// node design/sport/src/shot.mjs [desk] [tag]: full-page screenshots of the mock at phone, laptop and monitor widths,
// light and dark, with page errors, sideways scroll and overlapping text. In this sandbox ESPN's crests and F1's
// circuit map cannot load, so they are stood in by plain shapes of the same size (the file keeps the real addresses).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
const H = new URL("../../../", import.meta.url).pathname, desk = process.argv[2] || "sport", tag = process.argv[3] || "v1";
const O = `${H}design/sport/shots/${tag}/`; mkdirSync(O, { recursive: true });
const crest = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="#b9b2a2"/></svg>`;
const track = `<svg xmlns="http://www.w3.org/2000/svg" width="1056" height="704"><rect width="1056" height="704" fill="#e7e2d6"/><path d="M180 520 C120 300 300 140 520 170 S900 160 880 360 S700 600 520 560 S260 640 180 520Z" fill="none" stroke="#3a3830" stroke-width="18" stroke-linejoin="round"/><text x="528" y="380" font-family="sans-serif" font-size="30" text-anchor="middle" fill="#625d52">Circuit map (F1) · stand-in</text></svg>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = {};
for (const [w, h, theme] of [[1300, 860, "light"], [390, 844, "light"], [1300, 860, "dark"], [390, 844, "dark"], [1920, 1080, "light"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  await p.route(/^https?:/, r => r.abort()); // registered first: Playwright tries the latest route first
  await p.route(/espncdn\.com/, r => r.fulfill({ body: crest, contentType: "image/svg+xml" }));
  await p.route(/formula1\.com/, r => r.fulfill({ body: track, contentType: "image/svg+xml" }));
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text()) && errs.push(m.text()));
  await p.goto(`file://${H}design/sport/${desk}-desk.html`); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach(i => (i.loading = "eager"))); await p.waitForTimeout(800);
  const name = `${w}-${theme}`;
  await p.screenshot({ path: `${O}${name}-top.png` });
  await p.screenshot({ path: `${O}${name}-full.png`, fullPage: true, scale: "css" });
  // each section on its own (the pinned tabs unpinned so they do not sit over the picture)
  if (w !== 1920) {
    await p.addStyleTag({ content: "nav.dtabs{position:static!important}" });
    for (const id of await p.evaluate(() => ["dopen", ...[...document.querySelectorAll("section.sec")].filter(s => !s.hidden).map(s => s.id), "foot"])) {
      const l = id === "dopen" ? p.locator(".dopen") : id === "foot" ? p.locator(".nextdesk") : p.locator("#" + id);
      await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      mkdirSync(`${O}sections/`, { recursive: true }); await l.screenshot({ path: `${O}sections/${name}-${id}.png`, animations: "disabled" });
    }
  }
  report[name] = await p.evaluate(() => {
    const els = [...document.querySelectorAll("h1,h2,h3,h4,.kick,.tag,p,li,td,th,figcaption,a")].filter(e => e.checkVisibility() && e.textContent.trim() && !e.closest("details:not([open])") && !e.closest(".dtabs") && e.getBoundingClientRect().width > 0).map(e => [e, e.getBoundingClientRect()]);
    const overlaps = [];
    for (let i = 0; i < els.length && overlaps.length < 20; i++) for (let j = i + 1; j < els.length; j++) { const [a, A] = els[i], [c, B] = els[j]; if (a.contains(c) || c.contains(a)) continue; if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) { overlaps.push(`${a.textContent.trim().slice(0, 40)} × ${c.textContent.trim().slice(0, 40)}`); break; } }
    return { sideways: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, sections: [...document.querySelectorAll("section.sec")].filter(s => !s.hidden).map(s => s.id), overlaps };
  });
  report[name].errs = errs;
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
await b.close();
