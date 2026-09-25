// Assemble the static output: public/ + content/ + config/ into dist/.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("content", "dist/content", { recursive: true, filter: src => !src.endsWith("schema.json") });
mkdirSync("dist/config", { recursive: true });
cpSync("config/house.json", "dist/config/house.json");
if (!existsSync("dist/content/latest.json")) console.warn("build: no content/latest.json yet");
// The run's working notes (checks) and the market-movers scan are for the 14:00 run and the validator, not the
// reader: strip them from the served editions so the page stays light.
for (const f of ["dist/content/latest.json", ...readdirSync("dist/content/editions").map(x => `dist/content/editions/${x}`)]) {
  if (!f.endsWith(".json") || !existsSync(f)) continue;
  const e = JSON.parse(readFileSync(f, "utf8"));
  delete e.checks;
  if (e.snapshot) delete e.snapshot.movers;
  writeFileSync(f, JSON.stringify(e));
}

// Version the script and stylesheet by content hash so browsers can keep them for a year (vercel.json headers).
let html = readFileSync("dist/index.html", "utf8");
for (const f of ["app.js", "styles.css"]) {
  const v = createHash("sha256").update(readFileSync(`dist/${f}`)).digest("hex").slice(0, 10);
  html = html.replace(`"/${f}"`, `"/${f}?v=${v}"`);
}
writeFileSync("dist/index.html", html);
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");
