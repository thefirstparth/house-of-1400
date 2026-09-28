// Local stand-in for Vercel: middleware, /api functions, rewrites and dist/ static files.
// Usage: RUN_KEY=y node scripts/dev.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

if (process.env.DEV_MOCK) (await import("../tests/mocks.mjs")).installMocks();

const port = Number(process.argv[2] || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const REWRITES = [[/^\/archive$/, "/"], [/^\/editor$/, "/"], [/^\/today$/, "/"], [/^\/poster\/[a-z]+$/, "/"], [/^\/e\/[^/]+$/, "/"]];

async function toRequest(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  return new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
}
async function send(res, r) {
  const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer()));
}

createServer(async (req, res) => {
  try {
    const request = await toRequest(req);
    let path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) {
      const live = path.match(/^\/api\/live\/([^/]+)$/);
      const mod = await import(live ? "../api/live/[key].js" : `../api${path.slice(4)}.js`).catch(() => null);
      const fn = mod?.[request.method];
      if (!fn) return send(res, new Response("not found", { status: 404 }));
      return send(res, await fn(request));
    }
    for (const [re, to] of REWRITES) if (re.test(path)) path = to;
    if (path === "/") path = "/index.html";
    const file = normalize(join("dist", path.endsWith("/") ? path + "index.html" : path));
    if (!file.startsWith("dist")) return send(res, new Response("no", { status: 403 }));
    const body = await readFile(file).catch(() => readFile(file + ".html")).catch(() => null);
    if (!body) return send(res, new Response("not found", { status: 404 }));
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(body);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log(`dev: http://localhost:${port}`));
