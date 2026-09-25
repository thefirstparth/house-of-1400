// Assemble the static output: public/ + content/ + config/ into dist/.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });
cpSync("content", "dist/content", { recursive: true, filter: src => !src.endsWith("schema.json") });
mkdirSync("dist/config", { recursive: true });
cpSync("config/house.json", "dist/config/house.json");
if (!existsSync("dist/content/latest.json")) console.warn("build: no content/latest.json yet");
writeFileSync("dist/build.json", JSON.stringify({ built_at: new Date().toISOString() }));
console.log("build: dist ready");
