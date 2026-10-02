// The temperature now, measured (lib/live.js): IMD and METAR readings parsed, the freshest within 75 minutes used, a
// stale or implausible one never.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImd, parseMetar, pickMeasured, applyMeasured, FRESH_MIN } from "../lib/live.js";

const imd = (o = {}) => [{ "Station Id": "43296", Station: "Bengaluru-HAL Airport", "Date of Observation": "2026-10-02", Time: "23", Temperature: "21", Humidity: "94", "Wind Speed KMPH": "3.7", "Feel Like": "21", ...o }];
const at = s => Date.parse(s);

test("an IMD reading: the UTC hour of the report, numbers checked", () => {
  const r = parseImd(imd());
  assert.equal(r.temp, 21); assert.equal(r.humidity, 94); assert.equal(r.wind, 3.7); assert.equal(r.at, at("2026-10-02T23:00:00Z")); assert.equal(r.source, "IMD");
  assert.equal(parseImd(imd({ Temperature: "NA" })), null);
  assert.equal(parseImd(imd({ Temperature: "99" })), null);
  assert.equal(parseImd(imd({ Time: "" })), null);
  assert.equal(parseImd(imd({ Humidity: "NA" })).humidity, null);
  assert.equal(parseImd([]), null);
});

test("a METAR: humidity from the dew point, wind from knots", () => {
  const r = parseMetar({ icaoId: "VOBG", obsTime: at("2026-10-02T23:30:00Z") / 1000, temp: 21, dewp: 20, wspd: 4 });
  assert.equal(r.temp, 21); assert.equal(r.humidity, 94); assert.equal(r.wind, 7.4); assert.equal(r.source, "METAR");
  assert.equal(parseMetar({ icaoId: "X", obsTime: 1, temp: null }), null);
});

test("the freshest reading within 75 minutes wins; stale, future or far-off ones never", () => {
  const now = at("2026-10-03T00:00:00Z"), r = (t, min) => ({ temp: t, at: now - min * 6e4 });
  assert.equal(pickMeasured([r(21, 30), r(22, 60)], { temp: 20 }, now).temp, 21);
  assert.equal(pickMeasured([r(21, FRESH_MIN + 1)], { temp: 20 }, now), null);
  assert.equal(pickMeasured([r(21, -30)], { temp: 20 }, now), null);
  assert.equal(pickMeasured([r(30, 10)], { temp: 20 }, now), null, "more than 6 degrees from the model: a faulty station");
  assert.equal(pickMeasured([], { temp: 20 }, now), null);
});

test("applied: temperature, feels, the day's high and low hold it; the sky stays the model's", () => {
  const w = { current: { temp: 19.9, feels: 22, code: 1, humidity: 90, wind: 2 }, daily: [{ max: 29, min: 20 }, { max: 30, min: 21 }] };
  const m = { temp: 18.5, humidity: 95, wind: 0, feels: null, at: at("2026-10-02T23:30:00Z"), source: "METAR", station: "VOBG" };
  const o = applyMeasured(w, m);
  assert.equal(o.current.temp, 18.5); assert.equal(o.current.code, 1); assert.equal(o.current.measured.station, "VOBG");
  assert.equal(o.current.feels, 20.6, "the model's gap (22 - 19.9) on the measured 18.5");
  assert.equal(o.daily[0].min, 18.5); assert.equal(o.daily[0].max, 29); assert.equal(o.daily[1].min, 21);
  assert.equal(applyMeasured(w, null), w);
});
