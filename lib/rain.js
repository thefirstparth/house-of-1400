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

// ---- the budget (Parth, 3 Oct: "stay under 60,000 per financial year, even for the next financial year ... decided
// forever"; config weather.rain.budget). Worked out from the caps, never set by hand.
const IST = ms => new Date(ms + 5.5 * 36e5);
// The financial year a moment falls in, April to March: "2026-27"
export const fyOf = (ms = Date.now()) => { const d = IST(ms), y = d.getUTCFullYear(), m = d.getUTCMonth(); const a = m >= 3 ? y : y - 1; return `${a}-${String(a + 1).slice(2)}`; };
// gauges: how many a reading calls. Returns {perDay, reads, slot (minutes), window [from, to] IST hours, perYear}
export function rainPlan(gauges, B = config().weather?.rain?.budget || {}) {
  const [w0, w1] = B.window || [6, 24], cap = B.fy_cap ?? 60000, reserve = B.reserve ?? 3000;
  const perDay = Math.min(B.day_cap ?? 1000, Math.floor((cap - reserve) / 366));
  const reads = Math.max(1, Math.floor((perDay - gauges) / gauges)); // one reading a day is the 14:00 snapshot's
  const slot = Math.ceil(((w1 - w0) * 60) / reads);
  return { perDay, reads, slot, window: [w0, w1], perYear: (reads + 1) * gauges * 366 };
}
const gaugeCount = () => (config().weather?.rain?.places || []).reduce((t, p) => t + p.gauges.length, 0);
const minsIST = ms => { const d = IST(ms); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; };
export const inWindow = (ms = Date.now(), plan = rainPlan(gaugeCount())) => { const m = minsIST(ms); return m >= plan.window[0] * 60 && m < plan.window[1] * 60; };
// Seconds the CDN holds a reading: to the start of the next slot (slots run from the window's start, every plan.slot
// minutes); outside the window, to the window's next start. A reading in a slot's last two minutes covers the next slot
// too, so a boundary never costs two readings.
export function rainTtl(ms = Date.now(), plan = rainPlan(gaugeCount())) {
  const m = minsIST(ms), [w0, w1] = plan.window.map(h => h * 60);
  if (m < w0) return Math.round((w0 - m) * 60);
  if (m >= w1) return Math.round((24 * 60 - m + w0) * 60);
  let next = w0 + (Math.floor((m - w0) / plan.slot) + 1) * plan.slot;
  if (next - m < 2) next += plan.slot;
  if (next >= w1) next = 24 * 60 + w0; // the day's last slot runs to the window's next start
  return Math.round((next - m) * 60);
}

// The reading of the current slot, kept by the function: a second request in the same slot (another region's CDN, a
// link with a query string) gets it back instead of more calls. With the CDN holding each reading to the slot's end,
// the gauges are read about once a slot (rainPlan: 24 readings, 144 calls a day with 6 gauges).
let MEMO = null;

export async function rain() {
  try {
    const key = process.env.WU; if (!key) throw new Error("no WU key in the environment");
    const R = config().weather?.rain || {}, now = Date.now();
    if (MEMO && now < MEMO.until) return { ...MEMO.result, hold_s: Math.max(60, Math.round((MEMO.until - now) / 1000)) };
    // no readings outside the window (overnight): the page shows none, and no call is made
    if (!inWindow(now)) throw new Error("outside Weather Union's reading hours");
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
