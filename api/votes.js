import { hasRunKey } from "../lib/auth.js";
import { blobConfigured, readJSON } from "../lib/blob.js";

// Recent thumbs for the daily run: GET /api/votes?days=14.
// Without the run key it returns totals only (per thread and per section, ups and downs), which is all the run
// needs to learn from and says nothing more than which stories were liked. With the run key it also returns the
// individual records with their timestamps.
export async function GET(request) {
  const full = hasRunKey(request);
  if (!blobConfigured()) return Response.json({ ok: true, stored: false, totals: { threads: {}, sections: {} }, votes: [] });
  const days = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 14));
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { list } = await import("@vercel/blob");
  const votes = [];
  let cursor;
  do {
    const page = await list({ prefix: "votes/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const d = b.pathname.split("/")[1];
      if (d < since) continue;
      try { const v = await readJSON(b); if (v) votes.push(v); } catch {}
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  votes.sort((a, b) => (a.at < b.at ? -1 : 1));
  const totals = { threads: {}, sections: {} };
  for (const v of votes) {
    if (v.vote !== "up" && v.vote !== "down") continue;
    for (const [k, id] of [["threads", v.thread_id || v.story_id], ["sections", v.section]]) {
      const t = (totals[k][id] ||= { up: 0, down: 0 });
      t[v.vote]++;
    }
  }
  return Response.json({ ok: true, stored: true, days, totals, ...(full ? { votes } : {}) }, { headers: { "cache-control": "no-store" } });
}
