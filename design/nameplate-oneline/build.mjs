// node design/nameplate-oneline/build.mjs: bakes the one-line nameplate mock into index.html (self-contained).
import { readFileSync, writeFileSync } from "node:fs";
import { storiesFromEdition } from "../../v2/wordmark.js";

const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const E = JSON.parse(read("content/latest.json")), cfg = JSON.parse(read("config/house.json"));
const desks = cfg.desks_v2.desks.filter(d => d.id !== "one"), pieces = storiesFromEdition(E, desks);
const SHARES = desks.map(d => ({ desk: d.id, words: pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0) })).filter(x => x.words);

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Nameplate on one line</title>
<style>
@font-face{font-family:"UnifrakturMaguntia";src:url(data:font/woff2;base64,${b64("v2/fonts/unifrakturmaguntia-latin-400-normal.woff2")}) format("woff2");font-weight:400}
@font-face{font-family:"Libre Franklin";src:url(data:font/woff2;base64,${b64("v2/fonts/libre-franklin-latin-wght-normal.woff2")}) format("woff2");font-weight:100 900}
:root{--paper:#f3f1ea;--sheet:#fbfaf6;--ink:#15140f;--ink2:#3a3830;--muted:#625d52;--rule:#d5d0c3;--rule2:#e4e0d5;--bad:#c0261d;
 --d-one:#15140f;--d-news:#1f3f73;--d-home:#0a72a8;--d-sport:#b8460e;--d-tech:#6a3fb5;--d-money:#9b2f6e;--d-off:#876200;color-scheme:light}
:root[data-theme="dark"]{--paper:#131210;--sheet:#1b1a17;--ink:#efe8d8;--ink2:#d4ccba;--muted:#aca390;--rule:#3a3730;--rule2:#282621;--bad:#ff9585;
 --d-one:#efe8d8;--d-news:#a9c2ee;--d-home:#86cff3;--d-sport:#f4a06a;--d-tech:#c0aaf4;--d-money:#f0a3c9;--d-off:#e9c766;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Georgia,serif}
header.top,main{max-width:1500px;margin:0 auto;padding:0 16px}
header.top{padding-top:26px;border-bottom:3px double var(--rule)}
h1{margin:0;font:600 32px/1.1 Georgia,serif}
header.top p{margin:6px 0 12px;color:var(--ink2);max-width:75ch}
.bar button{font:600 13px "Libre Franklin",sans-serif;color:var(--ink);background:none;border:1px solid var(--rule);border-radius:4px;padding:7px 14px;cursor:pointer;margin-bottom:14px}
section{padding:24px 0 18px;border-bottom:1px solid var(--rule)}
h2{margin:0;font:600 24px/1.2 Georgia,serif}
.dek{margin:4px 0 14px;color:var(--ink2);max-width:80ch}
.pair{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:24px;align-items:start}
.laptop .frame{width:1440px;transform-origin:0 0}
.frame{background:var(--paper);border:1px solid var(--rule);border-radius:4px;overflow:hidden;padding:0 20px}
.phone .frame{width:390px;padding:0 16px}
.cap{margin:6px 0 0;font:500 12.5px "Libre Franklin",sans-serif;color:var(--muted)}
.run{display:flex;justify-content:space-between;gap:18px;padding:8px 0 4px;font:500 12.5px "Libre Franklin",sans-serif;color:var(--muted);white-space:nowrap;overflow:hidden}
.phone .run span+span{display:none}
.tabs{display:flex;gap:6px;padding-top:6px;border-bottom:1px solid var(--rule);overflow:hidden}
.tabs a{flex:1 0 auto;text-align:center;padding:8px 6px 8px;border-top:4px solid var(--c);font:700 12px "Libre Franklin",sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--c);white-space:nowrap}
.tabs a.on{background:color-mix(in srgb,var(--ink) 9%,transparent);color:var(--ink)}
.phone .tabs a{flex:none;font-size:11px}
.np-now{display:flex;flex-direction:column;align-items:center;padding:2px 0 12px}
.np-now .the{font:400 33px/1 UnifrakturMaguntia}
.np-now .hof{font:600 11px "Libre Franklin",sans-serif;letter-spacing:.55em;padding-left:.55em;margin:4px 0 3px;text-transform:uppercase}
.np-now .fig{display:flex;justify-content:center;align-items:center}
.np-line{display:flex;justify-content:center;align-items:flex-end;gap:.32em;padding:10px 0 12px;white-space:nowrap}
.np-line .bl{font:400 60px/1 UnifrakturMaguntia;flex:none;margin-right:.3em}
.np-line.b{align-items:baseline;gap:0}
.np-line.b .bl{margin-right:0}.np-line.b .bfig{flex:none;margin-left:.12em;align-self:flex-end;margin-bottom:-.1em}
.np-line.c{gap:14px}.np-line.c .bl{margin-right:0}
.np-line.c .caps{font:600 18px "Libre Franklin",sans-serif;letter-spacing:.42em;text-transform:uppercase;flex:none}
.ears{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:8px 0 4px}
.ear{display:flex;flex-direction:column;gap:2px;font:500 12.5px/1.35 "Libre Franklin",sans-serif;color:var(--muted)}
.ear b{color:var(--ink);font-weight:700}
.ear i{font-style:normal;color:var(--bad)}
.ear.r{text-align:right}
.phone .ears{grid-template-columns:1fr}.phone .ear{display:none}
.body{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:28px;padding:16px 0 18px}
.body::before,.body::after,.body i{content:"";display:block;height:120px;background:repeating-linear-gradient(var(--rule2) 0 12px,transparent 12px 26px);border-top:2px solid var(--ink)}
.phone .body{grid-template-columns:1fr}.phone .body::after{display:none}
@media (max-width:1000px){.pair{grid-template-columns:1fr}}
</style></head><body>
<header class="top"><h1>The nameplate on one line</h1>
<p>Four ways to set "The House of 1400" on one line, as the New York Times sets its name, so everything can be bigger and the header shorter. Each is the real header (run line, nameplate, desk tabs) at a laptop's width and on a phone, with today's dots; the 1400s are live (they swell, and a tap re-forms them). Today's header comes first for comparison.</p>
<div class="bar"><button id="theme" type="button">Night</button></div></header>
<main id="variants"></main>
<script>
const SHARES = ${JSON.stringify(SHARES)};
${read("v2/wordmark.js").replace(/^export /gm, "")}
${readFileSync(here + "src.js", "utf8")}
// the laptop frames are the real 1440px width, scaled to fit the page
function fitFrames() { document.querySelectorAll(".laptop").forEach(l => { const f = l.querySelector(".frame"), z = Math.min(1, l.clientWidth / 1440); f.style.zoom = z; }); }
addEventListener("resize", fitFrames); new MutationObserver(fitFrames).observe(document.getElementById("variants"), { childList: true });
</script></body></html>
`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB`);
