import { blobConfigured, putJSON } from "../lib/blob.js";

// Public (the site has no password). Stores one vote per story per day in Vercel Blob when a store is connected.
const SECTIONS = /^[a-z]{2,20}$/;
const ID = /^[A-Za-z0-9._:-]{1,80}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const { date, story_id, thread_id, section, vote } = body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !ID.test(story_id || "") || (thread_id && !ID.test(thread_id)) ||
      !SECTIONS.test(section || "") || !["up", "down", "none"].includes(vote)) {
    return Response.json({ ok: false, error: "invalid vote" }, { status: 400 });
  }
  if (!blobConfigured()) return Response.json({ ok: true, stored: false });
  const rec = { date, story_id, thread_id: thread_id || null, section, vote, at: new Date().toISOString() };
  try { await putJSON(`votes/${date}/${story_id}.json`, rec); }
  catch (e) { return Response.json({ ok: false, stored: false, error: "store unavailable" }, { status: 502 }); }
  return Response.json({ ok: true, stored: true });
}
