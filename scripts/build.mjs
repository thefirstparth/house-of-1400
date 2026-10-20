// Assemble the static output: public/ + content/ + config/ into dist/.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
// Only the last art.keep_days days of Bunty's art go into a deployment (Parth, 14 Oct: option A). Vercel keeps a full
// copy of the site per deployment, and the art archive grows by about 2 MB a day: all of it in every copy would pass
// the free 10 GB again within months. Older days stay in the repository; their editions show no drawings.
const ART_KEEP = JSON.parse(readFileSync("config/house.json", "utf8")).art?.keep_days ?? 30;
const latestDate = existsSync("content/latest.json") ? JSON.parse(readFileSync("content/latest.json", "utf8")).date : null;
const artCut = latestDate ? new Date(Date.parse(`${latestDate}T12:00:00Z`) - (ART_KEEP - 1) * 864e5).toISOString().slice(0, 10) : "0000-00-00";
const oldArt = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < artCut;
cpSync("public", "dist", { recursive: true, filter: src => { const m = src.replace(/\\/g, "/").match(/(?:^|\/)public\/art\/(\d{4}-\d{2}-\d{2})(?:\/|$)/); return !(m && oldArt(m[1])); } });
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
// The editor's page (Parth, 1 Oct: "it doesn't even say how many editions we have printed"): the paper's own numbers,
// worked out from the editions at build time, and Bhide's desk diary (ledger/editor-log.json, written by each run:
// a short entry daily, the week's review on Mondays).
{
  const eds = readdirSync("content/editions").filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(`content/editions/${f}`, "utf8")));
  const { allItems } = await import("./validate.mjs");
  const items = eds.map(e => { try { return allItems(e).length; } catch { return 0; } });
  const printed = eds.map(e => e.printed_at || Object.values(e.snapshot || {}).map(x => x?.as_of).filter(t => t && t.slice(0, 10) >= e.date).sort().pop()).filter(Boolean);
  const ist = t => new Date(Date.parse(t) + 5.5 * 36e5).toISOString().slice(11, 16);
  const ledgerT = existsSync("ledger/story-ledger.json") ? JSON.parse(readFileSync("ledger/story-ledger.json", "utf8")).threads?.length || 0 : 0;
  const lessons = existsSync("ledger/lessons.json") ? (JSON.parse(readFileSync("ledger/lessons.json", "utf8")).lessons || []).length : 0;
  const log = existsSync("ledger/editor-log.json") ? JSON.parse(readFileSync("ledger/editor-log.json", "utf8")) : { entries: [] };
  writeFileSync("dist/editor.json", JSON.stringify({
    stats: { editions: eds.length, first: eds[0]?.date || null, latest: eds.at(-1)?.date || null, items: items.reduce((a, b) => a + b, 0), items_latest: items.at(-1) || 0,
      threads: ledgerT, lessons, printed_latest: printed.length ? ist(printed.at(-1)) : null, printed_median: printed.length ? printed.map(ist).sort()[Math.floor(printed.length / 2)] : null },
    log: (log.entries || []).slice(-60) }));
}
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
    if (oldArt(d)) { mkdirSync(`dist/art/${d}`, { recursive: true }); writeFileSync(`dist/art/${d}/manifest.json`, JSON.stringify({ date: d, items: [], rejected: [], note: `older than ${ART_KEEP} days: not in the deployment (it stays in the repository)` })); continue; }
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
// The new design (v2; 1 Oct 2026, the default since 4 Oct 2026; v2/README.md): / shows it; /?v1 gives the old design
// and the device remembers it until /?v2; poster links stay in the old design. It is assembled from app.js and styles.css (v2/assemble.mjs) without changing
// them, and only the edition pages (/, /today, /e/<date>) use it. A v2 that cannot be built never fails the build:
// the paper ships in the old design alone.
try {
  const { assemble, withV2, archiveDays } = await import("../v2/assemble.mjs");
  {
    const { allItems } = await import("./validate.mjs");
    const eds = readdirSync("content/editions").filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(`content/editions/${f}`, "utf8")));
    writeFileSync("dist/archive-days.json", JSON.stringify(await archiveDays(eds, fullConfig, e => { try { return allItems(e).length; } catch { return 0; } })));
  }
  const v2 = assemble();
  writeFileSync("dist/v2.js", v2.js);
  writeFileSync("dist/v2.css", v2.css);
  mkdirSync("dist/fonts", { recursive: true });
  for (const f of readdirSync("v2/fonts")) cpSync(`v2/fonts/${f}`, `dist/fonts/${f}`);
  const ver = f => createHash("sha256").update(readFileSync(`dist/${f}`)).digest("hex").slice(0, 10);
  html = withV2(html, v2.head, `/v2.js?v=${ver("v2.js")}`, `/v2.css?v=${ver("v2.css")}`, fullConfig.weather?.always?.[0]);
  console.log("build: v2 ready (the default; ?v1 for the old design)");
} catch (e) { console.warn(`build: v2 skipped, the paper ships in the old design only: ${e.message}`); }
// The paper as an app (20 Oct 2026; v2/README.md "Install"): dist/paper-sw.js is public/paper-sw.js with its version (a
// hash of the page's files, so a new build of the page is a new worker and the older caches go) and the shell it keeps
// for an offline open. Today's edition is in the shell but stays network-first like everything that changes.
{
  const sw = readFileSync("public/paper-sw.js", "utf8");
  const v2files = [...new Set(html.match(/\/v2\.(?:js|css)\?v=[0-9a-f]+/g) || [])];
  const pre = ["/", "/content/latest.json", "/config/house.json", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", ...v2files,
    ...["unifrakturmaguntia-latin-400-normal", "libre-franklin-latin-wght-normal"].map(f => `/fonts/${f}.woff2`).filter(f => existsSync(`dist${f}`))];
  const h = createHash("sha256").update(html).update(sw);
  for (const f of ["v2.js", "v2.css", "app.js", "styles.css"]) if (existsSync(`dist/${f}`)) h.update(readFileSync(`dist/${f}`));
  const out = sw.replace(/^const VERSION = "[^"]*";$/m, () => `const VERSION = "${h.digest("hex").slice(0, 10)}";`).replace(/^const PRECACHE = \[[^\]]*\];$/m, () => `const PRECACHE = ${JSON.stringify(pre)};`);
  if (out === sw || !/const VERSION = "[0-9a-f]{10}"/.test(out) || out.includes('const PRECACHE = ["/"];')) console.warn("build: paper-sw.js not versioned (its VERSION or PRECACHE line moved)");
  writeFileSync("dist/paper-sw.js", out);
}
writeFileSync("dist/index.html", html);
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");

