// Call the deployed live layer the way a daily run does: GET <SITE_URL>/api/live/<key> with the RUN_KEY header.
export const SITE_URL = (process.env.SITE_URL || "https://house-of-1400.vercel.app").replace(/\/+$/, "");

export async function remoteLive(key, qs = "") {
  const runKey = process.env.RUN_KEY;
  if (!runKey) throw new Error("RUN_KEY is not set in this environment");
  const r = await fetch(`${SITE_URL}/api/live/${key}${qs}`, { headers: { "x-run-key": runKey, accept: "application/json" }, signal: AbortSignal.timeout(25000) });
  if (r.status === 401) throw new Error("401 from the site: RUN_KEY here does not match RUN_KEY in Vercel");
  if (!r.ok) throw new Error(`${r.status} from ${SITE_URL}/api/live/${key}`);
  return r.json();
}

export const useRemote = argv => !argv.includes("--local");
