// The trial's sky feeds (lib/look-sky.js): the Sky Report's parts of the day from Open-Meteo's hours, MET Norway as
// backup; The Search Bar's searches (Google's trending page, its RSS, Google News) and X's list (trends24, getdaytrends).
// Fixtures: Open-Meteo for Bengaluru, Ranchi and Prayagraj and MET Norway for Bengaluru, as they answered on 27 Nov 2026;
// India's trending page (cut to 60 searches), its RSS, a Google News search, trends24 and getdaytrends on 28 Nov 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupParts, partOf, partCode, parseOpenMeteo, parseMetnoHours, metCode, lookSky, istHour, LOOK_SKY, LOOK_SKY_CACHE,
  parseTrendingPage, parseTrendsFeed, parseNewsSearch, parseTrends24, parseGetDayTrends, trendItem, rankSearches, sameStory, pickHeadline,
  words, isLatin, isEnglishOrHindi, NOISY, lookSearch } from "../lib/look-sky.js";

const OM = JSON.parse(readFileSync(new URL("./fixtures/look-sky-om.json", import.meta.url)));
const MET = JSON.parse(readFileSync(new URL("./fixtures/look-sky-met.json", import.meta.url)));
const NOW = Date.parse("2026-11-27T00:45:00Z"); // 06:15 IST
const CITIES = [{ name: "Bengaluru" }, { name: "Ranchi" }, { name: "Prayagraj" }];
const hours = (fromLocal, n, f = () => ({})) => Array.from({ length: n }, (_, i) => ({ time: istHour(Date.parse(fromLocal + ":00+05:30") + i * 36e5), temp: 20 + (i % 5), rain_prob: 10, code: 3, ...f(i) }));

test("the parts of the day, in IST", () => {
  assert.deepEqual([0, 5, 6, 11, 12, 16, 17, 20, 21, 23].map(h => partOf(h).key), ["tonight", "tonight", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "tonight", "tonight"]);
});

test("Open-Meteo's hours grouped from the part under way", () => {
  const [blr, rnc, pyj] = parseOpenMeteo(OM, CITIES, NOW);
  assert.equal(blr.name, "Bengaluru");
  assert.deepEqual(blr.parts.map(p => p.key), ["morning", "afternoon", "evening", "tonight", "morning"]);
  const [m, a, e, t] = blr.parts;
  assert.deepEqual([m.rain, m.tmin, m.tmax, m.hours], [8, 20, 27, 6]);
  assert.deepEqual([a.rain, a.tmin, a.tmax, a.hours], [87, 26, 29, 5]);
  assert.equal(e.rain, 84);
  // a wet afternoon is drawn wet, not as a cloud
  assert.ok(a.code >= 51);
  // tonight runs from 21:00 to 06:00 the next day
  assert.equal(t.start, "2026-11-27T21:00:00+05:30");
  assert.equal(t.end, "2026-11-28T06:00:00+05:30");
  assert.equal(t.hours, 9);
  assert.equal(rnc.parts[0].rain, 0);
  assert.equal(pyj.name, "Prayagraj");
});

test("the part under way starts at this hour", () => {
  const P = groupParts(hours("2026-11-27T00:00", 48), Date.parse("2026-11-27T13:20:00+05:30"));
  assert.equal(P[0].key, "afternoon");
  assert.equal(P[0].partial, true);
  assert.equal(P[0].first, "2026-11-27T13:00:00+05:30");
  assert.equal(P[0].hours, 4);
  assert.deepEqual(P.map(p => p.key), ["afternoon", "evening", "tonight", "morning", "afternoon"]);
});

test("after midnight, tonight is the night that began the evening before", () => {
  const P = groupParts(hours("2026-11-27T00:00", 48), Date.parse("2026-11-28T02:30:00+05:30"));
  assert.equal(P[0].key, "tonight");
  assert.equal(P[0].start, "2026-11-27T21:00:00+05:30");
  assert.equal(P[0].end, "2026-11-28T06:00:00+05:30");
  assert.equal(P[0].hours, 4);
});

test("bad temperatures and missing chances", () => {
  const P = groupParts(hours("2026-11-27T06:00", 30, i => (i === 1 ? { temp: 999 } : i < 6 ? { rain_prob: null } : {})), Date.parse("2026-11-27T06:10:00+05:30"));
  assert.equal(P[0].hours, 5);
  assert.equal(P[0].rain, null);
  assert.ok(P[0].tmax < 60);
});

test("the sky of a part", () => {
  assert.equal(partCode([{ code: 3 }, { code: 3 }, { code: 61 }], 20), 3);
  assert.equal(partCode([{ code: 3 }, { code: 3 }, { code: 61 }], 70), 61);
  assert.equal(partCode([{ code: 61 }, { code: 95 }], 80), 95);
  assert.equal(partCode([{ code: null }], 0), null);
});

test("MET Norway's hours: no chance of rain, millimetres instead", () => {
  const H = parseMetnoHours(MET);
  assert.ok(H.length >= 30);
  assert.ok(H.every(h => h.rain_prob === null && /^\d{4}-\d\d-\d\dT\d\d:00$/.test(h.time)));
  assert.equal(metCode("lightrainshowers_day"), 80);
  assert.equal(metCode("heavyrainandthunder"), 95);
  assert.equal(metCode("partlycloudy_night"), 2);
  const P = groupParts(H, NOW);
  assert.equal(P[0].rain, null);
  assert.ok(P[0].rain_mm != null);
});

test("lookSky: Open-Meteo first, MET Norway for a city it misses, nothing when both fail", async () => {
  const r = await lookSky(null, { now: NOW, fetchJSON: async () => OM });
  assert.equal(r.ok, true);
  assert.equal(r.source, "Open-Meteo");
  assert.deepEqual(r.value.cities.map(c => c.name), ["Bengaluru", "Ranchi", "Prayagraj"]);
  const b = await lookSky(null, { now: NOW, fetchJSON: async u => { if (u.includes("open-meteo")) throw new Error("down"); return MET; } });
  assert.equal(b.source, "MET Norway");
  assert.equal(b.value.cities[0].parts[0].rain, null);
  const f = await lookSky(null, { now: NOW, fetchJSON: async () => { throw new Error("down"); } });
  assert.equal(f.ok, false);
  assert.equal(typeof LOOK_SKY.look_sky, "function");
  assert.deepEqual(LOOK_SKY_CACHE.look_sky, [1800, 3600]);
});

// ---------- (8) The Search Bar ----------
const fx = f => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const PAGE = fx("look-search-page-IN.html"), RSS = fx("look-search-rss-IN.xml"), GNEWS = fx("look-search-gnews.xml"), T24 = fx("look-search-t24.html"), GDT = fx("look-search-gdt.html");

test("the trending page's own list: volume, start, ended or not, related searches, category, news languages", () => {
  const L = parseTrendingPage(PAGE);
  assert.equal(L.length, 60);
  assert.deepEqual([L[0].term, L[0].volume, L[0].traffic, L[0].active, L[0].cat, L[0].langs], ["man utd vs brentford", 200000, "200K+", true, "Sport", ["en"]]);
  assert.equal(L[0].started, "2026-11-28T14:00:00.000Z");
  assert.ok(!L[0].related.includes("man utd vs brentford") && L[0].related.includes("manchester united"));
  assert.ok(L.some(t => !t.active));
  assert.ok(L.some(t => t.langs.includes("ta")));
  assert.deepEqual(parseTrendingPage("<html>no list</html>"), []);
  assert.equal(trendItem(["", 1]), null);
});

test("Google's RSS: ten searches with Google's own news", () => {
  const R = parseTrendsFeed(RSS);
  assert.equal(R.length, 10);
  const c = R.find(t => t.term === "indian cricket");
  assert.equal(c.volume, 50000);
  assert.ok(c.news.length && c.news.every(n => /^https?:/.test(n.url) && n.title && n.source));
});

test("Google News search: the outlet comes off the title", () => {
  const N = parseNewsSearch(GNEWS);
  assert.equal(N.length, 6);
  assert.deepEqual([N[1].title, N[1].source], ["Match report: United 0 Brentford 4", "Manchester United"]);
});

test("a headline only when it is about the search, never a live page", () => {
  const t = { term: "man utd vs brentford", related: ["man utd", "man united", "manchester united", "brentford fc"] };
  // the first result is a live-score page; the match report is the first about it
  assert.equal(pickHeadline(t, parseNewsSearch(GNEWS)).title, "Match report: United 0 Brentford 4");
  assert.equal(pickHeadline({ term: "granada", related: ["granada terremoto", "terremoto hoy"] }, [{ title: "Thieves steal equipment at Granada Hills job", url: "https://x.y/1" }]), null);
  assert.equal(pickHeadline({ term: "granada", related: ["granada terremoto"] }, [{ title: "Un terremoto en un pueblo de Granada", url: "https://x.y/2" }]).url, "https://x.y/2");
  // a thin stats page only when nothing better is about it
  const thin = { title: "Nottm Forest vs. Chelsea (28 Nov) Team Stats", url: "https://x.y/3" }, good = { title: "Gibbs-White fires Nottingham Forest past Chelsea", url: "https://x.y/4" };
  assert.equal(pickHeadline({ term: "nottm forest vs chelsea", related: ["nottingham forest"] }, [thin, good]).url, "https://x.y/4");
  assert.equal(pickHeadline({ term: "nottm forest vs chelsea", related: [] }, [thin]).url, "https://x.y/3");
  assert.ok(NOISY("Wales vs Japan LIVE: build-up") && NOISY("There's a simple way to watch England vs New Zealand for *FREE*") && !NOISY("Live Nation shares fall"));
  // a headline in the wrong language is not taken
  assert.equal(pickHeadline({ term: "पेंशन", related: [] }, [{ title: "பென்ஷன் பற்றி", url: "https://x.y/5" }], isEnglishOrHindi), null);
});

test("one row per story, climbing searches first, India in English or Hindi", () => {
  assert.ok(sameStory({ term: "man utd vs brentford", related: [] }, { term: "manchester united f.c. vs brentford f.c. standings", related: [] }));
  assert.ok(sameStory({ term: "al-hazem vs al-nassr", related: [] }, { term: "al-hazem f.c. vs al-nassr standings", related: [] }));
  assert.ok(sameStory({ term: "man city vs leeds", related: [] }, { term: "manchester city f.c. vs leeds united f.c. lineups", related: [] })); // a side in common: one match
  assert.ok(!sameStory({ term: "leeds united vs coventry", related: [] }, { term: "west ham united vs stoke", related: [] }));
  assert.ok(!sameStory({ term: "indigo", related: [] }, { term: "indian cricket", related: [] }));
  const keep = t => isEnglishOrHindi(t.term) && (!t.langs.length || t.langs.some(l => l === "en" || l === "hi"));
  const R = rankSearches(parseTrendingPage(PAGE), keep);
  assert.equal(R[0].term, "man utd vs brentford");
  assert.ok(R[0].related.includes("manchester united f.c. vs brentford f.c. standings"));
  assert.ok(!R.some(t => /standings/.test(t.term) && /brentford|al-nassr/.test(t.term)));
  assert.ok(R.every(t => isEnglishOrHindi(t.term)));
  const firstEnded = R.findIndex(t => !t.active);
  assert.ok(firstEnded === -1 || R.slice(firstEnded).every(t => !t.active));
  for (let i = 1; i < R.length; i++) if (R[i].active === R[i - 1].active) assert.ok(R[i].volume <= R[i - 1].volume);
  assert.ok(isLatin("elche vs atlético") && !isLatin("पेंशन") && isEnglishOrHindi("पेंशन") && !isEnglishOrHindi("அரசியல்"));
  assert.deepEqual(words("Manchester United F.C. vs Brentford F.C. standings 2026"), ["manchester", "united", "brentford"]);
});

test("X's list: the latest hour, its posts, hours on the list; getdaytrends as backup", () => {
  const X = parseTrends24(T24);
  assert.equal(X.length, 20);
  assert.deepEqual([X[0].name, X[0].count, X[0].url], ["QAZI SHINING WITH DIGNITY", 22238, "https://x.com/search?q=QAZI%20SHINING%20WITH%20DIGNITY"]);
  assert.ok(X.every(x => x.hours >= 1 && x.hours <= 6));
  assert.equal(new Set(X.map(x => x.name.toLowerCase())).size, X.length);
  const G = parseGetDayTrends(GDT);
  assert.equal(G.length, 12);
  assert.deepEqual([G[0].name, G[0].count, G[0].hours], ["QAZI SHINING WITH DIGNITY", 32000, null]);
  assert.deepEqual(parseTrends24("<html></html>"), []);
});

test("lookSearch: the page's list, headlines for the rest, the world in one list, X beside", async () => {
  const fetchText = async u => {
    if (u.includes("trends.google.com/trending?geo=IN")) return PAGE;
    if (u.includes("trends.google.com/trending?geo=")) throw new Error("blocked");
    if (u.includes("/trending/rss?geo=IN")) return RSS;
    if (u.includes("/trending/rss")) return RSS.replace(/indian cricket/g, "england vs new zealand");
    if (u.includes("news.google.com")) return GNEWS;
    if (u.includes("trends24.in/india")) return T24;
    if (u.includes("trends24")) throw new Error("down");
    if (u.includes("getdaytrends")) return GDT;
    throw new Error("unexpected " + u);
  };
  const fetchPost = async () => ')]}\'\n\n[["wrb.fr","i0OFE",null,null,null,[7],"generic"]]'; // turned away, as from Vercel
  const r = await lookSearch(null, { fetchText, fetchPost, now: Date.parse("2026-11-28T18:30:00Z") });
  assert.equal(r.ok, true);
  assert.equal(r.value.from.IN, "page");
  assert.equal(r.value.from.US, "rss");
  const IN = r.value.geos.IN;
  assert.ok(IN.length >= 5 && IN.length <= 10);
  assert.equal(IN[0].term, "man utd vs brentford");
  assert.equal(IN[0].news.title, "Match report: United 0 Brentford 4");
  // a row either has a headline (and no related searches) or its related searches
  assert.ok(IN.every(t => (t.news && !t.related.length) || (!t.news && t.related.length)));
  // Google's own news for its RSS ten
  assert.equal(IN.find(t => t.term === "indian cricket")?.news?.source, "Cricbuzz");
  // the world: the countries' rows, one row per story, naming each country
  const eng = r.value.world.find(t => t.term === "england vs new zealand");
  assert.deepEqual(eng?.geos, ["US", "GB", "ES"]);
  assert.equal(r.value.world[0].geos.length, 3);
  assert.equal(r.value.x.india[0].name, "QAZI SHINING WITH DIGNITY");
  assert.equal(r.value.x.world[0].hours, null); // from getdaytrends
  assert.equal(r.source, "Google Trends, trends24");
  const none = await lookSearch(null, { fetchText: async () => { throw new Error("down"); }, fetchPost });
  assert.equal(none.ok, false);
  assert.equal(typeof LOOK_SKY.look_search, "function");
  assert.deepEqual(LOOK_SKY_CACHE.look_search, [1200, 2400]);
});
