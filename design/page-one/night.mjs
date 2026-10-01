// node design/page-one/night.mjs: the weather block at 21:30 (moon) in light and dark.
import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const theme of ["light", "dark"]) for (const at of ["14:08", "21:30", "04:45"]) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 820 }, colorScheme: theme, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(`file://${H}page-one-variants.html?v=B&at=${at}`); await p.waitForTimeout(800);
  await p.locator(".stack .blk").first().screenshot({ path: `${H}arc-${at.replace(":", "")}-${theme}.png` });
  console.log(theme, at, errs, await p.locator(".arc").first().getAttribute("aria-label"));
}
await b.close();
