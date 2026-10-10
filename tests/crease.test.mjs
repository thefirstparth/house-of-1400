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

test("the live Crease: next match, the series match by match with its score, the rest, the next tour", async () => {
  const { creaseView } = await import("../lib/cricket.js");
  const m = (id, series, format, desc, n, opp, start, state, status = null, won = null) => ({ id, series, format, desc, n, opponent: opp, start, time_announced: true, city: "X", ground: null, state, status, won });
  const M = [
    m(1, "West Indies tour of India, 2026", "ODI", "1st ODI", 1, "West Indies", "2026-09-27T08:30:00.000Z", "done", "India won by 8 wkts", true),
    m(2, "West Indies tour of India, 2026", "ODI", "2nd ODI", 2, "West Indies", "2026-09-30T08:30:00.000Z", "next"),
    m(3, "West Indies tour of India, 2026", "ODI", "3rd ODI", 3, "West Indies", "2026-10-03T08:30:00.000Z", "next"),
    m(4, "West Indies tour of India, 2026", "T20", "1st T20I", 1, "West Indies", "2026-10-06T13:30:00.000Z", "next"),
    m(5, "Asian Games 2026", "T20", "2nd Quarter-Final", null, "Afghanistan", "2026-09-28T04:30:00.000Z", "done", "Match abandoned due to rain (No toss)", null),
    m(6, "Asian Games 2026", "T20", "2nd Semi-Final", null, "Sri Lanka", "2026-10-01T04:30:00.000Z", "next"),
    m(7, "India tour of New Zealand 2026", "T20", "1st T20I", 1, "New Zealand", "2026-10-22T07:00:00.000Z", "next"),
  ];
  const v = creaseView(M, Date.parse("2026-09-30T00:30:00Z"));
  assert.equal(v.next.id, 2);
  assert.equal(v.main.name, "West Indies tour of India, 2026");
  assert.deepEqual(v.main.formats.map(f => [f.label, f.total, f.score]), [["ODIs", 3, "India lead 1–0"], ["T20Is", 1, null]]);
  assert.deepEqual(v.also.map(a => [a.name, a.formats[0].total, a.formats[0].score]), [["Asian Games 2026", null, null]], "a tournament has no series score or length");
  assert.equal(v.after.name, "India tour of New Zealand 2026");
});

test("the Crease keeps today's match, with its result, until midnight IST (Parth, 1 Oct)", async () => {
  const { creaseView, keptToday } = await import("../lib/cricket.js");
  const m = (id, series, desc, n, opp, start, state, status = null, won = null) => ({ id, series, format: n ? "ODI" : "T20", desc, n, opponent: opp, start, time_announced: true, city: "X", ground: null, state, status, won });
  const M = [
    m(1, "West Indies tour of India, 2026", "1st ODI", 1, "West Indies", "2026-09-27T08:30:00.000Z", "done", "India won by 8 wkts", true),
    m(2, "West Indies tour of India, 2026", "2nd ODI", 2, "West Indies", "2026-09-30T08:30:00.000Z", "done", "India won by 5 wkts", true),
    m(3, "West Indies tour of India, 2026", "3rd ODI", 3, "West Indies", "2026-10-03T08:30:00.000Z", "next"),
    m(6, "Asian Games 2026", "2nd Semi-Final", null, "Sri Lanka", "2026-10-01T04:30:00.000Z", "next"),
  ];
  // 22:00 IST on the day: the ODI is done, the next match is tomorrow's semi-final in another series.
  const night = creaseView(M, Date.parse("2026-09-30T16:30:00Z"));
  assert.equal(night.today.id, 2);
  assert.equal(night.next.id, 6);
  assert.equal(night.main.name, "West Indies tour of India, 2026", "today's series stays in charge");
  assert.equal(night.main.formats[0].score, "India lead 2–0");
  // 06:00 IST the next day: the semi-final's series takes over.
  const after = creaseView(M, Date.parse("2026-09-30T19:00:00Z") + 36e5 * 5.5);
  assert.equal(after.today, null);
  assert.equal(after.main.name, "Asian Games 2026");
  // A late match keeps 12 hours from its start even past midnight.
  assert.ok(keptToday(Date.parse("2026-09-30T17:30:00Z"), Date.parse("2026-09-30T20:00:00Z")));
  assert.ok(!keptToday(Date.parse("2026-10-01T04:30:00Z"), Date.parse("2026-09-30T20:00:00Z")), "a match that has not started is not today's result");
});

test("cricket scores: innings in batting order, overs as a reader writes them, all out as runs alone", async () => {
  const { inningsLine } = await import("../lib/cricket.js");
  const t = (id, s) => ({ teamId: id, teamSName: s });
  const odi = { matchFormat: "ODI", team1: t(10, "WI"), team2: t(2, "IND"),
    matchScore: { team1Score: { inngs1: { inningsId: 1, runs: 405, wickets: 7, overs: 49.6 } }, team2Score: { inngs1: { inningsId: 2, runs: 406, wickets: 2, overs: 43.3 } } } };
  assert.equal(inningsLine(odi), "WI 405/7 (50 ov) · IND 406/2 (43.3 ov)");
  const bowledOut = { ...odi, team2: t(2, "IND"), matchScore: { team1Score: { inngs1: { inningsId: 2, runs: 94, wickets: 10, overs: 13.6 } }, team2Score: { inngs1: { inningsId: 1, runs: 221, wickets: 7, overs: 19.6 } } } };
  assert.equal(inningsLine(bowledOut), "IND 221/7 (20 ov) · WI 94 (14 ov)", "the side batting first comes first");
  const test = { matchFormat: "TEST", team1: t(2, "IND"), team2: t(9, "ENG"),
    matchScore: { team1Score: { inngs1: { inningsId: 1, runs: 320, wickets: 10, overs: 98.2 }, inngs2: { inningsId: 3, runs: 180, wickets: 4, overs: 40 } }, team2Score: { inngs1: { inningsId: 2, runs: 250, wickets: 10, overs: 80 } } } };
  assert.equal(inningsLine(test), "IND 320 & 180/4 · ENG 250");
  assert.equal(inningsLine({ matchFormat: "ODI", team1: t(1, "A"), team2: t(2, "B") }), null);
  const cut = { ...odi, state: "In Progress", matchScore: { team1Score: { inngs1: { inningsId: 1, runs: 238, wickets: 10, overs: 41 } }, team2Score: { inngs1: { inningsId: 2, runs: 60, wickets: 1, overs: 12 } } } };
  assert.equal(inningsLine(cut), "WI 238 · IND 60/1 (12 ov)", "a finished first innings given as whole overs short of 50 drops its overs; the live one keeps them");
});

test("cricket card: each side's top scorer and best bowler, not-out marked, wicketless bowlers left out", async () => {
  const { cardOf } = await import("../lib/cricket.js");
  const inn = (bat, bowlTeam, bats, bowls) => ({ batTeamDetails: { batTeamShortName: bat, batsmenData: Object.fromEntries(bats.map((b, i) => ["bat_" + i, b])) }, bowlTeamDetails: { bowlTeamShortName: bowlTeam, bowlersData: Object.fromEntries(bowls.map((b, i) => ["bowl_" + i, b])) } });
  const j = { scoreCard: [
    inn("IND", "WI", [{ batName: "Sanju Samson", runs: 82, balls: 41, outDesc: "c Pooran b Springer" }, { batName: "Ishan Kishan", runs: 43, balls: 22, outDesc: "b Chase" }], [{ bowlName: "Roston Chase", wickets: 3, runs: 24 }, { bowlName: "Akeal Hosein", wickets: 0, runs: 46 }]),
    inn("WI", "IND", [{ batName: "Shai Hope", runs: 102, balls: 45, outDesc: "not out" }], [{ bowlName: "Jasprit Bumrah", wickets: 0, runs: 30 }]),
  ], matchHeader: { playersOfTheMatch: [{ fullName: "Shai Hope" }] } };
  const c = cardOf(j, 1);
  assert.deepEqual(c.innings[0].bat, { name: "Sanju Samson", runs: 82, balls: 41, out: true });
  assert.deepEqual(c.innings[0].bowl, { name: "Roston Chase", wickets: 3, runs: 24, team: "WI" });
  assert.equal(c.innings[1].bat.out, false);
  assert.equal(c.innings[1].bowl, null, "a bowler with no wickets is not a best bowler");
  assert.deepEqual(c.potm, ["Shai Hope"]);
  assert.equal(cardOf({}, 1), null);
});
