import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeSeries, tdChart, tdKey } from "../lib/twelvedata.js";
import { fx } from "../lib/live.js";

// Twelve Data's daily series (newest first), 70 sessions of a rising index
const series = (n = 70, from = "2026-07-01", start = 70000, step = 50) => {
  const v = []; let d = Date.parse(from + "T00:00:00Z");
  for (let i = 0; i < n; i++) { const day = new Date(d).getUTCDay(); if (day !== 0 && day !== 6) v.push({ datetime: new Date(d).toISOString().slice(0, 10), close: String(start + v.length * step) }); d += 864e5; if (v.length >= n) break; }
  return { meta: { symbol: "BSESN", currency: "INR", exchange_timezone: "Asia/Kolkata", type: "Index" }, values: v.reverse(), status: "ok" };
};

test("twelvedata: a daily series reads like Yahoo's chart (price, previous close, 7D, 1M, 3-month range)", () => {
  const j = series(), q = shapeSeries(j, { yahoo: "^BSESN" });
  const closes = j.values.map(v => Number(v.close));
  assert.equal(q.symbol, "^BSESN");
  assert.equal(q.price, closes[0]); assert.equal(q.prev, closes[1]);
  assert.ok(Math.abs(q.change_pct - ((closes[0] - closes[1]) / closes[1]) * 100) < 1e-9);
  assert.equal(q.session_date, j.values[0].datetime);
  assert.ok(q.chg_7d > 0 && q.chg_1m > q.chg_7d, `${q.chg_7d} ${q.chg_1m}`);
  assert.equal(q.hi3m, q.price); assert.equal(q.source, "Twelve Data");
  assert.equal(q.live, false, "no exchange hours given: never marked live");
  assert.throws(() => shapeSeries({ values: [{ datetime: "2026-10-16", close: "1" }] }, {}), /too few/);
});

test("twelvedata: the rupee falls back Yahoo, Twelve Data, then ExchangeRate-API; the key never shows", async () => {
  const real = globalThis.fetch, env = process.env.TWELVEDATA_KEY;
  process.env.TWELVEDATA_KEY = "secret-key-123";
  const asked = [];
  globalThis.fetch = async (url) => {
    url = String(url); asked.push(url.replace(/apikey=[^&]+/, "apikey=…"));
    if (url.includes("yahoo")) return new Response("busy", { status: 503 });
    if (url.includes("twelvedata")) { const j = series(70, "2026-07-01", 93, 0.02); j.meta = { symbol: "USD/INR", currency: "INR" }; return new Response(JSON.stringify(j), { status: 200 }); }
    return new Response("{}", { status: 500 });
  };
  try {
    assert.equal(tdKey().name, "TWELVEDATA_KEY");
    const r = await fx();
    assert.equal(r.ok, true); assert.equal(r.source, "Twelve Data"); assert.equal(r.value.symbol, "INR=X");
    assert.ok(r.value.price > 70 && r.value.price < 130);
    assert.ok(asked.some(u => u.includes("api.twelvedata.com/time_series?symbol=USD%2FINR")));
    // an error from Twelve Data never carries the key
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 401, message: "**apikey** secret-key-123 is invalid", status: "error" }), { status: 401 });
    await assert.rejects(tdChart("NSEI", { yahoo: "^NSEI" }), e => !e.message.includes("secret-key-123") && /401/.test(e.message));
  } finally { globalThis.fetch = real; if (env === undefined) delete process.env.TWELVEDATA_KEY; else process.env.TWELVEDATA_KEY = env; }
});
