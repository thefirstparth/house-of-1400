// The weather in the ink (Parth, 2 Oct: "let's definitely add weather, but make it slightly more beautiful and
// creative"). The live weather where the reader is (Bengaluru unless they have shared where they are) moves the
// wordmark's own dots, quietly, all day:
// - rain: fine streaks fall across the figure at the wind's slant; where one meets a dot the dot takes the drop and a
//   small ring spreads from it; ink gathers under the figure's lowest dots and drips; the longer it rains, the more the
//   lower dots soak and spread. Drizzle is finer and never drips. A thunderstorm adds lightning: a double flash and,
//   once in a while, a fork to the figure.
// - clear by day: the figure casts a soft shadow away from the real sun, which turns through the day; now and then
//   light glints across it. Above 33° a mirage: the figure's foot reflects below it in the heat, wavering.
// - cloud: soft cloud shadows drift across the figure, more and larger when it is overcast.
// - fog and haze: the ink goes soft at the edges and banks of fine grey drift across in front.
// - snow (when the reader is somewhere it snows): flakes fall and settle as small caps on the figure's top edges.
// - wind: gusts lean the figure from its foot and lift loose dots off its right-hand edges.
// - night: the ink sits a little dim, like a page under a lamp, and on a clear night loose ink twinkles round it.
// Motion off: none of it. Nothing here writes to the paper; it is drawn from the live weather the page already reads.
// inkWeather(geom) -> { parts(list), set(state), apply(t, dt), under(ctx, t, look), over(ctx, t, dt, look), on() }
// geom: { W, H, g, R, PX, PY, CW, CH }; a part is a dot { x, y, base, ... } and gets wx, wy, wr, wa each frame.
// state: { kind: "clear"|"clouds"|"fog"|"drizzle"|"rain"|"storm"|"snow", amount 0..1, night, wind (km/h), temp, sun: {alt, az} }

const iclamp = x => Math.max(0, Math.min(1, x));
const ismooth = x => { x = iclamp(x); return x * x * (3 - 2 * x); };
const irnd = (a, b) => a + Math.random() * (b - a);
const ipick = a => a[Math.floor(Math.random() * a.length)];

// The sun's height and bearing (radians; bearing from north, clockwise) at a place and time, good to a degree.
export function sunAt(lat, lon, ms) {
  const r = Math.PI / 180, d = ms / 864e5 - 10957.5, g = (357.529 + 0.98560028 * d) * r, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r, e = (23.439 - 0.00000036 * d) * r;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const H = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * r + lon * r - ra, la = lat * r;
  return { alt: Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)), az: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) + Math.PI };
}

// The moon's altitude in radians (the low-precision lunar theory SunCalc uses; good to about a degree): the Weather
// block's day line draws the moon only while it is up, and says when it rises
export function moonAt(lat, lon, ms) {
  const r = Math.PI / 180, d = ms / 864e5 - 10957.5, L = r * (218.316 + 13.176396 * d), M = r * (134.963 + 13.064993 * d), F = r * (93.272 + 13.22935 * d);
  const l = L + r * 6.289 * Math.sin(M), b = r * 5.128 * Math.sin(F), e = r * 23.4397;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)), dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = r * (280.16 + 360.9856235 * d) + r * lon - ra, la = lat * r;
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
}

// The weather the ink shows, from a live reading: { code (WMO), temp, wind, lat, lon } and the time
export function inkState(w, ms = Date.now()) {
  if (!w || w.code == null) return null;
  const c = w.code, sun = Number.isFinite(w.lat) ? sunAt(w.lat, w.lon, ms) : null, night = sun ? sun.alt < -0.0145 : false;
  const kind = c >= 95 ? "storm" : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? "rain" : c >= 51 && c <= 57 ? "drizzle" : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : c === 45 || c === 48 ? "fog" : c >= 2 ? "clouds" : "clear";
  const amount = { 61: 0.45, 80: 0.45, 63: 0.7, 81: 0.7, 66: 0.7, 65: 1, 82: 1, 67: 1, 51: 0.3, 53: 0.45, 55: 0.6, 56: 0.45, 57: 0.6, 71: 0.4, 73: 0.7, 75: 1, 77: 0.4, 85: 0.5, 86: 0.9, 2: 0.5, 3: 1, 95: 1, 96: 1, 99: 1, 45: 0.8, 48: 0.9 }[c] ?? 0.6;
  return { kind, amount, night, wind: w.wind ?? 0, temp: w.temp, sun };
}

export function inkWeather(G) {
  let P = [], S = null, hash = new Map(), edges = { bottom: [], top: [], right: [] }, yb = 0, rainFor = 0;
  let streaks = [], ripples = [], drops = [], flakes = [], caps = new Map(), lifted = [], motes = [], clouds = [], stars = [], bolt = null, flashAt = -1, nextFlash = 4;
  const key = (i, j) => i * 4096 + j;
  const near = (x, y, r) => { const i = Math.floor(x / G.g), j = Math.floor(y / G.g); let best = null, bd = r; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const d of hash.get(key(i + a, j + b)) || []) { const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } } return best; };
  const api = {
    parts(list) {
      P = list; hash = new Map(); caps = new Map();
      for (const d of P) { const k = key(Math.floor(d.x / G.g), Math.floor(d.y / G.g)); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(d); }
      const has = (d, dx, dy) => !!near(d.x + dx, d.y + dy, G.g * 0.75);
      edges = { bottom: P.filter(d => d.base > 0.5 && !has(d, 0, G.g * 1.414)), top: P.filter(d => d.base > 0.5 && !has(d, 0, -G.g * 1.414)), right: P.filter(d => d.base > 0.5 && !has(d, G.g * 1.414, 0)) };
      yb = Math.max(0, ...P.map(d => d.y));
    },
    set(state) {
      const was = S?.kind; S = state;
      if (!S) return;
      if (S.kind !== was) { streaks = []; drops = []; ripples = []; flakes = []; rainFor = 0; }
      const n = S.kind === "clouds" ? (S.amount >= 1 ? 4 : 2) : 0;
      clouds = [...Array(n)].map((_, i) => ({ x: (i / n) * (G.W + G.H * 2) - G.H, y: irnd(0.1, 0.9) * G.H, rx: G.H * irnd(0.55, 1.1) * (S.amount >= 1 ? 1.25 : 1), ry: G.H * irnd(0.35, 0.6), v: irnd(7, 13) }));
      motes = S.kind === "fog" ? [...Array(110)].map(() => ({ x: irnd(0, G.CW), y: G.PY + irnd(-0.1, 1.1) * G.H, r: irnd(0.5, 1.4), v: irnd(5, 12) })) : [];
      stars = S.night && (S.kind === "clear" || (S.kind === "clouds" && S.amount < 1)) ? [...Array(14)].map(() => ({ x: irnd(0, G.CW), y: irnd(3, G.CH - 3), r: irnd(0.6, 1.4), ph: irnd(0, 6), sp: irnd(0.7, 1.8) })) : [];
    },
    on: () => !!S,
    // every frame: each dot's offset (wx, wy), size (wr) and strength (wa) from the weather
    apply(t, dt) {
      for (const d of P) { d.wx = 0; d.wy = 0; d.wr = 1; d.wa = 1; }
      if (!S) return;
      const wet = S.kind === "rain" || S.kind === "storm" || S.kind === "drizzle", amt = S.amount;
      if (S.night) for (const d of P) d.wa *= 0.86 + 0.06 * Math.sin(t * 0.7 + d.x * 0.012);
      // wind: a gust leans the figure from its foot
      const wind = iclamp((S.wind - 15) / 35), gust = wind ? wind * (0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 0.8)), 2)) : 0;
      if (gust) for (const d of P) d.wx += gust * (1 - d.y / G.H) * G.g * 1.3 + Math.sin(t * 8 + d.y * 0.3) * 0.12 * G.g * gust;
      if (gust > 0.45 && Math.random() < 5 * gust * dt) { const d = ipick(edges.right); if (d) lifted.push({ x: d.x, y: d.y, d, vx: irnd(80, 190), ph: irnd(0, 6), age: 0 }); }
      for (const f of lifted) { f.age += dt; f.x += f.vx * dt; f.y += Math.sin(f.age * 7 + f.ph) * 18 * dt; }
      lifted = lifted.filter(f => f.age < 1.4);
      // heat on a clear day: the figure shimmers a little, more at the top
      if (S.kind === "clear" && !S.night && S.temp >= 33) for (const d of P) { const h = 1 - d.y / G.H; d.wx += Math.sin(d.y * 0.16 + t * 5) * G.g * 0.14 * (0.3 + h); }
      // clear by day: now and then a glint of light crosses the figure
      if (S.kind === "clear" && !S.night) { const f = (t % 9) / 1.6; if (f < 1) { const front = -G.H + (G.W + G.H * 2) * f; for (const d of P) { const w = Math.max(0, 1 - Math.abs(d.x + d.y * 0.7 - front) / (G.g * 5)); d.wr *= 1 + 0.22 * ismooth(w); } } }
      // cloud shadows drifting across
      for (const c of clouds) { c.x += c.v * dt; if (c.x - c.rx > G.W + G.H) { c.x = -c.rx - G.H * 0.5; c.y = irnd(0.1, 0.9) * G.H; } }
      if (clouds.length) for (const d of P) { let s = 0; for (const c of clouds) s += Math.exp(-(((d.x - c.x) / c.rx) ** 2) - (((d.y - c.y) / c.ry) ** 2)); s = Math.min(1, s); d.wa *= 1 - 0.34 * s * (0.6 + 0.4 * amt); d.wr *= 1 - 0.06 * s; }
      // fog: soft edges, a slow breath
      if (S.kind === "fog") for (const d of P) { d.wa *= (0.62 + 0.14 * Math.sin(d.x * 0.02 + t * 0.5)) * (1 - 0.3 * Math.abs(d.x - G.W / 2) / (G.W / 2)); d.wr *= 0.93; }
      if (wet) {
        rainFor += dt;
        const n = S.kind === "drizzle" ? 14 + 16 * amt : 8 + 34 * amt, slant = 0.16 + iclamp(S.wind / 40) * 0.35;
        while (streaks.length < n) streaks.push({ x: irnd(-G.PY * slant, G.CW), y: irnd(-G.CH, 0), v: irnd(380, 520) * (S.kind === "drizzle" ? 0.7 : 1), len: S.kind === "drizzle" ? irnd(4, 7) : irnd(9, 17), a: irnd(0.12, 0.26) });
        for (const s of streaks) {
          s.y += s.v * dt; s.x += s.v * slant * dt;
          // where a streak meets a dot, the dot takes the drop: a ring spreads, the dot swells for a moment
          const fx = s.x - G.PX, fy = s.y - G.PY;
          if (fy > 0 && fy < G.H && Math.random() < (S.kind === "drizzle" ? 0.05 : 0.14)) { const d = near(fx, fy, G.R * 1.4); if (d) { ripples.push({ d, age: 0 }); d.hit = t; s.y = G.CH + 99; } }
          if (s.y > G.CH + 20) { s.y = irnd(-40, -5); s.x = irnd(-G.PY * slant, G.CW); }
        }
        for (const r of ripples) r.age += dt;
        ripples = ripples.filter(r => r.age < 0.5);
        const soak = iclamp(rainFor / 25) * amt;
        for (const d of P) { if (d.hit != null && t - d.hit < 0.35 && t >= d.hit) d.wr *= 1 + 0.45 * (1 - (t - d.hit) / 0.35); if (d.y > G.H * 0.55) d.wr *= 1 + 0.1 * soak * (d.y / G.H); }
        // drips: ink gathers under the lowest dots, hangs, and falls
        if (S.kind !== "drizzle" && Math.random() < (0.35 + 1.4 * amt) * dt) { const d = ipick(edges.bottom); if (d && !drops.some(x => x.d === d && !x.fall)) drops.push({ d, age: 0, fall: false, y: 0, v: 0, hang: irnd(0.8, 1.5) }); }
        for (const x of drops) { x.age += dt; if (!x.fall && x.age > x.hang) x.fall = true; if (x.fall) { x.v += 520 * dt; x.y += x.v * dt; } else x.d.wr *= 1 - 0.2 * iclamp(x.age / x.hang); }
        drops = drops.filter(x => x.y < G.PY * 0.9);
        // a storm: lightning every few seconds, a double flash, sometimes a fork to the figure
        if (S.kind === "storm") {
          if (t > nextFlash) { flashAt = t; nextFlash = t + irnd(5, 12); bolt = Math.random() < 0.6 ? (() => { const d = ipick(edges.top); if (!d) return null; const pts = []; let x = d.x + irnd(-30, 30), y = -G.PY; const n = 9; for (let i = 0; i <= n; i++) { pts.push([x, y]); x += (d.x - x) / (n - i + 1) + irnd(-7, 7); y += (d.y - y) / (n - i + 1); } return pts; })() : null; }
          const f = t - flashAt; if (f >= 0 && f < 0.3) { const k = f < 0.07 || (f > 0.13 && f < 0.2) ? 1 : 0; for (const d of P) { d.wr *= 1 + 0.15 * k; d.wx += k * irnd(-0.5, 0.5); } }
        }
      }
      if (S.kind === "snow") {
        const n = 20 + 60 * amt;
        while (flakes.length < n) flakes.push({ x: irnd(0, G.CW), y: irnd(-G.CH, 0), r: irnd(0.7, 1.7), v: irnd(16, 38), ph: irnd(0, 6) });
        for (const f of flakes) {
          f.y += f.v * dt; f.x += Math.sin(t * 1.2 + f.ph) * 10 * dt + iclamp(S.wind / 40) * 20 * dt;
          const fx = f.x - G.PX, fy = f.y - G.PY;
          if (fy > 0 && fy < G.H) { const d = near(fx, fy, G.R * 1.2); if (d && edges.top.includes(d)) { caps.set(d, Math.min(1.6, (caps.get(d) || 0) + 0.12)); f.y = G.CH + 99; } }
          if (f.y > G.CH + 10) { f.y = irnd(-20, -3); f.x = irnd(0, G.CW); }
        }
      }
    },
    // under the dots: the sun's soft shadow, the heat's mirage
    under(ctx, t, look) {
      if (!S || S.night) return;
      if (S.kind === "clear" && S.sun && S.sun.alt > 0.05) {
        const L = G.g * Math.max(0.7, Math.min(3.6, 1.1 / Math.tan(S.sun.alt))), dx = -Math.sin(S.sun.az) * L, dy = L * 0.45;
        ctx.globalAlpha = look.dark ? 0.22 : 0.1; ctx.fillStyle = look.dark ? "#000" : look.ink; ctx.beginPath();
        for (const d of P) { const rr = Math.min(d.base * d.wr, 1.2) * G.R * 1.08; if (rr > 0.3) { const x = G.PX + d.x + d.wx + dx, y = G.PY + d.y + d.wy + dy; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); } }
        ctx.fill();
      }
      if (S.kind === "clear" && S.temp >= 33) {
        const reach = G.H * 0.5;
        look.colours.forEach((col, bi) => {
          ctx.fillStyle = col; ctx.beginPath(); let any = false;
          for (const d of P) {
            if (d.bi !== bi || d.y < yb - reach) continue;
            const k = (yb - d.y) / reach, y = G.PY + yb + 4 + (yb - d.y) * 0.55, x = G.PX + d.x + Math.sin(y * 0.35 + t * 3.2) * 1.8, rr = Math.min(d.base, 1) * G.R * 0.85;
            if (rr > 0.3) { ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); any = true; }
          }
          if (any) { ctx.globalAlpha = 0.13; ctx.fill(); }
        });
      }
      ctx.globalAlpha = 1;
    },
    // over the dots: rain, rings, drips, flakes and caps, lifted ink, haze, stars, lightning
    over(ctx, t, dt, look) {
      if (!S) return;
      const ink = look.ink;
      if (streaks.length) {
        const slant = 0.16 + iclamp(S.wind / 40) * 0.35;
        ctx.strokeStyle = ink; ctx.lineWidth = S.kind === "drizzle" ? 0.6 : 0.8; ctx.lineCap = "round";
        for (const s of streaks) { ctx.globalAlpha = s.a * (look.dark ? 1.3 : 1); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.len * slant, s.y - s.len); ctx.stroke(); }
      }
      for (const r of ripples) { const k = r.age / 0.5; ctx.globalAlpha = 0.5 * (1 - k); ctx.strokeStyle = look.colours[r.d.bi] || ink; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(G.PX + r.d.x, G.PY + r.d.y, G.R * (1.1 + k * 3.4), G.R * (0.55 + k * 1.5), 0, 0, Math.PI * 2); ctx.stroke(); }
      for (const x of drops) {
        const k = iclamp(x.age / x.hang), cx = G.PX + x.d.x, base = G.PY + x.d.y + G.R * 0.7; ctx.fillStyle = look.colours[x.d.bi] || ink; ctx.beginPath();
        if (!x.fall) { const r = G.g * (0.26 + 0.46 * k); ctx.globalAlpha = 1; ctx.moveTo(cx - r * 0.35, base); ctx.quadraticCurveTo(cx - r, base + r * 1.6, cx, base + r * 2.1); ctx.quadraticCurveTo(cx + r, base + r * 1.6, cx + r * 0.35, base); ctx.closePath(); ctx.fill(); }
        else { const r = G.g * 0.42, y = base + G.g * 1.5 + x.y, fade = iclamp(1 - x.y / (G.PY * 0.8)); ctx.globalAlpha = fade; ctx.ellipse(cx, y, r * 0.75, r * (1 + Math.min(1.6, x.v / 220)), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = fade * 0.4; ctx.fillRect(cx - 0.6, y - Math.min(24, x.v * 0.08) - r, 1.2, Math.min(24, x.v * 0.08)); }
      }
      if (flakes.length) {
        ctx.lineWidth = 0.8; ctx.strokeStyle = look.muted; ctx.fillStyle = look.paper;
        for (const f of flakes) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        for (const [d, c] of caps) { const x = G.PX + d.x + d.wx, y = G.PY + d.y + d.wy - G.R * 0.95; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.ellipse(x, y, G.R * (0.7 + 0.35 * c), G.R * (0.25 + 0.3 * c), 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
      for (const f of lifted) { ctx.globalAlpha = 0.8 * (1 - f.age / 1.4); ctx.fillStyle = look.colours[f.d.bi] || ink; ctx.beginPath(); ctx.arc(G.PX + f.x, G.PY + f.y, G.R * 0.6 * (1 - f.age / 2), 0, Math.PI * 2); ctx.fill(); }
      if (motes.length) { ctx.fillStyle = ink; ctx.globalAlpha = 0.13; ctx.beginPath(); for (const p of motes) { p.x += p.v * dt; if (p.x > G.CW + 4) p.x = -4; const y = p.y + Math.sin(t * 0.8 + p.x * 0.04) * 2; ctx.moveTo(p.x + p.r, y); ctx.arc(p.x, y, p.r, 0, Math.PI * 2); } ctx.fill(); }
      if (stars.length) { ctx.fillStyle = ink; for (const s of stars) { ctx.globalAlpha = 0.12 + 0.5 * Math.max(0, Math.sin(t * s.sp + s.ph)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); } }
      if (S.kind === "storm") {
        const f = t - flashAt;
        if (f >= 0 && f < 0.3) {
          const k = f < 0.07 ? 1 - f / 0.07 * 0.4 : f > 0.13 && f < 0.2 ? 0.8 : 0;
          if (k) { ctx.globalAlpha = (look.dark ? 0.22 : 0.5) * k; ctx.fillStyle = look.dark ? "#fff" : look.paper; ctx.fillRect(0, 0, G.CW, G.CH); }
          if (bolt && f < 0.22) { ctx.globalAlpha = 0.85 * (1 - f / 0.22); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.lineJoin = "round"; ctx.beginPath(); bolt.forEach(([x, y], i) => (i ? ctx.lineTo(G.PX + x, G.PY + y) : ctx.moveTo(G.PX + x, G.PY + y))); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return api;
}
