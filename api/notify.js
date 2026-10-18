import { blobConfigured, putJSON, readJSON } from "../lib/blob.js";
import { readLatest } from "../lib/edition-file.js";
import { config } from "../lib/live.js";

// Telegram for The House of 1400. No key needed: it can only ever send the deployed edition's own summary, at most
// once per edition (a marker in Blob), so calling it twice or from anywhere does nothing more.
//   POST /api/notify?run=main|retry1|retry2|retry3   the daily run, after the edition is live
//   POST /api/notify?podcast=YYYY-MM-DD&k=<folder>     the podcast job (scripts/podcast/make.mjs), once the day's episode
//        is in the feed: a separate message, at most once a day, with the writer and voice that made it (Parth, 13 Oct)
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

export async function send(text) {
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

// The message (Parth, 12 Oct 2026: short, structured, the right data): the day's headlines with their tags, then money,
// what is coming up for the teams and players he follows, the weather, and the link. A warning line only when
// something went wrong. Every figure comes from the edition's own snapshot; a missing one is left out, never guessed.
const num = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = x => `${x >= 0 ? "▲" : "▼"}${Math.abs(x).toFixed(1)}%`;
const ymdIST = t => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const whenIST = (utc, now) => {
  const d = new Date(utc), days = (Date.parse(ymdIST(d)) - Date.parse(ymdIST(now))) / 864e5;
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
  return `${day} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ })}`;
};
const surname = n => String(n || "").trim().split(/\s+/).at(-1);
const SOON = 3 * 864e5; // fixtures within the next three days

function upNext(E, cfg, now) {
  const out = [], soon = u => { const t = Date.parse(u); return t > now - 2 * 36e5 && t < now + SOON; };
  const club = cfg.follows?.football_club?.name || "", clubShort = surname(club);
  const team = { madrid: ["⚽", clubShort || "Madrid"], india_cricket: ["🏏", "India"] };
  for (const [key, c] of Object.entries(E.chronology || {})) {
    const n = c?.next; if (!n?.when_utc || !soon(n.when_utc)) continue;
    if (/f1|max/.test(key)) out.push([n.when_utc, `🏎️ ${n.label}, ${whenIST(n.when_utc, now)}`]);
    else if (team[key]) out.push([n.when_utc, `${team[key][0]} ${team[key][1]} v ${n.label}, ${whenIST(n.when_utc, now)}`]);
    else if (/nba|warriors/.test(key)) out.push([n.when_utc, `🏀 Warriors v ${n.label}, ${whenIST(n.when_utc, now)}`]);
  }
  for (const p of E.tennis?.players || []) {
    const m = p.next_match; if (!m?.when_utc || !soon(m.when_utc)) continue;
    const opp = (m.text || "").match(/\bv\.? ([A-Z][\p{L}'.-]+(?: [A-Z][\p{L}'.-]+)*)/u)?.[1];
    out.push([m.when_utc, `🎾 ${surname(p.name)}${opp ? ` v ${surname(opp)}` : ""}, ${whenIST(m.when_utc, now)}`]);
  }
  return out.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0])).map(x => x[1]);
}

function money(E) {
  const s = E.snapshot || {}, ok = k => s[k]?.value && !s[k]?.error ? s[k].value : null;
  const m = ok("markets"), fx = ok("fx"), gold = ok("gold_in"), btc = ok("crypto"), parts = [];
  const day = d => d && d !== E.date ? ` (${longDate(d).split(" ")[0]})` : "";
  for (const name of ["Nifty 50", "Sensex"]) {
    const i = m?.indices?.find(x => x.name === name);
    if (i && Number.isFinite(i.price) && Number.isFinite(i.change_pct)) parts.push(`${name.replace(" 50", "")} ${num(i.price)} ${pct(i.change_pct)}${day(i.session_date)}`);
  }
  const line2 = [];
  if (Number.isFinite(fx?.price)) line2.push(`₹${fx.price.toFixed(2)}/$`);
  if (Number.isFinite(gold?.per_10g_24k)) line2.push(`Gold ₹${num(gold.per_10g_24k)}/10g`);
  if (Number.isFinite(btc?.price)) line2.push(`BTC $${(btc.price / 1000).toFixed(1)}k`);
  return [parts.join(" · "), line2.join(" · ")].filter(Boolean);
}

// Headlines: the paper's own stories and briefs (front page first, then the sections), most important first by
// Bhide's art scores, 4 to 10 of them. "The day in a minute" belongs to the page and is not used here.
function headlines(E) {
  const items = [];
  if (E.front) items.push(E.front.lead, ...(E.front.seconds || []), ...(E.front.briefs || []));
  for (const S of Object.values(E.sections || {})) items.push(...(S.stories || []), ...(S.briefs || []));
  const seen = new Set(), list = items.filter(i => i?.headline && !seen.has(i.id) && seen.add(i.id));
  const imp = Object.fromEntries((E.art_scores || []).map(x => [x.story_id, x.importance ?? 0]));
  const [lead, ...rest] = list;
  const ranked = rest.map((x, i) => ({ x, i })).sort((a, b) => (imp[b.x.id] ?? 1) - (imp[a.x.id] ?? 1) || a.i - b.i).map(r => r.x);
  const strong = ranked.filter(x => (imp[x.id] ?? 1) >= 2);
  return [lead, ...ranked.slice(0, Math.min(9, Math.max(3, strong.length)))].filter(Boolean);
}

export function summary(E, origin, run, { cfg = {}, now = Date.now() } = {}) {
  const tag = i => esc(String(i.kicker || "").trim());
  const heads = headlines(E);
  const lines = [`📰 <b>The House of 1400</b> · ${esc(longDate(E.date))}`, ""];
  if (heads.length) {
    const [lead, ...rest] = heads;
    lines.push(`<b>${esc(lead.headline)}</b>`, ...rest.map(i => `• ${tag(i) ? `${tag(i)}: ` : ""}${esc(i.headline)}`));
  } else lines.push("<b>Today's paper is out</b>");
  if (E.editor_note && E.big_day) lines.push("", `✒️ <i>${esc(E.editor_note)}</i>`);
  const mo = money(E);
  if (mo.length) lines.push("", `📈 ${esc(mo[0])}`, ...mo.slice(1).map(esc));
  const next = upNext(E, cfg, now);
  if (next.length) lines.push("", ...next.map(esc));
  const city = E.snapshot?.weather?.value?.cities?.[0];
  const wx = city?.current && Number.isFinite(city.current.temp) ? `☀️ ${esc(city.name)} ${Math.round(city.current.temp)}°${Number.isFinite(city.daily?.[0]?.rain_prob) ? ` · rain ${city.daily[0].rain_prob}%` : ""}` : null;
  lines.push("", [wx, `<a href="${origin}/">Read the paper →</a>`].filter(Boolean).join("  ·  "));
  // Only when something went wrong: a retry published, or live data is older than it should be.
  const snap = E.snapshot || {};
  const down = LIVE_KEYS.filter(k => !snap[k]?.value || snap[k]?.error);
  const warn = [];
  if (run && run !== "main" && RUNS[run]) warn.push(`published by ${RUNS[run]}`);
  if (down.length) warn.push(`older data for ${down.map(k => KEY_NAMES[k] || k).join(", ")}`);
  if (warn.length) lines.push("", `⚠️ ${esc(warn.join(" · "))}`);
  return lines.join("\n");
}

// The podcast's message: the episode's own record (written by make.mjs next to the MP3, in the private store), so it can
// only ever announce an episode that is really in the feed, and only today's, once.
const MODEL_NAMES = m => String(m || "").replace(/^gemini-/, "Gemini ").replace(/-flash-lite/, " Flash Lite").replace(/-flash-tts/, " Flash TTS").replace(/-flash/, " Flash").replace(/-preview/, " (preview)").replace(/-tts/, " TTS");
async function podcast(url) {
  const k = url.searchParams.get("k") || "", d = url.searchParams.get("podcast") || "", dry = url.searchParams.has("dry");
  if (!/^[a-f0-9]{24}$/.test(k) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return Response.json({ ok: false, sent: false, reason: "bad request" }, { status: 400 });
  if (!dry && d !== today()) return Response.json({ ok: true, sent: false, reason: "only today's episode is announced" });
  if (!dry && await marker(`podcast-${d}`)) return Response.json({ ok: true, sent: false, reason: "already sent today" });
  let m = null;
  try { const { get } = await import("@vercel/blob"); const r = await get(`podcast/${k}/${d}.json`, { access: "private", useCache: false }); m = r?.stream ? await new Response(r.stream).json() : null; } catch {}
  if (!m) return Response.json({ ok: true, sent: false, reason: "no episode in the feed for that day" });
  const backupW = /lite/.test(m.by) || m.by === "code", backupV = m.voice === "kokoro" || (m.voice_model && !/3\.8-flash-tts/.test(m.voice_model));
  const writer = m.by === "code" ? "the plain script made by code (every Gemini writer failed)" : `${MODEL_NAMES(m.by)}${backupW ? " (backup writer)" : ""}`;
  const voice = m.voice === "kokoro" ? "Kokoro (backup voice, no Gemini)" : `${MODEL_NAMES(m.voice_model || "gemini-3.8-flash-tts")}${backupV ? " (backup voice)" : ""}`;
  const mins = Number.isFinite(m.seconds) ? `${Math.floor(m.seconds / 60)} min ${String(Math.round(m.seconds % 60)).padStart(2, "0")} s` : null;
  const text = [`🎧 <b>Today's podcast is in Apple Podcasts</b> (${esc(longDate(d))})`, `<i>${esc(String(m.title || "").replace(/^[^·]*·\s*/, ""))}</i>`, "",
    [mins, `script: ${esc(writer)}`, `voice: ${esc(voice)}`].filter(Boolean).join("\n"), "", `<a href="${esc(m.url)}">Listen here →</a>`].join("\n");
  if (dry) return Response.json({ ok: true, sent: false, text });
  const out = await send(text);
  if (out.sent) await mark(`podcast-${d}`, { at: new Date().toISOString(), by: m.by, voice: m.voice_model || m.voice });
  return Response.json({ ok: true, ...out });
}

async function handle(request, { cron }) {
  const url = new URL(request.url);
  if (!cron && url.searchParams.has("podcast")) return podcast(url);
  const origin = (process.env.SITE_URL || url.origin).replace(/\/+$/, "");
  const run = url.searchParams.get("run");
  const E = readLatest();
  const day = today();
  if (E?.date === day) {
    if (await marker(`sent-${day}`)) return Response.json({ ok: true, sent: false, reason: "already sent today" });
    const out = await send(summary(E, origin, cron ? null : run, { cfg: config() }));
    if (out.sent) await mark(`sent-${day}`, { at: new Date().toISOString(), run: run || (cron ? "cron" : null) });
    return Response.json({ ok: true, ...out });
  }
  // Today's edition is not live. Only the afternoon cron says so, once, after the last retry has had its chance.
  if (!cron || hm() < "15:55") return Response.json({ ok: true, sent: false, reason: "today's edition is not live yet" });
  if (await marker(`late-${day}`)) return Response.json({ ok: true, sent: false, reason: "already sent today" });
  const out = await send(`🕯️ <b>No paper today</b> (${esc(longDate(day))}).\nNone of the runs published today. The site is showing ${E ? `the edition of ${esc(longDate(E.date))}` : "the last edition"}; nothing needs doing on your side.\n\n${origin}/`);
  if (out.sent) await mark(`late-${day}`, { at: new Date().toISOString() });
  return Response.json({ ok: true, ...out });
}

export const POST = request => handle(request, { cron: false });
export const GET = request => handle(request, { cron: true });
