// The paper as an app (Parth, 20 Oct 2026: "do it with qa"; DECISIONS.md, v2/README.md "Install"): the manifest opens
// the paper in the Glass look, the worker (public/paper-sw.js) is network-first for everything that changes and never
// touches /api or the Sport app, its caches are versioned, and the Sport app keeps its own worker and scope. Also the
// QA panel's round-2 accessibility items (focus ring, desk chips, the skip link's landing, Money's small figures).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url).pathname;
const read = f => readFileSync(root + f, "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const index = read("public/index.html");
const SW = read("public/paper-sw.js");
// a PNG's own width and height (its IHDR)
const pngSize = f => { const b = readFileSync(root + f); assert.equal(b.toString("ascii", 1, 4), "PNG", `${f} is a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("the manifest: the paper opens standalone in the Glass look, scope /, Glass's ground", () => {
  assert.equal(manifest.name, "The House of 1400");
  assert.equal(manifest.short_name, "1400");
  assert.equal(manifest.start_url, "/?glass");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color.toLowerCase(), "#e3e0d9");
  assert.equal(manifest.background_color.toLowerCase(), "#e3e0d9");
  // the Glass look's ground is the same colour
  assert.match(read("v2/glass.css"), /--paper:#e3e0d9/i);
});

test("the manifest's icons are there at their sizes: 192, 512, a 512 maskable; and the 180 apple-touch-icon", () => {
  const want = [["192x192", undefined], ["512x512", undefined], ["512x512", "maskable"]];
  for (const [sizes, purpose] of want) {
    const i = manifest.icons.find(x => x.sizes === sizes && x.purpose === purpose);
    assert.ok(i, `an icon ${sizes} ${purpose || ""}`);
    assert.equal(i.type, "image/png");
    assert.deepEqual(pngSize("public" + i.src), sizes.split("x").map(Number));
  }
  const apple = index.match(/<link rel="apple-touch-icon" href="([^"]+)">/);
  assert.ok(apple, "index.html names an apple-touch-icon");
  assert.deepEqual(pngSize("public" + apple[1]), [180, 180]);
});

test("index.html: the manifest, the home-screen meta, and the worker registered on the paper's pages, never on a poster", () => {
  assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(index, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(index, /<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
  assert.match(index, /<meta name="apple-mobile-web-app-title" content="1400">/);
  const reg = index.match(/<script>(\/\* the paper's network-first worker[\s\S]*?)<\/script>/);
  assert.ok(reg, "the registration script");
  const run = (pathname, search = "") => {
    const calls = []; let onload = null;
    const navigator = { serviceWorker: { register: (u, o) => { calls.push([u, o]); return Promise.resolve(); } } };
    new Function("location", "navigator", "addEventListener", reg[1])({ pathname, search }, navigator, (ev, fn) => { if (ev === "load") onload = fn; });
    if (onload) onload();
    return calls;
  };
  for (const [p, q] of [["/", ""], ["/", "?glass"], ["/today", ""], ["/e/2026-10-19", ""], ["/archive", ""], ["/", "?v1"]]) {
    const c = run(p, q);
    assert.equal(c.length, 1, `registers on ${p}${q}`);
    assert.equal(c[0][0], "/paper-sw.js"); assert.equal(c[0][1].scope, "/");
  }
  assert.equal(run("/", "?poster=today").length, 0, "not on a poster link");
  assert.equal(run("/poster/clock", "").length, 0, "not on /poster/");
});

// The worker, run in a sandbox with a pretend network and Cache Storage.
function worker({ online = true, body = () => "net" } = {}) {
  const ORIGIN = "https://paper.test";
  const stores = new Map(), handlers = {}, fetched = [];
  const abs = u => new URL(typeof u === "string" ? u : u.url, ORIGIN).href;
  const res = (b, status = 200) => ({ body: b, status, ok: status >= 200 && status < 300, type: "basic", clone() { return res(this.body, this.status); } });
  class Request { constructor(u, o = {}) { this.url = abs(u); this.method = o.method || "GET"; this.mode = o.mode || "cors"; this.cache = o.cache || "default"; } }
  const store = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (r, v) => { m.set(abs(r), v); },
      match: async r => m.get(abs(r)),
      keys: async () => [...m.keys()].map(url => ({ url })),
      delete: async r => m.delete(abs(r)),
      add: async r => { const v = await sandbox.fetch(r); m.set(abs(r), v); },
    };
  };
  const caches = {
    open: async n => store(n),
    match: async r => { for (const m of stores.values()) if (m.has(abs(r))) return m.get(abs(r)); },
    keys: async () => [...stores.keys()],
    delete: async n => stores.delete(n),
  };
  const sandbox = {
    URL, Promise, console,
    Request,
    caches,
    fetch: async r => { fetched.push(abs(r)); if (!sandbox.online) throw new TypeError("offline"); return res(body(abs(r))); },
    online,
    self: { location: new URL(ORIGIN), addEventListener: (ev, fn) => (handlers[ev] = fn), skipWaiting: async () => {}, clients: { claim: async () => {} } },
  };
  vm.createContext(sandbox);
  vm.runInContext(SW, sandbox);
  // an event: respondWith and waitUntil collected, then awaited
  const fire = async (ev, req) => {
    const waits = []; let responded = null;
    handlers[ev]({ request: req, respondWith: p => (responded = p), waitUntil: p => waits.push(p) });
    const out = responded ? await responded : undefined;
    await Promise.all(waits);
    return { responded: !!responded, out };
  };
  const get = (u, mode = "cors") => fire("fetch", new Request(u, { mode }));
  return { sandbox, stores, fire, get, fetched, Request, res, strategy: sandbox.strategy, CACHE: vm.runInContext("CACHE", sandbox) };
}

test("the worker's routing: network-first for the page, the edition, the config, art manifests; /api, Sport and posters untouched", () => {
  const { strategy } = worker();
  const net = ["/", "/?glass", "/today", "/e/2026-10-19", "/archive", "/content/latest.json", "/content/editions/2026-10-19.json", "/content/archive.json",
    "/config/house.json", "/art/2026-10-20/manifest.json", "/archive-days.json", "/editor.json", "/v2.js", "/manifest.webmanifest", "/art/2026-10-20/lead.webp"];
  for (const u of net) assert.equal(strategy(u), "network", u);
  const pass = ["/api/live/markets", "/api/live/weather?lat=1&lon=2", "/api/notify", "/api/podcast?k=1", "/sport", "/sport/", "/sport/app.js", "/sport/index.html",
    "/sport-sw.js", "/paper-sw.js", "/posters/latest/a.jpg", "/poster/clock", "/?poster=today", "/podcast/a/b", "/listen", "/listen/feed.xml", "https://a.espncdn.com/x.png", "https://fonts.googleapis.com/css2"];
  for (const u of pass) assert.equal(strategy(u), "pass", u);
  assert.equal(strategy("/content/latest.json", "POST"), "pass");
  for (const u of ["/v2.js?v=0123456789", "/v2.css?v=0123456789", "/app.js?v=ab", "/styles.css?v=ab", "/fonts/newsreader-latin-opsz-normal.woff2", "/icons/icon-192.png"]) assert.equal(strategy(u), "cache", u);
});

test("network first: online, a new edition always wins over the cached one (the 14:00 paper shows on the next open)", async () => {
  let edition = "A";
  const w = worker({ body: u => (u.endsWith("/content/latest.json") ? `edition ${edition}` : `page ${edition}`) });
  const a = await w.get("/content/latest.json");
  assert.equal(a.out.body, "edition A");
  edition = "B";
  const b = await w.get("/content/latest.json");
  assert.equal(b.out.body, "edition B", "the network's copy, not the cached A");
  const nav = await w.get("/", "navigate");
  assert.equal(nav.out.body, "page B");
  // and the cache now holds B for an offline open
  w.sandbox.online = false;
  assert.equal((await w.get("/content/latest.json")).out.body, "edition B");
});

test("offline: the last copy of the page and the edition; an edition page falls back to the shell; nothing cached for /api", async () => {
  const w = worker();
  await w.get("/?glass", "navigate");
  await w.get("/content/latest.json");
  const api = await w.get("/api/live/markets");
  assert.equal(api.responded, false, "the worker stays out of /api: the browser fetches it");
  w.sandbox.online = false;
  assert.equal((await w.get("/?glass", "navigate")).out.body, "net");
  assert.equal((await w.get("/e/2026-10-19", "navigate")).out.body, "net", "any edition page opens from the shell kept under /");
  assert.equal((await w.get("/content/latest.json")).out.body, "net");
  // nothing from /api was ever put in a cache
  for (const m of w.stores.values()) for (const k of m.keys()) assert.doesNotMatch(k, /\/api\//);
  // a file never seen offline is a network error, not a made-up response
  await assert.rejects(w.get("/content/editions/2026-01-01.json"));
});

test("cache first only for versioned files; a new version replaces the old one in the cache", async () => {
  const w = worker({ body: u => u });
  await w.get("/v2.js?v=aaaa");
  w.fetched.length = 0;
  assert.equal((await w.get("/v2.js?v=aaaa")).out.body, "https://paper.test/v2.js?v=aaaa");
  assert.equal(w.fetched.length, 0, "served from the cache");
  await w.get("/v2.js?v=bbbb");
  const keys = [...w.stores.get(w.CACHE).keys()].filter(k => k.includes("/v2.js"));
  assert.deepEqual(keys, ["https://paper.test/v2.js?v=bbbb"]);
});

test("versioned caches: install keeps the shell, activate deletes older paper caches and leaves Sport's alone", async () => {
  const w = worker();
  assert.match(w.CACHE, /^paper-/);
  for (const n of ["paper-old1", "paper-0123456789", "sport-v4a", "sport-v4a-img", "paper-art"]) await w.sandbox.caches.open(n);
  await w.fire("install");
  assert.ok(w.stores.get(w.CACHE).has("https://paper.test/"), "the shell is kept on install");
  await w.fire("activate");
  assert.deepEqual([...w.stores.keys()].sort(), [w.CACHE, "paper-art", "sport-v4a", "sport-v4a-img"].sort());
});

test("the build versions the worker: one VERSION line and one PRECACHE line for scripts/build.mjs to replace", () => {
  assert.equal((SW.match(/^const VERSION = "[^"]*";$/gm) || []).length, 1);
  assert.equal((SW.match(/^const PRECACHE = \[[^\]]*\];$/gm) || []).length, 1);
  const build = read("scripts/build.mjs");
  assert.match(build, /dist\/paper-sw\.js/);
  assert.match(build, /\/content\/latest\.json", "\/config\/house\.json"/);
});

test("vercel.json: the worker and the manifest are never kept long; the worker is not under the year-long rule", () => {
  const v = JSON.parse(read("vercel.json"));
  const rule = src => v.headers.find(h => h.source === src)?.headers || [];
  assert.match(rule("/paper-sw.js").find(h => h.key === "Cache-Control")?.value || "", /max-age=0/);
  assert.match(rule("/manifest.webmanifest").find(h => h.key === "Content-Type")?.value || "", /application\/manifest\+json/);
  const year = v.headers.filter(h => h.headers.some(x => /immutable/.test(x.value)));
  for (const h of year) assert.equal(new RegExp("^" + h.source.replace(/\(\.\*\)/g, ".*") + "$").test("/paper-sw.js"), false, h.source);
});

test("the Sport app keeps its own worker and scope: /sport-sw.js at /sport, its own caches; the paper's worker passes /sport by", () => {
  const sport = JSON.parse(read("public/sport/manifest.webmanifest"));
  assert.equal(sport.scope, "/sport");
  assert.match(read("public/sport/app.js"), /navigator\.serviceWorker\.register\("\/sport-sw\.js", \{ scope: "\/sport" \}\)/);
  const ssw = read("public/sport-sw.js");
  assert.match(ssw, /k\.startsWith\("sport-"\)/, "Sport's worker only deletes its own caches");
  assert.doesNotMatch(SW, /sport-sw\.js"\s*,/, "the paper's worker does not precache Sport's files");
  const { strategy } = worker();
  for (const u of ["/sport", "/sport/", "/sport/js/core.js", "/sport/manifest.webmanifest", "/sport-sw.js"]) assert.equal(strategy(u), "pass", u);
  assert.notEqual(manifest.start_url, sport.start_url);
});

// ---- the QA panel's round-2 accessibility items (20 Oct 2026) ----
const glass = read("v2/glass.css"), v2css = read("v2/v2.css"), layer = read("v2/layer.js");
test("a11y: Glass's focus ring is 2px on screen at any zoom (layer.js sets --z with the zoom)", () => {
  assert.match(layer, /setProperty\("--z", String\(z\)\)/);
  assert.match(glass, /nav\.dtabs ol a:focus-visible\{outline:calc\(2\.1px \/ var\(--z,1\)\) solid/);
  assert.match(glass, /\.jump a\):focus-visible\{outline:calc\(2\.1px \/ var\(--z,1\)\) solid/);
});
test("a11y: the desk chips' fill is dark, so white names are 4.5:1 or more on every Glass desk colour", () => {
  const m = glass.match(/html\.look-glass \.jump a\{background:rgba\(0,0,0,([\d.]+)\)/);
  assert.ok(m, "a dark chip fill");
  const lum = h => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = h; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const a = Number(m[1]);
  const desks = [...glass.match(/--d-one:[^}]*?--d-off:#[0-9a-f]{6}/i)[0].matchAll(/--d-(\w+):#([0-9a-f]{6})/gi)].filter(x => x[1] !== "one");
  assert.equal(desks.length, 6);
  for (const [, d, hex] of desks) {
    const bg = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) * (1 - a));
    const ratio = 1.05 / (lum(bg) + 0.05);
    assert.ok(ratio >= 4.5, `${d}: ${ratio.toFixed(2)}`);
  }
});
test("a11y: the skip link's target (the desk title, Page One's title) lands below the pinned Glass bar", () => {
  assert.match(glass, /html\.look-glass #main :is\(\.dopen h1,#p1-title\)\{scroll-margin-top:calc\(\(var\(--g-barh,72px\) \+ 12px\) \/ var\(--z,1\)\)\}/);
});
test("a11y: Money's small change figures in a solid muted ink (#6b675f), 4.5:1 or more; night, print and more contrast keep theirs", () => {
  assert.match(v2css, /:root\{--fig-ink:#6b675f;--fig-op:1\}/);
  assert.match(v2css, /\.board tr:not\(\.neutral,\.on\) td\.r small\{color:var\(--fig-ink,var\(--muted\)\);opacity:var\(--fig-op,\.85\)\}/);
  for (const re of [/:root\[data-theme="dark"\]\{--fig-ink:initial;--fig-op:initial\}/, /prefers-contrast:more\)\{:root\{--fig-ink:initial/, /@media print\{:root\{--fig-ink:initial/]) assert.match(v2css, re);
  assert.ok(existsSync(root + "public/styles.css") && !read("public/styles.css").includes("--fig-ink"), "v1's stylesheet is untouched");
});
