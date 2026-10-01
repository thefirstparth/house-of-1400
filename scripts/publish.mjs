// Publish a validated edition: copy to latest.json, update archive.json and the story ledger.
// Usage: node scripts/publish.mjs content/editions/YYYY-MM-DD.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { allItems, validateEdition } from "./validate.mjs";
import { pickArt } from "../lib/art.js";

const file = process.argv[2];
if (!file) { console.error("usage: publish.mjs content/editions/YYYY-MM-DD.json"); process.exit(2); }
const raw = readFileSync(file, "utf8");
const E = JSON.parse(raw);
const ledger = JSON.parse(readFileSync("ledger/story-ledger.json", "utf8"));
// Art orders come from Bhide's scores (lib/art.js pickArt; Parth, 1 Oct 2026). On the first publish of the day they are
// picked fresh; on a later correction the orders already published stay as they are, in order, and new picks are only
// added, so the illustrator's finished work is never thrown out.
if (E.art_scores?.length) {
  const picks = pickArt(E, JSON.parse(readFileSync("config/house.json", "utf8")));
  const before = E.printed_at ? (E.art_orders || []).map(o => o.story_id) : [];
  const ids = [...new Set([...before, ...picks])];
  E.art_orders = ids.map(id => (E.art_orders || []).find(o => o.story_id === id) || { story_id: id });
  console.log(`art: ${E.art_orders.length} orders${before.length ? ` (${before.length} kept from the first publish)` : ""}: ${ids.join(", ")}`);
}
const { errors, warnings } = validateEdition(E, { ledger });
warnings.forEach(w => console.log(`warn  ${w}`));
if (errors.length) { errors.forEach(e => console.log(`ERROR ${e}`)); console.log("Not published."); process.exit(1); }

// The moment it went out, for the masthead ("Printed 14:16 IST"), written into the edition and latest.json alike.
E.printed_at = new Date().toISOString();
const out = JSON.stringify(E, null, 2) + "\n";
writeFileSync(file, out);
writeFileSync("content/latest.json", out);

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
// Lessons: an owed story covered in this edition is marked printed, so later runs stop being asked for it.
const covered = (E.checks?.lessons || []).filter(l => l.covered_by || l.action);
if (covered.length && existsSync("ledger/lessons.json")) {
  const L = JSON.parse(readFileSync("ledger/lessons.json", "utf8"));
  for (const l of L.lessons || []) {
    const a = covered.find(x => x.id === l.id);
    if (!a || !l.owed || l.owed.printed_on || l.owed.settled) continue;
    if (a.covered_by) l.owed.printed_on = E.date; else l.owed.settled = { on: E.date, why: a.action };
  }
  writeFileSync("ledger/lessons.json", JSON.stringify(L, null, 2) + "\n");
}
// Money calendar: a change covered in this edition is marked printed; one answered as no longer news is settled.
const handled = E.checks?.changes || [];
if (handled.length && existsSync("ledger/changes.json")) {
  const C = JSON.parse(readFileSync("ledger/changes.json", "utf8"));
  for (const c of C.changes || []) {
    const a = handled.find(x => x.id === c.id);
    if (!a || c.printed_on || c.settled) continue;
    if (a.covered_by) c.printed_on = E.date; else c.settled = { on: E.date, why: a.action };
  }
  writeFileSync("ledger/changes.json", JSON.stringify(C, null, 2) + "\n");
}
console.log(`Published ${E.date} (No. ${E.edition_no}). ${ledger.threads.length} threads in the ledger.`);
