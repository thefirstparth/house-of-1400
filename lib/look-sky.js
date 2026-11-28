// The trial's sky feeds, behind /api/live/look_*. Every key returns {ok, value, source, as_of, stale}.
// look_sky (the Sky Report's "rest of the day", /?trial, 27 Nov 2026): the next hours for Bengaluru, Ranchi and
// Prayagraj from Open-Meteo, grouped into the parts of the day in IST: tonight 21:00 to 06:00, morning 06:00 to 12:00,
// afternoon 12:00 to 17:00, evening 17:00 to 21:00. Each part carries the highest chance of rain in its hours, its
// coldest and warmest hour, and the sky most of its hours have. The first part is the one under way (only its hours
// from now on); five parts are sent so the page can drop one that ends while the feed is held at the edge.
// Backup: MET Norway's hourly forecast for a city Open-Meteo does not answer for. MET gives no chance of rain outside
// the Nordic area, so its parts carry rain: null and the millimetres it expects instead; the page then shows no bar.
import { config, getJSON, getText } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });

export const PARTS = [
  { key: "tonight", label: "Tonight", from: 21, to: 6 },
  { key: "morning", label: "Morning", from: 6, to: 12 },
  { key: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { key: "evening", label: "Evening", from: 17, to: 21 },
];
export const partOf = h => (h >= 21 || h < 6 ? PARTS[0] : h < 12 ? PARTS[1] : h < 17 ? PARTS[2] : PARTS[3]);

const pad = n => String(n).padStart(2, "0");
// "2026-11-27T06:00" in IST for a moment, and back
export const istHour = ms => { const d = new Date(ms + 5.5 * 36e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`; };
export const istMs = local => Date.parse(local + ":00+05:30");
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

// The sky most of a part's hours have; when rain is likely (60% or more) and some hour has rain or a storm, the
// commonest wet sky (a storm wins a tie), so a wet afternoon is not drawn as a cloud.
export function partCode(hours, rain) {
  const codes = hours.map(h => h.code).filter(c => Number.isFinite(c));
  if (!codes.length) return null;
  const wet = codes.filter(c => c >= 51);
  const pool = rain != null && rain >= 60 && wet.length ? wet : codes;
  const n = {}; for (const c of pool) n[c] = (n[c] || 0) + 1;
  return Number(Object.keys(n).sort((a, b) => n[b] - n[a] || b - a)[0]);
}

// hours: [{time: "YYYY-MM-DDTHH:00" (IST), temp, rain_prob, code, rain_mm?}] in order. Returns up to `count` parts,
// starting with the one under way at `now`.
export function groupParts(hours, now = Date.now(), count = 5) {
  const startMs = istMs(istHour(now)), stop = startMs + 30 * 36e5;
  const ahead = (hours || []).filter(h => { const t = istMs(h.time); return t >= startMs && t < stop && Number.isFinite(h.temp) && h.temp > -60 && h.temp < 60; });
  const out = [];
  for (const h of ahead) {
    const hr = Number(h.time.slice(11, 13)), P = partOf(hr), day = h.time.slice(0, 10);
    // tonight belongs to the evening it starts on: 00:00 to 05:00 are the night of the day before
    const startDay = P.key === "tonight" && hr < 6 ? addDays(day, -1) : day;
    const id = `${P.key}:${startDay}`;
    let cur = out[out.length - 1];
    if (!cur || cur.id !== id) {
      const endDay = P.key === "tonight" ? addDays(startDay, 1) : startDay;
      cur = { id, key: P.key, label: P.label, from: `${pad(P.from)}:00`, to: `${pad(P.to)}:00`, start: `${startDay}T${pad(P.from)}:00:00+05:30`, end: `${endDay}T${pad(P.to)}:00:00+05:30`, first: h.time, hours: [] };
      out.push(cur);
    }
    cur.hours.push(h);
  }
  return out.slice(0, count).map(p => {
    const temps = p.hours.map(h => h.temp), probs = p.hours.map(h => h.rain_prob).filter(Number.isFinite), mm = p.hours.map(h => h.rain_mm).filter(Number.isFinite);
    const rain = probs.length ? Math.round(Math.max(...probs)) : null;
    return {
      key: p.key, label: p.label, from: p.from, to: p.to, start: p.start, end: p.end,
      // the part under way starts at this hour, not at its usual start
      partial: p.first !== p.start.slice(0, 16), first: `${p.first}:00+05:30`, hours: p.hours.length,
      rain, rain_mm: mm.length ? Math.round(mm.reduce((s, x) => s + x, 0) * 10) / 10 : null,
      tmin: Math.round(Math.min(...temps)), tmax: Math.round(Math.max(...temps)), code: partCode(p.hours, rain),
    };
  });
}

// Open-Meteo answers a list of points with a list (one point: one object)
export function parseOpenMeteo(j, cities, now = Date.now()) {
  const arr = Array.isArray(j) ? j : [j];
  if (arr.length !== cities.length) throw new Error("open-meteo count");
  return cities.map((c, i) => {
    const H = arr[i]?.hourly;
    if (!H?.time?.length || !Array.isArray(H.temperature_2m)) return null;
    const hours = H.time.map((t, k) => ({ time: t, temp: H.temperature_2m[k], rain_prob: H.precipitation_probability?.[k] ?? null, code: H.weather_code?.[k] ?? null }));
    const parts = groupParts(hours, now);
    return parts.length >= 4 ? { name: c.name, parts, source: "Open-Meteo" } : null;
  });
}

// MET Norway's symbol codes as WMO codes ("lightrainshowers_day" is a light shower, and so on)
const MET_CODE = { clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45, lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 80, heavyrainshowers: 81, drizzle: 53, lightsleet: 61, sleet: 63 };
export const metCode = s => { const k = String(s || "").replace(/_(day|night|polartwilight)$/, ""); return /thunder/.test(k) ? 95 : MET_CODE[k] ?? null; };
export function parseMetnoHours(j) {
  const ts = j?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) throw new Error("met.no shape");
  return ts.filter(x => x.data?.next_1_hours).map(x => ({
    time: istHour(Date.parse(x.time)), temp: x.data.instant?.details?.air_temperature, rain_prob: null,
    code: metCode(x.data.next_1_hours.summary?.symbol_code), rain_mm: x.data.next_1_hours.details?.precipitation_amount ?? null,
  }));
}

const CITIES = () => { const W = config().weather; return [...W.always, ...(W.family || [])].map(c => ({ name: c.name, lat: c.lat, lon: c.lon })); };

export async function lookSky(params, { fetchJSON = getJSON, now = Date.now() } = {}) {
  const cities = CITIES();
  let got = cities.map(() => null);
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cities.map(c => c.lat).join(",")}&longitude=${cities.map(c => c.lon).join(",")}` +
      `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=3&timezone=Asia%2FKolkata`;
    got = parseOpenMeteo(await fetchJSON(u, { timeout: 6000 }), cities, now);
  } catch {}
  // a city Open-Meteo did not answer for: MET Norway
  await Promise.all(cities.map(async (c, i) => {
    if (got[i]) return;
    try {
      const j = await fetchJSON(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c.lat}&lon=${c.lon}`, { timeout: 6000, headers: { "user-agent": config().weather.metno_user_agent } });
      const parts = groupParts(parseMetnoHours(j), now);
      if (parts.length >= 4) got[i] = { name: c.name, parts, source: "MET Norway" };
    } catch {}
  }));
  const list = got.filter(Boolean);
  if (!list.length) return fail("look_sky: no forecast");
  return ok({ cities: list }, [...new Set(list.map(c => c.source))].join(", "));
}

// ================================================================ look_search: The Search Bar and what X is posting
// (8) The Search Bar (/?trial, 28 Nov 2026). Google's "Trending now" for India and the paper's world countries (config
// trends: IN, then US, GB, ES), with a headline for each search, and X's trending list for India and the world.
//   the list      Google's own list, read from the trending page itself (trends.google.com/trending: the page carries
//                 its list inline, about 350 searches a country, each with its volume, start, whether it has ended,
//                 its related searches and the languages of its news). The batchexecute call the paper's own feed uses
//                 (lib/live.js trends) is turned away from Vercel and from this sandbox (error 7, checked 28 Nov), so
//                 it is only the second try; Google's RSS (ten small searches) is the last.
//   the headline  the RSS's own news for its ten; for the rest, the day's Google News results for the search, the
//                 first that is about it (its words, or its related searches', in the title) and not a live-score or
//                 how-to-watch page. A search with no such headline keeps its related searches as its context.
//   the order     searches still climbing first, by volume, then ones that have ended; one row per story (a match and
//                 its "standings" or a longer spelling of it are one row). India keeps searches written in English or
//                 Hindi, with English or Hindi headlines; the world rows in the Latin alphabet, and a search trending
//                 in more than one of the countries is one row naming each.
//   On X          trends24.in's hourly copies of X's list (X's own needs a paid key), India and worldwide: the latest
//                 hour, each with its posts when known and how many of the last 24 hours it has been on the list;
//                 getdaytrends.com when trends24 fails. X failing never fails the feed.
const UA_PAGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const decodeXml = s => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
const xtag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decodeXml(m[1]) : ""; };
export const trafficOf = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M+` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K+` : `${n}+`);
const volOf = t => { const m = String(t || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i); return m ? Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1) : 0; };
// Google's category numbers on the trending page
const CATS = { 1: "Autos", 2: "Fashion", 3: "Business", 4: "Entertainment", 5: "Food", 6: "Games", 7: "Health", 8: "Hobbies", 9: "Education", 10: "Government", 13: "Pets", 14: "Politics", 15: "Science", 16: "Shopping", 17: "Sport", 18: "Technology", 19: "Travel", 20: "Climate" };

// One search of Google's list: [0] term, [3][0] start (epoch s), [4] end (set once it has stopped climbing), [6] volume,
// [8] rise (%), [9] related searches, [10] categories, [11] news keys [id, language, geo]
export function trendItem(it) {
  if (!Array.isArray(it) || typeof it[0] !== "string" || !it[0].trim()) return null;
  const term = it[0].trim(), volume = typeof it[6] === "number" ? it[6] : 0;
  const start = Array.isArray(it[3]) && typeof it[3][0] === "number" ? it[3][0] : null;
  return {
    term, volume, traffic: trafficOf(volume), started: start ? new Date(start * 1000).toISOString() : null,
    active: it[4] == null, related: (Array.isArray(it[9]) ? it[9] : []).filter(q => typeof q === "string" && q.trim().toLowerCase() !== term.toLowerCase()).slice(0, 6),
    cat: (Array.isArray(it[10]) ? it[10] : []).map(c => CATS[c]).find(Boolean) || null,
    langs: [...new Set((Array.isArray(it[11]) ? it[11] : []).map(k => Array.isArray(k) ? k[1] : null).filter(l => typeof l === "string"))],
  };
}
// The trending page's inline list: the AF_initDataCallback whose data[1] is a list of searches
export function parseTrendingPage(html) {
  for (const m of String(html || "").matchAll(/AF_initDataCallback\(\{key: '[^']*', hash: '[^']*', data:([\s\S]*?), sideChannel: \{\}\}\);<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { continue; }
    const L = Array.isArray(d) ? d[1] : null;
    if (Array.isArray(L) && L.length && Array.isArray(L[0]) && typeof L[0][0] === "string" && typeof L[0][2] === "string") return L.map(trendItem).filter(Boolean);
  }
  return [];
}
// Google's RSS: ten searches, each with Google's own news
export function parseTrendsFeed(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const volume = volOf(xtag(it, "ht:approx_traffic")), at = Date.parse(xtag(it, "pubDate"));
    return { term: xtag(it, "title"), volume, traffic: trafficOf(volume), started: Number.isFinite(at) ? new Date(at).toISOString() : null, active: true, related: [], cat: null, langs: [],
      news: [...it.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].map(([, n]) => ({ title: xtag(n, "ht:news_item_title"), url: xtag(n, "ht:news_item_url"), source: xtag(n, "ht:news_item_source") })).filter(n => n.title && /^https?:\/\//.test(n.url)) };
  }).filter(t => t.term);
}
// Google News search results: [{title, url, source}], the outlet taken off the end of the title
export function parseNewsSearch(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const source = xtag(it, "source"); let title = xtag(it, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    return { title, url: xtag(it, "link"), source };
  }).filter(n => n.title && /^https?:\/\//.test(n.url));
}

// ---- words: a search's words, for matching it to a headline and to its own repeats ----
const SCRIPT_OK = { latin: /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u, deva: /^[\p{Script=Latin}\p{Script=Devanagari}\p{N}\p{P}\p{S}\p{Zs}\p{M}]+$/u };
export const isLatin = t => SCRIPT_OK.latin.test(String(t || "").trim());
export const isEnglishOrHindi = t => SCRIPT_OK.deva.test(String(t || "").trim());
export const hasDevanagari = t => /\p{Script=Devanagari}/u.test(String(t || ""));
const FILLER = new Set(["vs", "v", "fc", "f.c.", "f.c", "cf", "sc", "the", "of", "and", "in", "on", "at", "for", "to", "a", "standings", "lineups", "lineup", "stats", "live", "score", "scores", "today", "news", "latest", "highlights", "result", "results", "prediction", "match", "timeline"]);
export const words = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC")
  .split(/[^\p{L}\p{M}\p{N}.-]+/u).map(w => w.replace(/^[.-]+|[.-]+$/g, "")).filter(w => w && !FILLER.has(w) && !/^\d{4}$/.test(w));
const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
const hasWord = (list, w) => list.some(x => same(x, w));
const isMatch = t => /\s(vs\.?|v)\s/i.test(` ${t} `);
// The two sides of "a vs b" as word lists
const sides = t => String(t).split(/\s(?:vs\.?|v)\s/i).map(words);
// club words two different teams share, so they never alone make two matches one
const CLUB = new Set(["united", "city", "real", "club", "sporting", "athletic", "atletico", "inter", "town", "rovers", "al", "fc"]);
// Two searches about one story: a match and its standings ("man utd vs brentford", "manchester united f.c. vs brentford
// f.c. standings" share a side), one inside the other's related searches, or the same words.
export function sameStory(a, b) {
  const ka = words(a.term), kb = words(b.term);
  if (!ka.length || !kb.length) return false;
  if (ka.join(" ") === kb.join(" ")) return true;
  const ra = (a.related || []).map(r => words(r).join(" ")), rb = (b.related || []).map(r => words(r).join(" "));
  if (ra.includes(kb.join(" ")) || rb.includes(ka.join(" "))) return true;
  if (isMatch(a.term) && isMatch(b.term)) {
    const [a1, a2] = sides(a.term), [b1, b2] = sides(b.term), sharing = (x, y) => (x || []).some(w => !CLUB.has(w) && hasWord(y || [], w));
    return (sharing(a1, b1) || sharing(a1, b2) || sharing(a2, b1) || sharing(a2, b2));
  }
  // one search's words all inside the other's (a longer spelling), two words at least
  const inside = (x, y) => x.length >= 2 && x.every(w => hasWord(y, w));
  return inside(ka, kb) || inside(kb, ka);
}
// A live page's title is out of date by the time it is read (a score, "LIVE!"), and a how-to-watch page says nothing:
// never used. A stats, line-up or final-score page says only that there was a match: used when nothing better is about it.
const STALE = t => /\bLIVE\b/.test(t) || /\b(live (score|scores|updates?|blog|coverage|stream|streaming|text|commentary)|how to watch|where to watch|ways? to watch|watch live|watch .{0,40} for \*?free|tv channel|predictions?|betting tips|odds)\b/i.test(t);
const THIN = /\b(team stats|match stats|game details|game highlights|confirmed line-?ups|line-?ups|final score|scorecard|preview)\b/i;
export const NOISY = t => STALE(t) || THIN.test(t);
// The first headline about the search: one of its words in the title and a second word of it or of its related
// searches (a one-word search with no related searches: its word is enough); a thin page only when nothing else is
// about it, a live or how-to-watch page never.
export function pickHeadline(t, news, ok = () => true) {
  const own = words(t.term), more = [...new Set((t.related || []).slice(0, 6).flatMap(words))].filter(w => !hasWord(own, w));
  const about = n => {
    const tw = words(n.title); if (!tw.length || !own.some(w => hasWord(tw, w))) return false;
    if (own.length < 2 && !more.length) return true;
    return new Set([...own, ...more].filter(w => hasWord(tw, w))).size >= 2;
  };
  const fit = (news || []).filter(n => n?.title && n.url && ok(n.title) && !STALE(n.title) && about(n));
  return fit.find(n => !THIN.test(n.title)) || fit[0] || null;
}

// The rows of one country: still climbing first by volume, then the rest; one row per story; language kept
export function rankSearches(items, keep = () => true, max = 14) {
  const L = (items || []).filter(t => t?.term && keep(t)).map((t, i) => ({ t, i }))
    .sort((x, y) => (y.t.active - x.t.active) || (y.t.volume - x.t.volume) || (x.i - y.i)).map(x => x.t);
  const out = [];
  for (const t of L) {
    const dup = out.find(o => sameStory(o, t));
    if (dup) { dup.related = [...new Set([...dup.related, t.term, ...t.related])].filter(r => r.toLowerCase() !== dup.term.toLowerCase()).slice(0, 8); continue; }
    out.push({ ...t, related: [...t.related] });
    if (out.length >= max) break;
  }
  return out;
}

// trends24's page: its hourly lists, newest first. [{name, url, count}] for the latest, with hours = how many of the
// lists carry the name
export function parseTrends24(html) {
  const lists = [...String(html || "").matchAll(/<ol class=["']?trend-card__list["']?>([\s\S]*?)<\/ol>/g)].map(m =>
    [...m[1].matchAll(/<a href="([^"]+)"[^>]*class=["']?trend-link["']?[^>]*>([^<]+)<\/a>(?:<span class=["']?tweet-count["']?[^>]*data-count=["']?(\d*)["']?)?/g)]
      .map(x => ({ name: decodeXml(x[2]), url: decodeXml(x[1]), count: x[3] ? Number(x[3]) : null })));
  if (!lists.length || !lists[0].length) return [];
  const seen = new Set();
  return lists[0].filter(t => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20).map(t => ({
    name: t.name, url: `https://x.com/search?q=${encodeURIComponent(t.name)}`, count: t.count,
    hours: lists.filter(l => l.some(x => x.name.toLowerCase() === t.name.toLowerCase())).length,
  }));
}
// getdaytrends' table: the name, and its post count when it has one
export function parseGetDayTrends(html) {
  const seen = new Set();
  return [...String(html || "").matchAll(/<a class="string" href="[^"]*\/trend\/[^"]*">([^<]+)<\/a>(?:<div class="desc"><span[^>]*>([^<]*)<\/span>)?/g)]
    .map(m => ({ name: decodeXml(m[1]), count: volOf(m[2] || "") || null }))
    .filter(t => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20)
    .map(t => ({ name: t.name, url: `https://x.com/search?q=${encodeURIComponent(t.name)}`, count: t.count, hours: null }));
}

const TN = "https://trends.google.com/_/TrendsUi/data/batchexecute";
async function postText(url, body, { timeout = 6000 } = {}) {
  const r = await fetch(url, { method: "POST", signal: AbortSignal.timeout(timeout), body,
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": UA_PAGE } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
async function trendsList(geo, { fetchText, fetchPost }) {
  try {
    const L = parseTrendingPage(await fetchText(`https://trends.google.com/trending?geo=${geo}&hl=en-US`, { timeout: 8000, headers: { "user-agent": UA_PAGE } }));
    if (L.length) return { from: "page", items: L };
  } catch {}
  try {
    const txt = await fetchPost(`${TN}?rpcids=i0OFE&source-path=%2Ftrending&hl=en-US&geo=${geo}`,
      "f.req=" + encodeURIComponent(JSON.stringify([[["i0OFE", JSON.stringify([null, null, geo, 0, "en-US", 24, 1]), null, "generic"]]])));
    const line = txt.split("\n").find(l => l.startsWith('[["wrb.fr"'));
    const p = line && JSON.parse(line)[0]?.[2];
    const L = typeof p === "string" ? (JSON.parse(p)?.[1] || []).map(trendItem).filter(Boolean) : [];
    if (L.length) return { from: "list", items: L };
  } catch {}
  return null;
}
// where to ask Google News for a search's story: Hindi for a Hindi search, else the country's English edition (Spain:
// its own edition first, since its searches are mostly about Spain, then the US edition)
const NEWS_ED = { IN: ["en-IN", "IN", "IN:en"], US: ["en-US", "US", "US:en"], GB: ["en-GB", "GB", "GB:en"] };
const newsEditions = (term, geo) => (hasDevanagari(term) ? [["hi", "IN", "IN:hi"]] : geo === "ES" ? [["es", "ES", "ES:es"], NEWS_ED.US] : [NEWS_ED[geo] || NEWS_ED.US]);

export async function lookSearch(params, { fetchText = getText, fetchPost = postText, now = Date.now(), lookups = 10 } = {}) {
  const cfg = config().trends || {}, inG = cfg.india_geo || "IN", worldG = (cfg.world_geos || ["US"]).filter(g => g !== inG);
  const geos = [inG, ...worldG];
  const keepIn = t => isEnglishOrHindi(t.term) && (!t.langs?.length || t.langs.some(l => l === "en" || l === "hi"));
  const keepWorld = t => isLatin(t.term);
  const headOk = { [inG]: isEnglishOrHindi };
  const [lists, feeds, xIn, xWorld] = await Promise.all([
    Promise.all(geos.map(g => trendsList(g, { fetchText, fetchPost }))),
    Promise.all(geos.map(g => fetchText(`https://trends.google.com/trending/rss?geo=${g}`, { timeout: 6000 }).then(parseTrendsFeed).catch(() => []))),
    xTrends("india", fetchText), xTrends("world", fetchText),
  ]);
  const from = {}, rows = {};
  geos.forEach((g, i) => {
    const L = lists[i]?.items?.length ? lists[i].items : feeds[i];
    if (!L?.length) return;
    from[g] = lists[i]?.items?.length ? lists[i].from : "rss";
    const own = new Map(feeds[i].map(t => [t.term.toLowerCase(), t.news]));
    rows[g] = rankSearches(L, g === inG ? keepIn : keepWorld).map(t => {
      // Google's own news for its RSS ten is trusted without the word check (it attached it to the search itself)
      const ok = headOk[g] || isLatin, n = own.get(t.term.toLowerCase()) || t.news || [];
      return { ...t, news: pickHeadline(t, n, ok) || (own.has(t.term.toLowerCase()) ? n.find(x => ok(x.title) && !NOISY(x.title)) || null : null) };
    });
  });
  // a headline from Google News for the top searches that have none, four at a time
  const need = Object.entries(rows).flatMap(([g, L]) => L.slice(0, lookups).filter(t => !t.news).map(t => [g, t]));
  let cur = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cur < need.length) {
      const [g, t] = need[cur++];
      for (const [hl, gl, ceid] of newsEditions(t.term, g)) {
        try {
          const n = parseNewsSearch(await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${t.term} when:1d`)}&hl=${hl}&gl=${gl}&ceid=${ceid}`, { timeout: 5000 }));
          const h = pickHeadline(t, n.slice(0, 8), headOk[g] || isLatin);
          if (h) { t.news = h; break; }
        } catch {}
      }
    }
  }));
  // a row needs a headline or related searches to explain it
  const shape = t => ({ term: t.term, traffic: t.traffic, volume: t.volume, started: t.started, active: t.active, cat: t.cat, related: t.news ? [] : t.related.slice(0, 3), news: t.news ? { title: t.news.title, url: t.news.url, source: t.news.source || null } : null });
  const geosOut = Object.fromEntries(Object.entries(rows).map(([g, L]) => [g, L.filter(t => t.news || t.related.length).slice(0, 10).map(shape)]));
  // the world: the countries' rows together, one row per story naming each country it trends in
  const world = [];
  for (const g of worldG) for (const t of rows[g] || []) {
    if (!t.news && !t.related.length) continue;
    const had = world.find(w => sameStory(w, t));
    if (had) { if (!had.geos.includes(g)) had.geos.push(g); if (t.volume > had.volume) Object.assign(had, { volume: t.volume, traffic: t.traffic }); if (!had.news && t.news) had.news = t.news; continue; }
    world.push({ ...t, geos: [g] });
  }
  world.sort((a, b) => b.geos.length - a.geos.length || (b.active - a.active) || b.volume - a.volume);
  const x = { india: xIn, world: xWorld };
  if (!Object.keys(geosOut).length && !xIn?.length && !xWorld?.length) return fail("look_search: nothing");
  return ok({ geos: geosOut, world: world.slice(0, 10).map(t => ({ ...shape(t), geos: t.geos })), from, x, at: new Date(now).toISOString() },
    [Object.keys(geosOut).length ? "Google Trends" : null, (xIn?.length || xWorld?.length) ? "trends24" : null].filter(Boolean).join(", "));
}
async function xTrends(region, fetchText) {
  try {
    const L = parseTrends24(await fetchText(`https://trends24.in/${region === "india" ? "india/" : ""}`, { timeout: 6000, headers: { "user-agent": UA_PAGE } }));
    if (L.length) return L;
  } catch {}
  try {
    const L = parseGetDayTrends(await fetchText(`https://getdaytrends.com/${region === "india" ? "india/" : ""}`, { timeout: 6000, headers: { "user-agent": UA_PAGE } }));
    if (L.length) return L;
  } catch {}
  return null;
}

export const LOOK_SKY = { look_sky: lookSky, look_search: lookSearch };
// The hours change once an hour; held 30 minutes at the edge. The searches: 20 minutes, held 40 at the edge.
export const LOOK_SKY_CACHE = { look_sky: [1800, 3600], look_search: [1200, 2400] };
