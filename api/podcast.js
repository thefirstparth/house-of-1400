// The private podcast feed and its episodes (scripts/podcast/make.mjs writes them to the private Blob store under
// podcast/<secret>/). Served here so Apple Podcasts can fetch them: /podcast/<secret>/feed.xml and
// /podcast/<secret>/YYYY-MM-DD.mp3 (vercel.json rewrites to this function). The secret folder name is the only key:
// anything else is a plain 404. Byte ranges are passed through, which Apple Podcasts uses to stream.
const OK_K = /^[a-f0-9]{24}$/, OK_F = /^(feed\.xml|\d{4}-\d{2}-\d{2}\.mp3)$/;

async function serve(request, head) {
  const url = new URL(request.url), k = url.searchParams.get("k") || "", f = url.searchParams.get("f") || "";
  if (!OK_K.test(k) || !OK_F.test(f)) return new Response("Not found", { status: 404 });
  const { get } = await import("@vercel/blob");
  const range = request.headers.get("range"), mp3 = f.endsWith(".mp3");
  let r;
  try { r = await get(`podcast/${k}/${f}`, { access: "private", useCache: mp3, headers: range ? { range } : undefined }); }
  catch { return new Response("Not found", { status: 404 }); }
  if (!r?.stream) return new Response("Not found", { status: 404 });
  const h = new Headers({
    "content-type": mp3 ? "audio/mpeg" : "application/rss+xml; charset=utf-8",
    "accept-ranges": "bytes",
    "cache-control": mp3 ? "public, max-age=86400" : "public, max-age=300",
    "x-robots-tag": "noindex",
  });
  for (const k2 of ["content-length", "content-range", "etag", "last-modified"]) { const v = r.headers.get(k2); if (v) h.set(k2, v); }
  const status = r.headers.get("content-range") ? 206 : 200;
  if (head) { r.stream.cancel().catch(() => {}); return new Response(null, { status, headers: h }); }
  return new Response(r.stream, { status, headers: h });
}

export const GET = request => serve(request, false);
export const HEAD = request => serve(request, true);
