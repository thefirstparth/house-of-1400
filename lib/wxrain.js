// Measured rain for the four-city weather app, from Weather Union's gauges on the app's own key (Parth, 24 Oct 2026:
// "use a new key entirely", "go, hourly plus rain boost"). Separate from the paper's rain key (lib/rain.js, env WU).
// - Stations: config wxapp.wu.stations, per city, each [id, name, role]; Bengaluru's home station drives the card and
//   the office's adds "raining at work".
// - Budget, fixed forever (Parth: "make sure that we stay under the limit forever"): at most day_cap (150) calls an
//   IST day and fy_cap (54,900) a financial year, against Weather Union's 60,000 a profile a year (Terms, clause
//   3(vii)) and the dashboard's 1,000 a day. Every call is counted in the shared store (Upstash) before it is sent;
//   without the store no call is made at all.
// - Cadence: each station once an hour (base_min), always within budget (4 stations x 24 = 96); every boost_min
//   (15, the feed's own refresh) while its last reading had rain or the forecast says rain within the hour, from a
//   separate daily allowance (boost_cap, 54). When the boost is spent the station falls back to hourly until midnight.
// - Weather Union gives no reading time: a reading is as of its fetch. Outages come back as HTTP 200 with
//   "temporarily unavailable" and nulls; such a reading is kept as not ok.
import { config, getJSON } from "./live.js";
import { redis, usageStored } from "./gusage.js";
import { fyOf } from "./rain.js";

const URL_ = id => `https://www.weatherunion.com/gw/weather/external/v0/get_locality_weather_data?locality_id=${encodeURIComponent(id)}`;
const U = () => ({ env: "WU_KEY", day_cap: 150, fy_cap: 54900, base_min: 60, boost_min: 15, boost_cap: 54, fresh_min: 75, apply: false, stations: {}, ...(config().wxapp?.wu || {}) });
const dayOf = ms => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 10);

// Due for a reading? A minute's slack, so a feed refresh a few seconds early still reads.
export function due(st, now, boost, u = U()) {
  if (!st?.at) return true;
  return now - Date.parse(st.at) >= ((boost ? u.boost_min : u.base_min) - 1) * 6e4;
}
// Rain likely within the hour, from the city's forecast and nowcast (the assembled city)
export const rainSoon = c => Boolean(c?.nowcast) || (c?.hours || []).slice(0, 2).some(h => (h.p ?? 0) >= 50 || ["drizzle", "rain", "heavyrain", "storm"].includes(h.k));

// One counted call: reserve it in the store first (day, year, and the boost's own allowance), give it back if over
async function reserve(now, boost, u) {
  const d = dayOf(now), fy = fyOf(now), ks = [`wxwu:d:${d}`, `wxwu:fy:${fy}`, ...(boost ? [`wxwu:b:${d}`] : [])];
  const res = await redis([...ks.map(k => ["INCR", k]), ["EXPIRE", ks[0], String(3 * 86400)], ["EXPIRE", ks[1], String(400 * 86400)], ...(boost ? [["EXPIRE", ks[2], String(3 * 86400)]] : [])]);
  const [day, year, b] = res.map(r => Number(r?.result));
  if (day > u.day_cap || year > u.fy_cap || (boost && b > u.boost_cap)) { await redis(ks.map(k => ["DECR", k])).catch(() => null); return false; }
  return true;
}
export function parse(j) {
  const d = j?.locality_weather_data;
  const ok = String(j?.status) === "200" && d && d.rain_intensity != null && !/unavailable/i.test(j?.message || "");
  return ok ? { ok: true, type: j.device_type ?? null, intensity: Number(d.rain_intensity) || 0, today: Number(d.rain_accumulation) || 0, temp: d.temperature ?? null } : { ok: false, type: j?.device_type ?? null, message: j?.message || "no reading" };
}

// cities: the assembled cities (forecast, nowcast). Returns { [cityId]: [{id, name, role, ...reading}] } and reads the
// stations that are due, within budget. Never throws.
export async function wuReadings(cities, now = Date.now()) {
  const u = U(), key = process.env[u.env], out = {};
  const all = cities.flatMap(c => (u.stations[c.id] || []).map(([id, name, role]) => ({ city: c, id, name, role })));
  if (!all.length || !usageStored()) return out;
  let states = [];
  try { states = (await redis([["MGET", ...all.map(s => `wxwu:s:${s.id}`)]]))[0]?.result || []; } catch { return out; }
  await Promise.all(all.map(async (s, i) => {
    let st = null; try { st = states[i] ? JSON.parse(states[i]) : null; } catch { st = null; }
    const boost = Boolean(st?.ok && st.intensity > 0) || rainSoon(s.city);
    const want = key && (due(st, now, boost, u) || (boost && due(st, now, false, u)));
    if (want) {
      try {
        const asBoost = !due(st, now, false, u); // an hourly reading is never charged to the boost
        const lock = await redis([["SET", `wxwu:l:${s.id}`, "1", "NX", "EX", "50"]]);
        if (lock[0]?.result === "OK" && (await reserve(now, asBoost, u))) {
          let r;
          try { r = parse(await getJSON(URL_(s.id), { timeout: 8000, headers: { "x-zomato-api-key": key } })); } catch (e) { r = { ok: false, message: String(e?.message || e).slice(0, 80) }; }
          st = { ...r, at: new Date(now).toISOString(), boost: asBoost };
          await redis([["SET", `wxwu:s:${s.id}`, JSON.stringify(st), "EX", String(3 * 86400)]]).catch(() => null);
        }
      } catch { /* the store or the network failed: keep the last reading */ }
    }
    (out[s.city.id] ||= []).push({ id: s.id, name: s.name, role: s.role, ...(st || { ok: false, message: "not read yet" }) });
  }));
  return out;
}

// Weather Union reads rain in steps of 0.2 mm a minute (one tip of the gauge a minute is already 12 mm an hour), so
// IMD's words from the rate would call every shower heavy (24 Oct: both Bengaluru gauges at 0.2 and 0.4 in ordinary
// rain). Rain is rain; heavy only from 0.6 mm a minute (36 mm an hour) up.
const kindOf = mmMin => (mmMin >= 0.6 ? "heavyrain" : "rain");
// What a station says now, if its reading is fresh enough to say anything
export function summary(r, now = Date.now(), u = U()) {
  if (!r?.ok || !r.at || now - Date.parse(r.at) > u.fresh_min * 6e4) return null;
  const mmh = Math.round(r.intensity * 600) / 10;
  return { station: r.name, raining: mmh > 0, rate_mm_h: mmh, heavy: r.intensity >= 0.6, today_mm: Math.round(r.today * 10) / 10, at: r.at };
}
// The city's measured rain (rain_now), and, when config wxapp.wu.apply is on, the gauge over the forecast for now:
// raining at the home station makes it rain now whatever the forecast says; a dry gauge takes "rain now" away.
export function applyRain(city, rs, WORD, chipFor, now = Date.now(), u = U()) {
  if (!rs?.length) return city;
  const home = summary(rs.find(r => r.role === "home"), now, u), work = summary(rs.find(r => r.role === "work"), now, u);
  if (!home && !work) return city;
  city.rain_now = { ...(home || {}), work: work || null, src: "Live readings: Weather Union by Zomato" };
  if (!u.apply || !home) return city;
  const wetK = ["drizzle", "rain", "heavyrain", "storm"], day = city.now.day !== false;
  if (home.raining) {
    const k = city.now.k === "storm" ? "storm" : kindOf(home.rate_mm_h / 60);
    city.now = { ...city.now, k, word: WORD[k][day ? 0 : 1] };
    if (city.hours[0]) city.hours[0] = { ...city.hours[0], k, mm: Math.max(city.hours[0].mm || 0, home.rate_mm_h), p: 100 };
  } else if (wetK.includes(city.now.k)) {
    city.now = { ...city.now, k: "cloudy", word: WORD.cloudy[day ? 0 : 1] };
    if (city.hours[0]) city.hours[0] = { ...city.hours[0], k: "cloudy", p: Math.min(city.hours[0].p ?? 0, 30) };
  }
  city.chip = chipFor(city);
  return city;
}

// ?check=wu: the stations' last readings and today's counts; no calls
export async function wuCheck(now = Date.now()) {
  const u = U(), d = dayOf(now), fy = fyOf(now), ids = Object.values(u.stations).flat().map(s => s[0]);
  if (!usageStored()) return { stored: false, key_set: Boolean(process.env[u.env]) };
  const res = await redis([["MGET", `wxwu:d:${d}`, `wxwu:b:${d}`, `wxwu:fy:${fy}`], ["MGET", ...ids.map(i => `wxwu:s:${i}`)]]);
  const [cd, cb, cfy] = res[0]?.result || [], st = res[1]?.result || [];
  return { stored: true, key_set: Boolean(process.env[u.env]), apply: u.apply, today: Number(cd) || 0, boost_today: Number(cb) || 0, year: Number(cfy) || 0, caps: { day: u.day_cap, boost: u.boost_cap, year: u.fy_cap },
    stations: Object.entries(u.stations).flatMap(([city, ss]) => ss.map(([id, name, role]) => { const i = ids.indexOf(id); let s = null; try { s = st[i] ? JSON.parse(st[i]) : null; } catch { s = null; } return { city, id, name, role, ...(s || { read: false }) }; })) };
}
