// Wordmark moments (mock, 2 Oct 2026; Parth: "Big moments, the weather in the ink, a printing press on first load:
// show all three separately and together, in multiple variants"). Built on the paper's own halftone (v2/wordmark.js,
// inlined by build.mjs: screenFor, bandsOf) and today's real desk split (SHARES). Nothing here is production code.

const css = (n, el = document.documentElement) => getComputedStyle(el).getPropertyValue(n).trim();
let DARK = false; // the card being drawn is a night card (set by Mark.frame)
const dark = () => DARK;
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------- the mark: the halftone, plus effects on top
class Mark {
  constructor(canvas, { size = 96, plan = [], loop = 0, onLine = () => {} }) {
    Object.assign(this, { canvas, size, plan, loop, onLine });
    this.ctx = canvas.getContext("2d");
  }
  async init() {
    const s = await screenFor(this.size);
    Object.assign(this, { W: s.W, H: s.H, g: s.g, R: s.g * 0.6 });
    this.PX = Math.round(s.W * 0.2); this.PY = Math.round(s.H * 0.55); this.CW = s.W + 2 * this.PX; this.CH = s.H + 2 * this.PY;
    this.parts = [];
    bandsOf(s.dots, SHARES).forEach((list, bi) => list.forEach(d => this.parts.push({ x: d.x, y: d.y, base: d.base, bi })));
    const P = this.parts, g = this.g;
    for (const d of P) {
      d.bottom = !P.some(o => o !== d && Math.abs(o.x - d.x) < g * 0.8 && o.y > d.y && o.y - d.y < g * 1.6);
      d.top = !P.some(o => o !== d && Math.abs(o.x - d.x) < g * 0.8 && o.y < d.y && d.y - o.y < g * 1.6);
      d.right = !P.some(o => o !== d && Math.abs(o.y - d.y) < g * 0.8 && o.x > d.x && o.x - d.x < g * 1.6);
    }
    this.edges = { bottom: P.filter(d => d.bottom && d.base > 0.5), top: P.filter(d => d.top && d.base > 0.5), right: P.filter(d => d.right && d.base > 0.5) };
    this.canvas.style.width = `${this.CW}px`; this.canvas.style.maxWidth = "100%"; this.canvas.style.aspectRatio = `${this.CW} / ${this.CH}`;
    this.colours(); this.scale();
    this.restart();
  }
  colours() { const el = this.canvas; this.ink = css("--ink", el); this.cols = SHARES.map(x => css(`--d-${x.desk}`, el) || this.ink); }
  isDark() { return this.canvas.closest("[data-theme]")?.dataset.theme === "dark"; }
  scale() { const k = Math.min(3, devicePixelRatio || 1); this.canvas.width = Math.round(this.CW * k); this.canvas.height = Math.round(this.CH * k); this.ctx.setTransform(k, 0, 0, k, 0, 0); }
  restart() { this.t0 = performance.now(); this.last = 0; for (const p of this.plan) p.fx.reset?.(this); this.onLine("", false); }
  frame(now) {
    DARK = this.isDark();
    let t = (now - this.t0) / 1000;
    if (this.loop && t > this.loop) { this.restart(); t = 0; }
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60; this.last = now;
    for (const d of this.parts) { d.ox = 0; d.oy = 0; d.rs = 1; d.col = null; d.a = 1; }
    for (const p of this.plan) p.fx.apply?.(this, t - (p.at || 0), dt);
    const { ctx, R, PX, PY } = this, groups = new Map();
    ctx.clearRect(0, 0, this.CW, this.CH);
    for (const d of this.parts) {
      if (d.a <= 0.02) continue;
      const rr = Math.min(d.base * d.rs, 1.35) * R; if (rr < 0.25) continue;
      const key = `${d.col || this.cols[d.bi]}|${Math.round(d.a * 20) / 20}`;
      let g = groups.get(key); if (!g) groups.set(key, (g = []));
      g.push(PX + d.x + d.ox, PY + d.y + d.oy, rr);
    }
    for (const [key, arr] of groups) {
      const [col, a] = key.split("|"); ctx.globalAlpha = +a; ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < arr.length; i += 3) { ctx.moveTo(arr[i] + arr[i + 2], arr[i + 1]); ctx.arc(arr[i], arr[i + 1], arr[i + 2], 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of this.plan) p.fx.extra?.(this, ctx, t - (p.at || 0), dt);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
}
const dot = (ctx, x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); };

// ---------------------------------------------------------------- 1. a printing press on first load
const PRESS = {
  // each desk's dots arrive as their own plate, in the tabs' order, a little out of register, then snap into place
  plates: () => ({
    apply(m, t) {
      const step = 0.24, land = 0.4, n = SHARES.length, done = n * step + land;
      for (const d of m.parts) {
        const e = (t - d.bi * step) / land;
        if (e < 0) { d.a = 0; continue; }
        if (e < 1) { const k = ease(e); d.a = clamp(e * 3); d.ox = (1 - k) * m.g * 2.4 * (d.bi % 2 ? 1 : -1); d.oy = (1 - k) * -m.g * 1.6; d.rs = 1 + 0.3 * (1 - k); }
        const s = (t - done) / 0.22, r = s < 0 ? 1 : 1 - ease(s); // the last snap into register
        if (r > 0) { d.ox += r * m.g * 0.35 * (d.bi % 2 ? 1 : -1); d.oy += r * m.g * 0.25; }
      }
    },
  }),
  // a roller passes left to right and leaves the figure behind it, the newest ink still wet and spread
  roller: () => {
    let specks = [];
    const T = 1.25, front = (m, t) => -m.g * 3 + (m.W + m.g * 6) * (t / T);
    return {
      reset() { specks = []; },
      apply(m, t) {
        const f = front(m, t);
        for (const d of m.parts) { const b = f - d.x; if (b < 0) { d.a = 0; continue; } const w = Math.max(0, 1 - b / (m.g * 7)); d.rs = 1 + 0.5 * w; d.ox = -w * m.g * 0.5; }
      },
      extra(m, ctx, t, dt) {
        if (t < 0 || t > T + 1) return;
        const x = m.PX + front(m, t), y0 = m.PY - m.g * 4, y1 = m.PY + m.H + m.g * 4;
        if (t <= T) {
          ctx.globalAlpha = 0.1; ctx.fillStyle = m.ink; ctx.fillRect(x, y0, m.g * 2.6, y1 - y0);
          ctx.globalAlpha = 0.55; ctx.fillRect(x, y0, 1, y1 - y0); ctx.fillRect(x + m.g * 2.6, y0, 1, y1 - y0);
          if (Math.random() < 0.5) specks.push({ x: x + m.g * 3, y: rnd(m.PY, m.PY + m.H), vx: rnd(10, 60), vy: rnd(-10, 30), r: rnd(0.5, 1.3), age: 0, c: pick(m.cols) });
        }
        for (const s of specks) { s.age += dt; s.vy += 200 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
        specks = specks.filter(s => s.age < 0.8);
        for (const s of specks) { ctx.globalAlpha = 0.6 * (1 - s.age / 0.8); ctx.fillStyle = s.c; ctx.beginPath(); dot(ctx, s.x, s.y, s.r); ctx.fill(); }
      },
    };
  },
  // four process plates (cyan, magenta, yellow, black) land one by one, off register, and settle into the desk colours
  process: () => ({
    apply(m, t) { const e = smooth((t - 1.25) / 0.45); for (const d of m.parts) d.a = e; },
    extra(m, ctx, t) {
      const e = smooth((t - 1.25) / 0.45); if (e >= 1 || t < 0) return;
      const P = dark() ? [["#3cc8ff", -1, -0.8], ["#ff5cb1", 1, -0.5], ["#ffe14d", -0.4, 1], [m.ink, 0.7, 0.6]] : [["#00a3e0", -1, -0.8], ["#e5007e", 1, -0.5], ["#f2c400", -0.4, 1], [m.ink, 0.7, 0.6]];
      const off = (1 - ease(t / 1.35)) * m.g * 2.2;
      ctx.globalCompositeOperation = dark() ? "screen" : "multiply";
      P.forEach(([c, ux, uy], k) => {
        const lt = t - k * 0.26; if (lt < 0) return;
        ctx.globalAlpha = clamp(lt / 0.2) * (1 - e) * (k === 3 ? 0.9 : 0.75); ctx.fillStyle = c; ctx.beginPath();
        for (const d of m.parts) { const rr = Math.min(d.base, 1.15) * m.R; if (rr > 0.25) dot(ctx, m.PX + d.x + ux * off, m.PY + d.y + uy * off, rr); }
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
    },
  }),
  // the forme comes down: the figure stamps onto the page, the ink spreads, and a few drops fly off the edges
  stamp: () => {
    let specks = null; const fall = 0.3;
    return {
      reset() { specks = null; },
      apply(m, t) {
        const cx = m.W / 2, cy = m.H / 2;
        for (const d of m.parts) {
          if (t < 0) { d.a = 0; continue; }
          if (t < fall) { const k = ease(t / fall), s = 1.32 - 0.32 * k; d.ox = (d.x - cx) * (s - 1); d.oy = (d.y - cy) * (s - 1); d.a = k * 0.9; d.rs = s; }
          else { d.rs = 1 + 0.55 * Math.exp(-(t - fall) * 4.5); const j = t - fall < 0.14 ? (1 - (t - fall) / 0.14) * m.g * 0.4 : 0; d.ox = Math.sin(t * 90) * j; d.oy = Math.cos(t * 70) * j; }
        }
      },
      extra(m, ctx, t, dt) {
        if (t < fall) return;
        if (!specks) specks = [...Array(30)].map(() => { const d = pick(m.parts.filter(p => p.bottom || p.top || p.right)), cx = m.W / 2, cy = m.H / 2, a = Math.atan2(d.y - cy, d.x - cx), v = rnd(60, 190); return { x: m.PX + d.x, y: m.PY + d.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: rnd(0.6, 1.6), age: 0, c: m.cols[d.bi] }; });
        for (const s of specks) { s.age += dt; s.vx *= 0.92; s.vy = s.vy * 0.92 + 160 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
        for (const s of specks) if (s.age < 1) { ctx.globalAlpha = 0.75 * (1 - s.age); ctx.fillStyle = s.c; ctx.beginPath(); dot(ctx, s.x, s.y, s.r); ctx.fill(); }
      },
    };
  },
};

// ---------------------------------------------------------------- 2. the weather in the ink (it stays on all day)
const WEATHER = {
  // rain: ink gathers under the figure's lowest dots, hangs, and drips; rate = drops a second
  rain: (rate = 1.2) => {
    let drops = [], acc = 0;
    return {
      reset() { drops = []; acc = 0; },
      apply(m, t, dt) {
        if (t < 0) return;
        acc += rate * dt;
        while (acc >= 1) { acc--; const d = pick(m.edges.bottom); if (d && !drops.some(x => x.d === d && !x.fall)) drops.push({ d, age: 0, fall: false, y: 0, v: 0, hang: rnd(0.7, 1.4) }); }
        for (const x of drops) {
          x.age += dt;
          if (!x.fall && x.age > x.hang) x.fall = true;
          if (x.fall) { x.v += 520 * dt; x.y += x.v * dt; }
          x.d.rs *= x.fall ? 1 : 1 - 0.25 * clamp(x.age / x.hang);
        }
        drops = drops.filter(x => x.y < m.PY);
      },
      extra(m, ctx) {
        for (const x of drops) {
          const k = clamp(x.age / x.hang), cx = m.PX + x.d.x, base = m.PY + x.d.y + m.R * 0.7;
          ctx.fillStyle = m.cols[x.d.bi]; ctx.beginPath();
          if (!x.fall) { const r = m.g * (0.28 + 0.5 * k); ctx.globalAlpha = 1; ctx.moveTo(cx - r * 0.35, base); ctx.quadraticCurveTo(cx - r, base + r * 1.6, cx, base + r * 2.1); ctx.quadraticCurveTo(cx + r, base + r * 1.6, cx + r * 0.35, base); ctx.closePath(); ctx.fill(); }
          else {
            const r = m.g * 0.45, y = base + m.g * 1.6 + x.y, fade = clamp(1 - x.y / (m.PY * 0.85));
            ctx.globalAlpha = fade; ctx.ellipse(cx, y, r * 0.75, r * (1 + Math.min(1.6, x.v / 220)), 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = fade * 0.4; ctx.fillRect(cx - 0.6, y - Math.min(26, x.v * 0.08) - r, 1.2, Math.min(26, x.v * 0.08));
          }
        }
      },
    };
  },
  // heat: the figure shimmers, more at the top, and faint motes rise off it like haze off a road
  heat: () => {
    let motes = [];
    return {
      reset() { motes = []; },
      apply(m, t, dt) {
        for (const d of m.parts) { const h = 1 - d.y / m.H; d.ox += Math.sin(d.y * 0.16 + t * 5.5) * m.g * 0.22 * (0.3 + h); d.oy += Math.sin(d.x * 0.05 + t * 3.1) * m.g * 0.12 * h; }
        if (Math.random() < 2.2 * dt) { const d = pick(m.edges.top); if (d) motes.push({ x: d.x, y: d.y, age: 0, c: m.cols[d.bi], ph: rnd(0, 6) }); }
        for (const p of motes) { p.age += dt; p.y -= 22 * dt; }
        motes = motes.filter(p => p.age < 1.8);
      },
      extra(m, ctx, t) { for (const p of motes) { ctx.globalAlpha = 0.45 * (1 - p.age / 1.8); ctx.fillStyle = p.c; ctx.beginPath(); dot(ctx, m.PX + p.x + Math.sin(t * 4 + p.ph) * 2, m.PY + p.y, m.R * 0.5 * (1 - p.age / 2.2)); ctx.fill(); } },
    };
  },
  // wind: gusts lean the figure from its foot and lift loose dots off its right edges
  wind: () => {
    let flakes = [];
    const gust = t => Math.pow(Math.max(0, Math.sin(t * 0.85)), 2);
    return {
      reset() { flakes = []; },
      apply(m, t, dt) {
        const gu = gust(t) + 0.12;
        for (const d of m.parts) { const h = 1 - d.y / m.H; d.ox += gu * h * m.g * 1.3 + Math.sin(t * 8 + d.y * 0.3) * 0.12 * m.g * gu; }
        if (gu > 0.6 && Math.random() < 6 * dt) { const d = pick(m.edges.right); if (d) flakes.push({ x: d.x, y: d.y, vx: rnd(90, 200), ph: rnd(0, 6), age: 0, c: m.cols[d.bi] }); }
        for (const f of flakes) { f.age += dt; f.x += f.vx * dt; f.y += Math.sin(f.age * 7 + f.ph) * 18 * dt; }
        flakes = flakes.filter(f => f.age < 1.4);
      },
      extra(m, ctx) { for (const f of flakes) { ctx.globalAlpha = 0.8 * (1 - f.age / 1.4); ctx.fillStyle = f.c; ctx.beginPath(); dot(ctx, m.PX + f.x, m.PY + f.y, m.R * 0.6 * (1 - f.age / 2)); ctx.fill(); } },
    };
  },
  // cloud and haze: the ink goes soft and a light grey haze drifts across in front
  haze: () => {
    let motes = null;
    return {
      reset() { motes = null; },
      apply(m, t) { for (const d of m.parts) { d.a = 0.74 + 0.14 * Math.sin(d.x * 0.02 + t * 0.6); d.rs *= 0.92; } },
      extra(m, ctx, t, dt) {
        if (!motes) motes = [...Array(90)].map(() => ({ x: rnd(0, m.CW), y: rnd(m.PY - 10, m.PY + m.H + 10), r: rnd(0.6, 1.6), v: rnd(6, 16) }));
        ctx.fillStyle = m.ink; ctx.globalAlpha = 0.14; ctx.beginPath();
        for (const p of motes) { p.x += p.v * dt; if (p.x > m.CW + 4) p.x = -4; dot(ctx, p.x, p.y + Math.sin(t + p.x * 0.05) * 2, p.r); }
        ctx.fill();
      },
    };
  },
  // night: the ink sits a little dim, like a page under a lamp, and loose ink twinkles round it
  night: () => {
    let stars = null;
    return {
      reset() { stars = null; },
      apply(m, t) { for (const d of m.parts) d.a = 0.8 + 0.08 * Math.sin(t * 0.7 + d.x * 0.012); },
      extra(m, ctx, t) {
        if (!stars) stars = [...Array(16)].map(() => ({ x: rnd(0, m.CW), y: rnd(4, m.CH - 4), r: rnd(0.7, 1.5), ph: rnd(0, 6), sp: rnd(0.8, 2) }));
        ctx.fillStyle = m.ink;
        for (const s of stars) { ctx.globalAlpha = 0.15 + 0.55 * Math.max(0, Math.sin(t * s.sp + s.ph)); ctx.beginPath(); dot(ctx, s.x, s.y, s.r); ctx.fill(); }
      },
    };
  },
  // clear: crisp ink, and now and then sunlight glints across the figure
  glint: () => ({
    apply(m, t) {
      const c = t % 5.5, f = c / 1.5; if (f > 1) return;
      const front = -m.H + (m.W + m.H * 2) * f;
      for (const d of m.parts) { const w = Math.max(0, 1 - Math.abs(d.x + d.y * 0.7 - front) / (m.g * 5)); d.rs *= 1 + 0.25 * smooth(w); }
    },
  }),
};

// ---------------------------------------------------------------- 3. big moments (once, the first time the page opens)
const MC = {
  gold: () => (dark() ? "#e8c66e" : "#a97c1e"),
  saffron: () => (dark() ? "#ffa24d" : "#e2711a"), navy: () => (dark() ? "#9fb3ff" : "#22348f"), green: () => (dark() ? "#52c763" : "#138808"),
  orange: () => (dark() ? "#ff8c3a" : "#e35a00"),
};
const MOMENT = {
  // a Madrid win: a gold wave sweeps the figure, sparks rise off it, then the desk colours come back the same way
  madrid: (line = "Real Madrid 3–1 Villarreal") => {
    let sparks = [];
    return {
      line,
      reset() { sparks = []; },
      apply(m, t, dt) {
        if (t < 0) return;
        const span = m.W + m.g * 16, f1 = -m.g * 8 + span * smooth(t / 1.1), f2 = -m.g * 8 + span * smooth((t - 2.4) / 1.1), gold = MC.gold();
        for (const d of m.parts) {
          if (d.x < f1 && d.x > f2) d.col = gold;
          const w = Math.max(0, 1 - Math.abs(d.x - f1) / (m.g * 4)); d.rs *= 1 + 0.4 * w; d.oy -= w * m.g * 0.8;
        }
        if (t < 1.1 && Math.random() < 30 * dt) { const tops = m.edges.top.filter(d => Math.abs(d.x - f1) < m.g * 3); const d = pick(tops.length ? tops : m.edges.top); sparks.push({ x: d.x, y: d.y, vy: rnd(-70, -30), vx: rnd(-15, 15), age: 0, s: rnd(1.6, 3.2) }); }
        for (const s of sparks) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt; }
        sparks = sparks.filter(s => s.age < 1.3);
        m.onLine(line, t > 0.5 && t < 4);
      },
      extra(m, ctx) {
        ctx.fillStyle = MC.gold();
        for (const s of sparks) { const a = 1 - s.age / 1.3, x = m.PX + s.x, y = m.PY + s.y, r = s.s * a; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.lineTo(x + r * 0.45, y - r * 0.45); ctx.lineTo(x + r * 1.8, y); ctx.lineTo(x + r * 0.45, y + r * 0.45); ctx.lineTo(x, y + r * 1.8); ctx.lineTo(x - r * 0.45, y + r * 0.45); ctx.lineTo(x - r * 1.8, y); ctx.lineTo(x - r * 0.45, y - r * 0.45); ctx.closePath(); ctx.fill(); }
      },
    };
  },
  // an India gold: the tricolour wipes down the figure, ripples like a flag, then wipes away
  tricolour: (line = "India win hockey gold") => ({
    line,
    apply(m, t) {
      if (t < 0) return;
      const cs = [MC.saffron(), MC.navy(), MC.green()], hold = t > 0.7 && t < 2.9 ? Math.sin(clamp((t - 0.7) / 2.2) * Math.PI) : 0;
      for (const d of m.parts) {
        const yf = d.y / m.H, on = clamp((t - yf * 0.6) / 0.2) * (1 - clamp((t - 3 - yf * 0.6) / 0.2));
        if (on > 0.5) { const b = yf < 0.36 ? 0 : yf < 0.64 ? 1 : 2; d.col = cs[b]; if (b === 1) d.rs *= 0.8; }
        d.oy += Math.sin(d.x * 0.045 - t * 6) * m.g * 0.5 * hold * (0.3 + d.x / m.W);
      }
      m.onLine(line, t > 0.4 && t < 3.6);
    },
  }),
  // an F1 win for Verstappen: the dots burst outward in orange and spring back home
  burst: (line = "Verstappen wins in Sepang") => {
    let st = null;
    return {
      line,
      reset() { st = null; },
      apply(m, t, dt) {
        if (t < 0) return;
        if (!st) { const cx = m.W / 2, cy = m.H / 2; st = m.parts.map(d => { const a = Math.atan2(d.y - cy, d.x - cx) + rnd(-0.3, 0.3), v = rnd(70, 190); return { px: 0, py: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }); }
        const k = t < 0.35 ? 0 : 60 * smooth((t - 0.35) / 0.6), c = t < 0.35 ? 2.2 : 9, orange = MC.orange();
        m.parts.forEach((d, i) => {
          const s = st[i]; s.vx += (-k * s.px - c * s.vx) * dt; s.vy += (-k * s.py - c * s.vy) * dt; s.px += s.vx * dt; s.py += s.vy * dt;
          d.ox += s.px; d.oy += s.py; if (Math.hypot(s.px, s.py) > m.g * 0.6 || t < 1.4) d.col = orange;
        });
        m.onLine(line, t > 0.4 && t < 3.6);
      },
    };
  },
  // a win for a side Parth follows: that desk's dots stand up in a stadium wave, twice across
  wave: (desk = "sport", line = "India beat Pakistan") => ({
    line,
    apply(m, t) {
      if (t < 0) return;
      const si = SHARES.findIndex(x => x.desk === desk);
      for (const d of m.parts) {
        for (const off of [0, 1.3]) {
          const ph = (t - off) * 1.8 - (d.x / m.W) * 1.4;
          if (ph > 0 && ph < 1) { const lift = Math.sin(ph * Math.PI); d.oy -= lift * m.g * (d.bi === si ? 3.4 : 0.6); d.rs *= 1 + 0.15 * lift; }
        }
      }
      m.onLine(line, t > 0.3 && t < 3.4);
    },
  }),
};

// ---------------------------------------------------------------- the page
const CARDS = [
  ["press", "A printing press on first load", "Once per visit, about a second and a half. Then the figure rests as it does today.", [
    ["Colour plates", "Each desk's dots land as their own plate, in the tabs' order, slightly out of register, then snap into place.", [{ fx: PRESS.plates() }], 4.5],
    ["The roller", "A roller passes left to right and leaves the figure behind it, the newest ink still wet and spread.", [{ fx: PRESS.roller() }], 4.5],
    ["Four process colours", "Cyan, magenta, yellow and black land one by one off register and settle into the desk colours.", [{ fx: PRESS.process() }], 4.5],
    ["The stamp", "The forme comes down: the figure stamps onto the page, the ink spreads, a few drops fly off.", [{ fx: PRESS.stamp() }], 4.5],
  ]],
  ["weather", "The weather in the ink", "All day, from the live Bengaluru weather. Quiet enough to forget, there when you look.", [
    ["Rain, light", "A 40% chance of rain: now and then ink gathers under the figure and drips.", [{ fx: WEATHER.rain(1.1) }], 0],
    ["Rain, heavy", "A wet day: it drips steadily.", [{ fx: WEATHER.rain(6) }], 0],
    ["Heat", "35° and up: the figure shimmers, more at the top, and haze rises off it.", [{ fx: WEATHER.heat() }], 0],
    ["Wind", "A windy day: gusts lean the figure and lift loose ink off its edges.", [{ fx: WEATHER.wind() }], 0],
    ["Cloud and haze", "Overcast or bad air: the ink goes soft and a grey haze drifts across.", [{ fx: WEATHER.haze() }], 0],
    ["Clear", "A clear day: crisp, and now and then sunlight glints across.", [{ fx: WEATHER.glint() }], 0],
    ["Night", "After sunset: a little dim, like a page under a lamp, with loose ink twinkling.", [{ fx: WEATHER.night() }], 0, "dark"],
  ]],
  ["moments", "Big moments", "Once, the first time the page opens after it happens; set by the live results, never by hand. The line under it is optional.", [
    ["Madrid win: the gold wave", "A gold wave sweeps the figure and sparks rise off it, then the desk colours come back.", [{ fx: MOMENT.madrid() }], 6],
    ["India gold: the tricolour", "Saffron, blue and green wipe down the figure, ripple like a flag, then wipe away.", [{ fx: MOMENT.tricolour() }], 6],
    ["Verstappen wins: the burst", "The dots burst outward in orange and spring back home.", [{ fx: MOMENT.burst() }], 6],
    ["Any win: the stadium wave", "The desk's own dots stand up in a wave, twice across. Works for any side he follows.", [{ fx: MOMENT.wave() }], 6],
  ]],
  ["together", "All three together", "Pressed on first load, then the day's weather stays, then the moment plays once over it.", [
    ["Sunday, rain, Madrid won", "Colour plates, then light rain, then the gold wave.", [{ fx: PRESS.plates() }, { fx: WEATHER.rain(1.4), at: 1.9 }, { fx: MOMENT.madrid(), at: 2.3 }], 9],
    ["Hot afternoon, India gold", "The roller, then heat, then the tricolour.", [{ fx: PRESS.roller() }, { fx: WEATHER.heat(), at: 1.3 }, { fx: MOMENT.tricolour(), at: 1.8 }], 8],
    ["Night, Verstappen won", "The stamp, then night, then the burst.", [{ fx: PRESS.stamp() }, { fx: WEATHER.night(), at: 0.8 }, { fx: MOMENT.burst(), at: 1.6 }], 8, "dark"],
    ["A quiet windy day", "The process colours, then wind; no moment, as on most days.", [{ fx: PRESS.process() }, { fx: WEATHER.wind(), at: 1.7 }], 8],
    ["Overcast, India beat Pakistan", "The stamp, then haze, then the stadium wave.", [{ fx: PRESS.stamp() }, { fx: WEATHER.haze(), at: 0.9 }, { fx: MOMENT.wave(), at: 1.4 }], 8],
  ]],
];

const marks = [];
async function build() {
  const main = document.getElementById("cards");
  for (const [id, title, dek, list] of CARDS) {
    const sec = document.createElement("section"); sec.id = id;
    sec.innerHTML = `<h2>${title}</h2><p class="dek">${dek}</p><div class="grid"></div>`;
    main.append(sec);
    for (const [name, desc, plan, loop, theme] of list) {
      const card = document.createElement("div"); card.className = "card"; if (theme) card.dataset.theme = theme;
      card.innerHTML = `<div class="np"><span class="the">The</span><span class="hof">House of</span><canvas aria-hidden="true"></canvas><p class="line"></p></div><div class="cap"><h3>${name}</h3><p>${desc}</p><button type="button">Replay</button></div>`;
      sec.querySelector(".grid").append(card);
      const lineEl = card.querySelector(".line");
      const m = new Mark(card.querySelector("canvas"), { plan, loop, onLine: (txt, on) => { if (txt) lineEl.textContent = txt; lineEl.classList.toggle("on", !!on && document.getElementById("withline").checked); } });
      m.card = card; marks.push(m);
      await m.init();
      card.querySelector("button").addEventListener("click", () => m.restart());
    }
  }
  const io = new IntersectionObserver(es => es.forEach(e => { const m = marks.find(x => x.card === e.target); if (m) { m.shown = e.isIntersecting; if (m.shown && !m.loop) {} } }), { rootMargin: "100px" });
  marks.forEach(m => io.observe(m.card));
  const tick = now => { for (const m of marks) if (m.shown) m.frame(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
document.getElementById("theme").addEventListener("click", () => {
  const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark";
  document.getElementById("theme").textContent = d.dataset.theme === "dark" ? "Day" : "Night"; marks.forEach(m => m.colours());
});
document.getElementById("replay").addEventListener("click", () => marks.forEach(m => m.restart()));
build();
