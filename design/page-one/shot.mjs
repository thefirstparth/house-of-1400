import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors"] });
for (const [w, h, theme] of [[1440, 820, "light"], [1280, 760, "light"], [1440, 820, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: w < 500 ? 2 : 1, ignoreHTTPSErrors: true })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + H + "page-one.html", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${H}p1-${w}-${theme}.png`, fullPage: w < 500 });
  const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, sw: document.documentElement.scrollWidth - innerWidth }));
  if (w === 1440 && theme === "light") { await p.goto("file://" + H + "page-one.html#/sport"); await p.waitForTimeout(800); await p.screenshot({ path: `${H}desk-${w}.png` }); }
  console.log(w, h, theme, errs, JSON.stringify(m));
}
await b.close();
