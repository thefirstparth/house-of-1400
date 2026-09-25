// The House of 1400. Renders an edition JSON and keeps the live layer fresh.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const TZ = "Asia/Kolkata";
const LIVE_EVERY = 5 * 60 * 1000;

let CFG, E, ROUTE, LIVE = {}, pTimer, liveTimer, liveTried = false, POSTER = null;

// ------------------------------------------------------------------ helpers
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = n => (n == null || !isFinite(n) ? "" : Math.abs(n) < 0.005 ? "0.00%" : `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`);
const dir = n => (n == null ? "" : n < 0 ? "dn" : "up");
// The move in the instrument's own units, from the previous close (or backed out of the percentage when a source gives only that).
function pts(q, unit = "", d = 2) {
  if (q?.price == null || q.change_pct == null || !isFinite(q.change_pct)) return "";
  const prev = q.prev ?? q.price / (1 + q.change_pct / 100), a = q.price - prev;
  if (Math.abs(a) < 0.5 * 10 ** -d) return `${unit}0`;
  return `${a < 0 ? "−" : "+"}${unit}${Math.abs(a).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
const fmt = (iso, o, tz = TZ) => new Date(iso).toLocaleString("en-GB", { timeZone: tz, hour12: false, ...o }).replace(/\bSept\b/g, "Sep");
const istFull = iso => fmt(iso, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
const istTime = iso => fmt(iso, { hour: "2-digit", minute: "2-digit" });
const istDay = iso => fmt(iso, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
const istDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const longDate = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace(/\bSept\b/, "Sep").toUpperCase();
const agoIST = iso => (iso ? `as of ${istFull(iso)} IST` : "");
const sec = id => CFG.sections.find(s => s.id === id) || { id, name: id, short: id, accent: "--ink" };
const accent = id => `var(${sec(id).accent})`;
const words = s => (String(s || "").match(/\S+/g) || []).length;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// Countdowns to the minute: seconds made the page look busy.
function cd(ms) {
  if (ms < 6e4) return "under a minute";
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d ? `${d}d ${h}h` + (d < 2 ? ` ${m}m` : "") : h ? `${h}h ${m}m` : `${m}m`;
}

let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2600); }

async function getJSON(url) {
  const r = await fetch(url, { credentials: "same-origin", cache: url.startsWith("/api/") ? "no-cache" : "default" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ------------------------------------------------------------------ live layer
// Primary and backup live in /api/live. Then the edition snapshot, with its time. Otherwise hide.
// Keep in step with the list in index.html's <head>.
const LIVE_KEYS = ["weather", "f1_next", "f1_standings", "f1_last", "football", "laliga_table", "markets", "gold_in", "nba", "cricket"];
const PRE = {}; // requests started at boot, before the config and edition arrive
async function live(key, qs = "") {
  const past = ROUTE.kind === "edition";
  if (!past) {
    try {
      const pre = !qs && PRE[key]; delete PRE[key];
      const j = await (pre || getJSON(`/api/live/${key}${qs}`));
      if (j?.ok && j.value) return (LIVE[key] = { value: j.value, as_of: j.as_of, source: j.source, stale: false });
    } catch {}
  }
  const s = E?.snapshot?.[key];
  if (s && s.value) return (LIVE[key] = { value: s.value, as_of: s.as_of, source: s.source, stale: true });
  return (LIVE[key] = null);
}

// Every key in parallel; each block repaints as soon as its own data lands (one repaint per frame).
let paintQueued = false;
const paintSoon = () => { if (paintQueued) return; paintQueued = true; requestAnimationFrame(() => { paintQueued = false; paintLive(); }); };
let marketsAt = 0;
async function refreshLive() {
  // While every exchange is shut, market data (indices, plus the rupee, oil and Bitcoin in the same feed) refreshes
  // every 30 minutes instead of every 5.
  const quiet = CFG && LIVE.markets && !LIVE.markets.stale && allShut() && Date.now() - marketsAt < 30 * 60 * 1000;
  const jobs = LIVE_KEYS.filter(k => !(k === "markets" && quiet)).map(k => live(k).then(v => { if (k === "markets") marketsAt = Date.now(); paintSoon(); return v; }));
  if (ROUTE.kind !== "edition") {
    const ids = (E.betting || []).map(b => b.id).filter(Boolean).join(",");
    jobs.push(live("betting", ids ? `?ids=${encodeURIComponent(ids)}` : "").then(paintSoon));
    if (!E.trends?.india?.length) jobs.push(live("trends").then(paintSoon));
  }
  await Promise.all(jobs);
  liveTried = true;
  paintLive();
}

function staleNote(k) {
  const L = LIVE[k];
  // Say "from the snapshot" only once a live fetch has failed, or on a past edition.
  return L?.stale && (liveTried || ROUTE.kind === "edition") ? `<div class="asof stale">From the ${esc(L.source || "edition")} snapshot, ${agoIST(L.as_of)}</div>` : "";
}

// ------------------------------------------------------------------ events (countdowns, on now)
function events() {
  const out = [];
  for (const f of E.fixtures || []) {
    if (f.time_tbc) continue;
    const start = Date.parse(f.when_utc);
    const end = f.until_utc ? Date.parse(f.until_utc) : start + (f.minutes || 120) * 6e4;
    out.push({ label: f.label, start, end, entity: f.entity || "" });
  }
  // India's matches in the next week, from the live cricket feed, unless the edition already lists them.
  for (const m of LIVE.cricket?.value?.next || []) {
    const start = Date.parse(m.start);
    if (!m.time_announced || start > Date.now() + 7 * 864e5 || out.some(o => Math.abs(o.start - start) < 30 * 6e4)) continue;
    out.push({ label: `India v ${/^[A-Z]\d$/.test(m.opponent || "") ? "TBD" : m.opponent} · ${m.desc}`, start, end: m.end ? Date.parse(m.end) : start + 8 * 36e5, entity: "india_cricket" });
  }
  const race = LIVE.f1_next?.value?.race;
  if (race) for (const s of race.sessions) {
    if (!s.time_confirmed) continue;
    const start = Date.parse(s.start);
    if (!out.some(o => Math.abs(o.start - start) < 5 * 6e4 && o.entity === "f1")) out.push({ label: `F1 · ${s.name}`, start, end: start + s.minutes * 6e4, entity: "f1" });
  }
  return out.sort((a, b) => a.start - b.start);
}
const stateOf = (e, n) => (n >= e.end ? "done" : n >= e.start ? "on" : "next");

function tick() {
  const n = Date.now(), ev = events();
  const nx = ev.find(e => stateOf(e, n) !== "done");
  $$('[data-cd="sess"]').forEach(el => (el.textContent = !nx ? "All clear" : stateOf(nx, n) === "on" ? "On now" : cd(nx.start - n)));
  $$('[data-cd="sessname"]').forEach(el => (el.textContent = !nx ? "" : stateOf(nx, n) === "on" ? `${nx.label} · go watch` : `${nx.label} · ${istFull(new Date(nx.start).toISOString())} IST`));
  $$("[data-until]").forEach(el => {
    const t = Date.parse(el.dataset.until), dur = Number(el.dataset.min || 120) * 6e4;
    el.textContent = n < t ? cd(t - n) : n < t + dur ? "On now, go watch" : el.dataset.done || "Done";
  });
  $$("[data-clock]").forEach(el => (el.textContent = new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })));
}

// ------------------------------------------------------------------ small renderers
// Sparkline. Labels sit outside the plot so nothing overlaps: dates below, 3-month high and low as text.
function spark(a, col, { w = 320, h = 72, from = "", to = "", mini = false } = {}) {
  if (!a || a.length < 2) return "";
  const mn = Math.min(...a), mx = Math.max(...a), span = mx - mn || 1;
  const x = i => 2 + i * (w - 4) / (a.length - 1), y = v => 4 + (1 - (v - mn) / span) * (h - 8), L = a.length - 1;
  const d = a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Daily closes${from ? `, ${from} to ${to}` : ""}"><path d="${d} L${x(L)} ${h} L2 ${h} Z" fill="${col}" opacity=".09"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${mini ? 1.6 : 2}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  if (mini) return `<div class="spark mini">${svg}</div>`;
  const fmtN = v => (v >= 1000 ? inr(Math.round(v)) : v.toFixed(2));
  return `<div class="spark">${svg}<div class="spark-axis"><span>${esc(from)}</span><span>${esc(to)}</span></div><div class="spark-range">3-month high <b class="tnum">${fmtN(mx)}</b> · low <b class="tnum">${fmtN(mn)}</b></div></div>`;
}
const sparkLabel = ymd => (ymd ? new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep") : "");

const WMO = { 0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"], 45: ["🌫️", "Fog"], 48: ["🌫️", "Fog"], 51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"], 61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 80: ["🌦️", "Showers"], 81: ["🌧️", "Heavy showers"], 82: ["⛈️", "Violent showers"], 95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm, hail"], 99: ["⛈️", "Thunderstorm, hail"] };
const wx = c => WMO[c] || ["🌡️", ""];
const P = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  moon: '<path d="M19.5 14.8A8 8 0 0 1 9.2 4.5a8 8 0 1 0 10.3 10.3z"/>',
  cloud: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 11a3.8 3.8 0 0 0 .8 7.5z"/>',
  sunCloud: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.3M2 8h1.3M3.8 3.8l.9.9M12.2 3.8l-.9.9"/><path d="M9 19h9a3.8 3.8 0 0 0 .4-7.6 5.2 5.2 0 0 0-9.8 1.6A3 3 0 0 0 9 19z"/>',
  moonCloud: '<path d="M11 6.5A4 4 0 0 1 6.5 3a4.2 4.2 0 1 0 4.5 3.5z"/><path d="M9 19h9a3.8 3.8 0 0 0 .4-7.6 5.2 5.2 0 0 0-9.8 1.6A3 3 0 0 0 9 19z"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  drizzle: '<path d="M7 15h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 7.5 3.8 3.8 0 0 0 7 15z"/><path d="M9 18.5v1M13 18.5v1M17 18.5v1"/>',
  rain: '<path d="M7 14h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 6.5 3.8 3.8 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  storm: '<path d="M7 13.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 6 3.8 3.8 0 0 0 7 13.5z"/><path d="M12.5 15l-2.5 4h3l-2 3.5"/>',
  snow: '<path d="M7 14h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 6.5 3.8 3.8 0 0 0 7 14z"/><path d="M9 18h.01M12 20h.01M15 18h.01"/>',
};
const ICON_OF = c => (c === 0 || c === 1 ? "sun" : c === 2 ? "sunCloud" : c === 3 ? "cloud" : c === 45 || c === 48 ? "fog" : c >= 51 && c <= 57 ? "drizzle" : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? "rain" : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : c >= 95 ? "storm" : "cloud");
function wxIcon(code, night = false, label = "") {
  let k = ICON_OF(code);
  if (night) k = k === "sun" ? "moon" : k === "sunCloud" ? "moonCloud" : k;
  return `<span class="wxi" role="img" aria-label="${esc(label || wx(code)[1])}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg></span>`;
}
const isNight = hour => hour >= 19 || hour < 6;
const wxAt = (c, hour) => wxIcon(c, isNight(hour));

const sourcesLine = srcs => (srcs?.length ? `<div class="src">${srcs.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</div>` : "");
const newFor = x => (x.new_for_you ? `<span class="newfor">New for you</span>` : "");

const THUMB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H3V10z"/><path d="M7 10l4.2-7.2a2 2 0 0 1 3.7 1.3L14 9h5.6a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 18 21H7"/></svg>`;
// Feedback is a letter to the editor, in words (EDITORIAL.md, Letters). Every story and brief has a way to write one.
const PEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>`;
const noteBtn = (id, cls = "note") => `<button class="${cls}" data-note="${esc(id)}" title="Write to the editor about this">${PEN}<span>Write to the editor</span></button>`;
function tools(st, withMore) {
  const link = st.sources?.[0]?.url;
  const id = esc(st.id);
  return `<div class="tools">${withMore ? `<button class="rm" data-more="${id}" aria-expanded="false">Full story</button>` : ""}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Source ↗</a>` : ""}<button data-clip="${id}" title="Share this story as an image">Share</button>${noteBtn(st.id)}</div>`;
}

const why = w => (w?.text ? `<div class="why"><b>${w.personal ? "Why it matters for you" : "Why it matters"}</b>${esc(w.text)}</div>` : "");
const VERDICT_TWI = { try: "Verdict: Try", wait: "Verdict: Wait", ignore: "Verdict: Ignore" };

function byline(st) {
  if (st.byline) return `<div class="by">${esc(st.byline)}</div>`;
  const labels = [...new Set((st.sources || []).map(s => s.label.toUpperCase()))].slice(0, 2);
  return labels.length ? `<div class="by">${esc(labels.join(" · "))}</div>` : "";
}

function storyHTML(st, { lead = false, kickerPrefix = "" } = {}) {
  const more = st.more?.length;
  const H = lead ? "h2" : "h3";
  return `<article class="${lead ? "lead-story" : "story"}" id="s-${esc(st.id)}" style="--acc:${accent(st.section)}" data-thread="${esc(st.thread_id)}" data-section="${esc(st.section)}">
<div class="kick">${esc(kickerPrefix + st.kicker)}${newFor(st)}</div><${H}><button data-head="${esc(st.id)}">${esc(st.headline)}</button></${H}>
${st.deck ? `<p class="deck">${esc(st.deck)}</p>` : ""}${byline(st)}
<div class="body"><p class="${lead ? "first" : ""}">${esc(st.short)}</p>
${more ? `<div class="more" id="more-${esc(st.id)}" hidden>${st.more.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
${st.verdict ? `<div class="verdictline" style="color:var(--acc)">${VERDICT_TWI[st.verdict]}</div>` : ""}
${why(st.why)}</div>${tools(st, more)}</article>`;
}

function briefHTML(b, cls = "item") {
  return `<div class="${cls}" id="s-${esc(b.id)}" style="--acc:${accent(b.section)}" data-thread="${esc(b.thread_id)}">${b.kicker ? `<div class="${cls === "brief" ? "kick" : "tag"}">${esc(b.kicker)}${newFor(b)}</div>` : newFor(b)}<h4>${esc(b.headline)}</h4>${esc(b.text)}<div class="btools">${sourcesLine(b.sources)}${noteBtn(b.id, "note sm")}</div></div>`;
}

function secWrap(id, body, sub) {
  if (!body || !body.trim()) return "";
  const s = sec(id);
  const subline = sub ?? E.sections?.[id]?.sub ?? "";
  return `<section class="sec" id="${id}" style="--acc:${accent(id)}"><div class="sechead"><h2>${esc(s.name)}</h2><span>${esc(subline)}</span></div>${body}</section>`;
}

function storiesBlock(id, { beside = false } = {}) {
  const S = E.sections?.[id] || {};
  const st = S.stories || [], br = S.briefs || [];
  let h = "";
  // A lone story on a wide page reads in two columns; beside data it stays one.
  if (st.length) h += `<div class="${beside ? "stack" : st.length > 1 ? "cols2" : "solo"}">${st.map(x => storyHTML(x)).join("")}</div>`;
  if (br.length) h += `<div class="${beside ? "stack" : br.length > 2 ? "cols3" : br.length === 2 ? "cols2" : ""}">${br.map(b => briefHTML(b)).join("")}</div>`;
  return h;
}

// Data (tables, live figures) on the left, the section's stories on the right. Either may be empty.
function split(data, id) {
  const stories = storiesBlock(id, { beside: !!data });
  if (!data) return stories;
  if (!stories) return data;
  return `<div class="split"><div class="split-data">${data}</div><div class="split-stories">${stories}</div></div>`;
}

// ------------------------------------------------------------------ live blocks
const LIVEBLOCKS = {
  railWeather() {
    const w = LIVE.weather?.value?.cities?.[0]; if (!w) return "";
    const d = w.daily[0], hr = Number(fmt(new Date().toISOString(), { hour: "2-digit" }));
    return `<a class="w" href="#sky"><b>${esc(w.name)}</b><div class="row"><span class="big tnum">${Math.round(w.current.temp)}°</span>${wxIcon(w.current.code, isNight(hr))}</div><span class="sub">${esc(wx(w.current.code)[1])} · ${Math.round(d.max)}° / ${Math.round(d.min)}°${d.rain_prob != null ? ` · ${d.rain_prob}% rain` : ""}</span>${staleNote("weather")}</a>`;
  },
  nextUp() {
    return `<div class="w"><b><span class="live"><i></i>Next up</span></b><span class="big tnum" data-cd="sess">--</span><div class="sub" data-cd="sessname"></div></div>`;
  },
  // Race countdown only in race week.
  railF1() {
    const r = LIVE.f1_next?.value?.race; if (!r) return "";
    const race = r.sessions.at(-1);
    if (!race.time_confirmed || Date.parse(race.start) - Date.now() > 7 * 864e5) return "";
    return `<a class="w" href="#paddock"><b>F1 · ${esc(r.locality || r.country)} · lights out</b><span class="big tnum" data-until="${race.start}" data-min="${race.minutes}" data-done="Race done">--</span><div class="sub">${esc(istFull(race.start))} IST</div></a>`;
  },
  railIndex(name) {
    const q = LIVE.markets?.value?.indices?.find(i => i.name === name); if (!q) return "";
    const col = q.change_pct < 0 ? "var(--bad)" : "var(--good)", s = q.spark?.slice(-22) || [];
    return `<a class="w" href="#ledger"><div class="row"><b>${esc(name)}</b><span class="${dir(q.change_pct)} tnum" style="font:700 13px var(--sans)">${pct(q.change_pct)}</span></div><span class="big tnum">${inr(Math.round(q.price))}</span><div class="mc ${q.live ? "open" : ""}">${esc(hoursLine(q))}</div>${spark(s, col, { w: 200, h: 32, mini: true })}${staleNote("markets")}</a>`;
  },
};

function railHTML() {
  const prof = CFG.day_profiles[E.weekday] || {};
  const markets = CFG.markets.top_two.map(n => LIVEBLOCKS.railIndex(n)).join("");
  const sport = LIVEBLOCKS.nextUp() + LIVEBLOCKS.railF1();
  return LIVEBLOCKS.railWeather() + (prof.live_first === "fixtures" ? sport + markets : markets + sport);
}
function madridBlock() {
  const F = LIVE.football?.value, T = LIVE.laliga_table?.value;
  let table = "";
  if (F?.next?.length) {
    table = `<div class="tbl"><table><thead><tr><th>Next</th><th>Competition</th><th class="r">IST</th></tr></thead><tbody>${F.next.slice(0, 4).map((e, i) => `<tr class="${i === 0 ? "on" : ""}"><td>${esc(e.opponent)} <small>${e.home ? "home" : "away"}</small></td><td>${esc(e.competition || "")}</td><td class="r tnum">${e.time_confirmed ? esc(istFull(e.date)) : esc(istDay(e.date)) + ", time TBC"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const lines = [];
  if (F?.last) {
    const l = F.last, sc = l.score ? `${l.score.us}–${l.score.them}` : "";
    const res = l.winner === "us" ? "Won" : l.winner === "them" ? "Lost" : sc ? "Drew" : "";
    lines.push(`<p><b>Last:</b> ${res} ${esc(sc)} ${l.home ? "v" : "at"} ${esc(l.opponent)}, ${esc(istDay(l.date))}${l.competition ? ` · ${esc(l.competition)}` : ""}.</p>`);
  }
  if (F?.form?.length) lines.push(`<p><b>Form:</b> <span class="form">${F.form.map(r => `<i class="${r}">${r}</i>`).join("")}</span> <small class="asof">latest first</small></p>`);
  const rm = T?.rows?.find(r => String(r.id) === String(CFG.follows.football_club.espn_id) || r.team === CFG.follows.football_club.name);
  if (rm) {
    const top = T.rows[0];
    const gap = top && top !== rm ? `, ${top.points - rm.points} behind ${esc(top.team)}` : top === rm ? ", top of the table" : "";
    lines.push(`<p><b>Table:</b> ${ordinal(rm.rank)} on ${rm.points} points${gap}.</p>`);
  }
  let mini = "";
  if (T?.rows?.length) {
    const isUs = r => String(r.id) === String(CFG.follows.football_club.espn_id) || r.team === CFG.follows.football_club.name;
    const rows = T.rows.slice(0, 5); const us = T.rows.find(isUs); if (us && !rows.includes(us)) rows.push(us);
    mini = `<table class="compact liga"><thead><tr><th>#</th><th>La Liga</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${rows.map(r => `<tr class="${isUs(r) ? "on" : ""}"><td class="tnum">${r.rank}</td><td>${esc(r.team)}</td><td class="r tnum">${r.played ?? ""}</td><td class="r tnum">${r.gd > 0 ? "+" : ""}${r.gd ?? ""}</td><td class="r tnum">${r.points}</td></tr>`).join("")}</tbody></table>`;
  }
  const facts = lines.filter(l => !l.startsWith("<p><b>Table:")).join("") + staleNote("football");
  if (!table && !lines.length && !mini) return "";
  return `<div class="cols2"><div>${table}</div><div class="facts">${facts}${mini}</div></div>`;
}
const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

// Paddock Notes owns F1: this weekend's sessions, the key lines, the drivers' standings and the calendar.
function paddockBlock() {
  const N = LIVE.f1_next?.value, S = LIVE.f1_standings?.value, Lr = LIVE.f1_last?.value, D = E.sections?.paddock?.data || {};
  const n = Date.now();
  let sessions = "";
  if (N?.race) {
    const tz = D.local_tz;
    const t = (iso, zone) => esc(fmt(iso, { weekday: "short", hour: "2-digit", minute: "2-digit" }, zone).replace(",", ""));
    sessions = `<div class="tbl"><table class="compact"><thead><tr><th>This weekend</th>${tz ? `<th class="r">Local</th>` : ""}<th class="r">IST</th></tr></thead><tbody>${N.race.sessions.map(s => {
      const st = stateOf({ start: Date.parse(s.start), end: Date.parse(s.start) + s.minutes * 6e4 }, n);
      return `<tr class="${st === "on" ? "on" : st === "done" ? "done" : ""}"><td>${esc(s.name)}${st === "on" ? ` <span class="live"><i></i>On now, go watch</span> <button class="refresh" data-refresh="f1_next">Refresh</button>` : st === "done" ? ` <small>done</small>` : ""}</td>${tz ? `<td class="r tnum">${s.time_confirmed ? t(s.start, tz) : "TBC"}</td>` : ""}<td class="r tnum">${s.time_confirmed ? t(s.start) : "TBC"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  const bits = [];
  const max = S?.drivers?.find(d => /Verstappen/.test(d.name)), lead = S?.drivers?.[0];
  if (max) bits.push(`<p><b>${esc(CFG.follows.f1_driver.label)}.</b> ${ordinal(max.pos)} on ${max.points} points${max === lead ? ", leading the championship" : `, ${lead.points - max.points} behind ${esc(lead.name)}`}.${D.max_note ? " " + esc(D.max_note) : ""}</p>`);
  if (Lr?.results?.length) {
    const w = Lr.results[0], mx = Lr.results.find(r => /Verstappen/.test(r.name));
    bits.push(`<p><b>Last race.</b> ${esc(Lr.flag)} ${esc(Lr.name)}: ${esc(w.name)} won${mx && mx !== w ? `, Verstappen ${ordinal(mx.pos)}` : ""}.</p>`);
  }
  for (const note of D.notes || []) bits.push(`<p><b>${esc(note.label)}.</b> ${esc(note.text)}</p>`);
  let standings = "";
  if (S?.drivers?.length) {
    const rows = S.drivers.slice(0, 8);
    if (max && !rows.includes(max)) rows.push(max);
    const top = lead.points || 1;
    standings = `<div class="tbl"><table class="compact standings"><thead><tr><th>#</th><th>Drivers</th><th class="r">Pts</th><th class="r">Gap</th></tr></thead><tbody>${rows.map(d => `<tr class="${d === max ? "on" : ""}"><td class="tnum">${d.pos}</td><td>${esc(d.name.replace(/^Andrea /, ""))} <small>${esc(d.team || "")}</small><span class="mbar" style="width:${(d.points / top * 100).toFixed(1)}%"></span></td><td class="r tnum">${d.points}</td><td class="r tnum">${d === lead ? "" : "−" + (lead.points - d.points)}</td></tr>`).join("")}</tbody></table>${S.round ? `<p class="asof">After round ${S.round}. Source: ${esc(LIVE.f1_standings.source)}.</p>` : ""}</div>`;
  }
  let calendar = "";
  if (N?.race || N?.upcoming?.length) {
    const cal = [...(N.race ? [{ round: N.race.round, flag: N.race.flag, name: N.race.name, date: N.race.sessions.at(-1).start, now: true }] : []), ...(N.upcoming || [])];
    calendar = `<div class="tbl"><table class="compact calendar"><thead><tr><th>Rd</th><th>Grand Prix</th><th class="r">Race</th></tr></thead><tbody>${cal.map(r => `<tr class="${r.now ? "on" : ""}"><td class="tnum">${r.round ?? ""}</td><td><span class="flag" aria-hidden="true">${esc(r.flag)}</span> ${esc(r.name)}</td><td class="r tnum">${esc(sparkLabel(istDate(new Date(r.date))))}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if (!sessions && !bits.length && !standings && !calendar) return "";
  return `<div class="cols2"><div>${sessions}</div><div class="facts">${bits.join("")}${staleNote("f1_standings")}</div></div>${standings || calendar ? `<div class="cols2 gap-top"><div>${standings}</div><div>${calendar}</div></div>` : ""}`;
}



function warriorsBlock() {
  const B = LIVE.nba?.value;
  if (!B?.in_season) return "";
  const bits = [];
  if (B.last) bits.push(`Last: ${B.last.winner === "us" ? "beat" : "lost to"} ${esc(B.last.opponent)} ${esc(B.last.score?.us)}–${esc(B.last.score?.them)}.`);
  if (B.next?.length) bits.push(`Next: ${B.next.map(g => `${g.home ? "v" : "at"} ${esc(g.opponent)}, ${esc(istFull(g.date))} IST`).join("; ")}.`);
  const pos = B.west?.find(r => /Warriors/.test(r.team));
  if (pos) bits.push(`${ordinal(pos.rank)} in the West.`);
  const west = B.west?.length ? `<table class="compact"><thead><tr><th>#</th><th>NBA West</th><th class="r">W</th><th class="r">L</th><th class="r">GB</th></tr></thead><tbody>${B.west.slice(0, 8).map(r => `<tr class="${/Warriors/.test(r.team) ? "on" : ""}"><td class="tnum">${r.rank}</td><td>${esc(r.team)}</td><td class="r tnum">${r.wins}</td><td class="r tnum">${r.losses}</td><td class="r tnum">${esc(r.gb ?? "")}</td></tr>`).join("")}</tbody></table>` : "";
  return bits.length ? `<div class="cols2"><div class="item" style="--acc:var(--acc-sp)"><div class="tag">NBA · Warriors</div>${bits.join(" ")}</div><div>${west}</div></div>` : "";
}
function assetNote(name, q) {
  const D = E.sections?.ledger?.data || {};
  const fmtN = v => (v >= 1000 ? inr(Math.round(v)) : v.toFixed(2));
  const range = q?.lo3m != null ? `3-month range ${fmtN(q.lo3m)} to ${fmtN(q.hi3m)}` : "";
  return [D.notes?.[name], q?.note || range].filter(Boolean).map(x => x.replace(/\.$/, "")).join(". ") + ".";
}

// Trading hours come from config (markets.hours), converted to IST; whether it actually traded today comes from the
// data itself (Yahoo's trading period), which is how a holiday shows up.
function tzParts(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(d).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, hm: `${p.hour}:${p.minute}`, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
// The instant at which it is `hm` on the calendar day y-mo-d in time zone tz.
function tzInstant(tz, y, mo, d, hm) {
  const guess = Date.UTC(y, mo - 1, d, +hm.slice(0, 2), +hm.slice(3));
  const p = tzParts(tz, new Date(guess)), seen = Date.UTC(p.y, p.mo - 1, p.d, +p.hm.slice(0, 2), +p.hm.slice(3));
  return new Date(guess - (seen - guess));
}
function session(exchange) {
  const H = CFG.markets.hours?.[exchange]; if (!H) return null;
  const now = new Date(), t = tzParts(H.tz, now);
  const openNow = H.days.includes(t.wd) && t.hm >= H.open && t.hm < H.close;
  const closeAt = tzInstant(H.tz, t.y, t.mo, t.d, H.close);
  let next = null;
  for (let i = 0; i < 8 && !next; i++) {
    const day = tzParts(H.tz, new Date(now.getTime() + i * 864e5));
    const at = tzInstant(H.tz, day.y, day.mo, day.d, H.open);
    if (H.days.includes(day.wd) && at > now) next = at;
  }
  return { openNow, closeAt, next };
}
const istWhen = d => (istDate(d) === istDate() ? istTime(d.toISOString()) : istDate(d) === istDate(new Date(Date.now() + 864e5)) ? `tomorrow ${istTime(d.toISOString())}` : `${fmt(d.toISOString(), { weekday: "short" })} ${istTime(d.toISOString())}`);
function hoursLine(q) {
  const s = session(CFG.markets.indices.find(i => i.name === q.name)?.exchange);
  if (!s) return q.live ? "Live" : "Market closed";
  if (q.live) return `Live · till ${istTime(s.closeAt.toISOString())}`;
  if (s.openNow) return "Closed today";
  return `Closed · opens ${istWhen(s.next)}`;
}
const allShut = () => Object.keys(CFG.markets.hours || {}).every(ex => !session(ex)?.openNow);
const mstate = q => `<span class="mstate ${q.live ? "open" : "closed"}">${esc(hoursLine(q))}</span>`;

// Gold's context from IBJA's own history: the month's move, then where today sits in the period's range.
function goldNote(G) {
  if (G?.change_1m_pct == null) return "";
  const m = G.change_1m_pct, span = `${Math.max(1, Math.round((Date.now() - Date.parse(G.range_from)) / 2.63e9))}-month`;
  const where = G.per_10g_24k >= G.hi ? `at a ${span} high` : G.per_10g_24k <= G.lo ? `at a ${span} low`
    : `${Math.abs((G.per_10g_24k / G.hi - 1) * 100).toFixed(1)}% below the ${span} high of ₹${inr(G.hi)} on ${sparkLabel(G.hi_date)}`;
  return `${m < 0 ? "Down" : "Up"} ${Math.abs(m).toFixed(1)}% in a month, ${where}`;
}

// Mondays: the week ahead, grouped by day. Every area of the paper can put a date in it.
function weekBlock() {
  const W = (E.week_ahead || []).slice().sort((a, b) => (a.date + (a.time_ist || "99")).localeCompare(b.date + (b.time_ist || "99")));
  if (!W.length) return "";
  const days = [...new Set(W.map(w => w.date))];
  return `<div class="week">${days.map(d => `<div class="wday"><h4>${esc(istDay(d + "T12:00:00+05:30"))}</h4><ul>${W.filter(w => w.date === d).map(w => `<li style="--acc:${accent(w.area)}"><span class="wtag">${esc(sec(w.area).short)}${w.time_ist ? ` · ${esc(w.time_ist)}` : ""}</span><div>${w.target ? `<a href="#s-${esc(w.target)}">${esc(w.what)}</a>` : w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.what)}</a>` : esc(w.what)}${w.why ? `<small>${esc(w.why)}</small>` : ""}</div></li>`).join("")}</ul></div>`).join("")}</div>`;
}

// Mondays: what the weekend changed for markets, the mood so far today, and the week's market dates.
function mondayLedger(D) {
  const m = D.monday; if (!m?.mood) return "";
  const list = (t, a) => (a?.length ? `<div><h5>${t}</h5><ul>${a.map(x => `<li>${typeof x === "string" ? esc(x) : `${x.date ? `<b>${esc(istDay(x.date + "T12:00:00+05:30"))}</b> ` : ""}${esc(x.what || "")}`}</li>`).join("")}</ul></div>` : "");
  return `<div class="monday"><div class="mhead">The weekend and the week</div><p class="mood">${esc(m.mood)}</p><div class="mcols">${list("Since Friday's close", m.weekend)}${list("This week", m.watch)}</div></div>`;
}

// The index board: level, 1D, 7D, 1M and a 30-day line for each index, India first, then the US.
// 7D and 1M compare today's price with the last close on or before the same date 7 and 30 days back (hover shows it).
function indexBoard(M, D) {
  const REG = { India: "India", US: "United States" };
  const ex = n => CFG.markets.indices.find(i => i.name === n)?.exchange;
  const groups = [...new Set(CFG.markets.indices.map(i => i.exchange))];
  const cell = (v, from) => `<td class="r tnum ${dir(v)}"${from ? ` title="vs close of ${esc(sparkLabel(from))}"` : ""}>${pct(v) || "–"}</td>`;
  const rows = groups.map(g => {
    const list = M.indices.filter(q => ex(q.name) === g);
    if (!list.length) return "";
    return `<tr class="grp"><th colspan="6">${esc(REG[g] || g)}</th></tr>` + list.map(q => {
      const col = (q.chg_1m ?? q.change_pct) < 0 ? "var(--bad)" : "var(--good)";
      const note = D.notes?.[q.name] || q.note || "";
      return `<tr><td class="ix"><b>${esc(q.name)}</b><span class="st ${q.live ? "open" : ""}">${esc(hoursLine(q))}</span>${note ? `<small>${esc(note)}</small>` : ""}</td>
<td class="r tnum lv">${inr(q.price, 2)}<small class="${dir(q.change_pct)}">${pts(q)}</small></td>${cell(q.change_pct)}${cell(q.chg_7d, q.from_7d)}${cell(q.chg_1m, q.from_1m)}<td class="sp">${q.spark30?.length > 2 ? spark(q.spark30, col, { w: 150, h: 36, mini: true }) : ""}</td></tr>`;
    }).join("");
  }).join("");
  const moods = Object.keys(CFG.markets.mood || {}).map(k => M.mood?.[k]).filter(Boolean);
  return `<div class="board-wrap"><div class="tbl board"><table><thead><tr><th>Index</th><th class="r">Level</th><th class="r">1D</th><th class="r">7D</th><th class="r">1M</th><th class="r">30 days</th></tr></thead><tbody>${rows}</tbody></table></div>${moods.length ? `<div class="moods">${moods.map(moodCard).join("")}<details class="mhow"><summary>How the mood is worked out</summary><p>${esc(CFG.markets.mood?.method || "")}</p></details></div>` : ""}</div>`;
}
function moodCard(m) {
  const a = Math.PI * (1 - m.score / 100), cx = 100, cy = 96, r = 78;
  const nx = cx + (r - 12) * Math.cos(a), ny = cy - (r - 12) * Math.sin(a);
  const arc = (from, to, c) => { const p = t => [cx + r * Math.cos(Math.PI * (1 - t)), cy - r * Math.sin(Math.PI * (1 - t))]; const [x1, y1] = p(from), [x2, y2] = p(to); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="butt"/>`; };
  const where = m.range_pos == null ? "" : m.range_pos <= 15 ? "near its 3-month low" : m.range_pos >= 85 ? "near its 3-month high" : `${m.range_pos}% of the way up its 3-month range`;
  const calm = m.vix_pos == null ? "" : m.vix_pos <= 30 ? "calm for the quarter" : m.vix_pos >= 70 ? "jumpy for the quarter" : "middling for the quarter";
  return `<div class="mood"><div class="mh"><span>${esc(m.region || "")} mood</span><span class="tnum">${m.score}/100</span></div>
<svg viewBox="0 0 200 108" role="img" aria-label="${esc(m.region || "")} market mood ${m.score} out of 100">${arc(0, .25, "var(--bad)")}${arc(.25, .45, "color-mix(in srgb,var(--bad) 45%,var(--surface2))")}${arc(.45, .55, "var(--surface2)")}${arc(.55, .75, "color-mix(in srgb,var(--good) 45%,var(--surface2))")}${arc(.75, 1, "var(--good)")}
<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink)"/></svg>
<div class="mword">${esc(m.word || moodWord(m.score))}</div>
<ul><li>${esc(m.index)} ${where}</li><li>7 days ${pct(m.chg_7d)} · today ${pct(m.change_pct)}</li>${m.vix != null ? `<li>${esc(m.vix_name)} ${m.vix} · ${calm}</li>` : ""}</ul></div>`;
}
const moodWord = s => (s < 25 ? "Fearful" : s < 45 ? "Cautious" : s <= 55 ? "Neutral" : s < 75 ? "Confident" : "Exuberant");

function ledgerBlock() {
  const M = LIVE.markets?.value, G = LIVE.gold_in?.value, D = E.sections?.ledger?.data || {};
  const prof = CFG.day_profiles[E.weekday] || {};
  let h = mondayLedger(D);
  if (M?.indices?.length) h += indexBoard(M, D);
  const rows = [];
  for (const c of CFG.markets.cross) {
    if (c.source === "ibja") {
      if (G) rows.push(`<tr><td><b>Gold 24K</b><br><small>IBJA, per 10g</small></td><td class="r tnum">₹${inr(G.per_10g_24k)}</td><td class="r tnum ${dir(G.change_pct)}">${pct(G.change_pct)}<small>${pts({ price: G.per_10g_24k, prev: G.prev_10g, change_pct: G.change_pct }, "₹", 0)}</small></td><td class="r tnum hide-s">–</td><td class="r tnum hide-s ${dir(G.change_1m_pct)}"${G.month_from ? ` title="vs ${esc(sparkLabel(G.month_from))}"` : ""}>${pct(G.change_1m_pct) || "–"}</td><td class="sub">${esc([D.notes?.[c.name]?.replace(/\.$/, ""), goldNote(G), `22K ₹${inr(G.per_10g_22k)}`].filter(Boolean).join(". "))}.</td></tr>`);
      continue;
    }
    const q = M?.cross?.find(x => x.symbol === c.yahoo); if (!q) continue;
    const lvl = c.yahoo === "INR=X" ? "₹" + q.price.toFixed(2) : c.yahoo === "BZ=F" ? "$" + usd(q.price, 2) : c.yahoo === "BTC-USD" ? "$" + usd(q.price) : inr(Math.round(q.price));
    const unit = c.yahoo === "INR=X" ? "₹" : /^(BZ=F|BTC-USD)$/.test(c.yahoo) ? "$" : "", d = c.yahoo === "BTC-USD" ? 0 : 2;
    rows.push(`<tr><td><b>${esc(c.name)}</b></td><td class="r tnum">${lvl}</td><td class="r tnum ${dir(q.change_pct)}">${pct(q.change_pct)}<small>${pts(q, unit, d)}</small></td><td class="r tnum hide-s ${dir(q.chg_7d)}">${pct(q.chg_7d) || "–"}</td><td class="r tnum hide-s ${dir(q.chg_1m)}">${pct(q.chg_1m) || "–"}</td><td class="sub">${esc(assetNote(c.name, q))}</td></tr>`);
  }
  if (rows.length) h += `<div class="tbl cross"><table><thead><tr><th>Asset</th><th class="r">Level</th><th class="r">1D</th><th class="r hide-s">7D</th><th class="r hide-s">1M</th><th>Note</th></tr></thead><tbody>${rows.join("")}</tbody></table>${staleNote("markets")}</div>`;
  if (h && prof.markets === "light_unless_important" && !(E.sections?.ledger?.stories?.length)) {
    h = `<details><summary class="asof" style="cursor:pointer;padding:6px 0">Weekend: markets folded. Tap to open.</summary>${h}</details>`;
  }
  return h;
}

// Sky & Streets: one plain sentence for the week, the hours that matter to the reader, a slim 7-day strip,
// and other cities as a single line only when their weather is worth knowing.
const dayName = ymd => (ymd === istDate() ? "today" : new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }));
const dayShort = ymd => (ymd === istDate() ? "Today" : new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }));
const wetness = p => (p == null ? "" : p >= 70 ? "wet" : p >= 40 ? "showery" : "dry");

function weekSentence(days) {
  const t = days[0], rest = days.slice(1);
  const today = { wet: "Rain likely today", showery: "Showers possible today", dry: "Mostly dry today" }[wetness(t.rain_prob)] || "Today";
  let s = `${today}, ${Math.round(t.max)}° at best.`;
  const firstDry = rest.findIndex(d => wetness(d.rain_prob) === "dry");
  if (wetness(t.rain_prob) !== "dry" && firstDry > -1) {
    let end = firstDry; while (end + 1 < rest.length && wetness(rest[end + 1].rain_prob) === "dry") end++;
    const run = rest.slice(firstDry, end + 1), hot = Math.round(Math.max(...run.map(d => d.max)));
    s += ` Drier ${run.length > 1 ? `from ${dayName(run[0].date)} to ${dayName(run.at(-1).date)}` : `on ${dayName(run[0].date)}`}${hot > Math.round(t.max) ? `, warming to ${hot}°` : ""}.`;
    const back = rest.slice(end + 1).find(d => wetness(d.rain_prob) === "wet");
    if (back) s += ` Rain returns ${dayName(back.date)}.`;
  } else if (wetness(t.rain_prob) === "dry") {
    const wet = rest.find(d => wetness(d.rain_prob) === "wet");
    s += wet ? ` Rain likely from ${dayName(wet.date)}.` : " No rain of note this week.";
  } else {
    s += " Unsettled all week.";
  }
  return s;
}

function keyHours(c) {
  const H = c.hourly; if (!H?.length) return "";
  const now = Date.now();
  const picks = (CFG.weather.key_times || []).map(k => {
    const slot = H.find(h => Number(h.time.slice(11, 13)) === k.hour && Date.parse(h.time + ":00+05:30") >= now - 30 * 6e4);
    return slot && { ...k, slot };
  }).filter(Boolean).sort((a, b) => a.slot.time.localeCompare(b.slot.time));
  if (!picks.length) return "";
  return `<div class="hours">${picks.map(p => `<div><span class="lbl">${esc(p.label)}</span><span class="t">${esc(fmt(p.slot.time + ":00+05:30", { hour: "2-digit", minute: "2-digit" }))}</span><span class="v">${wxAt(p.slot.code, p.hour)} ${Math.round(p.slot.temp)}°</span><span class="r ${p.slot.rain_prob >= 50 ? "wet" : ""}">${p.slot.rain_prob ?? "–"}% rain</span></div>`).join("")}</div>`;
}

function notableLine(c) {
  const bad = c.daily.slice(0, 3).filter(d => (d.rain_prob ?? 0) >= 80 || d.max >= 40 || [65, 82, 95, 96, 99].includes(d.code));
  if (!bad.length) return "";
  const hot = bad.filter(d => d.max >= 40), wet = bad.filter(d => !(d.max >= 40));
  const parts = [];
  if (wet.length) parts.push(`${wet.some(d => (d.rain_mm ?? 0) >= 30 || [65, 82].includes(d.code)) ? "heavy rain" : "rain"} ${wet.map(d => dayName(d.date)).join(" and ")}`);
  if (hot.length) parts.push(`${Math.round(Math.max(...hot.map(d => d.max)))}° heat ${hot.map(d => dayName(d.date)).join(" and ")}`);
  return `<p class="city"><b>${esc(c.name)}:</b> ${esc(parts.join("; "))}.</p>`;
}

function skyBlock() {
  const W = LIVE.weather?.value; if (!W?.cities?.length) return "";
  const c = W.cities[0];
  const strip = `<div class="strip7">${c.daily.map(d => `<div class="${wetness(d.rain_prob)}"><b>${dayShort(d.date)}</b>${wxIcon(d.code)}<span class="tnum">${Math.round(d.max)}°</span>${(d.rain_prob ?? 0) >= 40 ? `<small>${d.rain_prob}%</small>` : "<small>&nbsp;</small>"}</div>`).join("")}</div>`;
  let h = `<p class="sky-lede">${esc(weekSentence(c.daily))}</p>${keyHours(c)}${strip}`;
  const others = W.cities.slice(1).map(notableLine).join("");
  if (others) h += `<div class="cities">${others}</div>`;
  h += `<div id="myloc"></div>`;
  if (ROUTE.kind !== "edition" && navigator.geolocation && !store.get("h1400-loc")) h += `<p class="note"><button class="linkish" id="locBtn">Add the weather where you are</button></p>`;
  const note = E.sections?.sky?.data?.note;
  if (note) h += `<p class="note">${esc(note)}</p>`;
  return h + staleNote("weather");
}

// The Fixture List is the next seven days across every sport, by day. Club and national-team fixtures further
// out live in their own sections, so nothing repeats beyond the week.
function fixturesBlock() {
  const n = Date.now(), horizon = n + 7 * 864e5;
  const rows = (E.fixtures || []).slice().sort((a, b) => a.when_utc.localeCompare(b.when_utc)).filter(f => {
    const start = Date.parse(f.when_utc), end = f.until_utc ? Date.parse(f.until_utc) : start + (f.minutes || 120) * 6e4;
    return end > n && start < horizon;
  });
  if (!rows.length) return "";
  const byDay = new Map();
  for (const f of rows) {
    const start = Date.parse(f.when_utc);
    const key = start < n ? istDate() : istDate(new Date(start));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(f);
  }
  return `<div class="agenda">${[...byDay].map(([day, list]) => `<div class="day"><h3>${esc(dayName(day).replace(/^./, c => c.toUpperCase()))} <span>${esc(sparkLabel(day))}</span></h3><ul>${list.map(f => {
    const start = Date.parse(f.when_utc), end = f.until_utc ? Date.parse(f.until_utc) : start + (f.minutes || 120) * 6e4;
    const st = f.time_tbc ? "next" : stateOf({ start, end }, n);
    const when = f.time_tbc ? "Time TBC" : f.until_utc ? `Runs to ${sparkLabel(istDate(new Date(f.until_utc)))}` : istTime(f.when_utc);
    return `<li class="${st}"><span class="t tnum">${esc(when)}</span><span class="what">${esc(f.label)}${f.where ? ` <small>· ${esc(f.where)}</small>` : ""}${st === "on" ? ` <span class="live"><i></i>On now, go watch</span> <button class="refresh" data-refresh="fixtures">Refresh</button>` : ""}</span></li>`;
  }).join("")}</ul></div>`).join("")}</div>`;
}

// India's matches from the live Cricbuzz feed; where to watch from the edition's verified broadcast list, by series.
const seriesKey = s => String(s || "").toLowerCase().replace(/\b(19|20)\d\d\b|[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const watchFor = series => (E.broadcast || []).find(b => seriesKey(b.series) === seriesKey(series) || seriesKey(series).includes(seriesKey(b.series)));
function cricketTable() {
  const C = LIVE.cricket?.value; if (!C) return "";
  let h = "";
  if (C.last) h += `<p class="cr-last"><b>Last:</b> ${esc(C.last.result)} <span>(${esc(C.last.desc)} v ${esc(C.last.opponent)}, ${esc(istDay(C.last.start))})</span></p>`;
  const list = (C.next || []).slice(0, 6);
  if (list.length) h += `<div class="tbl cr"><table><thead><tr><th>When (IST)</th><th>Match</th><th>Where</th><th>Watch in India</th></tr></thead><tbody>${list.map(m => {
    const w = watchFor(m.series);
    const opp = /^[A-Z]\d$/.test(m.opponent || "") ? `TBD (${m.opponent})` : m.opponent;
    return `<tr><td class="tnum"><b>${esc(istDay(m.start))}</b><br>${m.time_announced ? esc(istTime(m.start)) : "time TBC"}</td><td><b>v ${esc(opp)}</b> · ${esc(m.desc)}<br><small>${esc(m.series)} · ${esc(m.format)}</small></td><td>${esc(m.ground || "")}${m.city ? `<br><small>${esc(m.city)}</small>` : ""}</td><td>${w ? `${esc([...(w.tv || [])].join(", "))}${w.ott?.length ? `<br><small>${esc(w.ott.join(", "))}${w.note ? " · " + esc(w.note) : ""}</small>` : ""}` : `<small>To be confirmed</small>`}</td></tr>`;
  }).join("")}</tbody></table>${staleNote("cricket")}<p class="asof">Fixtures from Cricbuzz. Broadcasters checked by the editor per series.</p></div>`;
  return h;
}
function creaseBlock() {
  const rows = E.sections?.crease?.data?.rows || [];
  const t = rows.length ? `<table class="kv"><tbody>${rows.map(r => `<tr class="${r.on ? "on" : ""}"><th scope="row">${esc(r.label)}</th><td>${esc(r.text)}</td></tr>`).join("")}</tbody></table>` : "";
  return cricketTable() + split(t, "crease");
}

function deuceBlock() {
  const T = E.tennis || {};
  let h = "";
  if (T.events?.length) h += `<div class="tbl" style="margin-bottom:16px"><table><thead><tr><th>Tournament</th><th>Dates</th><th>Note</th></tr></thead><tbody>${T.events.map(e => `<tr><td><b style="font-weight:600">${esc(e.name)}</b>${e.place ? " · " + esc(e.place) : ""}</td><td>${esc(e.dates)}</td><td class="sub">${esc([e.level, e.note].filter(Boolean).join(" · "))}</td></tr>`).join("")}</tbody></table></div>`;
  if (T.players?.length) h += `<div class="cols2">${T.players.map(p => `<div class="panel"><div class="nm">${esc(p.name)}</div>${p.next_match ? `<p style="margin:6px 0 4px"><b>Next match:</b> ${esc(p.next_match.text)}</p>` : ""}${p.next_event ? `<p style="margin:6px 0 4px"><b>${p.next_match ? "Event" : "Next event"}:</b> ${esc(p.next_event.text)}${p.next_match ? "" : " Match TBD."}</p>` : ""}${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}</div>`).join("")}</div>`;
  return h + storiesBlock("deuce");
}

const VERDICT = { must: ["v-must", "Must watch"], good: ["v-good", "Good watch"], call: ["v-call", "Your call"], skip: ["v-skip", "Skip"], early: ["v-early", "Too early"] };
const screenId = s => "scr-" + String(s.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
function screenBlock() {
  const all = E.screen || [];
  const now = all.filter(s => !s.coming_soon), soon = all.filter(s => s.coming_soon);
  const table = list => `<div class="tbl"><table><thead><tr><th>Title</th><th>Where</th><th>When</th><th class="r">Verdict</th></tr></thead><tbody>${list.map(s => `<tr><td><b>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(s.title)}</a>` : esc(s.title)}</b><br><small>${esc(s.type)} · ${esc(s.language)}</small><br><small>${esc(s.reason)}${s.if_you_liked ? ` If you liked ${esc(s.if_you_liked)}.` : ""}</small></td><td>${esc(s.where)}</td><td>${esc(s.release)}</td><td class="r"><span class="verdict ${VERDICT[s.verdict][0]}">${VERDICT[s.verdict][1]}</span></td></tr>`).join("")}</tbody></table></div>`;
  let h = "";
  if (now.length) h += table(now);
  if (now.length) h += `<div class="legend">${Object.entries(VERDICT).map(([k, [c, l]]) => `<div><span class="verdict ${c}">${l}</span>${{ must: "Critics and audiences both strongly positive", good: "Clearly positive, a few reservations", call: "Split reviews, or good but niche", skip: "Clearly negative on both", early: "Fewer than three reputable reviews so far" }[k]}</div>`).join("")}</div>`;
  if (soon.length) h += `<h3 style="font:700 12px var(--utilf);letter-spacing:.1em;text-transform:uppercase;margin:22px 0 6px;color:var(--acc)">Coming soon</h3>` + table(soon);
  return h + storiesBlock("screen");
}

// Live fallback only: the daily run curates Talk of the Day with a researched line per term.
// Keep terms and headlines that are in English, deduplicate against the paper, mix the world feeds in turn.
const english = t => /^[\x20-\x7E\u00C0-\u024F\u2018-\u201D\u2013\u2026₹]+$/.test(t || "");
function liveTrends() {
  const G = LIVE.trends?.value?.geos; if (!G) return null;
  const heads = allStories().map(s => s.headline.toLowerCase());
  const seen = new Set();
  const pick = list => (list || []).filter(t => {
    const k = t.term.toLowerCase(), news = t.news?.find(n => english(n.title));
    if (!english(t.term) || !news || seen.has(k) || (k.length >= 5 && heads.some(h => h.includes(k)))) return false;
    seen.add(k); t._news = news; return true;
  }).slice(0, CFG.trends.target_each || 6).map(t => ({ term: t.term, traffic: t.traffic, what: t._news.title.slice(0, CFG.trends.max_what_chars || 140), url: t._news.url }));
  const geos = CFG.trends.world_geos.filter(g => G[g]?.length);
  const mixed = [];
  for (let i = 0; i < 20; i++) for (const g of geos) if (G[g][i]) mixed.push(G[g][i]);
  return { india: pick(G[CFG.trends.india_geo]), world: pick(mixed), live: true };
}

function talkBlock() {
  const T = E.trends?.india?.length || E.trends?.world?.length ? E.trends : liveTrends();
  if (!T || (!T.india?.length && !T.world?.length)) return "";
  const col = (label, list) => (list?.length ? `<div><h3 class="colhead">${esc(label)}</h3>${list.map(t => `<p class="trend"><b>${esc(t.term)}</b>${t.traffic ? ` <span class="traffic">· ${esc(t.traffic)}</span>` : ""} <span class="dash">–</span> ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.what)}</a>` : esc(t.what)}</p>`).join("")}</div>` : "");
  return `<div class="cols2 talk">${col("India", T.india)}${col("World", T.world)}</div>${T.live ? `<p class="asof" style="margin-top:8px">${LIVE.trends?.stale ? `Google Trends ${agoIST(LIVE.trends.as_of)}` : "Live from Google Trends"}, with the top English headline for each.</p>` : ""}`;
}

// Compact: one row per market, top outcomes inline with a thin bar for the favourite. Up to ten.
// Readable over dense: title on its own line, one row per outcome with its own bar. Up to ten markets.
const MONTHS = { january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun", july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec" };
const outcomeLabel = n => String(n).replace(/^(By|Through) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(, \d{4})?$/i, (_, w, m, d, y) => `${w} ${d} ${MONTHS[m.toLowerCase()]}${y || ""}`);

function bettingBlock() {
  const liveM = LIVE.betting?.value?.markets || [];
  const list = (E.betting?.length ? E.betting : liveM).slice(0, CFG.betting.show || 10);
  if (!list.length) return "";
  const idOf = b => (b.id?.includes(":") ? b.id : b.id ? `pm:${b.id}` : null);
  const cards = list.map(b => {
    const L = !LIVE.betting?.stale && liveM.find(m => m.id === idOf(b));
    const outs = (L?.outcomes?.length ? L.outcomes : b.outcomes).slice(0, 3);
    return `<li><div class="meta">${esc(b.category || "World")}<span> · ${b.since && b.since < E.date ? `Trending since ${esc(sparkLabel(b.since))}` : esc(b.source || "Polymarket")}</span></div><a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title.replace(/\.\.\.\?$/, "…?"))}</a>${b.note ? `<small>${esc(b.note)}</small>` : ""}<ul>${outs.map((o, i) => `<li class="${i === 0 ? "fav" : ""}"><span>${esc(outcomeLabel(o.name))}</span><b class="tnum">${Math.round(o.prob)}%</b><i><em style="width:${Math.max(0, Math.min(100, o.prob))}%"></em></i></li>`).join("")}</ul></li>`;
  }).join("");
  return `<ol class="markets">${cards}</ol><p class="asof" style="margin-top:10px">${LIVE.betting && !LIVE.betting.stale ? "Live prices" : `Prices ${agoIST(LIVE.betting?.as_of) || "at press time"}`}. A price is what traders pay for a yes, not a forecast.</p>`;
}

function byeBlock() {
  const b = E.before_you_go || {};
  return (b.watch?.length ? `<p><b>Watch:</b> ${b.watch.map(esc).join(" ")}</p>` : "") + (b.do?.length ? `<p><b>Do:</b> ${b.do.map(esc).join(" ")}</p>` : "");
}

function deskBlock() {
  if (!E.desk?.length) return "";
  const G = { "72h": "Next 72h", "4-7": "Days 4 to 7", week2: "Week 2" };
  return `<details class="desk" id="desk"><summary>${esc(sec("desk").name)} · tap to open</summary><table style="margin-top:8px"><tbody>${E.desk.map(d => `<tr><td>${esc(d.group ? G[d.group] : d.when)}</td><td>${d.group ? `<b style="font-weight:600">${esc(d.when)}</b> · ` : ""}${esc(d.text)}${d.kind === "action" ? ` <span class="newfor" style="--acc:var(--bad)">Action</span>` : ""}</td></tr>`).join("")}</tbody></table></details>`;
}

// ------------------------------------------------------------------ page
// Lead on the left with the briefs under it, second stories on the right: both columns end near the same line.
function frontHTML() {
  const F = E.front;
  return `<div class="front" id="front" style="scroll-margin-top:48px">
<div class="lead">${storyHTML({ ...F.lead, kicker: `Front Page · ${F.lead.kicker}` }, { lead: true })}
${F.briefs.length ? `<div class="briefs">${F.briefs.map(b => briefHTML(b, "brief")).join("")}</div>` : ""}</div>
<div class="side">${F.seconds.map(s => storyHTML(s)).join("")}</div></div>`;
}

function render() {
  const n = E.edition_no;
  document.title = `The House of 1400 · ${longDate(E.date)}`;
  $("#run-date").textContent = longDate(E.date);
  $("#run-vol").textContent = `Vol. ${roman(Number(E.date.slice(0, 4)) - 2025)} · No. ${n} · ${CFG.paper.home_city}`;
  $("#run-cut").textContent = `Information cut ${E.cut_ist} IST`;
  $("#motto").innerHTML = `${esc(CFG.paper.motto)} · Edited by <a href="/editor">${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</a>`;
  $("#profile").textContent = E.profile_line;

  let h = frontHTML();
  if (E.week_ahead?.length) h += secWrap("week", weekBlock(), "Monday to Sunday · what to watch");
  h += secWrap("fixtures", `<div data-live="fixtures">${fixturesBlock()}</div>`, "Next 7 days · IST");
  h += secWrap("madrid", `<div data-live="madrid">${madridBlock()}</div>` + storiesBlock("madrid"));
  h += secWrap("pitch", storiesBlock("pitch"), "Football beyond Madrid");
  const race = LIVE.f1_next?.value?.race;
  h += secWrap("paddock", `<div data-live="paddock">${paddockBlock()}</div>` + storiesBlock("paddock"), race ? `${race.flag} Round ${race.round ?? ""} · ${race.name}${race.locality ? " · " + race.locality : ""}` : undefined);
  h += secWrap("crease", `<div data-live="crease">${creaseBlock()}</div>`, "India men · senior team");
  h += secWrap("deuce", deuceBlock(), "Tennis · big events first, then Alcaraz and Djokovic");
  h += secWrap("sidelines", `<div data-live="warriors">${warriorsBlock()}</div>` + storiesBlock("sidelines"), "Every other sport, when it matters");
  h += secWrap("dateline", storiesBlock("dateline"), "World & India");
  h += secWrap("workshop", storiesBlock("workshop"), "Tech · AI · wearables");
  h += secWrap("pipeline", storiesBlock("pipeline"), "SDR · outbound · GTM");
  h += secWrap("ledger", `<div data-live="ledger">${ledgerBlock()}</div>` + storiesBlock("ledger"), "Markets · money · cards");
  h += secWrap("sky", `<div data-live="sky">${skyBlock()}</div>` + storiesBlock("sky"), `${CFG.paper.home_city} · the week ahead`);
  h += secWrap("namma", storiesBlock("namma"), `${CFG.paper.home_city} · fuller on Fri, Sat, Sun`);
  h += secWrap("screen", screenBlock(), "English and Hindi · theatre and OTT");
  h += secWrap("talk", `<div data-live="talk">${talkBlock()}</div>`, "What people are searching for");
  const markets = [...new Set((E.betting || []).map(b => b.source || "Polymarket"))].join(" and ") || "Polymarket";
  h += secWrap("betting", `<div data-live="betting">${bettingBlock()}</div>`, `What the world is betting on · ${markets}`);
  h += secWrap("bye", byeBlock(), "Watch and do");
  h += deskBlock();
  h += secWrap("letters", lettersBlock(), E.letters?.length ? "The editor replies" : "Your notes to the paper");
  if (E.editor_note) h += `<div class="editor">${esc(E.editor_note)}<span><a href="/editor"><img src="/bhide.svg" alt="" width="28" height="28">${esc(CFG.paper.editor.signature)}</a></span></div>`;
  h += `<div class="house" id="house"><b>${esc(sec("house").name)}</b><p>${esc(E.house_note)}</p></div>`;
  h += `<div class="foot">${esc(`THE HOUSE OF 1400 · ${longDate(E.date).toUpperCase()} · NO. ${n} · EDITED BY ${CFG.paper.editor.signature.replace(", Editor", "").toUpperCase()}`)}<br><a href="/editor">About the editor</a> · <a href="/archive">The Archive</a></div>`;
  $("#main").innerHTML = h;
  requestAnimationFrame(balanceFront);
  document.fonts?.ready.then(balanceFront);


  // Read time
  const all = [E.front.lead, ...E.front.seconds, ...E.front.briefs, ...Object.values(E.sections || {}).flatMap(s => [...(s.stories || []), ...(s.briefs || [])])];
  const skim = all.reduce((a, s) => a + words(s.headline) + words(s.short || s.text), 0);
  const full = skim + all.reduce((a, s) => a + words((s.more || []).join(" ")) + words(s.why?.text), 0);
  $("#readtime").textContent = `Skim: ${Math.max(1, Math.round(skim / 200))} min · Everything: ${Math.max(2, Math.round(full / 200))} min`;

  // At a Glance
  if (E.glance?.length) {
    $("#glance").innerHTML = `<h4>At a Glance</h4><div class="gd">${esc(longDate(E.date))}</div>` + E.glance.map(g => `<button data-go="${esc(g.target)}" style="--c:${g.color ? `var(${esc(g.color)})` : "var(--ink)"}"><span>${esc(g.section)}</span>${esc(g.line)}</button>`).join("");
    $("#glanceBtn").hidden = false;
  }
  paintLive();
}

// On a wide screen, move trailing second stories under the lead while that evens the two columns.
function balanceFront() {
  const lead = document.querySelector(".front .lead"), side = document.querySelector(".front .side");
  if (!lead || !side) return;
  lead.querySelectorAll(".story.moved").forEach(el => side.appendChild(el));
  // Up to 980px the front is one column; from 1500px it is three (lead, seconds, briefs), which need no balancing.
  if (innerWidth <= 980 || innerWidth >= 1500) return;
  for (let i = 0; i < 3; i++) {
    const last = side.querySelector(".story:last-of-type");
    if (!last || side.querySelectorAll(".story").length < 2) break;
    const gap = side.offsetHeight - lead.offsetHeight, h = last.offsetHeight;
    if (gap <= h * 0.6) break;
    last.classList.add("moved"); lead.appendChild(last);
  }
}

function paintLive() {
  $("#rail").innerHTML = railHTML();
  const map = { crease: creaseBlock, talk: talkBlock, fixtures: fixturesBlock, madrid: madridBlock, paddock: paddockBlock, ledger: ledgerBlock, sky: skyBlock, warriors: warriorsBlock, betting: bettingBlock };
  for (const [k, fn] of Object.entries(map)) {
    const el = document.querySelector(`[data-live="${k}"]`);
    if (!el) continue;
    const html = fn();
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }
  // Sections are omitted when empty, never padded. Live-only sections appear once their data arrives.
  let changed = false;
  for (const s of $$("section.sec")) {
    const body = [...s.children].slice(1);
    const empty = !body.some(el => el.textContent.trim() || el.querySelector("svg,table,img"));
    if (s.hidden !== empty) { s.hidden = empty; changed = true; }
  }
  const race = LIVE.f1_next?.value?.race, ph = document.querySelector("#paddock .sechead span");
  if (race && ph) ph.textContent = `${race.flag} Round ${race.round ?? ""} · ${race.name}${race.locality ? " · " + race.locality : ""}`;
  if (changed || !$("#idx a")) {
    const present = CFG.sections.filter(x => { const el = document.getElementById(x.id); return el && !el.hidden; });
    $("#idx div").innerHTML = present.map(x => `<a href="#${x.id}" style="--c:var(${x.accent})"><i></i>${esc(x.short)}</a>`).join("");
    observeIndex(present);
  }
  if (!$("#poster").hidden && (POSTER === "today" || POSTER === "edition")) paintPoster();
  tick();
}

let IO;
function observeIndex(present) {
  try {
    IO?.disconnect();
    const links = $$("#idx a");
    const io = IO = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.toggle("cur", l.getAttribute("href") === "#" + en.target.id));
      const c = links.find(l => l.classList.contains("cur")); c && c.scrollIntoView({ block: "nearest", inline: "center" });
    }), { rootMargin: "-45% 0px -50% 0px" });
    present.forEach(s => { const el = document.getElementById(s.id); el && io.observe(el); });
  } catch {}
}

const roman = n => { let r = "", v = Math.max(1, n); for (const [k, s] of [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (v >= k) { r += s; v -= k; } return r; };

// ------------------------------------------------------------------ interactions
function allStories() {
  return [E.front.lead, ...E.front.seconds, ...E.front.briefs, ...Object.values(E.sections || {}).flatMap(s => [...(s.stories || []), ...(s.briefs || [])])];
}
function findStory(id) {
  const s = allStories().find(x => x.id === id);
  if (s) return s;
  const t = (E.screen || []).find(x => screenId(x) === id);
  return t && { id, thread_id: id, section: "screen" };
}

function toggleMore(id) {
  const m = document.getElementById("more-" + id), b = document.querySelector(`[data-more="${CSS.escape(id)}"]`);
  if (!m) return false;
  m.hidden = !m.hidden;
  if (b) { b.textContent = m.hidden ? "Read more" : "Read less"; b.setAttribute("aria-expanded", !m.hidden); }
  return true;
}

// ------------------------------------------------------------------ letters to the editor
function openLetter(id = "") {
  const st = id ? findStory(id) : null;
  const about = st ? `<div class="lt-about">About: <b>${esc(st.headline || st.title || "")}</b></div>` : "";
  $("#modal").innerHTML = `<div class="card letter"><div class="lt-head">A letter to the editor</div>${about}
<textarea id="ltText" maxlength="1500" rows="6" placeholder="${st ? "More of this, less of that, a correction, a question…" : "What should the paper do more of, less of, or differently?"}"></textarea>
<p class="lt-note">He reads every letter before the next edition and notes what he did about it. The site has no password, so anyone with its link could read letters too.</p>
<div class="row2"><button class="pri" id="sendLetter" data-id="${esc(id)}">Send</button><button data-close="1">Cancel</button></div></div>`;
  $("#modal").hidden = false;
  setTimeout(() => $("#ltText")?.focus(), 30);
}
async function sendLetter() {
  const text = $("#ltText").value.trim(), id = $("#sendLetter").dataset.id || "";
  if (text.length < 3) { toast("Write a line or two first."); return; }
  const st = id ? findStory(id) : null;
  $("#sendLetter").disabled = true;
  try {
    const r = await fetch("/api/letter", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, date: E.date, story_id: id || null, headline: st?.headline || null, section: st?.section || null }) });
    if (!r.ok) throw new Error(r.status);
    $("#modal").hidden = true; toast("Sent. The editor will read it before the next edition.");
  } catch { $("#sendLetter").disabled = false; toast("Could not send. Try again in a minute."); }
}
function lettersBlock() {
  const L = E.letters || [];
  const replies = L.map(l => `<div class="lt-item"><blockquote>${esc(l.quote)}</blockquote><p>${esc(l.reply)}</p><span class="lt-sig">${esc(CFG.paper.editor.signature)}</span></div>`).join("");
  return `${replies ? `<div class="lt-list">${replies}</div>` : ""}<button class="lt-write" data-note="">${PEN}<span>Write to the editor</span></button>`;
}

async function vote(id, dirn) {
  const st = findStory(id); if (!st) return;
  const v = store.get("h1400-votes") || {};
  const on = v[id] !== dirn;
  if (on) v[id] = dirn; else delete v[id];
  store.set("h1400-votes", v);
  $$(`[data-story="${CSS.escape(id)}"]`).forEach(b => b.setAttribute("aria-pressed", on && b.dataset.th === dirn));
  toast(!on ? "Removed." : dirn === "up" ? "Noted. More stories like this in future editions." : "Noted. Fewer stories like this in future editions.");
  try {
    await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ date: E.date, story_id: id, thread_id: st.thread_id, section: st.section, vote: on ? dirn : "none" }) });
  } catch {}
}

function wrap(ctx, text, maxW) {
  const out = []; let line = "";
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

async function clip(id) {
  const st = findStory(id); if (!st) return;
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const col = v => css.getPropertyValue(v).trim();
  const W = 1080, P = 72, c = document.createElement("canvas"), x = c.getContext("2d");
  const body = st.short || st.text;
  // measure first
  c.width = W; c.height = 10;
  x.font = "400 64px 'Playfair Display', Georgia, serif"; const hl = wrap(x, st.headline, W - 2 * P);
  x.font = "400 34px 'Source Serif 4', Georgia, serif"; const bl = wrap(x, body, W - 2 * P);
  const H = P + 40 + 40 + hl.length * 72 + 28 + bl.length * 52 + 60 + 40;
  c.height = H;
  x.fillStyle = col("--paper") || "#ebe6da"; x.fillRect(0, 0, W, H);
  x.fillStyle = col("--ink") || "#191816";
  let y = P;
  x.font = "700 22px 'Instrument Sans', Arial, sans-serif"; x.textBaseline = "top";
  x.fillText("THE HOUSE OF 1400", P, y);
  const dt = longDate(E.date).toUpperCase(); x.fillStyle = col("--muted"); x.fillText(dt, W - P - x.measureText(dt).width, y);
  y += 40; x.fillStyle = col("--rule"); x.fillRect(P, y, W - 2 * P, 2); y += 30;
  x.fillStyle = col(sec(st.section).accent) || col("--ink"); x.font = "700 22px 'Instrument Sans', Arial, sans-serif";
  x.fillText((st.kicker || sec(st.section).name).toUpperCase(), P, y); y += 44;
  x.fillStyle = col("--ink"); x.font = "400 64px 'Playfair Display', Georgia, serif";
  for (const l of hl) { x.fillText(l, P, y); y += 72; }
  y += 16; x.font = "400 34px 'Source Serif 4', Georgia, serif";
  for (const l of bl) { x.fillText(l, P, y); y += 52; }
  y += 24; x.fillStyle = col("--muted"); x.font = "500 20px 'Instrument Sans', Arial, sans-serif";
  x.fillText(`Edited by ${CFG.paper.editor.signature.replace(", Editor", "")}`, P, y);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const file = new File([blob], `house-of-1400-${E.date}-${id}.png`, { type: "image/png" });
  const url = URL.createObjectURL(blob);
  $("#modal").innerHTML = `<div class="card"><img src="${url}" alt="${esc(st.headline)}" style="width:100%;display:block;border:1px solid var(--rule)"><div class="row2"><button class="pri" id="shareClip">${navigator.canShare?.({ files: [file] }) ? "Share" : "Download"}</button><button data-close="1">Close</button></div></div>`;
  $("#modal").hidden = false;
  $("#shareClip").onclick = async () => {
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: st.headline }); } catch {} }
    else { const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); }
  };
}

document.addEventListener("click", e => {
  const t = e.target.closest("button,a"); if (!t) return;
  if (t.id === "themeBtn") {
    const r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    r.setAttribute("data-theme", dk ? "light" : "dark");
    try { localStorage.setItem("h1400-theme", dk ? "light" : "dark"); } catch {}
    t.textContent = dk ? "Night" : "Day"; return;
  }
  if (t.id === "glanceBtn") { const g = $("#glance"); g.hidden = !g.hidden; t.setAttribute("aria-expanded", !g.hidden); t.textContent = g.hidden ? "At a Glance" : "Close"; return; }
  if (t.dataset.go) { const el = document.getElementById("s-" + t.dataset.go) || document.getElementById(t.dataset.go); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); $("#glance").hidden = true; $("#glanceBtn").textContent = "At a Glance"; return; }
  if (t.dataset.more) { toggleMore(t.dataset.more); return; }
  if (t.dataset.head) { if (!toggleMore(t.dataset.head)) toast("Short story. The full text is already shown."); return; }
  if (t.dataset.note !== undefined) { openLetter(t.dataset.note); return; }
  if (t.id === "sendLetter") { sendLetter(); return; }
  if (t.dataset.clip) { clip(t.dataset.clip); return; }
  if (t.dataset.close) { $("#modal").hidden = true; return; }
  if (t.id === "locBtn") { myLocation(true); return; }
  if (t.dataset.refresh) {
    const k = t.dataset.refresh;
    (k === "fixtures" ? Promise.all(["f1_next", "football"].map(x => live(x))) : live(k)).then(() => { paintLive(); toast("Refreshed."); });
    return;
  }
  if (t.id === "posterBtn") { const m = $("#pmenu"); m.hidden = !m.hidden; t.setAttribute("aria-expanded", !m.hidden); return; }
  if (t.dataset.poster) { $("#pmenu").hidden = true; openPoster(t.dataset.poster); return; }
});
let resizeT;
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { balanceFront(); fitPoster(); }, 150); });
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") $("#modal").hidden = true; });
$("#poster").addEventListener("click", closePoster);
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#modal").hidden = true; closePoster(); } });

async function myLocation(ask) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async p => {
    const q = `?lat=${p.coords.latitude.toFixed(2)}&lon=${p.coords.longitude.toFixed(2)}`;
    try {
      const j = await getJSON(`/api/live/weather${q}`);
      const c = j.ok && j.value?.cities?.[0]; if (!c) return;
      const d = c.daily[0], [, tx] = wx(c.current.code);
      const el = $("#myloc"); if (el) el.innerHTML = `<p class="note" style="font-size:15px">Where you are: <b>${Math.round(c.current.temp)}°</b> ${wxIcon(c.current.code)} ${esc(tx)} · today ${Math.round(d.max)}° / ${Math.round(d.min)}°, ${d.rain_prob ?? "–"}% rain</p>`;
      const b = $("#locBtn"); if (b) b.parentElement.remove();
      store.set("h1400-loc", true);
    } catch {}
  }, () => { if (ask) toast("Location not available."); }, { maximumAge: 30 * 60 * 1000, timeout: 10000 });
}

// ------------------------------------------------------------------ poster mode
function heads(n = 5) {
  return [E.front.lead, ...E.front.seconds, ...E.front.briefs].slice(0, n).map(s => [s.kicker?.replace(/^Front Page · /, "") || sec(s.section).short, s.headline]);
}
const mastHTML = () => `<div class="pm"><span class="the">The</span><span class="hof">House of</span><span class="yr">1400</span><span class="sub">${esc(longDate(E.date))} · Edited by ${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</span></div>`;
function stripBits() {
  const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value?.indices || [];
  const bits = [];
  if (w) bits.push(`${esc(w.name)} ${Math.round(w.current.temp)}° ${wxIcon(w.current.code)}`);
  for (const nm of CFG.markets.top_two) { const q = M.find(i => i.name === nm); if (q) bits.push(`${esc(nm)} ${inr(Math.round(q.price))} <span class="${dir(q.change_pct)}">${pct(q.change_pct)}</span>`); }
  return bits;
}

// ---- "Today, one screen": everything worth a glance, arranged like a front page on a dashboard grid
function dashHTML() {
  const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value, N = LIVE.f1_next?.value, S = LIVE.f1_standings?.value;
  const F = LIVE.football?.value, T = LIVE.laliga_table?.value, B = LIVE.betting?.value?.markets || [];
  const hr = Number(fmt(new Date().toISOString(), { hour: "2-digit" }));
  const card = (cls, title, body, right = "") => (body ? `<section class="c ${cls}"><h5><span>${title}</span><span>${right}</span></h5>${body}</section>` : "");
  const line = (k, v) => `<div class="line"><span>${k}</span><b>${v}</b></div>`;

  const headsBody = `<ol>${heads(5).map(h => `<li><div><small>${esc(h[0])}</small>${esc(h[1])}</div></li>`).join("")}</ol>`;

  let sky = "";
  if (w) {
    const d = w.daily[0];
    sky = `<div class="row" style="display:flex;align-items:center;gap:10px"><span class="big">${Math.round(w.current.temp)}°</span>${wxIcon(w.current.code, isNight(hr))}</div><div style="color:var(--muted);margin-bottom:6px">${esc(wx(w.current.code)[1])} · ${Math.round(d.max)}° / ${Math.round(d.min)}° · ${d.rain_prob ?? "–"}% rain</div>` +
      (CFG.weather.key_times || []).map(k => { const h = w.hourly?.find(x => Number(x.time.slice(11, 13)) === k.hour && Date.parse(x.time + ":00+05:30") >= Date.now() - 18e5); return h ? line(esc(k.label), `${Math.round(h.temp)}° · ${h.rain_prob ?? "–"}%`) : ""; }).join("");
  }

  const upcoming = events().filter(e => e.end > Date.now()).slice(1, 4);
  const next = `<span class="big" data-cd="sess">--</span><div data-cd="sessname" style="color:var(--muted);margin:2px 0 6px"></div>${upcoming.map(e => line(esc(e.label), esc(istFull(new Date(e.start).toISOString())))).join("")}`;

  let mk = "";
  if (M?.indices?.length) {
    const cross = CFG.markets.cross.map(c => {
      if (c.source === "ibja") { const G = LIVE.gold_in?.value; return G ? `<div><span>Gold 24K /10g</span><b>₹${inr(G.per_10g_24k)}</b> <small class="${dir(G.change_pct)}">${pct(G.change_pct)}</small>${G.change_1m_pct != null ? `<em class="${dir(G.change_1m_pct)}">${pct(G.change_1m_pct).replace(/0$/, "")} in a month</em>` : ""}</div>` : ""; }
      const q = M.cross?.find(x => x.symbol === c.yahoo); if (!q || c.yahoo === "^GSPC" || c.yahoo === "^NSEBANK") return "";
      const lvl = c.yahoo === "INR=X" ? "₹" + q.price.toFixed(2) : c.yahoo === "BZ=F" ? "$" + usd(q.price, 2) : "$" + usd(q.price);
      return `<div><span>${esc(c.name)}</span><b>${lvl}</b> <small class="${dir(q.change_pct)}">${pct(q.change_pct)}</small></div>`;
    }).join("");
    mk = `<div class="idx3">${(CFG.markets.poster || []).map(n => M.indices.find(i => i.name === n)).filter(Boolean).map(q => `<div><span>${esc(q.name)}</span><span class="big">${inr(Math.round(q.price))}</span><b class="${dir(q.change_pct)}"><i>${pts(q)} </i>${pct(q.change_pct)}</b><small class="mc">${esc(hoursLine(q))}</small>${spark(q.spark?.slice(-22), q.change_pct < 0 ? "var(--bad)" : "var(--good)", { w: 200, h: 28, mini: true })}</div>`).join("")}</div><div class="cross">${cross}</div>`;
  }

  const sport = [];
  if (N?.race) { const race = N.race.sessions.at(-1); sport.push(line(`${esc(N.race.flag)} ${esc(N.race.name.replace(" Grand Prix", " GP"))}`, `<span data-until="${race.start}" data-min="${race.minutes}" data-done="Race done"></span>`)); }
  const max = S?.drivers?.find(d => /Verstappen/.test(d.name)); if (max) sport.push(line("Max Verstappen", `${ordinal(max.pos)} · ${max.points} pts`));
  const mn = F?.next?.[0]; if (mn) sport.push(line(`Madrid ${mn.home ? "v" : "at"} ${esc(mn.opponent)}`, esc(istFull(mn.date))));
  const rm = T?.rows?.find(r => String(r.id) === String(CFG.follows.football_club.espn_id)); if (rm) sport.push(line("La Liga", `${ordinal(rm.rank)} · ${rm.points} pts`));
  const ind = E.chronology?.india_cricket?.next; if (ind) sport.push(line(`India v ${esc(ind.label)}`, ind.time_tbc ? esc(istDay(ind.when_utc)) : esc(istFull(ind.when_utc))));
  const alc = E.tennis?.players?.find(p => /Alcaraz/.test(p.name)); if (alc?.next_event) sport.push(line("Alcaraz", esc(alc.next_event.text.split(",")[0])));

  const bets = (E.betting?.length ? E.betting : B).slice(0, 5).map(b => {
    const L = B.find(m => m.id === b.id); const o = (L?.outcomes?.length ? L.outcomes : b.outcomes)[0];
    return o ? line(esc(b.title.replace(/\.\.\.\?$/, "…?").slice(0, 46)), `${esc(outcomeLabel(o.name))} ${Math.round(o.prob)}%`) : "";
  }).join("");

  return `<div class="dash" onclick="event.stopPropagation()">
<header class="hd"><div class="name"><span class="the">The</span><span class="hofs">House of</span><b>1400</b></div><div class="when"><b data-clock></b>${esc(longDate(E.date))} · No. ${E.edition_no}</div></header>
${card("heads", "The front page", headsBody)}
${card("sky", esc(w?.name || "Weather"), sky)}
${card("next", "Next up", next)}
${card("mk", "Markets", mk, esc(M?.indices?.some(q => q.live) ? "Live" : "Markets closed"))}
${card("sport", "Your sport", sport.join(""))}
${card("bets", "The Betting Window", bets)}</div>`;
}

// ---- "The edition, framed": the day's paper composed as a single poster
function framedHTML() {
  const L = E.front.lead;
  const notes = [
    E.editor_note ? `<div class="note-card"><b>From the editor</b>${esc(E.editor_note)}<i>${esc(CFG.paper.editor.signature)}</i></div>` : "",
    `<div class="note-card"><b>${esc(sec("house").name)}</b>${esc(E.house_note)}</div>`,
  ].join("");
  return `<div class="framed" onclick="event.stopPropagation()">
<div class="fm"><span class="the">The</span><span class="hof">House of</span><span class="yr">1400</span><span class="dt">${esc(longDate(E.date))} · No. ${E.edition_no} · Edited by ${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</span></div>
<div class="headline"><small>${esc(L.kicker)}</small>${esc(L.headline)}</div>
<div class="cols"><div class="gl"><h5>At a Glance</h5><ul>${(E.glance || []).map(g => `<li style="--c:${g.color ? `var(${esc(g.color)})` : "var(--ink)"}"><span>${esc(g.section)}</span>${esc(g.line)}</li>`).join("")}</ul></div><div class="notes">${notes}</div></div>
</div>`;
}
const CLOSE = `<button class="pclose" aria-label="Back to the paper" title="Back to the paper (Esc)">×</button>`;
function paintPoster() {
  const P = $("#poster"), html = (POSTER === "today" ? dashHTML() : framedHTML()) + CLOSE;
  if (P.dataset.html === html) return;
  P.innerHTML = html; P.dataset.html = html; tick(); fitPoster();
}
// Today and The edition fit one screen: shrink the whole sheet (CSS zoom) until it does, never scroll.
function fitPoster() {
  const P = $("#poster"), c = P.firstElementChild;
  if (P.hidden || !c?.matches(".dash,.framed")) return;
  c.style.zoom = "";
  const cs = getComputedStyle(P);
  const room = P.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let z = 1;
  for (let i = 0; i < 4; i++) {
    const h = c.getBoundingClientRect().height;
    if (h <= room + 1) break;
    z = Math.max(0.5, z * room / h); c.style.zoom = z.toFixed(3);
  }
}
function openPoster(k) {
  const P = $("#poster"); clearInterval(pTimer);
  if (k === "heads") k = "edition";
  POSTER = k; delete P.dataset.html;
  P.className = "poster" + (k === "night" || k === "clock" ? " dark" : "") + (k === "today" || k === "edition" ? " fit" : "");
  P.hidden = false;
  if (k === "mast" || k === "night") P.innerHTML = mastHTML();
  if (k === "today" || k === "edition") { paintPoster(); document.fonts?.ready.then(fitPoster); }
  if (k === "clock") {
    P.innerHTML = `<div class="pm"><span class="hof">The House of 1400</span><div class="clock" data-clock></div><div class="strip">${stripBits().map(b => `<span>${b}</span>`).join("")}<span>Next: <b data-cd="sessname"></b> <b data-cd="sess"></b></span></div></div>`;
  }
  pTimer = setInterval(tick, 1000);
  tick();
  if (k !== "today" && k !== "edition") { try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch {} }
  try { navigator.wakeLock?.request("screen").catch(() => {}); } catch {}
}
function closePoster() {
  const P = $("#poster"); if (P.hidden) return;
  P.hidden = true; clearInterval(pTimer); POSTER = null;
  try { document.fullscreenElement && document.exitFullscreen(); } catch {}
  if (location.pathname === "/today" || location.pathname.startsWith("/poster/") || new URLSearchParams(location.search).has("poster")) history.replaceState(null, "", "/");
}

// ------------------------------------------------------------------ archive
async function renderArchive() {
  document.title = "Archive · The House of 1400";
  $("#run-date").textContent = "The Archive";
  $("#run-vol").textContent = CFG.paper.home_city;
  $("#run-cut").innerHTML = `<a class="backlink" href="/">Today's paper</a>`;
  $("#motto").textContent = CFG.paper.motto;
  $("#profile").textContent = "Every edition, newest first";
  $("#layout").style.display = "block";
  $("#rail").hidden = true; $("#idx").hidden = true;
  let a;
  try { a = await getJSON("/content/archive.json"); } catch { a = { editions: [] }; }
  const list = (a.editions || []).slice().sort((x, y) => y.date.localeCompare(x.date));
  $("#main").innerHTML = list.length
    ? `<section class="sec" style="--acc:var(--ink)"><div class="sechead"><h2>The Archive</h2><span>${list.length} edition${list.length > 1 ? "s" : ""}</span></div><ul class="archive-list">${list.map(e => `<li><span>${esc(longDate(e.date))}</span><a href="/e/${esc(e.date)}">${esc(e.lead || "Edition " + e.edition_no)}</a></li>`).join("")}</ul></section>`
    : `<p class="notice">The archive starts with the first edition.</p>`;
}

// ------------------------------------------------------------------ about the editor
// A page of its own, linked from the byline, the editor's note and the foot of the paper. Never on the front page.
// Laid out as a golden-age newspaper profile: framed portrait, pull quote, a day at the desk, the red pencil at work.
async function renderEditor() {
  const name = CFG.paper.editor.signature.replace(", Editor", "");
  document.title = `${name} · The House of 1400`;
  $("#run-date").textContent = "Profile";
  $("#run-vol").textContent = CFG.paper.home_city;
  $("#run-cut").innerHTML = `<a class="backlink" href="/">Today's paper</a>`;
  $("#motto").textContent = CFG.paper.motto;
  $("#profile").textContent = "The man on the byline";
  $("#layout").style.display = "block";
  $("#rail").hidden = true; $("#idx").hidden = true;
  // A typewriter face for his memos and a hand for his corrections, loaded on this page only.
  if (!document.getElementById("ed-fonts")) {
    const l = document.createElement("link");
    l.id = "ed-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Courier+Prime&display=swap";
    document.head.appendChild(l);
  }
  const day = [
    ["14:00", "Closes the information cut. Anything later waits for tomorrow, and he does not accept appeals."],
    ["14:05", "Reads the front pages of the national papers, all leanings, and notes what leads two or more."],
    ["14:15", "Reads the regulators' notices and the money pages. Anything that changes what people pay, earn, save or insure goes on the list."],
    ["14:20", "Asks why every stock that fell off a cliff fell off it. “Financial stocks were weak” is not an answer."],
    ["14:30", "Picks the lead. Writes At a Glance. Fixes every time to the minute in IST."],
    ["14:40", "Hands the pages to the checker, a program that reads for sources, dates, duplicates and banned words. He calls it the night desk."],
    ["14:45", "The paper goes live. On a big day he signs a short note at the end. On an ordinary day he says nothing, which he considers a courtesy."],
  ];
  const proofs = [
    { typed: `The company <s>unveiled</s><ins>launched</ins> a <s>pivotal</s> new phone <s>amid robust demand</s><ins>as sales rose 12%</ins>.`, note: "Say what happened. Adjectives are not news." },
    { typed: `Experts say the move <s>underscores the growing importance of</s><ins>matters for</ins> AI.`, note: "Which experts? Name them or cut them." },
    { typed: `Madrid play Villarreal on Sunday <s>—</s><ins title="full stop">⊙</ins> Kick-off is TBC.`, note: "No em dashes in this house." },
  ];
  const quirks = [
    ["Tea", "Two cups, at 13:30 and 16:00. Never at the desk."],
    ["“Reportedly”", "Allowed only with a name attached."],
    ["Exclamation marks", "One per decade, held in reserve for a Madrid title."],
    ["Headlines that ask a question", "The answer is usually no, so he does not print them."],
    ["Formula 1 on a Saturday", "A matter of public record. See his note of 25 September."],
    ["The moustache", "Denies it."],
  ];
  const rules = [
    ["The two tests", "Would Parth be annoyed tomorrow if this were missing? Would a well-informed person in India be caught out not knowing it? A story that passes either one prints."],
    ["Next means next", "Every club, player and race gets one timeline, sorted. The next match is the earliest confirmed one, whatever the headlines say about a bigger game later."],
    ["Times to the minute", "Venue time, then UTC, then IST. Two sources that disagree by half an hour send him to a third. If the third does not settle it, the paper prints “time TBC” and moves on."],
    ["Once is enough", "A story reprints only when a fact has changed. He keeps a ledger of every thread the paper has run and checks it before anything goes in."],
    ["No filler", "A section with nothing worth printing is removed. The paper never tells you what it could not find."],
    ["Money and institutions", "He does not follow politics and neither does the reader, but a rule that changes what you pay, or a row inside the body that runs elections, is news. It prints, plainly."],
  ];
  let memo = "";
  try {
    const L = await getJSON("/content/latest.json");
    if (L.editor_note) memo = `<figure class="ed-memo"><div class="memo-head"><span>MEMORANDUM</span><span>From: ${esc(name)}</span><span>To: The reader</span><span>Date: ${esc(longDate(L.date))}</span></div><blockquote>${esc(L.editor_note)}</blockquote><div class="memo-init" aria-hidden="true">TAB</div></figure>`;
  } catch {}
  $("#main").innerHTML = `<article class="about">
<header class="ed-open">
  <figure class="ed-frame"><div class="mat"><img src="/bhide.svg" alt="A drawn portrait of T. A. Bhide: side-parted hair going grey at the temples, round spectacles, one eyebrow raised, a moustache" width="240" height="240"></div>
    <figcaption>Drawn for The House of 1400. The editor declined to sit for a photograph.</figcaption></figure>
  <div class="ed-title">
    <div class="kick">Profile · The Editor</div>
    <h1>${esc(name)}</h1>
    <p class="deck">${esc(CFG.paper.editor.full_name)} edits an afternoon paper with a circulation of one. He is strict about rules and quick to correct the reader, and very proud of his education. He is also, as he would be the first to point out, fictional.</p>
    <div class="ed-by">By the staff of The House of 1400 · Filed at 14:00 IST</div>
  </div>
</header>
<dl class="ed-stats">
  <div><dt>Circulation</dt><dd>1</dd></div>
  <div><dt>Deadline</dt><dd>14:00</dd></div>
  <div><dt>Words he will not print</dt><dd>15</dd></div>
  <div><dt>Em dashes printed</dt><dd>0</dd></div>
</dl>
<div class="ed-body">
  <section class="ed-story">
    <h2>Who he is</h2>
    <p class="drop">Bhide is an editor of the old school, the kind that ran city desks when a paper had to be right before it could be first. He believes a newspaper is a set of rules kept every day, and that the reader should never have to wonder whether the paper checked. He reads everything twice. He has opinions about commas.</p>
    <blockquote class="ed-pull">“A paper has to be right before it can be first.”</blockquote>
    <p>His name is a small tribute to a famous society secretary of Indian television, a man who also believed that rules exist to be read aloud. The resemblance ends at the moustache, which the editor denies having.</p>
    <p>He edits for one reader, who works a shift from 17:00 to 02:00 and reads on his phone. So the paper arrives in the afternoon, it is finished in five minutes if you only skim, and it never pads a page to look busy.</p>
  </section>
  <aside class="ed-quirks">
    <h2>Things he has opinions about</h2>
    <dl>${quirks.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  </aside>
</div>
<section class="ed-day">
  <h2>A day at the desk</h2>
  <ol>${day.map(([t, d]) => `<li><time>${t}</time><p>${esc(d)}</p></li>`).join("")}</ol>
</section>
<section class="ed-proof">
  <h2>The red pencil</h2>
  <p class="ed-lede">Every sentence in the paper has been past this pencil. A few from the spike.</p>
  <div class="proofs">${proofs.map(x => `<div class="proof"><p class="typed">${x.typed}</p><p class="margin">${esc(x.note)}</p></div>`).join("")}</div>
</section>
<section class="ed-rulesec">
  <h2>The house rules</h2>
  <ol class="ed-rules">${rules.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("")}</ol>
</section>
${memo ? `<section><h2>In his own words</h2>${memo}</section>` : ""}
<section class="ed-honest"><h2>A note on the byline</h2>
<p>T. A. Bhide is a character. Each afternoon the paper is researched and written by an AI model working to a written rulebook, and a checker in code reads the edition (sources, times, duplicates, banned words) before it is published. The rules are real, and so are the sources. Only the editor is invented, and his portrait is a drawing.</p></section>
<p class="ed-back"><a class="backlink" href="/">Back to today's paper</a> · <a class="backlink" href="/archive">The Archive</a></p>
</article>`;
}

// ------------------------------------------------------------------ boot
// Each poster has its own address, /poster/<name>, for a screen or a screensaver that should open straight to it.
const POSTER_NAMES = { today: "today", edition: "edition", framed: "edition", heads: "edition", masthead: "mast", mast: "mast", night: "night", clock: "clock" };
// A poster left open (a screensaver, a spare screen) reloads itself when the next edition goes live, and hides the
// cursor when the mouse is still.
function posterKiosk() {
  setInterval(async () => {
    if ($("#poster").hidden) return;
    try { const h = await getJSON("/api/health"); if (h.edition && E && h.edition > E.date) location.reload(); } catch {}
  }, 10 * 60 * 1000);
  let idle;
  const wake = () => { $("#poster").classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => $("#poster").classList.add("idle"), 3000); };
  addEventListener("mousemove", wake); wake();
}

function route() {
  const p = location.pathname.replace(/\/+$/, "") || "/";
  const m = p.match(/^\/e\/(\d{4}-\d{2}-\d{2})$/);
  if (m) return { kind: "edition", date: m[1] };
  if (p === "/archive") return { kind: "archive" };
  if (p === "/editor") return { kind: "editor" };
  if (p === "/today") return { kind: "today" };
  const pm = p.match(/^\/poster\/([a-z]+)$/);
  if (pm) return { kind: "poster", poster: POSTER_NAMES[pm[1]] || "today" };
  return { kind: "home" };
}

async function boot() {
  ROUTE = route();
  {
    const r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    $("#themeBtn").textContent = dk ? "Day" : "Night";
  }
  // Config, edition and live data are requested together, not one after another.
  // index.html starts these in <head>, before this script has even downloaded.
  const P0 = window.PRE0 || {};
  const ed = ROUTE.kind === "archive" || ROUTE.kind === "editor" ? null : (ROUTE.kind !== "edition" && P0.latest) || getJSON(ROUTE.kind === "edition" ? `/content/editions/${ROUTE.date}.json` : "/content/latest.json");
  ed?.catch(() => {});
  if (ROUTE.kind === "home" || ROUTE.kind === "today" || ROUTE.kind === "poster") for (const k of LIVE_KEYS) PRE[k] = (P0.live?.[k] || getJSON(`/api/live/${k}`)).catch(() => null);
  try { CFG = await (P0.cfg || getJSON("/config/house.json")); }
  catch { $("#main").innerHTML = `<p class="notice">The paper could not be loaded. Try again in a minute.</p>`; return; }
  if (ROUTE.kind === "archive") return renderArchive();
  if (ROUTE.kind === "editor") return renderEditor();
  try { E = await ed; }
  catch {
    $("#main").innerHTML = ROUTE.kind === "edition" ? `<p class="notice">No edition for that date. <a class="backlink" href="/archive">See the archive</a>.</p>` : `<p class="notice">The first edition is on its way.</p>`;
    return;
  }
  if (ROUTE.kind === "edition") {
    $("#pastbar").innerHTML = `You are reading the edition of ${esc(longDate(E.date))}. Live figures show the snapshot from press time. <a href="/">Today's paper</a> · <a href="/archive">Archive</a>`;
    $("#pastbar").hidden = false;
  } else {
    const today = istDate();
    const hm = new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
    if (E.date < today && hm >= "16:30") { $("#late").textContent = `Today's paper is late. This is the edition of ${longDate(E.date)}.`; $("#late").hidden = false; }
  }
  // First paint with the snapshot, then fetch live.
  for (const [k, s] of Object.entries(E.snapshot || {})) if (s?.value) LIVE[k] = { ...s, stale: true };
  render();
  const poster = ROUTE.kind === "poster" ? ROUTE.poster : ROUTE.kind === "today" ? "today" : POSTER_NAMES[new URLSearchParams(location.search).get("poster")];
  if (poster) { openPoster(poster); posterKiosk(); }
  setInterval(tick, 1000);
  if (ROUTE.kind !== "edition") {
    await refreshLive();
    if (store.get("h1400-loc")) {
      try { const p = await navigator.permissions?.query({ name: "geolocation" }); if (p?.state === "granted") myLocation(false); } catch {}
    }
    liveTimer = setInterval(() => { if (!document.hidden) refreshLive(); }, LIVE_EVERY);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshLive(); });
  }
}

boot();
