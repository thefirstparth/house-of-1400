// Assemble the static output: public/ + content/ + config/ into dist/.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("content", "dist/content", { recursive: true, filter: src => !src.endsWith("schema.json") });
mkdirSync("dist/config", { recursive: true });
cpSync("config/house.json", "dist/config/house.json");
// The site is public (no password since 25 Sep). Your Desk comes from Gmail and Calendar, so it is never
// served: strip it from every edition copied into dist. The private repo keeps the full JSON.
const strip = f => { const e = JSON.parse(readFileSync(f, "utf8")); if ("desk" in e) { e.desk = null; writeFileSync(f, JSON.stringify(e)); } };
if (existsSync("dist/content/latest.json")) strip("dist/content/latest.json"); else console.warn("build: no content/latest.json yet");
for (const f of readdirSync("dist/content/editions").filter(f => f.endsWith(".json"))) strip(`dist/content/editions/${f}`);
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");
