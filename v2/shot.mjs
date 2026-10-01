// node v2/shot.mjs <tag> [v1|v2] [path]: open the built site (dist/, run npm run build first) in the old or the new
// design and screenshot it at phone, laptop and monitor sizes, light and dark; v2 is shot on every desk. The live
// figures come from the edition's own press-time snapshot and the clock is held at 15:00 IST on its day, so the
// shots match what Parth saw at press time. Reports page errors, sideways scroll, overlapping text, tables wider than
// their column and whether Page One fits one screen. Shots go to v2/shots/<tag>/ (not kept in git).
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const H = new URL("../", import.meta.url).pathname, D = H + "dist", tag = process.argv[2] || "now", mode = process.argv[3] || "v2", path = process.argv[4] || "/";
const O = `${H}v2/shots/${tag}/`; mkdirSync(O, { recursive: true });
const E = JSON.parse(readFileSync(path.startsWith("/e/") ? `${D}/content/editions/${path.slice(3)}.json` : `${D}/content/latest.json`, "utf8"));
const full = JSON.parse(readFileSync(`${H}content/editions/${E.date}.json`, "utf8")), snap = full.snapshot || {};
const T0 = Date.parse(`${E.date}T09:30:00Z`);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const crest = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="#b9b2a2"/></svg>`;
const track = `<svg xmlns="http://www.w3.org/2000/svg" width="1056" height="704"><rect width="1056" height="704" fill="#e7e2d6"/><path d="M180 520 C120 300 300 140 520 170 S900 160 880 360 S700 600 520 560 S260 640 180 520Z" fill="none" stroke="#3a3830" stroke-width="18"/></svg>`;
const DESKS = mode === "v2" ? (JSON.parse(readFileSync(`${D}/config/house.json`, "utf8")).desks_v2?.desks || []).map(d => d.id) : ["page"];
const SIZES = (process.env.SIZES || "1440x900-light,390x844-light,1440x900-dark,390x844-dark,1280x720-light,1920x1080-light").split(",");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = {};
for (const sz of SIZES) {
  const [wh, theme] = sz.split("-"), [w, h] = wh.split("x").map(Number), touch = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(`(function(){var R=Date,O=${T0}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}
D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();`);
  const p = await ctx.newPage();
  await p.route(/^https?:/, r => r.abort());
  await p.route(/espncdn\.com/, r => r.fulfill({ body: crest, contentType: "image/svg+xml" }));
  await p.route(/formula1\.com/, r => r.fulfill({ body: track, contentType: "image/svg+xml" }));
  await p.route(/^https:\/\/house14\.test\//, r => {
    const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
    if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
    let f = D + u.pathname; if (u.pathname === "/" || /^\/(today|e\/[\d-]+|archive|editor)$/.test(u.pathname)) f = D + "/index.html";
    if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
    return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" });
  });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text()) && errs.push(m.text()));
  await p.goto(`https://house14.test${path}${mode === "v2" ? "?v2" : "?v1"}#d-${DESKS[0] === "page" ? "one" : DESKS[0]}`); await p.waitForTimeout(3000);
  for (const d of DESKS) {
    if (mode === "v2" && d !== DESKS[0]) { await p.click(`#dtabs a[data-desk="${d}"]`); await p.waitForTimeout(900); }
    await p.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach(i => (i.loading = "eager"))); await p.waitForTimeout(400);
    const name = `${wh}-${theme}-${d}`;
    await p.screenshot({ path: `${O}${name}-top.png` });
    if (!touch || d === "one" || mode === "v1") await p.screenshot({ path: `${O}${name}-full.png`, fullPage: true, scale: "css" });
    report[name] = await p.evaluate(() => {
      const vis = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
      const els = [...document.querySelectorAll("#main h1,#main h2,#main h3,#main h4,#main .kick,#main p,#main li,#main td,#main th,#dtop a,#dtop span.n")].filter(e => vis(e) && e.textContent.trim() && !e.closest("details:not([open])")).map(e => [e, e.getBoundingClientRect()]);
      const overlaps = [];
      for (let i = 0; i < els.length && overlaps.length < 10; i++) for (let j = i + 1; j < els.length; j++) { const [a, A] = els[i], [c, B] = els[j]; if (a.contains(c) || c.contains(a)) continue; if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) { overlaps.push(`${a.textContent.trim().slice(0, 30)} × ${c.textContent.trim().slice(0, 30)}`); break; } }
      const end = document.querySelector(".p1end")?.getBoundingClientRect().bottom;
      return {
        design: window.H1400V2 ? "v2" : "v1",
        sideways: document.documentElement.scrollWidth - innerWidth,
        sections: [...document.querySelectorAll("#main section.sec")].filter(s => !s.hidden).map(s => s.id).join(" "),
        onescreen: end != null ? (innerWidth < 1000 ? "phone" : Math.round(end) <= innerHeight) : "",
        lines: document.querySelectorAll(".p1 ol.min a").length || "",
        zoom: document.getElementById("layout")?.style.zoom || "",
        tables: [...document.querySelectorAll("#main table, #main .tbl")].filter(t => vis(t) && (t.scrollWidth > t.clientWidth + 1 || t.getBoundingClientRect().right > innerWidth)).map(t => t.closest("section")?.id).join(" "),
        fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "")).filter((x, i, a) => a.indexOf(x) === i).join(", "),
        overlaps,
      };
    });
  }
  report[`${wh}-${theme}`] = { errs };
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v));
await b.close();
