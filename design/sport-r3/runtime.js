// The mock's behaviour: C's panel tabs, its follow-the-story panel and its phone sheet, A's "open every table". In the
// baked preview (no app script) it also does what the page's own script does for the desk: the competition tabs, the
// championship tabs, "show more" and "full story".
(function () {
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let picked = 0;
  function show(id, byHand) {
    if (byHand) picked = Date.now();
    $$("[data-r3tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.r3tab === id));
    $$("[data-r3pan]").forEach(p => { p.hidden = p.dataset.r3pan !== id; });
    const pans = document.querySelector(".r3-pans"); if (pans && byHand) pans.scrollTop = 0;
  }
  window.R3run = function () {
    const first = document.querySelector("[data-r3tab]"); if (!first) return;
    show(document.querySelector("[data-r3room]")?.dataset.r3room || first.dataset.r3tab);
    // the panel follows the team whose stories are in view, unless a tab was chosen in the last few seconds
    const io = new IntersectionObserver(es => {
      if (Date.now() - picked < 4000 || matchMedia("(max-width: 860px)").matches) return;
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) show(vis.target.dataset.r3room);
    }, { rootMargin: "-30% 0px -55% 0px" });
    $$("[data-r3room]").forEach(g => io.observe(g));
  };
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.r3tab) { show(t.dataset.r3tab, true); return; }
    if (t.dataset.r3show != null) { show(t.dataset.r3show, true); document.documentElement.classList.add("r3-sheet"); return; }
    if (t.dataset.r3close != null) { document.documentElement.classList.remove("r3-sheet"); return; }
    if (t.dataset.r3all != null) { const all = $$(".r3-fold"), open = !all.every(d => d.open); all.forEach(d => { d.open = open; }); t.textContent = open ? "Fold every table" : "Open every table"; return; }
    if (!window.R3_STATIC) return;
    if (t.dataset.comp) { const c = t.closest(".comps"); $$("[data-comp]", c).forEach(b => b.setAttribute("aria-selected", b === t)); $$(".cpan", c).forEach(p => { p.hidden = p.id !== "cpan-" + t.dataset.comp; }); return; }
    if (t.dataset.f1board) { $$("[data-f1board]").forEach(b => b.setAttribute("aria-selected", b === t)); $$(".f1-pan").forEach(p => { p.hidden = p.id !== "f1p-" + t.dataset.f1board; }); return; }
    if (t.dataset.lmore) { const box = t.parentElement, open = t.getAttribute("aria-expanded") !== "true"; $$("li.x, tr.x", box).forEach(x => { x.hidden = !open; }); t.setAttribute("aria-expanded", open); t.dataset.was = t.dataset.was || t.textContent; t.textContent = open ? "Show fewer" : t.dataset.was; return; }
    if (t.dataset.more) { const m = document.getElementById("more-" + t.dataset.more); if (m) { m.hidden = !m.hidden; t.setAttribute("aria-expanded", !m.hidden); t.textContent = m.hidden ? "Full story" : "Less"; } return; }
  });
  if (window.R3_STATIC) addEventListener("DOMContentLoaded", () => window.R3run());
})();
