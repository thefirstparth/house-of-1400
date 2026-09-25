// Daily run helper for The Betting Window. Pulls Polymarket's busiest events, applies config exclusions,
// merges near-duplicates and ranks by 24-hour volume. Prints candidates as JSON; the editor picks 8 to 10.
// Polymarket only (Kalshi was retired on 25 Sep 2026: it needed a slow, rate-limited crawl for little extra).
// Usage: node scripts/betting-candidates.mjs [--top 30]
import { ensureProxy } from "./proxy.mjs";
ensureProxy();
const { filterBetting, getJSON, shapePolymarket } = await import("../lib/live.js");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const TOP = arg("--top", 30);

const pm = filterBetting(await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=500", { timeout: 30000 }))
  .map(shapePolymarket).filter(m => m.outcomes.length);
console.error(`polymarket: ${pm.length} after exclusions`);

const STOP = new Set("the a an of in on by to will be who what which is 2026 2027 winner election".split(" "));
const toks = t => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)));
const similar = (a, b) => { const A = toks(a), B = toks(b); const i = [...A].filter(x => B.has(x)).length; return i / Math.max(1, Math.min(A.size, B.size)) >= 0.75; };

// Drop markets that are already settled in all but name (a 99% favourite) and prop-bet lines.
const live = m => !(m.outcomes[0].prob >= 99 || (m.outcomes.length === 1 && m.outcomes[0].prob <= 1)) && !m.outcomes.some(o => /\bO\/U\b/.test(o.name));
const all = pm.filter(live).sort((a, b) => b.volume24h - a.volume24h);
const out = [];
for (const m of all) {
  const twin = out.find(o => similar(o.title, m.title));
  if (twin) { (twin.also ||= []).push({ id: m.id, outcomes: m.outcomes, url: m.url }); continue; }
  out.push(m);
  if (out.length >= TOP) break;
}
console.log(JSON.stringify(out, null, 2));
