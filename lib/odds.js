// The odds on every upcoming match the paper follows (Parth, 3 Oct: "every upcoming match, found automatically"):
// /api/live/odds. The open match markets on Kalshi (config betting.odds.kalshi series) and Polymarket (its tags)
// whose sides include a team or player in config follows, from yesterday to `days` ahead, and the next F1 race and
// qualifying. When both list a match, the one with more traded wins. The page matches each to its own fixtures by
// the two sides, the sport and the date (public/app.js oddsFor); nothing is named here.
import { config, getJSON, shapePolymarket } from "./live.js";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
// Kalshi answers a burst of calls with 429s: at most four at a time, and one retry after a pause.
export const KERR = [];
let busy = 0; const queue = [];
async function kget(url) {
  while (busy >= 4) await new Promise(r => queue.push(r));
  busy++;
  try {
    try { return await getJSON(url, { timeout: 8000 }); }
    catch (e) { if (!/429/.test(String(e?.message))) throw e; await new Promise(r => setTimeout(r, 1200)); return await getJSON(url, { timeout: 8000 }); }
  } finally { busy--; queue.shift()?.(); }
}
const FILLER = new Set(["fc", "cf", "club", "de", "del", "the", "sc", "ac", "afc", "cd", "rcd", "ud", "sd", "ssc", "as", "calcio"]);
const QUALIFIERS = new Set(["women", "womens", "w", "a", "b", "u19", "u21", "u23", "legends", "champions", "xi", "2nd"]);
export const words = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, " ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !FILLER.has(w));

// Two names for the same side: the same qualifiers ("India" is not "India A" or "India women") and one name's words
// all inside the other's ("Alcaraz" and "Carlos Alcaraz", "Villarreal" and "Villarreal CF", "Atlético Madrid" and
// "Club Atlético de Madrid"; not "Real Madrid" and "Atlético Madrid").
export function sameSide(x, y) {
  const a = words(x), b = words(y);
  const qa = a.filter(w => QUALIFIERS.has(w)).sort().join(" "), qb = b.filter(w => QUALIFIERS.has(w)).sort().join(" ");
  if (qa !== qb) return false;
  const ca = a.filter(w => !QUALIFIERS.has(w)), cb = b.filter(w => !QUALIFIERS.has(w));
  if (!ca.length || !cb.length) return false;
  const [s, l] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  return s.some(w => w.length >= 3) && s.every(w => l.includes(w));
}

// "Asian Games Men: Pakistan vs India" -> ["Pakistan", "India"]; a side market ("... - Most Sixes") is not a match.
export function sidesOf(title) {
  const t = String(title || "");
  if (/ - /.test(t)) return null;
  const s = t.split(": ").pop().split(/\s+vs\.?\s+/i).map(x => x.trim()).filter(Boolean);
  return s.length === 2 ? s : null;
}

// A Kalshi event ticker's date, and its start when it has one: "KXT20MATCH-26OCT030030INDPAK" is 3 Oct 2026, 00:30
// in New York (04:30 UTC). Returns {date: "YYYY-MM-DD" (New York's date), start: ISO or null}.
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
export function kalshiWhen(ticker) {
  const m = String(ticker || "").match(/-(\d\d)([A-Z]{3})(\d\d)(\d{4})?/);
  if (!m || !(m[2] in MON)) return null;
  const y = 2000 + Number(m[1]), mo = MON[m[2]], d = Number(m[3]);
  const date = `${y}-${String(mo + 1).padStart(2, "0")}-${m[3]}`;
  if (!m[4]) return { date, start: null };
  const hh = Number(m[4].slice(0, 2)), mm = Number(m[4].slice(2));
  // New York's offset that day: try -4 (summer), check with Intl, else -5
  for (const off of [4, 5]) {
    const t = Date.UTC(y, mo, d, hh + off, mm);
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(t)));
    if (h === hh) return { date, start: new Date(t).toISOString() };
  }
  return { date, start: null };
}
const istDate = iso => new Date(Date.parse(iso) + 5.5 * 36e5).toISOString().slice(0, 10);

// A Kalshi market's price: the middle of a tight bid and ask, else the last trade.
const kmid = x => { const b = Number(x.yes_bid_dollars), a = Number(x.yes_ask_dollars), l = Number(x.last_price_dollars); return a > 0 && b >= 0 && a - b <= 0.05 ? (a + b) / 2 : l; };
const decided = outs => !outs.length || outs.some(o => o.prob >= 99) || outs.every(o => o.prob <= 1);

// Who each sport's markets must name: India's cricket team, the club and the national sides, the tennis players, the
// NBA team. F1 is the whole grid, so any race counts.
export function followed(C = config()) {
  const F = C.follows || {};
  return {
    cricket: [(F.cricket_team?.name || "India").replace(/\s*\(.*\)$/, "").replace(/\s+men$/i, "")],
    football: [F.football_club?.name, ...(F.national_teams || [])].filter(Boolean),
    tennis: F.tennis_players || [],
    basketball: [F.nba_team?.name].filter(Boolean),
  };
}
const ours = (sides, names) => sides.some(s => names.some(n => sameSide(s, n)));

async function kalshi(sport, series, names, from, to) {
  const ev = await kget(`${KALSHI}/events?series_ticker=${series}&status=open&limit=200`).catch(e => { KERR.push(String(e?.message || e)); return {}; });
  const out = [];
  await Promise.all((ev.events || []).map(async e => {
    const w = kalshiWhen(e.event_ticker); if (!w || w.date < from || w.date > to) return;
    const f1 = sport === "f1", sides = f1 ? null : sidesOf(e.title);
    if (!f1 && !(sides && ours(sides, names))) return;
    const m = await kget(`${KALSHI}/markets?event_ticker=${encodeURIComponent(e.event_ticker)}&limit=60`).catch(e => { KERR.push(String(e?.message || e)); return null; });
    const live = (m?.markets || []).filter(x => x.status === "active");
    const outcomes = live.map(x => ({ name: x.yes_sub_title === "Tie" ? "Draw" : x.yes_sub_title, prob: Math.round(kmid(x) * 1000) / 10 }))
      .filter(o => o.name && isFinite(o.prob) && o.prob > 0).sort((a, b) => b.prob - a.prob);
    if (decided(outcomes)) return;
    const start = w.start || (f1 && live[0]?.occurrence_datetime) || null;
    const base = { sport, source: "Kalshi", url: `https://kalshi.com/markets/${series.toLowerCase()}`, volume: Math.round(live.reduce((t, x) => t + Number(x.volume_fp || 0), 0)), start, date: start ? istDate(start) : w.date, date_exact: !!start };
    if (f1) out.push({ ...base, kind: /QUALIFY/.test(series) ? "qualifying" : "race", name: String(e.sub_title || e.title).replace(/\s*\d{4}$/, "").replace(/ Main Race Winner$/, ""), outcomes: outcomes.slice(0, 3) });
    else out.push({ ...base, kind: "match", sides, outcomes });
  }));
  return out;
}

async function polymarket(sport, tags, names, from, to) {
  const lists = await Promise.all(tags.map(t => getJSON(`https://gamma-api.polymarket.com/events?tag_slug=${encodeURIComponent(t)}&active=true&closed=false&limit=300&order=volume24hr&ascending=false`, { timeout: 10000 }).catch(() => [])));
  const seen = new Set(), out = [];
  for (const e of lists.flat()) {
    if (!e?.slug || seen.has(e.slug) || e.closed) continue; seen.add(e.slug);
    if (!/\d{4}-\d\d-\d\d$/.test(e.slug)) continue; // a match's own market; "-more-markets", "-exact-score" and the like are not
    const start = e.startTime || e.markets?.[0]?.gameStartTime || null; if (!start || !isFinite(Date.parse(start))) continue;
    const date = istDate(start); if (date < from || date > to) continue;
    let kind = "match", sides = null, name = null;
    if (sport === "f1") {
      const r = String(e.title).match(/^(.*?Grand Prix): Driver (Winner|Pole Position)$/i); if (!r) continue;
      kind = /pole/i.test(r[2]) ? "qualifying" : "race"; name = r[1];
    } else { sides = sidesOf(e.title); if (!sides || !ours(sides, names)) continue; }
    const g = shapePolymarket(e), outcomes = g.outcomes.filter(o => isFinite(o.prob)).sort((a, b) => b.prob - a.prob);
    if (decided(outcomes)) continue;
    out.push({ sport, kind, ...(sides ? { sides } : { name }), source: "Polymarket", url: g.url, volume: Math.round(Number(e.volume) || 0), start, date, date_exact: true, outcomes: sport === "f1" ? outcomes.slice(0, 3) : outcomes });
  }
  return out;
}

// One market a match: where Kalshi and Polymarket both list it (same sport and kind, the same two sides, dates a day
// apart at most), the one with more traded.
export function merge(list) {
  const same = (x, y) => x.sport === y.sport && x.kind === y.kind && Math.abs(Date.parse(x.date) - Date.parse(y.date)) <= 864e5 &&
    (x.kind === "match" ? (sameSide(x.sides[0], y.sides[0]) && sameSide(x.sides[1], y.sides[1])) || (sameSide(x.sides[0], y.sides[1]) && sameSide(x.sides[1], y.sides[0])) : true);
  const out = [];
  for (const m of [...list].sort((a, b) => b.volume - a.volume)) {
    const twin = out.find(o => same(o, m));
    if (!twin) out.push(m);
    else if (!twin.start && m.start) Object.assign(twin, { start: m.start, date: m.date, date_exact: true }); // the better-traded price, with a start time when either has one
  }
  return out.sort((a, b) => String(a.start || a.date).localeCompare(String(b.start || b.date)));
}

// A match's prices read as chances that add up to 100 (each Kalshi side is its own market, so the middles of their
// bids and asks can sum to 102); a race's top three are left as priced.
export function fair(m) {
  if (m.kind !== "match") return m;
  const t = m.outcomes.reduce((a, o) => a + o.prob, 0);
  return t > 0 ? { ...m, outcomes: m.outcomes.map(o => ({ ...o, prob: Math.round(o.prob / t * 1000) / 10 })) } : m;
}

export async function odds() {
  KERR.length = 0;
  try {
    const C = config(), O = C.betting?.odds || {}, names = followed(C), min = O.min_volume ?? 1000;
    const now = Date.now(), from = istDate(new Date(now - 864e5).toISOString()), to = istDate(new Date(now + (O.days || 15) * 864e5).toISOString());
    const jobs = [];
    for (const [sport, list] of Object.entries(O.kalshi || {})) for (const s of list) jobs.push(kalshi(sport, s, names[sport] || [], from, to));
    for (const [sport, tags] of Object.entries(O.polymarket || {})) jobs.push(polymarket(sport, tags, names[sport] || [], from, to));
    const all = (await Promise.all(jobs.map(j => j.catch(() => [])))).flat();
    const matches = merge(all).filter(m => m.volume >= min).map(fair);
    if (!matches.length) throw new Error("no open match markets for the paper's follows");
    const src = [...new Set(matches.map(m => m.source))].join(", ");
    return { ok: true, value: { matches }, source: src, as_of: new Date().toISOString(), stale: false };
  } catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
}

export const ODDS = { odds };
export const ODDS_CACHE = { odds: [900, 3600] };
