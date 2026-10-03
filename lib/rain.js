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

// ---- the budget (Parth, 3 Oct: "keep the 60,000 number in mind, as well as the 1,000 daily"; config weather.rain.budget)
const IST = ms => new Date(ms + 5.5 * 36e5);
// The financial year a moment falls in, April to March: "2026-27"
export const fyOf = (ms = Date.now()) => { const d = IST(ms), y = d.getUTCFullYear(), m = d.getUTCMonth(); const a = m >= 3 ? y : y - 1; return `${a}-${String(a + 1).slice(2)}`; };
// Seconds until the next reading slot, IST: every day_slot_min by day, every night_slot_min in the night hours. The CDN
// holds a reading until then, so however often the page asks, the gauges are read at most once a slot.
export function rainTtl(ms = Date.now(), B = config().weather?.rain?.budget || {}) {
  const d = IST(ms), mins = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60, [n0, n1] = B.night_hours || [0, 6];
  const night = d.getUTCHours() >= n0 && d.getUTCHours() < n1, slot = night ? B.night_slot_min || 120 : B.day_slot_min || 30;
  let next = (Math.floor(mins / slot) + 1) * slot;
  if (night && next > n1 * 60) next = n1 * 60; // the first day slot starts at the end of the night
  // read in a slot's last two minutes: hold it to the end of the next slot, so a boundary never costs two readings
  if (next - mins < 2) next += night && next < n1 * 60 ? slot : B.day_slot_min || 30;
  return Math.round((next - mins) * 60);
}
// The reading of the current slot, kept by the function: a second request in the same slot (another region's CDN, a
// link with a query string) gets it back instead of six more calls. With the CDN holding each reading to the slot's
// end, the gauges are read about once a slot: 39 times, 234 calls, a day.
let MEMO = null;

export async function rain() {
  try {
    const key = process.env.WU; if (!key) throw new Error("no WU key in the environment");
    const R = config().weather?.rain || {}, now = Date.now();
    if (MEMO && now < MEMO.until) return { ...MEMO.result, hold_s: Math.max(60, Math.round((MEMO.until - now) / 1000)) };
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
    const result = { ok: true, value, source: R.source || "Weather Union", as_of: new Date(now).toISOString(), stale: false }, hold = rainTtl(now);
    MEMO = { until: now + hold * 1000, result };
    return { ...result, hold_s: hold };
  } catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
}

export const RAIN = { rain };
// The CDN holds each reading until the next slot (api/live/[key].js asks rainTtl); this is only the fallback.
export const RAIN_CACHE = { rain: [1800, 60] };
