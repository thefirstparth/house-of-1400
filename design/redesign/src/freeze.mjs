// Render the prototype once and freeze it into one self-contained HTML file (the static mock).
// node freeze.mjs <route> <out.html>
import { chromium } from "/home/user/house-of-1400/node_modules/playwright-core/index.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { open } from "./shot.mjs";
const R = "/tmp/claude-0/qa/rd/", PUB = "/home/user/house-of-1400/public";
const route = process.argv[2] || "/", out = process.argv[3] || R + "redesign.html", label = process.argv[4] || "";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const { p, errs } = await open(b, 1300, "light", route);
const html = await p.evaluate(() => {
  // Your Desk comes from Gmail and Calendar: it stays in the private edition JSON, never in a file like this.
  document.querySelectorAll("#desk, details.desk, .desk, #deskBtn").forEach(n => n.remove());
  document.querySelectorAll("script").forEach(s => s.remove());
  document.querySelectorAll("[data-html]").forEach(n => n.removeAttribute("data-html"));
  return "<!doctype html>\n" + document.documentElement.outerHTML;
});
if (/Your Desk|details class="desk/.test(html)) throw new Error("Your Desk still present");
const mime = f => f.endsWith(".svg") ? "image/svg+xml" : f.endsWith(".webp") ? "image/webp" : f.endsWith(".png") ? "image/png" : "image/jpeg";
let s = html
  .replace(/<link rel="stylesheet" href="\/styles\.css[^"]*">/, `<style>${readFileSync(R + "styles.css", "utf8")}</style>`)
  .replace(/media="print" onload="this.media='all'"/g, 'media="all"')
  .replace(/(src|href)="(\/(?:art\/[^"?]+|bhide\.svg|favicon\.svg))(\?[^"]*)?"/g, (m, attr, path) => {
    const f = PUB + decodeURIComponent(path);
    return existsSync(f) ? `${attr}="data:${mime(f)};base64,${readFileSync(f).toString("base64")}"` : m;
  })
  .replace("</body>", `<script>${readFileSync(R + "mini.js", "utf8")}</script>\n</body>`);
// A thin strip saying what this file is.
s = s.replace(/<body([^>]*)>/, `<body$1><div style="background:#15140f;color:#f3f1ea;font:600 12.5px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">Redesign mock · built from the edition of ${label} with live figures from 30 Sep, 13:45 IST · not the live paper</div>`);
writeFileSync(out, s);
console.log(out, Math.round(s.length / 1024) + " KB", errs);
await b.close();
