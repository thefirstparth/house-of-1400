// The trial's Sky Report feed (lib/look-sky.js): the parts of the day from Open-Meteo's hours, MET Norway as backup.
// Fixtures: Open-Meteo for Bengaluru, Ranchi and Prayagraj and MET Norway for Bengaluru, as they answered on 27 Nov 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupParts, partOf, partCode, parseOpenMeteo, parseMetnoHours, metCode, lookSky, istHour, LOOK_SKY, LOOK_SKY_CACHE } from "../lib/look-sky.js";

const OM = JSON.parse(readFileSync(new URL("./fixtures/look-sky-om.json", import.meta.url)));
const MET = JSON.parse(readFileSync(new URL("./fixtures/look-sky-met.json", import.meta.url)));
const NOW = Date.parse("2026-11-27T00:45:00Z"); // 06:15 IST
const CITIES = [{ name: "Bengaluru" }, { name: "Ranchi" }, { name: "Prayagraj" }];
const hours = (fromLocal, n, f = () => ({})) => Array.from({ length: n }, (_, i) => ({ time: istHour(Date.parse(fromLocal + ":00+05:30") + i * 36e5), temp: 20 + (i % 5), rain_prob: 10, code: 3, ...f(i) }));

test("the parts of the day, in IST", () => {
  assert.deepEqual([0, 5, 6, 11, 12, 16, 17, 20, 21, 23].map(h => partOf(h).key), ["tonight", "tonight", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "tonight", "tonight"]);
});

test("Open-Meteo's hours grouped from the part under way", () => {
  const [blr, rnc, pyj] = parseOpenMeteo(OM, CITIES, NOW);
  assert.equal(blr.name, "Bengaluru");
  assert.deepEqual(blr.parts.map(p => p.key), ["morning", "afternoon", "evening", "tonight", "morning"]);
  const [m, a, e, t] = blr.parts;
  assert.deepEqual([m.rain, m.tmin, m.tmax, m.hours], [8, 20, 27, 6]);
  assert.deepEqual([a.rain, a.tmin, a.tmax, a.hours], [87, 26, 29, 5]);
  assert.equal(e.rain, 84);
  // a wet afternoon is drawn wet, not as a cloud
  assert.ok(a.code >= 51);
  // tonight runs from 21:00 to 06:00 the next day
  assert.equal(t.start, "2026-11-27T21:00:00+05:30");
  assert.equal(t.end, "2026-11-28T06:00:00+05:30");
  assert.equal(t.hours, 9);
  assert.equal(rnc.parts[0].rain, 0);
  assert.equal(pyj.name, "Prayagraj");
});

test("the part under way starts at this hour", () => {
  const P = groupParts(hours("2026-11-27T00:00", 48), Date.parse("2026-11-27T13:20:00+05:30"));
  assert.equal(P[0].key, "afternoon");
  assert.equal(P[0].partial, true);
  assert.equal(P[0].first, "2026-11-27T13:00:00+05:30");
  assert.equal(P[0].hours, 4);
  assert.deepEqual(P.map(p => p.key), ["afternoon", "evening", "tonight", "morning", "afternoon"]);
});

test("after midnight, tonight is the night that began the evening before", () => {
  const P = groupParts(hours("2026-11-27T00:00", 48), Date.parse("2026-11-28T02:30:00+05:30"));
  assert.equal(P[0].key, "tonight");
  assert.equal(P[0].start, "2026-11-27T21:00:00+05:30");
  assert.equal(P[0].end, "2026-11-28T06:00:00+05:30");
  assert.equal(P[0].hours, 4);
});

test("bad temperatures and missing chances", () => {
  const P = groupParts(hours("2026-11-27T06:00", 30, i => (i === 1 ? { temp: 999 } : i < 6 ? { rain_prob: null } : {})), Date.parse("2026-11-27T06:10:00+05:30"));
  assert.equal(P[0].hours, 5);
  assert.equal(P[0].rain, null);
  assert.ok(P[0].tmax < 60);
});

test("the sky of a part", () => {
  assert.equal(partCode([{ code: 3 }, { code: 3 }, { code: 61 }], 20), 3);
  assert.equal(partCode([{ code: 3 }, { code: 3 }, { code: 61 }], 70), 61);
  assert.equal(partCode([{ code: 61 }, { code: 95 }], 80), 95);
  assert.equal(partCode([{ code: null }], 0), null);
});

test("MET Norway's hours: no chance of rain, millimetres instead", () => {
  const H = parseMetnoHours(MET);
  assert.ok(H.length >= 30);
  assert.ok(H.every(h => h.rain_prob === null && /^\d{4}-\d\d-\d\dT\d\d:00$/.test(h.time)));
  assert.equal(metCode("lightrainshowers_day"), 80);
  assert.equal(metCode("heavyrainandthunder"), 95);
  assert.equal(metCode("partlycloudy_night"), 2);
  const P = groupParts(H, NOW);
  assert.equal(P[0].rain, null);
  assert.ok(P[0].rain_mm != null);
});

test("lookSky: Open-Meteo first, MET Norway for a city it misses, nothing when both fail", async () => {
  const r = await lookSky(null, { now: NOW, fetchJSON: async () => OM });
  assert.equal(r.ok, true);
  assert.equal(r.source, "Open-Meteo");
  assert.deepEqual(r.value.cities.map(c => c.name), ["Bengaluru", "Ranchi", "Prayagraj"]);
  const b = await lookSky(null, { now: NOW, fetchJSON: async u => { if (u.includes("open-meteo")) throw new Error("down"); return MET; } });
  assert.equal(b.source, "MET Norway");
  assert.equal(b.value.cities[0].parts[0].rain, null);
  const f = await lookSky(null, { now: NOW, fetchJSON: async () => { throw new Error("down"); } });
  assert.equal(f.ok, false);
  assert.equal(typeof LOOK_SKY.look_sky, "function");
  assert.deepEqual(LOOK_SKY_CACHE.look_sky, [1800, 3600]);
});
