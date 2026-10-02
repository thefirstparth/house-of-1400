// The nameplate on two lines (mock, 3 Oct 2026). "The" over "HOUSE OF" as one fixed block, the live figure beside it.
// The rule that keeps it still: the block is set to the box of 1400 (the top of its figures, 0.722 of the size above
// the baseline, and the baseline), and every shape a tap brings starts where 1400 starts, on that baseline, inside that
// box (wordmark.js textDots). So the words never measure the shape, and never move.
const DESK_NAMES = [["one", "Page One"], ["news", "News"], ["home", "Close to Home"], ["sport", "Sport"], ["tech", "Tech & AI"], ["money", "Money"], ["off", "Off Duty"]];
const tabs = () => `<nav class="tabs">${DESK_NAMES.map(([id, n], i) => `<a style="--c:var(--d-${id})"${i ? "" : ' class="on"'}>${n}</a>`).join("")}</nav>`;
const run = wide => `<div class="run"><span>${wide ? "Friday 2 October 2026 · No. 8 · " : "Fri 2 Oct · "}Printed 14:15 IST · <b>13 min</b> read</span><span>${wide ? "Sat 3 Oct · 05:30 IST &nbsp; An afternoon newspaper for one reader · edited by T. A. Bhide" : "05:30"}</span></div>`;
const SHAPES = ["1400", "21°", "Feels 23°", "Clear", "05:30", "Bhatia"];
const NS = "http://www.w3.org/2000/svg";
const measure = (font, text, spacing = 0) => { const m = document.createElement("canvas").getContext("2d"); m.font = font; const r = m.measureText(text); return { w: r.width + spacing * Math.max(0, text.length - 1), a: r.actualBoundingBoxAscent, d: r.actualBoundingBoxDescent }; };

// the live figure, its canvas padding taken back so the holder's edges are 1400's ink and its height the canvas's
async function figure(holder, s) {
  const W = Math.ceil(ADV * s + s * 0.5), PX = Math.round(W * 0.2), ink0 = (W - ADV * s) / 2 + 0.028 * s, ink1 = (W - ADV * s) / 2 + (ADV - 2.294) * s;
  holder.style.cssText = `display:block;flex:none;margin:0 ${-(PX + ink1)}px 0 ${-(PX + ink0)}px;height:${Math.ceil(s * 1.02)}px;line-height:0;cursor:pointer`;
  await mountWordmark(holder, { size: s, shares: SHARES, cycle: () => SHAPES, homeAfter: 8 });
}
// a block of lines as SVG text, each on an exact baseline: [text, font, spacing, place] where place is "top" (its ink's
// top on the figures' top) or "base" (on 1400's baseline); align "end" or "start"
function stack(s, lines, align, rule) {
  const top = Math.ceil(s * 1.02) / 2 + s * 0.36 - s * 0.722, base = Math.ceil(s * 1.02) / 2 + s * 0.36;
  const m = lines.map(([t, f, sp]) => measure(f(s), t, sp(s))), w = Math.ceil(Math.max(...m.map(x => x.w))) + 2;
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("width", w + (rule ? s * 0.16 : 0)); svg.setAttribute("height", Math.ceil(s * 1.02)); svg.style.cssText = "display:block;flex:none;overflow:visible";
  lines.forEach(([t, f, sp, place], i) => {
    const x = document.createElementNS(NS, "text"); x.textContent = t;
    x.setAttribute("x", align === "end" ? w : 0); x.setAttribute("text-anchor", align === "end" ? "end" : "start");
    x.setAttribute("y", place === "top" ? top + m[i].a : base);
    x.setAttribute("style", `font:${f(s)};letter-spacing:${sp(s)}px;fill:var(--ink)`);
    svg.append(x);
  });
  if (rule) { const l = document.createElementNS(NS, "line"); const x = w + s * 0.08; l.setAttribute("x1", x); l.setAttribute("x2", x); l.setAttribute("y1", top); l.setAttribute("y2", base); l.setAttribute("style", "stroke:var(--rule);stroke-width:1.5"); svg.append(l); }
  return svg;
}
const black = k => s => `400 ${(s * k).toFixed(1)}px UnifrakturMaguntia`, caps = k => s => `600 ${(s * k).toFixed(1)}px "Libre Franklin"`;
const VARIANTS = [
  { id: "now", name: "Today, for comparison", note: "On one line, as the site has it now: the words are placed once against 1400 and stay; the shapes start where 1400 starts.", build: async (el, wide) => {
    el.innerHTML = `${run(wide)}<div class="np-now"><span class="the">The</span><span class="hof">House of</span><span class="fig"></span></div>${tabs()}`;
    const s = wide ? 128 : 76; el.querySelector(".np-now").style.cssText = `display:flex;flex-direction:row;justify-content:center;align-items:center;gap:${s * 0.1}px;padding:6px 0 12px`;
    el.querySelector(".the").style.fontSize = `${s * 0.42}px`; el.querySelector(".hof").style.fontSize = `${s * 0.13}px`; el.querySelector(".hof").style.margin = "0";
    await figure(el.querySelector(".fig"), s);
  } },
  { id: "a", name: "A · The stack, set right", note: "\"The\" in the blackletter over \"HOUSE OF\" in spaced capitals, set flush right against the figure: the top of \"The\" on the top of the figures, \"HOUSE OF\" on their baseline. The pair reads as one word with the number, like a masthead's ear.", lines: [["The", black(0.56), () => 0, "top"], ["HOUSE OF", caps(0.15), s => s * 0.15 * 0.36, "base"]], align: "end" },
  { id: "b", name: "B · The stack with a column rule", note: "The same two lines set flush left, and a hairline rule as tall as the figures between the words and the number, as a newspaper sets its ears. The rule is the fixed edge every shape starts from.", lines: [["The", black(0.56), () => 0, "top"], ["HOUSE OF", caps(0.15), s => s * 0.15 * 0.36, "base"]], align: "start", rule: true },
  { id: "c", name: "C · All in blackletter", note: "\"The\" small over \"House of\" larger, both in the blackletter, flush right, the two lines filling the height of the figures exactly: the oldest newspaper look, and the most weight beside the dots.", lines: [["The", black(0.34), () => 0, "top"], ["House of", black(0.44), () => 0, "base"]], align: "end" },
];
VARIANTS.filter(v => v.lines).forEach(v => { v.build = async (el, wide) => {
  el.innerHTML = `${run(wide)}<div class="np2"><span class="fig"></span></div>${tabs()}`;
  // the figure as big as the width allows on a phone (the stack is narrow), 128px on a laptop as now
  const k = (() => { const s = 100, m = v.lines.map(([t, f, sp]) => measure(f(s), t, sp(s)).w); return (Math.max(...m) + (v.rule ? s * 0.16 : 0)) / s; })();
  const avail = el.clientWidth - 2, s = wide ? 128 : Math.min(112, Math.floor(avail / (k + 0.12 + 2.266)));
  const row = el.querySelector(".np2"), st = stack(s, v.lines, v.align, v.rule); st.style.marginRight = `${s * (v.rule ? 0.04 : 0.12)}px`;
  row.prepend(st); await figure(row.querySelector(".fig"), s);
  el.dataset.size = s;
}; });

async function build() {
  await document.fonts.load("400 40px UnifrakturMaguntia"); await document.fonts.load("600 12px 'Libre Franklin'");
  const main = document.getElementById("variants");
  for (const v of VARIANTS) {
    const sec = document.createElement("section"); sec.id = v.id;
    sec.innerHTML = `<h2>${v.name}</h2><p class="dek">${v.note}</p><div class="pair"><div class="laptop"><div class="frame"><div class="hdr"></div><div class="body"></div></div><p class="cap">Laptop · <span class="h"></span></p></div><div class="phone"><div class="frame"><div class="hdr"></div><div class="body"></div></div><p class="cap">Phone · <span class="h"></span></p></div></div>`;
    main.append(sec);
    for (const kind of ["laptop", "phone"]) {
      const box = sec.querySelector(`.${kind} .hdr`); await v.build(box, kind === "laptop");
      const hgt = Math.round(box.getBoundingClientRect().height / (kind === "laptop" ? parseFloat(getComputedStyle(sec.querySelector(".laptop .frame")).zoom || 1) : 1));
      sec.querySelector(`.${kind} .h`).textContent = `header ${hgt}px tall${box.dataset.size ? ` · 1400 at ${box.dataset.size}px` : ""}`;
    }
  }
}
let cyc = 0;
document.getElementById("cycle").addEventListener("click", e => {
  if (cyc) { clearInterval(cyc); cyc = 0; e.target.textContent = "Show every shape"; return; }
  e.target.textContent = "Stop"; const tap = () => document.querySelectorAll(".fig").forEach(f => f.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  tap(); cyc = setInterval(tap, 2400);
});
document.getElementById("theme").addEventListener("click", () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; document.getElementById("theme").textContent = d.dataset.theme === "dark" ? "Day" : "Night"; });
if (location.hash === "#dark") { document.documentElement.dataset.theme = "dark"; document.getElementById("theme").textContent = "Day"; }
build();
