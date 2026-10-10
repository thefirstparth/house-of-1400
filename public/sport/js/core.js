// Sport V2, the data core: the feeds, what Parth follows, and every followed event in one shape with its live state.
// Rules from the paper: a figure shows only from its source, with its time; a feed that fails falls back to the last
// copy this phone saw, then the day's edition snapshot, marked with its time; otherwise the block is left out.
// Live state comes from a live source (ESPN's scoreboards), never from a schedule plus a length: a session that starts
// late or runs long stays live (10 Oct 2026: qualifying ran past its calendar slot and the app called it over).
export const TZ = "Asia/Kolkata";
export const KEYS = ["football", "madrid_hub", "club_stats", "intl_hub", "f1_next", "f1_sessions", "f1_standings", "f1_last", "f1_market", "f1_hub", "odds", "crease", "tennis_players", "tennis", "tennis_hub", "nba"];
export const D = {}; // key -> { value, as_of, source, stale }
export const S = { cfg: null, snap: null, lastLoad: 0, loading: false, route: "home", UI: { day: null, match: null, table: "liga", leaders: "goals", f1table: "drivers", f1mkt: "race" } };

// ------------------------------------------------------------------ small helpers
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const t = iso => (iso ? Date.parse(iso) : NaN);
// date formatters are built once (building one per call made a redraw take 180ms on a phone)
const FMT = new Map();
const fmtr = (loc, o) => { const k = loc + JSON.stringify(o); let f = FMT.get(k); if (!f) FMT.set(k, (f = new Intl.DateTimeFormat(loc, { timeZone: TZ, ...o }))); return f; };
export const fmt = (iso, o = {}) => fmtr("en-GB", o).format(new Date(iso));
export const dayKey = ms => fmtr("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
export const hm = iso => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
export function dayLabel(iso) {
  const k = dayKey(t(iso)), now = Date.now();
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now + 864e5)) return "Tomorrow";
  if (k === dayKey(now - 864e5)) return "Yesterday";
  return longDate(iso);
}
export const when = iso => `${dayLabel(iso)}, ${hm(iso)}`;
// dates in one style everywhere ("10 Oct", "Sat 10 Oct"; never "Sept")
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = iso => { const [y, m, d] = dayKey(t(iso)).split("-").map(Number); return { y, m, d }; };
export const shortDate = iso => { const p = parts(iso); return `${p.d} ${MON[p.m - 1]}`; };
export const longDate = iso => `${fmt(iso, { weekday: "short" })} ${shortDate(iso)}`;
export const span = (a, b) => (shortDate(a) === shortDate(b) ? shortDate(a) : `${shortDate(a)} to ${shortDate(b)}`);
// "in 42 min", "in 3h 10m", "in 5 days" (whole IST calendar days, as the date beside it reads), "12 min ago"
export function rel(iso) {
  const m = Math.round((t(iso) - Date.now()) / 6e4), a = Math.abs(m);
  const days = Math.abs(Date.parse(dayKey(t(iso))) - Date.parse(dayKey(Date.now()))) / 864e5;
  const txt = a < 60 ? `${a} min` : a < 24 * 60 ? `${Math.floor(a / 60)}h${a % 60 && a < 600 ? ` ${a % 60}m` : ""}` : `${days} day${days === 1 ? "" : "s"}`;
  return a < 1 ? "now" : m > 0 ? `in ${txt}` : `${txt} ago`;
}
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(cf|fc|club de futbol|sad)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Two names for the same side: equal, or one is the other with words added ("Golden State" / "Golden State Warriors").
// Whole words only, so "Real Madrid" is never "Atlético Madrid" and "India" never "West Indies".
export const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)); };
// A surname: the last word, except "Vinícius Júnior" is "Vinícius"; particles stay with it ("de Jong", "Van Dijk")
export const last = n => {
  const two = (S.cfg?.follows?.sport_app_compound_surnames || []).find(x => String(n || "").endsWith(" " + x));
  if (two) return two;
  const w = String(n || "").split(" ").filter(Boolean); let i = w.length > 1 && /^(J[uú]nior|Jr\.?|Neto|Filho)$/i.test(w.at(-1)) ? w.length - 2 : w.length - 1;
  const end = i; while (i > 1 && /^(de|da|di|do|dos|das|du|del|della|van|von|der|den|ter|le|la)$/i.test(w[i - 1])) i--;
  return w.slice(i, end + 1).join(" ");
};
export const initials = n => { const w = String(n || "").split(/\s+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w.at(-1)[0]).toUpperCase(); };
export const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
export const gpName = n => String(n || "").replace(/ in .*$/, "");
export const gpShort = n => gpName(n).replace(/Grand Prix/, "GP");
export const val = k => D[k]?.value || null;

// ------------------------------------------------------------------ loading
async function getJSON(url, ms = 25000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-cache" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("sport:" + k) || "null"); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("sport:" + k, JSON.stringify(v)); } catch {} },
};
async function snapshot() {
  if (S.snap) return S.snap;
  try { S.snap = (await getJSON("/content/latest.json", 15000)).snapshot || {}; } catch { S.snap = {}; }
  return S.snap;
}
// An F1 weekend's agreed session results are final: a fresh copy that lacks one (a source that went quiet while a
// session is on) keeps it from the phone's last copy of the same weekend
function keepF1(fresh, old) {
  if (!old?.race || !fresh?.race || old.race.round !== fresh.race.round || old.race.season !== fresh.race.season) return fresh;
  const results = [...(fresh.results || [])];
  for (const r of old.results || []) if (!results.some(x => x.start === r.start)) results.push(r);
  return { ...fresh, results: results.sort((a, b) => a.start.localeCompare(b.start)) };
}
function keepFaces(v) {
  if (!v?.ranks) return v;
  const F = store.get("faces") || {};
  const ranks = v.ranks.map(r => { const f = F[r.name]; return f && (!r.id || !r.photo || !r.flag) ? { ...r, id: r.id || f.id, photo: r.photo || f.photo, flag: r.flag || f.flag } : r; });
  for (const r of ranks) if (r.id || r.photo) F[r.name] = { id: r.id || null, photo: r.photo || null, flag: r.flag || null };
  store.set("faces", F);
  return { ...v, ranks };
}
async function loadKey(k) {
  try {
    const j = await getJSON(`/api/live/${k}`, /_hub$/.test(k) ? 45000 : 25000);
    if (j?.ok && j.value) {
      const value = k === "f1_sessions" ? keepF1(j.value, store.get(k)?.value) : k === "tennis_hub" ? keepFaces(j.value) : j.value;
      D[k] = { value, as_of: j.as_of, source: j.source, stale: false }; store.set(k, D[k]); return;
    }
    throw new Error(j?.error || "empty");
  } catch {
    const c = store.get(k);
    if (c?.value) { D[k] = { ...c, stale: true }; return; }
    const s = (await snapshot())[k];
    if (s?.value) D[k] = { value: s.value, as_of: s.as_of, source: s.source, stale: true };
  }
}
export async function loadAll(onEach) {
  if (S.loading) return; S.loading = true;
  for (const k of KEYS) if (!D[k]) { const c = store.get(k); if (c?.value) D[k] = { ...c, stale: true }; }
  if (!S.cfg) { try { S.cfg = await getJSON("/config/house.json", 15000); store.set("cfg", S.cfg); } catch { S.cfg = store.get("cfg"); } }
  onEach?.();
  await Promise.all(KEYS.map(k => loadKey(k).then(() => onEach?.(k))));
  S.lastLoad = Date.now(); S.loading = false;
}

// ------------------------------------------------------------------ what Parth follows
export const follows = () => S.cfg?.follows || {};
export const club = () => follows().football_club?.name || "Real Madrid";
export const clubId = () => val("madrid_hub")?.club_id || String(follows().football_club?.espn_id || 86);
export const favDriver = () => follows().f1_driver?.name || "Max Verstappen";
export const nbaTeam = () => follows().nba_team?.name || "Golden State Warriors";
export const nbaAbbr = () => follows().nba_team?.espn_abbr || "gs";
export const sn = x => { const M = follows().sport_app_short_names || {}; let v = String(x || ""); for (const [k, r] of Object.entries(M)) v = v.replace(k, r); return v; };
export const short = n => (same(n, club()) ? "Madrid" : follows().sport_app_short_teams?.[n] || n);

// ------------------------------------------------------------------ markets
export function oddsFor(sport, sides, iso, kind = "match") {
  const M = (val("odds")?.matches || []).filter(m => m.sport === sport && m.kind === kind && (m.start && m.date_exact !== false ? Math.abs(t(m.start) - t(iso)) <= 3 * 36e5 : Math.abs(Date.parse(m.date) - Date.parse(dayKey(t(iso)))) <= 864e5));
  if (kind !== "match") return M[0] || null;
  return M.find(m => m.sides?.length === 2 && ((same(m.sides[0], sides[0]) && same(m.sides[1], sides[1])) || (same(m.sides[0], sides[1]) && same(m.sides[1], sides[0])))) || null;
}
export const f1Kind = s => (/sprint qualif|shootout/i.test(s) ? "sprint_qualifying" : /sprint/i.test(s) ? "sprint" : /qualif/i.test(s) ? "qualifying" : /^race$/i.test(s) ? "race" : null);
// The race winner market, this weekend's only (never another Grand Prix's prices)
export const raceMarket = () => {
  const M = val("f1_market"), gp = gpName(val("f1_next")?.race?.name);
  if (!M || (gp && M.race && !same(gpName(M.race), gp))) return null;
  return [...(M.markets || [])].sort((a, b) => (b.volume || 0) - (a.volume || 0))[0] || null;
};
export const sessionMarket = (name, start) => { const k = f1Kind(name); return k === "race" ? raceMarket() : k ? oddsFor("f1", null, start, k) : null; };
// Each side's price as the market gives it, rounded
export function sideProbs(m, sides) {
  if (!m) return null;
  const find = s => m.outcomes.find(o => same(o.name, s));
  const a = find(sides[0]), b = find(sides[1]), d = m.outcomes.find(o => /^draw$/i.test(o.name));
  if (!a || !b) return null;
  return { a: Math.round(a.prob), b: Math.round(b.prob), d: d ? Math.round(d.prob) : null, source: m.source };
}
// The followed side's chance in an event (this weekend's F1 sessions only)
export function myChance(e) {
  if (e.state === "done" || e.state === "off") return null;
  if (e.sp === "f1") {
    if (!e.id.startsWith("f1")) return null;
    const m = sessionMarket(e.session, e.start), o = m?.outcomes.find(x => same(x.name, favDriver()));
    return o ? { who: last(favDriver()), prob: Math.round(o.prob), what: /qualif|shootout/i.test(e.session) ? "pole" : "win" } : null;
  }
  if (!e.b || e.sp === "intl") return null;
  const sp = e.sp === "nba" ? "basketball" : e.sp, m = oddsFor(sp, [e.a, e.b], e.start); if (!m) return null;
  const mine = e.sp === "football" ? club() : e.sp === "cricket" ? "India" : e.sp === "nba" ? nbaTeam() : e.player;
  const o = m.outcomes.find(x => same(x.name, mine));
  return o ? { who: e.sp === "football" ? "Madrid" : last(mine), prob: Math.round(o.prob), what: "win" } : null;
}

// ------------------------------------------------------------------ F1 session state
// ESPN's live scoreboard first (pre, in, post, with the actual start); without it, live from the start until a result
// is published or the session's length plus an hour and a half has passed (a red flag can stop the clock for long)
export const F1MIN = { race: 120, qualifying: 60, sprint: 60, sprint_qualifying: 45 };
export function f1State(s, res, now = Date.now(), sameWk = true) {
  const ES = sameWk ? (val("f1_sessions")?.status || []).find(x => x.name === s.name && Math.abs(t(x.start) - t(s.start)) < 6 * 36e5) : null;
  const start = ES?.start || s.start, st = t(start), mins = s.minutes || F1MIN[f1Kind(s.name)] || 60;
  let state;
  // ESPN holds a finished session at "in" with "End of Session" for a while: that is over (older copies of the feed
  // carry the detail without the server's correction). A live state is believed for four hours after the start at
  // most (a saved copy must never stay live for ever).
  // A result two sources agree on ends a session whatever ESPN still says; postponed or cancelled is off.
  const ended = ES && (ES.state === "post" || /end of session|final|finished|complete/i.test(ES.detail || ""));
  const offW = ES && offWord(ES.detail || "");
  let unconfirmed = false;
  if (res) state = "done";
  else if (offW && !ended && ES.state !== "in") state = "off";
  else if (ES?.state === "in" && !ended) state = now - st < 4 * 36e5 ? "live" : "done";
  else if (ended) state = "done";
  else if (now < st) state = "next";
  else if (ES?.state === "pre") state = now - st < 3 * 36e5 ? "late" : "off"; // due but not started (a delay)
  // no live source at all: never "live" from the calendar; "due" (on by the timetable) until it should be over, then
  // over by the clock only (said as "Ended", never "Final", which needs a result or ESPN's word)
  else { state = now < st + (mins + 90) * 6e4 ? "due" : "done"; unconfirmed = state === "done"; }
  // a saved copy that says "in": believed for ten minutes, then last seen live
  const seen = state === "live" ? lost("f1_sessions", now) : null;
  if (seen) state = "off";
  const pause = state === "live" && /red flag|stopped/i.test(ES?.detail || "") ? "Red flag" : state === "live" && /suspend/i.test(ES?.detail || "") ? "Suspended" : state === "live" && /delay/i.test(ES?.detail || "") ? "Delayed" : null;
  // ESPN's order at the flag stands in, marked provisional, until two sources agree on the result
  const prov = state === "done" && !res && ended && ES?.top?.length ? ES.top : null;
  return { state: state === "late" || state === "due" ? "next" : state, late: state === "late", due: state === "due", unconfirmed, pause, offWhy: seen ? null : (state === "off" && offW) || null, seen, start, liveTop: state === "live" ? ES?.top || null : null, liveOrder: state === "live" ? ES?.order || null : null, mins, prov,
    saved: state === "live" && D.f1_sessions?.stale ? D.f1_sessions.as_of : null };
}

// A feed that says "in play" is believed only so long after the start: beyond it, a saved copy has gone stale and the
// event is left out (state "off") rather than shown live, or finished with a score nobody published
const LIVE_FOR = { football: 4, intl: 4, nba: 4, tennis: 6, cricket: 10 };
const sane = (sp, start, state, now) => (state === "live" && now - t(start) > LIVE_FOR[sp] * 36e5 ? "off" : state);
// A saved copy (the feed failed) is believed to be live for ten minutes after it was taken, in every sport; after that
// the event says when it was last seen live and is never drawn as live (QA, 10 Oct: a copy kept quali live for 50 min)
export const SAVED_FOR = 10 * 6e4;
const lost = (k, now) => (D[k]?.stale && D[k].as_of && now - t(D[k].as_of) > SAVED_FOR ? D[k].as_of : null);
// Postponed, cancelled, abandoned: said in a word in the status track
export const offWord = s => (/postpon/i.test(s) ? "Postponed" : /cancel/i.test(s) ? "Cancelled" : /abandon/i.test(s) ? "Abandoned" : /no result/i.test(s) ? "No result" : /suspend/i.test(s) ? "Suspended" : null);
// a cricket stoppage in a word for the status track; the full status goes in the hero
const PAUSE = [[/\bstumps\b/i, "Stumps"], [/\binnings break\b/i, "Break"], [/\btea\b/i, "Tea"], [/\blunch\b/i, "Lunch"], [/\brain\b/i, "Rain"], [/\bbad light\b/i, "Bad light"], [/\bwet outfield\b/i, "Wet field"], [/\bdrinks\b/i, "Drinks"], [/\bdelay/i, "Delayed"]];
const pauseWord = s => PAUSE.find(([r]) => r.test(s || ""))?.[1] || null;
// ------------------------------------------------------------------ every followed event, one shape
// { sp, id, start, state: live|next|done|off, a, b, ma, mb (marks), sa, sb (scores), won: a|b|null, comp, venue,
//   who, href, ... }. A mark is { t: soccer|nba|cricket|player, id?, abbr?, name }; the UI draws it.
export const soccerMark = (id, name) => ({ t: "soccer", id, name });
export function events(all = false) {
  const out = [], now = Date.now();
  // Real Madrid: football (live state and score) over madrid_hub (the season)
  const F = val("football"), H = val("madrid_hub"), cname = club(), cid = clubId();
  const fx = new Map();
  for (const m of [...(H?.fixtures || []), ...(H?.results || []).slice(0, all ? 12 : 4)]) fx.set(String(m.id), m);
  for (const m of [...(F?.next || []), ...(F?.last ? [F.last] : [])]) { const o = fx.get(String(m.id)) || {}; fx.set(String(m.id), { ...o, ...m, us: m.score?.us ?? o.us, them: m.score?.them ?? o.them }); }
  for (const m of fx.values()) {
    const home = m.home, a = home ? cname : m.opponent, b = home ? m.opponent : cname;
    // the feed's own detail overrules its state: "FT" while still "in" is over; "Postponed" while "pre" is off
    const det = String(m.detail || ""), over = /^(FT|AET|Final|Full[- ]time)/i.test(det), off = /postpon|cancel|suspend|abandon/i.test(det);
    const susp = m.state === "in" && /suspend/i.test(det);
    let state = sane("football", m.date, off && !susp ? "off" : m.state === "in" && !over ? "live" : m.completed || (m.state === "in" && over) ? "done" : m.state === "post" ? "off" : "next", now);
    if (state === "next" && now - t(m.date) > 3 * 36e5) state = "off"; // still "pre" three hours after kick-off: not shown
    // still "pre" after the kick-off time: about to start (the feed lags a minute or two), then late; kept on screen
    const late = state === "next" && t(m.date) < now ? (now - t(m.date) < 15 * 6e4 ? "starting" : "late") : null;
    const LV = H?.live && String(H.live.match_id) === String(m.id) ? H.live : null;
    const seen = state === "live" ? lost("football", now) : null; if (seen) state = "off";
    out.push({ sp: "football", id: "rm" + m.id, mid: String(m.id), start: m.date, state, a, b, ma: soccerMark(home ? cid : m.opponent_id, a), mb: soccerMark(home ? m.opponent_id : cid, b),
      comp: m.competition, venue: m.venue, sa: home ? m.us : m.them, sb: home ? m.them : m.us, clock: m.clock || LV?.detail || null,
      won: m.winner === "us" ? (home ? "a" : "b") : m.winner === "them" ? (home ? "b" : "a") : null, who: "Madrid", key: "madrid", href: "#football", late: late === "late", starting: late === "starting", offWhy: off && !susp ? offWord(det) || det : null, seen, pause: state === "live" && susp ? "Suspended" : null,
      saved: state === "live" && D.football?.stale ? D.football.as_of : null,
      ev: LV?.events?.length ? LV.events : m.events || (H?.recent && String(H.recent.match_id) === String(m.id) ? H.recent.events : null) });
  }
  // The national sides (this feed is cached for an hour: a match under way is live without a score)
  for (const T of val("intl_hub")?.teams || []) for (const m of [...T.next, ...(T.last ? [T.last] : [])]) {
    if (D.intl_hub?.stale && !m.completed && t(m.date) < now - SAVED_FOR) continue;
    // live only on the feed's own word ("in"), never from the clock; still "pre" after kick-off is starting, then late
    const st = m.completed ? "done" : m.state === "post" || t(m.date) < now - 3 * 36e5 ? "off" : m.state === "in" ? "live" : "next";
    if (st === "next" && now - t(m.date) > 2 * 36e5) continue;
    // the feed read after kick-off and still "pre": Delayed; a feed not read since: no live word on it after 15 minutes
    const lt = st === "next" && t(m.date) < now ? (D.intl_hub?.as_of && t(D.intl_hub.as_of) - t(m.date) > 15 * 6e4 ? "late" : now - t(m.date) > 15 * 6e4 ? "nolive" : "starting") : null;
    out.push({ sp: "intl", id: "nt" + m.id, start: m.date, state: st, a: m.home, b: m.away, ma: soccerMark(m.home_id, m.home), mb: soccerMark(m.away_id, m.away), abbrA: m.home_abbr, abbrB: m.away_abbr,
      comp: m.competition, venue: m.venue, sa: m.completed || st === "live" ? m.hs ?? null : null, sb: m.completed || st === "live" ? m.as ?? null : null, won: m.completed ? (+m.hs > +m.as ? "a" : +m.hs < +m.as ? "b" : null) : null,
      late: lt === "late", starting: lt === "starting", nolive: lt === "nolive", who: T.name, key: "nt:" + T.name, href: "#football/nations" });
  }
  // India (The Crease)
  const C = val("crease");
  if (C) {
    const list = [C.today, C.next, ...[C.main, ...(C.also || []), C.after].filter(Boolean).flatMap(X => (X.formats || []).flatMap(f => f.matches || []))].filter(Boolean);
    for (const m of new Map(list.map(m => [m.id, m])).values()) {
      let state = /TEST/i.test(m.format || "") ? (m.state === "live" ? "live" : m.state === "done" ? "done" : m.state === "off" ? "off" : "next") : sane("cricket", m.start, m.state === "live" ? "live" : m.state === "done" ? "done" : m.state === "off" ? "off" : "next", now);
      const inn = String(m.score || "").split(" · ").map(x => x.match(/^([A-Z]{2,4})\s+(\d+(?:\/\d+)?d?(?: & \d+(?:\/\d+)?d?)?)(?:\s*\(([\d.]+) ov\))?$/)).filter(Boolean);
      const mine = inn.find(x => x[1] === "IND"), theirs = inn.find(x => x[1] !== "IND");
      if (state === "live" && /won by|match tied|no result|drawn|abandon/i.test(m.status || "")) state = /abandon|no result/i.test(m.status) ? "off" : "done";
      const seen = state === "live" ? lost("crease", now) : null; if (seen) state = "off";
      const pause = state === "live" ? pauseWord(m.status) : null;
      out.push({ sp: "cricket", id: "in" + m.id, start: m.start, state, pause, seen, offWhy: state === "off" && !seen ? offWord(m.status || "") || null : null, saved: state === "live" && D.crease?.stale ? D.crease.as_of : null, a: "India", b: m.opponent, ma: { t: "cricket", name: "India" }, mb: { t: "cricket", name: m.opponent },
        sa: mine ? mine[2] : null, sb: theirs ? theirs[2] : null, oa: mine?.[3] || null, ob: theirs?.[3] || null, score: m.score,
        comp: m.desc, venue: [m.ground, m.city].filter(Boolean).join(", "), city: m.city, status: m.status, won: m.won === true ? "a" : m.won === false ? "b" : null, tbc: m.time_announced === false,
        who: "India", key: "india", href: "#cricket", card: C.last_card && String(C.last_card.match_id) === String(m.id) ? C.last_card : null });
    }
  }
  // F1: the weekend's sessions (those that count unless all), with the state from ESPN's live scoreboard
  // results and states only from the same weekend: f1_next moves on three hours after the flag, f1_sessions keeps the
  // weekend just run for a day and a half (QA, 10 Oct: the next Grand Prix showed the last one's podium)
  const N = val("f1_next")?.race, FS = val("f1_sessions"), sameWk = FS?.race && N && String(FS.race.round) === String(N.round) && String(FS.race.season || "") === String(N.season || FS.race.season || "");
  const R = sameWk ? FS.results || [] : [];
  for (const s of N?.sessions || []) {
    if (!f1Kind(s.name) && !all) continue;
    const res = R.find(r => r.name === s.name && Math.abs(t(r.start) - t(s.start)) < 6 * 36e5) || null, X = f1State(s, res, now, sameWk);
    out.push({ sp: "f1", id: "f1" + s.start, start: X.start, state: X.state, late: X.late, due: X.due, saved: X.saved, unconfirmed: X.unconfirmed, pause: X.pause, offWhy: X.offWhy, seen: X.seen, liveTop: X.liveTop, liveOrder: X.liveOrder, mins: X.mins, session: s.name,
      gp: gpName(N.name), circuit: N.circuit, flag: N.flag, round: N.round, top: res?.top || X.prov || null, provisional: !res && !!X.prov && !!f1Kind(s.name), who: "F1", key: "f1", href: "#f1" });
  }
  if (all) for (const u of val("f1_next")?.upcoming || []) out.push({ sp: "f1", id: "gp" + u.round, start: u.date, state: "next", session: "Race", gp: gpName(u.name), heldIn: / in /.test(u.name) ? u.name.replace(/^.* in /, "") : null,
    circuit: [u.circuit, u.locality].filter(Boolean).join(", "), flag: u.flag, round: u.round, sessions: u.sessions || [], who: "F1", key: "f1", href: "#f1/calendar" });
  // Tennis
  for (const p of val("tennis_players")?.players || []) {
    const tst = p.next ? sane("tennis", p.next.when_utc, p.next.live ? (lost("tennis_players", now) ? "off" : "live") : "next", now) : null;
    // the order of play runs late: past its time and not on court, it stays next ("Not yet on court") for six hours
    const tlt = tst === "next" && !p.next.tbd && t(p.next.when_utc) < now ? (now - t(p.next.when_utc) < 15 * 6e4 ? "starting" : "late") : null;
    if (p.next && !(t(p.next.when_utc) < now - 6 * 36e5 && !p.next.live)) out.push({ sp: "tennis", id: "tn" + p.name + p.next.when_utc, start: p.next.when_utc, state: tst, late: tlt === "late", starting: tlt === "starting", seen: p.next.live && tst === "off" ? D.tennis_players?.as_of : null, tbc: !!p.next.tbd || p.agree === false, held: p.next.held || null, a: p.name, b: p.next.opponent, ma: { t: "player", name: p.name }, mb: p.next.opponent ? { t: "player", name: p.next.opponent } : null,
      comp: sn([p.next.event, p.next.round].filter(Boolean).join(", ")), venue: p.next.court, player: p.name, who: last(p.name), key: "tn:" + p.name, href: "#tennis", then: p.agree ? p.backup?.then || null : null });
    if (p.last) {
      const sets = [...String(p.last.note || "").replace(/^.*?\bbt\b/, "").matchAll(/(\d+)-(\d+)(?:\s*\((\d+)-(\d+)\))?/g)].map(x => [Number(x[1]), Number(x[2])]);
      const won = !!p.last.won, mineSets = sets.map(x => (won ? x[0] : x[1])), theirSets = sets.map(x => (won ? x[1] : x[0]));
      out.push({ sp: "tennis", id: "tl" + p.name + p.last.when_utc, start: p.last.when_utc, state: "done", a: p.name, b: p.last.opponent, ma: { t: "player", name: p.name }, mb: { t: "player", name: p.last.opponent },
        setsA: mineSets, setsB: theirSets, retired: /\bret/i.test(p.last.note || ""), comp: sn([p.last.event, p.last.round].filter(Boolean).join(", ")), won: won ? "a" : "b", player: p.name, who: last(p.name), key: "tn:" + p.name, href: "#tennis" });
    }
  }
  // The Warriors
  const B = val("nba"), team = nbaTeam(), me = nbaAbbr();
  for (const g of [...(B?.next || []), ...(B?.last ? [B.last] : [])]) {
    const a = g.home ? team : g.opponent, b = g.home ? g.opponent : team;
    const fin = g.live && /final/i.test(g.clock || "");
    let nst = sane("nba", g.date, g.live && !fin ? "live" : g.completed || fin ? "done" : t(g.date) < now - 3 * 36e5 ? "off" : "next", now);
    const seen = nst === "live" ? lost("nba", now) : null; if (seen) nst = "off";
    const nlt = nst === "next" && t(g.date) < now ? (now - t(g.date) < 15 * 6e4 ? "starting" : "late") : null;
    out.push({ sp: "nba", id: "nb" + g.id, start: g.date, state: nst, seen, late: nlt === "late", starting: nlt === "starting", saved: nst === "live" && D.nba?.stale ? D.nba.as_of : null, a, b,
      ma: { t: "nba", abbr: g.home ? me : g.opponent_abbr, name: a }, mb: { t: "nba", abbr: g.home ? g.opponent_abbr : me, name: b },
      comp: g.preseason ? "Preseason" : "NBA", sa: g.score ? (g.home ? g.score.us : g.score.them) : null, sb: g.score ? (g.home ? g.score.them : g.score.us) : null,
      won: g.winner === "us" ? (g.home ? "a" : "b") : g.winner === "them" ? (g.home ? "b" : "a") : null, clock: g.clock, who: "Warriors", key: "nba", href: "#nba",
      tops: g.top_scorers?.us && g.top_scorers?.them ? (g.home ? [g.top_scorers.us, g.top_scorers.them] : [g.top_scorers.them, g.top_scorers.us]) : null });
  }
  for (const e of out) if (e.comp && e.sp !== "cricket") e.comp = sn(e.comp);
  // one row per match (Spain v England is followed twice, once per side)
  const ids = new Set();
  return out.filter(e => e.start && !isNaN(t(e.start)) && !ids.has(e.id) && ids.add(e.id)).sort((x, y) => t(x.start) - t(y.start));
}
export const nbaOn = () => { const B = val("nba"); return !!B && (B.in_season || (B.next || []).some(g => t(g.date) - Date.now() < 10 * 864e5) || (B.last && Date.now() - t(B.last.date) < 3 * 864e5)); };
// India's result in a few words: "Won by 8 wkts", "Lost by 5 wkts", else the status as given
export function resultWord(m) {
  const by = String(m.status || "").match(/won by (.+?)(?: \(.*\))?$/i)?.[1];
  return by && m.won === "a" ? `Won by ${by}` : by && m.won === "b" ? `Lost by ${by}` : String(m.status || "").replace(/ due to .*$/i, "");
}
// Madrid's record in the last meetings with the next opponent
export function meetRecord(PV) {
  const cname = club(); let w = 0, d = 0, l = 0;
  for (const m of PV?.meetings || []) { const us = same(m.home, cname) ? m.hs : same(m.away, cname) ? m.as : null, them = same(m.home, cname) ? m.as : m.hs; if (us == null) continue; if (+us > +them) w++; else if (+us < +them) l++; else d++; }
  return { w, d, l };
}
export const atp = name => {
  const r = (val("tennis_hub")?.ranks || []).find(x => same(x.name, name)) || null, c = follows().tennis_espn?.[Object.keys(follows().tennis_espn || {}).find(n => same(n, name))];
  if (!c || (r?.id && r?.photo)) return r;
  return { ...(r || { name }), id: r?.id || c.id, photo: r?.photo || `https://a.espncdn.com/i/headshots/tennis/players/full/${c.id}.png`, flag: r?.flag || (c.flag ? `https://a.espncdn.com/i/teamlogos/countries/500/${c.flag}.png` : null) };
};

// ------------------------------------------------------------------ since you last looked
// What changed since this phone last had the app open: results in, sessions finished, matches gone live. Worked out
// here from the feeds the phone saw (a snapshot of each event's state, kept on the phone). Nothing is guessed.
const SEEN = "seen";
const snap = E => Object.fromEntries(E.map(e => [e.id, [e.state, e.sa ?? null, e.sb ?? null, (e.top || [])[0] || null]]));
export function sinceLast(E) {
  const old = store.get(SEEN);
  if (!old?.at || Date.now() - old.at < 2 * 6e4) return { at: old?.at || null, items: [] };
  const items = [];
  for (const e of E) {
    const o = old.ev?.[e.id]; if (!o) continue;
    if (e.state === "done" && o[0] !== "done") items.push({ e, kind: "done" });
    else if (e.state === "live" && o[0] === "next") items.push({ e, kind: "live" });
    else if (e.state === "live" && (o[1] !== (e.sa ?? null) || o[2] !== (e.sb ?? null)) && e.sa != null) items.push({ e, kind: "score" });
  }
  return { at: old.at, items: items.sort((a, b) => t(b.e.start) - t(a.e.start)).slice(0, 5) };
}
export const markSeen = E => { if (E.length) store.set(SEEN, { at: Date.now(), ev: snap(E) }); };
