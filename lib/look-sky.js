// The trial's sky feeds, behind /api/live/look_*. Every key returns {ok, value, source, as_of, stale}.
// look_sky (the Sky Report's "rest of the day", /?trial, 27 Nov 2026): the next hours for Bengaluru, Ranchi and
// Prayagraj from Open-Meteo, grouped into the parts of the day in IST: tonight 21:00 to 06:00, morning 06:00 to 12:00,
// afternoon 12:00 to 17:00, evening 17:00 to 21:00. Each part carries the highest chance of rain in its hours, its
// coldest and warmest hour, and the sky most of its hours have. The first part is the one under way (only its hours
// from now on); five parts are sent so the page can drop one that ends while the feed is held at the edge.
// Backup: MET Norway's hourly forecast for a city Open-Meteo does not answer for. MET gives no chance of rain outside
// the Nordic area, so its parts carry rain: null and the millimetres it expects instead; the page then shows no bar.
import { config, getJSON } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });

export const PARTS = [
  { key: "tonight", label: "Tonight", from: 21, to: 6 },
  { key: "morning", label: "Morning", from: 6, to: 12 },
  { key: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { key: "evening", label: "Evening", from: 17, to: 21 },
];
export const partOf = h => (h >= 21 || h < 6 ? PARTS[0] : h < 12 ? PARTS[1] : h < 17 ? PARTS[2] : PARTS[3]);

const pad = n => String(n).padStart(2, "0");
// "2026-11-27T06:00" in IST for a moment, and back
export const istHour = ms => { const d = new Date(ms + 5.5 * 36e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`; };
export const istMs = local => Date.parse(local + ":00+05:30");
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

// The sky most of a part's hours have; when rain is likely (60% or more) and some hour has rain or a storm, the
// commonest wet sky (a storm wins a tie), so a wet afternoon is not drawn as a cloud.
export function partCode(hours, rain) {
  const codes = hours.map(h => h.code).filter(c => Number.isFinite(c));
  if (!codes.length) return null;
  const wet = codes.filter(c => c >= 51);
  const pool = rain != null && rain >= 60 && wet.length ? wet : codes;
  const n = {}; for (const c of pool) n[c] = (n[c] || 0) + 1;
  return Number(Object.keys(n).sort((a, b) => n[b] - n[a] || b - a)[0]);
}

// hours: [{time: "YYYY-MM-DDTHH:00" (IST), temp, rain_prob, code, rain_mm?}] in order. Returns up to `count` parts,
// starting with the one under way at `now`.
export function groupParts(hours, now = Date.now(), count = 5) {
  const startMs = istMs(istHour(now)), stop = startMs + 30 * 36e5;
  const ahead = (hours || []).filter(h => { const t = istMs(h.time); return t >= startMs && t < stop && Number.isFinite(h.temp) && h.temp > -60 && h.temp < 60; });
  const out = [];
  for (const h of ahead) {
    const hr = Number(h.time.slice(11, 13)), P = partOf(hr), day = h.time.slice(0, 10);
    // tonight belongs to the evening it starts on: 00:00 to 05:00 are the night of the day before
    const startDay = P.key === "tonight" && hr < 6 ? addDays(day, -1) : day;
    const id = `${P.key}:${startDay}`;
    let cur = out[out.length - 1];
    if (!cur || cur.id !== id) {
      const endDay = P.key === "tonight" ? addDays(startDay, 1) : startDay;
      cur = { id, key: P.key, label: P.label, from: `${pad(P.from)}:00`, to: `${pad(P.to)}:00`, start: `${startDay}T${pad(P.from)}:00:00+05:30`, end: `${endDay}T${pad(P.to)}:00:00+05:30`, first: h.time, hours: [] };
      out.push(cur);
    }
    cur.hours.push(h);
  }
  return out.slice(0, count).map(p => {
    const temps = p.hours.map(h => h.temp), probs = p.hours.map(h => h.rain_prob).filter(Number.isFinite), mm = p.hours.map(h => h.rain_mm).filter(Number.isFinite);
    const rain = probs.length ? Math.round(Math.max(...probs)) : null;
    return {
      key: p.key, label: p.label, from: p.from, to: p.to, start: p.start, end: p.end,
      // the part under way starts at this hour, not at its usual start
      partial: p.first !== p.start.slice(0, 16), first: `${p.first}:00+05:30`, hours: p.hours.length,
      rain, rain_mm: mm.length ? Math.round(mm.reduce((s, x) => s + x, 0) * 10) / 10 : null,
      tmin: Math.round(Math.min(...temps)), tmax: Math.round(Math.max(...temps)), code: partCode(p.hours, rain),
    };
  });
}

// Open-Meteo answers a list of points with a list (one point: one object)
export function parseOpenMeteo(j, cities, now = Date.now()) {
  const arr = Array.isArray(j) ? j : [j];
  if (arr.length !== cities.length) throw new Error("open-meteo count");
  return cities.map((c, i) => {
    const H = arr[i]?.hourly;
    if (!H?.time?.length || !Array.isArray(H.temperature_2m)) return null;
    const hours = H.time.map((t, k) => ({ time: t, temp: H.temperature_2m[k], rain_prob: H.precipitation_probability?.[k] ?? null, code: H.weather_code?.[k] ?? null }));
    const parts = groupParts(hours, now);
    return parts.length >= 4 ? { name: c.name, parts, source: "Open-Meteo" } : null;
  });
}

// MET Norway's symbol codes as WMO codes ("lightrainshowers_day" is a light shower, and so on)
const MET_CODE = { clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45, lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 80, heavyrainshowers: 81, drizzle: 53, lightsleet: 61, sleet: 63 };
export const metCode = s => { const k = String(s || "").replace(/_(day|night|polartwilight)$/, ""); return /thunder/.test(k) ? 95 : MET_CODE[k] ?? null; };
export function parseMetnoHours(j) {
  const ts = j?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) throw new Error("met.no shape");
  return ts.filter(x => x.data?.next_1_hours).map(x => ({
    time: istHour(Date.parse(x.time)), temp: x.data.instant?.details?.air_temperature, rain_prob: null,
    code: metCode(x.data.next_1_hours.summary?.symbol_code), rain_mm: x.data.next_1_hours.details?.precipitation_amount ?? null,
  }));
}

const CITIES = () => { const W = config().weather; return [...W.always, ...(W.family || [])].map(c => ({ name: c.name, lat: c.lat, lon: c.lon })); };

export async function lookSky(params, { fetchJSON = getJSON, now = Date.now() } = {}) {
  const cities = CITIES();
  let got = cities.map(() => null);
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cities.map(c => c.lat).join(",")}&longitude=${cities.map(c => c.lon).join(",")}` +
      `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=3&timezone=Asia%2FKolkata`;
    got = parseOpenMeteo(await fetchJSON(u, { timeout: 6000 }), cities, now);
  } catch {}
  // a city Open-Meteo did not answer for: MET Norway
  await Promise.all(cities.map(async (c, i) => {
    if (got[i]) return;
    try {
      const j = await fetchJSON(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c.lat}&lon=${c.lon}`, { timeout: 6000, headers: { "user-agent": config().weather.metno_user_agent } });
      const parts = groupParts(parseMetnoHours(j), now);
      if (parts.length >= 4) got[i] = { name: c.name, parts, source: "MET Norway" };
    } catch {}
  }));
  const list = got.filter(Boolean);
  if (!list.length) return fail("look_sky: no forecast");
  return ok({ cities: list }, [...new Set(list.map(c => c.source))].join(", "));
}

export const LOOK_SKY = { look_sky: lookSky };
// The hours change once an hour; held 30 minutes at the edge
export const LOOK_SKY_CACHE = { look_sky: [1800, 3600] };
