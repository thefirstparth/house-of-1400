import { CACHE, LIVE } from "../../lib/live.js";

// GET /api/live/<key>. Returns {ok, value, source, as_of, stale}.
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.pathname.split("/").filter(Boolean).pop();
  const fn = Object.hasOwn(LIVE, key) ? LIVE[key] : null;
  if (!fn) return Response.json({ ok: false, error: "unknown key", keys: Object.keys(LIVE) }, { status: 404 });
  let out;
  try { out = await fn(url.searchParams); }
  catch (e) { out = { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
  const [s, swr] = CACHE[key] || [300, 900];
  const personal = url.searchParams.has("lat");
  return Response.json(out, {
    headers: { "cache-control": out.ok && !personal ? `public, s-maxage=${s}, stale-while-revalidate=${swr}` : "no-store" },
  });
}
