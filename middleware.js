import { next } from "@vercel/functions";
import { COOKIE, readCookie, safeEqual, sessionToken } from "./lib/auth.js";
import { loginPage } from "./lib/login-page.js";

// Routes that skip the cookie gate. /api/notify and /api/votes check RUN_KEY themselves.
const OPEN = new Set(["/api/login", "/api/health", "/api/notify", "/api/votes", "/favicon.svg", "/robots.txt"]);

export const config = { matcher: "/((?!_vercel).*)" };

export default async function middleware(request) {
  const url = new URL(request.url);
  if (OPEN.has(url.pathname)) return next();
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const got = readCookie(request.headers.get("cookie"), COOKIE);
    if (got && safeEqual(got, await sessionToken(password))) return next();
  }
  const accept = request.headers.get("accept") || "";
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/content/") || !accept.includes("text/html")) {
    return Response.json({ ok: false, error: "locked" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const html = loginPage({ next: url.pathname + url.search, error: url.searchParams.get("login") === "fail" });
  return new Response(html, { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
