// The daily episode (Parth, 12-13 Oct 2026: two hosts, Ashu (Aoede) and Tarun (Rasalgethi), from Allahabad, 6 to 8 minutes, free and
// automatic, for his phone and his wife's in Apple Podcasts). Runs on GitHub Actions when an edition is pushed
// (.github/workflows/podcast.yml):
//   1. the running order from the edition (lib.mjs rundown), by the paper's desks, nothing outside it;
//   2. Gemini (free tier, always the main writer first; "busy" is waited out) writes the conversation; checked and sent
//      back up to twice; the best script that passes the hard checks is voiced; else Flash Lite; else a plain script;
//   3. Gemini TTS (free tier) voices it: each host alone in one take, cut into lines (solo), else one take of both;
//      if every Gemini voice fails or comes back cut short, Kokoro (open source) voices the same script ("kokoro" job);
//   4. the studio (studio.mjs) makes it a radio show and an MP3; it goes to Vercel Blob with the feed, episodes older
//      than keep_days removed.
// Never touches the repo. Secrets: GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN (GitHub Actions secrets).
//   node scripts/podcast/make.mjs [YYYY-MM-DD] [--force] [--dry]   (--feed: only rebuild feed.xml from the kept episodes)
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rundown, writerPrompt, checkScript, fallbackScript, spoken, feedXML, deepItems, splitLines, cutAt, onAir } from "./lib.mjs";
import { layout, mix } from "./studio.mjs";
import { afterClose } from "../../lib/after-close.js";

const args = process.argv.slice(2), FORCE = args.includes("--force"), DRY = args.includes("--dry"), FEED_ONLY = args.includes("--feed");
// A voice sample (--sample) is a test run on the same day as the episode: it spends at most two voice requests (one
// solo take per host, no retries, no fallbacks), so the day's episode always keeps at least eight of the ten
const SAMPLE = args.some(a => a.startsWith("--sample="));
const H = new URL("../../", import.meta.url).pathname, OUT = `${H}.podcast`;
const cfg = JSON.parse(readFileSync(`${H}config/house.json`, "utf8")), P = cfg.podcast || {};
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const latest = JSON.parse(readFileSync(`${H}content/latest.json`, "utf8"));
const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || latest.edition || latest.date || today;
const file = `${H}content/editions/${date}.json`;
if (!existsSync(file)) { console.log(`podcast: no edition for ${date}; nothing to do`); process.exit(0); } // nothing logged after it
const E = JSON.parse(readFileSync(file, "utf8"));
const KEY = process.env.GEMINI_API_KEY, BLOB = process.env.BLOB_READ_WRITE_TOKEN;
if (!DRY && (!KEY || !BLOB)) { console.error("podcast: GEMINI_API_KEY and BLOB_READ_WRITE_TOKEN are needed"); process.exit(1); }
// The feed's folder name is derived from the Blob token, so it is unguessable and needs no extra secret
const folder = `podcast/${createHash("sha256").update(`${BLOB || "dry"}:house-of-1400-podcast`).digest("hex").slice(0, 24)}`;
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("podcast:", ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GEM = "https://generativelanguage.googleapis.com/v1beta/models";
// Node's fetch gives up on any answer slower than five minutes (13 Oct: two rewrites died at exactly 300 s, "fetch
// failed", although we allow nine); undici (installed with @vercel/blob) lifts that, each call keeps its own timeout
try { const { Agent, setGlobalDispatcher } = await import("undici"); setGlobalDispatcher(new Agent({ headersTimeout: 600000, bodyTimeout: 600000 })); } catch { /* the five-minute default stays */ }
// Deadlines, so the episode still goes out before 15:45 IST however busy Gemini is: the writers start new rounds until
// WRITE_BY (15:10 IST) and no writer call runs past STOP (15:20 IST); then the best script so far is voiced. A run that
// starts later (a backup, a test) gets ten and twenty-five minutes from its start.
const t0 = Date.now(), istAt = (h, m) => Date.parse(`${new Date(t0 + 5.5 * 36e5).toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
const late = t0 > istAt(15, 0), WRITE_BY = late ? t0 + 10 * 60000 : istAt(15, 10), STOP = late ? t0 + 25 * 60000 : istAt(15, 20);
// "busy" (429, 500, 503) is waited out a minute at a time, up to `tries` attempts in all (the main writer's first
// try: six, about five minutes; 3.8 Flash was busy for over three minutes at a time on 12-13 Oct, and refused
// requests count against the free day's twenty)
async function gemini(model, body, tries = 2, waitMs = 300000) {
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now();
    // a stuck request fails in time instead of holding the job (the writer thinks for up to four minutes; voicing
    // seven minutes takes under a minute)
    const r = await fetch(`${GEM}/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(waitMs) });
    log(`${model}: ${r.status} in ${Math.round((Date.now() - t0) / 1000)} s`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const msg = `${model} ${r.status}: ${j.error?.message || ""}`.slice(0, 600);
    // out of the day's free requests ("retry in 23h...") is final for this model today: never waited for
    if ([429, 500, 503].includes(r.status) && i + 1 < tries && !/limit: 0\b|retry in \d+h/i.test(`${msg} ${JSON.stringify(j.error?.details || "")}`)) { log(msg, "- busy, waiting a minute"); await sleep(62000); continue; }
    const final = /limit: 0\b|retry in \d+h|PerDay/i.test(`${msg} ${JSON.stringify(j.error?.details || "")}`);
    throw Object.assign(new Error(final && r.status === 429 ? `${msg} [out of the day's free requests]` : msg), { http: r.status });
  }
}

// 2. The script. Gemini's free models are often all "busy" at once, and a refused request still counts against the
// day's free twenty (12-13 Oct). The first writer (3.8 Flash) is waited for, a minute at a time, up to ten minutes
// (14 Oct); then the first answer rotates: one request to each strong writer in turn (3.8, 3.7, 3.6,
// 3.5 Flash), a minute between rounds, up to five rounds; a writer out of free requests for the day is skipped. The
// writer that answers does the rewrites (up to three tries in all, each refusal's reasons sent back), and its best
// script that passes the hard checks is used. Flash Lite only when no strong writer answered; the plain code script
// only when nothing usable came back.
async function writeScript(R) {
  const base = writerPrompt(R, P), all = P.text_models || ["gemini-3.8-flash"], strong = all.filter(m => !/lite/.test(m)), lite = all.filter(m => /lite/.test(m));
  // at most `writer_budget` requests to any one writer in a run (busy refusals count against its free twenty a day too),
  // so a redo the same day still has requests left
  const used = {}, budget = P.writer_budget ?? 15;
  const ask = (model, prompt, tries) => {
    const left = STOP - Date.now();
    if (left < 45000) return Promise.reject(Object.assign(new Error(`${model}: out of time for the writers`), { http: 0 }));
    if ((used[model] || 0) >= budget) return Promise.reject(Object.assign(new Error(`${model}: ${budget} requests used in this run; the rest of its day is kept for a redo`), { http: 0 }));
    used[model] = (used[model] || 0) + 1;
    return gemini(model, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9 } }, tries, Math.min(540000, left));
  };
  const turnsOf = j => { const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "", body = text.replace(/^```(?:json)?|```$/g, "").trim(); return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1)).turns; };
  const busy = e => [500, 503].includes(e.http) || (e.http === 429 && !/retry in \d+h|limit: 0\b|PerDay|day's free requests/i.test(e.message));
  let first = null, last = [];
  const out = new Set();
  // Waiting for the first writer (Parth, 14 Oct: "more tries under the limit for 3.8"; on 14 Oct 3.8 was busy once
  // and 3.7 wrote the script): while 3.8 is busy it is asked again a minute later, up to `first_writer_waits` (ten)
  // times, before the next writer is tried. The wait ends at once when 3.8 is out of its day's free requests (a final
  // refusal is never waited for), at the run's budget for it, or when fewer than ten minutes are left before WRITE_BY,
  // so the other writers still get their turn.
  const head = strong[0], waits = P.first_writer_waits ?? 10;
  let waited = 0;
  for (let k = 0; head && k <= waits && !first; k++) {
    if (k) {
      if (WRITE_BY - Date.now() < 10 * 60000) { log(`${head}: no more waiting, ten minutes to the writing deadline`); break; }
      log(`${head} busy; asking again in a minute (${k} of ${waits})`); await sleep(60000); waited++;
    }
    try { first = { model: head, j: await ask(head, base, 1) }; }
    catch (e) { last = [e.message]; log(`writer ${head}:`, e.message.split("\n")[0].slice(0, 160)); if (!busy(e)) { out.add(head); break; } }
  }
  // then the rotation: five rounds at least, then more while there is time before WRITE_BY (13 Oct redo: every writer
  // busy for minutes); 3.8, just asked, sits out the first round
  for (let round = 0; (round < 5 || (round < 12 && Date.now() < WRITE_BY)) && !first; round++) {
    if (strong.every(m => out.has(m))) break; // every strong writer out of free requests (or out of time)
    if (round) { log(`every strong writer busy; round ${round + 1} in a minute`); await sleep(60000); }
    for (const m of strong) {
      if (out.has(m) || (round === 0 && m === head)) continue;
      try { first = { model: m, j: await ask(m, base, 1) }; break; }
      catch (e) { last = [e.message]; log(`writer ${m}:`, e.message.split("\n")[0].slice(0, 160)); if (!busy(e)) out.add(m); }
    }
  }
  // A rewrite goes to the writer that answered, else to the next free strong writer (13 Oct: 3.8 Flash wrote a
  // 10-minute draft and was busy for every rewrite, so the long draft went out); up to two rounds a minute apart.
  const rewriteAsk = async (model, prompt) => {
    const order = first ? [model, ...strong.filter(m => m !== model && !out.has(m))] : [model];
    let err;
    // rounds a minute and a half apart while there is time before WRITE_BY (13 Oct redo: eighteen busy refusals in a
    // row over fourteen minutes, then the unrevised 1,534-word draft went out)
    for (let round = 0; round === 0 || (round < 8 && Date.now() < WRITE_BY); round++) {
      if (round) await sleep(90000);
      for (const m of order) {
        try { const j = await ask(m, prompt, 1); if (m !== model) log(`rewrite by ${m}`); return j; }
        catch (e) { err = e; log(`rewrite ${m}:`, e.message.split("\n")[0].slice(0, 120)); if (!busy(e)) out.add(m); }
      }
    }
    throw err;
  };
  for (const model of first ? [first.model] : lite) {
    let prompt = base, best = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const j = attempt === 0 && first ? first.j : await rewriteAsk(model, prompt);
        const turns = turnsOf(j), probs = checkScript(turns, R, P), hard = probs.filter(p => p.hard);
        log(`script by ${model} (try ${attempt + 1}): ${turns.length} turns, ${probs.length ? probs.map(p => (p.hard ? "HARD " : "") + p.msg).slice(0, 8).join("; ") : "no problems"}`);
        if (!hard.length && (!best || probs.length < best.n)) best = { turns, by: model, n: probs.length };
        if (!probs.length) break;
        last = probs.map(p => p.msg);
        prompt = `${base}\n\nYOUR PREVIOUS SCRIPT (below) was sent back for: ${last.join("; ")}. Rewrite it, fixing exactly these and keeping everything else that works.\n${JSON.stringify({ turns })}`;
      } catch (e) {
        last = [e.message]; log(`writer ${model} failed:`, e.message.split("\n")[0].slice(0, 200));
        if (!best && (e.http || e.name === "TimeoutError" || e.name === "AbortError")) break;
      }
    }
    if (best) {
      log(`script chosen: ${model}, ${best.n} soft problem(s) left`);
      return { turns: best.turns, by: model };
    }
  }
  log("using the plain script made by code; the writer's last problems:", last.slice(0, 4).join("; "));
  return { turns: fallbackScript(R, P), by: "code" };
}

// WAV helpers: Gemini returns a WAV (RIFF) or raw 16-bit PCM at 24 kHz mono
const wavHeader = (n, rate = 24000) => { const b = Buffer.alloc(44); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n, 40); return b; };
function pcmOf(buf) {
  if (buf.slice(0, 4).toString() !== "RIFF") return buf;
  let o = 12; while (o < buf.length - 8) { const id = buf.slice(o, o + 4).toString(), size = buf.readUInt32LE(o + 4); if (id === "data") return buf.slice(o + 8, o + 8 + size); o += 8 + size; }
  return buf.slice(44);
}

// 3. The voice
let voiceModel = null, soloPieces = null; // the Gemini voice model that made the take (for the episode record and the Telegram message)
const hostVoice = Object.fromEntries((P.hosts || []).map(h => [h.id, h.voice]));
// Every line opens with the same fixed description of its speaker, word for word, so the voice and accent stay put for
// the whole take (Parth, 13 Oct: the man's accent changed several times and it did not sound Indian); the mood is after
const hostStyle = Object.fromEntries((P.hosts || []).map(h => [h.id, h.voice_style || ""]));
const styleOf = t => `${hostStyle[t.speaker] || ""} ${t.speaker}'s voice and accent stay exactly the same in every line. ${P.style || ""} Tone of this line: ${(P.moods || {})[t.mood] || t.mood || (P.moods || {}).neutral || "conversational"}.`.trim();
async function ttsGemini(turns) {
  const speakers = { multiSpeakerVoiceConfig: { speakerVoiceConfigs: Object.entries(hostVoice).map(([speaker, voiceName]) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName } } })) } };
  const moods = [...new Set(turns.map(t => t.mood))].filter(m => (P.moods || {})[m]).map(m => `${m}: ${(P.moods || {})[m]}`).join("; ");
  // The transcript as one text with "Name: line" labels and ONE instruction for the whole take: the form of Parth's
  // favourite sample (his AI Studio tester, 12 Oct), and the main form from 14 Oct, because a different instruction on
  // every line let Tarun's voice and accent drift (Parth, 13 Oct). Feeling comes from the words, not per-line styles.
  const transcript = list => ({
    contents: [{ role: "user", parts: [{ text: `${P.voice_instruction || `${P.style || ""} ${Object.values(hostStyle).join(" ")}`} Match each moment's tone to its news: lively and warm for good news, gentle and serious for sad news, never laughing near it. Read this conversation exactly as written:\n\n${list.map(t => `${t.speaker}: ${spoken(t.text, P.pronounce)}`).join("\n")}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: speakers },
  });
  // One part per turn (3.8 refuses a transcript: "Multi-speaker generation requests must specify speech_metadata.speaker
  // for each text part", sample run of 13 Oct) with the SAME style text on every line of a speaker, word for word: one
  // instruction for the whole take, as in the transcript form, with no per-line mood to pull the voice around
  const steadyStyle = sp => `${P.voice_instruction || P.style || ""} ${hostStyle[sp] || ""} Match each moment's tone to its news: lively and warm for good news, gentle and serious for sad news, never laughing near it.`.trim();
  const steady = list => ({
    contents: [{ role: "user", parts: list.map(t => ({ text: spoken(t.text, P.pronounce), speech_metadata: { speaker: t.speaker, style: steadyStyle(t.speaker) } })) }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: speakers },
  });
  // One part per turn with its own style and mood (the documented 3.8 form)
  const perTurn = list => ({
    contents: [{ role: "user", parts: list.map(t => ({ text: spoken(t.text, P.pronounce), speech_metadata: { speaker: t.speaker, style: styleOf(t) } })) }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: speakers },
  });
  const one = async (list, form, model) => {
    const j = await gemini(model, form(list), 2);
    const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) throw new Error(`no audio in the answer (${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || "?"})`);
    log(`audio: ${part.inlineData.mimeType || "?"}`);
    return pcmOf(Buffer.from(part.inlineData.data, "base64"));
  };
  // Solo: each host alone, all their lines in ONE single-voice take, then cut at the pauses and put back in order. With
  // one voice in a take there is nothing for the voice or accent to drift towards (Parth, 13 Oct: Tarun still
  // inconsistent at 5/10 with the steady form). Two calls an episode. If a take will not split cleanly, the steady form.
  const solo = async (list, model) => {
    const hosts = [...new Set(list.map(t => t.speaker))], lines = new Map();
    for (const sp of hosts) {
      const mine = list.filter(t => t.speaker === sp), texts = mine.map(t => spoken(t.text, P.pronounce));
      const other = hosts.find(h => h !== sp) || "a friend";
      // One part per line with the speaker and a fixed style as metadata (14 Oct: a single text with the instruction in
      // front was read out loud, "Ashu is a woman from Allahabad..."; metadata never is), only this host's lines
      const body = {
        contents: [{ role: "user", parts: texts.map(text => ({ text, speech_metadata: { speaker: sp, style: `${steadyStyle(sp)} Leave a clear pause after each line.` } })) }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: speakers },
      };
      // two takes at most for each host: a take that will not split is tried once more before the fallback
      let pieces = null;
      // one take a host (14 Oct): a take the pauses cannot cut is cut by ear instead of asking Gemini again
      for (let go = 1; go <= 1 && !pieces; go++) {
        const j = await gemini(model, body, 2), part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
        if (!part) { if (go === 2) throw new Error(`no audio for ${sp} (${j.candidates?.[0]?.finishReason || "?"})`); continue; }
        const take = pcmOf(Buffer.from(part.inlineData.data, "base64"));
        writeFileSync(`${OUT}/solo-${sp}-${go}.wav`, Buffer.concat([wavHeader(take.length), take])); // kept as a run artifact, to see why a split failed
        pieces = splitLines(take, texts.map(t => t.split(/\s+/).length));
        if (!pieces) log(`solo: ${sp}'s take ${go} did not split into ${texts.length} lines by its pauses; cutting it by ear`);
        else if (!listen(sp, go, pieces, texts)) pieces = null;
        // the same take cut by ear (the listening model's word times), before asking Gemini for another take
        if (!pieces) { pieces = byEar(sp, go, take, texts); if (pieces && !listen(sp, `${go}e`, pieces, texts)) pieces = null; }
        if (!pieces && go === 1 && !SAMPLE) log(`solo: ${sp}'s take ${go}: once more`);
      }
      if (!pieces) throw new Error(`${sp}'s takes did not cut cleanly into ${texts.length} lines (by the pauses or by ear)`);
      mine.forEach((t, i) => lines.set(t, pieces[i]));
      log(`solo: ${sp}, ${texts.length} lines`);
    }
    // back in the script's order, a short breath between speakers and a shorter one when the same host goes on
    const gap = s => Buffer.alloc(Math.round(24000 * s) * 2);
    soloPieces = list.map(t => ({ speaker: t.speaker, pcm: lines.get(t) })); // for the studio's two mics and timing
    return Buffer.concat(list.flatMap((t, i) => [i ? gap(list[i - 1].speaker === t.speaker ? 0.2 : 0.32) : Buffer.alloc(0), lines.get(t)]));
  };
  // The listening check (verify_lines.py, Parth, 13 Oct: "how are we sure this will happen accurately?"): every cut
  // piece is transcribed by an open-source speech-to-text model on the runner and must say its own line. A cut that
  // fails is rejected like one that would not split. If the check itself cannot run, solo is given up at once (the
  // steady form is voiced instead): a cut is never published unheard.
  const listen = (sp, go, pieces, texts) => {
    const dir = `${OUT}/verify`, job = `${dir}/${sp}-${go}.json`, res = `${dir}/${sp}-${go}.out.json`;
    mkdirSync(dir, { recursive: true });
    const list = pieces.map((p, i) => { const f = `${dir}/${sp}-${go}-${i + 1}.wav`; writeFileSync(f, Buffer.concat([wavHeader(p.length), p])); return { wav: f, text: texts[i] }; });
    writeFileSync(job, JSON.stringify({ model: P.verify_model || "base.en", pieces: list }));
    try { execFileSync(process.env.PODCAST_PYTHON || "python3", [`${H}scripts/podcast/verify_lines.py`, job, res], { stdio: ["ignore", "inherit", "inherit"], timeout: 8 * 60000 }); }
    catch (e) { throw new Error(`the listening check could not run (${String(e.message).split("\n")[0].slice(0, 160)}); no unheard cut is used`); }
    const r = JSON.parse(readFileSync(res, "utf8")), bad = r.pieces.map((x, i) => [i, x]).filter(([, x]) => !x.ok);
    if (bad.length) log(`solo: ${sp}'s take ${go} cut in the wrong place: line ${bad.map(([i, x]) => `${i + 1} heard "${x.heard.slice(0, 60)}"`).join("; line ")}`);
    else log(`solo: ${sp}'s take ${go}: every line heard as written`);
    return !bad.length;
  };
  // Cutting by ear: the listening model times every word of the whole take, and the cuts go between the lines' words
  const byEar = (sp, go, take, texts) => {
    const dir = `${OUT}/verify`, wav = `${dir}/${sp}-${go}-take.wav`, job = `${dir}/${sp}-${go}-align.json`, res = `${dir}/${sp}-${go}-align.out.json`;
    mkdirSync(dir, { recursive: true }); writeFileSync(wav, Buffer.concat([wavHeader(take.length), take]));
    writeFileSync(job, JSON.stringify({ model: P.verify_model || "base.en", take: wav, lines: texts }));
    try { execFileSync(process.env.PODCAST_PYTHON || "python3", [`${H}scripts/podcast/verify_lines.py`, job, res], { stdio: ["ignore", "inherit", "inherit"], timeout: 8 * 60000 }); }
    catch (e) { log(`solo: cutting by ear could not run (${String(e.message).split("\n")[0].slice(0, 120)})`); return null; }
    const r = JSON.parse(readFileSync(res, "utf8"));
    if (!r.ok) { log(`solo: ${sp}'s take ${go} could not be cut by ear: ${r.why}`); return null; }
    const pieces = cutAt(take, r.cuts, { start: r.start, end: r.end });
    if (!pieces) log(`solo: ${sp}'s take ${go}: the cuts by ear did not hold`);
    return pieces;
  };
  // One take (Parth, 13 Oct: no chunks). The steady form first (config podcast.voice_form), per-turn second.
  const words = turns.reduce((a, t) => a + spoken(t.text, P.pronounce).split(/\s+/).length, 0);
  // The main voice model in its two accepted forms, then the other Gemini voice models (same voices) in the transcript form
  const [main, ...others] = P.tts_models || [P.tts_model || "gemini-3.8-flash-tts"];
  const forms = { steady, "per-turn": perTurn, transcript };
  const lead = forms[P.voice_form] ? P.voice_form : "steady";
  const first = [...(P.voice_form === "solo" ? [[main, "solo", "solo"]] : []), [main, lead, forms[lead]], ...["steady", "per-turn"].filter(n => n !== lead).map(n => [main, n, forms[n]])];
  const takes = SAMPLE && P.voice_form === "solo" ? [[main, "solo", "solo"]] : [...first, ...others.map(m => [m, "transcript", transcript])];
  for (const [model, name, form] of takes) {
    try {
      soloPieces = null;
      const pcm = form === "solo" ? await solo(turns, model) : await one(turns, form, model), secs = pcm.length / 48000;
      // faster than 230 words a minute means the take was cut off
      if (secs < (words / 230) * 60) throw new Error(`came back cut short (${Math.round(secs)} s for ${words} words)`);
      log(`voice: ${model}, ${name}`); voiceModel = model;
      return pcm;
    } catch (e) { soloPieces = null; log(`voicing as one ${name} take on ${model} failed: ${e.message}`); await sleep(21000); }
  }
  throw new Error("every one-take voice failed");
}

// Kokoro (open source, on the runner's CPU) voices the same script when Gemini cannot
function ttsKokoro(turns) {
  const K = P.kokoro || {}, inp = `${OUT}/turns.json`, wav = `${OUT}/kokoro.wav`;
  writeFileSync(inp, JSON.stringify({ lang: K.lang || "a", voices: K.voices || {}, turns: turns.map(t => ({ speaker: t.speaker, mood: t.mood, text: spoken(t.text, P.pronounce).replace(/<[^>]+>/g, "") })) }));
  execFileSync(process.env.PODCAST_PYTHON || "python3", [`${H}scripts/podcast/kokoro_voice.py`, inp, wav], { stdio: "inherit", timeout: 40 * 60000 });
  return pcmOf(readFileSync(wav));
}

// The studio (studio.mjs): jingle, stings, outro, the room, two mics and natural timing, as .podcast/episode.mp3; the
// seconds it runs. Two mics and timing need each line as its own piece (the solo voice form); a single take gets the
// rest. If the studio fails for any reason, the plain levelled MP3 goes out instead: the episode never fails here.
function produce(turns, pcm) {
  writeFileSync(`${OUT}/episode.wav`, Buffer.concat([wavHeader(pcm.length), pcm]));
  if (P.studio !== false) {
    try {
      const L = layout({ turns, pieces: soloPieces, take: soloPieces ? null : pcm, date, pan: P.pan || {}, music: P.music !== false });
      mix(L, OUT, `${OUT}/episode.mp3`);
      log(`studio: ${soloPieces ? "two mics, natural timing" : "one take"}, ${P.music === false ? "no music" : `${L.marks} sting(s)`}, ${Math.round(L.seconds)} s`);
      return L.seconds;
    } catch (e) { log("studio failed, plain mix instead:", e.message.split("\n")[0].slice(0, 200)); }
  }
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${OUT}/episode.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", `${OUT}/episode.mp3`]);
  return pcm.length / 48000;
}

// 4. Store and publish
async function blob() { return import("@vercel/blob"); }
const site = (cfg.site?.url || process.env.SITE_URL || "https://house14.vercel.app").replace(/\/+$/, "");
const served = f => `${site}/${folder}/${f}`; // the site's /podcast/<secret>/<file> route (api/podcast.js)
// the feed from every episode still kept; older ones are deleted
async function publishFeed({ put, list, del, get }) {
  const { blobs } = await list({ prefix: `${folder}/`, token: BLOB }), cut = new Date(Date.now() - (P.keep_days || 14) * 864e5).toISOString().slice(0, 10);
  const episodes = [], old = [];
  for (const b of blobs.filter(b => /\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname))) {
    const d = b.pathname.match(/(\d{4}-\d{2}-\d{2})\.json$/)[1];
    if (d < cut) { old.push(b.url, b.url.replace(/\.json$/, ".mp3")); continue; }
    const g = await get(b.pathname, { access: "private", useCache: false, token: BLOB }).catch(() => null);
    const m = g?.stream ? await new Response(g.stream).json().catch(() => null) : null; if (m) episodes.push(m);
  }
  if (old.length) { await del(old, { token: BLOB }).catch(e => log("could not delete old episodes:", e.message)); log(`removed ${old.length / 2} old episode(s)`); }
  const image = P.image ? new URL(P.image, site + "/").href : null;
  await put(`${folder}/feed.xml`, feedXML({ P, base: site, episodes, image }), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/rss+xml; charset=utf-8", cacheControlMaxAge: 300, token: BLOB });
  return episodes.length;
}
async function main() {
  // --models: the models this key can call, and a one-line ping of each text writer (does not write an episode)
  if (args.includes("--models")) {
    const r = await fetch(`${GEM}?pageSize=200`, { headers: { "x-goog-api-key": KEY } }), j = await r.json().catch(() => ({}));
    log(`models (${r.status}):`, (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")).map(m => m.name.replace("models/", "")).join(", "));
    return;
  }
  // --sample=FILE: voice a short given script ({turns}) with the day's voices and settings, nothing published (to hear
  // a change before an episode carries it)
  const sample = args.find(a => a.startsWith("--sample="))?.slice(9);
  if (sample) {
    const { turns } = JSON.parse(readFileSync(`${H}${sample}`, "utf8")), pcm = await ttsGemini(turns);
    const secs = produce(turns, pcm);
    log(`sample: ${Math.round(secs)} s from ${sample}`); return;
  }
  const { put, list, del, get } = DRY ? {} : await blob();
  if (FEED_ONLY) { const n = await publishFeed({ put, list, del, get }); log(`feed rebuilt (${n} in the feed)`); log(`FEED ${served("feed.xml")}`); return; }
  // --force on a published day is a redo: the new take goes up under a new file and episode id (-v2, -v3), the feed
  // switches to it, and only then is the old file deleted, so a failed redo leaves the old episode up (Parth, 13 Oct)
  let prior = null;
  if (!DRY) {
    const { blobs } = await list({ prefix: `${folder}/${date}.json`, token: BLOB });
    if (blobs.length && !FORCE) { log(`episode for ${date} already published`); return; }
    if (blobs.length) { const g = await get(`${folder}/${date}.json`, { access: "private", useCache: false, token: BLOB }).catch(() => null); prior = g?.stream ? await new Response(g.stream).json().catch(() => null) : null; }
  }
  const v = prior ? (prior.v || 1) + 1 : 1, file = v > 1 ? `${date}-v${v}.mp3` : `${date}.mp3`;
  // a big move after yesterday's paper went to press, with the paper's reason (from 15 Oct; lib/after-close.js)
  let after_close = null;
  try {
    const prev = readdirSync(`${H}content/editions`).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${date}.json`).sort().pop();
    const AC = cfg.pool?.after_close;
    if (prev && AC?.from && date >= AC.from) { const moves = afterClose(E, JSON.parse(readFileSync(`${H}content/editions/${prev}`, "utf8")), cfg.pool); if (moves.length) after_close = { moves, why: E.checks?.after_close?.why || null }; }
  } catch (e) { log("after-close: skipped,", e.message); }
  const R = rundown(E, P, undefined, { desks: cfg.desks_v2?.desks, sections: cfg.sections, follows: cfg.follows, betting: cfg.betting, after_close });
  R.on_air = onAir(); // the radio time check, from the clock as the script is written
  if (!R.lead) { log("the edition has no lead; nothing to say"); return; }
  const KOKORO = process.env.PODCAST_VOICE === "kokoro", saved = existsSync(`${OUT}/script.json`) ? JSON.parse(readFileSync(`${OUT}/script.json`, "utf8")) : null;
  // the Kokoro step (podcast.yml) reuses the script the first step wrote
  const { turns, by } = KOKORO && saved?.date === date ? saved : DRY && !KEY ? { turns: fallbackScript(R, P), by: "code" } : await writeScript(R);
  writeFileSync(`${OUT}/script.json`, JSON.stringify({ date, by, turns }, null, 1));
  // A script from Flash Lite or the code is held back once: at the edition push, and only before 14:35 IST, so the
  // 14:40 run can try the strong writers again. Every later run publishes whatever it gets (Parth, 13 Oct: the
  // episode is ready before 15:45 IST at any cost).
  const ist = new Date(Date.now() + 5.5 * 36e5), early = ist.getUTCHours() * 60 + ist.getUTCMinutes() < 14 * 60 + 35;
  if (!DRY && !KOKORO && !args.includes("--final") && early && (/lite/.test(by) || by === "code")) { log(`script by ${by}: holding it back for the 14:40 IST run, which publishes whatever it gets`); return; }
  // a redo never swaps a published episode for a weaker script (Flash Lite or the code's plain one)
  if (prior && !DRY && (/lite/.test(by) || by === "code")) { log(`redo: script by ${by}, keeping the published episode`); return; }
  log(`script: ${turns.length} turns, ${turns.reduce((a, t) => a + t.text.split(/\s+/).length, 0)} words, by ${by}`);
  if (DRY && !KEY) { log("dry run: script written to .podcast/script.json"); return; }
  let pcm, voice = KOKORO ? "kokoro" : "gemini";
  if (KOKORO) pcm = ttsKokoro(turns);
  else try { pcm = await ttsGemini(turns); }
  catch (e) { throw new Error(`Gemini voice failed (${e.message}); the Kokoro step takes over`); }
  const seconds = produce(turns, pcm), bytes = statSync(`${OUT}/episode.mp3`).size;
  log(`audio: ${Math.round(seconds)} s, ${Math.round(bytes / 1024)} KB, voice ${voice}`);
  if (DRY) { log("dry run: .podcast/episode.mp3"); return; }
  await put(`${folder}/${file}`, readFileSync(`${OUT}/episode.mp3`), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "audio/mpeg", token: BLOB });
  const day = new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const meta = { date, title: `${day} · ${R.lead.headline}`, description: deepItems(R).map(s => s.headline).join(" · "), url: served(file), v, bytes, seconds, published: new Date().toISOString(), by, voice, voice_model: KOKORO ? "kokoro" : voiceModel };
  await put(`${folder}/${date}.json`, JSON.stringify(meta), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: BLOB });
  const n = await publishFeed({ put, list, del, get });
  log(`published ${date}${v > 1 ? ` (take ${v})` : ""} (${n} in the feed)`);
  const was = prior?.url?.split("/").pop();
  if (was && was !== file) await del(`${folder}/${was}`, { token: BLOB }).then(() => log(`removed the old take ${was}`)).catch(e => log(`could not remove the old take ${was}:`, e.message));
  log(`FEED ${served("feed.xml")}`);
  // a separate Telegram message that the episode is in Apple Podcasts, with its writer and voice (api/notify.js; once a day)
  await fetch(`${site}/api/notify?podcast=${date}&k=${folder.split("/")[1]}`, { method: "POST", signal: AbortSignal.timeout(30000) })
    .then(r => r.json()).then(j => log("telegram:", j.sent ? "sent" : j.reason)).catch(e => log("telegram: not sent:", e.message));
}
// exitCode, not process.exit: exiting at once can drop the last log lines on a pipe
main().catch(e => { console.error("podcast: failed:", e.message); process.exitCode = 1; });
