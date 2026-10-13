// The studio: the radio sound around the voices (Parth, 13 Oct: "studio radio" package, items 1, 2, 3, 4 and 6).
//  1. a jingle at the top, a short sting before each part the writer marks, an outro bed under the sign-off;
//  2. one shared room: gentle EQ and compression on the voices and a faint room tone under everything;
//  3. two mics: Ashu a little left, Tarun a little right (only when each line is its own piece, the solo voice form);
//  4. natural timing: varied gaps, quick reactions slipping in just before the other host finishes.
// The music is made here in code (no licence to worry about): Raag Bhupali's five notes (Sa Re Ga Pa Dha, in D) on a
// soft bell over a tanpura-like drone. Everything is deterministic for a given date, so a rerun sounds the same.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const RATE = 24000;
const TAU = Math.PI * 2, hz = m => 440 * 2 ** ((m - 69) / 12);

// a bell-like note (a little inharmonic, quick attack, long decay) added into a mono buffer
function bell(buf, t, midi, dur, amp) {
  const f = hz(midi), s0 = Math.floor(t * RATE), n = Math.min(buf.length - s0, Math.floor(dur * RATE));
  const parts = [[1, 1, 1.6], [2, 0.42, 1.0], [3.01, 0.16, 0.6], [4.2, 0.07, 0.35]];
  for (let i = 0; i < n; i++) {
    const x = i / RATE, att = Math.min(1, x / 0.004);
    let v = 0; for (const [k, a, d] of parts) v += a * Math.exp(-x / d) * Math.sin(TAU * f * k * x);
    buf[s0 + i] += amp * att * v;
  }
}
// a soft drone (Sa and Pa, like a tanpura heard from across the room): slow swell, a gentle beat between voices
function drone(buf, t, dur, amp, root = 50) {
  const s0 = Math.floor(t * RATE), n = Math.min(buf.length - s0, Math.floor(dur * RATE));
  const notes = [[root, 1], [root + 7, 0.6], [root + 12, 0.45]];
  for (let i = 0; i < n; i++) {
    const x = i / RATE, env = Math.min(1, x / 0.9) * Math.min(1, (dur - x) / 1.2);
    let v = 0;
    for (const [m, a] of notes) for (const [det, w] of [[0, 1], [0.35, 0.5]]) {
      const f = hz(m) + det;
      for (let k = 1; k <= 5; k++) v += (a * w / k) * Math.sin(TAU * f * k * x + k);
    }
    buf[s0 + i] += amp * env * v * (0.85 + 0.15 * Math.sin(TAU * 0.7 * x));
  }
}
// every music piece is scaled to the same safe peak (the jingle's last chord summed past full scale and would clip)
const peak = (b, to = 0.7) => { let m = 0; for (const x of b) m = Math.max(m, Math.abs(x)); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= to / m; return b; };
const D = 74, SA = D, RE = 76, GA = 78, PA = 81, DHA = 83, SA2 = 86, PA_ = 69, DHA_ = 71; // Bhupali in D
export function jingle() {
  const b = new Float32Array(Math.round(4.6 * RATE));
  drone(b, 0, 4.6, 0.05);
  const beat = 0.24;
  [[0, PA_], [1, SA], [2, RE], [3, GA], [4, PA], [6, GA], [7, RE]].forEach(([i, m]) => bell(b, i * beat, m, 1.4, 0.32));
  bell(b, 8 * beat, SA, 2.6, 0.36); bell(b, 8 * beat, PA_, 2.6, 0.2); bell(b, 8 * beat + 0.02, GA - 12, 2.4, 0.14);
  return peak(b);
}
export function sting() {
  const b = new Float32Array(Math.round(1.7 * RATE));
  [[0, SA], [0.11, GA], [0.22, PA]].forEach(([t, m]) => bell(b, t, m, 1.4, 0.3));
  bell(b, 0.22, SA - 12, 1.4, 0.12);
  return peak(b, 0.55);
}
export function outro() {
  const b = new Float32Array(Math.round(7.5 * RATE));
  drone(b, 0, 7.5, 0.05);
  [[0.5, SA2], [0.74, DHA], [0.98, PA], [1.22, GA], [1.46, RE]].forEach(([t, m]) => bell(b, t, m, 1.5, 0.28));
  bell(b, 1.8, SA, 4.5, 0.34); bell(b, 1.8, PA_, 4.5, 0.18); bell(b, 1.82, DHA_ - 12, 4.2, 0.1);
  return peak(b);
}

// a small seeded random, so the timing is the same on a rerun of the same day
const rng = seed => { let x = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261) || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
const f32 = pcm => { const o = new Float32Array(pcm.length >> 1); for (let i = 0; i < o.length; i++) o[i] = pcm.readInt16LE(i * 2) / 32768; return o; };
const wordsIn = t => String(t || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const SERIOUS = new Set(["bad", "sombre", "concerned", "gentle"]);

// Lays out the show. pieces: [{ speaker, pcm }] one per turn (solo), or take: one PCM of the whole conversation.
// Returns { voice: [L, R], music: [L, R] or null, seconds, marks } (Float32 stereo at RATE). music: false leaves out
// the jingle, stings and outro (Parth, 13 Oct: "remove all audio for now", config podcast.music).
export function layout({ turns, pieces, take, date = "", pan = {}, music = true }) {
  const rand = rng(date), none = new Float32Array(0), J = music ? jingle() : none, S = music ? sting() : none, O = music ? outro() : none, gap = s => Math.round(s * RATE);
  const lines = pieces ? pieces.map((p, i) => ({ ...turns[i], audio: f32(p.pcm) })) : [{ speaker: null, audio: f32(take) }];
  // where each line starts, in samples
  let t = music ? J.length - gap(1.1) : gap(0.3), last = -1e9;
  const place = [], stings = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1], n = l.audio.length;
    if (i) {
      let g = 0.3 + (rand() - 0.5) * 0.16;
      if (/\?\s*$/.test(prev.text || "")) g = 0.2 + rand() * 0.08;
      if (prev.speaker === l.speaker) g = 0.22;
      if (SERIOUS.has(prev.mood) || SERIOUS.has(l.mood)) g = 0.5;
      // a quick reaction slips in just before the other host finishes (never on serious news)
      if (wordsIn(l.text) <= 3 && prev.speaker !== l.speaker && !SERIOUS.has(prev.mood) && !SERIOUS.has(l.mood)) g = -Math.min(0.22, place[i - 1].n / RATE * 0.12);
      t = place[i - 1].at + place[i - 1].n + gap(g);
      // a sting before a marked part (not in the opening, never within twenty seconds of the last)
      if (music && l.segment && i > 2 && t - last > gap(20)) { t += gap(0.25); stings.push(t); last = t; t += gap(1.05); }
    }
    place.push({ at: Math.max(0, t), n, speaker: l.speaker });
  });
  const end = place.at(-1).at + place.at(-1).n, outroAt = Math.max(place.at(-1).at - gap(0.6), end - gap(2.2)), total = music ? Math.max(end + gap(3.8), outroAt + O.length) : end + gap(1);
  const vL = new Float32Array(total), vR = new Float32Array(total), mono = new Float32Array(total);
  // two mics: constant-power pan
  place.forEach((p, i) => {
    const x = pieces ? (pan[p.speaker] ?? 0) : 0, gl = Math.cos((x + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((x + 1) * Math.PI / 4) * Math.SQRT2, a = lines[i].audio;
    for (let k = 0; k < a.length && p.at + k < total; k++) { vL[p.at + k] += a[k] * gl; vR[p.at + k] += a[k] * gr; }
  });
  const add = (buf, at, g = 1) => { for (let k = 0; k < buf.length && at + k < total; k++) mono[at + k] += buf[k] * g; };
  add(J, 0); stings.forEach(s => add(S, s)); add(O, outroAt);
  // the music dips under the voices (ducking), with smooth 0.25 s ramps
  const talk = new Uint8Array(Math.ceil(total / 240) + 1);
  for (const p of place) for (let b = Math.floor(p.at / 240); b <= Math.floor((p.at + p.n) / 240); b++) talk[b] = 1;
  let g = 1; const step = 240 / (0.25 * RATE);
  for (let k = 0; k < total; k++) { const want = talk[Math.floor(k / 240)] ? 0.16 : 1; g += Math.sign(want - g) * Math.min(Math.abs(want - g), step / 240); mono[k] *= g; }
  // nothing past full scale where pieces overlap (a reaction over the other host, a sting over the jingle's tail):
  // turned down if needed, never up; the loudness step after the mix sets the level
  const top = bufs => bufs.reduce((m, b) => { for (const x of b) m = Math.max(m, Math.abs(x)); return m; }, 0);
  for (const bufs of [[vL, vR], [mono]]) { const m = top(bufs); if (m > 0.95) for (const b of bufs) for (let k = 0; k < b.length; k++) b[k] *= 0.95 / m; }
  return { voice: [vL, vR], music: music ? [mono, mono] : null, seconds: total / RATE, marks: stings.length };
}

const wav = ([L, R]) => {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4); b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4); }
  return b;
};

// The mix: voices through the room (EQ, compression, early reflections), the music with a little space, a faint room
// tone under both, then loudness to podcast level (-16 LUFS) as a 128 kbps stereo MP3.
export function mix({ voice, music, seconds }, dir, out) {
  writeFileSync(`${dir}/voice.wav`, wav(voice));
  const room = "highpass=f=75,equalizer=f=200:t=q:w=1:g=1.5,equalizer=f=6500:t=q:w=1.5:g=-1.5,acompressor=threshold=0.1:ratio=2.5:attack=10:release=150:makeup=1.6,aecho=0.9:0.5:23|37:0.10|0.07";
  // no music: the voices alone through the same treatment, with no room tone either (nothing added but the voices)
  if (!music) return execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${dir}/voice.wav`, "-af", `${room},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100`, "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "128k", out]);
  writeFileSync(`${dir}/music.wav`, wav(music));
  const fc = [
    `[0:a]${room}[v]`,
    "[1:a]aecho=0.8:0.6:60|97|141:0.3|0.2|0.14,volume=0.55[m]",
    `anoisesrc=color=pink:amplitude=0.0016:sample_rate=${RATE}:duration=${seconds.toFixed(2)},aformat=channel_layouts=stereo[r]`,
    "[v][m][r]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[o]",
  ].join(";");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${dir}/voice.wav`, "-i", `${dir}/music.wav`, "-filter_complex", fc, "-map", "[o]", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "128k", out]);
}
