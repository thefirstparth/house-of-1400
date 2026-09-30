import { chromium } from "/home/user/house-of-1400/node_modules/playwright-core/index.mjs";
import { open } from "./shot.mjs";
const R = "/tmp/claude-0/qa/rd/", tag = process.argv[2] || "v", w = Number(process.argv[3] || 1300), theme = process.argv[4] || "light";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const { p, errs } = await open(b, w, theme, process.argv[5] || "/");
await p.screenshot({ path: `${R}${tag}-${w}-top.png` });
for (const id of await p.$$eval(".dgroup:not([hidden])", g => g.map(x => x.id))) {
  await p.evaluate(id => { const el = document.getElementById(id); scrollTo({ top: el.getBoundingClientRect().top + scrollY - 100, behavior: "instant" }); }, id);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${R}${tag}-${w}-${id}.png` });
}
console.log(errs);
await b.close();
