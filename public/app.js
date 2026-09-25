// The House of 1400. Renders an edition JSON and keeps the live layer fresh.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const TZ = "Asia/Kolkata";
const LIVE_EVERY = 5 * 60 * 1000;

let CFG, E, ROUTE, LIVE = {}, pTimer, liveTimer, liveTried = false;

// ------------------------------------------------------------------ helpers
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = n => (n == null || !isFinite(n) ? "" : `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`);
const dir = n => (n == null ? "" : n < 0 ? "dn" : "up");
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

function cd(ms) {
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  return (d ? d + "d " : "") + (d || h ? h + "h " : "") + m + "m " + String(s).padStart(2, "0") + "s";
}

let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2600); }

async function getJSON(url) {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
  if (r.status === 401) { location.reload(); throw new Error("locked"); }
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ------------------------------------------------------------------ live layer
// Primary and backup live in /api/live. Then the edition snapshot, with its time. Otherwise hide.
async function live(key, qs = "") {
  const past = ROUTE.kind === "edition";
  if (!past) {
    try {
      const j = await getJSON(`/api/live/${key}${qs}`);
      if (j.ok && j.value) return (LIVE[key] = { value: j.value, as_of: j.as_of, source: j.source, stale: false });
    } catch {}
  }
  const s = E?.snapshot?.[key];
  if (s && s.value) return (LIVE[key] = { value: s.value, as_of: s.as_of, source: s.source, stale: true });
  return (LIVE[key] = null);
}

async function refreshLive() {
  const keys = ["weather", "f1_next", "f1_standings", "f1_last", "football", "laliga_table", "markets", "gold_in", "nba"];
  await Promise.all(keys.map(k => live(k)));
  if (ROUTE.kind !== "edition") {
    const ids = (E.betting || []).map(b => b.id).filter(Boolean).join(",");
    await Promise.all([live("betting", ids ? `?ids=${encodeURIComponent(ids)}` : ""), E.trends?.india?.length ? null : live("trends")]);
  }
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
const NIGHT = { 0: "🌙", 1: "🌙", 2: "☁️" };
const wxAt = (c, hour) => ((hour >= 19 || hour < 6) && NIGHT[c] ? NIGHT[c] : wx(c)[0]);

const sourcesLine = srcs => (srcs?.length ? `<div class="src">${srcs.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</div>` : "");
const newFor = x => (x.new_for_you ? `<span class="newfor">New for you</span>` : "");

function tools(st, withMore) {
  const v = store.get("h1400-votes") || {};
  const cur = v[st.id];
  const link = st.sources?.[0]?.url;
  const id = esc(st.id);
  return `<div class="tools">${withMore ? `<button class="rm" data-more="${id}" aria-expanded="false">Full story</button>` : ""}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Source ↗</a>` : ""}<button data-clip="${id}" title="Share this story as an image">Share</button><span class="thumbs" role="group" aria-label="Tune future editions"><button class="th" data-th="up" data-story="${id}" aria-pressed="${cur === "up"}" title="More stories like this" aria-label="More stories like this">👍</button><button class="th" data-th="down" data-story="${id}" aria-pressed="${cur === "down"}" title="Fewer stories like this" aria-label="Fewer stories like this">👎</button></span></div>`;
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
  return `<div class="${cls}" id="s-${esc(b.id)}" style="--acc:${accent(b.section)}" data-thread="${esc(b.thread_id)}">${b.kicker ? `<div class="${cls === "brief" ? "kick" : "tag"}">${esc(b.kicker)}${newFor(b)}</div>` : newFor(b)}<h4>${esc(b.headline)}</h4>${esc(b.text)}${sourcesLine(b.sources)}</div>`;
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
  earL() {
    const w = LIVE.weather?.value?.cities?.[0]; if (!w) return "";
    const [e, t] = wx(w.current.code), d = w.daily[0];
    return `<b>Sky Report</b><span class="big tnum">${Math.round(w.current.temp)}°</span> ${e} ${esc(t)}<br>High ${Math.round(d.max)}° · Low ${Math.round(d.min)}°`;
  },
  earR() {
    return `<b><span class="live"><i></i>Next up</span></b><span class="big tnum" data-cd="sess">--</span><br><span data-cd="sessname"></span>`;
  },
  railWeather() {
    const w = LIVE.weather?.value?.cities?.[0]; if (!w) return "";
    const [e] = wx(w.current.code), d = w.daily[0];
    return `<a class="w" href="#sky"><b>${esc(w.name)} now</b><div class="row"><span class="big tnum">${Math.round(w.current.temp)}°</span><span>${e}${d.rain_prob != null ? ` ${d.rain_prob}% rain` : ""}</span></div>Today ${Math.round(d.max)}° / ${Math.round(d.min)}°${staleNote("weather")}</a>`;
  },
  // Race countdown only in race week; the masthead's "Next up" covers everything else.
  railF1() {
    const r = LIVE.f1_next?.value?.race; if (!r) return "";
    const race = r.sessions.at(-1);
    if (!race.time_confirmed || Date.parse(race.start) - Date.now() > 7 * 864e5) return "";
    return `<a class="w" href="#paddock"><b><span class="live"><i></i>F1 · ${esc(r.locality || r.country)}</span></b><span class="big tnum" data-until="${race.start}" data-min="${race.minutes}" data-done="Race done">--</span><br>to lights out, ${esc(istFull(race.start))} IST</a>`;
  },
  railIndex(name) {
    const q = LIVE.markets?.value?.indices?.find(i => i.name === name); if (!q) return "";
    const col = q.change_pct < 0 ? "var(--bad)" : "var(--good)", s = q.spark?.slice(-22) || [];
    return `<a class="w" href="#ledger"><div class="row"><b>${esc(name)}</b><span class="${dir(q.change_pct)} tnum">${pct(q.change_pct)}</span></div><span class="big tnum">${inr(Math.round(q.price))}</span>${spark(s, col, { w: 200, h: 34, mini: true })}${staleNote("markets")}</a>`;
  },
};






function railHTML() {
  const prof = CFG.day_profiles[E.weekday] || {};
  const markets = CFG.markets.top_two.map(n => LIVEBLOCKS.railIndex(n)).join("");
  const sport = LIVEBLOCKS.railF1();
  return LIVEBLOCKS.railWeather() + (prof.live_first === "fixtures" ? sport + markets : markets + sport);
}

// Madridismo owns Madrid's fixtures: the next four, the last result, form and table.
function madridBlock({ stacked = false } = {}) {
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
  const facts = lines.join("") + staleNote("football");
  if (!table && !lines.length) return "";
  return stacked ? `<div class="facts">${facts}</div>${table}` : `<div class="cols2"><div>${table}</div><div class="facts">${facts}</div></div>`;
}
const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

function paddockBlock({ stacked = false } = {}) {
  const N = LIVE.f1_next?.value, S = LIVE.f1_standings?.value, Lr = LIVE.f1_last?.value, D = E.sections?.paddock?.data || {};
  let table = "";
  const n = Date.now();
  if (N?.race) {
    const tz = D.local_tz;
    const t = (iso, zone) => esc(fmt(iso, { weekday: "short", hour: "2-digit", minute: "2-digit" }, zone).replace(",", ""));
    table = `<div class="tbl"><table><thead><tr><th>Session</th>${tz ? `<th class="r">Local</th>` : ""}<th class="r">IST</th></tr></thead><tbody>${N.race.sessions.map(s => {
      const st = stateOf({ start: Date.parse(s.start), end: Date.parse(s.start) + s.minutes * 6e4 }, n);
      return `<tr class="${st === "on" ? "on" : st === "done" ? "done" : ""}"><td>${esc(s.name)}${st === "on" ? ` <span class="live"><i></i>On now</span> <button class="refresh" data-refresh="f1_next">Refresh</button>` : st === "done" ? ` <small>done</small>` : ""}</td>${tz ? `<td class="r tnum">${s.time_confirmed ? t(s.start, tz) : "TBC"}</td>` : ""}<td class="r tnum">${s.time_confirmed ? t(s.start) : "TBC"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  const bits = [];
  if (S?.drivers?.length) {
    const max = S.drivers.find(d => /Verstappen/.test(d.name)), lead = S.drivers[0];
    if (max) bits.push(`<p><b>${esc(CFG.follows.f1_driver.label)}.</b> ${ordinal(max.pos)} on ${max.points} points${max === lead ? ", leading the championship" : `, ${lead.points - max.points} behind ${esc(lead.name)}`}.${D.max_note ? " " + esc(D.max_note) : ""}</p>`);
    if (lead && lead !== max) { const second = S.drivers[1]; bits.push(`<p><b>Leader.</b> ${esc(lead.name)} (${esc(lead.team)}) on ${lead.points}${second ? `, ${lead.points - second.points} clear of ${esc(second.name)}` : ""}.</p>`); }
  }
  if (Lr?.results?.length) {
    const w = Lr.results[0], mx = Lr.results.find(r => /Verstappen/.test(r.name));
    bits.push(`<p><b>Last race.</b> ${esc(Lr.flag)} ${esc(Lr.name)}: ${esc(w.name)} won${mx && mx !== w ? `, Verstappen ${ordinal(mx.pos)}` : ""}.</p>`);
  }
  for (const note of D.notes || []) bits.push(`<p><b>${esc(note.label)}.</b> ${esc(note.text)}</p>`);
  if (N?.upcoming?.length) bits.push(`<p><b>Next three.</b> ${N.upcoming.map(u => `${esc(u.flag)} ${esc(u.name.replace(" Grand Prix", ""))} ${esc(istDay(u.date))}`).join(" · ")}</p>`);
  if (!table && !bits.length) return "";
  const facts = `<div class="facts">${bits.join("")}${staleNote("f1_standings")}</div>`;
  return stacked ? table + facts : `<div class="cols2"><div>${table}</div>${facts}</div>`;
}

function tablesBlock() {
  const S = LIVE.f1_standings?.value, T = LIVE.laliga_table?.value, B = LIVE.nba?.value;
  const cols = [];
  if (S?.drivers?.length) {
    const top = S.drivers[0].points || 1;
    const rows = S.drivers.slice(0, 10);
    const max = S.drivers.find(d => /Verstappen/.test(d.name));
    if (max && !rows.includes(max)) rows.push(max);
    cols.push(`<div class="tbl"><table><thead><tr><th>#</th><th>F1 drivers</th><th style="width:38%"></th><th class="r">Pts</th></tr></thead><tbody>${rows.map(d => `<tr class="${d === max ? "on" : ""}"><td>${d.pos}</td><td>${esc(d.name)}<br><small>${esc(d.team || "")}</small></td><td><span class="bar" style="width:${(d.points / top * 100).toFixed(1)}%;background:var(--acc-f1)"></span></td><td class="r tnum">${d.points}</td></tr>`).join("")}</tbody></table>${staleNote("f1_standings")}</div>`);
  }
  if (T?.rows?.length) {
    const club = CFG.follows.football_club;
    const isUs = r => String(r.id) === String(club.espn_id) || r.team === club.name;
    const rows = T.rows.slice(0, 8);
    const us = T.rows.find(isUs);
    if (us && !rows.includes(us)) rows.push(us);
    cols.push(`<div class="tbl"><table><thead><tr><th>#</th><th>La Liga</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${rows.map(r => `<tr class="${isUs(r) ? "on" : ""}"><td>${r.rank}</td><td>${esc(r.team)}</td><td class="r tnum">${r.played ?? ""}</td><td class="r tnum">${r.gd > 0 ? "+" : ""}${r.gd ?? ""}</td><td class="r tnum">${r.points}</td></tr>`).join("")}</tbody></table>${staleNote("laliga_table")}</div>`);
  }
  if (B?.in_season && B.west?.length) {
    cols.push(`<div class="tbl"><table><thead><tr><th>#</th><th>NBA West</th><th class="r">W</th><th class="r">L</th><th class="r">GB</th></tr></thead><tbody>${B.west.map(r => `<tr class="${/Warriors/.test(r.team) ? "on" : ""}"><td>${r.rank}</td><td>${esc(r.team)}</td><td class="r tnum">${r.wins}</td><td class="r tnum">${r.losses}</td><td class="r tnum">${esc(r.gb ?? "")}</td></tr>`).join("")}</tbody></table></div>`);
  }
  return cols.length ? `<div class="${cols.length > 1 ? "cols2" : ""}">${cols.join("")}</div>` : "";
}

function warriorsBlock() {
  const B = LIVE.nba?.value;
  if (!B?.in_season) return "";
  const bits = [];
  if (B.last) bits.push(`Last: ${B.last.winner === "us" ? "beat" : "lost to"} ${esc(B.last.opponent)} ${esc(B.last.score?.us)}–${esc(B.last.score?.them)}.`);
  if (B.next?.length) bits.push(`Next: ${B.next.map(g => `${g.home ? "v" : "at"} ${esc(g.opponent)}, ${esc(istFull(g.date))} IST`).join("; ")}.`);
  const pos = B.west?.find(r => /Warriors/.test(r.team));
  if (pos) bits.push(`${ordinal(pos.rank)} in the West.`);
  return bits.length ? `<div class="item" style="--acc:var(--acc-sp)"><div class="tag">NBA · Warriors</div>${bits.join(" ")}</div>` : "";
}

// Every figure gets a note that says something: the editor's driver for the day if there is one,
// otherwise where the level sits in its own 3-month history.
function assetNote(name, q) {
  const D = E.sections?.ledger?.data || {};
  const fmtN = v => (v >= 1000 ? inr(Math.round(v)) : v.toFixed(2));
  const range = q?.lo3m != null ? `3-month range ${fmtN(q.lo3m)} to ${fmtN(q.hi3m)}` : "";
  return [D.notes?.[name], q?.note || range].filter(Boolean).map(x => x.replace(/\.$/, "")).join(". ") + ".";
}

function ledgerBlock() {
  const M = LIVE.markets?.value, G = LIVE.gold_in?.value, D = E.sections?.ledger?.data || {};
  const prof = CFG.day_profiles[E.weekday] || {};
  let h = "";
  if (M?.indices?.length) {
    h += `<div class="cols3 panels">${M.indices.map(q => {
      const col = q.change_pct < 0 ? "var(--bad)" : "var(--good)";
      const when = q.live ? "today, live" : `on ${sparkLabel(q.session_date)}`;
      const driver = D.notes?.[q.name];
      return `<div class="panel"><div class="nm">${esc(q.name)}</div><div class="lvl tnum">${inr(Math.round(q.price))}</div><div class="chg ${dir(q.change_pct)} tnum">${pct(q.change_pct)} ${esc(when)}</div>${q.note ? `<div class="pnote">${esc(q.note)}</div>` : ""}${spark(q.spark, col, { from: sparkLabel(q.spark_from), to: sparkLabel(q.spark_to) })}${driver ? `<p class="note">${esc(driver)}</p>` : ""}${D.dma?.[q.name] ? `<p class="note">${esc(D.dma[q.name])}</p>` : ""}</div>`;
    }).join("")}</div>`;
  }
  const rows = [];
  for (const c of CFG.markets.cross) {
    if (c.source === "ibja") {
      if (G) rows.push(`<tr><td><b>Gold 24K</b><br><small>IBJA, per 10g</small></td><td class="r tnum">₹${inr(G.per_10g_24k)}</td><td class="r tnum"></td><td class="sub">22K ₹${inr(G.per_10g_22k)}${D.notes?.[c.name] ? ". " + esc(D.notes[c.name]) : ""}</td></tr>`);
      continue;
    }
    const q = M?.cross?.find(x => x.symbol === c.yahoo); if (!q) continue;
    const lvl = c.yahoo === "INR=X" ? "₹" + q.price.toFixed(2) : c.yahoo === "BZ=F" ? "$" + usd(q.price, 2) : c.yahoo === "BTC-USD" ? "$" + usd(q.price) : inr(Math.round(q.price));
    rows.push(`<tr><td><b>${esc(c.name)}</b></td><td class="r tnum">${lvl}</td><td class="r tnum ${dir(q.change_pct)}">${pct(q.change_pct)}</td><td class="sub">${esc(assetNote(c.name, q))}</td></tr>`);
  }
  if (rows.length) h += `<div class="tbl cross"><table><thead><tr><th>Asset</th><th class="r">Level</th><th class="r">Change</th><th>Note</th></tr></thead><tbody>${rows.join("")}</tbody></table>${staleNote("markets")}</div>`;
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
  const strip = `<div class="strip7">${c.daily.map(d => `<div class="${wetness(d.rain_prob)}"><b>${dayShort(d.date)}</b><span class="e" aria-hidden="true">${wx(d.code)[0]}</span><span class="tnum">${Math.round(d.max)}°</span>${(d.rain_prob ?? 0) >= 40 ? `<small>${d.rain_prob}%</small>` : "<small>&nbsp;</small>"}</div>`).join("")}</div>`;
  let h = `<p class="sky-lede">${esc(weekSentence(c.daily))}</p>${keyHours(c)}${strip}`;
  const others = W.cities.slice(1).map(notableLine).join("");
  if (others) h += `<div class="cities">${others}</div>`;
  h += `<div id="myloc"></div>`;
  if (ROUTE.kind !== "edition" && navigator.geolocation && !store.get("h1400-loc")) h += `<p class="note"><button class="linkish" id="locBtn">📍 Add the weather where you are</button></p>`;
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

function creaseBlock() {
  const rows = E.sections?.crease?.data?.rows || [];
  const t = rows.length ? `<table class="kv"><tbody>${rows.map(r => `<tr class="${r.on ? "on" : ""}"><th scope="row">${esc(r.label)}</th><td>${esc(r.text)}</td></tr>`).join("")}</tbody></table>` : "";
  return split(t, "crease");
}

function deuceBlock() {
  const T = E.tennis || {};
  let h = "";
  if (T.events?.length) h += `<div class="tbl" style="margin-bottom:16px"><table><thead><tr><th>Tournament</th><th>Dates</th><th>Note</th></tr></thead><tbody>${T.events.map(e => `<tr><td><b style="font-weight:600">${esc(e.name)}</b>${e.place ? " · " + esc(e.place) : ""}</td><td>${esc(e.dates)}</td><td class="sub">${esc([e.level, e.note].filter(Boolean).join(" · "))}</td></tr>`).join("")}</tbody></table></div>`;
  if (T.players?.length) h += `<div class="cols2">${T.players.map(p => `<div class="panel"><div class="nm">${esc(p.name)}</div>${p.next_match ? `<p style="margin:6px 0 4px"><b>Next match:</b> ${esc(p.next_match.text)}</p>` : ""}${p.next_event ? `<p style="margin:6px 0 4px"><b>${p.next_match ? "Event" : "Next event"}:</b> ${esc(p.next_event.text)}${p.next_match ? "" : " Match TBD."}</p>` : ""}${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}</div>`).join("")}</div>`;
  return h + storiesBlock("deuce");
}

const VERDICT = { must: ["v-must", "Must watch"], good: ["v-good", "Good watch"], call: ["v-call", "Your call"], skip: ["v-skip", "Skip"], early: ["v-early", "Too early"] };
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
function bettingBlock() {
  const liveM = LIVE.betting?.value?.markets || [];
  const list = (E.betting?.length ? E.betting : liveM).slice(0, CFG.betting.show || 10);
  if (!list.length) return "";
  const idOf = b => (b.id?.includes(":") ? b.id : b.id ? `pm:${b.id}` : null);
  const rows = list.map(b => {
    const L = !LIVE.betting?.stale && liveM.find(m => m.id === idOf(b));
    const outs = (L?.outcomes?.length ? L.outcomes : b.outcomes).slice(0, 3);
    const fav = outs[0];
    const label = o => (o.name === "Yes" && outs.length === 1 ? "Yes" : o.name);
    return `<li><div class="mk"><span class="cat">${esc(b.category || "World")} <span class="src">· ${esc(b.source || "Polymarket")}</span></span><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>${b.note ? `<small>${esc(b.note)}</small>` : ""}</div><div class="outs">${outs.map((o, i) => `<span class="${i === 0 ? "fav" : ""}">${esc(label(o))} <b class="tnum">${Math.round(o.prob)}%</b></span>`).join("")}</div><div class="bar"><span style="width:${Math.max(0, Math.min(100, fav.prob))}%"></span></div></li>`;
  }).join("");
  return `<ol class="markets">${rows}</ol><p class="asof" style="margin-top:8px">${LIVE.betting && !LIVE.betting.stale ? "Live prices" : `Prices ${agoIST(LIVE.betting?.as_of) || "at press time"}`}. Probabilities are what traders pay, not forecasts.</p>`;
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
  $("#motto").textContent = `${CFG.paper.motto} · Edited by ${CFG.paper.editor.signature.replace(", Editor", "")}`;
  $("#profile").textContent = E.profile_line;

  let h = frontHTML();
  h += secWrap("fixtures", `<div data-live="fixtures">${fixturesBlock()}</div>`, "Next 7 days · IST");
  h += secWrap("madrid", split(`<div data-live="madrid" data-stacked="${E.sections?.madrid?.stories?.length ? 1 : ""}">${madridBlock({ stacked: !!E.sections?.madrid?.stories?.length })}</div>`, "madrid"));
  h += secWrap("pitch", storiesBlock("pitch"), "Football beyond Madrid");
  const race = LIVE.f1_next?.value?.race;
  h += secWrap("paddock", split(`<div data-live="paddock" data-stacked="${E.sections?.paddock?.stories?.length ? 1 : ""}">${paddockBlock({ stacked: !!E.sections?.paddock?.stories?.length })}</div>`, "paddock"), race ? `${race.flag} Round ${race.round ?? ""} · ${race.name}${race.locality ? " · " + race.locality : ""}` : undefined);
  h += secWrap("crease", creaseBlock(), "India men · senior team");
  h += secWrap("deuce", deuceBlock(), "Tennis · big events first, then Alcaraz and Djokovic");
  h += secWrap("sidelines", `<div data-live="warriors">${warriorsBlock()}</div>` + storiesBlock("sidelines"), "Every other sport, when it matters");
  h += secWrap("tables", `<div data-live="tables">${tablesBlock()}</div>`, "Standings, refreshed live");
  h += secWrap("dateline", storiesBlock("dateline"), "World & India");
  h += secWrap("workshop", storiesBlock("workshop"), "Tech · AI · wearables");
  h += secWrap("pipeline", storiesBlock("pipeline"), "SDR · outbound · GTM");
  h += secWrap("ledger", `<div data-live="ledger">${ledgerBlock()}</div>` + storiesBlock("ledger"), "Markets · money · cards");
  h += secWrap("sky", `<div data-live="sky">${skyBlock()}</div>` + storiesBlock("sky"), `${CFG.paper.home_city} · the week ahead`);
  h += secWrap("namma", storiesBlock("namma"), `${CFG.paper.home_city} · fuller on Fri, Sat, Sun`);
  h += secWrap("screen", screenBlock(), "English and Hindi · theatre and OTT");
  h += secWrap("talk", `<div data-live="talk">${talkBlock()}</div>`, "What people are searching for");
  h += secWrap("betting", `<div data-live="betting">${bettingBlock()}</div>`, "What the world is betting on · Polymarket and Kalshi");
  h += secWrap("bye", byeBlock(), "Watch and do");
  h += deskBlock();
  if (E.editor_note) h += `<div class="editor">${esc(E.editor_note)}<span>${esc(CFG.paper.editor.signature)}</span></div>`;
  h += `<div class="house" id="house"><b>${esc(sec("house").name)}</b><p>${esc(E.house_note)}</p></div>`;
  h += `<div class="foot">${esc(`THE HOUSE OF 1400 · ${longDate(E.date).toUpperCase()} · NO. ${n} · EDITED BY ${CFG.paper.editor.signature.replace(", Editor", "").toUpperCase()}`)}</div>`;
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
  if (innerWidth <= 980) return;
  for (let i = 0; i < 3; i++) {
    const last = side.querySelector(".story:last-of-type");
    if (!last || side.querySelectorAll(".story").length < 2) break;
    const gap = side.offsetHeight - lead.offsetHeight, h = last.offsetHeight;
    if (gap <= h * 0.6) break;
    last.classList.add("moved"); lead.appendChild(last);
  }
}

function paintLive() {
  const L = LIVEBLOCKS.earL();
  $("#ear-l").innerHTML = L; $("#ear-l").hidden = !L;
  $("#ear-r").innerHTML = LIVEBLOCKS.earR(); $("#ear-r").hidden = false;
  $("#rail").innerHTML = railHTML();
  const map = { talk: talkBlock, fixtures: fixturesBlock, madrid: () => madridBlock({ stacked: !!document.querySelector('[data-live="madrid"]')?.dataset.stacked }), paddock: () => paddockBlock({ stacked: !!document.querySelector('[data-live="paddock"]')?.dataset.stacked }), tables: tablesBlock, ledger: ledgerBlock, sky: skyBlock, warriors: warriorsBlock, betting: bettingBlock };
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
function findStory(id) { return allStories().find(s => s.id === id); }

function toggleMore(id) {
  const m = document.getElementById("more-" + id), b = document.querySelector(`[data-more="${CSS.escape(id)}"]`);
  if (!m) return false;
  m.hidden = !m.hidden;
  if (b) { b.textContent = m.hidden ? "Read more" : "Read less"; b.setAttribute("aria-expanded", !m.hidden); }
  return true;
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
  x.font = "400 64px 'Libre Caslon Display', Georgia, serif"; const hl = wrap(x, st.headline, W - 2 * P);
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
  x.fillStyle = col("--ink"); x.font = "400 64px 'Libre Caslon Display', Georgia, serif";
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
  if (t.id === "glanceBtn") { const g = $("#glance"); g.hidden = !g.hidden; t.setAttribute("aria-expanded", !g.hidden); t.textContent = g.hidden ? "✦ At a Glance" : "✕ Close"; return; }
  if (t.dataset.go) { const el = document.getElementById("s-" + t.dataset.go) || document.getElementById(t.dataset.go); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); $("#glance").hidden = true; $("#glanceBtn").textContent = "✦ At a Glance"; return; }
  if (t.dataset.more) { toggleMore(t.dataset.more); return; }
  if (t.dataset.head) { if (!toggleMore(t.dataset.head)) toast("Short story. The full text is already shown."); return; }
  if (t.dataset.th) { vote(t.dataset.story, t.dataset.th); return; }
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
addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(balanceFront, 200); });
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
      const d = c.daily[0], [em, tx] = wx(c.current.code);
      const el = $("#myloc"); if (el) el.innerHTML = `<p class="note" style="font-size:15px">📍 Where you are: <b>${Math.round(c.current.temp)}°</b> ${em} ${esc(tx)} · today ${Math.round(d.max)}° / ${Math.round(d.min)}°, ${d.rain_prob ?? "–"}% rain</p>`;
      const b = $("#locBtn"); if (b) b.parentElement.remove();
      store.set("h1400-loc", true);
    } catch {}
  }, () => { if (ask) toast("Location not available."); }, { maximumAge: 30 * 60 * 1000, timeout: 10000 });
}

// ------------------------------------------------------------------ poster mode
function heads() {
  return [E.front.lead, ...E.front.seconds, ...E.front.briefs].slice(0, 5).map(s => [s.kicker || sec(s.section).short, s.headline]);
}
const mastHTML = () => `<div class="pm"><span class="the">The</span><span class="hof">House of</span><span class="yr">1400</span><span class="sub">${esc(longDate(E.date))} · Edited by ${esc(CFG.paper.editor.signature.replace(", Editor", ""))}</span></div>`;
function stripBits() {
  const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value?.indices || [];
  const bits = [];
  if (w) bits.push(`${esc(w.name)} ${Math.round(w.current.temp)}° ${wx(w.current.code)[0]}`);
  for (const nm of CFG.markets.top_two) { const q = M.find(i => i.name === nm); if (q) bits.push(`${esc(nm)} ${inr(Math.round(q.price))} <span class="${dir(q.change_pct)}">${pct(q.change_pct)}</span>`); }
  return bits;
}
function openPoster(k) {
  const P = $("#poster"); clearInterval(pTimer);
  P.className = "poster" + (k === "night" || k === "clock" ? " dark" : "");
  if (k === "mast" || k === "night") P.innerHTML = mastHTML();
  if (k === "heads") {
    const H = heads(); let i = 0;
    P.innerHTML = `<div class="pm"><span class="hof" style="margin-bottom:24px">The House of 1400</span><div class="ph" id="ph">${esc(H[0][1])}</div></div>`;
    pTimer = setInterval(() => { const h = $("#ph"); if (!h) return; h.style.opacity = 0; setTimeout(() => { i = (i + 1) % H.length; h.textContent = H[i][1]; h.style.opacity = 1; }, 800); }, 9000);
  }
  if (k === "clock") {
    P.innerHTML = `<div class="pm"><span class="hof">The House of 1400</span><div class="clock" data-clock></div><div class="strip">${stripBits().map(b => `<span>${b}</span>`).join("")}<span>Next: <b data-cd="sessname"></b> <b data-cd="sess"></b></span></div></div>`;
    pTimer = setInterval(tick, 1000);
  }
  if (k === "today") {
    const w = LIVE.weather?.value?.cities?.[0], M = LIVE.markets?.value?.indices || [];
    const q = nm => M.find(i => i.name === nm);
    const cell = nm => { const x = q(nm); return x ? `<div><small>${esc(nm)}</small><b class="tnum">${inr(Math.round(x.price))}</b><span class="${dir(x.change_pct)}">${pct(x.change_pct)}</span></div>` : ""; };
    P.innerHTML = `<div class="today"><div class="t-m"><span>The House of</span><b>1400</b><span>${esc(longDate(E.date))}</span></div><div class="t-g">${w ? `<div><small>${esc(w.name)}</small><b>${Math.round(w.current.temp)}° ${wx(w.current.code)[0]}</b>${Math.round(w.daily[0].max)}° / ${Math.round(w.daily[0].min)}°</div>` : ""}<div><small>Next up</small><b data-cd="sess"></b><span data-cd="sessname"></span></div>${CFG.markets.top_two.map(cell).join("")}</div><ol>${heads().map(h => `<li><small>${esc(h[0])}</small>${esc(h[1])}</li>`).join("")}</ol><div class="t-f">Tap anywhere to open the paper</div></div>`;
  }
  P.hidden = false; tick();
  if (k !== "today") { try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch {} }
  try { navigator.wakeLock?.request("screen").catch(() => {}); } catch {}
}
function closePoster() {
  const P = $("#poster"); if (P.hidden) return;
  P.hidden = true; clearInterval(pTimer);
  try { document.fullscreenElement && document.exitFullscreen(); } catch {}
  if (location.pathname === "/today" || new URLSearchParams(location.search).has("poster")) history.replaceState(null, "", "/");
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

// ------------------------------------------------------------------ boot
function route() {
  const p = location.pathname.replace(/\/+$/, "") || "/";
  const m = p.match(/^\/e\/(\d{4}-\d{2}-\d{2})$/);
  if (m) return { kind: "edition", date: m[1] };
  if (p === "/archive") return { kind: "archive" };
  if (p === "/today") return { kind: "today" };
  return { kind: "home" };
}

async function boot() {
  ROUTE = route();
  {
    const r = document.documentElement, dk = r.getAttribute("data-theme") === "dark" || (!r.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    $("#themeBtn").textContent = dk ? "Day" : "Night";
  }
  try { CFG = await getJSON("/config/house.json"); }
  catch { $("#main").innerHTML = `<p class="notice">The paper could not be loaded. Try again in a minute.</p>`; return; }
  if (ROUTE.kind === "archive") return renderArchive();
  try { E = await getJSON(ROUTE.kind === "edition" ? `/content/editions/${ROUTE.date}.json` : "/content/latest.json"); }
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
    if (E.date < today && hm >= "15:15") { $("#late").textContent = `Today's paper is late. This is the edition of ${longDate(E.date)}.`; $("#late").hidden = false; }
  }
  // First paint with the snapshot, then fetch live.
  for (const [k, s] of Object.entries(E.snapshot || {})) if (s?.value) LIVE[k] = { ...s, stale: true };
  render();
  const poster = new URLSearchParams(location.search).get("poster");
  if (ROUTE.kind === "today") openPoster("today");
  else if (poster) openPoster(poster);
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
