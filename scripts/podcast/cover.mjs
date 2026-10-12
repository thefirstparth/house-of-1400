// The podcast's cover art (Apple asks for a square JPEG or PNG, 1400 to 3000 px): the Page One wordmark's halftone
// "1400", printed in the desk colours left to right, on the paper. Drawn once and kept in public/podcast-cover.jpg.
//   node scripts/podcast/cover.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const H = new URL("../../", import.meta.url).pathname, F = f => readFileSync(`${H}v2/fonts/${f}`).toString("base64");
const S = 3000, desks = ["#1f3f73", "#0a72a8", "#b8460e", "#6a3fb5", "#0b7a43", "#a87a00"];
const html = `<!doctype html><style>
@font-face{font-family:P;src:url(data:font/woff2;base64,${F("playfair-display-latin-wght-normal.woff2")});font-weight:400 900}
@font-face{font-family:L;src:url(data:font/woff2;base64,${F("libre-franklin-latin-wght-normal.woff2")});font-weight:100 900}
@font-face{font-family:N;src:url(data:font/woff2;base64,${F("newsreader-latin-opsz-italic.woff2")});font-style:italic}
html,body{margin:0}</style><canvas id=c width=${S} height=${S}></canvas><script>
async function draw(){
  await document.fonts.load("900 100px P"); await document.fonts.load("600 100px L"); await document.fonts.load("italic 100px N");
  const c = document.getElementById("c"), x = c.getContext("2d"), ink = "#15140f", paper = "#f3efe4";
  x.fillStyle = paper; x.fillRect(0, 0, ${S}, ${S});
  // the figure as a mask
  const m = document.createElement("canvas"); m.width = m.height = ${S}; const mx = m.getContext("2d");
  mx.font = "900 1180px P"; mx.textAlign = "center"; mx.textBaseline = "alphabetic"; mx.fillText("1400", ${S / 2}, 1890);
  const w = mx.measureText("1400").width, x0 = ${S / 2} - w / 2, d = mx.getImageData(0, 0, ${S}, ${S}).data;
  const cover = (px, py, r) => { let n = 0, k = 0; for (let i = -r; i <= r; i += 3) for (let j = -r; j <= r; j += 3) { const X = Math.round(px + i), Y = Math.round(py + j); k++; if (X >= 0 && Y >= 0 && X < ${S} && Y < ${S} && d[(Y * ${S} + X) * 4 + 3] > 127) n++; } return n / k; };
  // a 45-degree screen of round dots, each sized by how much of its cell the figure covers
  const cell = 30, cs = Math.SQRT1_2, cols = ${JSON.stringify(desks)};
  for (let u = -${S}; u < ${S} * 1.5; u += cell) for (let v = -${S}; v < ${S} * 1.5; v += cell) {
    const px = (u - v) * cs + ${S / 2}, py = (u + v) * cs - ${S / 2};
    if (px < 0 || py < 0 || px > ${S} || py > ${S}) continue;
    const a = cover(px, py, cell / 2); if (a < 0.04) continue;
    const t = Math.min(0.999, Math.max(0, (px - x0) / w));
    x.fillStyle = cols[Math.floor(t * cols.length)]; x.beginPath(); x.arc(px, py, (cell / 2) * Math.sqrt(a) * 1.08, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = ink; x.textAlign = "center";
  x.font = "600 150px L"; x.letterSpacing = "62px"; x.fillText("THE HOUSE OF", ${S / 2} + 31, 830);
  x.letterSpacing = "0px";
  x.fillRect(420, 2140, ${S} - 840, 14); x.fillRect(420, 2180, ${S} - 840, 5);
  x.font = "italic 150px N"; x.fillText("The afternoon paper, out loud", ${S / 2}, 2440);
  x.font = "600 92px L"; x.letterSpacing = "26px"; x.fillStyle = "#4f4a41"; x.fillText("DAILY \\u00b7 BENGALURU", ${S / 2} + 13, 2650);
  return c.toDataURL("image/jpeg", 0.9);
}</script>`;
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const p = await b.newPage(); await p.setContent(html);
const png = await p.evaluate("draw()"); await b.close();
writeFileSync(`${H}public/podcast-cover.jpg`, Buffer.from(png.split(",")[1], "base64"));
console.log("wrote public/podcast-cover.jpg");
