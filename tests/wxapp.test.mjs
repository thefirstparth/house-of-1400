// The weather app's feed (lib/wxapp.js): real Open-Meteo, ensemble, CAMS and MET Norway answers from 22 and 23 Oct
// 2026 put into the app's shape; India's AQI; rain chances from the 51 runs; the words; no coordinates in the output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indiaAqi, aqiCat, kindOf, compass, rainChances, fromOpenMeteo, fromMetno, fromGoogle, airFromCams, airFromGoogle, metarVis, assemble, lineFor, chipFor, headlineFor, points, gKind } from "../lib/wxapp.js";

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-10-23T00:20:00Z"); // 5:50 am IST
const blr = { id: "blr", name: "Bengaluru", state: "Karnataka", elev: 920, lat: 12.99, lon: 77.71 };

test("India's AQI: CPCB's breakpoints, the worse of PM2.5 and PM10", () => {
  assert.deepEqual(indiaAqi(15, 25), { v: 25, cat: "Good", lead: "PM2.5" });
  assert.deepEqual(indiaAqi(45, 40), { v: 75, cat: "Satisfactory", lead: "PM2.5" });
  assert.deepEqual(indiaAqi(40, 300), { v: 250, cat: "Poor", lead: "PM10" });
  assert.equal(indiaAqi(130, 0).cat, "Very poor");
  assert.equal(indiaAqi(600, 0).v, 500);
  assert.equal(indiaAqi(null, undefined), null);
  assert.deepEqual([50, 51, 100, 101, 200, 201, 300, 301, 400, 401].map(aqiCat), ["Good", "Satisfactory", "Satisfactory", "Moderate", "Moderate", "Poor", "Poor", "Very poor", "Very poor", "Severe"]);
});

test("the sky in a word from WMO codes; the wind's compass point", () => {
  assert.deepEqual([0, 1, 2, 3, 45, 51, 61, 63, 65, 80, 81, 82, 95, 99].map(kindOf), ["clear", "partly", "partly", "cloudy", "fog", "drizzle", "drizzle", "rain", "heavyrain", "rain", "rain", "heavyrain", "storm", "storm"]);
  assert.equal(kindOf(null), null);
  assert.deepEqual([0, 44, 72, 180, 245, 359].map(compass), ["N", "NE", "E", "S", "SW", "N"]);
  assert.equal(gKind("SCATTERED_THUNDERSTORMS"), "storm"); assert.equal(gKind("MOSTLY_CLOUDY"), "cloudy"); assert.equal(gKind(undefined), null);
});

test("rain chances are the share of the ensemble's runs with rain, by hour and by day", () => {
  const ch = rainChances(fx("wx-ens-blr-2026-10-23.json"));
  assert.equal(ch.runs, 51);
  const hrs = Object.values(ch.hour);
  assert.ok(hrs.length >= 48 && hrs.every(p => p >= 0 && p <= 100));
  assert.ok(Object.keys(ch.day).length >= 2);
  // made-up runs: 10 of 20 wet in the hour, 5 of 20 with a millimetre over the day
  const h = { time: Array.from({ length: 24 }, (_, i) => `2026-10-24T${String(i).padStart(2, "0")}:00`) };
  for (let m = 0; m < 20; m++) h[m ? `precipitation_member${String(m).padStart(2, "0")}` : "precipitation"] = h.time.map((_, i) => (i === 0 && m < 10 ? 0.2 : 0) + (i === 1 && m < 5 ? 1 : 0));
  const c = rainChances({ hourly: h });
  assert.equal(c.hour["2026-10-24T00:00"], 50); assert.equal(c.hour["2026-10-24T01:00"], 25); assert.equal(c.day["2026-10-24"], 25);
  assert.equal(rainChances({ hourly: { time: ["x"], precipitation: [1] } }), null, "one run is not an ensemble");
});

test("Open-Meteo's ECMWF answer: hours from now, ten days, nothing out of range", () => {
  const f = fromOpenMeteo(fx("wx-om-blr-2026-10-23.json"), NOW, "ecmwf_ifs");
  assert.equal(f.src, "ECMWF (9 km) via Open-Meteo");
  assert.equal(f.hours[0].t, "2026-10-23T05:00");
  assert.equal(f.hours.length, 25);
  assert.equal(f.days.length, 10); assert.equal(f.days[0].d, "2026-10-23");
  assert.equal(f.days[0].rise, "06:11");
  assert.ok(f.days.every(d => d.hi >= d.lo && d.hi < 45 && d.lo > 5));
  assert.ok(f.now.temp > 10 && f.now.temp < 35 && f.now.rh <= 100);
  assert.throws(() => fromOpenMeteo({ current: { temperature_2m: 99 }, hourly: { time: ["x"] }, daily: { time: ["x"] } }));
});

test("MET Norway stands in with hours and days, and no rain chance", () => {
  const f = fromMetno(fx("wx-met-blr-2026-10-22.json"), Date.parse("2026-10-22T21:00:00Z"));
  assert.equal(f.src, "MET Norway");
  assert.ok(f.hours.length >= 20 && f.hours.every(h => h.p === undefined));
  assert.ok(f.days.length >= 2 && f.days.every(d => d.hi > d.lo));
  assert.ok(f.now.temp > 15 && f.now.temp < 30);
});

test("Google's answers in the same shape, with its own chances", () => {
  const T = d => ({ degrees: d, unit: "CELSIUS" });
  const cur = { currentTime: "2026-10-23T03:00:00Z", isDaytime: true, weatherCondition: { type: "PARTLY_CLOUDY" }, temperature: T(24), feelsLikeTemperature: T(25), dewPoint: T(18), relativeHumidity: 70, uvIndex: 3, wind: { direction: { degrees: 250 }, speed: { value: 6 } }, airPressure: { meanSeaLevelMillibars: 1014.6 }, visibility: { distance: 4 } };
  const hrs = { forecastHours: [0, 1, 2].map(i => ({ interval: { startTime: `2026-10-23T0${3 + i}:30:00Z` }, isDaytime: true, weatherCondition: { type: i === 2 ? "LIGHT_RAIN" : "CLEAR" }, temperature: T(24 + i), feelsLikeTemperature: T(25 + i), relativeHumidity: 70, precipitation: { probability: { percent: i * 30 }, qpf: { quantity: i === 2 ? 0.4 : 0 } }, wind: { speed: { value: 5 }, direction: { degrees: 250 } } })) };
  const dys = { forecastDays: [{ displayDate: { year: 2026, month: 10, day: 23 }, maxTemperature: T(32), minTemperature: T(18), daytimeForecast: { weatherCondition: { type: "SUNNY" }, precipitation: { probability: { percent: 10 }, qpf: { quantity: 0 } }, uvIndex: 6 }, nighttimeForecast: { precipitation: { probability: { percent: 20 } } }, sunEvents: { sunriseTime: "2026-10-23T00:56:00Z", sunsetTime: "2026-10-23T12:15:00Z" } }] };
  const g = fromGoogle(cur, hrs, dys, NOW);
  assert.equal(g.hasChance, true); assert.equal(g.now.temp, 24); assert.equal(g.now.p, 1015);
  assert.equal(g.hours[0].t, "2026-10-23T09:00"); assert.equal(g.hours[2].p, 60); assert.equal(g.hours[2].code, 51);
  assert.deepEqual([g.days[0].d, g.days[0].hi, g.days[0].lo, g.days[0].p, g.days[0].rise, g.days[0].set], ["2026-10-23", 32, 18, 20, "06:26", "17:45"]);
  assert.throws(() => fromGoogle({}, null, null));
  // before 7 am IST Google's first day is still yesterday's: it is dropped
  const early = fromGoogle(cur, hrs, { forecastDays: [{ ...dys.forecastDays[0], displayDate: { year: 2026, month: 10, day: 22 } }, dys.forecastDays[0]] }, Date.parse("2026-10-23T01:20:00Z"));
  assert.deepEqual(early.days.map(d => d.d), ["2026-10-23"]);
  // a "now" feels-like out of step with Google's own forecast for this hour gives way to the hour's gap
  const odd = { ...cur, currentTime: "2026-10-23T01:40:00Z", temperature: T(20.7), feelsLikeTemperature: T(24.4) };
  const hr = { forecastHours: [{ ...hrs.forecastHours[0], interval: { startTime: "2026-10-23T01:30:00Z" }, temperature: T(17.2), feelsLikeTemperature: T(17.2) }] };
  assert.equal(fromGoogle(odd, hr, dys, NOW).now.feels, 20.7);
  assert.equal(fromGoogle({ ...odd, feelsLikeTemperature: T(21.5) }, hr, dys, NOW).now.feels, 21.5); // within 1.5 degrees: Google's own
  assert.deepEqual(airFromGoogle({ indexes: [{ code: "uaqi", aqi: 40 }, { code: "ind_cpcb", aqi: 231, dominantPollutant: "pm10" }] }), { v: 231, cat: "Poor", lead: "PM10", src: "Google Air Quality, India's scale" });
  assert.equal(airFromGoogle({ indexes: [{ code: "uaqi", aqi: 40 }] }), null);
});

test("CAMS air on India's scale: now from the last 24 hours, the days ahead, UV by hour", () => {
  const a = airFromCams(fx("wx-aq-ggn-2026-10-23.json"), NOW);
  assert.ok(a.v > 0 && a.v <= 500); assert.equal(a.cat, aqiCat(a.v));
  assert.ok(a.days.length >= 4 && a.days[0].d === "2026-10-23");
  assert.ok(Object.keys(a.uv).length > 48);
});

test("a METAR's visibility, statute miles to km", () => {
  assert.deepEqual(metarVis({ visib: 1.74, wxString: "BR", obsTime: 1 }), { km: 2.8, over: false, wx: "BR", at: 1000 });
  assert.equal(metarVis({ visib: "10+", obsTime: 1 }).over, true);
  assert.equal(metarVis({}), null);
});

test("a city put together: measured now wins, chances from the ensemble, haze on bad air, no coordinates", () => {
  const f = fromOpenMeteo(fx("wx-om-blr-2026-10-23.json"), NOW, "ecmwf_ifs"), ch = rainChances(fx("wx-ens-blr-2026-10-23.json"));
  const reading = { temp: 22, humidity: 94, wind: 6, at: NOW - 20 * 6e4, source: "METAR", station: "VOBG" };
  const c = assemble(blr, f, { chances: ch, air: { v: 14, cat: "Good", lead: "PM2.5", src: "CAMS", days: [], uv: {} }, readings: [reading], vis: { km: 6, over: false, wx: "BR", at: NOW - 20 * 6e4 }, visStation: "VOBG" }, NOW);
  assert.equal(c.now.temp, 22); assert.equal(c.now.measured.station, "VOBG"); assert.equal(c.now.vis_km, 6);
  assert.ok(c.hours.every(h => h.p == null || (h.p >= 0 && h.p <= 100)));
  assert.ok(c.hours.some(h => h.p != null));
  assert.equal(c.src.rain, "ECMWF ensemble, 51 runs");
  assert.ok(!/"lat"|"lon"/.test(JSON.stringify(c)), "the feed carries no coordinates");
  // without the ensemble the chance is left out, never guessed
  assert.ok(assemble(blr, f, {}, NOW).hours.every(h => h.p === null));
  // a clear sky over poor air reads as haze
  const clear = { ...f, now: { ...f.now, code: 0, day: true } };
  assert.equal(assemble(blr, clear, { air: { v: 260, cat: "Poor", days: [] } }, NOW).now.word, "Hazy sun");
});

test("the words: the day's line, the tile's chip, the headline across the cities", () => {
  const h = (t, o = {}) => ({ t: `2026-10-23T${t}:00`, temp: 24, p: 5, mm: 0, k: "clear", day: true, ...o });
  const base = { name: "Gurugram", now: { vis_km: 2.3 }, today: { p: 3 }, air: { v: 281, cat: "Poor", days: [{ d: "2026-10-23", v: 281, cat: "Poor" }, { d: "2026-10-26", v: 380, cat: "Very poor" }] },
    hours: [h("08"), h("10", { temp: 28 }), h("13", { temp: 31 }), h("16", { temp: 29 }), h("21", { temp: 22, day: false })] };
  assert.equal(lineFor(base), "Dry and warming to 31° by 1 pm. Mist, 2.3 km. The air is poor today and very poor by Monday.");
  assert.deepEqual(chipFor(base), { kind: "air", text: "Air poor" });
  const wet = { name: "Bengaluru", now: {}, today: { p: 99 }, air: { v: 14, cat: "Good", days: [] }, hours: [h("08", { p: 20 }), h("14", { p: 60, mm: 3 }), h("17", { p: 90, mm: 9, k: "storm" })] };
  assert.equal(lineFor(wet), "Rain from about 2 pm, with thunder likely, about 12 mm.");
  assert.deepEqual(chipFor(wet), { kind: "rain", text: "Rain 2 pm" });
  assert.equal(headlineFor([{ ...wet, chip: chipFor(wet) }, { ...base, chip: chipFor(base) }]), "Rain in Bengaluru after 2 pm. Air is poor in Gurugram.");
  // no chances at all: never "dry"
  assert.equal(lineFor({ ...base, air: null, now: {}, hours: base.hours.map(x => ({ ...x, p: null })) }), "Up to 31° by 1 pm. Down to 22° tonight.");
  // raining now and most of the day, with mist in the morning: one sentence, then the mist
  const now = { name: "Bengaluru", now: { vis_km: 2, at: "2026-10-23T06:15" }, today: { p: 100 }, air: null, hours: Array.from({ length: 12 }, (_, i) => h(String(6 + i).padStart(2, "0"), { p: 80, mm: .5 })) };
  assert.equal(lineFor(now), "Rain now and on and off all day, about 6 mm. Mist this morning, 2 km.");
});

test("the family points come from the environment; a bad value falls back to the city centre", () => {
  const cs = [{ id: "blr", lat: 12.97, lon: 77.59 }, { id: "ggn", lat: 28.46, lon: 77.03 }];
  assert.deepEqual(points(cs, '{"blr":[12.99,77.71]}').map(c => [c.lat, c.lon]), [[12.99, 77.71], [28.46, 77.03]]);
  assert.deepEqual(points(cs, "not json").map(c => c.lat), [12.97, 28.46]);
  assert.deepEqual(points(cs, '{"blr":[999,1]}').map(c => c.lat), [12.97, 28.46]);
});
