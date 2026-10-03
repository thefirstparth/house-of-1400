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

import { rainTtl, fyOf } from "../lib/rain.js";
const B = { day_slot_min: 30, night_slot_min: 120, night_hours: [0, 6] }, at = s => Date.parse(s);
test("rainTtl: every 30 minutes by day, every 2 hours at night, never two readings across a boundary", () => {
  assert.equal(rainTtl(at("2026-10-03T07:40:00+05:30"), B), 20 * 60);
  assert.equal(rainTtl(at("2026-10-04T00:10:00+05:30"), B), 110 * 60);
  assert.equal(rainTtl(at("2026-10-04T05:30:00+05:30"), B), 30 * 60); // the night ends at 06:00
  assert.equal(rainTtl(at("2026-10-03T07:59:30+05:30"), B), 30.5 * 60); // held to the end of the next slot
  let n = 0; for (let ms = at("2026-10-03T00:00:00+05:30"); ms < at("2026-10-04T00:00:00+05:30");) { n++; ms += rainTtl(ms, B) * 1000 + 1; }
  assert.ok(n * 6 <= 240, `${n * 6} calls a day`); // within 60,000 a year and 1,000 a day
});
test("fyOf: April to March", () => { assert.equal(fyOf(at("2027-03-31T23:00:00+05:30")), "2026-27"); assert.equal(fyOf(at("2027-04-01T00:30:00+05:30")), "2027-28"); });
