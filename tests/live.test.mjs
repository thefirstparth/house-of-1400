import { test, before } from "node:test";
import assert from "node:assert/strict";

import { installMocks } from "./mocks.mjs";

before(installMocks);

const L = await import("../lib/live.js");

test("weather: Bengaluru with 7 days", async () => {
  const r = await L.weather(new URLSearchParams());
  assert.equal(r.ok, true); assert.equal(r.value.cities[0].name, "Bengaluru"); assert.equal(r.value.cities[0].daily.length, 7);
  assert.deepEqual(r.value.cities.map(c => c.name), ["Bengaluru", "Ranchi", "Prayagraj"], "the family cities every day");
  assert.equal(r.value.cities[1].family, true);
  assert.equal(r.value.cities[0].air.now, 40); assert.equal(r.value.cities[0].air.scale, "US AQI");
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
  assert.equal(m.ok, true); assert.equal(m.value.indices.length, 6);
  assert.deepEqual(Object.keys(m.value.mood), ["India", "US"]);
  for (const k of ["India", "US"]) { const x = m.value.mood[k]; assert.ok(x.score >= 0 && x.score <= 100); assert.ok(x.word); }
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
  assert.deepEqual(ids, ["pm:brazil-presidential-election", "pm:iran-blockade"]);
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

test("range notes: lows, highs, rupee wording, quiet ranges", () => {
  const days = n => [...Array(n)].map((_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const mk = vals => days(vals.length).map((d, i) => ({ d, c: vals[i] }));
  assert.equal(L.rangeNote(mk([...Array(20)].map((_, i) => 100 - i)), "^BSESN"), "Lowest close in 3 months");
  assert.equal(L.rangeNote(mk([90, ...Array(18).fill(100), 95]), "^BSESN"), "Lowest close since 1 Jul");
  assert.equal(L.rangeNote(mk([...Array(20)].map((_, i) => 90 + i)), "INR=X"), "Rupee at its weakest in 3 months");
  assert.equal(L.rangeNote(mk([100, 104, 96, 103, 97, 102, 98, 101, 99, 100, 104, 96, 103, 97, 102, 98, 101, 99, 100, 100.5]), "^NSEI"), null);
});

test("betting: Polymarket ids only", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => { seen.push(String(url)); return new Response("[]", { status: 200, headers: { "content-type": "application/json" } }); };
  try { await L.betting(new URLSearchParams("ids=pm:some-market,ks:KXLLM1-26DEC31")); }
  finally { globalThis.fetch = realFetch; }
  assert.ok(seen.every(u => u.includes("polymarket.com")), seen.join(" "));
  assert.ok(!seen.some(u => u.includes("kalshi")));
});

test("movers: sessions aligned by date, stocks, clusters", () => {
  const cfg = { stock_pct: 8, industry_pct: 2.5, industry_min_stocks: 4, sessions: 2 };
  const list = ["A", "B", "C", "D", "E"].map(s => ({ name: s + " Ltd.", industry: s === "E" ? "Other" : "Fin", symbol: s }));
  const days = ["2026-09-22", "2026-09-23", "2026-09-24"];
  const px = { A: [100, 100, 60], B: [100, 100, 95], C: [100, 100, 95.5], D: [100, 100, 100], E: [100, 100, 101] };
  const closes = Object.fromEntries(Object.entries(px).map(([s, a]) => [`${s}.NS`, a.map((c, i) => ({ d: days[i], c }))]));
  closes["B.NS"] = [{ d: days[0], c: 100 }, { d: days[2], c: 95 }]; // B is missing a day
  const r = L.moverStats(list, closes, cfg);
  assert.deepEqual(r.days, ["2026-09-24", "2026-09-23"]);
  assert.deepEqual(r.stocks.map(x => x.symbol), ["A"]);
  assert.equal(r.stocks[0].sessions[0], -40);
  const b = r.stocks.concat([]).length; assert.equal(b, 1);
  assert.equal(r.clusters.length, 1);
  assert.equal(r.clusters[0].industry, "Fin");
  assert.equal(r.clusters[0].direction, "down");
  assert.deepEqual(r.clusters[0].stocks.map(x => x.symbol), ["A", "B", "C"]);
});
