// node design/page-one/shot3.mjs: B on laptops and big monitors.
import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors"] });
for (const v of (process.argv[2] || "B").split(","))
for (const [w, h] of [[1280, 720], [1440, 820], [1536, 864], [1920, 1080], [2000, 1073], [2560, 1440], [3440, 1440]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`file://${H}page-one-variants.html?v=${v}`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${H}big-${v}-${w}x${h}.png` });
  const m = await p.evaluate(() => { const bar = document.querySelector(".switch").offsetHeight, cols = [...document.querySelectorAll(".vB .body > section.news, .vB .stack")].map(c => Math.round(c.getBoundingClientRect().bottom));
    return { fill: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), zoom: document.getElementById("page").style.zoom, lines: document.querySelectorAll("ol.min li").length, sw: document.documentElement.scrollWidth - innerWidth, cols }; });
  console.log(v, `${w}x${h}`, errs, JSON.stringify(m));
}
await b.close();
