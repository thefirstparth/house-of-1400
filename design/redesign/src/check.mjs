// Open the frozen file itself (no server, no network except fonts) and check it works: no errors, no sideways scroll,
// the desk bar follows the page, the tabs and "more" buttons work, at laptop and phone widths.
import { chromium } from "/home/user/house-of-1400/node_modules/playwright-core/index.mjs";
const f = process.argv[2], tag = process.argv[3] || "chk";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, th] of [[1300, "light"], [390, "light"], [390, "dark"]]) {
  const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 900 }, colorScheme: th, deviceScaleFactor: w < 500 ? 2 : 1 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + f); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const out = { sw: document.documentElement.scrollWidth - innerWidth, h: document.documentElement.scrollHeight, imgs: [...document.images].filter(i => i.src.startsWith("data:") && !i.naturalWidth).length };
    const g = document.getElementById("dg-sport"); scrollTo({ top: g.offsetTop, behavior: "instant" }); await new Promise(r => setTimeout(r, 400));
    out.cur = document.querySelector("#idx .dtabs a.cur")?.textContent;
    out.chips = [...document.querySelectorAll("#idx .dchips:not([hidden]) a")].map(a => a.textContent).join(",");
    document.querySelector('[data-comp="ucl"]')?.click(); out.ucl = !document.getElementById("cpan-ucl")?.hidden;
    document.querySelector('.cpan:not([hidden]) [data-tmore]')?.click(); out.full = document.querySelectorAll(".cpan:not([hidden]) table.liga tr:not([hidden])").length;
    return out;
  });
  console.log(w, th, JSON.stringify(r), errs);
  if (w === 390 && th === "dark") await p.screenshot({ path: `/tmp/claude-0/qa/rd/${tag}-dark.png` });
}
await b.close();
