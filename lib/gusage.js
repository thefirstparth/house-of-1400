// How many Google calls the weather feed has made, day by day, for the app's /usage page (Parth, 23 Oct: "just for
// my reassurance"). Counted in a small Redis store (Upstash, connected through Vercel's Marketplace; its REST
// variables are KV_REST_API_URL and KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), one
// hash per India day, kept 40 days. Never in Blob: its monthly operations are already close to the free limit. Without
// the store, only this server's own count since it started is known, and the page says so.
// Vercel keeps the function alive for the write after the reply; outside Vercel (tests) the package may be absent
let waitUntil = null;
import("@vercel/functions").then(m => { waitUntil = m.waitUntil; }).catch(() => {});

const IST = 330 * 6e4;
const dayOf = (ms = Date.now()) => new Date(ms + IST).toISOString().slice(0, 10);
// the store's REST address and token under whatever prefix Vercel gave them when it was connected (24 Oct: the usual
// names weren't there); never the read-only token
const envName = re => Object.keys(process.env).filter(k => re.test(k) && !/READ_ONLY/.test(k) && process.env[k]).sort((a, b) => a.length - b.length)[0] || null;
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env[envName(/REST_API_URL$|REDIS_REST_URL$/)] || null;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env[envName(/REST_API_TOKEN$|REDIS_REST_TOKEN$/)] || null;
// for ?check=usage: the names (never the values) of the settings that look like a Redis store's
export const storeVarNames = () => Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH/.test(k)).sort();
export const usageStored = () => Boolean(url() && token());
export const METHODS = ["current", "hours", "days", "air"];

let LOCAL = { day: null, since: new Date().toISOString(), n: {} };
const redis = (cmds, ms = 2000) => fetch(`${url()}/pipeline`, { method: "POST", headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(ms) }).then(r => (r.ok ? r.json() : Promise.reject(new Error(`store ${r.status}`))));

// counts = { current: 1, hours: 1, days: 1 } etc. Never slows or breaks the feed: the write runs after the reply.
export function countGoogle(counts) {
  const d = dayOf(); if (LOCAL.day !== d) LOCAL = { day: d, since: new Date().toISOString(), n: {} };
  for (const [k, v] of Object.entries(counts)) LOCAL.n[k] = (LOCAL.n[k] || 0) + v;
  if (!usageStored()) return;
  const key = `gusage:${d}`, cmds = [...Object.entries(counts).map(([k, v]) => ["HINCRBY", key, k, String(v)]), ["EXPIRE", key, String(40 * 86400)]];
  const p = redis(cmds).catch(() => null);
  try { waitUntil?.(p); } catch { /* outside a request: the promise just runs */ }
}

// Today and the days of this month so far, from the store; or this server's own count when there is no store
export async function readUsage(now = Date.now()) {
  const today = dayOf(now);
  if (!usageStored()) return { stored: false, today, days: LOCAL.day === today ? [{ d: today, ...LOCAL.n }] : [{ d: today }], since: LOCAL.since };
  const month = today.slice(0, 8), n = +today.slice(8, 10), ds = Array.from({ length: n }, (_, i) => `${month}${String(i + 1).padStart(2, "0")}`);
  const res = await redis(ds.map(d => ["HGETALL", `gusage:${d}`]), 5000);
  const days = ds.map((d, i) => { const a = res[i]?.result || [], o = { d }; for (let j = 0; j + 1 < a.length; j += 2) o[a[j]] = Number(a[j + 1]); return o; });
  return { stored: true, today, days };
}
