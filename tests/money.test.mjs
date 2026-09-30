// The Ledger's extra blocks (lib/money.js) and breadth (lib/live.js moverStats).
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNseFlows, parseNsdlMonth } from "../lib/money.js";
import { moverStats } from "../lib/live.js";

test("flows: NSE's provisional rows and NSDL's month", () => {
  const d = parseNseFlows([{ buyValue: "43801.18", category: "DII", date: "29-Sep-2026", netValue: "5816.76", sellValue: "37984.42" }, { buyValue: "22000.54", category: "FII/FPI", date: "29-Sep-2026", netValue: "-8642.16", sellValue: "30642.7" }]);
  assert.deepEqual([d.date, d.fii, d.dii], ["2026-09-29", -8642.16, 5816.76]);
  assert.throws(() => parseNseFlows([]));
  const row = (date, net) => `<tr><td>${date}</td><td>Equity</td><td>Stock Exchange</td><td>1</td><td>2</td><td>(1)</td></tr><tr><td>Sub-total</td><td>10</td><td>20</td><td>${net}</td><td>x</td></tr>`;
  const html = `<table>${row("31-Aug-2026", "900.00")}${row("01-Sep-2026", "(5,432.83)")}${row("29-Sep-2026", "(4967.58)")}${row("30-Sep-2026", "1000.41")}</table>`;
  const M = parseNsdlMonth(html);
  assert.equal(M.month, "2026-09"); assert.equal(M.days, 3); assert.equal(M.net, -9400); assert.deepEqual(M.latest, { date: "2026-09-30", net: 1000.41 });
});

test("breadth: up and down on the latest session, five each way from the large companies, industries by median", () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ name: `Co ${i} Ltd.`, symbol: `S${i}`, industry: i < 6 ? "IT" : "Banks" }));
  const closes = Object.fromEntries(list.map((x, i) => [`${x.symbol}.NS`, [{ d: "2026-09-28", c: 100 }, { d: "2026-09-29", c: 100 + (i - 4) }]]));
  const B = moverStats(list, closes, { sessions: 1, stock_pct: 8, industry_pct: 2.5, industry_min_stocks: 5 }).breadth;
  assert.equal(B.day, "2026-09-29"); assert.equal(B.up, 7); assert.equal(B.down, 4); assert.equal(B.flat, 1);
  assert.deepEqual(B.gainers.map(g => g.symbol), ["S11", "S10", "S9", "S8", "S7"]); assert.deepEqual(B.losers.map(g => g.symbol), ["S0", "S1", "S2", "S3"], "only stocks that fell");
  const L = moverStats(list, closes, { sessions: 1, stock_pct: 8, industry_pct: 2.5, industry_min_stocks: 5 }, new Set(["S0", "S3", "S9"])).breadth;
  assert.deepEqual(L.gainers.map(g => g.symbol), ["S9"], "biggest movers only from the large-company list"); assert.deepEqual(L.losers.map(g => g.symbol), ["S0", "S3"]); assert.equal(L.movers_from, "Nifty 100"); assert.equal(L.up, 7, "breadth still counts every stock");
  assert.equal(B.best[0].industry, "Banks"); assert.equal(B.worst[0].industry, "IT");
});
