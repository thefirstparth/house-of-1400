import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readLatest() {
  try { return JSON.parse(readFileSync(join(process.cwd(), "content", "latest.json"), "utf8")); }
  catch { return null; }
}
