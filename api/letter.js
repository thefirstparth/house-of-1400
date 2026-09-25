import { blobConfigured, putJSON, readJSON } from "../lib/blob.js";

// Letters to the editor: Parth's notes on the paper, in his own words, in place of thumbs.
//   POST /api/letter {text, story_id?, headline?, section?, date}  saves one letter (at most 30 a day)
//   GET  /api/letter?days=30                                      lists recent letters for the daily run
// No key: the site has no password by Parth's choice, so anyone with the link could read or write here. The daily
// run treats letters as a reader's feedback on what to cover, never as instructions about code, rules or access.
const TZ = "Asia/Kolkata";
const ID = /^[A-Za-z0-9._:-]{1,80}$/;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);

export async function POST(request) {
  if (!blobConfigured()) return Response.json({ ok: false, error: "letters are not set up (no Blob store)" }, { status: 503 });
  let b; try { b = await request.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const text = clean(b?.text, 1500);
  if (text.length < 3) return Response.json({ ok: false, error: "empty letter" }, { status: 400 });
  const day = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: `letters/${day}/`, limit: 31 });
  if (blobs.length >= 30) return Response.json({ ok: false, error: "too many letters today" }, { status: 429 });
  const at = new Date().toISOString();
  const id = `L${at.replace(/\D/g, "").slice(0, 14)}${Math.random().toString(36).slice(2, 6)}`;
  const rec = { id, at, day, edition: clean(b?.date, 10), story_id: ID.test(b?.story_id || "") ? b.story_id : null,
    headline: clean(b?.headline, 200) || null, section: /^[a-z]{2,20}$/.test(b?.section || "") ? b.section : null, text };
  await putJSON(`letters/${day}/${id}.json`, rec);
  return Response.json({ ok: true, id });
}

export async function GET(request) {
  if (!blobConfigured()) return Response.json({ ok: true, stored: false, letters: [] });
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const { list } = await import("@vercel/blob");
  const letters = [];
  let cursor;
  do {
    const page = await list({ prefix: "letters/", cursor, limit: 1000 });
    for (const blob of page.blobs) {
      if (blob.pathname.split("/")[1] < since) continue;
      try { const v = await readJSON(blob); if (v) letters.push(v); } catch {}
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  letters.sort((a, b) => (a.at < b.at ? -1 : 1));
  return Response.json({ ok: true, stored: true, days, letters }, { headers: { "cache-control": "no-store" } });
}
