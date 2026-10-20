// The Sport app's Glass family look (S2, the default from 20 Oct 2026; docs/DECISIONS.md): /sport ships glass.css over
// app.css with html.sglass set before first paint, ?classic keeps the V3 look on a device (localStorage sport-look),
// ?classic=off ends it, and every rule of glass.css is scoped under html.sglass, so without the class the app is V3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const html = readFileSync(`${root}public/sport/index.html`, "utf8");
const css = readFileSync(`${root}public/sport/glass.css`, "utf8");
const sw = readFileSync(`${root}public/sport-sw.js`, "utf8");

// the selectors of a stylesheet outside @font-face, split at top-level commas
function selectors(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = []; let buf = "", depth = 0, skip = false;
  for (const ch of src) {
    if (ch === "{") { const head = buf.trim(); buf = ""; depth++; if (head.startsWith("@font-face")) skip = true; else if (!head.startsWith("@") && !skip) out.push(head); }
    else if (ch === "}") { depth--; buf = ""; if (!depth) skip = false; }
    else if (ch === ";" && depth) buf = "";
    else buf += ch;
  }
  const split = s => { const r = [""]; let d = 0; for (const c of s) { if (c === "(") d++; if (c === ")") d--; if (c === "," && !d) r.push(""); else r[r.length - 1] += c; } return r.map(x => x.trim()).filter(Boolean); };
  return out.flatMap(split);
}

test("/sport ships glass.css after app.css, with html.sglass set in the markup", () => {
  assert.match(html, /<html lang="en-IN" class="sglass">/);
  const app = html.indexOf('href="/sport/app.css"'), glass = html.indexOf('href="/sport/glass.css"');
  assert.ok(app > 0 && glass > app, "glass.css comes after app.css");
  assert.match(html, /<a class="np14" href="\/"[^>]*aria-label="The House of 1400, the paper"[^>]*>[\s\S]*?<img src="\/sport\/np-1400.svg"/);
  assert.ok(existsSync(`${root}public/sport/np-1400.svg`));
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html + css), "fonts are self-hosted");
  assert.ok(!/\u2014/.test(html), "no em dashes");
});

test("every rule of glass.css sits under html.sglass (V3 is untouched without it)", () => {
  const sels = selectors(css);
  assert.ok(sels.length > 150);
  const loose = sels.filter(s => !s.startsWith("html.sglass") && s !== ".np14");
  assert.deepEqual(loose, []);
  for (const [, f] of css.matchAll(/url\("\/sport\/fonts\/([^"]+)"\)/g)) assert.ok(existsSync(`${root}public/sport/fonts/${f}`), f);
  for (const l of ["libre-franklin", "newsreader", "unifrakturmaguntia"]) assert.ok(existsSync(`${root}public/sport/fonts/LICENSE-${l}.txt`), l);
});

test("?classic turns the V3 look on for the device, ?classic=off turns it off, S2 is the default", () => {
  const script = html.match(/<script>([^<]*sport-look[^<]*)<\/script>/)[1];
  const run = (search, stored = null) => {
    const cls = new Set(["sglass"]), store = new Map(stored ? [["sport-look", stored]] : []);
    const document = { documentElement: { classList: { remove: c => cls.delete(c), add: c => cls.add(c), contains: c => cls.has(c) } } };
    const localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
    new Function("document", "localStorage", "location", script)(document, localStorage, { search });
    return { glass: cls.has("sglass"), stored: store.get("sport-look") ?? null };
  };
  assert.deepEqual(run(""), { glass: true, stored: null });
  assert.deepEqual(run("?classic"), { glass: false, stored: "classic" });
  assert.deepEqual(run("", "classic"), { glass: false, stored: "classic" });
  assert.deepEqual(run("?classic=off", "classic"), { glass: true, stored: null });
  assert.deepEqual(run("?classical"), { glass: true, stored: null });
  // the look is settled before the saved theme is applied (both before first paint)
  assert.ok(html.indexOf("sport-look") < html.indexOf('localStorage.getItem("sport-theme")'));
});

test("the dark switch stays, with the warm charcoal tokens", () => {
  assert.match(html, /id="theme"/);
  const dark = css.match(/html\.sglass:root\[data-theme="dark"\]\{([^}]*)\}/)[1];
  assert.match(dark, /--bg:#1c1b18/); assert.match(dark, /--surface:#262521/);
});

test("the service worker's new cache carries the new files", () => {
  const cache = sw.match(/const CACHE = "([^"]+)"/)[1];
  assert.notEqual(cache, "sport-v3f");
  const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1]);
  for (const f of ["/sport/glass.css", "/sport/np-1400.svg", "/sport/fonts/libre-franklin-latin-wght-normal.woff2", "/sport/fonts/newsreader-latin-opsz-normal.woff2", "/sport/fonts/unifrakturmaguntia-latin-400-normal.woff2"]) assert.ok(shell.includes(f), f);
  for (const f of shell) if (f !== "/sport") assert.ok(existsSync(`${root}public${f}`), f);
});
