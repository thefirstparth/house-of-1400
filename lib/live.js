// Live data sources. Every getter returns {ok, value, source, as_of, stale}.
// Primary, then backup. The browser falls back to the edition snapshot, then hides the field.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let CONFIG;
export function config() {
  if (!CONFIG) CONFIG = JSON.parse(readFileSync(join(process.cwd(), "config", "house.json"), "utf8"));
  return CONFIG;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

// Some hosts refuse a browser user-agent from cloud IPs (ESPN answers Vercel with 403), others refuse
// anything else. On 403 or 429, retry with the other identities before giving up.
const ALT_UAS = ["Mozilla/5.0", "house-of-1400/1.0 (+private newspaper)", null];

export async function getJSON(url, { timeout = 8000, headers = {} } = {}) {
  const tried = [];
  for (const ua of [headers["user-agent"] || UA, ...ALT_UAS.filter(u => u !== headers["user-agent"])]) {
    const h = { accept: "application/json", ...headers };
    if (ua) h["user-agent"] = ua; else delete h["user-agent"];
    const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(timeout) });
    if (r.ok) return r.json();
    tried.push(`${r.status}${ua ? "" : "(no ua)"}`);
    if (r.status !== 403 && r.status !== 429) break;
  }
  throw new Error(`${tried.join(",")} ${url}`);
}

export async function getText(url, { timeout = 8000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });

async function chain(...attempts) {
  const errors = [];
  for (const a of attempts) {
    try { return await a(); } catch (e) { errors.push(String(e?.message || e)); }
  }
  return fail(errors.join(" | "));
}

// ---------------------------------------------------------------- weather
export const WMO = {
  0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"], 51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"], 61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"], 71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"],
  77: ["🌨️", "Snow grains"], 80: ["🌦️", "Showers"], 81: ["🌧️", "Heavy showers"], 82: ["⛈️", "Violent showers"],
  85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"], 95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm, hail"], 99: ["⛈️", "Thunderstorm, hail"],
};

// Seven days back and seven ahead, so the page can say what has changed. Past days come back in `past`.
async function openMeteo(lat, lon, hourly = false) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,precipitation,relative_humidity_2m,wind_speed_10m,uv_index,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,relative_humidity_2m_mean,apparent_temperature_max,sunrise,sunset` +
    (hourly ? `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=36` : "") +
    `&timezone=Asia%2FKolkata&forecast_days=7&past_days=7`;
  const j = await getJSON(u);
  const c = j.current, d = j.daily;
  if (!c || !d?.time?.length || typeof c.temperature_2m !== "number") throw new Error("open-meteo shape");
  if (c.temperature_2m < -60 || c.temperature_2m > 60) throw new Error("open-meteo range");
  const today = /^\d{4}-\d\d-\d\d/.test(c.time || "") ? c.time.slice(0, 10) : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days = d.time.map((t, i) => ({
    date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
    rain_prob: d.precipitation_probability_max?.[i] ?? null, rain_mm: d.precipitation_sum?.[i] ?? null,
    humidity: d.relative_humidity_2m_mean?.[i] ?? null, feels_max: d.apparent_temperature_max?.[i] ?? null,
    // Local times (IST for the paper's cities), for the masthead's sky arc.
    sunrise: d.sunrise?.[i] ?? null, sunset: d.sunset?.[i] ?? null,
  }));
  return {
    current: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m ?? null, uv: typeof c.uv_index === "number" ? Math.round(c.uv_index * 10) / 10 : null, is_day: c.is_day ?? null, time: c.time },
    daily: days.filter(x => x.date >= today),
    past: days.filter(x => x.date < today),
    utc_offset_seconds: j.utc_offset_seconds ?? null,
    // Local IST times like "2026-09-25T17:00".
    hourly: j.hourly?.time ? j.hourly.time.map((t, i) => ({ time: t, temp: j.hourly.temperature_2m[i], rain_prob: j.hourly.precipitation_probability?.[i] ?? null, code: j.hourly.weather_code?.[i] ?? null })) : undefined,
  };
}

// ---------------------------------------------------------------- the temperature now, measured (3 Oct 2026)
// Parth: "a go on switching the 'now' reading to IMD's measured figures". Measured beats modelled, but only while it is
// fresh: IMD's Bengaluru-City station reports every three hours (a 14:30 reading shown at 17:00 would be wrong), so
// the reading used is the freshest from a station near the city that measured in the last 75 minutes: IMD's own
// stations (city.imd.gov.in, keyless; Bengaluru-City and HAL, Ranchi, Prayagraj) and the airports' METAR reports
// (aviationweather.gov, every 30 to 60 minutes). None fresh, or every reading more than 6 degrees from the model's
// (a faulty station): the model's figure stands, as before. The sky (its code) stays the model's: IMD's codes are its own.
export const FRESH_MIN = 75;
const num = v => (v === "" || v == null || v === "NA" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export function parseImd(j) {
  const r = Array.isArray(j) ? j[0] : null; if (!r) return null;
  const t = num(r.Temperature), at = /^\d{4}-\d\d-\d\d$/.test(r["Date of Observation"] || "") && /^\d{1,2}$/.test(String(r.Time ?? "")) ? Date.parse(`${r["Date of Observation"]}T${String(r.Time).padStart(2, "0")}:00:00Z`) : NaN;
  if (t == null || t < -20 || t > 55 || !Number.isFinite(at)) return null;
  const rh = num(r.Humidity), w = num(r["Wind Speed KMPH"]), f = num(r["Feel Like"]);
  return { temp: t, humidity: rh != null && rh >= 0 && rh <= 100 ? rh : null, wind: w != null && w >= 0 && w < 300 ? w : null, feels: f != null && f > -30 && f < 70 ? f : null, at, source: "IMD", station: String(r.Station || "") };
}
export function parseMetar(m) {
  const t = num(m?.temp), at = Number(m?.obsTime) * 1000; if (t == null || t < -20 || t > 55 || !Number.isFinite(at)) return null;
  const td = num(m.dewp), mag = x => Math.exp(17.625 * x / (243.04 + x)), rh = td != null ? Math.round(Math.min(100, 100 * mag(td) / mag(t))) : null;
  const kt = num(m.wspd), wind = kt != null ? Math.round(kt * 1.852 * 10) / 10 : null;
  return { temp: t, humidity: rh, wind, feels: null, at, source: "METAR", station: String(m.icaoId || "") };
}
export function pickMeasured(readings, model, now = Date.now()) {
  const ok = readings.filter(r => r && now - r.at <= FRESH_MIN * 6e4 && now - r.at >= -10 * 6e4 && (model?.temp == null || Math.abs(r.temp - model.temp) <= 6));
  return ok.sort((a, b) => b.at - a.at)[0] || null;
}
async function readings(st) {
  const imd = (st.imd || []).map(id => getJSON(`https://city.imd.gov.in/api/current_wx_api.php?id=${encodeURIComponent(id)}`, { timeout: 4000 }).then(parseImd).catch(() => null));
  const metar = st.metar?.length ? getJSON(`https://aviationweather.gov/api/data/metar?ids=${st.metar.map(encodeURIComponent).join(",")}&format=json`, { timeout: 4000 }).then(a => (Array.isArray(a) ? a : []).map(parseMetar)).catch(() => []) : Promise.resolve([]);
  return [...await Promise.all(imd), ...await metar].filter(Boolean);
}
export function applyMeasured(w, m) {
  if (!m || !w?.current) return w;
  const cur = { ...w.current, temp: m.temp, humidity: m.humidity ?? w.current.humidity, wind: m.wind ?? w.current.wind };
  // feels-like keeps the model's own gap between feel and temperature, on the measured figure: one method whichever
  // station answers (IMD's own feels-like equals the temperature at night; a formula on a humid dawn reads 4 degrees up)
  cur.feels = w.current.feels != null && w.current.temp != null ? Math.round((m.temp + (w.current.feels - w.current.temp)) * 10) / 10 : m.feels ?? w.current.feels;
  cur.measured = { source: m.source, station: m.station, at: new Date(m.at).toISOString(), model_temp: w.current.temp };
  // the day's high and low hold the measured figure (a reading above the forecast high is the high)
  const daily = (w.daily || []).map((d, i) => (i ? d : { ...d, max: d.max != null ? Math.max(d.max, m.temp) : d.max, min: d.min != null ? Math.min(d.min, m.temp) : d.min }));
  return { ...w, current: cur, daily };
}

// Air quality from Open-Meteo (CAMS model), on the US AQI scale: now, the last seven days and about five ahead.
// A day's figure is the highest hourly AQI that day, as the reader would meet it.
async function airQuality(cities) {
  const j = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${cities.map(c => c.lat).join(",")}&longitude=${cities.map(c => c.lon).join(",")}` +
    `&current=us_aqi,pm2_5&hourly=us_aqi&past_days=7&forecast_days=6&timezone=Asia%2FKolkata`);
  return [].concat(j).map(a => {
    const today = (a.current?.time || "").slice(0, 10);
    const byDay = {};
    (a.hourly?.time || []).forEach((t, i) => { const v = a.hourly.us_aqi[i]; if (v != null) (byDay[t.slice(0, 10)] ||= []).push(v); });
    const days = Object.entries(byDay).filter(([, v]) => v.length >= 12).map(([date, v]) => ({ date, aqi: Math.max(...v) }));
    const now = a.current?.us_aqi;
    if (!(now >= 0 && now < 1000)) return null;
    return { now, pm2_5: a.current.pm2_5 ?? null, scale: "US AQI", daily: days.filter(x => x.date >= today), past: days.filter(x => x.date < today) };
  });
}

// ---------------------------------------------------------------- Sky & Streets: the weeks and months ahead
// For the section's trend (Parth, 1 Oct: "how the weather is trending week over week and month over month"). For each
// city: last week as measured, this week and next (Open-Meteo, 14 days); this month and the next two from ECMWF's
// seasonal forecast (51 runs, medians), corrected by how far it was off last month against the city's weather station;
// a usual month (config/climate.json: station 1991 to 2020, air 2022 to 2025); air as the week's mean US AQI.
let CLIMATE;
const climate = () => (CLIMATE ||= JSON.parse(readFileSync(join(process.cwd(), "config", "climate.json"), "utf8")));
const median = a => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => { const b = a.filter(x => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const r1o = v => (v == null ? null : Math.round(v * 10) / 10);
async function outlookCity(c, usual) {
  const Z = `latitude=${c.lat}&longitude=${c.lon}&timezone=Asia%2FKolkata`;
  const [f, a, s] = await Promise.all([
    getJSON(`https://api.open-meteo.com/v1/forecast?${Z}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,relative_humidity_2m_mean,precipitation_probability_max,precipitation_sum&past_days=7&forecast_days=14`),
    getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${Z}&hourly=us_aqi&past_days=7&forecast_days=5`).catch(() => null),
    getJSON(`https://seasonal-api.open-meteo.com/v1/seasonal?${Z}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&past_days=31&forecast_days=93`, { timeout: 15000 }).catch(() => null),
  ]);
  const d = f.daily; if (!d?.time?.length) throw new Error("open-meteo shape");
  const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10), t0 = d.time.indexOf(today);
  if (t0 < 7) throw new Error("open-meteo: no past week");
  const week = (from, to, measured) => {
    const ix = d.time.map((_, i) => i).slice(from, to), v = k => ix.map(i => d[k][i]);
    const aqh = a?.hourly ? a.hourly.time.map((t, i) => [t.slice(0, 10), a.hourly.us_aqi[i]]).filter(([t, x]) => x != null && t >= d.time[from] && t <= d.time[to - 1]).map(([, x]) => x) : [];
    return { from: d.time[from], to: d.time[to - 1], hi: r1o(mean(v("temperature_2m_max"))), lo: r1o(mean(v("temperature_2m_min"))), feels: r1o(mean(v("apparent_temperature_max"))),
      humidity: Math.round(mean(v("relative_humidity_2m_mean")) ?? NaN) || null,
      rainy: measured ? v("precipitation_sum").filter(x => x >= 2.5).length : v("precipitation_probability_max").filter(x => x >= 60).length,
      aqi: aqh.length >= 48 ? Math.round(mean(aqh)) : null, measured };
  };
  const weeks = [week(t0 - 7, t0, true), week(t0, t0 + 7, false), ...(d.time.length >= t0 + 14 ? [week(t0 + 7, t0 + 14, false)] : [])];
  const days = d.time.slice(t0, t0 + 14).map((t, i) => ({ date: t, rain_prob: d.precipitation_probability_max[t0 + i], hi: d.temperature_2m_max[t0 + i] }));
  // Months: medians across the 51 runs, corrected by last month's error against the station.
  let months = [];
  if (s?.daily?.time) {
    const S = s.daily, keys = v => Object.keys(S).filter(k => k === v || k.startsWith(v + "_member"));
    const by = {}; S.time.forEach((t, i) => (by[t.slice(0, 7)] ||= []).push(i));
    const monthOf = (m, v, agg) => median(keys(v).map(k => agg(by[m].map(i => S[k][i]))));
    const ym = today.slice(0, 7), add = n => { const [y, mo] = ym.split("-").map(Number), x = new Date(Date.UTC(y, mo - 1 + n, 15)); return x.toISOString().slice(0, 7); };
    const prev = add(-1), U = m => usual?.months?.[+m.slice(5)] || {};
    const bias = by[prev] ? { hi: monthOf(prev, "temperature_2m_max", mean) - U(prev).hi, lo: monthOf(prev, "temperature_2m_min", mean) - U(prev).lo } : { hi: 0, lo: 0 };
    months = [ym, add(1), add(2)].filter(m => by[m]?.length >= 20).map(m => ({ month: m, hi: r1o(monthOf(m, "temperature_2m_max", mean) - (Number.isFinite(bias.hi) ? bias.hi : 0)), lo: r1o(monthOf(m, "temperature_2m_min", mean) - (Number.isFinite(bias.lo) ? bias.lo : 0)),
      rain: Math.round(monthOf(m, "precipitation_sum", x => x.reduce((t, y) => t + (y || 0), 0))), usual_hi: U(m).hi ?? null, usual_lo: U(m).lo ?? null, usual_rain: U(m).rain ?? null, usual_aqi: U(m).aqi ?? null }));
  }
  return { name: c.name, ...(c.family ? { family: true } : {}), lat: c.lat, lon: c.lon, weeks, days, months, station: usual?.station || null };
}
export async function outlook() {
  const cfg = config().weather, C = climate().cities;
  const list = [...cfg.always, ...(cfg.family || []).map(c => ({ ...c, family: true }))];
  return chain(async () => {
    const res = await Promise.allSettled(list.map(c => outlookCity(c, C[c.name])));
    if (res[0].status !== "fulfilled") throw res[0].reason;
    return ok({ cities: res.filter(r => r.status === "fulfilled").map(r => r.value) }, "Open-Meteo, ECMWF, Copernicus, station records");
  });
}

// The name of the place the reader is in, for "where you are" (Parth, 2 Oct): OpenStreetMap's Nominatim, then
// BigDataCloud. Asked with the point rounded to about a kilometre; nothing is kept.
async function placeName(lat, lon) {
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`, { timeout: 5000, headers: { "user-agent": "house-of-1400/1.0 (+private newspaper)" } });
    const a = j.address || {}, name = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district || a.state;
    if (name) return { name, region: a.state || null, country: (a.country_code || "").toUpperCase() || null };
  } catch {}
  try {
    const j = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { timeout: 5000 });
    const name = j.city || j.locality || j.principalSubdivision;
    if (name) return { name, region: j.principalSubdivision || null, country: j.countryCode || null };
  } catch {}
  return null;
}

export async function weather(params) {
  const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  // Where the reader is (only when they have shared it, from the page): the point's weather, air and name. Rounded to
  // two decimals (about a kilometre) before it goes anywhere; never cached at the edge (api/live, "personal").
  if (params.has("lat")) {
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return fail("bad coordinates");
    const la = lat.toFixed(2), lo = lon.toFixed(2);
    return chain(async () => {
      const [w, place, air] = await Promise.all([
        openMeteo(la, lo, true).catch(() => openMeteo(la, lo, true)),
        placeName(la, lo),
        airQuality([{ lat: la, lon: lo }]).then(a => a[0] || null).catch(() => null),
      ]);
      return ok({ cities: [{ name: place?.name || "Where you are", here: true, lat: Number(la), lon: Number(lo), region: place?.region || null, country: place?.country || null, ...w, air }] }, "Open-Meteo");
    });
  }
  // Home first, then the family cities (config weather.family), every day.
  const cfg = config().weather;
  const list = [...cfg.always, ...(cfg.family || cfg.when_notable || []).map(c => ({ ...c, family: true }))];
  return chain(async () => {
    const [wx, air, meas] = await Promise.all([
      // One retry each: Open-Meteo occasionally stalls on a single request.
      Promise.allSettled(list.map((c, i) => openMeteo(c.lat, c.lon, i === 0).catch(() => openMeteo(c.lat, c.lon, i === 0)))),
      airQuality(list).catch(() => []),
      Promise.all(list.map(c => (c.stations ? readings(c.stations).catch(() => []) : []))),
    ]);
    if (wx[0].status !== "fulfilled") throw wx[0].reason;
    const cities = list.map((c, i) => wx[i].status === "fulfilled" ? { name: c.name, lat: c.lat, lon: c.lon, ...(c.family ? { family: true } : {}), ...applyMeasured(wx[i].value, pickMeasured(meas[i] || [], wx[i].value.current)), air: air[i] || null } : null).filter(Boolean);
    return ok({ cities }, cities.some(c => c.current.measured) ? "IMD, METAR, Open-Meteo" : "Open-Meteo");
  });
}

// ---------------------------------------------------------------- F1
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const SESSION_KEYS = [["FirstPractice", "Practice 1", 60], ["SecondPractice", "Practice 2", 60], ["ThirdPractice", "Practice 3", 60],
  ["SprintQualifying", "Sprint Qualifying", 45], ["SprintShootout", "Sprint Shootout", 45], ["Sprint", "Sprint", 60], ["Qualifying", "Qualifying", 60]];
const COUNTRY_FLAG = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", USA: "🇺🇸", "United States": "🇺🇸", Italy: "🇮🇹", Monaco: "🇲🇨",
  Spain: "🇪🇸", Canada: "🇨🇦", Austria: "🇦🇹", UK: "🇬🇧", "United Kingdom": "🇬🇧", Hungary: "🇭🇺", Belgium: "🇧🇪", Netherlands: "🇳🇱",
  Azerbaijan: "🇦🇿", Malaysia: "🇲🇾", Korea: "🇰🇷", "South Korea": "🇰🇷", Turkey: "🇹🇷", "Türkiye": "🇹🇷", Vietnam: "🇻🇳", Russia: "🇷🇺", Singapore: "🇸🇬", Mexico: "🇲🇽", Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", "Abu Dhabi": "🇦🇪",
  "Las Vegas": "🇺🇸", Miami: "🇺🇸", Portugal: "🇵🇹", France: "🇫🇷", Germany: "🇩🇪", Argentina: "🇦🇷", India: "🇮🇳", Thailand: "🇹🇭",
};
export const flag = c => COUNTRY_FLAG[c] || "🏁";
const iso = (date, time) => (date ? `${date}T${time || "00:00:00Z"}`.replace(/Z?$/, "Z") : null);

function jolpicaRace(r) {
  const sessions = [];
  for (const [k, name, dur] of SESSION_KEYS) if (r[k]?.date) sessions.push({ name, start: iso(r[k].date, r[k].time), minutes: dur, time_confirmed: !!r[k].time });
  sessions.push({ name: "Race", start: iso(r.date, r.time), minutes: 120, time_confirmed: !!r.time });
  sessions.sort((a, b) => a.start.localeCompare(b.start));
  const country = r.Circuit?.Location?.country;
  return { season: r.season, round: Number(r.round), name: r.raceName, circuit: r.Circuit?.circuitName, locality: r.Circuit?.Location?.locality, country, flag: flag(country), sessions };
}

// The circuit map F1 publishes for a race weekend (OpenF1's meetings list carries it): the detailed 2026 map with
// corners, sectors and overtake zones. Found by the weekend's dates; no map rather than the wrong one.
async function trackMap(race) {
  try {
    const raceAt = Date.parse(race.sessions.at(-1).start);
    const m = await getJSON(`https://api.openf1.org/v1/meetings?year=${new Date(raceAt).getUTCFullYear()}`, { timeout: 6000 });
    const hit = m.find(x => !x.is_cancelled && Date.parse(x.date_start) <= raceAt && Date.parse(x.date_end) + 6 * 36e5 >= raceAt);
    return hit?.circuit_image && /^https:\/\/media\.formula1\.com\//.test(hit.circuit_image) ? { image: hit.circuit_image, circuit: hit.circuit_short_name || null, official: hit.meeting_official_name || null } : null;
  } catch { return null; }
}

// Team colours as F1 publishes them (OpenF1's driver list for the latest session), keyed by driver code, so no team
// or colour is written into the paper; and each driver's name as F1 prints it ("Kimi Antonelli", where Jolpica has
// "Andrea Kimi"). Kept for six hours; without it the page draws neutral bars and Jolpica's names.
let F1COL = null;
async function f1Colours() {
  if (F1COL && Date.now() - F1COL.t < 6 * 36e5) return F1COL.m;
  try {
    const d = await getJSON("https://api.openf1.org/v1/drivers?session_key=latest", { timeout: 6000 });
    const m = {};
    for (const x of d || []) if (x.name_acronym && /^[0-9a-f]{6}$/i.test(x.team_colour || "")) m[x.name_acronym] = { colour: "#" + x.team_colour.toUpperCase(), shown: [x.first_name, x.last_name].filter(Boolean).join(" ") || null };
    if (Object.keys(m).length) F1COL = { t: Date.now(), m };
    return m;
  } catch { return F1COL?.m || {}; }
}

export async function f1_next() {
  const now = Date.now();
  return chain(async () => {
    const j = await getJSON(`${JOLPICA}/current.json?limit=40`);
    const races = (j.MRData?.RaceTable?.Races || []).map(jolpicaRace);
    if (!races.length) throw new Error("jolpica empty");
    // Current weekend stays "current" until 3h after lights out.
    const idx = races.findIndex(r => Date.parse(r.sessions.at(-1).start) + 3 * 36e5 > now);
    // the races to come, each with its qualifying and sprint times (the Sport app's race sheet)
    const up = (list, i) => list.slice(i + 1, i + 5).map(r => ({ round: r.round, name: r.name, country: r.country, flag: r.flag, date: r.sessions.at(-1).start, sessions: r.sessions.filter(x => !/practice/i.test(x.name)) }));
    if (idx < 0) {
      // Off-season (December to March): the season just run is over; next year's opener once its calendar is out.
      const nx = await getJSON(`${JOLPICA}/${Number(races[0].season) + 1}.json?limit=40`).then(x => (x.MRData?.RaceTable?.Races || []).map(jolpicaRace)).catch(() => []);
      if (!nx.length) return ok({ race: null, upcoming: [], season_over: true, season: races[0].season }, "Jolpica");
      return ok({ race: { ...nx[0], track: await trackMap(nx[0]) }, upcoming: up(nx, 0), next_season: true, season_over: true, season: races[0].season }, "Jolpica");
    }
    return ok({ race: { ...races[idx], track: await trackMap(races[idx]) }, upcoming: up(races, idx) }, "Jolpica");
  }, async () => {
    const year = new Date().getUTCFullYear();
    const s = await getJSON(`https://api.openf1.org/v1/sessions?year=${year}`);
    const future = s.filter(x => Date.parse(x.date_end) + 3 * 36e5 > now).sort((a, b) => a.date_start.localeCompare(b.date_start));
    if (!future.length) throw new Error("openf1 empty");
    const mk = future[0].meeting_key;
    const sessions = s.filter(x => x.meeting_key === mk).sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map(x => ({ name: x.session_name, start: new Date(x.date_start).toISOString(), minutes: Math.round((Date.parse(x.date_end) - Date.parse(x.date_start)) / 6e4), time_confirmed: true }));
    const f = future[0];
    const meetings = [...new Map(future.map(x => [x.meeting_key, x])).values()].slice(1, 4);
    return ok({ race: { season: String(year), round: null, name: `${f.country_name} Grand Prix`, circuit: f.circuit_short_name, locality: f.location, country: f.country_name, flag: flag(f.country_name), sessions },
      upcoming: meetings.map(m => ({ round: null, name: `${m.country_name} Grand Prix`, country: m.country_name, flag: flag(m.country_name), date: m.date_start })) }, "OpenF1");
  });
}

export async function f1_standings() {
  return chain(async () => {
    const get = season => Promise.all([getJSON(`${JOLPICA}/${season}/driverStandings.json`), getJSON(`${JOLPICA}/${season}/constructorStandings.json`)]);
    let [d, c] = await get("current"), prior = false;
    // A new season before its first race has no table yet: show the last one, marked as its final standings.
    if (!d.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.length) { [d, c] = await get(Number(d.MRData?.StandingsTable?.season || new Date().getUTCFullYear()) - 1); prior = true; }
    const dl = d.MRData?.StandingsTable?.StandingsLists?.[0], cl = c.MRData?.StandingsTable?.StandingsLists?.[0];
    if (!dl?.DriverStandings?.length) throw new Error("jolpica standings empty");
    const col = await f1Colours();
    const drivers = dl.DriverStandings.map(x => ({ pos: Number(x.position), name: `${x.Driver.givenName} ${x.Driver.familyName}`, code: x.Driver.code, team: x.Constructors?.[0]?.name, points: Number(x.points), wins: Number(x.wins), colour: col[x.Driver.code]?.colour || null, shown: col[x.Driver.code]?.shown || null }));
    return ok({
      season: dl.season, round: Number(dl.round), prior,
      drivers,
      constructors: (cl?.ConstructorStandings || []).map(x => ({ pos: Number(x.position), name: x.Constructor.name, points: Number(x.points), wins: Number(x.wins),
        colour: drivers.find(dr => dr.team === x.Constructor.name && dr.colour)?.colour || null })),
    }, "Jolpica");
  });
}

export async function f1_last() {
  return chain(async () => {
    let j = await getJSON(`${JOLPICA}/current/last/results.json`);
    // Before a new season's first race, the last race is last season's finale.
    if (!j.MRData?.RaceTable?.Races?.length) j = await getJSON(`${JOLPICA}/${Number(j.MRData?.RaceTable?.season || new Date().getUTCFullYear()) - 1}/last/results.json`);
    const r = j.MRData?.RaceTable?.Races?.[0];
    if (!r) throw new Error("jolpica last empty");
    const col = await f1Colours();
    return ok({ season: r.season, round: Number(r.round), name: r.raceName, country: r.Circuit?.Location?.country, flag: flag(r.Circuit?.Location?.country), date: iso(r.date, r.time),
      results: r.Results.map(x => ({ pos: Number(x.position), name: `${x.Driver.givenName} ${x.Driver.familyName}`, code: x.Driver.code, team: x.Constructor?.name, status: x.status,
        time: x.Time?.time || null, laps: Number(x.laps) || null, points: Number(x.points), colour: col[x.Driver.code]?.colour || null, shown: col[x.Driver.code]?.shown || null })) }, "Jolpica");
  });
}

// The top three in each finished session of the latest race weekend (sprint qualifying, sprint, qualifying, race), for
// the fixture list (Parth, 9 Oct: "why can I see results for some sports and not for others?"). A session's three
// print only when two of OpenF1, ESPN and Jolpica name the same drivers in the same order; otherwise it has none here.
const sessionKind = n => (/^sprint (qualifying|shootout)$/i.test(n) ? "sq" : /^sprint$/i.test(n) ? "sprint" : /^qualifying$/i.test(n) ? "quali" : /^race$/i.test(n) ? "race" : null);
const ESPN_KIND = { SS: "sq", SR: "sprint", Qual: "quali", Race: "race" };
const JOLPICA_KIND = { quali: ["qualifying", "QualifyingResults"], sprint: ["sprint", "SprintResults"], race: ["results", "Results"] };
export const surnameKey = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, "");
// The first pair of sources that agree on all three, in order of preference; null when no two do.
export function agreedTop(lists) {
  const have = lists.filter(l => l?.top?.length === 3);
  for (let i = 0; i < have.length; i++) for (let j = i + 1; j < have.length; j++)
    if (have[i].top.every((n, k) => surnameKey(n) === surnameKey(have[j].top[k]))) return { top: have[i].top, sources: [have[i].source, have[j].source] };
  return null;
}

export async function f1_sessions() {
  const now = Date.now(), near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) < 30 * 6e4;
  let races;
  try { races = (await getJSON(`${JOLPICA}/current.json?limit=40`)).MRData?.RaceTable?.Races?.map(jolpicaRace) || []; } catch (e) { return fail(e); }
  // The weekend under way, or the one just run until the day after its race.
  const W = races.filter(r => Date.parse(r.sessions[0].start) <= now && Date.parse(r.sessions.at(-1).start) + 36 * 36e5 > now).at(-1);
  if (!W) return ok({ race: null, results: [] }, "Jolpica");
  const done = W.sessions.filter(s => sessionKind(s.name) && s.time_confirmed && Date.parse(s.start) + s.minutes * 6e4 < now);
  if (!done.length) return ok({ race: W, results: [] }, "Jolpica");
  const year = new Date(Date.parse(W.sessions.at(-1).start)).getUTCFullYear();
  const [of1, espn, jol] = await Promise.all([
    (async () => {
      const ss = (await getJSON(`https://api.openf1.org/v1/sessions?year=${year}`)).filter(x => done.some(s => near(s.start, x.date_start) && sessionKind(s.name) === sessionKind(x.session_name)));
      if (!ss.length) return [];
      const mk = ss[0].meeting_key;
      const [res, drv] = await Promise.all([getJSON(`https://api.openf1.org/v1/session_result?meeting_key=${mk}&position%3C%3D3`), getJSON(`https://api.openf1.org/v1/drivers?meeting_key=${mk}`)]);
      const name = new Map(drv.map(d => [d.driver_number, d.last_name]));
      return ss.map(x => ({ start: x.date_start, top: res.filter(r => r.session_key === x.session_key && r.position >= 1 && r.position <= 3).sort((a, b) => a.position - b.position).map(r => name.get(r.driver_number)).filter(Boolean) }));
    })().catch(() => []),
    (async () => {
      const j = await getJSON(`${ESPN}/racing/f1/scoreboard`);
      return (j.events || []).flatMap(e => e.competitions || []).filter(c => ESPN_KIND[c.type?.abbreviation] && c.status?.type?.completed)
        .map(c => ({ start: c.date, kind: ESPN_KIND[c.type.abbreviation], top: (c.competitors || []).filter(x => x.order >= 1 && x.order <= 3).sort((a, b) => a.order - b.order).map(x => x.athlete?.displayName).filter(Boolean) }));
    })().catch(() => []),
    Promise.all(done.filter(s => JOLPICA_KIND[sessionKind(s.name)]).map(async s => {
      const [path, field] = JOLPICA_KIND[sessionKind(s.name)];
      const r = (await getJSON(`${JOLPICA}/${W.season}/${W.round}/${path}.json`)).MRData?.RaceTable?.Races?.[0];
      return { start: s.start, top: (r?.[field] || []).filter(x => Number(x.position) <= 3).sort((a, b) => a.position - b.position).map(x => x.Driver?.familyName).filter(Boolean) };
    }).map(p => p.catch(() => null))),
  ]);
  const results = [];
  for (const s of done) {
    const pick = (list, source) => { const x = list.find(y => y && near(y.start, s.start) && (!y.kind || y.kind === sessionKind(s.name))); return x && { top: x.top, source }; };
    const a = agreedTop([pick(of1, "OpenF1"), pick(espn, "ESPN"), pick(jol, "Jolpica")]);
    if (a) results.push({ name: s.name, start: s.start, top: a.top, sources: a.sources });
  }
  return ok({ race: W, results }, [...new Set(results.flatMap(r => r.sources))].join(", ") || "Jolpica");
}

// ---------------------------------------------------------------- football (ESPN)
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const score = s => (s == null ? null : typeof s === "object" ? (s.displayValue ?? s.value ?? null) : s);

const COMPS = { "spanish laliga": "La Liga", "laliga": "La Liga", "uefa champions league": "Champions League", "spanish copa del rey": "Copa del Rey", "spanish supercopa": "Supercopa", "fifa club world cup": "Club World Cup" };
export const tidyComp = n => (n ? COMPS[n.toLowerCase()] || n.replace(/^Spanish /, "") : null);

function espnEvent(ev, teamId) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const me = cs.find(c => String(c.team?.id ?? c.id) === String(teamId)) || cs[0];
  const opp = cs.find(c => c !== me) || {};
  const st = comp.status?.type || ev.status?.type || {};
  const league = tidyComp(ev.league?.name || comp.league?.name || ev.seasonType?.name || ev.season?.displayName || null);
  return {
    id: ev.id, date: ev.date, name: ev.name,
    competition: league,
    home: me?.homeAway === "home",
    opponent: opp.team?.displayName || opp.team?.shortDisplayName || null,
    opponent_id: opp.team?.id ?? opp.id ?? null,
    venue: comp.venue?.fullName || null,
    state: st.state || null, completed: !!st.completed, detail: st.shortDetail || st.detail || null, clock: st.state === "in" ? (st.shortDetail || null) : null,
    time_confirmed: !(comp.timeValid === false || ev.timeValid === false),
    score: me && opp ? { us: score(me.score), them: score(opp.score) } : null,
    winner: me?.winner === true ? "us" : opp?.winner === true ? "them" : null,
  };
}

// A game under way (Parth, 3 Oct: "the match is live and the score, if possible"): the team schedules are slow to move
// during play, so a game that has started and not finished is read from ESPN's own page for it (the summary), which
// carries the running score and clock. Unchanged when that fails.
const playing = (e, now, hours) => !e.completed && Date.parse(e.date) <= now && Date.parse(e.date) > now - hours * 36e5;
async function espnNow(path, e, teamId, shape) {
  const j = await getJSON(`${ESPN}/${path}/summary?event=${e.id}`, { timeout: 8000 }).catch(() => null);
  const c = j?.header?.competitions?.[0];
  return c ? { ...e, ...shape({ ...c, status: c.status || j.header?.status }, teamId) } : e;
}
const soccerNow = (c, teamId) => {
  const ev = espnEvent({ competitions: [c] }, teamId);
  return { state: ev.state, completed: ev.completed, detail: ev.detail, clock: ev.clock, score: ev.score, winner: ev.winner };
};

async function espnTeam(league, teamId) {
  const [fx, rs] = await Promise.all([
    getJSON(`${ESPN}/soccer/${league}/teams/${teamId}/schedule?fixture=true`),
    getJSON(`${ESPN}/soccer/${league}/teams/${teamId}/schedule`),
  ]);
  const now = Date.now();
  const sched = await Promise.all((fx.events || []).map(e => espnEvent(e, teamId)).map(e => (playing(e, now, 3) ? espnNow(`soccer/${league}`, e, teamId, soccerNow) : e)));
  const next = sched.filter(e => !e.completed && Date.parse(e.date) > now - 3 * 36e5).sort((a, b) => a.date.localeCompare(b.date));
  const done = [...sched.filter(e => e.completed), ...(rs.events || []).map(e => espnEvent(e, teamId)).filter(e => e.completed)]
    .filter((e, i, a) => a.findIndex(x => x.id === e.id) === i).sort((a, b) => b.date.localeCompare(a.date));
  if (!next.length && !done.length) throw new Error("espn empty");
  return { next: next.slice(0, 5), last: done[0] || null, form: done.slice(0, 5).map(e => (e.winner === "us" ? "W" : e.winner === "them" ? "L" : "D")) };
}

export async function football(params = new URLSearchParams()) {
  const club = config().follows.football_club;
  // ESPN, then football-data.org (from 3 Oct 2026, lib/footballdata.js; TheSportsDB was dropped on 25 Sep for an
  // incomplete schedule). ?via=fd asks for the backup alone, to check it.
  const fd = async () => { const { fdTeam } = await import("./footballdata.js"); return ok({ club: club.name, ...(await fdTeam(club.fd_id ?? 86)) }, "football-data.org"); };
  if (params.get?.("via") === "fd") return chain(fd);
  return chain(async () => ok({ club: club.name, ...(await espnTeam("all", club.espn_id)) }, "ESPN"), fd);
}

function espnStandings(j) {
  const groups = j.children?.length ? j.children : [j];
  return groups.map(g => ({
    name: g.name || g.abbreviation || null,
    rows: (g.standings?.entries || []).map(e => {
      const s = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.value ?? Number(x.displayValue)]));
      const sd = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.displayValue]));
      return { team: e.team?.displayName, short: e.team?.shortDisplayName, id: e.team?.id, abbr: e.team?.abbreviation,
        rank: s.rank ?? s.playoffSeed ?? null, played: s.gamesPlayed ?? null, points: s.points ?? null, gd: s.pointDifferential ?? null,
        wins: s.wins ?? null, draws: s.ties ?? null, losses: s.losses ?? null, pct: sd.winPercent ?? null, gb: sd.gamesBehind ?? null };
    }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  }));
}

export async function laliga_table(params = new URLSearchParams()) {
  const espn = async () => {
    const j = await getJSON("https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings");
    const g = espnStandings(j)[0];
    if (!g?.rows?.length) throw new Error("espn table empty");
    return ok({ rows: g.rows.map(r => ({ rank: r.rank, team: r.team, short: r.short, id: r.id, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, points: r.points, gd: r.gd })) }, "ESPN");
  };
  const fd = async () => { const { fdTable } = await import("./footballdata.js"); return ok({ rows: await fdTable("PD") }, "football-data.org"); };
  return params.get?.("via") === "fd" ? chain(fd) : chain(espn, fd);
}

// ESPN's game clock in a few characters: "Q3 4:12", "Half-time", "End of Q3", "OT 1:05"
export function nbaClock(S = {}) {
  const d = String(S.type?.shortDetail || S.type?.detail || ""), p = Number(S.period) || 0;
  if (/half/i.test(d)) return "Half-time";
  const q = n => (n > 4 ? (n > 5 ? `${n - 4}OT` : "OT") : `Q${n}`);
  const end = d.match(/end of (?:the )?(\d)/i); if (end) return `End of ${q(Number(end[1]))}`;
  if (p) return `${q(p)}${S.displayClock && S.displayClock !== "0.0" ? ` ${S.displayClock}` : ""}`;
  const m = d.match(/^([\d:.]+)\s*-\s*(\d)/); return m ? `${q(Number(m[2]))} ${m[1]}` : d || null;
}
export async function nba() {
  const t = config().follows.nba_team;
  return chain(async () => {
    const s = await getJSON(`${ESPN}/basketball/nba/teams/${t.espn_abbr}/schedule`);
    const [pre, reg] = await Promise.all([getJSON(`${ESPN}/basketball/nba/teams/${t.espn_abbr}/schedule?seasontype=1`).catch(() => ({ events: [] })), getJSON(`${ESPN}/basketball/nba/teams/${t.espn_abbr}/schedule?seasontype=2`).catch(() => ({ events: [] }))]);
    const now = Date.now();
    const evs = [...(pre.events || []), ...(s.events || []), ...(reg.events || [])];
    const byId = new Map(evs.map(e => [e.id, e]));
    const shape = comp => {
      const cs = comp.competitors || [];
      const me = cs.find(c => c.team?.abbreviation?.toLowerCase() === t.espn_abbr || c.team?.abbreviation === "GS" || c.team?.abbreviation === "GSW") || cs[0];
      const opp = cs.find(c => c !== me) || {};
      const S = comp.status || {}, st = S.type || {}, live = st.state === "in";
      return { opponent: opp.team?.displayName, opponent_abbr: opp.team?.abbreviation || null, home: me?.homeAway === "home", completed: !!st.completed, live,
        score: st.completed || live ? { us: score(me?.score), them: score(opp.score) } : null, clock: live ? nbaClock(S) : null,
        winner: me?.winner === true || me?.winner === "true" ? "us" : opp.winner === true || opp.winner === "true" ? "them" : null };
    };
    let all = [...byId.values()].map(e => ({ id: e.id, date: e.date, preseason: e.seasonType?.type === 1, ...shape(e.competitions?.[0] || {}) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    // a game under way: its running score from ESPN's page for it (a game runs about two and a half hours)
    all = await Promise.all(all.map(e => (playing(e, now, 4) ? espnNow("basketball/nba", e, null, shape) : e)));
    const regularPlayed = all.some(e => !e.preseason && e.completed);
    const next = all.filter(e => !e.completed && Date.parse(e.date) > now - 4 * 36e5).slice(0, 2);
    let last = all.filter(e => e.completed).at(-1) || null;
    // the last game's top scorer on each side, from ESPN's page for it (for the Sport app)
    if (last) {
      const sm = await getJSON(`${ESPN}/basketball/nba/summary?event=${last.id}`).catch(() => null);
      const top = (sm?.leaders || []).map(x => { const p = (x.leaders || []).find(c => c.name === "points")?.leaders?.[0]; return p ? { us: x.team?.abbreviation === "GS" || x.team?.abbreviation?.toLowerCase() === t.espn_abbr, name: p.athlete?.displayName, points: Number(p.displayValue) } : null; }).filter(x => x?.name && Number.isFinite(x.points));
      if (top.length === 2) last = { ...last, top_scorers: { us: top.find(x => x.us) || null, them: top.find(x => !x.us) || null } };
    }
    let west = null;
    if (regularPlayed) {
      const st = await getJSON("https://site.api.espn.com/apis/v2/sports/basketball/nba/standings").catch(() => null);
      const g = st && espnStandings(st).find(x => /west/i.test(x.name || ""));
      if (g) west = g.rows.slice(0, 15).map(r => ({ rank: r.rank, team: r.team, abbr: r.abbr, wins: r.wins, losses: r.losses, gb: r.gb }))
        .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses)).map((r, i) => ({ ...r, rank: r.rank ?? i + 1 }));
    }
    // the regular season's first game, for the Sport app's opening-night countdown
    const opener = regularPlayed ? null : all.find(e => !e.preseason && !e.completed) || null;
    return ok({ team: t.name, in_season: regularPlayed, next, last, west, opener }, "ESPN");
  });
}

export async function tennis() {
  return chain(async () => {
    const j = await getJSON(`${ESPN}/tennis/atp/scoreboard`);
    const events = (j.events || []).map(e => ({ name: e.name || e.shortName, start: e.date, end: e.endDate || null, venue: e.venue?.displayName || e.venue?.fullName || null, major: !!e.major }));
    if (!events.length) throw new Error("espn tennis empty");
    return ok({ events }, "ESPN");
  });
}

// ---------------------------------------------------------------- markets (Yahoo, server side only)
const tzDate = (sec, tz) => new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: tz || "UTC" });

export async function yahooChart(symbol, range = "3mo") {
  const hosts = ["query1", "query2"];
  let j, err;
  for (const h of hosts) {
    // Yahoo answers 429 to a full browser user-agent that carries no cookies; a plain one gets through.
    try { j = await getJSON(`https://${h}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`, { headers: { "user-agent": "Mozilla/5.0" } }); break; }
    catch (e) { err = e; }
  }
  if (!j) throw err;
  const r = j.chart?.result?.[0];
  if (!r?.meta || typeof r.meta.regularMarketPrice !== "number") throw new Error(`yahoo shape ${symbol}`);
  const tz = r.meta.exchangeTimezoneName;
  const closes = r.indicators?.quote?.[0]?.close || [];
  // Daily bars can be null. Never chart or average a null; drop them.
  const bars = (r.timestamp || []).map((t, i) => ({ d: tzDate(t, tz), c: closes[i] })).filter(b => typeof b.c === "number" && isFinite(b.c));
  const sessionDate = tzDate(r.meta.regularMarketTime, tz);
  const prevBar = [...bars].reverse().find(b => b.d < sessionDate);
  const price = r.meta.regularMarketPrice;
  const series = bars.filter(b => b.d < sessionDate).concat([{ d: sessionDate, c: price }]);
  let prev = prevBar?.c ?? null;
  // Futures roll to a new session at 18:00 New York time, so their daily bars lag a day.
  // For futures only, the 1-day chart's previousClose is the true last settlement.
  // (For indices that same field is unreliable, so the bar method above stays.)
  if (r.meta.instrumentType === "FUTURE") {
    try {
      const d = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1h`, { headers: { "user-agent": "Mozilla/5.0" } });
      const pc = d.chart?.result?.[0]?.meta?.previousClose;
      if (typeof pc === "number" && pc > 0) prev = pc;
    } catch {}
  }
  const note = rangeNote(bars.filter(b => b.d < sessionDate).concat([{ d: sessionDate, c: price }]), symbol);
  // 7-day and 1-month moves: today's price against the last close on or before the same calendar date 7 and 30 days
  // earlier (the exchange's own dates). A 30-day line for the board.
  const back = n => { const t = new Date(Date.parse(sessionDate + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10); return [...series].reverse().find(b => b.d <= t); };
  const b7 = back(7), b30 = back(30);
  const pctFrom = b => (b?.c ? Math.round(((price - b.c) / b.c) * 10000) / 100 : null);
  const cut30 = new Date(Date.parse(sessionDate + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
  const period = r.meta.currentTradingPeriod?.regular;
  const nowS = Date.now() / 1000;
  const live = !!period && nowS >= period.start && nowS <= period.end && nowS - r.meta.regularMarketTime < 20 * 60;
  return {
    symbol, price, prev, change_pct: prev ? ((price - prev) / prev) * 100 : null,
    session_date: sessionDate, market_time: new Date(r.meta.regularMarketTime * 1000).toISOString(),
    currency: r.meta.currency, live, instrument: r.meta.instrumentType || null, note,
    lo3m: bars.length ? Math.min(...bars.map(b => b.c), price) : null, hi3m: bars.length ? Math.max(...bars.map(b => b.c), price) : null,
    spark: series.map(b => Math.round(b.c * 100) / 100), spark_from: series[0]?.d, spark_to: series.at(-1)?.d,
    chg_7d: pctFrom(b7), from_7d: b7?.d || null, chg_1m: pctFrom(b30), from_1m: b30?.d || null,
    spark30: series.filter(b => b.d >= cut30).map(b => Math.round(b.c * 100) / 100),
  };
}

// "Lowest close since 24 Jun", "a 3-month high" and so on, from the closes themselves. Nothing is averaged.
const dayLabel = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep");
export function rangeNote(series, symbol) {
  if (series.length < 15) return null;
  const n = series.length - 1, cur = series[n].c;
  const inverse = symbol === "INR=X"; // a higher USD/INR is a weaker rupee
  const word = hi => (inverse ? (hi ? "Rupee at its weakest" : "Rupee at its strongest") : (hi ? "Highest close" : "Lowest close"));
  for (const hi of [true, false]) {
    let j = n - 1;
    while (j >= 0 && (hi ? series[j].c < cur : series[j].c > cur)) j--;
    if (j < 0) return inverse ? `${word(hi)} in 3 months` : `${hi ? "Highest" : "Lowest"} close in 3 months`;
    if (n - j >= 10) return `${word(hi)} since ${dayLabel(series[j].d)}`;
  }
  const max = Math.max(...series.map(b => b.c)), min = Math.min(...series.map(b => b.c));
  if (!inverse && cur >= max * 0.99) return "Within 1% of its 3-month high";
  if (!inverse && cur <= min * 1.01) return "Within 1% of its 3-month low";
  return null;
}

const RANGES = { "^INDIAVIX": [5, 90], "^VIX": [5, 90], "^BSESN": [40000, 150000], "^NSEI": [12000, 45000], "^NDX": [10000, 60000], "^NSEBANK": [25000, 120000], "INR=X": [70, 130], "BZ=F": [20, 250], "BTC-USD": [5000, 500000], "^GSPC": [2500, 15000], "^CNXIT": [10000, 90000], "^DJI": [20000, 100000], "^INDIAVIX": [5, 100], "^VIX": [5, 100] };
const inRange = q => { const r = RANGES[q.symbol]; return !r || (q.price >= r[0] && q.price <= r[1]); };

// Market mood as its publishers print it (config markets.mood): Tickertape's Market Mood Index for India and CNN's
// Fear & Greed Index for the US. Never our own calculation (Parth, 28 Sep). Each source is tried twice with
// different request identities; if both fail, this server's last good reading is served with its own time and
// marked stale, and the page falls back to the edition snapshot after that. A missing reading is never replaced
// by a different measure.
export const moodWordFor = (bands, score) => [...(bands || [])].sort((a, b) => b.from - a.from).find(b => score >= b.from)?.word || null;
const MOOD_LAST = {};
const round1 = v => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const MOOD_SOURCES = {
  async tickertape() {
    const j = await getJSON("https://api.tickertape.in/mmi/now", { timeout: 6000, headers: { "user-agent": BROWSER, origin: "https://www.tickertape.in", referer: "https://www.tickertape.in/" } });
    const d = j?.data;
    if (!j?.success || !Number.isFinite(d?.indicator)) throw new Error("tickertape: no reading");
    return { score: d.indicator, as_of: d.date || null, prev_day: d.lastDay?.indicator, prev_week: d.lastWeek?.indicator, prev_month: d.lastMonth?.indicator, prev_year: d.lastYear?.indicator };
  },
  async cnn() {
    const j = await getJSON("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", { timeout: 6000, headers: {
      "user-agent": BROWSER, accept: "application/json, text/plain, */*", "accept-language": "en-US,en;q=0.9",
      origin: "https://edition.cnn.com", referer: "https://edition.cnn.com/", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" } });
    const f = j?.fear_and_greed;
    if (!Number.isFinite(f?.score)) throw new Error("cnn: no reading");
    const hist = (j.fear_and_greed_historical?.data || []).slice(-30).map(p => Math.round(p.y));
    return { score: f.score, rating: f.rating || null, as_of: f.timestamp || null, prev_day: f.previous_close, prev_week: f.previous_1_week, prev_month: f.previous_1_month, prev_year: f.previous_1_year, spark30: hist.length > 5 ? hist : null };
  },
};
export async function marketMood(cfg = config().markets.mood || {}) {
  const out = {};
  await Promise.all(Object.entries(cfg).filter(([, m]) => m?.source && MOOD_SOURCES[m.source]).map(async ([k, m]) => {
    let r = null;
    for (let i = 0; i < 2 && !r; i++) { try { r = await MOOD_SOURCES[m.source](); } catch {} }
    if (r && r.score >= 0 && r.score <= 100) {
      const word = r.rating ? r.rating.replace(/^\w/, c => c.toUpperCase()) : moodWordFor(m.bands, r.score);
      out[k] = MOOD_LAST[k] = { score: Math.round(r.score), exact: round1(r.score), word, region: m.label, name: m.name, url: m.url, source: m.source, bands: m.bands,
        as_of: r.as_of, prev_day: round1(r.prev_day), prev_week: round1(r.prev_week), prev_month: round1(r.prev_month), prev_year: round1(r.prev_year), ...(r.spark30 ? { spark30: r.spark30 } : {}) };
    } else if (MOOD_LAST[k]) out[k] = { ...MOOD_LAST[k], stale: true };
    // The market's own fear gauge beside the index (config mood.<region>.vix: India VIX, CBOE VIX): level and the day's move.
    if (out[k] && m.vix?.yahoo) {
      try { const q = await yahooChart(m.vix.yahoo); if (inRange(q)) out[k].vix = { name: m.vix.name, value: round1(q.price), change_pct: round1(q.change_pct), session_date: q.session_date || null }; } catch {}
    }
  }));
  return out;
}

// 7-day and 1-month changes as a publisher prints them. Moneycontrol's price feed carries them for Indian
// indices (with the comparison dates; they agree with NSE's own figures) and for some global ones.
// Accepted only when the publisher's level agrees with ours, so a stale record never mixes with a fresh price.
export async function publishedReturns(key, price) {
  const kind = key.startsWith("in;") ? "inidicesindia" : "indicesglobal";
  const j = await getJSON(`https://priceapi.moneycontrol.com/pricefeed/notapplicable/${kind}/${encodeURIComponent(key)}`, { timeout: 8000, headers: { "user-agent": "Mozilla/5.0" } });
  const d = j?.data; if (!d) throw new Error(`moneycontrol ${key}: ${j?.message || "no data"}`);
  const level = Number(String(d.pricecurrent ?? "").replace(/,/g, ""));
  if (!(level > 0) || Math.abs(level - price) / price > 0.003) throw new Error(`moneycontrol ${key}: level ${level} vs ${price}`);
  const num = v => v == null || v === "" ? null : Number(v);
  const w = num(d.cl1wPerChange ?? d["1wk"]), m = num(d.cl1mPerChange ?? d["1mth"]);
  if (![w, m].every(v => v != null && Number.isFinite(v) && Math.abs(v) < 60)) throw new Error(`moneycontrol ${key}: range`);
  return { chg_7d: w, from_7d: d.cl1wDt || null, chg_1m: m, from_1m: d.cl1mDt || null, returns_source: "Moneycontrol" };
}
// NSE's own figures for its indices (Parth, 3 Oct: "NSE official source, we should use it instead of the Moneycontrol
// scrape"): nseindia.com/api/allIndices, keyless with a browser's headers, gives each index's level and its value a
// week, a month (30 days) and a year ago, with the dates. One call serves every NSE index in a refresh.
let NSE_ALL = null;
const nseAll = () => {
  if (NSE_ALL && Date.now() - NSE_ALL.at < 60e3) return NSE_ALL.p;
  const p = getJSON("https://www.nseindia.com/api/allIndices", { timeout: 8000, headers: { "user-agent": UA, referer: "https://www.nseindia.com/market-data/live-market-indices", accept: "application/json, text/plain, */*" } });
  NSE_ALL = { at: Date.now(), p }; p.catch(() => { NSE_ALL = null; });
  return p;
};
const nseDate = d => { const t = Date.parse(`${d} 12:00 UTC`); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
export function nseReturnsOf(row, price) {
  if (!row) throw new Error("nse: index not listed");
  const last = Number(row.last), w = Number(row.oneWeekAgoVal), m = Number(row.oneMonthAgoVal);
  if (!(last > 0) || Math.abs(last - price) / price > 0.005) throw new Error(`nse ${row.index}: level ${last} vs ${price}`);
  if (!(w > 0) || !(m > 0)) throw new Error(`nse ${row.index}: no week or month value`);
  const r = v => Math.round(v * 100) / 100, chg_7d = r((last / w - 1) * 100), chg_1m = r((last / m - 1) * 100);
  if (![chg_7d, chg_1m].every(v => Math.abs(v) < 60)) throw new Error(`nse ${row.index}: range`);
  return { chg_7d, from_7d: nseDate(row.oneWeekAgo), chg_1m, from_1m: nseDate(row.date30dAgo), returns_source: "NSE" };
}
async function nseReturns(name, price) { const j = await nseAll(); return nseReturnsOf((j?.data || []).find(x => x.index === name), price); }
// Published figures first (NSE for its own indices; Moneycontrol only where NSE does not publish: the Sensex, which is
// BSE's, and the S&P 500); our own sum from daily closes only when no publisher has them.
async function withReturns(q, key, nse) {
  if (nse) { try { return { ...q, ...(await nseReturns(nse, q.price)), returns_calc: false }; } catch {} }
  if (key) { try { const r = await publishedReturns(key, q.price); return { ...q, ...r, returns_calc: false }; } catch {} }
  return { ...q, returns_source: q.chg_7d != null ? "calculated from daily closes" : null, returns_calc: q.chg_7d != null };
}

export async function markets() {
  const cfg = config().markets;
  const moodP = marketMood(cfg.mood).catch(() => ({})); // in parallel with the prices
  const idx = await Promise.allSettled(cfg.indices.map(async i => {
    const q = await yahooChart(i.yahoo);
    if (!inRange(q)) throw new Error(`range ${i.yahoo}`);
    return withReturns({ name: i.name, ...q }, i.nse ? null : i.published, i.nse);
  }));
  const indices = idx.filter(r => r.status === "fulfilled").map(r => r.value);
  // The other assets and the two volatility indices, fetched together.
  const crossOut = await Promise.all(cfg.cross.filter(c => c.yahoo).map(async c => {
    try {
      let q;
      if (c.yahoo === "INR=X") q = (await fx()).value;
      else if (c.yahoo === "BTC-USD") q = (await cryptoPrice()).value;
      else { q = await withReturns(await yahooChart(c.yahoo), c.published); if (!inRange(q)) throw new Error("range"); delete q.spark; }
      return q ? { name: c.name, symbol: c.yahoo, price: q.price, prev: q.prev ?? null, change_pct: q.change_pct ?? null, session_date: q.session_date ?? null, note: q.note ?? null, lo3m: q.lo3m ?? null, hi3m: q.hi3m ?? null, spark30: q.spark30 ?? null, chg_7d: q.chg_7d ?? null, from_7d: q.from_7d ?? null, chg_1m: q.chg_1m ?? null, from_1m: q.from_1m ?? null, returns_source: q.returns_source ?? (q.chg_7d != null ? "calculated from daily closes" : null), returns_calc: q.returns_calc ?? q.chg_7d != null, source: q.source || "Yahoo Finance" } : null;
    } catch { return null; }
  }));
  const cross = crossOut.filter(Boolean);
  const mood = await moodP;
  if (!indices.length && !cross.length) return fail("no market data");
  return ok({ indices, cross, mood }, "Yahoo Finance");
}

export async function fx() {
  return chain(async () => {
    const q = await yahooChart("INR=X");
    if (!inRange(q)) throw new Error("fx range");
    delete q.spark;
    return ok({ ...q, source: "Yahoo Finance" }, "Yahoo Finance");
  }, async () => {
    const j = await getJSON("https://open.er-api.com/v6/latest/USD");
    const v = j.rates?.INR;
    if (!(v > 70 && v < 130)) throw new Error("er-api range");
    return ok({ symbol: "INR=X", price: v, change_pct: null, source: "ExchangeRate-API" }, "ExchangeRate-API", new Date(j.time_last_update_unix * 1000).toISOString());
  });
}

export async function cryptoPrice() {
  return chain(async () => {
    const q = await yahooChart("BTC-USD");
    if (!inRange(q)) throw new Error("btc range");
    delete q.spark;
    return ok({ ...q, source: "Yahoo Finance" }, "Yahoo Finance");
  }, async () => {
    const j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
    const v = j.bitcoin?.usd;
    if (!(v > 5000)) throw new Error("coingecko range");
    return ok({ symbol: "BTC-USD", price: v, change_pct: j.bitcoin.usd_24h_change ?? null, source: "CoinGecko" }, "CoinGecko");
  });
}

// ---------------------------------------------------------------- gold (IBJA, scraped)
export function parseIbja(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const pick = purity => {
    const re = new RegExp(`\\b${purity}\\b[^0-9₹]{0,60}(?:₹\\s*)?([0-9][0-9,]{3,8}(?:\\.[0-9]+)?)`, "g");
    for (const m of text.matchAll(re)) {
      let v = Number(m[1].replace(/,/g, ""));
      if (v > 50000 && v < 400000) v = v / 10; // per 10 g printed, normalise to per gram
      if (v > 5000 && v < 40000) return v;
    }
    return null;
  };
  const g24 = pick("999"), g22 = pick("916");
  if (!g24 || !g22) throw new Error("ibja parse");
  const ratio = g22 / g24;
  if (ratio < 0.88 || ratio > 0.95) throw new Error("ibja ratio");
  const date = (text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/) || [])[1] || null;
  const out = { per_gram_24k: g24, per_gram_22k: g22, per_10g_24k: Math.round(g24 * 10), per_10g_22k: Math.round(g22 * 10), rate_date: date };
  return { ...out, ...goldHistory(html, out.per_10g_24k, date) };
}

// IBJA's page carries its chart data (about 4 months of daily 999 rates per 10 g) in a hidden input.
// From it: the change on the previous rate, the change over a week and about a month, and the high and low of the period.
export function goldHistory(html, now, rateDate) {
  const m = html.match(/id="HdnGold"[^>]*value="([^"]*)"/) || html.match(/value="([^"]*)"[^>]*id="HdnGold"/);
  if (!m) return {};
  let j;
  try { j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); } catch { return {}; }
  const ymd = l => { const [d, mo, y] = String(l).split(/[\/-]/); return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; };
  const hist = (j.labels || []).map((l, i) => ({ d: ymd(l), c: Number(j.purity999?.[i]) })).filter(x => x.c > 50000 && x.c < 400000);
  if (hist.length < 10) return {};
  const today = rateDate ? ymd(rateDate) : hist.at(-1).d;
  const before = hist.filter(x => x.d < today);
  const prev = before.at(-1);
  const monthAgo = new Date(Date.parse(today + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
  const m1 = [...hist].reverse().find(x => x.d <= monthAgo);
  const weekAgo = new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
  const w1 = [...hist].reverse().find(x => x.d <= weekAgo);
  const all = [...hist.filter(x => x.d !== today), { d: today, c: now }];
  const hi = all.reduce((a, x) => (x.c >= a.c ? x : a)), lo = all.reduce((a, x) => (x.c <= a.c ? x : a));
  const chg = (a, b) => (b ? Math.round((a / b - 1) * 10000) / 100 : null);
  return {
    change_pct: chg(now, prev?.c), prev_10g: prev?.c ?? null, prev_date: prev?.d || null,
    change_1m_pct: chg(now, m1?.c), month_from: m1?.d || null,
    change_7d_pct: chg(now, w1?.c), week_from: w1?.d || null,
    hi: hi.c, hi_date: hi.d, lo: lo.c, lo_date: lo.d, range_from: hist[0].d,
    spark: all.slice(-66).map(x => x.c),
  };
}

export async function gold_in() {
  return chain(async () => ok(parseIbja(await getText("https://ibjarates.com/")), "IBJA"));
}

// ---------------------------------------------------------------- trends (Google Trends RSS)
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : null; };

export function parseTrendsRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
    term: tag(it, "title"), traffic: tag(it, "ht:approx_traffic"), published: tag(it, "pubDate"),
    news: [...it.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].map(([, n]) => ({ title: tag(n, "ht:news_item_title"), url: tag(n, "ht:news_item_url"), source: tag(n, "ht:news_item_source") })),
  })).filter(x => x.term);
}

// Google Trends (from 3 Oct 2026; Parth, after Kylo's "What people are searching"): Google's own "Trending now" list
// for the last 24 hours, the one trends.google.com/trending shows (69 terms for India on 3 Oct, each with its search
// volume and start, in Google's order), read the way that page reads it: an undocumented POST to its batchexecute
// endpoint (rpc i0OFE). The RSS feed (only the 10 newest terms, mostly small) is the backup for a country whose list
// fails. News for a term: the RSS's own when it lists the term, else Google's articles for it (rpc w4opAf), for the
// top ones. Each country says which served it.
const TN = "https://trends.google.com/_/TrendsUi/data/batchexecute";
async function trendsRpc(rpc, geo, args) {
  const r = await fetch(`${TN}?rpcids=${rpc}&source-path=%2Ftrending&hl=en-US&geo=${geo}`, {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": UA },
    body: "f.req=" + encodeURIComponent(JSON.stringify([[[rpc, JSON.stringify(args), null, "generic"]]])),
  });
  if (!r.ok) throw new Error(`${rpc} ${r.status}`);
  const line = (await r.text()).split("\n").find(l => l.startsWith('[["wrb.fr"'));
  const payload = line && JSON.parse(line)[0]?.[2];
  if (typeof payload !== "string") throw new Error(`${rpc}: no payload`);
  return JSON.parse(payload);
}
// 100000 -> "100K+", as Google prints it (the volume is the bottom of its bucket)
export const trafficLabel = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M+` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K+` : `${n}+`);
// One item of the i0OFE list: [0] term, [3][0] start (epoch s), [6] volume, [9] its searches, [11] news keys
export function parseTrendingItem(it) {
  if (!Array.isArray(it) || typeof it[0] !== "string" || !it[0].trim()) return null;
  const volume = typeof it[6] === "number" ? it[6] : 0;
  return { term: it[0].trim(), volume, traffic: trafficLabel(volume), started: Array.isArray(it[3]) && typeof it[3][0] === "number" ? new Date(it[3][0] * 1000).toISOString() : null,
    related: (Array.isArray(it[9]) ? it[9] : []).filter(q => typeof q === "string" && q.toLowerCase() !== it[0].trim().toLowerCase()).slice(0, 5), keys: Array.isArray(it[11]) ? it[11] : [] };
}
async function trendingGeo(g, top = 25, lookups = 12) {
  const [rss, list] = await Promise.all([
    getText(`https://trends.google.com/trending/rss?geo=${g}`).then(parseTrendsRss).catch(() => []),
    trendsRpc("i0OFE", g, [null, null, g, 0, "en-US", 24, 1]).then(p => (Array.isArray(p?.[1]) ? p[1] : []).map(parseTrendingItem).filter(Boolean)).catch(() => []),
  ]);
  if (!list.length) return rss.length ? { from: "rss", items: rss } : null;
  const byTerm = new Map(rss.map(t => [t.term.toLowerCase(), t.news]));
  const items = list.slice(0, top).map((t, i) => ({ ...t, rank: i + 1, news: byTerm.get(t.term.toLowerCase()) || [] }));
  let cursor = 0; const need = items.slice(0, lookups).filter(t => !t.news.length && t.keys.length);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < need.length) {
      const t = need[cursor++];
      try {
        const p = await trendsRpc("w4opAf", g, [t.keys.slice(0, 3), 3]);
        t.news = (Array.isArray(p?.[0]) ? p[0] : []).filter(a => Array.isArray(a) && /^https?:\/\//.test(a[1] || "")).map(a => ({ title: a[0], url: a[1], source: a[2] })).slice(0, 3);
      } catch {}
    }
  }));
  return { from: "list", items: items.map(({ keys, ...t }) => t) };
}
export async function trends(params) {
  const cfg = config().trends;
  const geos = [...new Set([cfg.india_geo, ...cfg.world_geos, ...(params.get("geos") || "").split(",").filter(g => /^[A-Z]{2}$/.test(g))])];
  const res = await Promise.all(geos.map(async g => [g, await trendingGeo(g).catch(() => null)]));
  const ok_ = res.filter(([, v]) => v?.items?.length);
  if (!ok_.length) return fail("trends unavailable");
  const by = Object.fromEntries(ok_.map(([g, v]) => [g, v.items])), from = Object.fromEntries(ok_.map(([g, v]) => [g, v.from]));
  return ok({ geos: by, from }, Object.values(from).every(f => f === "list") ? "Google Trends, trending now" : "Google Trends");
}

// ---------------------------------------------------------------- betting (Polymarket)
// Tag slugs as Polymarket actually uses them (checked 25 Sep 2026). "trump" is not excluded on its own:
// Iran and ceasefire markets carry it, and those are world news.
const EXCLUDE_TAGS = new Set([
  "us-politics", "us-presidential-election", "midterms", "senate-midterms", "senate-elections", "congress", "primaries", "us-election", "elections-us",
  "fed", "fed-rates", "fomc", "economic-policy",
  "nfl", "nba", "mlb", "nhl", "ncaa", "ncaab", "cfb", "wnba", "mls", "ufc", "super-bowl", "baseball",
  "esports", "counter-strike-2", "counter-strike", "league-of-legends", "dota-2", "valorant",
  "crypto", "crypto-prices", "hit-price", "multi-strikes", "pre-market", "fdv", "finance-updown",
  "weather", "climate-weather", "tweets-markets", "tweets", "mentions", "pop-culture", "celebrities", "music",
]);
const EXCLUDE_WORDS = /\b(biden|harris|vance|newsom|desantis|ocasio-cortez|senate|congress|house of representatives|governor|midterms?|democrat(ic|s)?|republican(s)?|gop|fed |fomc|federal reserve|powell|warsh|rate cuts?|rate hike|cpi|tariffs?|nfl|nba|mlb|nhl|ncaa|wnba|super bowl|world series|esports?|bitcoin|ethereum|solana|xrp|up or down|price of|temperature|highest temp|tweets?|# of posts|taylor swift|kardashian|kanye|engaged|pregnant|album)\b/i;
const seriesKey = t => String(t || "").toLowerCase().replace(/\s+(by|through|before|on|in)\b.*$/, "").replace(/[^a-z0-9 ]/g, "").trim();

export function filterBetting(events) {
  const seen = new Set();
  return events.filter(e => {
    const tags = (e.tags || []).map(t => (t.slug || "").toLowerCase());
    if (tags.some(t => EXCLUDE_TAGS.has(t))) return false;
    if (tags.includes("united-states") && tags.includes("politics")) return false;
    if (EXCLUDE_WORDS.test(e.title || "") || /more markets|o\/u|over\/under|visual aid/i.test(e.title || "")) return false;
    const k = seriesKey(e.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const parseArr = v => { try { return Array.isArray(v) ? v : JSON.parse(v || "[]"); } catch { return []; } };

export function shapePolymarket(e) {
  const open = (e.markets || []).filter(m => m.active !== false && m.closed !== true);
  // A match event carries side bets too (the toss, "completed match?", set winners, totals): only its "who wins"
  // market(s) count (one two-name market in tennis and cricket, three Yes/No markets for a football win-draw-win).
  const ml = open.filter(m => m.sportsMarketType === "moneyline"), mkts = ml.length ? ml : open;
  let outcomes;
  const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(, \d{4})?$/i;
  if (mkts.length > 1 && mkts.every(m => MONTH.test(m.groupItemTitle || "") && m.endDate)) {
    // Date ladder ("... by March 31?"): show the nearest deadlines in date order.
    // A rung closing within a day is all but settled (0% or 100%), so it does not lead; kept only if nothing is later.
    const live = mkts.filter(m => Date.parse(m.endDate) > Date.now()), later = live.filter(m => Date.parse(m.endDate) > Date.now() + 864e5);
    outcomes = (later.length ? later : live).sort((a, b) => a.endDate.localeCompare(b.endDate))
      .map(m => ({ name: `${/\bthrough\b/i.test(e.title) ? "Through" : "By"} ${m.groupItemTitle}`, prob: Number(parseArr(m.outcomePrices)[0]) * 100 })).filter(o => isFinite(o.prob)).slice(0, 3);
  } else if (mkts.length > 1) {
    // A runner whose book is one-sided or wide (no bid, or more than 5 cents between bid and ask) has a displayed price
    // that means nothing (seen 10 Oct: a 12% "favourite" with no bid and $5 traded); it is left out, as Kalshi's are.
    const priced = m => !("bestBid" in m || "bestAsk" in m) || (Number(m.bestBid) > 0 && Number(m.bestAsk) - Number(m.bestBid) <= 0.05);
    outcomes = mkts.filter(priced).map(m => ({ name: m.groupItemTitle || m.question, prob: Number(parseArr(m.outcomePrices)[0]) * 100 }))
      .filter(o => isFinite(o.prob)).sort((a, b) => b.prob - a.prob).slice(0, 3);
  } else if (mkts.length === 1) {
    const names = parseArr(mkts[0].outcomes), prices = parseArr(mkts[0].outcomePrices).map(Number);
    outcomes = names.map((n, i) => ({ name: n, prob: prices[i] * 100 })).filter(o => isFinite(o.prob));
    if (names[0] === "Yes") outcomes = outcomes.slice(0, 1);
  } else outcomes = [];
  return { id: `pm:${e.slug}`, title: e.title, category: (e.tags || []).find(t => !["all", "featured"].includes(t.slug))?.label || null,
    volume24h: Math.round(Number(e.volume24hr) || 0), end: e.endDate || null,
    outcomes: outcomes.map(o => ({ name: String(o.name).replace(/^Draw \(.*\)$/, "Draw"), prob: Math.round(o.prob * 10) / 10 })), source: "Polymarket", url: `https://polymarket.com/event/${e.slug}` };
}

// Market signals for the sections: what Polymarket says about the next race or match the paper follows (the F1
// race winner, Real Madrid's next match, India's next cricket match, the followed tennis players' next match).
// Everything is found from the live fixtures and the config's follows; nothing is named here.
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
async function taggedEvents(tags) {
  const lists = await Promise.all(tags.map(t => getJSON(`https://gamma-api.polymarket.com/events?tag_slug=${encodeURIComponent(t)}&active=true&closed=false&limit=300&order=volume24hr&ascending=false`, { timeout: 10000 }).catch(() => [])));
  const seen = new Set(), out = [];
  for (const e of lists.flat()) if (e?.slug && !seen.has(e.slug) && !e.closed) { seen.add(e.slug); out.push(e); }
  return out;
}
const signalOf = (e, extra = {}) => {
  const m = shapePolymarket(e);
  const outcomes = m.outcomes.map(o => ({ name: o.name.replace(/^Draw \(.*\)$/, "Draw"), prob: o.prob }));
  return { title: e.title, url: m.url, volume: Math.round(Number(e.volume) || 0), end: e.endDate || null, outcomes, ...extra };
};
export async function signals() {
  const C = config(), S = C.betting?.signals || {}, T = S.tags || {}, minVol = S.min_volume ?? 1000;
  return chain(async () => {
    const [f1, fb, f1ev, fbev, crev, tnev] = await Promise.all([
      f1_next().catch(() => null), football().catch(() => null),
      taggedEvents(T.f1 || ["f1"]), taggedEvents(T.football || ["soccer"]), taggedEvents(T.cricket || ["cricket"]), taggedEvents(T.tennis || ["tennis"]),
    ]);
    const out = {}, big = e => Number(e.volume || 0) >= minVol;
    // F1: the next race's winner market.
    const race = f1?.value?.race;
    if (race) {
      const name = norm(race.name);
      const e = f1ev.find(e => norm(e.title).includes(name) && /winner/i.test(e.title) && !/constructor|pole|podium|sprint|fastest/i.test(e.title) && big(e));
      if (e) out.paddock = signalOf(e, { label: `${race.name}: race winner` });
    }
    // Football: the club's next match (win, draw, win).
    const club = C.follows?.football_club?.name, nx = fb?.value?.next?.[0];
    if (club && nx?.opponent) {
      const a = norm(club), b = norm(nx.opponent).split(" ").filter(w => w.length > 3)[0] || norm(nx.opponent);
      const e = fbev.find(e => { const t = norm(e.title); return t.includes(a) && t.includes(b) && / vs /.test(t) && !/more markets/.test(norm(e.slug)) && big(e); });
      if (e) out.madrid = signalOf(e, { label: `${club} ${nx.home ? "v" : "at"} ${nx.opponent}` });
    }
    // Cricket: India's next match.
    const team = norm((C.follows?.cricket_team?.name || "India").split(" ")[0]);
    const cr = crev.filter(e => new RegExp(`(^| )${team} vs | vs ${team}( |$)`).test(norm(e.title).split(" : ").pop() || norm(e.title)) && Date.parse(e.endDate) > Date.now())
      .sort((x, y) => (x.slug.match(/\d{4}-\d\d-\d\d$/)?.[0] || x.endDate).localeCompare(y.slug.match(/\d{4}-\d\d-\d\d$/)?.[0] || y.endDate))
      .find(big);
    if (cr) out.crease = signalOf(cr, { label: cr.title.split(": ").pop() });
    // Tennis: the followed players' next match.
    for (const p of C.follows?.tennis_players || []) {
      const sur = norm(p).split(" ").pop();
      const e = tnev.filter(e => norm(e.title).includes(sur) && / vs /.test(norm(e.title)) && big(e)).sort((x, y) => String(x.endDate).localeCompare(String(y.endDate)))[0];
      if (e) { out.deuce = signalOf(e, { label: e.title }); break; }
    }
    return ok(out, "Polymarket");
  });
}

// The next market in the same line as `title` (e.g. next month's edition of a monthly question): open, ending more
// than 24 hours out, not already decided, soonest first. `similar` decides what counts as the same question.
export async function successor(title, similar, now = Date.now()) {
  const q = title.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{4}\b|\.\.\.|\?/gi, " ").replace(/\s+/g, " ").trim();
  const j = await getJSON(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}&limit_per_type=20&events_status=active`);
  const evs = (j.events || []).filter(e => similar(e.title || "", title) && !e.closed && (!e.endDate || Date.parse(e.endDate) > now + 864e5))
    .sort((a, b) => (Date.parse(a.endDate) || Infinity) - (Date.parse(b.endDate) || Infinity)).slice(0, 3);
  for (const ev of evs) {
    const m = shapePolymarket((await getJSON(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(ev.slug)}`))[0] || ev);
    if (m.outcomes.length && m.outcomes[0].prob < 99) return m;
  }
  return null;
}

export async function betting(params) {
  // ids: "pm:<polymarket slug>" (bare slugs are Polymarket, for older editions). Polymarket only: Kalshi was retired
  // on 25 Sep 2026, and any older "ks:" ids are ignored so those rows keep their press-time prices.
  const ids = (params.get("ids") || params.get("slugs") || "").split(",").map(s => (s.includes(":") ? s : `pm:${s}`))
    .filter(s => /^pm:[a-z0-9-]{3,200}$/.test(s)).slice(0, 14);
  return chain(async () => {
    if (ids.length) {
      const got = await Promise.all(ids.map(id =>
        getJSON(`https://gamma-api.polymarket.com/events?slug=${id.slice(3)}`).then(a => a[0] && { ...shapePolymarket(a[0]), id }).catch(() => null)));
      return ok({ markets: got.filter(Boolean) }, "Polymarket");
    }
    const j = await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=150");
    const kept = filterBetting(j).map(shapePolymarket).filter(m => m.outcomes.length).slice(0, 25);
    if (!kept.length) throw new Error("polymarket empty");
    return ok({ markets: kept }, "Polymarket");
  });
}

// ---------------------------------------------------------------- movers (India, Nifty 500)
// The daily run reads it to find the stocks and industries that moved hard in the last sessions, then researches why.
// The page prints only its breadth (The Ledger, from 30 Sep 2026). Nothing here names a company: the universe is NSE's own Nifty 500 list.
let N500 = null, N100 = null;
export function parseNifty500(csv) {
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head.split(",").map(x => x.trim().toLowerCase());
  const iN = cols.indexOf("company name"), iI = cols.indexOf("industry"), iS = cols.indexOf("symbol");
  if (iN < 0 || iS < 0) throw new Error("nifty500 columns");
  return rows.map(r => r.split(",")).filter(r => r[iS]).map(r => ({ name: r[iN].trim(), industry: (r[iI] || "").trim(), symbol: r[iS].trim() }));
}
// closes: { "SYM.NS": [{ d: "YYYY-MM-DD", c }] }. Sessions are aligned by date across the universe, so a stock
// with a missing day is not compared against the wrong session.
export function moverStats(list, closes, cfg, large = null) {
  const n = cfg.sessions || 2, count = {};
  for (const a of Object.values(closes)) for (const x of a) count[x.d] = (count[x.d] || 0) + 1;
  const days = Object.keys(count).filter(d => count[d] >= Object.keys(closes).length / 2).sort().reverse().slice(0, n);
  const out = [];
  for (const x of list) {
    const a = (closes[`${x.symbol}.NS`] || []).filter(p => Number.isFinite(p.c)).sort((p, q) => p.d.localeCompare(q.d));
    if (a.length < 2) continue;
    const sessions = days.map(d => {
      const i = a.findIndex(p => p.d === d);
      return i > 0 ? Math.round((a[i].c / a[i - 1].c - 1) * 10000) / 100 : null;
    });
    out.push({ ...x, price: a.at(-1).c, sessions });
  }
  const big = x => Math.max(...x.sessions.map(v => Math.abs(v ?? 0)));
  const stocks = out.filter(x => big(x) >= cfg.stock_pct).sort((a, b) => big(b) - big(a)).slice(0, 25);
  const by = {};
  for (const x of out) (by[x.industry] ||= []).push(x);
  const med = a => { const s = [...a].sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const industries = Object.entries(by).filter(([, a]) => a.length >= cfg.industry_min_stocks).map(([industry, a]) => ({
    industry, stocks: a.length, sessions: days.map((_, i) => Math.round(med(a.map(x => x.sessions[i]).filter(v => v != null)) * 100) / 100),
  })).filter(x => x.sessions.some(v => Math.abs(v) >= cfg.industry_pct));
  // Clusters: three or more stocks in one industry moving the same way by at least half the stock threshold in the
  // same session (a sector story hiding inside a flat industry average).
  const clusters = [];
  for (const [industry, a] of Object.entries(by)) for (let i = 0; i < days.length; i++) for (const sign of [1, -1]) {
    const hit = a.filter(x => sign * (x.sessions[i] ?? 0) >= cfg.stock_pct / 2).sort((p, q) => sign * (q.sessions[i] - p.sessions[i]));
    if (hit.length >= 3) clusters.push({ industry, session: days[i], direction: sign > 0 ? "up" : "down", stocks: hit.slice(0, 8).map(x => ({ name: x.name, symbol: x.symbol, pct: x.sessions[i] })) });
  }
  // Breadth for The Ledger (Parth, 30 Sep): the latest session only. How many of the Nifty 500 rose and fell; the five
  // biggest gainers and losers among the large companies (the Nifty 100, which holds the Nifty 50, when its list is
  // known); and the five strongest and weakest industries by their median move.
  const d0 = out.filter(x => Number.isFinite(x.sessions[0])), largeCos = large?.size ? d0.filter(x => large.has(x.symbol)) : d0;
  const byPct = [...largeCos].sort((a, b) => b.sessions[0] - a.sessions[0]), pick = x => ({ name: x.name, symbol: x.symbol, pct: x.sessions[0] });
  const inds = Object.entries(by).map(([industry, a]) => ({ industry, stocks: a.length, pct: Math.round(med(a.map(x => x.sessions[0]).filter(Number.isFinite)) * 100) / 100 }))
    .filter(x => x.stocks >= cfg.industry_min_stocks && Number.isFinite(x.pct)).sort((a, b) => b.pct - a.pct);
  const breadth = d0.length ? { day: days[0], up: d0.filter(x => x.sessions[0] > 0).length, down: d0.filter(x => x.sessions[0] < 0).length, flat: d0.filter(x => x.sessions[0] === 0).length,
    movers_from: large?.size ? "Nifty 100" : "Nifty 500", gainers: byPct.filter(x => x.sessions[0] >= 0.05).slice(0, 5).map(pick), losers: byPct.filter(x => x.sessions[0] <= -0.05).slice(-5).reverse().map(pick), best: inds.filter(x => x.pct >= 0.05).slice(0, 5), worst: inds.filter(x => x.pct <= -0.05).slice(-5).reverse() } : null;
  return { days, stocks, industries, clusters, universe: out.length, breadth };
}
export async function movers() {
  const cfg = config().markets.movers;
  return chain(async () => {
    // NSE's live list first; the copy in config/ (refresh with scripts/nifty500.mjs) if NSE refuses the request.
    if (!N500) {
      try { N500 = parseNifty500(await getText("https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv", { timeout: 10000, headers: { "user-agent": "Mozilla/5.0" } })); }
      catch { N500 = parseNifty500(readFileSync(join(process.cwd(), "config", "nifty500.csv"), "utf8")); }
    }
    // The Nifty 100 (the Nifty 50 and the next 50): breadth names its biggest movers from these large companies.
    if (!N100) {
      try { N100 = new Set(parseNifty500(await getText("https://nsearchives.nseindia.com/content/indices/ind_nifty100list.csv", { timeout: 8000, headers: { "user-agent": "Mozilla/5.0" } })).map(x => x.symbol)); }
      catch { try { N100 = new Set(parseNifty500(readFileSync(join(process.cwd(), "config", "nifty100.csv"), "utf8")).map(x => x.symbol)); } catch { N100 = new Set(); } }
    }
    const closes = {};
    const syms = N500.map(x => `${x.symbol}.NS`);
    const batches = []; for (let i = 0; i < syms.length; i += 20) batches.push(syms.slice(i, i + 20));
    await Promise.all(batches.map(async b => {
      try {
        const j = await getJSON(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${b.map(encodeURIComponent).join(",")}&range=5d&interval=1d`, { headers: { "user-agent": "Mozilla/5.0" }, timeout: 12000 });
        for (const r of j.spark?.result || []) {
          const q = r.response?.[0], ts = q?.timestamp || [], c = [...(q?.indicators?.quote?.[0]?.close || [])];
          // Yahoo's daily series often leaves the latest session's close empty for a third of the list; its own
          // last price (regularMarketPrice at regularMarketTime) is that session's close, or the live price while
          // the market is open. Without this, breadth and the movers check miss those stocks on the latest day.
          const m = q?.meta, day = t => new Date((t + 19800) * 1000).toISOString().slice(0, 10), last = ts.length - 1;
          if (last >= 0 && !Number.isFinite(c[last]) && Number.isFinite(m?.regularMarketPrice) && m?.regularMarketTime && day(m.regularMarketTime) === day(ts[last])) c[last] = m.regularMarketPrice;
          closes[r.symbol] = ts.map((t, i) => ({ d: day(t), c: c[i] }));
        }
      } catch {}
    }));
    const st = moverStats(N500, closes, cfg, N100);
    if (st.universe < 300) throw new Error(`movers: only ${st.universe} of ${N500.length} priced`);
    return ok({ ...st, thresholds: { stock_pct: cfg.stock_pct, industry_pct: cfg.industry_pct }, note: "sessions[i] is the % change on days[i] (IST); days[0] is the latest, live while the market is open" }, "NSE list, Yahoo Finance");
  });
}

// ---------------------------------------------------------------- registry
// ---------------------------------------------------------------- the next race's winner, as the markets price it
// For Paddock's race preview, printed at 14:00 (Parth, 1 Oct: not a live line): Kalshi's race-winner market (series
// KXF1RACE), matched to the next race by name, and Polymarket's when it has one. The run copies it into the edition.
export async function f1_market() {
  return chain(async () => {
    const race = (await f1_next())?.value?.race; if (!race) throw new Error("no next race");
    const key = norm(race.name).replace(/ in .*$/, "").replace(/\bgrand prix\b/, "").trim(); // "Bahrain Grand Prix in Malaysia": "bahrain"
    const out = { race: race.name, markets: [] };
    try {
      const ev = await getJSON("https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXF1RACE&status=open&limit=50", { timeout: 8000 });
      const e = (ev.events || []).find(x => norm(`${x.title} ${x.sub_title}`).includes(key));
      if (e) {
        const m = await getJSON(`https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=${encodeURIComponent(e.event_ticker)}&limit=60`, { timeout: 8000 });
        const mid = x => { const b = Number(x.yes_bid_dollars), a = Number(x.yes_ask_dollars), l = Number(x.last_price_dollars); return a > 0 && b >= 0 && a - b <= 0.05 ? (a + b) / 2 : l; };
        const outcomes = (m.markets || []).map(x => ({ name: x.yes_sub_title, prob: Math.round(mid(x) * 1000) / 10 })).filter(o => o.name && o.prob > 0).sort((a, b) => b.prob - a.prob).slice(0, 6);
        const vol = (m.markets || []).reduce((t, x) => t + Number(x.volume_fp || 0), 0);
        if (outcomes.length) out.markets.push({ source: "Kalshi", title: e.title, url: `https://kalshi.com/markets/kxf1race`, volume: Math.round(vol), outcomes });
      }
    } catch {}
    try {
      const pm = (await taggedEvents(["f1"])).find(e => norm(e.title).includes(key) && /winner/i.test(e.title) && !/constructor|pole|podium|sprint|fastest/i.test(e.title));
      if (pm) { const g = signalOf(pm); out.markets.push({ source: "Polymarket", title: pm.title, url: g.url, volume: g.volume, outcomes: g.outcomes.slice(0, 6) }); }
    } catch {}
    if (!out.markets.length) throw new Error(`no race-winner market for ${race.name}`);
    return ok(out, out.markets.map(m => m.source).join(", "));
  });
}

export const LIVE = { outlook, f1_market, weather, f1_next, f1_standings, f1_last, f1_sessions, football, laliga_table, nba, tennis, markets, fx, gold_in, trends, betting, crypto: cryptoPrice, movers, signals };

// Cache seconds per key: [s-maxage, stale-while-revalidate]
export const CACHE = {
  weather: [900, 3600], f1_next: [3600, 21600], f1_standings: [3600, 21600], f1_last: [3600, 21600], f1_sessions: [600, 1800], football: [1800, 7200],
  laliga_table: [3600, 21600], nba: [3600, 21600], tennis: [3600, 21600], markets: [300, 1800], fx: [900, 3600],
  outlook: [10800, 43200], f1_market: [1800, 7200], crypto: [300, 1800], gold_in: [3600, 21600], trends: [1800, 7200], betting: [1800, 7200], movers: [1800, 7200], signals: [1800, 7200],
};
