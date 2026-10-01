import { chromium } from "../../node_modules/playwright-core/index.mjs";
const H = new URL(".", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY }, args: ["--ignore-certificate-errors"] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true })).newPage();
await p.goto("file://" + H + "page-one.html", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
await p.screenshot({ path: H + "p1-390-top.png" }); await b.close();
