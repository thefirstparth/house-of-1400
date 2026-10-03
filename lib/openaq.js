// Air quality now, measured (Parth, 3 Oct: "OpenAQ, API key added to Vercel under the name OpenAQ"): OpenAQ v3, which
// carries CPCB's own continuous monitoring stations (CAAQMS), keyless to read for us only with the key. For each of the
// paper's cities, the stations within radius_km that measured PM2.5 in the last two hours, and their median. The
// page's air figure is the US AQI (Open-Meteo's CAMS model), so the measured PM2.5 is put on the same scale (the US EPA's
// 2024 breakpoints). Stations silent for hours (WAQI's copy of CPCB went quiet in June) are left out, and with none
// fresh the city has no measured figure.
import { config, getJSON } from "./live.js";

const OAQ = "https://api.openaq.org/v3";
const key = () => process.env.OpenAQ || process.env.OPENAQ || process.env.OPENAQ_KEY || "";
const get = path => { const k = key(); if (!k) throw new Error("no OpenAQ key in the environment"); return getJSON(`${OAQ}${path}`, { timeout: 10000, headers: { "X-API-Key": k } }); };

// US EPA AQI from PM2.5 (µg/m³, 24-hour breakpoints as revised in 2024)
const BP = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
export function usAqiPm25(c) {
  const x = Math.floor(Number(c) * 10) / 10; if (!Number.isFinite(x) || x < 0) return null;
  const b = BP.find(([lo, hi]) => x <= hi) || BP.at(-1);
  return Math.round(((b[3] - b[2]) / (b[1] - b[0])) * (Math.min(x, b[1]) - b[0]) + b[2]);
}
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function aqi_now(params = new URLSearchParams()) {
  try {
    const C = config(), cities = [...C.weather.always, ...(C.weather.family || [])], R = (C.weather.openaq?.radius_km ?? 20) * 1000, now = Date.now();
    const out = await Promise.all(cities.map(async c => {
      const L = await get(`/locations?coordinates=${c.lat},${c.lon}&radius=${Math.min(R, 25000)}&parameters_id=2&limit=50`);
      const locs = (L.results || []).filter(l => (l.sensors || []).some(s => s.parameter?.name === "pm25"));
      const read = await Promise.all(locs.slice(0, 12).map(async l => {
        try {
          const j = await get(`/locations/${l.id}/latest`);
          const pm = (j.results || []).find(r => (l.sensors || []).find(s => s.id === r.sensorsId)?.parameter?.name === "pm25");
          const at = pm?.datetime?.utc || null, age = at ? (now - Date.parse(at)) / 6e4 : null;
          return { name: l.name, provider: l.provider?.name || null, owner: l.owner?.name || null, pm25: pm?.value ?? null, at, age_min: age == null ? null : Math.round(age) };
        } catch { return { name: l.name, provider: l.provider?.name || null, pm25: null, at: null, age_min: null }; }
      }));
      const fresh = read.filter(r => r.pm25 != null && r.pm25 >= 0 && r.pm25 < 1000 && r.age_min != null && r.age_min <= 120);
      const pm = fresh.length ? Math.round(median(fresh.map(r => r.pm25)) * 10) / 10 : null;
      return { city: c.name, stations: read.length, fresh: fresh.length, pm25: pm, us_aqi: pm == null ? null : usAqiPm25(pm), latest: fresh.map(r => r.at).sort().pop() || null,
        ...(params.get?.("debug") ? { read } : {}) };
    }));
    if (!out.some(c => c.pm25 != null) && !params.get?.("debug")) throw new Error(`OpenAQ: no station measured PM2.5 in the last two hours (${out.map(c => `${c.city} ${c.fresh}/${c.stations}`).join(", ")})`);
    return { ok: true, value: { cities: out }, source: "OpenAQ (CPCB stations)", as_of: new Date().toISOString(), stale: false };
  } catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
}
export const OPENAQ = { aqi_now };
export const OPENAQ_CACHE = { aqi_now: [1800, 3600] };
