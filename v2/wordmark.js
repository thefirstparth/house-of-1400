// The House of 1400's wordmark on Page One (Parth, 1 Oct 2026: options 1 + 4 of design/nameplate; 2 Oct: ink only,
// always flowing, no links).
// "1400" printed as a newsprint halftone: a 45° screen of round ink dots, each sized by how much of its cell the
// figure covers, so it reads as the solid Playfair 1400 from a distance and as a printed screen up close.
// - Always: a slow current runs through the figure. The dots sway with it and swell thick and thin as it passes,
//   every few seconds a stronger swell sweeps across, and a little loose ink drifts around the figure.
// - Pointer (laptop): the dots part around the pointer with a swirl and spring back when it leaves.
// - Tap or click: the dots are thrown out from the finger and settle back onto the screen.
// - Motion off (prefers-reduced-motion): one still, printed figure.
// It stops drawing when it is off screen or the tab is hidden. Lining figures: the text is drawn through an SVG
// image (Playfair's default figures are oldstyle, and a canvas cannot switch them), which works in every browser.
// mountWordmark(el, { font: base64 woff2 of Playfair Display, size: px }) -> destroy()

const CACHE = new Map();

async function maskOf(text, size, W, H, font) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>@font-face{font-family:P;src:url(data:font/woff2;base64,${font})}text{font:900 ${size}px P;font-variant-numeric:lining-nums}</style><text x="${W / 2}" y="${H / 2 + size * 0.36}" text-anchor="middle">${text}</text></svg>`;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
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
async function screenFor(size, font) {
  const key = String(size);
  if (CACHE.has(key)) return CACHE.get(key);
  const probe = document.createElement("span");
  probe.textContent = "1400";
  probe.style.cssText = `position:absolute;visibility:hidden;font:900 ${size}px "Playfair Display",serif;font-variant-numeric:lining-nums`;
  document.body.append(probe); const w = probe.getBoundingClientRect().width; probe.remove();
  const W = Math.ceil(w + size * 0.5), H = Math.ceil(size * 1.02), g = Math.max(3, size / 21);
  const cover = await maskOf("1400", size, W, H, font);
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

export async function mountWordmark(el, { font, size }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { W, H, g, dots } = await screenFor(size, font), R = g * 0.6;
  // the canvas reaches past the figure, so loose ink and parted dots have room; it never takes the pointer itself
  const PX = Math.round(W * 0.2), PY = Math.round(H * 0.3), CW = W + 2 * PX, CH = H + 2 * PY;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `display:block;width:${CW}px;height:${CH}px;margin:${-PY}px auto;pointer-events:none;flex:none`;
  el.replaceChildren(c);
  el.style.touchAction = "pan-y";
  const ctx = c.getContext("2d");
  let ink = "";
  const readInk = () => { ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#15140f"; };
  readInk();
  // sharp at any page zoom (Page One scales itself to the screen) and on any phone
  const scale = () => { const r = c.getBoundingClientRect(), z = r.width / CW || 1, k = Math.min(3, (devicePixelRatio || 1) * z); c.width = Math.round(CW * k); c.height = Math.round(CH * k); ctx.setTransform(k, 0, 0, k, 0, 0); };
  scale();
  for (const d of dots) { d.px = 0; d.py = 0; d.vx = 0; d.vy = 0; }
  // loose ink: a few specks drifting around the figure on the same current
  const dust = [...Array(reduced ? 0 : Math.round(CW * CH / 1500))].map(() => ({ x: Math.random() * CW, y: Math.random() * CH, r: 0.45 + Math.random() * 0.85, a: Math.random() < 0.3, vx: 0, vy: 0 }));
  let pointer = null, kicks = [], raf = 0, alive = true, shown = true, last = 0;
  const at = e => { const r = c.getBoundingClientRect(), z = r.width / CW || 1; return [(e.clientX - r.left) / z - PX, (e.clientY - r.top) / z - PY]; };
  const field = (x, y, t) => [Math.sin(x * 0.021 + t * 0.8) + Math.sin(y * 0.05 - t * 0.6 + x * 0.008), Math.cos(x * 0.017 - t * 0.7) + Math.sin(y * 0.043 + t * 0.9)];
  function draw(t, dt) {
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = ink;
    const A = g * 0.42, Rp = H * 0.62, P = g * 0.9;
    // the swell: every 7 seconds a band sweeps left to right, lifting and thickening the dots it passes
    const front = ((t % 7) / 7) * (W + 2 * PX) - PX, band = W * 0.13;
    ctx.beginPath();
    for (const d of dots) {
      let r = d.base;
      if (!reduced) {
        const [a, b] = field(d.x, d.y, t), sw = Math.max(0, 1 - Math.abs(d.x - front) / band), s2 = sw * sw * (3 - 2 * sw);
        const tx = A * a + s2 * g * 0.9 * Math.sin(d.y * 0.09 + t * 2), ty = A * 0.6 * b - s2 * g * 1.4;
        let ax = (tx - d.px) * 0.06, ay = (ty - d.py) * 0.06;
        if (pointer) {
          const dx = d.x + d.px - pointer[0], dy = d.y + d.py - pointer[1], dd = Math.hypot(dx, dy) || 1;
          if (dd < Rp) { const f = (1 - dd / Rp) ** 2 * P; ax += (dx / dd) * f - (dy / dd) * f * 0.7; ay += (dy / dd) * f + (dx / dd) * f * 0.7; }
        }
        for (const k of kicks) {
          if (k.done) continue;
          const dx = d.x - k.x, dy = d.y - k.y, dd = Math.hypot(dx, dy) || 1, f = Math.max(0, 1 - dd / (W * 0.7)) * g * 2.6;
          d.vx += (dx / dd) * f + (Math.random() - 0.5) * f * 0.6; d.vy += (dy / dd) * f + (Math.random() - 0.5) * f * 0.6;
        }
        d.vx = (d.vx + ax * dt) * 0.86 ** dt; d.vy = (d.vy + ay * dt) * 0.86 ** dt;
        d.px += d.vx * dt; d.py += d.vy * dt;
        // thick and thin: a ripple of ink weight runs along the figure, and the swell inks heavier
        const wave = 0.5 + 0.5 * Math.sin(d.x * 0.035 - t * 1.6 + d.y * 0.012);
        const moved = Math.min(1, Math.hypot(d.vx, d.vy) / g);
        r = d.base * (0.8 + 0.32 * wave + 0.25 * s2) * (1 - 0.25 * moved);
      }
      const x = PX + d.x + d.px, y = PY + d.y + d.py, rr = Math.min(r, 1.15) * R;
      if (rr < 0.25) continue;
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2);
    }
    ctx.fill();
    kicks.forEach(k => (k.done = true)); kicks = [];
    for (const p of dust) {
      const [a, b] = field(p.x, p.y, t * 0.6);
      p.vx += (a * 0.05 + 0.04) * dt; p.vy += b * 0.035 * dt;
      if (pointer) { const dx = p.x - PX - pointer[0], dy = p.y - PY - pointer[1], dd = Math.hypot(dx, dy) || 1; if (dd < Rp) { const f = (1 - dd / Rp) * 0.25; p.vx += (dx / dd) * f; p.vy += (dy / dd) * f; } }
      p.vx *= 0.94 ** dt; p.vy *= 0.94 ** dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x > CW + 2) p.x = -2; if (p.x < -2) p.x = CW + 2; if (p.y > CH + 2) p.y = -2; if (p.y < -2) p.y = CH + 2;
    }
    for (const dark of [true, false]) {
      ctx.globalAlpha = dark ? 0.55 : 0.28; ctx.beginPath();
      for (const p of dust) if (p.a === dark) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0; if (!alive || !shown || document.hidden) return;
    const dt = last ? Math.min(3, (now - last) / 16.67) : 1; last = now;
    draw(now / 1000, dt);
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!reduced && !raf && alive && shown && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const onMove = e => { if (e.pointerType === "mouse") pointer = at(e); };
  const onLeave = () => { pointer = null; };
  const onDown = e => { const [x, y] = at(e); kicks.push({ x, y }); if (reduced) draw(0, 1); };
  const onVis = () => wake();
  const onResize = () => { scale(); if (reduced) draw(0, 1); };
  el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerdown", onDown);
  document.addEventListener("visibilitychange", onVis); addEventListener("resize", onResize);
  const io = new IntersectionObserver(es => { shown = es.some(x => x.isIntersecting); wake(); });
  io.observe(el);
  const mo = new MutationObserver(() => { readInk(); if (reduced) draw(0, 1); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"), onScheme = () => { readInk(); if (reduced) draw(0, 1); }; mq.addEventListener?.("change", onScheme);
  draw(0, 1); wake();
  return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", onScheme); document.removeEventListener("visibilitychange", onVis); removeEventListener("resize", onResize);
    el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); };
}
