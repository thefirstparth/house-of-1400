// Sport V3 (/sport): everything Parth follows, in one app. The shell: routing, history, sheets, refresh, theme, motion.
// Data in js/core.js, components in js/ui.js, screens in js/views.js. No LLM anywhere.
// A redraw patches the page in place (js/morph.js): nodes that did not change are kept, so pills glide, images stay
// painted, an open sheet stays put and a new score rolls in once. Only a change of tab swaps the page, with a cross-fade.
import { D, S, events, loadAll as load, rel, nbaOn, markSeen, hm, store, last } from "./js/core.js";
import { sheet, header } from "./js/ui.js";
import { VIEWS, TITLES } from "./js/views.js";
import { morph } from "./js/morph.js";

const $ = s => document.querySelector(s);
const view = $("#view"), root = $("#sheet-root");
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
const UI = S.UI;
const say = txt => { const a = $("#announce"); if (a) { a.textContent = ""; setTimeout(() => (a.textContent = txt), 50); } };

// ------------------------------------------------------------------ loading
// The first draw waits for the feeds that decide what leads Today (live and next), up to 0.8 seconds, so Live now
// never arrives last and pushes the page down. After that, redraws as feeds arrive are merged (one per 250ms).
const LEAD = ["f1_sessions", "f1_next", "football", "crease", "tennis_players", "nba", "intl_hub"];
let held = true, pend = null;
const soon = () => { if (held || pend) return; pend = setTimeout(() => { pend = null; render(false); }, 250); };
async function loadAll(manual = false) {
  if (S.loading) return;
  $("#refresh").classList.add("spin");
  const got = new Set(), first = !S.lastLoad;
  if (first) setTimeout(() => { if (held) { held = false; render(false); } }, LEAD.some(k => store.get(k)) ? 800 : 2500);
  await load(k => {
    if (k) got.add(k);
    else if (held && first && LEAD.every(x => D[x])) { held = false; render(false); return; } // the phone's saved copy covers what leads Today
    if (held && LEAD.every(x => got.has(x))) { held = false; render(false); } else soon();
  });
  held = false;
  $("#refresh").classList.remove("spin");
  clearTimeout(pend); pend = null; render(false);
  const fresh = Object.values(D).some(x => x && !x.stale);
  if (manual || !fresh) say(fresh ? `Updated ${hm(new Date().toISOString())}` : Object.keys(D).length ? "The feeds did not answer. Showing the last saved copies." : "The feeds did not answer.");
}

// ------------------------------------------------------------------ router and history
// Back from any tab goes to Today, then out of the app (a tab change from another tab replaces the history entry);
// a chosen day and an open sheet are history entries, so the Android back gesture undoes them first.
const atBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
let io = null, jio = null, jcur = null, onBottom = () => {}, sheetFor = null, sig = "", pendingSec = null, vt = false;
const scrollMem = {};
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
let sT = 0; addEventListener("scroll", () => { clearTimeout(sT); sT = setTimeout(() => { if (S.route) scrollMem[S.route] = scrollY; }, 120); }, { passive: true });
// every visited tab's page stays in #view, laid out but hidden (content-visibility), so going back to a tab only
// shows it again and patches it with fresh data; the page shown is the one without .away
const cur = () => view.querySelector(":scope > .pg:not(.away)") || view;
const byId = id => cur().querySelector("#" + CSS.escape(id));
function pageFor(r, html) {
  let pg = view.querySelector(`:scope > .pg[data-r="${r}"]`);
  if (!pg) { pg = document.createElement("div"); pg.className = "pg away"; pg.dataset.r = r; pg.innerHTML = html; view.append(pg); return [pg, true]; }
  return [pg, false];
}
let fromHome = false;
const parse = () => { const [r, sec] = location.hash.replace(/^#\/?/, "").split("/"); return { r: VIEWS[r] ? r : "home", sec: sec || null }; };
const stateSig = () => events().map(e => `${e.id}:${e.state}:${e.late ? 1 : 0}${e.starting ? 1 : 0}:${e.sa ?? ""}-${e.sb ?? ""}:${(e.liveTop || []).join(",")}`).join("|");
// a tab change: the pill glides from the tap; the page fades out (90ms) while the next page is built, is swapped, and
// fades in (160ms); with reduced motion a 60ms fade each way. One change in flight: a tap during the fade only moves the
// pill and the end of the fade draws the latest route.
let tabFx = null, pre = null;
function render(navigated) {
  if (held && S.loading) return;
  const to = parse().r;
  if (!(navigated && S.route && to !== S.route) || !view.animate) { if (!tabFx) draw(navigated); return; }
  pill(to);
  if (tabFx) return;
  const from = parseFloat(getComputedStyle(view).opacity);
  tabFx = view.animate([{ opacity: isNaN(from) ? 1 : from }, { opacity: 0 }], { duration: RM() ? 60 : 90, easing: "ease-in", fill: "forwards" });
  // the next page is built (and, first time, attached hidden) while the old one fades
  setTimeout(() => { const r = parse().r; try { pre = { r, html: VIEWS[r]() }; const [pg, made] = pageFor(r, pre.html); if (!made) morph(pg, pre.html); } catch { pre = null; } }, 0);
  tabFx.finished.catch(() => {}).then(() => {
    draw(true);
    view.animate(RM() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: RM() ? 60 : 160, easing: "cubic-bezier(.2,0,0,1)" });
    tabFx.cancel(); tabFx = null;
  });
}
function pill(r) {
  const shown = [...document.querySelectorAll(".tabs a")].filter(a => !a.hidden);
  $("#tabs").style.setProperty("--ti", Math.max(0, shown.findIndex(a => a.dataset.tab === r)));
}
const failed = r => `<div class="page">${header(TITLES[r])}<div class="empty"><b>The feeds did not answer.</b><span>Nothing is shown rather than something old.</span><button type="button" class="chip" data-act="retry">Try again</button></div></div>`;
const lastScores = new Map();
function draw(navigated) {
  const { r, sec } = parse(), changed = r !== S.route, prev = S.route;
  S.route = r;
  document.body.dataset.tab = r;
  const tabs = [...document.querySelectorAll(".tabs a")], nbaTab = tabs.find(a => a.dataset.tab === "nba");
  if (nbaTab && (Object.keys(D).length || r === "nba")) { nbaTab.hidden = !nbaOn() && r !== "nba"; try { localStorage.setItem("sport:nbaTab", nbaTab.hidden ? "0" : "1"); } catch {} }
  const shown = tabs.filter(a => !a.hidden);
  $("#tabs").style.setProperty("--n", shown.length);
  $("#tabs").style.setProperty("--ti", Math.max(0, shown.findIndex(a => a.dataset.tab === r)));
  for (const a of tabs) a.toggleAttribute("aria-current", a.dataset.tab === r) && a.setAttribute("aria-current", "page");
  $("#topTitle").textContent = TITLES[r];
  const html = !Object.keys(D).length && S.lastLoad && !S.loading ? failed(r) : pre && pre.r === r ? pre.html : VIEWS[r]();
  pre = null;
  const [pg, made] = pageFor(r, html);
  if (!made) morph(pg, html);
  if (prev && changed) pg.querySelector(".page")?.style.setProperty("animation", "none");
  for (const x of view.children) x.classList.toggle("away", x !== pg);
  sig = stateSig();
  // a score that changed since the last draw rolls in (once: the patch keeps the class until the roll ends)
  for (const el of cur().querySelectorAll("[data-sk]")) {
    const k = el.dataset.sk, v = el.dataset.v;
    if (v && lastScores.has(k) && lastScores.get(k) !== v) { el.classList.add("bump"); el.addEventListener("animationend", () => el.classList.remove("bump"), { once: true }); const lab = el.closest("[aria-label]")?.getAttribute("aria-label"), ev = events().find(x => k.startsWith(x.id)), g = ev?.ev?.filter(x => x.kind !== "red").at(-1); if (lab) say(`${g ? `Goal, ${last(g.player)} ${String(g.minute || "").replace(/'/g, "")} minutes. ` : "Score: "}${lab}`); }
    lastScores.set(k, v);
  }
  drawSheet();
  // where to be on the page: a section asked for in the link (once its content is in), else where this tab was left
  if (changed) {
    if (sec) pendingSec = sec;
    else window.scrollTo(0, scrollMem[r] || 0);
  }
  if (pendingSec) { const el = byId(pendingSec); if (el && !cur().querySelector(".skel")) { pendingSec = null; requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); } }
  document.title = `${TITLES[r]} · Sport`;
  observe();
}
// sheets sit in their own layer above the app, which goes inert behind them; a sheet already up is patched, not redrawn
function drawSheet() {
  const ev = UI.match ? events(true).find(x => x.id === UI.match) : null;
  if (UI.match && !ev) UI.match = null;
  const open = root.firstElementChild && !root.classList.contains("closing");
  if (ev) {
    const html = sheet(ev);
    if (open) morph(root, html);
    else {
      root.classList.remove("closing"); root.innerHTML = html;
      sheetFor = `[data-match="${CSS.escape(UI.match)}"]`;
      if (!history.state?.sheet) history.pushState({ sheet: true, day: UI.day || null }, "");
      requestAnimationFrame(() => $("#sheet-t")?.focus());
      dragSheet(root.querySelector(".sheet"));
    }
    $("#app").inert = true;
  } else if (open) startClose();
}
function startClose() {
  if (!root.firstElementChild || root.classList.contains("closing")) return;
  root.classList.add("closing"); $("#app").inert = false;
  const done = () => { if (root.classList.contains("closing")) { root.classList.remove("closing"); root.innerHTML = ""; } };
  if (RM()) done(); else { root.querySelector(".sheet")?.addEventListener("animationend", done, { once: true }); setTimeout(done, 400); }
  if (sheetFor) { cur().querySelector(sheetFor)?.focus({ preventScroll: true }); sheetFor = null; }
}
function observe() {
  io?.disconnect(); jio?.disconnect(); jcur = null;
  const chips = [...cur().querySelectorAll(".jump a[data-jump]")];
  const slide = (bar, left) => bar.scrollTo({ left, behavior: RM() ? "auto" : "smooth" });
  if (chips.length && "IntersectionObserver" in window) {
    const seen = new Map();
    jio = new IntersectionObserver(es => {
      for (const en of es) seen.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : null);
      if (atBottom()) return onBottom();
      const cur = [...seen].filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0]?.[0];
      if (cur === jcur) return; jcur = cur;
      for (const c of chips) { const on = c.dataset.jump === cur; c.toggleAttribute("aria-current", on); if (on) slide(c.parentElement, Math.max(0, c.offsetLeft - (c.parentElement.clientWidth - c.offsetWidth) / 2)); }
    }, { rootMargin: "-110px 0px -55% 0px" });
    for (const c of chips) { const el = byId(c.dataset.jump); if (el) jio.observe(el); }
    onBottom = () => { if (atBottom()) { const lastC = chips.at(-1); if (jcur !== lastC.dataset.jump) { jcur = lastC.dataset.jump; for (const c of chips) c.toggleAttribute("aria-current", c === lastC); slide(lastC.parentElement, lastC.parentElement.scrollWidth); } } };
  } else onBottom = () => {};
  const h1 = cur().querySelector("#h1");
  if (h1 && "IntersectionObserver" in window) { io = new IntersectionObserver(([en]) => $("#top").classList.toggle("solid", !en.isIntersecting), { rootMargin: "-56px 0px 0px 0px" }); io.observe(h1); }
}
addEventListener("hashchange", () => { const r = parse().r; vibe(); UI.match = null; UI.day = r === "home" ? history.state?.day || null : null; if (r === "home") fromHome = false; else if (S.route === "home") fromHome = true; render(true); });
// back: the sheet closes, then a chosen day goes back to today; a back across tabs is handled by hashchange
addEventListener("popstate", () => {
  const was = backPending; backPending = false;
  if (parse().r !== S.route) return;
  if (was && wantDay !== undefined) { const d = wantDay; wantDay = undefined; if (d) { UI.day = null; setTimeout(() => setDay(d), 0); } }
  const st = history.state || {};
  if (UI.match && !st.sheet) UI.match = null;
  UI.day = st.day || null;
  draw(false);
});
const closeSheet = () => { startClose(); if (history.state?.sheet) history.back(); else { UI.match = null; draw(false); } };
// one back at a time: a scrub across Today must never send two (two backs would leave the app)
let backPending = false, wantDay;
const setDay = v => {
  const d = v || null; if (backPending) { wantDay = d; return; } if (d === UI.day) return;
  if (!d) { UI.day = null; if (history.state?.day) { backPending = true; history.back(); } draw(false); return; }
  if (history.state?.day) history.replaceState({ day: d }, ""); else history.pushState({ day: d }, "");
  UI.day = d; vibe(5); draw(false);
};
// a tab: from Today it is a new history entry, from another tab it replaces the entry; the tab already shown scrolls
// to the top (and Today goes back to today)
$("#tabs").addEventListener("click", e => {
  const a = e.target.closest("a[data-tab]"); if (!a) return;
  e.preventDefault();
  if (a.dataset.tab === S.route && !UI.match) { vibe(); if (UI.day) setDay(null); window.scrollTo({ top: 0, behavior: RM() ? "auto" : "smooth" }); return; }
  go(a.getAttribute("href"));
});
function go(href) {
  vibe(); UI.match = null;
  if (S.route === "home" && !history.state?.sheet) { fromHome = true; location.hash = href; return; } // hashchange draws
  UI.day = null;
  if (href === "#home" && fromHome) { fromHome = false; history.back(); return; } // back to the Today entry, not a second one
  history.replaceState(null, "", href); render(true);
}
$("#refresh").addEventListener("click", () => { vibe(); loadAll(true); });

// ------------------------------------------------------------------ theme: light unless dark is chosen, kept on the phone
const setTheme = dark => {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("#themeColor")?.setAttribute("content", dark ? "#000000" : "#f3f3f5");
  const b = $("#theme"); b.setAttribute("aria-pressed", String(dark)); b.setAttribute("aria-label", "Dark mode");
  try { localStorage.setItem("sport-theme", dark ? "dark" : "light"); } catch {}
};
setTheme(document.documentElement.dataset.theme === "dark");
$("#theme").addEventListener("click", () => { vibe(); setTheme(document.documentElement.dataset.theme !== "dark"); draw(false); });

// ------------------------------------------------------------------ sheets: drag down to close, or flick
function dragSheet(el) {
  if (!el) return;
  const bg = root.querySelector(".sheet-bg");
  let y0 = null, dy = 0, prev = [0, 0], last = [0, 0];
  el.addEventListener("touchstart", e => { if (el.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; last = prev = [y0, performance.now()]; el.style.transition = "none"; }, { passive: true });
  el.addEventListener("touchmove", e => {
    if (y0 == null) return; const y = e.touches[0].clientY; dy = Math.max(0, y - y0);
    el.style.transform = dy ? `translateY(${dy}px)` : ""; if (bg) bg.style.opacity = String(Math.max(0, 1 - dy / (el.offsetHeight || 600)));
    prev = last; last = [y, performance.now()];
  }, { passive: true });
  el.addEventListener("touchend", e => {
    if (y0 == null) return; y0 = null;
    const v = performance.now() - last[1] < 80 ? (last[0] - prev[0]) / Math.max(1, last[1] - prev[1]) : 0; // px per ms at release
    el.style.transition = ""; if (bg) bg.style.opacity = "";
    if (dy > 120 || (dy > 24 && v > 0.45)) closeSheet(); else el.style.transform = "";
  }, { passive: true });
}
root.addEventListener("click", e => {
  if (e.target.closest("[data-close]")) return closeSheet();
  const tab = e.target.closest('a[href^="#"]:not([data-match])');
  if (tab) { e.preventDefault(); UI.match = null; UI.day = null; vibe(); history.replaceState(null, "", tab.getAttribute("href")); render(true); return; }
  const mt = e.target.closest("[data-match]"); if (mt) { e.preventDefault(); UI.match = mt.dataset.match; vibe(); draw(false); }
});
view.addEventListener("click", e => {
  if (e.target.closest("[data-act=retry]")) { vibe(); loadAll(true); return; }
  const b = e.target.closest("button[data-ui]");
  if (b) {
    const k = b.dataset.ui, v = b.dataset.v;
    if (k === "day") { setDay(v); if (!RM()) window.scrollTo({ top: 0, behavior: "smooth" }); else window.scrollTo(0, 0); return; }
    const sg = b.closest(".seg"); if (sg) sg.style.setProperty("--i", [...sg.querySelectorAll("button")].indexOf(b));
    UI[k] = v; vibe(); draw(false); return;
  }
  const mt = e.target.closest("[data-match]");
  if (mt) { e.preventDefault(); UI.match = mt.dataset.match; vibe(); draw(false); return; }
  const j = e.target.closest("a[data-jump]");
  if (j) { e.preventDefault(); const el = byId(j.dataset.jump); if (el) { el.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "start" }); history.replaceState(history.state, "", j.getAttribute("href")); } }
});
// scrub the days: drag along the rail (a tick on each day), or swipe the Today page sideways
{
  const days = () => [...cur().querySelectorAll(".rail .day:not(:disabled)")];
  let scrub = false;
  // the pill and the thumb start moving at the touch, not at the click
  view.addEventListener("pointerdown", e => {
    if (e.target.closest(".rail-in")) scrub = true;
    const d = e.target.closest(".rail .day:not(:disabled)"); if (d) { const all = [...d.parentElement.querySelectorAll(".day")]; d.parentElement.style.setProperty("--di", all.indexOf(d)); }
    const b = e.target.closest(".seg button"); if (b) b.parentElement.style.setProperty("--i", [...b.parentElement.querySelectorAll("button")].indexOf(b));
  });
  view.addEventListener("pointermove", e => {
    if (!scrub || e.pointerType === "mouse" && !e.buttons) return;
    const d = days().find(b => { const r = b.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
    if (d && !d.classList.contains("on")) setDay(d.dataset.v);
  });
  addEventListener("pointerup", () => { scrub = false; }); addEventListener("pointercancel", () => { scrub = false; });
  let sx = null, sy = 0;
  view.addEventListener("touchstart", e => { sx = S.route === "home" && !e.target.closest(".rail,.jump,.seg,.hscroll") ? e.touches[0].clientX : null; sy = e.touches[0].clientY; }, { passive: true });
  view.addEventListener("touchend", e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, ady = Math.abs(e.changedTouches[0].clientY - sy); sx = null;
    if (Math.abs(dx) < 70 || ady > 40) return;
    const all = [...cur().querySelectorAll(".rail .day")], i = all.findIndex(b => b.classList.contains("on"));
    for (let j = i + (dx < 0 ? 1 : -1); j >= 0 && j < all.length; j += dx < 0 ? 1 : -1) if (!all[j].disabled) { setDay(all[j].dataset.v); break; }
  }, { passive: true });
}
// pull to refresh (a home-screen web app on iPhone has none of its own)
{
  let y0 = null, pulled = 0; const ind = document.createElement("div"); ind.className = "ptr"; ind.setAttribute("aria-hidden", "true"); document.body.append(ind);
  addEventListener("touchstart", e => { y0 = window.scrollY <= 0 && !UI.match && !e.target.closest(".rail") ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
  addEventListener("touchmove", e => { if (y0 == null) return; pulled = Math.max(0, e.touches[0].clientY - y0); ind.style.setProperty("--p", Math.min(pulled / 70, 1)); ind.classList.toggle("on", pulled > 8); ind.classList.toggle("ready", pulled > 70); }, { passive: true });
  addEventListener("touchend", () => { if (y0 != null && pulled > 70) { vibe(); loadAll(true); } y0 = null; ind.classList.remove("on", "ready"); }, { passive: true });
}
addEventListener("scroll", () => onBottom(), { passive: true });
addEventListener("pointerdown", () => { document.body.dataset.input = "touch"; }, { passive: true });
addEventListener("keydown", () => { delete document.body.dataset.input; });
addEventListener("keydown", e => {
  if (e.key === "Escape" && UI.match) closeSheet();
  if (e.key === "Tab" && UI.match) {
    const f = [...root.querySelectorAll("a[href],button,[tabindex]")].filter(x => !x.disabled && x.offsetParent); if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && (document.activeElement === f.at(-1) || !root.contains(document.activeElement))) { e.preventDefault(); f[0].focus(); }
  }
});

// ------------------------------------------------------------------ time
// Countdowns tick every 20 seconds. Every 30 seconds: redraw if any event changed state (a session starting or
// finishing needs no reload to show), and reload every minute while something is live or about to start, else every
// five minutes, and on return to the app.
setInterval(() => { for (const el of document.querySelectorAll("[data-cd]")) { const v = rel(el.dataset.cd); if (el.textContent !== v) el.textContent = v; } }, 20000);
setInterval(() => {
  if (document.hidden) return;
  if (stateSig() !== sig) draw(false);
  const E = events(), hot = E.some(e => e.state === "live" || (e.state === "next" && Date.parse(e.start) - Date.now() < 15 * 6e4));
  if (Date.now() - S.lastLoad > (hot ? 60e3 : 300e3)) loadAll();
}, 30000);
// "Since you last looked" compares against what the phone saw when the app was last put away
document.addEventListener("visibilitychange", () => { if (document.hidden) { if (S.lastLoad) markSeen(events()); return; } sizeCheck(); if (Date.now() - S.lastLoad > 60e3) loadAll(); });
addEventListener("pagehide", () => { if (S.lastLoad) markSeen(events()); });
// very large text (Dynamic Type): capped at 21px; rows put the status above the names
const sizeCheck = () => {
  const h = document.documentElement; h.style.fontSize = "";
  const px = parseFloat(getComputedStyle(h).fontSize);
  if (px > 21) h.style.fontSize = "21px";
  document.body.classList.toggle("big", px > 19);
};
sizeCheck(); addEventListener("resize", sizeCheck);
{ const { r, sec } = parse(); if (sec) pendingSec = sec; if (location.hash && r === "home" && !/^#\/?home/.test(location.hash)) history.replaceState(null, "", "#home"); }
draw(true);
loadAll();
if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("/sport-sw.js", { scope: "/sport" }).catch(() => {});
export { D };
