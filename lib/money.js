// The Ledger's extra live blocks (Parth, 30 Sep 2026): what traders expect (prediction markets on the Fed, the RBI,
// oil, gold and Bitcoin), the day's institutional money flows, and, in lib/live.js movers, the market's breadth.
// Every getter returns {ok, value, source, as_of, stale}; the page hides a block whose source fails.
import { config, getJSON, getText } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });
const DAY = 864e5;

// ---------------------------------------------------------------- what traders expect
// Config markets.traders.topics names only topics: a Polymarket tag and a title pattern. The market itself is found
// each time: the open event that matches, has traded enough, and resolves soonest while still at least
// min_days away (so a month's oil question is not shown on its last day, when it is already settled).
export function pickEvent(events, t, now = Date.now()) {
  const re = new RegExp(t.match, "i");
  return (events || [])
    .filter(e => !e.closed && re.test(e.title || "") && Date.parse(e.endDate) - now >= (t.min_days ?? 0.5) * DAY && (Number(e.volume) || 0) >= (t.min_volume ?? 0))
    .sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate) || (b.volume24hr || 0) - (a.volume24hr || 0))[0] || null;
}
const yes = m => { try { return Number(JSON.parse(m.outcomePrices)[0]); } catch { return NaN; } };

// A decision (Fed, RBI): every outcome with at least 1%, most likely first, with its move over the last day.
export function readDecision(e) {
  return (e.markets || []).filter(m => !m.closed).map(m => ({ label: m.groupItemTitle || m.question, p: yes(m), chg: m.oneDayPriceChange ?? null }))
    .filter(o => Number.isFinite(o.p) && o.p >= 0.01).sort((a, b) => b.p - a.p);
}

// Price levels (oil, gold, Bitcoin): of the still-open levels (5% to 95%), the three the market is least sure about
// (closest to even), with at least one on each side when both exist, shown low to high. "↑ $95" reads
// "reaches $95", "↓ $90" reads "dips to $90".
export function readLevels(e, max = 3) {
  return (e.markets || []).filter(m => !m.closed).map(m => {
    const g = String(m.groupItemTitle || ""), up = g.includes("↑"), down = g.includes("↓");
    const level = Number(g.replace(/[^\d.]/g, "")), shown = g.replace(/[↑↓]\s*/, "").trim();
    return { up, down, level, label: `${up ? "reaches" : down ? "dips to" : ""} ${shown}`.trim(), p: yes(m), vol: Number(m.volume24hr) || 0 };
  }).filter(x => (x.up || x.down) && Number.isFinite(x.level) && x.p >= 0.05 && x.p <= 0.95)
    .sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5) || b.vol - a.vol)
    .reduce((pick, x, i, all) => {
      if (pick.length >= max) return pick;
      const left = max - pick.length, needUp = !pick.some(p => p.up) && all.some(p => p.up), needDown = !pick.some(p => p.down) && all.some(p => p.down);
      if (left === 1 && ((needUp && !x.up) || (needDown && !x.down))) return pick;
      return [...pick, x];
    }, [])
    .sort((a, b) => a.level - b.level)
    .map(({ label, p, level, up }) => ({ label, p, level, direction: up ? "up" : "down" }));
}

// Kalshi's own market on the same decision, as a second opinion: the event in the series that closes within two
// days of Polymarket's, each outcome at the middle of its bid and ask (or its last trade).
async function kalshi(series, ends) {
  const j = await getJSON(`https://api.elections.kalshi.com/trade-api/v2/events?status=open&series_ticker=${encodeURIComponent(series)}&limit=10`, { timeout: 8000 });
  const ev = (j.events || []).find(e => Math.abs(Date.parse(e.strike_date || e.close_time || "") - Date.parse(ends)) < 3 * DAY) || null;
  const tick = ev?.event_ticker || (j.events || [])[0]?.event_ticker;
  if (!tick) throw new Error("kalshi: no open event");
  const m = await getJSON(`https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=${encodeURIComponent(tick)}`, { timeout: 8000 });
  const price = x => { const b = Number(x.yes_bid_dollars), a = Number(x.yes_ask_dollars), l = Number(x.last_price_dollars); return b > 0 && a > 0 && a - b <= 0.1 ? (a + b) / 2 : l; };
  const out = (m.markets || []).filter(x => x.status === "active").map(x => ({ label: x.yes_sub_title, p: price(x), close: x.close_time })).filter(o => Number.isFinite(o.p) && o.p >= 0.02).sort((a, b) => b.p - a.p);
  if (!out.length) throw new Error("kalshi: no prices");
  if (ends && Math.abs(Date.parse(out[0].close || m.markets[0].close_time) - Date.parse(ends)) > 3 * DAY) throw new Error("kalshi: a different meeting");
  return { event: tick, url: `https://kalshi.com/markets/${series.toLowerCase()}`, outcomes: out.map(({ label, p }) => ({ label, p })) };
}

export async function traders() {
  try {
    const T = config().markets?.traders?.topics || [];
    const now = Date.now();
    const byTag = {};
    const eventsFor = tag => (byTag[tag] ||= getJSON(`https://gamma-api.polymarket.com/events?closed=false&tag_slug=${encodeURIComponent(tag)}&limit=100&order=volume24hr&ascending=false`, { timeout: 9000 }));
    const topics = (await Promise.all(T.map(async t => {
      try {
        const e = pickEvent(await eventsFor(t.tag), t, now);
        if (!e) return null;
        const read = t.kind === "levels" ? readLevels(e) : readDecision(e);
        if (!read.length) return null;
        const out = { id: t.id, label: t.label, question: e.title, ends: e.endDate, url: `https://polymarket.com/event/${e.slug}`, volume: Math.round(Number(e.volume) || 0), kind: t.kind || "decision" };
        out[t.kind === "levels" ? "levels" : "outcomes"] = read;
        if (t.kalshi) out.kalshi = await kalshi(t.kalshi, e.endDate).catch(err => ({ error: String(err.message || err) }));
        return out;
      } catch { return null; }
    }))).filter(Boolean);
    if (!topics.length) throw new Error("traders: no market found for any topic");
    return ok({ topics }, "Polymarket, Kalshi");
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------- institutional money flows
// Two official publishers, two different measures, each labelled as such:
// - NSE's provisional figures for the day: net buying of foreign (FII/FPI) and domestic (DII) institutions in the
//   cash market (all exchanges when NSE's combined report answers, NSE alone otherwise).
// - NSDL's daily FPI report (custodian-confirmed): foreign net investment in Indian equity, summed for the month.
const NUM = s => { const t = String(s).trim(); const n = Number(t.replace(/[(),]/g, "")); return /^\(.*\)$/.test(t) ? -n : n; };
export function parseNseFlows(rows) {
  const f = (rows || []).find(r => /FII|FPI/i.test(r.category)), d = (rows || []).find(r => /^DII/i.test(r.category));
  if (!f || !d) throw new Error("nse flows: rows missing");
  const date = new Date(`${f.date} 12:00 UTC`);
  if (isNaN(date)) throw new Error("nse flows: date");
  return { date: date.toISOString().slice(0, 10), fii: NUM(f.netValue), dii: NUM(d.netValue), fii_buy: NUM(f.buyValue), fii_sell: NUM(f.sellValue), dii_buy: NUM(d.buyValue), dii_sell: NUM(d.sellValue) };
}
export function parseNsdlMonth(html) {
  const t = html.replace(/<[^>]+>/g, " | ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const days = [];
  for (const m of t.matchAll(/(\d{2}-[A-Za-z]{3}-\d{4}) \| \| Equity \|(.*?)Sub-total \| \| ([\d.,()]+) \| \| ([\d.,()]+) \| \| ([\d.,()-]+) \|/g)) {
    const d = new Date(`${m[1]} 12:00 UTC`);
    if (!isNaN(d)) days.push({ date: d.toISOString().slice(0, 10), net: NUM(m[5]) });
  }
  if (!days.length) throw new Error("nsdl: no equity rows");
  const month = days.at(-1).date.slice(0, 7), mine = days.filter(x => x.date.startsWith(month));
  return { month, net: Math.round(mine.reduce((a, x) => a + x.net, 0) * 100) / 100, days: mine.length, latest: mine.at(-1) };
}

const BROWSER = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", referer: "https://www.nseindia.com/reports/fii-dii", accept: "application/json, text/plain, */*" };
async function nseFlows() {
  for (const [path, scope] of [["fiidiiTradeReact", "NSE, BSE and MSEI"], ["fiidiiTradeNse", "NSE"]]) {
    try { return { ...parseNseFlows(await getJSON(`https://www.nseindia.com/api/${path}`, { timeout: 8000, headers: BROWSER })), scope, source: "NSE (provisional)", url: "https://www.nseindia.com/reports/fii-dii" }; }
    catch {}
  }
  throw new Error("nse flows unavailable");
}
async function nsdlMonth() {
  const html = await getText("https://www.fpi.nsdl.co.in/web/Reports/Monthly.aspx", { timeout: 10000, headers: { "user-agent": BROWSER["user-agent"] } });
  return { ...parseNsdlMonth(html), source: "NSDL", url: "https://www.fpi.nsdl.co.in/web/Reports/Monthly.aspx" };
}
export async function flows() {
  const [a, b] = await Promise.allSettled([nseFlows(), nsdlMonth()]);
  if (a.status === "rejected" && b.status === "rejected") return fail(`${a.reason?.message} | ${b.reason?.message}`);
  return ok({ day: a.status === "fulfilled" ? a.value : null, fpi_month: b.status === "fulfilled" ? b.value : null }, [a.status === "fulfilled" && "NSE", b.status === "fulfilled" && "NSDL"].filter(Boolean).join(", "));
}

export const MONEY = { traders, flows };
export const MONEY_CACHE = { traders: [600, 1800], flows: [1800, 7200] };
