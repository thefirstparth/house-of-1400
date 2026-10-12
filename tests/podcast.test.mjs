import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spoken, intWords, rundown, checkScript, fallbackScript, feedXML } from "../scripts/podcast/lib.mjs";

const P = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8")).podcast;

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
  front: { lead: { id: "max", kicker: "F1 · Singapore", headline: "Max wins in Singapore", short: "Max won. He led every session.", tone: "good" }, seconds: [{ id: "riyadh", kicker: "World · Gulf", headline: "Riyadh strike kills 13", short: "Thirteen died.", tone: "bad" }], briefs: [] },
  sections: {}, art_scores: [{ story_id: "max", importance: 3 }, { story_id: "riyadh", importance: 3 }],
  snapshot: { markets: { value: { indices: [{ name: "Nifty 50", price: 22365, change_pct: -0.69, session_date: "2026-10-12" }] } } },
};

test("podcast: the running order comes from the edition only, lead first", () => {
  const R = rundown(E, P, Date.parse("2026-10-12T09:30:00Z"));
  assert.equal(R.lead.id, "max");
  assert.deepEqual(R.stories.map(s => s.id), ["riyadh"]);
  assert.equal(R.stories[0].tone, "bad");
  assert.match(R.money[0], /Nifty 50 at 22,365, down 0.7%/);
});

test("podcast: a script that laughs at a tragedy or talks about the process is refused; the code script always exists", () => {
  const R = rundown(E, P);
  const long = "word ".repeat(80).trim();
  const turns = Array.from({ length: 10 }, (_, i) => ({ speaker: i % 2 ? "Ravi" : "Asha", mood: "neutral", text: long }));
  assert.deepEqual(checkScript(turns, R, P), []);
  turns[2] = { speaker: "Asha", mood: "bad", text: "The Riyadh strike killed thirteen. <laugh>" };
  turns[3] = { speaker: "Ravi", mood: "neutral", text: "We waited for a second source on that." };
  const bad = checkScript(turns, R, P).join(" | ");
  assert.match(bad, /laughter/);
  assert.match(bad, /how the show is made/);
  const fb = fallbackScript(R, P);
  assert.ok(fb.length >= 6 && fb.every(t => ["Asha", "Ravi"].includes(t.speaker)));
});

test("podcast: the feed is private (blocked from Apple's directory) and lists the newest first", () => {
  const ep = d => ({ date: d, title: `Ep ${d}`, description: "x & y", url: `https://b/${d}.mp3`, bytes: 1000, seconds: 360, published: `${d}T09:30:00Z` });
  const xml = feedXML({ P, base: "https://house14.vercel.app", episodes: [ep("2026-10-12"), ep("2026-10-13")] });
  assert.match(xml, /<itunes:block>Yes<\/itunes:block>/);
  assert.ok(xml.indexOf("2026-10-13") < xml.indexOf("2026-10-12"));
  assert.match(xml, /x &amp; y/);
});
