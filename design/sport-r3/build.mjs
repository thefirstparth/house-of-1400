// node design/sport-r3/build.mjs: Sport round 3 (mock). Renders the real v2 Sport desk (dist/, 2 Oct paper, its
// press-time live figures), rearranges it into each variant in the page (variants.js), and bakes the result into one
// self-contained page: index.html. Screens of each go to shots/ for checking. Needs `npm run build` first.
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { extname } from "node:path";
const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname, D = H + "dist";
const E = JSON.parse(readFileSync(`${D}/content/latest.json`, "utf8")), snap = JSON.parse(readFileSync(`${H}content/editions/${E.date}.json`, "utf8")).snapshot || {};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const VARIANTS = (process.env.ONLY || "now,a,b,c").split(","), DEVICES = { laptop: [1470, 830, 2, false], phone: [402, 874, 3, true] };
const inject = ["style.css", "variants.js", "runtime.js"].map(f => readFileSync(here + f, "utf8"));
mkdirSync(here + "shots", { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const baked = {}, report = [];
for (const v of VARIANTS) for (const [dev, [w, hgt, dpr, ph]] of Object.entries(DEVICES)) {
  const ctx = await b.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: dpr, isMobile: ph, hasTouch: ph, colorScheme: "light" });
  await ctx.addInitScript(`(function(){var R=Date,O=${Date.parse(`${E.date}T09:30:00Z`)}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();try{sessionStorage.setItem("h1400-pressed","1");localStorage.setItem("h1400-theme","light")}catch(e){}`);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route(/^https?:/, r => /espncdn\.com/.test(r.request().url()) ? r.continue() : r.abort());
  await p.route(/^https:\/\/house14\.test\//, r => { const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
    if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
    let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html"; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" }); });
  await p.goto(`https://house14.test/?v2#d-sport`); await p.waitForTimeout(3500);
  // every illustration loaded (they are lazy), so the screens show them
  await p.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach(i => { i.loading = "eager"; }));
  await p.waitForTimeout(800);
  if (v !== "now") {
    await p.addStyleTag({ content: inject[0] }); await p.addScriptTag({ content: inject[2] }); await p.addScriptTag({ content: inject[1] });
    await p.evaluate(v => { const pin = document.querySelector("nav.dtabs"); document.documentElement.style.setProperty("--r3pin", pin && getComputedStyle(pin).position === "sticky" ? pin.offsetHeight + "px" : "0px"); window.R3(v); }, v);
    await p.waitForTimeout(900);
  }
  await p.evaluate(() => Promise.all([...document.images].map(i => { i.loading = "eager"; return i.decode().catch(() => {}); })));
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  report.push({ v, dev, height, screens: +(height / hgt).toFixed(1), errs });
  await p.screenshot({ path: `${here}shots/${v}-${dev}-top.png` });
  await p.screenshot({ path: `${here}shots/${v}-${dev}-full.png`, fullPage: true });
  // bake: canvases become pictures, scripts go, every rule of every stylesheet comes along
  const out = await p.evaluate(() => {
    document.querySelectorAll("canvas").forEach(c => { try { const i = new Image(); i.src = c.toDataURL(); i.style.cssText = c.style.cssText; i.width = c.clientWidth; i.height = c.clientHeight; i.className = c.className; c.replaceWith(i); } catch {} });
    // the stylesheets as written (a rule's cssText loses any shorthand that uses a variable): our own files by
    // path, the inline styles as they are, the font service by link
    let css = "", links = "";
    for (const n of document.querySelectorAll("link[rel=stylesheet], style")) {
      if (n.tagName === "STYLE") css += n.textContent + "\n";
      else if (/^https:\/\/house14\.test\//.test(n.href)) css += `%%FILE:${new URL(n.href).pathname}%%\n`;
      else links += `<link rel="stylesheet" href="${n.href}">`;
    }
    document.querySelectorAll("script, link[rel=stylesheet], style").forEach(x => x.remove());
    const root = document.documentElement, attrs = [...root.attributes].filter(a => a.name !== "data-theme").map(a => `${a.name}="${a.value.replace(/"/g, "&quot;")}"`).join(" ");
    return { css, links, attrs, body: document.body.outerHTML };
  });
  baked[`${v}-${dev}`] = out;
  console.log(v, dev, height, "px", (height / hgt).toFixed(1), "screens", errs.length ? "ERR " + errs[0] : "");
  await ctx.close();
}
await b.close();

// assets once: the paper's own fonts (latin; the ext sets are left out) and the day's illustrations
const ART = {}, FONTS = {};
const fix = s => s.replace(/https:\/\/house14\.test/g, "")
  .replace(/@font-face\s*\{[^}]*-ext-[^}]*\}/g, "")
  .replace(/url\(["']?\/fonts\/([^"')]+)["']?\)/g, (m, f) => { const p = `${D}/fonts/${f}`; if (existsSync(p)) FONTS[f] = readFileSync(p).toString("base64"); return `url(%%FONT:${f}%%)`; })
  .replace(/src="\/([a-z0-9-]+\.svg)"/g, (m, f) => existsSync(`${D}/${f}`) ? `src="data:image/svg+xml;base64,${readFileSync(`${D}/${f}`).toString("base64")}"` : m)
  .replace(/\/art\/([0-9-]+)\/([a-z0-9-]+\.webp)(\?v=[a-z0-9]+)?/g, (m, d, f) => { const p = `${D}/art/${d}/${f}`; if (existsSync(p)) { ART[f] = readFileSync(p).toString("base64"); return `%%ART:${f}%%`; } return m; });
const files = s => s.replace(/%%FILE:([^%]+)%%/g, (m, f) => readFileSync(D + f, "utf8"));
for (const o of Object.values(baked)) o.css = files(o.css);
const docs = {};
let css = null;
for (const [k, o] of Object.entries(baked)) { const c = fix(o.css); if (css == null || c.length > css.length) css = c; docs[k] = { attrs: o.attrs, links: o.links, body: fix(o.body) }; }
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Sport, round 3</title><style>${readFileSync(here + "frame.css", "utf8")}</style></head><body>
<header class="top"><h1>Sport, round three</h1>
<p class="lede">Today's Sport desk, the real one, rearranged three ways. Nothing is redrawn and nothing is left out: every story and illustration, every crest, table, leader board, result, market bar and source note is the page's own, only moved. Pick a layout, a screen, day or night; the frame scrolls like the page.</p>
<div class="controls"><div class="seg" id="vs"></div><div class="seg" id="ds"></div><div class="seg" id="ts"></div></div><p class="why" id="why"></p></header>
<main><div id="stage"></div></main>
<script>
const REPORT = ${JSON.stringify(report)};
const DOCS = ${JSON.stringify(docs)};
const CSS = ${JSON.stringify(css)};
const RUNTIME = ${JSON.stringify(inject[2])};
const FONTS = ${JSON.stringify(FONTS)};
const ART = ${JSON.stringify(ART)};
${readFileSync(here + "frame.js", "utf8")}
</script></body></html>`;
writeFileSync(here + "index.html", page);
writeFileSync(here + "shots/report.json", JSON.stringify(report, null, 1));
console.log(`index.html ${(page.length / 1048576).toFixed(1)} MB`);
