// The Ledger's extra live blocks (Parth, 30 Sep 2026): the day's institutional money flows here, and, in lib/live.js
// movers, the market's breadth.
// Every getter returns {ok, value, source, as_of, stale}; the page hides a block whose source fails.
import { config, getJSON, getText } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });

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

export const MONEY = { flows };
export const MONEY_CACHE = { flows: [1800, 7200] };
