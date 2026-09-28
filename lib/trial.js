// Trial sources (Parth, 28 Sep 2026; docs/SOURCES-AUDIT.md). Run-only live keys: the page never requests them,
// the edition snapshot never stores them and `npm test` skips them. scripts/trial.mjs calls them after the day's
// edition is live and scores what they found against what the paper printed. Nothing here reaches the paper.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config, getJSON, getText, parseNifty500 } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });
const guard = async (fn) => { try { return await fn(); } catch (e) { return fail(e); } };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const H = 36e5;

// ---------------------------------------------------------------- RSS
export const decode = s => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
const strip = s => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? m[1] : null; };
const attrOf = (x, t, a) => { const m = x.match(new RegExp(`<${t}\\b[^>]*\\b${a}="([^"]*)"`, "i")); return m ? decode(m[1]) : null; };
export const hostOf = u => { try { return new URL(u).hostname.replace(/^(www|m|amp|feeds|rss)\./, ""); } catch { return null; } };

// Most feeds use RFC 822 or ISO dates; SEBI writes "24 Sep, 2026 +0530" (no time).
export const parseDate = s => { const d = Date.parse(s); return !isNaN(d) ? d : Date.parse(s.replace(/,/g, "").replace(/(\d{4})\s+([+-]\d{4})$/, "$1 00:00:00 GMT$2")); };

// Google News item: "Headline - Publisher"; the real outlet in <source url>; the description lists up to five
// outlets that ran the same story (title and publisher). That list groups the day's stories without guessing.
export function parseFeed(xml, feed) {
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  return blocks.map((b, position) => {
    const google = feed.kind === "signal" || feed.kind === "search";
    let title = strip(tagOf(b, "title"));
    const link = decode(tagOf(b, "link") || "") || attrOf(b, "link", "href") || "";
    const date = parseDate(decode(tagOf(b, "pubDate") || tagOf(b, "published") || tagOf(b, "updated") || tagOf(b, "dc:date") || ""));
    let outlet = feed.name, related = [];
    if (google) {
      outlet = strip(tagOf(b, "source")) || title.split(" - ").pop();
      const d = decode(tagOf(b, "description") || "");
      related = [...d.matchAll(/<a [^>]*>([\s\S]*?)<\/a>(?:\s|&nbsp;| )*<font[^>]*>([\s\S]*?)<\/font>/g)].map(m => ({ title: strip(m[1]), outlet: strip(m[2]) }));
      if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    }
    const snippet = google ? "" : strip(tagOf(b, "description") || tagOf(b, "summary") || "").slice(0, 280);
    return { title, url: link, outlet, feed: feed.id, section: feed.section, kind: feed.kind, date: isNaN(date) ? null : new Date(date).toISOString(), position, ...(related.length ? { related } : {}), ...(snippet ? { snippet } : {}) };
  }).filter(i => i.title);
}

const STOP = new Set("a an the of in on at to for and or but with from by as is are was were be after before over under into than this that his her their its it he she they we you i will has have had not no new says said amid vs v".split(" "));
export const tokens = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const normTitle = s => tokens(s).join(" ");
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

// Group the day: each Google signal item is a story with its outlets; an outlet's own item joins the story whose
// related list carries the same headline, or (rarely) a near-identical headline. Headline overlap alone is not
// used to group two outlets (kylo-news measured it: it either misses or wrongly merges).
export function cluster(items) {
  const stories = [], byTitle = new Map();
  for (const it of items.filter(i => i.kind === "signal")) {
    const outlets = [...new Set([it.outlet, ...(it.related || []).map(r => r.outlet)].filter(Boolean))];
    const s = { title: it.title, outlets, signals: [`${it.feed}#${it.position + 1}`], date: it.date, members: [] };
    const keys = [it.title, ...(it.related || []).map(r => r.title)].map(normTitle);
    const hit = keys.map(k => byTitle.get(k)).find(Boolean);
    if (hit) { hit.outlets = [...new Set([...hit.outlets, ...outlets])]; hit.signals.push(...s.signals); keys.forEach(k => byTitle.set(k, hit)); continue; }
    stories.push(s); keys.forEach(k => byTitle.set(k, s));
  }
  for (const it of items.filter(i => i.kind !== "signal")) {
    const k = normTitle(it.title), t = tokens(it.title);
    let s = byTitle.get(k);
    if (!s && t.length >= 5) s = stories.find(x => jac(tokens(x.title), t) >= 0.7);
    if (s) { s.members.push({ title: it.title, outlet: it.outlet, url: it.url }); if (!s.outlets.includes(it.outlet)) s.outlets.push(it.outlet); }
  }
  return stories.map(s => ({ ...s, n: s.outlets.length })).sort((a, b) => b.n - a.n || a.signals.length - b.signals.length);
}

// Some hosts refuse one identity and accept another (LiveFromALounge: 403 to "Mozilla/5.0", 200 to a named bot).
async function feedText(url) {
  let last;
  for (const ua of [/google\.com/.test(url) ? UA : "Mozilla/5.0", "house-of-1400/1.0 (+private newspaper)", UA]) {
    try { return await getText(url, { timeout: 9000, headers: { "user-agent": ua, accept: "application/rss+xml, application/xml, text/xml, */*" } }); }
    catch (e) { last = e; if (!/^(403|429) /.test(e.message)) break; }
  }
  throw last;
}

// GET /api/live/wire?from=ISO&to=ISO (defaults: the last 24 hours). Every feed in config.sources.feeds, read at
// once; items inside the window; failures listed per feed so a feed that goes quiet shows up.
export async function wire(qs = new URLSearchParams()) {
  return guard(async () => {
    const S = config().sources;
    const to = Date.parse(qs.get("to") || "") || Date.now(), from = Date.parse(qs.get("from") || "") || to - 24 * H;
    const only = qs.get("sections") ? new Set(qs.get("sections").split(",")) : null;
    const feeds = S.feeds.filter(f => !only || only.has(f.section));
    const results = await Promise.all(feeds.map(async f => {
      const t0 = Date.now();
      try {
        const xml = await feedText(f.url);
        const all = parseFeed(xml, f);
        const lo = f.max_age_h ? Math.min(from, to - f.max_age_h * H) : from;
        const kept = all.filter(i => i.date ? Date.parse(i.date) >= lo && Date.parse(i.date) <= to + 15 * 60e3 : f.undated).slice(0, f.max || 50);
        return { f, items: kept, stat: { id: f.id, section: f.section, ok: true, read: all.length, kept: kept.length, undated: all.filter(i => !i.date).length, ms: Date.now() - t0 } };
      } catch (e) {
        return { f, items: [], stat: { id: f.id, section: f.section, ok: false, error: String(e.message || e).slice(0, 120), ms: Date.now() - t0 } };
      }
    }));
    const items = results.flatMap(r => r.items);
    const failed = results.filter(r => !r.stat.ok).length;
    if (failed > feeds.length / 2) throw new Error(`wire: ${failed} of ${feeds.length} feeds failed`);
    return ok({ window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() }, feeds: results.map(r => r.stat), items, stories: cluster(items) }, "Wire");
  });
}

// ---------------------------------------------------------------- tennis: each followed player's next and last match
export function tennisPlayers(scoreboard, names) {
  const matches = (scoreboard.events || []).flatMap(e => (e.groupings || []).flatMap(g => (g.competitions || []).map(c => ({
    event: e.name, draw: g.grouping?.displayName || null, date: c.date || c.startDate, state: c.status?.type?.state, detail: c.status?.type?.detail || null,
    round: c.round?.displayName || null, court: c.venue?.court || null, note: c.notes?.[0]?.text || null,
    players: (c.competitors || []).map(x => ({ name: x.athlete?.displayName, winner: !!x.winner })),
  }))));
  return names.map(name => {
    const mine = matches.filter(m => m.players.some(p => p.name === name) && /singles/i.test(m.draw || "singles"));
    const opp = m => m.players.find(p => p.name !== name)?.name || null;
    const next = mine.filter(m => m.state === "pre" || m.state === "in").sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
    const last = mine.filter(m => m.state === "post").sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    return {
      name,
      next: next ? { event: next.event, round: next.round, when_utc: next.date, opponent: opp(next), live: next.state === "in", court: next.court } : null,
      last: last ? { event: last.event, round: last.round, when_utc: last.date, opponent: opp(last), won: !!last.players.find(p => p.name === name)?.winner, note: last.note } : null,
    };
  });
}

export async function tennis_players() {
  return guard(async () => {
    const names = config().follows.tennis_players;
    const j = await getJSON("https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", { timeout: 10000 });
    return ok({ players: tennisPlayers(j, names) }, "ESPN");
  });
}

// ---------------------------------------------------------------- Screen & Stage: OMDb, TMDB, JustWatch, Sacnilk
// Keyed calls never put the URL (and so the key) into an error message.
async function keyed(url, label) {
  let r;
  try { r = await fetch(url, { headers: { accept: "application/json", "user-agent": "house-of-1400/1.0" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new Error(`${label}: network error`); }
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status}`);
  return r.json();
}

async function omdb(title, year) {
  const key = process.env.OMDB_KEY;
  if (!key) return { error: "OMDB_KEY not set" };
  const j = await keyed(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}`, "OMDb");
  if (j.Response === "False") return { error: `OMDb: ${j.Error || "not found"}` };
  const rating = src => j.Ratings?.find(r => r.Source === src)?.Value || null;
  return { title: j.Title, year: j.Year, type: j.Type, imdb: j.imdbRating !== "N/A" ? j.imdbRating : null, imdb_votes: j.imdbVotes !== "N/A" ? j.imdbVotes : null,
    rotten_tomatoes: rating("Rotten Tomatoes"), metacritic: rating("Metacritic"), language: j.Language, released: j.Released !== "N/A" ? j.Released : null, imdb_id: j.imdbID };
}

async function tmdb(title) {
  const key = process.env.TMDB_KEY;
  if (!key) return { error: "TMDB_KEY not set" };
  const s = await keyed(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(title)}&region=IN`, "TMDB");
  const hit = (s.results || []).find(r => r.media_type === "movie" || r.media_type === "tv");
  if (!hit) return { error: "TMDB: not found" };
  const p = await keyed(`https://api.themoviedb.org/3/${hit.media_type}/${hit.id}/watch/providers?api_key=${encodeURIComponent(key)}`, "TMDB");
  const IN = p.results?.IN || {};
  return { id: hit.id, type: hit.media_type, title: hit.title || hit.name, date: hit.release_date || hit.first_air_date || null,
    in_stream: (IN.flatrate || []).map(x => x.provider_name), in_rent: (IN.rent || []).map(x => x.provider_name), in_link: IN.link || null };
}

const JW_QUERY = `query StreamingCharts($country: Country!, $filter: StreamingChartsFilter, $first: Int!, $after: String) {
  streamingCharts(country: $country, filter: $filter, first: $first, after: $after) {
    edges { streamingChartInfo { rank } node { objectType content(country: $country, language: "en") { title originalReleaseYear } } } } }`;
async function justwatch(objectType) {
  const r = await fetch("https://apis.justwatch.com/graphql", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ query: JW_QUERY, variables: { country: "IN", first: 10, after: "", filter: { category: "WEEKLY_POPULARITY_SAME_CONTENT_TYPE", objectType, startDate: null } } }) });
  if (!r.ok) throw new Error(`JustWatch ${r.status}`);
  const j = await r.json();
  if (j.errors?.length) throw new Error(`JustWatch: ${j.errors[0].message}`);
  return (j.data?.streamingCharts?.edges || []).map(e => ({ rank: e.streamingChartInfo.rank, title: e.node.content.title, year: e.node.content.originalReleaseYear }));
}

export const sacnilkTitles = html => [...new Set([...html.matchAll(/sacnilk\.com\/news\/([A-Za-z0-9_]+?)_(\d{4})_Box_Office_Collection_Day_Wise/g)].map(m => `${m[1].replace(/_/g, " ")} (${m[2]})`))];

// GET /api/live/screen?titles=A|B|C  (titles: the edition's Screen & Stage list; at most 12)
export async function screen(qs = new URLSearchParams()) {
  return guard(async () => {
    const titles = (qs.get("titles") || "").split("|").map(s => s.trim()).filter(Boolean).slice(0, 12);
    const settle = p => p.then(v => v, e => ({ error: String(e.message || e) }));
    const [lookups, movies, shows, sac] = await Promise.all([
      Promise.all(titles.map(async t => ({ title: t, omdb: await settle(omdb(t)), tmdb: await settle(tmdb(t)) }))),
      settle(justwatch("MOVIE")), settle(justwatch("SHOW")),
      settle(getText("https://www.sacnilk.com/entertainmenttopbar/Box_Office", { timeout: 8000 }).then(sacnilkTitles)),
    ]);
    return ok({ titles: lookups, chart: { movies, shows }, box_office: sac, keys: { omdb: !!process.env.OMDB_KEY, tmdb: !!process.env.TMDB_KEY } }, "OMDb, TMDB, JustWatch, Sacnilk");
  });
}

// ---------------------------------------------------------------- NSE's official MCP server (bhavcopy)
async function nseSession(url) {
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "house-of-1400/1.0" };
  const r = await fetch(url, { method: "POST", headers: h, signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "house-of-1400", version: "1.0" } } }) });
  const sid = r.headers.get("mcp-session-id"); await r.text();
  if (!r.ok || !sid) throw new Error(`NSE MCP initialize ${r.status}`);
  await (await fetch(url, { method: "POST", headers: { ...h, "mcp-session-id": sid }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) })).text();
  let id = 1;
  return async (name, args) => {
    const x = await fetch(url, { method: "POST", headers: { ...h, "mcp-session-id": sid }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }) });
    const b = await x.text(), m = b.match(/^data:(.*)$/m), j = JSON.parse(m ? m[1] : b);
    if (j.error) throw new Error(`NSE MCP ${name}: ${j.error.message}`);
    const t = j.result?.content?.[0]?.text;
    if (j.result?.isError) throw new Error(`NSE MCP ${name}: ${String(t).slice(0, 120)}`);
    try { return JSON.parse(t); } catch { return t; }
  };
}

let N500SET;
const nifty500 = () => N500SET ||= new Set(parseNifty500(readFileSync(join(process.cwd(), "config", "nifty500.csv"), "utf8")).map(x => x.symbol));

// GET /api/live/nse?date=YYYY-MM-DD&symbols=A,B (symbols: the day's flagged movers, for corporate actions; at most 8)
export async function nse(qs = new URLSearchParams()) {
  return guard(async () => {
    const date = qs.get("date") || new Date(Date.now() + 5.5 * H).toISOString().slice(0, 10);
    const symbols = (qs.get("symbols") || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
    const call = await nseSession("https://mcp.nseindia.in/bhavcopy/cm/mcp");
    const [breadth, gain, loss] = await Promise.all([call("get_market_breadth", { date }), call("get_top_movers", { date, n: 50, direction: "gain" }), call("get_top_movers", { date, n: 50, direction: "loss" })]);
    const n5 = nifty500();
    const pick = r => (r.stocks || []).filter(s => n5.has(s.symbol)).map(s => ({ symbol: s.symbol, pct: s.pct_change, close: s.close }));
    const from = new Date(Date.parse(date) - 30 * 864e5).toISOString().slice(0, 10);
    const actions = {};
    await Promise.all(symbols.map(async s => { try { actions[s] = (await call("get_corporate_actions", { symbol: s, fromDate: from, toDate: date })).actions || []; } catch (e) { actions[s] = { error: String(e.message).slice(0, 100) }; } }));
    return ok({ requested: date, data_date: breadth.date || gain.date || null, breadth, gainers: pick(gain), losers: pick(loss), actions }, "NSE MCP (bhavcopy)");
  });
}

// ---------------------------------------------------------------- Sachet: NDMA and IMD alerts near the paper's cities
const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon); return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2)); };
export function nearAlerts(rows, cities, places, radius) {
  return cities.flatMap(c => rows.filter(a => {
    const names = places[c.name] || [c.name];
    if (names.some(n => new RegExp(`\\b${n}\\b`, "i").test(a.area_description || ""))) return true;
    const [lon, lat] = String(a.centroid || "").split(",").map(Number);
    return Number.isFinite(lat) && km(c, { lat, lon }) <= radius;
  }).map(a => ({ city: c.name, severity: a.severity, colour: a.severity_color || null, type: a.disaster_type, area: a.area_description, from: a.effective_start_time, until: a.effective_end_time, source: a.alert_source, message: a.actual_lang === "en" ? String(a.warning_message || "").slice(0, 300) : null, language: a.actual_lang })));
}

export async function alerts() {
  return guard(async () => {
    const C = config(), T = C.trial;
    const rows = await getJSON("https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails", { timeout: 12000 });
    if (!Array.isArray(rows)) throw new Error("sachet shape");
    return ok({ total: rows.length, near: nearAlerts(rows, [...C.weather.always, ...C.weather.family], T.alert_places, T.alert_radius_km) }, "Sachet (NDMA, IMD)");
  });
}

// ---------------------------------------------------------------- WhereIsCricket: India's matches and where to watch
export function parseWhereIsCricket(html) {
  return html.split('<article class="match-row"').slice(1).map(a => {
    const text = sel => { const m = a.match(new RegExp(`class="${sel}"[^>]*>([\\s\\S]*?)</(?:span|div|strong)>`)); return m ? strip(m[1]) : ""; };
    const fmt = text("fmt[^\"]*");
    const teams = strip((a.match(/class="match-teams">([\s\S]*?)<\/div>/) || [])[1] || "").replace(fmt, "").replace(/\s*LIVE\s*$/, "").trim();
    const where = tag => { const m = a.match(new RegExp(`where-tag ${tag}"[\\s\\S]*?<span class="where-val([^"]*)">([\\s\\S]*?)</span></span>`)); return !m ? null : /is-none/.test(m[1]) ? "not in India" : strip(m[2]).split(/[(.]/)[0].trim() || null; };
    return { date: text("match-date"), time: text("time-wide"), teams, format: fmt, sub: strip((a.match(/class="match-sub">([\s\S]*?)<\/div>/) || [])[1] || ""), tv: where("is-tv"), ott: where("is-ott") };
  });
}

export async function cricket_where() {
  return guard(async () => {
    const rows = parseWhereIsCricket(await getText("https://www.whereiscricket.com/", { timeout: 10000 }));
    if (!rows.length) throw new Error("whereiscricket: no rows");
    const india = rows.filter(r => /(^|\s)India(\s|$)/.test(r.teams) && !/India (A|Women|U19|Under|Legends|Masters)/i.test(r.teams));
    return ok({ india, total: rows.length }, "WhereIsCricket");
  });
}

// ---------------------------------------------------------------- ESPN: national-team football for the next week
export async function intl_football() {
  return guard(async () => {
    const leagues = config().trial.intl_football;
    const days = [...Array(8)].map((_, i) => new Date(Date.now() + (i - 1) * 864e5).toISOString().slice(0, 10).replace(/-/g, ""));
    const lists = await Promise.all(leagues.flatMap(l => days.map(d => getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/scoreboard?dates=${d}`, { timeout: 8000 }).then(j => (j.events || []).map(e => ({ league: l, e }))).catch(() => []))));
    const seen = new Set(), matches = [];
    for (const { league, e } of lists.flat()) {
      if (seen.has(e.id)) continue; seen.add(e.id);
      const c = e.competitions?.[0] || {};
      const side = h => c.competitors?.find(x => x.homeAway === h);
      matches.push({ league, when_utc: e.date, home: side("home")?.team?.displayName, away: side("away")?.team?.displayName, state: c.status?.type?.state,
        score: c.status?.type?.completed ? `${side("home")?.score}-${side("away")?.score}` : null });
    }
    return ok({ matches: matches.sort((a, b) => Date.parse(a.when_utc) - Date.parse(b.when_utc)) }, "ESPN");
  });
}

// ---------------------------------------------------------------- Calendars for the Week Ahead
export function parseFomc(html, year) {
  const i = html.indexOf(`${year} FOMC Meetings`); if (i < 0) return [];
  const block = html.slice(i, html.indexOf("FOMC Meetings", i + 20) > 0 ? html.indexOf("FOMC Meetings", i + 20) : i + 60000);
  return [...block.matchAll(/fomc-meeting__month[^>]*><strong>([A-Za-z/]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)].map(m => {
    const month = m[1].split("/").pop(), days = m[2].replace(/\*/g, "").trim(), last = days.split("-").pop().trim();
    const d = new Date(`${month} ${parseInt(last)}, ${year} 12:00 UTC`);
    return { what: "US Federal Reserve (FOMC) decision", date: isNaN(d) ? null : d.toISOString().slice(0, 10), days: `${m[1]} ${days}` };
  }).filter(x => x.date);
}
export function parseIcs(ics) {
  return ics.split("BEGIN:VEVENT").slice(1).map(v => ({ date: (v.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1], what: (v.match(/SUMMARY:(.*)/) || [])[1]?.trim() }))
    .filter(x => x.date && x.what).map(x => ({ what: x.what, date: `${x.date.slice(0, 4)}-${x.date.slice(4, 6)}-${x.date.slice(6)}` }));
}

export async function calendar() {
  return guard(async () => {
    const now = Date.now(), until = now + 30 * 864e5, inside = x => Date.parse(x.date) >= now - 864e5 && Date.parse(x.date) <= until;
    const y = new Date().getUTCFullYear();
    const [fomc, hol] = await Promise.all([
      getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", { timeout: 10000 }).then(h => [...parseFomc(h, y), ...parseFomc(h, y + 1)]).catch(e => ({ error: e.message })),
      getText("https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics", { timeout: 10000 }).then(parseIcs).catch(e => ({ error: e.message })),
    ]);
    return ok({ fomc: Array.isArray(fomc) ? fomc.filter(inside) : fomc, india_holidays: Array.isArray(hol) ? hol.filter(inside).sort((a, b) => a.date.localeCompare(b.date)) : hol }, "Federal Reserve, Google Calendar");
  });
}

export const TRIAL = { wire, tennis_players, screen, nse, alerts, cricket_where, intl_football, calendar };
export const TRIAL_CACHE = { wire: [600, 1800], tennis_players: [1800, 7200], screen: [21600, 43200], nse: [1800, 7200], alerts: [900, 3600], cricket_where: [3600, 21600], intl_football: [3600, 21600], calendar: [21600, 86400] };
