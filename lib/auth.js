// Shared by middleware (edge) and /api/login (node). Web Crypto only.
export const COOKIE = "h1400";
export const MAX_AGE = 60 * 60 * 24 * 30;

export async function sessionToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("house-of-1400:session:v1"));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

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
