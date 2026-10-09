// node design/fixtures-v3/build.mjs: the Fixture List, three ways (mock, 10 Oct 2026). One self-contained page with
// the paper's fonts; laptop or phone width, day or night page.
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const b64 = f => readFileSync(H + f).toString("base64");
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const sec = (id, name, note, cls = "") => `<section id="${id}"><h2>${name}</h2><p class="note">${note}</p><div class="frame lst ${cls}"><div class="sechd"><b>The Fixture List</b><i>Next 7 days · IST</i></div><div class="agenda"></div></div></section>`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Fixture List, round three</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${font("Source Serif 4", "source-serif-4-latin-opsz-normal.woff2", "200 900")}
${font("Titillium Web", "titillium-web-latin-600-normal.woff2", "600")}
${font("Titillium Web", "titillium-web-latin-700-normal.woff2", "700")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The Fixture List, round three</h1>
<p class="lede">The list as it stood at 00:32 on 10 Oct, every field kept (time, sport, round and place, where to watch, the market and its source, the result), set as way 1 with better visuals, three ways. The F1 gaps are OpenF1's timing.</p>
<div class="controls"><button type="button" id="phone">Phone width</button><button type="button" id="theme">Night page</button></div></header>
<main>
${sec("R1", "3a · One colour", "Way 1 with better visuals: each result drawn the way its sport prints one (F1's top three with team colours, codes and gaps; a cricket scorecard with the winner marked; a tennis set board), each market as one bar with the two sides at its ends and a draw in the middle, the next fixture counted down, and the channel as a small tag. The desk's one colour throughout, as the site does now.")}
${sec("R2", "3b · Sport colours, big dates", "3a with each sport in its own colour (cricket blue, football green, F1 red, tennis olive, basketball orange) and a big date numeral opening each day.", "sport")}
${sec("R3", "3c · Sport colours, today up front", "3b with today on a lighter panel, so the eye lands on what is still to come today.", "sport focus")}
</main>
<script>${readFileSync(here + "data.js", "utf8")}
${readFileSync(here + "src.js", "utf8")}</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
