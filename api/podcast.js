// The private podcast feed and its episodes (scripts/podcast/make.mjs writes them to the private Blob store under
// podcast/<secret>/). Served here so Apple Podcasts can fetch them: /podcast/<secret>/feed.xml and
// /podcast/<secret>/YYYY-MM-DD.mp3 (or -v2.mp3, a redo) (vercel.json rewrites to this function). The secret folder name is the only key:
// anything else is a plain 404. Byte ranges are answered by Vercel's CDN from its copy (see serve).
// Since 14 Oct the show is listed (Apple Podcasts, Spotify): the public address is /listen (the feed) and
// /listen/<file>. The folder is the one in the store that holds the feed (there is one), looked up once per instance,
// so it never depends on which copy of the Blob token this function has. The old secret address still works.
const OK_K = /^[a-f0-9]{24}$/, OK_F = /^(feed\.xml|\d{4}-\d{2}-\d{2}(-v\d+)?\.(mp3|vtt))$/;
let folderOf = null;
// (31 Oct 2026) remembered in Redis too (lib/state.js), so a new server does not list the store to find it
async function ownFolder() {
  if (folderOf) return folderOf;
  const { stateGet, stateSet } = await import("../lib/state.js");
  const saved = await stateGet("podcast-folder", null).catch(() => null);
  if (OK_K.test(saved?.k || "")) return (folderOf = saved.k);
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "podcast/", limit: 1000 });
  folderOf = blobs.map(b => b.pathname.match(/^podcast\/([a-f0-9]{24})\/feed\.xml$/)?.[1]).find(Boolean) || "";
  if (folderOf) await stateSet("podcast-folder", null, { k: folderOf }).catch(() => null);
  return folderOf;
}

export function feedAge(now = Date.now()) {
  const ist = new Date(now + 5.5 * 36e5), m = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (m >= 810 && m < 990) return 300;
  return Math.max(300, Math.min(21600, ((810 - m + 1440) % 1440) * 60));
}

// Each file read from Blob is kept in this server's memory for as long as the CDN may keep it (31 Oct 2026: Vercel's
// CDN keeps a copy per region and drops rarely asked files within hours, and each of those misses was a Blob read;
// the misses from every region reach this one function, so its memory answers them). The audio never changes, so the
// last three episodes stay in memory; the feed and transcripts for the same time as at the CDN. If Blob does not
// answer, an older copy in memory is served rather than nothing.
const MEM = new Map(), MP3_KEEP = 3;
const istDay = (now = Date.now()) => new Date(now + 5.5 * 36e5).toISOString().slice(0, 10);
// The feed: once today's episode is in it, an hour at a time (a redo still shows within the hour); before that, as
// feedAge (five minutes from 13:30 to 16:30 IST, when the episode comes out)
export function feedTtl(xml, now = Date.now()) {
  const d = istDay(now);
  return xml.includes(`/${d}.mp3`) || xml.includes(`/${d}-v`) ? 3600 : feedAge(now);
}

async function serve(request, head) {
  const url = new URL(request.url), pub = url.searchParams.has("pub"), f = url.searchParams.get("f") || (pub ? "feed.xml" : "");
  let k = url.searchParams.get("k") || "";
  if (pub) { try { k = await ownFolder(); } catch { k = ""; } }
  if (!OK_K.test(k) || !OK_F.test(f)) return new Response("Not found", { status: 404 });
  const mp3 = f.endsWith(".mp3"), vtt = f.endsWith(".vtt"), id = `${k}/${f}`, now = Date.now();
  let m = MEM.get(id);
  if (!m || m.until <= now) {
    let body = null, meta = {};
    try {
      // An episode's audio never changes once published (a redo is a new file, -v2), so it is read whole and held at
      // Vercel's CDN for a year (23 Oct 2026); the CDN answers byte ranges from its copy, a first request gets it all.
      const { get } = await import("@vercel/blob");
      const r = await get(`podcast/${id}`, { access: "private", useCache: mp3 });
      if (r?.stream) {
        body = new Uint8Array(await new Response(r.stream).arrayBuffer());
        for (const h of ["etag", "last-modified"]) { const v = r.headers.get(h); if (v) meta[h] = v; }
      }
    } catch { body = null; }
    if (body) {
      const ttl = mp3 ? 31536000 : vtt ? feedAge(now) : feedTtl(new TextDecoder().decode(body), now);
      m = { body, meta, ttl, until: mp3 ? Infinity : now + ttl * 1000 };
      MEM.delete(id); MEM.set(id, m);
      const mp3s = [...MEM.keys()].filter(x => x.endsWith(".mp3"));
      for (const x of mp3s.slice(0, Math.max(0, mp3s.length - MP3_KEEP))) MEM.delete(x);
    } else if (!m) return new Response("Not found", { status: 404 });
    else m = { ...m, ttl: 300 }; // Blob did not answer: the older copy, briefly
  }
  const h = new Headers({
    "content-type": mp3 ? "audio/mpeg" : vtt ? "text/vtt; charset=utf-8" : "application/rss+xml; charset=utf-8",
    "accept-ranges": "bytes",
    "content-length": String(m.body.byteLength),
    // the feed and transcripts: as long as this server keeps them (feedTtl, feedAge); the audio for a year
    "cache-control": mp3 ? "public, max-age=86400, s-maxage=31536000, immutable" : `public, max-age=300, s-maxage=${Math.max(60, Math.round(m.until === Infinity ? m.ttl : Math.min(m.ttl, (m.until - now) / 1000)))}, stale-while-revalidate=600`,
    "x-robots-tag": "noindex",
    ...m.meta,
  });
  return new Response(head ? null : m.body, { status: 200, headers: h });
}

export const GET = request => serve(request, false);
export const HEAD = request => serve(request, true);
