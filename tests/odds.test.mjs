import { test } from "node:test";
import assert from "node:assert/strict";
import { sameSide, sidesOf, kalshiWhen, merge, fair, f1Kind } from "../lib/odds.js";

test("sameSide: the same team or player under two books' names", () => {
  assert.ok(sameSide("Alcaraz", "Carlos Alcaraz"));
  assert.ok(sameSide("Villarreal", "Villarreal CF"));
  assert.ok(sameSide("Atlético Madrid", "Club Atlético de Madrid"));
  assert.ok(sameSide("Real Madrid", "Real Madrid CF"));
  assert.ok(sameSide("Golden State Warriors", "Golden State"));
  assert.ok(!sameSide("Real Madrid", "Club Atlético de Madrid"));
  assert.ok(!sameSide("India", "India A"));
  assert.ok(!sameSide("India women", "India"));
  assert.ok(!sameSide("India", "West Indies"));
});

test("sidesOf: a match market's two sides; side markets are not matches", () => {
  assert.deepEqual(sidesOf("Asian Games Men: Pakistan vs India"), ["Pakistan", "India"]);
  assert.deepEqual(sidesOf("Real Madrid CF vs. Villarreal CF"), ["Real Madrid CF", "Villarreal CF"]);
  assert.equal(sidesOf("Real Madrid CF vs. Villarreal CF - More Markets"), null);
  assert.equal(sidesOf("Will Novak Djokovic announce his retirement by...?"), null);
});

test("kalshiWhen: a ticker's date, and its start in New York time", () => {
  assert.deepEqual(kalshiWhen("KXT20MATCH-26OCT030030INDPAK"), { date: "2026-10-03", start: "2026-10-03T04:30:00.000Z" });
  assert.deepEqual(kalshiWhen("KXLALIGAGAME-26OCT10RMAVIL"), { date: "2026-10-10", start: null });
  assert.equal(kalshiWhen("KXF1RACE-BAH26"), null);
  assert.equal(kalshiWhen("KXT20MATCH-26DEC051930INDAUS").start, "2026-12-06T00:30:00.000Z"); // winter: five hours behind
});

test("merge: one market a match, the better traded, with a start when either has one", () => {
  const k = { sport: "tennis", kind: "match", sides: ["Alcaraz", "Arnaldi"], source: "Kalshi", volume: 160000, start: null, date: "2026-10-02", outcomes: [] };
  const p = { sport: "tennis", kind: "match", sides: ["Carlos Alcaraz", "Matteo Arnaldi"], source: "Polymarket", volume: 75000, start: "2026-10-03T03:30:00Z", date: "2026-10-03", outcomes: [] };
  const other = { ...p, sides: ["Carlos Alcaraz", "Jannik Sinner"] };
  const out = merge([p, k, other]);
  assert.equal(out.length, 2);
  const m = out.find(x => x.sides[1] === "Arnaldi");
  assert.equal(m.source, "Kalshi"); assert.equal(m.start, p.start); assert.equal(m.date, "2026-10-03");
});

test("fair: a match's chances add up to 100; a race is left as priced", () => {
  const m = fair({ kind: "match", outcomes: [{ name: "India", prob: 85.5 }, { name: "West Indies", prob: 16.5 }] });
  assert.equal(Math.round(m.outcomes.reduce((t, o) => t + o.prob, 0)), 100);
  const r = { kind: "race", outcomes: [{ name: "A", prob: 29 }, { name: "B", prob: 26 }] };
  assert.deepEqual(fair(r), r);
});

// Each F1 session's own market (9 Oct 2026: the sprint had none, and sprint qualifying borrowed qualifying's)
test("f1Kind: race, qualifying, sprint and sprint qualifying from Kalshi series and Polymarket titles", () => {
  assert.deepEqual(["KXF1RACE", "KXF1QUALIFY", "KXF1RACESPRINT", "KXF1SPRINTPOLE"].map(f1Kind), ["race", "qualifying", "sprint", "sprint_qualifying"]);
  assert.deepEqual(["Driver Winner", "Driver Pole Position", "Sprint Winner", "Sprint Qualifying Pole Winner"].map(f1Kind), ["race", "qualifying", "sprint", "sprint_qualifying"]);
});
