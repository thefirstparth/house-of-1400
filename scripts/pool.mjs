// Daily run helper: the day's pool (from the 13 Oct 2026 edition; lib/pool.js). Reads the whole reading list for the
// news window (since the previous edition's cut) through /api/live/wire, ranks and shortlists it with every desk's
// floor (config pool), reads each shortlisted story's article through /api/live/read, then writes ledger/pool.json and
// prints the compact pool: the one thing the editor reads to choose and write the day's news.
// Usage: node scripts/pool.mjs [YYYY-MM-DD] [--local]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
import { remoteLive, useRemote } from "./remote.mjs";
import { buildPool, compactPool } from "../lib/pool.js";
ensureProxy();

const args = process.argv.slice(2), H = 36e5;
const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const C = JSON.parse(readFileSync("config/house.json", "utf8")), P = C.pool || {};
const prev = readdirSync("content/editions").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${date}.json`).sort().pop();
const PE = prev ? JSON.parse(readFileSync(`content/editions/${prev}`, "utf8")) : null;
const from = PE ? new Date(`${PE.date}T${PE.cut_ist || "14:00"}:00+05:30`).toISOString() : new Date(Date.now() - 24 * H).toISOString();
const to = new Date(Math.min(Date.now(), Date.parse(`${date}T14:00:00+05:30`) + 2 * H)).toISOString();
const local = !useRemote(args);
const live = async (key, qs, ms) => local ? (await import(key === "read" ? "../lib/pool.js" : "../lib/trial.js"))[key](new URLSearchParams(qs.slice(1))) : remoteLive(key, qs, ms);

let out;
try {
  const w = await live("wire", `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 60000);
  if (!w.ok) throw new Error(w.error || "wire failed");
  const pool = buildPool(w.value, C);
  // read the shortlisted stories' articles, eight to a request, four requests at a time
  const asks = pool.clusters.map(c => c.read.join("|")), got = new Map();
  const chunks = []; for (let i = 0; i < asks.length; i += 8) chunks.push(asks.slice(i, i + 8));
  for (let i = 0; i < chunks.length; i += 4) {
    const res = await Promise.all(chunks.slice(i, i + 4).map(ch => live("read", "?" + ch.map(u => "u=" + encodeURIComponent(u)).join("&"), 60000).catch(e => ({ ok: false, error: e.message }))));
    for (const r of res) for (const x of r?.value || []) got.set(x.ask, x);
  }
  for (const c of pool.clusters) { const r = got.get(c.read.join("|")); if (r?.text) { c.text = r.text; c.text_url = r.url; } }
  const failed = (w.value.feeds || []).filter(f => !f.ok).map(f => `${f.id}: ${f.error}`);
  out = { date, window: { from, to }, built_at: new Date().toISOString(), feeds: { total: (w.value.feeds || []).length, failed }, candidates: pool.candidates, counts: pool.counts,
    read: pool.clusters.filter(c => c.text).length, clusters: pool.clusters, headlines: pool.headlines };
  const text = compactPool(out, P);
  console.log(text);
  console.log(`\npool: ${out.clusters.length} stories (${out.read} with their article text), ${out.headlines.length} headlines, from ${out.candidates} grouped stories; ${out.feeds.total - failed.length} of ${out.feeds.total} feeds answered. ${text.length} characters.`);
} catch (e) {
  out = { date, window: { from, to }, built_at: new Date().toISOString(), error: String(e.message || e), clusters: [], headlines: [] };
  console.error(`pool: ${out.error}. Run it again; if it still fails, research the day by hand (EDITORIAL.md) and say so in checks.pool_error.`);
}
writeFileSync("ledger/pool.json", JSON.stringify(out, null, 1) + "\n");
