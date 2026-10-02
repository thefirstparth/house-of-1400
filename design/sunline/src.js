// The day line, three ways (mock). Everything is drawn from the sun's and the moon's real positions over Bengaluru.
const R = Math.PI / 180, MIN = 6e4, HOUR = 36e5, D0 = Date.parse(DATA.date + "T00:00:00+05:30");
const ist = ms => new Date(ms + 19800e3).toISOString().slice(11, 16);
const hm = ms => { const m = Math.max(0, Math.round(ms / MIN)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const NS = "http://www.w3.org/2000/svg";
const dark = () => document.documentElement.dataset.theme === "dark";
const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();

// the sun's altitude in degrees (v2/ink.js sunAt)
function sunAlt(ms) {
  const d = ms / 864e5 - 10957.5, g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R, e = (23.439 - 0.00000036 * d) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const H = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * R + DATA.lon * R - ra, la = DATA.lat * R;
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)) / R;
}
// the moon's altitude in degrees (the low-precision lunar theory SunCalc uses; good to about a degree)
function moonAlt(ms) {
  const d = ms / 864e5 - 0.5 + 2440588 - 2451545, L = R * (218.316 + 13.176396 * d), M = R * (134.963 + 13.064993 * d), F = R * (93.272 + 13.22935 * d);
  const l = L + R * 6.289 * Math.sin(M), b = R * 5.128 * Math.sin(F), e = R * 23.4397;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)), dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = R * (280.16 + 360.9856235 * d) + R * DATA.lon - ra, phi = R * DATA.lat;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / R;
}
const SYN = 29.530588853, NEW = Date.UTC(2000, 0, 6, 18, 14);
const phase = ms => { const age = (((ms - NEW) / 864e5) % SYN + SYN) % SYN; return { lit: (1 - Math.cos(2 * Math.PI * age / SYN)) / 2, waxing: age < SYN / 2 }; };
// when f crosses thr between a and b (minute steps)
function cross(f, a, b, thr, dirUp) { let p = f(a); for (let t = a + 2 * MIN; t <= b; t += 2 * MIN) { const v = f(t); if (dirUp == null ? (p < thr) !== (v < thr) : dirUp ? p < thr && v >= thr : p >= thr && v < thr) return t; p = v; } return null; }
const H0 = -0.833;
function windowAt(t) {
  const day = sunAlt(t) > H0;
  let from = null, to = null;
  for (let a = t; a > t - 30 * HOUR && from == null; a -= 2 * MIN) { if ((sunAlt(a - 2 * MIN) > H0) !== day) from = a; }
  for (let a = t; a < t + 30 * HOUR && to == null; a += 2 * MIN) { if ((sunAlt(a + 2 * MIN) > H0) !== day) to = a + 2 * MIN; }
  return { day, from, to };
}

// the sky's colour for a sun altitude: night, the three twilights, the golden hour, day
const SKY = [[-18, "#1f2747", "#12172b"], [-12, "#2c3766", "#1b2242"], [-6, "#5b4f88", "#2e2852"], [-2, "#c47478", "#6e3c4b"], [1, "#ee9d50", "#9c5b22"], [6, "#f3c071", "#a87628"], [15, "#f2dca5", "#6f6342"], [35, "#d3e2ea", "#3a5264"], [90, "#bcd6e8", "#33506a"]];
function sky(alt) {
  const k = dark() ? 2 : 1, hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  if (alt <= SKY[0][0]) return SKY[0][k];
  for (let i = 1; i < SKY.length; i++) if (alt <= SKY[i][0]) {
    const [a, b] = [SKY[i - 1], SKY[i]], f = (alt - a[0]) / (b[0] - a[0]), A = hex(a[k]), B = hex(b[k]);
    return `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * f)).join(",")})`;
  }
  return SKY.at(-1)[k];
}
const label = (W, x, y, str) => el("text", { x: Math.min(W - 1, Math.max(1, x)), y, "text-anchor": x < 48 ? "start" : x > W - 48 ? "end" : "middle" }, [document.createTextNode(str)]);
const el = (tag, at = {}, kids = []) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); kids.forEach(k => e.append(k)); return e; };
let gid = 0;
const seeded = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

// a lit moon at (x, y), radius r, with its phase (the lit part drawn, the rest in shadow)
function moonDisc(x, y, r, ms, ring) {
  const p = phase(ms), rx = (r * Math.abs(1 - 2 * p.lit)).toFixed(2), sweep = p.lit > 0.5 ? 1 : 0;
  return el("g", { transform: `translate(${x} ${y})${p.waxing ? "" : " scale(-1 1)"}` }, [
    ...(ring ? [el("circle", { r: r + 2.2, fill: "var(--paper)" })] : []),
    el("circle", { r, fill: "var(--mdark)" }),
    el("path", { d: `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`, fill: "var(--moon)" })]);
}
function sunDisc(x, y, big) {
  const rays = el("g", { class: "rays" }, [...Array(12)].map((_, i) => { const a = i * 30 * R, r0 = big ? 8.5 : 7, r1 = big ? 12 : 9.5; return el("line", { x1: x + Math.cos(a) * r0, y1: y + Math.sin(a) * r0, x2: x + Math.cos(a) * r1, y2: y + Math.sin(a) * r1, stroke: "var(--sun)", "stroke-width": 1.4, "stroke-linecap": "round" }); }));
  return el("g", {}, [el("circle", { cx: x, cy: y, r: big ? 15 : 11, fill: "var(--halo)", opacity: 0.75 }), rays, el("circle", { cx: x, cy: y, r: big ? 6 : 5, fill: "var(--sun)" })]);
}
// the line's words: what is left, and one more fact (the golden hour by day, the moon by night)
function words(t, w) {
  const left = `<b><em>${hm(w.to - t)}</em> to ${w.day ? "sunset" : "sunrise"}</b>`;
  let x = "";
  if (w.day) {
    const g = cross(sunAlt, Math.max(t, w.to - 3 * HOUR), w.to, 6, false);
    x = g ? `Golden hour ${ist(g)}` : sunAlt(t) < 6 && t > (w.from + w.to) / 2 ? "Golden hour now" : `${hm(w.to - w.from)} of daylight`;
  } else {
    const up = moonAlt(t) > 0, lit = Math.round(phase(t).lit * 100);
    const nx = cross(moonAlt, t, w.to + HOUR, 0, !up);
    x = up ? `Moon ${lit}% · up till ${nx ? ist(nx) : "dawn"}` : nx && nx < w.to ? `Moon ${lit}% · rises ${ist(nx)}` : `Moon ${lit}% · down tonight`;
  }
  return `<div class="top">${left}<span class="x">${x}</span></div>`;
}

// ---------------------------------------------------------------- A · The window: a strip of the day's own sky
// The sky from sunrise to sunset, each moment in its own colour (rose at dawn, amber at the golden hour, pale at noon),
// what has gone bright and what is to come faded; the sun's real path drawn over it. By night the window turns to
// night sky with stars, and the moon's own path (it is drawn only while the moon is up).
function A(box, t) {
  const W = box.clientWidth, Hh = 66, hz = 48, w = windowAt(t), a = w.from - 40 * MIN, b = w.to + 40 * MIN, X = s => 4 + (s - a) / (b - a) * (W - 8);
  const f = w.day ? sunAlt : moonAlt, N = Math.max(40, Math.round(W / 3)), pts = [...Array(N + 1)].map((_, i) => a + (b - a) * i / N);
  const top = Math.max(w.day ? 20 : 30, ...pts.map(f)), Y = v => hz - Math.max(-6, Math.min(v, top)) / top * (hz - 8);
  const id = `a${gid++}`, svg = el("svg", { viewBox: `0 0 ${W} ${Hh}`, height: Hh, role: "img", "aria-label": `${w.day ? "Sunrise" : "Sunset"} ${ist(w.from)}, ${w.day ? "sunset" : "sunrise"} ${ist(w.to)}` });
  const grad = el("linearGradient", { id, x1: 0, x2: 1, y1: 0, y2: 0 }, pts.filter((_, i) => i % 3 === 0).map(s => el("stop", { offset: ((s - a) / (b - a)).toFixed(3), "stop-color": sky(sunAlt(s)) })));
  const clip = el("clipPath", { id: id + "c" }, [el("rect", { x: 0, y: 0, width: W, height: hz, rx: 7 })]);
  svg.append(el("defs", {}, [grad, clip]));
  const g = el("g", { "clip-path": `url(#${id}c)` });
  g.append(el("rect", { x: 0, y: 0, width: W, height: hz, fill: `url(#${id})` }));
  if (!w.day) { const rnd = seeded(7); for (let i = 0; i < Math.round(W / 14); i++) { const x = rnd() * W, y = 3 + rnd() * (hz - 12); if (sunAlt(a + (x / W) * (b - a)) < -9) g.append(el("circle", { cx: x, cy: y, r: 0.5 + rnd() * 0.8, fill: "var(--star)", class: "star", style: `animation-delay:${(rnd() * 3).toFixed(2)}s` })); } }
  g.append(el("rect", { x: X(t), y: 0, width: W, height: hz, fill: w.day ? "var(--paper)" : "#05070f", opacity: w.day ? 0.55 : 0.4 }));
  const path = (from, to) => pts.filter(s => s >= from && s <= to).map((s, i) => `${i ? "L" : "M"}${X(s).toFixed(1)} ${Y(f(s)).toFixed(1)}`).join("");
  const col = w.day ? "var(--sun)" : "var(--moon)";
  g.append(el("path", { d: path(a, b), fill: "none", stroke: col, "stroke-width": 1.3, "stroke-dasharray": "2 4", opacity: w.day ? 0.9 : 0.7 }));
  g.append(el("path", { d: path(a, t), fill: "none", stroke: col, "stroke-width": 2.4, "stroke-linecap": "round" }));
  svg.append(g, el("line", { x1: 0, x2: W, y1: hz, y2: hz, stroke: "var(--ink)", "stroke-width": 1.2 }));
  for (const s of [w.from, w.to]) { svg.append(el("line", { x1: X(s), x2: X(s), y1: hz, y2: hz + 4, stroke: "var(--ink)", "stroke-width": 1.2 })); svg.append(label(W, X(s), hz + 15, `${s === w.from ? (w.day ? "Sunrise" : "Sunset") : w.day ? "Sunset" : "Sunrise"} ${ist(s)}`)); }
  const v = f(t);
  if (w.day) svg.append(sunDisc(X(t), Y(v), false));
  else if (v > 0) svg.append(moonDisc(X(t), Y(v), 6.5, t, false));
  else svg.append(el("line", { x1: X(t), x2: X(t), y1: 4, y2: hz, stroke: "var(--moon)", "stroke-width": 1.4, opacity: 0.8 }));
  box.innerHTML = `<div class="dl">${words(t, w)}</div>`; box.firstChild.append(svg);
}

// ---------------------------------------------------------------- B · The ribbon: the whole day in one band of colour
// Midnight to midnight, each minute in the sky's colour: deep blue night (with its stars), violet and rose twilight,
// amber golden hours, pale day. A needle marks now, with the sun or the moon (in its phase) on it; the hours still to
// come are faded. A thin silver line above the band is the moon's time in the sky.
function B(box, t) {
  const W = box.clientWidth, Hh = 52, y0 = 14, bh = 18, d0 = D0 + Math.floor((t - D0) / 864e5) * 864e5, X = s => 2 + (s - d0) / 864e5 * (W - 4), w = windowAt(t);
  const id = `b${gid++}`, svg = el("svg", { viewBox: `0 0 ${W} ${Hh}`, height: Hh, role: "img", "aria-label": "The day from midnight to midnight" });
  const stops = [...Array(97)].map((_, i) => d0 + i * 15 * MIN);
  svg.append(el("defs", {}, [el("linearGradient", { id, x1: 0, x2: 1, y1: 0, y2: 0 }, stops.map((s, i) => el("stop", { offset: (i / 96).toFixed(4), "stop-color": sky(sunAlt(s)) }))),
    el("clipPath", { id: id + "c" }, [el("rect", { x: 2, y: y0, width: W - 4, height: bh, rx: bh / 2 })])]));
  const g = el("g", { "clip-path": `url(#${id}c)` }, [el("rect", { x: 0, y: y0, width: W, height: bh, fill: `url(#${id})` })]);
  const rnd = seeded(11); for (let i = 0; i < Math.round(W / 6); i++) { const x = 2 + rnd() * (W - 4), y = y0 + 2 + rnd() * (bh - 4); if (sunAlt(d0 + (x / W) * 864e5) < -10) g.append(el("circle", { cx: x, cy: y, r: 0.4 + rnd() * 0.6, fill: "#fff", opacity: 0.85, class: "star", style: `animation-delay:${(rnd() * 3).toFixed(2)}s` })); }
  svg.append(g);
  // the moon's hours, a fine line over the band
  let on = null; for (let s = d0; s <= d0 + 864e5; s += 10 * MIN) { const up = moonAlt(s) > 0; if (up && on == null) on = s; if ((!up || s >= d0 + 864e5 - 10 * MIN) && on != null) { svg.append(el("line", { x1: X(on) + 5, x2: X(s), y1: y0 - 6, y2: y0 - 6, stroke: dark() ? "var(--moon)" : "var(--mdark)", "stroke-width": 1.4, "stroke-linecap": "round", opacity: 0.6 }), moonDisc(X(on) + 1.5, y0 - 6, 3.2, t, false)); on = null; } }
  // sunrise and sunset under the band
  const rise = cross(sunAlt, d0, d0 + 864e5, H0, true), set = cross(sunAlt, d0, d0 + 864e5, H0, false);
  for (const [s, k] of [[rise, "↑"], [set, "↓"]]) if (s) { svg.append(el("line", { x1: X(s), x2: X(s), y1: y0 + bh + 1, y2: y0 + bh + 5, stroke: "var(--muted)", "stroke-width": 1 })); svg.append(label(W, X(s), y0 + bh + 16, `${k === "↑" ? "Sunrise" : "Sunset"} ${ist(s)}`)); }
  svg.append(el("line", { x1: X(t), x2: X(t), y1: y0 - 3, y2: y0 + bh + 3, stroke: "var(--ink)", "stroke-width": 1.6 }));
  svg.append(w.day ? el("g", {}, [el("circle", { cx: X(t), cy: y0 + bh / 2, r: 9, fill: "var(--paper)" }), el("circle", { cx: X(t), cy: y0 + bh / 2, r: 6.5, fill: "var(--sun)" })]) : moonDisc(X(t), y0 + bh / 2, 6.5, t, true));
  box.innerHTML = `<div class="dl">${words(t, w)}</div>`; box.firstChild.append(svg);
}

// ---------------------------------------------------------------- C · The halftone: the sun's path in the paper's own dots
// The path as a row of dots that grow as the sun climbs, the same screen as the nameplate's 1400: the ones behind us
// inked in, the ones to come pale. The sun is a disc of dots that swells slowly, as the nameplate does; by night the
// moon is a disc of dots in its phase, on its own path, with a few stars.
const C_LIVE = new Map();
function C(box, t) {
  const W = box.clientWidth, Hh = 62, hz = 46, w = windowAt(t), a = w.from - 30 * MIN, b = w.to + 30 * MIN, X = s => 6 + (s - a) / (b - a) * (W - 12);
  const f = w.day ? sunAlt : moonAlt, step = 7, n = Math.floor((W - 12) / step), pts = [...Array(n + 1)].map((_, i) => a + (b - a) * i / n);
  const top = Math.max(w.day ? 20 : 30, ...pts.map(f)), Y = v => hz - Math.max(0, Math.min(v, top)) / top * (hz - 10);
  const svg = el("svg", { viewBox: `0 0 ${W} ${Hh}`, height: Hh, role: "img", "aria-label": `${w.day ? "Sunrise" : "Sunset"} ${ist(w.from)}, ${w.day ? "sunset" : "sunrise"} ${ist(w.to)}` });
  for (let x = 2; x < W; x += 4.5) svg.append(el("circle", { cx: x, cy: hz, r: 0.75, fill: "var(--muted)" }));
  if (!w.day) { const rnd = seeded(5); for (let i = 0; i < Math.round(W / 16); i++) svg.append(el("circle", { cx: rnd() * W, cy: 3 + rnd() * (hz - 14), r: 0.5 + rnd() * 0.6, fill: "var(--ink)", opacity: 0.5, class: "star", style: `animation-delay:${(rnd() * 3).toFixed(2)}s` })); }
  const col = w.day ? "var(--sun)" : "var(--moon)";
  for (const s of pts) { const v = f(s); if (v <= 0.3) continue; const r = 0.7 + 2.5 * Math.sin(Math.min(v, top) * R) / Math.sin(top * R); svg.append(el("circle", { cx: X(s), cy: Y(v), r: r.toFixed(2), fill: s <= t ? col : "var(--rule)", ...(s <= t || w.day ? {} : { opacity: 0.8 }), ...(!w.day && s <= t && !dark() ? { stroke: "var(--mdark)", "stroke-width": 0.6 } : {}) })); }
  for (const s of [w.from, w.to]) svg.append(label(W, X(s), hz + 14, `${s === w.from ? (w.day ? "Sunrise" : "Sunset") : w.day ? "Sunset" : "Sunrise"} ${ist(s)}`));
  const v = f(t), cx = X(t), cy = Y(Math.max(v, 0)), disc = el("g");
  svg.append(disc);
  const show = w.day || v > 0;
  const p = phase(t), litAt = (x, y, r) => { // is (x, y) on the lit part of a moon of radius r in this phase?
    const k = 1 - 2 * p.lit, xs = p.waxing ? x : -x, edge = k * Math.sqrt(Math.max(0, r * r - y * y)); return xs >= edge; };
  const draw = now => {
    disc.replaceChildren(); if (!show) return;
    if (!w.day) disc.append(el("circle", { cx, cy, r: 12, fill: "none", stroke: "var(--muted)", "stroke-width": 0.6, "stroke-dasharray": "1 2", opacity: 0.7 }));
    const RR = w.day ? 13 : 11, g = 3.1, sw = 1 + 0.16 * Math.sin(now / 900);
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const x = (i - j) * g * Math.SQRT1_2, y = (i + j) * g * Math.SQRT1_2, d = Math.hypot(x, y); if (d > RR) continue;
      const fall = Math.sqrt(1 - (d / RR) ** 2), wave = 1 + 0.18 * Math.sin(now / 700 - d * 0.45);
      if (w.day) disc.append(el("circle", { cx: cx + x, cy: cy + y, r: (0.35 + 1.25 * fall * wave * sw).toFixed(2), fill: "var(--sun)" }));
      else if (litAt(x, y, RR)) disc.append(el("circle", { cx: cx + x, cy: cy + y, r: (0.45 + 1.2 * fall * wave).toFixed(2), fill: dark() ? "var(--moon)" : "var(--mdark)" }));
    }
  };
  draw(performance.now()); C_LIVE.set(box, draw);
  box.innerHTML = `<div class="dl">${words(t, w)}</div>`; box.firstChild.append(svg);
}
(function loop() { const n = performance.now(); C_LIVE.forEach(d => d(n)); requestAnimationFrame(loop); })();

// ---------------------------------------------------------------- the page
const VARIANTS = [
  { id: "A", draw: A, name: "A · The window", note: "A strip of the day's own sky, rose at dawn, amber at the golden hour, pale at noon, with the sun's real path over it. By night, night sky and stars, and the moon's path while it is up." },
  { id: "B", draw: B, name: "B · The ribbon", note: "The whole day, midnight to midnight, as one band in the sky's colours, with stars in the night. The needle is now; the fine line above is the moon's hours in the sky." },
  { id: "C", draw: C, name: "C · The halftone", note: "The sun's path in the nameplate's own dots, growing as the sun climbs; the sun a swelling disc of dots. By night, the moon in its phase, in dots." },
];
const block = (inner, small) => `<div class="card${small ? " small" : ""}"><div class="lab">Weather<small>${DATA.city}</small></div><div class="wx3"><div class="now"><span class="t tnum">${DATA.temp}°</span><div class="c"><b>${DATA.sky}</b><span class="tnum">Feels ${DATA.feels}° · High ${DATA.hi}° · Low ${DATA.lo}°</span></div></div>${inner}<p class="reads"><span><i>Rain</i><b class="tnum">${DATA.rain}%</b> today</span><span><i>Air</i><b class="tnum">${DATA.air}</b> poor for some</span><span><i>Humidity</i><b class="tnum">${DATA.humidity}%</b></span></p><p class="elsewhere">${DATA.others.map(o => `<span><b>${o.name}</b> <span class="tnum">${o.temp}°</span> ${o.sky}</span>`).join("")}</p></div></div>`;
const MOMENTS = [["Dawn", "05:52"], ["Morning", "08:30"], ["The paper's hour", "14:15"], ["Golden hour", "17:42"], ["Night", "22:30"]];
const at = s => D0 + (+s.slice(0, 2)) * HOUR + (+s.slice(3)) * MIN;
let T = at("14:15");
function paint() {
  C_LIVE.clear();
  const live = document.getElementById("live");
  live.innerHTML = VARIANTS.map(v => `<div class="var"><h3>${v.name}</h3><p class="note">${v.note}</p>${block(`<div class="slot" data-v="${v.id}"></div>`)}</div>`).join("");
  live.querySelectorAll(".slot").forEach(s => VARIANTS.find(v => v.id === s.dataset.v).draw(s, T));
  const m = document.getElementById("moments");
  m.innerHTML = VARIANTS.map(v => `<div class="moments"><h3>${v.name}</h3>${MOMENTS.map(([k, s]) => `<div><p class="when">${k} · ${s}</p>${block(`<div class="slot" data-v="${v.id}" data-t="${s}"></div>`, true)}</div>`).join("")}</div>`).join("");
  m.querySelectorAll(".slot").forEach(s => VARIANTS.find(v => v.id === s.dataset.v).draw(s, at(s.dataset.t)));
  document.getElementById("clock").textContent = ist(T);
}
const hour = document.getElementById("hour");
hour.value = Math.round((T - D0) / MIN);
hour.addEventListener("input", () => { T = D0 + hour.value * MIN; paint(); });
let playing = 0;
document.getElementById("play").addEventListener("click", e => {
  if (playing) { cancelAnimationFrame(playing); playing = 0; e.target.textContent = "Play a day"; return; }
  e.target.textContent = "Stop"; let last = performance.now();
  const tick = n => { T = D0 + ((T - D0 + (n - last) * 72 * 60) % 864e5 + 864e5) % 864e5; last = n; hour.value = Math.round((T - D0) / MIN);
    document.querySelectorAll("#live .slot").forEach(s => VARIANTS.find(v => v.id === s.dataset.v).draw(s, T)); document.getElementById("clock").textContent = ist(T); playing = requestAnimationFrame(tick); };
  playing = requestAnimationFrame(tick);
});
document.getElementById("theme").addEventListener("click", e => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; e.target.textContent = d.dataset.theme === "dark" ? "Day page" : "Night page"; paint(); });
if (location.hash === "#dark") { document.documentElement.dataset.theme = "dark"; document.getElementById("theme").textContent = "Day page"; }
addEventListener("resize", paint);
document.fonts.ready.then(paint);
