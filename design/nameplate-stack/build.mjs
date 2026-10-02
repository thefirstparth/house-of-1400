// node design/nameplate-stack/build.mjs: "The / HOUSE OF" on two lines beside the live figure (mock, 3 Oct 2026; Parth:
// "we have not been able to align ... with the moving text. How about the house in two lines and the animated text on
// the right? Think well so that we don't have to make this change every time"). Bakes index.html (self-contained).
import { readFileSync, writeFileSync } from "node:fs";
import { storiesFromEdition } from "../../v2/wordmark.js";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const E = JSON.parse(read("content/latest.json")), cfg = JSON.parse(read("config/house.json"));
const desks = cfg.desks_v2.desks.filter(d => d.id !== "one"), pieces = storiesFromEdition(E, desks);
const SHARES = desks.map(d => ({ desk: d.id, words: pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0) })).filter(x => x.words);
const css = readFileSync(H + "design/nameplate-oneline/build.mjs", "utf8").match(/<style>\n([\s\S]*?)<\/style>/)[1].replace(/\$\{[^}]*\}/g, "");
const font = (fam, file, w = "100 900") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w}}`;
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>The nameplate on two lines</title>
<style>
${font("UnifrakturMaguntia", "unifrakturmaguntia-latin-400-normal.woff2", "400")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${css.replace(/@font-face\{[^}]*\}/g, "")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>The nameplate on two lines</h1>
<p>"The" over "HOUSE OF", fixed, with the live figure to the right. Each way is the real header at a laptop's width and on a phone, with today's dots. The two lines are set to the box of 1400 itself (the top of its figures and its baseline), and every shape a tap brings starts where 1400 starts, on that baseline, inside that box: so nothing about the words depends on which shape is showing, and the words never move. Press "Show every shape" (or tap a figure) to watch.</p>
<div class="bar"><button id="cycle" type="button">Show every shape</button> <button id="theme" type="button">Night</button></div></header>
<main id="variants"></main>
<script>
const SHARES = ${JSON.stringify(SHARES)};
const GLYPHS = ${read("v2/glyphs.json").trim()};
${read("v2/wordmark.js").replace(/^export /gm, "")}
${readFileSync(here + "src.js", "utf8")}
function fitFrames() { document.querySelectorAll(".laptop").forEach(l => { const f = l.querySelector(".frame"), z = Math.min(1, l.clientWidth / 1440); f.style.zoom = z; }); }
addEventListener("resize", fitFrames); new MutationObserver(fitFrames).observe(document.getElementById("variants"), { childList: true });
</script></body></html>
`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
