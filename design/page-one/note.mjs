// node design/page-one/note.mjs: B on a big day (editor's note), with the real fonts.
import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors"] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 820 }, ignoreHTTPSErrors: true })).newPage();
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(`file://${H}page-one-variants.html?v=B&note=1`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
console.log(errs, await p.evaluate(() => [document.fonts.check('52px "Playfair Display"'), document.documentElement.scrollHeight, innerHeight]));
await p.screenshot({ path: `${H}B-note-1440.png` }); await b.close();
