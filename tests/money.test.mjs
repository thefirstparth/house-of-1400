// The Ledger's extra blocks (lib/money.js) and breadth (lib/live.js moverStats).
import { test } from "node:test";
import assert from "node:assert/strict";

import { pickEvent, readDecision, readLevels, parseNseFlows, parseNsdlMonth } from "../lib/money.js";
import { moverStats } from "../lib/live.js";

const NOW = Date.parse("2026-09-30T06:00:00Z");
const ev = (title, endDate, volume, markets = []) => ({ title, endDate, volume, markets, closed: false, slug: title.toLowerCase().replace(/\W+/g, "-") });

test("topics pick the soonest open event that matches, has traded enough and is not about to settle", () => {
  const oil = { match: "^What will WTI Crude Oil \\(WTI\\) hit in [A-Z][a-z]+ \\d{4}\\?$", min_days: 5, min_volume: 10000 };
  const E = [ev("What will WTI Crude Oil (WTI) hit in September 2026?", "2026-10-01T04:00:00Z", 900000), ev("What will WTI Crude Oil (WTI) hit in October 2026?", "2026-11-01T04:00:00Z", 90000),
    ev("WTI Crude Oil (WTI) closes above ___ on September 30?", "2026-09-30T20:00:00Z", 500000), ev("What will WTI Crude Oil (WTI) hit in November 2026?", "2026-12-01T04:00:00Z", 900)];
  assert.equal(pickEvent(E, oil, NOW).title, "What will WTI Crude Oil (WTI) hit in October 2026?");
  assert.equal(pickEvent(E, { ...oil, min_volume: 1e9 }, NOW), null);
});

test("a decision lists outcomes of 1% or more, most likely first", () => {
  const m = (t, p, chg) => ({ groupItemTitle: t, outcomePrices: JSON.stringify([String(p), String(1 - p)]), oneDayPriceChange: chg, closed: false });
  const out = readDecision({ markets: [m("25 bps increase", 0.435, -0.25), m("No change", 0.555, 0.25), m("50+ bps decrease", 0.0025)] });
  assert.deepEqual(out.map(o => [o.label, o.p]), [["No change", 0.555], ["25 bps increase", 0.435]]);
});

test("levels: the three least certain, one on each side, low to high; settled levels left out", () => {
  const m = (t, p, closed = false) => ({ groupItemTitle: t, outcomePrices: JSON.stringify([String(p), String(1 - p)]), closed, volume24hr: 100 });
  const L = readLevels({ markets: [m("↑ $100", 0.525), m("↑ $105", 0.39), m("↑ $110", 0.175), m("↓ $80", 0.49), m("↓ $85", 0.78), m("↑ $95", 1, true), m("↑ $150", 0.009)] });
  assert.deepEqual(L.map(l => `${l.label} ${l.p}`), ["dips to $80 0.49", "reaches $100 0.525", "reaches $105 0.39"]);
  const onlyUp = readLevels({ markets: [m("↑ $100", 0.5), m("↑ $105", 0.45), m("↑ $110", 0.4), m("↓ $70", 0.06)] });
  assert.ok(onlyUp.some(l => l.direction === "down"), "the other side is kept when it exists");
});

test("flows: NSE's provisional rows and NSDL's month", () => {
  const d = parseNseFlows([{ buyValue: "43801.18", category: "DII", date: "29-Sep-2026", netValue: "5816.76", sellValue: "37984.42" }, { buyValue: "22000.54", category: "FII/FPI", date: "29-Sep-2026", netValue: "-8642.16", sellValue: "30642.7" }]);
  assert.deepEqual([d.date, d.fii, d.dii], ["2026-09-29", -8642.16, 5816.76]);
  assert.throws(() => parseNseFlows([]));
  const row = (date, net) => `<tr><td>${date}</td><td>Equity</td><td>Stock Exchange</td><td>1</td><td>2</td><td>(1)</td></tr><tr><td>Sub-total</td><td>10</td><td>20</td><td>${net}</td><td>x</td></tr>`;
  const html = `<table>${row("31-Aug-2026", "900.00")}${row("01-Sep-2026", "(5,432.83)")}${row("29-Sep-2026", "(4967.58)")}${row("30-Sep-2026", "1000.41")}</table>`;
  const M = parseNsdlMonth(html);
  assert.equal(M.month, "2026-09"); assert.equal(M.days, 3); assert.equal(M.net, -9400); assert.deepEqual(M.latest, { date: "2026-09-30", net: 1000.41 });
});

test("breadth: up and down on the latest session, three each way, industries by median", () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ name: `Co ${i} Ltd.`, symbol: `S${i}`, industry: i < 6 ? "IT" : "Banks" }));
  const closes = Object.fromEntries(list.map((x, i) => [`${x.symbol}.NS`, [{ d: "2026-09-28", c: 100 }, { d: "2026-09-29", c: 100 + (i - 4) }]]));
  const B = moverStats(list, closes, { sessions: 1, stock_pct: 8, industry_pct: 2.5, industry_min_stocks: 5 }).breadth;
  assert.equal(B.day, "2026-09-29"); assert.equal(B.up, 7); assert.equal(B.down, 4); assert.equal(B.flat, 1);
  assert.deepEqual(B.gainers.map(g => g.symbol), ["S11", "S10", "S9"]); assert.deepEqual(B.losers.map(g => g.symbol), ["S0", "S1", "S2"]);
  assert.equal(B.best[0].industry, "Banks"); assert.equal(B.worst[0].industry, "IT");
});
