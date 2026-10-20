// No story leaves a wide empty space beside it (Parth, 19 Oct 2026: "We could fix the white space issue once and for
// all. Dynamically for future runs as well", on the Tiger Shroff lead, which had no drawing and left the right half of
// the News page empty). Opens the built site (dist/) offline and visits every desk of the last editions at the MacBook
// Air sizes and a wide monitor, twice: with the day's drawings and with none (a drawing that is refused, late or never
// ordered). A story fails when its text, Why it matters and drawing together end more than a third of the story's width
// short of its right edge. The headline, kicker and tools are not counted: a headline may wrap short by design.
// From 20 Oct 2026 it checks both looks, the current one and Glass (/?glass), and two more things (Parth, 20 Oct, on
// Glass: "Unbelievable amount of white space" under a drawing, and a drawing with the top of a head cut off):
// - beside a drawing: no empty band under the drawing or under the text beside it that is a third of the story's width
//   wide and a third of its height tall (in Glass also with every Read more open);
// - no drawing is cropped or squeezed: every drawing on the page shows at its file's own shape (within 1%), at the
//   laptop sizes and on an iPhone 17.
//   node scripts/space-check.mjs [dates...]      (run `npm run build` first; tests/space.test.mjs does both)
//   LOOKS=glass node scripts/space-check.mjs     (one look only: current or glass)
import { chromium } from "playwright-core";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
import { CHROMIUM } from "./fit-check.mjs";

const H = new URL("../", import.meta.url).pathname, D = H + "dist";
export const SIZES = { "Air 13": [1470, 832], "Air 15": [1710, 990], "Wide monitor": [2000, 1100] };
// phones: the drawings' shape only (a story there is one column, its drawing at the top)
export const PHONES = { "iPhone 17": [402, 760, 3] };
export const LOOKS = ["current", "glass"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".gif": "image/gif" };
const GAP = 1 / 3, MIN_WIDTH = 600, SHAPE = 0.01;

export const lastEditions = (n = 4) => readdirSync(`${H}content/editions`).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(-n).map(f => f.slice(0, 10));

// in the page: every story's empty space, and every drawing's shape
function measure({ GAP, MIN_WIDTH, SHAPE, phone }) {
  const out = [];
  const vis = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
  for (const img of document.querySelectorAll("#main figure.art img")) {
    if (!vis(img) || !img.naturalWidth) continue;
    const r = img.getBoundingClientRect(), want = img.naturalWidth / img.naturalHeight, got = r.width / r.height;
    const fit = getComputedStyle(img).objectFit;
    if (Math.abs(got / want - 1) > SHAPE) out.push(`the drawing in ${img.closest("[id]")?.id} shows at ${got.toFixed(3)}, its file is ${want.toFixed(3)} (${fit === "cover" ? "cropped" : "squeezed"})`);
  }
  if (phone) return out;
  for (const a of document.querySelectorAll("#main article.story, #main article.lead-story")) {
    const box = a.getBoundingClientRect(); if (box.width < MIN_WIDTH || !box.height) continue;
    let right = -Infinity;
    const parts = [...a.querySelectorAll(":scope > .body, :scope > figure.art, :scope > .deck")];
    for (const el of parts) {
      if (el.matches("figure")) { right = Math.max(right, el.querySelector("img")?.getBoundingClientRect().right ?? -Infinity); continue; }
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange();
      for (let n; (n = tw.nextNode());) { if (!n.textContent.trim() || n.parentElement.closest("[hidden]")) continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width) right = Math.max(right, r.right); }
      for (const box2 of el.querySelectorAll(".why")) right = Math.max(right, box2.getBoundingClientRect().right);
    }
    if (right !== -Infinity) {
      const gap = (box.right - right) / box.width;
      if (gap > GAP) out.push(`${a.id} leaves ${Math.round(gap * 100)}% of its ${Math.round(box.width)}px empty`);
    }
    // beside a drawing: the parts of the story in the column beside it, top to bottom, and the empty bands in that
    // column and under the drawing
    const img = a.querySelector(":scope > figure.art img"); if (!img || !vis(img)) continue;
    const ir = img.getBoundingClientRect();
    const side = [...a.children].filter(e => !e.matches("figure") && vis(e)).map(e => e.getBoundingClientRect())
      .filter(r => r.height && r.bottom > ir.top + 1 && (r.left >= ir.right - 1 || r.right <= ir.left + 1)).sort((x, y) => x.top - y.top);
    if (!side.length) continue;
    const sideW = Math.max(...side.map(r => r.right)) - Math.min(...side.map(r => r.left));
    const bands = [{ where: "under its drawing", h: Math.max(...side.map(r => r.bottom)) - ir.bottom, w: ir.width }];
    let y = ir.top; for (const r of side) { bands.push({ where: "in the text beside its drawing", h: r.top - y, w: sideW }); y = Math.max(y, r.bottom); }
    bands.push({ where: "under the text beside its drawing", h: ir.bottom - y, w: sideW });
    for (const b of bands) if (b.w >= box.width * GAP && b.h >= box.height * GAP && b.h > 40) out.push(`${a.id} leaves ${Math.round(b.h)}px by ${Math.round(b.w)}px empty ${b.where} (${Math.round(100 * b.h / box.height)}% of its height)`);
  }
  return out;
}

async function visit(b, { E, look, art, w, h, dpr, phone, desks }) {
  const snap = E.snapshot || {};
  const ctx = await b.newContext({ serviceWorkers: "block", viewport: { width: w, height: h }, ...(phone ? { deviceScaleFactor: dpr, isMobile: true, hasTouch: true } : {}) });
  const fails = [];
  try {
    const T0 = Date.parse(`${E.date}T09:30:00Z`);
    await ctx.addInitScript(`(function(){var R=Date,O=${T0}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();try{sessionStorage.setItem("h1400-pressed","1")}catch(e){}`);
    const p = await ctx.newPage();
    await p.route(/^https?:/, r => r.abort());
    await p.route(/^https:\/\/house14\.test\//, r => {
      const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
      if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
      if (u.pathname === "/content/latest.json") return r.fulfill({ json: E });
      if (u.pathname.startsWith("/api/") || (!art && u.pathname.startsWith("/art/"))) return r.fulfill({ status: 404, json: {} });
      let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html";
      if (!existsSync(f) && u.pathname.startsWith("/art/")) f = H + "public" + u.pathname;
      return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" });
    });
    const q = look === "glass" ? "?glass" : "?glass=off";
    for (const desk of desks) {
      await p.goto(`https://house14.test/${q}#d-${desk}`);
      await p.waitForTimeout(desk === desks[0] ? 2500 : 1200);
      // every drawing loaded, so its file's own shape is known
      await p.evaluate(() => Promise.race([Promise.all([...document.querySelectorAll("#main figure.art img")].map(i => { i.loading = "eager"; return i.decode().catch(() => {}); })), new Promise(r => setTimeout(r, 4000))]));
      await p.waitForTimeout(150);
      const tag = `${E.date} ${look} · ${art ? "with drawings" : "no drawings"} · ${phone || `${w}px`} · ${desk}`;
      for (const x of await p.evaluate(measure, { GAP, MIN_WIDTH, SHAPE, phone: !!phone })) fails.push(`${tag}: ${x}`);
      // Glass: again with every Read more open (the text grows; the drawing's layout follows it)
      if (look === "glass" && !phone && art) {
        const n = await p.evaluate(() => { const bs = [...document.querySelectorAll('#main [data-more][aria-expanded="false"]')]; bs.forEach(b => b.click()); return bs.length; });
        if (n) { await p.waitForTimeout(300); for (const x of await p.evaluate(measure, { GAP, MIN_WIDTH, SHAPE, phone: false })) fails.push(`${tag} · Read more open: ${x}`); }
      }
    }
  } finally { await ctx.close(); }
  return fails;
}

export async function spaceCheck({ dates = lastEditions(), sizes = SIZES, phones = PHONES, looks = LOOKS, log = console.log } = {}) {
  const desks = JSON.parse(readFileSync(`${H}config/house.json`, "utf8")).desks_v2.desks.map(d => d.id);
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const fails = [];
  try {
    for (const date of dates) {
      const E = JSON.parse(readFileSync(`${H}content/editions/${date}.json`, "utf8"));
      for (const look of looks) {
        // the sizes of one look and edition run side by side
        const runs = [];
        for (const art of [true, false]) for (const [, [w, h]] of Object.entries(sizes)) runs.push({ E, look, art, w, h, desks });
        for (const [name, [w, h, dpr]] of Object.entries(phones)) runs.push({ E, look, art: true, w, h, dpr, phone: name, desks });
        for (const f of await Promise.all(runs.map(r => visit(b, r)))) fails.push(...f);
      }
      log(`${date}: checked`);
    }
  } finally { await b.close(); }
  return fails;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const looks = process.env.LOOKS ? process.env.LOOKS.split(",") : LOOKS;
  const fails = await spaceCheck({ dates: process.argv[2] ? process.argv.slice(2) : lastEditions(), looks });
  console.log(fails.length ? fails.join("\n") : "No wide empty space beside any story, and every drawing whole.");
  process.exit(fails.length ? 1 : 0);
}
