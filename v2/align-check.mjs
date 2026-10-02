// node v2/align-check.mjs: checks the nameplate on every device of the QA matrix: for 1400 and each tapped shape, the
// middle of HOUSE OF's capitals against the middle of the ink actually drawn (read from the canvas's pixels), and the
// gap from "OF" to the ink. Prints the worst offsets per device.
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
const H = new URL("../", import.meta.url).pathname, D = H + "dist";
const E = JSON.parse(readFileSync(`${D}/content/latest.json`, "utf8")), snap = JSON.parse(readFileSync(`${H}content/editions/${E.date}.json`, "utf8")).snapshot || {};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const src = readFileSync(`${H}v2/shot.mjs`, "utf8"), DEV = eval("(" + src.match(/const DEVICES = (\{[\s\S]*?\});/)[1] + ")"), PH = eval("(" + src.match(/const PHONES = (\{[\s\S]*?\});/)[1] + ")");
const only = process.argv[2] ? process.argv[2].split(",") : null;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [name, spec0] of Object.entries(DEV)) {
  if (only && !only.includes(name)) continue;
  const spec = PH[spec0] || spec0, [dims, dpr0] = spec.split("@"), [w, h] = dims.split("x").map(Number), ph = w < 760;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr0) || (ph ? 2 : 1), isMobile: ph, hasTouch: ph });
  const T0 = Date.parse(`${E.date}T09:30:00Z`);
  await ctx.addInitScript(`(function(){var R=Date,O=${T0}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();try{sessionStorage.setItem("h1400-pressed","1")}catch(e){}`);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route(/^https?:/, r => r.abort());
  await p.route(/^https:\/\/house14\.test\//, r => { const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
    if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
    let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html"; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" }); });
  await p.goto(`https://house14.test/?v2#d-one`); await p.waitForTimeout(3000);
  const measure = () => p.evaluate(() => {
    const plate = document.getElementById("bigplate"), hof = plate.querySelector(".hof"), c = plate.querySelector("canvas");
    // the ink: rows and columns of the canvas with real ink (a dust speck is not ink)
    const x = c.getContext("2d"), W = c.width, Hh = c.height, d = x.getImageData(0, 0, W, Hh).data, rows = new Array(Hh).fill(0), cols = new Array(W).fill(0);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > 140) { rows[j]++; cols[i]++; }
    // a row or column counts as ink when it holds a real share of the figure (dust specks never do)
    const thr = W * 0.04, cthr = Hh * 0.06, y0 = rows.findIndex(v => v >= thr), y1 = Hh - 1 - [...rows].reverse().findIndex(v => v >= thr), x0 = cols.findIndex(v => v >= cthr);
    const r = c.getBoundingClientRect(), sy = r.height / Hh, sx = r.width / W, inkMid = r.top + sy * (y0 + y1) / 2, inkLeft = r.left + sx * x0;
    const p0 = document.createElement("span"); p0.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; hof.append(p0); const base = p0.getBoundingClientRect().top; p0.remove();
    const cs = getComputedStyle(hof), m = document.createElement("canvas").getContext("2d"); m.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const mm = m.measureText("HOUSE OF");
    const z = parseFloat(document.getElementById("dtop")?.style.zoom) || 1, capTop = base - z * mm.actualBoundingBoxAscent, capMid = (capTop + base) / 2;
    const hr = hof.getBoundingClientRect(), right = hr.right - z * parseFloat(cs.letterSpacing || 0), np = parseFloat(getComputedStyle(plate).getPropertyValue("--np"));
    const the = plate.querySelector(".the").getBoundingClientRect();
    return { off: +(capMid - inkMid).toFixed(1), gap: +((inkLeft - right) / z).toFixed(1), want: +(np * 0.12).toFixed(1), left: Math.round(the.left), right: Math.round(r.left + sx * (W - 1 - [...cols].reverse().findIndex(v => v >= cthr))), vw: innerWidth, label: plate.querySelector(".n").getAttribute("aria-label") };
  });
  const out = []; out.push(await measure());
  const box = await p.locator("#bigplate .n").boundingBox();
  for (let i = 0; i < 6; i++) {
    if (ph) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else { await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.move(2, h - 2); }
    await p.waitForTimeout(2300); out.push(await measure());
    if (process.env.SHOTS) { const bb = await p.locator("#bigplate").boundingBox(); await p.screenshot({ path: `${H}v2/shots/al-${name}-${i}.png`, clip: { x: 0, y: bb.y - 6, width: w, height: bb.height + 12 } }); }
  }
  const worst = out.reduce((a, o) => Math.max(a, Math.abs(o.off)), 0), gaps = out.map(o => o.gap), centred = out.map(o => Math.round(((o.left + o.right) / 2) - o.vw / 2));
  console.log(`${name.padEnd(22)} centre-offset max ${worst.toFixed(1)}px | gap ${Math.min(...gaps)}–${Math.max(...gaps)} (want ${out[0].want}) | off-centre ${Math.min(...centred)}..${Math.max(...centred)}px | ${out.map(o => `${o.label.slice(0, 12)}:${o.off}/${o.gap}`).join(" ")}${errs.length ? " | ERR " + errs[0] : ""}`);
  await ctx.close();
}
await b.close();
