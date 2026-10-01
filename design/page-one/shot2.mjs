// node design/page-one/shot2.mjs: screenshot the three Page One variants.
import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors"] });
for (const v of (process.argv[2] || "A,B,C").split(","))
for (const [w, h, theme] of [[1440, 820, "light"], [1280, 760, "light"], [1440, 820, "dark"], [390, 844, "light"]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: w < 500 ? 2 : 1, ignoreHTTPSErrors: true })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`file://${H}page-one-variants.html?v=${v}`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${H}v${v}-${w}-${theme}.png`, fullPage: w < 500 });
  const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight - document.querySelector(".switch").offsetHeight, vh: innerHeight, sw: document.documentElement.scrollWidth - innerWidth,
    clip: [...document.querySelectorAll("*")].filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").length }));
  console.log(v, w, h, theme, errs, JSON.stringify(m));
}
await b.close();
