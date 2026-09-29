// Daily run helper: the wire check (EDITORIAL.md, The wire check). Reads the day's reading list (/api/live/wire,
// every feed in config sources) for the news window, lists the stories widely covered since the last edition's cut,
// and marks the ones the draft already carries. Writes ledger/wire-check.json; the validator asks for an answer to
// every candidate the edition does not visibly carry (checks.wire). Run it once after research and again after
// writing, until nothing is left unanswered.
// Usage: node scripts/wire-check.mjs [content/editions/YYYY-MM-DD.json] [--local]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
import { remoteLive, useRemote } from "./remote.mjs";
import { matchItem, wireCandidates } from "../lib/trial.js";
import { allItems } from "./validate.mjs";
ensureProxy();

const args = process.argv.slice(2), H = 36e5;
const today = new Date(Date.now() + 5.5 * H).toISOString().slice(0, 10);
const C = JSON.parse(readFileSync("config/house.json", "utf8"));
const file = args.find(a => a.endsWith(".json")) || `content/editions/${today}.json`;
const E = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { date: today };
const prev = readdirSync("content/editions").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${E.date}.json`).sort().pop();
const P = prev ? JSON.parse(readFileSync(`content/editions/${prev}`, "utf8")) : null;
const from = P ? new Date(`${P.date}T${P.cut_ist || "14:00"}:00+05:30`).toISOString() : new Date(Date.now() - 24 * H).toISOString();
const to = new Date().toISOString();

let out;
try {
  const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const r = useRemote(args) ? await remoteLive("wire", qs) : await (await import("../lib/trial.js")).TRIAL.wire(new URLSearchParams(qs.slice(1)));
  if (!r.ok) throw new Error(r.error || "wire failed");
  const printed = allItems(E);
  const cands = wireCandidates(r.value, C).map(c => {
    const hit = printed.find(it => matchItem(it, [{ title: c.title }]));
    return { ...c, carried_by: hit?.id || null };
  });
  out = { date: E.date, window: { from, to }, checked_at: new Date().toISOString(), candidates: cands };
  const open = cands.filter(c => !c.carried_by);
  console.log(`wire check: ${cands.length} widely covered stories since ${from}; ${cands.length - open.length} already carried, ${open.length} to answer.\n`);
  for (const c of open) console.log(`  [${c.id}] ${c.region}/${c.section_hint || "?"} · ${c.n} outlets · ${c.title}\n      ${c.links[0] || ""}`);
} catch (e) {
  out = { date: E.date, window: { from, to }, checked_at: new Date().toISOString(), error: String(e.message || e), candidates: [] };
  console.error(`wire check: ${out.error}. Carry on without it; the validator only warns.`);
}
writeFileSync("ledger/wire-check.json", JSON.stringify(out, null, 2) + "\n");
