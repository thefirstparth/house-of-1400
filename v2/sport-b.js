// Sport, round 3 (mock, 3 Oct 2026). Parth: "I don't want to remove any of the data that we currently have. I just
// want to present it better, where I don't have to scroll that much ... the images by the illustrator should still
// appear, the logos of the teams should still exist ... some things can be collapsed and still easy to navigate."
// Each variant is the real Sport desk as the site renders it, with its own pieces moved, never redrawn: every story,
// illustration, crest, table, leader board, market bar and source note is the same node the page made. Run in the page
// after the desk has rendered: R3("a" | "b" | "c").
(function () {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const ROOMS = [
    { id: "madrid", name: "Real Madrid", short: "Madrid", desk: "Madridismo", crest: 86, next: s => $$(":scope > div > .cols2", s).find(x => x.querySelector("table")) },
    { id: "paddock", name: "Formula 1", short: "F1", desk: "Paddock Notes", next: s => $(".f1top", s) },
    { id: "crease", name: "Cricket", short: "Cricket", desk: "The Crease", next: s => $(".cz-next", s) },
    { id: "deuce", name: "Tennis", short: "Tennis", desk: "Deuce", next: s => $$(".cols2", s).find(x => x.querySelector(".panel")) },
    { id: "pitch", name: "Football", short: "Football", desk: "The Wider Pitch", next: s => { const hd = $("h4.subhd", s); if (!hd) return null; const w = h("div", "r3-intl"); const t = hd.nextElementSibling; hd.before(w); w.append(hd); if (t) w.append(t); return w; } },
  ];
  const crest = id => `<img class="crest r3-crest" src="https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&h=80&w=80" width="26" height="26" alt="">`;
  // the parts of a section: its head, its stories (articles, briefs, lines), the market's view, the "next" block, the
  // F1 preview, and everything else (the tables, leader boards, results, sources), in the order the page had them
  function parts(room) {
    const s = document.getElementById(room.id); if (!s) return null;
    const head = $(".sechead", s), market = $(".signal-slot", s), next = room.next(s), preview = $(".f1p", s);
    const top = el => !el.parentElement.closest("article, .item");
    const stories = $$("article.story, article.lead-story, .item, ul.lines, .lines", s).filter(top);
    [head, market, next, preview, ...stories].forEach(x => x && x.remove());
    // what is left is data; drop the wrappers the moves emptied
    const prune = el => { for (const c of [...el.children]) prune(c); if (el !== s && !el.textContent.trim() && !el.querySelector("img,svg,table,canvas")) el.remove(); };
    prune(s);
    const rest = [...s.children];
    // the page styles a few of these by their section (#madrid .tbl, #deuce .tbl): they keep that as data-from
    [market, next, preview, ...rest].forEach(x => { if (x) x.dataset.from = room.id; });
    const sub = head?.querySelector("span")?.textContent.trim() || "";
    return { room, s, head, sub, market, next, preview, stories, rest };
  }
  // one line saying what a folded block holds, from its own text
  const gist = {
    madrid: P => [...(P.next?.querySelectorAll(".facts p") || [])].map(p => p.textContent.trim()).filter(t => /^(La Liga|Champions League)/.test(t)).join(" ") || "La Liga and the Champions League",
    paddock: P => (P.next?.querySelector(".facts p")?.textContent.trim() || "").split(". ")[0] + ".",
    crease: P => P.rest.map(x => x.querySelector?.("h4, h3, .cz-sname, b")?.textContent.trim()).filter(Boolean).slice(0, 3).join(" · "),
    deuce: P => "This week's events and draws",
    pitch: P => "More football",
  };
  const restTitle = { madrid: "La Liga and the Champions League: tables, top scorers, assists, ratings", paddock: "The championship, the last race and the races ahead", crease: "Every series: fixtures, results and the knockouts", deuce: "The tournaments", pitch: "More tables" };
  const fold = (title, sub, nodes, open = false, cls = "") => {
    const d = h("details", "r3-fold " + cls); if (open) d.open = true;
    d.append(h("summary", "", `<span class="t">${title}</span>${sub ? `<span class="g">${sub}</span>` : ""}<i aria-hidden="true"></i>`));
    const body = h("div", "r3-fbody"); nodes.filter(Boolean).forEach(n => body.append(n)); d.append(body); return d;
  };
  const label = (P, extra = "") => `<div class="r3-room-h"><div class="nm">${P.room.crest ? crest(P.room.crest) : ""}<b>${P.room.name}</b><span>${P.room.desk}${P.sub ? ` · ${P.sub}` : ""}</span></div>${extra}</div>`;

  window.R3 = function (v) {
    const main = $("#main"), dopen = $("header.dopen", main); if (!main || !dopen) return;
    const side = document.getElementById("sidelines"), fx = document.getElementById("fixtures");
    const lead = side && $("article.lead-story, article.story", side), agenda = fx && $(".agenda", fx);
    const sideRest = side ? $$("article, .item", side).filter(x => x !== lead) : [];
    const P = ROOMS.map(parts).filter(Boolean);
    const box = h("div", `r3 r3-${v}`); dopen.after(box);
    const jump = $("nav.jump", dopen);

    if (v === "a") {
      // A · The paper, then the scoreboard: one page in three parts with a pinned contents line. The stories first, as
      // a newspaper sets them (the lead across, the rest in two columns, briefs in three); then Next up (the week's
      // fixtures and each team's next match with the market's view); then every table, folded, each saying in one
      // line what it holds.
      const nav = h("nav", "r3-nav", `<a href="#r3-stories">The stories</a><a href="#r3-next">Next up</a><a href="#r3-tables">Tables and results</a><span class="sep"></span>${P.map(p => `<a href="#r3-t-${p.room.id}">${p.room.short}</a>`).join("")}<button type="button" data-r3-all>Open every table</button>`);
      box.append(nav);
      const st = h("section", "r3-part", `<h2 class="r3-h" id="r3-stories">The stories</h2>`);
      if (lead) { const L = h("div", "r3-lead" + (v === "a" ? " dlead" : "")); L.append(lead); st.append(L); }
      const arts = [], briefs = [];
      for (const p of P) { if (p.preview) arts.push(p.preview); for (const x of p.stories) (x.matches("article") ? arts : briefs).push(x); }
      for (const x of sideRest) (x.matches("article") ? arts : briefs).push(x);
      const g = h("div", "r3-grid"); arts.forEach(x => g.append(x)); st.append(g);
      if (briefs.length) { const b = h("div", "r3-briefs"); briefs.forEach(x => b.append(x)); st.append(b); }
      box.append(st);
      const nx = h("section", "r3-part", `<h2 class="r3-h" id="r3-next">Next up</h2>`);
      if (agenda) nx.append(fold("The Fixture List", "Next 7 days, IST", [agenda], true, "r3-agenda"));
      const cards = h("div", "r3-cards");
      for (const p of P) { const c = h("div", "r3-card", label(p)); if (p.next) c.append(p.next); if (p.market) c.append(p.market); cards.append(c); }
      nx.append(cards); box.append(nx);
      const tb = h("section", "r3-part", `<h2 class="r3-h" id="r3-tables">Tables and results</h2>`), cols = h("div", "r3-folds");
      for (const p of P) if (p.rest.length) { const f = fold(`<b>${p.room.name}</b> ${restTitle[p.room.id]}`, gist[p.room.id](p), p.rest, false); f.id = `r3-t-${p.room.id}`; cols.append(f); }
      tb.append(cols); box.append(tb);
    }

    if (v === "b") {
      // B · Team rooms: after the day's lead and the week, a room for each team. The room's head carries the team, its
      // standing and the market's view; the room is the team's stories on the left and, on the right, what is next
      // for it, with everything else (tables, leaders, results) in a drawer under it, folded, saying what it holds.
      const top = h("div", "r3-top"); if (lead) { const L = h("div", "r3-lead" + (v === "a" ? " dlead" : "")); L.append(lead); top.append(L); }
      if (agenda) { const w = h("aside", "r3-week", `<h3 class="r3-k">The Fixture List <span>Next 7 days, IST</span></h3>`); w.append(agenda); top.append(w); }
      box.append(top);
      const nav = h("nav", "r3-nav r3-chips", P.map(p => `<a href="#r3-r-${p.room.id}">${p.room.crest ? crest(p.room.crest) : ""}${p.room.short}<small>${p.stories.length + (p.preview ? 1 : 0)}</small></a>`).join(""));
      box.append(nav);
      for (const p of P) {
        const r = h("section", "r3-room", label(p)); r.id = `r3-r-${p.room.id}`;
        if (p.market) r.querySelector(".r3-room-h").append(p.market);
        const body = h("div", "r3-room-b"), news = h("div", "r3-news"), data = h("div", "r3-data");
        if (p.preview) news.append(p.preview); p.stories.forEach(x => news.append(x));
        if (!news.children.length) news.append(h("p", "r3-quiet", "No story today; the figures are on the right."));
        if (p.next) data.append(h("h4", "r3-k", "Next"), p.next);
        if (p.rest.length) data.append(fold(restTitle[p.room.id], gist[p.room.id](p), p.rest, false, "r3-drawer"));
        body.append(news, data); r.append(body); box.append(r);
      }
      if (sideRest.length) { const r = h("section", "r3-room", `<div class="r3-room-h"><div class="nm"><b>The Sidelines</b><span>Every other sport</span></div></div>`), n = h("div", "r3-news r3-wide"); sideRest.forEach(x => n.append(x)); r.append(n); box.append(r); }
    }

    if (v === "c") {
      // C · Two panes: the news on the left, read top to bottom, each team's stories under a slim head with its next
      // match and the market's view; on the right a pinned panel with every figure, a tab per team (and the week), which
      // follows the story you are reading. On a phone the panel opens from the foot of each team's stories.
      const grid = h("div", "r3-panes"), left = h("div", "r3-left"), rail = h("aside", "r3-rail");
      if (lead) { const L = h("div", "r3-lead" + (v === "a" ? " dlead" : "")); L.append(lead); left.append(L); }
      const tabs = h("div", "r3-tabs"), pans = h("div", "r3-pans");
      tabs.setAttribute("role", "tablist");
      const addPan = (id, name, nodes, crestId) => {
        tabs.append(h("button", "", `${crestId ? crest(crestId) : ""}${name}`)); tabs.lastChild.dataset.r3tab = id; tabs.lastChild.type = "button";
        const pan = h("div", "r3-pan"); pan.dataset.r3pan = id; nodes.filter(Boolean).forEach(n => pan.append(n)); pans.append(pan);
      };
      if (agenda) addPan("week", "This week", [h("h3", "r3-k", "The Fixture List <span>Next 7 days, IST</span>"), agenda]);
      for (const p of P) {
        const g = h("section", "r3-group", label(p)); g.dataset.r3room = p.room.id;
        if (p.market) g.append(p.market);
        if (p.preview) g.append(p.preview); p.stories.forEach(x => g.append(x));
        const btn = h("button", "r3-open", `${p.room.short}: next, tables and results <span aria-hidden="true">→</span>`); btn.type = "button"; btn.dataset.r3show = p.room.id; g.append(btn);
        left.append(g);
        addPan(p.room.id, p.room.short, [p.next && h("h4", "r3-k", "Next"), p.next, ...(p.rest.length ? [h("h4", "r3-k", restTitle[p.room.id].split(":")[0]), ...p.rest] : [])], p.room.crest);
      }
      if (sideRest.length) { const g = h("section", "r3-group", `<div class="r3-room-h"><div class="nm"><b>The Sidelines</b><span>Every other sport</span></div></div>`); sideRest.forEach(x => g.append(x)); left.append(g); }
      rail.append(tabs, pans); grid.append(left, rail); box.append(grid);
      const close = h("button", "r3-close", "Close"); close.type = "button"; close.dataset.r3close = ""; rail.prepend(close);
    }

    // the old sections, now empty, and the old in-page contents go
    for (const id of ["sidelines", "fixtures", ...ROOMS.map(r => r.id)]) document.getElementById(id)?.remove();
    if (jump) jump.remove();
    window.R3run?.();
  };
})();

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

// Preview only (branch sport-b-preview, never main): Sport as team rooms, option B of design/sport-r3, applied to the
// real desk each time it renders. Every story, illustration, crest, table and figure is the page's own node, moved.
(function () {
  let busy = false;
  const apply = () => {
    if (busy || typeof DESK === "undefined" || DESK.id !== "sport") return;
    const main = document.getElementById("main"); if (!main || main.querySelector(".r3") || !document.getElementById("madrid")) return;
    busy = true;
    try { const pin = document.querySelector("nav.dtabs"); document.documentElement.style.setProperty("--r3pin", pin && getComputedStyle(pin).position === "sticky" ? pin.offsetHeight + "px" : "0px"); window.R3("b"); }
    finally { busy = false; }
  };
  new MutationObserver(() => requestAnimationFrame(apply)).observe(document.documentElement, { childList: true, subtree: true });
})();
