// Off Duty (Parth, 3-4 Oct 2026: "AI is not able to do a very good job in terms of both finding the popular movies and
// ranking the popular movies"; "go ahead with the Off Duty redesign"). The code finds and ranks; the daily run only
// reads the reviews and writes each film's verdict and one line (EDITORIAL.md, Off Duty). Four live functions:
// - cinema: Hindi and English films in Indian cinemas from the last few weeks, ranked by how many people look them up
//   (Wikipedia page views, from the film's Wikidata link), with Rotten Tomatoes, IMDb, Sacnilk's India box office, the
//   Reddit review thread and the review headlines the run reads (independent critics and trade sites kept apart).
// - streaming: this week's top ten on Netflix (Netflix's own India Top 10 with JustWatch's chart), Prime Video,
//   JioHotstar and Apple TV (JustWatch India), English and Hindi only, stand-up specials marked.
// - upcoming: films and series due in India in the next weeks (JustWatch's India release calendar for the services,
//   TMDB for Indian cinema dates and Hindi series), the shows Parth is watching flagged.
// - stage: Bengaluru stand-up and Sufi evenings from allevents.in and District, with when each was listed, so a show
//   that has just opened (even one months away) is flagged. "First seen" is carried forward through each edition's own
//   snapshot (content/latest.json), so nothing extra is stored and the daily run is unchanged.
// Every part fails on its own: what cannot be had is left out, and the page hides what is missing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./live.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
// Wikimedia asks for an identifying user agent with a way to reach the operator; the site's address, never a person's email
const WIKI_UA = "House1400/1.0 (https://house14.vercel.app; private newspaper)";
const ok = (value, source) => ({ ok: true, value, source, as_of: new Date().toISOString(), stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });
const C = () => config().offduty || {};
const istDay = (ms = Date.now()) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

async function text(url, { timeout = 12000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${new URL(url).hostname}`);
  return r.text();
}
async function json(url, opts = {}) { return JSON.parse(await text(url, { ...opts, headers: { accept: "application/json", ...(opts.headers || {}) } })); }
// at most n at a time; a failure is null
export async function pool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; try { out[k] = await fn(list[k], k); } catch { out[k] = null; } } }));
  return out;
}
const decodeHtml = s => String(s ?? "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
export const words = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w && !["the", "a", "an", "and", "of"].includes(w));
// the same title: one's words all inside the other's (Drishyam: The Conclusion and Drishyam 3: The Conclusion)
export function sameTitle(a, b) {
  const x = words(a), y = words(b); if (!x.length || !y.length) return false;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.every(w => l.includes(w)) && s.length >= Math.min(2, l.length);
}
export const looseTitle = (a, b) => { const q = t => words(t).map(w => w.replace(/(.)\1+/g, "$1")).join(" "); return sameTitle(q(a), q(b)); };
const ldBlocks = html => [...String(html).matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : [j]; } catch { return []; } });

// ================================================================ language: English and Hindi only
const EN = new Set(["US", "GB", "CA", "AU", "IE", "NZ"]);
const REGIONAL = /\b(tamil|telugu|malayalam|kannada|bengali|bangla|marathi|punjabi|gujarati|odia|assamese|bhojpuri)\b/i;
const scriptOf = s => (/[ऀ-ॿ]/.test(s) ? "deva" : /^[\u0000-ɏ -⁯₹\s]*$/.test(s) ? "latin" : "other");
// JustWatch content: {title, originalTitle, productionCountries, shortDescription}
// "Hindi?" is an Indian title in Latin letters whose description names no language: checked against TMDB (checkLangs).
export function languageOf(c = {}) {
  if (c._lang !== undefined) return c._lang;
  const t = c.originalTitle || c.title || "", sc = scriptOf(t), pc = c.productionCountries || [], d = c.shortDescription || "";
  if (sc === "deva") return "Hindi";
  if (sc !== "latin") return null;
  if (pc.includes("IN")) return /\bhindi\b/i.test(d) ? "Hindi" : REGIONAL.test(d) ? null : /\benglish[- ]language\b/i.test(d) ? "English" : "Hindi?";
  if (pc.length && pc.every(x => EN.has(x))) return "English";
  return null;
}
// A stand-up special: the words say so, or it is a comedy named after a comedian Parth follows or the config lists
// ("Papa Yaar by Zakir Khan"); a comedy talk or talent show is not one.
export const isStandup = (c = {}, comedians = []) => /\bstand[- ]?up\b|\bcomedy special\b/i.test(`${c.shortDescription || ""} ${c.title || ""}`) ||
  ((c.genres || []).some(g => g.shortName === "cmy") && !/\b(talk|talent|reality|variety|sitcom)\b/i.test(c.shortDescription || "") && comedians.some(n => String(c.title || "").toLowerCase().includes(n.toLowerCase())));

// ================================================================ JustWatch
const JW = "https://apis.justwatch.com/graphql";
async function jw(query, variables) {
  const r = await fetch(JW, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`JustWatch ${r.status}`);
  const j = await r.json(); if (j.errors?.length) throw new Error(`JustWatch: ${j.errors[0].message}`);
  return j.data;
}
const CONTENT = `title originalReleaseYear ... on MovieOrShowContent { originalTitle productionCountries shortDescription genres { shortName } }`;
const CHART = `query S($country: Country!, $filter: StreamingChartsFilter, $first: Int!) { streamingCharts(country: $country, filter: $filter, first: $first) {
  edges { streamingChartInfo { rank } node { objectType content(country: $country, language: "en") { ${CONTENT} } } } } }`;
async function jwChart(pk, objectType, first = 40) {
  const d = await jw(CHART, { country: "IN", first, filter: { category: "WEEKLY_POPULARITY_SAME_CONTENT_TYPE", objectType, packages: [pk] } });
  return (d.streamingCharts?.edges || []).map(e => ({ rank: e.streamingChartInfo.rank, kind: objectType === "MOVIE" ? "Film" : "Series", ...e.node.content }));
}
const SEARCH = `query Q($country: Country!, $q: String!) { popularTitles(country: $country, first: 3, filter: { searchQuery: $q }) { edges { node { objectType content(country: $country, language: "en") { ${CONTENT} } } } } }`;
async function jwFind(title) {
  const d = await jw(SEARCH, { country: "IN", q: title });
  const hit = (d.popularTitles?.edges || []).map(e => e.node).find(n => sameTitle(n.content?.title, title));
  return hit ? { kind: hit.objectType === "MOVIE" ? "Film" : "Series", ...hit.content } : null;
}

// ================================================================ streaming: the top ten of each service this week
// Netflix's own Top 10 (a 30 MB file of every country and week; India's newest week is read and the rest never
// downloaded). Rows: [country, iso2, week, category, rank, show_title, season_title, weeks]
export function netflixRows(tsv, country = "India") {
  const out = []; let week = null;
  for (const line of String(tsv).split("\n")) {
    const c = line.split("\t");
    if (c[0] !== country) { if (out.length) break; continue; }
    week ||= c[2];
    if (c[2] !== week) break;
    const season = c[6] && c[6] !== "N/A" ? (c[6].match(/: Season (\d+)$/) || [])[1] : null;
    out.push({ week, category: c[3], rank: Number(c[4]), title: c[5], season: season ? Number(season) : null });
  }
  return out;
}
async function netflixTop10() {
  const r = await fetch("https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv", { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok || !r.body) throw new Error(`Netflix Top 10 ${r.status}`);
  // read until India's newest week is complete (its 20 rows and the first row after them), then stop downloading
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "", start = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      if (start < 0) { const i = buf.indexOf("\nIndia\t"); if (i >= 0) { buf = buf.slice(i + 1); start = 0; } else { buf = buf.slice(-200); continue; } }
      if ((buf.match(/(^|\n)India\t/g) || []).length > 20 || /\n(?!India\t)[^\n]+\n/.test(buf.slice(buf.lastIndexOf("\nIndia\t") + 1) + "")) break;
    }
  } finally { try { await reader.cancel(); } catch {} }
  const rows = netflixRows(buf);
  if (!rows.length) throw new Error("Netflix Top 10: no India rows");
  return rows;
}
const label = (t, season) => (season > 1 ? `${t}, season ${season}` : t);
// TMDB's original language for the "Hindi?" titles (a Telugu film with a romanised title is not Hindi); without a key
// they count as Hindi. Sets c._lang, so languageOf answers from it.
async function checkLangs(contents) {
  const key = process.env.TMDB_KEY, todo = contents.filter(c => c && c._lang === undefined && languageOf(c) === "Hindi?");
  await pool(todo, 4, async c => {
    if (!key) { c._lang = "Hindi"; return; }
    const r = await json(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(c.title)}&region=IN`, { timeout: 8000 });
    // romanised spellings differ ("Mahendragiri Varahi" is TMDB's "Mahendragiri Vaaraahi"): doubled letters count once
    const hit = (r.results || []).find(x => (x.media_type === "movie" || x.media_type === "tv") && looseTitle(x.title || x.name, c.title));
    c._lang = !hit ? "Hindi" : hit.original_language === "hi" ? "Hindi" : hit.original_language === "en" ? "English" : null;
  });
  for (const c of todo) if (c._lang === undefined) c._lang = "Hindi";
}
// One service's ten: chart rows from both sources, the same title once, English and Hindi only, this year's or last
// year's titles (or a new season), the official rank weighing most.
export function rankService({ official = [], chart = [] }, year = new Date().getFullYear(), comedians = []) {
  const items = [];
  const find = t => items.find(x => sameTitle(x.title, t));
  for (const o of official) {
    const x = { title: o.title, season: o.season, kind: o.category === "Films" ? "Film" : "Series", lang: o.lang ?? null, standup: !!o.standup, score: (11 - o.rank) * 2 };
    items.push(x);
  }
  for (const c of chart) {
    const hit = find(c.title), pts = Math.max(0, (41 - c.rank) / 4);
    if (hit) { hit.score += pts; hit.lang ??= languageOf(c); hit.standup ||= isStandup(c, comedians); continue; }
    if (!((c.originalReleaseYear || 0) >= year - 1)) continue;
    items.push({ title: c.title, season: null, kind: c.kind, lang: languageOf(c), standup: isStandup(c, comedians), score: pts });
  }
  return items.filter(x => x.lang === "English" || x.lang === "Hindi").sort((a, b) => b.score - a.score).slice(0, 10)
    .map(x => ({ title: label(x.title, x.season), kind: x.standup ? "Stand-up" : x.kind, lang: x.lang }));
}
export async function streaming() {
  try {
    const services = C().services || [{ id: "netflix", name: "Netflix", jw: "nfx" }, { id: "prime", name: "Prime Video", jw: "prv" }, { id: "jiohotstar", name: "JioHotstar", jw: "jhs" }, { id: "appletv", name: "Apple TV", jw: "atp" }];
    const nf = await netflixTop10().catch(() => null), comedians = C().stage?.comedians || [];
    const out = await Promise.all(services.map(async s => {
      const chart = (await Promise.all(["MOVIE", "SHOW"].map(t => jwChart(s.jw, t).catch(() => [])))).flat().sort((a, b) => a.rank - b.rank);
      let official = [];
      if (s.id === "netflix" && nf) {
        // language and kind for Netflix's own rows: from JustWatch's chart, else a JustWatch search
        const found = await pool(nf, 5, async o => chart.find(x => sameTitle(x.title, o.title)) || await jwFind(o.title).catch(() => null));
        await checkLangs([...chart, ...found]);
        official = nf.map((o, i) => ({ ...o, lang: found[i] ? languageOf(found[i]) : null, standup: found[i] ? isStandup(found[i], comedians) || comedians.some(n => o.title.toLowerCase().includes(n.toLowerCase())) : false }));
      } else await checkLangs(chart);
      const rows = rankService({ official, chart }, undefined, comedians);
      return rows.length ? { id: s.id, name: s.name, rows, source: official.length ? `Netflix's India Top 10, week to ${Number(nf[0].week.slice(8, 10))} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[Number(nf[0].week.slice(5, 7)) - 1]}, with JustWatch India` : "JustWatch India, this week" } : null;
    }));
    const list = out.filter(Boolean);
    if (!list.length) throw new Error("no streaming chart");
    return ok({ services: list }, "Netflix, JustWatch");
  } catch (e) { return fail(e); }
}

// ================================================================ upcoming: films and series due in India
const UPCOMING = `query N($country: Country!, $date: Date!, $filter: TitleFilter, $first: Int!) {
  newTitles(country: $country, date: $date, filter: $filter, first: $first, pageType: UPCOMING, priceDrops: false) {
    edges { node { objectType
      ... on Season { content(country: $country, language: "en") { seasonNumber upcomingReleases { releaseDate package { shortName } } }
        show { content(country: $country, language: "en") { ${CONTENT} scoring { imdbVotes tmdbPopularity } } } }
      ... on Movie { content(country: $country, language: "en") { ${CONTENT} upcomingReleases { releaseDate package { shortName } } scoring { imdbVotes tmdbPopularity } } } } } } }`;
export function jwUpcomingRows(edges, pk, svc) {
  return (edges || []).map(e => {
    const n = e.node, c = n.content || {}, sc = n.show?.content || {}, base = n.objectType === "SHOW_SEASON" ? sc : c;
    const rel = (c.upcomingReleases || []).find(u => u.package?.shortName === pk) || (c.upcomingReleases || [])[0];
    const s = base.scoring || {};
    return { title: n.objectType === "SHOW_SEASON" ? (c.seasonNumber > 1 ? `${sc.title}, season ${c.seasonNumber}` : sc.title) : c.title,
      kind: n.objectType === "MOVIE" ? "film" : "series", date: rel?.releaseDate || null, where: svc, lang: languageOf(base),
      pop: Math.round(s.tmdbPopularity || 0), votes: s.imdbVotes || 0 };
  }).filter(x => x.title && x.date);
}
export async function upcoming() {
  try {
    const U = C().upcoming || {}, svc = C().upcoming_services || { nfx: "Netflix", prv: "Prime Video", jhs: "JioHotstar", atp: "Apple TV", snl: "SonyLIV", zee: "Zee5" };
    const today = istDay(), until = addDays(today, U.further_days ?? 90);
    const watching = (C().watching || []).map(String);
    const jwRows = (await Promise.all(Object.entries(svc).map(([pk, name]) => jw(UPCOMING, { country: "IN", date: today, first: 100, filter: { packages: [pk] } })
      .then(d => jwUpcomingRows(d.newTitles?.edges, pk, name)).catch(() => [])))).flat();
    // TMDB: Indian cinema dates (Hindi and English, its most popular few) and Hindi series streaming in India
    let tm = null; try { const { tmdbUpcoming } = await import("./trial.js"); tm = await tmdbUpcoming(); } catch {}
    const tmRows = [];
    for (const f of tm?.films || []) if (f.kind === "cinema" && f.popularity_rank <= (U.cinema_rank ?? 4)) tmRows.push({ title: f.title, kind: "film", date: f.date, where: "Cinemas", lang: f.language, pop: 0, rank: f.popularity_rank, tmdb_id: f.tmdb_id });
    for (const f of tm?.films || []) if (f.kind === "streaming premiere" && f.popularity_rank <= 2 && f.streaming_on?.length) tmRows.push({ title: f.title, kind: "film", date: f.date, where: f.streaming_on[0], lang: f.language, pop: 0, rank: f.popularity_rank, tmdb_id: f.tmdb_id });
    for (const s of tm?.series || []) if (s.language === "Hindi" && s.india_day_one && s.streaming_on?.length) tmRows.push({ title: s.kind.startsWith("season") && s.kind !== "season 1" ? `${s.title}, ${s.kind}` : s.title, kind: "series", date: s.date, where: s.streaming_on[0].replace(/ with Ads$/i, ""), lang: "Hindi", pop: 0, rank: s.popularity_rank, tmdb_id: s.tmdb_id });
    const all = [];
    for (const x of [...tmRows, ...jwRows]) {
      if (!x.date || x.date < today || x.date > until || /-01-01$/.test(x.date)) continue; // 1 Jan is JustWatch's "date not known"
      if (x.lang === "Hindi?") x.lang = "Hindi";
      if (x.lang !== "English" && x.lang !== "Hindi") continue;
      const w = watching.some(t => sameTitle(t, x.title.replace(/, season \d+$/, "")));
      const worth = w || x.where === "Cinemas" || x.rank || x.pop >= (U.min_popularity ?? 12) || x.votes >= (U.min_votes ?? 20000);
      if (!worth) continue;
      if (all.some(y => sameTitle(y.title, x.title) && y.date === x.date)) continue;
      all.push({ ...x, watching: w });
    }
    all.sort((a, b) => a.date.localeCompare(b.date) || b.pop - a.pop);
    if (!all.length) throw new Error("nothing due");
    return ok({ today, near_days: U.days ?? 21, further_min_popularity: U.further_min_popularity ?? 30, items: all }, tm?.films ? "JustWatch, TMDB" : "JustWatch");
  } catch (e) { return fail(e); }
}

// ================================================================ cinema: the films in cinemas now
// Sacnilk's box-office list: each film's page and its full name and language ("Here is the Hindi movie ...").
// The name is read from the summary line, which survived Sacnilk's redesign of 4 Oct 2026 (before it, an image's alt).
export function parseSacnilkList(html) {
  return [...String(html).matchAll(/href="(https:\/\/www\.sacnilk\.com\/news\/[A-Za-z0-9_]+_Box_Office_Collection_Day_Wise_Worldwide)"[\s\S]{0,4000}?Here is the (\w+) movie ([\s\S]{1,160}?) box office collection/g)]
    .map(m => ({ url: m[1], title: decodeHtml(m[3]).replace(/\s+/g, " ").trim(), language: m[2] }));
}
// a film's page: India net so far and the days counted
export function parseSacnilkFilm(html) {
  const t = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "|").replace(/\s*\|\s*(\|\s*)*/g, "|");
  const total = t.match(/Total Collection \(Net\)\|₹\s?([\d.,]+)\s?Cr/i);
  const days = [...t.matchAll(/\|Day (\d+)\|[^|]*\|[^|]*\|₹\s?([\d.]+)\s?Cr/g)].map(m => Number(m[1]));
  return total ? { net_cr: Number(total[1].replace(/,/g, "")), days: days.length ? Math.max(...days) : null } : null;
}
// Rotten Tomatoes: a film's page, its critics and audience scores and consensus
export function parseRT(html) {
  const s = String(html), out = {};
  for (const k of ["criticsScore", "audienceScore"]) {
    const m = s.match(new RegExp(`"${k}":\\{([^}]*)\\}`)); if (!m) continue;
    const d = Object.fromEntries([...m[1].matchAll(/"(score|reviewCount|ratingCount|likedCount)":"?([^",]+)/g)].map(x => [x[1], x[2]]));
    out[k === "criticsScore" ? "critics" : "audience"] = { score: d.score != null && d.score !== "null" ? Number(d.score) : null, count: Number(d.reviewCount || d.ratingCount || 0) || null, liked: d.likedCount != null ? Number(d.likedCount) : null };
  }
  const ld = ldBlocks(s).find(x => x?.dateCreated || x?.datePublished);
  out.date = ld?.dateCreated || ld?.datePublished || null;
  const c = s.match(/id="critics-consensus"[^>]*>([\s\S]*?)<\/div>/) || s.match(/data-qa="critics-consensus"[^>]*>([\s\S]*?)<\//);
  if (c) out.consensus = decodeHtml(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/^\s*Critics Consensus\s*/i, "").replace(/\s*Read Critics Reviews.*$/i, "").trim().slice(0, 240) || null;
  return out;
}
async function rtFor(title, year) {
  const s = await text(`https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`, { timeout: 10000 });
  const slugs = [...new Set([...s.matchAll(/href="https:\/\/www\.rottentomatoes\.com\/m\/([a-z0-9_]+)"/g)].map(m => m[1]))].slice(0, 6);
  const cand = [...slugs.filter(x => x.endsWith(`_${year}`)), ...slugs.filter(x => !/_\d{4}$/.test(x))].filter(x => sameTitle(x.replace(/_\d{4}$/, "").replace(/_/g, " "), title));
  for (const slug of cand.slice(0, 2)) {
    const p = parseRT(await text(`https://www.rottentomatoes.com/m/${slug}`, { timeout: 10000 }));
    if (!p.date || p.date.slice(0, 4) >= String(year - 1)) return { url: `https://www.rottentomatoes.com/m/${slug}`, ...p };
  }
  return null;
}
// Review headlines from Google News, each outlet sorted as an independent critic or a trade or fan site (config)
export function classifyReviews(items, cfg = {}) {
  const ind = (cfg.independent || []).map(x => x.toLowerCase()), trade = (cfg.trade || []).map(x => x.toLowerCase());
  const is = (src, list) => list.some(n => src.toLowerCase().includes(n));
  return items.filter(x => /\breview\b/i.test(x.title) && !/\b(x|twitter|netizens|audience|first|public)\s+review/i.test(x.title))
    .map(x => ({ ...x, kind: is(x.source, trade) ? "trade" : is(x.source, ind) ? "independent" : null })).filter(x => x.kind);
}
async function reviewsFor(title) {
  const s = await text(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${title}" review when:21d`)}&hl=en-IN&gl=IN&ceid=IN:en`, { timeout: 10000 });
  const items = [...s.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const g = k => decodeHtml((m[1].match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)</${k}>`)) || [])[1] || "");
    return { title: g("title").replace(/\s+-\s+[^-]+$/, ""), source: g("source"), url: g("link"), date: g("pubDate") };
  });
  return classifyReviews(items, C().critics).slice(0, 14);
}
async function redditFor(title, lang) {
  const sub = lang === "Hindi" ? "bollywood" : "movies";
  const q = lang === "Hindi" ? `${title} review` : `Official Discussion ${title}`;
  const s = await text(`https://www.reddit.com/r/${sub}/search.rss?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=month`, { timeout: 10000 });
  const e = [...s.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => ({ title: decodeHtml((m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""), url: (m[1].match(/<link href="([^"]+)"/) || [])[1] }))
    .find(x => sameTitle(x.title.replace(/[–-].*$/, ""), title) && /review|discussion|megathread/i.test(x.title));
  return e?.url ? { sub: `r/${sub}`, title: e.title, url: e.url, rss: e.url.replace(/\/?$/, "/.rss") } : null;
}
// Wikipedia page views for the last seven days, from TMDB's Wikidata ids: one Wikidata call and one Wikipedia call
async function pageViews(wikidataIds) {
  const ids = wikidataIds.filter(Boolean); if (!ids.length) return {};
  const wd = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=enwiki&ids=${ids.join("|")}`, { headers: { "user-agent": WIKI_UA } });
  const title = Object.fromEntries(Object.entries(wd.entities || {}).map(([q, e]) => [q, e.sitelinks?.enwiki?.title]).filter(x => x[1]));
  const titles = [...new Set(Object.values(title))]; if (!titles.length) return {};
  const pv = await json(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageviews&pvipdays=7&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`, { headers: { "user-agent": WIKI_UA } });
  const redirect = Object.fromEntries((pv.query?.redirects || []).map(r => [r.from, r.to]));
  const views = Object.fromEntries(Object.values(pv.query?.pages || {}).map(p => [p.title, Object.values(p.pageviews || {}).reduce((a, v) => a + (v || 0), 0)]));
  return Object.fromEntries(Object.entries(title).map(([q, t]) => [q, views[redirect[t] || t] ?? null]));
}
export async function cinema() {
  try {
    const key = process.env.TMDB_KEY; if (!key) throw new Error("TMDB_KEY not set");
    const { keyed } = await import("./trial.js");
    const K = C().cinema || {}, back = K.days_back ?? 35, per = K.per_language ?? 8, today = istDay(), since = addDays(today, -back);
    const T = (path, qs = "") => keyed(`https://api.themoviedb.org/3/${path}?api_key=${encodeURIComponent(key)}${qs}`, "TMDB");
    const lists = await Promise.all(["hi", "en"].map(l => T("discover/movie", `&with_original_language=${l}&sort_by=popularity.desc&region=IN&with_release_type=2|3&release_date.gte=${since}&release_date.lte=${today}`)
      .then(r => (r.results || []).slice(0, per)).catch(() => [])));
    const base = await pool(lists.flat(), 8, async x => {
      const d = await T(`movie/${x.id}`, "&append_to_response=release_dates,external_ids");
      const IN = (d.release_dates?.results || []).find(c => c.iso_3166_1 === "IN")?.release_dates?.filter(r => r.type === 3 || r.type === 2).map(r => r.release_date.slice(0, 10)).sort()[0] || null;
      return { title: d.title, year: Number((IN || d.release_date || "").slice(0, 4)) || null, language: d.original_language === "hi" ? "Hindi" : "English", release: IN || d.release_date || null,
        tmdb_id: d.id, imdb_id: d.external_ids?.imdb_id || null, wikidata: d.external_ids?.wikidata_id || null, popularity: d.popularity || 0 };
    });
    const films = base.filter(f => f && f.release && f.release >= since && f.release <= today);
    if (!films.length) throw new Error("no films in cinemas");
    const [views, sacList] = await Promise.all([pageViews(films.map(f => f.wikidata)).catch(() => ({})),
      Promise.all([1, 2].map(p => text(`https://www.sacnilk.com/entertainmenttopbar/Box_Office${p > 1 ? `?page=${p}` : ""}`).then(parseSacnilkList).catch(() => []))).then(x => x.flat())]);
    for (const f of films) f.views_7d = views[f.wikidata] ?? null;
    // the most-followed first: page views when Wikipedia has the film, else TMDB's popularity
    const rank = f => (f.views_7d != null ? f.views_7d : -1e9 + f.popularity);
    films.sort((a, b) => rank(b) - rank(a));
    const top = films.slice(0, K.max ?? 8);
    await pool(top, 4, async f => {
      const sac = sacList.find(s => s.language === f.language && sameTitle(s.title, f.title));
      const [bo, rt, reviews, reddit, om] = await Promise.all([
        sac ? text(sac.url).then(parseSacnilkFilm).catch(() => null) : null,
        rtFor(f.title, f.year).catch(() => null),
        reviewsFor(f.title).catch(() => []),
        redditFor(f.title, f.language).catch(() => null),
        f.imdb_id && process.env.OMDB_KEY ? keyed(`https://www.omdbapi.com/?apikey=${encodeURIComponent(process.env.OMDB_KEY)}&i=${f.imdb_id}`, "OMDb").catch(() => null) : null,
      ]);
      if (bo) f.box_office = { ...bo, url: sac.url, source: "Sacnilk" };
      if (rt) f.rt = rt;
      f.reviews = reviews;
      if (reddit) f.reddit = reddit;
      if (om && om.Response !== "False" && om.imdbRating && om.imdbRating !== "N/A") f.imdb = { rating: Number(om.imdbRating), votes: Number(String(om.imdbVotes).replace(/,/g, "")) || null };
    });
    return ok({ since, films: top.map(({ popularity, wikidata, ...f }) => f) }, "TMDB, Wikipedia, Rotten Tomatoes, Sacnilk, Google News, Reddit");
  } catch (e) { return fail(e); }
}

// ================================================================ stage: Bengaluru stand-up and Sufi evenings
// allevents.in category pages: schema.org Events in the page
export function parseAllevents(html) {
  return ldBlocks(html).flatMap(x => (x?.["@type"] === "ItemList" ? (x.itemListElement || []).map(i => i.item || i) : [x])).filter(e => /Event/.test(String(e?.["@type"])))
    .map(e => {
      const loc = (Array.isArray(e.location) ? e.location[0] : e.location) || {}, off = (Array.isArray(e.offers) ? e.offers[0] : e.offers) || {};
      const price = Number(off.price || off.lowPrice) || null;
      return { title: decodeHtml(e.name || "").trim(), dates: [String(e.startDate || "").slice(0, 16)].filter(Boolean), venue: decodeHtml(loc.name || "").replace(/:\s*Bengaluru$|,\s*Bengaluru$/i, "").trim() || null,
        city: decodeHtml([loc.address?.addressLocality, loc.address?.streetAddress].filter(Boolean).join(" ")), price_from: price, url: e.url || null, source: "allevents", performers: [] };
    }).filter(e => e.title && e.dates.length);
}
// District: one event's page (schema.org Events, one per date, and the page data: when it was listed, the seating)
export function parseDistrict(html, url) {
  const evs = ldBlocks(html).filter(x => /Event/.test(String(x?.["@type"])));
  if (!evs.length) return null;
  const t = String(html).replace(/\\"/g, '"'), loc = (Array.isArray(evs[0].location) ? evs[0].location[0] : evs[0].location) || {}, addr = loc.address;
  const prices = evs.flatMap(e => (Array.isArray(e.offers) ? e.offers : [e.offers]).map(o => Number(o?.price || o?.lowPrice) || 0)).filter(p => p > 0);
  const seat = (t.match(/"heading":"Seating Arrangement","subheading":"([^"]+)"/) || [])[1] || null;
  return { title: decodeHtml(evs[0].name || "").trim(), dates: [...new Set(evs.map(e => String(e.startDate || "").slice(0, 16)).filter(Boolean))].sort(),
    venue: decodeHtml(loc.name || "").trim() || null, city: typeof addr === "string" ? addr : [addr?.addressLocality, addr?.streetAddress].filter(Boolean).join(" "),
    price_from: prices.length ? Math.min(...prices) : null, performers: [].concat(evs[0].performer || []).map(p => p?.name).filter(Boolean),
    listed: (t.match(/"published_at_timestamp":"([^"]+)"/) || [])[1] || null, seated: seat ? /seated/i.test(seat) && !/standing/i.test(seat) : null,
    url, source: "District" };
}
const IST = iso => (iso ? new Date(Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}${iso.length <= 10 ? "T00:00:00" : ""}+05:30`) + 5.5 * 36e5).toISOString().slice(0, 16) : null);
// Sort one show into stand-up or Sufi, or neither (config offduty.stage): Sufi by its words or its artists, stand-up by
// its category or words; open mics, line-ups and regional-language shows are not listed; nor the comedians Parth skips.
export function classify(ev, S = {}, from = "") {
  const hay = `${ev.title} ${(ev.performers || []).join(" ")}`, rx = list => new RegExp(`\\b(${list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  if ((S.never || []).length && rx(S.never).test(hay)) return null;
  if (rx(S.regional_words || ["telugu", "tamil", "kannada", "malayalam", "bengali", "bangla", "marathi"]).test(hay)) return null;
  if ((S.sufi_words || []).length && rx(S.sufi_words).test(hay)) return "sufi";
  if ((S.sufi_artists || []).length && rx(S.sufi_artists).test(hay)) return "sufi";
  const comedy = from === "comedy" || /\bstand[- ]?up\b|\bcomedy\b|\bcomic\b/i.test(hay) || ((S.comedians || []).length && rx(S.comedians).test(hay));
  if (!comedy) return null;
  if ((S.skip_words || []).length && rx(S.skip_words).test(hay)) return null;
  // a named act: a performer, "by X", "ft. X", "X Live", a solo
  if (!(ev.performers?.length || /\b(by|ft\.?|feat\.?|featuring)\s+\p{Lu}/u.test(ev.title) || /\blive\b|\bsolo\b|\btour\b|·/i.test(ev.title) || ((S.comedians || []).length && rx(S.comedians).test(hay)))) return null;
  return "comedy";
}
// Bengaluru: named in the address, venue or title, or a Bengaluru PIN code (560 to 562: Yelahanka's arena is 562157)
export const inBengaluru = e => /bengaluru|bangalore/i.test(`${e.city} ${e.venue} ${e.title}`) || /\b56[0-2]\d{3}\b/.test(e.city || "");
// "Samay Raina Live | Bengaluru | Koramangala Indoor Stadium" -> "Samay Raina Live"; "Lakhwinder Wadali India Tour -
// Bengaluru" -> "Lakhwinder Wadali India Tour": the city and the venue are printed beside the title already
export function cleanTitle(t, venue = "") {
  const v = words(venue).join(" ");
  const parts = String(t).split(/\s+\|\s+/).map(p => p.replace(/\s*[-–,:]\s*(bengaluru|bangalore)\s*$/i, "").replace(/\s+(in|at)\s+(bengaluru|bangalore)\s*$/i, "").trim())
    .filter(p => p && !/^(bengaluru|bangalore)$/i.test(p) && !(v && words(p).join(" ") === v));
  return parts.join(" · ") || String(t).trim();
}
const keyOf = e => `${words(e.title).slice(0, 4).join("-")}@${(e.dates[0] || "").slice(0, 10)}`;
export function mergeStage(list, S = {}, prev = [], today = istDay()) {
  const until = addDays(today, S.days ?? 150), out = [];
  for (const e of list) {
    if (!e || !inBengaluru(e)) continue;
    const dates = e.dates.map(IST).filter(d => d && d.slice(0, 10) >= today && d.slice(0, 10) <= until);
    if (!dates.length) continue;
    const kind = classify(e, S, e.from); if (!kind) continue;
    const x = { ...e, title: cleanTitle(e.title, e.venue), dates, kind }; delete x.from;
    const same = out.find(y => y.kind === kind && (y.dates[0] || "").slice(0, 10) === dates[0].slice(0, 10) && (sameTitle(y.title, x.title) || words(y.title).slice(0, 3).join(" ") === words(x.title).slice(0, 3).join(" ")));
    if (same) { // District knows more (listing date, seating, price): it wins, allevents fills gaps
      if (x.source === "District") Object.assign(same, { ...x, price_from: x.price_from ?? same.price_from });
      else { same.price_from ??= x.price_from; }
      continue;
    }
    out.push(x);
  }
  const seen = new Map((prev || []).map(p => [p.key, p.first_seen]));
  const firstRun = !prev?.length;
  for (const x of out) {
    x.key = keyOf(x);
    x.first_seen = seen.has(x.key) ? seen.get(x.key) : firstRun ? null : today; // a show listed before stays as it was
    x.listed = x.listed ? IST(x.listed).slice(0, 10) : null;
    const since = x.listed || x.first_seen;
    x.new = !!since && since >= addDays(today, -(S.new_days ?? 7));
    x.follow = (S.comedians_follow || []).some(n => new RegExp(`\\b${n}\\b`, "i").test(`${x.title} ${(x.performers || []).join(" ")}`));
  }
  return out.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}
const OTHER_CITIES = ["mumbai", "delhi", "new-delhi", "pune", "hyderabad", "kolkata", "chennai", "ahmedabad", "jaipur", "lucknow", "chandigarh", "gurgaon", "gurugram", "noida", "indore", "nagpur", "kochi", "goa", "surat", "bhopal", "patna", "ranchi", "dehradun", "amritsar", "ludhiana", "jalandhar", "panchkula", "kota", "jammu", "shimla", "hisar", "rohtak", "karnal", "ambala", "bathinda", "hoshiarpur", "ganganagar", "gurdaspur", "lakhimpur", "yamuna-nagar", "vadodara", "nashik", "thane", "navi-mumbai", "faridabad", "ghaziabad", "visakhapatnam", "vizag", "coimbatore", "mysore", "mysuru", "mangalore", "kanpur", "varanasi", "guwahati", "bhubaneswar", "raipur", "udaipur", "jodhpur", "agra", "meerut", "dubai", "london", "singapore", "toronto", "new-york", "sydney", "melbourne"];
const PAST_SLUG = /20(1\d|2[0-5])(?!\d)/;
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
export function districtCandidates(xml, S = {}, today = istDay()) {
  const slugs = [...String(xml).matchAll(/<loc>https:\/\/www\.district\.in\/events\/([^<]+)<\/loc>/g)].map(m => m[1]);
  const names = [...(S.sufi_artists || []), ...(S.comedians_follow || []), ...(S.comedians || []), ...(S.sufi_words || [])].map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  // a page found by an artist's name but plainly for another city ("...-live-in-mumbai-2027-...") is not fetched
  const elsewhere = new RegExp(`-(${(S.other_cities || OTHER_CITIES).join("|")})(-|$)`);
  return slugs.filter(s => {
    if (PAST_SLUG.test(s) && !/202[6-9]/.test(s)) return false;
    // a dated slug ("...-oct4-2026-buy-tickets") already past
    const dm = s.match(new RegExp(`(${MONTHS})(\\d{1,2})-(20\\d\\d)`));
    if (dm && `${dm[3]}-${String(MONTHS.split("|").indexOf(dm[1]) + 1).padStart(2, "0")}-${dm[2].padStart(2, "0")}` < today) return false;
    if (/bengaluru|bangalore|blr/.test(s)) return true;
    return names.some(n => n && s.includes(n)) && !elsewhere.test(s);
  });
}
function previousStage() {
  try { return JSON.parse(readFileSync(join(process.cwd(), "content", "latest.json"), "utf8")).snapshot?.stage?.value?.items || []; } catch { return []; }
}
export async function stage() {
  try {
    const S = C().stage || {};
    const cats = S.allevents || ["comedy", "music", "concerts"];
    // allevents' category pages, all at once (a page past the last is empty), and District's pages, side by side
    const allevents = async () => (await Promise.all(cats.flatMap(cat => Array.from({ length: S.allevents_pages ?? 12 }, (_, i) => i + 1).map(p =>
      text(`https://allevents.in/bangalore/${cat}${p > 1 ? `?page=${p}` : ""}`, { timeout: 12000 }).then(h => parseAllevents(h).map(e => ({ ...e, from: cat }))).catch(() => []))))).flat();
    const district = async () => {
      try {
        const xml = await text("https://cdn.district.in/sitemap/event-detail-pages.xml", { timeout: 15000 });
        const cand = districtCandidates(xml, S).slice(0, S.district_max ?? 160);
        return (await pool(cand, 16, async slug => { const u = `https://www.district.in/events/${slug}`; return parseDistrict(await text(u, { timeout: 9000 }), u); })).filter(Boolean);
      } catch { return []; }
    };
    const [ae, dist] = await Promise.all([allevents(), district()]);
    const items = mergeStage([...dist, ...ae], S, previousStage());
    if (!items.length) throw new Error("no Bengaluru shows found");
    return ok({ items, sources: { allevents: ae.length, district: dist.length } }, "District, allevents.in");
  } catch (e) { return fail(e); }
}

export const OFFDUTY = { cinema, streaming, upcoming, stage };
export const OFFDUTY_CACHE = { cinema: [10800, 21600], streaming: [21600, 43200], upcoming: [21600, 43200], stage: [21600, 43200] };
