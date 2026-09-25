// Fetch recent thumbs for the daily run: GET <SITE_URL>/api/votes?days=14. Prints the totals per thread and per
// section (public, no key needed). If RUN_KEY is available the site also returns the individual votes.
// Usage: node scripts/votes.mjs [--days 14]
import { ensureProxy } from "./proxy.mjs";
import { SITE_URL } from "./remote.mjs";
ensureProxy();
const i = process.argv.indexOf("--days"), days = i > -1 ? Number(process.argv[i + 1]) : 14;
const headers = { accept: "application/json" };
if (process.env.RUN_KEY) headers["x-run-key"] = process.env.RUN_KEY;
try {
  const r = await fetch(`${SITE_URL}/api/votes?days=${days}`, { headers, signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  if (!j.stored) console.error("votes: no Blob store connected; skipping votes");
  else console.error(`votes: totals for ${Object.keys(j.totals.threads).length} threads and ${Object.keys(j.totals.sections).length} sections over ${days} days`);
  console.log(JSON.stringify({ totals: j.totals || { threads: {}, sections: {} }, votes: j.votes || null }, null, 2));
} catch (e) { console.error(`votes: unavailable (${e.message}); skipping votes`); console.log(JSON.stringify({ totals: { threads: {}, sections: {} }, votes: null })); }
