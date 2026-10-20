// The paper's app icons (the paper as an app, 20 Oct 2026; v2/README.md "Install"): the Glass nameplate, blackletter
// "The" over "HOUSE OF" and the halftone 1400 drawn by v2/wordmark.js (stillWordmark), its dots shared evenly among
// the desks in the tabs' order (config desks_v2) in the Glass look's desk colours (v2/glass.css), on Glass's ground.
// Run by hand when the nameplate changes; the PNGs are committed:
//   node scripts/paper-icons.mjs
// Writes public/icons/icon-180.png (apple-touch-icon), icon-192.png, icon-512.png and icon-512-maskable.png (the
// figure inside the maskable safe zone, the middle 80% circle).
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const H = new URL("../", import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(`${H}config/house.json`, "utf8"));
const desks = (cfg.desks_v2?.desks || []).map(d => d.id).filter(d => d !== "one");
const glass = readFileSync(`${H}v2/glass.css`, "utf8");
const tok = k => (glass.match(new RegExp(`--${k}:(#[0-9a-fA-F]{3,8})`)) || [])[1];
const ground = tok("paper"), ink = tok("ink");
const colours = Object.fromEntries(desks.map(d => [d, tok(`d-${d}`)]));
if (!ground || !ink || desks.some(d => !colours[d])) throw new Error("paper-icons: a Glass token is missing from v2/glass.css");

const OUT = `${H}public/icons/`;
mkdirSync(OUT, { recursive: true });
const ICONS = [["icon-180.png", 180, 0.8], ["icon-192.png", 192, 0.8], ["icon-512.png", 512, 0.8], ["icon-512-maskable.png", 512, 0.6]];

const page = (S, fill) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(/fonts/unifrakturmaguntia-latin-400-normal.woff2)}
@font-face{font-family:F;src:url(/fonts/libre-franklin-latin-wght-normal.woff2);font-weight:100 900}
:root{--ink:${ink};${desks.map(d => `--d-${d}:${colours[d]}`).join(";")}}
html,body{margin:0;background:${ground}}
.i{width:${S}px;height:${S}px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:${ink};overflow:hidden}
.the{font:400 ${(S * fill * 0.2).toFixed(1)}px/.9 B}
.hof{font:600 ${(S * fill * 0.062).toFixed(1)}px/1 F;letter-spacing:.32em;margin-right:-.32em;text-transform:uppercase;margin-top:${(S * fill * 0.012).toFixed(1)}px}
#n{margin-top:${(S * fill * 0.05).toFixed(1)}px;display:flex;justify-content:center}
</style></head><body><div class="i"><div class="the">The</div><div class="hof">House of</div><div id="n"></div></div>
<script type="module">
import { stillWordmark } from "/v2/wordmark.js";
await document.fonts.load("10px B"); await document.fonts.load("600 10px F");
// the figure's width is "fill" of the icon: 1400 is 2.338 ems wide (v2/wordmark.js ADV)
await stillWordmark(document.getElementById("n"), { size: ${S} * ${fill} / 2.338, shares: ${JSON.stringify(desks.map(d => ({ desk: d, words: 1 })))} });
document.body.dataset.ready = "1";
</script></body></html>`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
for (const [name, S, fill] of ICONS) {
  const ctx = await b.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route(/^https:\/\/icons\.test\//, r => {
    const u = new URL(r.request().url());
    if (u.pathname === "/") return r.fulfill({ body: page(S, fill), contentType: "text/html" });
    if (u.pathname === "/v2/wordmark.js") return r.fulfill({ body: readFileSync(`${H}v2/wordmark.js`), contentType: "text/javascript" });
    if (u.pathname.startsWith("/fonts/")) return r.fulfill({ body: readFileSync(`${H}v2${u.pathname}`), contentType: "font/woff2" });
    return r.fulfill({ status: 404, body: "" });
  });
  await p.goto("https://icons.test/");
  await p.waitForSelector("body[data-ready]");
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + name, clip: { x: 0, y: 0, width: S, height: S } });
  console.log(`paper-icons: ${name}`);
  await ctx.close();
}
await b.close();
