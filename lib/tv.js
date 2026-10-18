// The TV feed (/api/live/tv, from 18 Oct 2026; Parth, design B3): the lines on the TV launcher's home screen (the
// tv-vibehack repo). Sport: what is live, just finished or next among the things Parth follows, from the Sport app's own
// events() (public/sport/js/core.js) run here on the same feeds, so the TV and the app can never disagree. Weather: the
// paper's three cities, now, feels, today's high and low, and at most one word or warning each. The TV only draws it.
// Every setting is in config tv. Exact start times go out as they are; the TV words them in IST.
import { config, LIVE as PAPER } from "./live.js";
import { SPORTAPP } from "./sportapp.js";
import { CREASE } from "./crease-live.js";
import { TRIAL } from "./trial.js";
import { IMD } from "./imd.js";
import { readLatest } from "./edition-file.js";
import { blobConfigured, putJSON, readJSON } from "./blob.js";
import { events, using, liveOrder, short, last, gpShort, same, t } from "../public/sport/js/core.js";

const TZ = "Asia/Kolkata";
const istDay = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
const istHour = ms => Number(new Date(ms).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
const r0 = v => (Number.isFinite(v) ? Math.round(v) : null);
// no em-dashes in anything the TV prints
const clean = s => (s == null ? s : String(s).replace(/\s*[—–]\s*/g, ", ").trim());

// The feeds the Sport app reads for events(), by key, with what each is called in a failure message
const SPORT = {
  football: [PAPER.football, "Real Madrid fixtures (ESPN)"], madrid_hub: [SPORTAPP.madrid_hub, "Real Madrid season (ESPN)"],
  intl_hub: [SPORTAPP.intl_hub, "Brazil and Spain (ESPN)"], crease: [CREASE.crease, "India cricket (Cricbuzz, ESPNcricinfo)"],
  f1_next: [PAPER.f1_next, "F1 weekend (Jolpica, OpenF1)"], f1_sessions: [PAPER.f1_sessions, "F1 sessions (OpenF1, ESPN, Jolpica)"],
  tennis_players: [TRIAL.tennis_players, "Alcaraz and Djokovic (ESPN, Tennis Explorer)"], nba: [PAPER.nba, "Warriors (ESPN)"],
};
const OTHER = { f1_standings: "F1 driver codes (Jolpica)", open_meteo: "weather (Open-Meteo)", metno: "weather backup (MET Norway)", alerts: "weather warnings (Sachet)", nowcast: "Bengaluru nowcast (IMD)" };

// ------------------------------------------------------------------ the feeds, with the app's fallbacks
// A feed that fails falls back to this server's last good copy, then the edition's snapshot, each marked stale with its
// time, exactly as the app falls back to the phone's copy and the snapshot: events() then never calls a stale copy live
// for more than ten minutes (it says when it was last seen live instead).
const LAST = {};
const snapshotOf = k => { const s = readLatest()?.snapshot?.[k]; return s?.value ? { value: s.value, as_of: s.as_of, source: s.source } : null; };
const within = (ms, p) => { let id; return Promise.race([p, new Promise((_, no) => { id = setTimeout(() => no(new Error(`timed out after ${ms / 1000}s`)), ms); })]).finally(() => clearTimeout(id)); };
async function read(k, fn, health) {
  let r;
  try { r = await within(20000, fn(new URLSearchParams())); } catch (e) { r = { ok: false, error: String(e?.message || e) }; }
  health[k] = !!(r?.ok && r.value);
  if (health[k]) return (LAST[k] = { value: r.value, as_of: r.as_of, source: r.source, stale: false });
  const c = LAST[k] || snapshotOf(k);
  return c ? { ...c, stale: true } : null;
}

// ------------------------------------------------------------------ which events, in what order
// Live first (two at once: the app's own order, so the Warriors are always last); then what finished in the last
// results_hours after its end, and anything postponed, abandoned or lost from view in the last off_hours, newest first;
// then what is next, in time order (the app's order for a shared start), up to window_days ahead. max_items at most.
export function endOf(e, T) {
  const M = T.minutes || {};
  const mins = e.sp === "f1" ? e.mins || M.f1 : e.sp === "cricket" ? M[String(e.comp || "").match(/\b(T20|ODI|Test)/i)?.[1]?.toUpperCase()] || M.ODI : M[e.sp];
  return t(e.start) + (mins || 120) * 6e4;
}
export function pick(E, T, now) {
  const teams = T.national_teams || [];
  const keep = E.filter(e => e.sp !== "intl" || teams.some(n => same(e.a, n) || same(e.b, n)));
  const live = keep.filter(e => e.state === "live").sort(liveOrder);
  const recent = keep.filter(e => (e.state === "done" && (e.sp !== "f1" || e.top) && t(e.start) <= now && now - endOf(e, T) < T.results_hours * 36e5)
    || (e.state === "off" && (e.offWhy || e.seen) && Math.abs(now - t(e.start)) < T.off_hours * 36e5)).sort((a, b) => t(b.start) - t(a.start) || liveOrder(a, b));
  const next = keep.filter(e => e.state === "next" && t(e.start) - now <= T.window_days * 864e5 && (t(e.start) > now || e.late || e.starting || e.due || e.nolive))
    .sort((a, b) => t(a.start) - t(b.start) || liveOrder(a, b));
  return [...live, ...recent, ...next].slice(0, T.max_items);
}

// ------------------------------------------------------------------ one event as the TV needs it
// Fields with nothing to say are left out, never sent empty. a and b are the short form when the full name is long;
// a_short, b_short and comp_short are there when a shorter form exists, so the TV can step down instead of cutting.
const fullComp = (comp, cfg) => { const M = cfg.follows?.sport_app_short_names || {}; return Object.keys(M).find(k => M[k] === comp) || comp; };
const testDay = e => Number(String(e.status || "").match(/\bDay (\d)\b/i)?.[1]) || null;
export function item(e, ctx) {
  const { cfg, T, codes, f1city } = ctx, o = { sp: e.sp, state: e.state, start: new Date(t(e.start)).toISOString() };
  const put = (k, v) => { if (v != null && v !== false && v !== "" && !(Array.isArray(v) && !v.length)) o[k] = typeof v === "string" ? clean(v) : v; };
  if (e.sp === "f1") {
    put("gp", e.gp ? gpShort(e.gp) : null); put("session", e.session);
    put("city", f1city && e.gp && same(e.gp, f1city.gp) ? f1city.city : e.heldIn || null);
    const top = e.state === "live" ? e.liveTop : e.state === "done" ? e.top : null;
    if (top?.length >= 3) put("top", top.slice(0, 3).map(n => codes[n] || codes[last(n)] || last(n)));
    put("provisional", e.state === "done" && e.provisional);
  } else {
    // NBA sides by their nickname ("Lakers v Warriors"): the city is the long part (config tv.nba_two_word_nicknames)
    const nick = n => (T.nba_two_word_nicknames || []).find(x => String(n).endsWith(" " + x)) || String(n).split(" ").at(-1);
    const side = n => (e.sp === "tennis" ? last(n) : n), shortOf = n => (e.sp === "tennis" ? null : e.sp === "nba" ? nick(n) : short(n));
    for (const [k, n] of [["a", e.a], ["b", e.b]]) {
      if (!n) continue;
      const full = side(n), sh = shortOf(n);
      put(k, full.length > T.long_name && sh ? sh : full);
      if (sh && sh !== o[k]) put(k + "_short", sh);
    }
    if (e.state === "live" || e.state === "done") {
      if (e.sp === "cricket") { put("sa", e.sa ? `${e.sa}${e.oa ? ` (${e.oa} ov)` : ""}` : null); put("sb", e.sb ? `${e.sb}${e.ob ? ` (${e.ob} ov)` : ""}` : null); }
      else if (e.sp !== "tennis") { put("sa", e.sa != null ? String(e.sa) : null); put("sb", e.sb != null ? String(e.sb) : null); }
    }
  }
  const comp = e.sp === "cricket" ? e.comp : fullComp(e.comp, cfg);
  put("comp", comp);
  if (e.comp && e.comp !== comp) put("comp_short", e.comp);
  if (e.state === "live") {
    const ht = e.sp === "football" && /^(HT|half[- ]?time)$/i.test(String(e.clock || "").trim());
    put("pause", ht ? "HT" : e.pause);
    if (!ht && (e.sp === "football" || e.sp === "nba")) put("clock", e.clock);
    if (e.sp === "cricket" && /TEST/i.test(e.comp || "")) put("clock", testDay(e) ? `Day ${testDay(e)}` : null);
  }
  if (e.state === "done") {
    if (e.sp === "cricket") put("result", String(e.status || "").replace(/ \(.*\)$/, ""));
    if (e.sp === "tennis" && e.won) put("result", `${last(e.won === "a" ? e.a : e.b)} won`);
  }
  put("tbc", e.tbc); put("late", e.late); put("starting", e.starting);
  if (e.state === "off") { put("offWhy", e.offWhy); put("seen", e.seen ? new Date(t(e.seen)).toISOString() : null); }
  return o;
}

// ------------------------------------------------------------------ weather
// Open-Meteo (the paper's weather key, with its measured "now") first; per city MET Norway's Locationforecast when it
// fails; then this server's last good copy if it is from today and under weather_last_good_hours; otherwise the city
// is left out (the others stay).
export function dayOf(d) {
  if (!d) return null;
  return { max: d.max ?? null, min: d.min ?? null, rain_mm: d.rain_mm ?? null, rain_prob: d.rain_prob ?? null, code: d.code ?? null, feels_max: d.feels_max ?? null };
}
const fromOpenMeteo = w => ({ now: w.current?.temp, feels: w.current?.feels, today: dayOf(w.daily?.[0]), tomorrow: dayOf(w.daily?.[1]), source: "Open-Meteo" });
// MET Norway: hourly for about two and a half days, then six-hourly. A day's high and low only when its hours cover
// at least 18 of the 24 (so not for today once the morning has gone: the day's real low may already be past).
// symbol_code "thunder" stands for WMO 95, "fog" for 45. Feels-like is MET's own (apparent_air_temperature). MET gives
// no chance of rain outside the Nordic area, so "Rain likely" and "Storms likely" cannot come from it.
export function parseMetno(j, now) {
  const ts = j?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) throw new Error("met.no shape");
  const first = ts[0]?.data?.instant?.details?.air_temperature;
  if (!Number.isFinite(first) || first < -60 || first > 60) throw new Error("met.no range");
  const days = {};
  for (const x of ts) {
    const at = Date.parse(x.time), d = istDay(at), n1 = x.data?.next_1_hours, I = x.data?.instant?.details || {}, T = I.air_temperature;
    if (!n1) continue; // past the hourly part: daily figures from hourly steps only
    const D = (days[d] ||= { temps: [], feels: [], hours: 0, rain_mm: 0, rain_prob: null, thunder: false, fog: false });
    D.hours++;
    if (Number.isFinite(T)) D.temps.push(T);
    if (Number.isFinite(I.apparent_air_temperature)) D.feels.push(I.apparent_air_temperature);
    if (Number.isFinite(n1.details?.precipitation_amount)) D.rain_mm += n1.details.precipitation_amount;
    if (Number.isFinite(n1.details?.probability_of_precipitation)) D.rain_prob = Math.max(D.rain_prob ?? 0, n1.details.probability_of_precipitation);
    if (/thunder/.test(n1.summary?.symbol_code || "")) D.thunder = true;
    if (/fog/.test(n1.summary?.symbol_code || "")) D.fog = true;
  }
  const day = k => {
    const D = days[k]; if (!D) return null;
    const full = D.hours >= 18;
    return { max: full ? Math.max(...D.temps) : null, min: full ? Math.min(...D.temps) : null, rain_mm: Math.round(D.rain_mm * 10) / 10, rain_prob: D.rain_prob, code: D.thunder ? 95 : D.fog ? 45 : null, feels_max: full && D.feels.length === D.hours ? Math.max(...D.feels) : null, partial: !full };
  };
  const feels = ts[0]?.data?.instant?.details?.apparent_air_temperature;
  return { now: first, feels: Number.isFinite(feels) ? feels : null, today: day(istDay(now)), tomorrow: day(istDay(now + 864e5)), source: "MET Norway" };
}
async function metno(c, T, now) {
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${c.lat}&lon=${c.lon}`, { headers: { "user-agent": T.metno_user_agent, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`met.no ${r.status}`);
  return parseMetno(await r.json(), now);
}
// The word: first rule whose every figure holds (a figure the day lacks fails the rule)
export function weatherWord(day, rules) {
  if (!day) return null;
  const has = v => v != null && Number.isFinite(v);
  const holds = r => (r.rain_mm == null || (has(day.rain_mm) && day.rain_mm >= r.rain_mm)) && (r.rain_prob == null || (has(day.rain_prob) && day.rain_prob >= r.rain_prob))
    && (r.max == null || (has(day.max) && day.max >= r.max)) && (r.feels_max == null || (has(day.feels_max) && day.feels_max >= r.feels_max))
    && (r.min_at_most == null || (has(day.min) && day.min <= r.min_at_most)) && (r.codes == null || (has(day.code) && r.codes.includes(day.code)));
  return rules.find(holds)?.word || null;
}
// A warning beats the forecast's word: Sachet's for every city, IMD's nowcast where config tv.nowcast_cities says (from
// moderate up, nowcast_min_level: the site already leaves light rain out of Sachet's warnings)
const strip = s => String(s || "").replace(/^(a|an) /i, "").replace(/,.*$/, "");
export function warningFor(city, alerts, nowcast, T) {
  const a = alerts?.by_city?.[city];
  if (a?.colour) { const lvl = a.colour[0].toUpperCase() + a.colour.slice(1).toLowerCase(); return { word: `${lvl} alert${a.type ? ` · ${String(a.type).toLowerCase()}` : ""}`, word_short: `${lvl} alert` }; }
  const n = (T.nowcast_cities || []).includes(city) ? (nowcast?.cities || []).find(c => c.city === city)?.warning : null;
  if (n?.what?.length && n.level >= (T.nowcast_min_level || 2)) return { word: `IMD warning · ${strip(n.what[0])}`, word_short: "IMD warning" };
  return null;
}
const LASTWX = {};
export function cityLine(c, w, warn, T, now) {
  const evening = istHour(now) >= T.evening_from;
  const fw = weatherWord(evening ? w.tomorrow : w.today, T.weather_words);
  const o = { city: c.name };
  for (const [k, v] of [["now", r0(w.now)], ["feels", r0(w.feels)], ["hi", r0(w.today?.max)], ["lo", r0(w.today?.min)]]) if (v != null) o[k] = v;
  if (warn) Object.assign(o, warn, { warn: true });
  else if (fw) o.word = evening ? `${fw} tomorrow` : fw;
  o.source = w.source;
  if (w.as_of) o.as_of = w.as_of;
  return o;
}
async function weather(T, health, now) {
  const C = config().weather, cities = [...C.always, ...(C.family || [])];
  const [om, al, nc] = await Promise.all([
    within(20000, PAPER.weather(new URLSearchParams())).catch(e => ({ ok: false, error: String(e) })),
    within(15000, TRIAL.alerts()).catch(() => ({ ok: false })),
    within(15000, IMD.nowcast()).catch(() => ({ ok: false })),
  ]);
  health.alerts = !!al.ok; health.nowcast = !!nc.ok;
  const omCities = om.ok ? om.value.cities || [] : [];
  health.open_meteo = cities.every(c => omCities.some(x => x.name === c.name));
  const out = [];
  for (const c of cities) {
    const o = omCities.find(x => x.name === c.name);
    let w = o && Number.isFinite(o.current?.temp) ? fromOpenMeteo(o) : null;
    if (!w) {
      try { w = await metno(c, T, now); health.metno = true; } catch { health.metno = false; }
    }
    if (w) LASTWX[c.name] = { ...w, at: now };
    else {
      const L = LASTWX[c.name];
      if (L && istDay(L.at) === istDay(now) && now - L.at < T.weather_last_good_hours * 36e5) w = { ...L, as_of: new Date(L.at).toISOString() };
    }
    if (!w) continue;
    out.push(cityLine(c, w, warningFor(c.name, al.ok ? al.value : null, nc.ok ? nc.value : null, T), T, now));
  }
  return out;
}

// ------------------------------------------------------------------ a source down for a day: one Telegram message
// When any source feeding this key has failed for alert_after_hours, one message; one more when it is back. At most one
// message a day per source (a recovery on the day of its failure message waits until the next day). The state is one
// small file in Blob, read once a call; nothing is sent without Blob or Telegram set up.
const STATE = "notify/tv-sources.json";
async function readState() {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: STATE, limit: 1 });
  return blobs[0] ? (await readJSON(blobs[0]).catch(() => null)) || {} : {};
}
export function track(S, health, T, now, names) {
  const msgs = [], day = istDay(now);
  let changed = false;
  const when = ms => new Date(ms).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  for (const [k, ok] of Object.entries(health)) {
    const s = S[k];
    if (!ok) {
      if (!s) { S[k] = { since: now }; changed = true; continue; }
      if (!s.alerted && now - s.since > T.alert_after_hours * 36e5 && s.day !== day) {
        msgs.push(`⚠️ <b>TV feed</b>: ${names[k] || k} has not answered since ${when(s.since)} IST. The TV leaves its lines out, or shows the last copy with its time.`);
        Object.assign(s, { alerted: true, day }); changed = true;
      }
    } else if (s) {
      if (s.alerted && s.day === day) continue; // the recovery message waits for tomorrow
      if (s.alerted) msgs.push(`✅ <b>TV feed</b>: ${names[k] || k} is answering again.`);
      delete S[k]; changed = true;
    }
  }
  return { msgs, changed };
}
async function watch(health, T, now) {
  if (!blobConfigured() || !process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    const S = await readState();
    const names = { ...Object.fromEntries(Object.entries(SPORT).map(([k, v]) => [k, v[1]])), ...OTHER };
    const { msgs, changed } = track(S, health, T, now, names);
    if (changed) await putJSON(STATE, S);
    if (msgs.length) { const { send } = await import("../api/notify.js"); for (const m of msgs) await send(m); }
  } catch {}
}

// ------------------------------------------------------------------ the key
export async function tv() {
  const cfg = config(), T = cfg.tv, now = Date.now(), health = {};
  const [feeds, wx] = await Promise.all([
    Promise.all(Object.entries(SPORT).map(async ([k, [fn]]) => [k, await read(k, fn, health)])),
    weather(T, health, now),
  ]);
  const data = Object.fromEntries(feeds.filter(([, v]) => v));
  const ctx0 = { data, cfg, now };
  const chosen = using(ctx0, () => pick(events(true), T, now));
  // F1 three-letter codes only when an F1 line has a top three to print
  let codes = {};
  if (chosen.some(e => e.sp === "f1" && (e.liveTop || e.top))) {
    const st = await read("f1_standings", PAPER.f1_standings, health);
    for (const d of st?.value?.drivers || []) if (d.code) { codes[d.name] = d.code; codes[last(d.name)] = d.code; }
  }
  const race = data.f1_next?.value?.race, f1city = race?.locality ? { gp: race.name.replace(/ in .*$/, ""), city: race.locality } : null;
  const sport = using(ctx0, () => chosen.map(e => item(e, { cfg, T, codes, f1city })));
  await watch(health, T, now);
  const used = [...new Set([...Object.values(data).map(d => d.source), ...wx.map(w => w.source)].filter(Boolean))];
  return { ok: true, value: { sport, weather: wx }, source: used.join(", "), as_of: new Date(now).toISOString(), stale: Object.values(data).some(d => d.stale) };
}

export const TV = { tv };
// Held 5 minutes; a minute while anything is live or starts within 15 minutes (api/live/[key].js). The stale window lets
// the TV's one request get an answer at once while the CDN refreshes behind it.
export const TV_CACHE = { tv: [300, 900] };
