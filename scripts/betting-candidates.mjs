// Daily run helper for The Betting Window. Pulls Polymarket's busiest events and crawls every open Kalshi
// event (Kalshi has no volume sort), applies config exclusions, merges near-duplicates and ranks by
// 24-hour dollar volume. Prints candidates as JSON; the editor picks 8 to 10 for the edition.
// Usage: node scripts/betting-candidates.mjs [--top 30] [--kalshi-pages 80]
import { ensureProxy } from "./proxy.mjs";
ensureProxy();
const { filterBetting, filterKalshi, getJSON, shapePolymarket } = await import("../lib/live.js");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const TOP = arg("--top", 30), MAX_PAGES = arg("--kalshi-pages", 80);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function polite(url) {
  for (let i = 0; i < 5; i++) {
    try { return await getJSON(url, { timeout: 30000 }); }
    catch (e) { if (!/429/.test(e.message)) throw e; await sleep(3000 * (i + 1)); }
  }
  throw new Error(`429 persisted ${url}`);
}

const pm = filterBetting(await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=500", { timeout: 30000 }))
  .map(shapePolymarket).filter(m => m.outcomes.length);
console.error(`polymarket: ${pm.length} after exclusions`);

let ks = [], cursor = "", pages = 0;
try {
  do {
    const j = await polite(`https://api.elections.kalshi.com/trade-api/v2/events?with_nested_markets=true&status=open&limit=200${cursor ? `&cursor=${cursor}` : ""}`);
    ks.push(...filterKalshi(j.events || []));
    cursor = j.cursor; pages++;
    if (cursor) await sleep(1300);
  } while (cursor && pages < MAX_PAGES);
  console.error(`kalshi: ${pages} pages${cursor ? " (stopped early)" : ""}, ${ks.length} after exclusions`);
} catch (e) { console.error(`kalshi failed: ${e.message}`); }

const STOP = new Set("the a an of in on by to will be who what which is 2026 2027 winner election".split(" "));
const toks = t => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)));
const similar = (a, b) => { const A = toks(a), B = toks(b); const i = [...A].filter(x => B.has(x)).length; return i / Math.max(1, Math.min(A.size, B.size)) >= 0.75; };

// Drop markets that are already settled in all but name (a 99% favourite) and prop-bet lines.
const live = m => !(m.outcomes[0].prob >= 99 || (m.outcomes.length === 1 && m.outcomes[0].prob <= 1)) && !m.outcomes.some(o => /\bO\/U\b/.test(o.name));
const all = [...pm, ...ks].filter(live).sort((a, b) => b.volume24h - a.volume24h);
const out = [];
for (const m of all) {
  const twin = out.find(o => similar(o.title, m.title));
  if (twin) { (twin.also ||= []).push({ id: m.id, source: m.source, outcomes: m.outcomes, url: m.url }); continue; }
  out.push(m);
  if (out.length >= TOP) break;
}
console.log(JSON.stringify(out, null, 2));
