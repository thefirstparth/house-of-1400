// Twelve Data, the money pages' backup source (Parth, 18 Oct 2026: "TwelveData API key was added to the Vercel
// environment as a fallback for all money sources"). Yahoo Finance stays first; an instrument Yahoo does not answer for
// is asked of Twelve Data, one daily series per instrument (one credit), in the same shape lib/live.js's yahooChart
// returns, so the page, the snapshot and the podcast read it the same way. Symbols live in config (markets.indices[] and
// markets.cross[] `twelvedata`); an instrument without one has no backup here.
//
// The key: a Vercel environment variable (any of the names below; only its name is ever reported, never its value).
// The free plan allows 8 credits a minute and 800 a day, so answers are kept for ten minutes in this server and at most
// eight calls go out in any minute; a call over that is refused here rather than spent.

const NAMES = ["TWELVEDATA_KEY", "TWELVEDATA_API_KEY", "TWELVE_DATA_KEY", "TWELVE_DATA_API_KEY", "TWELVEDATA", "TwelveData", "twelvedata", "TWELVE_DATA"];
export function tdKey() {
  for (const n of NAMES) { const v = process.env[n]; if (v && String(v).trim()) return { name: n, value: String(v).trim() }; }
  return null;
}

const BASE = "https://api.twelvedata.com";
const KEPT = new Map(), CALLS = [], HOLD_MS = 10 * 60000, PER_MINUTE = 8;
const clean = (s, key) => String(s || "").split(key || "\u0000").join("…"); // a message never carries the key

async function call(path, key) {
  const now = Date.now();
  while (CALLS.length && now - CALLS[0] > 60000) CALLS.shift();
  if (CALLS.length >= PER_MINUTE) throw new Error("twelvedata: 8 calls this minute already (the free plan's limit)");
  CALLS.push(now);
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(key)}`, { signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!j) throw new Error(`twelvedata: HTTP ${r.status}`);
    if (j.status === "error" || j.code >= 400) throw new Error(`twelvedata ${j.code || r.status}: ${clean(j.message, key).slice(0, 160)}`);
    return j;
  } catch (e) { throw new Error(clean(e?.name === "AbortError" ? "twelvedata: timeout" : e.message, key)); }
  finally { clearTimeout(t); }
}

// Is the exchange open now? (config markets.hours: tz, open, close, days, holidays)
function openNow(h, now = new Date()) {
  if (!h?.tz) return false;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: h.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(now).map(x => [x.type, x.value]));
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], date = `${p.year}-${p.month}-${p.day}`, hm = `${p.hour}:${p.minute}`;
  if (!(h.days || [1, 2, 3, 4, 5]).includes(day) || (h.holidays || []).some(x => x.date === date)) return false;
  return hm >= h.open && hm <= h.close;
}
const todayIn = (tz, now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: tz || "UTC" });

// Daily closes (newest first from Twelve Data) into the fields yahooChart gives: price, previous close, the day's move,
// 7-day and 1-month moves against the last close on or before those dates, three-month high and low, the sparklines.
export function shapeSeries(j, { yahoo, hours, rangeNote } = {}) {
  const tz = j?.meta?.exchange_timezone || hours?.tz || "UTC";
  const bars = (j?.values || []).map(v => ({ d: String(v.datetime).slice(0, 10), c: Number(v.close) })).filter(b => Number.isFinite(b.c) && b.c > 0).reverse();
  if (bars.length < 2) throw new Error("twelvedata: too few closes");
  const last = bars.at(-1), prev = bars.at(-2), price = last.c, sessionDate = last.d;
  const back = n => { const t = new Date(Date.parse(sessionDate + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10); return [...bars].reverse().find(b => b.d <= t); };
  const b7 = back(7), b30 = back(30), pctFrom = b => (b?.c ? Math.round(((price - b.c) / b.c) * 10000) / 100 : null);
  const cut30 = new Date(Date.parse(sessionDate + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
  const cut3m = new Date(Date.parse(sessionDate + "T00:00:00Z") - 92 * 864e5).toISOString().slice(0, 10), m3 = bars.filter(b => b.d >= cut3m);
  const live = hours ? openNow(hours) && sessionDate === todayIn(tz) : false;
  return {
    symbol: yahoo, price, prev: prev.c, change_pct: ((price - prev.c) / prev.c) * 100,
    session_date: sessionDate, market_time: live ? new Date().toISOString() : `${sessionDate}T00:00:00Z`,
    currency: j?.meta?.currency || null, live, instrument: j?.meta?.type || null, note: rangeNote ? rangeNote(m3, yahoo) : null,
    lo3m: Math.min(...m3.map(b => b.c)), hi3m: Math.max(...m3.map(b => b.c)),
    spark: m3.map(b => Math.round(b.c * 100) / 100), spark_from: m3[0]?.d, spark_to: sessionDate,
    chg_7d: pctFrom(b7), from_7d: b7?.d || null, chg_1m: pctFrom(b30), from_1m: b30?.d || null,
    spark30: bars.filter(b => b.d >= cut30).map(b => Math.round(b.c * 100) / 100),
    source: "Twelve Data",
  };
}

// One instrument's daily series, kept ten minutes. `td` is the Twelve Data symbol, `yahoo` the config's Yahoo symbol
// (kept as the item's symbol so the page and the range checks find it).
export async function tdChart(td, { yahoo, hours, rangeNote } = {}) {
  const k = tdKey();
  if (!k) throw new Error("twelvedata: no key in the environment");
  if (!td) throw new Error(`twelvedata: no symbol for ${yahoo}`);
  const kept = KEPT.get(td);
  if (kept && Date.now() - kept.t < HOLD_MS) return shapeSeries(kept.j, { yahoo, hours, rangeNote });
  const j = await call(`time_series?symbol=${encodeURIComponent(td)}&interval=1day&outputsize=70`, k.value);
  KEPT.set(td, { t: Date.now(), j });
  return shapeSeries(j, { yahoo, hours, rangeNote });
}

// The account's use today (a free call, no credit): for the check below.
export async function tdUsage() {
  const k = tdKey();
  if (!k) return null;
  try { const j = await call("api_usage", k.value); return { used_today: j.daily_usage ?? null, day_limit: j.plan_daily_limit ?? null, used_this_minute: j.current_usage ?? null, minute_limit: j.plan_limit ?? null, plan: j.plan_category || null }; }
  catch (e) { return { error: e.message }; }
}
