// node design/page-one/shot-final.mjs: Page One B with the wordmark, at phone, laptop and monitor sizes, light and dark.
// For each: the page, then the nameplate at rest, under the pointer, mid-tap and after; page errors, sideways scroll,
// whether it is one screen (laptop and up), the editor's lines printed and the page's zoom.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
const H = new URL(".", import.meta.url).pathname, O = H + "final/"; mkdirSync(O, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = {};
for (const [w, h, theme] of [[1280, 720, "light"], [1440, 900, "light"], [1440, 900, "dark"], [1920, 1080, "light"], [2560, 1440, "light"], [390, 844, "light"], [390, 844, "dark"]]) {
  const touch = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  await p.route(/^https?:/, r => r.abort());
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(`file://${H}page-one-variants.html?v=B`); await p.waitForTimeout(1800);
  const tag = `${w}x${h}-${theme}`;
  await p.screenshot({ path: `${O}${tag}-page.png` });
  const plate = p.locator(".plate"), cv = p.locator(".plate canvas");
  const box = await cv.boundingBox();
  await plate.screenshot({ path: `${O}${tag}-1-rest.png` });
  if (!touch) { await p.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5); await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45, { steps: 8 }); await p.waitForTimeout(300); await plate.screenshot({ path: `${O}${tag}-2-pointer.png` }); }
  const t = [box.x + box.width * 0.25, box.y + box.height * 0.5];
  if (touch) await p.touchscreen.tap(...t); else await p.mouse.click(...t);
  await p.waitForTimeout(260); await plate.screenshot({ path: `${O}${tag}-3-tap.png` });
  await p.waitForTimeout(900); await plate.screenshot({ path: `${O}${tag}-4-colours.png` });
  if (!touch) await p.mouse.move(2, 2);
  await p.waitForTimeout(5500); await plate.screenshot({ path: `${O}${tag}-5-settled.png` });
  report[tag] = await p.evaluate(() => ({
    errs: 0, sideways: document.documentElement.scrollWidth - innerWidth,
    oneScreen: innerWidth < 1000 ? "phone scrolls" : document.documentElement.scrollHeight <= innerHeight,
    lines: document.querySelectorAll(".vB ol.min a").length, zoom: document.getElementById("page").style.zoom || "1",
    canvas: (() => { const c = document.querySelector(".plate canvas"); return c ? `${c.style.width} x ${c.style.height}, backing ${c.width}x${c.height}` : "none"; })(),
    caption: document.querySelector(".plate .wmcap")?.innerText || "",
  }));
  report[tag].errs = errs;
  await ctx.close();
}
writeFileSync(O + "report.json", JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v));
await b.close();
