import { blobConfigured, putJSON, readJSON } from "../lib/blob.js";
import { readLatest } from "../lib/edition-file.js";

// Telegram for The House of 1400. No key needed: it can only ever send the deployed edition's own summary, at most
// once per edition (a marker in Blob), so calling it twice or from anywhere does nothing more.
//   POST /api/notify?run=main|retry1|retry2|retry3   the daily run, after the edition is live
//   GET  /api/notify                                   the Vercel cron at 16:00 IST: sends the summary if the run
//        did not, or one "no paper today" message if today's edition never went live.
// Setup: TELEGRAM_BOT_TOKEN in Vercel, then send any message to the bot once. TELEGRAM_CHAT_ID is optional: without
// it the chat is found from the bot's recent messages and remembered.
const TZ = "Asia/Kolkata";
const LIVE_KEYS = ["weather", "f1_next", "f1_standings", "f1_last", "football", "laliga_table", "nba", "tennis", "markets", "fx", "crypto", "gold_in", "trends", "betting", "movers"];
const RUNS = { main: "the 14:00 run", retry1: "the 14:29 retry", retry2: "the 14:58 retry", retry3: "the 15:27 retry" };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const hm = () => new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const longDate = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/\bSept\b/, "Sep");
const KEY_NAMES = { weather: "weather", f1_next: "F1 schedule", f1_standings: "F1 standings", f1_last: "F1 results", football: "Madrid fixtures", laliga_table: "La Liga table", nba: "NBA", tennis: "tennis", markets: "markets", fx: "rupee", crypto: "Bitcoin", gold_in: "gold", trends: "trends", betting: "betting prices", movers: "market movers" };
const WAIVER_NAMES = { pitch: "The Wider Pitch", sidelines: "The Sidelines", screen: "Screen & Stage", talk: "Talk of the Day", betting: "The Betting Window", ledger_notes: "Ledger notes", betting_carry: "betting carry-over", cut: "early information cut" };

async function marker(name) {
  if (!blobConfigured()) return null;
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: `notify/${name}`, limit: 1 });
  return blobs[0] ? (await readJSON(blobs[0]).catch(() => ({}))) || {} : null;
}
const mark = (name, obj) => (blobConfigured() ? putJSON(`notify/${name}.json`, obj) : null);

async function chatId(token) {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const saved = await marker("chat").catch(() => null);
  if (saved?.id) return saved.id;
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const j = await r.json().catch(() => ({}));
  const chats = (j.result || []).map(u => (u.message || u.edited_message || u.my_chat_member)?.chat).filter(c => c?.type === "private");
  const id = chats.at(-1)?.id;
  if (id) await mark("chat", { id }).catch(() => {});
  return id || null;
}

async function send(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, reason: "TELEGRAM_BOT_TOKEN is not set in Vercel" };
  const chat = await chatId(token);
  if (!chat) {
    // Say which bot this token belongs to and what it can see, so the setup can be checked from here.
    const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json().catch(() => ({}));
    const up = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json().catch(() => ({}));
    const seen = up.ok ? `${(up.result || []).length} recent update(s)` : `getUpdates error: ${up.description || "unknown"}`;
    return { sent: false, reason: `no chat yet for @${me.result?.username || "?"} (${seen}): open that bot in Telegram, press Start or send any message, then try again` };
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return r.ok ? { sent: true } : { sent: false, reason: `telegram ${r.status}` };
}

export function summary(E, origin, run) {
  const lines = [`📰 <b>The House of 1400</b> · ${esc(longDate(E.date))} · No. ${esc(E.edition_no)}`, ""];
  lines.push(`<b>${esc(E.front?.lead?.headline || "Today's paper is out")}</b>`, "");
  const glance = (E.glance || []).slice(0, 6);
  if (glance.length) lines.push(...glance.map(g => `• <i>${esc(g.section)}</i>: ${esc(g.line)}`), "");
  if (E.editor_note) lines.push(`✒️ <i>${esc(E.editor_note)}</i>`, "");
  // Run status in one line: when and by which run, then anything that went wrong on the way.
  const snap = E.snapshot || {};
  const down = LIVE_KEYS.filter(k => !snap[k]?.value || snap[k]?.error);
  const waived = Object.keys(E.coverage_waivers || {});
  const status = [`Published ${hm()} IST${RUNS[run] ? ` by ${RUNS[run]}` : ""}`];
  status.push(down.length ? `older data for ${down.map(k => KEY_NAMES[k] || k).join(", ")}` : "all live sources fine");
  if (waived.length) status.push(`thin today: ${waived.map(k => WAIVER_NAMES[k] || k).join(", ")}`);
  lines.push(`<code>${esc(status.join(" · "))}</code>`, "", `${origin}/`);
  return lines.join("\n");
}

async function handle(request, { cron }) {
  const url = new URL(request.url);
  const origin = (process.env.SITE_URL || url.origin).replace(/\/+$/, "");
  const run = url.searchParams.get("run");
  const E = readLatest();
  const day = today();
  if (E?.date === day) {
    if (await marker(`sent-${day}`)) return Response.json({ ok: true, sent: false, reason: "already sent today" });
    const out = await send(summary(E, origin, cron ? null : run));
    if (out.sent) await mark(`sent-${day}`, { at: new Date().toISOString(), run: run || (cron ? "cron" : null) });
    return Response.json({ ok: true, ...out });
  }
  // Today's edition is not live. Only the afternoon cron says so, once, after the last retry has had its chance.
  if (!cron || hm() < "15:55") return Response.json({ ok: true, sent: false, reason: "today's edition is not live yet" });
  if (await marker(`late-${day}`)) return Response.json({ ok: true, sent: false, reason: "already sent today" });
  const out = await send(`🕯️ <b>No paper today</b> (${esc(longDate(day))}).\nAll four runs finished without publishing. The site is showing ${E ? `the edition of ${esc(longDate(E.date))}` : "the last edition"}; nothing needs doing on your side.\n\n${origin}/`);
  if (out.sent) await mark(`late-${day}`, { at: new Date().toISOString() });
  return Response.json({ ok: true, ...out });
}

export const POST = request => handle(request, { cron: false });
export const GET = request => handle(request, { cron: true });
