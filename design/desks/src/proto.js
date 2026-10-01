// ================================================================ DESK PAGE MOCK (design/sport, not production)
// A thin layer over the live renderer: every section is drawn by the paper's own functions from the real edition and
// live data; only the page around them changes (one-line masthead, desk tabs, the desk's sections in order, the next
// desk). Desks, names and colours as agreed on 1 Oct (docs/HANDOVER.md 7.1); in production they come from config desks.
const NEWDESKS = [
  { id: "one", name: "Page One", href: "/", sections: [] },
  { id: "news", name: "News", href: "/news", sections: ["desh", "videsh", "dateline", "talk", "betting"] },
  { id: "home", name: "Close to Home", href: "/close-to-home", sections: ["namma", "sky"] },
  { id: "sport", name: "Sport", href: "/sport", sections: ["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"] },
  { id: "tech", name: "Tech & AI", href: "/tech", sections: ["ai", "tech", "sales", "workshop", "pipeline"] },
  { id: "money", name: "Money", href: "/money", sections: ["ledger"] },
  { id: "off", name: "Off Duty", href: "/off-duty", sections: ["screen", "bye"] },
];
const DESK = NEWDESKS.find(d => d.id === (window.MOCK_DESK || "sport"));
const deskOf = id => NEWDESKS.find(d => d.sections.includes(id));

// Mock only: Dateline as Desh (India) and Videsh (the world), by the story's own kicker ("India · Courts", "World ·
// Aviation"). In production Bhide files each story to its section (a schema change for Parth to agree).
function splitDateline() {
  if (splitDateline.done) return; splitDateline.done = true;
  for (const [id, name] of [["desh", "Desh"], ["videsh", "Videsh"]]) if (!CFG.sections.some(s => s.id === id)) CFG.sections.push({ id, name, short: name, accent: "--ink", palette: "ink" });
  const to = x => (/^India\b/i.test(x.kicker || "") ? "desh" : "videsh");
  const F = E.front || {};
  for (const x of [F.lead, ...(F.seconds || []), ...(F.briefs || [])]) if (x?.section === "dateline") x.section = to(x);
  const D = E.sections?.dateline; if (!D) return;
  for (const k of ["stories", "briefs", "lines"]) for (const x of D[k] || []) { const id = to(x); ((E.sections[id] ||= {})[k] ||= []).push({ ...x, section: id }); }
  delete E.sections.dateline;
}

// The lead runs at the top of its own desk, its 16:9 drawing beside it (no art on Page One).
const leadHere = () => !!E.front?.lead && deskOf(E.front.lead.section) === DESK;
function deskLead() { return leadHere() ? `<div class="dlead">${storyHTML(E.front.lead, { lead: true })}</div>` : ""; }

// The front page's stories are printed once more in their own section, at the top, in the front's order: Page One
// carries only their headlines (presentation only; the edition is unchanged).
function frontItems(id, kind) {
  const F = E.front || {};
  const st = [leadHere() ? null : F.lead, ...(F.seconds || [])].filter(x => x?.section === id);
  return kind === "story" ? st : (F.briefs || []).filter(x => x?.section === id);
}

// The one-line masthead for a desk page: the nameplate, Bengaluru now, the Sensex.
function paintShell() {
  const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value, ix = M?.indices?.[0];
  const sky = w?.current ? `<a href="/close-to-home#sky"><span class="k">${esc(CFG.paper.home_city)}</span> <b class="tnum">${Math.round(w.current.temp)}°</b> ${esc(wx(w.current.code)[1].toLowerCase())}</a>` : "";
  const mk = ix ? `<a href="/money#ledger"><span class="k">${esc(ix.name)}</span> <b class="tnum">${inr(ix.price, 0)}</b> <span class="tnum ${dir(ix.change_pct)}">${pct(ix.change_pct)}</span></a>` : "";
  const html = sky + mk;
  const el = $("#now"); if (el && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
}
function shellStatic() {
  const printed = E.printed_at;
  $("#r-date").textContent = longDate(E.date);
  $("#r-no").textContent = `No. ${E.edition_no}`;
  $("#r-print").textContent = printed ? `Printed ${istTime(printed)} IST` : "";
  $("#r-tag").innerHTML = `${esc(CFG.paper.motto)} · edited by <a href="/editor">${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</a>`;
  $("#dtabs ol").innerHTML = NEWDESKS.map(d => `<li><a href="${d.href}" style="--c:var(--d-${d.id})"${d === DESK ? ' aria-current="page"' : ""}>${esc(d.name)}</a></li>`).join("");
  // On a phone the tabs scroll sideways: the current desk is brought to the middle of the row (the row only).
  // Its edges fade where there is more to scroll to, so it reads as a row that moves.
  const ol = $("#dtabs ol"), fade = () => { ol.classList.toggle("more-l", ol.scrollLeft > 2); ol.classList.toggle("more-r", ol.scrollLeft + ol.clientWidth < ol.scrollWidth - 2); };
  ol.addEventListener("scroll", fade, { passive: true }); addEventListener("resize", fade);
  requestAnimationFrame(() => { const a = ol.querySelector("[aria-current]"); if (a && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = a.parentElement.offsetLeft - (ol.clientWidth - a.parentElement.offsetWidth) / 2; fade(); });
  document.title = `${DESK.name} · The House of 1400 · ${longDate(E.date)}`;
  document.documentElement.style.setProperty("--d", `var(--d-${DESK.id})`);
}
function deskOpener() {
  splitDateline();
  shellStatic();
  return `<header class="dopen"><h1>${esc(DESK.name)}</h1><nav class="jump" id="jump" aria-label="In ${esc(DESK.name)}"></nav></header>${deskLead()}`;
}
// The section index is only a jump list: the sections that are printed today, in page order.
function paintJump() {
  const el = $("#jump"); if (!el) return;
  const ids = DESK.sections.filter(id => { const s = document.getElementById(id); return s && !s.hidden; });
  el.innerHTML = ids.map(id => `<a href="#${id}">${esc(sec(id).name)}</a>`).join("");
}
function deskFoot() {
  const i = NEWDESKS.indexOf(DESK), nx = NEWDESKS[(i + 1) % NEWDESKS.length];
  return `<div class="nextdesk"><a href="${nx.href}" style="--c:var(--d-${nx.id})">Next: <b>${esc(nx.name)}</b> →</a></div>
<footer class="dfoot"><nav><a href="/#desk">Your Desk</a><a href="/#letters">Letters</a><a href="/editor">The editor</a><a href="/archive">Archive</a></nav>
<span>${esc(`The House of 1400 · ${longDate(E.date)} · No. ${E.edition_no}`)}</span></footer>`;
}
function desksHTML(S) { return DESK.sections.map(id => S[id] || "").join(""); }

// An image that cannot load leaves no box behind (Parth: no unexplained white space). A club crest just goes; F1's
// circuit map goes and the column it leaves is taken by Max Watch and the notes, as on a weekend with no map yet.
document.addEventListener("error", e => {
  const img = e.target; if (!(img instanceof HTMLImageElement)) return;
  if (img.classList.contains("crest")) { img.remove(); return; }
  const fig = img.closest(".f1-track"); if (!fig) return;
  const top = fig.closest(".f1top"), col = fig.parentElement; fig.remove();
  const facts = top?.querySelector(".facts"), left = top?.firstElementChild;
  if (top && facts && col && col !== left) { const unit = facts.parentElement !== left ? facts.parentElement : facts; unit.style.marginTop = ""; col.append(unit); }
  else if (top && col && !col.children.length) { col.remove(); top.classList.remove("cols2"); }
}, true);
