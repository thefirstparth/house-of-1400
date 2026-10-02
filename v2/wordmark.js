// The House of 1400's wordmark on Page One (Parth, 1 Oct 2026: options 1 + 4 of design/nameplate; 2 Oct: always
// flowing, no links, the desk colours always on).
// "1400" printed as a newsprint halftone: a 45° screen of round dots, each sized by how much of its cell the figure
// covers, so it reads as the solid Playfair 1400 from a distance and as a printed screen up close.
// - The day in dots: the figure is shared among today's desks in the tabs' order, left to right, each in proportion to
//   its length in words, and each desk's dots are printed in its colour. A long Sport day makes a wide orange band.
// - At rest the figure is still and crisp. Every 7 seconds one swell sweeps across it, thickening the dots it passes,
//   and a little loose ink drifts while it moves (Parth, 2 Oct: rest, then swell, to spare a phone's battery).
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

// Any short text in the same face, for the shapes a tap cycles through (v2/glyphs.json, embedded by the build as
// GLYPHS): it is set to fit the width of "1400" at most, on the same baseline.
const shapeCache = new Map();
async function textDots(text, size, W, H, g) {
  const key = `${text}|${size}|${g}`; if (shapeCache.has(key)) return shapeCache.get(key);
  let dots;
  if (text === "1400" || typeof GLYPHS === "undefined") dots = (await screenFor(size, g)).dots;
  else {
    const chars = [...text].filter(ch => GLYPHS[ch] || ch === " "), adv = chars.reduce((a, ch) => a + (GLYPHS[ch]?.[0] ?? 0.28), 0) || 1;
    const sz = Math.min(size * 1.05, (size * ADV) / adv), c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    let at = W / 2 - (adv * sz) / 2;
    for (const ch of chars) { const G = GLYPHS[ch]; if (G) { x.setTransform(sz, 0, 0, sz, at, H / 2 + size * 0.36); x.fill(new Path2D(G[1])); } at += (G?.[0] ?? 0.28) * sz; }
    const d = x.getImageData(0, 0, W, H).data, I = new Float32Array((W + 1) * (H + 1)), W1 = W + 1;
    for (let y = 0; y < H; y++) { let r = 0; for (let i = 0; i < W; i++) { r += d[(y * W + i) * 4 + 3] / 255; I[(y + 1) * W1 + i + 1] = I[y * W1 + i + 1] + r; } }
    const cover = (cx, cy, h) => { const x0 = Math.max(0, Math.floor(cx - h)), x1 = Math.min(W, Math.ceil(cx + h)), y0 = Math.max(0, Math.floor(cy - h)), y1 = Math.min(H, Math.ceil(cy + h)); if (x1 <= x0 || y1 <= y0) return 0; return (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0)); };
    dots = []; const span = Math.hypot(W, H), ca = Math.SQRT1_2;
    for (let j = -span / g; j < span / g; j++) for (let i = -span / g; i < span / g; i++) {
      const u = i * g, v = j * g, px = W / 2 + u * ca - v * ca, py = H / 2 + u * ca + v * ca;
      if (px < -g || py < -g || px > W + g || py > H + g) continue;
      const base = Math.sqrt(cover(px, py, g / 2)); if (base > 0.04) dots.push({ x: px, y: py, base });
    }
  }
  shapeCache.set(key, dots); return dots;
}

// mountWordmark(el, { size: px, shares: [{ desk, words }], cycle: () => ["1400", "29°", "Cloudy", "15:42", ...] })
// At rest the figure is still and crisp. Every 7 seconds one swell sweeps across it; the pointer parts the dots while
// it moves; a tap or click re-forms the dots into the next shape of the cycle, and the figure comes back to 1400 by
// itself after a few seconds. It stops drawing whenever nothing moves, off screen, or in a hidden tab.
export async function mountWordmark(el, { size, shares = [], cycle = () => ["1400"], homeAfter = 6 }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { W, H, g } = await screenFor(size), R = g * 0.6;
  const PX = Math.round(W * 0.2), PY = Math.round(H * 0.3), CW = W + 2 * PX, CH = H + 2 * PY;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `display:block;width:${CW}px;height:${CH}px;margin:${-PY}px auto;pointer-events:none;flex:none`;
  el.replaceChildren(c);
  el.style.touchAction = "manipulation";
  const ctx = c.getContext("2d");
  const S = shares.filter(x => x.words > 0);
  let ink = "", colours = [];
  const readInk = () => { const cs = getComputedStyle(document.documentElement); ink = cs.getPropertyValue("--ink").trim() || "#15140f"; colours = S.length ? S.map(x => cs.getPropertyValue(`--d-${x.desk}`).trim() || ink) : [ink]; };
  readInk();
  const scale = () => { const r = c.getBoundingClientRect(), z = r.width / CW || 1, k = Math.min(3, (devicePixelRatio || 1) * z); c.width = Math.round(CW * k); c.height = Math.round(CH * k); ctx.setTransform(k, 0, 0, k, 0, 0); };
  scale();
  // the particles: each has a home on the current shape, an offset from it, a speed, and its desk band
  let parts = [], bands = [];
  const place = (homes, from) => {
    const order = [...homes].sort((a, b) => a.x - b.x || a.y - b.y), old = from ? [...from].sort((a, b) => (a.x + a.px) - (b.x + b.px)) : null;
    parts = order.map((h, i) => { const o = old?.[Math.floor(i * old.length / order.length)];
      return { x: h.x, y: h.y, base: h.base, px: o ? o.x + o.px - h.x : 0, py: o ? o.y + o.py - h.y : 0, vx: o ? o.vx + (Math.random() - 0.5) * g : 0, vy: o ? o.vy + (Math.random() - 0.5) * g : 0 }; });
    bands = bandsOf(parts, S);
  };
  place(await textDots("1400", size, W, H, g));
  const dust = [...Array(reduced ? 0 : Math.round(CW * CH / 1500))].map(() => ({ x: Math.random() * CW, y: Math.random() * CH, r: 0.45 + Math.random() * 0.85, a: Math.random() < 0.3, vx: 0, vy: 0 }));
  let pointer = null, quietTill = 0, lastMove = 0, morphAt = -1e9, swellAt = -1e9, energy = 0, raf = 0, alive = true, shown = true, last = 0, swellT = 0, homeT = 0, idx = 0;
  const at = e => { const r = c.getBoundingClientRect(), z = r.width / CW || 1; return [(e.clientX - r.left) / z - PX, (e.clientY - r.top) / z - PY]; };
  const field = (x, y, t) => [Math.sin(x * 0.021 + t * 0.8) + Math.sin(y * 0.05 - t * 0.6 + x * 0.008), Math.cos(x * 0.017 - t * 0.7) + Math.sin(y * 0.043 + t * 0.9)];
  const SWELL = 2.4;
  function draw(now) {
    const t = now / 1000, dt = last ? Math.min(3, (now - last) / 16.67) : 1; last = now;
    const swell = (t - swellAt) < SWELL ? (t - swellAt) / SWELL : -1, busy = !!pointer && now - lastMove < 1200 || now - morphAt < 2500 || swell >= 0;
    energy += ((busy ? 1 : 0) - energy) * Math.min(1, 0.06 * dt);
    ctx.clearRect(0, 0, CW, CH);
    const A = g * 0.42 * energy, Rp = H * 0.62, P = g * 0.9;
    const front = swell >= 0 ? swell * (W + 2 * PX) - PX : -1e9, band = W * 0.13;
    let moving = false;
    bands.forEach((list, bi) => {
      ctx.fillStyle = colours[bi] || ink; ctx.beginPath();
      for (const d of list) {
        let r = d.base;
        if (!reduced) {
          const [a, b] = field(d.x, d.y, t), sw = Math.max(0, 1 - Math.abs(d.x - front) / band), s2 = sw * sw * (3 - 2 * sw);
          const tx = A * a + s2 * g * 0.9 * Math.sin(d.y * 0.09 + t * 2), ty = A * 0.6 * b - s2 * g * 1.4;
          let ax = (tx - d.px) * 0.06, ay = (ty - d.py) * 0.06;
          if (pointer && now > quietTill) { const dx = d.x + d.px - pointer[0], dy = d.y + d.py - pointer[1], dd = Math.hypot(dx, dy) || 1; if (dd < Rp) { const f = (1 - dd / Rp) ** 2 * P; ax += (dx / dd) * f - (dy / dd) * f * 0.7; ay += (dy / dd) * f + (dx / dd) * f * 0.7; } }
          d.vx = (d.vx + ax * dt) * 0.86 ** dt; d.vy = (d.vy + ay * dt) * 0.86 ** dt; d.px += d.vx * dt; d.py += d.vy * dt;
          if (Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || Math.abs(d.px) + Math.abs(d.py) > 0.08) moving = true;
          const wave = 0.5 + 0.5 * Math.sin(d.x * 0.035 - t * 1.6 + d.y * 0.012), moved = Math.min(1, Math.hypot(d.vx, d.vy) / g);
          r = d.base * (1 + energy * (0.32 * wave - 0.2) + 0.25 * s2) * (1 - 0.25 * moved);
        } else { d.px = 0; d.py = 0; }
        const x = PX + d.x + d.px, y = PY + d.y + d.py, rr = Math.min(r, 1.15) * R;
        if (rr < 0.25) continue;
        ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2);
      }
      ctx.fill();
    });
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
    return busy || energy > 0.01 || moving;
  }
  function frame(now) { raf = 0; if (!alive || !shown || document.hidden) return; if (draw(now)) raf = requestAnimationFrame(frame); else last = 0; }
  const wake = () => { if (!reduced && !raf && alive && shown && !document.hidden) raf = requestAnimationFrame(frame); };
  // one swell every 7 seconds, while the figure is on screen
  const swellLoop = () => { clearTimeout(swellT); if (!alive) return; if (shown && !document.hidden && !reduced) { swellAt = performance.now() / 1000; wake(); } swellT = setTimeout(swellLoop, 7000); };
  const reform = async text => { const homes = await textDots(text, size, W, H, g); place(homes, parts); morphAt = performance.now(); el.setAttribute("aria-label", text); if (reduced) draw(performance.now()); else wake(); };
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
  draw(performance.now()); last = 0; swellT = setTimeout(swellLoop, 1500);
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(swellT); clearTimeout(homeT); io.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", redraw); document.removeEventListener("visibilitychange", onVis); removeEventListener("resize", onResize);
    el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); };
}
