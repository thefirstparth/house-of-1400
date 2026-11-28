// The outlets' small logos for the new look on trial (Parth, 27 Nov 2026: "the source under the news with a logo"):
// node scripts/logos.mjs. Every outlet the editions have cited since a date, plus the regular wires, saved once as
// public/logos/<domain>.png (64 px, from Google's favicon service) and listed in public/logos/index.json. Stored with
// the paper, so a reader's browser never asks another site for an image. An outlet with no real icon (the service's
// default globe) is left out and the page draws its initials instead.
// node scripts/logos.mjs --curated <the-daily-index checkout>: copies the hand-picked 96 px logos from The Daily Index
// (public/publishers/<slug>.light.png, matched by its lib/publishers.ts list; shared by its author, 28 Nov 2026) over the
// favicons for the same outlets, and keeps the rest. Run it after every favicon pass, which rewrites the folder.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
const H = new URL("../", import.meta.url).pathname, OUT = `${H}public/logos/`;
const CUR = process.argv.indexOf("--curated");
if (CUR > -1) {
  const dir = process.argv[CUR + 1].replace(/\/$/, ""), list = readFileSync(`${dir}/src/lib/publishers.ts`, "utf8");
  const index = JSON.parse(readFileSync(`${OUT}index.json`, "utf8")); let n = 0;
  for (const [, host, slug] of list.matchAll(/"([a-z0-9.-]+\.[a-z]{2,})":\s*\{[^}]*slug:\s*"([a-z0-9-]+)"/g)) {
    const f = `${dir}/public/publishers/${slug}.light.png`; if (!existsSync(f)) continue;
    copyFileSync(f, `${OUT}${host}.png`); index[host] = 1; n++;
  }
  writeFileSync(`${OUT}index.json`, JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 0) + "\n");
  console.log(`logos: ${n} curated logos copied`); process.exit(0);
}
const SINCE = process.argv[2] || "2026-10-01";
const WIRES = ["reuters.com", "apnews.com", "bloomberg.com", "cnbc.com", "ft.com", "wsj.com", "nytimes.com", "washingtonpost.com", "scroll.in", "thewire.in", "news18.com", "firstpost.com", "livelaw.in", "thequint.com", "wionews.com", "skysports.com", "autosport.com", "marca.com", "as.com", "realmadrid.com", "nba.com", "atptour.com", "variety.com", "hollywoodreporter.com", "deadline.com", "engadget.com", "wired.com", "9to5mac.com", "anthropic.com", "openai.com", "sebi.gov.in", "rbi.org.in", "pib.gov.in"];
mkdirSync(OUT, { recursive: true });
const seen = new Map();
for (const f of readdirSync(`${H}content/editions`).filter(f => f >= SINCE && f.endsWith(".json"))) {
  const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === "object") { for (const s of Array.isArray(o.sources) ? o.sources : []) { try { const h = new URL(s.url).hostname.replace(/^www\./, ""); seen.set(h, (seen.get(h) || 0) + 1); } catch {} } Object.values(o).forEach(walk); } };
  const E = JSON.parse(readFileSync(`${H}content/editions/${f}`, "utf8")); walk(E.front); walk(E.sections);
}
for (const w of WIRES) if (!seen.has(w)) seen.set(w, 0);
const got = {}, hashes = {};
for (const host of seen.keys()) {
  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`, { redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (!r.ok) continue;
    const b = Buffer.from(await r.arrayBuffer()), h = createHash("sha1").update(b).digest("hex");
    (hashes[h] ||= []).push(host); got[host] = b;
  } catch {}
}
// the service's default globe comes back for many hosts with the same bytes: those hosts have no icon of their own
const globe = new Set(Object.values(hashes).filter(a => a.length >= 4).flat());
const index = {};
for (const [host, b] of Object.entries(got)) { if (globe.has(host) || b.length < 120) continue; writeFileSync(`${OUT}${host}.png`, b); index[host] = 1; }
writeFileSync(`${OUT}index.json`, JSON.stringify(index, null, 0) + "\n");
console.log(`logos: ${Object.keys(index).length} saved, ${globe.size} without an icon of their own, of ${seen.size} outlets`);
