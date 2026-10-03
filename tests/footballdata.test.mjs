import { test } from "node:test";
import assert from "node:assert/strict";
import { fdEvent } from "../lib/footballdata.js";

test("fdEvent: a football-data match from Madrid's side, in ESPN's shape", () => {
  const m = { id: 1, utcDate: "2026-09-20T19:00:00Z", status: "FINISHED", competition: { code: "PD" }, homeTeam: { id: 78, name: "Club Atlético de Madrid", shortName: "Atleti" }, awayTeam: { id: 86, name: "Real Madrid CF", shortName: "Real Madrid" }, score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } } };
  const e = fdEvent(m, 86);
  assert.equal(e.home, false); assert.equal(e.opponent, "Atleti"); assert.equal(e.competition, "La Liga");
  assert.deepEqual(e.score, { us: 1, them: 2 }); assert.equal(e.winner, "them"); assert.equal(e.completed, true);
  const n = fdEvent({ ...m, status: "TIMED", score: { winner: null, fullTime: {} } }, 86);
  assert.equal(n.state, "pre"); assert.equal(n.time_confirmed, true); assert.equal(n.winner, null);
});

import { espnMatch } from "../lib/cricket-espn.js";
test("espnMatch: an ESPN cricket event as The Crease's match", () => {
  const e = { id: "1529228", date: "2026-09-30T08:30Z", competitions: [{ description: "2nd ODI", status: { type: { state: "post" }, summary: "India won by 8 wkts (39b rem)" }, venue: { fullName: "Barsapara", address: { city: "Guwahati" } },
    competitors: [{ team: { displayName: "India", abbreviation: "IND" }, score: "406/2 (43.3/50 ov, target 406)", winner: "true" }, { team: { displayName: "West Indies", abbreviation: "WI" }, score: "405/7", winner: "false" }] }] };
  const m = espnMatch(e, "West Indies tour of India");
  assert.equal(m.format, "ODI"); assert.equal(m.n, 2); assert.equal(m.won, true); assert.equal(m.state, "done");
  assert.equal(m.status, "India won by 8 wkts"); assert.equal(m.score, "IND 406/2 (43.3 ov) · WI 405/7"); assert.equal(m.opponent, "West Indies");
});
