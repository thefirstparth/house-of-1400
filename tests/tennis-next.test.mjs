// A followed tennis player's next tournament, from the news (Parth, 13 Oct 2026, from the 14 Oct edition)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateEdition } from "../scripts/validate.mjs";
import { tennisLeads } from "../lib/pool.js";

const cfg = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8"));
const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-13.json", import.meta.url), "utf8"));
const tennisErrs = E => validateEdition(E).errors.filter(e => /^tennis:/.test(e));
const withNext = next_event => {
  const E = structuredClone(base); E.date = "2026-10-14";
  E.tennis.players[0].next_event = next_event;
  return E;
};

test("tennis next event: reports of a followed player's plans are leads; other news about him is not", () => {
  const items = [
    { title: "Alcaraz confirms he will play the Paris Masters", outlet: "BBC", url: "https://b/1" },
    { title: "Djokovic withdraws from Paris to end his season", outlet: "ESPN", url: "https://e/2" },
    { title: "Zizou Bergs stuns Carlos Alcaraz in Shanghai", outlet: "ESPN", url: "https://e/3" },
    { title: "Sinner confirms he will play Paris", outlet: "ESPN", url: "https://e/4" },
  ];
  const L = tennisLeads({ items }, cfg);
  assert.deepEqual(L.map(l => [l.player, l.url]), [["Carlos Alcaraz", "https://b/1"], ["Novak Djokovic", "https://e/2"]]);
  assert.ok(L.every(l => /^t-(alcaraz|djokovic)-\d$/.test(l.id)));
});

test("tennis next event: a printed one names its event, start, outlet and link, and has a row in the table", () => {
  assert.deepEqual(tennisErrs(withNext({ text: "Paris Masters, from 26 October" })), [], "an old-style line is left alone");
  assert.ok(tennisErrs(withNext({ text: "Paris Masters, from 26 October", event: "Paris Masters" })).some(e => /needs starts, source, url/.test(e)));
  const full = { text: "Paris Masters, from Monday 26 October (confirmed)", event: "Rolex Paris Masters", starts: "2026-10-26", source: "BBC", url: "https://b/1" };
  assert.ok(tennisErrs(withNext(full)).some(e => /needs a row in tennis.events/.test(e)));
  const E = withNext(full); E.tennis.events.push({ name: "Paris Masters", dates: "26 Oct to 1 Nov", place: "Paris" });
  assert.deepEqual(tennisErrs(E), []);
  const old = withNext({ ...full, starts: "2026-10-10" }); old.tennis.events.push({ name: "Paris Masters", dates: "x" });
  assert.ok(tennisErrs(old).some(e => /began on 2026-10-10/.test(e)));
  const far = withNext({ ...full, starts: "2027-05-24" }); far.tennis.events.push({ name: "Paris Masters", dates: "x" });
  assert.ok(tennisErrs(far).some(e => /four months off/.test(e)));
});
