// node design/wordmark-moments/build.mjs: bakes the mock into one self-contained page, index.html, from the paper's
// own halftone (v2/wordmark.js), today's desk split (content/latest.json, config desks_v2) and src.js.
import { readFileSync, writeFileSync } from "node:fs";
import { storiesFromEdition } from "../../v2/wordmark.js";

const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const E = JSON.parse(read("content/latest.json")), cfg = JSON.parse(read("config/house.json"));
const desks = cfg.desks_v2.desks.filter(d => d.id !== "one");
const pieces = storiesFromEdition(E, desks);
const SHARES = desks.map(d => ({ desk: d.id, words: pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0) })).filter(x => x.words);
const engine = read("v2/wordmark.js").replace(/^export /gm, "");

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Wordmark moments</title>
<style>
@font-face{font-family:"UnifrakturMaguntia";src:url(data:font/woff2;base64,${b64("v2/fonts/unifrakturmaguntia-latin-400-normal.woff2")}) format("woff2");font-weight:400}
@font-face{font-family:"Libre Franklin";src:url(data:font/woff2;base64,${b64("v2/fonts/libre-franklin-latin-wght-normal.woff2")}) format("woff2");font-weight:100 900}
:root{--paper:#f3f1ea;--sheet:#fbfaf6;--ink:#15140f;--ink2:#3a3830;--muted:#625d52;--rule:#d5d0c3;--rule2:#e4e0d5;
 --d-news:#1f3f73;--d-home:#0a72a8;--d-sport:#b8460e;--d-tech:#6a3fb5;--d-money:#9b2f6e;--d-off:#876200;color-scheme:light}
:root[data-theme="dark"],.card[data-theme="dark"]{--paper:#26231e;--sheet:#2d2a24;--ink:#efe8d8;--ink2:#d4ccba;--muted:#aca390;--rule:#4a453c;--rule2:#3a362f;
 --d-news:#a9c2ee;--d-home:#86cff3;--d-sport:#f4a06a;--d-tech:#c0aaf4;--d-money:#f0a3c9;--d-off:#e9c766;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Georgia,"Times New Roman",serif}
header,main{max-width:1240px;margin:0 auto;padding:0 16px}
header{padding-top:28px;padding-bottom:8px;border-bottom:3px double var(--rule)}
h1{margin:0;font:600 34px/1.1 Georgia,serif}
header p{margin:8px 0 0;color:var(--ink2);max-width:70ch}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 6px;font:600 13px "Libre Franklin",sans-serif}
.bar button,.cap button{font:600 13px "Libre Franklin",sans-serif;color:var(--ink);background:none;border:1px solid var(--rule);border-radius:4px;padding:8px 14px;cursor:pointer}
.bar button:hover,.cap button:hover{border-color:var(--ink)}
.bar label{display:flex;gap:6px;align-items:center;color:var(--ink2)}
.legend{font:500 12.5px "Libre Franklin",sans-serif;color:var(--muted)}
section{padding:26px 0 10px;border-bottom:1px solid var(--rule)}
h2{margin:0;font:600 26px/1.15 Georgia,serif}
.dek{margin:4px 0 16px;color:var(--ink2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--paper);color:var(--ink);border:1px solid var(--rule);border-top:2px solid var(--ink);border-radius:4px;overflow:hidden}
.np{display:flex;flex-direction:column;align-items:center;padding:18px 8px 6px;user-select:none;overflow:hidden}
.the{font:400 33px/1 "UnifrakturMaguntia",serif}
.hof{font:600 11px "Libre Franklin",sans-serif;letter-spacing:.55em;padding-left:.55em;margin:4px 0 0;text-transform:uppercase}
.np canvas{display:block;margin:-54px auto -50px}
.line{min-height:18px;margin:2px 0 0;font:600 12px "Libre Franklin",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);opacity:0;transition:opacity .4s}
.line.on{opacity:1}
.cap{padding:10px 14px 14px;border-top:1px solid var(--rule2);display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:start}
.cap h3{margin:0;font:700 14px "Libre Franklin",sans-serif}
.cap p{grid-column:1;margin:0;font:14px/1.4 Georgia,serif;color:var(--ink2)}
.cap button{grid-column:2;grid-row:1/3;align-self:center}
footer{max-width:1240px;margin:0 auto;padding:18px 16px 40px;font:500 12.5px "Libre Franklin",sans-serif;color:var(--muted)}
@media (max-width:420px){.grid{grid-template-columns:1fr}h1{font-size:28px}}
</style></head>
<body>
<header><h1>Wordmark moments</h1>
<p>Three ideas for the 1400 on Page One, each in a few variants, then all three together. Every figure here is the paper's own halftone with today's real split of the paper by desk (${SHARES.map(x => x.desk).join(", ")}). The press and the moments repeat every few seconds so you can watch them; on the page each would play once.</p>
<div class="bar"><button type="button" id="replay">Replay all</button><button type="button" id="theme">Night</button><label><input type="checkbox" id="withline" checked> Show the line under a big moment</label></div>
<p class="legend">Mock only, nothing here is on the site. Jump to: <a href="#press">press</a> · <a href="#weather">weather</a> · <a href="#moments">moments</a> · <a href="#together">together</a></p></header>
<main id="cards"></main>
<footer>The House of 1400 · design/wordmark-moments · ${E.date}</footer>
<script>
const SHARES = ${JSON.stringify(SHARES)};
${engine}
${readFileSync(here + "src.js", "utf8")}
</script>
</body></html>
`;
writeFileSync(here + "index.html", page);
console.log(`index.html: ${(page.length / 1024).toFixed(0)} KB, shares ${JSON.stringify(SHARES)}`);
