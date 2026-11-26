import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { spoken, intWords, rundown, checkScript, fallbackScript, feedXML, sayWhen, splitLines, cutAt, onAir, SEGMENTS, writerPrompt, cutNote, vttOf } from "../scripts/podcast/lib.mjs";
import { layout, jingle, sting, outro, RATE } from "../scripts/podcast/studio.mjs";

const C = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8")), P = C.podcast;
const paper = { desks: C.desks_v2.desks, sections: C.sections };

test("podcast: numbers and symbols are said the Indian way", () => {
  assert.equal(intWords(14843000), "one crore forty-eight lakh forty-three thousand");
  assert.equal(spoken("SIPs hit ₹32,490 crore"), "SIPs hit thirty-two thousand four hundred and ninety crore rupees");
  assert.equal(spoken("India lead 2–1"), "India lead two-one");
  assert.equal(spoken("fell 0.76% to 71,920"), "fell zero point seven six per cent to seventy-one thousand nine hundred and twenty");
  assert.equal(spoken("the 4th T20I at 19:00", P.pronounce), "the fourth T twenty international at seven p m");
  assert.doesNotMatch(spoken("₹1,48,430 for 10 grams, $2.5 billion"), /\d|₹|\$|%/);
});

const E = {
  date: "2026-10-12", house_note: "A note.",
  front: { lead: { id: "max", section: "paddock", kicker: "F1 · Singapore", headline: "Max wins in Singapore", short: "Max won. He led every session.", tone: "good" },
    seconds: [{ id: "riyadh", section: "videsh", kicker: "World · Gulf", headline: "Riyadh strike kills 13", short: "Thirteen died.", tone: "bad" },
      { id: "jantar", section: "desh", kicker: "India · Protest", headline: "Delhi Police shut Jantar Mantar to protests", short: "Three grounds instead.", tone: "neutral" }], briefs: [] },
  sections: { namma: { briefs: [{ id: "bmtc", section: "namma", headline: "BMTC shares live bus data", text: "Map apps get it." }] },
    deuce: { briefs: [{ id: "alcaraz", section: "deuce", kicker: "Tennis", headline: "Alcaraz beats Cerundolo in Shanghai", text: "Straight sets." }] } },
  art_scores: [{ story_id: "max", importance: 3 }, { story_id: "riyadh", importance: 3 }],
  chronology: { madrid: { next: { when_utc: "2026-10-14T19:00:00Z", label: "AS Roma", detail: "Away · Champions League" } } },
  snapshot: { markets: { value: { indices: [{ name: "Sensex", price: 22365, change_pct: -0.69, session_date: "2026-10-12" }] } } },
};

test("podcast: the running order follows the paper's desks, lead first, and times are said the way people say them", () => {
  const R = rundown(E, P, undefined, paper), all = R.segments.flatMap(g => g.items), desk = id => all.find(i => i.id === id)?.desk;
  assert.equal(R.lead.id, "max");
  assert.deepEqual(R.segments[0].items.map(i => i.id), ["riyadh", "jantar"]); // Page One first, in the paper's order
  assert.equal(R.segments[0].desk, "Page One");
  assert.equal(desk("jantar"), "News");           // Delhi is News, never Close to Home
  assert.equal(desk("bmtc"), "Close to Home");
  assert.equal(desk("alcaraz"), "Sport");
  assert.match(R.segments.find(g => g.desk === "Money").markets[0], /Sensex at about 22,400, down 0.7%/);
  assert.match(R.segments.find(g => g.desk === "Sport").coming[0], /on Thursday at twelve thirty a m, late on Wednesday night/);
  assert.equal(sayWhen("2026-10-14T13:30:00Z", Date.parse("2026-10-12T09:00:00Z")), "on Wednesday at seven p m");
  assert.equal(sayWhen("2026-10-12T10:00:00Z", Date.parse("2026-10-12T09:00:00Z")), "today at three thirty p m");
});

test("podcast: a script that reads the paper, laughs at a tragedy or talks about the process is refused; the code script always exists", () => {
  const R = rundown(E, P, undefined, paper), hard = ps => ps.filter(p => p.hard).map(p => p.msg).join(" | "), all = ps => ps.map(p => p.msg).join(" | ");
  const chat = ["Max finally won in Singapore, at the tenth attempt.", "Ten tries? Wow.", "Is Riyadh safe now?", "Not really, sadly.", "What about Jantar Mantar?", "Shut to protests.", "And buses?", "BMTC is sharing live data.", "Alcaraz?", "Through in straight sets.", "Roma next for Madrid?", "Yes, on Thursday at twelve thirty a m, late on Wednesday night."];
  const pad = " and that is the gist of the whole afternoon as we heard it from friends over tea".repeat(23);
  const turns = chat.map((t, i) => ({ speaker: i % 2 ? "Tarun" : "Ashu", mood: "warm", text: i % 4 === 0 ? t + pad : t }));
  assert.equal(hard(checkScript(turns, R, P)), "");
  const bad = turns.map(t => ({ ...t }));
  bad[2] = { speaker: "Ashu", mood: "sombre", text: "The Riyadh strike killed thirteen. <laugh>" };
  bad[3] = { speaker: "Tarun", mood: "warm", text: "Turning to Delhi, we waited for a second source on that." };
  bad[5] = { speaker: "Tarun", mood: "warm", text: "Max wins in Singapore Max won. He led every session." };
  const ps = checkScript(bad, R, P);
  assert.match(hard(ps), /laughter/);
  assert.match(hard(ps), /how the show is made/);
  assert.match(all(ps), /stock phrase "Turning to"/);
  const fb = fallbackScript(R, P);
  assert.ok(fb.length >= 6 && fb.every(t => ["Ashu", "Tarun"].includes(t.speaker)));
});

test("podcast: the hosts are a woman and a man, with different voices", () => {
  const [a, b] = P.hosts;
  assert.notEqual(a.voice, b.voice);
  assert.deepEqual([a.gender, b.gender].sort(), ["man", "woman"]);
});

test("podcast: the feed is private (blocked from Apple's directory) and lists the newest first", () => {
  const ep = d => ({ date: d, title: `Ep ${d}`, description: "x & y", url: `https://b/${d}.mp3`, bytes: 1000, seconds: 360, published: `${d}T09:30:00Z` });
  const xml = feedXML({ P, base: "https://house14.vercel.app", episodes: [ep("2026-10-12"), ep("2026-10-13")] });
  assert.match(xml, /<itunes:block>Yes<\/itunes:block>/);
  assert.ok(xml.indexOf("2026-10-13") < xml.indexOf("2026-10-12"));
  assert.match(xml, /x &amp; y/);
});

test("podcast: a redo is a new episode to Apple Podcasts (new guid), and the server serves its file", async () => {
  const xml = feedXML({ P, base: "https://b", episodes: [{ date: "2026-10-13", v: 2, title: "t", description: "d", url: "https://b/2026-10-13-v2.mp3", bytes: 1, seconds: 1, published: "2026-10-13T10:00:00Z" }] });
  assert.match(xml, /<guid isPermaLink="false">h1400-2026-10-13-v2<\/guid>/);
  const src = readFileSync(new URL("../api/podcast.js", import.meta.url), "utf8"), OK_F = new RegExp(src.match(/OK_F = \/(.+?)\/;/)[1]);
  assert.ok(OK_F.test("2026-10-13-v2.mp3") && OK_F.test("2026-10-13.mp3") && !OK_F.test("x.mp3"));
});

test("podcast: every step the episode maker calls is defined (the Kokoro fallback was lost once in an edit, 13 Oct)", () => {
  const src = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  for (const f of ["writeScript", "ttsGemini", "ttsKokoro", "publishFeed", "gemini", "pcmOf", "wavHeader"]) {
    if (new RegExp(`\\b${f}\\(`).test(src)) assert.match(src, new RegExp(`(function ${f}\\b|const ${f} =)`), `${f} is called but not defined`);
  }
});

test("podcast: what is coming up is the paper's Fixture List (Warriors pre-season marked; national sides not on it)", () => {
  const T = Date.parse("2026-10-12T09:00:00Z"), at = h => new Date(T + h * 36e5).toISOString();
  const E2 = { ...E, chronology: {}, snapshot: { ...E.snapshot,
    football: { value: { next: [{ date: at(34), opponent: "AS Roma", home: false, competition: "Champions League" }] } },
    intl_football: { value: { matches: [{ home: "Spain", away: "Georgia", when_utc: at(30), state: "pre" }] } },
    nba: { value: { team: "Golden State Warriors", in_season: false, next: [{ date: at(17), preseason: true, opponent: "Los Angeles Lakers", home: false }] } } } };
  const R = rundown(E2, P, undefined, { ...paper, follows: C.follows }), coming = R.segments.find(g => g.desk === "Sport").coming;
  assert.match(coming.join(" | "), /Los Angeles Lakers v Golden State Warriors, pre-season, tomorrow at seven thirty a m/);
  assert.match(coming.join(" | "), /AS Roma v Real Madrid, Champions League, on Wednesday at twelve thirty a m, late tomorrow night/);
  assert.doesNotMatch(coming.join(" | "), /Spain v Georgia/);
});

test("podcast: a host's single-voice take is cut back into its lines at the long pauses, and a bad take is refused", () => {
  // speech as noise at about 2.6 words a second with short breaths inside lines, then a long pause between lines
  const sec = x => Math.round(24000 * x), noise = n => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((Math.random() * 2 - 1) * 8000), i * 2); return b; };
  const quiet = n => Buffer.alloc(n * 2), words = [12, 3, 20, 8, 1];
  const take = lines => Buffer.concat([quiet(sec(0.3)), ...lines.flatMap((w, i) => {
    const half = sec(w / 2.6 / 2);
    return [noise(half), quiet(sec(w > 6 ? 0.35 : 0.05)), noise(half), quiet(sec(i < lines.length - 1 ? 1.6 : 0.4))];
  })]);
  const pieces = splitLines(take(words), words);
  assert.equal(pieces.length, words.length);
  pieces.forEach((p, i) => assert.ok(Math.abs(p.length / 48000 - words[i] / 2.6) < 0.6, `line ${i}: ${p.length / 48000} s`));
  // pauses between lines no longer than the breaths inside long lines (Tarun's take, 13 Oct) still split right
  const tight = [16, 3, 22, 9], even = Buffer.concat([quiet(sec(0.3)), ...tight.flatMap((w, i) => {
    const third = sec(w / 2.6 / 3);
    return [noise(third), quiet(sec(w > 6 ? 0.45 : 0)), noise(third), quiet(sec(w > 6 ? 0.45 : 0)), noise(third), quiet(sec(i < tight.length - 1 ? 0.45 : 0.3))];
  })]);
  const cut = splitLines(even, tight);
  assert.ok(cut, "an evenly paused take must split");
  cut.forEach((p, i) => assert.ok(Math.abs(p.length / 48000 - tight[i] / 2.6 - (tight[i] > 6 ? 0.9 : 0)) < 0.5, `tight line ${i}: ${p.length / 48000} s`));
  // a take read straight through, with no pauses between the lines, does not split
  const straight = Buffer.concat([quiet(sec(0.3)), ...words.map(w => noise(sec(w / 2.6))), quiet(sec(0.3))]);
  assert.ok(splitLines(straight, words) === null, "a take with no pauses must not split");
  // nor does one where a pause fell inside a long line and two short lines ran together (pieces far off their words)
  const off = Buffer.concat([quiet(sec(0.3)), noise(sec(2)), quiet(sec(1.6)), noise(sec(2)), quiet(sec(1.6)), noise(sec(9)), quiet(sec(0.3))]);
  assert.ok(splitLines(off, [5, 20, 5]) === null, "pieces far off their word counts must not split");
});

test("podcast: each market's figure is said once; the sign-off and segment marks are checked (Parth, 13 Oct)", () => {
  const T = (speaker, text, segment) => ({ speaker, mood: "neutral", text, ...(segment ? { segment } : {}) });
  const turns = [T("Ashu", "Welcome to The House of 1400, Bhide's paper."), T("Tarun", "Hello!"), ...Array.from({ length: 8 }, (_, i) => T(i % 2 ? "Tarun" : "Ashu", `Line ${i}?`)),
    T("Ashu", "The rupee firmed to ninety-five point two five today.", "money"), T("Tarun", "Nice."), T("Ashu", "The rupee is at ninety-five point two eight."), T("Tarun", "Bye from The House of 1400.")];
  const msgs = checkScript(turns, { segments: [], editor: "T. A. Bhide" }, { ...P, music: true, words: { min: 10, max: 9999 } }).map(p => p.msg);
  assert.ok(msgs.some(m => /figure for the rupee in 2 turns/.test(m)), msgs.join(" | "));
  assert.ok(msgs.some(m => /sign-off/.test(m)));
  assert.ok(msgs.some(m => /"segment" mark/.test(m)));
  assert.ok(!msgs.some(m => /numbers in one turn/.test(m)), "numbers are fine now");
  // the Nifty IT index is not the Nifty
  const ok = checkScript([...turns.slice(0, 10), T("Ashu", "The Nifty IT index rose three per cent."), T("Tarun", "And the Nifty is at twenty-two thousand.")], { segments: [] }, { ...P, words: { min: 10, max: 9999 } }).map(p => p.msg);
  assert.ok(!ok.some(m => /the Nifty in/.test(m)), ok.join(" | "));
  assert.ok(SEGMENTS.includes("fixture-watch") && SEGMENTS.includes("house-note"));
  assert.equal(onAir(Date.parse("2026-10-14T08:42:00Z")), "a little after two in the afternoon");
});

test("podcast: the studio lays out jingle, stings, two mics and natural timing, and never clips the music", () => {
  const tone = (secs, f) => { const n = Math.round(secs * RATE), b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin(2 * Math.PI * f * i / RATE)), i * 2); return b; };
  const turns = [], pieces = [];
  for (let i = 0; i < 24; i++) {
    const speaker = i % 2 ? "Tarun" : "Ashu", short = i % 5 === 3;
    turns.push({ speaker, mood: i === 9 ? "sombre" : "neutral", text: short ? "Arre wah!" : "A longer line with quite a few words in it here?", ...(i === 4 || i === 6 || i === 14 ? { segment: "news" } : {}) });
    pieces.push({ speaker, pcm: tone(short ? 0.6 : 4, speaker === "Ashu" ? 220 : 180) });
  }
  const L = layout({ turns, pieces, date: "2026-10-14", pan: { Ashu: -0.3, Tarun: 0.3 } });
  assert.equal(L.marks, 2, "a sting at turn 5 and turn 15; turn 7 is within twenty seconds of the last");
  const voiced = pieces.reduce((a, p) => a + p.pcm.length / 2, 0) / RATE;
  assert.ok(L.seconds > voiced && L.seconds < voiced + 30, `${L.seconds} s for ${voiced} s of voice`);
  // Ashu speaks first: during her first line the left channel is louder
  const [vl, vr] = L.voice, k0 = vl.findIndex(x => x !== 0); let dl = 0, dr = 0;
  for (let k = k0; k < k0 + RATE; k++) { dl += Math.abs(vl[k]); dr += Math.abs(vr[k]); }
  assert.ok(dl > dr * 1.5, `Ashu sits left (${dl} against ${dr})`);
  // a single take sits in the middle
  const one = layout({ turns, take: Buffer.concat(pieces.map(p => p.pcm)), date: "2026-10-14" });
  let d = 0; for (let k = 0; k < one.voice[0].length; k++) d += Math.abs(one.voice[0][k] - one.voice[1][k]); assert.ok(d < 1e-6);
  assert.equal(one.marks, 0);
  for (const b of [jingle(), sting(), outro()]) { let pk = 0; for (const x of b) pk = Math.max(pk, Math.abs(x)); assert.ok(pk > 0.05 && pk < 1, `music peak ${pk}`); }
  // no music (Parth, 13 Oct): voices only, no stings, no music track, and the writer is not asked for segment marks
  const quiet = layout({ turns, pieces, date: "2026-10-14", pan: { Ashu: -0.3, Tarun: 0.3 }, music: false });
  assert.equal(quiet.music, null); assert.equal(quiet.marks, 0);
  assert.ok(quiet.seconds < L.seconds - 5 && quiet.seconds > voiced - 3, `${quiet.seconds} s without music`);
  assert.ok(!/musical sting/.test(writerPrompt(rundown(E, P), { ...P, music: false })));
  assert.ok(!checkScript(Array.from({ length: 10 }, (_, i) => ({ speaker: i % 2 ? "Tarun" : "Ashu", mood: "neutral", text: "Hello there?" })), { segments: [] }, { ...P, music: false }).some(p => /segment/.test(p.msg)));
  // the same day lays out the same way (a rerun sounds the same)
  assert.equal(layout({ turns, pieces, date: "2026-10-14", pan: {} }).seconds, layout({ turns, pieces, date: "2026-10-14", pan: {} }).seconds);
});

test("podcast: every solo cut is heard before it is used (the listening check is installed and called)", () => {
  const make = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  const wf = readFileSync(new URL("../.github/workflows/podcast.yml", import.meta.url), "utf8");
  assert.match(make, /verify_lines\.py/);
  assert.match(make, /no unheard cut is used/, "a check that cannot run gives up solo, never skips the check");
  assert.match(wf, /requirements-verify\.txt/);
  assert.match(readFileSync(new URL("../scripts/podcast/requirements-verify.txt", import.meta.url), "utf8"), /^faster-whisper==\d/m);
});

test("podcast: a cut by ear goes into the pause, never the dip inside a word (16 Oct: \"eighty-\" | \"nine\")", () => {
  const sec = x => Math.round(24000 * x), noise = n => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((Math.random() * 2 - 1) * 8000), i * 2); return b; };
  const quiet = n => Buffer.alloc(n * 2);
  // line one runs to 3.0 s with a 60 ms dip (the "t" of "eighty") at 2.6 s; the real pause is 3.0 to 3.5 s; line two to 5.5 s
  const take = Buffer.concat([noise(sec(2.6)), quiet(sec(0.06)), noise(sec(0.34)), quiet(sec(0.5)), noise(sec(2)), quiet(sec(0.3))]);
  // the listening model's time runs early, right on the dip
  const p = cutAt(take, [2.63]);
  assert.equal(p.length, 2);
  assert.ok(Math.abs(p[0].length / 48000 - 3.0) < 0.2, `line one keeps its last sound: ${p[0].length / 48000} s`);
  assert.ok(Math.abs(p[1].length / 48000 - 2.0) < 0.2, `line two starts at its first word: ${p[1].length / 48000} s`);
  // no pause anywhere near: refused, so the caller falls back rather than cutting a word
  assert.equal(cutAt(Buffer.concat([noise(sec(6))]), [3]), null);
});

test("podcast: a cut that leaves one line far too slow and the next far too fast moves to the right pause (18 Oct)", () => {
  const sec = x => Math.round(24000 * x), noise = n => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((Math.random() * 2 - 1) * 8000), i * 2); return b; };
  const quiet = n => Buffer.alloc(n * 2);
  // line one: 20 words in 7 s; the pause between the lines 0.6 s; line two: 20 words, 2 s, a comma pause of 0.3 s, 5 s
  const take = Buffer.concat([noise(sec(7)), quiet(sec(0.6)), noise(sec(2)), quiet(sec(0.3)), noise(sec(5)), quiet(sec(0.3))]);
  // the listening model put the line's end at the comma ("...Ballon d'Or. Bhide noted the tragedy in Kolkata, | ...")
  const wrong = cutAt(take, [9.75]);
  assert.ok(Math.abs(wrong[0].length / 48000 - 9.6) < 0.25, "without the line lengths, the comma pause is kept");
  const p = cutAt(take, [9.75], { words: [20, 20] });
  assert.ok(Math.abs(p[0].length / 48000 - 7.0) < 0.25, `line one ends at its own end: ${p[0].length / 48000} s`);
  assert.ok(Math.abs(p[1].length / 48000 - 7.3) < 0.3, `line two keeps its first words: ${p[1].length / 48000} s`);
  // short lines are left alone (their pace varies too much to judge)
  assert.ok(Math.abs(cutAt(take, [9.75], { words: [6, 6] })[0].length / 48000 - 9.6) < 0.25);
});

test("podcast: the listening check does not fail a right cut on a laugh, a plural or a Hindi word (19 Oct)", (t) => {
  // "<laugh> Priorities sorted, ekdum!" heard as "Haha, priority sorted, egg." failed the check, so the day went out as
  // one take with no transcript
  const code = `import sys, json; sys.path.insert(0, "scripts/podcast"); import verify_lines as v
want = v.words("<laugh> Priorities sorted, ekdum!", True); got = v.words("Haha, priority sorted, egg.", False)
print(json.dumps({"want": want, "got": got, "f1": v.f1(want, got), "arre": v.words("Arre wah!", True)}))`;
  let out;
  try { out = JSON.parse(execFileSync("python3", ["-c", code], { encoding: "utf8" })); } catch { t.skip("python3 with numpy not here"); return; }
  assert.deepEqual(out.want, ["priority", "sorted"]);
  assert.deepEqual(out.got, ["priority", "sorted", "egg"]);
  assert.ok(out.f1 >= 0.35, `f1 ${out.f1}`);
  assert.deepEqual(out.arre, ["arre", "wah"], "a line of Hindi words alone keeps them");
});

test("podcast: a take cut by ear keeps only the lines, from the first line's start to the last line's end (14 Oct)", () => {
  const sec = x => Math.round(24000 * x), noise = n => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((Math.random() * 2 - 1) * 8000), i * 2); return b; };
  const quiet = n => Buffer.alloc(n * 2);
  // 6 s of instructions read out loud, then three lines of 2, 3 and 1 seconds with short gaps
  const take = Buffer.concat([noise(sec(6)), quiet(sec(0.5)), noise(sec(2)), quiet(sec(0.3)), noise(sec(3)), quiet(sec(0.3)), noise(sec(1)), quiet(sec(0.4))]);
  const p = cutAt(take, [8.65, 11.95], { start: 6.4, end: 13.2 });
  assert.equal(p.length, 3);
  [2, 3, 1].forEach((want, i) => assert.ok(Math.abs(p[i].length / 48000 - want) < 0.2, `piece ${i}: ${p[i].length / 48000} s`));
  assert.equal(cutAt(take, [11.95, 8.65]), null, "cuts out of order are refused");
});

test("podcast: only Ranchi and Prayagraj are 'back home' (14 Oct: 'back home in Bihar')", () => {
  const T = text => ({ speaker: "Ashu", mood: "neutral", text });
  const base = Array.from({ length: 9 }, (_, i) => T(`Line ${i}?`));
  const msgs = t => checkScript([...base, T(t)], { segments: [] }, { ...P, words: { min: 1, max: 9999 } }).map(p => p.msg);
  assert.ok(msgs("There is tragic news back home in Bihar.").some(m => /back home/.test(m)));
  assert.ok(!msgs("And back home in Prayagraj, the Magh Mela plans are out.").some(m => /back home/.test(m)));
  // 26 Nov 2026: the hosts are from Allahabad, so Ranchi is "over in Ranchi"
  assert.ok(msgs("And back home in Ranchi, flights are delayed.").some(m => /over in Ranchi/.test(m)));
});

test("podcast: the show is public, so no listener's name or family (15 Oct rehearsal)", () => {
  const T = text => ({ speaker: "Ashu", mood: "neutral", text });
  const base = Array.from({ length: 9 }, (_, i) => T(`Line ${i}?`));
  const msgs = t => checkScript([...base, T(t)], { segments: [] }, { ...P, words: { min: 1, max: 9999 } }).map(p => p.msg);
  assert.ok(msgs("Good afternoon, and hello to your wife listening in with us.").some(m => /family/.test(m)));
  assert.ok(msgs("Good afternoon, Parth.").some(m => /by name/.test(m)));
  assert.ok(!msgs("His wife told CBS News he is also battling cancer.").some(m => /family/.test(m)));
  assert.ok(!writerPrompt({ day: "Thursday 15 October", editor: "T. A. Bhide" }, P).includes("Parth and his wife"));
});

test("podcast length (15 Oct: 1,858 words, 12 minutes 23): a budget the writer can follow and a cut note for a long draft", () => {
  const C = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8")).podcast;
  assert.ok(C.words.max <= 1400 && C.words.target <= 1200, "about nine minutes at most");
  const p = writerPrompt({ day: "Thursday 15 October", editor: "T. A. Bhide" }, C);
  assert.match(p, /no turn over sixty words/);
  const T = (n, w = "word") => ({ speaker: "Ashu", mood: "neutral", text: Array(n).fill(w).join(" ") + "." });
  assert.equal(cutNote([T(50), T(50)], C), "");
  const note = cutNote([...Array(30)].map(() => T(55)).concat([T(110)]), C);
  assert.match(note, /LENGTH: the script is 1760 words; bring it down to about 1150 \(never over 1400\), cutting about 610 words/);
  assert.match(note, /turn 31 \(110\)/);
  const make = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  assert.match(make, /REWRITE_BY = Math\.min\(WRITE_BY, t0 \+ 16 \* 60000\)/);
});

test("podcast money (14 Oct): still open at two, the range in words, the Nasdaq-100, yesterday's late move", () => {
  const ix = (name, price, extra) => ({ name, price, change_pct: -0.3, chg_7d: 0.2, chg_1m: -2.7, lo3m: 71593, hi3m: 78955, ...extra });
  const Ed = { date: "2026-10-15", front: { lead: { id: "a", section: "desh", headline: "A lead", short: "x" } }, sections: {},
    snapshot: { markets: { value: { indices: [ix("Sensex", 72862, { session_date: "2026-10-15", live: true, market_time: "2026-10-15T08:23:00Z" }), ix("Nifty 50", 24600, { session_date: "2026-10-15", live: true, market_time: "2026-10-15T08:38:00Z", lo3m: 22232, hi3m: 24774 }), ix("Nasdaq-100", 30569, { session_date: "2026-10-14", live: false })] } } } };
  const moves = [{ name: "Sensex", printed: 72566, close: 73034, points: 468, pct: 0.64, day_pct: 1.54, session: "2026-10-14" }];
  const R = rundown(Ed, { ...P, indices: ["Sensex", "Nifty 50", "Nasdaq-100"] }, undefined, { ...paper, after_close: { moves, why: "Sitharaman said she would hear views on removing the LTCG tax." } });
  // from 15 Oct the show gives the Sensex and the Nasdaq-100 only (Parth, 14 Oct)
  const only = rundown(Ed, P, undefined, paper).segments.find(g => g.markets).markets;
  assert.deepEqual(only.map(x => x.split(" at ")[0]), ["Sensex", "the Nasdaq-100, New York's big technology index,"]);
  const m = R.segments.find(g => g.markets);
  assert.match(m.markets[0], /so far today/);
  assert.doesNotMatch(m.markets.join(" "), /between its|71,593|78,955/, "no range figures");
  assert.match(m.markets[1], /close to its highest in three months/);
  assert.match(m.markets.find(x => /Nasdaq/.test(x)), /last close \(Wednesday in New York, overnight for us\)/);
  assert.match(m.market_open, /13:53 IST/);
  assert.match(m.after_close[0], /closed yesterday at 73,034, 468 points above/);
  assert.match(m.after_close.at(-1), /LTCG/);
  const t = Array.from({ length: 8 }, (_, i) => ({ speaker: i % 2 ? "Tarun" : "Ashu", text: "Right." }));
  t[2].text = "The Sensex finished down a little today.";
  t[3].text = "Yesterday, after our paper, the Sensex closed eleven hundred points up.";
  t[4].text = "The Nifty slipped because investors fear American tariffs and election jitters.";
  const msgs = checkScript(t, R, P).map(p => p.msg);
  assert.ok(msgs.some(x => /turn 3: says an Indian index closed/.test(x)), msgs.join(" | "));
  assert.ok(!msgs.some(x => /turn 4: says an Indian index closed/.test(x)), "yesterday's close is fine");
  assert.ok(msgs.some(x => /turn 5: gives a reason/.test(x)), msgs.join(" | "));
});

test("podcast: Real Madrid weighs 7% more (Parth, 14 Oct), Atlético does not", () => {
  const C2 = { ...P, weights: [{ section: "madrid", words: "Real Madrid", factor: 1.07 }], quick_max: 1, deep_max: 2 };
  const Ed = { date: "2026-10-14", front: { lead: { id: "lead", section: "desh", headline: "A lead", short: "x" } },
    sections: { pitch: { briefs: [{ id: "atleti", section: "pitch", headline: "United lose at Atlético Madrid", text: "Two-nil." }, { id: "other", section: "pitch", headline: "Arsenal beat Lille", text: "Three-nil." }, { id: "third", section: "pitch", headline: "Inter draw at home", text: "One-all." }] },
      madrid: { briefs: [{ id: "rm", section: "madrid", headline: "Madrid play Roma tonight", text: "Huijsen is back." }] } } };
  const ids = R => [R.lead, ...R.segments.flatMap(g => g.items)].map(i => i.id);
  assert.ok(!ids(rundown(Ed, { ...C2, weights: [] }, undefined, paper)).includes("rm"), "without the weight, the paper's order decides");
  const got = ids(rundown(Ed, C2, undefined, paper));
  assert.ok(got.includes("rm"), got.join(","));
  assert.ok(!got.includes("atleti") || got.indexOf("atleti") > got.indexOf("rm"), "Atlético is not Real Madrid");
});

test("podcast: Sport gets 20% more places, gently (Parth, 14 Oct): four become five, from its own next-best stories", () => {
  const b = (id, section, headline) => ({ id, section, headline, text: "Something happened." });
  const Ed = { date: "2026-10-14", front: { lead: { id: "lead", section: "desh", headline: "A lead", short: "x" } },
    sections: { desh: { briefs: [1, 2, 3, 4, 5, 6].map(i => b(`n${i}`, "desh", `News item ${i}`)) },
      pitch: { briefs: [1, 2, 3, 4, 5, 6].map(i => b(`s${i}`, "pitch", `Football item ${i}`)) } } };
  const art = [...[1, 2, 3, 4].map(i => ({ story_id: `s${i}`, importance: 2 })), ...[1, 2, 3, 4, 5, 6].map(i => ({ story_id: `n${i}`, importance: 2 }))];
  const sport = W => { const R = rundown({ ...Ed, art_scores: art }, { ...P, deep_max: 2, quick_max: 8, weights: W }, undefined, paper); return [R.lead, ...R.segments.flatMap(g => g.items)].filter(i => i.desk === "Sport").map(i => i.id); };
  assert.equal(sport([]).length, 4);
  assert.deepEqual(sport([{ desk: "sport", factor: 1.2 }]).sort(), ["s1", "s2", "s3", "s4", "s5"]);
});

test("podcast: every desk, and Bengaluru, Prayagraj and Ranchi each, gets a place before News takes the ties (16 Oct)", () => {
  const b = (id, section, headline, kicker) => ({ id, section, headline, kicker, text: "Something happened." });
  const Ed = { date: "2026-10-16", front: { lead: { id: "lead", section: "desh", headline: "A lead", short: "x" } },
    sections: { desh: { briefs: [1, 2, 3, 4, 5, 6].map(i => b(`n${i}`, "desh", `News item ${i}`)) },
      pitch: { briefs: [b("s1", "pitch", "Palace lose at Lyon")] }, namma: { briefs: [b("blr", "namma", "Kumaraswamy at the police commissioner's")] },
      back: { briefs: [b("p1", "back", "Kasari-Masari renamed", "Prayagraj"), b("p2", "back", "Teliyarganj crossing", "Prayagraj"), b("r1", "back", "JCB opens in Ranchi", "Ranchi")] } } };
  const R = rundown(Ed, { ...P, deep_max: 2, quick_max: 4, weights: [] }, undefined, paper), ids = [R.lead, ...R.segments.flatMap(g => g.items)].map(i => i.id);
  for (const id of ["blr", "p1", "r1", "s1"]) assert.ok(ids.includes(id), `${id} missing: ${ids.join(",")}`);
  assert.ok(!ids.includes("p2"), "Prayagraj's second story waits until every place has one");
});

test("podcast: Sport says where the follows stand: league, championship, series (Parth, 14 Oct)", () => {
  const Ed = { date: "2026-10-14", front: { lead: { id: "lead", section: "desh", headline: "A lead", short: "x" } }, sections: { crease: { data: { rows: [{ label: "West Indies", text: "T20Is · 5 matches, 3 played · India lead 2–1" }, { label: "Next", text: "4th T20I" }] } } },
    snapshot: { laliga_table: { value: { rows: [{ rank: 1, team: "Barcelona", points: 24, played: 8 }, { rank: 2, team: "Atlético Madrid", points: 19, played: 8 }, { rank: 4, team: "Real Madrid", points: 18, played: 8 }] } },
      f1_standings: { value: { drivers: [{ pos: 1, name: "Andrea Kimi Antonelli", shown: "Kimi Antonelli", points: 340 }, { pos: 4, name: "Max Verstappen", points: 221 }] } } } };
  const g = rundown(Ed, P, undefined, { ...paper, follows: C.follows }).segments.find(x => x.standings);
  assert.deepEqual(g.standings, ["Real Madrid: 4th in La Liga on 18 points after 8 games, 6 behind the leaders Barcelona (on 24)", "Max Verstappen: 4th in the drivers' championship on 221 points, 119 behind the leader Kimi Antonelli", "India's cricket, West Indies: T20Is, 5 matches, 3 played, India lead 2–1"]);
});

test("podcast feed, listed (14 Oct): no block, owner, category, the public address; unlisted stays blocked", () => {
  const ep = { date: "2026-10-14", title: "t", description: "d", url: "https://house14.vercel.app/listen/2026-10-14.mp3", bytes: 1, seconds: 1, published: "2026-10-14T10:00:00Z" };
  const xml = feedXML({ P: { ...P, feed_url: "https://house14.vercel.app/listen" }, base: "https://house14.vercel.app", episodes: [ep] });
  assert.doesNotMatch(xml, /itunes:block/);
  assert.match(xml, /<itunes:owner><itunes:name>Parth Bhatia<\/itunes:name><itunes:email>parth@bhatia\.page<\/itunes:email><\/itunes:owner>/);
  assert.match(xml, /<itunes:category text="News"><itunes:category text="Daily News"\/><\/itunes:category>/);
  assert.match(xml, /<itunes:new-feed-url>https:\/\/house14\.vercel\.app\/listen<\/itunes:new-feed-url>/);
  assert.match(feedXML({ P: { ...P, listed: false, feed_url: "x" }, base: "b", episodes: [ep] }), /<itunes:block>Yes<\/itunes:block>/);
});

test("podcast transcript (14 Oct): each line with its speaker and time, as WebVTT; tags and arrows made safe", async () => {
  const { vttOf } = await import("../scripts/podcast/lib.mjs");
  const v = vttOf([{ speaker: "Ashu", text: "Hello <sigh> & welcome --> in" }, { speaker: "Tarun", text: "Haan!" }], [[0, 2.5], [2.5, 3.1]]);
  assert.equal(v, "WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.500\n<v Ashu>Hello &amp; welcome -> in\n\n2\n00:00:02.500 --> 00:00:03.100\n<v Tarun>Haan!\n");
  assert.equal(vttOf([{ speaker: "Ashu", text: "x" }], null), null);
  const xml = feedXML({ P: { ...P, feed_url: "https://h/listen" }, base: "https://h", episodes: [{ date: "2026-10-14", title: "t", description: "d", url: "https://h/listen/2026-10-14.mp3", transcript_url: "https://h/listen/2026-10-14.vtt", bytes: 1, seconds: 1, published: "2026-10-14T10:00:00Z" }] });
  assert.match(xml, /xmlns:podcast="https:\/\/podcastindex\.org\/namespace\/1\.0"/);
  assert.match(xml, /<podcast:transcript url="https:\/\/h\/listen\/2026-10-14\.vtt" type="text\/vtt" language="en"\/>/);
});

test("podcast: New York's close is overnight only after a weekday; Fixture Watch is the follows' next matches; Money levels rounded", () => {
  const ndx = d => ({ name: "Nasdaq-100", price: 29187.5, change_pct: -2.5, session_date: d });
  const P2 = { ...P, indices: ["Sensex", "Nasdaq-100"] };
  const at = (date, d) => rundown({ ...E, date, snapshot: { markets: { value: { indices: [ndx(d)] } } } }, P2, Date.parse(`${date}T09:00:00Z`), paper).segments.find(g => g.desk === "Money").markets[0];
  assert.match(at("2026-10-19", "2026-10-16"), /about 29,200.*Friday's close in New York.*NOT overnight/); // a Monday paper
  assert.match(at("2026-10-15", "2026-10-14"), /Wednesday in New York, overnight for us/);
  const R = rundown({ ...E, date: "2026-10-19", snapshot: { markets: { value: { indices: [ndx("2026-10-16")] } } } }, P2, Date.parse("2026-10-19T09:00:00Z"), paper);
  const said = (text, speaker = "Ashu") => checkScript([...Array(10)].map((_, i) => ({ speaker: i % 2 ? "Tarun" : "Ashu", mood: "warm", text: "A line." })).concat([{ speaker, mood: "warm", text }]), R, P2).map(p => p.msg).join(" | ");
  assert.match(said("Overnight in New York, the Nasdaq fell."), /not last night/);
  assert.doesNotMatch(said("At Friday's close in New York, the Nasdaq fell."), /not last night/);
  // the soonest match of each follow, at most three, in time order (19 Oct: eight read as a list)
  const F = { ...E, date: "2026-10-19", chronology: {
    madrid: { next: { when_utc: "2026-10-21T19:00:00Z", label: "RB Leipzig" } },
    india_cricket: { next: { when_utc: "2026-10-22T07:00:00Z", label: "New Zealand" } },
    f1: { next: { when_utc: "2026-10-23T18:00:00Z", label: "United States GP" } },
    nba: { next: { when_utc: "2026-10-20T02:00:00Z", label: "Lakers" } } } };
  const coming = rundown(F, P, Date.parse("2026-10-19T09:00:00Z"), paper).segments.find(g => g.desk === "Sport").coming;
  assert.equal(coming.length, 3);
  assert.deepEqual(coming.map(c => c.split(" next")[0]), ["Real Madrid", "India (cricket)", "Formula One"]);
});

test("podcast: Page One once, never in a question; the hosts share the telling; at most two markets a turn", () => {
  const R = rundown(E, P, undefined, paper);
  const turns = [...Array(12)].map((_, i) => ({ speaker: i % 2 ? "Tarun" : "Ashu", mood: "warm", text: i % 2 ? "What happened on Page One?" : "On Page One, a long story told at length by one host who does nearly all of the talking in this show today." }));
  const msgs = checkScript(turns, R, P).map(p => p.msg).join(" | ");
  assert.match(msgs, /says "Page One" in 12 turns/);
  assert.match(msgs, /puts "Page One" inside a question/);
  assert.match(msgs, /Ashu has \d+% of the words/);
  const R2 = rundown({ ...E, snapshot: { markets: { value: { indices: [{ name: "Sensex", price: 73804, change_pct: -1.2, session_date: "2026-10-12" }] } } } }, P, undefined, paper);
  const m = checkScript([...turns.slice(0, 10), { speaker: "Ashu", mood: "warm", text: "The Sensex is at seventy-three thousand eight hundred, the rupee at ninety-four point nine three, and gold at one lakh forty-six thousand rupees for ten grams." }], R2, P).map(p => p.msg).join(" | ");
  assert.match(m, /reads out 3 markets in one turn/);
});

test("podcast, 20 Oct audit: the lead uses up no desk's place; Sport's 1.2 never takes a desk's last story; India's cricket weighs 7% more", () => {
  const Ed = JSON.parse(readFileSync(new URL("../content/editions/2026-10-20.json", import.meta.url), "utf8"));
  const R = rundown(Ed, P, undefined, { ...paper, follows: C.follows }), ids = [R.lead, ...R.segments.flatMap(g => g.items)].map(i => i.id);
  const of = name => R.segments.filter(g => g.desk === name).flatMap(g => g.items).map(i => i.id);
  assert.equal(R.lead.id, "india-nz-fta-in-force"); // Money's story, told as the lead
  assert.deepEqual(of("Money"), ["brent-tops-110"], "Money still gets a story of its own, and Sport's extra place does not take it");
  assert.deepEqual(of("Tech & AI"), ["mmx-launched-phobos"]);
  assert.ok(of("News").length >= 1);
  assert.ok(ids.includes("ojha-chief-selector"), "the new chief selector beats the gossip on a tie");
  for (const id of ["svitolina-monfils-split", "ronaldo-suspended-portugal"]) assert.ok(!ids.includes(id), `${id}: ${ids.join(",")}`);
  // Sport keeps its own: the Madrid preview and four in all
  assert.equal(of("Sport").length, 4);
  // without Madrid's and the cricket's weights, the paper's order decides and Sport's share takes no desk's only story
  const W = rundown(Ed, { ...P, weights: P.weights.filter(w => w.desk) }, undefined, { ...paper, follows: C.follows });
  assert.ok(W.segments.find(g => g.desk === "Money").items.some(i => i.id === "brent-tops-110"));
  assert.ok(P.weights.some(w => w.section === "crease" && w.factor === P.weights.find(x => x.section === "madrid").factor));
});

test("podcast, 20 Oct audit: a spoken year is not a 24-hour clock; two markets moving by the same amount are not a repeat", () => {
  const T = (speaker, text) => ({ speaker, mood: "neutral", text }), base = Array.from({ length: 8 }, (_, i) => T(i % 2 ? "Tarun" : "Ashu", `Line ${i}?`));
  const msgs = turns => checkScript([...base, ...turns], { segments: [] }, { ...P, words: { min: 10, max: 9999 } }).map(p => p.msg).join(" | ");
  const years = msgs([T("Tarun", "It reaches Phobos in August twenty twenty-seven, and brings it back to Earth in twenty thirty-one."), T("Ashu", "By twenty thirty, maybe more. Two thousand and thirty-one is a long wait.")]);
  assert.doesNotMatch(years, /twenty-four-hour clock/);
  assert.match(msgs([T("Tarun", "Kick-off is at twenty thirty, so stay up.")]), /twenty-four-hour clock or IST \("twenty thirty"\)/);
  assert.match(msgs([T("Tarun", "The match starts at nineteen hundred hours.")]), /twenty-four-hour clock/);
  const money = msgs([T("Tarun", "Yesterday the Sensex fell one point two per cent to about seventy-three thousand nine hundred."), T("Ashu", "And at Monday's close the Nasdaq rose one point two per cent to about twenty-nine thousand five hundred.")]);
  assert.doesNotMatch(money, /says the same thing twice/);
  const again = msgs([T("Tarun", "Yesterday the Sensex fell one point two per cent to about seventy-three thousand."), T("Ashu", "Right, so the Sensex fell one point two per cent to about seventy-three thousand.")]);
  assert.match(again, /says the same thing twice/);
});

test("podcast, 20 Oct audit: RB Leipzig is voiced as R B Leipzig, and the transcript keeps the real spelling", () => {
  assert.equal(spoken("Madrid host RB Leipzig on Wednesday.", P.pronounce), "Madrid host R B Leipzig on Wednesday.");
  assert.match(vttOf([{ speaker: "Tarun", text: "Madrid host RB Leipzig." }], [[0, 2]]), /Madrid host RB Leipzig\./);
});

test("podcast, 26 Nov 2026: the House Note is told only for its joke; a plain one is never read, the close is one thing to watch", () => {
  const w = writerPrompt(rundown(E, P, undefined, paper), P);
  assert.match(w, /if the House Note has a joke or a wry line, retell just that/);
  assert.match(w, /If it is only a summary of the day's stories, do NOT read it and do not recap the show/);
  assert.match(w, /one line on one thing worth watching tomorrow or in the next few days/);
  assert.doesNotMatch(w, /—/, "no em dashes in the writers' brief");
});

test("podcast, 20 Oct audit: the listening check passes a line whose only miss is one unspellable name from the script", (t) => {
  const code = `import sys, json; sys.path.insert(0, "scripts/podcast"); import verify_lines as v
lines = ["Goofy from Nagarbhavi won the Fat Dogs contest!", "Bachonker McChonketh? Seriously, yaar?", "And back home in Prayagraj, a merchant navy officer is stranded."]
ok = lambda texts, heard: [x["ok"] for x in v.judge(texts, heard)]
print(json.dumps({
  "name": ok(lines, [lines[0], "Bachelor Mick Chonk Kit? Seriously?", lines[2]]),
  "other_word": ok(lines, [lines[0], "Bachelor Mick Chonk Kit? Curious?", lines[2]]),
  "two_names": ok(["Goofy won it.", "Bachonker McChonketh met Ricky Jefferies.", "Fine."], ["Goofy won it.", "Bachelor Mick Chonk met Rikki Jeffers.", "Fine."]),
  "common": ok(["Goofy won it.", "Seriously? What a name.", "Fine."], ["Goofy won it.", "Curious? Wet a gnome.", "Fine."]),
  "names": v.names("Huge week! Madrid host RB Leipzig. Bachonker McChonketh, though. So Goofy won. Who, I ask?")}))`;
  let out;
  try { out = JSON.parse(execFileSync("python3", ["-c", code], { encoding: "utf8" })); } catch { t.skip("python3 with numpy not here"); return; }
  assert.deepEqual(out.name, [true, true, true], "one name the recogniser cannot spell, every other word heard");
  assert.equal(out.other_word[1], false, "another word missed as well: not heard");
  assert.equal(out.two_names[1], false, "two names missed: not heard");
  assert.equal(out.common[1], false, "a common word is never excused");
  assert.deepEqual(out.names, [["rb", "leipzig"], ["bachonker", "mcchonketh"], ["goofy"]]);
});

// 26 Nov 2026: every Gemini writer answered 503 for fifteen minutes and the episode went out on the code's plain script.
test("evening retries replace a plain-script episode only with a script Gemini wrote", () => {
  const wf = readFileSync(new URL("../.github/workflows/podcast.yml", import.meta.url), "utf8");
  assert.match(wf, /cron: "30 13 \* \* \*"/);
  assert.match(wf, /cron: "30 16 \* \* \*"/);
  assert.match(wf, /github\.event_name == 'schedule' && '--upgrade'/);
  const s = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  assert.match(s, /UPGRADE && done\.by === "code" && date === today/);
  assert.match(s, /by === "code" \|\| \(\/lite\/\.test\(by\) && prior\.by !== "code"\)/);
  const n = readFileSync(new URL("../api/notify.js", import.meta.url), "utf8");
  assert.match(n, /before && before\.by !== "code"/);
  assert.match(n, /A better take of today's podcast/);
});
test("a retry that keeps a plain-script episode tells Parth on Telegram, at most three times a day", () => {
  const s = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  assert.match(s, /if \(prior\.by === "code"\) await fetch\(`\$\{site\}\/api\/notify\?podcast=\$\{date\}&k=\$\{folder\.split\("\/"\)\[1\]\}&kept=1`/);
  const n = readFileSync(new URL("../api/notify.js", import.meta.url), "utf8");
  assert.match(n, /if \(m\?\.by !== "code"\) return/);
  assert.match(n, /seen >= 3/);
});

// ---- 26 Nov 2026 audit (podcast v2): Parth chose all of A plus 8 to 13 ----
import { figures, auditChecks } from "../scripts/podcast/lib.mjs";
const T2 = (speaker, text, mood = "neutral") => ({ speaker, mood, text });
test("v2: figures are read the way they are said, and times, years, scores and ordinals are not figures", () => {
  const v = t => figures(t).map(f => f.v);
  assert.deepEqual(v("up four hundred and sixty-two points"), [462]);
  assert.deepEqual(v("about one lakh twenty-four thousand rupees"), [124000]);
  assert.deepEqual(v("three lakh crore"), [3e12]);
  assert.deepEqual(v("fifteen thousand five hundred and eleven crore"), [15511e7]);
  assert.deepEqual(v("eighty-one point three billion dollars"), [81.3e9]);
  assert.deepEqual(v("ninety two point ninety"), [92.9]);
  assert.deepEqual(v("ninety dollars and forty-five cents"), [90]);
  assert.deepEqual(v("a hundred and thirty"), [130]);
  for (const t of ["since March twenty twenty", "today at three thirty p m", "won five-one", "Saturday, twenty-first of November", "over a trillion dollars", "nineteen ninety-two"]) assert.deepEqual(v(t), [], t);
  assert.deepEqual(v("₹1,24,000 and $81.3bn and ₹3 lakh crore"), [124000, 81.3, 81.3e9, 3, 3e12]);
  assert.equal(figures("down eight per cent")[0].pct, true);
  assert.equal(figures("about seventy-three thousand")[0].q, "~");
});
test("v2: the fact guard flags a figure the paper does not give, a match on the wrong day and a dropped hedge, and lets the paper's own pass", () => {
  const R = { day: "Friday 20 November", segments: [
    { desk: "Money", items: [{ id: "s", headline: "Sensex rallies", text: "The Sensex rose 990 points to 83,022, its highest close in three months.", depth: "deep" }], markets: ["Sensex at about 83,800, up 0.9% so far today"] },
    { desk: "News", items: [{ id: "m", headline: "Mexico captures cartel boss Isidro", text: "The alleged leader of the Beltran Leyva group was caught.", depth: "quick" }, { id: "uk", must: true, headline: "Britain and the EU agree a food deal", text: "x", depth: "quick" }] },
    { desk: "Sport", items: [], coming: ["India v New Zealand, 2nd Test, Christchurch, on Friday at three thirty a m, late on Thursday night"], results: [] }] };
  const msgs = turns => auditChecks(turns, R, P).map(p => p.msg).join(" | ");
  const bad = msgs([T2("Ashu", "The Sensex closed at eighty-three thousand and twenty-two, up four hundred and sixty-two points."), T2("Tarun", "And India's second Test against New Zealand is in Christchurch on Thursday."), T2("Ashu", "Mexico caught Isidro, who leads the Beltran Leyva cartel.")]);
  assert.match(bad, /"four hundred and sixty two" is not a figure in the rundown/);
  assert.doesNotMatch(bad, /eighty three thousand and twenty two" is not/);
  assert.match(bad, /says "Thursday" for India v New Zealand/);
  assert.match(bad, /without the paper's hedge \("alleged"\)/);
  assert.match(bad, /leaves out "Britain and the EU agree a food deal"/);
  const good = msgs([T2("Ashu", "The Sensex jumped about nine hundred and ninety points, so far today it's at about eighty-three thousand eight hundred."), T2("Tarun", "And the Christchurch Test starts on Friday at three thirty a m, late on Thursday night."), T2("Ashu", "Mexico caught Isidro, the alleged leader of the Beltran Leyva group. Britain and the EU agreed their food deal too.")]);
  assert.equal(good, "", good);
});
test("v2: a conversation, not a reading: the same host twice, prompting runs, section names, Hindi as a news opener, cheer after deaths", () => {
  const R = { day: "Friday 20 November", segments: [] };
  const m = auditChecks([T2("Ashu", "On Page One today, a fire."), T2("Ashu", "Thirty-one people were killed in Cairo."), T2("Tarun", "Wonderful! And the weather is lovely."), T2("Ashu", "What happened?"), T2("Tarun", "Arre, the Supreme Court sent the former MP back to jail within a month today."), T2("Ashu", "Why?"), T2("Tarun", "A ruling."), T2("Ashu", "And then?"), T2("Tarun", "Here's Bhide's House Note.")], R, P).map(p => p.msg).join(" | ");
  for (const re of [/same host speaks twice in a row at turn 2/, /reads out the paper's section name \("On Page One"\)/, /reads out the paper's section name \("House Note"\)/, /comes straight after a story with deaths/, /Ashu only asks short questions/, /opens a news sentence with a Hindi word/]) assert.match(m, re);
});
test("v2: the fact guard counts heavily but never stops a script: soft, weighted, sorted first for a rewrite", () => {
  const R = rundown(E, P, undefined, paper);
  const ps = checkScript(Array.from({ length: 10 }, (_, i) => T2(i % 2 ? "Tarun" : "Ashu", i === 3 ? "Riyadh says four hundred and nine people were hurt?" : "A line?")), R, P);
  const f = ps.find(p => /four hundred and nine/.test(p.msg));
  assert.ok(f && !f.hard && f.w === 4);
  const make = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  assert.match(make, /probs\.reduce\(\(a, p\) => a \+ \(p\.w \|\| 1\), 0\)/);
  assert.match(make, /sort\(\(a, b\) => \(b\.hard - a\.hard\) \|\| \(b\.w \|\| 1\) - \(a\.w \|\| 1\)\)/);
});
test("v2: money said right: flat, at its high, the rupee on a weekend and beside its own story", () => {
  const Ed = { date: "2026-11-21", front: { lead: { id: "a", section: "desh", headline: "A lead", short: "x" } }, sections: {},
    snapshot: { markets: { value: { indices: [{ name: "Sensex", price: 83919.71, change_pct: -0.02, session_date: "2026-11-21", live: true, market_time: "2026-11-21T08:20:00Z", lo3m: 71000, hi3m: 83919.71 }] } }, fx: { value: { price: 92.67, change_pct: -0.67, session_date: "2026-11-20", note: "Rupee at its strongest in 3 months" } } } };
  const m = rundown(Ed, P, undefined, paper).segments.find(g => g.markets).markets;
  assert.match(m[0], /Sensex at about 83,900, flat so far today/);
  assert.match(m[0], /at its highest in three months/);
  assert.match(m.find(x => /rupee/.test(x)), /stronger by 0\.7% at the last close \(Friday\)/);
  const withStory = { ...Ed, date: "2026-11-26", sections: { ledger: { briefs: [{ id: "r", section: "ledger", headline: "The rupee closes at an eight-month high of 92.23", text: "Foreign money flowed in." }] } }, art_scores: [{ story_id: "r", importance: 2 }] };
  withStory.snapshot = { ...Ed.snapshot, fx: { value: { ...Ed.snapshot.fx.value, session_date: "2026-11-26" } } };
  const m2 = rundown(withStory, P, undefined, paper).segments.find(g => g.markets).markets.find(x => /rupee/.test(x));
  assert.match(m2, /the rupee at 92\.67 to the dollar \(its story is in Money/);
  assert.doesNotMatch(m2, /strongest in 3 months|stronger by/);
});
test("v2: no live F1 table older than the race the paper reports; tonight's match always in Fixture Watch; every importance-2 story in; one betting line; Bhide without initials", () => {
  const Ed = { date: "2026-11-22", front: { lead: { id: "a", section: "desh", headline: "A lead", short: "x" } },
    sections: { videsh: { briefs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => ({ id: `w${i}`, section: "videsh", headline: `World item ${i}`, text: "x" })) } },
    art_scores: [{ story_id: "w11", importance: 2 }],
    chronology: { f1: { last: { when_utc: "2026-11-22T04:00:00Z", label: "Las Vegas GP" } } },
    snapshot: { f1_standings: { value: { drivers: [{ pos: 1, name: "Andrea Kimi Antonelli", shown: "Kimi Antonelli", points: 390 }, { pos: 2, name: "Max Verstappen", points: 279 }] } }, f1_last: { value: { round: 20, date: "2026-11-08T17:00:00Z" } },
      tennis_players: { value: { players: [{ name: "Carlos Alcaraz", next: { when_utc: "2026-11-22T17:00:00Z", opponent: "Alexander Zverev", event: "ATP Finals", round: "Final" } }] } } } };
  const F = { ...P, fixtures: { max: 0, order: ["madrid"] }, quick_max: 3 };
  const R = rundown(Ed, F, undefined, { ...paper, follows: C.follows });
  const sport = R.segments.find(g => g.desk === "Sport");
  assert.ok(!(sport?.standings || []).some(x => /Verstappen/.test(x)), "the table is from before the race");
  assert.match((sport?.coming || []).join(" | "), /Alcaraz v Alexander Zverev, ATP Finals, Final, today at ten thirty p m/);
  assert.ok(R.segments.flatMap(g => g.items).some(i => i.id === "w11" && i.must), "an importance-2 story is in even past quick_max");
  assert.equal(R.editor, "Bhide");
  assert.match(writerPrompt(R, P), /say just "Bhide", never his initials/);
  const src = readFileSync(new URL("../scripts/podcast/lib.mjs", import.meta.url), "utf8");
  assert.match(src, /marketsExpect\(E, paper, P\.betting_max \?\? 1\)/);
});
test("v2: the writer is told to bridge in spoken words, keep only Fixture Watch, keep hedges, never derive a figure, and say 'over in Ranchi'", () => {
  const w = writerPrompt(rundown(E, P, undefined, paper), P);
  assert.match(w, /never by reading out the paper's section names/);
  assert.match(w, /The one name the show keeps is "Fixture Watch"/);
  assert.match(w, /a Ranchi story is "over in Ranchi"/);
  assert.match(w, /Keep every hedge/);
  assert.match(w, /Never work out a figure of your own/);
  assert.match(w, /At most two figures in any one turn/);
  assert.match(w, /ONE sentence, wherever it fits best, that says plainly what the question is/);
  assert.doesNotMatch(w, /—/);
});
test("v2: the code's backup script names the hosts, asks why, bridges, gives one market a turn, never reads a writer's note or the House Note", () => {
  const Ed = JSON.parse(readFileSync(new URL("../content/editions/2026-11-26.json", import.meta.url), "utf8"));
  const R = rundown(Ed, P, undefined, { ...paper, follows: C.follows }), fb = fallbackScript(R, P), text = fb.map(t => t.text).join(" ");
  assert.match(fb[0].text, /I'm Ashu/); assert.match(fb[1].text, /And I'm Tarun\. This is Bhide's paper/);
  assert.ok(fb.every((t, i) => !i || t.speaker !== fb[i - 1].speaker), "never the same host twice in a row");
  assert.match(text, /Why does it matter\?/);
  assert.match(text, /On to money:/);
  assert.match(text, /Fixture Watch:/);
  assert.doesNotMatch(text, /tell them together|NOT overnight|House Note/);
  assert.equal(fb.at(-1).text, P.signoff);
  assert.ok(!checkScript(fb, R, P).some(p => p.hard));
});
test("v2: entities, cricket totals and the new names are said right; the studio's gaps vary and quick reactions overlap", () => {
  assert.equal(spoken("the S&amp;P 500 fell", P.pronounce), "the S and P five hundred fell");
  assert.equal(spoken("India 720/9 dec, New Zealand 368 & 239/5"), "India seven hundred and twenty for nine declared, New Zealand three hundred and sixty-eight and two hundred and thirty-nine for five");
  assert.equal(spoken("on 26/11, open 24/7"), "on twenty-six eleven, open twenty-four seven");
  assert.equal(spoken("Jensen Huang, Mbappé and Bhide's paper", P.pronounce), "Jensen Hwang, Em-bap-pay and Bhee-day's paper");
  const turns = [], pieces = [];
  for (let i = 0; i < 40; i++) { const sp = i % 2 ? "Tarun" : "Ashu", t = i % 4 === 3 ? "Arre, really?" : i % 3 ? "A fairly long line with many words in it that tells a whole story at length today." : "Is that so?"; turns.push({ speaker: sp, mood: "neutral", text: t }); pieces.push({ speaker: sp, pcm: Buffer.alloc(Math.round((t.split(" ").length / 2.6) * RATE) * 2) }); }
  const L = layout({ turns, pieces, date: "2026-11-26", pan: {}, music: false });
  const g = L.cues.slice(1).map((c, i) => c[0] - L.cues[i][1]);
  assert.ok(Math.max(...g) - Math.min(...g.filter(x => x > 0)) > 0.35, `gaps vary: ${g.map(x => x.toFixed(2)).join(",")}`);
  assert.ok(g.some(x => x < 0), "a quick reaction overlaps");
});
