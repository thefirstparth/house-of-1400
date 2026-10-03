import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
const H = new URL("../", import.meta.url).pathname, D = H + "dist", O = process.argv[2], DESKID = process.argv[3] || "home", W0 = +(process.argv[4] || 1470);
const E = JSON.parse(readFileSync(`${D}/content/latest.json`, "utf8")), snap = JSON.parse(readFileSync(`${H}content/editions/${E.date}.json`, "utf8")).snapshot || {};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ph = W0 < 760, ctx = await b.newContext({ viewport: { width: W0, height: ph ? 874 : 830 }, isMobile: ph, hasTouch: ph });
await ctx.addInitScript(`(function(){var R=Date,O=${Date.parse(`${E.date}T09:30:00Z`)}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();try{sessionStorage.setItem("h1400-pressed","1")}catch(e){}`);
const p = await ctx.newPage();
await p.route(/^https?:/, r => /espncdn/.test(r.request().url()) ? r.continue() : r.abort());
await p.route(/^https:\/\/house14\.test\//, r => { const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
  if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
  let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html"; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" }); });
await p.goto(`https://house14.test/?v2#d-${DESKID}`); await p.waitForTimeout(3500);
await p.evaluate(() => Promise.all([...document.images].map(i => { i.loading = "eager"; return i.decode().catch(() => {}); })));
await p.waitForTimeout(500);
const out = await p.evaluate(() => {
  const rows = [], main = document.getElementById("main");
  for (const s of main.querySelectorAll(":scope > section.sec, :scope > header, :scope > div")) {
    const r = s.getBoundingClientRect(); rows.push(`${s.tagName.toLowerCase()}#${s.id}.${s.className} h=${Math.round(r.height)} :: ${s.querySelector("h2")?.textContent.trim() || ""}`);
    if (s.tagName === "SECTION") for (const c of s.querySelectorAll(":scope > *, :scope > div > *")) { if (c.parentElement !== s && c.parentElement.parentElement !== s) continue; const q = c.getBoundingClientRect(); if (q.height > 8) rows.push(`   ${c.tagName.toLowerCase()}.${[...c.classList].join(".")} h=${Math.round(q.height)} w=${Math.round(q.width)} :: ${c.textContent.replace(/\s+/g, " ").trim().slice(0, 90)}`); }
  }
  return rows.join("\n") + `\nTOTAL ${document.documentElement.scrollHeight}`;
});
console.log(out);
await p.screenshot({ path: `${O}/inv-${DESKID}-${W0}.png`, fullPage: true });
await b.close();
