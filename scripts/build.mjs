// Assemble the static output: public/ + content/ + config/ into dist/.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("content", "dist/content", { recursive: true, filter: src => !src.endsWith("schema.json") });
mkdirSync("dist/config", { recursive: true });
// The page reads the config; the daily run's reading list and the trial settings are not for it.
const fullConfig = JSON.parse(readFileSync("config/house.json", "utf8"));
const config = { ...fullConfig };
delete config.sources; delete config.trial; delete config.art; delete config.money; delete config.section_ranges; if (config.screen) delete config.screen.upcoming;
writeFileSync("dist/config/house.json", JSON.stringify(config, null, 2) + "\n");
// The source trial's scorecards for /trial (not the raw reading lists in ledger/trial/wire/).
if (existsSync("ledger/trial")) {
  mkdirSync("dist/trial", { recursive: true });
  for (const f of readdirSync("ledger/trial")) if (f.endsWith(".json")) cpSync(`ledger/trial/${f}`, `dist/trial/${f}`);
}
if (!existsSync("dist/content/latest.json")) console.warn("build: no content/latest.json yet");
// The run's working notes (checks) and the market-movers scan are for the 14:00 run and the validator, not the
// reader: strip them from the served editions so the page stays light.
for (const f of ["dist/content/latest.json", ...readdirSync("dist/content/editions").map(x => `dist/content/editions/${x}`)]) {
  if (!f.endsWith(".json") || !existsSync(f)) continue;
  const e = JSON.parse(readFileSync(f, "utf8"));
  delete e.checks;
  delete e.art_orders; // Bhide's art orders are for the illustrator (/art/brief.json), not the reader
  if (e.snapshot) delete e.snapshot.movers;
  writeFileSync(f, JSON.stringify(e));
}

// Illustrations (lib/art.js). The brief for the illustrator comes from today's edition (Bhide's art orders); each day's
// manifest is checked against its edition and replaced in dist by the checked one, so the page only ever sees
// images that fit their slot. A bad file never fails the build: it is listed under "rejected" and not shown.
try {
  const { brief, checkArt } = await import("../lib/art.js");
  const credit = fullConfig.art?.illustrator?.credit || "Illustration";
  mkdirSync("dist/art", { recursive: true });
  if (existsSync("content/latest.json")) writeFileSync("dist/art/brief.json", JSON.stringify(brief(JSON.parse(readFileSync("content/latest.json", "utf8")), fullConfig), null, 2));
  for (const d of existsSync("public/art") ? readdirSync("public/art") : []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !existsSync(`public/art/${d}/manifest.json`)) continue;
    let out;
    try {
      const ed = `content/editions/${d}.json`;
      if (!existsSync(ed)) throw new Error(`no edition for ${d}`);
      const read = f => (existsSync(`public/art/${d}/${f}`) ? readFileSync(`public/art/${d}/${f}`) : null);
      out = checkArt(JSON.parse(readFileSync(ed, "utf8")), JSON.parse(readFileSync(`public/art/${d}/manifest.json`, "utf8")), read, credit);
    } catch (e) { out = { items: [], rejected: [{ reason: String(e.message || e) }] }; }
    writeFileSync(`dist/art/${d}/manifest.json`, JSON.stringify({ date: d, checked_at: new Date().toISOString(), ...out }, null, 2));
    console.log(`build: art ${d}: ${out.items.length} shown, ${out.rejected.length} rejected${out.rejected.length ? ` (${out.rejected.map(r => `${r.story_id || ""} ${r.reason}`).join("; ")})` : ""}`);
  }
} catch (e) { console.warn(`build: art skipped: ${e.message}`); }

// Version the script and stylesheet by content hash so browsers can keep them for a year (vercel.json headers).
let html = readFileSync("dist/index.html", "utf8");
for (const f of ["app.js", "styles.css"]) {
  const v = createHash("sha256").update(readFileSync(`dist/${f}`)).digest("hex").slice(0, 10);
  html = html.replace(`"/${f}"`, `"/${f}?v=${v}"`);
}
writeFileSync("dist/index.html", html);
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");
