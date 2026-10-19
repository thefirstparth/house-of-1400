// No story leaves a wide empty space beside it (Parth, 19 Oct 2026: "We could fix the white space issue once and for
// all. Dynamically for future runs as well", on the Tiger Shroff lead, which had no drawing and left the right half of
// the News page empty). Opens the built site (dist/) offline and visits every desk of the last editions at the MacBook
// Air sizes and a wide monitor, twice: with the day's drawings and with none (a drawing that is refused, late or never
// ordered). A story fails when its text, Why it matters and drawing together end more than a third of the story's width
// short of its right edge. The headline, kicker and tools are not counted: a headline may wrap short by design.
//   node scripts/space-check.mjs            (run `npm run build` first; tests/space.test.mjs does both)
import { chromium } from "playwright-core";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
import { CHROMIUM } from "./fit-check.mjs";

const H = new URL("../", import.meta.url).pathname, D = H + "dist";
export const SIZES = { "Air 13": [1470, 832], "Air 15": [1710, 990], "Wide monitor": [2000, 1100] };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".gif": "image/gif" };
const GAP = 1 / 3, MIN_WIDTH = 600;

export const lastEditions = (n = 4) => readdirSync(`${H}content/editions`).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(-n).map(f => f.slice(0, 10));

export async function spaceCheck({ dates = lastEditions(), sizes = SIZES, log = console.log } = {}) {
  const desks = JSON.parse(readFileSync(`${H}config/house.json`, "utf8")).desks_v2.desks.map(d => d.id);
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const fails = [];
  try {
    for (const date of dates) {
      const E = JSON.parse(readFileSync(`${H}content/editions/${date}.json`, "utf8")), snap = E.snapshot || {};
      for (const art of [true, false]) for (const [name, [w, h]] of Object.entries(sizes)) {
        const ctx = await b.newContext({ viewport: { width: w, height: h } });
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
        for (const desk of desks) {
          await p.goto(`https://house14.test/#d-${desk}`);
          await p.waitForTimeout(desk === desks[0] ? 2500 : 1200);
          const bad = await p.evaluate(({ GAP, MIN_WIDTH }) => {
            const out = [];
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
              if (right === -Infinity) continue;
              const gap = (box.right - right) / box.width;
              if (gap > GAP) out.push(`${a.id} leaves ${Math.round(gap * 100)}% of its ${Math.round(box.width)}px empty`);
            }
            return out;
          }, { GAP, MIN_WIDTH });
          for (const x of bad) fails.push(`${date} ${art ? "with drawings" : "no drawings"} · ${name} ${w}px · ${desk}: ${x}`);
        }
        await ctx.close();
      }
      log(`${date}: checked`);
    }
  } finally { await b.close(); }
  return fails;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fails = await spaceCheck({ dates: process.argv[2] ? process.argv.slice(2) : lastEditions() });
  console.log(fails.length ? fails.join("\n") : "No wide empty space beside any story.");
  process.exit(fails.length ? 1 : 0);
}
