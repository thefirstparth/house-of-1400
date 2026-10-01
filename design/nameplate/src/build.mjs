// node design/nameplate/src/build.mjs: bake the nameplate samples into one self-contained file (nameplate-samples.html)
// from the edition of content/latest.json, with the fonts embedded from the Fontsource packages that
// design/desks/src/make.mjs caches in /tmp/h1400-fonts (run that first).
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../../", import.meta.url).pathname, FC = "/tmp/h1400-fonts/";
const E = JSON.parse(readFileSync(H + "content/latest.json", "utf8"));
const b64 = f => readFileSync(FC + f).toString("base64");
const face = (fam, f, w = "100 900", st = "normal") => `@font-face{font-family:"${fam}";font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(f)}) format("woff2")}`;
const fonts = [
  face("Playfair Display", "playfair-display/files/playfair-display-latin-wght-normal.woff2", "400 900"),
  face("UnifrakturMaguntia", "unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2", "400"),
  face("Libre Franklin", "libre-franklin/files/libre-franklin-latin-wght-normal.woff2"),
  face("Newsreader", "newsreader/files/newsreader-latin-opsz-normal.woff2", "200 800"),
  face("Source Serif 4", "source-serif-4/files/source-serif-4-latin-opsz-normal.woff2", "200 900"),
].join("\n");
// the desks as agreed on 1 Oct, for each section of today's paper
const DESK = { dateline: "news", talk: "news", betting: "news", namma: "home", sky: "home", fixtures: "sport", madrid: "sport", paddock: "sport", crease: "sport", deuce: "sport", pitch: "sport", sidelines: "sport", workshop: "tech", pipeline: "tech", ledger: "money", screen: "off", bye: "off" };
const NAME = { news: "News", home: "Close to Home", sport: "Sport", tech: "Tech & AI", money: "Money", off: "Off Duty" };
const ORDER = ["news", "home", "sport", "tech", "money", "off"];
const F = E.front;
const all = [F.lead, ...F.seconds, ...F.briefs, ...Object.values(E.sections || {}).flatMap(s => [...(s.stories || []), ...(s.briefs || [])])];
const seen = new Set();
const items = all.filter(x => x && DESK[x.section] && !seen.has(x.id) && seen.add(x.id))
  .map(x => ({ headline: x.headline, desk: DESK[x.section], deskName: NAME[DESK[x.section]] }))
  .sort((a, b) => ORDER.indexOf(a.desk) - ORDER.indexOf(b.desk));
const ist = t => new Date(Date.parse(t) + 5.5 * 36e5).toISOString().slice(11, 16);
const w = E.snapshot?.weather?.value?.cities?.[0]?.current;
const SKY = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 80: "showers", 81: "showers", 82: "heavy showers", 95: "thunderstorms" };
const day = new Date(E.date + "T12:00:00Z");
const data = {
  date_long: day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  date_short: day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "").replace("Sept", "Sep"),
  no: E.edition_no, printed: ist(E.printed_at), temp: Math.round(w?.temp ?? 0), sky: SKY[w?.code] || "now",
  lead: F.lead.headline, glance: (E.glance || []).map(g => ({ tag: g.section, line: g.line })), items,
};
const esc = s => JSON.stringify(s).replace(/</g, "\\u003c");
let html = readFileSync(H + "design/nameplate/src/samples.src.html", "utf8")
  .replace("__FONTS__", () => fonts).replace("__DATA__", () => esc(data))
  .replace("__PLAYFAIR__", () => b64("playfair-display/files/playfair-display-latin-wght-normal.woff2"));
writeFileSync(H + "design/nameplate/nameplate-samples.html", html);
console.log("nameplate-samples.html", Math.round(html.length / 1024) + " KB", items.length, "stories", data.printed, data.temp + "°", data.sky);
