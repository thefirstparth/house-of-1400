// The Weather block, between the slim line and the ribbon (mock, 3 Oct 2026). Parth: "What we have now made is
// slightly too complex, while it is still beautiful. Can we not find a middle ground between beauty and design and some
// degree of cleanliness, and not exactly minimalism?" Uses astro.js (the sun and moon for Bengaluru, the sky colours).
const T = (s, d = 0) => D0 + d * 864e5 + (+s.slice(0, 2)) * HOUR + (+s.slice(3)) * MIN;
const svgOf = (W, Hh, kids, label) => { const s = el("svg", { viewBox: `0 0 ${W} ${Hh}`, height: Hh, width: "100%", role: "img", "aria-label": label }); kids.flat().filter(Boolean).forEach(k => s.append(k)); return s; };

const gradient = (id, a, b, steps = 24) => el("linearGradient", { id, x1: 0, x2: 1, y1: 0, y2: 0 }, [...Array(steps + 1)].map((_, i) => el("stop", { offset: (i / steps).toFixed(3), "stop-color": sky(sunAlt(a + (b - a) * i / steps)) })));
const ends = w => [`${w.day ? "Sunrise" : "Sunset"} <b class="tnum">${ist(w.from)}</b>`, `${w.day ? "Sunset" : "Sunrise"} <b class="tnum">${ist(w.to)}</b>`];
const left = (t, w) => `<b><em class="tnum">${hm(w.to - t)}</em> to ${w.day ? "sunset" : "sunrise"}</b>`;
function fact(t, w) {
  if (w.day) { const g = cross(sunAlt, Math.max(t, w.to - 3 * HOUR), w.to, 6, false); return g ? `Golden hour ${ist(g)}` : sunAlt(t) < 6 && t > (w.from + w.to) / 2 ? "Golden hour now" : ""; }
  const up = moonAlt(t) > 0, lit = Math.round(phase(t).lit * 100), nx = cross(moonAlt, t, w.to + HOUR, 0, !up);
  return up ? `Moon ${lit}%, up till ${nx ? ist(nx) : "dawn"}` : nx && nx < w.to ? `Moon ${lit}%, rises ${ist(nx)}` : `Moon ${lit}%`;
}
const mark = (x, y, t, w, r = 5) => w.day
  ? el("g", {}, [el("circle", { cx: x, cy: y, r: r + 4, fill: "var(--halo)", opacity: 0.9 }), el("circle", { cx: x, cy: y, r, fill: "var(--sun)" })])
  : moonAlt(t) > 0 ? el("g", {}, [el("circle", { cx: x, cy: y, r: r + 3.5, fill: "var(--mhalo)" }), moonDisc(x, y, r + 0.5, t, false)])
  // the moon is drawn only while it is up; before it rises (or after it sets) the night's mark is a plain dot
  : el("g", {}, [el("circle", { cx: x, cy: y, r: r + 2.5, fill: "var(--mhalo)" }), el("circle", { cx: x, cy: y, r: r - 1, fill: "var(--night)" })]);

// Before: the slim line from 2 Oct, as it was (for comparison)
function V0(box, t) {
  const w = windowAt(t), W = Math.max(80, box.clientWidth - 176), f = (t - w.from) / (w.to - w.from), x = 6 + (W - 12) * f, [a, b] = ends(w);
  box.innerHTML = `<div class="dl lr"><span class="end">${a}</span><span class="mid"></span><span class="end">${b}</span><p class="over">${left(t, w)}</p></div>`;
  box.querySelector(".mid").append(svgOf(W, 16, [el("line", { x1: 6, x2: W - 6, y1: 8, y2: 8, stroke: "var(--rule)", "stroke-width": 1.5 }), el("line", { x1: 6, x2: x, y1: 8, y2: 8, stroke: w.day ? "var(--sun)" : "var(--moon)", "stroke-width": 2 }), mark(x, 8, t, w, 3.8)], ""));
}
// 1 · The line, coloured: the same slim line; the part of the day already gone takes the sky's colours, the sun has a
// soft halo, the moon its phase. One row, as before, with the one fact more at the right of the countdown.
function V1(box, t) {
  const w = windowAt(t), W = Math.max(80, box.clientWidth - 176), f = (t - w.from) / (w.to - w.from), x = 6 + (W - 12) * f, [a, b] = ends(w), id = `g${gid++}`, x2 = fact(t, w);
  box.innerHTML = `<div class="dl lr"><span class="end">${a}</span><span class="mid"></span><span class="end">${b}</span><p class="over">${left(t, w)}${x2 ? `<span class="fx">· ${x2}</span>` : ""}</p></div>`;
  box.querySelector(".mid").append(svgOf(W, 18, [el("defs", {}, [gradient(id, w.from, w.to)]), el("line", { x1: 6, x2: W - 6, y1: 9, y2: 9, stroke: "var(--rule)", "stroke-width": 1.5, "stroke-linecap": "round" }),
    el("rect", { x: 6, y: 7.25, width: Math.max(0, x - 6), height: 3.5, rx: 1.75, fill: `url(#${id})` }), mark(x, 9, t, w, 4.6)], ""));
  box.querySelector("linearGradient").setAttribute("gradientUnits", "userSpaceOnUse"); box.querySelector("linearGradient").setAttribute("x1", 6); box.querySelector("linearGradient").setAttribute("x2", W - 6);
}
// 2 · The low arc: the shape of the first design, flattened to a strip: the sun's real path from rise to set (the
// night's from set to rise), gone in the sky's colours, ahead in dots; the times under its ends.
function V2(box, t) {
  const w = windowAt(t), W = box.clientWidth, Hh = 44, base = 34, id = `g${gid++}`, x2 = fact(t, w);
  const N = 60, X = s => 8 + (W - 16) * (s - w.from) / (w.to - w.from);
  const Y = s => base - 26 * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - w.from) / (w.to - w.from))));
  const pts = [...Array(N + 1)].map((_, i) => w.from + (w.to - w.from) * i / N), path = (a, b) => pts.filter(s => s >= a && s <= b).map((s, i) => `${i ? "L" : "M"}${X(s).toFixed(1)} ${Y(s).toFixed(1)}`).join("") + (b < w.to ? `L${X(b).toFixed(1)} ${Y(b).toFixed(1)}` : "");
  box.innerHTML = `<div class="dl"><p class="top">${left(t, w)}${x2 ? `<span class="fx">${x2}</span>` : ""}</p><span class="mid"></span><p class="ends"><span>${ends(w)[0]}</span><span>${ends(w)[1]}</span></p></div>`;
  const g = gradient(id, w.from, w.to); g.setAttribute("gradientUnits", "userSpaceOnUse"); g.setAttribute("x1", 8); g.setAttribute("x2", W - 8);
  box.querySelector(".mid").append(svgOf(W, Hh, [el("defs", {}, [g]), el("line", { x1: 0, x2: W, y1: base, y2: base, stroke: "var(--rule)", "stroke-width": 1 }),
    el("path", { d: path(t, w.to), fill: "none", stroke: "var(--muted)", "stroke-width": 1.4, "stroke-dasharray": "1.5 4", "stroke-linecap": "round", opacity: 0.7 }),
    el("path", { d: path(w.from, t), fill: "none", stroke: `url(#${id})`, "stroke-width": 3, "stroke-linecap": "round" }), mark(X(t), Y(t), t, w, 5)], ""));
}
// 3 · The day's own band: only the span you are in (sunrise to sunset, or the night), as one short band in the sky's
// colours, the times at its ends and the sun or moon on it; the countdown under it. No stars, no moon line.
function V3(box, t) {
  const w = windowAt(t), W = Math.max(80, box.clientWidth - 112), f = (t - w.from) / (w.to - w.from), x = 9 + (W - 18) * f, id = `g${gid++}`, x2 = fact(t, w);
  box.innerHTML = `<div class="dl row3"><span class="end"><i>${w.day ? "Sunrise" : "Sunset"}</i><b class="tnum">${ist(w.from)}</b></span><span class="mid"></span><span class="end r"><i>${w.day ? "Sunset" : "Sunrise"}</i><b class="tnum">${ist(w.to)}</b></span><p class="under">${left(t, w)}${x2 ? `<span class="fx">· ${x2}</span>` : ""}</p></div>`;
  const g = gradient(id, w.from, w.to); g.setAttribute("gradientUnits", "userSpaceOnUse"); g.setAttribute("x1", 9); g.setAttribute("x2", W - 9);
  box.querySelector(".mid").append(svgOf(W, 22, [el("defs", {}, [g]), el("rect", { x: 9, y: 7, width: W - 18, height: 8, rx: 4, fill: `url(#${id})` }),
    el("rect", { x, y: 7, width: Math.max(0, W - 9 - x), height: 8, fill: "var(--paper)", opacity: 0.45 }), mark(x, 11, t, w, 5.5)], ""));
}
// 4 · The hours in dots: one dot for each hour of the day (or the night), in the nameplate's halftone, each as big as
// the sun is high in that hour; the hours gone are inked, the hour you are in carries the sun or the moon.
function V4(box, t) {
  const w = windowAt(t), n = Math.round((w.to - w.from) / HOUR), W = Math.max(80, box.clientWidth - 176), step = (W - 16) / Math.max(1, n - 1), x2 = fact(t, w);
  const kids = [];
  const top = Math.max(...[...Array(n)].map((_, i) => w.day ? sunAlt(w.from + (i + 0.5) * HOUR) : moonAlt(w.from + (i + 0.5) * HOUR)), 10);
  for (let i = 0; i < n; i++) {
    const s = w.from + (i + 0.5) * HOUR, x = 8 + step * i, alt = w.day ? sunAlt(s) : 40, r = 1.6 + 3.2 * Math.max(0, Math.min(1, alt / top)) ** 0.7;
    const now = t >= w.from + i * HOUR && t < w.from + (i + 1) * HOUR, gone = t >= w.from + (i + 1) * HOUR;
    if (now) kids.push(mark(x, 10, t, w, 4.8));
    else kids.push(el("circle", { cx: x, cy: 10, r: (w.day ? r : 2.4).toFixed(2), fill: gone ? (w.day ? sky(sunAlt(s)) : "var(--night)") : "none", stroke: gone ? "none" : "var(--rule)", "stroke-width": 1.2 }));
  }
  box.innerHTML = `<div class="dl lr"><span class="end">${ends(w)[0]}</span><span class="mid"></span><span class="end">${ends(w)[1]}</span><p class="over">${left(t, w)}${x2 ? `<span class="fx">· ${x2}</span>` : ""}</p></div>`;
  box.querySelector(".mid").append(svgOf(W, 20, kids, ""));
}
const VARIANTS = [
  { id: "B", draw: B, name: "Today · the ribbon", note: "What is on the site now: the whole day, midnight to midnight, stars, the moon's hours." },
  { id: "V0", draw: V0, name: "Before · the slim line", note: "The line of 2 Oct, for comparison." },
  { id: "V1", draw: V1, name: "1 · The line, coloured", note: "The slim line you liked, one row as before; the part of the day already gone takes the sky's colours, the sun a soft halo, the moon its phase. The golden hour, or the moon, beside the countdown." },
  { id: "V2", draw: V2, name: "2 · The low arc", note: "The first design's arc, flattened to a strip: the day's path from sunrise to sunset (by night, sunset to sunrise), the part gone in the sky's colours, the rest in dots; the times under its ends." },
  { id: "V3", draw: V3, name: "3 · The day's own band", note: "Only the span you are in, as one short band in the sky's colours with the times at its ends, and the countdown under it. No stars, no moon line, no midnight-to-midnight." },
  { id: "V4", draw: V4, name: "4 · The hours in dots", note: "One dot for each hour of the day (or the night), in the nameplate's halftone, each as big as the sun is high then; the hours gone are inked, the one you are in carries the sun or the moon." },
];
const block = (inner, wide) => `<div class="card"><div class="lab"><span>Weather</span><span class="r"><span class="here">○ Where I am</span><span>Sky &amp; Streets →</span></span></div><div class="wx3"><p class="wxplace">Bengaluru</p><div class="now"><span class="t tnum">${DATA.temp}°</span><div class="c"><b>${DATA.sky}</b><span class="tnum">Feels ${DATA.feels}° · High ${DATA.hi}° · Low ${DATA.lo}°</span></div></div>${inner}<p class="reads"><span><i>Rain</i><b class="tnum">${DATA.rain}%</b> today</span><span><i>Air</i><b class="tnum">${DATA.air}</b> poor for some</span><span><i>Humidity</i><b class="tnum">${DATA.humidity}%</b></span></p><p class="elsewhere">${DATA.others.map(o => `<span><b>${o.name}</b> <span class="tnum">${o.temp}°</span> ${o.sky}</span>`).join("")}</p></div></div>`;
const MOMENTS = [["The paper's hour", "14:15", 0], ["Golden hour", "17:40", 0], ["Night", "22:30", 0], ["Before dawn", "05:20", 1]];
let PHONE = false;
function paint() {
  const m = document.getElementById("grid"); document.body.classList.toggle("phone", PHONE);
  m.innerHTML = VARIANTS.map(v => `<section class="var"><h2>${v.name}</h2><p class="note">${v.note}</p><div class="row">${MOMENTS.map(([k, s, d]) => `<div class="cell"><p class="when">${k} · ${s}</p>${block(`<div class="slot" data-v="${v.id}" data-t="${s}" data-d="${d}"></div>`)}</div>`).join("")}</div></section>`).join("");
  m.querySelectorAll(".slot").forEach(s => VARIANTS.find(v => v.id === s.dataset.v).draw(s, T(s.dataset.t, +s.dataset.d)));
}
document.getElementById("theme").addEventListener("click", e => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; e.target.textContent = d.dataset.theme === "dark" ? "Day page" : "Night page"; paint(); });
document.getElementById("phone").addEventListener("click", e => { PHONE = !PHONE; e.target.textContent = PHONE ? "Laptop width" : "Phone width"; paint(); });
if (location.hash === "#dark") { document.documentElement.dataset.theme = "dark"; document.getElementById("theme").textContent = "Day page"; }
if (location.hash === "#phone") { PHONE = true; document.getElementById("phone").textContent = "Laptop width"; }
addEventListener("resize", paint);
document.fonts.ready.then(paint);
