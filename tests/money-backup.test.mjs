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

test("money backup: NSE's own level for its indices and Moneycontrol's for the Sensex (18 Oct)", async () => {
  const { nseQuoteOf, moneycontrolQuoteOf } = await import("../lib/live.js");
  const row = { index: "NIFTY 50", last: 23146.15, previousClose: 22997.35, oneWeekAgoVal: 22520.45, oneMonthAgoVal: 23270.6, oneWeekAgo: "09-Oct-2026", date30dAgo: "17-Sep-2026", previousDay: "16-Oct-2026" };
  const hours = { tz: "Asia/Kolkata", open: "09:15", close: "15:30", days: [1, 2, 3, 4, 5] };
  const q = nseQuoteOf(row, "16-Oct-2026 15:30", { yahoo: "^NSEI", hours, now: new Date("2026-10-18T06:00:00Z") });
  assert.equal(q.symbol, "^NSEI"); assert.equal(q.price, 23146.15); assert.equal(q.prev, 22997.35);
  assert.equal(Math.round(q.change_pct * 100) / 100, 0.65); assert.equal(q.session_date, "2026-10-16"); assert.equal(q.live, false, "a Sunday");
  assert.equal(q.chg_7d, 2.78); assert.equal(q.returns_source, "NSE"); assert.equal(q.source, "NSE"); assert.equal(q.spark30, null);
  const live = nseQuoteOf(row, "16-Oct-2026 11:00", { yahoo: "^NSEI", hours, now: new Date("2026-10-16T05:40:00Z") });
  assert.equal(live.live, true, "a Friday at 11:10 IST");
  const m = moneycontrolQuoteOf({ pricecurrent: "74729.27", priceprevclose: "74315.61", lastupd_epoch: "1792147202", market_state: "CLOSED", cl1wPerChange: "3.11", cl1wDt: "2026-10-09", cl1mPerChange: "0.53", cl1mDt: "2026-09-16" }, { yahoo: "^BSESN", hours });
  assert.equal(m.price, 74729.27); assert.equal(m.session_date, "2026-10-16"); assert.equal(m.live, false); assert.equal(m.chg_1m, 0.53); assert.equal(m.source, "Moneycontrol");
  assert.throws(() => moneycontrolQuoteOf({ pricecurrent: "" }, {}), /no level/);
});
