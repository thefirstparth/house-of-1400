// QA: freeze today's live data from production into qa-data/ (gitignored), so before/after screenshots compare the
// same numbers. Usage: node scripts/qa/freeze.mjs [https://house14.vercel.app]
import { mkdirSync, writeFileSync } from "node:fs";
import { ensureProxy } from "../proxy.mjs";
ensureProxy();
const SITE = process.argv[2] || "https://house14.vercel.app";
const KEYS = ["weather", "f1_next", "f1_standings", "f1_last", "f1_market", "football", "laliga_table", "markets", "gold_in", "nba", "signals", "intl_football", "flows", "movers", "tennis_players", "crease", "club_stats", "cricket_where", "outlook", "club_knockouts", "betting", "trends"];
mkdirSync("qa-data", { recursive: true });
for (const k of KEYS) {
  try { const r = await fetch(`${SITE}/api/live/${k}`); writeFileSync(`qa-data/${k}.json`, await r.text()); console.log("ok", k); }
  catch (e) { console.log("fail", k, e.message); }
}
