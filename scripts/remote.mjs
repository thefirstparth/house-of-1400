// Call the deployed live layer the way a daily run does: GET <SITE_URL>/api/live/<key>.
export const SITE_URL = (process.env.SITE_URL || "https://house-of-1400.vercel.app").replace(/\/+$/, "");

export async function remoteLive(key, qs = "") {
  const r = await fetch(`${SITE_URL}/api/live/${key}${qs}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${r.status} from ${SITE_URL}/api/live/${key}`);
  return r.json();
}

export const useRemote = argv => !argv.includes("--local");
