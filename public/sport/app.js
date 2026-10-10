// Sport V2 (/sport): everything Parth follows, in one app. The shell: routing, sheets, refresh, theme. Data in
// js/core.js, components in js/ui.js, screens in js/views.js. No LLM anywhere.
import { D, S, events, loadAll as load, rel, nbaOn } from "./js/core.js";
import { sheet } from "./js/ui.js";
import { VIEWS, TITLES } from "./js/views.js";

const $ = s => document.querySelector(s);
const view = $("#view");
const vibe = () => { try { navigator.vibrate?.(8); } catch {} };
const UI = S.UI;

async function loadAll() {
  if (S.loading) return;
  $("#refresh").classList.add("spin");
  let q = false;
  await load(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; render(false); }); });
  $("#refresh").classList.remove("spin");
  render(false);
}

// ------------------------------------------------------------------ router
const atBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
let io = null, jio = null, jcur = null, onBottom = () => {}, sheetFor = null, sig = "";
const parse = () => { const [r, sec] = location.hash.replace(/^#\/?/, "").split("/"); return { r: VIEWS[r] ? r : "home", sec: sec || null }; };
const stateSig = () => events().map(e => `${e.id}:${e.state}:${e.sa ?? ""}-${e.sb ?? ""}:${(e.liveTop || []).join(",")}`).join("|");
function render(navigated) {
  const { r, sec } = parse(), changed = r !== S.route; S.route = r;
  const y = window.scrollY;
  document.body.dataset.tab = r;
  const nbaTab = $('.tabs a[data-tab="nba"]'); if (nbaTab) nbaTab.hidden = !nbaOn() && r !== "nba";
  $("#tabs").style.setProperty("--n", [...document.querySelectorAll(".tabs a")].filter(a => !a.hidden).length);
  for (const a of document.querySelectorAll(".tabs a")) { if (a.dataset.tab === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
  $("#topTitle").textContent = TITLES[r];
  S.sheet = "";
  view.innerHTML = VIEWS[r]();
  if (UI.match) { const ev = events(true).find(x => x.id === UI.match); if (ev) S.sheet = sheet(ev); else UI.match = null; }
  sig = stateSig();
  // sheets sit in their own layer above the app, which goes inert behind them
  const root = $("#sheet-root"), opening = S.sheet && !root.innerHTML, was = root.innerHTML ? root.dataset.kind : "", kind = UI.match ? "m" : "d";
  root.innerHTML = S.sheet; root.dataset.kind = S.sheet ? kind : "";
  $("#app").inert = !!root.innerHTML;
  if (opening || (S.sheet && was && was !== kind)) { sheetFor = UI.match ? `[data-match="${CSS.escape(UI.match)}"]` : `.wd[data-v="${CSS.escape(UI.day || "")}"]`; requestAnimationFrame(() => $("#sheet-t")?.focus()); dragSheet(root.querySelector(".sheet")); }
  else if (!root.innerHTML && sheetFor) { const b = view.querySelector(sheetFor); sheetFor = null; b?.focus({ preventScroll: true }); }
  if (!changed && !navigated) { view.querySelector(".page")?.style.setProperty("animation", "none"); window.scrollTo(0, y); }
  else if (sec && document.getElementById(sec)) requestAnimationFrame(() => document.getElementById(sec).scrollIntoView({ block: "start" }));
  else window.scrollTo(0, 0);
  document.title = `${TITLES[r]} · Sport`;
  io?.disconnect(); jio?.disconnect(); jcur = null;
  const chips = [...document.querySelectorAll(".jump a[data-jump]")];
  if (chips.length && "IntersectionObserver" in window) {
    const seen = new Map();
    jio = new IntersectionObserver(es => {
      for (const en of es) seen.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : null);
      if (atBottom()) return onBottom();
      const cur = [...seen].filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0]?.[0];
      if (cur === jcur) return; jcur = cur;
      for (const c of chips) { const on = c.dataset.jump === cur; c.toggleAttribute("aria-current", on); if (on) { const bar = c.parentElement; bar.scrollTo({ left: Math.max(0, c.offsetLeft - (bar.clientWidth - c.offsetWidth) / 2), behavior: "smooth" }); } }
    }, { rootMargin: "-110px 0px -55% 0px" });
    for (const c of chips) { const el = document.getElementById(c.dataset.jump); if (el) jio.observe(el); }
    onBottom = () => { if (atBottom()) { const lastC = chips.at(-1); if (jcur !== lastC.dataset.jump) { jcur = lastC.dataset.jump; for (const c of chips) c.toggleAttribute("aria-current", c === lastC); const bar = lastC.parentElement; bar.scrollTo({ left: bar.scrollWidth, behavior: "smooth" }); } } };
  } else onBottom = () => {};
  const h1 = $("#h1");
  if (h1 && "IntersectionObserver" in window) { io = new IntersectionObserver(([en]) => $("#top").classList.toggle("solid", !en.isIntersecting), { rootMargin: "-56px 0px 0px 0px" }); io.observe(h1); }
}
addEventListener("hashchange", () => { vibe(); UI.match = null; UI.day = null; render(true); });
$("#refresh").addEventListener("click", () => { vibe(); loadAll(); });

// ------------------------------------------------------------------ theme: light unless dark is chosen, kept on the phone
const setTheme = dark => {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("#themeColor")?.setAttribute("content", dark ? "#000000" : "#f4f4f6");
  const b = $("#theme"); b.setAttribute("aria-pressed", String(dark)); b.setAttribute("aria-label", dark ? "Light mode" : "Dark mode");
  try { localStorage.setItem("sport-theme", dark ? "dark" : "light"); } catch {}
};
setTheme(document.documentElement.dataset.theme === "dark");
$("#theme").addEventListener("click", () => { vibe(); setTheme(document.documentElement.dataset.theme !== "dark"); });

// ------------------------------------------------------------------ taps
function dragSheet(el) {
  if (!el) return; let y0 = null, dy = 0;
  el.addEventListener("touchstart", e => { if (el.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; el.style.transition = "none"; }, { passive: true });
  el.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener("touchend", () => { if (y0 == null) return; el.style.transition = ""; if (dy > 80) { if (UI.match) UI.match = null; else UI.day = null; render(false); } else el.style.transform = ""; y0 = null; }, { passive: true });
}
$("#sheet-root").addEventListener("click", e => {
  const c = e.target.closest("[data-close]"); if (c) { UI[c.dataset.close] = null; render(false); return; }
  const mt = e.target.closest("[data-match]"); if (mt) { e.preventDefault(); UI.match = mt.dataset.match; vibe(); render(false); }
});
view.addEventListener("click", e => {
  const b = e.target.closest("button[data-ui]");
  if (b) { UI[b.dataset.ui] = b.dataset.ui === "day" && UI.day === b.dataset.v ? null : b.dataset.v; vibe(); render(false); return; }
  const mt = e.target.closest("[data-match]");
  if (mt) { e.preventDefault(); UI.match = mt.dataset.match; vibe(); render(false); return; }
  const j = e.target.closest("a[data-jump]");
  if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.jump); if (el) { el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); history.replaceState(null, "", j.getAttribute("href")); } }
});
// pull to refresh (a home-screen web app on iPhone has none of its own)
{
  let y0 = null, pulled = 0; const ind = document.createElement("div"); ind.className = "ptr"; ind.setAttribute("aria-hidden", "true"); document.body.append(ind);
  addEventListener("touchstart", e => { y0 = window.scrollY <= 0 && !UI.day && !UI.match ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
  addEventListener("touchmove", e => { if (y0 == null) return; pulled = Math.max(0, e.touches[0].clientY - y0); ind.style.setProperty("--p", Math.min(pulled / 70, 1)); ind.classList.toggle("on", pulled > 8); ind.classList.toggle("ready", pulled > 70); }, { passive: true });
  addEventListener("touchend", () => { if (y0 != null && pulled > 70) { vibe(); loadAll(); } y0 = null; ind.classList.remove("on", "ready"); }, { passive: true });
}
addEventListener("scroll", () => onBottom(), { passive: true });
addEventListener("pointerdown", () => { document.body.dataset.input = "touch"; }, { passive: true });
addEventListener("keydown", () => { delete document.body.dataset.input; });
addEventListener("keydown", e => { if (e.key === "Escape" && (UI.day || UI.match)) { if (UI.match) UI.match = null; else UI.day = null; render(false); } });

// ------------------------------------------------------------------ time
// Countdowns tick every 20 seconds. Every 30 seconds: redraw if any event changed state (a session starting or
// finishing needs no reload to show), and reload every minute while something is live or about to start, else every
// five minutes, and on return to the app.
setInterval(() => { for (const el of document.querySelectorAll("[data-cd]")) { const v = rel(el.dataset.cd); if (el.textContent !== v) el.textContent = v; } }, 20000);
setInterval(() => {
  if (document.hidden) return;
  if (!UI.match && !UI.day && stateSig() !== sig) render(false);
  const E = events(), hot = E.some(e => e.state === "live" || (e.state === "next" && Date.parse(e.start) - Date.now() < 15 * 6e4));
  if (Date.now() - S.lastLoad > (hot ? 60e3 : 300e3)) loadAll();
}, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { sizeCheck(); if (Date.now() - S.lastLoad > 60e3) loadAll(); } });
// very large text (Dynamic Type): capped at 21px; the tab bar keeps its icons and drops the labels
const sizeCheck = () => {
  const h = document.documentElement; h.style.fontSize = "";
  const px = parseFloat(getComputedStyle(h).fontSize);
  if (px > 21) h.style.fontSize = "21px";
  document.body.classList.toggle("big", px > 19);
};
sizeCheck(); addEventListener("resize", sizeCheck);
render(true);
loadAll();
if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("/sport-sw.js", { scope: "/sport" }).catch(() => {});
export { D };
