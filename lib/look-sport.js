// The trial's sport feeds (/?trial, 27 Nov 2026; v2/trial.js item 6 and 7), behind /api/live/look_*. Every key returns
// {ok, value, source, as_of, stale}. Nothing here is estimated: a feed that cannot read its source, or whose figures do
// not add up, returns ok:false and the page hides its card.
//   look_f1_chatter  the newest worthwhile posts on r/formula1 and r/F1Technical (Arctic Shift's archive of Reddit,
//                    since Reddit refuses cloud servers; Reddit's own JSON and RSS as backups); never invented posts.
//                    X has no free API, so it is not read.
//   look_f1_weekend  the race weekend's sessions: ESPN's live state, and each finished session's quickest (or winner)
//                    and the followed driver's place where two of ESPN, OpenF1 and Jolpica agree; the circuit map.
//   look_title_race  Real Madrid's and the La Liga leader's (or, when Madrid lead, the runner-up's) league points after
//                    each match, from ESPN's team schedules, checked against ESPN's table; and Madrid's next league match.
//   look_last_match  Madrid's last result in any competition, with scorers, crests and ESPN's league slug (for the card
//                    and its Match centre link).
//   look_match       One match from ESPN's soccer summary (?e=<event id>&l=<league slug>): score, scorers, the stat
//                    boxes, a momentum strip (shots and corners by five minutes), goals and cards, commentary.
import { config, getJSON } from "./live.js";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_TABLE = "https://site.api.espn.com/apis/v2/sports/soccer";
const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });
const guard = async fn => { try { return await fn(); } catch (e) { return fail(e); } };
const num = v => { const n = typeof v === "object" && v ? Number(v.value ?? v.displayValue) : Number(v); return Number.isFinite(n) ? n : null; };
const scoreOf = s => (s == null ? null : typeof s === "object" ? num(s.displayValue ?? s.value) : num(s));
const COMPS = { "spanish laliga": "La Liga", laliga: "La Liga", "uefa champions league": "Champions League", "spanish copa del rey": "Copa del Rey", "spanish supercopa": "Supercopa", "fifa club world cup": "Club World Cup", "club friendly": "Friendly" };
export const tidyComp = n => { if (!n) return null; const x = String(n).replace(/^\d{4}(-\d{2,4})?\s+/, "").trim(); return COMPS[x.toLowerCase()] || x.replace(/^Spanish /, ""); };
const safeLogo = u => (typeof u === "string" && /^https:\/\/a\.espncdn\.com\//.test(u) ? u : null);
const hex = c => (typeof c === "string" && /^[0-9a-f]{6}$/i.test(c) ? "#" + c.toLowerCase() : null);
export const decodeEntities = s => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

// ---------------------------------------------------------------- (6) Paddock Chatter: r/formula1 and r/F1Technical
// Reddit refuses cloud servers (403 from Vercel and from the build machine, Nov 2026) and closed logged-out reading, so
// the posts come from Arctic Shift (arctic-shift.photon-reddit.com), a free public archive that records each post as it
// is made through Reddit's own API. It has no votes for a post under about a day and a half old, so the card ranks by
// what it can know: the newest worthwhile posts of the last 36 hours, news and technical posts ahead of chat, a post that
// names our driver or his team first (and tagged), one post per story. Reddit's own JSON and RSS stay as backups.
// One identity, said plainly; no browser disguise and no retries under other names.
const REDDIT_UA = "house-of-1400/1.0 (a private one-reader newspaper; reads r/formula1 posts once every 30 minutes)";
const ARCTIC = "https://arctic-shift.photon-reddit.com/api/posts/search";
const ARCTIC_FIELDS = "id,title,subreddit,author,url,created_utc,over_18,distinguished,link_flair_text,selftext";
const CHATTER_SUBS = ["formula1", "F1Technical"];
const CHATTER_MAX = 5;
const CHATTER_HOURS = 36;
// The subreddit's own housekeeping (daily and session threads, megathreads, mod posts), never news.
const HOUSEKEEPING = /\b(daily|weekly|monthly|weekend)\s+(discussion|thread|general|questions?|chat|megathread)\b|\bmega ?thread\b|\bdiscussion thread\b|\bfree ?talk\b|\bsimple questions\b|\bask anything\b|^\s*\[?meta\]?\s|\bmod(erator)? (post|announcement)\b|\b(pre|post)-?(race|qualifying|quali|sprint|session) (discussion|thread)\b|\b(race|qualifying|sprint|practice|fp[123]) (discussion|thread)\b|\b(practice|qualifying|sprint|race|fp[123]|sprint qualifying) - (discussion|thread)\b|\bgp - (practice|qualifying|sprint|race)/i;
// Flair as a weight: what a reader of the paper wants first. Off-topic posts are left out.
const FLAIR_W = [[/news/i, 1], [/technical/i, 0.95], [/social media|quotes?/i, 0.85], [/statistics|stats/i, 0.8], [/video|photo|image/i, 0.65], [/throwback|history/i, 0.5], [/discussion/i, 0.45], [/misc/i, 0.3], [/satire|humou?r|meme/i, 0.25]];
const flairName = f => (f ? decodeEntities(String(f).replace(/:[a-z0-9-]+:/gi, "")).trim() || null : null);
const flairWeight = (f, sub) => { if (f && /off-?topic/i.test(f)) return 0; for (const [re, w] of FLAIR_W) if (f && re.test(f)) return w; return /f1technical/i.test(sub) ? 0.8 : 0.5; };
export const worthReading = t => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.replace(/[^\p{L}\p{N}]/gu, "").length >= 12 && !HOUSEKEEPING.test(s) && !/^\s*\[?OT\]/i.test(s); };
const domainOf = u => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return /(^|\.)(reddit\.com|redd\.it)$/.test(h) ? null : h; } catch { return null; } };
// Two posts about one story (a repost with or without the outlet in brackets): the same link, or most of the same words.
const words = t => new Set(String(t).toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(w => w.length > 2));
const sameStory = (a, b) => { if (a.link && a.link === b.link) return true; const A = words(a.title), B = words(b.title); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size) >= 0.7; };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// One Arctic Shift post as a chatter post, or null for one the paper does not print (NSFW, a moderator's or a bot's,
// housekeeping, off-topic, deleted).
export function fromArctic(p) {
  const title = decodeEntities(p?.title || "");
  if (!p?.id || !/^[a-z0-9]{3,12}$/i.test(p.id) || !title || !p.subreddit || typeof p.created_utc !== "number") return null;
  if (p.over_18 || p.distinguished || /^automoderator$/i.test(p.author || "") || !worthReading(title)) return null;
  if (/^\[(removed|deleted)\]$/.test(String(p.selftext || "").trim()) && !domainOf(p.url)) return null;
  const flair = flairName(p.link_flair_text), w = flairWeight(flair, p.subreddit);
  if (!w) return null;
  // "[Racing News 365] Stroll hurt his back": the outlet in brackets goes to its own field
  const m = title.match(/^\[([^\]]{2,32})\]\s*(.{12,})$/);
  return { id: p.id, title: m ? m[2] : title, outlet: m ? m[1].trim() : null, url: `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/`, sub: `r/${p.subreddit}`,
    author: p.author && p.author !== "[deleted]" ? `u/${p.author}` : null, flair, link: domainOf(p.url) ? String(p.url) : null, domain: domainOf(p.url),
    at: new Date(p.created_utc * 1000).toISOString(), weight: w };
}
// The card's posts: the last CHATTER_HOURS, ranked by flair, a mention of the followed driver or team (doubled, and
// tagged) and age (half the weight every 12 hours); one post per story; at most two from r/F1Technical.
export function rankChatter(posts, { follows = [], now = Date.now(), max = CHATTER_MAX } = {}) {
  const res = follows.filter(Boolean).map(n => ({ name: n, re: new RegExp(`(^|[^\\p{L}])${escRe(n)}([^\\p{L}]|$)`, "iu") }));
  const scored = posts.filter(p => p && now - Date.parse(p.at) < CHATTER_HOURS * 36e5 && Date.parse(p.at) <= now + 6e4).map(p => {
    const tags = res.filter(f => f.re.test(p.title)).map(f => f.name);
    const age = (now - Date.parse(p.at)) / 36e5;
    return { ...p, tags, score: p.weight * (tags.length ? 2 : 1) * Math.pow(0.5, age / 12) };
  }).sort((a, b) => b.score - a.score);
  const out = [];
  for (const p of scored) {
    if (out.some(q => sameStory(p, q))) continue;
    if (/f1technical/i.test(p.sub) && out.filter(q => /f1technical/i.test(q.sub)).length >= 2) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out.map(({ weight, score, id, ...p }) => p);
}
// Reddit's listing JSON (a backup): data.children[].data. Stickied and NSFW posts are left out; the best-scored first.
export function parseRedditJSON(j) {
  const posts = (j?.data?.children || []).map(c => c?.data).filter(d => d && d.title && d.permalink && !d.stickied && !d.over_18)
    .map(d => ({ title: decodeEntities(d.title), url: `https://www.reddit.com${d.permalink}`, sub: "r/formula1", author: d.author ? `u/${d.author}` : null,
      score: Number.isFinite(d.score) ? d.score : null, comments: Number.isFinite(d.num_comments) ? d.num_comments : null,
      flair: d.link_flair_text ? flairName(d.link_flair_text) : null, at: Number.isFinite(d.created_utc) ? new Date(d.created_utc * 1000).toISOString() : null }));
  return posts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, CHATTER_MAX);
}
// Reddit's Atom feed (a backup; no scores; Reddit's own order, which for /top is by score). Its first entries can be
// the subreddit's pinned posts, which carry no marker in the feed: they are kept only if they also fall within the day.
export function parseRedditRSS(xml, now = Date.now()) {
  const entries = [...String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
  return entries.map(e => {
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const url = decodeEntities((e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "");
    const author = decodeEntities((e.match(/<author>\s*<name>([\s\S]*?)<\/name>/) || [])[1] || "").replace(/^\/?u\//, "u/") || null;
    const at = Date.parse((e.match(/<published>([\s\S]*?)<\/published>/) || e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || "");
    return { title, url, sub: "r/formula1", author, score: null, comments: null, flair: null, at: Number.isFinite(at) ? new Date(at).toISOString() : null };
  }).filter(p => p.title && /^https:\/\/(www\.|old\.)?reddit\.com\/r\/formula1\//i.test(p.url) && (!p.at || now - Date.parse(p.at) < 36 * 36e5)).slice(0, CHATTER_MAX);
}
async function redditText(url, accept) {
  const r = await fetch(url, { headers: { "user-agent": REDDIT_UA, accept }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
// The followed driver's surname and his team's short name (Jolpica's standings), for the tags; the surname alone
// when Jolpica does not answer.
async function f1Follows() {
  const who = String(config().follows?.f1_driver?.name || "").trim(), sur = who.split(/\s+/).pop();
  if (!sur) return [];
  try {
    const j = await getJSON("https://api.jolpi.ca/ergast/f1/current/driverStandings.json", { timeout: 5000 });
    const row = (j.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []).find(r => `${r.Driver?.givenName} ${r.Driver?.familyName}` === who);
    const team = row?.Constructors?.at(-1)?.name?.replace(/\s+(F1 Team|Racing|Formula One Team)$/i, "").trim();
    return [sur, ...(team ? [team] : [])];
  } catch { return [sur]; }
}
export async function look_f1_chatter() {
  const errors = [], follows = await f1Follows();
  try {
    // one subreddit per request, one after another (a free service, asked to be used considerately)
    const all = [];
    for (const sub of CHATTER_SUBS) {
      const r = await fetch(`${ARCTIC}?subreddit=${sub}&sort=desc&limit=50&fields=${ARCTIC_FIELDS}`, { headers: { "user-agent": REDDIT_UA, accept: "application/json" }, signal: AbortSignal.timeout(7000) });
      if (!r.ok) { errors.push(`arctic ${sub} ${r.status}`); continue; }
      const j = await r.json();
      if (!Array.isArray(j?.data)) { errors.push(`arctic ${sub}: no data`); continue; }
      all.push(...j.data.map(fromArctic).filter(Boolean));
    }
    const posts = rankChatter(all, { follows });
    if (posts.length >= 3) return ok({ subs: CHATTER_SUBS.map(s => `r/${s}`), order: "newest", follows, posts }, "Arctic Shift (Reddit)");
    errors.push("arctic: too few posts");
  } catch (e) { errors.push(String(e?.message || e)); }
  try {
    const posts = parseRedditJSON(JSON.parse(await redditText("https://www.reddit.com/r/formula1/top.json?t=day&limit=15&raw_json=1", "application/json")));
    if (posts.length >= 3) return ok({ subs: ["r/formula1"], order: "top", follows, posts }, "Reddit");
    errors.push("json: too few posts");
  } catch (e) { errors.push(String(e?.message || e)); }
  try {
    const posts = parseRedditRSS(await redditText("https://www.reddit.com/r/formula1/top/.rss?t=day", "application/atom+xml"));
    if (posts.length >= 3) return ok({ subs: ["r/formula1"], order: "top", follows, posts }, "Reddit");
    errors.push("rss: too few posts");
  } catch (e) { errors.push(String(e?.message || e)); }
  return fail(errors.join(" | "));
}

// ---------------------------------------------------------------- (6) the race weekend, session by session
// For the Race Weekend card: each session's state as ESPN's live scoreboard has it (a session that starts late or runs
// long is still on), and for each finished one the quickest driver (the winner of a sprint or race) and where the
// followed driver finished, each printed only when two of ESPN, OpenF1 and Jolpica agree. OpenF1 locks every request
// while a session runs (401 for anyone without a paid key, past sessions included), so the agreement falls back on
// ESPN and Jolpica then. The lap time comes from whichever agreeing source has one. Also the circuit map: OpenF1's,
// else F1's own "Track icons" image named for the circuit, checked to exist (the weekend card's map otherwise vanishes
// whenever its feed is refreshed during a session).
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const ESPN_F1 = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard";
const OPENF1 = "https://api.openf1.org/v1";
const F1_SESS = [["FirstPractice", "Practice 1", 60], ["SecondPractice", "Practice 2", 60], ["ThirdPractice", "Practice 3", 60], ["SprintQualifying", "Sprint Qualifying", 45], ["SprintShootout", "Sprint Qualifying", 45], ["Sprint", "Sprint", 60], ["Qualifying", "Qualifying", 60]];
const ESPN_ABBR = { FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3", SS: "Sprint Qualifying", SQ: "Sprint Qualifying", SR: "Sprint", Qual: "Qualifying", Race: "Race" };
const OF1_NAME = { "Practice 1": "Practice 1", "Practice 2": "Practice 2", "Practice 3": "Practice 3", "Sprint Qualifying": "Sprint Qualifying", "Sprint Shootout": "Sprint Qualifying", Sprint: "Sprint", Qualifying: "Qualifying", Race: "Race" };
const ENDED = /end of session|final|finished|complete/i;
// F1's "Track icons 4x3/<name> carbon.png", by Jolpica's circuit id (a venue with no image there has no entry)
const F1_TRACK_NAME = { albert_park: "Australia", shanghai: "China", suzuka: "Japan", bahrain: "Bahrain", jeddah: "Saudi Arabia", miami: "Miami", imola: "Emilia Romagna", monaco: "Monaco", villeneuve: "Canada", catalunya: "Spain", red_bull_ring: "Austria", silverstone: "Great Britain", spa: "Belgium", hungaroring: "Hungary", zandvoort: "Netherlands", monza: "Italy", baku: "Azerbaijan", marina_bay: "Singapore", americas: "United States", rodriguez: "Mexico", interlagos: "Brazil", vegas: "Las Vegas", losail: "Qatar", yas_marina: "Abu Dhabi" };
export const trackIcon = id => (F1_TRACK_NAME[id] ? `https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/${encodeURIComponent(F1_TRACK_NAME[id])}%20carbon.png` : null);
const isoAt = (d, t) => (d ? `${d}T${t || "00:00:00Z"}`.replace(/Z?$/, "Z") : null);
export const surKey = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, "");
// 83.217 -> "1:23.217"
export const lapTime = s => { const n = Number(s); if (!Number.isFinite(n) || n <= 0 || n > 600) return null; const m = Math.floor(n / 60), r = n - m * 60; return `${m}:${r.toFixed(3).padStart(6, "0")}`; };

// Jolpica's season: the weekend on the card (the first race not over three hours after lights out, as f1_next).
export function weekendOf(j, now = Date.now()) {
  const races = j?.MRData?.RaceTable?.Races || [];
  const r = races.find(x => Date.parse(isoAt(x.date, x.time)) + 3 * 36e5 > now);
  if (!r) return null;
  const sessions = [];
  for (const [k, name, minutes] of F1_SESS) if (r[k]?.date && !sessions.some(s => s.name === name)) sessions.push({ name, start: isoAt(r[k].date, r[k].time), minutes, time_confirmed: !!r[k].time });
  sessions.push({ name: "Race", start: isoAt(r.date, r.time), minutes: 120, time_confirmed: !!r.time });
  sessions.sort((a, b) => a.start.localeCompare(b.start));
  return { season: r.season, round: Number(r.round), name: r.raceName, circuit_id: r.Circuit?.circuitId || null, sprint: sessions.some(s => s.name === "Sprint"), sessions };
}
// ESPN's scoreboard: each session of the weekend, its state and its order (surnames, first to last).
export function espnSessions(j, W) {
  const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) < 12 * 36e5;
  return (j?.events || []).flatMap(e => e.competitions || []).map(c => {
    const name = ESPN_ABBR[c.type?.abbreviation], st = c.status?.type || {};
    if (!name || !W.sessions.some(s => s.name === name && near(s.start, c.date))) return null;
    const ended = st.state === "post" || (st.state === "in" && ENDED.test(st.detail || ""));
    const order = (c.competitors || []).filter(x => x.order >= 1).sort((a, b) => a.order - b.order).map(x => x.athlete?.displayName).filter(Boolean);
    return { name, start: c.date, state: ended ? "post" : st.state || null, final: !!st.completed, order: st.state === "pre" ? [] : order };
  }).filter(Boolean);
}
// OpenF1's results for the meeting: by session name, rows in order {sur, code, colour, time}.
export function openf1Sessions(sessions, results, drivers) {
  const drv = new Map((drivers || []).map(d => [d.driver_number, d]));
  const out = {};
  for (const s of sessions || []) {
    const name = OF1_NAME[s.session_name];
    if (!name) continue;
    const race = /^(Sprint|Race)$/.test(name);
    const rows = (results || []).filter(r => r.session_key === s.session_key && r.position >= 1).sort((a, b) => a.position - b.position).map(r => {
      const d = drv.get(r.driver_number) || {}, dur = Array.isArray(r.duration) ? [...r.duration].reverse().find(x => x != null) : r.duration;
      return { sur: d.last_name || null, code: d.name_acronym || null, colour: /^[0-9a-f]{6}$/i.test(d.team_colour || "") ? "#" + d.team_colour.toUpperCase() : null, time: race ? null : lapTime(dur) };
    }).filter(r => r.sur);
    if (rows.length) out[name] = { start: s.date_start, rows };
  }
  return out;
}
// Jolpica's classification of one session (qualifying, sprint or race): rows in order {sur, code, time}.
export function jolpicaRows(j, field) {
  const r = j?.MRData?.RaceTable?.Races?.[0]?.[field] || [];
  return r.filter(x => Number(x.position) >= 1).sort((a, b) => a.position - b.position).map(x => ({ sur: x.Driver?.familyName || null, code: x.Driver?.code || null, time: field === "QualifyingResults" ? (x.Q3 || x.Q2 || x.Q1 || null) : null })).filter(x => x.sur);
}
// The weekend's sessions with what two sources agree on. `lists` per session: {espn: [surnames], openf1: rows, jolpica: rows}.
export function agreeSession(lists, follow) {
  const have = [["ESPN", (lists.espn || []).map(n => ({ sur: n }))], ["OpenF1", lists.openf1 || []], ["Jolpica", lists.jolpica || []]].filter(([, r]) => r.length);
  let top = null, max = null;
  for (let i = 0; i < have.length && !top; i++) for (let k = i + 1; k < have.length && !top; k++) {
    const a = have[i][1][0], b = have[k][1][0];
    if (a && b && surKey(a.sur) === surKey(b.sur)) {
      const rows = [have[i][1][0], have[k][1][0]], withCode = rows.find(r => r.code), withTime = rows.find(r => r.time);
      top = { name: b.sur.length > a.sur.length ? b.sur : a.sur, code: withCode?.code || null, colour: rows.find(r => r.colour)?.colour || null, time: withTime?.time || null, sources: [have[i][0], have[k][0]] };
    }
  }
  const fk = surKey(follow);
  if (fk) {
    const pos = have.map(([src, r]) => [src, r.findIndex(x => surKey(x.sur) === fk) + 1]).filter(([, p]) => p > 0);
    for (let i = 0; i < pos.length && !max; i++) for (let k = i + 1; k < pos.length && !max; k++) if (pos[i][1] === pos[k][1]) max = { pos: pos[i][1], sources: [pos[i][0], pos[k][0]] };
  }
  return { top, max };
}
export function buildWeekend({ W, espn = [], openf1 = {}, jolpica = {}, follow = "", now = Date.now() }) {
  const sessions = W.sessions.map(s => {
    const e = espn.find(x => x.name === s.name), end = Date.parse(s.start) + s.minutes * 6e4;
    const state = e?.state || (now >= end + 15 * 6e4 ? "post" : now >= Date.parse(s.start) ? null : "pre");
    const out = { name: s.name, start: s.start, minutes: s.minutes, time_confirmed: s.time_confirmed, state: e?.state || null, provisional: e ? e.state === "post" && !e.final : false };
    if (state === "post") Object.assign(out, agreeSession({ espn: e?.order || [], openf1: openf1[s.name]?.rows || [], jolpica: jolpica[s.name] || [] }, follow));
    return out;
  });
  return { season: W.season, round: W.round, name: W.name, sprint: W.sprint, sessions };
}
async function headOk(url) {
  try { const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) }); return r.ok && /^image\//.test(r.headers.get("content-type") || ""); } catch { return false; }
}
export async function look_f1_weekend() {
  return guard(async () => {
    const now = Date.now(), follow = String(config().follows?.f1_driver?.name || "");
    const W = weekendOf(await getJSON(`${JOLPICA}/current.json?limit=40`, { timeout: 7000 }), now);
    if (!W) throw new Error("no race weekend");
    const started = Date.parse(W.sessions[0].start) <= now;
    const year = new Date(Date.parse(W.sessions.at(-1).start)).getUTCFullYear();
    const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) < 6 * 36e5;
    const [espn, of1, map0] = await Promise.all([
      started ? getJSON(ESPN_F1, { timeout: 7000 }).then(j => espnSessions(j, W)).catch(() => []) : [],
      // OpenF1: the meeting's sessions, its results and drivers (401 while a session runs: then nothing from here)
      (async () => {
        const ss = (await getJSON(`${OPENF1}/sessions?year=${year}`, { timeout: 6000 })).filter(x => W.sessions.some(s => near(s.start, x.date_start)));
        if (!ss.length) return { sessions: {}, map: null };
        const mk = ss[0].meeting_key;
        const [res, drv, mt] = await Promise.all([started ? getJSON(`${OPENF1}/session_result?meeting_key=${mk}&position%3C%3D22`, { timeout: 6000 }) : [], started ? getJSON(`${OPENF1}/drivers?meeting_key=${mk}`, { timeout: 6000 }) : [], getJSON(`${OPENF1}/meetings?meeting_key=${mk}`, { timeout: 6000 }).catch(() => [])]);
        const img = mt?.[0]?.circuit_image;
        return { sessions: openf1Sessions(ss, res, drv), map: typeof img === "string" && /^https:\/\/media\.formula1\.com\//.test(img) ? img : null };
      })().catch(() => ({ sessions: {}, map: null })),
      trackIcon(W.circuit_id),
    ]);
    // Jolpica's classifications of the sessions that are over (qualifying, sprint, race)
    const JOL = { Qualifying: ["qualifying", "QualifyingResults"], Sprint: ["sprint", "SprintResults"], Race: ["results", "Results"] };
    const jolpica = {};
    await Promise.all(W.sessions.filter(s => JOL[s.name] && now > Date.parse(s.start) + s.minutes * 6e4).map(async s => {
      try { jolpica[s.name] = jolpicaRows(await getJSON(`${JOLPICA}/${W.season}/${W.round}/${JOL[s.name][0]}.json`, { timeout: 6000 }), JOL[s.name][1]); } catch {}
    }));
    const value = buildWeekend({ W, espn, openf1: of1.sessions, jolpica, follow, now });
    value.map = of1.map || (map0 && (await headOk(map0)) ? map0 : null);
    const used = new Set(["Jolpica", ...(espn.length ? ["ESPN"] : []), ...value.sessions.flatMap(s => [...(s.top?.sources || []), ...(s.max?.sources || [])])]);
    return ok(value, [...used].join(", "));
  });
}

// ---------------------------------------------------------------- (7) the title race
// ESPN's table: [{id, team, short, abbr, rank, played, points}], ranked.
export function tableRows(j) {
  const g = (j?.children?.length ? j.children[0] : j)?.standings?.entries || [];
  return g.map(e => {
    const s = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.value ?? Number(x.displayValue)]));
    return { id: String(e.team?.id ?? ""), team: e.team?.displayName || null, short: e.team?.shortDisplayName || e.team?.displayName || null, abbr: e.team?.abbreviation || null,
      rank: s.rank ?? null, played: s.gamesPlayed ?? null, points: s.points ?? null };
  }).filter(r => r.id && r.rank != null).sort((a, b) => a.rank - b.rank);
}
// A team's completed league matches in date order, each with the points it took and the running total.
export function leagueSeries(sched, teamId) {
  const rows = [];
  for (const e of sched?.events || []) {
    const c = e.competitions?.[0] || {}, st = c.status?.type || e.status?.type || {};
    if (!(st.completed && st.state === "post")) continue;
    const cs = c.competitors || [], me = cs.find(x => String(x.team?.id ?? x.id) === String(teamId)), opp = cs.find(x => x !== me);
    if (!me || !opp) continue;
    const gf = scoreOf(me.score), ga = scoreOf(opp.score);
    if (gf == null || ga == null) throw new Error(`no score for ${e.id}`);
    rows.push({ id: String(e.id), date: e.date, opponent: opp.team?.shortDisplayName || opp.team?.displayName || null, home: me.homeAway === "home", gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D" });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let t = 0;
  for (const r of rows) { t += r.res === "W" ? 3 : r.res === "D" ? 1 : 0; r.pts = t; }
  return rows;
}
// The club and its rival (the leader, or the runner-up when the club leads), both checked against the table: the
// computed games and points must equal ESPN's own, or the race is not drawn.
export function titleRace({ table, us: usSched, them: themSched, fixtures, clubId, now = Date.now() }) {
  const us = table.find(r => r.id === String(clubId));
  if (!us) throw new Error("club not in the table");
  const rival = table[0] === us ? table[1] : table[0];
  if (!rival) throw new Error("no rival");
  const a = leagueSeries(usSched, us.id), b = leagueSeries(themSched, rival.id);
  for (const [row, s] of [[us, a], [rival, b]]) {
    if (s.length !== row.played || (s.at(-1)?.pts ?? 0) !== row.points) throw new Error(`${row.short}: ${s.length} games, ${s.at(-1)?.pts ?? 0} pts computed; table ${row.played}, ${row.points}`);
  }
  if (!a.length || !b.length) throw new Error("no league games yet");
  const nx = (fixtures?.events || []).map(e => {
    const c = e.competitions?.[0] || {}, st = c.status?.type || {}, cs = c.competitors || [];
    const me = cs.find(x => String(x.team?.id ?? x.id) === String(clubId)), opp = cs.find(x => x !== me);
    return me && opp && !st.completed && st.state !== "post" ? { id: String(e.id), date: e.date, opponent: opp.team?.displayName || null, opponent_id: String(opp.team?.id ?? "") || null, home: me.homeAway === "home", time_confirmed: !(c.timeValid === false || e.timeValid === false), live: st.state === "in" } : null;
  }).filter(x => x && Date.parse(x.date) > now - 3 * 36e5).sort((x, y) => x.date.localeCompare(y.date))[0] || null;
  const side = (row, s) => ({ id: row.id, name: row.team, short: row.short, abbr: row.abbr, rank: row.rank, played: row.played, points: row.points, series: s.map(r => r.pts), results: s.map(r => r.res) });
  return { league: "La Liga", us: side(us, a), rival: side(rival, b), next: nx };
}
export async function look_title_race() {
  return guard(async () => {
    const club = config().follows.football_club, league = club.league || "esp.1";
    const table = tableRows(await getJSON(`${ESPN_TABLE}/${league}/standings`, { timeout: 8000 }));
    const us = table.find(r => r.id === String(club.espn_id));
    if (!us) throw new Error("club not in the table");
    const rival = table[0] === us ? table[1] : table[0];
    const [a, b, fx] = await Promise.all([
      getJSON(`${ESPN}/${league}/teams/${us.id}/schedule`, { timeout: 8000 }),
      getJSON(`${ESPN}/${league}/teams/${rival.id}/schedule`, { timeout: 8000 }),
      getJSON(`${ESPN}/${league}/teams/${us.id}/schedule?fixture=true`, { timeout: 8000 }).catch(() => ({ events: [] })),
    ]);
    return ok(titleRace({ table, us: a, them: b, fixtures: fx, clubId: club.espn_id }), "ESPN");
  });
}

// ---------------------------------------------------------------- (7) one match, from ESPN's summary
const SHOTS = /^(shot-|goal|penalty---scored|penalty---saved|penalty---missed|own-goal)/;
// "45'+2'" -> 45 (stoppage time counts in the minute it was added to); "90'" -> 90
const minuteOf = d => { const m = String(d || "").match(/(\d+)'?/); return m ? Number(m[1]) : null; };
// The goals in order, each given to the side whose count went up in ESPN's own running score ("Goal! A 1, B 0."),
// so an own goal lands with the side it counted for; ESPN's team is the fallback.
function goalsOf(keyEvents, sides) {
  const out = []; let prev = [0, 0];
  for (const k of keyEvents || []) {
    if (!k.scoringPlay || k.shootout) continue;
    const t = String(k.type?.type || ""), og = /own-goal/.test(t), pen = /penalty/.test(t);
    let side = null;
    const m = String(k.text || "").match(/Goal!\s+.+?\s(\d+),\s+.+?\s(\d+)\./);
    if (m) { const now = [+m[1], +m[2]], up = [now[0] > prev[0], now[1] > prev[1]]; side = up[0] !== up[1] ? (up[0] ? 0 : 1) : null; prev = now; }
    if (side == null && !og) side = sides.findIndex(s => s.id === String(k.team?.id ?? ""));
    if (side == null || side < 0) continue;
    const who = k.participants?.[0]?.athlete?.displayName || null;
    out.push({ side, who, assist: !og && !pen ? k.participants?.[1]?.athlete?.displayName || null : null, minute: k.clock?.displayValue || null, m: minuteOf(k.clock?.displayValue), pen, og });
  }
  return out;
}
const STAT_SET = [["possessionPct", "Possession"], ["totalShots", "Shots"], ["shotsOnTarget", "On target"], ["wonCorners", "Corners"], ["totalPasses", "Passes"], ["foulsCommitted", "Fouls"]];
// the Stats view's longer list (each only when both sides have it)
const STAT_ALL = [["possessionPct", "Possession"], ["totalShots", "Shots"], ["shotsOnTarget", "On target"], ["blockedShots", "Blocked shots"], ["wonCorners", "Corners"], ["totalPasses", "Passes"], ["accuratePasses", "Accurate passes"], ["totalCrosses", "Crosses"], ["totalTackles", "Tackles"], ["interceptions", "Interceptions"], ["totalClearance", "Clearances"], ["saves", "Saves"], ["offsides", "Offsides"], ["foulsCommitted", "Fouls"], ["yellowCards", "Yellow cards"], ["redCards", "Red cards"]];
// A side's line-up from ESPN's roster: starters placed in the formation's lines (depth from the position code, then
// left to right), and the bench, those who came on first. Null when there is no formation or a starter has no position:
// a line-up that cannot be drawn is not drawn.
const DEPTH = p => (p === "G" ? 0 : /^(CD|LB|RB|D|SW|LWB|RWB)/.test(p) ? 1 : /^DM/.test(p) ? 2 : /^(LM|RM|CM|M)/.test(p) ? 3 : /^AM/.test(p) ? 4 : /^(F|LF|RF|CF|ST|LW|RW|SS)/.test(p) ? 5 : null);
const LAT = p => (/^(LB|LWB)$/.test(p) ? -1 : /^(RB|RWB)$/.test(p) ? 1 : /^CD-L$|^DM-L$|^CM-L$/.test(p) ? -0.4 : /^CD-R$|^DM-R$|^CM-R$/.test(p) ? 0.4 : /-L$|^LM|^LW|^LF/.test(p) ? -0.8 : /-R$|^RM|^RW|^RF/.test(p) ? 0.8 : 0);
export function lineupOf(r) {
  if (!r?.roster?.length) return null;
  const st = (p, k) => num((p.stats || []).find(s => s.name === k)?.value) || 0;
  const players = r.roster.map(p => ({ id: String(p.athlete?.id ?? ""), name: p.athlete?.displayName || null, short: p.athlete?.lastName || p.athlete?.displayName || null, no: p.jersey != null ? String(p.jersey) : "",
    pos: p.position?.abbreviation || "", starter: !!p.starter, on: !!p.subbedIn, off: !!p.subbedOut, goals: st(p, "totalGoals"), yellow: st(p, "yellowCards") > 0, red: st(p, "redCards") > 0 })).filter(p => p.name);
  const starters = players.filter(p => p.starter), rows = String(r.formation || "").split("-").map(Number).filter(n => n > 0);
  if (starters.length !== 11 || rows.reduce((a, b) => a + b, 0) !== 10 || starters.some(p => DEPTH(p.pos) == null) || starters.filter(p => p.pos === "G").length !== 1) return null;
  const rest = starters.filter(p => p.pos !== "G").sort((a, b) => DEPTH(a.pos) - DEPTH(b.pos));
  const lines = [starters.filter(p => p.pos === "G")];
  let at = 0;
  for (const n of rows) { lines.push(rest.slice(at, at + n).sort((a, b) => LAT(a.pos) - LAT(b.pos))); at += n; }
  const bench = players.filter(p => !p.starter).sort((a, b) => Number(b.on) - Number(a.on));
  return { formation: r.formation, lines: lines.map(l => l.map(({ starter, ...p }) => p)), bench: bench.map(({ starter, ...p }) => p) };
}
// Every shot with a place on the pitch (ESPN's commentary: x toward the goal aimed at, 0 to 100; y across), for the map.
export function shotsOf(commentary, teams) {
  const idx = n => teams.findIndex(t => t.name === n || t.short === n);
  return (commentary || []).map(c => c.play).filter(p => p && p.fieldPositionX != null && SHOTS.test(String(p.type?.type || "")) && !/penalty---missed|own-goal/.test(p.type?.type || ""))
    .map(p => { const t = String(p.type.type), side = idx(p.team?.displayName), x = num(p.fieldPositionX), y = num(p.fieldPositionY);
      return side < 0 || x == null || y == null || x < 50 || x > 100 || y < 0 || y > 100 ? null : { side, x, y, m: minuteOf(p.clock?.displayValue), who: p.participants?.[0]?.athlete?.displayName || null, out: /^goal|penalty---scored/.test(t) ? "goal" : /on-target|saved/.test(t) ? "on" : /woodwork/.test(t) ? "post" : /blocked/.test(t) ? "blocked" : "off" }; })
    .filter(Boolean);
}
// Each side's last five results before this match (ESPN's lastFiveGames, which lists them oldest first), latest first: "W", "D", "L".
export function formOf(lastFive, teams) {
  return teams.map(t => { const g = (lastFive || []).find(x => String(x.team?.id) === t.id); const r = [...(g?.events || [])].sort((a, b) => String(b.gameDate || "").localeCompare(String(a.gameDate || ""))).map(e => String(e.gameResult || "").toUpperCase()).filter(x => /^[WDL]$/.test(x)); return r.length >= 3 ? r.slice(0, 5) : null; });
}
export function parseMatch(j, { commentaryMax = 200 } = {}) {
  const h = j?.header, c = h?.competitions?.[0];
  if (!c?.competitors?.length) throw new Error("no match in the summary");
  const st = c.status?.type || h.status?.type || {};
  const cs = [...c.competitors].sort((a, b) => (a.homeAway === "home" ? -1 : 1) - (b.homeAway === "home" ? -1 : 1));
  const teams = cs.map(x => ({ id: String(x.team?.id ?? x.id ?? ""), name: x.team?.displayName || null, short: x.team?.shortDisplayName || x.team?.displayName || null, abbr: x.team?.abbreviation || null,
    logo: safeLogo((x.team?.logos || []).find(l => (l.rel || []).includes("default"))?.href || x.team?.logos?.[0]?.href || x.team?.logo), color: hex(x.team?.color), alt: hex(x.team?.alternateColor),
    home: x.homeAway === "home", score: scoreOf(x.score), shootout: num(x.shootoutScore), winner: x.winner === true }));
  if (teams.length !== 2 || teams.some(t => !t.name)) throw new Error("two named sides needed");
  const pre = st.state === "pre";
  const goals = pre ? [] : goalsOf(j.keyEvents, teams);
  teams.forEach((t, i) => { t.scorers = goals.filter(g => g.side === i).map(({ who, minute, pen, og }) => ({ who, minute, pen, og })); });
  // the stat boxes, each only when both sides have the figure (possession only when it adds up to about 100)
  const box = j.boxscore?.teams || [];
  const statOf = (i, k) => num(box.find(b => String(b.team?.id) === teams[i].id)?.statistics?.find(s => s.name === k)?.displayValue);
  const stats = pre ? [] : STAT_SET.map(([k, label]) => ({ key: k, label, home: statOf(0, k), away: statOf(1, k) }))
    .filter(s => s.home != null && s.away != null && (s.key !== "possessionPct" || Math.abs(s.home + s.away - 100) < 1.5) && (s.key === "possessionPct" || s.home + s.away > 0));
  // momentum: shots and corners by five minutes, from ESPN's commentary; only with enough of them to mean something
  const plays = (j.commentary || []).map(x => x.play).filter(Boolean);
  const nameIdx = n => teams.findIndex(t => t.name === n || t.short === n);
  const acts = plays.map(p => ({ t: String(p.type?.type || ""), side: nameIdx(p.team?.displayName), m: minuteOf(p.clock?.displayValue) }))
    .filter(a => a.side >= 0 && a.m != null && (SHOTS.test(a.t) || a.t === "corner-awarded"));
  let momentum = null;
  if (acts.length >= 8) {
    const last = Math.max(90, ...acts.map(a => a.m)), n = Math.ceil((last + 1) / 5);
    const buckets = Array.from({ length: n }, (_, i) => ({ from: i * 5, home: 0, away: 0 }));
    for (const a of acts) { const b = buckets[Math.min(n - 1, Math.floor(Math.min(a.m, last) / 5))]; b[a.side ? "away" : "home"]++; }
    momentum = { step: 5, end: n * 5, buckets, goals: goals.filter(g => g.m != null).map(g => ({ side: g.side, m: g.m, who: g.who })) };
  }
  // goals and cards, in order
  const events = pre ? [] : (j.keyEvents || []).map(k => {
    const t = String(k.type?.type || ""), side = teams.findIndex(x => x.id === String(k.team?.id ?? ""));
    const kind = k.scoringPlay && !k.shootout ? "goal" : /red-card/.test(t) ? "red" : /yellow-card/.test(t) ? "yellow" : null;
    if (!kind) return null;
    if (kind === "goal") { const g = goals.find(x => x.minute === (k.clock?.displayValue || null) && x.who === (k.participants?.[0]?.athlete?.displayName || null)); return g ? { kind, side: g.side, minute: g.minute, who: g.who, assist: g.assist, pen: g.pen, og: g.og } : null; }
    return side >= 0 ? { kind, side, minute: k.clock?.displayValue || null, who: k.participants?.[0]?.athlete?.displayName || null } : null;
  }).filter(Boolean);
  const statsAll = pre ? [] : STAT_ALL.map(([k, label]) => ({ key: k, label, home: statOf(0, k), away: statOf(1, k) }))
    .filter(s => s.home != null && s.away != null && (s.key !== "possessionPct" || Math.abs(s.home + s.away - 100) < 1.5) && (s.key === "possessionPct" || s.home + s.away > 0));
  const rost = id => (j.rosters || []).find(r => String(r.team?.id) === id);
  const lineups = teams.map(t => lineupOf(rost(t.id)));
  const shots = pre ? [] : shotsOf(j.commentary, teams);
  const form = formOf(j.lastFiveGames, teams);
  // commentary, latest first
  const KIND = t => (/goal|penalty---scored/.test(t) ? "goal" : /red-card/.test(t) ? "red" : /yellow-card/.test(t) ? "yellow" : /substitution/.test(t) ? "sub" : /^shot-|penalty/.test(t) ? "shot" : /corner/.test(t) ? "corner" : /foul|handball/.test(t) ? "foul" : /offside/.test(t) ? "offside" : /var/.test(t) ? "var" : /kickoff|half|end-regular|start-2nd|full-time|end/.test(t) ? "whistle" : "note");
  const commentary = (j.commentary || []).filter(x => x?.text).sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)).slice(0, commentaryMax)
    .map(x => ({ minute: x.time?.displayValue || null, text: String(x.text).trim(), kind: KIND(String(x.play?.type?.type || "")) }));
  const v = j.gameInfo?.venue;
  return {
    id: String(h.id || ""), league: { name: tidyComp(h.league?.name) || null, slug: h.league?.slug || null },
    date: c.date || null, venue: v?.fullName || null, city: v?.address?.city || null,
    status: { state: st.state || null, completed: !!st.completed, detail: st.shortDetail || st.detail || null, clock: c.status?.displayClock || null, description: st.description || null },
    teams, stats, statsAll, momentum, events, commentary, lineups: lineups.some(Boolean) ? lineups : null, shots: shots.length >= 5 ? shots : [], form: form.some(Boolean) ? form : null,
  };
}
const EVENT_ID = /^\d{5,12}$/, SLUG = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;
export async function look_match(params = new URLSearchParams()) {
  return guard(async () => {
    const e = String(params.get?.("e") || ""), l = String(params.get?.("l") || "all").toLowerCase();
    if (!EVENT_ID.test(e)) throw new Error("bad event id");
    const league = SLUG.test(l) && l.length <= 40 ? l : "all";
    let j = await getJSON(`${ESPN}/${league}/summary?event=${e}`, { timeout: 8000 }).catch(err => (league === "all" ? Promise.reject(err) : null));
    if (!j?.header && league !== "all") j = await getJSON(`${ESPN}/all/summary?event=${e}`, { timeout: 8000 });
    return ok(parseMatch(j), "ESPN");
  });
}

// Madrid's last result in any competition, for the Last Result card.
export function lastFrom(sched, now = Date.now()) {
  const done = (sched?.events || []).filter(e => { const st = e.competitions?.[0]?.status?.type || {}; return st.completed && st.state === "post" && Date.parse(e.date) <= now; })
    .sort((a, b) => b.date.localeCompare(a.date));
  return done[0] || null;
}
export async function look_last_match() {
  return guard(async () => {
    const club = config().follows.football_club;
    const ev = lastFrom(await getJSON(`${ESPN}/all/teams/${club.espn_id}/schedule`, { timeout: 8000 }));
    if (!ev) throw new Error("no completed match");
    const slug = ev.league?.slug && SLUG.test(ev.league.slug) ? ev.league.slug : "all";
    const m = parseMatch(await getJSON(`${ESPN}/${slug}/summary?event=${ev.id}`, { timeout: 8000 }), { commentaryMax: 0 });
    if (!m.status.completed) throw new Error("not finished");
    if (!m.teams.some(t => t.id === String(club.espn_id))) throw new Error("club not in the match");
    const { momentum, commentary, events, statsAll, lineups, shots, form, ...card } = m;
    return ok({ ...card, league: { name: m.league.name || tidyComp(ev.league?.name), slug: m.league.slug || slug }, club_id: String(club.espn_id) }, "ESPN");
  });
}

export const LOOK_SPORT = { look_f1_chatter, look_f1_weekend, look_title_race, look_last_match, look_match };
// [s-maxage, stale-while-revalidate] in seconds
export const LOOK_SPORT_CACHE = { look_f1_chatter: [1800, 3600], look_f1_weekend: [300, 1800], look_title_race: [1800, 7200], look_last_match: [900, 3600], look_match: [120, 3600] };
