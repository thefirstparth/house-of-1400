// The trial's money feeds (Money as a Market Pulse, /?trial, 27 Nov 2026), behind /api/live/look_*. Every key returns
// {ok, value, source, as_of, stale}. Nothing here reaches the live paper: only the trial's Money desk reads these keys.
//   look_rates        the two policy rates (a table of facts, below) and the US 10-year yield (Yahoo ^TNX, else the US
//                     Treasury's own daily par yield)
//   look_commodities  silver, natural gas and copper (Yahoo, front-month COMEX/NYMEX futures), each in its own unit
// A failed source drops its own item; the page hides that card (never a wrong or empty figure).
import { config, getJSON, getText } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });
const r4 = v => Math.round(v * 1e4) / 1e4;

// ================================================================ THE POLICY RATES (live, from the banks themselves)
// Each rate is read from its central bank's own page, with a backup, and a hand-checked table as the last resort:
//   RBI repo   the RBI's home page ("Policy Repo Rate : 5.50%"), else the table below
//   Fed funds  the FOMC's own statement for its last decision (the calendar says which day; the statement says what was
//              decided and the range), else the New York Fed's daily EFFR record (the range in force each day), else the
//              table below
// A rate is never shown across a decision it cannot see: in the hours after a decision, until the source has caught up,
// that card is hidden (better hidden than wrong). The table is used only until its next decision is announced.
// To update the table after a decision: change rate, value, move, set_on, next_decision, next_at, checked and evidence.
export const POLICY_RATES = [
  {
    id: "repo", label: "RBI repo rate", short: "RBI",
    rate: 5.5, value: "5.50%", move: "Raised 0.25 pts", set_on: "2026-10-07",
    next_decision: "2026-12-04", next_at: "2026-12-04T04:30:00Z", // the MPC's resolution, 10:00 IST on the last day of its meeting
    checked: "2026-11-27",
    source: "Reserve Bank of India", url: "https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63839",
    evidence: "RBI home page, Current Rates: Policy Repo Rate 5.50% (read 27 Nov 2026). Minutes of the MPC meeting of 5 to 7 Oct 2026: repo raised by 25 bps to 5.50%; next meeting 2 to 4 Dec 2026.",
  },
  {
    id: "fed", label: "Fed funds rate", short: "Fed",
    lower: 3.75, upper: 4, value: "3.75–4.00%", move: "Held", set_on: "2026-10-28",
    next_decision: "2026-12-09", next_at: "2026-12-09T19:00:00Z", // the FOMC statement, 14:00 New York time
    checked: "2026-11-27",
    source: "Federal Reserve", url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
    evidence: "FOMC statement, 28 Oct 2026: target range maintained at 3-3/4 to 4 percent (raised to it on 16 Sep 2026). FOMC calendar: next meeting 8 to 9 Dec 2026.",
  },
];
// The table's entries still good at `now` (their next decision not yet announced)
export const policyRates = (now = Date.now(), table = POLICY_RATES) => table.filter(p => Date.parse(p.next_at) > now);

// The MPC's decision days, from the RBI's published schedule (the resolution is out at 10:00 IST). Past ones stay: they
// tell a held rate from a changed one. Add the next year's dates when the RBI publishes its schedule.
export const RBI_DECISIONS = ["2026-08-05", "2026-10-07", "2026-12-04"];
const rbiAt = d => Date.parse(`${d}T04:30:00Z`);
const RBI_SETTLE = 3 * 36e5; // the home page's Current Rates are trusted again three hours after a decision

const flatText = html => String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
export function parseRbiRepo(html) {
  const v = Number(flatText(html).match(/Policy Repo Rate\s*:\s*([\d.]+)\s*%/i)?.[1]);
  if (!(v > 0 && v < 20)) throw new Error("rbi: no repo rate");
  return v;
}
const pts = d => `${Math.abs(Math.round(d * 100) / 100).toFixed(2)} pts`;
// The repo card from the live rate, the table and the decision days. The move and its day are said only when they can be
// known: from the table while it is current, or worked out when exactly one decision has passed since the table's.
export function repoFrom(rate, { now = Date.now(), table = POLICY_RATES.find(p => p.id === "repo"), days = RBI_DECISIONS } = {}) {
  const passed = days.filter(d => rbiAt(d) <= now), last = passed.at(-1);
  if (last && now - rbiAt(last) < RBI_SETTLE) return null; // just decided: the page may not have caught up
  const next = days.find(d => rbiAt(d) > now) || null;
  let move = null, set_on = null;
  const since = passed.filter(d => d > table.set_on);
  if (!since.length && rate === table.rate) [move, set_on] = [table.move, table.set_on];
  else if (since.length === 1) [move, set_on] = [rate === table.rate ? "Held" : `${rate > table.rate ? "Raised" : "Cut"} ${pts(rate - table.rate)}`, since[0]];
  return {
    id: "repo", label: "RBI repo rate", short: "RBI", rate, value: `${rate.toFixed(2)}%`, move, set_on,
    next_decision: next, next_at: next ? new Date(rbiAt(next)).toISOString() : null,
    source: "Reserve Bank of India", url: "https://www.rbi.org.in/", live: true,
  };
}

// ----- the Fed
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// The FOMC calendar page: each year's panel lists its meetings ("October" "27-28*"); the decision is on the last day.
export function parseFomcCalendar(html) {
  const out = [], s = String(html || ""), heads = [...s.matchAll(/(\d{4}) FOMC Meetings/g)];
  heads.forEach((h, i) => {
    const panel = s.slice(h.index, heads[i + 1]?.index ?? s.length), y = Number(h[1]);
    for (const m of panel.matchAll(/fomc-meeting__month[^>]*>\s*<strong>([A-Za-z/]+)<\/strong>[\s\S]{0,400}?fomc-meeting__date[^>]*>\s*([\d][\d\-*]*)/g)) {
      const mo = MONTHS.indexOf(m[1].split("/").pop().slice(0, 3).toLowerCase()), d = Number(m[2].replace(/\*/g, "").split("-").pop());
      if (mo >= 0 && d >= 1 && d <= 31) out.push(`${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  });
  if (!out.length) throw new Error("fomc calendar: no meetings");
  return [...new Set(out)].sort();
}
// 14:00 in New York on a day, as an instant (daylight saving included)
export function fomcAt(day) {
  const guess = Date.parse(`${day}T14:00:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return guess + (guess - shown);
}
// "3-3/4" -> 3.75, "4" -> 4, "1/4" -> 0.25
export const fedFrac = s => { const m = String(s).trim().match(/^(?:(\d+)(?:-(\d+)\/(\d+))?|(\d+)\/(\d+))$/); if (!m) return NaN; return m[4] ? m[4] / m[5] : Number(m[1]) + (m[2] ? m[2] / m[3] : 0); };
// The statement: "The Committee decided to maintain the target range for the federal funds rate at 3-3/4 to 4 percent"
// (or "to raise ... by 1/4 percentage point to ...").
export function parseFomcStatement(html) {
  const m = flatText(html).match(/Committee decided to (maintain|raise|increase|lower|reduce|cut) the target range for the federal funds rate (?:by ([\d\-/]+) percentage points? )?(?:at|to) ([\d\-/]+) to ([\d\-/]+) percent/i);
  if (!m) throw new Error("fomc statement: no decision");
  const lower = fedFrac(m[3]), upper = fedFrac(m[4]), by = m[2] ? fedFrac(m[2]) : null;
  if (!(lower >= 0 && upper > lower && upper < 20)) throw new Error("fomc statement: range");
  const kind = /maintain/i.test(m[1]) ? "Held" : /raise|increase/i.test(m[1]) ? "Raised" : "Cut";
  return { lower, upper, move: kind === "Held" || by == null ? kind : `${kind} ${pts(by)}` };
}
// The New York Fed's EFFR record: the target range in force each business day, newest last after sorting.
export function parseEffr(j) {
  const rows = (j?.refRates || []).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate) && isFinite(r.targetRateFrom) && isFinite(r.targetRateTo)).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  if (!rows.length) throw new Error("effr: no rows");
  const now = rows.at(-1), same = r => r.targetRateFrom === now.targetRateFrom && r.targetRateTo === now.targetRateTo;
  let i = rows.length - 1; while (i > 0 && same(rows[i - 1])) i--;
  return { lower: now.targetRateFrom, upper: now.targetRateTo, since: rows[i].effectiveDate, before: i > 0 ? rows[i - 1].targetRateTo : null, last: now.effectiveDate };
}
const fedValue = (lo, hi) => `${lo.toFixed(2)}–${hi.toFixed(2)}%`;
// The Fed card from what answered: the statement (st) for the last decision, or the EFFR record (e), with the calendar
export function fedFrom({ cal = null, st = null, e = null, now = Date.now(), table = POLICY_RATES.find(p => p.id === "fed") } = {}) {
  const past = (cal || []).filter(d => fomcAt(d) <= now), last = past.at(-1) || null, next = (cal || []).find(d => fomcAt(d) > now) || null;
  const base = { id: "fed", label: "Fed funds rate", short: "Fed", next_decision: next, next_at: next ? new Date(fomcAt(next)).toISOString() : null, live: true };
  if (st && last) return { ...base, lower: st.lower, upper: st.upper, value: fedValue(st.lower, st.upper), move: st.move, set_on: last, source: "Federal Reserve", url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary${last.replace(/-/g, "")}a.htm` };
  if (e && cal) {
    if (last && e.last <= last) return null; // the record does not yet reach past the last decision: its outcome is unknown
    // the range took effect the day after its decision
    const set = [...past].reverse().find(d => d < e.since && Date.parse(e.since) - Date.parse(d) <= 4 * 864e5) || null;
    const moved = e.before == null ? null : e.upper > e.before ? `Raised ${pts(e.upper - e.before)}` : e.upper < e.before ? `Cut ${pts(e.upper - e.before)}` : null;
    const [move, set_on] = last && set && last > set ? ["Held", last] : [moved, set];
    return { ...base, lower: e.lower, upper: e.upper, value: fedValue(e.lower, e.upper), move, set_on, source: "New York Fed", url: "https://www.newyorkfed.org/markets/reference-rates/effr" };
  }
  if (table && Date.parse(table.next_at) > now) return { ...table, live: false };
  return null;
}
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
async function fedRate(now = Date.now()) {
  let cal = null, st = null, e = null;
  try { cal = parseFomcCalendar(await getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", { timeout: 7000, headers: UA })); } catch {}
  const last = (cal || []).filter(d => fomcAt(d) <= now).at(-1);
  if (last) { try { st = parseFomcStatement(await getText(`https://www.federalreserve.gov/newsevents/pressreleases/monetary${last.replace(/-/g, "")}a.htm`, { timeout: 7000, headers: UA })); } catch {} }
  if (!st) { try { e = parseEffr(await getJSON(`https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=${isoDay(now - 400 * 864e5)}&endDate=${isoDay(now)}`, { timeout: 7000 })); } catch {} }
  return fedFrom({ cal, st, e, now });
}
async function repoRate(now = Date.now()) {
  try { return repoFrom(parseRbiRepo(await getText("https://www.rbi.org.in/", { timeout: 8000, headers: UA })), { now }); }
  catch { const t = policyRates(now).find(p => p.id === "repo"); return t ? { ...t, live: false } : null; }
}

// ----- what traders expect of the next decision (Polymarket), a forecast and labelled as one
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ODDS_Q = { repo: m => `Reserve Bank of India decision in ${m}`, fed: m => `Fed decision in ${m}` };
const outcomeWords = s => {
  const t = String(s || "").trim();
  if (/no change|maintain/i.test(t)) return "no change";
  const m = t.match(/(\d+)(\+)?\s*bps?\s*(increase|hike|raise|decrease|cut)/i);
  if (!m) return t.toLowerCase();
  const size = (m[1] / 100).toFixed(2).replace(/0$/, ""), up = /increase|hike|raise/i.test(m[3]);
  return m[2] ? `a ${up ? "rise" : "cut"} of ${size} pts or more` : `a ${size} pt ${up ? "rise" : "cut"}`;
};
// The event about this very decision (its title names the month, it ends within two days of it), and its leading outcome
export function pickOdds(events, { id, decision }) {
  if (!decision) return null;
  const month = MONTH_NAMES[Number(decision.slice(5, 7)) - 1], want = new RegExp(`^${id === "fed" ? "Fed" : "Reserve Bank of India"} decision in ${month}\\b`, "i");
  const ev = (events || []).find(e => want.test(String(e.title || "").trim()) && Math.abs(Date.parse(e.endDate) - Date.parse(`${decision}T12:00:00Z`)) <= 2 * 864e5 && !e.closed);
  if (!ev) return null;
  const outs = (ev.markets || []).filter(m => m.active !== false && !m.closed).map(m => { let p; try { p = Number(JSON.parse(m.outcomePrices)[0]); } catch { p = NaN; } return { name: m.groupItemTitle, prob: p * 100 }; }).filter(o => o.name && o.prob >= 0 && o.prob <= 100);
  if (outs.length < 2) return null;
  const lead = outs.sort((a, b) => b.prob - a.prob)[0];
  return { prob: Math.round(lead.prob), outcome: outcomeWords(lead.name), vol: Math.round(Number(ev.volume) || 0), source: "Polymarket", url: `https://polymarket.com/event/${ev.slug}`, decision };
}
async function oddsFor(p) {
  if (!p?.next_decision) return null;
  try {
    const q = ODDS_Q[p.id](MONTH_NAMES[Number(p.next_decision.slice(5, 7)) - 1]);
    const j = await getJSON(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}&limit_per_type=10&events_status=active`, { timeout: 6000 });
    return pickOdds(j?.events, { id: p.id, decision: p.next_decision });
  } catch { return null; }
}

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
  const now = Date.now();
  const [repo, fed, y10] = await Promise.all([repoRate(now).catch(() => null), fedRate(now).catch(() => null), us10y().catch(e => ({ err: e }))]);
  const policy = [repo, fed].filter(Boolean);
  await Promise.all(policy.map(async p => { const o = await oddsFor(p); if (o) p.odds = o; }));
  const us = y10?.err ? null : y10;
  if (!policy.length && !us) return fail(y10?.err || "no rates");
  return ok({ policy, us10y: us }, [...new Set(policy.map(p => p.source)), us?.source].filter(Boolean).join(", "));
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

// ================================================================ the day's line on every card (look_daylines)
// Yahoo's spark (the same unofficial, keyless endpoint the paper's markets feed uses): five-minute closes for each card's
// symbol, its latest session only (what follows its last long gap, 24 hours at most). A closed market keeps its last
// session; one with nothing under "1d" is asked again for five days. The page draws the line against the card's own
// previous close, so the line and the figure beside it always agree, and drops a line whose end is far from the card's price.
const SPARK = (syms, range, interval) => `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${syms.map(encodeURIComponent).join(",")}&range=${range}&interval=${interval}`;
export const chartSymbols = (cfg = config()) => [...new Set([...(cfg.markets?.indices || []).map(i => i.yahoo), ...(cfg.markets?.cross || []).map(c => c.yahoo), ...COMMODITIES.map(c => c.symbol)].filter(Boolean))];
const thin = (a, most) => (a.length <= most ? a : Array.from({ length: most }, (_, i) => a[Math.round((i * (a.length - 1)) / (most - 1))]));
// one symbol's spark series -> its latest session, or null. The rupee and Bitcoin never shut on a weekday, and Yahoo's
// rupee goes hours without a print: theirs is the last 24 hours, quiet stretches and all.
export const ROUND_CLOCK = ["INR=X", "BTC-USD"];
export function lastSession(series, most = 78, allDay = ROUND_CLOCK.includes(series?.symbol)) {
  const rows = (series?.timestamp || []).map((t, i) => [t, series.close?.[i]]).filter(([t, c]) => typeof t === "number" && typeof c === "number" && isFinite(c));
  if (rows.length < 2) return null;
  const end = rows.at(-1)[0];
  let i = rows.length - 1; while (i > 0 && (allDay || rows[i][0] - rows[i - 1][0] < 3 * 3600) && rows[i - 1][0] >= end - 86400) i--;
  const s = rows.slice(i);
  if (s.length < 2) return null;
  return { t0: s[0][0], t1: end, points: thin(s.map(r => r[1]), most).map(r4), prev: typeof series.chartPreviousClose === "number" ? series.chartPreviousClose : null, day_pct: typeof series.fulldayChangePercent === "number" ? r4(series.fulldayChangePercent) : null };
}
export function parseSpark(j) {
  const out = {};
  for (const [sym, v] of Object.entries(j || {})) { const s = lastSession(v); if (s) out[sym] = s; }
  return out;
}
async function sparkOf(syms, range, interval) {
  const out = {};
  for (let i = 0; i < syms.length; i += 20) {
    try { Object.assign(out, await getJSON(SPARK(syms.slice(i, i + 20), range, interval), { timeout: 7000, headers: { "user-agent": "Mozilla/5.0" } })); } catch {}
  }
  return out;
}
export async function look_daylines() {
  const syms = chartSymbols();
  const lines = parseSpark(await sparkOf(syms, "1d", "5m"));
  const missing = syms.filter(s => !lines[s]);
  if (missing.length) Object.assign(lines, parseSpark(await sparkOf(missing, "5d", "15m")));
  if (!Object.keys(lines).length) return fail("no day lines");
  return ok({ lines }, "Yahoo Finance");
}

// ================================================================ why a market moved (look_why)
// On a day a region's indices move 1% or more on average, the most recent headline about that close from Google News
// (the same search a reader would run), from a publisher the reader knows where one has it. Only a headline that agrees
// with the move (a fall for a fall), is about the day (not the week or what comes next) and was published after that
// session opened. It is printed as the headline it is, with its publisher: the paper does not claim to know why.
export const WHY = {
  India: { q: "Sensex Nifty close", hl: "en-IN", gl: "IN", ceid: "IN:en", about: /\b(sensex|nifty|dalal street|d-street|indian (stocks?|shares|equit\w*|markets?))\b/i },
  US: { q: "Wall Street stocks close", hl: "en-US", gl: "US", ceid: "US:en", about: /\b(wall street|s&p 500|s&p|nasdaq|dow|u\.?s\.? stocks)\b/i },
};
const KNOWN = /reuters|bloomberg|moneycontrol|business standard|economic times|the economic times|livemint|mint|hindu ?businessline|businessline|financial express|ndtv profit|business today|cnbc|hindustan times|the hindu|indian express|times of india|associated press|ap news|wall street journal|financial times|marketwatch|barron/i;
const DOWN = /\b(fall|falls|fell|slip|slips|slipped|drop|drops|dropped|decline|declines|declined|tumble|tumbles|tumbled|slide|slides|slid|sink|sinks|sank|plunge|plunges|plunged|crash|crashes|slump|slumps|slumped|lower|in red|in the red|drag|drags|dragged|losses|lose|loses|lost|tank|tanks|tanked|retreat|retreats|selloff|sell-off|weak|down)\b/i;
const UP = /\b(rise|rises|rose|gain|gains|gained|jump|jumps|jumped|surge|surges|surged|rally|rallies|rallied|climb|climbs|climbed|soar|soars|soared|higher|in green|in the green|advance|advances|advanced|rebound|rebounds|rebounded|up|record high|extend gains)\b/i;
// the week is allowed only in a report on the close ("ends higher in a volatile week"), not a weekly round-up
const WEEK = /\b(week|weekly)\b/i, CLOSE = /\b(ends?|ended|clos(e|es|ed|ing)|settles?|settled|finish(es|ed)?|closing bell)\b/i;
const NOT_THE_DAY = /\b(month|monthly|ytd|outlook|preview|ahead|tomorrow|next|expect|forecast|prediction|to watch|to buy|stocks to|levels|strategy|what to|live updates?|live blog|explained|opinion|opens?|opening|pre-?market|early trade|midday|mid-session|intraday)\b|\?/i;
const ent = s => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/[\uFFFC\uFFFD\u200B]/g, "").trim();
export function parseNewsRss(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const tag = n => it.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1];
    const source = ent(tag("source")), raw = ent(tag("title"));
    const title = source && raw.endsWith(` - ${source}`) ? raw.slice(0, -(source.length + 3)) : raw.replace(/ - [^-]+$/, "");
    return { title, source, url: ent(tag("link")), at: Date.parse(ent(tag("pubDate"))) };
  }).filter(x => x.title && x.url && isFinite(x.at));
}
export function pickHeadline(items, { pct, about, from, to = from, now = Date.now() }) {
  const down = pct < 0, good = (items || []).filter(x => x.at >= from && x.at <= now + 6e5 && about.test(x.title) && !NOT_THE_DAY.test(x.title) && (!WEEK.test(x.title) || CLOSE.test(x.title))
    && (down ? DOWN.test(x.title) && !UP.test(x.title.replace(/\bup\b/i, "")) : UP.test(x.title) && !DOWN.test(x.title)));
  if (!good.length) return null;
  // after the close first (a report on the whole day), then a publisher the reader knows, then the latest
  const rank = x => (x.at >= to ? 2 : 0) + (KNOWN.test(x.source) ? 1 : 0);
  return [...good].sort((a, b) => rank(b) - rank(a) || b.at - a.at)[0];
}
export async function look_why() {
  const cfg = config(), regions = {};
  const ix = (cfg.markets?.indices || []).filter(i => WHY[i.exchange]);
  const spark = parseSpark(await sparkOf(ix.map(i => i.yahoo), "1d", "5m"));
  await Promise.all(Object.keys(WHY).map(async R => {
    const moves = ix.filter(i => i.exchange === R).map(i => spark[i.yahoo]).filter(s => s?.day_pct != null);
    if (!moves.length) return;
    const pct = r4(moves.reduce((a, s) => a + s.day_pct, 0) / moves.length), t0 = Math.min(...moves.map(s => s.t0)) * 1000, t1 = Math.max(...moves.map(s => s.t1)) * 1000;
    const out = { pct, session_from: new Date(t0).toISOString(), headline: null };
    if (Math.abs(pct) >= 1) {
      const W = WHY[R];
      try {
        const xml = await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${W.q} when:2d`)}&hl=${W.hl}&gl=${W.gl}&ceid=${W.ceid}`, { timeout: 7000, headers: { "user-agent": "Mozilla/5.0" } });
        const h = pickHeadline(parseNewsRss(xml), { pct, about: W.about, from: t0, to: t1 });
        if (h) out.headline = { title: h.title, source: h.source, url: h.url, at: new Date(h.at).toISOString() };
      } catch {}
    }
    regions[R] = out;
  }));
  if (!Object.keys(regions).length) return fail("no index moves");
  return ok({ regions }, "Yahoo Finance, Google News");
}

// ================================================================ a card's chart, on a tap (look_chart?sym=&range=)
// Only the paper's own symbols. Six ranges; a day with nothing yet (a holiday, a weekend) shows the last session.
const CHART_RANGES = { "1D": ["1d", "5m"], "5D": ["5d", "15m"], "1M": ["1mo", "60m"], "6M": ["6mo", "1d"], "1Y": ["1y", "1d"], "5Y": ["5y", "1wk"] };
export function parseChartRange(j, range) {
  const r = j?.chart?.result?.[0], m = r?.meta;
  if (!m) throw new Error("yahoo shape");
  const cl = r.indicators?.quote?.[0]?.close || [];
  let pts = (r.timestamp || []).map((t, i) => [t, cl[i]]).filter(([t, c]) => typeof t === "number" && typeof c === "number" && isFinite(c));
  if (range === "1D" && pts.length) {
    // the latest session only: Yahoo's five-day answer, used for a closed day, carries the days before it
    const end = pts.at(-1)[0], allDay = ROUND_CLOCK.includes(m.symbol); let i = pts.length - 1;
    while (i > 0 && (allDay || pts[i][0] - pts[i - 1][0] < 3 * 3600) && pts[i - 1][0] >= end - 86400) i--;
    const prior = pts[i - 1]?.[1] ?? null; pts = pts.slice(i);
    if (pts.length < 2) throw new Error("too few points");
    return { points: thin(pts, 400).map(([t, c]) => [t, r4(c)]), base: prior ?? m.chartPreviousClose ?? m.previousClose ?? null, tz: m.exchangeTimezoneName || null, currency: m.currency || null };
  }
  if (pts.length < 2) throw new Error("too few points");
  return { points: thin(pts, 400).map(([t, c]) => [t, r4(c)]), base: r4(pts[0][1]), tz: m.exchangeTimezoneName || null, currency: m.currency || null };
}
export async function look_chart(params = new URLSearchParams()) {
  const sym = params.get("sym"), range = params.get("range") || "1D";
  if (!chartSymbols().includes(sym) || !CHART_RANGES[range]) return fail("unknown symbol or range");
  const url = (rg, iv) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${rg}&interval=${iv}&includePrePost=false`;
  const get = (rg, iv) => getJSON(url(rg, iv), { timeout: 7000, headers: { "user-agent": "Mozilla/5.0" } });
  try {
    let v;
    if (range === "1D") { try { v = parseChartRange(await get("1d", "5m"), "1D"); v.base = null; } catch { v = parseChartRange(await get("5d", "5m"), "1D"); } }
    else v = parseChartRange(await get(...CHART_RANGES[range]), range);
    return ok({ sym, range, ...v }, "Yahoo Finance");
  } catch (e) { return fail(e); }
}

export const LOOK_MONEY = { look_rates, look_commodities, look_daylines, look_why, look_chart };
// [s-maxage, stale-while-revalidate] seconds: the paper refreshes every five minutes; these move slowly enough for ten
export const LOOK_MONEY_CACHE = { look_rates: [600, 1800], look_commodities: [600, 1800], look_daylines: [240, 900], look_why: [900, 3600], look_chart: [300, 1800] };
