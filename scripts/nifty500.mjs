// Refresh config/nifty500.csv, the fallback copy of NSE's Nifty 500 constituent list used by /api/live/movers
// when NSE refuses the live request. NSE rebalances the index twice a year (March and September).
// Usage: node scripts/nifty500.mjs
import { writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
ensureProxy();
const { parseNifty500 } = await import("../lib/live.js");
const r = await fetch("https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv", { headers: { "user-agent": "Mozilla/5.0" } });
if (!r.ok) { console.error(`nifty500: NSE answered ${r.status}; kept the old copy`); process.exit(1); }
const csv = await r.text();
const n = parseNifty500(csv).length;
if (n < 450) { console.error(`nifty500: only ${n} rows; kept the old copy`); process.exit(1); }
writeFileSync("config/nifty500.csv", csv.endsWith("\n") ? csv : csv + "\n");
console.log(`nifty500: ${n} constituents saved`);
