import { hasRunKey } from "../lib/auth.js";
import { blobConfigured, readJSON } from "../lib/blob.js";

// RUN_KEY only. Returns recent votes for the daily run: GET /api/votes?days=14
export async function GET(request) {
  if (!hasRunKey(request)) return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  if (!blobConfigured()) return Response.json({ ok: true, stored: false, votes: [] });
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
  return Response.json({ ok: true, stored: true, votes }, { headers: { "cache-control": "no-store" } });
}
