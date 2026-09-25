// Publish a validated edition: copy to latest.json, update archive.json and the story ledger.
// Usage: node scripts/publish.mjs content/editions/YYYY-MM-DD.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { allItems, validateEdition } from "./validate.mjs";

const file = process.argv[2];
if (!file) { console.error("usage: publish.mjs content/editions/YYYY-MM-DD.json"); process.exit(2); }
const raw = readFileSync(file, "utf8");
const E = JSON.parse(raw);
const ledger = JSON.parse(readFileSync("ledger/story-ledger.json", "utf8"));
const { errors, warnings } = validateEdition(E, { ledger });
warnings.forEach(w => console.log(`warn  ${w}`));
if (errors.length) { errors.forEach(e => console.log(`ERROR ${e}`)); console.log("Not published."); process.exit(1); }

writeFileSync("content/latest.json", raw.endsWith("\n") ? raw : raw + "\n");

const archive = JSON.parse(readFileSync("content/archive.json", "utf8"));
archive.editions = (archive.editions || []).filter(e => e.date !== E.date);
archive.editions.push({ date: E.date, edition_no: E.edition_no, lead: E.front.lead.headline });
archive.editions.sort((a, b) => b.date.localeCompare(a.date));
writeFileSync("content/archive.json", JSON.stringify(archive, null, 2) + "\n");

// Ledger: upsert every printed thread, keep 30 days plus anything still active.
const byId = new Map(ledger.threads.map(t => [t.thread_id, t]));
for (const s of allItems(E)) {
  const t = byId.get(s.thread_id) || { thread_id: s.thread_id, title: s.headline, entities: [], facts: {}, first_printed: E.date, last_printed: null, last_change: E.date, status: "active", votes: { up: 0, down: 0 } };
  const facts = s.facts || {};
  if (Object.entries(facts).some(([k, v]) => String(t.facts[k]) !== String(v))) t.last_change = E.date;
  t.title = s.headline;
  t.section = s.section;
  t.facts = { ...t.facts, ...facts };
  t.last_printed = E.date;
  byId.set(s.thread_id, t);
}
const cutoff = new Date(Date.parse(E.date + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
ledger.threads = [...byId.values()].filter(t => t.status === "active" && t.last_change >= cutoff || t.last_printed >= cutoff);
ledger.last_updated = new Date().toISOString();
ledger.last_edition = E.date;
writeFileSync("ledger/story-ledger.json", JSON.stringify(ledger, null, 2) + "\n");

// Letters answered in this edition are not shown to tomorrow's run again.
const answered = (E.checks?.letters || []).map(l => l.id).filter(Boolean);
if (answered.length) {
  const h = existsSync("ledger/letters-handled.json") ? JSON.parse(readFileSync("ledger/letters-handled.json", "utf8")) : { ids: [] };
  h.ids = [...new Set([...(h.ids || []), ...answered])].slice(-2000);
  writeFileSync("ledger/letters-handled.json", JSON.stringify(h, null, 2) + "\n");
}
console.log(`Published ${E.date} (No. ${E.edition_no}). ${ledger.threads.length} threads in the ledger.`);
