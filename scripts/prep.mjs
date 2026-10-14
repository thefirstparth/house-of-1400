// Daily run helper: the morning's fixed steps in one command, so the run spends one step on them instead of five
// (Parth, 1 Oct: fewer steps, same checks). In order, each independent (one failing does not stop the rest):
//   1. the last seven editions in brief (date, lead, every story, brief and line with its thread), from the files,
//      so the run sees a week of history without reading seven whole editions (open one only when needed);
//   2. letters to the editor (scripts/letters.mjs), 3. India's cricket times (scripts/cricket-times.mjs),
//   4. Betting Window candidates (scripts/betting-candidates.mjs), 5. the live snapshot into today's edition
//      (scripts/snapshot.mjs; creates the file with just the date if it does not exist yet; keep its `snapshot`).
// Each helper prints what it always printed and writes its ledger file as before; the validator is unchanged.
//   6. from config pool.from (13 Oct 2026), the day's pool (scripts/pool.mjs): the stories to choose from, with their text.
// Usage: node scripts/prep.mjs [YYYY-MM-DD]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { allItems, afterClose } from "./validate.mjs";

const today = process.argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const file = `content/editions/${today}.json`;
const hr = t => console.log(`\n==================== ${t} ====================`);

hr("The last seven editions, in brief");
const past = readdirSync("content/editions").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${today}.json`).sort().slice(-7);
for (const f of past) {
  const E = JSON.parse(readFileSync(`content/editions/${f}`, "utf8"));
  console.log(`\n${E.date} (No. ${E.edition_no}) lead: ${E.front?.lead?.headline || "?"}${E.big_day ? ` | big day: ${E.big_day.kind}` : ""}`);
  for (const it of allItems(E)) if (it.id !== E.front?.lead?.id) console.log(`  ${it._kind === "story" ? "S" : it._kind === "brief" ? "b" : "l"} ${it.section || "?"} [${it.thread_id || it.id}] ${it.headline}`);
}

const run = (title, args) => {
  hr(title);
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env, timeout: 300000 });
  if (r.status !== 0) console.log(`\n(${args[0]} did not finish cleanly: exit ${r.status}${r.error ? `, ${r.error.message}` : ""}. Run it on its own to retry.)`);
};
run("Letters to the editor", ["scripts/letters.mjs"]);
run("India's cricket times", ["scripts/cricket-times.mjs"]);
run("Betting Window candidates", ["scripts/betting-candidates.mjs"]);
if (!existsSync(file)) writeFileSync(file, JSON.stringify({ date: today }, null, 2) + "\n");
run(`Live snapshot into ${file}`, ["scripts/snapshot.mjs", file]);
// After yesterday's paper (from 15 Oct): a big move between the last print and the close, which the paper owes a reason
try {
  const C = JSON.parse(readFileSync("config/house.json", "utf8")).pool || {};
  if (C.after_close?.from && today >= C.after_close.from && past.length) {
    const moves = afterClose(JSON.parse(readFileSync(file, "utf8")), JSON.parse(readFileSync(`content/editions/${past.at(-1)}`, "utf8")), C);
    if (moves.length) {
      hr("After yesterday's paper");
      for (const m of moves) console.log(`${m.name} closed ${m.session} at ${m.close.toFixed(2)}: ${m.points > 0 ? "+" : ""}${m.points} points (${m.pct > 0 ? "+" : ""}${m.pct}%) after the 14:00 print${m.day_pct != null ? `, ${m.day_pct > 0 ? "+" : ""}${m.day_pct}% on the day` : ""}.`);
      console.log("Find why in the pool's market stories, print it in the Ledger, and record checks.after_close {why, covered_by} (DESK.md).");
    }
  }
} catch (e) { console.log(`(after-close check skipped: ${e.message})`); }
// From the 13 Oct 2026 edition: the day's pool (scripts/pool.mjs), the stories to choose from, with their text.
let poolFrom = null; try { poolFrom = JSON.parse(readFileSync("config/house.json", "utf8")).pool?.from || null; } catch {}
if (poolFrom && today >= poolFrom) { run("The day's pool", ["scripts/pool.mjs", today]); console.log("\nprep: done. Next: choose and write from the pool (docs/DESK.md), then validate."); }
else console.log("\nprep: done. Next: research (RUNBOOK step 5), then the wire check.");
