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
