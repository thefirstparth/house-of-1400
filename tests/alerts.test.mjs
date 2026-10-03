import { test } from "node:test";
import assert from "node:assert/strict";
import { keepAlerts, sachetTime } from "../lib/trial.js";

test("sachetTime: Sachet's IST times", () => assert.equal(new Date(sachetTime("Sat Oct 03 21:00:00 IST 2026")).toISOString(), "2026-10-03T15:30:00.000Z"));
test("keepAlerts: real warnings only, not ended, most severe first, no repeats", () => {
  const now = Date.parse("2026-10-03T03:00:00Z"), until = "Sat Oct 03 21:00:00 IST 2026";
  const out = keepAlerts([
    { city: "Ranchi", colour: "yellow", severity: "WATCH", type: "Thunderstorm", until },
    { city: "Bengaluru", colour: "orange", severity: "ALERT", type: "Heavy Rain", until },
    { city: "Bengaluru", colour: "orange", severity: "ALERT", type: "Heavy Rain", until },
    { city: "Bengaluru", colour: "yellow", severity: "WATCH", type: "Light Rain", until },
    { city: "Prayagraj", colour: "yellow", severity: "WATCH", type: "Flood", until: "Sat Oct 03 06:00:00 IST 2026" },
    { city: "Prayagraj", colour: "green", severity: "MINOR", type: "Flood", until },
  ], now);
  assert.deepEqual(out.map(a => `${a.city} ${a.type}`), ["Bengaluru Heavy Rain", "Ranchi Thunderstorm"]);
});
