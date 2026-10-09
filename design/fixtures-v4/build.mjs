// node design/fixtures-v4/build.mjs: the Fixture List from scratch, three ways (mock, 10 Oct 2026). One page with the
// paper's fonts and Barlow Condensed for the figures; crests, flags and drivers' photos load from ESPN and F1 as they
// would on the site. Laptop or phone width, day or night page.
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const b64 = f => readFileSync(f).toString("base64"), v2f = f => H + "v2/fonts/" + f, own = f => here + "fonts/" + f;
const font = (fam, file, w) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64(file)}) format("woff2");font-weight:${w}}`;
const way = (id, name, note) => `<section id="${id}"><h2>${name}</h2><p class="note">${note}</p><div class="frame"><div class="sechd"><b>The Fixture List</b><i>Next 7 days · IST</i></div><div class="out"></div>
  <p class="exh">Other states <span>(made-up rows, to show a live match, one called off and one with no time yet)</span></p><div class="ex"></div></div></section>`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Fixture List, from scratch</title><style>
${font("Newsreader", v2f("newsreader-latin-opsz-normal.woff2"), "200 800")}
${font("Libre Franklin", v2f("libre-franklin-latin-wght-normal.woff2"), "100 900")}
${font("Source Serif 4", v2f("source-serif-4-latin-opsz-normal.woff2"), "200 900")}
${font("Titillium Web", v2f("titillium-web-latin-700-normal.woff2"), "700")}
${["500", "600", "700"].map(w => font("Barlow Condensed", own(`barlow-condensed-latin-${w}-normal.woff2`), w)).join("\n")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The Fixture List, from scratch</h1>
<p class="lede">Three ways, each from a different idea, with today's list as it stood at 00:32 on Saturday 10 Oct. Every field is kept. Crests, flags and drivers' photos are the real ones; times, scores and prices are in one scoreboard face throughout.</p>
<div class="controls"><button type="button" id="phone">Phone width</button><button type="button" id="theme">Night page</button></div></header>
<main>
${way("W1", "1 · Broadsheet", "A quality paper's listings page, led by type. The time in scoreboard figures; the fixture in the paper's serif with its crests or flags; one typeset line under it for the market or the result (F1 drivers with their photos and team colours). The desk's one colour; the crests bring the rest.")}
${way("W2", "2 · Scoreboard", "Each match as two sides facing each other, crest over name, the time or the score large between them, the market as one bar under the pair with each side's price at its end. An F1 session shows its three drivers as photos in team-colour rings. Each sport in its own colour.")}
${way("W3", "3 · Front page", "Ranked by what matters now: what finished overnight as scoreboard tiles (F1 as a small podium), the next fixture as the lead with its market, then the rest of the week as one clean table, a day to a band.")}
</main>
<script>${["data.js", "shared.js", "v1.js", "v2.js", "v3.js"].map(f => readFileSync(here + f, "utf8")).join("\n")}
document.querySelector("#W1 .out").innerHTML = v1(FIX); document.querySelector("#W1 .ex").innerHTML = v1(EXAMPLES);
document.querySelector("#W2 .out").innerHTML = v2(FIX); document.querySelector("#W2 .ex").innerHTML = v2(EXAMPLES);
document.querySelector("#W3 .out").innerHTML = v3(FIX); document.querySelector("#W3 .ex").innerHTML = v3Examples(EXAMPLES);
document.getElementById("phone").onclick = e => { const on = document.body.classList.toggle("phone"); e.target.textContent = on ? "Laptop width" : "Phone width"; };
document.getElementById("theme").onclick = e => { const r = document.documentElement, dark = r.dataset.theme !== "dark"; r.dataset.theme = dark ? "dark" : "light"; e.target.textContent = dark ? "Day page" : "Night page"; };
</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
