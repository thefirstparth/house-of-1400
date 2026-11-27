// The new look on trial (Parth, 27 Nov 2026: "don't make it live yet; first show me how today's newspaper would look"):
// behind /?trial only, light, on the Glass look; without the switch the paper is exactly as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { assemble, withV2 } from "../v2/assemble.mjs";
const root = new URL("../", import.meta.url).pathname;
const FILES = ["v2/trial.css", "v2/trial-money.css", "v2/trial-bets.css", "v2/trial-sky.css", "v2/trial-sport.css"];

test("trial: /?trial adds the Glass look and the trial, light, and is remembered; ?trial=off clears it; v1 and posters never get it", () => {
  const html = readFileSync(root + "public/index.html", "utf8"), { head } = assemble();
  const out = withV2(html, head, "/v2.js?v=1", "/v2.css?v=1");
  const src = out.match(/<script>(\(function\(\)\{var q=location\.search,k="h1400-trial"[\s\S]*?)<\/script>\n<\/head>/);
  assert.ok(src, "the trial's switch is the last script in the head");
  const run = (search, { v2 = true, stored = null } = {}) => {
    const store = new Map(stored ? [["h1400-trial", stored]] : []), classes = new Set(), attrs = {};
    const doc = { documentElement: { classList: { add: (...c) => c.forEach(x => classes.add(x)) }, setAttribute: (k, v) => (attrs[k] = v) }, createElement: () => ({}), head: { appendChild: () => {} }, querySelectorAll: () => [] };
    new Function("location", "localStorage", "window", "document", src[1])({ search }, { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, { H1400V2: v2 }, doc);
    return { classes, attrs, store };
  };
  const on = run("?trial");
  assert.ok(on.classes.has("look-trial") && on.classes.has("look-glass"));
  assert.equal(on.attrs["data-theme"], "light");
  assert.equal(on.store.get("h1400-trial"), "on");
  assert.ok(run("", { stored: "on" }).classes.has("look-trial"), "remembered on this device");
  const off = run("?trial=off", { stored: "on" });
  assert.ok(!off.classes.has("look-trial") && !off.store.has("h1400-trial"));
  assert.equal(run("", {}).classes.size, 0, "without the switch, nothing changes");
  assert.equal(run("?trial", { v2: false }).classes.size, 0, "the old design and posters never get it");
});

// a selector list split at its own commas, not those inside :is(), :not() or :where()
const topLevel = r => { const out = []; let d = 0, cur = ""; for (const ch of r) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
test("trial: every rule is under html.look-trial, and every module draws only while the trial is on", () => {
  for (const f of FILES) {
    const css = readFileSync(root + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.split("}").map(r => r.split("{")[0].trim()).filter(r => r && !r.startsWith("@") && !/^(from|to|\d+%)$/.test(r))) {
      for (const sel of topLevel(rule).map(x => x.trim()).filter(Boolean)) assert.match(sel, /^html(:not\()?\.look-trial|^html\.look-trial|^html:not\(\.look-trial\)/, `${f}: "${sel}" is not under html.look-trial`);
    }
  }
  const js = readFileSync(root + "v2/trial.js", "utf8");
  assert.match(js, /function trialPaint\(\) \{\n  if \(!trialOn\(\)\) return;/);
  const { js: app } = assemble();
  assert.match(app, /if \(trialOn\(\)\) Object\.assign\(map, TRIAL_BLOCKS\);/);
  assert.match(app, /if \(trialOn\(\)\) for \(const \[k, q\] of TRIAL_KEYS\)/);
  assert.match(app, /headingOrder\(\); trialPaint\(\);/);
});

test("trial: the outlets' logos are stored with the paper, and the new faces are self-hosted", () => {
  const index = JSON.parse(readFileSync(root + "public/logos/index.json", "utf8"));
  assert.ok(Object.keys(index).length >= 50, "most outlets have a logo");
  for (const h of ["thehindu.com", "bbc.co.uk", "theguardian.com", "aljazeera.com"]) assert.ok(index[h] && existsSync(`${root}public/logos/${h}.png`), h);
  for (const f of ["schibsted-grotesk-latin-wght-normal", "schibsted-grotesk-latin-ext-wght-normal"]) assert.ok(existsSync(`${root}v2/fonts/${f}.woff2`), f);
  assert.match(assemble().css, /font-family:"Schibsted Grotesk"/);
});
