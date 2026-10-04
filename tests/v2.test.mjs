// The new design (v2, behind ?v2 from 1 Oct 2026): it is assembled from app.js and styles.css without changing them,
// and the switch in index.html writes the old design's own tags, unchanged, for a reader of v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assemble, withV2 } from "../v2/assemble.mjs";

const root = new URL("../", import.meta.url).pathname;

test("every v2 patch finds its anchor in app.js and the result parses", () => {
  const { js, css, head } = assemble();
  const f = join(mkdtempSync(join(tmpdir(), "v2-")), "v2.mjs");
  writeFileSync(f, js);
  execFileSync(process.execPath, ["--check", f]);
  assert.match(js, /function deskOpener\(\)/);
  assert.match(js, /sportGroups\(list\)/);
  assert.match(css, /@font-face\{font-family:"Newsreader"/);
  assert.doesNotMatch(css, /fonts\.googleapis/);
  assert.match(head, /id="dtabs"/);
});

test("a changed app.js fails loudly, so the build ships v1 alone", () => {
  assert.throws(() => assemble({ app: readFileSync(root + "public/app.js", "utf8").replace("function render() {", "function draw() {") }), /anchor missing/);
});

test("the switch: v1 readers get the very same tags; v2 its own; edition pages and the archive switch", () => {
  const html = readFileSync(root + "public/index.html", "utf8").replace('"/app.js"', '"/app.js?v=1"').replace('"/styles.css"', '"/styles.css?v=1"');
  const out = withV2(html, "<header id=\"dtop\"></header>", "/v2.js?v=2", "/v2.css?v=2");
  const writes = [...out.matchAll(/document\.write\(window\.H1400V2\?("(?:[^"\\]|\\.)*"):("(?:[^"\\]|\\.)*")\)/g)].map(m => [JSON.parse(m[1]), JSON.parse(m[2])]);
  assert.equal(writes.length, 2);
  const [links, script] = writes;
  assert.ok(html.includes(links[1]) && links[1].includes("fonts.googleapis.com") && links[1].includes('/styles.css?v=1'));
  assert.equal(script[1], '<script type="module" src="/app.js?v=1"></script>');
  assert.equal(links[0], '<link rel="stylesheet" href="/v2.css?v=2">');
  assert.equal(script[0], '<script type="module" src="/v2.js?v=2"></script>');
  // the decision itself, run as the browser would
  const decide = out.match(/<script>(\(function\(\)\{var q=location\.search[\s\S]*?)<\/script>/)[1];
  const run = (path, search, stored = null) => {
    const store = new Map(stored ? [["h1400-design", stored]] : []), w = {};
    new Function("location", "localStorage", "window", decide)({ pathname: path, search }, { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, w);
    return [w.H1400V2, store.get("h1400-design") ?? null];
  };
  // v2 is the default since 4 Oct 2026; ?v1 chooses the old design on this device, ?v2 forgets that
  assert.deepEqual(run("/", ""), [true, null]);
  assert.deepEqual(run("/", "", "v2"), [true, "v2"]); // a device that opted in before the switch
  assert.deepEqual(run("/e/2026-09-25", ""), [true, null]);
  assert.deepEqual(run("/archive", ""), [true, null]); // the archive calendar is in the new design (2 Oct)
  assert.deepEqual(run("/editor", ""), [false, null]);
  assert.deepEqual(run("/poster/today", ""), [false, null]);
  assert.deepEqual(run("/", "?v1"), [false, "v1"]);
  assert.deepEqual(run("/", "", "v1"), [false, "v1"]);
  assert.deepEqual(run("/", "?v2", "v1"), [true, null]);
  assert.deepEqual(run("/", "?poster=front"), [false, null]); // the 16:00 poster run stays in the old design
});
