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
// The date and time now (Parth, 3 Oct: "we are not showing the current date and time anywhere ... I don't want it
// in bold, but it should be readable and present"): plain, at the head of the run line's right side; on a phone just
// the time, with the day when it is not the paper's.
let nowT = 0;
function tickNow() {
  const el = $("#r-now"); if (!el) return;
  const d = new Date(), day = o => d.toLocaleDateString("en-GB", { ...o, timeZone: TZ }), t = istTime(d.toISOString()), other = istDate(d) !== E?.date;
  const html = `<span class="lg">${esc(day({ weekday: "short" }))} ${esc(day({ day: "numeric", month: "short" }))} · ${t} IST</span><span class="sh">${other ? `${esc(day({ weekday: "short" }))} ` : ""}${t}</span>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  clearTimeout(nowT); nowT = setTimeout(tickNow, 60000 - (Date.now() % 60000) + 50);
}
let tagline = "";
function shellStatic() {
  $("#r-date").innerHTML = `<span class="lg">${esc(longDate(E.date))}</span><span class="sh">${esc(new Date(E.date + "T12:00:00+05:30").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }))}</span>`;
  $("#r-no").textContent = `No. ${E.edition_no}`;
  $("#r-print").textContent = E.printed_at ? `Printed ${istTime(E.printed_at)} IST` : "";
  tickNow();
  tagline = `${esc(CFG.paper.motto)} · edited by ${esc(CFG.paper.editor.signature.replace(", Editor", ""))}`;
  $("#r-tag").innerHTML = tagline;
  // Page One's tab carries a small, still day in dots, shown once the masthead has scrolled away (Parth, 2 Oct)
  $("#dtabs ol").innerHTML = NEWDESKS.map(d => `<li><a href="${deskHref(d.id)}" data-desk="${d.id}" style="--c:var(--d-${d.id})"${d === DESK ? ' aria-current="page"' : ""}>${d.id === "one" ? `<span class="tl">${esc(d.name)}</span><span class="tmk" aria-hidden="true"></span>` : esc(d.name)}</a></li>`).join("");
  tabMark();
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
const footNav = () => `<nav>${E?.desk?.length ? `<a href="${deskHref(lastDesk())}" data-desk="${lastDesk()}" data-to="desk" data-open="desk">${esc(sec("desk")?.name || "Your Desk")}</a>` : ""}<a href="/editor">The editor and letters</a><a href="/archive">Archive</a><a href="?v1" data-v1>The old design</a></nav>`;
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

// ---------------------------------------------------------------- The Fixture List, by time, labelled by sport
// Each day's fixtures in time order (Parth, 2 Oct: "this needs to be in ascending order, no?"), with the sport's small
// label above a row whenever the sport changes, so cricket, tennis, football and F1 still read apart (Parth, 1 Oct).
const SPORTS = [["Cricket", /cricket/], ["Football", /madrid|football|soccer/], ["F1", /^f1/], ["Tennis", /tennis/], ["Basketball", /nba|warriors/]];
const sportOf = f => (SPORTS.find(([, re]) => re.test(f.entity || "")) || ["More sport"])[0];
function sportGroups(list) {
  const out = []; let last = null;
  for (const f of [...list].sort((a, b) => String(a.when_utc).localeCompare(String(b.when_utc)))) {
    const sp = sportOf(f); if (sp !== last) out.push({ sp }); last = sp; out.push(f);
  }
  return out;
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
<ol class="min">${items.map(g => { const d = storyDesk(g.target) || "news"; return `<li><a href="${deskHref(d)}" data-desk="${d}" data-to="s-${esc(g.target)}" style="--c:var(--d-${d})"><span class="lab">${esc(g.section)}${allStories().find(x => x.id === g.target)?.update ? " · Update" : ""}</span><b>${esc(g.line)}</b></a></li>`; }).join("")}</ol>`;
}
function eveningHTML() {
  const s = (E.screen || []).find(x => x.verdict === "must" && !x.coming_soon); if (!s) return "";
  return `<a class="pick" href="${deskHref("off")}" data-desk="off" data-to="screen" style="--c:var(--d-off)"><span class="v">Must watch</span><b>${esc(s.title)}</b><p>${esc([s.where, s.release].filter(Boolean).join(" · "))}. ${esc(String(s.reason || "").split(". ")[0])}.</p></a>`;
}
const when1 = iso => { const n = Math.round((Date.parse(istDate(new Date(iso))) - Date.parse(istDate())) / 864e5); return `${n === 0 ? "today" : n === 1 ? "tomorrow" : istDay(iso)}, ${istTime(iso)}`; };
// Sport this week (Parth, 2 Oct: "should be in ascending order; India v West Indies is missing"): the next match of
// everything he follows, in time order, a match under way first. "Everything" is each India cricket series in the
// live schedule (the Asian Games side and the West Indies series both count), Real Madrid, the F1 race and each
// followed player: the next match of each within seven days, then Madrid's if within fourteen, then more matches by
// time while rows remain. A match more than three hours past that is not in play is left out.
function sportHTML(max = 5) {
  const C = LIVE.crease?.value, F = LIVE.football?.value, T = LIVE.tennis_players?.value?.players || [], f1 = LIVE.f1_next?.value?.race, n = Date.now();
  const on = w => (w ? ` · ${esc(w)}` : ""), live = t => `<span class="live">${t}</span>`, all = [];
  // India's cricket: today's, the next, and every match in the series under way and the others in the schedule
  const series = [C?.main, ...(Array.isArray(C?.also) ? C.also : [C?.also])].filter(Boolean);
  const seen = new Set();
  for (const m of [C?.today, C?.next, ...series.flatMap(x => (x.formats || []).flatMap(f => f.matches || []))]) {
    if (!m?.start || seen.has(m.id ?? m.start)) continue; seen.add(m.id ?? m.start);
    const t = Date.parse(m.start); if (m.state === "done" || (m.state !== "live" && t < n - 6 * 36e5)) continue;
    all.push({ sport: "Cricket", key: `cz:${m.series_id ?? m.series ?? series.find(x => (x.formats || []).some(f => (f.matches || []).includes(m)))?.label ?? "india"}`, t, title: `India v ${m.opponent} · ${m.desc}`, sub: m.state === "live" ? `${live("In play")}${m.score ? ` ${esc(m.score)}` : ""}` : `${m.time_announced === false ? `${istDay(m.start)}, time TBC` : when1(m.start)}${on(watchOn({ entity: "cricket", label: `India v ${m.opponent}`, when_utc: m.start }))}`, live: m.state === "live" });
  }
  for (const m of F?.next || []) {
    const t = Date.parse(m.date); if (!Number.isFinite(t) || t < n - 3 * 36e5) continue;
    all.push({ sport: "Madrid", key: "madrid", t, title: `${m.home ? "v" : "at"} ${m.opponent}`, sub: `${esc(m.competition)} · ${m.time_confirmed ? when1(m.date) : istDay(m.date)}${on(watchOn({ competition: m.competition, label: m.name }))}` });
  }
  const race = f1?.sessions?.at(-1);
  if (race && Date.parse(race.start) + race.minutes * 6e4 > n) all.push({ sport: "F1", key: "f1", t: Date.parse(race.start), title: `${f1.name.replace(/ in [A-Z][a-z]+$/, "")}${f1.locality ? `, ${f1.locality}` : ""}`, sub: `Race ${when1(race.start)}${on(watchOn({ entity: "f1" }))}` });
  for (const p of T) {
    const nx = p.next, nm = lastName(p.name); if (!nx?.when_utc || (!nx.live && Date.parse(nx.when_utc) < n - 3 * 36e5)) continue;
    all.push({ sport: "Tennis", key: `tn:${p.name}`, t: Date.parse(nx.when_utc), title: `${nm} v ${nx.opponent || "TBC"}`, sub: `${nx.live ? live("On court") : when1(nx.when_utc)}${on(watchOn({ entity: "tennis", label: `${nm} v ${nx.opponent}`, event: nx.event }))}`, live: !!nx.live });
  }
  all.sort((a, b) => a.t - b.t);
  const pick = new Set(), keys = new Set(), within = d => x => x.t - n < d * 864e5;
  for (const x of all.filter(within(7))) if (!keys.has(x.key) && pick.size < max) { keys.add(x.key); pick.add(x); }
  const madrid = all.find(x => x.key === "madrid" && within(14)(x)); if (madrid && !keys.has("madrid") && pick.size < max) pick.add(madrid);
  for (const x of all.filter(within(7))) { if (pick.size >= max) break; pick.add(x); }
  const rows = all.filter(x => pick.has(x));
  return rows.length ? `<ul class="rows">${rows.map(x => `<li><span class="lab">${x.sport}</span><span><b>${esc(x.title)}</b>${x.sub}</span></li>`).join("")}</ul>` : "";
}
// Weather (Parth, 2 Oct: "too cluttered; present it better without removing any of the data"): three calm parts.
// The temperature with the outlook and the day's range; the sun's arc, flatter, holding the time left until sunset
// (or sunrise) with the two times at its ends; then every reading as a label over a figure, in one grid, and the
// family's cities in the same grid below.
// ---------------------------------------------------------------- Weather where you are (Parth, 2 Oct)
// "Can we not ask for live location on the web page itself and show the live weather there, wherever the person is
// accessing it?" Only when the reader asks: "Where I am" in the Weather block's head asks the browser, once; the
// point, rounded to about a kilometre, goes to the paper's own weather function (Open-Meteo, the place's name from
// OpenStreetMap) and nowhere else, and nothing is stored but a note on this device that the reader said yes. Away from
// home (more than 30 km from Bengaluru) the block shows the weather there, with Bengaluru and the family's cities in a
// row below; the wordmark's ink and its tap cycle follow it too. At home nothing changes. A tap on it again turns it
// off. If the browser says no or the weather cannot be had, the block stays on Bengaluru (a wrong or empty field is
// never shown).
const HERE_KEY = "h1400-here";
let HERE = null, hereBusy = false, hereNote = "";
const hereOn = () => { try { return localStorage.getItem(HERE_KEY) === "1"; } catch { return false; } };
const homeAt = () => CFG.weather?.always?.[0] || { lat: 12.97, lon: 77.59 };
const kmApart = (a, b) => { const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const awayCity = () => (HERE?.current && hereOn() && kmApart(HERE, homeAt()) > 30 ? HERE : null);
function locate(asked) {
  if (!("geolocation" in navigator)) return;
  hereBusy = asked; if (asked) hereRepaint();
  navigator.geolocation.getCurrentPosition(async pos => {
    try { localStorage.setItem(HERE_KEY, "1"); } catch {}
    try {
      const r = await fetch(`/api/live/weather?lat=${pos.coords.latitude.toFixed(2)}&lon=${pos.coords.longitude.toFixed(2)}`), j = await r.json();
      const c = j.ok && j.value?.cities?.[0];
      if (c?.current && Number.isFinite(c.current.temp)) { HERE = c; hereNote = ""; } else if (asked) hereNote = "The weather there is not in yet";
    } catch { if (asked) hereNote = "The weather there is not in yet"; }
    hereBusy = false; hereRepaint();
  }, err => {
    hereBusy = false;
    if (err.code === 1) { try { localStorage.removeItem(HERE_KEY); } catch {} HERE = null; if (asked) hereNote = "Location is off for this site"; }
    hereRepaint();
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60e3 });
}
// On a later visit it follows the reader again by itself, but only where the browser says the permission still stands
// (so the page never asks unbidden); it looks again every 15 minutes while open.
async function hereBoot() {
  if (!hereOn() || !("geolocation" in navigator)) return;
  try { const p = await navigator.permissions?.query({ name: "geolocation" }); if (p?.state === "granted") locate(false); else if (p?.state === "denied") localStorage.removeItem(HERE_KEY); } catch {}
  setInterval(() => { if (hereOn() && HERE) locate(false); }, 15 * 60e3);
}
function hereRepaint() { if (DESK.id === "one" && document.querySelector(".p1")) { paintOne(); fitMonitor(); } unmountMark?.setWeather?.(markWeather()); }
function hereHead() {
  if (!("geolocation" in navigator)) return "";
  const away = awayCity(), on = hereOn() && HERE;
  if (hereBusy) return `<span class="here busy">Finding you…</span>`;
  if (hereNote) { const n = hereNote; setTimeout(() => { if (hereNote === n) { hereNote = ""; hereRepaint(); } }, 4000); return `<span class="here note">${esc(n)}</span>`; }
  return on ? `<button type="button" class="here on" data-here="off" aria-pressed="true" title="Show ${esc(CFG.paper.home_city || "Bengaluru")} again">${away ? `Back to ${esc(CFG.paper.home_city || "Bengaluru")}` : "Where I am"}</button>`
    : `<button type="button" class="here" data-here="on" aria-pressed="false" title="Show the weather where you are (your browser asks first)">Where I am</button>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-here]"); if (!b) return; e.preventDefault(); if (b.dataset.here === "on") locate(true); else { try { localStorage.removeItem(HERE_KEY); } catch {} HERE = null; hereRepaint(); } });
// What the wordmark's ink shows: the weather where the reader is, or at home
function markWeather() {
  const away = awayCity(), c = away || LIVE.weather?.value?.cities?.[0], h = homeAt();
  if (!c?.current) return null;
  return inkState({ code: c.current.code, temp: c.current.temp, wind: c.current.wind, lat: c.lat ?? h.lat, lon: c.lon ?? h.lon });
}

// The day line (Parth, 3 Oct, of design/sunline: "let's go ahead with B"): the whole day, midnight to midnight where
// the reader is, as one band in the sky's own colours, worked out minute by minute from the sun's height: deep blue
// night with its stars, violet and rose twilight, amber golden hours, pale day. A needle marks now, carrying the sun or
// the moon in its phase; a fine line above the band is the moon's hours in the sky, from its real position. Over it,
// the time left to sunset (or sunrise) and one more fact: the golden hour by day, the moon by night.
const SKYC = [[-18, "#1f2747", "#12172b"], [-12, "#2c3766", "#1b2242"], [-6, "#5b4f88", "#2e2852"], [-2, "#c47478", "#6e3c4b"], [1, "#ee9d50", "#9c5b22"], [6, "#f3c071", "#a87628"], [15, "#f2dca5", "#6f6342"], [35, "#d3e2ea", "#3a5264"], [90, "#bcd6e8", "#33506a"]];
function skyColour(deg, k) {
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  if (deg <= SKYC[0][0]) return SKYC[0][k];
  for (let i = 1; i < SKYC.length; i++) if (deg <= SKYC[i][0]) {
    const a = SKYC[i - 1], b = SKYC[i], f = (deg - a[0]) / (b[0] - a[0]), A = hex(a[k]), B = hex(b[k]);
    return "#" + A.map((v, j) => Math.round(v + (B[j] - v) * f).toString(16).padStart(2, "0")).join("");
  }
  return SKYC.at(-1)[k];
}
function dayRibbon(c, away, n) {
  const h = homeAt(), lat = c.lat ?? h.lat, lon = c.lon ?? h.lon, off = (c.utc_offset_seconds ?? 19800) * 1000, D = 864e5, M = 6e4, deg = 180 / Math.PI;
  const d0 = Math.floor((n + off) / D) * D - off, pc = t => +((t - d0) / D * 100).toFixed(2), alt = t => sunAt(lat, lon, t).alt * deg, moon = t => moonAt(lat, lon, t) * deg;
  // the first time f crosses thr between a and b, rising (up) or setting
  const cross = (f, a, b, thr, up) => { let p = f(a); for (let t = a + 2 * M; t <= b; t += 2 * M) { const v = f(t); if (up ? p < thr && v >= thr : p >= thr && v < thr) return t; p = v; } return null; };
  const H0 = -0.833, day = alt(n) > H0, rise = cross(alt, d0, d0 + D, H0, true), set = cross(alt, d0, d0 + D, H0, false);
  const to = day ? cross(alt, n, n + D, H0, false) : cross(alt, n, n + D, H0, true); if (!to || !rise || !set) return "";
  const stops = k => [...Array(97)].map((_, i) => `${skyColour(alt(d0 + i * 15 * M), k)} ${(i / 0.96).toFixed(2)}%`).join(",");
  // stars where the sky is dark enough, always in the same places
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const stars = [...Array(44)].map(() => [rnd(), rnd(), rnd()]).filter(([x]) => alt(d0 + x * D) < -10).map(([x, y, s]) => `<i style="left:${(x * 100).toFixed(1)}%;top:${(15 + y * 70).toFixed(0)}%;--s:${(1.4 + s * 1.1).toFixed(1)}px;animation-delay:${(s * 3).toFixed(1)}s"></i>`).join("");
  // the moon's hours, from its real place
  const ups = []; let on = null; for (let t = d0; t <= d0 + D; t += 10 * M) { const up = moon(t) > 0; if (up && on == null) on = t; if (on != null && (!up || t > d0 + D - 10 * M)) { ups.push([on, t]); on = null; } }
  const moonG = (r, m = moonNow(n)) => { const rx = (r * Math.abs(1 - 2 * m.lit)).toFixed(2), sweep = m.lit > 0.5 ? 1 : 0; return `<g${m.waxing ? "" : ' transform="scale(-1 1)"'}><circle r="${r}" fill="var(--mdark)"/><path d="M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z" fill="var(--moon)"/></g>`; };
  const mline = ups.map(([a, b]) => `<span class="mup" style="left:${pc(a)}%;width:${Math.max(0, pc(b) - pc(a))}%"><svg viewBox="-4 -4 8 8" aria-hidden="true">${moonG(3.2)}</svg></span>`).join("");
  const edge = p => (p < 9 ? " s" : p > 91 ? " e" : "");
  const label = (t, w) => `<span class="rt${edge(pc(t))}" style="left:${pc(t)}%">${w} <b class="tnum">${istTime(new Date(t).toISOString())}</b></span>`;
  const mark = day ? `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" fill="var(--paper)"/><circle r="6.5" fill="var(--sun)"/></svg>` : `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" fill="var(--paper)"/>${moonG(6.5)}</svg>`;
  let x;
  if (day) { const g = cross(alt, Math.max(n, to - 3 * 36e5), to, 6, false); x = g ? `Golden hour ${istTime(new Date(g).toISOString())}` : alt(n) < 6 && n > (rise + set) / 2 ? "Golden hour now" : `${hm(set - rise)} of daylight`; }
  else { const up = moon(n) > 0, lit = Math.round(moonNow(n).lit * 100), nx = cross(moon, n, to + 36e5, 0, !up);
    x = up ? `Moon ${lit}% · up till ${nx ? istTime(new Date(nx).toISOString()) : "dawn"}` : nx && nx < to ? `Moon ${lit}% · rises ${istTime(new Date(nx).toISOString())}` : `Moon ${lit}%, down tonight`; }
  const said = `${day ? "Sunset" : "Sunrise"} at ${istTime(new Date(to).toISOString())}, ${hm(to - n)} from now`;
  return `<div class="ribbon ${day ? "day" : "night"}" style="--rib-l:linear-gradient(90deg,${stops(1)});--rib-d:linear-gradient(90deg,${stops(2)})"><p class="rtop"><b><em class="tnum">${hm(to - n)}</em> to ${day ? "sunset" : "sunrise"}</b><span>${esc(x)}</span></p>
<div class="rwrap" role="img" aria-label="${esc(said)}"><div class="moons">${mline}</div><div class="band">${stars}</div><span class="needle" style="left:${pc(n)}%">${mark}</span>${label(rise, "Sunrise")}${label(set, "Sunset")}</div></div>`;
}
// The Weather block (Parth, 2 Oct: "since we added Where I am, this section has become too data-heavy, too cluttered,
// with no real structure"): four tiers, each one line or close to it. Now (the place when away, the temperature, the
// sky, feels, high and low); the day as a slim line from sunrise to sunset (or sunset to sunrise) with the sun or the
// moon where it is; three readings on one line (rain today or the moon at night, the air, humidity); and elsewhere, one
// quiet line of the other cities. The city shown is never repeated in that line.
function weatherHTML() {
  const W = LIVE.weather?.value?.cities, away = awayCity(), c = away || W?.[0]; if (!c?.current) return "";
  const d0 = (c.daily || [])[0] || {}, n = Date.now(), sun = dayRibbon(c, away, n);
  const O = away ? null : LIVE.outlook?.value?.cities?.[0], head = (O && skyHeadline(O)) || wx(c.current.code)[1];
  const air = c.air?.now, day = away ? sunAt(c.lat, c.lon, n).alt > 0 : !isNight(Number(istTime(new Date(n).toISOString()).slice(0, 2)));
  const read = (k, v, w = "") => `<span><i>${k}</i><b class="tnum">${v}</b>${w ? ` ${esc(w)}` : ""}</span>`;
  // by night the day line already gives the moon, so the readings do not repeat it
  const reads = [day && d0.rain_prob != null ? read("Rain", `${d0.rain_prob}%`, "today") : sun ? "" : read("Moon", `${Math.round(moonNow(n).lit * 100)}%`, "lit"),
    air != null ? read("Air", String(air), airWord(air)) : "", c.current.humidity != null ? read("Humidity", `${c.current.humidity}%`) : ""].join("");
  const others = (W || []).filter(x => x.current && x.name !== c.name).map(x => `<span><b>${esc(x.name)}</b> <span class="tnum">${Math.round(x.current.temp)}°</span> ${esc(wx(x.current.code)[1].toLowerCase())}</span>`).join("");
  // the place is always named, home too (Parth, 3 Oct: "the weather does not mention that it is by default for
  // Bengaluru; that is very confusing")
  return `<div class="wx3${away ? " away" : ""}">${away ? `<p class="wxplace">${esc(away.name)}${away.region && away.region !== away.name ? `<span>, ${esc(away.region)}</span>` : ""}</p>` : `<p class="wxplace">${esc(c.name || CFG.paper.home_city || "Bengaluru")}</p>`}<div class="now"><span class="t tnum">${Math.round(c.current.temp)}°</span><div class="c"><b>${esc(head)}</b><span class="tnum">Feels ${Math.round(c.current.feels)}° · High ${Math.round(d0.max)}° · Low ${Math.round(d0.min)}°</span></div></div>
${sun}<p class="reads">${reads}</p>${others ? `<p class="elsewhere">${others}</p>` : ""}</div>${staleNote("weather")}`;
}
// Money (Parth, 1 Oct: "The % change is 1 day change? What do you show on a weekend?"): each figure's change on its
// latest session, headed 1D; a dot and a line say whether the market is live or closed, and which session's close
// the figure is when it is closed (Friday's on a weekend).
function moneyHTML() {
  const M = LIVE.markets?.value; if (!M?.indices?.length) return "";
  const q = n => M.indices.find(x => x.name === n), sx = q("Sensex"), nf = q("Nifty 50"), sp = q("S&P 500"), br = (M.cross || []).find(x => /brent/i.test(x.name)), fx = (M.cross || []).find(x => /USD\/INR/i.test(x.name)), G = LIVE.gold_in?.value;
  const closeOf = x => (x?.live ? "" : x?.session_date && x.session_date !== istDate() ? ` <small>${esc(fmt(x.session_date + "T12:00:00Z", { weekday: "short" }))}</small>` : "");
  const dot = x => `<i class="mdot ${x?.live ? "on" : ""}" title="${esc(x ? hoursLine(x) : "")}"></i>`;
  const row = (nm, v, c, x) => `<tr><td class="l">${x ? dot(x) : ""}${nm}${closeOf(x)}</td><td class="v tnum">${v}</td><td class="r tnum ${dir(c)}">${pct(c)}</td></tr>`;
  const mood = m => (m ? `<span>${esc(m.region)} mood<b class="${m.score < 45 ? "dn" : m.score > 55 ? "up" : ""}">${m.score} · ${esc(String(m.word || moodWord(m.score)).toLowerCase())}</b></span>` : "");
  return `<div class="mny">${sx ? `<div class="sx"><span class="k">Sensex</span><b class="tnum">${inr(sx.price)}</b><span class="tnum ${dir(sx.change_pct)}">${pct(sx.change_pct)}</span><span class="k">1D</span></div><p class="mst">${dot(sx)}${esc(hoursLine(sx))}</p>` : ""}
<table><thead><tr><th></th><th></th><th class="r">1D</th></tr></thead><tbody>${nf ? row("Nifty 50", inr(nf.price), nf.change_pct, nf) : ""}${sp ? row("S&P 500", inr(sp.price), sp.change_pct, sp) : ""}${fx ? `<tr><td class="l">USD/INR</td><td class="v tnum">₹${fx.price.toFixed(2)}</td><td class="r tnum">${pct(fx.change_pct)}</td></tr>` : ""}${br ? row("Brent", "$" + br.price.toFixed(2), br.change_pct, br.live != null ? br : null) : ""}${G?.per_10g_24k ? row("Gold 24K", "₹" + inr(G.per_10g_24k), G.change_pct) : ""}</tbody></table>
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
  // live prices where the market is in the live feed (every 5 minutes), else the edition's own
  const liveM = !LIVE.betting?.stale && LIVE.betting?.value?.markets || [], idOf = b => (b.id?.includes(":") ? b.id : `pm:${b.id}`);
  return `<ol class="bets" style="--c:var(--d-news)">${list.map(b => { const L = liveM.find(m => m.id === idOf(b)), o = [...((L?.outcomes?.length ? L.outcomes : b.outcomes) || [])].sort((x, y) => y.prob - x.prob)[0]; if (!o) return "";
    return `<li data-bet="${esc(b.id)}" tabindex="0" role="button" aria-label="${esc(b.title)}: in detail"><span class="t">${esc(vsV(b.title).replace(/^UEFA /, ""))}</span><span class="o"><b class="tnum">${Math.round(o.prob)}%</b><span>${esc(outcomeLabel(o.name))}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, o.prob))}%"></i></span></span></li>`; }).join("")}</ol>`;
}
// ---------------------------------------------------------------- Since the paper went out (Parth, 2 Oct)
// What changed after this edition was printed, timestamped, from the live figures the page already reads: a market's
// close, a result that was not in at press time (checked against the edition's own press-time snapshot), sunset or
// sunrise at home, and a forecast that has moved since press. It is worked out in the page only: the daily run, the
// edition and the live functions are untouched, and the next edition starts it again from its own print time. News
// after press is not here (it would need a new live source). On a quiet afternoon there is no strip at all.
function printedAt() {
  if (E.printed_at) return Date.parse(E.printed_at);
  const t = Object.values(E.snapshot || {}).map(x => x?.as_of).filter(x => x && x.slice(0, 10) >= E.date).sort().pop();
  return t ? Date.parse(t) : NaN;
}
function sinceItems() {
  if (ROUTE?.kind === "edition") return [];
  const P = printedAt(), n = Date.now(), out = [], snap = E.snapshot || {}; if (!Number.isFinite(P)) return out;
  // every row: its time (when it happened, or when the result came in), a label, the line (Parth, 2 Oct: "one alignment")
  const add = (t, label, desk, text, extra = {}) => { if (t > P && t <= n) out.push({ t, when: istTime(new Date(t).toISOString()), label, desk, text, ...extra }); };
  // a market's close
  const M = LIVE.markets?.value;
  for (const name of ["Sensex", "S&P 500"]) {
    const q = M?.indices?.find(x => x.name === name), ex = CFG.markets.indices.find(i => i.name === name)?.exchange, s = ex && session(ex);
    if (!q || q.live || !s?.closeAt || !Number.isFinite(q.price) || !Number.isFinite(q.change_pct)) continue;
    const at = s.closeAt.getTime(); if (q.session_date && q.session_date !== new Date(at).toLocaleDateString("en-CA", { timeZone: CFG.markets.hours[ex].tz })) continue;
    add(at, "Money", "money", `${name} closed at ${inr(q.price, name === "Sensex" ? 0 : 2)}, ${q.change_pct >= 0 ? "up" : "down"} ${Math.abs(q.change_pct).toFixed(2)}%${q.note ? `: ${q.note.replace(/^./, c => c.toLowerCase())}` : ""}.`);
  }
  // results that were not in at press time
  const C = LIVE.crease?.value?.today, C0 = snap.crease?.value?.today;
  if (C?.state === "done" && !(C0?.id === C.id && C0?.state === "done")) add(Math.min(n, Date.parse(LIVE.crease.as_of || n)), "Result", "sport", `India v ${C.opponent}, ${C.desc}: ${C.status}${C.score ? ` (${C.score})` : ""}.`);
  const L = LIVE.football?.value?.last, L0 = snap.football?.value?.last;
  if (L?.completed && L.score && L.id !== L0?.id) add(Math.min(n, Date.parse(LIVE.football.as_of || n)), "Result", "sport", `${CFG.follows.football_club.name} ${L.winner === "us" ? "won" : L.winner === "them" ? "lost" : "drew"} ${L.score.us}–${L.score.them} ${L.home ? "v" : "at"} ${L.opponent} (${L.competition}).`);
  for (const p of LIVE.tennis_players?.value?.players || []) {
    const x = p.last, x0 = (snap.tennis_players?.value?.players || []).find(q => q.name === p.name)?.last;
    if (!x?.when_utc || (x0 && x0.when_utc === x.when_utc)) continue;
    const sc = setScore(x.note);
    add(Math.min(n, Date.parse(LIVE.tennis_players.as_of || n)), "Result", "sport", `${lastName(p.name)} ${x.won ? "beat" : "lost to"} ${x.opponent}${sc ? ` ${sc}` : ""}, ${x.event}${x.round ? `, ${x.round}` : ""}.`);
  }
  const F = LIVE.f1_last?.value, F0 = snap.f1_last?.value;
  if (F?.results?.length && F.date !== F0?.date) {
    const win = F.results[0], me = F.results.find(r => r.name === CFG.follows.f1_driver?.name);
    add(Math.min(n, Date.parse(LIVE.f1_last.as_of || n)), "Result", "sport", `${win.name} won the ${F.name}${me && me !== win ? `; ${lastName(me.name)} ${me.pos ? `P${me.pos}` : me.status}` : ""}.`);
  }
  // internationals: a result for a national team followed (config follows.national_teams), or for any match the
  // Betting Window carried, that came in after print (Parth, 2 Oct: "for France v Italy, why are we showing the
  // forecast and not the score?")
  const IN = LIVE.intl_football?.value?.matches || [], IN0 = snap.intl_football?.value?.matches || [], nations = CFG.follows?.national_teams || [];
  const LEAGUE = { "uefa.nations": "Nations League", "fifa.friendly": "friendly", "fifa.worldq.uefa": "World Cup qualifier", "uefa.euroq": "Euro qualifier", "fifa.world": "World Cup", "uefa.euro": "Euro" };
  const betOn = m => (E.betting || []).some(b => b.title && b.title.includes(m.home) && b.title.includes(m.away));
  const decided = [];
  for (const m of IN) {
    if (m.state !== "post" || !m.score || !(nations.includes(m.home) || nations.includes(m.away) || betOn(m))) continue;
    if (IN0.find(x => x.home === m.home && x.away === m.away && x.when_utc === m.when_utc)?.state === "post") continue;
    const lg = LEAGUE[m.league] || "";
    add(Math.min(n, Math.max(Date.parse(m.when_utc) + 115 * 6e4, P + 6e4)), "Result", "sport", `${m.home} ${String(m.score).replace(/\s*-\s*/, "–")} ${m.away}${lg ? `, ${lg}` : ""}.`);
    decided.push(m);
  }
  // sunset and sunrise at home
  const c = LIVE.weather?.value?.cities?.[0], off = c?.utc_offset_seconds ?? 19800;
  for (const d of (c?.daily || []).slice(0, 2)) for (const [k, v] of [["Sunset", d.sunset], ["Sunrise", d.sunrise]]) {
    const t = localMs(v, off); if (Number.isFinite(t) && c?.current) add(t, "Weather", "home", `${k} in ${CFG.paper.home_city}; now ${Math.round(c.current.temp)}° and ${wx(c.current.code)[1].toLowerCase()}.`);
  }
  // a forecast that has moved since press
  const liveM = !LIVE.betting?.stale && LIVE.betting?.value?.markets || [], min = CFG.betting?.carry?.min_move_pts || 5;
  // a market at 99% or 1% has been decided: it is a result, not a forecast, and is never printed as one
  const settled = Lm => (Lm.outcomes || []).some(o => o.prob >= 99 || (Lm.outcomes.length === 2 && o.prob <= 1));
  const moves = (E.betting || []).filter(b => !decided.some(m => b.title?.includes(m.home) && b.title?.includes(m.away))).map(b => { const Lm = liveM.find(m => m.id === (b.id?.includes(":") ? b.id : `pm:${b.id}`)); if (!Lm || settled(Lm)) return null; const o = [...(Lm.outcomes || [])].sort((x, y) => y.prob - x.prob)[0], w = o && b.outcomes?.find(q => q.name === o.name)?.prob; return o && w != null ? { b, o, w, d: o.prob - w } : null; })
    .filter(x => x && Math.abs(x.d) >= min).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 1);
  for (const m of moves) add(Math.min(n, Date.parse(LIVE.betting.as_of || n)), "Forecast", "news", `${vsV(m.b.title).replace(/^UEFA /, "")} · ${outcomeLabel(m.o.name)} ${Math.round(m.o.prob)}% now (${Math.round(m.w)}% at press).`, { forecast: true, bet: m.b.id });
  return out.sort((x, y) => x.t - y.t).slice(-4);
}
function sinceHTML() {
  const it = sinceItems(); if (!it.length) return "";
  const P = printedAt(), name = id => NEWDESKS.find(d => d.id === id)?.name || "";
  return `<section class="after14" aria-label="Since we printed"><div class="lab"><span><i></i>Since we printed<b class="tnum">${esc(istTime(new Date(P).toISOString()))}</b></span></div><ol>${it.map(x => `<li class="${x.forecast ? "fc" : ""}"${x.bet ? ` data-bet="${esc(x.bet)}" tabindex="0" role="button"` : ""}><span class="a14t tnum">${esc(x.when)}</span><span class="a14l">${esc(x.label || name(x.desk))}</span><span class="a14x">${esc(x.text)}</span></li>`).join("")}</ol></section>`;
}

const blk = (id, desk, title, link, to, body, extra = "") => (body ? `<section class="blk" id="p1-${id}" style="--c:var(--d-${desk})"><div class="bh"><h2>${title}</h2>${extra}<a href="${deskHref(desk)}" data-desk="${desk}" data-to="${to}">${link} →</a></div><div data-p1="${id}">${body}</div></section>` : "");
function pageOne() {
  return `<div class="p1"><div id="p1-since" data-p1="since">${sinceHTML()}</div><div class="p1body"><div class="stack c1"><section class="news" id="p1-minute"><div class="bh" style="--c:var(--d-one)"><h2>The day in a minute</h2><a href="${deskHref("news")}" data-desk="news">All the news →</a></div><div data-p1="minute">${minuteHTML(p1lines)}</div></section><div class="eve" id="p1-eve" data-p1="evening">${eveningHTML()}</div></div>
<div class="stack c2">${blk("money", "money", "Money", "The Ledger", "ledger", moneyHTML())}${blk("sport", "sport", "Sport this week", "Sport", "fixtures", sportHTML(6))}</div>
<div class="stack c3">${blk("weather", "home", "Weather", "Sky &amp; Streets", "sky", weatherHTML(), `<span class="bhx" data-p1="wxhead">${hereHead()}</span>`)}${blk("bets", "news", "The market expects", "Betting Window", "betting", betsHTML(3))}</div></div></div>`;
}
function oneFoot() {
  const nx = NEWDESKS[1] || NEWDESKS[0];
  return `<div class="p1end">${E.house_note ? `<p class="hn"><b>House Note</b><span>${esc(E.house_note)}</span></p>` : ""}<div class="foot">${footNav()}<a class="next" href="${deskHref(nx.id)}" data-desk="${nx.id}">Start reading: ${esc(nx.name)} →</a></div></div>`;
}
// Live figures repaint the blocks in place (the edition's own lines never change)
function paintOne() {
  const parts = { wxhead: hereHead, since: sinceHTML, minute: () => minuteHTML(p1lines), evening: eveningHTML, weather: weatherHTML, sport: () => sportHTML(6), money: moneyHTML, bets: () => betsHTML(3) };
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
// Page One's blocks find their column (Parth, 2 Oct, on a MacBook Air: "so much white space, and what happened to
// the font size?"). The page scales until its tallest column fits the screen, so one tall column (Weather with
// Sport this week) shrank everything and left the others half empty. On a laptop or monitor the day in a minute
// keeps the first column; the other blocks (Weather, Sport this week, Money, The market expects, and the evening pick,
// which goes last in whichever column it joins) may sit in any column, in that order within it. The news column is
// tried at three widths, its lines in one column or two, and the layout with the shortest tallest column wins (the
// usual one unless another is clearly shorter). Each block is measured once in each column, so every arrangement is
// worked out, not laid out. Phones and narrow windows keep the usual order, with the Since strip across the top.
// On a laptop the Since strip is one more block, last in its column (on a phone it runs across the top).
// Money ranks above Weather (Parth, 2 Oct: "at least for the front page, let's make money more important than
// weather"): it opens the middle column, and wherever the two share a column Money comes first.
const P1BLOCKS = ["money", "weather", "sport", "bets", "eve", "since"], P1HOME = [1, 2, 1, 2, 0, 0], P1WIDE = [1.5, 1.25, 1];
function balanceOne() {
  const body = document.querySelector(".p1body"), news = document.getElementById("p1-minute"), cols = [...document.querySelectorAll(".p1body > .stack")];
  if (!body || !news || cols.length !== 3) return;
  const blocks = P1BLOCKS.map(id => document.getElementById(`p1-${id}`));
  const layout = (a, r, one) => {
    body.style.gridTemplateColumns = r ? `minmax(0,${r}fr) minmax(0,1fr) minmax(0,1fr)` : "";
    news.classList.toggle("onecol", !!one);
    blocks.forEach((b, i) => b && cols[a[i]].append(b));
  };
  layout(P1HOME);
  const since = document.getElementById("p1-since");
  if (innerWidth <= 1100) { if (since) body.before(since); return; }
  const gap = parseFloat(getComputedStyle(cols[0]).rowGap) || 0, hOf = el => (el && el.childElementCount ? el.getBoundingClientRect().height : 0);
  const stackH = hs => { const on = hs.filter(h => h > 0); return on.reduce((x, h) => x + h, 0) + gap * Math.max(0, on.length - 1); };
  const options = [];
  for (const r of P1WIDE) {
    // each block's height in each column at this width (a block's height depends only on its column's width)
    const H = [0, 1, 2].map(c => { layout(blocks.map(() => c), r); return blocks.map(hOf); });
    for (const one of [false, true]) {
      layout(P1HOME, r, one); const minute = hOf(news);
      for (let code = 0; code < 3 ** blocks.length; code++) {
        const a = blocks.map((_, i) => Math.floor(code / 3 ** i) % 3);
        const tall = Math.max(...[0, 1, 2].map(c => stackH([c === 0 ? minute : 0, ...blocks.map((_, i) => (a[i] === c ? H[c][i] : 0))])));
        options.push({ tall, a, r, one, home: r === 1.5 && !one && a.every((x, i) => x === P1HOME[i]) });
      }
    }
  }
  const home = options.find(o => o.home), best = options.reduce((x, o) => (o.tall < x.tall ? o : x), home);
  const pick = best.tall < home.tall * 0.97 ? best : home;
  layout(pick.a, pick.home ? 0 : pick.r, pick.one);
}
// Page One: one screen. Every one of the editor's lines prints; the page takes the full width and scales (0.62 to
// 2.2) until it fills the height. Only on a screen too short even then does it drop lines, never below five.
// It never scrolls on a laptop (Parth, 2 Oct: "the first page logic was specifically to not have to scroll"); the type
// stays large because the blocks balance (balanceOne) and the fixed parts are compact: the House Note and the foot share
// one row, the Since strip is one line.
function fitOne() {
  setZoom(1, 0);
  if (DESK.id !== "one" || !document.querySelector(".p1end")) return;
  const bottom = s => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0;
  if (p1lines !== P1MAX) { p1lines = P1MAX; paintOne(); }
  const W = innerWidth;
  balanceOne();
  if (W < 1000) return;
  setZoom(1, W); balanceOne(); // arrange at the screen's own width, then scale
  const at = (z, s = ".p1end") => { setZoom(z, Math.min(W / z, 2600)); return bottom(s) <= innerHeight; };
  const LO = 0.8; // lines are dropped (never below five) before the type goes under this
  while (!at(LO) && p1lines > P1MIN) { p1lines--; paintOne(); }
  const search = (s, top) => {
    let lo = LO, hi = Math.max(LO, top);
    if (at(hi, s)) return hi;
    for (let k = 0; k < 14; k++) { const z = (lo + hi) / 2; if (at(z, s)) lo = z; else hi = z; }
    return lo;
  };
  // the type never goes below 0.8 of its size (body text about 12.5px; QA, 2 Oct: a 1080p Windows laptop at 150% has
  // a window only 595px tall, and fitting it all printed the text at 10.5px). Only such a short window scrolls, a little.
  const scale = () => Math.max(0.8, search(".p1end", Math.min(W / 1100, 2.2)));
  // the page's width changes with its scale, so arrange again at the scale found, then scale once more
  at(scale()); balanceOne(); at(scale());
}
let unmountMark = () => {};
// The day in dots: each desk's share of today's paper, in words, in the tabs' order (storiesFromEdition)
let shareMemo = null;
function dayShares() {
  if (shareMemo?.E === E) return shareMemo.v;
  const desks = NEWDESKS.filter(d => d.id !== "one");
  const pieces = storiesFromEdition(E, desks.map(d => ({ id: d.id, name: d.name, sections: d.sections })));
  const v = desks.map(d => ({ desk: d.id, name: d.name, words: pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0) })).filter(x => x.words);
  shareMemo = { E, v }; return v;
}
const sharesLabel = shares => { const all = shares.reduce((a, x) => a + x.words, 0) || 1; return `1400: today's paper by desk, ${shares.map(x => `${x.name} ${Math.round(100 * x.words / all)}%`).join(", ")}`; };
// What a tap on the wordmark cycles through (config desks_v2.wordmark), worked out at the moment of the tap
const SKY1 = c => (c <= 1 ? "sun" : c <= 3 ? "Cloudy" : c <= 48 ? "Foggy" : c <= 57 ? "Drizzle" : c <= 67 || (c >= 80 && c <= 82) ? "Rainy" : c <= 77 || c === 85 || c === 86 ? "Snowy" : c >= 95 ? "Stormy" : "Cloudy");
function markCycle() {
  const away = awayCity(), w = (away || LIVE.weather?.value?.cities?.[0])?.current, hh = Number(istTime(new Date().toISOString()).slice(0, 2));
  return (CFG.desks_v2?.wordmark?.cycle || ["1400"]).map(x => {
    if (x === "temperature") return w ? `${Math.round(w.temp)}°` : "";
    // what it feels like, when that differs from the reading (Parth, 2 Oct: "can we also not show what it feels like?")
    if (x === "feels") return w && Number.isFinite(w.feels) && Math.round(w.feels) !== Math.round(w.temp) ? `Feels ${Math.round(w.feels)}°` : "";
    if (x === "sky") { if (!w) return ""; const k = SKY1(w.code); return k === "sun" ? ((away ? sunAt(away.lat, away.lon, Date.now()).alt <= 0 : isNight(hh)) ? "Clear" : "Sunny") : k; }
    if (x === "time") return istTime(new Date().toISOString());
    return String(x);
  });
}
// "The HOUSE OF" on the centre line of what follows it (Parth, 2 Oct: "shouldn't the house of be vertically
// centre-aligned with 24 here? Same for Clear ... with whatever comes next"). Measured, not guessed: the middle of the
// capitals of HOUSE OF (from the font's own measure, at its baseline) against the middle of the ink the dots form; and
// the gap from "OF" to the ink is the same for every shape, so a narrower shape draws the words along with it and the
// nameplate stays centred. The words glide as the dots re-form.
function capsMid(hof, z) {
  const p = document.createElement("span"); p.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  hof.append(p); const base = p.getBoundingClientRect().top; p.remove();
  const cs = getComputedStyle(hof), c = document.createElement("canvas").getContext("2d"); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = c.measureText(String(hof.textContent).toUpperCase());
  return base - z * (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}
const zoomOf = () => parseFloat(document.getElementById("dtop")?.style.zoom) || 1;
let plateInk = null, plateGeom = null;
function alignPlate(b = plateInk) {
  plateInk = b;
  const plate = document.getElementById("bigplate"), w = plate?.querySelector(".words"), hof = w?.querySelector(".hof"), n = plate?.querySelector(".n");
  if (!b || !plateGeom || !w || !hof || !n || !plate.offsetParent) return;
  const z = zoomOf(), first = !w.style.transform;
  const was = w.style.transform; w.style.transition = "none"; w.style.transform = "none";
  const nr = n.getBoundingClientRect(), hr = hof.getBoundingClientRect(), ls = parseFloat(getComputedStyle(hof).letterSpacing) || 0;
  const mid = nr.top + z * (b.y0 + b.y1) / 2, left = nr.left + z * (plateGeom.px + b.x0), cm = capsMid(hof, z);
  const dx = (left - z * plateGeom.size * 0.12 - (hr.right - z * ls)) / z, dy = (mid - cm) / z;
  w.style.transform = was; void w.offsetWidth; if (!first) w.style.transition = "";
  w.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  if (first) requestAnimationFrame(() => { w.style.transition = ""; });
}
// the desk pages' small nameplate: the same centre line, on the still figure (its ink's middle is 0.006 of the size
// below the middle of its canvas: the outline runs from 0.722 above the baseline to 0.014 below, wordmark.js)
function alignMini() {
  const np = document.querySelector("#dtop .np"), w = np?.querySelector(".words"), hof = w?.querySelector(".hof"), c = np?.querySelector(".n canvas");
  if (!c || !hof || !np.offsetParent) return;
  const z = zoomOf(), size = parseFloat(getComputedStyle(np.querySelector(".n")).fontSize) || 28;
  w.style.transform = "none";
  const cr = c.getBoundingClientRect(), mid = cr.top + cr.height / 2 + z * size * 0.006, dy = (mid - capsMid(hof, z)) / z;
  w.style.transform = `translateY(${dy.toFixed(1)}px)`;
}
let alignT = 0;
addEventListener("resize", () => { clearTimeout(alignT); alignT = setTimeout(() => { alignPlate(); alignMini(); }, 120); });
document.fonts?.ready.then(() => { alignPlate(); alignMini(); });

function mountMark() {
  unmountMark(); unmountMark = () => {};
  const n = document.querySelector("#bigplate .n"); if (!n || DESK.id !== "one") return;
  const size = parseFloat(getComputedStyle(document.querySelector("#bigplate")).getPropertyValue("--np")) || 96;
  // the figure's canvas carries room for the swell and the weather round the ink; take it back so 1400 sits on the line
  // close to "HOUSE OF" (the ink runs from 0.028 to 2.294 em of the outline's advance, wordmark.js)
  const W0 = Math.ceil(ADV * size + size * 0.5), PX0 = Math.round(W0 * 0.2), pad = (W0 - ADV * size) / 2;
  n.style.margin = `0 ${-(PX0 + pad + (ADV - 2.294) * size).toFixed(1)}px 0 ${-(PX0 + pad + 0.028 * size).toFixed(1)}px`;
  plateGeom = { size, px: PX0 };
  const shares = dayShares();
  n.setAttribute("aria-label", sharesLabel(shares));
  // the stamp prints the figure once per visit (a browser session), the first time Page One shows
  let press = false; try { press = !sessionStorage.getItem("h1400-pressed"); sessionStorage.setItem("h1400-pressed", "1"); } catch {}
  mountWordmark(n, { size, shares, cycle: markCycle, homeAfter: CFG.desks_v2?.wordmark?.home_after_s || 6, weather: markWeather, press, onShape: b => alignPlate(b) }).then(u => { unmountMark = u; alignPlate(); }).catch(() => {});
}
// The pinned tab bar: once the masthead is off the screen, Page One's tab shows the day in dots instead of its name.
let tabObs = null;
function tabMark() {
  const tm = document.querySelector("#dtabs .tmk"); if (!tm || !E) return;
  stillWordmark(tm, { size: 20, shares: dayShares() }).catch(() => {});
  if (!tabObs && "IntersectionObserver" in window) {
    tabObs = new IntersectionObserver(es => { for (const e of es) document.getElementById("dtabs")?.classList.toggle("stuck", !e.isIntersecting); });
    const top = document.getElementById("dtop"); if (top) tabObs.observe(top);
  }
}
// The desk pages' small 1400: the same split, still (Parth, 2 Oct). Drawn once per edition and size.
addEventListener("resize", () => { if (NEWDESKS.length && DESK.id !== "one") mountMini(); });
let miniKey = "", unmountMini = () => {};
function mountMini() {
  const n = document.querySelector("#dtop .np .n"); if (!n || !E) return;
  const size = parseFloat(getComputedStyle(n).fontSize) || 28, key = `${E.date}|${size}`;
  if (key === miniKey && n.querySelector("canvas")) return;
  miniKey = key; unmountMini(); unmountMini = () => {};
  const shares = dayShares();
  stillWordmark(n, { size, shares }).then(u => { unmountMini = u; alignMini(); }).catch(() => {});
}

// ---------------------------------------------------------------- the read time, in the run line (Parth, 2 Oct)
// The renderer works it out as before (headlines at a skimming pace; every word at a reading pace plus the tables);
// the run line prints it plainly: "34 min read · 3 to skim".
function readLine() {
  const el = $("#r-read"), m = ($("#readtime")?.textContent || "").match(/Headlines: (\d+) min · Everything: (\d+) min/); if (!el || !m) return;
  const h = `<b>${m[2]} min</b> read<span class="skim"> · ${m[1]} to skim</span>`;
  if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; }
}

// ---------------------------------------------------------------- The Week Ahead, Monday to Sunday (Parth, 2 Oct)
// Seven columns, one per day from the edition's Monday; what to watch under each, with its time and section; a day
// with nothing is a short rule, never words. On a phone the days stack.
function weekV2() {
  const W = (E.week_ahead || []).slice().sort((a, b) => (a.date + (a.time_ist || "99")).localeCompare(b.date + (b.time_ist || "99")));
  if (!W.length) return "";
  const d0 = Date.parse(E.date + "T12:00:00+05:30"), days = [...Array(7)].map((_, i) => istDate(new Date(d0 + i * 864e5)));
  const col = d => { const list = W.filter(w => w.date === d), k = deskOf(list[0]?.area)?.id;
    return `<div class="wcol${d === istDate() ? " today" : ""}"><h4><span>${esc(fmt(d + "T12:00:00+05:30", { weekday: "short" }))}</span> ${esc(String(Number(d.slice(8))))}</h4>${list.length ? `<ul>${list.map(w => `<li style="--c:var(--d-${deskOf(w.area)?.id || "news"})">${w.time_ist ? `<span class="wt tnum">${esc(w.time_ist)}</span>` : ""}<span class="wk">${esc(sec(w.area)?.short || "")}</span><b>${esc(w.what)}</b>${w.why ? `<p>${esc(w.why)}</p>` : ""}</li>`).join("")}</ul>` : `<i class="wnone" aria-label="Nothing listed"></i>`}</div>`; };
  return `<div class="week7">${days.map(col).join("")}</div>`;
}

// ---------------------------------------------------------------- the archive, as a calendar (Parth, 2 Oct)
// Month by month, newest first, Monday to Sunday. A printed day is a tile: the date, the lead, how many items, a dot
// for the Sensex's close (green up, red down), and a strip of the day's paper by desk in the desks' colours, as the
// wordmark has it. A day without an edition is an empty dashed square. Each tile opens that day's paper.
async function archiveV2() {
  desksInit();
  document.title = "Archive · The House of 1400";
  document.body.classList.remove("on-one"); document.documentElement.style.setProperty("--d", "var(--d-one)");
  let days = [];
  try { days = await getJSON("/archive-days.json"); } catch { try { days = (await getJSON("/content/archive.json")).editions.map(e => ({ date: e.date, no: e.edition_no, lead: e.lead })); } catch { days = []; } }
  days.sort((a, b) => b.date.localeCompare(a.date));
  $("#r-date").textContent = "The Archive"; $("#r-no").textContent = ""; $("#r-print").textContent = `${days.length} edition${days.length === 1 ? "" : "s"}`; $("#r-read").textContent = "";
  $("#r-tag").textContent = CFG.paper.motto;
  $("#now").innerHTML = `<a href="/"><span class="k">Today's paper</span> →</a>`;
  $("#dtabs ol").innerHTML = NEWDESKS.map(d => `<li><a href="/${deskHref(d.id)}" style="--c:var(--d-${d.id})">${esc(d.name)}</a></li>`).join("");
  const by = new Map(days.map(d => [d.date, d])), months = [...new Set(days.map(d => d.date.slice(0, 7)))];
  const name = ym => new Date(ym + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = istDate(), first = days.at(-1)?.date || today;
  const month = ym => {
    const [y, m] = ym.split("-").map(Number), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // the month runs to its last day, or, in the current month, to the end of this week
    const t = today.startsWith(ym) ? Number(today.slice(8)) : 0, n = t ? Math.min(last, t + (6 - (lead + t - 1) % 7)) : last;
    const cells = [...Array(lead)].map(() => `<li class="pad" aria-hidden="true"></li>`);
    for (let d = 1; d <= n; d++) {
      const ds = `${ym}-${String(d).padStart(2, "0")}`, e = by.get(ds);
      if (!e && ds < first) { cells.push(`<li class="pad" aria-hidden="true"></li>`); continue; } // before the first edition
      if (!e) { cells.push(`<li class="${ds > today ? "fut" : "none"}${ds === today ? " today" : ""}"><span class="adn">${d}</span></li>`); continue; }
      const strip = (e.desks || []).map(([k, v]) => `<i style="flex:${v};background:var(--d-${k})"></i>`).join("");
      const mk = e.sensex == null ? "" : `<span class="mk ${e.sensex >= 0 ? "rise" : "fall"}" title="Sensex ${e.sensex >= 0 ? "+" : ""}${e.sensex}%"><i></i>${e.sensex >= 0 ? "+" : ""}${e.sensex}%</span>`;
      cells.push(`<li class="ed${ds === today ? " today" : ""}"><a href="/e/${ds}"><span class="adn">${d}</span>${mk}<b>${esc(e.lead || "")}</b><span class="meta">No. ${e.no}${e.items ? ` · ${e.items} items` : ""}</span>${strip ? `<span class="strip" aria-hidden="true">${strip}</span>` : ""}</a></li>`);
    }
    return `<section class="amonth"><h2>${esc(name(ym))}</h2><ol class="awk" aria-hidden="true">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(w => `<li>${w}</li>`).join("")}</ol><ol class="acal">${cells.join("")}</ol></section>`;
  };
  $("#main").innerHTML = `<header class="dopen"><h1>The Archive</h1><p class="asub">Every edition, by the day. The strip under each day is that day's paper by desk; the dot is how the Sensex closed.</p></header>${days.length ? months.map(month).join("") : ""}<footer class="dfoot">${footNav()}<span>The House of 1400</span></footer>`;
  fitDesk();
}

// ---------------------------------------------------------------- live figures and charts (Parth, 2 Oct)
// A live figure that changes (a score, an index, a price) flashes once in ink, so the eye catches what just moved;
// countdowns, which change every minute, never flash. Charts and bars draw themselves in once, in 300ms, the first
// time they come into view on a desk; a live repaint never draws them again. Both are off with reduced motion.
const FX = { seen: new Map(), drawn: new Set(), desk: "", io: null, wait: new Map() };
const stillPage = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function liveFx() {
  if (FX.desk !== DESK.id) { FX.desk = DESK.id; FX.seen = new Map(); FX.drawn.clear(); }
  const first = !FX.seen.size, now = new Map();
  for (const box of document.querySelectorAll("#main [data-live], #main [data-p1], #now")) {
    const k = box.dataset.live || box.dataset.p1 || box.id;
    box.querySelectorAll(".tnum").forEach((el, i) => {
      const t = el.textContent.trim(); if (!/\d/.test(t) || /\d\s*[hdm]\b/.test(t)) return;
      const key = `${k}|${i}`, was = FX.seen.get(key); now.set(key, t);
      if (!first && was != null && was !== t && !stillPage()) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
    });
  }
  FX.seen = now;
  if (stillPage() || !("IntersectionObserver" in window)) return;
  FX.io ||= new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; FX.io.unobserve(e.target); const key = FX.wait.get(e.target); FX.wait.delete(e.target); if (FX.drawn.has(key)) return; FX.drawn.add(key); drawIn(e.target); }), { rootMargin: "0px 0px -6% 0px" });
  const count = new Map(), keyOf = (el, kind) => { const box = el.closest("[data-live],[data-p1],section.sec"), b = box?.dataset.live || box?.dataset.p1 || box?.id || "page", c = `${b}|${kind}`, n = count.get(c) || 0; count.set(c, n + 1); return `${c}|${n}`; };
  const lines = [...document.querySelectorAll('#main svg path[fill="none"], #main .arc polyline.done')].filter(el => getComputedStyle(el).strokeDasharray === "none");
  const bars = [...document.querySelectorAll('#main [style*="width:"]')].filter(el => !el.textContent.trim() && !el.querySelector("img,svg,canvas") && el.offsetHeight > 0 && el.offsetHeight <= 16);
  for (const [el, kind] of [...lines.map(el => [el, "line"]), ...bars.map(el => [el, "bar"])]) {
    const key = keyOf(el, kind); if (FX.drawn.has(key)) continue;
    el.dataset.draw = kind; FX.wait.set(el, key); FX.io.observe(el);
  }
}
function drawIn(el) {
  const ease = "cubic-bezier(.2,0,0,1)";
  if (el.dataset.draw === "line") {
    let L = 0; try { L = el.getTotalLength?.() || 0; } catch { return; } if (!L) return;
    el.style.strokeDasharray = L;
    el.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 300, easing: ease }).onfinish = () => { el.style.strokeDasharray = ""; };
  } else {
    el.style.transformOrigin = "left center";
    el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 300, easing: ease });
  }
}

// ---------------------------------------------------------------- moving between desks
function showDesk(id, to, open) {
  desksInit();
  const d = NEWDESKS.find(x => x.id === id) || NEWDESKS[0];
  const same = d === DESK; DESK = d;
  if (!same) { render(); scrollTo({ top: 0 }); }
  if (location.hash !== deskHref(d.id)) history.replaceState(null, "", deskHref(d.id));
  requestAnimationFrame(() => {
    fitMonitor(); if (d.id === "one") mountMark(); else { unmountMark(); mountMini(); } liveFx();
    if (to) { const el = document.getElementById(to) || document.getElementById("s-" + to); if (el) { if (open && el.tagName === "DETAILS") el.open = true; setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), same ? 0 : 60); } }
  });
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-desk]"); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  if (!E) { location.href = "/" + deskHref(a.dataset.desk); return; } // the archive has no edition: go to today's paper
  showDesk(a.dataset.desk, a.dataset.to, !!a.dataset.open);
}, true);
// The old design stays one tap away until Parth switches (?v1 forgets the choice on this device)
document.addEventListener("click", e => { if (e.target.closest("[data-v1]")) { try { localStorage.removeItem("h1400-design"); } catch {} } }, true);
// Day and night, in the run line (the old masthead's switch is not on this page). By default the page follows the sun
// in the home city (Parth, 2 Oct): night from sunset to sunrise, checked every minute. Night or Day chosen by hand is
// kept on this device (h1400-theme) until "Auto" hands it back to the sun.
const isDark = () => { const r = document.documentElement; return r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches); };
const chosen = () => { try { return localStorage.getItem("h1400-theme"); } catch { return null; } };
function setTheme(mode) {
  const r = document.documentElement;
  if (r.getAttribute("data-theme") !== mode) r.setAttribute("data-theme", mode);
  // the phone's own bar takes the paper's colour
  const paper = getComputedStyle(r).getPropertyValue("--paper").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.removeAttribute("media"); if (paper) m.setAttribute("content", paper); });
  dthemeLabel();
}
function followSun() {
  if (chosen()) return;
  const h = CFG?.weather?.always?.[0]; if (!h) return;
  setTheme(h1400Day(h.lat, h.lon, Date.now())[0] ? "light" : "dark");
}
function dthemeLabel() {
  const b = $("#dtheme"), a = $("#dauto"); if (!b) return;
  b.textContent = isDark() ? "Day" : "Night";
  if (a) a.hidden = !chosen();
}
setInterval(followSun, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) followSun(); });
document.addEventListener("click", e => {
  if (e.target.closest("#dtheme")) {
    const mode = isDark() ? "light" : "dark";
    try { localStorage.setItem("h1400-theme", mode); } catch {}
    setTheme(mode);
  } else if (e.target.closest("#dauto")) {
    try { localStorage.removeItem("h1400-theme"); } catch {}
    followSun();
  }
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

// ---------------------------------------------------------------- Sky & Streets' chart, drawn for the new design
// Parth, 2 Oct, on Ranchi and Prayagraj: "what has happened to the charts here? This was our redesign?" The chart
// approved on 1 Oct (design/weather, round three) was still drawn in the old style: gradient pills, pill-shaped air
// chips, a black outline round this week, and a legend that ran into "MONTH TO MONTH". Same figures, same two panels
// on one scale, drawn as the rest of the paper is: a flat bar from the night's low to the day's high with a warm tick
// at the top and a cool one at the foot, the usual month as a pale band behind its bar, this week as a tinted column,
// the air as a figure beside a small square of its colour. No gradients, no pills.
function skyChart(o, { w = 640, compact = false } = {}) {
  const W = o.weeks.map((x, i) => ({ l: ["Last week", "This week", "Next week"][i], s: i ? `from ${dmShort(x.from)}` : "measured", hi: x.hi, lo: x.lo, aq: x.aqi, now: i === 1 }));
  const M = o.months.map(x => ({ l: MONL[+x.month.slice(5) - 1], s: "", hi: x.hi, lo: x.lo, uhi: x.usual_hi, ulo: x.usual_lo, aq: x.usual_aqi, au: 1 }));
  const P = [...W, ...M], all = P.flatMap(p => [p.hi, p.lo, p.uhi, p.ulo]).filter(x => x != null);
  if (!all.length) return "";
  const nW = W.length, t0 = Math.floor(Math.min(...all) - 2), t1 = Math.ceil(Math.max(...all) + 2);
  // the legend sits right of "MONTH TO MONTH" when there is room, else on a line of its own
  const ax = 30, gap = 26, colw = (w - ax - gap) / P.length, mx = ax + gap + nW * colw, legW = 104, legOne = mx + 112 + 16 <= w - legW;
  const top = legOne || !M.length ? 46 : 62, h = (compact ? 216 : 262) + top - 46, bot = 66;
  const y = t => top + (1 - (t - t0) / (t1 - t0)) * (h - top - bot), X = i => ax + (i < nW ? 0 : gap) + i * colw + colw / 2;
  const bw = compact ? 8 : 10, band = bw + (compact ? 14 : 18), lab = 'font-size="10.5" font-weight="700" letter-spacing=".08em" fill="var(--muted)"';
  let s = `<svg class="sky-chart v2c" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(o.name)}: day and night temperatures and the air, week to week and month to month">`;
  // this week's column, tinted
  P.forEach((p, i) => { if (p.now) s += `<rect x="${X(i) - colw / 2 + 4}" y="${top - 26}" width="${colw - 8}" height="${h - top + 24}" fill="color-mix(in srgb, var(--d-home) 7%, transparent)"/>`; });
  s += `<text x="${ax}" y="13" ${lab}>WEEK TO WEEK</text>`;
  if (M.length) {
    s += `<text x="${mx}" y="13" ${lab}>MONTH TO MONTH</text>`;
    const lx = legOne ? w - legW : mx, ly = legOne ? 4 : 22;
    s += `<rect x="${lx}" y="${ly}" width="14" height="11" fill="var(--rule2)"/><text x="${lx + 19}" y="${ly + 9.5}" font-size="10.5" fill="var(--muted)">30-year average</text>`;
  }
  for (let t = Math.ceil(t0 / 5) * 5; t <= t1; t += 5) s += `<line x1="${ax}" x2="${w}" y1="${y(t)}" y2="${y(t)}" stroke="var(--rule2)" stroke-width="1"/><text x="${ax - 6}" y="${y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="var(--muted)">${t}°</text>`;
  if (M.length) s += `<line x1="${ax + nW * colw + gap / 2}" x2="${ax + nW * colw + gap / 2}" y1="${top - 22}" y2="${h - 6}" stroke="var(--rule)"/>`;
  P.forEach((p, i) => {
    if (p.hi == null || p.lo == null) return;
    const cx = X(i), yh = y(p.hi), yl = y(p.lo);
    if (p.uhi != null && p.ulo != null) s += `<rect x="${cx - band / 2}" y="${y(p.uhi)}" width="${band}" height="${Math.max(2, y(p.ulo) - y(p.uhi))}" fill="var(--rule2)"><title>A usual ${esc(p.l)}: ${Math.round(p.uhi)}° by day, ${Math.round(p.ulo)}° at night</title></rect>`;
    s += `<rect class="bar" x="${cx - bw / 2}" y="${yh}" width="${bw}" height="${Math.max(2, yl - yh)}" fill="var(--ink2)"><title>${esc(p.l)}: ${Math.round(p.hi)}° by day, ${Math.round(p.lo)}° at night</title></rect>`;
    s += `<rect x="${cx - bw / 2 - 3}" y="${yh - 1.5}" width="${bw + 6}" height="3" fill="var(--warm)"/><rect x="${cx - bw / 2 - 3}" y="${yl - 1.5}" width="${bw + 6}" height="3" fill="var(--cool)"/>`;
    // labels outside both the bar and the band, never on them (Parth, 1 Oct)
    const topY = y(Math.max(p.hi, p.uhi ?? -99)), botY = y(Math.min(p.lo, p.ulo ?? 99));
    s += `<text x="${cx}" y="${topY - 7}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--warm)">${Math.round(p.hi)}°</text><text x="${cx}" y="${botY + 16}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--cool)">${Math.round(p.lo)}°</text>`;
    const short = colw < 70;
    s += `<text x="${cx}" y="${h - bot + 20}" text-anchor="middle" font-size="${short ? 10.5 : 12}" font-weight="${p.now ? 800 : 600}" fill="var(--ink)">${short ? p.l.replace(" week", " wk").replace(/^(\w{3})\w+$/, "$1") : p.l}</text>${p.s && !short ? `<text x="${cx}" y="${h - bot + 33}" text-anchor="middle" font-size="10" fill="var(--muted)">${p.s}</text>` : ""}`;
    if (p.aq != null) { const [k, word] = aqWord(p.aq), tw = String(p.aq).length * 6.6; s += `<g><title>Air ${p.aq}, ${word}${p.au ? " (a usual month)" : ""}</title><rect x="${cx - (tw + 11) / 2}" y="${h - bot + 45}" width="7" height="7" fill="var(--aq${k})"/><text x="${cx - (tw + 11) / 2 + 11}" y="${h - bot + 52}" font-size="11.5" font-weight="700" fill="var(--ink)">${p.aq}</text></g>`; }
  });
  s += `<text x="${ax - 6}" y="${h - bot + 52}" text-anchor="end" font-size="10" font-weight="700" fill="var(--muted)">AIR</text>`;
  return s + `</svg>`;
}
