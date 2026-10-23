// The four-city weather app's feed (/api/live/wx; the weather repo; Parth, 23 Oct 2026, design A). One call gives the
// phone everything for its home screen, the city pages and the weeks-and-months view. docs/DATA.md, wx.
// - Forecast: Google's Weather API first when GOOGLE_MAPS_KEY is set (from 23 Oct 2026); then ECMWF's IFS at 9 km
//   through Open-Meteo (config wxapp.models, tried in order); then MET Norway. A place added in the app (?lat=) stays
//   on ECMWF, so it never spends Google's daily calls. A city none answers for is left out (the app keeps its last
//   good copy, with its time).
// - Chance of rain: the share of ECMWF's 51 ensemble runs that bring rain (an hour: 0.1 mm or more; a day: 1 mm or
//   more). Without the ensemble the chance is left out, never made up from one run.
// - Now: a station reading under 75 minutes old (IMD, METAR) replaces the model's temperature, humidity and wind, as
//   on the paper (lib/live.js applyMeasured's rule: feels-like keeps the model's gap).
// - Air on India's CPCB scale: Google's Air Quality API (ind_cpcb) when the key is set, else CAMS's PM2.5 and PM10
//   (Open-Meteo) worked into the index from 24-hour means. Days ahead: CAMS.
// - IMD warnings (Sachet, yellow and up) and IMD's 3-hour nowcast; Bengaluru's gauges from this site's own rain key;
//   the weeks and months from this site's outlook key.
// The family points come from the env var WEATHER_POINTS and never leave the server: the feed carries no coordinates.
import { config, getJSON, readings, pickMeasured, parseMetar } from "./live.js";
import { stationWarning } from "./imd.js";
import { nearAlerts, keepAlerts } from "./trial.js";

const ok = (value, source) => ({ ok: true, value, source, as_of: new Date().toISOString(), stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });
const r0 = v => (Number.isFinite(v) ? Math.round(v) : null);
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const inRange = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const IST = 5.5 * 36e5;
const istNow = (ms = Date.now()) => new Date(ms + IST).toISOString().slice(0, 16); // "2026-10-23T08:30"
const W = () => config().wxapp;

// ---- where: the family points from the environment, else the config's city centres
export function points(cities = W().cities, env = process.env[W().points_env || "WEATHER_POINTS"]) {
  let P = {};
  try { P = env ? JSON.parse(env) : {}; } catch { P = {}; }
  return cities.map(c => {
    const p = P[c.id];
    const good = Array.isArray(p) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
    return { ...c, lat: good ? Number(p[0]) : c.lat, lon: good ? Number(p[1]) : c.lon };
  });
}

// ---- the sky in one word, from WMO's codes (Open-Meteo) and the time of day
export function kindOf(code) {
  if (code == null) return null;
  if (code >= 95) return "storm";
  if (code === 45 || code === 48) return "fog";
  if (code === 65 || code === 82) return "heavyrain";
  if (code === 63 || code === 81 || code === 80) return "rain";
  if (code === 61 || (code >= 51 && code <= 57)) return "drizzle";
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  return "cloudy";
}
export const WORD = { clear: ["Sunny", "Clear"], partly: ["Partly cloudy", "Partly cloudy"], cloudy: ["Cloudy", "Cloudy"], fog: ["Fog", "Fog"], haze: ["Hazy sun", "Hazy"], drizzle: ["Light rain", "Light rain"], rain: ["Rain", "Rain"], heavyrain: ["Heavy rain", "Heavy rain"], storm: ["Thunderstorm", "Thunderstorm"] };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = d => (Number.isFinite(d) ? COMPASS[Math.round(((d % 360) + 360) % 360 / 45) % 8] : null);

// ---- India's AQI (CPCB): the larger of the PM2.5 and PM10 sub-indices, from 24-hour means
const BP25 = [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, 500, 400, 500]];
const BP10 = [[0, 50, 0, 50], [50, 100, 50, 100], [100, 250, 100, 200], [250, 350, 200, 300], [350, 430, 300, 400], [430, 600, 400, 500]];
const sub = (c, bps) => { for (const [lo, hi, ilo, ihi] of bps) if (c <= hi) return ilo + (ihi - ilo) * (c - lo) / (hi - lo); return 500; };
export const aqiCat = v => (v <= 50 ? "Good" : v <= 100 ? "Satisfactory" : v <= 200 ? "Moderate" : v <= 300 ? "Poor" : v <= 400 ? "Very poor" : "Severe");
export function indiaAqi(pm25, pm10) {
  if (!Number.isFinite(pm25) && !Number.isFinite(pm10)) return null;
  const a = Number.isFinite(pm25) ? sub(Math.max(0, pm25), BP25) : -1, b = Number.isFinite(pm10) ? sub(Math.max(0, pm10), BP10) : -1;
  const v = Math.round(Math.max(a, b));
  return { v, cat: aqiCat(v), lead: a >= b ? "PM2.5" : "PM10" };
}

// ---- Open-Meteo: the forecast, one request for every city (a list of points answers with a list)
const HOURLY = "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility,uv_index,is_day";
const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max,daylight_duration";
const CURRENT = "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day";
const ll = cs => `latitude=${cs.map(c => c.lat).join(",")}&longitude=${cs.map(c => c.lon).join(",")}`;
// One city's Open-Meteo answer in the app's shape (hours from the current hour, ten days), or a throw
export function fromOpenMeteo(j, now = Date.now(), model = null) {
  const c = j?.current, h = j?.hourly, d = j?.daily;
  if (!c || !h?.time?.length || !d?.time?.length) throw new Error("open-meteo shape");
  const T = inRange(c.temperature_2m, -40, 55); if (T == null) throw new Error("open-meteo range");
  const hourNow = istNow(now).slice(0, 13), i0 = Math.max(0, h.time.findIndex(t => t.slice(0, 13) >= hourNow));
  const hours = h.time.slice(i0, i0 + 25).map((t, k) => { const i = i0 + k; return { t, temp: r1(inRange(h.temperature_2m[i], -40, 55)), feels: r1(h.apparent_temperature?.[i]), rh: r0(inRange(h.relative_humidity_2m?.[i], 0, 100)), dew: r1(h.dew_point_2m?.[i]), mm: r1(inRange(h.precipitation?.[i], 0, 500)), code: h.weather_code?.[i] ?? null, wind: r0(inRange(h.wind_speed_10m?.[i], 0, 300)), deg: r0(h.wind_direction_10m?.[i]), vis_km: Number.isFinite(h.visibility?.[i]) ? r1(h.visibility[i] / 1000) : null, uv: r1(h.uv_index?.[i]), day: h.is_day?.[i] == null ? null : !!h.is_day[i] }; }).filter(x => x.temp != null);
  const today = istNow(now).slice(0, 10);
  const days = d.time.map((t, i) => ({ d: t, hi: r1(inRange(d.temperature_2m_max[i], -40, 55)), lo: r1(inRange(d.temperature_2m_min[i], -40, 55)), code: d.weather_code?.[i] ?? null, mm: r1(d.precipitation_sum?.[i]), uvmax: r1(d.uv_index_max?.[i]), rise: d.sunrise?.[i]?.slice(11, 16) || null, set: d.sunset?.[i]?.slice(11, 16) || null, len: Number.isFinite(d.daylight_duration?.[i]) ? Math.round(d.daylight_duration[i] / 60) : null }))
    .filter(x => x.d >= today && x.hi != null && x.lo != null).slice(0, 10);
  const now_ = { temp: r1(T), feels: r1(c.apparent_temperature), rh: r0(inRange(c.relative_humidity_2m, 0, 100)), dew: r1(c.dew_point_2m), code: c.weather_code ?? null, wind: r0(inRange(c.wind_speed_10m, 0, 300)), deg: r0(c.wind_direction_10m), p: r0(inRange(c.pressure_msl, 850, 1100)), day: c.is_day == null ? null : !!c.is_day, at: c.time || null };
  return { now: now_, hours, days, src: model ? `ECMWF (${model === "ecmwf_ifs025" ? "25 km" : "9 km"}) via Open-Meteo` : "Open-Meteo" };
}
async function openMeteo(cs, now) {
  const errors = [];
  // the first model gets a second try (Open-Meteo stalls on a single request now and then), the rest one each
  for (const m of [(W().models || ["ecmwf_ifs"])[0], ...(W().models || ["ecmwf_ifs"])]) {
    try {
      const j = await getJSON(`https://api.open-meteo.com/v1/forecast?${ll(cs)}&models=${m}&current=${CURRENT}&hourly=${HOURLY}&daily=${DAILY}&timezone=Asia%2FKolkata&forecast_days=10&past_days=1`, { timeout: 12000 });
      const list = [].concat(j);
      return cs.map((c, i) => { try { return fromOpenMeteo(list[i], now, m); } catch { return null; } });
    } catch (e) { errors.push(`${m}: ${e.message}`); }
  }
  throw new Error(errors.join(" | "));
}
// The ensemble's rain chances: per hour (IST "2026-10-23T14:00") and per day, the share of runs with rain
export function rainChances(j) {
  const h = j?.hourly; if (!h?.time?.length) return null;
  const keys = Object.keys(h).filter(k => k === "precipitation" || k.startsWith("precipitation_member"));
  if (keys.length < 10) return null;
  const hour = {}, byDay = {};
  h.time.forEach((t, i) => {
    const v = keys.map(k => h[k][i]).filter(Number.isFinite); if (v.length < 10) return;
    hour[t] = Math.round(100 * v.filter(x => x >= 0.1).length / v.length);
    const D = (byDay[t.slice(0, 10)] ||= { n: 0, sums: keys.map(() => 0) });
    D.n++; keys.forEach((k, m) => { if (Number.isFinite(h[k][i])) D.sums[m] += h[k][i]; });
  });
  const day = Object.fromEntries(Object.entries(byDay).filter(([, D]) => D.n >= 20).map(([d, D]) => [d, Math.round(100 * D.sums.filter(x => x >= 1).length / D.sums.length)]));
  return { hour, day, runs: keys.length };
}
async function ensemble(cs) {
  const j = await getJSON(`https://ensemble-api.open-meteo.com/v1/ensemble?${ll(cs)}&models=${W().ensemble_model || "ecmwf_ifs025"}&hourly=precipitation&timezone=Asia%2FKolkata&forecast_days=10`, { timeout: 15000 });
  return [].concat(j).map(rainChances);
}
// CAMS (Open-Meteo): India's AQI now (24-hour mean to this hour) and for each of the next days (the day's mean)
export function airFromCams(a, now = Date.now()) {
  const h = a?.hourly; if (!h?.time?.length) return null;
  const at = istNow(now).slice(0, 13), idx = h.time.map((t, i) => [t, i]).filter(([t]) => t.slice(0, 13) <= at).map(([, i]) => i).slice(-24);
  const mean = ix => { const v = ix.filter(Number.isFinite); return v.length >= 12 ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const nowA = indiaAqi(mean(idx.map(i => h.pm2_5[i])), mean(idx.map(i => h.pm10[i]))); if (!nowA) return null;
  const by = {}; h.time.forEach((t, i) => { (by[t.slice(0, 10)] ||= []).push(i); });
  const today = istNow(now).slice(0, 10);
  const days = Object.entries(by).filter(([d, ix]) => d >= today && ix.length >= 18).slice(0, 5).map(([d, ix]) => { const x = indiaAqi(mean(ix.map(i => h.pm2_5[i])), mean(ix.map(i => h.pm10[i]))); return x ? { d, ...x } : null; }).filter(Boolean);
  const uv = {}; h.time.forEach((t, i) => { if (Number.isFinite(h.uv_index?.[i])) uv[t] = h.uv_index[i]; });
  return { ...nowA, days, src: "CAMS via Open-Meteo, India's scale", uv };
}
async function cams(cs, now) {
  const j = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${ll(cs)}&hourly=pm2_5,pm10,uv_index&past_days=1&forecast_days=5&timezone=Asia%2FKolkata`, { timeout: 10000 });
  return [].concat(j).map(a => airFromCams(a, now));
}

// ---- Google (only with GOOGLE_MAPS_KEY): weather as the backup forecast, air quality first for "now". A call count per
// server instance stops it at the daily caps (config wxapp.google_caps), under the 70,000 a month free on India pricing;
// the caps set in Google's console are the hard stop.
const GCAP = { weather: 1950, air: 500 }; // weather: 650 a day for each of current, hours and days (three calls a city), as set in the console
let GCOUNT = { day: null, weather: 0, air: 0 };
function gAllow(kind, n = 1) {
  const d = istNow().slice(0, 10); if (GCOUNT.day !== d) GCOUNT = { day: d, weather: 0, air: 0 };
  const cap = (W().google_caps || GCAP)[kind] ?? GCAP[kind];
  if (GCOUNT[kind] + n > cap) return false; GCOUNT[kind] += n; return true;
}
const gKey = () => process.env[W().google_env || "GOOGLE_MAPS_KEY"] || null;
const G_KIND = { CLEAR: "clear", MOSTLY_CLEAR: "partly", PARTLY_CLOUDY: "partly", MOSTLY_CLOUDY: "cloudy", CLOUDY: "cloudy", WINDY: "cloudy", WIND_AND_RAIN: "rain", LIGHT_RAIN_SHOWERS: "drizzle", CHANCE_OF_SHOWERS: "drizzle", SCATTERED_SHOWERS: "drizzle", RAIN_SHOWERS: "rain", HEAVY_RAIN_SHOWERS: "heavyrain", LIGHT_TO_MODERATE_RAIN: "rain", MODERATE_TO_HEAVY_RAIN: "heavyrain", RAIN: "rain", LIGHT_RAIN: "drizzle", HEAVY_RAIN: "heavyrain", RAIN_PERIODICALLY_HEAVY: "heavyrain", THUNDERSTORM: "storm", THUNDERSHOWER: "storm", LIGHT_THUNDERSTORM_RAIN: "storm", SCATTERED_THUNDERSTORMS: "storm", HEAVY_THUNDERSTORM: "storm" };
export const gKind = t => G_KIND[t] || (/THUNDER/.test(t || "") ? "storm" : /HEAVY/.test(t || "") ? "heavyrain" : /RAIN|SHOWER/.test(t || "") ? "rain" : /FOG|HAZE/.test(t || "") ? "fog" : t ? "cloudy" : null);
const KIND_CODE = { clear: 0, partly: 2, cloudy: 3, fog: 45, drizzle: 51, rain: 63, heavyrain: 65, storm: 95 };
const deg = x => (Number.isFinite(x?.degrees) ? x.degrees : null);
// Google's three answers in the app's shape; rain chances come with them
export function fromGoogle(cur, hrs, dys, now = Date.now()) {
  if (!Number.isFinite(cur?.temperature?.degrees)) throw new Error("google shape");
  const k = gKind(cur.weatherCondition?.type);
  const toIST = s => (s ? new Date(Date.parse(s) + IST).toISOString().slice(0, 16) : null);
  const hours = (hrs?.forecastHours || []).slice(0, 25).map(x => ({ t: toIST(x.interval?.startTime), temp: r1(deg(x.temperature)), feels: r1(deg(x.feelsLikeTemperature)), rh: r0(x.relativeHumidity), dew: r1(deg(x.dewPoint)), mm: r1(x.precipitation?.qpf?.quantity), code: KIND_CODE[gKind(x.weatherCondition?.type)] ?? null, p: r0(x.precipitation?.probability?.percent), wind: r0(x.wind?.speed?.value), deg: r0(x.wind?.direction?.degrees), vis_km: r1(x.visibility?.distance), uv: r1(x.uvIndex), day: x.isDaytime ?? null })).filter(x => x.t && x.temp != null);
  const days = (dys?.forecastDays || []).slice(0, 10).map(x => { const D = x.displayDate || {}, dd = `${D.year}-${String(D.month).padStart(2, "0")}-${String(D.day).padStart(2, "0")}`, dt = x.daytimeForecast || {}, nt = x.nighttimeForecast || {};
    return { d: dd, hi: r1(deg(x.maxTemperature)), lo: r1(deg(x.minTemperature)), code: KIND_CODE[gKind(dt.weatherCondition?.type)] ?? null, mm: r1((dt.precipitation?.qpf?.quantity || 0) + (nt.precipitation?.qpf?.quantity || 0)), p: r0(Math.max(dt.precipitation?.probability?.percent ?? 0, nt.precipitation?.probability?.percent ?? 0)), uvmax: r1(dt.uvIndex), rise: toIST(x.sunEvents?.sunriseTime)?.slice(11, 16) || null, set: toIST(x.sunEvents?.sunsetTime)?.slice(11, 16) || null, len: x.sunEvents?.sunriseTime && x.sunEvents?.sunsetTime ? Math.round((Date.parse(x.sunEvents.sunsetTime) - Date.parse(x.sunEvents.sunriseTime)) / 6e4) : null }; })
    // Google's days run 7 am to 7 am local: before 7 am the first one is yesterday's, so it is left out
    .filter(x => x.hi != null && x.lo != null && x.d >= istNow(now).slice(0, 10));
  // Google's "feels like" is its heat index. Now and then the current reading's figure runs well away from Google's own
  // forecast for the same hour (23 Oct, 7 am: Ranchi "now" 20.7 feels 24.4, the 7 am hour 17.2 feels 17.2). When the two
  // gaps differ by more than 1.5 degrees, the hour's gap stands: still Google's number, just the consistent one.
  const tNow = r1(cur.temperature.degrees), fNow = r1(deg(cur.feelsLikeTemperature)), h0 = hours.find(h => h.t?.slice(0, 13) === toIST(cur.currentTime)?.slice(0, 13));
  const feelsNow = fNow != null && tNow != null && h0?.feels != null && Math.abs((fNow - tNow) - (h0.feels - h0.temp)) > 1.5 ? r1(tNow + (h0.feels - h0.temp)) : fNow;
  return { now: { temp: tNow, feels: feelsNow, rh: r0(cur.relativeHumidity), dew: r1(deg(cur.dewPoint)), code: KIND_CODE[k] ?? null, wind: r0(cur.wind?.speed?.value), deg: r0(cur.wind?.direction?.degrees), p: r0(cur.airPressure?.meanSeaLevelMillibars), day: cur.isDaytime ?? null, at: toIST(cur.currentTime), uv: r1(cur.uvIndex), vis_km: r1(cur.visibility?.distance) }, hours, days, src: "Google Weather", hasChance: true };
}
async function google(c, now) {
  const key = gKey(); if (!key || !gAllow("weather", 3)) throw new Error("google: no key or over the daily cap");
  const q = `key=${encodeURIComponent(key)}&location.latitude=${c.lat}&location.longitude=${c.lon}&unitsSystem=METRIC`;
  const [cur, hrs, dys] = await Promise.all([
    getJSON(`https://weather.googleapis.com/v1/currentConditions:lookup?${q}`, { timeout: 8000 }),
    getJSON(`https://weather.googleapis.com/v1/forecast/hours:lookup?${q}&hours=25&pageSize=25`, { timeout: 8000 }),
    getJSON(`https://weather.googleapis.com/v1/forecast/days:lookup?${q}&days=10&pageSize=10`, { timeout: 8000 }),
  ]);
  return fromGoogle(cur, hrs, dys, now);
}
export function airFromGoogle(j) {
  const x = (j?.indexes || []).find(i => i.code === "ind_cpcb"); if (!x || !Number.isFinite(x.aqi)) return null;
  const lead = { pm25: "PM2.5", pm10: "PM10", no2: "NO2", o3: "O3", co: "CO", so2: "SO2", nh3: "NH3" }[x.dominantPollutant] || null;
  return { v: x.aqi, cat: aqiCat(x.aqi), lead, src: "Google Air Quality, India's scale" };
}
async function googleAir(c) {
  const key = gKey(); if (!key || !gAllow("air")) return null;
  const r = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ location: { latitude: c.lat, longitude: c.lon }, extraComputations: ["LOCAL_AQI"], customLocalAqis: [{ regionCode: "in", aqi: "ind_cpcb" }], languageCode: "en" }) });
  return r.ok ? airFromGoogle(await r.json()) : null;
}

// ---- MET Norway, the last stand-in (no rain chances outside the Nordic area; its UV is for a clear sky, so left out)
const MET_CODE = s => (/thunder/.test(s) ? 95 : /fog/.test(s) ? 45 : /heavyrain/.test(s) ? 65 : /lightrain|drizzle/.test(s) ? 51 : /rain/.test(s) ? 63 : /^clearsky/.test(s) ? 0 : /^(fair|partlycloudy)/.test(s) ? 2 : 3);
export function fromMetno(j, now = Date.now()) {
  const ts = j?.properties?.timeseries; if (!Array.isArray(ts) || !ts.length) throw new Error("met.no shape");
  const toIST = s => new Date(Date.parse(s) + IST).toISOString().slice(0, 16), hourNow = istNow(now).slice(0, 13);
  const rows = ts.map(x => ({ t: toIST(x.time), I: x.data?.instant?.details || {}, n1: x.data?.next_1_hours, n6: x.data?.next_6_hours }));
  const first = rows.find(r => r.t.slice(0, 13) >= hourNow) || rows[0];
  if (!Number.isFinite(first.I.air_temperature)) throw new Error("met.no range");
  const hours = rows.filter(r => r.t.slice(0, 13) >= hourNow && r.n1).slice(0, 25).map(r => ({ t: r.t, temp: r1(r.I.air_temperature), feels: r1(r.I.apparent_air_temperature), rh: r0(r.I.relative_humidity), dew: r1(r.I.dew_point_temperature), mm: r1(r.n1.details?.precipitation_amount), code: MET_CODE(r.n1.summary?.symbol_code || ""), wind: r0(r.I.wind_speed * 3.6), deg: r0(r.I.wind_from_direction), vis_km: null, uv: null, day: !/night/.test(r.n1.summary?.symbol_code || "") }));
  const by = {};
  for (const r of rows) {
    const D = (by[r.t.slice(0, 10)] ||= { hi: -99, lo: 99, mm: 0, codes: [], n: 0 });
    const T = r.I.air_temperature; if (Number.isFinite(T)) { D.hi = Math.max(D.hi, T); D.lo = Math.min(D.lo, T); D.n++; }
    const six = r.n6?.details;
    if (!r.n1 && six) { if (Number.isFinite(six.air_temperature_max)) D.hi = Math.max(D.hi, six.air_temperature_max); if (Number.isFinite(six.air_temperature_min)) D.lo = Math.min(D.lo, six.air_temperature_min); D.mm += six.precipitation_amount || 0; D.codes.push(MET_CODE(r.n6.summary?.symbol_code || "")); D.n += 6; }
    else if (r.n1) { D.mm += r.n1.details?.precipitation_amount || 0; if (!/night/.test(r.n1.summary?.symbol_code || "")) D.codes.push(MET_CODE(r.n1.summary?.symbol_code || "")); }
  }
  const today = istNow(now).slice(0, 10);
  const days = Object.entries(by).filter(([d, D]) => d >= today && D.n >= 4 && D.hi - D.lo >= 2).slice(0, 10).map(([d, D]) => ({ d, hi: r1(D.hi), lo: r1(D.lo), code: D.codes.length ? Math.max(...D.codes) : 3, mm: r1(D.mm), uvmax: null, rise: null, set: null, len: null }));
  return { now: { temp: r1(first.I.air_temperature), feels: r1(first.I.apparent_air_temperature), rh: r0(first.I.relative_humidity), dew: r1(first.I.dew_point_temperature), code: MET_CODE(first.n1?.summary?.symbol_code || ""), wind: r0(first.I.wind_speed * 3.6), deg: r0(first.I.wind_from_direction), p: r0(first.I.air_pressure_at_sea_level), day: null, at: first.t }, hours, days, src: "MET Norway" };
}
async function metno(c, now) {
  const j = await getJSON(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${c.lat}&lon=${c.lon}`, { timeout: 8000, headers: { "user-agent": config().weather.metno_user_agent } });
  return fromMetno(j, now);
}

// ---- IMD and Sachet
async function nowcasts(cs) {
  const names = [...new Set(cs.flatMap(c => c.nowcast || []))]; if (!names.length) return cs.map(() => null);
  const q = encodeURIComponent(`Station IN (${names.map(n => `'${n.replace(/'/g, "''")}'`).join(",")})`);
  const j = await getJSON(`https://reactjs.imd.gov.in/geoserver/imd/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:NowcastWarningStation&outputFormat=application/json&CQL_FILTER=${q}`, { timeout: 12000 });
  const rows = (j?.features || []).map(f => f.properties), now = Date.now();
  return cs.map(c => rows.filter(r => (c.nowcast || []).includes(String(r.Station).trim())).map(r => stationWarning(r, now)).filter(Boolean).sort((a, b) => b.level - a.level || b.until.localeCompare(a.until))[0] || null);
}
async function sachet(cs) {
  const rows = await getJSON("https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails", { timeout: 12000 });
  if (!Array.isArray(rows)) throw new Error("sachet shape");
  const places = Object.fromEntries(cs.map(c => [c.name, c.alert_names || [c.name]]));
  const all = nearAlerts(rows, cs, places, W().alert_radius_km || 60);
  return cs.map(c => { const a = keepAlerts(all.filter(x => x.city === c.name))[0]; return a ? { colour: a.colour, type: a.type, area: a.area, from: a.from_ms ? new Date(a.from_ms).toISOString() : null, until: a.until_ms ? new Date(a.until_ms).toISOString() : null, message: a.message, src: a.source || "IMD via Sachet" } : null; });
}
// Every station's latest METAR, for the measured "now" and the visibility (statute miles -> km; "10+" -> over 10 km)
async function metars(cs) {
  const ids = [...new Set(cs.flatMap(c => c.stations?.metar || []))]; if (!ids.length) return [];
  const a = await getJSON(`https://aviationweather.gov/api/data/metar?ids=${ids.join(",")}&format=json`, { timeout: 6000 });
  return Array.isArray(a) ? a : [];
}
export const metarVis = m => { const v = String(m?.visib ?? ""); if (!v) return null; const n = parseFloat(v); return Number.isFinite(n) ? { km: r1(n * 1.609), over: v.endsWith("+"), wx: m.wxString || null, at: Number(m.obsTime) * 1000 } : null; };

// This site's own keys (CDN-held, so no extra calls to their sources): Bengaluru's gauges and the weeks and months
const SELF = () => (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.WX_SELF || null);
async function self(key) { const b = SELF(); if (!b) return null; try { const j = await getJSON(`${b}/api/live/${key}`, { timeout: 15000 }); return j?.ok ? j : null; } catch { return null; } }

// ---- putting a city together
const clock = t => { const [h, m] = t.slice(11, 16).split(":").map(Number); return `${((h + 11) % 12) + 1}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`; };
const wday = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
// The day in a sentence or two, worded from the figures (the app prints it under the city's top card). Rain first, then
// how the day goes, then mist and bad air, then the night; never two short alarms in a row ("Misty start. Rain now.")
export function lineFor(c) {
  const H = c.hours.slice(0, 18), bits = [], pct = h => h.p != null && h.p >= 50;
  const wet = H.find(pct);
  if (wet) {
    const storm = H.some(h => h.k === "storm" && (h.p ?? 0) >= 40), mm = Math.round(H.reduce((s, h) => s + (h.mm || 0), 0));
    const later = H.filter(pct).length >= 6;
    bits.push(`${wet === H[0] ? `Rain now${later ? " and on and off all day" : ""}` : `Rain from about ${clock(wet.t)}`}${storm ? ", with thunder likely" : ""}${mm >= 1 ? `, about ${mm} mm` : ""}.`);
  } else {
    const day = H.filter(h => h.day !== false), pk = day.reduce((a, h) => (a == null || h.temp > a.temp ? h : a), null);
    if (pk && pk !== H[0] && pk.temp - H[0].temp >= 3) bits.push(`${H.every(h => h.p != null && h.p < 20) ? "Dry and " : ""}${H.every(h => h.p != null && h.p < 20) ? "warming to" : "Up to"} ${Math.round(pk.temp)}° by ${clock(pk.t)}.`);
  }
  const hr = Number((c.now.at || "").slice(11, 13));
  if (c.now.vis_km != null && c.now.vis_km < 3) bits.push(`${c.now.vis_km < 1 ? "Fog" : "Mist"}${hr && hr < 11 ? " this morning" : ""}, ${c.now.vis_km} km.`);
  // "worse by" compares the days with each other (one source, CAMS), never with a "now" from another source (Google)
  if (c.air && ["Poor", "Very poor", "Severe"].includes(c.air.cat)) { const D = c.air.days || [], base = D[0]?.v ?? c.air.v, worse = D.slice(1).find(d => d.v > base + 40); bits.push(`The air is ${c.air.cat.toLowerCase()} today${worse ? ` and ${worse.cat.toLowerCase()} by ${wday(worse.d)}` : ""}.`); }
  if (bits.length < 2) { const night = c.hours.filter(h => h.day === false); const lo = night.reduce((a, h) => (a == null || h.temp < a.temp ? h : a), null); if (lo) bits.push(`Down to ${Math.round(lo.temp)}° tonight.`); }
  return bits.slice(0, 3).join(" ") || null;
}
// The home tile's chip: the one thing that matters most today
export function chipFor(c) {
  const wet = c.hours.slice(0, 18).find(h => h.p != null && h.p >= 50);
  if (c.alert) return { kind: "alert", text: c.alert.type || "IMD warning" };
  if (wet) return { kind: "rain", text: wet === c.hours[0] ? "Rain now" : `Rain ${clock(wet.t)}` };
  if (c.air && ["Poor", "Very poor", "Severe"].includes(c.air.cat)) return { kind: "air", text: `Air ${c.air.cat.toLowerCase()}` };
  if (c.now.vis_km != null && c.now.vis_km < 3) return { kind: "fog", text: c.now.vis_km < 1 ? "Fog" : "Misty" };
  return c.air ? { kind: "air-ok", text: `Air ${c.air.cat.toLowerCase()}` } : null;
}
export function headlineFor(cities) {
  const wet = cities.filter(c => c.chip?.kind === "rain"), bad = cities.filter(c => c.air && ["Poor", "Very poor", "Severe"].includes(c.air.cat));
  const and = a => (a.length < 3 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
  const a = wet.length ? `${wet.length === 1 ? `Rain in ${wet[0].name} ${wet[0].chip.text === "Rain now" ? "now" : `after ${wet[0].chip.text.slice(5)}`}` : `Rain in ${and(wet.map(c => c.name))}`}.` : cities.every(c => c.today?.p != null && c.today.p < 20) ? "Dry everywhere today." : "";
  const b = bad.length ? ` Air is ${bad.length === 1 ? bad[0].air.cat.toLowerCase() : "poor"} in ${and(bad.map(c => c.name))}.` : "";
  const fog = cities.filter(c => c.chip?.kind === "fog"), f = fog.length ? ` ${fog.some(c => c.chip.text === "Fog") ? "Fog" : "Mist"} in ${and(fog.map(c => c.name))}.` : "";
  return (a + b + f).trim() || null;
}
// One city: the forecast with its rain chances and measured now, and everything around it
export function assemble(c, fc, x = {}, now = Date.now()) {
  const ch = x.chances;
  const hours = fc.hours.map(h => { const k = kindOf(h.code); return { t: h.t, temp: h.temp, feels: h.feels, rh: h.rh, wind: h.wind, deg: h.deg, mm: h.mm, p: fc.hasChance ? h.p ?? null : ch ? ch.hour[h.t] ?? null : null, k, day: h.day, uv: h.uv ?? (x.air?.uv?.[h.t] ?? null) }; });
  // ECMWF gives no UV: the day's highest is CAMS's (Open-Meteo's air-quality model), from its hours
  const uvOf = d => { const v = Object.entries(x.air?.uv || {}).filter(([t]) => t.startsWith(d)).map(([, u]) => u); return v.length >= 12 ? r1(Math.max(...v)) : null; };
  const days = fc.days.map(d => ({ d: d.d, hi: d.hi, lo: d.lo, k: kindOf(d.code), mm: d.mm, p: fc.hasChance ? d.p ?? null : ch ? ch.day[d.d] ?? null : null, uvmax: d.uvmax ?? uvOf(d.d), rise: d.rise, set: d.set, len: d.len }));
  let n = { ...fc.now };
  const m = pickMeasured(x.readings || [], n, now);
  if (m) {
    n = { ...n, temp: r1(m.temp), rh: m.humidity ?? n.rh, wind: m.wind != null ? r0(m.wind) : n.wind, feels: n.feels != null && fc.now.temp != null ? r1(m.temp + (fc.now.feels - fc.now.temp)) : n.feels, measured: { source: m.source, station: m.station, at: new Date(m.at).toISOString() } };
    if (days[0]) days[0] = { ...days[0], hi: Math.max(days[0].hi, n.temp), lo: Math.min(days[0].lo, n.temp) };
  }
  const v = x.vis && now - x.vis.at < 3 * 36e5 ? x.vis : null;
  n.vis_km = v ? v.km : (fc.now.vis_km ?? fc.hours[0]?.vis_km ?? null);
  if (v) { n.vis_over = v.over; n.vis_src = `METAR ${x.visStation}`; }
  n.uv = fc.now.uv ?? hours[0]?.uv ?? null;
  let k = kindOf(n.code) ?? hours[0]?.k ?? "cloudy";
  const day = n.day ?? hours[0]?.day ?? true;
  if ((k === "clear" || k === "partly") && x.air && x.air.v > 200) k = "haze";
  if (v && /FG/.test(v.wx || "") && v.km < 1) k = "fog";
  n.k = k; n.word = WORD[k][day ? 0 : 1]; n.dir = compass(n.deg); n.day = day; delete n.code;
  const today = days[0] || null;
  const sun = today ? { rise: today.rise, set: today.set, len: today.len } : null;
  const air = x.air ? { v: x.air.v, cat: x.air.cat, lead: x.air.lead, src: x.air.src, days: (x.airDays || x.air.days || []).map(d => ({ d: d.d, v: d.v, cat: d.cat })) } : null;
  const out = { id: c.id, name: c.name, state: c.state, elev: c.elev, now: n, today: today ? { hi: today.hi, lo: today.lo, p: today.p, mm: today.mm, uvmax: today.uvmax } : null, hours: hours.slice(0, 25), days, sun, air,
    alert: x.alert || null, nowcast: x.nowcast || null, gauges: x.gauges || null, outlook: x.outlook || null,
    src: { forecast: fc.src, rain: fc.hasChance ? fc.src : ch ? `ECMWF ensemble, ${ch.runs} runs` : null, now: m ? `${m.source} ${m.station}` : fc.src, air: air?.src || null } };
  out.line = lineFor(out); out.chip = chipFor(out);
  return out;
}

// ---- the key
// ?check=google: is the key set, and what does Google answer (one air call, one weather call, for Bengaluru)? The key
// itself never appears; Google's own error message does. Never cached.
async function checkGoogle() {
  const key = gKey(), c = points()[0], out = { key_set: !!key, points_set: !!process.env[W().points_env || "WEATHER_POINTS"] };
  if (!key) return ok(out, "check");
  const tell = async r => ({ status: r.status, ...(r.ok ? {} : { error: (await r.json().catch(() => ({})))?.error?.message || r.statusText }) });
  out.air = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ location: { latitude: c.lat, longitude: c.lon }, customLocalAqis: [{ regionCode: "in", aqi: "ind_cpcb" }], extraComputations: ["LOCAL_AQI"] }) }).then(tell).catch(e => ({ error: String(e.message) }));
  out.weather = await fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(key)}&location.latitude=${c.lat}&location.longitude=${c.lon}`, { signal: AbortSignal.timeout(8000) }).then(tell).catch(e => ({ error: String(e.message) }));
  return ok(out, "check");
}

// ?check=feels: Google's raw "feels like" beside its own heat index and wind chill, the airport's reading, ECMWF's
// apparent temperature, and the two standard formulas worked on each. For checking why Google's figure runs high.
// 8 Google calls; never cached; no coordinates in the reply.
const heatIndexNWS = (tC, rh) => { const T = tC * 9 / 5 + 32; let hi = .5 * (T + 61 + (T - 68) * 1.2 + rh * .094); if ((hi + T) / 2 >= 80) { hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - .22475541 * T * rh - .00683783 * T * T - .05481717 * rh * rh + .00122874 * T * T * rh + .00085282 * T * rh * rh - .00000199 * T * T * rh * rh; if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17); if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5); } return r1((hi - 32) * 5 / 9); };
const apparentBoM = (tC, rh, windKmh) => { const e = rh / 100 * 6.105 * Math.exp(17.27 * tC / (237.7 + tC)); return r1(tC + .33 * e - .70 * (windKmh / 3.6) - 4); };
async function checkFeels(now) {
  const key = gKey(); if (!key) return ok({ key_set: false }, "check");
  const toIST = s => (s ? new Date(Date.parse(s) + IST).toISOString().slice(0, 16) : null);
  const cs = points(), [om, mets] = await Promise.all([openMeteo(cs, now).catch(() => cs.map(() => null)), metars(cs).catch(() => [])]);
  const pick = x => x && { temp: r1(deg(x.temperature)), feels: r1(deg(x.feelsLikeTemperature)), heat_index: r1(deg(x.heatIndex)), wind_chill: r1(deg(x.windChill)), dew: r1(deg(x.dewPoint)), rh: r0(x.relativeHumidity), wind_kmh: r0(x.wind?.speed?.value), uv: r1(x.uvIndex), cloud: r0(x.cloudCover), day: x.isDaytime ?? null };
  const rows = await Promise.all(cs.map(async (c, i) => {
    const q = `key=${encodeURIComponent(key)}&location.latitude=${c.lat}&location.longitude=${c.lon}&unitsSystem=METRIC`;
    const [cur, hrs] = await Promise.all([getJSON(`https://weather.googleapis.com/v1/currentConditions:lookup?${q}`, { timeout: 8000 }).catch(() => null), getJSON(`https://weather.googleapis.com/v1/forecast/hours:lookup?${q}&hours=4&pageSize=4`, { timeout: 8000 }).catch(() => null)]);
    const g = pick(cur), m = mets.filter(x => (c.stations?.metar || []).includes(x.icaoId)).sort((a, b) => b.obsTime - a.obsTime)[0], pm = m && parseMetar(m);
    const f = (t, rh, w) => (t == null || rh == null ? null : { nws_heat_index: heatIndexNWS(t, rh), bom_apparent: apparentBoM(t, rh, w ?? 0) });
    return { city: c.name, at: toIST(cur?.currentTime), google_now: g, google_hours: (hrs?.forecastHours || []).map(x => ({ t: toIST(x.interval?.startTime), ...pick(x) })),
      formulas_on_google: g && f(g.temp, g.rh, g.wind_kmh), measured: pm ? { temp: pm.temp, rh: pm.humidity, wind_kmh: pm.wind ?? null, station: pm.station, at: new Date(pm.at).toISOString(), ...f(pm.temp, pm.humidity, pm.wind) } : null,
      ecmwf_now: om[i] ? { temp: om[i].now.temp, apparent: om[i].now.feels, rh: om[i].now.rh, wind_kmh: om[i].now.wind } : null };
  }));
  return ok({ rows }, "check");
}

// ?check=compare: Google's and ECMWF's figures side by side for each city, with the airport's measured reading
// (12 Google calls; never cached). For deciding which forecast leads.
async function compare(now) {
  const cs = points(), [om, mets] = await Promise.all([openMeteo(cs, now).catch(() => cs.map(() => null)), metars(cs).catch(() => [])]);
  const sum = f => f && { now: f.now.temp, feels: f.now.feels, rh: f.now.rh, today_hi: f.days[0]?.hi, today_lo: f.days[0]?.lo, tomorrow: f.days[1] && [f.days[1].lo, f.days[1].hi], next12_max: Math.max(...f.hours.slice(0, 13).map(h => h.temp)), next12_rain_mm: r1(f.hours.slice(0, 13).reduce((t, h) => t + (h.mm || 0), 0)), sky_now: kindOf(f.now.code), days: f.days.length, hours: f.hours.length };
  const rows = await Promise.all(cs.map(async (c, i) => {
    const g = await google(c, now).catch(e => ({ error: String(e.message) }));
    const m = mets.filter(x => (c.stations?.metar || []).includes(x.icaoId)).sort((a, b) => b.obsTime - a.obsTime)[0];
    const pm = m && parseMetar(m);
    const gs = g.error ? g : { ...sum(g), next12_rain_chance_max: Math.max(...g.hours.slice(0, 13).map(h => h.p ?? 0)), today_rain_chance: g.days[0]?.p };
    return { city: c.name, measured: pm ? { temp: pm.temp, rh: pm.humidity, station: pm.station, at: new Date(pm.at).toISOString() } : null, ecmwf: sum(om[i]), google: gs };
  }));
  return ok({ rows }, "compare");
}

export async function wx(params = new URLSearchParams()) {
  try {
    const now = Date.now();
    if (params.get?.("check") === "google") return checkGoogle();
    if (params.get?.("check") === "compare") return compare(now);
    if (params.get?.("check") === "feels") return checkFeels(now);
    // A city the reader added in the app (?lat=&lon=&name=): the forecast and air only; never cached at the edge
    if (params.has?.("lat")) {
      const lat = Number(params.get("lat")), lon = Number(params.get("lon")); if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error("bad coordinates");
      const c = { id: "x", name: String(params.get("name") || "Here").slice(0, 40), state: String(params.get("state") || "").slice(0, 40) || null, lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
      const [fc, ch, air] = await Promise.all([openMeteo([c], now).then(a => a[0]).catch(() => null), ensemble([c]).then(a => a[0]).catch(() => null), cams([c], now).then(a => a[0]).catch(() => null)]);
      const f = fc || (await google(c, now).catch(() => null)) || (await metno(c, now).catch(() => null)); if (!f) throw new Error("no forecast for this place");
      const city = assemble(c, f, { chances: ch, air }, now);
      return ok({ cities: [city], headline: null }, city.src.forecast);
    }
    const cs = points();
    const [fcs, chs, airs, readsImd, mets, ncs, alerts, rain, outlook] = await Promise.all([
      openMeteo(cs, now).catch(() => cs.map(() => null)),
      ensemble(cs).catch(() => cs.map(() => null)),
      cams(cs, now).catch(() => cs.map(() => null)),
      Promise.all(cs.map(c => (c.stations?.imd?.length ? readings({ imd: c.stations.imd }).catch(() => []) : []))),
      metars(cs).catch(() => []),
      nowcasts(cs).catch(() => cs.map(() => null)),
      sachet(cs).catch(() => cs.map(() => null)),
      self("rain"), self("outlook"),
    ]);
    const cities = (await Promise.all(cs.map(async (c, i) => {
      // Google first (Parth, 23 Oct: WeatherNext 3 leads Brightband's independent benchmark), then ECMWF, then MET Norway
      const fc = (await google(c, now).catch(() => null)) || fcs[i] || (await metno(c, now).catch(() => null));
      if (!fc) return null;
      const mine = mets.filter(m => (c.stations?.metar || []).includes(m.icaoId)).sort((a, b) => b.obsTime - a.obsTime);
      const ga = await googleAir(c).catch(() => null);
      const air = ga ? { ...ga, days: airs[i]?.days || [], uv: airs[i]?.uv } : airs[i];
      const gauges = c.rain_places && rain?.value?.places ? rain.value.places.filter(p => c.rain_places.includes(p.id) && Date.now() - Date.parse(rain.as_of) < (rain.value.fresh_min || 60) * 6e4).map(p => ({ name: p.name, area: p.area, raining: p.raining, word: p.word, rate_mm_h: p.rate_mm_h, today_mm: p.today_mm })) : null;
      const ol = c.outlook && outlook?.value?.cities ? outlook.value.cities.find(o => o.name === c.outlook) : null;
      return assemble(c, fc, { chances: chs[i], air, readings: [...readsImd[i], ...mine.map(parseMetar).filter(Boolean)], vis: metarVis(mine[0]), visStation: mine[0]?.icaoId, nowcast: ncs[i], alert: alerts[i], gauges: gauges?.length ? gauges : null, outlook: ol ? { weeks: ol.weeks, months: ol.months, station: ol.station } : null }, now);
    }))).filter(Boolean);
    if (!cities.length) throw new Error("no forecast for any city");
    return ok({ cities, headline: headlineFor(cities) }, [...new Set(cities.map(c => c.src.forecast))].join(", "));
  } catch (e) { return fail(e); }
}

export const WXAPP = { wx };
export const WXAPP_CACHE = { wx: [900, 3600] };
