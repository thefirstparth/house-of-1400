import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spoken, intWords, rundown, checkScript, fallbackScript, feedXML, sayWhen, splitLines, cutAt, onAir, SEGMENTS, writerPrompt } from "../scripts/podcast/lib.mjs";
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
  assert.match(R.segments.find(g => g.desk === "Money").markets[0], /Sensex at 22,365, down 0.7%/);
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
