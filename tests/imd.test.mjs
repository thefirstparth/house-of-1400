import { test } from "node:test";
import assert from "node:assert/strict";
import { stationWarning, parseSilam } from "../lib/imd.js";

const base = { Station: "Bengaluru City", Date: "2026-10-03", toi: "1400", vupto: "1700" };
const zero = Object.fromEntries([...Array(19)].map((_, i) => [`cat${i + 1}`, 0]));
test("stationWarning: what IMD expects, strongest first, only while it holds", () => {
  const now = Date.parse("2026-10-03T15:00:00+05:30");
  const w = stationWarning({ ...base, ...zero, cat2: 2, cat9: 9 }, now);
  assert.deepEqual(w.what, ["a moderate thunderstorm, gusts to 61 km/h", "light rain"]); assert.equal(w.level, 3);
  assert.equal(w.until, "2026-10-03T11:30:00.000Z");
  assert.equal(stationWarning({ ...base, ...zero, cat1: 1 }, now), null); // no warning
  assert.equal(stationWarning({ ...base, ...zero, cat2: 2 }, Date.parse("2026-10-03T18:00:00+05:30")), null); // over
  assert.equal(stationWarning({ ...base, ...zero, cat2: 2, toi: "2200", vupto: "0100" }, Date.parse("2026-10-04T00:30:00+05:30")).until, "2026-10-03T19:30:00.000Z"); // past midnight
});
test("parseSilam: the data inside the page", () => {
  const html = `<script>var x = {"dates": ["03.10.2026"], "cities": [{"sl": 1, "city": "Bengaluru (Karnataka)", "aqi": {"03.10.2026": "Satisfactory"}}]};</script>`;
  assert.equal(parseSilam(html).cities[0].aqi["03.10.2026"], "Satisfactory");
});
