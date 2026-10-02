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
// Phones as Parth uses them (2 Oct: "Nothing Phone 2, iPhone 17, 16 Pro, other iPhones; half my reading is on a
// phone"): each one's CSS width and pixel density, and the height left once the browser's bars are drawn.
const PHONES = {
  nothing2: "412x835@2.625", iphone17: "402x760@3", iphone16pro: "402x760@3", iphone16: "393x740@3", iphone17promax: "440x840@3",
  iphone16plus: "430x820@3", iphone13: "390x730@3", iphonemini: "375x700@3", iphonese: "375x548@2",
  iphone17land: "874x370@3", nothing2land: "915x380@2.625",
};
// The QA matrix (Parth, 2 Oct: "proper QA once and for all for the top 15-20 screens"): each device's browser window
// at its default display scaling, after the menu bar or taskbar and Chrome's tabs and address bar; phones after
// Safari's or Chrome's bars. DEVICES=all runs every one (light; dark too with DARK=1).
const DEVICES = {
  "macbook-air-13": "1470x830", "macbook-air-15": "1710x985", "macbook-pro-14": "1512x855", "macbook-pro-16": "1728x990",
  "macbook-air-13-full": "1470x956", "imac-24": "2240x1130",
  "win-1080p-150": "1280x595", "win-1080p-125": "1536x730", "win-1366": "1366x657", "win-1080p-100": "1920x937", "surface-laptop": "1504x870",
  "monitor-1920x1200": "1920x1057", "monitor-2560x1440": "2560x1297", "monitor-4k-150": "2560x1297", "monitor-4k-100": "3840x2017",
  "ultrawide-3440": "3440x1297", "superwide-5120": "5120x1297",
  "ipad-landscape": "1180x760", "ipad-portrait": "820x1110",
  "iphone-17": "iphone17", "iphone-17-pro-max": "iphone17promax", "iphone-se": "iphonese", "nothing-phone-2": "nothing2",
  "galaxy-s24": "360x700@3", "pixel-9": "412x790@2.625", "iphone-17-landscape": "iphone17land",
};
const SIZES = (process.env.DEVICES === "all" ? Object.entries(DEVICES).flatMap(([n, v]) => [`${v}-light`, ...(process.env.DARK ? [`${v}-dark`] : [])]).filter((x, i, a) => a.indexOf(x) === i).join(",") : process.env.SIZES || (process.env.PHONES ? process.env.PHONES.split(",").flatMap(n => ["light", "dark"].map(t => `${n}-${t}`)).join(",") : "1440x900-light,390x844-light,1440x900-dark,390x844-dark,1280x720-light,1920x1080-light")).split(",");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = {};
for (const sz of SIZES) {
  const [wh, theme] = sz.split("-"), spec = PHONES[wh] || wh, [dims, dpr0] = spec.split("@"), [w, h] = dims.split("x").map(Number);
  const phone = !!PHONES[wh] || w < 760, touch = phone || /@/.test(spec) || w === 820 || w === 1180, dpr = Number(dpr0) || (phone ? 2 : touch ? 2 : 1);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
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
    if (!touch || d === "one" || mode === "v1" || process.env.FULL) await p.screenshot({ path: `${O}${name}-full.png`, fullPage: true, scale: "css" });
    report[name] = await p.evaluate(VW => {
      const vis = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
      const els = [...document.querySelectorAll("#main h1,#main h2,#main h3,#main h4,#main .kick,#main p,#main li,#main td,#main th,#dtop a,#dtop span.n")].filter(e => vis(e) && e.textContent.trim() && !e.closest("details:not([open])")).map(e => [e, e.getBoundingClientRect()]);
      const overlaps = [];
      for (let i = 0; i < els.length && overlaps.length < 10; i++) for (let j = i + 1; j < els.length; j++) { const [a, A] = els[i], [c, B] = els[j]; if (a.contains(c) || c.contains(a)) continue; if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) { overlaps.push(`${a.textContent.trim().slice(0, 30)} × ${c.textContent.trim().slice(0, 30)}`); break; } }
      const end = document.querySelector(".p1end")?.getBoundingClientRect().bottom;
      return {
        design: window.H1400V2 ? "v2" : "v1",
        // against the screen's own width: a phone browser quietly widens the page to fit anything that overflows
        sideways: Math.max(document.documentElement.scrollWidth, innerWidth) - VW,
        sections: [...document.querySelectorAll("#main section.sec")].filter(s => !s.hidden).map(s => s.id).join(" "),
        onescreen: end != null ? (innerWidth < 1000 ? "phone" : Math.round(end) <= innerHeight) : "",
        lines: document.querySelectorAll(".p1 ol.min a").length || "",
        zoom: document.getElementById("layout")?.style.zoom || "",
        tables: [...document.querySelectorAll("#main table, #main .tbl")].filter(t => vis(t) && (t.scrollWidth > t.clientWidth + 1 || t.getBoundingClientRect().right > VW)).map(t => t.closest("section")?.id).join(" "),
        fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family.replace(/"/g, "")).filter((x, i, a) => a.indexOf(x) === i).join(", "),
        overlaps,
        // the type as it reaches the eye: the body text and headlines' size on screen, with the page's zoom
        type: (() => { const z = parseFloat(document.getElementById("layout")?.style.zoom) || 1, px = sel => { const e = [...document.querySelectorAll(sel)].find(vis); return e ? Math.round(parseFloat(getComputedStyle(e).fontSize) * z * 10) / 10 : null; }; return { body: px("#main .p1 ol.min b, #main article.story .body p, #main article.lead-story .body p"), head: px("#main .leadh h3, #main article.story h3"), small: px("#main .kick, #main .lab") }; })(),
        // phones: anything wider than the screen (the tab row scrolls on purpose), type under 11px, links and buttons
        // under 32px tall to tap, and the wordmark's canvas against the screen
        wide: [...document.querySelectorAll("#main *, #dtop *")].filter(e => vis(e) && !e.closest("#dtabs, #bigplate") && e.getBoundingClientRect().right > VW + 1 && getComputedStyle(e).position !== "fixed").slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 40)),
        tiny: [...new Set([...document.querySelectorAll("#main *, #dtop *, #dtabs *")].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) * (parseFloat(document.getElementById("layout")?.style.zoom) || 1) < 11).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]} ${parseFloat(getComputedStyle(e).fontSize)}px`))].slice(0, 8),
        taps: innerWidth < 1000 ? [...document.querySelectorAll("#dtabs a, #main a, #main button, #dtop a, #dtop button")].filter(e => vis(e) && !e.closest("p, li, td, .agenda, .board, .tbl, .signal") && e.getBoundingClientRect().height < 32).slice(0, 6).map(e => `${e.textContent.trim().slice(0, 18)} ${Math.round(e.getBoundingClientRect().height)}px`) : [],
        // the tallest drawing on the page as a share of the screen's height (2 Oct: never the whole screen)
        art: Math.round(100 * Math.max(0, ...[...document.querySelectorAll("#main figure.art img")].filter(vis).map(i => i.getBoundingClientRect().height)) / innerHeight) + "%",
        mark: (() => { const c = document.querySelector("#bigplate canvas"); if (!c) return ""; const r = c.getBoundingClientRect(); return `${Math.round(r.left)}..${Math.round(r.right)} of ${VW}`; })(),
      };
    }, w);
  }
  report[`${wh}-${theme}`] = { errs };
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v));
await b.close();
