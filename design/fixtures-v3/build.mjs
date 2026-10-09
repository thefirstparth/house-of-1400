// node design/fixtures-v3/build.mjs: the Fixture List, three ways (mock, 10 Oct 2026). One self-contained page with
// the paper's fonts; laptop or phone width, day or night page.
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const b64 = f => readFileSync(H + f).toString("base64");
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const sec = (id, name, note) => `<section id="${id}"><h2>${name}</h2><p class="note">${note}</p><div class="frame"><div class="sechd"><b>The Fixture List</b><i>Next 7 days · IST</i></div><div class="agenda"></div></div></section>`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Fixture List, three ways</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${font("Source Serif 4", "source-serif-4-latin-opsz-normal.woff2", "200 900")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The Fixture List, three ways</h1>
<p class="lede">The list as it stood at 00:32 on 10 Oct, every field kept (time, sport, round and place, where to watch, the market and its source, the result), set three ways: cleaner, easier to read, a little more fun.</p>
<div class="controls"><button type="button" id="phone">Phone width</button><button type="button" id="theme">Night page</button></div></header>
<main>
${sec("A", "1 · Listings, tidied", "Today's columns and the desk's one colour, with each fixture in three steps: what it is, where (and on what), then the number. Prices become one thin bar with the favourite in colour; the source sits under it. A finished fixture greys out and its result reads first.")}
${sec("B", "2 · Ticket stubs", "Each fixture a stub torn from a programme: the time and sport on the stub in the sport's own colour, the fixture on the ticket, the favourite as a filled pill, and a FINAL stamp once it is over.")}
${sec("C", "3 · The day's line", "Each day a rail with its fixtures as stops: a big date, a dot in the sport's colour (filled with a tick once it is over), a NOW marker on today's line, and the market as a bar.")}
</main>
<script>${readFileSync(here + "data.js", "utf8")}
${readFileSync(here + "src.js", "utf8")}</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
