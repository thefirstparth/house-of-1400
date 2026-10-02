// node design/sunline/build.mjs: three ways to draw the day in the Weather block (mock, 2 Oct 2026; Parth: "I liked the
// earlier full arc, but space is limited, so make it more beautiful and attention-grabbing"). One self-contained page:
// each variant inside the real Weather block, at any hour of the day (a scrubber), day and night, light and dark.
// The sun and the moon are computed for Bengaluru, as the page would; the readings are the 2 Oct paper's. Not production.
import { readFileSync, writeFileSync } from "node:fs";

const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const E = JSON.parse(read("content/editions/2026-10-02.json")), C = JSON.parse(read("config/house.json"));
const W = E.snapshot.weather.value.cities, c = W[0], home = C.weather.always[0];
const DATA = {
  date: E.date, lat: home.lat, lon: home.lon, city: c.name,
  temp: Math.round(c.current.temp), feels: Math.round(c.current.feels), hi: Math.round(c.daily[0].max), lo: Math.round(c.daily[0].min),
  sky: "Mostly clear", rain: c.daily[0].rain_prob, air: c.air?.now, humidity: c.current.humidity,
  others: W.slice(1).map(x => ({ name: x.name, temp: Math.round(x.current.temp), sky: x.current.code === 0 ? "clear" : "mostly clear" })),
};
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>The day line, three ways</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The day line, three ways</h1>
<p class="lede">Three ways to draw the day in the Weather block, each in the block as it stands on Page One (the same width on a laptop and a phone). The sun and the moon are worked out for Bengaluru as the page would; drag the hour, or press Play to run through a day and a night.</p>
<div class="controls"><label class="scrub"><span>Hour</span><input id="hour" type="range" min="0" max="1439" step="1"><b id="clock" class="tnum">14:15</b></label><button type="button" id="play">Play a day</button><button type="button" id="theme">Night page</button></div></header>
<main>
<section class="live"><div class="trio" id="live"></div></section>
<section><h2>At five moments of the day</h2><p class="dek">Dawn, morning, the paper's hour, the golden hour and night, side by side for each.</p><div id="moments"></div></section>
</main>
<script>const DATA = ${JSON.stringify(DATA)};
(() => {
${readFileSync(here + "src.js", "utf8")}
})();</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
