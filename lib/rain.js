// Rain now and today at home, the office and central Bengaluru, from Weather Union's gauges (/api/live/rain; config
// weather.rain). Live readings, about a minute old, no timestamp of their own: the reading is as of when it was
// fetched. The key is the Vercel env var WU. A place is raining when any of its gauges reads rain now (Parth, 3 Oct:
// "I think the data is accurate"); its rate is the heaviest of them and its total today the wettest gauge's.
import { config, getJSON } from "./live.js";

const URL_ = id => `https://www.weatherunion.com/gw/weather/external/v0/get_locality_weather_data?locality_id=${encodeURIComponent(id)}`;

// mm in an hour, in the words the IMD uses for rain rates
export const rainWord = mmh => (mmh <= 0 ? "dry" : mmh < 2.5 ? "light" : mmh < 10 ? "moderate" : mmh < 50 ? "heavy" : "very heavy");

// gauges: [{id, name, ok, intensity (mm a minute), today (mm since midnight)}] for one place
export function placeOf(p, gauges) {
  const ok = gauges.filter(g => g.ok);
  if (!ok.length) return null;
  const mmh = Math.max(...ok.map(g => (Number(g.intensity) || 0) * 60)), today = Math.max(...ok.map(g => Number(g.today) || 0));
  const wet = ok.filter(g => (Number(g.intensity) || 0) > 0).map(g => g.name);
  return { id: p.id, name: p.name, area: p.area, raining: mmh > 0, rate_mm_h: Math.round(mmh * 10) / 10, word: rainWord(mmh), today_mm: Math.round(today * 10) / 10, wet_at: wet, gauges: ok.length, of: gauges.length };
}

export async function rain() {
  try {
    const key = process.env.WU; if (!key) throw new Error("no WU key in the environment");
    const R = config().weather?.rain || {};
    const places = await Promise.all((R.places || []).map(async p => {
      const gauges = await Promise.all(p.gauges.map(async ([id, name]) => {
        try {
          const j = await getJSON(URL_(id), { timeout: 8000, headers: { "x-zomato-api-key": key } });
          const d = j?.locality_weather_data;
          return d && String(j.status) === "200" && d.rain_intensity != null ? { id, name, ok: true, intensity: d.rain_intensity, today: d.rain_accumulation } : { id, name, ok: false };
        } catch { return { id, name, ok: false }; }
      }));
      return placeOf(p, gauges);
    }));
    const value = { places: places.filter(Boolean) };
    if (!value.places.length) throw new Error("no gauge answered");
    return { ok: true, value, source: R.source || "Weather Union", as_of: new Date().toISOString(), stale: false };
  } catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
}

export const RAIN = { rain };
// one refresh in 15 minutes at most, six calls each: 576 a day at the very most against the key's 1,000
export const RAIN_CACHE = { rain: [900, 60] };
