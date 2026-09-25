// Fetch recent thumbs for the daily run: GET <SITE_URL>/api/votes?days=14. The run key reaches the site either
// from RUN_KEY in the environment or from an API credential the cloud environment attaches to requests for the
// site (the run never needs to see it). Prints the votes as JSON, or [] with a note if they are unavailable.
// Usage: node scripts/votes.mjs [--days 14]
import { ensureProxy } from "./proxy.mjs";
import { SITE_URL } from "./remote.mjs";
ensureProxy();
const i = process.argv.indexOf("--days"), days = i > -1 ? Number(process.argv[i + 1]) : 14;
const headers = { accept: "application/json" };
if (process.env.RUN_KEY) headers["x-run-key"] = process.env.RUN_KEY;
try {
  const r = await fetch(`${SITE_URL}/api/votes?days=${days}`, { headers, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { console.error("votes: the site did not receive the run key (add it as an API credential for the site); skipping votes"); console.log("[]"); process.exit(0); }
  if (!j.stored) console.error("votes: no Blob store connected; skipping votes");
  console.error(`votes: ${(j.votes || []).length} in the last ${days} days`);
  console.log(JSON.stringify(j.votes || [], null, 2));
} catch (e) { console.error(`votes: unavailable (${e.message}); skipping votes`); console.log("[]"); }
