// ================================================================ THE NEW DESIGN, FULL SAMPLE (design/sample, not production)
// The paper's own renderer (public/app.js) draws every section from today's edition and its press-time figures; this
// layer adds the page around them as agreed on 1 Oct: Page One B with the halftone wordmark, six desk pages behind one
// row of tabs, the day's lead at the top of its desk, and a red-pencil note under every part for Parth's review.
const NEWDESKS = [
  { id: "one", name: "Page One", sections: [] },
  { id: "news", name: "News", sections: ["desh", "videsh", "dateline", "talk", "betting"] },
  { id: "home", name: "Close to Home", sections: ["namma", "sky"] },
  { id: "sport", name: "Sport", sections: ["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"] },
  { id: "tech", name: "Tech & AI", sections: ["ai", "tech", "sales", "workshop", "pipeline"] },
  { id: "money", name: "Money", sections: ["ledger"] },
  { id: "off", name: "Off Duty", sections: ["screen", "bye"] },
];
let DESK = NEWDESKS.find(d => location.hash === `#d-${d.id}`) || NEWDESKS[0];
const deskOf = id => NEWDESKS.find(d => d.sections.includes(id));
const deskHref = id => `#d-${id}`;
const realNow = () => (window.__realNow ? window.__realNow() : Date.now());

// ---------------------------------------------------------------- today's stories in the new sections (Parth: by label)
// From 2 Oct Bhide files Desh, Videsh, AI, Tech and Sales & SaaS himself; today's paper predates that, so its stories
// are sorted by their own labels: "India · ..." to Desh, the rest of Dateline to Videsh; The Workshop's AI stories to
// AI and the rest to Tech; The Pipeline to Sales & SaaS.
const AI_RE = /^AI\b|\bAI\b|artificial intelligence|OpenAI|Anthropic|Claude|Gemini|ChatGPT|\bLLM|DeepMind|chatbot|\bagents?\b|model/i;
function refile() {
  if (refile.done) return; refile.done = true;
  const to = { dateline: x => (/^India\b/i.test(x.kicker || "") ? "desh" : "videsh"), workshop: x => (AI_RE.test(`${x.kicker || ""} ${x.headline || ""}`) ? "ai" : "tech"), pipeline: () => "sales" };
  const F = E.front || {};
  for (const x of [F.lead, ...(F.seconds || []), ...(F.briefs || [])]) if (x && to[x.section]) x.section = to[x.section](x);
  for (const from of Object.keys(to)) {
    const S = E.sections?.[from]; if (!S) continue;
    for (const k of ["stories", "briefs", "lines"]) for (const x of S[k] || []) { const id = to[from](x); ((E.sections[id] ||= {})[k] ||= []).push(k === "lines" ? x : { ...x, section: id }); }
    delete E.sections[from];
  }
}

// ---------------------------------------------------------------- desks: the lead, front stories, the shell
const leadHere = () => !!E.front?.lead && deskOf(E.front.lead.section) === DESK;
function deskLead() { return leadHere() ? `<div class="dlead">${storyHTML(E.front.lead, { lead: true })}</div>` : ""; }
// The front page's stories print at the top of their own section, in the front's order; Page One carries only headlines.
function frontItems(id, kind) {
  const F = E.front || {};
  const st = [leadHere() ? null : F.lead, ...(F.seconds || [])].filter(x => x?.section === id);
  return kind === "story" ? st : (F.briefs || []).filter(x => x?.section === id);
}
function paintShell() {
  const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value, ix = M?.indices?.[0];
  const sky = w?.current ? `<a href="${deskHref("home")}" data-desk="home" data-to="sky"><span class="k">${esc(CFG.paper.home_city)}</span> <b class="tnum">${Math.round(w.current.temp)}°</b> ${esc(wx(w.current.code)[1].toLowerCase())}</a>` : "";
  const mk = ix ? `<a href="${deskHref("money")}" data-desk="money" data-to="ledger"><span class="k">${esc(ix.name)}</span> <b class="tnum">${inr(ix.price, 0)}</b> <span class="tnum ${dir(ix.change_pct)}">${pct(ix.change_pct)}</span></a>` : "";
  const html = sky + mk, el = $("#now");
  if (el && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  if (DESK.id === "one") paintOne();
}
let tagline = "";
function shellStatic() {
  $("#r-date").textContent = longDate(E.date);
  $("#r-no").textContent = `No. ${E.edition_no}`;
  $("#r-print").textContent = E.printed_at ? `Printed ${istTime(E.printed_at)} IST` : "";
  tagline = `${esc(CFG.paper.motto)} · edited by ${esc(CFG.paper.editor.signature.replace(", Editor", ""))}`;
  $("#r-tag").innerHTML = tagline;
  $("#dtabs ol").innerHTML = NEWDESKS.map(d => `<li><a href="${deskHref(d.id)}" data-desk="${d.id}" style="--c:var(--d-${d.id})"${d === DESK ? ' aria-current="page"' : ""}>${esc(d.name)}</a></li>`).join("");
  const ol = $("#dtabs ol"), fade = () => { ol.classList.toggle("more-l", ol.scrollLeft > 2); ol.classList.toggle("more-r", ol.scrollLeft + ol.clientWidth < ol.scrollWidth - 2); };
  if (!ol.dataset.wired) { ol.dataset.wired = 1; ol.addEventListener("scroll", fade, { passive: true }); addEventListener("resize", fade); }
  requestAnimationFrame(() => { const a = ol.querySelector("[aria-current]"); if (a && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = a.parentElement.offsetLeft - (ol.clientWidth - a.parentElement.offsetWidth) / 2; fade(); });
  document.title = `${DESK.id === "one" ? "" : DESK.name + " · "}The House of 1400 · ${longDate(E.date)}`;
  document.documentElement.style.setProperty("--d", `var(--d-${DESK.id})`);
  document.body.classList.toggle("on-one", DESK.id === "one");
}
function deskOpener() {
  refile(); shellStatic();
  if (DESK.id === "one") return pageOne();
  return `<header class="dopen"><h1>${esc(DESK.name)}</h1><nav class="jump" id="jump" aria-label="In ${esc(DESK.name)}"></nav></header>${deskLead()}`;
}
function paintJump() {
  const el = $("#jump"); if (!el) return;
  const ids = DESK.sections.filter(id => { const s = document.getElementById(id); return s && !s.hidden; });
  const h = ids.map(id => `<a href="#${id}" data-go="${id}">${esc(sec(id).name)}</a>`).join("");
  if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; }
}
function deskFoot() {
  if (DESK.id === "one") return oneFoot();
  const i = NEWDESKS.indexOf(DESK), nx = NEWDESKS[(i + 1) % NEWDESKS.length];
  return Notes.box(`${DESK.id}.desk`, `The ${DESK.name} desk as a whole`, "deskbox") +
    `<div class="nextdesk"><a href="${deskHref(nx.id)}" data-desk="${nx.id}" style="--c:var(--d-${nx.id})">Next: <b>${esc(nx.name)}</b> →</a></div>` + footLine();
}
const footLine = () => `<footer class="dfoot"><nav><a href="#d-one" data-desk="one" data-note="Your Desk stays out of this sample: it is private (Gmail and Calendar).">Your Desk</a><a href="#d-one" data-desk="one">Letters</a><a href="#d-one" data-desk="one">The editor</a><a href="#d-one" data-desk="one">Archive</a></nav><span>${esc(`The House of 1400 · ${longDate(E.date)} · No. ${E.edition_no}`)}</span></footer>`;
function desksHTML(S) { return DESK.sections.map(id => S[id] || "").join(""); }

// ---------------------------------------------------------------- Page One (variant B, design/page-one/README.md FINAL)
const P1MAX = 9; let p1lines = P1MAX;
const storyDesk = id => { const s = allStories().find(x => x.id === id); return s ? deskOf(s.section)?.id : null; };
function minuteHTML(n) {
  const L = E.front.lead, ld = deskOf(L.section)?.id || "news";
  const items = (E.glance || []).filter(g => g.target !== L.id).slice(0, n);
  const note = E.editor_note ? `<div class="ednote"><b>From the editor</b>${esc(E.editor_note)}<i>${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</i></div>` : "";
  return `<a class="leadh" href="${deskHref(ld)}" data-desk="${ld}" data-to="s-${esc(L.id)}" style="--c:var(--d-${ld})"><span class="lab">${esc(L.kicker || "Lead")}</span><h3>${esc(L.headline)}</h3></a>${note}
<ol class="min">${items.map(g => { const d = storyDesk(g.target) || "news"; return `<li><a href="${deskHref(d)}" data-desk="${d}" data-to="s-${esc(g.target)}" style="--c:var(--d-${d})"><span class="lab">${esc(g.section)}</span><b>${esc(g.line)}</b></a></li>`; }).join("")}</ol>`;
}
function eveningHTML() {
  const s = (E.screen || []).find(x => x.verdict === "must" && !x.coming_soon); if (!s) return "";
  return `<a class="pick" href="${deskHref("off")}" data-desk="off" data-to="screen" style="--c:var(--d-off)"><span class="v">Must watch</span><b>${esc(s.title)}</b><p>${esc([s.where, s.release].filter(Boolean).join(" · "))}. ${esc(String(s.reason || "").split(". ")[0])}.</p></a>`;
}
const when1 = iso => { const n = Math.round((Date.parse(istDate(new Date(iso))) - Date.parse(istDate())) / 864e5); return `${n === 0 ? "today" : n === 1 ? "tomorrow" : istDay(iso)}, ${istTime(iso)}`; };
function sportHTML(max = 5) {
  const rows = [], C = LIVE.crease?.value, F = LIVE.football?.value, T = LIVE.tennis_players?.value?.players || [], f1 = LIVE.f1_next?.value?.race, n = Date.now();
  const on = w => (w ? ` · ${esc(w)}` : "");
  const cz = C?.today?.state === "live" ? C.today : C?.next;
  if (cz) rows.push(["Cricket", `India v ${cz.opponent} · ${cz.desc}`, cz.state === "live" ? `<span class="live">In play</span>${cz.score ? ` ${esc(cz.score)}` : ""}` : `${when1(cz.start)}${on(watchOn({ entity: "cricket", label: `India v ${cz.opponent}`, when_utc: cz.start }))}`]);
  const m = F?.next?.[0];
  if (m && Date.parse(m.date) - n < 14 * 864e5) rows.push(["Madrid", `${m.home ? "v" : "at"} ${m.opponent}`, `${esc(m.competition)} · ${m.time_confirmed ? when1(m.date) : istDay(m.date)}${on(watchOn({ competition: m.competition, label: m.name }))}`]);
  const race = f1?.sessions?.at(-1);
  if (race && Date.parse(race.start) + race.minutes * 6e4 > n) rows.push(["F1", `${f1.name.replace(/ in [A-Z][a-z]+$/, "")}${f1.locality ? `, ${f1.locality}` : ""}`, `Race ${when1(race.start)}${on(watchOn({ entity: "f1" }))}`]);
  for (const p of T) {
    const nx = p.next, nm = lastName(p.name);
    if (!nx?.when_utc) continue;
    rows.push(["Tennis", `${nm} v ${nx.opponent || "TBC"}`, `${nx.live ? `<span class="live">On court</span>` : when1(nx.when_utc)}${on(watchOn({ entity: "tennis", label: `${nm} v ${nx.opponent}`, event: nx.event }))}`]);
  }
  return rows.length ? `<ul class="rows">${rows.slice(0, max).map(([l, t, s]) => `<li><span class="lab">${l}</span><span><b>${esc(t)}</b>${s}</span></li>`).join("")}</ul>` : "";
}
function weatherHTML() {
  const W = LIVE.weather?.value?.cities, c = W?.[0]; if (!c?.current) return "";
  const d0 = (c.daily || [])[0] || {}, off = c.utc_offset_seconds ?? 19800, n = Date.now();
  const rise = localMs(d0.sunrise, off), set = localMs(d0.sunset, off), DAY = 864e5;
  let arc = "";
  if (Number.isFinite(rise) && Number.isFinite(set)) {
    const day = n >= rise && n < set, from = day ? rise : n >= set ? set : set - DAY, to = day ? set : n >= set ? rise + DAY : rise;
    const f = Math.max(0, Math.min(1, (n - from) / (to - from)));
    const X = t => 14 + 192 * (0.5 - 0.5 * Math.cos(Math.PI * t)), Y = t => 52 - 40 * Math.sin(Math.PI * t), pts = k => [...Array(k + 1)].map((_, i) => `${X(i / k * f).toFixed(1)},${Y(i / k * f).toFixed(1)}`).join(" ");
    const full = [...Array(41)].map((_, i) => `${X(i / 40).toFixed(1)},${Y(i / 40).toFixed(1)}`).join(" "), x = X(f).toFixed(1), y = Y(f).toFixed(1);
    let body;
    if (day) body = `<circle cx="${x}" cy="${y}" r="9" fill="var(--halo)"/><circle cx="${x}" cy="${y}" r="5.5" fill="var(--sun)"/>`;
    else { const mm = moonNow(n), r = 6, rx = (r * Math.abs(1 - 2 * mm.lit)).toFixed(2), sweep = mm.lit > 0.5 ? 1 : 0;
      body = `<circle cx="${x}" cy="${y}" r="9" fill="var(--mhalo)"/><g transform="translate(${x} ${y})${mm.waxing ? "" : " scale(-1 1)"}"><circle r="${r}" fill="var(--mdark)"/><path d="M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z" fill="var(--moon)"/></g>`; }
    arc = `<svg class="arc ${day ? "day" : "night"}" viewBox="0 0 220 72" role="img" aria-label="${hm(to - n)} to ${day ? "sunset" : "sunrise"}"><polyline class="track" points="${full}"/><polyline class="done" points="${pts(30)}"/><line class="hz" x1="6" x2="214" y1="52.5" y2="52.5"/>${body}<text x="6" y="68">${day ? "↑" : "↓"} ${istTime(new Date(from).toISOString())}</text><text x="110" y="68" text-anchor="middle">${hm(to - n)} to ${day ? "sunset" : "sunrise"}</text><text x="214" y="68" text-anchor="end">${istTime(new Date(to).toISOString())} ${day ? "↓" : "↑"}</text></svg>`;
  }
  const O = LIVE.outlook?.value?.cities?.[0], head = (O && skyHeadline(O)) || wx(c.current.code)[1];
  const air = c.air?.now, day = isNight(Number(istTime(new Date(n).toISOString()).slice(0, 2))) ? false : true;
  const fam = (W || []).slice(1).filter(x => x.current).map(x => `<b>${esc(x.name)}</b> ${Math.round(x.current.temp)}° ${esc(wx(x.current.code)[1].toLowerCase())}`).join(" · ");
  return `<div class="wx"><div class="t tnum">${Math.round(c.current.temp)}°</div><div class="c"><b>${esc(head)}</b>Feels ${Math.round(c.current.feels)}° · ${Math.round(d0.max)}°/${Math.round(d0.min)}°</div>${arc}</div>
<div class="wxs">${day && d0.rain_prob != null ? `<span>Rain <b>${d0.rain_prob}%</b></span>` : `<span>Moon <b>${Math.round(moonNow(n).lit * 100)}%</b> lit</span>`}${air != null ? `<span>Air <b>${air}</b> ${esc(airWord(air))}</span>` : ""}${c.current.humidity != null ? `<span>Humidity <b>${c.current.humidity}%</b></span>` : ""}</div>${fam ? `<p class="fam1">${fam}</p>` : ""}${staleNote("weather")}`;
}
function moneyHTML() {
  const M = LIVE.markets?.value; if (!M?.indices?.length) return "";
  const q = n => M.indices.find(x => x.name === n), sx = q("Sensex"), sp = q("S&P 500"), br = (M.cross || []).find(x => /brent/i.test(x.name)), G = LIVE.gold_in?.value;
  const row = (nm, v, c) => `<tr><td class="l">${nm}</td><td class="v tnum">${v}</td><td class="r tnum ${dir(c)}">${pct(c)}</td></tr>`;
  const mood = m => (m ? `<span>${esc(m.region)} mood<b class="${m.score < 45 ? "dn" : m.score > 55 ? "up" : ""}">${m.score} · ${esc(String(m.word || moodWord(m.score)).toLowerCase())}</b></span>` : "");
  return `<div class="mny">${sx ? `<div class="sx"><span class="k">Sensex</span><b class="tnum">${inr(sx.price)}</b><span class="tnum ${dir(sx.change_pct)}">${pct(sx.change_pct)}</span></div>` : ""}
<table><tbody>${sp ? row("S&P 500", inr(sp.price), sp.change_pct) : ""}${br ? row("Brent", "$" + br.price.toFixed(2), br.change_pct) : ""}${G?.per_10g_24k ? row("Gold 24K", "₹" + inr(G.per_10g_24k), G.change_pct) : ""}</tbody></table>
<div class="fear">${mood(M.mood?.India)}${mood(M.mood?.US)}</div></div>${staleNote("markets")}`;
}
function betsHTML(k = 3) {
  const list = (E.betting || []).slice(0, k); if (!list.length) return "";
  return `<ol class="bets" style="--c:var(--d-news)">${list.map(b => { const o = [...(b.outcomes || [])].sort((x, y) => y.prob - x.prob)[0]; if (!o) return "";
    return `<li><span class="t">${esc(vsV(b.title).replace(/^UEFA /, ""))}</span><span class="o"><b class="tnum">${Math.round(o.prob)}%</b><span>${esc(outcomeLabel(o.name))}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, o.prob))}%"></i></span></span></li>`; }).join("")}</ol>`;
}
const blk = (id, desk, title, link, to, body) => (body ? `<section class="blk" id="p1-${id}" style="--c:var(--d-${desk})"><div class="bh"><h2>${title}</h2><a href="${deskHref(desk)}" data-desk="${desk}" data-to="${to}">${link} →</a></div><div data-p1="${id}">${body}</div></section>` : "");
function pageOne() {
  return `<div class="p1"><div class="p1body"><section class="news" id="p1-minute"><div class="bh" style="--c:var(--d-one)"><h2>The day in a minute</h2><a href="${deskHref("news")}" data-desk="news">All the news →</a></div><div data-p1="minute">${minuteHTML(p1lines)}</div><div class="eve" data-p1="evening">${eveningHTML()}</div></section>
<div class="stack">${blk("weather", "home", "Weather", "Sky &amp; Streets", "sky", weatherHTML())}${blk("sport", "sport", "Sport this week", "Sport", "fixtures", sportHTML(4))}</div>
<div class="stack">${blk("money", "money", "Money", "The Ledger", "ledger", moneyHTML())}${blk("bets", "news", "The market expects", "Betting Window", "betting", betsHTML(3))}</div></div></div>`;
}
function oneFoot() {
  return `<div class="p1end">${E.house_note ? `<p class="hn"><b>House Note</b><span>${esc(E.house_note)}</span></p>` : ""}<div class="foot"><nav><a href="#d-one" data-desk="one">Your Desk</a><a href="#d-one" data-desk="one">Letters</a><a href="#d-one" data-desk="one">The editor</a><a href="#d-one" data-desk="one">Archive</a></nav><a class="next" href="${deskHref("news")}" data-desk="news">Start reading: News →</a></div></div>` + Notes.onePanel();
}
// Live figures repaint the blocks in place (the edition's own lines never change)
function paintOne() {
  const parts = { minute: () => minuteHTML(p1lines), evening: eveningHTML, weather: weatherHTML, sport: () => sportHTML(4), money: moneyHTML, bets: () => betsHTML(3) };
  for (const [k, fn] of Object.entries(parts)) { const el = document.querySelector(`[data-p1="${k}"]`); if (!el) continue; const h = fn(); if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; } }
}
// One screen on any laptop or monitor: as many of the editor's lines as fit (never fewer than five with the lead), then
// the page scales (0.85 to 2) to fill the height within the width. Phones scroll. The notes panel sits below the fold.
const ZOOMED = ["dtop", "dtabs", "layout"];
function fitOne() {
  const setZ = z => ZOOMED.forEach(id => { const el = document.getElementById(id); if (el) el.style.zoom = z === 1 ? "" : String(z); });
  setZ(1);
  if (DESK.id !== "one" || !document.querySelector(".p1end")) return;
  const end = () => document.querySelector(".p1end")?.getBoundingClientRect().bottom ?? 0;
  const bar = () => document.querySelector(".mockbar")?.getBoundingClientRect().height ?? 0;
  if (innerWidth < 1000) { if (p1lines !== P1MAX) { p1lines = P1MAX; paintOne(); } return; }
  // the review bar is not part of the paper and scrolls away, so it does not count against the one screen
  const room = () => innerHeight + bar();
  p1lines = P1MAX; paintOne();
  while (p1lines > 4 && end() > room()) { p1lines--; paintOne(); }
  // on a big day the editor's note sits under the lead; the page may then shrink a little further (0.8) to stay one screen
  let lo = E.editor_note ? 0.8 : 0.85, hi = Math.max(1, Math.min(innerWidth / 1320, 2));
  for (let k = 0; k < 12; k++) { const z = (lo + hi) / 2; setZ(z); if (end() > room()) hi = z; else lo = z; }
  setZ(lo);
}
let unmountMark = () => {};
function mountMark() {
  unmountMark(); unmountMark = () => {};
  const n = document.querySelector("#bigplate .n"); if (!n || DESK.id !== "one") return;
  const size = parseFloat(getComputedStyle(document.querySelector("#bigplate")).getPropertyValue("--np")) || 78;
  const tag = $("#r-tag"), below = document.querySelector("#bigplate .wmcap");
  const caption = innerWidth <= 760 ? { show: h => { below.innerHTML = h; below.style.opacity = 1; }, hide: () => { below.style.opacity = 0; } }
    : { show: h => { tag.innerHTML = `<span class="wmrun">${h}</span>`; }, hide: () => { tag.innerHTML = tagline; } };
  const desks = NEWDESKS.filter(d => d.id !== "one").map(d => ({ id: d.id, name: d.name, sections: d.sections }));
  const items = storiesFromEdition(E, desks, deskHref).map(p => ({ ...p, headline: esc(p.headline) }));
  mountWordmark(n, { items, font: window.PLAYFAIR64, caption, size }).then(u => { unmountMark = u; }).catch(() => {});
}

// ---------------------------------------------------------------- moving between desks
function showDesk(id, to) {
  const d = NEWDESKS.find(x => x.id === id) || NEWDESKS[0];
  const same = d === DESK; DESK = d;
  if (!same) { render(); scrollTo({ top: 0 }); }
  if (location.hash !== deskHref(d.id)) history.replaceState(null, "", deskHref(d.id));
  requestAnimationFrame(() => {
    fitMonitor(); if (d.id === "one") mountMark(); else unmountMark();
    if (to) { const el = document.getElementById(to) || document.getElementById("s-" + to); if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), same ? 0 : 60); }
  });
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-desk]"); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  if (a.dataset.note) toast(a.dataset.note);
  showDesk(a.dataset.desk, a.dataset.to);
}, true);
addEventListener("hashchange", () => { const m = location.hash.match(/^#d-([a-z]+)$/); if (m && m[1] !== DESK.id) showDesk(m[1]); });

// ---------------------------------------------------------------- images that cannot load leave no box behind
document.addEventListener("error", e => {
  const img = e.target; if (!(img instanceof HTMLImageElement)) return;
  if (img.classList.contains("crest")) { img.remove(); return; }
  const fig = img.closest(".f1-track"); if (!fig) return;
  const top = fig.closest(".f1top"), col = fig.parentElement; fig.remove();
  const facts = top?.querySelector(".facts"), left = top?.firstElementChild;
  if (top && facts && col && col !== left) { const unit = facts.parentElement !== left ? facts.parentElement : facts; unit.style.marginTop = ""; col.append(unit); }
  else if (top && col && !col.children.length) { col.remove(); top.classList.remove("cols2"); }
}, true);

// ---------------------------------------------------------------- Parth's red pencil: notes on every part of the paper
// Each note is a verdict (looks right, needs changes, remove it) and free text, dictated or typed; it saves as he goes
// (to the page's own store where the viewer offers one, else on this device) and the drawer copies them all at once.
const Notes = (() => {
  const state = {}, labels = {}, timers = {}, chains = {};
  let db = null, mode = "local";
  const LS = "h1400-sample-notes";
  const local = { get() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} } };
  const safe = k => k.replace(/[^A-Za-z0-9_.~-]/g, "-");
  const VERDICTS = [["good", "Looks right"], ["change", "Needs changes"], ["drop", "Remove it"]];
  const ONE = [["one.nameplate", "Nameplate and the halftone wordmark"], ["one.tabs", "Desk tabs and moving between desks"], ["one.minute", "The day in a minute (and the editor's note)"], ["one.weather", "Weather"], ["one.sport", "Sport this week"], ["one.money", "Money"], ["one.bets", "The market expects"], ["one.house", "House Note and the foot line"], ["one.desk", "Page One as a whole"]];
  const PAPER = [["paper.overall", "The whole paper"], ["paper.look", "Type, colour and spacing"], ["paper.phone", "On your phone"]];
  function box(key, label, cls = "") {
    labels[key] = label;
    const s = state[key] || {}, id = "n-" + safe(key).replace(/\./g, "_");
    return `<aside class="pencil ${cls}" data-key="${esc(key)}"><div class="ph"><b>Red pencil</b><span class="pl">${esc(label)}</span><span class="st" aria-live="polite"></span></div>
<div class="chips" role="group" aria-label="Verdict on ${esc(label)}">${VERDICTS.map(([v, t]) => `<button type="button" data-verdict="${v}" aria-pressed="${s.verdict === v}">${t}</button>`).join("")}</div>
<textarea id="${id}" rows="2" placeholder="What should change? Dictate or type; it saves as you go.">${esc(s.text || "")}</textarea></aside>`;
  }
  function onePanel() { return `<section class="notes1" id="notes-one"><h2>Your notes on Page One</h2><p>One box per part of the page. Page One itself stays one screen; these sit below it.</p><div class="ngrid">${ONE.map(([k, l]) => box(k, l)).join("")}</div></section>`; }
  // a note under every section that is printed, matching its section's visibility
  function sync() {
    for (const s of document.querySelectorAll("#main section.sec")) {
      const key = `${DESK.id}.${s.id}`;
      let n = s.nextElementSibling;
      if (n?.dataset?.key !== key) { s.insertAdjacentHTML("afterend", box(key, sec(s.id).name)); n = s.nextElementSibling; }
      n.hidden = s.hidden;
    }
    const dl = document.querySelector("#main .dlead"); if (dl && !dl.nextElementSibling?.classList.contains("pencil")) dl.insertAdjacentHTML("afterend", box(`${DESK.id}.lead`, "The lead at the top of the desk"));
    count();
  }
  const filled = k => !!(state[k]?.verdict || state[k]?.text?.trim());
  function count() { const n = Object.keys(state).filter(filled).length; const b = $("#nbtn"); if (b) b.textContent = n ? `Your notes · ${n}` : "Your notes"; }
  async function write(key) {
    const s = state[key] || {}, body = { key, label: labels[key] || key, desk: key.split(".")[0], verdict: s.verdict || "", text: s.text || "", saved_at: new Date(realNow()).toISOString() };
    const all = local.get(); all[key] = body; local.set(all);
    if (!db) return setStatus(key, "Saved on this device");
    setStatus(key, "Saving…");
    chains[key] = (chains[key] || Promise.resolve()).then(() => db.doc(`notes/${safe(key)}`).set(body)).then(() => setStatus(key, "Saved"), err => setStatus(key, err?.code === "invalid_argument" ? "Read-only here" : "Not saved yet, will retry", true));
    return chains[key];
  }
  function setStatus(key, t, bad = false) { document.querySelectorAll(`.pencil[data-key="${CSS.escape(key)}"] .st`).forEach(el => { el.textContent = t; el.classList.toggle("bad", bad); }); }
  function queue(key, ms = 900) { clearTimeout(timers[key]); timers[key] = setTimeout(() => write(key), ms); count(); }
  document.addEventListener("input", e => { const t = e.target.closest(".pencil textarea"); if (!t) return; const k = t.closest(".pencil").dataset.key; (state[k] ||= {}).text = t.value; queue(k); });
  document.addEventListener("focusout", e => { const t = e.target.closest?.(".pencil textarea"); if (t) { const k = t.closest(".pencil").dataset.key; if (timers[k]) { clearTimeout(timers[k]); delete timers[k]; write(k); } } });
  document.addEventListener("click", e => {
    const b = e.target.closest(".pencil [data-verdict]"); if (!b) return;
    const k = b.closest(".pencil").dataset.key, v = b.dataset.verdict, s = (state[k] ||= {});
    s.verdict = s.verdict === v ? "" : v;
    document.querySelectorAll(`.pencil[data-key="${CSS.escape(k)}"] [data-verdict]`).forEach(x => x.setAttribute("aria-pressed", x.dataset.verdict === s.verdict));
    queue(k, 0);
  }, true);
  // the drawer: the whole paper's three boxes, every note at a glance, and one button that copies them all
  function drawer() {
    const d = $("#ndrawer"); if (!d) return;
    const byDesk = NEWDESKS.map(dk => ({ dk, keys: Object.keys(state).filter(k => k.startsWith(dk.id + ".") && filled(k)) }));
    d.querySelector(".nlist").innerHTML = byDesk.map(({ dk, keys }) => `<li><button type="button" data-desk="${dk.id}" data-to="${dk.id === "one" ? "notes-one" : ""}"><span style="--c:var(--d-${dk.id})">${esc(dk.name)}</span><b>${keys.length || "No"} note${keys.length === 1 ? "" : "s"}</b></button></li>`).join("");
    d.querySelector(".nmode").textContent = db ? "Your notes save as you type, and Claude reads them from here." : "Your notes save on this device. Use Copy all and paste them into the chat.";
  }
  function text() {
    const out = [`Notes on the new design sample (edition of ${longDate(E.date)})`];
    const V = Object.fromEntries(VERDICTS);
    for (const dk of [{ id: "paper", name: "The whole paper" }, ...NEWDESKS]) {
      const keys = Object.keys(state).filter(k => k.startsWith(dk.id + ".") && filled(k)); if (!keys.length) continue;
      out.push("", dk.name.toUpperCase());
      for (const k of keys) out.push(`- ${labels[k] || k}${state[k].verdict ? ` [${V[state[k].verdict]}]` : ""}: ${(state[k].text || "").trim() || "(no words)"}`);
    }
    return out.join("\n");
  }
  async function start() {
    Object.assign(state, local.get()); for (const [k, v] of Object.entries(state)) if (v.label) labels[k] = v.label;
    try { db = await window.claude?.use?.("db"); } catch { db = null; }
    if (db) {
      try { const snap = await db.collection("notes").get(); for (const doc of snap.docs) { const v = doc.data(); if (v?.key) { state[v.key] = { verdict: v.verdict || "", text: v.text || "" }; labels[v.key] = v.label || v.key; } } mode = "db"; }
      catch { db = null; }
    }
  }
  // notes that arrive after the page is drawn fill their boxes, unless he has already started typing in one
  function fill() {
    for (const el of document.querySelectorAll(".pencil")) {
      const k = el.dataset.key, v = state[k] || {}, ta = el.querySelector("textarea");
      if (ta && document.activeElement !== ta && !timers[k]) ta.value = v.text || "";
      el.querySelectorAll("[data-verdict]").forEach(x => x.setAttribute("aria-pressed", x.dataset.verdict === v.verdict));
    }
    count(); drawer();
  }
  function wireDrawer() {
    $("#nbtn")?.addEventListener("click", () => { const d = $("#ndrawer"); d.hidden = !d.hidden; $("#nbtn").setAttribute("aria-expanded", !d.hidden); if (!d.hidden) drawer(); });
    $("#nclose")?.addEventListener("click", () => { $("#ndrawer").hidden = true; $("#nbtn").setAttribute("aria-expanded", false); });
    $("#ncopy")?.addEventListener("click", async () => {
      const t = text(), out = $("#ncopied");
      try { await navigator.clipboard.writeText(t); out.textContent = "Copied. Paste it into the chat."; }
      catch { const ta = $("#nall"); ta.hidden = false; ta.value = t; ta.select(); out.textContent = "Selected below: copy it with your keyboard or the menu."; }
    });
    $("#nhide")?.addEventListener("click", e => { const on = document.body.classList.toggle("clean"); e.target.setAttribute("aria-pressed", on); e.target.textContent = on ? "Show notes" : "Hide notes"; });
    $("#ndrawer .npaper").innerHTML = PAPER.map(([k, l]) => box(k, l)).join("");
  }
  return { box, onePanel, sync, start, fill, wireDrawer, drawer, get mode() { return mode; } };
})();
