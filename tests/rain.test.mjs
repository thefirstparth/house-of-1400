import { test } from "node:test";
import assert from "node:assert/strict";
import { placeOf, rainWord } from "../lib/rain.js";

const P = { id: "home", name: "Home", area: "Hoodi" };
test("rainWord: the IMD's words for a rate in mm an hour", () => {
  assert.equal(rainWord(0), "dry"); assert.equal(rainWord(1), "light"); assert.equal(rainWord(4), "moderate");
  assert.equal(rainWord(20), "heavy"); assert.equal(rainWord(60), "very heavy");
});
test("placeOf: raining when any gauge reads rain; the heaviest rate, the wettest total", () => {
  const p = placeOf(P, [{ name: "A", ok: true, intensity: 0, today: 2 }, { name: "B", ok: true, intensity: 0.07, today: 6.4 }, { name: "C", ok: false }]);
  assert.equal(p.raining, true); assert.equal(p.rate_mm_h, 4.2); assert.equal(p.word, "moderate"); assert.equal(p.today_mm, 6.4);
  assert.deepEqual(p.wet_at, ["B"]); assert.equal(p.gauges, 2); assert.equal(p.of, 3);
});
test("placeOf: dry, and no answer at all means no place", () => {
  assert.equal(placeOf(P, [{ name: "A", ok: true, intensity: 0, today: 0 }]).raining, false);
  assert.equal(placeOf(P, [{ name: "A", ok: false }]), null);
});

import { rainTtl, rainPlan, inWindow, fyOf } from "../lib/rain.js";
const at = s => Date.parse(s);
test("rainPlan: under 60,000 in any financial year, a leap year included, and under 1,000 a day", () => {
  const B = { fy_cap: 60000, reserve: 3000, day_cap: 1000, window: [6, 24] };
  for (const g of [1, 4, 6, 8, 12]) {
    const p = rainPlan(g, B);
    assert.ok(p.perYear <= 57000, `${g} gauges: ${p.perYear} a year`);
    assert.ok((p.reads + 1) * g <= 1000);
  }
  assert.deepEqual(rainPlan(6, B), { perDay: 155, reads: 24, slot: 45, window: [6, 24], perYear: 54900 });
});
test("rainTtl: every 45 minutes from 06:00, none overnight, never two readings across a boundary", () => {
  const p = rainPlan(6, { fy_cap: 60000, reserve: 3000, window: [6, 24] });
  assert.equal(rainTtl(at("2026-10-03T06:10:00+05:30"), p), 35 * 60);
  assert.equal(rainTtl(at("2026-10-03T06:44:30+05:30"), p), 45.5 * 60); // held to the end of the next slot
  assert.equal(rainTtl(at("2026-10-04T02:00:00+05:30"), p), 4 * 3600);  // overnight: held to 06:00
  assert.equal(rainTtl(at("2026-10-03T23:30:00+05:30"), p), 6.5 * 3600); // the last slot runs to 06:00
  assert.equal(inWindow(at("2026-10-04T02:00:00+05:30"), p), false);
  let n = 0; for (let ms = at("2026-10-03T00:00:00+05:30"); ms < at("2026-10-04T00:00:00+05:30");) { if (inWindow(ms, p)) n++; ms += rainTtl(ms, p) * 1000 + 1; }
  assert.ok(n <= p.reads, `${n} readings`);
});
test("fyOf: April to March", () => { assert.equal(fyOf(at("2027-03-31T23:00:00+05:30")), "2026-27"); assert.equal(fyOf(at("2027-04-01T00:30:00+05:30")), "2027-28"); });
