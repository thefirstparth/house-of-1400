// The illustrator's brief, made from this repository alone: the same JSON the site serves at /art/brief.json
// (scripts/build.mjs), for when the site cannot be reached (Bunty, 3 and 4 Oct 2026: a Vercel connector refused it).
// No packages, no network. Usage: node scripts/art-brief.mjs [file]   (prints it, or writes it to file)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brief } from "../lib/art.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = p => JSON.parse(readFileSync(root + p, "utf8"));
const out = JSON.stringify(brief(read("content/latest.json"), read("config/house.json")), null, 2);
const file = process.argv[2];
if (file) writeFileSync(file, out); else process.stdout.write(out + "\n");
