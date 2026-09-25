// Daily run helper for The Betting Window. Prints JSON: first the markets that carry over from the previous
// edition because they are still trending (config betting.carry), then Polymarket's busiest events after the
// config exclusions, near-duplicates merged, ranked by 24-hour volume. The editor fills the rest of the 8 to 10.
// Also writes ledger/betting-carry.json, which the validator checks today's edition against.
// Polymarket only (Kalshi was retired on 25 Sep 2026: it needed a slow, rate-limited crawl for little extra).
// Nothing here names a market: what carries is decided by volume, price movement and the previous edition.
// Usage: node scripts/betting-candidates.mjs [--top 30]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
ensureProxy();
const { config, filterBetting, getJSON, shapePolymarket, successor } = await import("../lib/live.js");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const TOP = arg("--top", 30);
const CARRY = config().betting.carry || { max: 6, max_rank: 20, min_move_pts: 5 };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const STOP = new Set("the a an of in on by to will be who what which is winner election end through".split(" "));
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/;
const toks = t => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w) && !MONTHS.test(w) && !/^\d{4}$/.test(w)));
const similar = (a, b) => { const A = toks(a), B = toks(b); const i = [...A].filter(x => B.has(x)).length; return i / Math.max(1, Math.min(A.size, B.size)) >= 0.75; };

// Drop markets that are already settled in all but name (a 99% favourite) and prop-bet lines.
const live = m => m.outcomes.length && !(m.outcomes[0].prob >= 99 || (m.outcomes.length === 1 && m.outcomes[0].prob <= 1)) && !m.outcomes.some(o => /\bO\/U\b/.test(o.name));

const pool = filterBetting(await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=500", { timeout: 30000 }))
  .map(shapePolymarket).filter(live).sort((a, b) => b.volume24h - a.volume24h);
console.error(`polymarket: ${pool.length} live markets after exclusions`);
// Rank by distinct question, so twins do not push each other down.
const ranked = [];
for (const m of pool) if (!ranked.some(r => similar(r.title, m.title))) ranked.push(m);
const rankOf = m => { const i = ranked.findIndex(r => r.id === m.id || similar(r.title, m.title)); return i < 0 ? Infinity : i + 1; };

// 1. Carry-over from the previous edition.
const prev = existsSync("content/latest.json") ? JSON.parse(readFileSync("content/latest.json", "utf8")) : null;
const carried = [], dropped = [];
if (prev && (prev.date < today || process.argv.includes("--same-day"))) {
  for (const b of prev.betting || []) {
    if (!/^pm:/.test(b.id || "")) { dropped.push({ id: b.id, title: b.title, why: "not a Polymarket id" }); continue; }
    let ev = null;
    try { ev = (await getJSON(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(b.id.slice(3))}`))[0]; } catch {}
    let m = ev && shapePolymarket(ev), handover = null;
    const over = !ev || ev.closed || (ev.endDate && Date.parse(ev.endDate) < Date.now() + 864e5) || !live(m);
    if (over) {
      try { handover = await successor(b.title, similar); } catch {}
      if (!handover) { dropped.push({ id: b.id, title: b.title, why: "ended or decided, no next market in the same line" }); continue; }
      m = handover;
    }
    const rank = rankOf(m);
    const was = b.outcomes?.find(o => o.name === m.outcomes[0].name)?.prob;
    const moved = was != null ? Math.abs(m.outcomes[0].prob - was) : 0;
    const reasons = [];
    if (rank <= CARRY.max_rank) reasons.push(`#${rank} by 24h volume`);
    if (moved >= CARRY.min_move_pts) reasons.push(`${m.outcomes[0].name} moved ${moved.toFixed(1)} pts since printed`);
    if (!reasons.length) { dropped.push({ id: b.id, title: b.title, why: `cooled: ${rank === Infinity ? "outside the ranking" : "#" + rank} by volume, moved ${moved.toFixed(1)} pts` }); continue; }
    carried.push({ ...m, category: b.category, carry: { since: b.since || prev.date, from: b.id, reason: (handover ? "next in line; " : "") + reasons.join("; "), rank } });
  }
  carried.sort((a, b) => a.carry.rank - b.carry.rank);
  for (const m of carried.splice(CARRY.max)) dropped.push({ id: m.id, title: m.title, why: `carry cap of ${CARRY.max}` });
}
for (const m of carried) console.error(`carry: ${m.title} (${m.carry.reason})`);
for (const d of dropped) console.error(`drop:  ${d.title} (${d.why})`);
if (!process.argv.includes("--dry-run")) writeFileSync("ledger/betting-carry.json", JSON.stringify({ date: today, from: prev?.date || null,
  carry: carried.map(m => ({ id: m.id, title: m.title, since: m.carry.since, reason: m.carry.reason })), dropped }, null, 2) + "\n");

// 2. Fresh candidates for the rest.
const out = [...carried];
for (const m of ranked) {
  if (out.some(o => o.id === m.id || similar(o.title, m.title))) continue;
  out.push(m);
  if (out.length >= TOP + carried.length) break;
}
// Near-twins listed under the market they duplicate, for the editor's reference.
for (const m of pool) { const t = out.find(o => o.id !== m.id && similar(o.title, m.title)); if (t) (t.also ||= []).push({ id: m.id, outcomes: m.outcomes, url: m.url }); }
console.log(JSON.stringify(out, null, 2));
