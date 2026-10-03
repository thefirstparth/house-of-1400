// The House of 1400's wordmark on Page One (Parth, 1 Oct 2026: options 1 + 4 of design/nameplate; 2 Oct: always
// flowing, no links, the desk colours always on).
// "1400" printed as a newsprint halftone: a 45° screen of round dots, each sized by how much of its cell the figure
// covers, so it reads as the solid Playfair 1400 from a distance and as a printed screen up close.
// - The day in dots: the figure is shared among today's desks in the tabs' order, left to right, each in proportion to
//   its length in words, and each desk's dots are printed in its colour. A long Sport day makes a wide orange band.
// - At rest the figure is still and crisp. Every 4 seconds a little life (Parth, 3 Oct, of The Daily Index's livelier
//   figure: "get inspired by this ... it needs to be ours"): the desks are re-inked in turn, tabs' order, one plate at a
//   time, a ripple of fresh ink spreading through that desk's dots from its middle; every third beat one swell sweeps
//   across the whole figure, thickening the dots it passes, and a little loose ink drifts while it moves.
// - Out of register: a dot pushed fast (by the pointer, or re-forming) slips off its plate, and the plate beside it
//   shows for a moment as a coloured fringe behind it, the way a press's plates slip; it settles back into register as
//   it slows.
// - Pointer (laptop): the dots part around the pointer with a swirl and spring back when it leaves.
// - Tap or click: the dots re-form into the next shape of the cycle (config desks_v2.wordmark: 1400, the temperature,
//   the sky in a word, the time, a name), and the figure comes back to 1400 by itself after a few seconds.
// - Motion off (prefers-reduced-motion): one still, printed figure.
// It stops drawing when it is off screen or the tab is hidden. The figure is Playfair Display Black's lining "1400"
// (Playfair's default figures are oldstyle) as a fixed outline, taken from v2/fonts by v2/glyphs.py, so it needs no
// font loading and draws the same in every browser, Safari on an iPhone included.
// mountWordmark(el, { size: px, shares: [{ desk, words }] in order }) -> destroy()

const CACHE = new Map();

// "1400" in Playfair Display Black, lining figures, in ems: baseline at 0, advance ADV (v2/glyphs.py)
const ADV = 2.338;
const PATH = "M0.314 -0.718V-0.093Q0.314 -0.065 0.3205 -0.0495Q0.327 -0.034 0.3415 -0.0275Q0.356 -0.021 0.38 -0.021V0Q0.358 -0.001 0.3155 -0.0025Q0.273 -0.004 0.229 -0.004Q0.174 -0.004 0.12 -0.0025Q0.066 -0.001 0.038 0V-0.021Q0.073 -0.021 0.094 -0.03Q0.115 -0.039 0.1245 -0.061Q0.134 -0.083 0.134 -0.123V-0.558Q0.134 -0.593 0.1245 -0.6095Q0.115 -0.626 0.092 -0.631Q0.069 -0.636 0.028 -0.636V-0.657Q0.138 -0.669 0.2045 -0.6855Q0.271 -0.702 0.314 -0.718ZM0.833 -0.722 0.831 -0.69 0.436 -0.155 0.493 -0.252H0.945V-0.135H0.414V-0.156ZM0.849 -0.722V-0.106Q0.849 -0.07 0.8535 -0.052Q0.858 -0.034 0.8712 -0.028Q0.8844 -0.022 0.91 -0.02V0Q0.885 -0.002 0.8427 -0.0025Q0.8005 -0.003 0.752 -0.003Q0.7151 -0.003 0.679 -0.0025Q0.643 -0.002 0.618 0V-0.02Q0.6517 -0.022 0.6693 -0.028Q0.687 -0.034 0.693 -0.052Q0.699 -0.07 0.699 -0.106V-0.522L0.833 -0.722ZM1.3139 -0.722Q1.4031 -0.722 1.4701 -0.679Q1.537 -0.636 1.574 -0.5555Q1.611 -0.475 1.611 -0.36Q1.611 -0.248 1.573 -0.164Q1.535 -0.08 1.4675 -0.033Q1.3999 0.014 1.3131 0.014Q1.2239 0.014 1.1569 -0.029Q1.09 -0.072 1.053 -0.153Q1.016 -0.234 1.016 -0.348Q1.016 -0.46 1.054 -0.544Q1.092 -0.628 1.1595 -0.675Q1.2271 -0.722 1.3139 -0.722ZM1.31 -0.704Q1.258 -0.704 1.232 -0.613Q1.206 -0.522 1.206 -0.352Q1.206 -0.177 1.2355 -0.0905Q1.265 -0.004 1.317 -0.004Q1.3704 -0.004 1.3957 -0.095Q1.421 -0.186 1.421 -0.356Q1.421 -0.531 1.3915 -0.6175Q1.362 -0.704 1.31 -0.704ZM1.9969 -0.722Q2.0861 -0.722 2.1531 -0.679Q2.22 -0.636 2.257 -0.5555Q2.294 -0.475 2.294 -0.36Q2.294 -0.248 2.256 -0.164Q2.218 -0.08 2.1505 -0.033Q2.0829 0.014 1.9961 0.014Q1.9069 0.014 1.8399 -0.029Q1.773 -0.072 1.736 -0.153Q1.699 -0.234 1.699 -0.348Q1.699 -0.46 1.737 -0.544Q1.775 -0.628 1.8425 -0.675Q1.9101 -0.722 1.9969 -0.722ZM1.993 -0.704Q1.941 -0.704 1.915 -0.613Q1.889 -0.522 1.889 -0.352Q1.889 -0.177 1.9185 -0.0905Q1.948 -0.004 2 -0.004Q2.0534 -0.004 2.0787 -0.095Q2.104 -0.186 2.104 -0.356Q2.104 -0.531 2.0745 -0.6175Q2.045 -0.704 1.993 -0.704Z";
async function maskOf(size, W, H) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.setTransform(size, 0, 0, size, W / 2 - (ADV * size) / 2, H / 2 + size * 0.36);
  x.fill(new Path2D(PATH));
  const d = x.getImageData(0, 0, W, H).data, I = new Float32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let r = 0; for (let i = 0; i < W; i++) { r += d[(y * W + i) * 4 + 3] / 255; I[(y + 1) * (W + 1) + i + 1] = I[y * (W + 1) + i + 1] + r; } }
  return (cx, cy, h) => {
    const x0 = Math.max(0, Math.floor(cx - h)), x1 = Math.min(W, Math.ceil(cx + h)), y0 = Math.max(0, Math.floor(cy - h)), y1 = Math.min(H, Math.ceil(cy + h));
    if (x1 <= x0 || y1 <= y0) return 0; const W1 = W + 1;
    return (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
  };
}

// Every piece of the day's paper, in reading order, with its length in words: each desk's sections in the paper's
// order, the front page's stories at the top of their own section (as on the desk pages), then every article, brief
// and one-line story, and the sections that are lists (Screen & Stage, Talk of the Day, The Betting Window, the
// Fixture List, Before You Go) line by line. Your Desk is left out; Page One's own lines (the day in a minute, the
// notes) are not a desk's. Tables and charts count only their written lines.
// desks: [{id, name, sections: [section ids]}] in page order; href(desk, item) -> link.
export function storiesFromEdition(E, desks, href = d => "#" + d) {
  const words = (...xs) => xs.flat(Infinity).join(" ").split(/\s+/).filter(Boolean).length;
  const strings = o => (o == null ? [] : typeof o === "string" ? [o] : typeof o !== "object" ? [] : Object.entries(o).filter(([k]) => !/url|source|^id$|thread|when|date|time|kind/i.test(k)).flatMap(([, v]) => strings(v)));
  const F = E.front || {}, S = E.sections || {}, out = [];
  const add = (desk, headline, n, label = "") => n > 0 && headline && out.push({ desk: desk.id, deskName: desk.name, headline: label ? `${label}: ${headline}` : headline, words: n, href: href(desk.id) });
  const story = x => words(x.headline, x.deck, x.short, x.more, x.text, x.why?.text);
  for (const desk of desks) for (const id of desk.sections) {
    for (const x of [F.lead, ...(F.seconds || []), ...(F.briefs || [])]) if (x?.section === id) add(desk, x.headline, story(x));
    const s = S[id] || {};
    for (const x of [...(s.stories || []), ...(s.briefs || []), ...(s.lines || [])]) add(desk, x.headline, story(x));
    const notes = words(strings(s.data)); if (notes) add(desk, ({ paddock: "Paddock Notes", madrid: "Madridismo", crease: "The Crease", ledger: "The Ledger", sky: "Sky & Streets" })[id] || "Notes", notes, "");
    if (id === "screen") for (const t of E.screen || []) add(desk, t.title, words(t.title, t.reason, t.if_you_liked), "Screen & Stage");
    if (id === "talk") for (const t of [...(E.trends?.india || []), ...(E.trends?.world || [])]) add(desk, t.term, words(t.term, t.what), "Talk of the Day");
    if (id === "betting") for (const b of E.betting || []) add(desk, b.title, words(b.title, (b.outcomes || []).map(o => o.name)), "The Betting Window");
    if (id === "fixtures") for (const f of E.fixtures || []) add(desk, f.label, words(f.label, f.where), "The Fixture List");
    if (id === "bye") for (const l of [...(E.before_you_go?.watch || []), ...(E.before_you_go?.do || [])]) add(desk, l, words(l), "Before You Go");
    if (id === "week") for (const w of E.week_ahead || []) add(desk, w.what, words(w.what, w.why), "The Week Ahead");
  }
  return out;
}

// The screen for one size, worked out once: every dot's home on the screen and its size at rest.
async function screenFor(size, g = Math.max(3, size / 21)) {
  const key = `${size}|${g}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const W = Math.ceil(ADV * size + size * 0.5), H = Math.ceil(size * 1.02);
  const cover = await maskOf(size, W, H);
  const dots = [], span = Math.hypot(W, H), ca = Math.SQRT1_2, sa = Math.SQRT1_2;
  for (let j = -span / g; j < span / g; j++) for (let i = -span / g; i < span / g; i++) {
    const u = i * g, v = j * g, x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca;
    if (x < -g || y < -g || x > W + g || y > H + g) continue;
    const base = Math.sqrt(cover(x, y, g / 2));
    if (base > 0.04) dots.push({ x, y, base });
  }
  const s = { W, H, g, dots };
  CACHE.set(key, s);
  return s;
}

// The day in dots: bands left to right, one per desk, each as wide (in dots) as the desk is long (in words)
function bandsOf(dots, S) {
  if (!S.length) return [dots];
  const total = S.reduce((a, x) => a + x.words, 0), order = [...dots].sort((a, b) => a.x - b.x || a.y - b.y), bands = S.map(() => []);
  for (let i = 0, k = 0, acc = 0; i < S.length; i++) {
    acc += S[i].words;
    const end = i === S.length - 1 ? order.length : Math.round(order.length * acc / total);
    for (; k < end; k++) bands[i].push(order[k]);
  }
  return bands;
}

// The small 1400 in the desk pages' masthead (Parth, 2 Oct: "can the logo change every day based on the split ... it
// can be static"): the same day in dots, still, at the masthead's size, on a finer screen so the figure stays crisp.
// stillWordmark(el, { size: px, shares }) -> destroy()
export async function stillWordmark(el, { size, shares = [] }) {
  const { W, H, g, dots } = await screenFor(size, Math.max(1.5, size / 15)), R = g * 0.62;
  const S = shares.filter(x => x.words > 0), bands = bandsOf(dots, S), side = Math.round(size * 0.22);
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  // the figure's baseline sits where the text's did (0.87 of the size from the top)
  c.style.cssText = `display:block;width:${W}px;height:${H}px;margin:0 ${-side}px ${-(H - size * 0.87).toFixed(1)}px;flex:none`;
  el.replaceChildren(c);
  const ctx = c.getContext("2d");
  const draw = () => {
    const r = c.getBoundingClientRect(), z = r.width / W || 1, k = Math.min(4, (devicePixelRatio || 1) * z);
    c.width = Math.round(W * k); c.height = Math.round(H * k); ctx.setTransform(k, 0, 0, k, 0, 0);
    const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue("--ink").trim() || "#15140f";
    bands.forEach((list, i) => {
      ctx.fillStyle = (S[i] && cs.getPropertyValue(`--d-${S[i].desk}`).trim()) || ink; ctx.beginPath();
      for (const d of list) { const rr = Math.min(d.base, 1.1) * R; if (rr < 0.2) continue; ctx.moveTo(d.x + rr, d.y); ctx.arc(d.x, d.y, rr, 0, Math.PI * 2); }
      ctx.fill();
    });
  };
  draw();
  const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener?.("change", draw);
  addEventListener("resize", draw);
  return () => { mo.disconnect(); mq.removeEventListener?.("change", draw); removeEventListener("resize", draw); };
}

// The "°" glyph's top, in ems above the baseline (negative), measured once
let supTop = null;
function supBox() {
  if (supTop == null) { const B = inkBox(200, 200, x => { x.setTransform(100, 0, 0, 100, 20, 150); x.fill(new Path2D(GLYPHS["°"][1])); }); supTop = (B.y0 - 150) / 100; }
  return { top: supTop };
}
// The box a drawing's ink takes on a canvas of w x h (alpha over half)
function inkBox(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); draw(x);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 127) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
// Any short text in the same face, for the shapes a tap cycles through (v2/glyphs.json, embedded by the build as
// GLYPHS). Every one is set at the size of "1400" itself (Parth, 3 Oct: "the font size of all the rotations should be
// the same"), times k when the screen is too narrow for the widest of them (one k for them all), on 1400's baseline,
// starting where 1400 starts; a longer word runs on to the right, into WM, the mask's wider width.
const shapeCache = new Map();
export const textAdv = text => [...text].reduce((a, ch) => a + (typeof GLYPHS !== "undefined" ? (GLYPHS[ch]?.[0] ?? (ch === " " ? 0.28 : 0)) : 0.6) * (ch === "°" ? 0.8 : 1), 0);
async function textDots(text, size, W, H, g, k = 1, WM = W) {
  const key = `${text}|${size}|${g}|${k.toFixed(4)}|${WM}`; if (shapeCache.has(key)) return shapeCache.get(key);
  let dots;
  if (text === "1400" || typeof GLYPHS === "undefined") dots = (await screenFor(size, g)).dots;
  else {
    const chars = [...text].filter(ch => GLYPHS[ch] || ch === " "), adv = chars.reduce((a, ch) => a + (GLYPHS[ch]?.[0] ?? 0.28), 0) || 1;
    // every shape sits inside the box "1400" itself takes (2 Oct: the "°" of "21°" rose into "HOUSE OF"). The letters
    // and figures are measured on a tall scratch canvas and fitted to that box's height and width on the same baseline;
    // a "°" is set as a small superscript level with the top of the figures, as a typesetter would.
    const SUP = new Set(["°"]), base0 = H + size * 0.36;
    const set = (x, sz, ox, base, top) => { let at = ox; for (const ch of chars) { const G = GLYPHS[ch];
      if (G) { if (SUP.has(ch) && top != null) { const k = sz * 0.72, g0 = supBox(); x.setTransform(k, 0, 0, k, at, top - g0.top * k); } else x.setTransform(sz, 0, 0, sz, at, base); x.fill(new Path2D(G[1])); }
      at += (G?.[0] ?? 0.28) * sz * (SUP.has(ch) && top != null ? 0.8 : 1); } };
    const plain = chars.filter(ch => !SUP.has(ch)), advOf = sz => chars.reduce((a, ch) => a + (GLYPHS[ch]?.[0] ?? 0.28) * (SUP.has(ch) ? 0.8 : 1), 0) * sz;
    const T = inkBox(W, H * 2, x => { x.setTransform(size, 0, 0, size, W / 2 - (ADV * size) / 2, base0); x.fill(new Path2D(PATH)); });
    const B = inkBox(W, H * 2, x => { let at = 0; for (const ch of plain) { const G = GLYPHS[ch]; if (G) { x.setTransform(size, 0, 0, size, 10 + at, base0); x.fill(new Path2D(G[1])); } at += (G?.[0] ?? 0.28) * size; } });
    // the same face at the same size as 1400 (times k on a narrow screen), and never wider than the mask
    const sz = size * Math.min(k, (WM - T.x0 - 2 * g) / Math.max(1, advOf(1) * size)), topY = H / 2 + size * 0.36 - (base0 - B.y0) * (sz / size);
    const c = document.createElement("canvas"); c.width = WM; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    // every shape starts where the ink of "1400" starts and grows to the right (Parth, 3 Oct: "the position of 'The
    // House of' should never change"): the words stay put and the shapes come and go beside them
    set(x, sz, T.x0 - (B.x0 - 10) * (sz / size), H / 2 + size * 0.36, topY);
    const d = x.getImageData(0, 0, WM, H).data, I = new Float32Array((WM + 1) * (H + 1)), W1 = WM + 1;
    for (let y = 0; y < H; y++) { let r = 0; for (let i = 0; i < WM; i++) { r += d[(y * WM + i) * 4 + 3] / 255; I[(y + 1) * W1 + i + 1] = I[y * W1 + i + 1] + r; } }
    const cover = (cx, cy, h) => { const x0 = Math.max(0, Math.floor(cx - h)), x1 = Math.min(WM, Math.ceil(cx + h)), y0 = Math.max(0, Math.floor(cy - h)), y1 = Math.min(H, Math.ceil(cy + h)); if (x1 <= x0 || y1 <= y0) return 0; return (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0)); };
    dots = []; const span = Math.hypot(WM, H) + WM, ca = Math.SQRT1_2;
    for (let j = -span / g; j < span / g; j++) for (let i = -span / g; i < span / g; i++) {
      const u = i * g, v = j * g, px = W / 2 + u * ca - v * ca, py = H / 2 + u * ca + v * ca;
      if (px < -g || py < -g || px > WM + g || py > H + g) continue;
      const base = Math.sqrt(cover(px, py, g / 2)); if (base > 0.04) dots.push({ x: px, y: py, base });
    }
  }
  shapeCache.set(key, dots); return dots;
}

// mountWordmark(el, { size: px, shares: [{ desk, words }], cycle: () => ["1400", "29°", "Cloudy", "15:42", ...] })
// At rest the figure is still and crisp. Every 7 seconds one swell sweeps across it; the pointer parts the dots while
// it moves; a tap or click re-forms the dots into the next shape of the cycle, and the figure comes back to 1400 by
// itself after a few seconds. It stops drawing whenever nothing moves, off screen, or in a hidden tab.
export async function mountWordmark(el, { size, shares = [], cycle = () => ["1400"], homeAfter = 6, weather = null, press = false, onShape = null, room = null }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { W, H, g } = await screenFor(size), R = g * 0.6;
  // the rotations at 1400's own size; where the screen (room: the width from 1400's first stroke to the edge) cannot
  // take the widest of today's, all of them share one smaller size. The canvas runs on to the right by E for the longer
  // words, and gives that back in its margin, so nothing beside it moves.
  const inkL = (W - ADV * size) / 2 + 0.028 * size, widest = Math.max(0, ...cycle().filter(t => t && t !== "1400").map(t => textAdv(String(t)) * size));
  const KR = room && widest ? Math.min(1, (room - g) / widest) : 1, E = Math.max(0, Math.ceil(inkL + widest * KR + 2 * g - W)), WM = W + E;
  const PX = Math.round(W * 0.2), PY = Math.round(H * 0.3), CW = WM + 2 * PX, CH = H + 2 * PY;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `display:block;width:${CW}px;height:${CH}px;margin:${-PY}px ${-E}px ${-PY}px 0;pointer-events:none;flex:none`;
  el.replaceChildren(c);
  el.style.touchAction = "manipulation";
  const ctx = c.getContext("2d");
  const S = shares.filter(x => x.words > 0);
  let ink = "", colours = [], look = {};
  const readInk = () => { const cs = getComputedStyle(document.documentElement); ink = cs.getPropertyValue("--ink").trim() || "#15140f"; colours = S.length ? S.map(x => cs.getPropertyValue(`--d-${x.desk}`).trim() || ink) : [ink];
    look = { ink, colours, paper: cs.getPropertyValue("--paper").trim() || "#f3f1ea", muted: cs.getPropertyValue("--muted").trim() || ink, dark: document.documentElement.dataset.theme === "dark" }; };
  readInk();
  const scale = () => { const r = c.getBoundingClientRect(), z = r.width / CW || 1, k = Math.min(3, (devicePixelRatio || 1) * z); c.width = Math.round(CW * k); c.height = Math.round(CH * k); ctx.setTransform(k, 0, 0, k, 0, 0); };
  scale();
  // the weather in the ink (v2/ink.js): fed every new shape's dots, set from the live weather where the reader is
  const wink = typeof inkWeather === "function" && !reduced ? inkWeather({ W, H, g, R, PX, PY, CW, CH }) : null;
  // the particles: each has a home on the current shape, an offset from it, a speed, and its desk band
  let parts = [], bands = [];
  const place = (homes, from) => {
    const order = [...homes].sort((a, b) => a.x - b.x || a.y - b.y), old = from ? [...from].sort((a, b) => (a.x + a.px) - (b.x + b.px)) : null;
    parts = order.map((h, i) => { const o = old?.[Math.floor(i * old.length / order.length)];
      return { x: h.x, y: h.y, base: h.base, px: o ? o.x + o.px - h.x : 0, py: o ? o.y + o.py - h.y : 0, vx: o ? o.vx + (Math.random() - 0.5) * g : 0, vy: o ? o.vy + (Math.random() - 0.5) * g : 0 }; });
    bands = bandsOf(parts, S);
    bands.forEach((list, bi) => list.forEach(d => { d.bi = bi; d.wx = 0; d.wy = 0; d.wr = 1; d.wa = 1; d.inkv = 0.62 + Math.random() * 0.38; }));
    wink?.parts(parts);
  };
  // the tapped words (the temperature, the sky, the time, a name) are printed on a finer screen than 1400, with dots to
  // match, so their thinner strokes stay readable; 1400 keeps its own screen
  let RS = R, shapeText = "1400"; const gOf = text => (text === "1400" ? g : g * 0.72);
  // the ink's box of each shape (in the figure's own pixels), for the page to set "The HOUSE OF" beside it
  // vertically, the word's body: rows holding a fair share of its ink, so a descender's thin tail (the y of "Sunny")
  // does not pull the centre line down, as a typesetter centres on the letters, not their tails
  const inkOf = (homes, gg = g) => {
    let x0 = 1e9, x1 = -1e9; const rows = new Map(), step = gg * Math.SQRT1_2; // the screen's rows are this far apart
    for (const d of homes) if (d.base > 0.35) { if (d.x < x0) x0 = d.x; if (d.x > x1) x1 = d.x; const r = Math.round(d.y / step); rows.set(r, (rows.get(r) || 0) + 1); }
    // the bottom is the baseline (a descender's tail, as in Sunny's y, holds under a fifth of the busiest row); the top
    // is the tallest letter's, so a capital or an ascender counts (Sunny's S stands above its lowercase)
    const most = Math.max(...rows.values()), at = k => [...rows].filter(([, n]) => n >= most * k).map(([r]) => r * step);
    return { x0, x1, y0: Math.min(...at(0.06)), y1: Math.max(...at(0.18)) };
  };
  const first = await textDots("1400", size, W, H, g);
  place(first); onShape?.(inkOf(first), "1400");
  const dust = [...Array(reduced ? 0 : Math.round(CW * CH / 1500))].map(() => ({ x: Math.random() * CW, y: Math.random() * CH, r: 0.45 + Math.random() * 0.85, a: Math.random() < 0.3, vx: 0, vy: 0 }));
  let pulseAt = -1e9, pulseBi = -1, beat = 0;
  const PULSE = 1.7;
  let pointer = null, quietTill = 0, lastMove = 0, morphAt = -1e9, swellAt = -1e9, energy = 0, raf = 0, alive = true, shown = true, last = 0, swellT = 0, homeT = 0, idx = 0;
  const at = e => { const r = c.getBoundingClientRect(), z = r.width / CW || 1; return [(e.clientX - r.left) / z - PX, (e.clientY - r.top) / z - PY]; };
  const field = (x, y, t) => [Math.sin(x * 0.021 + t * 0.8) + Math.sin(y * 0.05 - t * 0.6 + x * 0.008), Math.cos(x * 0.017 - t * 0.7) + Math.sin(y * 0.043 + t * 0.9)];
  const SWELL = 2.4;
  // The stamp (Parth, 2 Oct: "implement the stamp, but make it more realistic and beautiful"): once per visit the
  // figure is printed like a letterpress forme coming down on the page. Its shadow falls and darkens as it comes
  // down; on contact the ink squashes out and lands unevenly, as a real impression does, then soaks in and evens out;
  // the paper keeps a faint embossed impression for a moment; the nameplate gives a small thump; a few specks of ink
  // fly from the edges and settle; and the shadow lifts away. About two seconds, then the figure rests as before.
  const ST = { at: press && !reduced ? performance.now() / 1000 + 0.35 : -1, down: 0.24, specks: null, thumped: false };
  const stampOn = t => ST.at > 0 && t - ST.at < 2.4;
  function stampShadow(t) {
    const s = t - ST.at; let k, sx, sy, sc;
    if (s < ST.down) { k = Math.max(0, s / ST.down); sc = 1 + 0.16 * (1 - k); sx = g * 1.8 * (1 - k); sy = g * 2.4 * (1 - k); }
    else if (s > 0.42 && s < 0.85) { const u = (s - 0.42) / 0.43; k = 1 - u; sc = 1 + 0.12 * u; sx = -g * 1.2 * u; sy = -g * 1.8 * u; }
    else return;
    const cx = W / 2, cy = H / 2;
    ctx.globalAlpha = (look.dark ? 0.55 : 0.2) * k * k; ctx.fillStyle = look.dark ? "#000" : ink; ctx.beginPath();
    for (const d of parts) { const rr = Math.min(d.base, 1.1) * R * sc * 1.15; if (rr < 0.3) continue; const x = PX + cx + (d.x - cx) * sc + sx, y = PY + cy + (d.y - cy) * sc + sy; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
  function stampEmboss(t) {
    const s = t - ST.at - ST.down; if (s < 0) return;
    const e = Math.exp(-s * 1.5); if (e < 0.03) return;
    const pass = (dx, dy, col, a) => { ctx.globalAlpha = a * e; ctx.fillStyle = col; ctx.beginPath(); for (const d of parts) { const rr = Math.min(d.base, 1.15) * R * 1.12; if (rr < 0.3) continue; const x = PX + d.x + dx, y = PY + d.y + dy; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); } ctx.fill(); };
    if (!look.dark) pass(-0.9, -0.9, "#fff", 0.85);
    pass(1, 1.2, look.dark ? "#000" : ink, look.dark ? 0.6 : 0.16);
    ctx.globalAlpha = 1;
  }
  function stampSpecks(t, dt) {
    const s = t - ST.at - ST.down; if (s < 0) return;
    if (!ST.specks) {
      const edge = parts.filter(d => d.base > 0.6), cx = W / 2, cy = H / 2;
      ST.specks = [...Array(26)].map(() => { const d = edge[Math.floor(Math.random() * edge.length)], a = Math.atan2(d.y - cy, d.x - cx) + (Math.random() - 0.5) * 0.9, v = 40 + Math.random() * 150; return { x: d.x, y: d.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.4 + Math.random() * 1.1, bi: d.bi, sat: Math.random() < 0.4 }; });
      if (!ST.thumped) { ST.thumped = true; (el.closest("#bigplate") || el).animate?.([{ transform: "translateY(0)" }, { transform: "translateY(1.6px)" }, { transform: "translateY(0)" }], { duration: 170, easing: "cubic-bezier(.2,0,0,1)" }); }
    }
    const fade = Math.max(0, 1 - Math.max(0, s - 0.5) / 1.4);
    for (const p of ST.specks) { const drag = Math.pow(0.0008, dt); p.vx *= drag; p.vy *= drag; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (const p of ST.specks) { ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = colours[p.bi] || ink; ctx.beginPath(); ctx.arc(PX + p.x, PY + p.y, p.r, 0, Math.PI * 2); if (p.sat) ctx.arc(PX + p.x - p.vx * 0.01 - 2, PY + p.y - p.vy * 0.01 - 1, p.r * 0.45, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function draw(now) {
    const t = now / 1000, dt = last ? Math.min(3, (now - last) / 16.67) : 1; last = now;
    const swell = (t - swellAt) < SWELL ? (t - swellAt) / SWELL : -1, busy = !!pointer && now - lastMove < 1200 || now - morphAt < 2500 || swell >= 0;
    energy += ((busy ? 1 : 0) - energy) * Math.min(1, 0.06 * dt);
    ctx.clearRect(0, 0, CW, CH);
    const inked = !!wink?.on(), stamping = stampOn(t), ss = stamping ? t - ST.at - ST.down : 0;
    // the sun's shadow and the mirage are drawn under 1400 only: under a word they double its thin strokes
    if (inked) { wink.apply(t, dt / 60); if (shapeText === "1400") wink.under(ctx, t, look); }
    if (stamping) { stampShadow(t); stampEmboss(t); }
    const A = g * 0.42 * energy, Rp = H * 0.62, P = g * 0.9;
    const front = swell >= 0 ? swell * (W + 2 * PX) - PX : -1e9, band = W * 0.13;
    // the re-inked plate: a ring of fresh ink spreading from the middle of one desk's dots
    const pul = !reduced && t - pulseAt < PULSE ? (t - pulseAt) / PULSE : -1;
    let moving = false; const slips = [];
    bands.forEach((list, bi) => {
      ctx.fillStyle = colours[bi] || ink; ctx.beginPath();
      let pc = null;
      if (pul >= 0 && bi === pulseBi && list.length) {
        if (!list.mid) { let x = 0, y = 0; for (const d of list) { x += d.x; y += d.y; } x /= list.length; y /= list.length; let far = 0; for (const d of list) far = Math.max(far, Math.hypot(d.x - x, d.y - y)); list.mid = [x, y, far]; }
        pc = list.mid;
      }
      let faint = inked ? new Map() : null; // dots the weather (or the stamp's uneven ink) dims, drawn after at their own strength
      for (const d of list) {
        let r = d.base, ring = 0;
        if (!reduced) {
          const [a, b] = field(d.x, d.y, t), sw = Math.max(0, 1 - Math.abs(d.x - front) / band), s2 = sw * sw * (3 - 2 * sw);
          const tx = A * a + s2 * g * 0.9 * Math.sin(d.y * 0.09 + t * 2), ty = A * 0.6 * b - s2 * g * 1.4;
          let ax = (tx - d.px) * 0.06, ay = (ty - d.py) * 0.06;
          if (pointer && now > quietTill) { const dx = d.x + d.px - pointer[0], dy = d.y + d.py - pointer[1], dd = Math.hypot(dx, dy) || 1; if (dd < Rp) { const f = (1 - dd / Rp) ** 2 * P; ax += (dx / dd) * f - (dy / dd) * f * 0.7; ay += (dy / dd) * f + (dx / dd) * f * 0.7; } }
          d.vx = (d.vx + ax * dt) * 0.86 ** dt; d.vy = (d.vy + ay * dt) * 0.86 ** dt; d.px += d.vx * dt; d.py += d.vy * dt;
          if (Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || Math.abs(d.px) + Math.abs(d.py) > 0.08) moving = true;
          const wave = 0.5 + 0.5 * Math.sin(d.x * 0.035 - t * 1.6 + d.y * 0.012), moved = Math.min(1, Math.hypot(d.vx, d.vy) / g);
          r = d.base * (1 + energy * (0.32 * wave - 0.2) + 0.25 * s2) * (1 - 0.25 * moved);
          if (pc) { const k = (Math.hypot(d.x - pc[0], d.y - pc[1]) - pul * (pc[2] + g * 3)) / (g * 2.4); ring = Math.exp(-k * k) * Math.sqrt(1 - pul); r *= 1 + 0.45 * ring; }
          // fast enough to slip off the plate: the neighbouring plate shows behind it, trailing the way it came
          const sp = Math.hypot(d.vx, d.vy) / g;
          if (sp > 0.18 && S.length > 1) slips.push(bi, PX + d.x + d.px + d.wx - d.vx * 1.6, PY + d.y + d.py + d.wy - d.vy * 1.6, Math.min(1, (sp - 0.18) * 2.2), d);
        } else { d.px = 0; d.py = 0; }
        // a dot never grows past 1.15 of its size, in motion or in weather, so neighbours never run into each other (2 Oct:
        // at 1.3 a tapped word's thin strokes ran into blobs)
        // (fresh ink, for the moment the ring passes, stands a little higher and fuller: up to 1.28)
        let x = PX + d.x + d.px + d.wx, y = PY + d.y + d.py + d.wy - ring * g * 0.3, rr = Math.min(r * d.wr, 1.15 + 0.13 * ring) * RS;
        if (rr < 0.25) continue;
        if (stamping) {
          if (ss < 0) continue; // the forme has not come down yet
          const settle = Math.min(1, ss / 1.3), a = 1 - (1 - d.inkv) * (1 - settle * settle * (3 - 2 * settle));
          rr *= 1 + 0.5 * Math.exp(-ss * 4.2); if (ss < 0.12) { x += (Math.random() - 0.5) * 0.9; y += (Math.random() - 0.5) * 0.9; }
          if (a < 0.97) { const k = Math.round(a * 20) / 20; (faint || (faint = new Map())); if (!faint.has(k)) faint.set(k, []); faint.get(k).push(x, y, Math.min(rr, 1.45 * RS)); continue; }
        }
        if (faint && d.wa < 0.97) { const k = Math.round(d.wa * 20) / 20; if (!faint.has(k)) faint.set(k, []); faint.get(k).push(x, y, rr); continue; }
        ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2);
      }
      ctx.fill();
      if (faint) for (const [k, a] of faint) { ctx.globalAlpha = k; ctx.beginPath(); for (let i = 0; i < a.length; i += 3) { ctx.moveTo(a[i] + a[i + 2], a[i + 1]); ctx.arc(a[i], a[i + 1], a[i + 2], 0, Math.PI * 2); } ctx.fill(); ctx.globalAlpha = 1; }
    });
    // the fringes, under nothing and over the paper: drawn after the plates, faint, in the next plate's colour
    if (slips.length) {
      for (let i = 0; i < slips.length; i += 5) {
        const d = slips[i + 4], rr = Math.min(d.base * d.wr, 1.15) * RS * 0.92; if (rr < 0.25) continue;
        ctx.globalAlpha = 0.5 * slips[i + 3]; ctx.fillStyle = colours[(slips[i] + 1) % colours.length] || ink;
        ctx.beginPath(); ctx.arc(slips[i + 1], slips[i + 2], rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (inked) wink.over(ctx, t, dt / 60, look);
    if (stamping) stampSpecks(t, dt / 60);
    // loose ink drifts only while the figure moves
    for (const p of dust) {
      if (energy > 0.02) {
        const [a, b] = field(p.x, p.y, t * 0.6);
        p.vx += (a * 0.05 + 0.04) * dt * energy; p.vy += b * 0.035 * dt * energy;
        if (pointer) { const dx = p.x - PX - pointer[0], dy = p.y - PY - pointer[1], dd = Math.hypot(dx, dy) || 1; if (dd < Rp) { const f = (1 - dd / Rp) * 0.25; p.vx += (dx / dd) * f; p.vy += (dy / dd) * f; } }
      }
      p.vx *= 0.94 ** dt; p.vy *= 0.94 ** dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.abs(p.vx) + Math.abs(p.vy) > 0.01) moving = true;
      if (p.x > CW + 2) p.x = -2; if (p.x < -2) p.x = CW + 2; if (p.y > CH + 2) p.y = -2; if (p.y < -2) p.y = CH + 2;
    }
    for (const dark of [true, false]) { ctx.fillStyle = ink; ctx.globalAlpha = dark ? 0.55 : 0.28; ctx.beginPath(); for (const p of dust) if (p.a === dark) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); } ctx.fill(); }
    ctx.globalAlpha = 1;
    return busy || pul >= 0 || energy > 0.01 || moving || inked || stamping || (ST.at > 0 && t < ST.at);
  }
  // with only the weather moving, it draws at about 30 frames a second to spare a phone's battery
  let lastDraw = 0;
  function frame(now) {
    raf = 0; if (!alive || !shown || document.hidden) return;
    const calm = wink?.on() && energy < 0.01 && !pointer && now - morphAt > 2500;
    if (calm && now - lastDraw < 31) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    if (draw(now)) raf = requestAnimationFrame(frame); else last = 0;
  }
  const wake = () => { if (!reduced && !raf && alive && shown && !document.hidden) raf = requestAnimationFrame(frame); };
  // a beat every 4 seconds while the figure is on screen: a desk re-inked (in the tabs' order, skipping a sliver too
  // small to see), and every third beat the swell across the whole figure
  const swellLoop = () => {
    clearTimeout(swellT); if (!alive) return;
    if (shown && !document.hidden && !reduced) {
      const now = performance.now() / 1000;
      if (beat++ % 3 === 2 || bands.length < 2) swellAt = now;
      else { const n = bands.length, total = bands.reduce((a, l) => a + l.length, 0); for (let k = 1; k <= n; k++) { const i = (pulseBi + k + n) % n; if (bands[i].length >= total * 0.04) { pulseBi = i; break; } } pulseAt = now; }
      wake();
    }
    swellT = setTimeout(swellLoop, 4000);
  };
  const reform = async text => { const gs = gOf(text), homes = await textDots(text, size, W, H, gs, KR, WM); RS = gs * 0.6; shapeText = text; place(homes, parts); onShape?.(inkOf(homes, gs), text); morphAt = performance.now(); el.setAttribute("aria-label", text); if (reduced) draw(performance.now()); else wake(); };
  const onMove = e => { if (e.pointerType === "mouse") { pointer = at(e); lastMove = performance.now(); wake(); } };
  const onLeave = () => { pointer = null; };
  const onDown = () => {
    quietTill = performance.now() + 1800; // the new shape shows whole, even with the pointer still on it
    const list = cycle().filter(Boolean); if (list.length < 2) return;
    idx = (idx + 1) % list.length; reform(list[idx]);
    clearTimeout(homeT); homeT = setTimeout(() => { if (idx) { idx = 0; reform(list[0]); } }, homeAfter * 1000);
  };
  const onVis = () => { last = 0; wake(); };
  const onResize = () => { scale(); draw(performance.now()); };
  el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerdown", onDown);
  document.addEventListener("visibilitychange", onVis); addEventListener("resize", onResize);
  const io = new IntersectionObserver(es => { shown = es.some(x => x.isIntersecting); last = 0; wake(); }); io.observe(el);
  const redraw = () => { readInk(); draw(performance.now()); };
  const mo = new MutationObserver(redraw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener?.("change", redraw);
  // the weather: read now and every minute (the page's live weather refreshes every few minutes)
  const readWeather = () => { if (!wink || !weather) return; let st = null; try { st = weather(); } catch {} wink.set(st); wake(); };
  readWeather(); const wxT = setInterval(readWeather, 60000);
  draw(performance.now()); last = 0; swellT = setTimeout(swellLoop, ST.at > 0 ? 3500 : 1500); if (ST.at > 0) wake();
  const destroy = () => { clearInterval(wxT); undo(); };
  destroy.setWeather = st => { if (wink) { wink.set(st); wake(); } };
  return destroy;
  function undo() { alive = false; cancelAnimationFrame(raf); clearTimeout(swellT); clearTimeout(homeT); io.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", redraw); document.removeEventListener("visibilitychange", onVis); removeEventListener("resize", onResize);
    el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); }
}
