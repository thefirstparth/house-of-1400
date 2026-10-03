import { test } from "node:test";
import assert from "node:assert/strict";
import { nseReturnsOf } from "../lib/live.js";

const row = { index: "NIFTY 50", last: 22421.95, oneWeekAgoVal: 23140.5, oneWeekAgo: "25-Sep-2026", oneMonthAgoVal: 23914.45, date30dAgo: "02-Sep-2026" };
test("nseReturnsOf: NSE's week and month, with their dates", () => {
  assert.deepEqual(nseReturnsOf(row, 22421.95), { chg_7d: -3.11, from_7d: "2026-09-25", chg_1m: -6.24, from_1m: "2026-09-02", returns_source: "NSE" });
});
test("nseReturnsOf: refuses a level that is not the price shown", () => {
  assert.throws(() => nseReturnsOf(row, 23000));
  assert.throws(() => nseReturnsOf(undefined, 22421.95));
});
