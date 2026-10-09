// node design/fixtures-v3/build.mjs: the Fixture List, three ways (mock, 10 Oct 2026). One self-contained page with
// the paper's fonts; laptop or phone width, day or night page.
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const b64 = f => readFileSync(H + f).toString("base64");
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const sec = (id, name, note, cls = "") => `<section id="${id}"><h2>${name}</h2><p class="note">${note}</p><div class="frame lst ${cls}"><div class="sechd"><b>The Fixture List</b><i>Next 7 days · IST</i></div><div class="agenda"></div></div></section>`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Fixture List, round two</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${font("Source Serif 4", "source-serif-4-latin-opsz-normal.woff2", "200 900")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The Fixture List, round two</h1>
<p class="lede">The list as it stood at 00:32 on 10 Oct, every field kept (time, sport, round and place, where to watch, the market and its source, the result), set as way 1 and three variations on it.</p>
<div class="controls"><button type="button" id="phone">Phone width</button><button type="button" id="theme">Night page</button></div></header>
<main>
${sec("A", "1 · Listings, tidied (as shown before)", "For comparison: the desk's one colour, each fixture in three steps (sport, the fixture, round and place and channel), the market as a thin bar with the names under it, a Final tag on a finished fixture.")}
${sec("A1", "1a · Quieter", "Way 1 with the bars taken out: the market is one line of names and prices, the favourite in the desk's colour, the source after it. Each fixture is shorter and the columns read more like a printed listings page.", "")}
${sec("A2", "1b · Sport colours, big dates", "Way 1 with two touches of fun: each day opens with a big date numeral, and each sport keeps its own colour on its label and its bar (cricket blue, football green, F1 red, tennis olive, basketball orange). Everything else as 1.", "sport")}
${sec("A3", "1c · Today up front", "Way 1a with today set apart on a lighter panel with a NOW line at the time of reading. A finished fixture shrinks to its time, name and result on one line, so what is still to come gets the room.", "focus")}
</main>
<script>${readFileSync(here + "data.js", "utf8")}
${readFileSync(here + "src.js", "utf8")}</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
