// RUN_KEY check for the endpoints only daily runs may call (/api/votes, /api/notify).
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function hasRunKey(request) {
  const key = process.env.RUN_KEY;
  const got = request.headers.get("x-run-key") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!key && safeEqual(got, key);
}
