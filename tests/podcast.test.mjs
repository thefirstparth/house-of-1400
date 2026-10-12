import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spoken, intWords, rundown, checkScript, fallbackScript, feedXML, sayWhen } from "../scripts/podcast/lib.mjs";

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
  snapshot: { markets: { value: { indices: [{ name: "Nifty 50", price: 22365, change_pct: -0.69, session_date: "2026-10-12" }] } } },
};

test("podcast: the running order follows the paper's desks, lead first, and times are said the way people say them", () => {
  const R = rundown(E, P, undefined, paper), desk = id => R.segments.find(g => g.items.some(i => i.id === id))?.desk;
  assert.equal(R.lead.id, "max");
  assert.equal(desk("jantar"), "News");           // Delhi is News, never Close to Home
  assert.equal(desk("bmtc"), "Close to Home");
  assert.equal(desk("alcaraz"), "Sport");
  assert.equal(R.segments.find(g => g.desk === "News").items[0].id, "riyadh");
  assert.match(R.segments.find(g => g.desk === "Money").markets[0], /Nifty 50 at 22,365, down 0.7%/);
  assert.match(R.segments.find(g => g.desk === "Sport").coming[0], /on Thursday at twelve thirty a m, late on Wednesday night/);
  assert.equal(sayWhen("2026-10-14T13:30:00Z", Date.parse("2026-10-12T09:00:00Z")), "on Wednesday at seven p m");
  assert.equal(sayWhen("2026-10-12T10:00:00Z", Date.parse("2026-10-12T09:00:00Z")), "today at three thirty p m");
});

test("podcast: a script that reads the paper, laughs at a tragedy or talks about the process is refused; the code script always exists", () => {
  const R = rundown(E, P, undefined, paper), hard = ps => ps.filter(p => p.hard).map(p => p.msg).join(" | "), all = ps => ps.map(p => p.msg).join(" | ");
  const chat = ["Max finally won in Singapore, at the tenth attempt.", "Ten tries? Wow.", "Is Riyadh safe now?", "Not really, sadly.", "What about Jantar Mantar?", "Shut to protests.", "And buses?", "BMTC is sharing live data.", "Alcaraz?", "Through in straight sets.", "Roma next for Madrid?", "Yes, on Thursday at twelve thirty a m, late on Wednesday night."];
  const pad = " and that is the gist of the whole afternoon as we heard it from friends over tea".repeat(23);
  const turns = chat.map((t, i) => ({ speaker: i % 2 ? "Ravi" : "Asha", mood: "warm", text: i % 4 === 0 ? t + pad : t }));
  assert.equal(hard(checkScript(turns, R, P)), "");
  const bad = turns.map(t => ({ ...t }));
  bad[2] = { speaker: "Asha", mood: "sombre", text: "The Riyadh strike killed thirteen. <laugh>" };
  bad[3] = { speaker: "Ravi", mood: "warm", text: "Turning to Delhi, we waited for a second source on that." };
  bad[5] = { speaker: "Ravi", mood: "warm", text: "Max wins in Singapore Max won. He led every session." };
  const ps = checkScript(bad, R, P);
  assert.match(hard(ps), /laughter/);
  assert.match(hard(ps), /how the show is made/);
  assert.match(all(ps), /stock phrase "Turning to"/);
  const fb = fallbackScript(R, P);
  assert.ok(fb.length >= 6 && fb.every(t => ["Asha", "Ravi"].includes(t.speaker)));
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
