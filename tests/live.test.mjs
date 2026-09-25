import { test, before } from "node:test";
import assert from "node:assert/strict";

import { installMocks } from "./mocks.mjs";

before(installMocks);

const L = await import("../lib/live.js");

test("weather: Bengaluru with 7 days", async () => {
  const r = await L.weather(new URLSearchParams());
  assert.equal(r.ok, true); assert.equal(r.value.cities[0].name, "Bengaluru"); assert.equal(r.value.cities[0].daily.length, 7);
  assert.equal(r.value.cities.length, 1, "Ranchi and Prayagraj only when notable");
});
test("weather: rejects bad coordinates", async () => {
  assert.equal((await L.weather(new URLSearchParams("lat=999&lon=1"))).ok, false);
});
test("f1_next picks the current weekend and the next three", async () => {
  const r = await L.f1_next();
  assert.equal(r.value.race.name, "Azerbaijan Grand Prix"); assert.equal(r.value.race.flag, "🇦🇿");
  assert.deepEqual(r.value.race.sessions.map(s => s.name), ["Practice 1", "Qualifying", "Race"]);
  assert.equal(r.value.upcoming.length, 2);
});
test("f1 standings and last race", async () => {
  const s = await L.f1_standings(); assert.equal(s.value.drivers[1].name, "Max Verstappen");
  const l = await L.f1_last(); assert.equal(l.value.results[0].name, "Kimi Antonelli");
});
test("football: next and last from ESPN", async () => {
  const r = await L.football();
  assert.equal(r.source, "ESPN"); assert.equal(r.value.next[0].opponent, "Villarreal"); assert.equal(r.value.next[0].competition, "La Liga"); assert.equal(r.value.next[0].home, true);
  assert.equal(r.value.last.opponent, "Atlético Madrid"); assert.deepEqual(r.value.last.score, { us: "1", them: "1" }); assert.deepEqual(r.value.form, ["D"]);
});
test("la liga table sorted", async () => {
  const r = await L.laliga_table(); assert.equal(r.value.rows[1].team, "Real Madrid"); assert.equal(r.value.rows[1].points, 15);
});
test("markets: null bars are dropped, change uses previous session close", async () => {
  const q = await L.yahooChart("^BSESN");
  assert.equal(q.price, 73581); assert.equal(q.prev, 74828);
  assert.ok(Math.abs(q.change_pct - -1.667) < 0.01);
  assert.ok(q.spark.every(Number.isFinite)); assert.equal(q.spark.at(-1), 73581);
  const m = await L.markets();
  assert.equal(m.ok, true); assert.equal(m.value.indices.length, 3);
  assert.ok(m.value.cross.find(c => c.symbol === "INR=X").price === 95.95);
});
test("gold: IBJA parse and ratio check", async () => {
  const r = await L.gold_in(); assert.equal(r.value.per_10g_24k, 150790); assert.equal(r.value.per_10g_22k, 138120);
  assert.throws(() => L.parseIbja("999 15079 916 5000"));
});
test("trends RSS parse", async () => {
  const r = await L.trends(new URLSearchParams());
  assert.equal(r.value.geos.IN[0].term, "Netherlands vs Germany"); assert.equal(r.value.geos.IN[0].news[0].title, "Dutch beat Germany");
});
test("betting: exclusions applied, outcomes shaped", async () => {
  const r = await L.betting(new URLSearchParams());
  const ids = r.value.markets.map(m => m.id);
  assert.deepEqual(ids, ["brazil-presidential-election", "iran-blockade"]);
  assert.equal(r.value.markets[0].outcomes[0].name, "Flávio Bolsonaro"); assert.equal(r.value.markets[0].outcomes[0].prob, 56.3);
  assert.deepEqual(r.value.markets[1].outcomes, [{ name: "Yes", prob: 61.8 }]);
});
test("nba: preseason is not in season", async () => {
  const r = await L.nba(); assert.equal(r.value.in_season, false); assert.equal(r.value.next[0].opponent, "LA Clippers");
});
test("fallback: failure returns ok:false, never a guess", async () => {
  const saved = globalThis.fetch; globalThis.fetch = async () => new Response("x", { status: 500 });
  try { for (const k of ["weather", "markets", "football", "gold_in"]) { const r = await L.LIVE[k](new URLSearchParams()); assert.equal(r.ok, false, k); assert.equal(r.value, null); } }
  finally { globalThis.fetch = saved; }
});
