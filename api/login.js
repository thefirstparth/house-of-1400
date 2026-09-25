import { COOKIE, MAX_AGE, safeEqual, sessionToken } from "../lib/auth.js";

function safeNext(n) {
  return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function POST(request) {
  const password = process.env.SITE_PASSWORD;
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }
  const given = String(form.get("password") || "");
  const dest = safeNext(String(form.get("next") || "/")).replace(/[?&]login=fail/, "");
  if (!password || !safeEqual(given, password)) {
    await new Promise(r => setTimeout(r, 600));
    const u = new URL(dest, "https://x");
    u.searchParams.set("login", "fail");
    return new Response(null, { status: 303, headers: { location: u.pathname + u.search, "cache-control": "no-store" } });
  }
  const token = await sessionToken(password);
  return new Response(null, {
    status: 303,
    headers: {
      location: dest,
      "cache-control": "no-store",
      "set-cookie": `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export function GET() {
  return new Response(null, { status: 303, headers: { location: "/" } });
}
