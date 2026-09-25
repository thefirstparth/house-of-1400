// Cookie-gated by middleware. Stores one vote per request in Vercel Blob when configured.
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: true, stored: false });
  const { put } = await import("@vercel/blob");
  const rec = { date, story_id, thread_id: thread_id || null, section, vote, at: new Date().toISOString() };
  await put(`votes/${date}/${story_id}.json`, JSON.stringify(rec), {
    access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
  return Response.json({ ok: true, stored: true });
}
