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
import { blobConfigured, putJSON, readPath } from "./blob.js";
import { events, using, liveOrder, short, last, gpShort, same, t } from "../public/sport/js/core.js";
import { minuteOf, headlinesOf, moneyOf, windowsOf, contextOf, resultsOf, weekOf, standingsOf, tennisLine, cricketWords, editionAge } from "./tv-saver.js";

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
const OTHER = { f1_standings: "F1 standings (Jolpica)", open_meteo: "weather (Open-Meteo)", metno: "weather backup (MET Norway)", alerts: "weather warnings (Sachet)", nowcast: "Bengaluru nowcast (IMD)",
  // the screensaver's (saver=1)
  laliga_table: "La Liga table (ESPN)", f1_last: "last Grand Prix (Jolpica)", tennis_hub: "ATP rankings (Tennis Explorer, ESPN)", edition: "the day's edition (under 36 hours old)",
  google_news: "headlines (Google News)", the_hindu: "headlines backup (The Hindu)", markets: "markets (Yahoo Finance and its backups)", yahoo: "markets (Yahoo Finance)",
  twelvedata: "USD/INR backup (Twelve Data)", gold_in: "gold (IBJA and Goodreturns)", ibja: "gold (IBJA)", goodreturns: "gold backup (Goodreturns)" };
// the screensaver's extra feeds, read only for saver=1
const MORE = { laliga_table: PAPER.laliga_table, f1_last: PAPER.f1_last, f1_standings: PAPER.f1_standings, tennis_hub: SPORTAPP.tennis_hub };

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
// The side Parth follows (config follows), sport by sport so that India's football side is never the cricket team:
// "a" or "b" when exactly one side is followed, so the TV can light it; nothing when both are, or neither, or for F1.
const cricketSide = F => (F.cricket_team?.name || "India").replace(/\s*\(.*\)$/, "").replace(/\s+men$/i, "");
export function oursOf(e, cfg) {
  const F = cfg.follows || {};
  const names = { football: [F.football_club?.name], intl: F.national_teams, cricket: [cricketSide(F)], nba: [F.nba_team?.name], tennis: F.tennis_players }[e.sp];
  if (!names || !e.a || !e.b) return null;
  const mine = n => names.some(x => x && same(n, x)), a = mine(e.a), b = mine(e.b);
  return a === b ? null : a ? "a" : "b";
}
export function item(e, ctx) {
  const { cfg, T, codes, f1city } = ctx, o = { sp: e.sp, state: e.state, start: new Date(t(e.start)).toISOString() };
  const put = (k, v) => { if (v != null && v !== false && v !== "" && !(Array.isArray(v) && !v.length)) o[k] = typeof v === "string" ? clean(v) : v; };
  if (e.sp === "f1") {
    // the TV's own shorter names for the long ones (tv.gp_short): its THEN/LATER rows drop a competition that does not
    // fit, and F1 has no other short form, so "United States GP" left a bare "Race" (Parth, 25 Oct)
    const gp = e.gp ? gpShort(e.gp) : null;
    put("gp", gp && T.gp_short?.[gp] || gp); put("session", e.session);
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
    put("ours", oursOf(e, cfg));
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
// The paper's weather key: Open-Meteo (with its measured "now"), and per city MET Norway's Locationforecast when
// Open-Meteo does not answer (both in lib/live.js, shared with the paper); then this server's last good copy if it is
// from today and under weather_last_good_hours; otherwise the city is left out (the others stay).
export { parseMetno } from "./live.js";
export function dayOf(d) {
  if (!d) return null;
  return { max: d.max ?? null, min: d.min ?? null, rain_mm: d.rain_mm ?? null, rain_prob: d.rain_prob ?? null, code: d.code ?? null, feels_max: d.feels_max ?? null };
}
const fromOpenMeteo = w => ({ now: w.current?.temp, feels: w.current?.feels, hum: w.current?.humidity, code: w.current?.code ?? null, today: dayOf(w.daily?.[0]), tomorrow: dayOf(w.daily?.[1]), hours: w.hourly || null, source: w.source || "Open-Meteo" });
// The rest of today (Parth, 19 Oct: "looking at my TV and seeing fog at 2 pm in Prayagraj is not accurate"): the day's
// word comes from the hours still ahead, from this hour to evening_from, not from the whole day's summary, whose code is
// the day's most significant weather (5 am's fog made it "Fog" until 6 pm). Highest temperature and feels-like, total
// rain, the highest chance of rain and the most significant code of those hours; no low (the night is tomorrow's, after
// evening_from). Null without hours for today (MET Norway's backup: its "today" already starts at the present hour).
export function restOfDay(hours, now, endHour) {
  const day = istDay(now), from = istHour(now);
  const H = (hours || []).filter(h => String(h.time).slice(0, 10) === day && Number(String(h.time).slice(11, 13)) >= from && Number(String(h.time).slice(11, 13)) < endHour);
  if (!H.length) return null;
  const nums = k => H.map(h => h[k]).filter(v => v != null && Number.isFinite(v));
  const max = k => (nums(k).length ? Math.max(...nums(k)) : null);
  return { max: max("temp"), min: null, feels_max: max("feels"), rain_mm: nums("rain_mm").length ? Math.round(nums("rain_mm").reduce((a, b) => a + b, 0) * 10) / 10 : null, rain_prob: max("rain_prob"), code: max("code") };
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
// The sky right now, for the TV's background light (Horizon v3: clouds, fog, rain, a storm), from Open-Meteo's measured
// current weather code. Nothing when the code is missing (MET Norway's backup has none): the TV then draws a clear sky.
export function skyOf(code) {
  if (!Number.isFinite(code)) return null;
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code >= 3) return "overcast";
  return code === 2 ? "partly" : "clear";
}
const LASTWX = {};
export function cityLine(c, w, warn, T, now) {
  const evening = istHour(now) >= T.evening_from;
  const fw = weatherWord(evening ? w.tomorrow : (restOfDay(w.hours, now, T.evening_from) || w.today), T.weather_words);
  const o = { city: c.name };
  for (const [k, v] of [["now", r0(w.now)], ["feels", r0(w.feels)], ["hum", r0(w.hum)], ["hi", r0(w.today?.max)], ["lo", r0(w.today?.min)]]) if (v != null) o[k] = v;
  if (warn) Object.assign(o, warn, { warn: true });
  else if (fw) o.word = evening ? `${fw} tomorrow` : fw;
  const sky = skyOf(w.code);
  if (sky) o.sky = sky;
  o.source = w.source;
  if (w.as_of) o.as_of = w.as_of;
  return o;
}
async function weather(T, health, now) {
  const C = config().weather, cities = [...C.always, ...(C.family || [])];
  const [om, al, nc] = await Promise.all([
    within(25000, PAPER.weather(new URLSearchParams("hourly=all"))).catch(e => ({ ok: false, error: String(e) })),
    within(15000, TRIAL.alerts()).catch(() => ({ ok: false })),
    within(15000, IMD.nowcast()).catch(() => ({ ok: false })),
  ]);
  health.alerts = !!al.ok; health.nowcast = !!nc.ok;
  const got = om.ok ? om.value.cities || [] : [];
  health.open_meteo = cities.every(c => got.some(x => x.name === c.name && (x.source || "Open-Meteo") === "Open-Meteo"));
  if (!health.open_meteo) health.metno = cities.every(c => got.some(x => x.name === c.name));
  const out = [];
  for (const c of cities) {
    const o = got.find(x => x.name === c.name);
    let w = o && Number.isFinite(o.current?.temp) ? fromOpenMeteo(o) : null;
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
// small file in Blob; nothing is sent without Blob or Telegram set up.
// Blob use (Parth, 20 Oct 2026: the month's Blob operations nearly gone in two days, from a list, a read and often a
// write on every refresh of the TV's lines): the state lives in this server's memory, is read from Blob at most once an
// hour, by its path with no list, and is written only when a message goes out, or at most once an hour when a failure
// starts or ends, so another server picks it up.
const STATE = "notify/tv-sources.json", HOUR = 6 * 36e5; // re-read every six hours (23 Oct 2026: Blob reads)
let MEM = null;
async function readState(now) {
  if (MEM && (now - MEM.read < HOUR || MEM.dirty)) return MEM.S; // (a change not yet written is never read over)
  const S = (await readPath(STATE).catch(() => null)) || MEM?.S || {};
  MEM = { S, read: now, wrote: MEM?.wrote || 0, dirty: false };
  return S;
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
    const S = await readState(now);
    const names = { ...Object.fromEntries(Object.entries(SPORT).map(([k, v]) => [k, v[1]])), ...OTHER };
    const { msgs, changed } = track(S, health, T, now, names);
    if (changed) MEM.dirty = true;
    if (MEM.dirty && (msgs.length || now - MEM.wrote >= HOUR)) { await putJSON(STATE, S); Object.assign(MEM, { wrote: now, dirty: false }); }
    if (msgs.length) { const { send } = await import("../api/notify.js"); for (const m of msgs) await send(m); }
  } catch {}
}

// ------------------------------------------------------------------ the screensaver's parts (saver=1)
// Headlines when the edition is over 36 hours old: the paper's own reading list (the wire key, config sources.feeds),
// one feed at a time in config tv.saver.headlines order (Google News India's top stories, then The Hindu)
async function headlines(S, health) {
  for (const h of S.headlines) {
    let r;
    try { r = await within(12000, TRIAL.wire(new URLSearchParams({ feeds: h.feed, from: new Date(Date.now() - 36 * 36e5).toISOString() }))); } catch (e) { r = { ok: false }; }
    const out = r?.ok ? headlinesOf(r.value.items, h.label, S.headline_count) : null;
    health[h.health] = !!out;
    if (out) return out;
  }
  return null;
}
// Money's sources for the alert: Yahoo for every market row; a backup only when it was needed (it answered, or the row
// fell to the next one); a row with no figure at all
function moneyHealth(m, mk, gold, health) {
  const rows = m?.rows || [], src = n => rows.find(r => r.name === n)?.source;
  health.markets = !!mk?.value && !mk.stale;
  health.gold_in = !!gold?.value && !gold.stale;
  if (!health.markets) return;
  const fx = src("USD / INR");
  health.yahoo = rows.filter(r => r.kind !== "gold").every(r => r.source === "Yahoo Finance");
  if (fx === "Twelve Data") health.twelvedata = true; else if (fx && fx !== "Yahoo Finance") health.twelvedata = false;
  const g = src(config().tv.saver.money.rows.find(r => r.gold)?.label);
  if (health.gold_in) { health.ibja = g === "IBJA"; if (g === "Goodreturns") health.goodreturns = true; }
  else health.goodreturns = false;
}
async function saverParts(ctx0, E, chosen, ctx, health, now) {
  const data = ctx0.data;
  const { cfg, T } = ctx, S = T.saver;
  // Today: the day in a minute (or headlines), Money
  const latest = readLatest(), fresh = editionAge(latest, now) <= S.edition_max_hours;
  health.edition = fresh;
  const [minute, mk, gold] = await Promise.all([
    fresh ? minuteOf(latest, cfg, now) : headlines(S, health),
    read("markets", PAPER.markets, {}),
    read("gold_in", PAPER.gold_in, {}),
  ]);
  const money = moneyOf(mk, gold, cfg, now);
  moneyHealth(money, mk, gold, health);
  // the rest is plain code on the feeds in hand, run with the server's feeds and config (core.js helpers read them)
  return using(ctx0, () => sportParts(data, E, chosen, ctx, now, { ...(minute ? { minute } : {}), ...(money ? { money } : {}) }));
}
function sportParts(data, E, chosen, ctx, now, today) {
  const { cfg, T } = ctx, S = T.saver;
  // Sport: the headline (as the home screen's first line; the latest result when nothing is coming), the week, the
  // results and the standings; and when Sport mode is on
  const results = resultsOf(E, data, now, S);
  const head = chosen[0] || results[0] || null;
  const it = e => {
    const codes = { ...ctx.codes, ...(e.codes || {}) }, o = item(e, { ...ctx, codes });
    if (e.state === "done" && e.sp === "cricket" && cricketWords(e.status)) o.result = cricketWords(e.status);
    if (e.state === "done" && e.sp === "tennis") Object.assign(o, tennisLine(e) || {});
    return o;
  };
  const sport_more = {
    ...(head ? { headline: { ...it(head), ...(contextOf(head, data, cfg) ? { context: contextOf(head, data, cfg) } : {}) } } : {}),
    week: weekOf(E, head, T, now).map(it),
    results: results.map(it),
    standings: standingsOf(data, cfg, now),
  };
  return { ...today, sport_more, ...windowsOf(E.filter(e => e.sp !== "intl" || (T.national_teams || []).some(n => same(e.a, n) || same(e.b, n))), T, now, endOf) };
}

// ------------------------------------------------------------------ the key
// /api/live/tv: the home screen's lines. ?saver=1 adds the screensaver's (minute, money, sport_more, sport_mode and
// sport_windows), so the plain call stays small.
export async function tv(params = new URLSearchParams()) {
  const cfg = config(), T = cfg.tv, now = Date.now(), health = {}, saver = params.get?.("saver") === "1";
  const keys = { ...Object.fromEntries(Object.entries(SPORT).map(([k, [fn]]) => [k, fn])), ...(saver ? MORE : {}) };
  const [feeds, wx] = await Promise.all([
    Promise.all(Object.entries(keys).map(async ([k, fn]) => [k, await read(k, fn, health)])),
    weather(T, health, now),
  ]);
  const data = Object.fromEntries(feeds.filter(([, v]) => v));
  const ctx0 = { data, cfg, now };
  const E = using(ctx0, () => events(true));
  const chosen = pick(E, T, now);
  // F1 three-letter codes only when an F1 line has a top three to print (the screensaver reads the standings anyway)
  let codes = {};
  if (saver || chosen.some(e => e.sp === "f1" && (e.liveTop || e.top))) {
    const st = data.f1_standings || await read("f1_standings", PAPER.f1_standings, health);
    for (const d of st?.value?.drivers || []) if (d.code) { codes[d.name] = d.code; codes[last(d.name)] = d.code; }
  }
  const race = data.f1_next?.value?.race, f1city = race?.locality ? { gp: race.name.replace(/ in .*$/, ""), city: race.locality } : null;
  const ctx = { cfg, T, codes, f1city };
  const sport = using(ctx0, () => chosen.map(e => item(e, ctx)));
  const more = saver ? await saverParts(ctx0, E, chosen, ctx, health, now) : {};
  await watch(health, T, now);
  const used = [...new Set([...Object.values(data).map(d => d.source), ...wx.map(w => w.source)].filter(Boolean))];
  return { ok: true, value: { sport, weather: wx, ...more }, source: used.join(", "), as_of: new Date(now).toISOString(), stale: Object.values(data).some(d => d.stale) };
}

export const TV = { tv };
// Held 5 minutes; a minute while anything is live or starts within 15 minutes (api/live/[key].js). The stale window (six
// hours, from 18 Oct 2026; was 15 minutes) lets the TV's request get an answer at once while the CDN refreshes behind
// it: a fresh call takes about five seconds, the TV waits five. The TV shows a copy over 20 minutes old (by its as_of)
// as a saved copy with its time, and the Today app asks again a minute later.
export const TV_CACHE = { tv: [300, 21600] };
