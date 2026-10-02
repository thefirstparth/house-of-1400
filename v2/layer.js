// ================================================================ THE NEW DESIGN (v2, behind ?v2; v2/README.md)
// The paper's own renderer (public/app.js) draws every section from the edition and the live figures; this layer adds
// the page around them as agreed with Parth on 1 Oct: Page One with the halftone wordmark, six desk pages behind one
// row of tabs (config desks_v2), the day's lead at the top of its own section, which opens its desk. The build
// (v2/assemble.mjs) patches it into a copy of app.js as /v2.js; app.js itself is never changed by it.
let NEWDESKS = [];
let DESK = { id: (location.hash.match(/^#d-([a-z]+)$/) || [])[1] || "one", name: "", sections: [] };
function desksInit() {
  if (NEWDESKS.length || !CFG) return;
  NEWDESKS = CFG.desks_v2?.desks || [{ id: "one", name: "Page One", sections: [] }, ...CFG.desks.map(d => ({ id: d.id, name: d.name, sections: d.sections }))];
  DESK = NEWDESKS.find(d => d.id === DESK.id) || NEWDESKS[0];
}
const deskOf = id => NEWDESKS.find(d => d.sections.includes(id));
const deskHref = id => `#d-${id}`;

// ---------------------------------------------------------------- older editions in the new sections (Parth: by label)
// From 2 Oct Bhide files Desh, Videsh, AI, Tech and Sales & SaaS himself; editions up to 1 Oct are sorted by their
// stories' own labels: "India · ..." to Desh, the rest of Dateline to Videsh; The Workshop's AI stories to AI and the
// rest to Tech; The Pipeline to Sales & SaaS.
const AI_RE = /^AI\b|\bAI\b|artificial intelligence|OpenAI|Anthropic|Claude|Gemini|ChatGPT|\bLLM|DeepMind|chatbot|\bagents?\b|model/i;
function refile() {
  if (refile.done === E) return; refile.done = E;
  if (E.date >= "2026-10-02") return;
  // lines carry no kicker: they go to Desh unless the headline is plainly about the world
  const WORLD = /\b(US|U\.S\.|UK|China|Pakistan|Russia|Ukraine|Israel|Iran|Gaza|Europe|EU|Trump|Putin|UN|world|global)\b/;
  const to = { dateline: x => (x.kicker ? (/^India\b/i.test(x.kicker) ? "desh" : "videsh") : WORLD.test(x.headline || "") ? "videsh" : "desh"), workshop: x => (AI_RE.test(`${x.kicker || ""} ${x.headline || ""}`) ? "ai" : "tech"), pipeline: () => "sales" };
  const F = E.front || {};
  for (const x of [F.lead, ...(F.seconds || []), ...(F.briefs || [])]) if (x && to[x.section]) x.section = to[x.section](x);
  for (const from of Object.keys(to)) {
    const S = E.sections?.[from]; if (!S) continue;
    for (const k of ["stories", "briefs", "lines"]) for (const x of S[k] || []) { const id = to[from](x); ((E.sections[id] ||= {})[k] ||= []).push(k === "lines" ? x : { ...x, section: id }); }
    delete E.sections[from];
  }
}

// ---------------------------------------------------------------- desks: the lead, front stories, the shell
// The day's lead prints at the top of its own section, across the page with its 16:9 drawing (Parth, 1 Oct: place the
// drawing by the shape Bhide ordered), and that section opens its desk. The front page's other stories print at the
// top of their own sections, in the front's order; Page One carries only headlines.
const leadSec = () => E.front?.lead?.section || null;
function frontItems(id, kind) {
  const F = E.front || {};
  return kind === "story" ? (F.seconds || []).filter(x => x?.section === id) : (F.briefs || []).filter(x => x?.section === id);
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
  // Phone tabs (review, 2 Oct): the current tab starts the row, so no sliver of the one before it shows; an edge fades
  // only where a tab is cut by it, so the row reads as one that scrolls.
  const ol = $("#dtabs ol"), fade = () => {
    const L = ol.scrollLeft, R = L + ol.clientWidth, cut = [...ol.children].map(li => [li.offsetLeft, li.offsetLeft + li.offsetWidth]);
    ol.classList.toggle("more-l", cut.some(([a, b]) => a < L - 1 && b > L + 1));
    ol.classList.toggle("more-r", R < ol.scrollWidth - 2);
  };
  if (!ol.dataset.wired) { ol.dataset.wired = 1; ol.addEventListener("scroll", fade, { passive: true }); addEventListener("resize", fade); }
  requestAnimationFrame(() => {
    const li = ol.querySelector("[aria-current]")?.parentElement;
    if (li && ol.scrollWidth > ol.clientWidth) {
      // start the row at a tab, the current one if the row can scroll that far, else the furthest tab that still shows it
      const max = ol.scrollWidth - ol.clientWidth, starts = [...ol.children].map((x, i) => (i ? x.offsetLeft - 4 : 0));
      const fit = starts.filter(b => b <= max && b <= starts[[...ol.children].indexOf(li)] && b + ol.clientWidth >= li.offsetLeft + li.offsetWidth + 4);
      ol.scrollLeft = fit.length ? Math.max(...fit) : max;
    }
    fade();
  });
  document.title = `${DESK.id === "one" ? "" : DESK.name + " · "}The House of 1400 · ${longDate(E.date)}`;
  document.documentElement.style.setProperty("--d", `var(--d-${DESK.id})`);
  document.body.classList.toggle("on-one", DESK.id === "one");
}
function deskOpener() {
  desksInit(); refile(); shellStatic();
  if (DESK.id === "one") return pageOne();
  return `<header class="dopen"><h1>${esc(DESK.name)}</h1><nav class="jump" id="jump" aria-label="In ${esc(DESK.name)}"></nav></header>`;
}
function paintJump() {
  const el = $("#jump"); if (!el) return;
  const ids = deskOrder().filter(id => { const s = document.getElementById(id); return s && !s.hidden; });
  const h = ids.map(id => `<a href="#${id}" data-go="${id}">${esc(sec(id).name)}</a>`).join("");
  if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; }
}
function deskFoot() {
  if (DESK.id === "one") return oneFoot();
  const i = NEWDESKS.indexOf(DESK), nx = NEWDESKS[(i + 1) % NEWDESKS.length];
  // Your Desk (Gmail and Calendar, folded) closes the last desk, as it closed the old paper
  return (i === NEWDESKS.length - 1 ? `<div class="ydesk">${deskBlock()}</div>` : "") +
    `<div class="nextdesk"><a href="${deskHref(nx.id)}" data-desk="${nx.id}" style="--c:var(--d-${nx.id})">Next: <b>${esc(nx.name)}</b> →</a></div>` + footLine();
}
const lastDesk = () => NEWDESKS.at(-1)?.id || "off";
const footNav = () => `<nav>${E.desk?.length ? `<a href="${deskHref(lastDesk())}" data-desk="${lastDesk()}" data-to="desk" data-open="desk">${esc(sec("desk")?.name || "Your Desk")}</a>` : ""}<a href="/editor">The editor and letters</a><a href="/archive">Archive</a><a href="?v1" data-v1>The old design</a></nav>`;
const footLine = () => `<footer class="dfoot">${footNav()}<span>${esc(`The House of 1400 · ${longDate(E.date)} · No. ${E.edition_no}`)}</span></footer>`;
// The desk's sections in order, with the lead's section first when the lead is on this desk
function deskOrder() {
  const L = leadSec(), at = DESK.sections.indexOf(L);
  return at > 0 ? [L, ...DESK.sections.filter(x => x !== L)] : DESK.sections;
}
function desksHTML(S) {
  const L = E.front?.lead;
  return deskOrder().map(id => {
    let h = S[id] || "";
    if (L && id === L.section) {
      const lead = `<div class="dlead">${storyHTML(L, { lead: true })}</div>`;
      if (!h) h = secWrap(id, "<i hidden></i>", "");
      const at = h.indexOf("</div></div>") + "</div></div>".length; // after the section head
      h = h.slice(0, at) + lead + h.slice(at);
    }
    return h;
  }).join("");
}

// ---------------------------------------------------------------- The Fixture List, by sport (Parth, 1 Oct)
// Each day's fixtures in sport groups, in this order, each under a small label; times stay in order inside a group.
const SPORTS = [["Cricket", /cricket/], ["Football", /madrid|football|soccer/], ["F1", /^f1/], ["Tennis", /tennis/], ["Basketball", /nba|warriors/]];
const sportOf = f => (SPORTS.find(([, re]) => re.test(f.entity || "")) || ["More sport"])[0];
function sportGroups(list) {
  const by = new Map(), rank = sp => { const i = SPORTS.findIndex(x => x[0] === sp); return i < 0 ? SPORTS.length : i; };
  for (const f of list) { const sp = sportOf(f); if (!by.has(sp)) by.set(sp, []); by.get(sp).push(f); }
  return [...by].sort((a, b) => rank(a[0]) - rank(b[0])).flatMap(([sp, l]) => [{ sp }, ...l]);
}

// ---------------------------------------------------------------- Page One (variant B, design/page-one/README.md FINAL)
// The day in a minute: every one of the editor's lines (Parth, 2 Oct: "the original had 7, what happened to ours?")
const P1MAX = 10, P1MIN = 5; let p1lines = P1MAX;
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
// Money (Parth, 1 Oct: "The % change is 1 day change? What do you show on a weekend?"): each figure's change on its
// latest session, headed 1D; a dot and a line say whether the market is live or closed, and which session's close
// the figure is when it is closed (Friday's on a weekend).
function moneyHTML() {
  const M = LIVE.markets?.value; if (!M?.indices?.length) return "";
  const q = n => M.indices.find(x => x.name === n), sx = q("Sensex"), sp = q("S&P 500"), br = (M.cross || []).find(x => /brent/i.test(x.name)), G = LIVE.gold_in?.value;
  const closeOf = x => (x?.live ? "" : x?.session_date && x.session_date !== istDate() ? ` <small>${esc(fmt(x.session_date + "T12:00:00Z", { weekday: "short" }))}</small>` : "");
  const dot = x => `<i class="mdot ${x?.live ? "on" : ""}" title="${esc(x ? hoursLine(x) : "")}"></i>`;
  const row = (nm, v, c, x) => `<tr><td class="l">${x ? dot(x) : ""}${nm}</td><td class="v tnum">${v}</td><td class="r tnum ${dir(c)}">${pct(c)}${closeOf(x)}</td></tr>`;
  const mood = m => (m ? `<span>${esc(m.region)} mood<b class="${m.score < 45 ? "dn" : m.score > 55 ? "up" : ""}">${m.score} · ${esc(String(m.word || moodWord(m.score)).toLowerCase())}</b></span>` : "");
  return `<div class="mny">${sx ? `<div class="sx"><span class="k">Sensex</span><b class="tnum">${inr(sx.price)}</b><span class="tnum ${dir(sx.change_pct)}">${pct(sx.change_pct)}</span><span class="k">1D</span></div><p class="mst">${dot(sx)}${esc(hoursLine(sx))}</p>` : ""}
<table><thead><tr><th></th><th></th><th class="r">1D</th></tr></thead><tbody>${sp ? row("S&P 500", inr(sp.price), sp.change_pct, sp) : ""}${br ? row("Brent", "$" + br.price.toFixed(2), br.change_pct, br.live != null ? br : null) : ""}${G?.per_10g_24k ? row("Gold 24K", "₹" + inr(G.per_10g_24k), G.change_pct) : ""}</tbody></table>
<div class="fear">${mood(M.mood?.India)}${mood(M.mood?.US)}</div></div>${staleNote("markets")}`;
}
// The market expects (Parth, 1 Oct: "How is Brazil important?"): the busiest markets that touch what he follows
// (config betting.page_one): a follow by name first, then his sports and AI and tech, then a war or trade fight.
function betsPick(k) {
  const P = CFG.betting?.page_one || {}, F = CFG.follows || {};
  const names = [F.football_club?.name, F.football_club?.name?.replace(/^Real /, ""), F.f1_driver?.name, ...(F.tennis_players || []), "India",
    ...(F.cricket_team?.priority || []).filter(x => !/^(team|others)$/.test(x)), F.nba_team?.name].filter(Boolean).flatMap(n => [n, lastName(n)]), teams = F.national_teams || [];
  const has = (t, n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t);
  const cats = new Set((P.then?.categories || []).map(c => c.toLowerCase())), last = P.last?.pattern ? new RegExp(P.last.pattern, "i") : null;
  // a single match counts only when it names a follow or a followed national side; a season-long market (a title, an
  // award, the best AI model) counts by its category
  const match = b => / vs?\.? /i.test(b.title || "");
  const score = b => { const t = `${b.title} ${(b.outcomes || []).map(o => o.name).join(" ")}`;
    if (names.some(n => has(t, n))) return 3;
    if (match(b)) return teams.some(n => has(b.title, n)) ? 2 : 0;
    return cats.has(String(b.category || "").toLowerCase()) ? 2 : last && last.test(`${b.title} ${b.category || ""}`) ? 1 : 0; };
  return (E.betting || []).map((b, i) => ({ b, s: score(b), i })).filter(x => x.s > 0).sort((x, y) => y.s - x.s || (y.b.volume24h || 0) - (x.b.volume24h || 0) || x.i - y.i).slice(0, k ?? P.show ?? 3).map(x => x.b);
}
function betsHTML(k = 3) {
  const list = betsPick(k); if (!list.length) return "";
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
  const nx = NEWDESKS[1] || NEWDESKS[0];
  return `<div class="p1end">${E.house_note ? `<p class="hn"><b>House Note</b><span>${esc(E.house_note)}</span></p>` : ""}<div class="foot">${footNav()}<a class="next" href="${deskHref(nx.id)}" data-desk="${nx.id}">Start reading: ${esc(nx.name)} →</a></div></div>`;
}
// Live figures repaint the blocks in place (the edition's own lines never change)
function paintOne() {
  const parts = { minute: () => minuteHTML(p1lines), evening: eveningHTML, weather: weatherHTML, sport: () => sportHTML(4), money: moneyHTML, bets: () => betsHTML(3) };
  for (const [k, fn] of Object.entries(parts)) { const el = document.querySelector(`[data-p1="${k}"]`); if (!el) continue; const h = fn(); if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; } }
}
// The page fills the screen's width on every laptop and monitor, whatever its shape (Parth, 2 Oct: "too much white
// space on my Mac and my BenQ"): the masthead, the tabs and the page scale together (zoom) and their width is the
// screen's, so nothing sits in a narrow column with empty margins. Phones and small tablets keep the plain layout.
const ZOOMED = ["dtop", "dtabs", "layout", "late", "pastbar"];
function setZoom(z, w) {
  for (const id of ZOOMED) { const el = document.getElementById(id); if (el) el.style.zoom = z === 1 ? "" : String(z); }
  document.documentElement.style.setProperty("--pw", w ? `${Math.round(w)}px` : "");
  // the screen's height in the page's own (zoomed) pixels, so a drawing can be held to part of the screen at any zoom
  document.documentElement.style.setProperty("--vh", `${Math.round(innerHeight / z)}px`);
}
// A desk page: the type grows with the screen (zoom 1 to 1.8, by width and by height), the page takes the full width,
// up to 1920px of layout so lines never run too long on an ultra-wide screen.
function fitDesk() {
  const W = innerWidth, H = innerHeight;
  if (W < 1100) return setZoom(1, 0);
  const z = Math.max(1, Math.min(W / 1440, H / 760, 1.8));
  setZoom(z, Math.min(W / z, 1920));
}
// Page One: one screen. Every one of the editor's lines prints; the page takes the full width and scales (0.62 to
// 2.2) until it fills the height. Only on a screen too short even then does it drop lines, never below five.
function fitOne() {
  setZoom(1, 0);
  if (DESK.id !== "one" || !document.querySelector(".p1end")) return;
  const end = () => document.querySelector(".p1end")?.getBoundingClientRect().bottom ?? 0;
  if (p1lines !== P1MAX) { p1lines = P1MAX; paintOne(); }
  const W = innerWidth; if (W < 1000) return;
  const at = z => { setZoom(z, Math.min(W / z, 2600)); return end() <= innerHeight; };
  const LO = 0.62;
  while (!at(LO) && p1lines > P1MIN) { p1lines--; paintOne(); }
  let lo = LO, hi = Math.max(LO, Math.min(W / 1100, 2.2));
  if (at(hi)) lo = hi;
  else for (let k = 0; k < 14; k++) { const z = (lo + hi) / 2; if (at(z)) lo = z; else hi = z; }
  at(lo);
}
let unmountMark = () => {};
function mountMark() {
  unmountMark(); unmountMark = () => {};
  const n = document.querySelector("#bigplate .n"); if (!n || DESK.id !== "one") return;
  const size = parseFloat(getComputedStyle(document.querySelector("#bigplate")).getPropertyValue("--np")) || 96;
  mountWordmark(n, { size }).then(u => { unmountMark = u; }).catch(() => {});
}

// ---------------------------------------------------------------- moving between desks
function showDesk(id, to, open) {
  desksInit();
  const d = NEWDESKS.find(x => x.id === id) || NEWDESKS[0];
  const same = d === DESK; DESK = d;
  if (!same) { render(); scrollTo({ top: 0 }); }
  if (location.hash !== deskHref(d.id)) history.replaceState(null, "", deskHref(d.id));
  requestAnimationFrame(() => {
    fitMonitor(); if (d.id === "one") mountMark(); else unmountMark();
    if (to) { const el = document.getElementById(to) || document.getElementById("s-" + to); if (el) { if (open && el.tagName === "DETAILS") el.open = true; setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), same ? 0 : 60); } }
  });
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-desk]"); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  showDesk(a.dataset.desk, a.dataset.to, !!a.dataset.open);
}, true);
// The old design stays one tap away until Parth switches (?v1 forgets the choice on this device)
document.addEventListener("click", e => { if (e.target.closest("[data-v1]")) { try { localStorage.removeItem("h1400-design"); } catch {} } }, true);
// Day and night, in the run line (the old masthead's switch is not on this page)
function dthemeLabel() { const b = $("#dtheme"); if (!b) return; const r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches); b.textContent = dk ? "Day" : "Night"; }
document.addEventListener("click", e => {
  if (!e.target.closest("#dtheme")) return;
  const r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  r.setAttribute("data-theme", dk ? "light" : "dark");
  try { localStorage.setItem("h1400-theme", dk ? "light" : "dark"); } catch {}
  dthemeLabel(); requestAnimationFrame(() => { if (DESK.id === "one") mountMark(); });
});
addEventListener("hashchange", () => { const m = location.hash.match(/^#d-([a-z]+)$/); if (m && NEWDESKS.length && m[1] !== DESK.id) showDesk(m[1]); });

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
