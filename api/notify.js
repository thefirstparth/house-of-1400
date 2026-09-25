import { hasRunKey } from "../lib/auth.js";
import { readLatest } from "../lib/edition-file.js";

// RUN_KEY only. Sends the lead headline and link to Telegram, once the edition is live.
export async function POST(request) {
  if (!hasRunKey(request)) return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return Response.json({ ok: true, sent: false, reason: "telegram not configured" });
  const latest = readLatest();
  if (!latest) return Response.json({ ok: false, error: "no edition" }, { status: 500 });
  const origin = process.env.SITE_URL || new URL(request.url).origin;
  const lead = latest.front?.lead?.headline || "Today's paper is out";
  const text = `The House of 1400 · ${latest.date}\n\n${lead}\n\n${origin}/`;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  return Response.json({ ok: r.ok, sent: r.ok }, { status: r.ok ? 200 : 502 });
}
