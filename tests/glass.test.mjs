// The Glass look (Direction 10, behind /?glass from 20 Oct 2026; v2/README.md): the switch is in every edition page the
// build writes, it is remembered per device, ?v1 still wins, and every rule of v2/glass.css is scoped under
// html.look-glass, so a reader without the switch sees v2 exactly as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assemble, withV2 } from "../v2/assemble.mjs";

const root = new URL("../", import.meta.url).pathname;

// every selector of a stylesheet, with the at-rules it sits in (comments dropped; @font-face and the like have none)
function selectors(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [], stack = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") {
      const head = buf.trim(); buf = "";
      if (head.startsWith("@")) stack.push({ at: head });
      else { stack.push({ rule: head }); out.push({ sel: head, within: stack.filter(s => s.at).map(s => s.at) }); }
    } else if (ch === "}") { stack.pop(); buf = ""; }
    else if (ch === ";" && !stack.at(-1)?.rule) buf = "";
    else buf += ch;
  }
  return out;
}
// a selector list split at its top-level commas (not those inside :is(), :where(), :not() or :has())
const split = sel => { const out = [""]; let d = 0; for (const ch of sel) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) out.push(""); else out[out.length - 1] += ch; } return out.map(s => s.trim()).filter(Boolean); };

test("every rule in v2/glass.css is scoped under html.look-glass", () => {
  const rules = selectors(readFileSync(root + "v2/glass.css", "utf8"));
  assert.ok(rules.length > 50, "glass.css has its rules");
  const loose = rules.flatMap(r => split(r.sel)).filter(s => !/^html\.look-glass(?![\w-])/.test(s));
  assert.deepEqual(loose, []);
});

test("the build appends glass.css to /v2.css, after v2's own rules", () => {
  const { css } = assemble();
  const glass = readFileSync(root + "v2/glass.css", "utf8");
  assert.ok(css.endsWith(glass), "glass.css closes /v2.css");
  assert.ok(css.indexOf(readFileSync(root + "v2/v2.css", "utf8")) < css.indexOf(glass));
  // nothing in /v2.css mentions the look except glass.css itself
  assert.equal(css.slice(0, css.length - glass.length).includes("look-glass"), false);
});

test("the switch: /?glass turns the look on and the device remembers it, ?glass=off turns it off, ?v1 still wins", () => {
  const html = readFileSync(root + "public/index.html", "utf8");
  const { head } = assemble();
  const out = withV2(html, head, "/v2.js?v=1", "/v2.css?v=1");
  assert.match(out, /h1400-look/);
  assert.match(out, /look-glass/);
  // it runs last in the head, after the saved Night/Day choice, so the look's one theme wins
  const glass = out.match(/<script>(\(function\(\)\{var q=location\.search,k="h1400-look"[\s\S]*?)<\/script>\n<\/head>/);
  assert.ok(glass, "the glass script sits just before </head>");
  assert.ok(out.indexOf('localStorage.getItem("h1400-theme")') < out.indexOf("h1400-look"));
  const run = (search, { v2 = true, stored = null } = {}) => {
    const store = new Map(stored ? [["h1400-look", stored]] : []), classes = new Set(), attrs = {};
    const doc = { documentElement: { classList: { add: c => classes.add(c) }, setAttribute: (k, v) => (attrs[k] = v) } };
    new Function("location", "localStorage", "window", "document", glass[1])({ search }, { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, { H1400V2: v2 }, doc);
    return [classes.has("look-glass"), attrs["data-theme"] || null, store.get("h1400-look") ?? null];
  };
  assert.deepEqual(run(""), [false, null, null]); // the default is unchanged
  assert.deepEqual(run("?glass"), [true, "light", "glass"]);
  assert.deepEqual(run("?glass=1&x"), [true, "light", "glass"]);
  assert.deepEqual(run("", { stored: "glass" }), [true, "light", "glass"]); // remembered on this device
  assert.deepEqual(run("?glass=off", { stored: "glass" }), [false, null, null]);
  assert.deepEqual(run("?v1&glass", { v2: false }), [false, null, "glass"]); // ?v1 wins; the choice waits for v2
  assert.deepEqual(run("?glassy"), [false, null, null]);
});

test("the layer keeps the look's behaviour behind its class", () => {
  const { js } = assemble();
  assert.match(js, /const GLASS = document\.documentElement\.classList\.contains\("look-glass"\)/);
  assert.match(js, /\$\{GLASS \? `<a href="\/\?glass=off">Back to the current design<\/a>` : ""\}/);
  assert.match(js, /if \(GLASS\) mode = "light";/);
});
