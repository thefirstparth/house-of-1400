// The daily episode (Parth, 12-13 Oct 2026: two hosts, Ashu (Aoede) and Tarun (Rasalgethi), from Allahabad, 6 to 8 minutes, free and
// automatic, for his phone and his wife's in Apple Podcasts). Runs on GitHub Actions when an edition is pushed
// (.github/workflows/podcast.yml):
//   1. the running order from the edition (lib.mjs rundown), by the paper's desks, nothing outside it;
//   2. Gemini (free tier, always the main writer first; "busy" is waited out) writes the conversation; checked and sent
//      back up to twice; the best script that passes the hard checks is voiced; else Flash Lite; else a plain script;
//   3. Gemini TTS (free tier) voices it in one take, per-turn mood as style; if that fails or comes back cut short,
//      Kokoro (open source) voices the same script (the "kokoro" job);
//   4. ffmpeg levels it and makes an MP3; it goes to Vercel Blob with the feed, episodes older than keep_days removed.
// Never touches the repo. Secrets: GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN (GitHub Actions secrets).
//   node scripts/podcast/make.mjs [YYYY-MM-DD] [--force] [--dry]   (--feed: only rebuild feed.xml from the kept episodes)
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rundown, writerPrompt, checkScript, fallbackScript, spoken, feedXML, deepItems } from "./lib.mjs";

const args = process.argv.slice(2), FORCE = args.includes("--force"), DRY = args.includes("--dry"), FEED_ONLY = args.includes("--feed");
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
    throw Object.assign(new Error(msg), { http: r.status });
  }
}

// 2. The script. Gemini's free models are often all "busy" at once, and a refused request still counts against the
// day's free twenty (12-13 Oct), so the first answer rotates: one request to each strong writer in turn (3.8, 3.7, 3.6,
// 3.5 Flash), a minute between rounds, up to five rounds; a writer out of free requests for the day is skipped. The
// writer that answers does the rewrites (up to three tries in all, each refusal's reasons sent back), and its best
// script that passes the hard checks is used. Flash Lite only when no strong writer answered; the plain code script
// only when nothing usable came back.
async function writeScript(R) {
  const base = writerPrompt(R, P), all = P.text_models || ["gemini-3.8-flash"], strong = all.filter(m => !/lite/.test(m)), lite = all.filter(m => /lite/.test(m));
  const ask = (model, prompt, tries) => gemini(model, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9 } }, tries, 540000);
  const turnsOf = j => { const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "", body = text.replace(/^```(?:json)?|```$/g, "").trim(); return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1)).turns; };
  const busy = e => [500, 503].includes(e.http) || (e.http === 429 && !/retry in \d+h/i.test(e.message));
  let first = null, last = [];
  const out = new Set();
  for (let round = 0; round < 5 && !first; round++) {
    if (round) { log(`every strong writer busy; round ${round + 1} in a minute`); await sleep(60000); }
    for (const m of strong) {
      if (out.has(m)) continue;
      try { first = { model: m, j: await ask(m, base, 1) }; break; }
      catch (e) { last = [e.message]; log(`writer ${m}:`, e.message.split("\n")[0].slice(0, 160)); if (!busy(e)) out.add(m); }
    }
  }
  // A rewrite goes to the writer that answered, else to the next free strong writer (13 Oct: 3.8 Flash wrote a
  // 10-minute draft and was busy for every rewrite, so the long draft went out); up to two rounds a minute apart.
  const rewriteAsk = async (model, prompt) => {
    const order = first ? [model, ...strong.filter(m => m !== model && !out.has(m))] : [model];
    let err;
    for (let round = 0; round < 2; round++) {
      if (round) await sleep(60000);
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
    if (best) { log(`script chosen: ${model}, ${best.n} soft problem(s) left`); return { turns: best.turns, by: model }; }
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
let voiceModel = null; // the Gemini voice model that made the take (for the episode record and the Telegram message)
const hostVoice = Object.fromEntries((P.hosts || []).map(h => [h.id, h.voice]));
// Every line opens with the same fixed description of its speaker, word for word, so the voice and accent stay put for
// the whole take (Parth, 13 Oct: the man's accent changed several times and it did not sound Indian); the mood is after
const hostStyle = Object.fromEntries((P.hosts || []).map(h => [h.id, h.voice_style || ""]));
const styleOf = t => `${hostStyle[t.speaker] || ""} ${t.speaker}'s voice and accent stay exactly the same in every line. ${P.style || ""} Tone of this line: ${(P.moods || {})[t.mood] || t.mood || (P.moods || {}).neutral || "conversational"}.`.trim();
async function ttsGemini(turns) {
  const speakers = { multiSpeakerVoiceConfig: { speakerVoiceConfigs: Object.entries(hostVoice).map(([speaker, voiceName]) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName } } })) } };
  const moods = [...new Set(turns.map(t => t.mood))].filter(m => (P.moods || {})[m]).map(m => `${m}: ${(P.moods || {})[m]}`).join("; ");
  // The transcript as one text with "Name: line" labels (the form Parth's AI Studio tester proved on this model)
  const transcript = list => ({
    contents: [{ role: "user", parts: [{ text: `${Object.values(hostStyle).join(" ")} Their voices and accents stay exactly the same from the first line to the last. ${P.style || ""} Match each moment's tone to its news (${moods}); never laugh near sad news. Read this conversation exactly as written:\n\n${list.map(t => `${t.speaker}: ${spoken(t.text, P.pronounce)}`).join("\n")}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: speakers },
  });
  // One part per turn with its own style (the documented 3.8 form)
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
  // One take (Parth, 13 Oct: no chunks). Per-turn first, it carries each moment's mood; the transcript form second.
  const words = turns.reduce((a, t) => a + spoken(t.text, P.pronounce).split(/\s+/).length, 0);
  // The main voice model in both forms, then the other Gemini voice models (same voices) in the transcript form
  const [main, ...others] = P.tts_models || [P.tts_model || "gemini-3.8-flash-tts"];
  const takes = [[main, "per-turn", perTurn], [main, "transcript", transcript], ...others.map(m => [m, "transcript", transcript])];
  for (const [model, name, form] of takes) {
    try {
      const pcm = await one(turns, form, model), secs = pcm.length / 48000;
      // faster than 230 words a minute means the take was cut off
      if (secs < (words / 230) * 60) throw new Error(`came back cut short (${Math.round(secs)} s for ${words} words)`);
      log(`voice: ${model}, ${name}`); voiceModel = model;
      return pcm;
    } catch (e) { log(`voicing as one ${name} take on ${model} failed: ${e.message}`); await sleep(21000); }
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
    writeFileSync(`${OUT}/episode.wav`, Buffer.concat([wavHeader(pcm.length), pcm]));
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${OUT}/episode.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", `${OUT}/episode.mp3`]);
    log(`sample: ${Math.round(pcm.length / 48000)} s from ${sample}`); return;
  }
  const { put, list, del, get } = DRY ? {} : await blob();
  if (FEED_ONLY) { const n = await publishFeed({ put, list, del, get }); log(`feed rebuilt (${n} in the feed)`); log(`FEED ${served("feed.xml")}`); return; }
  if (!DRY && !FORCE) {
    const { blobs } = await list({ prefix: `${folder}/${date}.json`, token: BLOB });
    if (blobs.length) { log(`episode for ${date} already published`); return; }
  }
  const R = rundown(E, P, undefined, { desks: cfg.desks_v2?.desks, sections: cfg.sections, follows: cfg.follows, betting: cfg.betting });
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
  log(`script: ${turns.length} turns, ${turns.reduce((a, t) => a + t.text.split(/\s+/).length, 0)} words, by ${by}`);
  if (DRY && !KEY) { log("dry run: script written to .podcast/script.json"); return; }
  let pcm, voice = KOKORO ? "kokoro" : "gemini";
  if (KOKORO) pcm = ttsKokoro(turns);
  else try { pcm = await ttsGemini(turns); }
  catch (e) { throw new Error(`Gemini voice failed (${e.message}); the Kokoro step takes over`); }
  writeFileSync(`${OUT}/episode.wav`, Buffer.concat([wavHeader(pcm.length), pcm]));
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${OUT}/episode.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", `${OUT}/episode.mp3`]);
  const seconds = pcm.length / 48000, bytes = statSync(`${OUT}/episode.mp3`).size;
  log(`audio: ${Math.round(seconds)} s, ${Math.round(bytes / 1024)} KB, voice ${voice}`);
  if (DRY) { log("dry run: .podcast/episode.mp3"); return; }
  await put(`${folder}/${date}.mp3`, readFileSync(`${OUT}/episode.mp3`), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "audio/mpeg", token: BLOB });
  const day = new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const meta = { date, title: `${day} · ${R.lead.headline}`, description: deepItems(R).map(s => s.headline).join(" · "), url: served(`${date}.mp3`), bytes, seconds, published: new Date().toISOString(), by, voice, voice_model: KOKORO ? "kokoro" : voiceModel };
  await put(`${folder}/${date}.json`, JSON.stringify(meta), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: BLOB });
  const n = await publishFeed({ put, list, del, get });
  log(`published ${date} (${n} in the feed)`);
  log(`FEED ${served("feed.xml")}`);
  // a separate Telegram message that the episode is in Apple Podcasts, with its writer and voice (api/notify.js; once a day)
  await fetch(`${site}/api/notify?podcast=${date}&k=${folder.split("/")[1]}`, { method: "POST", signal: AbortSignal.timeout(30000) })
    .then(r => r.json()).then(j => log("telegram:", j.sent ? "sent" : j.reason)).catch(e => log("telegram: not sent:", e.message));
}
// exitCode, not process.exit: exiting at once can drop the last log lines on a pipe
main().catch(e => { console.error("podcast: failed:", e.message); process.exitCode = 1; });
