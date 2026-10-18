// The TV screensaver's parts (/api/live/tv?saver=1, from 18 Oct 2026; tv-vibehack's Today and Sport modes). Plain code
// on the site's own getters, never a model: the edition's glance lines as printed (or Google News' top titles when the
// edition is more than 36 hours old), Money from the paper's markets, fx and gold_in, and the week, results, standings
// and the Sport mode's hours from the Sport app's events() and the same feeds the app reads. lib/tv.js assembles it.
// Every figure carries its source; anything missing is left out, never guessed.
import { config, openNowIn } from "./live.js";
import { liveOrder, last, same, t, ordinal, gpShort, favDriver, club } from "../public/sport/js/core.js";

const TZ = "Asia/Kolkata";
// an em-dash, or a dash between words, reads as a comma; a dash inside a score ("2–2") stays
const clean = s => (s == null ? s : String(s).replace(/\s*—\s*|\s+–\s+/g, ", ").trim());
const dash = s => String(s).replace(/-/g, "–"); // scores: "7–5", "2–1"

// ------------------------------------------------------------------ the day in a minute
// The edition's glance, line for line, each with its desk's night colour (config tv.saver.desk_colours, from
// docs/DESIGN.md). Before today's edition is out (about 14:15 IST) this is yesterday's, with its date. An edition more
// than saver.edition_max_hours old (or none) gives nothing here, and the caller asks the headlines instead.
export function editionAge(latest, now) {
  const at = Date.parse(latest?.printed_at || "") || Date.parse(`${latest?.date}T${latest?.cut_ist || "14:00"}:00+05:30`);
  return Number.isFinite(at) ? (now - at) / 36e5 : Infinity;
}
export function minuteOf(latest, cfg, now) {
  const S = cfg.tv.saver, desks = cfg.desks_v2?.desks || [];
  if (!latest?.glance?.length || editionAge(latest, now) > S.edition_max_hours) return null;
  const deskOf = section => desks.find(d => (d.sections || []).includes(section))?.id || null;
  // with each line's section ("World · India and the US") and its subject when the line starts with it (set bold on the TV)
  const lines = latest.glance.filter(g => g?.line).map(g => {
    const desk = deskOf(g.color), text = clean(g.line), subject = g.subject && text.startsWith(g.subject) ? g.subject : null;
    return { text, ...(desk ? { desk } : {}), ...(S.desk_colours[desk] ? { colour: S.desk_colours[desk] } : {}), ...(g.section ? { section: clean(g.section) } : {}), ...(subject ? { subject } : {}) };
  });
  return lines.length ? { kind: "edition", date: latest.date, lines } : null;
}
// Headlines when the edition is old: the feed's top titles in its own order, " - Publisher" taken off, dashes as commas
export function headlinesOf(items, source, n = 5) {
  const lines = [...(items || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(i => {
    let s = String(i.title || "");
    if (i.outlet && s.endsWith(` - ${i.outlet}`)) s = s.slice(0, -(i.outlet.length + 3));
    return { text: clean(s.replace(/\s+-\s+[^-]{2,40}$/, "")), ...(i.outlet ? { source: i.outlet } : {}) };
  }).filter(x => x.text).slice(0, n);
  return lines.length ? { kind: "headlines", source, lines } : null;
}

// ------------------------------------------------------------------ Money
// Six rows in a fixed order (config tv.saver.money: the paper's name for each and the name the TV prints): price, and a
// day, 30 days and a year as the shared getters give them (periods: one source per comparison). A row without a price
// is left out; a move without a figure is sent as null and the TV leaves the cell empty.
const dayWord = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
const shortDay = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep");
const dateIn = (ms, tz) => new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
// "today's close", "Friday's close", "9 Oct close", as the paper words a closed market's figure
export function closeWord(session, tz, now) {
  if (!session) return null;
  const today = dateIn(now, tz), age = (Date.parse(today) - Date.parse(session)) / 864e5;
  return session >= today ? "today's close" : age < 7 ? `${dayWord(session)}'s close` : `${shortDay(session)} close`;
}
export function marketsLine(states) {
  if (!states.length) return null;
  const open = states.filter(s => s.open), closed = states.filter(s => !s.open);
  if (!open.length) {
    const words = [...new Set(closed.map(s => s.close).filter(Boolean))];
    return words.length === 1 ? `Markets closed · ${words[0][0].toUpperCase()}${words[0].slice(1)}` : ["Markets closed", ...closed.filter(s => s.close).map(s => `${s.market}: ${s.close}`)].join(" · ");
  }
  return [...open.map(s => `${s.market} open`), ...closed.map(s => `${s.market}: ${s.close || "closed"}`)].join(" · ");
}
const per = (p, q) => {
  // a copy saved before periods existed (the edition's snapshot): the day's move from its own price and previous close
  if (!p && q?.price > 0 && q?.prev > 0) return { d1: { amt: Math.round((q.price - q.prev) * 100) / 100, pct: Math.round((q.price / q.prev - 1) * 10000) / 100 }, d30: null, y1: null };
  return p || { d1: null, d30: null, y1: null };
};
export function moneyOf(mk, gold, cfg, now) {
  const M = cfg.tv.saver.money, H = cfg.markets.hours || {}, rows = [];
  const all = [...(mk?.value?.indices || []), ...(mk?.value?.cross || [])];
  for (const r of M.rows) {
    if (r.gold) {
      const g = gold?.value;
      if (!(g?.per_10g_24k > 0)) continue;
      const P = per(g.periods, { price: g.per_10g_24k, prev: g.prev_10g });
      rows.push({ name: r.label, kind: "gold", price: g.per_10g_24k, d1: P.d1, d30: P.d30, y1: P.y1, source: g.source || gold.source });
      continue;
    }
    const q = all.find(x => x.name === r.name);
    if (!(q?.price > 0)) continue;
    const P = per(q.periods, q);
    rows.push({ name: r.label, kind: r.kind, price: q.price, d1: P.d1, d30: P.d30, y1: P.y1, source: q.periods?.source || q.source, ...(r.market ? { market: r.market } : {}), ...(q.session_date ? { session: q.session_date } : {}) });
  }
  if (!rows.length) return null;
  // open or closed per market, and which close its figures are (from the indices' own session dates)
  const states = [...new Set(M.rows.map(r => r.market).filter(Boolean))].filter(m => H[m]).map(m => {
    const mine = rows.filter(x => x.market === m), open = openNowIn(H[m], new Date(now)), session = mine.map(x => x.session).filter(Boolean).sort().at(-1);
    return { market: M.market_names?.[m] || m, open, close: open ? null : closeWord(session, H[m].tz, now) };
  }).filter(s => rows.some(x => (M.market_names?.[x.market] || x.market) === s.market));
  const stale = [mk, gold].some(x => x?.stale);
  const as_of = stale ? [mk, gold].filter(x => x?.stale).map(x => x.as_of).sort()[0] : undefined;
  return { label: marketsLine(states), markets: states, rows: rows.map(({ session, ...x }) => x), ...(stale ? { stale: true, as_of } : {}) };
}

// ------------------------------------------------------------------ Sport mode: when it is on
// From saver.sport_before_min before any followed event's start until saver.sport_after_min after its end (the
// event's usual length, config tv.minutes; while it is live, never before now), or while anything is live. The windows
// go to the TV with the flag, so it switches by its own clock between fetches.
export function windowsOf(E, T, now, endOf) {
  const S = T.saver, win = [];
  for (const e of E) {
    const st = t(e.start);
    if (!Number.isFinite(st) || e.state === "off") continue;
    const end = e.state === "live" ? Math.max(endOf(e, T), now) : endOf(e, T);
    const from = st - S.sport_before_min * 6e4, to = end + S.sport_after_min * 6e4;
    if (to < now - 36e5 || from > now + S.windows_days * 864e5) continue;
    win.push([from, to]);
  }
  win.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const w of win) { const m = merged.at(-1); if (m && w[0] <= m[1]) m[1] = Math.max(m[1], w[1]); else merged.push([...w]); }
  const on = E.some(e => e.state === "live") || merged.some(([a, b]) => a <= now && now <= b);
  return { sport_mode: on, sport_windows: merged.map(([a, b]) => ({ from: new Date(a).toISOString(), to: new Date(b).toISOString() })) };
}

// ------------------------------------------------------------------ Sport mode: the week, the results, the standings
const placeOf = (rows, name) => rows.find(r => same(r.team, name) || same(r.short, name));
// One line of context for the headline event: where, and why it matters, only from the feeds
export function contextOf(e, data, cfg) {
  const parts = [];
  if (e.sp === "football" || e.sp === "intl") {
    if (e.venue) parts.push(e.venue);
    const rows = data.laliga_table?.value?.rows || [];
    if (e.sp === "football" && /la ?liga/i.test(e.comp || "") && rows.length) {
      const a = placeOf(rows, e.a), b = placeOf(rows, e.b);
      if (a?.rank && b?.rank) parts.push(`${ordinal(a.rank)} v ${ordinal(b.rank)} in La Liga`);
    }
  } else if (e.sp === "cricket") {
    if (e.venue) parts.push(e.venue);
    const s = seriesOf(data.crease?.value, e.id);
    if (s?.score) parts.push(`${s.label} ${scoreWords(s.score, s.opponent)}`);
  } else if (e.sp === "f1") {
    if (e.circuit) parts.push(e.circuit);
    const ds = data.f1_standings?.value?.drivers || [], me = ds.find(d => same(d.name, favDriver()));
    if (me?.pos) parts.push(`${last(me.name)} ${ordinal(me.pos)} in the championship`);
  } else if (e.sp === "tennis") {
    if (e.venue) parts.push(e.venue);
  } else if (e.sp === "nba") {
    const B = data.nba?.value, w = B?.in_season ? (B.west || []).findIndex(r => same(r.team, cfg.follows?.nba_team?.name)) : -1;
    if (w >= 0) parts.push(`${ordinal(w + 1)} in the West`);
  }
  return parts.length ? clean(parts.join(" · ")) : null;
}
// The series a match belongs to (The Crease's main, also and after), with the format's score as Cricbuzz words it
export function seriesOf(C, id) {
  for (const s of [C?.main, ...(C?.also || []), C?.after].filter(Boolean)) for (const f of s.formats || []) {
    if ((f.matches || []).some(m => "in" + m.id === id || String(m.id) === String(id))) return { name: s.name, opponent: s.opponent, label: f.label, score: f.score, matches: f.matches || [], total: f.total, last: s.last };
  }
  return null;
}
// "Drawn 2–2" reads "drawn 2–2" after the series name; "India lead 1–0" keeps its capital
const scoreWords = (score, opponent) => (/^(India|Ind)\b/.test(score) || (opponent && String(score).startsWith(opponent)) ? score : score[0].toLowerCase() + score.slice(1));

// The latest result per follow (e.key) within saver.results_days, newest first, up to saver.max_rows; F1 from this
// weekend's sessions with a top three, else the last Grand Prix's podium (f1_last)
export function resultsOf(E, data, now, S) {
  const best = new Map();
  for (const e of E) {
    if (e.state !== "done" || !(t(e.start) <= now) || now - t(e.start) > S.results_days * 864e5) continue;
    if (e.sp === "f1" && !e.top?.length) continue;
    const k = e.key || e.sp, o = best.get(k);
    if (!o || t(e.start) > t(o.start)) best.set(k, e);
  }
  const L = data.f1_last?.value;
  if (!best.has("f1") && L?.date && now - Date.parse(L.date) <= S.results_days * 864e5 && Date.parse(L.date) <= now) {
    const top = (L.results || []).slice(0, 3);
    if (top.length === 3) best.set("f1", { sp: "f1", id: "gp" + L.round, key: "f1", state: "done", start: L.date, session: "Race", gp: L.name.replace(/ in .*$/, ""), top: top.map(r => r.name), codes: Object.fromEntries(top.filter(r => r.code).map(r => [r.name, r.code])) });
  }
  return [...best.values()].sort((a, b) => t(b.start) - t(a.start) || liveOrder(a, b)).slice(0, S.max_rows);
}
// The next events after the headline: upcoming only, within window_days, time order, up to max_rows
export function weekOf(E, headline, T, now) {
  const teams = T.national_teams || [];
  return E.filter(e => e.state === "next" && t(e.start) > now && t(e.start) - now <= T.window_days * 864e5 && e.id !== headline?.id && (e.sp !== "intl" || teams.some(n => same(e.a, n) || same(e.b, n))))
    .sort((a, b) => t(a.start) - t(b.start) || liveOrder(a, b)).slice(0, T.saver.max_rows);
}

// Where you stand: one line each, only when the data is there. runs: the words, b marks the figure in bold.
export function standingsOf(data, cfg, now) {
  const out = [], F = cfg.follows || {};
  // La Liga: Madrid's place and points, the gap to the leader (or the lead), games in hand on the leader
  const rows = data.laliga_table?.value?.rows || [], rm = placeOf(rows, club());
  if (rm?.rank) {
    const top = rows.find(r => r.rank === 1), second = rows.find(r => r.rank === 2);
    let note = null;
    if (rm.rank === 1 && second) note = rm.points > second.points ? `${rm.points - second.points} clear of ${second.short || second.team}` : `level on points with ${second.short || second.team}`;
    else if (top) {
      const gap = top.points - rm.points, hand = (top.played ?? 0) - (rm.played ?? 0);
      note = [gap > 0 ? `${gap} behind ${top.short || top.team}` : `level with ${top.short || top.team}`, hand === 1 ? "a game in hand" : hand > 1 ? `${hand} games in hand` : null].filter(Boolean).join(", ");
    }
    out.push({ label: "La Liga", runs: [{ t: `${club()} ` }, { t: ordinal(rm.rank), b: true }, { t: ` · ${rm.points} pts` }], note });
  }
  // F1: the followed driver's place, points and the gap to the leader
  const ds = data.f1_standings?.value?.drivers || [], me = ds.find(d => same(d.name, favDriver())), lead = ds.find(d => d.pos === 1);
  if (me?.pos) {
    const second = ds.find(d => d.pos === 2);
    const note = me.pos === 1 ? (second ? `${me.points - second.points} ahead of ${last(second.name)}` : null) : lead ? `${lead.points - me.points} behind ${last(lead.name)}` : null;
    out.push({ label: "F1", runs: [{ t: `${last(me.name)} ` }, { t: ordinal(me.pos), b: true }, { t: ` · ${me.points} pts` }], note });
  }
  // ATP: the followed players' ranks, and the No. 1 when neither is
  const ranks = data.tennis_hub?.value?.ranks || [];
  const mine = (F.tennis_players || []).map(n => ranks.find(r => same(r.name, n))).filter(r => r?.rank);
  if (mine.length) {
    const runs = [];
    mine.forEach((r, i) => runs.push({ t: `${i ? " · " : ""}${last(r.name)} ` }, { t: `No. ${r.rank}`, b: true }));
    const one = ranks.find(r => r.rank === 1);
    out.push({ label: "ATP", runs, note: one && !mine.some(r => r.rank === 1) ? `${last(one.name)} No. 1` : null });
  }
  // Cricket: India's series under way, else the latest finished (the format whose latest match is newest)
  const cr = cricketSeries(data.crease?.value, now);
  if (cr) out.push({ label: "Cricket", runs: [{ t: `India v ${cr.opponent} ${cr.label} ` }, { t: scoreWords(cr.score, cr.opponent), b: true }], note: cr.over ? "Series over" : `${cr.played} of ${cr.total} played` });
  // NBA: the Warriors' record and place in the West, in the regular season only
  const B = data.nba?.value;
  if (B?.in_season && B.west?.length) {
    const i = B.west.findIndex(r => same(r.team, F.nba_team?.name)), r = B.west[i];
    if (r) out.push({ label: "NBA", runs: [{ t: "Warriors " }, { t: `${r.wins}–${r.losses}`, b: true }, { t: ` · ${ordinal(i + 1)} in the West` }], note: null });
  }
  return out.map(x => (x.note ? x : { label: x.label, runs: x.runs }));
}
export function cricketSeries(C, now) {
  const all = [];
  for (const s of [C?.main, ...(C?.also || [])].filter(Boolean)) for (const f of s.formats || []) {
    const done = (f.matches || []).filter(m => m.state === "done" || m.state === "off");
    if (!f.score || !done.length) continue;
    const latest = Math.max(...done.map(m => Date.parse(m.start)));
    const total = f.total || f.matches.length, over = done.length >= total || (s.last && Date.parse(s.last) < now - 864e5 && !(f.matches || []).some(m => m.state === "next" || m.state === "live"));
    all.push({ opponent: s.opponent, label: f.label, score: dash(f.score), played: done.length, total, over, latest });
  }
  return all.sort((a, b) => b.latest - a.latest)[0] || null;
}
// A tennis result as "Bergs bt Alcaraz" and "7–5 7–6": the winner first, sets from the winner's side, no tie-breaks
export function tennisLine(e) {
  if (e.sp !== "tennis" || e.state !== "done" || !e.won) return null;
  const w = e.won === "a" ? e.a : e.b, l = e.won === "a" ? e.b : e.a, ws = e.won === "a" ? e.setsA : e.setsB, ls = e.won === "a" ? e.setsB : e.setsA;
  const sets = (ws || []).map((x, i) => `${x}–${ls?.[i]}`).join(" ");
  return { winner: last(w), loser: last(l), ...(sets ? { sets } : {}), ...(e.retired ? { retired: true } : {}) };
}
// A cricket result in a few words, as Cricbuzz gives it: "India won by 8 wkts", "No result, rain"
export const cricketWords = s => String(s || "").replace(/ \(.*\)$/, "").replace(/ due to /i, ", ").trim() || null;
