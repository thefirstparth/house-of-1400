// A game under way (Parth, 3 Oct: "the match is live and the score, if possible"): the Warriors' and Madrid's running
// score and clock come from ESPN's page for the game, the team schedule being slow to move during play.
import { test } from "node:test";
import assert from "node:assert/strict";

const L = await import("../lib/live.js");
const J = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const now = Date.now(), iso = ms => new Date(ms).toISOString();
async function withRoutes(routes, fn) {
  const saved = globalThis.fetch;
  globalThis.fetch = async url => { for (const [re, body] of routes) if (re.test(String(url))) return J(typeof body === "function" ? body(String(url)) : body); return new Response("no", { status: 404 }); };
  try { return await fn(); } finally { globalThis.fetch = saved; }
}
const side = (ab, name, homeAway, score) => ({ homeAway, team: { id: ab, abbreviation: ab, displayName: name }, ...(score != null ? { score } : {}) });
const pre = { type: { state: "pre", completed: false, shortDetail: "10/4 - 7:00 PM EDT" } };

test("nbaClock: ESPN's status in a few characters", () => {
  assert.equal(L.nbaClock({ period: 3, displayClock: "4:12", type: { shortDetail: "4:12 - 3rd" } }), "Q3 4:12");
  assert.equal(L.nbaClock({ type: { shortDetail: "4:12 - 3rd" } }), "Q3 4:12");
  assert.equal(L.nbaClock({ period: 2, type: { shortDetail: "Halftime" } }), "Half-time");
  assert.equal(L.nbaClock({ period: 3, type: { shortDetail: "End of 3rd" } }), "End of Q3");
  assert.equal(L.nbaClock({ period: 5, displayClock: "1:05", type: { shortDetail: "1:05 - OT" } }), "OT 1:05");
});

test("nba: a game under way carries its running score and clock", async () => {
  const ev = { id: "g1", date: iso(now - 50 * 6e4), seasonType: { type: 1 }, competitions: [{ status: pre, competitors: [side("GS", "Golden State Warriors", "away"), side("LAC", "LA Clippers", "home")] }] };
  const later = { id: "g2", date: iso(now + 3 * 864e5), seasonType: { type: 1 }, competitions: [{ status: pre, competitors: [side("GS", "Golden State Warriors", "home"), side("LAL", "Los Angeles Lakers", "away")] }] };
  const summary = { header: { competitions: [{ status: { period: 3, displayClock: "4:12", type: { state: "in", completed: false, shortDetail: "4:12 - 3rd" } },
    competitors: [side("GS", "Golden State Warriors", "away", "54"), side("LAC", "LA Clippers", "home", "49")] }] } };
  const r = await withRoutes([[/nba\/summary\?event=g1/, summary], [/nba\/teams\/gs\/schedule/, { events: [ev, later] }]], () => L.nba());
  const g = r.value.next[0];
  assert.equal(g.live, true); assert.deepEqual(g.score, { us: "54", them: "49" }); assert.equal(g.clock, "Q3 4:12"); assert.equal(g.home, false);
  assert.equal(r.value.next[1].live, false); assert.equal(r.value.next[1].score, null);
});

test("nba: a game that ended moves to last with its result; a failed summary leaves the game as scheduled", async () => {
  const ev = { id: "g1", date: iso(now - 150 * 6e4), seasonType: { type: 1 }, competitions: [{ status: pre, competitors: [side("GS", "Golden State Warriors", "home"), side("LAC", "LA Clippers", "away")] }] };
  const done = { header: { competitions: [{ status: { type: { state: "post", completed: true, shortDetail: "Final" } },
    competitors: [{ ...side("GS", "Golden State Warriors", "home", "112"), winner: true }, { ...side("LAC", "LA Clippers", "away", "108"), winner: false }] }] } };
  const r = await withRoutes([[/nba\/summary\?event=g1/, done], [/nba\/teams\/gs\/schedule/, { events: [ev] }]], () => L.nba());
  assert.equal(r.value.next.length, 0); assert.equal(r.value.last.winner, "us"); assert.deepEqual(r.value.last.score, { us: "112", them: "108" });
  const r2 = await withRoutes([[/nba\/teams\/gs\/schedule/, { events: [ev] }]], () => L.nba());
  assert.equal(r2.value.next[0].live, false); assert.equal(r2.value.next[0].score, null);
});

test("football: Madrid under way carries the running score and minute", async () => {
  const club = String(JSON.parse((await import("node:fs")).readFileSync(new URL("../config/house.json", import.meta.url))).follows.football_club.espn_id);
  const ev = { id: "m1", date: iso(now - 40 * 6e4), league: { name: "Spanish LALIGA" }, competitions: [{ status: { type: { state: "pre", completed: false, shortDetail: "Sat" } }, competitors: [side(club, "Real Madrid", "home"), side("102", "Villarreal", "away")] }] };
  const summary = { header: { competitions: [{ status: { type: { state: "in", completed: false, shortDetail: "63'" } }, competitors: [side(club, "Real Madrid", "home", "1"), side("102", "Villarreal", "away", "0")] }] } };
  const r = await withRoutes([[/soccer\/all\/summary\?event=m1/, summary], [/schedule\?fixture=true/, { events: [ev] }], [/teams\/\d+\/schedule$/, { events: [] }]], () => L.football());
  const m = r.value.next[0];
  assert.equal(m.state, "in"); assert.deepEqual(m.score, { us: "1", them: "0" }); assert.equal(m.clock, "63'"); assert.equal(m.competition, "La Liga");
});
