// node v2/qa-summary.mjs <tag>: the QA matrix's report (v2/shots/<tag>/report.json) as one row per device: Page One's
// scale and whether it fits, the type as read, and every problem found on any desk.
import { readFileSync } from "node:fs";
const H = new URL("../", import.meta.url).pathname, tag = process.argv[2] || "matrix";
const R = JSON.parse(readFileSync(`${H}v2/shots/${tag}/report.json`, "utf8"));
const src = readFileSync(`${H}v2/shot.mjs`, "utf8"), DEV = eval("(" + src.match(/const DEVICES = (\{[\s\S]*?\});/)[1] + ")");
const rows = [];
for (const [name, spec] of Object.entries(DEV)) {
  const keys = Object.keys(R).filter(k => k.startsWith(spec + "-light-"));
  if (!keys.length) continue;
  const one = R[`${spec}-light-one`] || {}, desks = keys.filter(k => !k.endsWith("-one")).map(k => R[k]), all = keys.map(k => [k.split("-").pop(), R[k]]);
  const issues = [];
  for (const [d, r] of all) {
    if (r.sideways > 0) issues.push(`${d}: ${r.sideways}px sideways`);
    if (r.overlaps?.length) issues.push(`${d}: overlap ${r.overlaps.slice(0, 2).join("; ")}`);
    if (r.tables) issues.push(`${d}: table too wide (${r.tables})`);
    if (r.wide?.length) issues.push(`${d}: wider than screen ${r.wide.slice(0, 2).join(", ")}`);
    if (r.taps?.length) issues.push(`${d}: small taps ${r.taps.slice(0, 2).join(", ")}`);
    if (parseInt(r.art) > 62) issues.push(`${d}: drawing ${r.art} of screen`);
  }
  const errs = R[`${spec}-light`]?.errs || [];
  if (errs.length) issues.push(`errors: ${errs.slice(0, 2).join("; ")}`);
  const body = desks.map(r => r.type?.body).filter(Boolean), head = desks.map(r => r.type?.head).filter(Boolean);
  rows.push({ name, spec, zoom: one.zoom ? Number(one.zoom).toFixed(2) : one.onescreen === "phone" ? "phone" : "1.00", fits: one.onescreen, p1body: one.type?.body, deskBody: body.length ? Math.min(...body) : null, deskHead: head.length ? Math.min(...head) : null, tiny: [...new Set(desks.flatMap(r => r.tiny || []))].length, issues });
}
console.log("device | window | Page One scale | fits | Page One text | desk text | desk headline | issues");
for (const r of rows) console.log(`${r.name} | ${r.spec} | ${r.zoom} | ${r.fits} | ${r.p1body ?? "-"} | ${r.deskBody ?? "-"} | ${r.deskHead ?? "-"} | ${r.issues.length ? r.issues.join(" / ") : "none"}`);
