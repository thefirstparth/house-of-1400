// node shot.mjs <route> <tag>: render the prototype and take full-page shots at laptop and phone widths.
import { chromium } from "/home/user/house-of-1400/node_modules/playwright-core/index.mjs";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
const R = "/tmp/claude-0/qa/rd/", route = process.argv[2] || "/", tag = process.argv[3] || "home";
export async function open(b, w, theme = "light", rt = "/") {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, colorScheme: theme, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date("2026-09-30T08:15:00Z"));
  await p.route(/\/app\.js(\?.*)?$/, r => r.fulfill({ body: readFileSync(R + "app.js"), contentType: "text/javascript" }));
  await p.route(/\/styles\.css(\?.*)?$/, r => r.fulfill({ body: readFileSync(R + "styles.css"), contentType: "text/css" }));
  await p.route(/\/config\/house\.json/, r => r.fulfill({ body: readFileSync(R + "house.json"), contentType: "application/json" }));
  await p.route("**/api/live/**", r => { const k = new URL(r.request().url()).pathname.split("/").pop(); const f = R + "live/" + k + ".json"; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: "application/json" }) : r.fulfill({ status: 500, body: '{"ok":false}' }); });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto("http://localhost:3000" + rt); await p.waitForTimeout(3500);
  return { p, ctx, errs };
}
if (process.argv[1].endsWith("shot.mjs")) {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const w of [1300, 390]) {
    const { p, ctx, errs } = await open(b, w, "light", route);
    await p.screenshot({ path: `${R}${tag}-${w}.png`, fullPage: true });
    const info = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth - innerWidth, desks: [...document.querySelectorAll(".dgroup")].map(g => `${g.id}${g.hidden ? "(h)" : ""}:${[...g.querySelectorAll("section.sec")].map(s => s.id + (s.hidden ? "(h)" : "")).join(",")}`) }));
    console.log(w, JSON.stringify(info), errs);
    await ctx.close();
  }
  await b.close();
}
