// Offline tests for the trial's Market Pulse feeds (lib/look-money.js): Yahoo chart parsing, the Treasury backup, the
// policy-rate table's expiry. Fixtures are real answers saved on 27 Nov 2026 (tests/fixtures/look-money/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMODITIES, POLICY_RATES, parseChart, parseTreasury, policyRates, treasuryQuote } from "../lib/look-money.js";

const fx = f => readFileSync(new URL(`./fixtures/look-money/${f}`, import.meta.url), "utf8");
const tnx = JSON.parse(fx("tnx-3mo.json")), si = JSON.parse(fx("si-3mo.json"));

test("a Yahoo daily chart: price, previous close, the day's change and a month of closes", () => {
  const m = tnx.chart.result[0].meta;
  const q = parseChart(tnx, { now: Date.parse("2026-11-27T01:00:00Z") });
  assert.equal(q.price, m.regularMarketPrice);
  assert.ok(q.prev > 0 && q.prev !== q.price);
  assert.equal(q.change, Math.round((q.price - q.prev) * 1e4) / 1e4);
  assert.match(q.session_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(q.spark30.at(-1), Math.round(q.price * 1e4) / 1e4, "the line ends at the price");
  assert.ok(q.spark30.length >= 15 && q.spark30.length <= 25, `a month of daily closes, got ${q.spark30.length}`);
  assert.ok(q.spark30.every(v => typeof v === "number" && isFinite(v)), "no nulls in the line");
  assert.ok(q.spark_from >= "2026-10-25" && q.spark_to === q.session_date);
});

test("a future takes the previous settlement it is given, and is live while its prints are fresh", () => {
  const t = si.chart.result[0].meta.regularMarketTime * 1000;
  const q = parseChart(si, { prevClose: 40.538, now: t + 10 * 6e4 });
  assert.equal(q.prev, 40.538);
  assert.equal(q.change_pct, Math.round((q.price / 40.538 - 1) * 100 * 1e4) / 1e4);
  assert.equal(q.live, true);
  assert.equal(parseChart(si, { prevClose: 40.538, now: t + 3 * 36e5 }).live, false, "three hours without a print is closed");
});

test("a broken Yahoo answer throws instead of giving a figure", () => {
  assert.throws(() => parseChart({ chart: { result: [{ meta: { regularMarketPrice: null } }] } }));
  assert.throws(() => parseChart({}));
});

test("null closes never reach the line", () => {
  const j = structuredClone(tnx); j.chart.result[0].indicators.quote[0].close[5] = null;
  const q = parseChart(j);
  assert.ok(q.spark30.every(v => v != null));
});

test("the Treasury's par yield CSV: the 10 Yr column, oldest first, then a quote", () => {
  const rows = parseTreasury(fx("treasury-2026.csv"));
  assert.ok(rows.length >= 10);
  assert.deepEqual(rows.at(-1), { d: "2026-11-25", c: 4.85 });
  assert.deepEqual(rows.at(-2), { d: "2026-11-24", c: 4.91 });
  const q = treasuryQuote(rows);
  assert.equal(q.price, 4.85); assert.equal(q.prev, 4.91); assert.equal(q.change, -0.06); assert.equal(q.session_date, "2026-11-25");
  assert.throws(() => parseTreasury("Date,1 Mo\n11/25/2026,4.27"), /10 Yr/);
  assert.throws(() => treasuryQuote(rows.slice(0, 1)));
});

test("the policy-rate table: each card is good until its next decision is announced, then hides", () => {
  for (const p of POLICY_RATES) {
    for (const k of ["id", "label", "value", "set_on", "next_decision", "next_at", "checked", "source", "url", "evidence"]) assert.ok(p[k], `${p.id}.${k}`);
    assert.ok(Date.parse(p.next_at) > Date.parse(p.set_on), `${p.id}: next decision after the last`);
    assert.equal(p.next_at.slice(0, 10), p.next_decision, `${p.id}: next_at is on the decision day`);
    assert.doesNotMatch(p.value + p.move + p.label, /—/, "no em dashes");
  }
  assert.deepEqual(policyRates(Date.parse("2026-11-27T12:00:00Z")).map(p => p.id), ["repo", "fed"]);
  assert.deepEqual(policyRates(Date.parse("2026-12-04T04:30:00Z")).map(p => p.id), ["fed"], "the repo card hides at the MPC's announcement");
  assert.deepEqual(policyRates(Date.parse("2026-12-10T00:00:00Z")), []);
});

test("commodities keep their own units", () => {
  assert.deepEqual(COMMODITIES.map(c => [c.symbol, c.unit]), [["SI=F", "$ per ounce"], ["NG=F", "$ per MMBtu"], ["HG=F", "$ per lb"]]);
});
