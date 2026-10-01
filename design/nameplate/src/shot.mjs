// node design/nameplate/src/shot.mjs: drive every sample in a real browser (rest, pointer over, mid-tap, after) at
// laptop and phone width, light and dark; record page errors, sideways scroll and how long a frame takes.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
const H = new URL("../../../", import.meta.url).pathname, O = H + "design/nameplate/shots/";
mkdirSync(O, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = {};
for (const [w, h, theme, touch] of [[1300, 760, "light", false], [390, 760, "light", true], [1300, 760, "dark", false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  for (const v of ["1", "2", "3", "4", "5", "12"]) {
    await p.goto(`file://${H}design/nameplate/nameplate-samples.html?v=${v}`); await p.waitForTimeout(1200);
    const tag = `${w}-${theme}-${v}`, plate = p.locator(".plate"), num = p.locator("#num > *").first();
    const box = await num.boundingBox();
    const shot = n => plate.screenshot({ path: `${O}${tag}-${n}.png` });
    if (v === "5") { await p.waitForTimeout(500); await shot("a-arrive"); await p.waitForTimeout(2500); } // rolling to the time now
    await shot("1-rest");
    if (!touch) { await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5); await p.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 8 }); await p.waitForTimeout(250); await shot("2-pointer"); }
    const t = [box.x + box.width * 0.2, box.y + box.height * 0.5];
    if (touch) await p.touchscreen.tap(...t); else await p.mouse.click(...t);
    await p.waitForTimeout(v === "12" ? 380 : 180); await shot("3-tap");
    await p.waitForTimeout(1500); await shot("4-after");
    // frame cost of the canvas options while something moves
    const ms = await p.evaluate(() => new Promise(res => { let n = 0, t0 = performance.now(); const f = () => (++n < 60 ? requestAnimationFrame(f) : res((performance.now() - t0) / 60)); requestAnimationFrame(f); }));
    report[tag] = { frame_ms: Math.round(ms * 10) / 10, sideways: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), cap: await p.locator("#cap").innerText() };
    if (!touch) await p.mouse.move(5, 5);
  }
  report[`${w}-${theme}`] = { errs };
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v));
await b.close();
