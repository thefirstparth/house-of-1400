// The paper's service worker (the paper as an app, 20 Oct 2026; v2/README.md "Install", DECISIONS.md). Scope "/".
// Everything that changes is NETWORK-FIRST: the page, the edition (/content/), the config, the art manifests, the
// archive and editor data. The last copy is used only when the network fails, so an installed app always shows the
// newest edition when it is online, and the 14:00 paper shows on the first open after it is published.
// Never cached here: /api/ (live figures; offline the page falls back to the edition's snapshot and labels it with its
// time, as it does whenever a live source fails), the Sport app (/sport, its own app with its own worker), posters,
// the podcast and other sites. Cache-first only for files whose address changes with their content: the versioned
// /v2.js?v=, /v2.css?v=, /app.js?v=, /styles.css?v=, the fonts and the icons.
// scripts/build.mjs replaces VERSION (a hash of the page's files) and PRECACHE (the shell) in dist/paper-sw.js; a
// new build of the page is a new worker, which takes over at once and deletes the older caches.
const VERSION = "dev";
const PRECACHE = ["/"];
const CACHE = "paper-" + VERSION, ART = "paper-art", ART_MAX = 60;

// What to do with a request: "pass" (the browser handles it, this worker stays out), "network" (network first, the
// last copy when offline) or "cache" (cache first, for versioned files).
function strategy(url, method = "GET") {
  const u = typeof url === "string" ? new URL(url, self.location.origin) : url;
  if (method !== "GET" || u.origin !== self.location.origin) return "pass";
  const p = u.pathname;
  if (p === "/sport" || p.startsWith("/sport/") || p.startsWith("/sport-")) return "pass";
  if (p.startsWith("/api/") || p.startsWith("/posters/") || p.startsWith("/poster/") || p.startsWith("/podcast/") || p === "/listen" || p.startsWith("/listen/")) return "pass";
  if (/[?&]poster=/.test(u.search) || p === "/paper-sw.js") return "pass";
  if (/^\/(v2\.js|v2\.css|app\.js|styles\.css)$/.test(p) && u.searchParams.has("v")) return "cache";
  if (p.startsWith("/fonts/") || p.startsWith("/icons/")) return "cache";
  return "network";
}
// The edition pages all serve the same page (vercel.json rewrites), kept under "/" for an offline open of any of them.
const SHELL = p => p === "/" || p === "/today" || p === "/archive" || p === "/editor" || /^\/e\/\d{4}-\d\d-\d\d$/.test(p);
// A drawing (not its manifest) goes in its own cache, at most ART_MAX of them, oldest out first.
const isArt = p => p.startsWith("/art/") && !p.endsWith(".json");

// res is a copy of its own (cloned before the page reads the original)
async function putCopy(req, res) {
  const u = new URL(req.url), shell = req.mode === "navigate" && SHELL(u.pathname) && (u.pathname !== "/" || u.search) ? res.clone() : null;
  const c = await caches.open(isArt(u.pathname) ? ART : CACHE);
  await c.put(req, res);
  if (shell) await c.put("/", shell);
  if (isArt(u.pathname)) { const ks = await c.keys(); if (ks.length > ART_MAX) await Promise.all(ks.slice(0, ks.length - ART_MAX).map(k => c.delete(k))); }
  // a versioned file replaces its older versions
  if (strategy(u) === "cache" && u.search) for (const k of await c.keys()) { const o = new URL(k.url); if (o.pathname === u.pathname && o.search !== u.search) await c.delete(k); }
}
const keep = res => res && res.ok && res.type === "basic";

async function networkFirst(req, wait = p => p) {
  let res;
  try { res = await fetch(req); } catch (e) {
    const u = new URL(req.url);
    const hit = (await caches.match(req)) || (req.mode === "navigate" && SHELL(u.pathname) ? await caches.match("/") : null);
    if (hit) return hit;
    throw e;
  }
  if (keep(res)) wait(putCopy(req, res.clone()).catch(() => {}));
  return res;
}
async function cacheFirst(req, wait = p => p) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (keep(res)) wait(putCopy(req, res.clone()).catch(() => {}));
  return res;
}

self.addEventListener("install", e => {
  // each file on its own: one that fails never stops the worker installing
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRECACHE.map(f => c.add(new Request(f, { cache: "no-cache" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("paper-") && k !== CACHE && k !== ART).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const s = strategy(new URL(e.request.url), e.request.method);
  if (s === "pass") return;
  const wait = p => e.waitUntil(p);
  e.respondWith(s === "cache" ? cacheFirst(e.request, wait) : networkFirst(e.request, wait));
});
