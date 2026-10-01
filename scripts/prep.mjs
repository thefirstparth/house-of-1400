// Daily run helper: the morning's fixed steps in one command, so the run spends one step on them instead of five
// (Parth, 1 Oct: fewer steps, same checks). In order, each independent (one failing does not stop the rest):
//   1. the last seven editions in brief (date, lead, every story, brief and line with its thread), from the files,
//      so the run sees a week of history without reading seven whole editions (open one only when needed);
//   2. letters to the editor (scripts/letters.mjs), 3. India's cricket times (scripts/cricket-times.mjs),
//   4. Betting Window candidates (scripts/betting-candidates.mjs), 5. the live snapshot into today's edition
//      (scripts/snapshot.mjs; creates the file with just the date if it does not exist yet; keep its `snapshot`).
// Each helper prints what it always printed and writes its ledger file as before; the validator is unchanged.
// Usage: node scripts/prep.mjs [YYYY-MM-DD]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { allItems } from "./validate.mjs";

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
console.log("\nprep: done. Next: research (RUNBOOK step 5), then the wire check.");
