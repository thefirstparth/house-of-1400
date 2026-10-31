// Small state files (the gold history, the TV feed's alarm state, the Telegram markers) in the Redis store that is
// already connected for the weather counter (lib/gusage.js), not in Blob (31 Oct 2026: the team's Blob reads and
// writes were over the free plan's limits; every server that started read these files again). Redis's free
// allowance is far larger. Without the store, or when it does not answer, everything falls back to Blob exactly as
// before. The first read of a name that Redis does not have yet copies it from Blob once.
import { redis, usageStored } from "./gusage.js";
import { blobConfigured, putJSON, readPath } from "./blob.js";

const key = name => `h14:${name}`;

// a file's contents (parsed JSON) or null
export async function stateGet(name, blobPath) {
  if (usageStored()) {
    try {
      const [r] = await redis([["GET", key(name)]]);
      if (r?.result != null) return JSON.parse(r.result);
      // not in Redis yet: the Blob copy, once, then Redis has it (a missing file stays missing in both)
      const v = blobConfigured() && blobPath ? await readPath(blobPath).catch(() => null) : null;
      if (v != null) await redis([["SET", key(name), JSON.stringify(v)]]).catch(() => null);
      return v;
    } catch { /* the store did not answer: Blob, as before */ }
  }
  return blobConfigured() && blobPath ? readPath(blobPath).catch(() => null) : null;
}

// save it; ttlDays for a marker that only matters for a few days
export async function stateSet(name, blobPath, obj, ttlDays = 0) {
  if (usageStored()) {
    try {
      const cmd = ["SET", key(name), JSON.stringify(obj)];
      if (ttlDays) cmd.push("EX", String(Math.round(ttlDays * 86400)));
      const [r] = await redis([cmd]);
      if (r?.result === "OK") return true;
    } catch { /* fall through to Blob */ }
  }
  if (!blobConfigured() || !blobPath) return false;
  await putJSON(blobPath, obj);
  return true;
}
export const stateConfigured = () => usageStored() || blobConfigured();
