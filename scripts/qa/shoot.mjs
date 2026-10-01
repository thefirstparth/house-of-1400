// QA: the local build (node scripts/dev.mjs on :3000) with live data frozen in qa-data/ (scripts/qa/freeze.mjs):
// every section at laptop and phone width, light and dark, with page errors, sideways scroll and overlapping text.
// Usage: node scripts/qa/shoot.mjs <tag>   ->   qa-shots/<tag>/<width>-<theme>-<section>.png and report.json
// Compare a "before" and "after" tag for every change. Playwright uses the preinstalled Chromium.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const tag = process.argv[2] || "now", O = `qa-shots/${tag}/`; mkdirSync(O, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined, args: ["--ignore-certificate-errors"] });
const report = {};
for (const [w, theme] of [[1300, "light"], [390, "light"], [1300, "dark"], [390, "dark"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: theme, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.route("**/api/live/**", r => { const k = new URL(r.request().url()).pathname.split("/").pop(), f = `qa-data/${k}.json`; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: "application/json" }) : r.fulfill({ status: 500, body: '{"ok":false}' }); });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 120000 }); await p.waitForTimeout(4000);
  await p.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach(i => (i.loading = "eager")));
  const ids = await p.evaluate(() => [...document.querySelectorAll("section[id], #front")].filter(s => !s.hidden && s.offsetHeight).map(s => s.id));
  const overlaps = await p.evaluate(() => { const els = [...document.querySelectorAll("h2,h3,h4,.kick,.tag,p,li,td,th,figcaption")].filter(e => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.textContent.trim() && !e.closest("details:not([open])") && e.getBoundingClientRect().width > 0).map(e => [e, e.getBoundingClientRect()]); const out = [];
    for (let i = 0; i < els.length && out.length < 20; i++) for (let j = i + 1; j < els.length; j++) { const [a, A] = els[i], [c, B] = els[j]; if (a.contains(c) || c.contains(a)) continue; if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) { out.push(`${a.textContent.trim().slice(0, 40)} × ${c.textContent.trim().slice(0, 40)}`); break; } } return out; });
  for (const id of ids) { const l = p.locator("#" + id); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); await l.screenshot({ path: `${O}${w}-${theme}-${id}.png`, animations: "disabled" }); }
  report[`${w}-${theme}`] = { errs, sideways: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), sections: ids.length, overlaps };
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
await b.close();
