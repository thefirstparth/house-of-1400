// The Crease's series counts and "After this" row, and Screen & Stage's Coming soon (from 29 Sep 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

import { seriesOf } from "../lib/cricket.js";
import { validateEdition } from "../scripts/validate.mjs";

const m = (desc, format, series, opponent, start) => ({ desc, format, series, opponent, start });
const MATCHES = [
  m("2nd ODI", "ODI", "West Indies tour of India, 2026", "West Indies", "2026-09-30T08:30:00Z"),
  m("3rd ODI", "ODI", "West Indies tour of India, 2026", "West Indies", "2026-10-03T08:30:00Z"),
  m("1st T20I", "T20", "West Indies tour of India, 2026", "West Indies", "2026-10-06T13:30:00Z"),
  m("5th T20I", "T20", "West Indies tour of India, 2026", "West Indies", "2026-10-17T13:30:00Z"),
  m("2nd Semi-Final", "T20", "Asian Games 2026", "TBC", "2026-10-01T04:30:00Z"),
  m("1st T20I", "T20", "India tour of New Zealand 2026", "New Zealand", "2026-10-22T07:00:00Z"),
  m("1st ODI", "ODI", "India tour of New Zealand 2026", "New Zealand", "2026-11-15T02:00:00Z"),
  m("1st Test", "TEST", "Later tour", "England", "2027-01-15T04:00:00Z"),
];

test("series: counts from the Nth match, what is under way, and only the next one after", () => {
  const s = seriesOf(MATCHES, Date.parse("2026-09-29T09:00:00Z"));
  assert.deepEqual(s.map(x => `${x.now ? "now" : "next"}:${x.opponent}`), ["now:West Indies", "now:TBC", "next:New Zealand"]);
  assert.deepEqual(s[0].parts, [{ format: "ODI", total: 3, played: 1 }, { format: "T20", total: 5, played: 0 }]);
  assert.deepEqual(s[1].parts, [{ format: "T20", total: null, played: null }], "a semi-final is not a numbered match");
});

test("validator: an After this row and 2 Coming soon titles are owed from 29 Sep", () => {
  const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-28.json", import.meta.url), "utf8"));
  const path = new URL("../ledger/cricket-times.json", import.meta.url), saved = readFileSync(path, "utf8");
  try {
    writeFileSync(path, JSON.stringify({ date: "2026-09-29", source: "Cricbuzz", matches: MATCHES.filter(x => x.start > "2026-09-29").map(x => ({ ...x, time_announced: true })), series: seriesOf(MATCHES, Date.parse("2026-09-29T09:00:00Z")) }));
    const E = { ...base, date: "2026-09-29", weekday: "tue" };
    const errs = x => validateEdition(x).errors.filter(e => /crease:|Coming soon/.test(e));
    assert.equal(errs(E).length, 2);
    const rows = [...base.sections.crease.data.rows, { label: "After this", text: "New Zealand, away: 5 T20Is and 5 ODIs from 22 Oct" }];
    const soon = [{ title: "A", type: "Film", language: "English", where: "Theatres", release: "Fri 2 Oct", verdict: "early", reason: "A long-awaited sequel.", coming_soon: true }, { title: "B", type: "Series", language: "Hindi", where: "Netflix", release: "Thu 8 Oct", verdict: "early", reason: "The second season of a hit.", coming_soon: true }];
    const ok = { ...E, screen: [...base.screen, ...soon], sections: { ...base.sections, crease: { data: { rows } } } };
    assert.deepEqual(errs(ok), []);
    assert.deepEqual(errs({ ...base }), [], "earlier editions are not held to it");
  } finally { writeFileSync(path, saved); }
});
