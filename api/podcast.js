// The private podcast feed and its episodes (scripts/podcast/make.mjs writes them to the private Blob store under
// podcast/<secret>/). Served here so Apple Podcasts can fetch them: /podcast/<secret>/feed.xml and
// /podcast/<secret>/YYYY-MM-DD.mp3 (or -v2.mp3, a redo) (vercel.json rewrites to this function). The secret folder name is the only key:
// anything else is a plain 404. Byte ranges are passed through, which Apple Podcasts uses to stream.
// Since 14 Oct the show is listed (Apple Podcasts, Spotify): the public address is /listen (the feed) and
// /listen/<file>. The folder is the one in the store that holds the feed (there is one), looked up once per instance,
// so it never depends on which copy of the Blob token this function has. The old secret address still works.
const OK_K = /^[a-f0-9]{24}$/, OK_F = /^(feed\.xml|\d{4}-\d{2}-\d{2}(-v\d+)?\.(mp3|vtt))$/;
let folderOf = null;
async function ownFolder() {
  if (folderOf) return folderOf;
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "podcast/", limit: 1000 });
  return (folderOf = blobs.map(b => b.pathname.match(/^podcast\/([a-f0-9]{24})\/feed\.xml$/)?.[1]).find(Boolean) || "");
}

export function feedAge(now = Date.now()) {
  const ist = new Date(now + 5.5 * 36e5), m = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (m >= 810 && m < 990) return 300;
  return Math.max(300, Math.min(21600, ((810 - m + 1440) % 1440) * 60));
}

async function serve(request, head) {
  const url = new URL(request.url), pub = url.searchParams.has("pub"), f = url.searchParams.get("f") || (pub ? "feed.xml" : "");
  let k = url.searchParams.get("k") || "";
  if (pub) { try { k = await ownFolder(); } catch { k = ""; } }
  if (!OK_K.test(k) || !OK_F.test(f)) return new Response("Not found", { status: 404 });
  const { get } = await import("@vercel/blob");
  const range = request.headers.get("range"), mp3 = f.endsWith(".mp3"), vtt = f.endsWith(".vtt");
  let r;
  // An episode's audio never changes once published (a redo is a new file, -v2), so it is read whole and held at Vercel's
  // CDN for a year (23 Oct 2026: every listen and every piece an app asked for was a function call and a Blob read; the
  // store was suspended). The CDN answers byte ranges from its copy; a first request with a range gets the whole file.
  try { r = await get(`podcast/${k}/${f}`, { access: "private", useCache: mp3, headers: range && !mp3 ? { range } : undefined }); }
  catch { return new Response("Not found", { status: 404 }); }
  if (!r?.stream) return new Response("Not found", { status: 404 });
  const h = new Headers({
    "content-type": mp3 ? "audio/mpeg" : vtt ? "text/vtt; charset=utf-8" : "application/rss+xml; charset=utf-8",
    "accept-ranges": "bytes",
    // the feed and transcripts held five minutes at Vercel's CDN too (20 Oct 2026: every Apple, Spotify and app check of
    // the feed was a function call and a Blob read); an episode's audio as before
    // (23 Oct 2026: still the month's Blob reads; Apple, Spotify and the apps poll the feed all day) five minutes only from
    // 13:30 to 16:30 IST, when a new episode comes out; the rest of the day until 13:30, at most six hours
    "cache-control": mp3 ? "public, max-age=86400, s-maxage=31536000, immutable" : `public, max-age=300, s-maxage=${feedAge()}, stale-while-revalidate=600`,
    "x-robots-tag": "noindex",
  });
  for (const k2 of ["content-length", "content-range", "etag", "last-modified"]) { const v = r.headers.get(k2); if (v) h.set(k2, v); }
  const status = r.headers.get("content-range") ? 206 : 200;
  if (head) { r.stream.cancel().catch(() => {}); return new Response(null, { status, headers: h }); }
  return new Response(r.stream, { status, headers: h });
}

export const GET = request => serve(request, false);
export const HEAD = request => serve(request, true);
