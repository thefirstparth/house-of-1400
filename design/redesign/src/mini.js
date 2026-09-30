// Just enough behaviour for the static mock: the desk bar follows the page, Night mode, Read more, the
// Madridismo tabs and "more" buttons, and At a Glance links.
(function () {
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function setDesk(id) {
    $$("#idx .dtabs a").forEach(function (a) { a.classList.toggle("cur", a.getAttribute("data-d") === id); });
    $$("#idx .dchips").forEach(function (c) { c.hidden = c.getAttribute("data-d") !== id; });
  }
  setDesk("front");
  try {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) setDesk(en.target.id.replace(/^dg-/, "")); }); }, { rootMargin: "-30% 0px -65% 0px" });
    $$(".dgroup").forEach(function (g) { io.observe(g); });
    addEventListener("scroll", function () { var f = document.querySelector(".dgroup:not(#dg-front)"); if (f && scrollY < f.offsetTop - innerHeight * 0.3) setDesk("front"); }, { passive: true });
  } catch (e) {}
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button,a"); if (!t) return;
    if (t.id === "themeBtn") { var r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches); r.setAttribute("data-theme", dk ? "light" : "dark"); return; }
    var d = t.dataset;
    if (d.go) { var el = document.getElementById("s-" + d.go) || document.getElementById(d.go); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (d.more) { var m = document.getElementById("more-" + d.more); if (m) { m.hidden = !m.hidden; t.textContent = m.hidden ? "Read more" : "Read less"; } return; }
    if (d.comp) { $$(".comps [data-comp]").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.comp === d.comp); }); $$(".comps .cpan").forEach(function (p) { p.hidden = p.id !== "cpan-" + d.comp; }); return; }
    if (d.lmore) { var box = t.closest(".ldr"), open = t.getAttribute("aria-expanded") !== "true"; $$("li.x", box).forEach(function (li) { li.hidden = !open; }); t.setAttribute("aria-expanded", open); t.textContent = open ? "Show fewer" : $$("li.x", box).length + " more"; return; }
    if (d.tmore) { var w = t.parentElement, tb = w.querySelector("table.liga"), op = t.getAttribute("aria-expanded") !== "true"; tb.classList.toggle("open", op); $$("tr.x", tb).forEach(function (r) { r.hidden = !op; }); var z = w.querySelector(".zones"); if (z) z.hidden = !op; t.setAttribute("aria-expanded", op); t.textContent = op ? "Top 7 only" : "Full table, all " + t.dataset.n; return; }
  });
})();
