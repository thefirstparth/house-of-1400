// Daily run helper for The Crease: India men's next matches with their exact start times, read from the structured
// data Cricbuzz embeds in India's team schedule page (start time, venue, and whether the time is officially
// announced). Prints the list and writes ledger/cricket-times.json, which the validator checks the edition's
// chronology.india_cricket and India fixtures against: a time Cricbuzz has announced is never printed as "TBC".
// Usage: node scripts/cricket-times.mjs
import { writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
import { seriesOf } from "../lib/cricket.js";
ensureProxy();

const TEAM = 2, BASE = "https://www.cricbuzz.com/cricket-team/india/2";
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function parseCricbuzz(html) {
  const flat = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(m => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).join("");
  const out = [], seen = new Set();
  for (const m of flat.matchAll(/"matchInfo":\{/g)) {
    let depth = 0, i = m.index + 12, j = i;
    for (; j < flat.length; j++) { const ch = flat[j]; if (ch === "{") depth++; else if (ch === "}") { depth--; if (!depth) break; } else if (ch === '"') { for (j++; j < flat.length && flat[j] !== '"'; j++) if (flat[j] === "\\") j++; } }
    try { const o = JSON.parse(flat.slice(i, j + 1)); if (o.matchId && !seen.has(o.matchId)) { seen.add(o.matchId); out.push(o); } } catch {}
  }
  return out;
}

let result;
try {
  const r = await fetch(`${BASE}/schedule`, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const now = Date.now();
  const matches = parseCricbuzz(await r.text())
    .filter(o => o.team1?.teamId === TEAM || o.team2?.teamId === TEAM)
    .map(o => {
      const opp = o.team1?.teamId === TEAM ? o.team2 : o.team1;
      const start = new Date(Number(o.startDate)).toISOString();
      return { desc: o.matchDesc, format: o.matchFormat, series: o.seriesName, opponent: opp?.teamName, start,
        ist: new Date(start).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
        time_announced: o.isTimeAnnounced !== false, ground: o.venueInfo?.ground || null, city: o.venueInfo?.city || null,
        url: `https://www.cricbuzz.com/live-cricket-scores/${o.matchId}` };
    })
    .filter(m => Date.parse(m.start) > now - 12 * 36e5)
    .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 40);
  if (!matches.length) throw new Error("no India matches found on the schedule page");
  const series = seriesOf(matches);
  result = { date: today, source: "Cricbuzz", checked_at: new Date().toISOString(), matches, series };
  for (const m of matches) console.log(`${m.ist} IST${m.time_announced ? "" : " (time not announced)"}  ${m.desc} v ${m.opponent}  ${m.city || ""}  [${m.series}]`);
  console.log("\nSeries (for The Crease rows: one row per series under way with its match count, then an \"After this\" row):");
  for (const x of series) console.log(`  ${x.now ? "NOW  " : "NEXT "} ${x.name}: ${x.parts.map(p => `${p.format} ${p.total ? `(${p.total} matches${p.played ? `, ${p.played} played` : ""})` : ""}`).join(", ")} · from ${x.from}`);
} catch (e) {
  result = { date: today, source: "Cricbuzz", checked_at: new Date().toISOString(), error: String(e.message || e), matches: [] };
  console.error(`cricket-times: ${result.error}. Find the times on BCCI or ESPNcricinfo instead, and say so in the edition.`);
}
writeFileSync("ledger/cricket-times.json", JSON.stringify(result, null, 2) + "\n");
