// A voice trial (Parth, 28 Nov 2026: "can we do a run on Sarvam for today's script?"): voices a published episode's
// script again with Sarvam's Bulbul, so Parth can hear it beside the Gemini episode. Nothing in the feed changes.
//   node scripts/podcast/sarvam.mjs [YYYY-MM-DD] [--model=bulbul:v4-flash] [--pairs=ashuVoice+tarunVoice,...]
// The script is the day's published transcript (/listen/<date>.vtt, "<v Ashu>line"), one request per line, joined with a
// short gap between hosts and levelled with ffmpeg. Each pair is saved as /listen/sample-<date>-<n>.mp3 (api/podcast.js),
// in the episode folder, so the clean-up that drops old days does not keep them for long. Pay as you go: about Rs 2 per
// 1,000 characters on v4 Flash, so about Rs 15 for a 7,700-character episode per pair.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2), opt = k => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
const MODEL = opt("model") || "bulbul:v4-flash";
// v4 Flash's conversational personas (Sarvam's docs list no podcast style; these read as two people talking)
const PAIRS = (opt("pairs") || "simran_en_conversation+dev_en_conversational,roopa_en_conversational+deven_en_conversation").split(",").map(p => p.split("+"));
const KEY = process.env.SARVAM_API_KEY, BLOB = process.env.BLOB_READ_WRITE_TOKEN, SITE = "https://house14.vercel.app";
const log = (...a) => console.log("sarvam:", ...a);
if (!KEY) { log("no SARVAM_API_KEY: add it as a GitHub Actions secret"); process.exit(1); }

function turnsOfVtt(vtt) {
  return [...vtt.matchAll(/<v ([^>]+)>([^\n]+)/g)].map(([, speaker, text]) => ({ speaker: speaker.trim(), text: text.replace(/<\/v>/g, "").trim() })).filter(t => t.text);
}

async function say(text, speaker) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST", headers: { "api-subscription-key": KEY, "content-type": "application/json" }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ text, language_code: "en-IN", model: MODEL, speaker, enable_preprocessing: true, speech_sample_rate: 24000, output_audio_codec: "wav" }),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok) { const j = await r.json(); return Buffer.from((j.audios || []).join(""), "base64"); }
    const body = (await r.text()).slice(0, 200);
    if (r.status === 402 || r.status === 403 || r.status === 400) throw new Error(`Sarvam ${r.status}: ${body}`);
    log(`Sarvam ${r.status}, trying again`, body); await new Promise(s => setTimeout(s, 2000 * (i + 1)));
  }
  throw new Error("Sarvam did not answer");
}

const vtt = await (await fetch(`${SITE}/listen/${date}.vtt`)).text();
const turns = turnsOfVtt(vtt);
if (turns.length < 10) { log(`no transcript for ${date}`); process.exit(1); }
const chars = turns.reduce((a, t) => a + t.text.length, 0);
log(`${date}: ${turns.length} lines, ${chars} characters, ${MODEL}, about Rs ${(chars / 1000 * (/v3/.test(MODEL) ? 3 : 2)).toFixed(0)} a pair`);
const OUT = ".podcast/sarvam"; mkdirSync(OUT, { recursive: true });
const hosts = [...new Set(turns.map(t => t.speaker))];
const made = [];
for (const [n, pair] of PAIRS.entries()) {
  const voice = Object.fromEntries(hosts.map((h, i) => [h, pair[/tarun/i.test(h) ? 1 : /ashu/i.test(h) ? 0 : i] || pair[0]]));
  log(`pair ${n + 1}: ${Object.entries(voice).map(([h, v]) => `${h} = ${v}`).join(", ")}`);
  const list = [];
  // 0.12 s of silence between lines by the same host, 0.32 s when the other host comes in
  for (const s of [0.12, 0.32]) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(s), `${OUT}/gap${s}.wav`]);
  for (const [i, t] of turns.entries()) {
    const f = `${OUT}/p${n}-${String(i).padStart(3, "0")}.wav`;
    writeFileSync(f, await say(t.text, voice[t.speaker]));
    if (i) list.push(`file 'gap${turns[i - 1].speaker === t.speaker ? 0.12 : 0.32}.wav'`);
    list.push(`file '${f.split("/").pop()}'`);
  }
  writeFileSync(`${OUT}/list${n}.txt`, list.join("\n") + "\n");
  const mp3 = `${OUT}/sample-${date}-${n + 1}.mp3`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${OUT}/list${n}.txt`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-b:a", "128k", mp3]);
  const secs = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim());
  log(`pair ${n + 1}: ${Math.round(secs)} s`);
  made.push({ mp3, voice, secs });
}
if (BLOB) {
  const { put } = await import("@vercel/blob");
  const folder = `podcast/${createHash("sha256").update(`${BLOB}:house-of-1400-podcast`).digest("hex").slice(0, 24)}`;
  for (const m of made) {
    const name = m.mp3.split("/").pop();
    await put(`${folder}/${name}`, readFileSync(m.mp3), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "audio/mpeg", token: BLOB });
    log(`SAMPLE ${SITE}/listen/${name} (${Object.values(m.voice).join(" and ")}, ${Math.round(m.secs)} s)`);
  }
}
log(`the Gemini episode to compare: ${SITE}/listen/${date}.mp3`);
