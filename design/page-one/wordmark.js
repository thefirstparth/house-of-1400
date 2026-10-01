// The House of 1400's wordmark on Page One (Parth, 1 Oct 2026: options 1 + 4 of design/nameplate).
// "1400" printed as a newsprint halftone: a 45° screen of round ink dots, each sized by how much of its cell the
// figure covers, so it reads as the solid Playfair 1400 from a distance and as a printed screen up close. Every dot
// belongs to one of today's stories, shared out in reading order (desk by desk, left to right), so the figure is
// also the day's paper.
// - At rest: ink only, still. Nothing moves until the reader touches it.
// - Pointer (laptop): a soft tone of ink rises around the pointer, the dots under it show their story's desk colour,
//   and the line under the figure names the story under the pointer, linked to its desk.
// - Tap or click: a ring of ink spreads from the finger; every dot it passes takes its desk colour, so the whole
//   figure shows the day's mix for a few seconds, then settles back to ink. The line names the story tapped.
// - Motion off (prefers-reduced-motion): the same, without movement.
// Lining figures: the text is drawn through an SVG image (Playfair's default figures are oldstyle, and a canvas
// cannot switch them), which works in every browser.
// mountWordmark(el, { items: [{headline, desk, deskName, href}], font: base64 woff2 of Playfair Display,
//   caption: { show(html), hide() } for the line, size: px }) -> destroy()

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

// The screen for one size, worked out once: every dot's place, its size at rest and its story.
async function screenFor(size, font, nItems) {
  const key = `${size}|${nItems}`;
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
    dots.push({ x, y, base: Math.sqrt(cover(x, y, g / 2)), story: -1 });
  }
  // the figure's dots shared among the stories in reading order, left to right
  const ink = dots.filter(d => d.base > 0.3).sort((a, b) => a.x - b.x || a.y - b.y), per = ink.length / Math.max(1, nItems);
  ink.forEach((d, k) => { d.story = Math.min(nItems - 1, Math.floor(k / per)); });
  const s = { W, H, g, dots, span };
  CACHE.set(key, s);
  return s;
}

export async function mountWordmark(el, { items, font, caption, size }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = await screenFor(size, font, items.length);
  const { W, H, g, dots, span } = S, R = g * 0.6;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `display:block;width:${W}px;height:${H}px;touch-action:pan-y;cursor:crosshair;margin:0 auto`;
  el.replaceChildren(c);
  const ctx = c.getContext("2d");
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // sharp at any page zoom (Page One scales itself to the screen) and on any phone
  const scale = () => { const r = c.getBoundingClientRect(), z = r.width / W || 1, k = Math.min(3, (devicePixelRatio || 1) * z); c.width = Math.round(W * k); c.height = Math.round(H * k); ctx.setTransform(k, 0, 0, k, 0, 0); };
  scale();
  for (const d of dots) { d.r = d.base; d.tint = 0; d.tintTo = 0; }
  let pointer = null, rings = [], raf = 0, settle = 0, hot = -1, alive = true;
  const at = e => { const r = c.getBoundingClientRect(), z = r.width / W || 1; return [(e.clientX - r.left) / z, (e.clientY - r.top) / z]; };
  const say = i => {
    if (!caption) return;
    if (i < 0) return caption.hide();
    const it = items[i];
    caption.show(`<span style="color:var(--d-${it.desk})">${it.deskName}</span> · <a href="${it.href}">${it.headline} →</a>`);
  };
  function frame(now) {
    raf = 0; if (!alive) return;
    const ink = css("--ink"), colours = {}, colour = desk => (colours[desk] ||= css(`--d-${desk}`));
    for (const r of rings) r.r = reduced ? span * 2 : (now - r.t0) * 0.7;
    rings = rings.filter(r => r.r < span * 2.2);
    ctx.clearRect(0, 0, W, H);
    let busy = rings.length > 0 || !!pointer;
    const byColour = new Map();
    for (const d of dots) {
      let target = d.base, ring = 0;
      const near = pointer ? Math.max(0, 1 - Math.hypot(d.x - pointer[0], d.y - pointer[1]) / (H * 0.7)) : 0;
      if (near) target = Math.max(target, 0.42 * near * near);
      for (const r of rings) { const k = Math.max(0, 1 - Math.abs(Math.hypot(d.x - r.x, d.y - r.y) - r.r) / (g * 3)); ring = Math.max(ring, k * Math.max(0, 1 - r.r / span)); if (d.story >= 0 && Math.hypot(d.x - r.x, d.y - r.y) <= r.r && r.t0 > (d.tintAt || 0)) { d.tintTo = 1; d.tintAt = r.t0; } }
      target = d.base > 0.05 ? Math.min(1.2, target + ring * 0.45) : Math.max(target, ring * 0.5);
      // a dot shows its story's colour while the ring has passed it (until the figure settles) or under the pointer
      const tintGoal = d.story >= 0 ? Math.max(d.tintTo, near > 0.35 ? 1 : 0) : 0;
      d.r += (target - d.r) * (reduced ? 1 : 0.22);
      d.tint += (tintGoal - d.tint) * (reduced ? 1 : 0.14);
      if (Math.abs(target - d.r) > 0.004 || Math.abs(tintGoal - d.tint) > 0.01) busy = true;
      if (d.r < 0.03) continue;
      const key = d.story >= 0 && d.tint > 0.5 ? colour(items[d.story].desk) : ink;
      if (!byColour.has(key)) byColour.set(key, []);
      byColour.get(key).push(d);
    }
    for (const [fill, list] of byColour) { ctx.fillStyle = fill; ctx.beginPath(); for (const d of list) { ctx.moveTo(d.x + d.r * R, d.y); ctx.arc(d.x, d.y, d.r * R, 0, Math.PI * 2); } ctx.fill(); }
    if (busy) wake();
  }
  const wake = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
  const storyAt = (px, py) => { let best = -1, bd = g * 2.5; for (const d of dots) if (d.story >= 0) { const dd = Math.hypot(d.x - px, d.y - py); if (dd < bd) { bd = dd; best = d.story; } } return best; };
  const calm = () => { clearTimeout(settle); settle = setTimeout(() => { for (const d of dots) d.tintTo = 0; if (!pointer) say(-1); wake(); }, 4500); };
  c.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    pointer = at(e); const i = storyAt(...pointer); if (i !== hot) { hot = i; if (i >= 0) say(i); } wake();
  });
  c.addEventListener("pointerleave", () => { pointer = null; hot = -1; if (!dots.some(d => d.tintTo)) say(-1); wake(); });
  c.addEventListener("click", e => {
    const [px, py] = at(e), i = storyAt(px, py);
    rings.push({ x: px, y: py, t0: performance.now(), r: 0 }); say(i >= 0 ? i : 0); calm(); wake();
  });
  const mo = new MutationObserver(() => wake());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)"), onScheme = () => wake(); mq.addEventListener?.("change", onScheme);
  frame(performance.now());
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(settle); mo.disconnect(); mq.removeEventListener?.("change", onScheme); };
}
