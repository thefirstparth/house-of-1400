// The trial's bets feed (/?trial, 27 Nov 2026, Parth's pick 4 from the Daily Index: "I like how it is showing a graph
// with the trend as well, how it is moving up and down", and "the why it moved section along with it").
//
// GET /api/live/look_bet_history?ids=pm:slug1,pm:slug2 (at most 8 ids). For each Polymarket market: its event on the
// gamma API gives each outcome's CLOB token, and the CLOB's price history (one month, hourly) gives the front-runners'
// lines (the same top three outcomes the paper prints, by lib/live.js shapePolymarket). Returned per market:
//   outcomes[{name, now, t, d24, d7, w:{t0, dt, p[]}, m:{t0, dt, p[]}}]  (w: the last 7 days hourly; m: 30 days, 6-hourly;
//   p in percent, one decimal; t0 in unix seconds; d24 and d7 the change in points over 24 hours and over the week)
//   moves[{n, name, at, from, to, pts, heads[{title, source, url, at}]}]: the one or two biggest moves of 8 points or
//   more within a day this week, each with the headlines published around it (Google News search, the 36 hours before
//   the move to two hours after; kept only when they name the moving side or the question's own names). Never a cause:
//   "around the move". A move of a side that is not a name ("None before 2027") is told by the named side that moved
//   with it, the way the Daily Index tells a jump by the story that lines up with it.
//   news[]: on a week with no such move, up to three headlines from the last four days that plainly name the question
//   ("In the news"), so the sheet still says what is going on; empty when nothing fits.
//   settled {winner, at}: the market has closed and Polymarket resolved it (every runner's book at 0 or 1). The page
//   then prints the result, never the last live price, which would be wrong.
//   end, vol, rules: when it settles, the money traded in all, and the first lines of how it is decided.
// GET /api/live/look_bet_all?id=pm:slug: the same front-runners since the market opened, one point a day (the sheet's
// "All", asked only when it is tapped).
// A market gamma does not know, or a history that does not answer: that market is simply left out (the card then
// shows without a trend line; nothing is ever drawn from invented points). Kalshi is not read: Parth retired it from
// the Betting Window on 25 Sep 2026 (docs/DECISIONS.md), and the window's ids are Polymarket's only.
import { getJSON, getText, shapePolymarket } from "./live.js";

const H = 3600, HMS = 36e5;
const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });
const parseArr = v => { try { return Array.isArray(v) ? v : JSON.parse(v || "[]"); } catch { return []; } };
const r1 = x => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- ids
export const MAX_IDS = 8;
export function parseIds(s) {
  const all = String(s || "").split(",").map(x => x.trim()).filter(Boolean).map(x => (x.includes(":") ? x : `pm:${x}`));
  return [...new Set(all.filter(x => /^pm:[a-z0-9-]{3,200}$/.test(x)))].slice(0, MAX_IDS);
}

// ---------------------------------------------------------------- outcomes and their tokens
// The outcomes the paper prints for this event (shapePolymarket: up to three), each with its CLOB token (the "Yes"
// side of a multi-market event, or the outcome's own side of a single market).
export function outcomeTokens(e) {
  const shaped = shapePolymarket(e).outcomes;
  const open = (e.markets || []).filter(m => m.active !== false && m.closed !== true);
  const ml = open.filter(m => m.sportsMarketType === "moneyline"), mkts = ml.length ? ml : open;
  const out = [];
  if (mkts.length === 1) {
    const names = parseArr(mkts[0].outcomes), toks = parseArr(mkts[0].clobTokenIds);
    for (const o of shaped) { const i = names.findIndex(n => String(n) === o.name); if (i >= 0 && toks[i]) out.push({ name: o.name, token: String(toks[i]) }); }
  } else {
    const label = m => [m.groupItemTitle, m.question, m.groupItemTitle && `By ${m.groupItemTitle}`, m.groupItemTitle && `Through ${m.groupItemTitle}`]
      .filter(Boolean).map(x => String(x).replace(/^Draw \(.*\)$/, "Draw"));
    for (const o of shaped) {
      const m = mkts.find(m => label(m).includes(o.name)), tok = m && parseArr(m.clobTokenIds)[0];
      if (tok) out.push({ name: o.name, token: String(tok) });
    }
  }
  return out.length ? out : settlingTokens(e);
}
// A market being settled (or just settled) has one-sided books, so the paper's price filter keeps no runner; its
// history still tells the story. Its named runners, likeliest first (the placeholders Polymarket lists unused,
// "Candidate A" to "Other", are left out).
const PLACEHOLDER = /^(candidate [a-z]|player [a-z]|team [a-z]|other|others|tbd)$/i;
const price0 = m => Number(parseArr(m.outcomePrices)[0]);
function settlingTokens(e) {
  const mk = (e.markets || []).filter(m => m.active !== false && !PLACEHOLDER.test(String(m.groupItemTitle || "").trim()));
  if (mk.length === 1) {
    const names = parseArr(mk[0].outcomes), toks = parseArr(mk[0].clobTokenIds);
    return (names[0] === "Yes" ? [0] : names.map((_, i) => i)).filter(i => toks[i]).map(i => ({ name: String(names[i]), token: String(toks[i]) }));
  }
  return mk.filter(m => (m.groupItemTitle || m.question) && parseArr(m.clobTokenIds)[0] && Number.isFinite(price0(m)))
    .sort((a, b) => price0(b) - price0(a)).slice(0, 3)
    .map(m => ({ name: String(m.groupItemTitle || m.question).replace(/^Draw \(.*\)$/, "Draw"), token: String(parseArr(m.clobTokenIds)[0]) }));
}

// ---------------------------------------------------------------- settled, and the market's facts
// Settled: every market of the event closed and resolved by Polymarket, one runner paid out (its Yes at 1). A yes/no
// market's winner is Yes or No. Anything less certain is not called settled.
export function settlement(e) {
  const mk = (e?.markets || []).filter(m => m.active !== false && !PLACEHOLDER.test(String(m.groupItemTitle || "").trim()));
  if (!mk.length || !mk.every(m => m.closed === true)) return null;
  const resolved = m => !m.umaResolutionStatus || m.umaResolutionStatus === "resolved";
  if (!mk.every(resolved)) return null;
  const at = Date.parse(e.closedTime || mk.map(m => String(m.closedTime || "").replace(" ", "T").replace(/\+00$/, "Z")).sort().pop() || "") || null;
  if (mk.length === 1) {
    const names = parseArr(mk[0].outcomes), p = parseArr(mk[0].outcomePrices).map(Number), i = p.findIndex(x => x >= 0.995);
    return i >= 0 && p.filter(x => x >= 0.995).length === 1 && names[i] ? { winner: String(names[i]), at } : null;
  }
  const won = mk.filter(m => price0(m) >= 0.995);
  return won.length === 1 ? { winner: String(won[0].groupItemTitle || won[0].question).replace(/^Draw \(.*\)$/, "Draw"), at } : null;
}
// How it is decided: the event's description, its first sentences up to about 420 characters, without em dashes
// (the paper's rule) or links.
export function rulesOf(d) {
  let t = String(d || "").replace(/https?:\/\/\S+/g, "").replace(/\s*—\s*/g, ", ").replace(/–/g, "-").replace(/\s+/g, " ").trim();
  if (t.length <= 420) return t;
  const cut = t.slice(0, 420), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\u00a0"));
  return end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

// ---------------------------------------------------------------- series
// A CLOB history ([{t, p}] in seconds and 0..1) on a regular grid from `start` to `end` every `dt` seconds: each grid
// point takes the last price at or before it. Points before the first trade are dropped (t0 moves up).
export function resample(hist, start, end, dt) {
  const h = (hist || []).filter(x => Number.isFinite(x?.t) && Number.isFinite(Number(x?.p))).sort((a, b) => a.t - b.t);
  if (h.length < 2) return null;
  const p = []; let t0 = null, j = -1;
  for (let t = start; t <= end; t += dt) {
    while (j + 1 < h.length && h[j + 1].t <= t) j++;
    if (j < 0) continue;
    if (t0 == null) t0 = t;
    p.push(r1(Number(h[j].p) * 100));
  }
  return p.length >= 2 ? { t0, dt, p } : null;
}
const at = (s, t) => { if (!s) return null; const i = Math.floor((t - s.t0) / s.dt); return i < 0 ? null : s.p[Math.min(i, s.p.length - 1)]; };

export function seriesOf(hist, nowSec = Math.floor(Date.now() / 1000)) {
  const end = Math.floor(nowSec / H) * H;
  const w = resample(hist, end - 7 * 24 * H, end, H), m = resample(hist, end - 30 * 24 * H, end, 6 * H);
  if (!w) return null;
  // the latest price itself (the grid stops at the hour)
  const last = [...hist].sort((a, b) => a.t - b.t).at(-1), now = r1(Number(last.p) * 100);
  const d24 = at(w, nowSec - 24 * H), d7 = w.p[0];
  return { now, t: last.t, d24: d24 == null ? null : r1(now - d24), d7: w.t0 <= end - 6 * 24 * H ? r1(now - d7) : null, w, m };
}

// ---------------------------------------------------------------- the moves
// On an hourly series: the biggest change between two points at most 24 hours apart, then the next biggest that does
// not overlap it. A spike that falls straight back (a thin book) does not count: three hours on, the price must still
// hold at least 60% of the move, and the fall back of a spike is not a move either. `at` is the steepest hour inside the move, where the chart puts its marker.
export function movesIn(s, { min = 8, max = 2, span = 24, skip = 0 } = {}) {
  if (!s?.p?.length) return [];
  const p = s.p, n = p.length, found = [], used = [];
  const free = (a, b) => used.every(([x, y]) => b < x - 12 || a > y + 12);
  for (let k = 0; k < max; k++) {
    let best = null;
    for (let b = 1; b < n; b++) for (let a = Math.max(skip, b - span); a < b; a++) {
      const d = p[b] - p[a];
      if (Math.abs(d) < min || (best && Math.abs(d) <= Math.abs(best.d)) || !free(a, b)) continue;
      const after = p[Math.min(n - 1, b + 3)] - p[a];
      if (Math.sign(after) !== Math.sign(d) || Math.abs(after) < 0.6 * Math.abs(d)) continue;
      // nor does the fall back of a spike: the price must have been steady for three hours before the move began
      if (Math.abs(p[Math.max(skip, a - 3)] - p[a]) > 0.4 * Math.abs(d)) continue;
      best = { a, b, d };
    }
    if (!best) break;
    let steep = best.a + 1;
    for (let i = best.a + 1; i <= best.b; i++) if ((p[i] - p[i - 1]) * Math.sign(best.d) > (p[steep] - p[steep - 1]) * Math.sign(best.d)) steep = i;
    used.push([best.a, best.b]);
    found.push({ at: s.t0 + steep * s.dt, from: p[best.a], to: p[best.b], pts: Math.round(best.d), t_from: s.t0 + best.a * s.dt, t_to: s.t0 + best.b * s.dt });
  }
  return found;
}
// Across the front-runners: the biggest moves first, at most `max`, none within a day of another (in a two-way market
// the other side mirrors the same move). A market opened this week starts at a default price (often 50%): its first
// six hours are not a move.
export function pickMoves(outcomes, { min = 8, max = 2 } = {}) {
  const born = o => o.w.t0 > Math.floor((o.t || 0) / H) * H - 7 * 24 * H + H;
  const all = outcomes.flatMap(o => movesIn(o.w, { min, max, skip: born(o) ? 6 : 0 }).map(m => ({ ...m, name: o.name }))).sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts));
  // a side that is not a name ("None before 2027", "Other") is told by the named side that moved with it, within
  // half a day and by at least half as much: the news names Netanyahu, not "none"
  const told = m => (nameWorth(m.name) ? m : all.find(x => x !== m && nameWorth(x.name) && Math.abs(x.at - m.at) <= 12 * H && Math.abs(x.pts) >= 0.5 * Math.abs(m.pts)) || m);
  const out = [];
  for (const m0 of all) { const m = told(m0); if (out.length < max && !out.includes(m) && out.every(x => Math.abs(x.at - m.at) > 24 * H)) out.push(m); }
  return out.sort((x, y) => x.at - y.at).map((m, i) => ({ n: i + 1, ...m }));
}

// ---------------------------------------------------------------- the headlines around a move
const STOP = new Set(("a an the of in on at to for and or but with from by as is are was were be will who which what when where how whose next new " +
  "before after end winner win wins election-winner market markets price prices average than this that it its his her their yes no vs v over under " +
  "out again ever first continue continues remain remains stay named called any most more least top hit reach above below between during until through jan feb mar apr may jun jul aug sep oct nov dec " +
  "january february march april june july august september october november december").split(" "));
const fold = s => String(s || "").replace(/['’]s\b/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const tokens = s => fold(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w) && !/^\d{1,4}$/.test(w) && !/^\d+(st|nd|rd|th)$/.test(w));
// a name worth searching with: a person, party or side, not a yes, a date rung, a price band or a draw
// the telling part of a runner's name: "Netanyahu - Israel PM" is Netanyahu, "Lula (Brazil)" is Lula
export const nameHead = n => String(n || "").split(/\s+[-–]\s+|\s*\(/)[0].trim();
export const nameWorth = n => !!n && !/^(yes|no|draw|other|others|none.*)$/i.test(n) && !/^(by|through|before|above|below|over|under)\b/i.test(n) && !/[$%↑↓<>]|\d/.test(n) && /[a-z]{3}/i.test(fold(n));
export function newsQuery(title, name) {
  const words = [...new Set(fold(title).replace(/\?|\.\.\./g, " ").split(/\s+/).map(w => w.replace(/[^A-Za-z0-9'-]/g, "")).filter(w => tokens(w).length))];
  const names = new Set(namesIn(title)), isName = w => names.has(tokens(w)[0]);
  const kw = [...words.filter(isName), ...words.filter(w => !isName(w))].slice(0, nameWorth(name) ? 3 : 5).join(" ");
  return nameWorth(name) ? `${fold(nameHead(name))} ${kw}`.trim() : kw;
}
const decode = s => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]).trim() : ""; };
export function parseRss(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => {
    const source = tag(x, "source"), raw = tag(x, "title");
    const title = source && raw.endsWith(` - ${source}`) ? raw.slice(0, -(source.length + 3)) : raw.replace(/\s+-\s+[^-]{2,60}$/, "");
    return { title: title.trim(), source: source || null, url: tag(x, "link") || null, at: Date.parse(tag(x, "pubDate")) || null };
  }).filter(i => i.title && i.url && i.at);
}
// The question's names: its capitalised words that are not the generic words of a market's title ("Mayor",
// "Election", "Grand Prix"), e.g. Israel and Iran in "Israel x Iran ceasefire continues through...?".
const GENERIC = new Set(("mayor mayoral election elections winner champion champions league cup prime minister president presidential ceo grand prix " +
  "test match driver drivers average rental price general leader head state government party world series final team club cf fc sc ac deportivo " +
  "nobel prize award best model company largest").split(" "));
export const namesIn = title => [...new Set(fold(title).split(/[^A-Za-z0-9'-]+/).filter(w => /^[A-Z]/.test(w)).flatMap(tokens).filter(w => !GENERIC.has(w)))];
// Headlines inside [from, to] (ms) that are plainly about the question: the moving outcome's name with a word of the
// question, or the question's names (two of them, or its only one) with two words of the question. Most overlap
// first, then nearest the move; never one about the betting itself; one per story.
const CIRCULAR = /\b(polymarket|kalshi|prediction markets?|betting odds|odds today|bettors?|sportsbook|best bets?|picks? and predictions?|dream ?11|fantasy|prediction)\b/i;
export function pickHeadlines(items, { title, name, from, to, moveAt, max = 3 }) {
  // with neither a named side nor a name in the question ("Next leader out of power before 2027?" moving on "None"),
  // common words alone ("leader", "power") match anything: nothing is shown
  const qt = new Set(tokens(title)), nt = new Set(nameWorth(name) ? tokens(nameHead(name)) : []), names = namesIn(title), need = names.length ? Math.min(2, names.length) : Infinity;
  const seen = new Set(), out = [];
  const scored = items.filter(i => i.at >= from && i.at <= to && !CIRCULAR.test(i.title)).map(i => {
    const ht = new Set(tokens(i.title)); let q = 0, nm = 0, en = 0;
    for (const w of ht) { if (qt.has(w)) q++; if (nt.has(w)) nm++; }
    for (const w of names) if (ht.has(w)) en++;
    return { i, q, nm, en, score: q + 3 * Math.min(nm, 1) };
  }).filter(x => (x.nm >= 1 && x.q >= 1) || (x.en >= need && x.q >= 2))
    .sort((a, b) => b.score - a.score || Math.abs(a.i.at - moveAt) - Math.abs(b.i.at - moveAt));
  for (const { i } of scored) {
    const k = tokens(i.title).slice(0, 6).join(" ");
    if (seen.has(k)) continue; seen.add(k); out.push(i);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------- fetching, with a short memory in a warm function
const MEMO = new Map();
async function memo(key, ttl, fn) {
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.v;
  const v = await fn();
  MEMO.set(key, { at: Date.now(), v });
  if (MEMO.size > 400) for (const k of [...MEMO.keys()].slice(0, 100)) MEMO.delete(k);
  return v;
}
const day = ms => new Date(ms).toISOString().slice(0, 10);
async function news(q, from, to) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} after:${day(from - 864e5)} before:${day(to + 864e5)}`)}&hl=en-IN&gl=IN&ceid=IN:en`;
  return memo(`n:${u}`, 30 * 6e4, async () => parseRss(await getText(u, { timeout: 4500 })));
}
async function eventOf(slug) {
  return memo(`e:${slug}`, 10 * 6e4, async () => {
    const a = await getJSON(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`, { timeout: 5000 }).catch(() => []);
    if (a?.[0]) return a[0];
    // a market's own slug: its event is the market itself
    const m = await getJSON(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`, { timeout: 5000 }).catch(() => []);
    return m?.[0] ? { title: m[0].question, slug, markets: [m[0]], tags: [] } : null;
  });
}
async function historyOf(token) {
  return memo(`h:${token}`, 10 * 6e4, async () => (await getJSON(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=1m&fidelity=60`, { timeout: 5000 }))?.history || []);
}

export async function marketHistory(id, { deadline = Date.now() + 9000, now = Date.now() } = {}) {
  const e = await eventOf(id.slice(3));
  if (!e) return null;
  const toks = outcomeTokens(e);
  if (!toks.length) return null;
  const nowSec = Math.floor(now / 1000);
  const outcomes = (await Promise.all(toks.map(async o => {
    const h = await historyOf(o.token).catch(() => null), s = h && seriesOf(h, nowSec);
    return s ? { name: o.name, ...s } : null;
  }))).filter(Boolean);
  if (!outcomes.length) return null;
  const moves = pickMoves(outcomes), settled = settlement(e);
  for (const mv of moves) {
    mv.heads = [];
    if (Date.now() > deadline - 2500) continue;
    const from = (mv.at - 36 * H) * 1000, to = (mv.at + 2 * H) * 1000, title = e.title || "";
    const tryQ = async q => (q ? pickHeadlines(await news(q, from, to).catch(() => []), { title, name: mv.name, from, to, moveAt: mv.at * 1000 }) : []);
    mv.heads = await tryQ(newsQuery(title, mv.name));
    if (!mv.heads.length && nameWorth(mv.name) && Date.now() < deadline - 2500) mv.heads = await tryQ(newsQuery(title, null));
  }
  // no move with headlines this week: what the last four days' news says about the question, held to the same test
  let inNews = [];
  if (!settled && !moves.some(m => m.heads.length) && Date.now() < deadline - 2500) {
    const fav = [...outcomes].sort((a, b) => b.now - a.now)[0], title = e.title || "", to = now, from = now - 4 * 864e5;
    const q = newsQuery(title, fav?.name);
    if (q) inNews = pickHeadlines(await news(q, from, to).catch(() => []), { title, name: fav?.name, from, to, moveAt: to });
  }
  return { title: e.title || null, outcomes, moves, news: inNews, settled, end: e.endDate || null, vol: Math.round(Number(e.volume) || 0) || null, rules: rulesOf(e.description) || null };
}

// ---------------------------------------------------------------- since the market opened, one point a day
export function allSeries(hist) {
  const h = (hist || []).filter(x => Number.isFinite(x?.t) && Number.isFinite(Number(x?.p))).sort((a, b) => a.t - b.t);
  if (h.length < 2) return null;
  const s = resample(h, h[0].t, h.at(-1).t, 86400);
  if (!s) return null;
  const last = h.at(-1);
  // the latest price as the last point, when the daily grid stopped before it
  if (s.t0 + (s.p.length - 1) * s.dt < last.t) s.last = [last.t, r1(Number(last.p) * 100)];
  return s;
}
export async function look_bet_all(params = new URLSearchParams()) {
  const id = parseIds(params.get("id"))[0];
  if (!id) return fail("no Polymarket id");
  const e = await eventOf(id.slice(3));
  const toks = e ? outcomeTokens(e) : [];
  if (!toks.length) return fail("no market for " + id);
  const outcomes = (await Promise.all(toks.map(async o => {
    const h = await memo(`a:${o.token}`, 60 * 6e4, async () => (await getJSON(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(o.token)}&interval=max&fidelity=1440`, { timeout: 6000 }))?.history || []).catch(() => null);
    const a = h && allSeries(h);
    return a && a.p.length >= 3 ? { name: o.name, a } : null;
  }))).filter(Boolean);
  if (!outcomes.length) return fail("no history for " + id);
  return ok({ id, outcomes }, "Polymarket price history");
}

export async function look_bet_history(params = new URLSearchParams()) {
  const ids = parseIds(params.get("ids"));
  if (!ids.length) return fail("no Polymarket ids");
  const deadline = Date.now() + 9000;
  const got = await Promise.all(ids.map(id => marketHistory(id, { deadline }).catch(() => null)));
  const markets = {};
  ids.forEach((id, i) => { if (got[i]) markets[id] = got[i]; });
  if (!Object.keys(markets).length) return fail("no history for " + ids.join(","));
  return ok({ markets }, "Polymarket price history; headlines from Google News");
}

export const LOOK_BETS = { look_bet_history, look_bet_all };
// prices move all day; the moves and their headlines change slowly: 15 minutes at the edge, then an hour stale
export const LOOK_BETS_CACHE = { look_bet_history: [900, 3600], look_bet_all: [3600, 21600] };
