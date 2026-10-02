// The nameplate on one line (mock, 2 Oct 2026; Parth: "can you not write it like this? The House of 1400, the way it
// is on the New York Times website ... we'll be able to increase the font size for everything, especially 1400").
// Each variant is the real header (run line, nameplate, desk tabs) at a laptop's width and a phone's, with the
// paper's own halftone (v2/wordmark.js mountWordmark) and today's split by desk. Not production code.

const DESK_NAMES = [["one", "Page One"], ["news", "News"], ["home", "Close to Home"], ["sport", "Sport"], ["tech", "Tech & AI"], ["money", "Money"], ["off", "Off Duty"]];
const tabs = () => `<nav class="tabs">${DESK_NAMES.map(([id, n], i) => `<a style="--c:var(--d-${id})"${i ? "" : ' class="on"'}>${n}</a>`).join("")}</nav>`;
const run = (ears = false) => ears ? "" : `<div class="run"><span>Friday 2 October 2026 · No. 8 · Printed 14:15 IST · <b>13 min</b> read</span><span>An afternoon newspaper for one reader · edited by T. A. Bhide</span></div>`;

// "1400" as a halftone in desk colours, set on the line: the canvas's own padding is taken back so the figure sits
// close to the words, and its baseline is lifted to theirs
async function figure(holder, s) {
  const W = Math.ceil(ADV * s + s * 0.5), PX = Math.round(W * 0.2), ink0 = (W - ADV * s) / 2 + 0.028 * s, ink1 = (W - ADV * s) / 2 + (ADV - 2.294) * s;
  holder.style.cssText = `display:inline-block;flex:none;margin:0 ${-(PX + ink1)}px 0 ${-(PX + ink0)}px;height:${Math.ceil(s * 1.02)}px;line-height:0`;
  await mountWordmark(holder, { size: s, shares: SHARES });
}
// a whole line of type as a halftone (variant B: "1400" in the blackletter itself)
function halftoneText(canvas, text, fontPx, colourOf) {
  const m = document.createElement("canvas").getContext("2d"); m.font = `400 ${fontPx}px UnifrakturMaguntia`;
  const w = Math.ceil(m.measureText(text).width + fontPx * 0.2), h = Math.ceil(fontPx * 1.25), k = Math.min(3, devicePixelRatio || 1);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true });
  x.font = m.font; x.textBaseline = "alphabetic"; x.fillText(text, fontPx * 0.1, fontPx * 0.95);
  const d = x.getImageData(0, 0, w, h).data, g = Math.max(2.4, fontPx / 24), out = canvas.getContext("2d");
  canvas.width = w * k; canvas.height = h * k; canvas.style.width = w + "px"; canvas.style.height = h + "px"; out.setTransform(k, 0, 0, k, 0, 0);
  const cover = (cx, cy) => { let a = 0, n = 0; for (let yy = Math.max(0, Math.floor(cy - g / 2)); yy < Math.min(h, cy + g / 2); yy++) for (let xx = Math.max(0, Math.floor(cx - g / 2)); xx < Math.min(w, cx + g / 2); xx++) { a += d[(yy * w + xx) * 4 + 3]; n++; } return n ? a / n / 255 : 0; };
  const dots = [], span = Math.hypot(w, h), q = Math.SQRT1_2;
  for (let j = -span / g; j < span / g; j++) for (let i = -span / g; i < span / g; i++) { const u = i * g, v = j * g, px = w / 2 + u * q - v * q, py = h / 2 + u * q + v * q; if (px < 0 || py < 0 || px > w || py > h) continue; const b = Math.sqrt(cover(px, py)); if (b > 0.05) dots.push({ x: px, y: py, base: b }); }
  dots.sort((a, b) => a.x - b.x);
  for (const p of dots) { out.fillStyle = colourOf(p.x / w); out.beginPath(); out.arc(p.x, p.y, Math.min(p.base, 1.1) * g * 0.6, 0, Math.PI * 2); out.fill(); }
  return { w, h };
}

const VARIANTS = [
  { id: "now", name: "Today, for comparison", note: "The figure under the words: three lines tall, and 1400 at 96px.", build: async (el, wide) => {
    el.innerHTML = `${run()}<div class="np-now"><span class="the">The</span><span class="hof">House of</span><span class="fig"></span></div>${tabs()}`;
    const s = wide ? 96 : 84, f = el.querySelector(".fig"); f.style.height = `${s * 1.02}px`; await mountWordmark(f, { size: s, shares: SHARES });
  } },
  { id: "a", name: "A · Blackletter and dots", note: "The House of in blackletter and 1400 in dots, on one line. 1400 grows to about 130px on a laptop.", build: async (el, wide) => {
    el.innerHTML = `${run()}<div class="np-line"><span class="bl">The House of</span><span class="fig"></span></div>${tabs()}`;
    const avail = el.clientWidth * (wide ? 0.62 : 0.92), f0 = fitFont(avail, "The House of", 1.42);
    el.querySelector(".bl").style.fontSize = f0 + "px"; await figure(el.querySelector(".fig"), Math.round(f0 * 1.42));
    el.querySelector(".bl").style.marginBottom = `${Math.round(f0 * 1.42 * 0.16 - f0 * 0.13)}px`;
  } },
  { id: "b", name: "B · All blackletter, the NYT way", note: "The whole name in blackletter, as the Times sets it; the figures in blackletter too, printed in the day's dots.", build: async (el, wide) => {
    el.innerHTML = `${run()}<div class="np-line b"><span class="bl">The House of</span><canvas class="bfig"></canvas></div>${tabs()}`;
    const avail = el.clientWidth * (wide ? 0.66 : 0.95), m = document.createElement("canvas").getContext("2d"); m.font = "400 100px UnifrakturMaguntia";
    const per = (m.measureText("The House of ").width + 1.3 * m.measureText("1400").width) / 100, fpx = Math.floor(avail / per);
    el.querySelector(".bl").style.fontSize = fpx + "px";
    const cs = getComputedStyle(el), cols = SHARES.map(x => cs.getPropertyValue(`--d-${x.desk}`).trim()), tot = SHARES.reduce((a, x) => a + x.words, 0);
    const edges = []; let acc = 0; for (const x of SHARES) { acc += x.words; edges.push(acc / tot); }
    halftoneText(el.querySelector(".bfig"), "1400", Math.round(fpx * 1.3), f => cols[Math.max(0, edges.findIndex(e => f <= e))]);
  } },
  { id: "c", name: "C · Small capitals and big dots", note: "The in blackletter, HOUSE OF in spaced capitals, and 1400 as the hero at about 150px.", build: async (el, wide) => {
    el.innerHTML = `${run()}<div class="np-line c"><span class="bl">The</span><span class="caps">House of</span><span class="fig"></span></div>${tabs()}`;
    const s = wide ? 150 : 72; el.querySelector(".bl").style.fontSize = Math.round(s * 0.5) + "px"; el.querySelector(".caps").style.fontSize = Math.round(s * 0.16) + "px";
    await figure(el.querySelector(".fig"), s);
    el.querySelector(".bl").style.marginBottom = `${Math.round(s * 0.16 - s * 0.06)}px`; el.querySelector(".caps").style.marginBottom = `${Math.round(s * 0.165)}px`;
  } },
  { id: "d", name: "D · One line with ears, as on the Times' front", note: "A on one line, bigger still, with the run line folded into ears: the date and edition left, the weather and the Sensex right. The tallest 1400 for the least height.", build: async (el, wide) => {
    el.innerHTML = `<div class="ears"><div class="ear l"><b>Friday 2 October 2026</b><span>No. 8 · Printed 14:15 IST</span><span><b>13 min</b> read</span></div><div class="np-line"><span class="bl">The House of</span><span class="fig"></span></div><div class="ear r"><b>29° Mostly clear</b><span>Bengaluru</span><span>Sensex 71,910 <i>−0.79%</i></span></div></div>${tabs()}`;
    const avail = el.clientWidth * (wide ? 0.6 : 0.92), f0 = fitFont(avail, "The House of", 1.42);
    el.querySelector(".bl").style.fontSize = f0 + "px"; await figure(el.querySelector(".fig"), Math.round(f0 * 1.42));
    el.querySelector(".bl").style.marginBottom = `${Math.round(f0 * 1.42 * 0.16 - f0 * 0.13)}px`;
  } },
];
// the font size at which "The House of" and a 1400 of ratio × that size fill the width
function fitFont(avail, text, ratio) {
  const m = document.createElement("canvas").getContext("2d"); m.font = "400 100px UnifrakturMaguntia";
  const per = m.measureText(text).width / 100 + 0.3 + ratio * 2.27;
  return Math.floor(avail / per);
}

async function build() {
  await document.fonts.load("400 40px UnifrakturMaguntia"); await document.fonts.load("600 12px 'Libre Franklin'");
  const main = document.getElementById("variants");
  for (const v of VARIANTS) {
    const sec = document.createElement("section"); sec.id = v.id;
    sec.innerHTML = `<h2>${v.name}</h2><p class="dek">${v.note}</p><div class="pair"><div class="laptop"><div class="frame"><div class="hdr"></div><div class="body"></div></div><p class="cap">Laptop · <span class="h"></span></p></div><div class="phone"><div class="frame"><div class="hdr"></div><div class="body"></div></div><p class="cap">Phone · <span class="h"></span></p></div></div>`;
    main.append(sec);
    for (const kind of ["laptop", "phone"]) {
      const box = sec.querySelector(`.${kind} .hdr`); await v.build(box, kind === "laptop");
      const h = Math.round(box.getBoundingClientRect().height / (kind === "laptop" ? parseFloat(getComputedStyle(sec.querySelector(".laptop .frame")).zoom || 1) : 1));
      sec.querySelector(`.${kind} .h`).textContent = `header ${h}px tall`;
    }
  }
}
document.getElementById("theme").addEventListener("click", () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; document.getElementById("theme").textContent = d.dataset.theme === "dark" ? "Day" : "Night"; location.hash = d.dataset.theme; location.reload(); });
if (location.hash === "#dark") { document.documentElement.dataset.theme = "dark"; document.getElementById("theme").textContent = "Day"; }
build();
