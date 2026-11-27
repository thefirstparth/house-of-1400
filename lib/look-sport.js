// The trial's sport feeds (/?trial, 27 Nov 2026; v2/trial.js item 6 and 7), behind /api/live/look_*. Every key returns
// {ok, value, source, as_of, stale}. Nothing here is estimated: a feed that cannot read its source, or whose figures do
// not add up, returns ok:false and the page hides its card.
//   look_f1_chatter  r/formula1's top posts of the day (Reddit's own JSON, then its RSS). Reddit often refuses cloud
//                    servers (403/429): then ok:false, never invented posts. X has no free API, so it is not read.
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

// ---------------------------------------------------------------- (6) Paddock Chatter: r/formula1, top of the day
// One identity, said plainly; no browser disguise and no retries under other names.
const REDDIT_UA = "house-of-1400/1.0 (a private one-reader newspaper; reads r/formula1 top posts once every 30 minutes)";
const CHATTER_MAX = 5;
// Reddit's listing JSON: data.children[].data. Stickied and NSFW posts are left out; the best-scored first.
export function parseRedditJSON(j) {
  const posts = (j?.data?.children || []).map(c => c?.data).filter(d => d && d.title && d.permalink && !d.stickied && !d.over_18)
    .map(d => ({ title: decodeEntities(d.title), url: `https://www.reddit.com${d.permalink}`, author: d.author ? `u/${d.author}` : null,
      score: Number.isFinite(d.score) ? d.score : null, comments: Number.isFinite(d.num_comments) ? d.num_comments : null,
      flair: d.link_flair_text ? decodeEntities(d.link_flair_text) : null, at: Number.isFinite(d.created_utc) ? new Date(d.created_utc * 1000).toISOString() : null }));
  return posts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, CHATTER_MAX);
}
// Reddit's Atom feed (no scores; Reddit's own order, which for /top is by score). Its first entries can be the
// subreddit's pinned posts, which carry no marker in the feed: they are kept only if they also fall within the day.
export function parseRedditRSS(xml, now = Date.now()) {
  const entries = [...String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
  return entries.map(e => {
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const url = decodeEntities((e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "");
    const author = decodeEntities((e.match(/<author>\s*<name>([\s\S]*?)<\/name>/) || [])[1] || "").replace(/^\/?u\//, "u/") || null;
    const at = Date.parse((e.match(/<published>([\s\S]*?)<\/published>/) || e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || "");
    return { title, url, author, score: null, comments: null, flair: null, at: Number.isFinite(at) ? new Date(at).toISOString() : null };
  }).filter(p => p.title && /^https:\/\/(www\.|old\.)?reddit\.com\/r\/formula1\//i.test(p.url) && (!p.at || now - Date.parse(p.at) < 36 * 36e5)).slice(0, CHATTER_MAX);
}
async function redditText(url, accept) {
  const r = await fetch(url, { headers: { "user-agent": REDDIT_UA, accept }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
export async function look_f1_chatter() {
  const errors = [];
  try {
    const posts = parseRedditJSON(JSON.parse(await redditText("https://www.reddit.com/r/formula1/top.json?t=day&limit=15&raw_json=1", "application/json")));
    if (posts.length >= 3) return ok({ sub: "r/formula1", posts }, "Reddit");
    errors.push("json: too few posts");
  } catch (e) { errors.push(String(e?.message || e)); }
  try {
    const posts = parseRedditRSS(await redditText("https://www.reddit.com/r/formula1/top/.rss?t=day", "application/atom+xml"));
    if (posts.length >= 3) return ok({ sub: "r/formula1", posts }, "Reddit");
    errors.push("rss: too few posts");
  } catch (e) { errors.push(String(e?.message || e)); }
  return fail(errors.join(" | "));
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
  // commentary, latest first
  const KIND = t => (/goal|penalty---scored/.test(t) ? "goal" : /red-card/.test(t) ? "red" : /yellow-card/.test(t) ? "yellow" : /substitution/.test(t) ? "sub" : /^shot-|penalty/.test(t) ? "shot" : /corner/.test(t) ? "corner" : /foul|handball/.test(t) ? "foul" : /offside/.test(t) ? "offside" : /var/.test(t) ? "var" : /kickoff|half|end-regular|start-2nd|full-time|end/.test(t) ? "whistle" : "note");
  const commentary = (j.commentary || []).filter(x => x?.text).sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)).slice(0, commentaryMax)
    .map(x => ({ minute: x.time?.displayValue || null, text: String(x.text).trim(), kind: KIND(String(x.play?.type?.type || "")) }));
  const v = j.gameInfo?.venue;
  return {
    id: String(h.id || ""), league: { name: tidyComp(h.league?.name) || null, slug: h.league?.slug || null },
    date: c.date || null, venue: v?.fullName || null, city: v?.address?.city || null,
    status: { state: st.state || null, completed: !!st.completed, detail: st.shortDetail || st.detail || null, clock: c.status?.displayClock || null, description: st.description || null },
    teams, stats, momentum, events, commentary,
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
    const { momentum, commentary, events, ...card } = m;
    return ok({ ...card, league: { name: m.league.name || tidyComp(ev.league?.name), slug: m.league.slug || slug }, club_id: String(club.espn_id) }, "ESPN");
  });
}

export const LOOK_SPORT = { look_f1_chatter, look_title_race, look_last_match, look_match };
// [s-maxage, stale-while-revalidate] in seconds
export const LOOK_SPORT_CACHE = { look_f1_chatter: [1800, 3600], look_title_race: [1800, 7200], look_last_match: [900, 3600], look_match: [120, 3600] };
