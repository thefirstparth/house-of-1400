// Screenshot every poster view of today's paper, desktop and phone, into public/posters/latest/ with a
// manifest. Published with the site, the Google Apps Script in docs/drive-sync.gs copies each new set into
// Google Drive. Run by the 16:00 IST poster routine (docs/RUNBOOK.md, "Posters").
// Usage: node scripts/posters.mjs [--wait-minutes 60] [--any-date]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureProxy } from "./proxy.mjs";
import { SITE_URL } from "./remote.mjs";

ensureProxy();
const { chromium } = await import("playwright-core");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const WAIT_MIN = arg("--wait-minutes", 60);
const OUT = "public/posters/latest";
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1. Wait for today's edition to be live (a daily run may still be finishing).
let edition = null;
for (let waited = 0; ; waited += 5) {
  try { edition = (await (await fetch(`${SITE_URL}/api/health`, { signal: AbortSignal.timeout(15000) })).json()).edition; } catch {}
  if (edition === today || process.argv.includes("--any-date")) break;
  if (waited >= WAIT_MIN) { console.error(`posters: today's edition (${today}) is not live after ${WAIT_MIN} min (site has ${edition}); not capturing.`); process.exit(2); }
  console.error(`posters: site has ${edition}, waiting for ${today}…`);
  await sleep(5 * 60 * 1000);
}

// 2. In a Claude Code cloud session, TLS is re-terminated by the egress proxy; Chromium must trust the proxy's
//    CA through the NSS store (never by ignoring certificate errors).
const CA = "/root/.ccr/agent-proxy-ca.crt";
if (existsSync(CA)) {
  try {
    try { execSync("command -v certutil", { stdio: "ignore" }); }
    catch { execSync("(apt-get install -y -q libnss3-tools || (apt-get update -q && apt-get install -y -q libnss3-tools)) >/dev/null 2>&1", { stdio: "ignore", shell: "/bin/bash" }); }
    const db = `sql:${process.env.HOME}/.pki/nssdb`;
    mkdirSync(`${process.env.HOME}/.pki/nssdb`, { recursive: true });
    try { execSync(`certutil -L -d ${db} -n ccr-agent-proxy`, { stdio: "ignore" }); }
    catch { execSync(`certutil -N -d ${db} --empty-password 2>/dev/null || true; certutil -A -d ${db} -n ccr-agent-proxy -t "C,," -i ${CA}`, { stdio: "ignore", shell: "/bin/bash" }); }
  } catch (e) { console.error(`posters: could not add the proxy CA to NSS (${e.message}); screenshots may fail`); }
}

// 3. Capture.
const VIEWS = [
  ["today", "Today, one screen"], ["edition", "The edition, framed"], ["mast", "Masthead"], ["night", "Masthead, night"], ["clock", "Clock and live strip"],
];
const DEVICES = [
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ["phone", { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
];
const exe = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].find(p => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const files = [];
for (const [dev, opts] of DEVICES) {
  const ctx = await browser.newContext({ ...opts, timezoneId: "Asia/Kolkata", colorScheme: "light" });
  const page = await ctx.newPage();
  for (const [key, title] of VIEWS) {
    await page.goto(`${SITE_URL}/?poster=${key}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    await sleep(6000); // live blocks fill in
    // Today and The edition fit one screen by design; anything taller is still captured whole.
    const full = await page.evaluate(() => document.getElementById("poster")?.scrollHeight || 0);
    const vp = opts.viewport;
    if (full > vp.height + 4) { await page.setViewportSize({ width: vp.width, height: full }); await sleep(800); }
    const name = `${edition}-${key}-${dev}.jpg`;
    await page.screenshot({ path: `${OUT}/${name}`, type: "jpeg", quality: 85 });
    files.push({ name, title: `${edition} · ${title} · ${dev}` });
    await page.setViewportSize(vp);
    console.error(`posters: ${name}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ date: edition, captured_at: new Date().toISOString(), site: SITE_URL, files }, null, 2) + "\n");
console.error(`posters: ${files.length} files for ${edition} in ${OUT}`);
