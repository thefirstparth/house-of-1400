// Assemble the static output: public/ + content/ + config/ into dist/.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("content", "dist/content", { recursive: true, filter: src => !src.endsWith("schema.json") });
mkdirSync("dist/config", { recursive: true });
cpSync("config/house.json", "dist/config/house.json");
if (!existsSync("dist/content/latest.json")) console.warn("build: no content/latest.json yet");
// Version the script and stylesheet by content hash so browsers can keep them for a year (vercel.json headers).
let html = readFileSync("dist/index.html", "utf8");
for (const f of ["app.js", "styles.css"]) {
  const v = createHash("sha256").update(readFileSync(`dist/${f}`)).digest("hex").slice(0, 10);
  html = html.replace(`"/${f}"`, `"/${f}?v=${v}"`);
}
writeFileSync("dist/index.html", html);
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");
