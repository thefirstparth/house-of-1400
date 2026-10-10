// The Sport app's service worker (scope /sport): the app's own files network-first with the last copy as a fallback,
// so an update shows at once and the app still opens offline; team crests cache-first. Live data is never cached
// here: the app keeps its own last copy of each feed, marked with its time.
const CACHE = "sport-v3b";
const SHELL = ["/sport", "/sport/app.css", "/sport/app.js", "/sport/js/core.js", "/sport/js/ui.js", "/sport/js/views.js", "/sport/js/morph.js", "/sport/manifest.webmanifest", "/sport/icon.svg", "/sport/fonts/barlow-condensed-latin-700-normal.woff2", "/sport/fonts/barlow-condensed-latin-600-normal.woff2", "/sport/fonts/barlow-condensed-latin-500-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("sport-") && k !== CACHE && k !== CACHE + "-img").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin && (u.pathname === "/sport" || u.pathname.startsWith("/sport/"))) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("/sport"))));
  } else if (u.hostname === "a.espncdn.com") {
    // crests and photos: only real (CORS, ok) responses are kept, at most 150, oldest out first (an opaque response
    // counts as megabytes against the phone's storage)
    e.respondWith(caches.open(CACHE + "-img").then(async c => (await c.match(r)) || fetch(r).then(res => { if (res.ok && res.type !== "opaque") { c.put(r, res.clone()).then(() => c.keys()).then(ks => ks.length > 150 && Promise.all(ks.slice(0, ks.length - 150).map(k => c.delete(k)))); } return res; })));
  }
});
