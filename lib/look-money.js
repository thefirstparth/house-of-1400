// The trial's money feeds (Money as a Market Pulse, /?trial, 27 Nov 2026), behind /api/live/look_*. Every key returns
// {ok, value, source, as_of, stale}. Nothing here reaches the live paper: only the trial's Money desk reads these keys.
//   look_rates        the two policy rates (a table of facts, below) and the US 10-year yield (Yahoo ^TNX, else the US
//                     Treasury's own daily par yield)
//   look_commodities  silver, natural gas and copper (Yahoo, front-month COMEX/NYMEX futures), each in its own unit
// A failed source drops its own item; the page hides that card (never a wrong or empty figure).
import { getJSON, getText } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });
const r4 = v => Math.round(v * 1e4) / 1e4;

// ================================================================ FACTS: THE POLICY RATES (update by hand)
// These change only at a scheduled decision, so they are a table, not a feed. Each entry is checked against the central
// bank's own pages (the evidence line says which). A card shows only until `next_at`, the moment its next decision is
// announced: if this table has not been updated by then, the card hides itself (better hidden than wrong). To update
// after a decision: change value, move, set_on, next_decision, next_at, checked and evidence, from the bank's own release.
export const POLICY_RATES = [
  {
    id: "repo", label: "RBI repo rate", short: "RBI",
    value: "5.50%", move: "Raised 0.25 pts", set_on: "2026-10-07",
    next_decision: "2026-12-04", next_at: "2026-12-04T04:30:00Z", // the MPC's resolution, 10:00 IST on the last day of its meeting
    checked: "2026-11-27",
    source: "Reserve Bank of India", url: "https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63839",
    evidence: "RBI home page, Current Rates: Policy Repo Rate 5.50% (read 27 Nov 2026). Minutes of the MPC meeting of 5 to 7 Oct 2026: repo raised by 25 bps to 5.50%; next meeting 2 to 4 Dec 2026.",
  },
  {
    id: "fed", label: "Fed funds rate", short: "Fed",
    value: "3.75–4.00%", move: "Held", set_on: "2026-10-28",
    next_decision: "2026-12-09", next_at: "2026-12-09T19:00:00Z", // the FOMC statement, 14:00 New York time
    checked: "2026-11-27",
    source: "Federal Reserve", url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
    evidence: "FOMC statement, 28 Oct 2026: target range maintained at 3-3/4 to 4 percent (raised to it on 16 Sep 2026). FOMC calendar: next meeting 8 to 9 Dec 2026.",
  },
];
// The entries still good at `now` (their next decision not yet announced)
export const policyRates = (now = Date.now(), table = POLICY_RATES) => table.filter(p => Date.parse(p.next_at) > now);

// ================================================================ Yahoo daily charts
const tzDate = (sec, tz) => new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
// A Yahoo v8 chart (interval 1d) as a quote: price, the previous close (or, for futures, the previous settlement passed
// in from the 1-day chart, since a future's daily bars lag a day), the session's date and a one-month line of closes.
// Null closes are dropped, never charted. `live`: a print within 45 minutes, and for anything but a future also inside
// the exchange's trading period (Yahoo's period for a future is a day stale, while its prints are current).
export function parseChart(j, { prevClose = null, now = Date.now() } = {}) {
  const r = j?.chart?.result?.[0], m = r?.meta;
  if (!m || typeof m.regularMarketPrice !== "number" || !isFinite(m.regularMarketPrice)) throw new Error("yahoo shape");
  const tz = m.exchangeTimezoneName, cl = r.indicators?.quote?.[0]?.close || [];
  const bars = (r.timestamp || []).map((t, i) => ({ d: tzDate(t, tz), c: cl[i] })).filter(b => typeof b.c === "number" && isFinite(b.c));
  const session = tzDate(m.regularMarketTime, tz), price = m.regularMarketPrice;
  const before = bars.filter(b => b.d < session);
  const prev = typeof prevClose === "number" && prevClose > 0 ? prevClose : before.at(-1)?.c ?? null;
  const series = before.concat([{ d: session, c: price }]);
  const cut = new Date(Date.parse(session + "T00:00:00Z") - 31 * 864e5).toISOString().slice(0, 10);
  const month = series.filter(b => b.d >= cut);
  const p = m.currentTradingPeriod?.regular, t = now / 1000;
  const fresh = t - m.regularMarketTime < 45 * 60;
  const live = fresh && (m.instrumentType === "FUTURE" || (!!p && t >= p.start && t <= p.end));
  return {
    symbol: m.symbol, price, prev, change: prev != null ? r4(price - prev) : null, change_pct: prev ? r4((price / prev - 1) * 100) : null,
    session_date: session, market_time: new Date(m.regularMarketTime * 1000).toISOString(), live, currency: m.currency || null,
    spark30: month.map(b => r4(b.c)), spark_from: month[0]?.d || null, spark_to: month.at(-1)?.d || null,
  };
}
const yUrl = (h, s, range) => `https://${h}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${range}&interval=1d&includePrePost=false`;
async function yahoo(symbol, { future = false } = {}) {
  let j, err;
  // Yahoo answers 429 to a full browser user-agent without cookies; a plain one gets through (lib/live.js)
  for (const h of ["query1", "query2"]) { try { j = await getJSON(yUrl(h, symbol, "3mo"), { timeout: 6000, headers: { "user-agent": "Mozilla/5.0" } }); break; } catch (e) { err = e; } }
  if (!j) throw err;
  let prevClose = null;
  if (future) {
    try {
      const d = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1h`, { timeout: 5000, headers: { "user-agent": "Mozilla/5.0" } });
      prevClose = d?.chart?.result?.[0]?.meta?.previousClose ?? null;
    } catch {}
  }
  return parseChart(j, { prevClose });
}
const inRange = (q, [lo, hi]) => q && q.price >= lo && q.price <= hi && (q.prev == null || (q.prev >= lo && q.prev <= hi));

// ================================================================ the US 10-year yield
// The US Treasury's daily par yield curve (CSV, one row a business day, newest first): the 10 Yr column.
export function parseTreasury(csv) {
  const lines = String(csv || "").trim().split(/\r?\n/);
  const head = (lines.shift() || "").split(",").map(s => s.replace(/"/g, "").trim());
  const col = head.indexOf("10 Yr");
  if (col < 0) throw new Error("treasury: no 10 Yr column");
  return lines.map(l => l.split(",")).map(c => {
    const [mo, d, y] = (c[0] || "").split("/"), v = Number(c[col]);
    return mo && y && c[col] !== "" && isFinite(v) ? { d: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, c: v } : null;
  }).filter(Boolean).sort((a, b) => a.d.localeCompare(b.d));
}
export function treasuryQuote(rows) {
  if (rows.length < 2) throw new Error("treasury: too few rows");
  const last = rows.at(-1), prev = rows.at(-2);
  const cut = new Date(Date.parse(last.d + "T00:00:00Z") - 31 * 864e5).toISOString().slice(0, 10), month = rows.filter(b => b.d >= cut);
  return { symbol: "UST10Y", price: last.c, prev: prev.c, change: r4(last.c - prev.c), change_pct: r4((last.c / prev.c - 1) * 100), session_date: last.d, market_time: null, live: false, spark30: month.map(b => b.c), spark_from: month[0]?.d, spark_to: last.d };
}
const TSY = y => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
async function treasury10() {
  const y = new Date().getUTCFullYear();
  let rows = parseTreasury(await getText(TSY(y), { timeout: 7000 }));
  if (rows.length < 22) { try { rows = parseTreasury(await getText(TSY(y - 1), { timeout: 7000 })).concat(rows); } catch {} }
  return treasuryQuote(rows);
}
const Y10 = [0.1, 20]; // percent; anything outside is a broken reading, not a market
async function us10y() {
  const errs = [];
  try { const q = await yahoo("^TNX"); if (inRange(q, Y10)) return { ...q, source: "Yahoo Finance" }; errs.push("tnx range"); } catch (e) { errs.push(String(e.message)); }
  try { const q = await treasury10(); if (inRange(q, Y10)) return { ...q, source: "US Treasury" }; errs.push("treasury range"); } catch (e) { errs.push(String(e.message)); }
  throw new Error(errs.join(" | "));
}

export async function look_rates() {
  const policy = policyRates();
  let y10 = null, err = null;
  try { y10 = await us10y(); } catch (e) { err = e; }
  if (!policy.length && !y10) return fail(err || "no rates");
  return ok({ policy, us10y: y10 }, [policy.length && "RBI, Federal Reserve", y10?.source].filter(Boolean).join(", "));
}

// ================================================================ silver, natural gas, copper
// Front-month futures, in the contract's own unit; never converted into rupees with a guessed rate.
export const COMMODITIES = [
  { id: "silver", name: "Silver", symbol: "SI=F", unit: "$ per ounce", market: "COMEX", range: [5, 400], dp: 2 },
  { id: "natgas", name: "Natural gas", symbol: "NG=F", unit: "$ per MMBtu", market: "NYMEX", range: [0.5, 40], dp: 3 },
  { id: "copper", name: "Copper", symbol: "HG=F", unit: "$ per lb", market: "COMEX", range: [0.5, 25], dp: 3 },
];
export async function look_commodities() {
  const out = await Promise.all(COMMODITIES.map(async c => {
    try { const q = await yahoo(c.symbol, { future: true }); return inRange(q, c.range) && q.spark30.length >= 2 ? { id: c.id, name: c.name, unit: c.unit, market: c.market, dp: c.dp, ...q, source: "Yahoo Finance" } : null; }
    catch { return null; }
  }));
  const items = out.filter(Boolean);
  if (!items.length) return fail("no commodity answered");
  return ok({ items }, "Yahoo Finance");
}

export const LOOK_MONEY = { look_rates, look_commodities };
// [s-maxage, stale-while-revalidate] seconds: the paper refreshes every five minutes; these move slowly enough for ten
export const LOOK_MONEY_CACHE = { look_rates: [600, 1800], look_commodities: [600, 1800] };
