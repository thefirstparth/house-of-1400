// node design/weather-v3/build.mjs: the Weather block between the slim line and the ribbon (mock, 3 Oct 2026). One
// self-contained page: each way in the real block at four moments, laptop or phone width, day or night page.
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const E = JSON.parse(read("content/editions/2026-10-02.json")), C = JSON.parse(read("config/house.json"));
const W = E.snapshot.weather.value.cities, c = W[0], home = C.weather.always[0];
const DATA = { date: E.date, lat: home.lat, lon: home.lon, city: c.name, temp: Math.round(c.current.temp), feels: Math.round(c.current.feels), hi: Math.round(c.daily[0].max), lo: Math.round(c.daily[0].min),
  sky: "October looks a little drier and cooler than usual", rain: c.daily[0].rain_prob, air: c.air?.now, humidity: c.current.humidity,
  others: W.slice(1).map(x => ({ name: x.name, temp: Math.round(x.current.temp), sky: x.current.code === 0 ? "clear" : "mostly clear" })) };
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Weather, the middle ground</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${readFileSync(H + "design/sunline/style.css", "utf8")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>Weather, the middle ground</h1>
<p class="lede">Four ways between the slim line you liked and today's ribbon, each in the whole Weather block as Page One sets it (now naming Bengaluru), at four moments of the day. The ribbon and the old line come first for comparison. The sun and the moon are worked out for Bengaluru; the moon is drawn only while it is up.</p>
<div class="controls"><button type="button" id="phone">Phone width</button><button type="button" id="theme">Night page</button></div></header>
<main id="grid"></main>
<script>const DATA = ${JSON.stringify(DATA)};
(() => {
${readFileSync(here + "astro.js", "utf8")}
${readFileSync(here + "src.js", "utf8")}
})();</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
