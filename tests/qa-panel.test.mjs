// The QA panel's items (Parth, 20 Oct 2026: "all as recommended"), the parts that can be checked without a browser:
// the night tag on a late start, the rupee in neutral ink, Page One's rule for dropping a line, Back and Forward.
// Each piece is taken from v2/layer.js as written and run on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assemble } from "../v2/assemble.mjs";

const root = new URL("../", import.meta.url).pathname;
const SRC = readFileSync(root + "v2/layer.js", "utf8");
// one top-level declaration, from its first line to its closing brace or semicolon at depth 0
function piece(start) {
  const at = SRC.indexOf(start); assert.ok(at >= 0, `layer.js has no ${start}`);
  let d = 0, q = null;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if ("({[".includes(c)) d++;
    else if (")}]".includes(c)) { d--; if (d === 0 && c === "}" && start.startsWith("function")) return SRC.slice(at, i + 1); }
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated " + start);
}
const TZ = "Asia/Kolkata";
const fmt = (iso, o, tz = TZ) => new Date(iso).toLocaleString("en-GB", { timeZone: tz, hour12: false, ...o });
const istTime = iso => fmt(iso, { hour: "2-digit", minute: "2-digit" });
const esc = s => String(s);

test("a start from midnight to 05:59 IST is tagged with the night before; the date stays IST's", () => {
  const nightOf = new Function("fmt", "istTime", `${piece("const nightOf =")} return nightOf;`)(fmt, istTime);
  assert.equal(nightOf("2026-10-21T19:00:00Z"), "Wed night"); // Thu 22 Oct, 00:30 IST: Madrid v Leipzig
  assert.equal(nightOf("2026-10-25T20:00:00Z"), "Sun night"); // Mon 26 Oct, 01:30 IST: the Clásico
  assert.equal(nightOf("2026-10-22T00:29:00Z"), "Wed night"); // 05:59 IST
  assert.equal(nightOf("2026-10-22T00:30:00Z"), ""); // 06:00 IST is the morning
  assert.equal(nightOf("2026-10-21T18:29:00Z"), ""); // 23:59 IST Wednesday is that evening
  assert.equal(nightOf("not a date"), "");
  const nightTag = new Function("nightOf", "esc", `${piece("const nightTag =")} return nightTag;`)(nightOf, esc);
  assert.equal(nightTag("2026-10-21T19:00:00Z"), ' <span class="ngt">Wed night</span>');
  assert.equal(nightTag("2026-10-21T14:00:00Z"), "");
});

test("the rupee's moves are in neutral ink in the Ledger, every period, and only the rupee's", () => {
  const CFG = JSON.parse(readFileSync(root + "config/house.json", "utf8"));
  const fxNeutral = new Function("CFG", `${piece("const fxNeutral =")} return fxNeutral;`)(CFG);
  assert.equal(fxNeutral("USD/INR"), true);
  for (const n of ["Brent crude", "Gold 24K", "Bitcoin", "Sensex"]) assert.equal(fxNeutral(n), false);
  const { js, css } = assemble();
  assert.match(js, /const nt = fxNeutral\(name\), col = nt \? "var\(--muted\)"/);
  assert.match(js, /<tr\$\{nt \? ' class="neutral"' : ""\}><td class="ix">/);
  assert.match(css, /\.board tr\.neutral :is\(td,small\)\.up,\.board tr\.neutral :is\(td,small\)\.dn\{color:var\(--ink\)\}/);
  // Page One's line for the rupee carries no up or down class either
  assert.match(SRC, /row\("USD\/INR", `₹\$\{fx\.price\.toFixed\(2\)\}`, fx\.change_pct, null, fx, ""\)/);
});

test("Page One drops a line of the day in a minute only when that shortens the tallest column", () => {
  const p1Trim = new Function(`${piece("function p1Trim(")} return p1Trim;`)();
  // the page as heights: the day in a minute is 40px a line; another column is `other` tall; the screen is `screen`
  const run = (lines, other, screen, min = 5) => {
    let n = lines; const tall = () => Math.max(n * 40, other), fits = () => tall() <= screen, set = k => { n = k; };
    return p1Trim(n, min, fits, tall, set);
  };
  assert.equal(run(9, 500, 330), 9); // another column is the tallest: every line stays
  assert.equal(run(9, 200, 300), 7); // the news column is the tallest: lines go until it fits
  assert.equal(run(9, 200, 100), 5); // never below five
  assert.equal(run(9, 330, 300), 8); // a line goes while it helps, and no further once another column is tallest
  assert.equal(run(9, 200, 400), 9); // it fits: nothing goes
  // two columns of lines: one line less leaves the column as tall, two lines less shortens it
  let n = 10; const tall2 = () => Math.ceil(n / 2) * 40, fits2 = () => tall2() <= 160;
  assert.equal(p1Trim(n, 5, fits2, tall2, k => { n = k; }), 8);
});

test("a change of desk pushes a history entry; Back, Forward and the first showing do not", () => {
  const histMode = new Function(`${piece("const histMode =")} return histMode;`)();
  assert.equal(histMode(false, "push"), "push"); // a tap on another desk
  assert.equal(histMode(true, "push"), "replace"); // a jump within the desk
  assert.equal(histMode(false, "pop"), null); // Back or Forward: the address is already right
  assert.equal(histMode(true, undefined), "replace"); // the first showing
  const show = piece("function showDesk(");
  assert.match(show, /history\[mode === "push" \? "pushState" : "replaceState"\]/);
  assert.match(SRC, /addEventListener\("popstate", fromAddress\)/);
  assert.match(SRC, /showDesk\(a\.dataset\.desk, a\.dataset\.to, !!a\.dataset\.open, "push"\)/);
  // the desk in the address is read lowercased
  assert.match(piece("const deskInHash ="), /location\.hash\.toLowerCase\(\)/);
  // a jump within a desk keeps the desk in the address
  assert.match(assemble().js, /if \(t\.dataset\.go\) \{ e\.preventDefault\(\);/);
});
