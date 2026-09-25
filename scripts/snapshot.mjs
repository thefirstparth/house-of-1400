// Store the live layer as the edition snapshot (fallback values with as_of).
// Default: call our own deployed /api/live/* with RUN_KEY (daily runs only need our Vercel domain and GitHub).
// --local: run the getters in this process against the third-party APIs (build sessions).
// Usage: node scripts/snapshot.mjs [--local] [content/editions/YYYY-MM-DD.json]   (without a file, prints JSON)
import { readFileSync, writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
import { remoteLive, SITE_URL, useRemote } from "./remote.mjs";

ensureProxy();

const REMOTE = useRemote(process.argv.slice(2));

const KEYS = ["weather", "f1_next", "f1_standings", "f1_last", "football", "laliga_table", "nba", "tennis", "markets", "fx", "crypto", "gold_in", "trends", "betting", "movers", "signals"];

export async function snapshot() {
  const out = {};
  await Promise.all(KEYS.map(async k => {
    try {
      const r = REMOTE ? await remoteLive(k) : await (await import("../lib/live.js")).LIVE[k](new URLSearchParams());
      out[k] = r.ok ? { value: r.value, as_of: r.as_of, source: r.source } : { value: null, as_of: null, source: null, error: r.error || "failed" };
    } catch (e) { out[k] = { value: null, as_of: null, source: null, error: String(e?.message || e) }; }
  }));
  return out;
}

const file = process.argv.slice(2).find(a => !a.startsWith("--"));
console.error(`snapshot: ${REMOTE ? `remote, ${SITE_URL}` : "local getters"}`);
const snap = await snapshot();
const okKeys = Object.entries(snap).filter(([, v]) => v.value).map(([k]) => k);
const bad = Object.entries(snap).filter(([, v]) => !v.value).map(([k, v]) => `${k}: ${v.error}`);
if (file) {
  const E = JSON.parse(readFileSync(file, "utf8"));
  const prev = E.snapshot || {};
  // Keep a previous good value if this run failed for a key: last-known-good with its own time.
  for (const [k, v] of Object.entries(snap)) if (!v.value && prev[k]?.value) snap[k] = { ...prev[k], error: v.error };
  // Only store what the page needs, and drop failures without a value.
  E.snapshot = Object.fromEntries(Object.entries(snap).filter(([, v]) => v.value));
  writeFileSync(file, JSON.stringify(E, null, 2) + "\n");
  console.error(`snapshot: ok ${okKeys.join(", ") || "none"}`);
  if (bad.length) console.error(`snapshot: failed ${bad.join(" | ")}`);
} else {
  console.log(JSON.stringify(snap, null, 2));
}
