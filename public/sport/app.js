// Sport (/sport): everything Parth follows, in one app. Reads the paper's live feeds (/api/live/<key>) and the two the
// app adds (madrid_hub, f1_hub, lib/sportapp.js). Rules from the paper: a figure shows only from its source, with its
// time; a feed that fails falls back to the last copy this phone saw, then the day's edition snapshot, marked "as of";
// otherwise the block is left out. Times are IST. No LLM anywhere.
const TZ = "Asia/Kolkata";
const KEYS = ["football", "madrid_hub", "club_stats", "f1_next", "f1_sessions", "f1_standings", "f1_last", "f1_market", "f1_hub", "odds", "crease", "tennis_players", "tennis", "nba", "intl_football"];
const D = {}; // key -> { value, as_of, source, stale }
let CFG = null, SNAP = null, lastLoad = 0, loading = false;
const $ = s => document.querySelector(s);
const view = $("#view");

// ------------------------------------------------------------------ small helpers
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const t = iso => (iso ? Date.parse(iso) : NaN);
const fmt = (iso, o) => new Date(iso).toLocaleString("en-GB", { timeZone: TZ, ...o });
const dayKey = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
const hm = iso => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
function dayLabel(iso) {
  const k = dayKey(t(iso)), now = Date.now();
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now + 864e5)) return "Tomorrow";
  if (k === dayKey(now - 864e5)) return "Yesterday";
  return fmt(iso, { weekday: "short", day: "numeric", month: "short" });
}
const when = iso => `${dayLabel(iso)}, ${hm(iso)}`;
const shortDate = iso => fmt(iso, { day: "numeric", month: "short" });
function rel(iso) {
  const m = Math.round((t(iso) - Date.now()) / 6e4), a = Math.abs(m);
  const txt = a < 1 ? "now" : a < 60 ? `${a} min` : a < 48 * 60 ? `${Math.floor(a / 60)}h${a % 60 && a < 600 ? ` ${a % 60}m` : ""}` : `${Math.round(a / 1440)} days`;
  return a < 1 ? "now" : m > 0 ? `in ${txt}` : `${txt} ago`;
}
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(cf|fc|club de futbol|sad)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Two names for the same side: equal, or one is the other with words added ("Golden State" / "Golden State Warriors").
// Whole words only, so "Real Madrid" is never "Atlético Madrid" and "India" never "West Indies".
const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)); };
const last = n => String(n || "").split(" ").pop();
// "IND", "WI", "NZ", "JMC": a one-word name gives its first three letters, longer names their initials
const initials = n => { const w = String(n || "").split(/\s+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, 3) : w.map(x => x[0]).join("").slice(0, 3)).toUpperCase(); };
const val = k => D[k]?.value || null;
const vibe = () => { try { navigator.vibrate?.(8); } catch {} };
const ICON = {
  football: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  f1: '<svg viewBox="0 0 24 24"><path d="M5 21V3.5"/><path d="M5 4h14v9H5"/><path class="f" d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"/></svg>',
  cricket: '<svg viewBox="0 0 24 24"><path d="M15.5 3l5.5 5.5-9.6 9.6-5.5-5.5z"/><path d="M5.9 12.6L3 19.5 4.5 21l6.9-2.9"/></svg>',
  tennis: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M5 6.3c3.2 1.6 4.6 5.7 3 10.1M19 6.3c-3.2 1.6-4.6 5.7-3 10.1"/></svg>',
  nba: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3.4 3 8.6 0 12M18 6c-3 3.4-3 8.6 0 12"/></svg>',
};
const SPORT_NAME = { football: "Football", f1: "F1", cricket: "Cricket", tennis: "Tennis", nba: "NBA" };
const chip = (sp, label) => `<span class="chip sp sp-${sp}">${ICON[sp]}${esc(label || SPORT_NAME[sp])}</span>`;
const chev = '<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const crestUrl = id => `https://a.espncdn.com/i/teamlogos/soccer/500/${encodeURIComponent(id)}.png`;
function crest(id, name, cls = "") {
  if (!id) return `<span class="mono ${cls === "sm" || cls === "xs" ? "sm" : "lg"}" aria-hidden="true">${esc(initials(name))}</span>`;
  return `<img class="crest ${cls}" src="${crestUrl(id)}" alt="" loading="lazy" decoding="async" onerror="this.outerHTML='<span class=&quot;mono ${cls === "sm" || cls === "xs" ? "sm" : "lg"}&quot;>${esc(initials(name)).replace(/'/g, "")}</span>'">`;
}
const mono = (name, cls = "lg") => `<span class="mono ${cls}" aria-hidden="true">${esc(initials(name))}</span>`;
const srcLine = (...keys) => {
  const parts = keys.filter(k => D[k]?.source).map(k => `${esc(D[k].source)} ${D[k].as_of ? (dayKey(t(D[k].as_of)) === dayKey(Date.now()) ? hm(D[k].as_of) : `${shortDate(D[k].as_of)} ${hm(D[k].as_of)}`) : ""}${D[k].stale ? " (last saved)" : ""}`);
  return parts.length ? `<p class="foot">Sources: ${[...new Set(parts)].join(" · ")}. Times IST.</p>` : "";
};

// ------------------------------------------------------------------ data
async function getJSON(url, ms = 25000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-cache" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("sport:" + k) || "null"); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("sport:" + k, JSON.stringify(v)); } catch {} },
};
async function snapshot() {
  if (SNAP) return SNAP;
  try { SNAP = (await getJSON("/content/latest.json", 15000)).snapshot || {}; } catch { SNAP = {}; }
  return SNAP;
}
async function loadKey(k) {
  try {
    const j = await getJSON(`/api/live/${k}`, k === "f1_hub" || k === "madrid_hub" ? 40000 : 25000);
    if (j?.ok && j.value) { D[k] = { value: j.value, as_of: j.as_of, source: j.source, stale: false }; store.set(k, D[k]); return; }
    throw new Error(j?.error || "empty");
  } catch {
    const c = store.get(k);
    if (c?.value) { D[k] = { ...c, stale: true }; return; }
    const s = (await snapshot())[k];
    if (s?.value) D[k] = { value: s.value, as_of: s.as_of, source: s.source, stale: true };
  }
}
let paintQ = false;
const paintSoon = () => { if (paintQ) return; paintQ = true; requestAnimationFrame(() => { paintQ = false; render(false); }); };
async function loadAll() {
  if (loading) return; loading = true; $("#refresh").classList.add("spin");
  // Saved copies first, so a reopened app shows something at once (marked stale until the fresh copy lands)
  for (const k of KEYS) if (!D[k]) { const c = store.get(k); if (c?.value) D[k] = { ...c, stale: true }; }
  if (!CFG) { try { CFG = await getJSON("/config/house.json", 15000); } catch { CFG = store.get("cfg"); } if (CFG) store.set("cfg", CFG); }
  render(false);
  await Promise.all(KEYS.map(k => loadKey(k).then(paintSoon)));
  lastLoad = Date.now(); loading = false; $("#refresh").classList.remove("spin");
  render(false);
}

// ------------------------------------------------------------------ the follows, as events
const follows = () => CFG?.follows || {};
const club = () => follows().football_club?.name || "Real Madrid";
const favDriver = () => follows().f1_driver?.name || "Max Verstappen";
// The markets for a match: Kalshi or Polymarket via the paper's odds feed, matched by sport, the two sides and the day
function oddsFor(sport, sides, iso, kind = "match") {
  const M = (val("odds")?.matches || []).filter(m => m.sport === sport && m.kind === kind && Math.abs(Date.parse(m.date) - Date.parse(dayKey(t(iso)))) <= 864e5);
  if (kind !== "match") return M[0] || null;
  return M.find(m => m.sides?.length === 2 && ((same(m.sides[0], sides[0]) && same(m.sides[1], sides[1])) || (same(m.sides[0], sides[1]) && same(m.sides[1], sides[0])))) || null;
}
// Outcomes laid out as the fixture reads: first side, draw, second side
function sideProbs(m, sides) {
  if (!m) return null;
  const find = s => m.outcomes.find(o => same(o.name, s));
  const a = find(sides[0]), b = find(sides[1]), d = m.outcomes.find(o => /^draw$/i.test(o.name));
  if (!a || !b) return null;
  return { a: Math.round(a.prob), b: Math.round(b.prob), d: d ? Math.round(d.prob) : null, source: m.source, url: m.url };
}
function mktBar(p, names, sp) {
  if (!p) return "";
  const lead = Math.max(p.a, p.b, p.d ?? -1);
  const seg = (v, cls) => `<i class="${cls}${v === lead ? " lead" : ""}" style="flex:${Math.max(v, 3)}"></i>`;
  return `<div class="mkt sp-${sp}" role="img" aria-label="Market: ${esc(names[0])} ${p.a}%, ${p.d != null ? `draw ${p.d}%, ` : ""}${esc(names[1])} ${p.b}%">
    <div class="bar">${seg(p.a, "")}${p.d != null ? seg(p.d, "draw") : ""}${seg(p.b, "")}</div>
    <div class="lab"><span class="${p.a === lead ? "lead" : ""}"><b class="tnum">${p.a}%</b> ${esc(names[0])}</span>${p.d != null ? `<span class="${p.d === lead ? "lead" : ""}">Draw <b class="tnum">${p.d}%</b></span>` : ""}<span class="${p.b === lead ? "lead" : ""}">${esc(names[1])} <b class="tnum">${p.b}%</b></span></div>
    <div class="src">${esc(p.source)}${D.odds?.as_of ? ` · ${hm(D.odds.as_of)}` : ""}</div></div>`;
}
function rankList(outcomes, sp, { max = 6, nameFn = x => x, mark = null } = {}) {
  const o = [...outcomes].sort((a, b) => b.prob - a.prob).slice(0, max), top = o[0]?.prob || 1;
  return `<div class="rank sp-${sp}">${o.map((x, i) => `<span class="n${i === 0 || (mark && same(x.name, mark)) ? " lead" : ""}">${esc(nameFn(x.name))}</span><span class="tr"><i class="${i === 0 ? "lead" : ""}" style="width:${Math.max(2, (x.prob / Math.max(top, 1)) * 100)}%"></i></span><b class="p tnum${i === 0 ? " lead" : ""}">${Math.round(x.prob)}%</b>`).join("")}</div>`;
}

// Every followed fixture as one shape: { sp, start, state: live|next|done, title, a, b, crest ids, score, href, extra }
function events() {
  const out = [], now = Date.now();
  // Real Madrid (football: live state and score; madrid_hub: the season)
  const F = val("football"), H = val("madrid_hub"), cname = club();
  const fx = new Map();
  for (const m of [...(H?.fixtures || []), ...(H?.results || []).slice(0, 4)]) fx.set(m.id, m);
  for (const m of [...(F?.next || []), ...(F?.last ? [F.last] : [])]) fx.set(m.id, { ...fx.get(m.id), ...m, us: m.score?.us ?? fx.get(m.id)?.us, them: m.score?.them ?? fx.get(m.id)?.them });
  for (const m of fx.values()) {
    const home = m.home, a = home ? cname : m.opponent, b = home ? m.opponent : cname;
    const state = m.state === "in" ? "live" : m.completed || m.state === "post" ? "done" : "next";
    const sa = home ? m.us : m.them, sb = home ? m.them : m.us;
    out.push({ sp: "football", id: "rm" + m.id, start: m.date, state, title: `${a} v ${b}`, a, b, ida: home ? H?.club_id || "86" : m.opponent_id, idb: home ? m.opponent_id : H?.club_id || "86",
      comp: m.competition, venue: m.venue, sa, sb, clock: m.clock, won: m.winner === "us" ? (home ? "a" : "b") : m.winner === "them" ? (home ? "b" : "a") : null, href: "#football" });
  }
  // India (The Crease)
  const C = val("crease");
  if (C) {
    const all = [C.today, C.next, ...[C.main, ...(C.also || []), C.after].filter(Boolean).flatMap(S => (S.formats || []).flatMap(f => f.matches || []))].filter(Boolean);
    for (const m of new Map(all.map(m => [m.id, m])).values()) {
      const state = m.state === "live" ? "live" : m.state === "done" ? "done" : m.state === "off" ? "off" : "next";
      out.push({ sp: "cricket", id: "in" + m.id, start: m.start, state, title: `India v ${m.opponent}`, a: "India", b: m.opponent, comp: m.desc, venue: [m.ground, m.city].filter(Boolean).join(", "), status: m.status, score: m.score, won: m.won === true ? "a" : m.won === false ? "b" : null, tbc: m.time_announced === false, href: "#cricket" });
    }
  }
  // F1: the weekend's sessions that count (qualifying, sprints, the race)
  const N = val("f1_next")?.race, R = val("f1_sessions")?.results || [];
  for (const s of N?.sessions || []) {
    if (!/qualifying|sprint|race|shootout/i.test(s.name)) continue;
    const st = t(s.start), end = st + (s.minutes || 60) * 6e4, res = R.find(r => Math.abs(t(r.start) - st) < 45 * 6e4);
    out.push({ sp: "f1", id: "f1" + s.start, start: s.start, state: now >= end ? "done" : now >= st ? "live" : "next", title: /^race$/i.test(s.name) ? String(N.name).replace(/ in .*$/, "") : s.name, sub: /^race$/i.test(s.name) ? N.circuit : String(N.name).replace(/ in .*$/, ""), flag: N.flag, session: s.name, top: res?.top || null, href: "#f1" });
  }
  // Tennis
  for (const p of val("tennis_players")?.players || []) {
    if (p.next) out.push({ sp: "tennis", id: "tn" + p.name + p.next.when_utc, start: p.next.when_utc, state: p.next.live ? "live" : "next", title: `${last(p.name)} v ${last(p.next.opponent) || "TBC"}`, a: p.name, b: p.next.opponent, comp: [p.next.event, p.next.round].filter(Boolean).join(", "), venue: p.next.court, player: p.name, href: "#tennis" });
    if (p.last) out.push({ sp: "tennis", id: "tl" + p.name + p.last.when_utc, start: p.last.when_utc, state: "done", title: `${last(p.name)} v ${last(p.last.opponent)}`, a: p.name, b: p.last.opponent, comp: [p.last.event, p.last.round].filter(Boolean).join(", "), won: p.last.won ? "a" : "b", note: p.last.note, player: p.name, href: "#tennis" });
  }
  // The Warriors
  const B = val("nba"), team = follows().nba_team?.name || "Golden State Warriors";
  for (const g of [...(B?.next || []), ...(B?.last ? [B.last] : [])]) {
    const a = g.home ? team : g.opponent, b = g.home ? g.opponent : team;
    out.push({ sp: "nba", id: "nb" + g.id, start: g.date, state: g.live ? "live" : g.completed ? "done" : "next", title: `${a} v ${b}`, a, b, comp: g.preseason ? "Preseason" : "NBA", sa: g.score ? (g.home ? g.score.us : g.score.them) : null, sb: g.score ? (g.home ? g.score.them : g.score.us) : null, won: g.winner === "us" ? (g.home ? "a" : "b") : g.winner === "them" ? (g.home ? "b" : "a") : null, clock: g.clock, href: "#nba" });
  }
  return out.filter(e => e.start && !isNaN(t(e.start))).sort((x, y) => t(x.start) - t(y.start));
}
// The favourite's price for an event, for the Up next rows
function evOdds(e) {
  if (e.sp === "f1") {
    const kind = /sprint qualif|shootout/i.test(e.session) ? "sprint_qualifying" : /sprint/i.test(e.session) ? "sprint" : /qualif/i.test(e.session) ? "qualifying" : "race";
    const m = oddsFor("f1", null, e.start, kind); if (!m) return null;
    const fav = favDriver(), o = m.outcomes.find(x => same(x.name, fav));
    return o ? { label: last(fav), prob: Math.round(o.prob) } : null;
  }
  if (!e.a || !e.b) return null;
  const sp = e.sp === "nba" ? "basketball" : e.sp, m = oddsFor(sp, [e.a, e.b], e.start); if (!m) return null;
  const mine = e.sp === "football" ? club() : e.sp === "cricket" ? "India" : e.sp === "nba" ? (follows().nba_team?.name || "Golden State") : e.player;
  const o = m.outcomes.find(x => same(x.name, mine)); return o ? { label: last(mine), prob: Math.round(o.prob) } : null;
}

// ------------------------------------------------------------------ shared pieces
function header(title, sub, stalekeys = []) {
  const st = stalekeys.filter(k => D[k]?.stale);
  return `<header class="hero-h"><h1 id="h1">${title}</h1>${sub || st.length ? `<div class="sub">${sub || ""}${st.length ? `<span class="stale">Some figures are from ${hm(D[st[0]].as_of)}</span>` : ""}</div>` : ""}</header>`;
}
const blk = (title, body, extra = "") => (body ? `<section class="blk"><div class="blk-h"><h2>${title}</h2>${extra}</div>${body}</section>` : "");
const stateChip = e => (e.state === "live" ? `<span class="chip live"><i></i>Live</span>` : e.state === "done" ? `<span class="chip done">Final</span>` : e.state === "off" ? `<span class="chip done">No result</span>` : "");
const countdown = iso => `<span data-cd="${esc(iso)}">${esc(rel(iso))}</span>`;

// The hero for an event: two sides and the time (or the score), or a single title for F1
function nextCard(e, { odds = true } = {}) {
  if (!e) return "";
  const head = `<div class="when">${chip(e.sp, e.sp === "f1" ? "F1" : e.comp || SPORT_NAME[e.sp])}${e.state === "live" ? stateChip(e) : `<span class="count">${e.tbc ? "Time to be confirmed" : countdown(e.start)}</span>`}</div>`;
  if (e.sp === "f1") {
    const o = odds ? evOdds(e) : null;
    return `<a class="card next one sp-f1" href="${e.href}">${head}<div class="title">${e.flag ? `${esc(e.flag)} ` : ""}${esc(e.title)}<small>${esc(e.sub || "")}</small></div><div class="clock tnum">${hm(e.start)}<small>${esc(dayLabel(e.start))} IST</small></div>${o ? `<div class="foot">Markets give ${esc(o.label)} ${o.prob}%</div>` : ""}</a>`;
  }
  const side = (name, id) => `<div class="side">${e.sp === "football" ? crest(id, name) : mono(name)}<b>${esc(e.sp === "tennis" ? last(name) : name)}</b></div>`;
  const live = e.state === "live" && e.sa != null;
  const mid = live ? `<div class="mid tnum">${esc(e.sa)}–${esc(e.sb)}${e.clock ? `<small>${esc(e.clock)}</small>` : ""}</div>` : e.state === "live" && e.score ? `<div class="mid time"><small>${esc(e.score)}</small></div>` : `<div class="mid time tnum">${e.tbc ? "TBC" : hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>`;
  const sp = e.sp === "nba" ? "basketball" : e.sp;
  const p = odds && e.state !== "done" ? sideProbs(oddsFor(sp, [e.a, e.b], e.start), [e.a, e.b]) : null;
  return `<a class="card next sp-${e.sp}" href="${e.href}">${head}<div class="vs">${side(e.a, e.ida)}${mid}${side(e.b, e.idb)}</div>${e.venue ? `<div class="meta">${esc(e.venue)}</div>` : ""}${p ? mktBar(p, [e.sp === "tennis" ? last(e.a) : e.a, e.sp === "tennis" ? last(e.b) : e.b], e.sp) : ""}</a>`;
}
// A finished event as a small scoreboard card
function resultCard(e) {
  let body = "";
  if (e.sp === "f1") {
    if (!e.top) return "";
    const S = val("f1_standings")?.drivers || [];
    body = `<div class="sb podium">${e.top.map((n, i) => { const d = S.find(x => same(last(x.name), n) || same(x.shown, n)); return `<div class="ln${i === 0 ? " won" : ""}"><span class="pos">${i + 1}</span><i class="team" style="${d?.colour ? `background:${esc(d.colour)}` : ""}"></i><span class="code">${esc(d?.code || "")}</span><span class="nm">${esc(n)}</span></div>`; }).join("")}</div>`;
  } else if (e.sp === "cricket") {
    const inn = String(e.score || "").split(" · ").map(s => s.match(/^([A-Z]{2,4})\s+(\d+(?:\/\d+)?(?:d)?)(?:\s*\(([\d.]+) ov\))?/));
    if (inn.length === 2 && inn.every(Boolean)) body = `<div class="sb">${inn.map(([, code, runs, ov]) => { const won = e.won === "a" ? code === "IND" : e.won === "b" ? code !== "IND" : false; return `<div class="ln${won ? " won" : ""}"><span class="nm">${esc(code)}</span>${won ? '<i class="w"></i>' : ""}<span class="v tnum">${esc(runs)}${ov ? `<small>${esc(ov)} ov</small>` : ""}</span></div>`; }).join("")}</div>`;
    else if (e.score) body = `<div class="cap">${esc(e.score)}</div>`;
    if (e.status) body += `<div class="cap">${esc(e.status)}</div>`;
  } else if (e.sp === "tennis") {
    const sets = [...String(e.note || "").matchAll(/(\d+)-(\d+)(?:\s*\(\d+-\d+\))?/g)].map(x => [Number(x[1]), Number(x[2])]);
    const winner = e.won === "a" ? e.a : e.b, loser = e.won === "a" ? e.b : e.a;
    body = sets.length ? `<div class="sb">${[[winner, 0, true], [loser, 1, false]].map(([n, i, w]) => `<div class="ln${w ? " won" : ""}"><span class="nm">${esc(last(n))}</span><span class="sets">${sets.map(s => `<b class="tnum">${s[i]}</b>`).join("")}</span></div>`).join("")}</div>` : "";
    if (/ret/i.test(e.note || "")) body += `<div class="cap">Retired</div>`;
  } else {
    if (e.sa == null) return "";
    body = `<div class="sb">${[[e.a, e.sa, e.won === "a", e.ida], [e.b, e.sb, e.won === "b", e.idb]].map(([n, v, w, id]) => `<div class="ln${w ? " won" : ""}">${e.sp === "football" ? crest(id, n, "sm") : ""}<span class="nm">${esc(n)}</span>${w ? '<i class="w"></i>' : ""}<span class="v tnum">${esc(v)}</span></div>`).join("")}</div>`;
  }
  if (!body) return "";
  const label = e.sp === "f1" ? `${e.session === "Race" ? "Race" : e.session}` : e.comp || SPORT_NAME[e.sp];
  return `<a class="card res-card sp-${e.sp}" href="${e.href}"><div class="hd">${chip(e.sp, label)}<time datetime="${esc(e.start)}">${esc(dayLabel(e.start))}</time></div>${e.sp === "f1" ? `<div class="cap">${esc(e.sub || "")}</div>` : `<div class="cap">${esc(e.title)}</div>`}${body}</a>`;
}

// ------------------------------------------------------------------ Today
function viewHome() {
  const E = events(), now = Date.now();
  const live = E.filter(e => e.state === "live");
  const next = E.filter(e => e.state === "next" && t(e.start) > now - 6e4);
  // One next fixture per thing followed: Madrid, F1, India, each tennis player, the Warriors
  const per = new Map();
  for (const e of next) { const k = e.sp === "tennis" ? "tn:" + e.player : e.sp; if (!per.has(k)) per.set(k, e); }
  const ups = [...per.values()].sort((a, b) => t(a.start) - t(b.start));
  const hero = ups[0];
  const rows = ups.slice(1).map(e => {
    const o = evOdds(e);
    return `<a class="row" href="${e.href}">${chip(e.sp, e.sp === "tennis" ? last(e.player) : e.sp === "football" ? "Madrid" : e.sp === "cricket" ? "India" : e.sp === "nba" ? "Warriors" : "F1")}<div class="grow"><div class="t1">${esc(e.sp === "nba" ? `${last(e.a)} v ${last(e.b)}` : e.title)}</div><div class="t2">${esc(e.tbc ? "Time to be confirmed" : when(e.start))}${e.sp === "f1" && e.sub ? ` · ${esc(e.sub)}` : e.comp ? ` · ${esc(e.comp)}` : ""}</div></div><div class="end">${o ? `<div class="t1 tnum">${o.prob}%</div><div class="t2">${esc(o.label)}</div>` : `<div class="t2">${countdown(e.start)}</div>`}</div></a>`;
  }).join("");
  // Latest results: the most recent finished event per follow, in the last ten days
  const doneBy = new Map();
  for (const e of [...E].reverse()) { if (e.state !== "done" || now - t(e.start) > 10 * 864e5) continue; const k = e.sp === "tennis" ? "tn:" + e.player : e.sp; if (!doneBy.has(k)) doneBy.set(k, e); }
  const results = [...doneBy.values()].sort((a, b) => t(b.start) - t(a.start)).map(resultCard).filter(Boolean).join("");
  // Tournaments and series: tennis events with each player's status, India's series, the championships
  const tours = [];
  const TP = val("tennis_players")?.players || [];
  for (const ev of val("tennis")?.events || []) {
    if (t(ev.end) < now) continue;
    const st = TP.map(p => {
      const nx = p.next && same(p.next.event, ev.name) ? p.next : null, ls = p.last && same(p.last.event, ev.name) ? p.last : null;
      if (nx) return `${last(p.name)}: ${esc(nx.round || "next")} v ${esc(last(nx.opponent))}, ${esc(when(nx.when_utc))}`;
      if (ls) return `${last(p.name)}: ${ls.won ? "won" : "out,"} ${esc(ls.round || "")} ${ls.won ? "" : `to ${esc(last(ls.opponent))}`}`.replace(/\s+/g, " ").trim();
      return null;
    }).filter(Boolean);
    const going = t(ev.start) <= now;
    tours.push(`<a class="row" href="#tennis">${chip("tennis")}<div class="grow"><div class="t1">${esc(ev.name)}</div><div class="t2 wrap">${st.length ? st.join(" · ") : `${going ? "Under way" : "Starts " + shortDate(ev.start)} · ${esc(ev.venue || "")}`}</div></div>${chev}</a>`);
  }
  const C = val("crease");
  for (const S of [C?.main, ...(C?.also || [])].filter(Boolean)) {
    const sc = (S.formats || []).map(f => f.score ? `${f.label}: ${f.score}` : null).filter(Boolean).join(" · ");
    tours.push(`<a class="row" href="#cricket">${chip("cricket", "India")}<div class="grow"><div class="t1">${esc(S.name)}</div><div class="t2 wrap">${esc(sc || `${shortDate(S.first)} to ${shortDate(S.last)}`)}</div></div>${chev}</a>`);
  }
  const ST = val("f1_standings");
  if (ST?.drivers?.length) {
    const me = ST.drivers.find(d => same(d.name, favDriver())), lead = ST.drivers[0];
    tours.push(`<a class="row" href="#f1">${chip("f1")}<div class="grow"><div class="t1">Drivers' championship</div><div class="t2 wrap">${esc(last(lead.shown || lead.name))} leads on ${lead.points}${me && me !== lead ? ` · ${esc(last(favDriver()))} P${me.pos}, ${lead.points - me.points} behind` : ""}</div></div>${chev}</a>`);
  }
  const TB = (val("club_stats")?.comps || []).find(c => c.key === "liga")?.rows?.find(r => same(r.team, club()));
  if (TB) tours.push(`<a class="row" href="#football">${chip("football", "Madrid")}<div class="grow"><div class="t1">La Liga</div><div class="t2">${ordinal(TB.rank)} on ${TB.points} points after ${TB.played}</div></div>${chev}</a>`);
  const nbaRow = val("nba") ? `<a class="row" href="#nba">${chip("nba", "Warriors")}<div class="grow"><div class="t1">Golden State Warriors</div><div class="t2">${val("nba").in_season ? "Season" : "Preseason"} · schedule and results</div></div>${chev}</a>` : "";
  const today = fmt(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" });
  const ready = Object.keys(D).length > 0;
  return `<div class="page">${header("Today", `<b>${esc(today)}</b>${lastLoad ? `<span>Updated ${hm(new Date(lastLoad).toISOString())}</span>` : ""}`)}
    ${!ready ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${live.length ? blk("Live now", live.map(e => nextCard(e)).join("")) : ""}
    ${hero ? blk("Up next", nextCard(hero) + (rows ? `<div class="list" style="margin-top:12px">${rows}</div>` : "")) : ""}
    ${results ? blk("Latest results", `<div class="shelf">${results}</div>`) : ""}
    ${tours.length || nbaRow ? blk("Tournaments and tables", `<div class="list">${tours.join("")}${nbaRow}</div>`) : ""}
    ${ready ? srcLine("football", "madrid_hub", "crease", "f1_next", "f1_sessions", "tennis_players", "nba", "odds") : ""}</div>`;
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

// ------------------------------------------------------------------ Madrid
// The XI on a pitch: lines by position depth, left to right by side; the formation string checks the line sizes
function pitch(xi) {
  const depth = p => { const s = String(p.pos || "").toUpperCase(); if (s === "G" || s === "GK") return 0; if (/^(CD|CB|SW|LB|RB|LWB|RWB|D)/.test(s)) return 1; if (/^(DM|CM|LM|RM|M)/.test(s)) return 2; if (/^(AM|LW|RW)/.test(s)) return 3; return 4; };
  const side = p => { const s = String(p.pos || "").toUpperCase(); return /-L$|^L/.test(s) ? 0 : /-R$|^R/.test(s) ? 2 : 1; };
  let lines = [0, 1, 2, 3, 4].map(d => xi.players.filter(p => depth(p) === d)).filter(l => l.length);
  const want = String(xi.formation || "").split("-").map(Number).filter(Boolean);
  if (want.length && want.reduce((a, b) => a + b, 0) === 10 && (lines.length - 1 !== want.length || lines.slice(1).some((l, i) => l.length !== want[i]))) {
    // Positions and formation disagree: fall back to the formation's own line sizes, in slot order
    const out = xi.players.filter(p => depth(p) !== 0).sort((a, b) => depth(a) - depth(b) || side(a) - side(b)); lines = [xi.players.filter(p => depth(p) === 0)];
    let i = 0; for (const n of want) { lines.push(out.slice(i, i + n)); i += n; }
  }
  const L = lines.length, rows = lines.map((l, li) => {
    const y = 90 - (li / Math.max(L - 1, 1)) * 78; // goalkeeper near the bottom, forwards near the top
    const sorted = [...l].sort((a, b) => side(a) - side(b));
    return sorted.map((p, i) => `<div class="pl${li === 0 ? " gk" : ""}" style="left:${((i + 1) / (sorted.length + 1)) * 100}%;top:${y}%"><b class="tnum">${esc(p.shirt || "")}</b><span>${esc(p.short?.replace(/^[A-Z]\. /, "") || last(p.name))}</span></div>`).join("");
  }).join("");
  return `<div class="pitch" role="img" aria-label="${esc(xi.formation || "")} ${esc(xi.players.map(p => p.name).join(", "))}"><svg class="lines" viewBox="0 0 68 80" preserveAspectRatio="none"><rect x="2" y="2" width="64" height="76" rx="1"/><path d="M2 40h64"/><circle cx="34" cy="40" r="7"/><rect x="18" y="66" width="32" height="12"/><rect x="26" y="73" width="16" height="5"/><rect x="18" y="2" width="32" height="12"/><rect x="26" y="2" width="16" height="5"/></svg>${rows}</div>`;
}
const UI = { table: "liga", leaders: "goals", f1table: "drivers" }; // segmented controls (in-memory, per visit)
function viewFootball() {
  const H = val("madrid_hub"), F = val("football"), CS = val("club_stats"), cname = club();
  const E = events().filter(e => e.sp === "football"), now = Date.now();
  const next = E.find(e => e.state === "live") || E.find(e => e.state === "next" && t(e.start) > now - 6e4);
  const liga = (CS?.comps || []).find(c => c.key === "liga"), me = liga?.rows?.find(r => same(r.team, cname));
  const form = (F?.form || []).slice(-5);
  const sub = [me ? `<b>${ordinal(me.rank)} in La Liga</b><span>${me.points} pts</span>` : "", form.length ? `<span class="form sm" aria-label="Form ${form.join(" ")}">${form.map(r => `<i class="${r}">${r}</i>`).join("")}</span>` : ""].join("");
  // The XI
  let xi = "";
  const X = H?.xi;
  if (X?.players?.length === 11) {
    const cap = X.kind === "official" ? `<span class="chip live" style="background:var(--win)">Official XI</span><span class="note">v ${esc(X.opponent)}</span>` : `<span class="note">Started v ${esc(X.opponent)}, ${esc(shortDate(X.date))}</span>`;
    xi = blk(X.kind === "official" ? "Starting XI" : "Last starting XI", `<div class="card">${pitch(X)}<p class="foot">${X.kind === "official" ? `${esc(X.formation || "")} · announced by the club` : `${esc(X.formation || "")} · the official XI for the next match shows here once it is announced, about an hour before kick-off`}${X.bench?.length ? `<br>Bench: ${esc(X.bench.slice(0, 12).join(", "))}` : ""}</p></div>`, cap);
  }
  // The next match's preview: both sides' last five, and the last meetings
  let preview = "";
  const PV = H?.preview;
  if (PV && next && String(next.id) === "rm" + PV.match_id) {
    const fm = PV.form.map(tm => `<div class="pvf"><div class="pvt">${crest(tm.id, tm.team, "sm")}<b>${esc(tm.team)}</b></div><span class="form" aria-label="${esc(tm.team)} form ${tm.games.map(g => g.result).join(" ")}">${tm.games.map(g => `<i class="${esc(g.result || "D")}" title="${esc(`${g.at ? "at" : "v"} ${g.opponent} ${g.score || ""}`)}">${esc(g.result || "")}</i>`).join("")}</span></div>`).join("");
    const mt = PV.meetings.map(m => `<div class="row"><div class="grow"><div class="t1">${esc(m.home)} ${esc(m.hs)}–${esc(m.as)} ${esc(m.away)}</div><div class="t2">${esc(m.competition || "")} · ${esc(fmt(m.date, { day: "numeric", month: "short", year: "numeric" }))}</div></div></div>`).join("");
    preview = blk("Form and meetings", `${fm ? `<div class="card pv">${fm}<p class="foot" style="margin:10px 0 0">Last five matches, oldest first.</p></div>` : ""}${mt ? `<div class="list" style="margin-top:12px">${mt}</div>` : ""}`, (() => {
      // Madrid's record in those meetings, counted here from the scores
      let w = 0, d = 0, l = 0;
      for (const m of PV.meetings) { const us = same(m.home, cname) ? m.hs : same(m.away, cname) ? m.as : null, them = same(m.home, cname) ? m.as : m.hs; if (us == null) continue; if (+us > +them) w++; else if (+us < +them) l++; else d++; }
      return w + d + l ? `<span class="note">Last ${w + d + l} meetings: ${w}W ${d}D ${l}L</span>` : "";
    })());
  }
  // Results and fixtures
  const resRows = (H?.results || []).map(m => {
    const r = m.winner === "us" ? "W" : m.winner === "them" ? "L" : "D", sc = `${m.us}–${m.them}`; // Madrid's goals first
    return `<div class="row">${crest(m.opponent_id, m.opponent, "sm")}<div class="grow"><div class="t1">${m.home ? "v" : "at"} ${esc(m.opponent)}</div><div class="t2">${esc(m.competition || "")} · ${esc(shortDate(m.date))}</div></div><span class="score ${r} tnum" aria-label="${r === "W" ? "Won" : r === "L" ? "Lost" : "Drew"} ${esc(sc)}">${esc(sc)}</span></div>`;
  });
  const fxRows = (H?.fixtures || []).map(m => {
    const sides = m.home ? [cname, m.opponent] : [m.opponent, cname], p = sideProbs(oddsFor("football", sides, m.date), sides), mine = p ? (m.home ? p.a : p.b) : null;
    return `<div class="row">${crest(m.opponent_id, m.opponent, "sm")}<div class="grow"><div class="t1">${m.home ? "v" : "at"} ${esc(m.opponent)}</div><div class="t2">${esc(m.competition || "")} · ${esc(when(m.date))}</div></div>${mine != null ? `<div class="end"><div class="t1 tnum">${mine}%</div><div class="t2">to win</div></div>` : ""}</div>`;
  });
  const list = (rows, n) => (rows.length ? `<div class="list">${rows.slice(0, n).join("")}${rows.length > n ? `<details class="more-box"><summary>Show ${rows.length - n} more <svg viewBox="0 0 14 14"><path d="M3 5l4 4 4-4"/></svg></summary>${rows.slice(n).join("")}</details>` : ""}</div>` : "");
  // Tables
  const comps = (CS?.comps || []).filter(c => c.rows?.length);
  const cur = comps.find(c => c.key === UI.table) || comps[0];
  let table = "";
  if (cur) {
    const rows = cur.rows, mi = rows.findIndex(r => same(r.team, cname));
    const tr = r => `<tr class="${same(r.team, cname) ? "me" : ""}"><td class="pos tnum" style="--zone:${esc(r.zone?.color || "transparent")}">${r.rank}</td><td class="team l"><div>${crest(r.id, r.team, "xs")}<span>${esc(r.short || r.team)}</span></div></td><td class="tnum">${r.played}</td><td class="tnum">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts tnum">${r.points}</td></tr>`;
    const head = `<thead><tr><th class="l">#</th><th class="l">Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>`;
    const show = rows.length > 12 ? [...new Set([...rows.slice(0, 4), ...rows.slice(Math.max(0, mi - 2), mi + 3)])] : rows;
    const zones = [...new Map(rows.filter(r => r.zone?.name).map(r => [r.zone.name, r.zone.color])).entries()];
    const seg = comps.length > 1 ? `<div class="seg" role="group" aria-label="Competition">${comps.map(c => `<button type="button" data-ui="table" data-v="${esc(c.key)}" aria-pressed="${c === cur}">${esc(c.label)}</button>`).join("")}</div>` : "";
    table = blk("Tables", `${seg}<div class="list sp-football"><table class="tbl">${head}<tbody>${show.map((r, i) => (i && r.rank - show[i - 1].rank > 1 ? `<tr class="gap"><td colspan="5">···</td></tr>` : "") + tr(r)).join("")}</tbody></table>${show.length < rows.length ? `<details class="more-box"><summary>Full table <svg viewBox="0 0 14 14"><path d="M3 5l4 4 4-4"/></svg></summary><table class="tbl"><tbody>${rows.map(tr).join("")}</tbody></table></details>` : ""}${zones.length ? `<div class="legend">${zones.map(([n, c]) => `<span><i style="background:${esc(c)}"></i>${esc(n)}</span>`).join("")}</div>` : ""}</div>`);
    // Leaders in the same competition
    const kinds = [["goals", "Goals"], ["assists", "Assists"], ["ratings", "Rating"]].filter(([k]) => cur[k]?.length);
    const lk = kinds.find(([k]) => k === UI.leaders)?.[0] || kinds[0]?.[0];
    if (lk) {
      const L = cur[lk].slice(0, 8), top = Math.max(...L.map(x => x.value));
      table += blk(`Leaders · ${esc(cur.label)}`, `<div class="seg" role="group" aria-label="Leader board">${kinds.map(([k, n]) => `<button type="button" data-ui="leaders" data-v="${k}" aria-pressed="${k === lk}">${n}</button>`).join("")}</div><div class="list sp-football">${L.map(x => `<div class="barrow${same(x.team, cname) ? " me" : ""}"><div class="nm"><span class="ps tnum">${x.rank}</span><span>${esc(x.name)}<br><small class="src">${esc(x.team)}</small></span></div><div class="bv"><i style="width:${Math.max(4, (x.value / top) * 100)}%"></i><b class="tnum">${lk === "ratings" ? Number(x.value).toFixed(2) : x.value}</b></div></div>`).join("")}</div><p class="foot">${esc((cur.sources || []).join(" · "))}</p>`);
    }
  }
  // National sides
  const intl = (val("intl_football")?.matches || []).slice(0, 6).map(m => `<div class="row"><div class="grow"><div class="t1">${esc(m.home)} v ${esc(m.away)}</div><div class="t2">${esc(m.competition || "")} · ${esc(when(m.when_utc || m.date))}</div></div>${m.score ? `<span class="score tnum">${esc(m.score)}</span>` : ""}</div>`).join("");
  return `<div class="page">${header(`<span style="display:inline-flex;align-items:center;gap:12px">${crest(H?.club_id || "86", cname, "sm")}${esc(cname)}</span>`, sub, ["football", "madrid_hub", "club_stats"])}
    ${!H && !F ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${next ? blk(next.state === "live" ? "Live" : "Next match", nextCard(next)) : ""}
    ${preview}
    ${xi}
    ${blk("Results", list(resRows, 5))}
    ${blk("Fixtures", list(fxRows, 4))}
    ${table}
    ${intl ? blk("National teams", `<div class="list">${intl}</div>`) : ""}
    ${srcLine("football", "madrid_hub", "club_stats", "odds")}</div>`;
}

// ------------------------------------------------------------------ F1
const fposCls = r => (!r ? "" : !r.finished ? "out" : r.pos === 1 ? "p1" : r.pos === 2 ? "p2" : r.pos === 3 ? "p3" : "");
const fpos = r => `<span class="fpos ${fposCls(r)} tnum" title="${esc(r?.race || "")}">${r ? (r.finished ? r.pos : esc(r.text === "R" ? "DNF" : r.text || "DNF")) : "–"}</span>`;
// The market favourite and the favourite driver's price for a session still to come
function sessFav(s) {
  const kind = /sprint qualif|shootout/i.test(s.name) ? "sprint_qualifying" : /sprint/i.test(s.name) ? "sprint" : /qualif/i.test(s.name) ? "qualifying" : /^race$/i.test(s.name) ? "race" : null;
  const m = kind && oddsFor("f1", null, s.start, kind); if (!m?.outcomes?.length) return "";
  const top = [...m.outcomes].sort((a, b) => b.prob - a.prob)[0], me = m.outcomes.find(x => same(x.name, favDriver()));
  return ` · ${esc(last(top.name))} ${Math.round(top.prob)}%${me && me !== top ? `, ${esc(last(me.name))} ${Math.round(me.prob)}%` : ""}`;
}
function viewF1() {
  const N = val("f1_next"), R = N?.race, S = val("f1_standings"), HB = val("f1_hub"), MK = val("f1_market"), SR = val("f1_sessions")?.results || [], LR = val("f1_last"), fav = favDriver(), now = Date.now();
  const drivers = S?.drivers || [], me = drivers.find(d => same(d.name, fav)), lead = drivers[0];
  const colourOf = name => drivers.find(d => same(d.name, name) || same(d.shown, name) || same(last(d.name), name))?.colour || null;
  // The weekend
  let weekend = "";
  if (R) {
    const sess = (R.sessions || []).map(s => {
      const st = t(s.start), end = st + (s.minutes || 60) * 6e4, state = now >= end ? "done" : now >= st ? "now" : "next";
      const res = SR.find(r => Math.abs(t(r.start) - st) < 45 * 6e4);
      return { ...s, state, res };
    });
    const nx = sess.find(s => s.state !== "done");
    const rows = sess.map(s => `<div class="row ${s.state}${s === nx && s.state === "next" ? " next" : ""}"><span class="dot"></span><div class="grow"><div class="t1">${esc(s.name)}</div><div class="t2">${s.res ? `${s.res.top.map((n, i) => `${i + 1} ${esc(n)}`).join(" · ")}` : esc(when(s.start))}${s.state !== "done" ? sessFav(s) : ""}</div></div><div class="end">${s.state === "now" ? `<span class="chip live"><i></i>On now</span>` : s.state === "done" ? `<span class="t2">${esc(dayLabel(s.start))}</span>` : `<div class="t1 tnum">${hm(s.start)}</div><div class="t2">${s === nx ? countdown(s.start) : esc(dayLabel(s.start))}</div>`}</div></div>`).join("");
    weekend = blk("This weekend", `<div class="card sp-f1"><div class="when" style="display:flex;justify-content:space-between;align-items:center">${chip("f1", `Round ${R.round}`)}${nx ? `<span class="count">${nx.name} ${countdown(nx.start)}</span>` : ""}</div><div class="next one" style="padding:0"><div class="title">${R.flag ? `${esc(R.flag)} ` : ""}${esc(String(R.name).replace(/ in .*$/, ""))}<small>${esc(R.circuit || "")}${R.locality ? `, ${esc(R.locality)}` : ""}</small></div></div>${R.track?.image ? `<img class="track" src="${esc(R.track.image)}" alt="${esc(R.circuit || "")} layout" loading="lazy">` : ""}</div><div class="list sess sp-f1" style="margin-top:12px">${rows}</div>`);
  }
  // Max Watch
  let watch = "";
  if (me || HB) {
    const form = HB?.form?.drivers?.find(d => same(d.name, fav))?.results || [];
    const race = (MK?.markets || []).sort((a, b) => (b.volume || 0) - (a.volume || 0))[0], o = race?.outcomes?.find(x => same(x.name, fav));
    const here = HB?.favourite_here || [], best = here.filter(r => r.pos).sort((a, b) => a.pos - b.pos)[0];
    const label = follows().f1_driver?.label || `${last(fav)} watch`;
    watch = blk(esc(label), `<div class="card sp-f1"><div style="display:flex;align-items:center;gap:12px"><i style="width:6px;height:44px;border-radius:3px;background:${esc(me?.colour || "var(--f1)")}"></i><div><div style="font:700 20px var(--sans)">${esc(fav)}</div><div class="src">${esc(me?.team || "")}</div></div></div>
      <div class="stats">${me ? `<div class="stat"><b class="tnum">P${me.pos}</b><span>Championship · ${me.points} pts</span></div><div class="stat"><b class="tnum">${me === lead ? "Lead" : `−${lead.points - me.points}`}</b><span>${me === lead ? "Top of the table" : `To ${esc(last(lead.shown || lead.name))}`}</span></div>` : ""}${o ? `<div class="stat"><b class="tnum">${Math.round(o.prob)}%</b><span>To win ${esc(String(R?.name || "").replace(/ Grand Prix.*$/, " GP"))} · ${esc(race.source)}</span></div>` : me ? `<div class="stat"><b class="tnum">${me.wins}</b><span>Wins this season</span></div>` : ""}</div>
      ${form.length ? `<div class="blk-h" style="margin:16px 0 8px"><span class="note">Last ${form.length} races</span></div><div class="fgrid">${form.map(fpos).join("")}</div>` : ""}
      ${here.length ? `<div class="blk-h" style="margin:16px 0 8px"><span class="note">At ${esc(HB.race?.circuit || "this track")}${best ? ` · best P${best.pos} (${best.season})` : ""}</span></div><div class="fgrid" style="flex-wrap:wrap">${here.map(r => `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">${fpos({ pos: r.pos, finished: /^\d+$/.test(r.text), text: r.text, race: `${r.season}: grid ${r.grid}, ${r.status}` })}<small class="src tnum">${String(r.season).slice(2)}</small></span>`).join("")}</div>` : ""}</div>`);
  }
  // Expectations: the race winner market
  const mk = (MK?.markets || []).sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const expect = mk[0] ? blk("What the markets expect", `<div class="card sp-f1">${rankList(mk[0].outcomes, "f1", { mark: fav, nameFn: n => (drivers.find(d => same(d.name, n))?.shown || n) })}<p class="foot">${esc(mk[0].title)} · <a href="${esc(mk[0].url)}" target="_blank" rel="noopener">${esc(mk[0].source)}</a>${mk[1] ? ` · ${esc(mk[1].source)} has ${esc(last(mk[1].outcomes[0]?.name))} ${Math.round(mk[1].outcomes[0]?.prob)}%` : ""}</p></div>`) : "";
  // This track over the years
  let track = "";
  if (HB?.winners?.length) {
    const W = HB.winners, fromPole = W.filter(w => w.grid === 1).length, top = HB.tally.slice(0, 5), mx = top[0]?.wins || 1;
    const rows = W.map(w => `<div class="row"><span class="yr tnum">${esc(w.season)}</span><div class="grow"><div class="t1">${esc(w.driver)}</div><div class="t2">${esc(w.team || "")}${w.grid ? ` · from P${w.grid}` : ""}</div></div></div>`);
    track = blk(`${esc(HB.race?.circuit || "This track")} history`, `<div class="card"><div class="stats" style="margin-top:0"><div class="stat"><b class="tnum">${W.length}</b><span>Races held</span></div><div class="stat"><b class="tnum">${fromPole}</b><span>Won from pole</span></div><div class="stat"><b class="tnum">${new Set(W.map(w => w.driver)).size}</b><span>Different winners</span></div></div></div>
      <div class="list sp-f1" style="margin-top:12px">${top.map(x => `<div class="barrow${same(x.driver, fav) ? " me" : ""}"><div class="nm"><span>${esc(x.driver)}</span></div><div class="bv"><i style="width:${(x.wins / mx) * 100}%"></i><b class="tnum">${x.wins}</b></div></div>`).join("")}</div>
      <div class="list hist" style="margin-top:12px">${rows.slice(0, 5).join("")}${rows.length > 5 ? `<details class="more-box"><summary>All ${rows.length} winners <svg viewBox="0 0 14 14"><path d="M3 5l4 4 4-4"/></svg></summary>${rows.slice(5).join("")}</details>` : ""}</div>`, `<span class="note">Wins</span>`);
  }
  // Form: the top ten's last five races
  let form = "";
  if (HB?.form?.drivers?.length && drivers.length) {
    const top10 = drivers.slice(0, 10).map(d => ({ d, f: HB.form.drivers.find(x => x.code === d.code || same(x.name, d.name)) })).filter(x => x.f);
    if (!top10.some(x => same(x.d.name, fav))) { const m = drivers.find(d => same(d.name, fav)), f = m && HB.form.drivers.find(x => x.code === m.code); if (f) top10.push({ d: m, f }); }
    form = blk("Form", `<div class="list">${top10.map(({ d, f }) => `<div class="row${same(d.name, fav) ? " me" : ""}" style="${same(d.name, fav) ? "background:color-mix(in srgb,var(--f1) 7%,transparent)" : ""}"><span class="fpos tnum" style="background:none;color:var(--muted)">${d.pos}</span><i style="width:4px;height:24px;border-radius:2px;background:${esc(d.colour || "var(--line)")}"></i><div class="grow"><div class="t1">${esc(d.shown || d.name)}</div></div><div class="fgrid">${f.results.map(fpos).join("")}</div></div>`).join("")}</div><p class="foot">Finishing positions, ${esc(HB.form.rounds.map(r => r.name.replace(/ Grand Prix.*$/, "")).join(", "))}. DNF: did not finish.</p>`, `<span class="note">Last ${HB.form.rounds.length} races</span>`);
  }
  // Standings
  let table = "";
  if (drivers.length) {
    const isD = UI.f1table !== "constructors", L = isD ? drivers : S.constructors || [], mx = L[0]?.points || 1;
    table = blk("Standings", `<div class="seg" role="group" aria-label="Standings">${[["drivers", "Drivers"], ["constructors", "Teams"]].map(([k, n]) => `<button type="button" data-ui="f1table" data-v="${k}" aria-pressed="${(k === "drivers") === isD}">${n}</button>`).join("")}</div><div class="list">${L.slice(0, isD ? 22 : 11).map(x => `<div class="barrow${isD && same(x.name, fav) ? " me" : ""}" style="--c:${esc(x.colour || "var(--muted)")}"><div class="nm"><span class="ps tnum">${x.pos}</span><span>${esc(isD ? x.shown || x.name : x.name)}</span></div><div class="bv"><i style="width:${(x.points / mx) * 100}%"></i><b class="tnum">${x.points}</b></div></div>`).join("")}</div><p class="foot">After round ${S.round}${S.prior ? ` of ${esc(S.season)} (final)` : ""}.</p>`);
  }
  // Last race
  let lastRace = "";
  if (LR?.results?.length) {
    const rr = LR.results.map(r => `<div class="row"><span class="fpos ${r.pos <= 3 ? "p" + r.pos : ""} tnum">${r.pos}</span><i style="width:4px;height:24px;border-radius:2px;background:${esc(r.colour || "var(--line)")}"></i><div class="grow"><div class="t1">${esc(r.shown || r.name)}</div><div class="t2">${esc(r.team || "")}</div></div><div class="end t2 tnum">${esc(r.time || r.status || "")}</div></div>`);
    lastRace = blk(`${LR.flag ? esc(LR.flag) + " " : ""}${esc(LR.name)}`, `<div class="list">${rr.slice(0, 3).join("")}<details class="more-box"><summary>Full result <svg viewBox="0 0 14 14"><path d="M3 5l4 4 4-4"/></svg></summary>${rr.slice(3).join("")}</details></div>`, `<span class="note">${esc(shortDate(LR.date))}</span>`);
  }
  // Calendar
  const cal = (N?.upcoming || []).map(u => `<div class="row"><span class="flag" style="font-size:26px">${esc(u.flag || "")}</span><div class="grow"><div class="t1">${esc(u.name)}</div><div class="t2">Round ${u.round} · ${esc(shortDate(u.date))}</div></div></div>`).join("");
  return `<div class="page">${header("Formula 1", R ? `<b>Round ${R.round}</b><span>${esc(String(R.name).replace(/ in .*$/, ""))}</span>` : "", ["f1_next", "f1_standings", "f1_hub"])}
    ${!R && !S ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${weekend}${watch}${expect}${track}${form}${table}${lastRace}
    ${cal ? blk("Coming up", `<div class="list">${cal}</div>`) : ""}
    ${srcLine("f1_next", "f1_sessions", "f1_standings", "f1_hub", "f1_market", "f1_last")}</div>`;
}

// ------------------------------------------------------------------ India
// India's result in two or three words: "Won by 8 wkts", "Lost by 5 wkts", else the status as given
function resultWord(m) {
  const by = String(m.status || "").match(/won by (.+?)(?: \(.*\))?$/i)?.[1];
  return by && m.won === true ? `Won by ${by}` : by && m.won === false ? `Lost by ${by}` : String(m.status || "").replace(/ due to .*$/i, "");
}
function viewCricket() {
  const C = val("crease"), now = Date.now(), E = events().filter(e => e.sp === "cricket");
  const live = E.find(e => e.state === "live"), next = live || E.find(e => e.state === "next" && t(e.start) > now - 6e4);
  const seriesBlock = (S, title) => {
    const fm = (S.formats || []).map(f => {
      const rows = (f.matches || []).map(m => {
        const st = m.state === "done" ? (m.won === true ? "W" : m.won === false ? "L" : "D") : null;
        return `<div class="row"><div class="grow"><div class="t1">${esc(m.desc)}</div><div class="t2">${esc([m.city, m.state === "done" ? shortDate(m.start) : m.time_announced === false ? `${shortDate(m.start)}, time TBC` : when(m.start)].filter(Boolean).join(" · "))}</div>${m.state === "done" && m.score ? `<div class="t2 tnum" style="white-space:normal">${esc(m.score)}</div>` : ""}</div><div class="end">${m.state === "done" ? `<span class="score ${st} tnum" style="font:600 13px var(--sans);min-width:0">${esc(resultWord(m))}</span>` : m.state === "live" ? `<span class="chip live"><i></i>Live</span>` : m.state === "off" ? `<span class="chip done">${esc(m.status || "No result")}</span>` : `<span class="t2">${countdown(m.start)}</span>`}</div></div>`;
      }).join("");
      return `<div class="blk-h" style="margin:16px 4px 8px"><h2 style="font-size:17px">${esc(f.label || f.format)}</h2>${f.score ? `<span class="chip sp sp-cricket">${esc(f.score)}</span>` : ""}</div><div class="list">${rows}</div>`;
    }).join("");
    return blk(title ? `${title} · ${esc(S.name)}` : esc(S.name), fm, `<span class="note">${esc(shortDate(S.first))} to ${esc(shortDate(S.last))}</span>`);
  };
  const series = [C?.main, ...(C?.also || [])].filter(Boolean).map(S => seriesBlock(S)).join("");
  const A = C?.after;
  const after = A?.formats ? blk(`Next · ${esc(A.name)}`, `<div class="list">${A.formats.map(f => { const ms = f.matches || []; return `<details class="row-d"><summary class="row"><div class="grow"><div class="t1">${ms.length} ${esc(f.label || f.format)}</div><div class="t2">${ms[0] ? `${esc(shortDate(ms[0].start))} to ${esc(shortDate(ms.at(-1).start))} · ${esc([...new Set(ms.map(m => m.city).filter(Boolean))].slice(0, 3).join(", "))}` : ""}</div></div><svg class="chev dn" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></summary>${ms.map(m => `<div class="row sub"><div class="grow"><div class="t1">${esc(m.desc)}</div><div class="t2">${esc([m.city, m.time_announced === false ? `${shortDate(m.start)}, time TBC` : when(m.start)].filter(Boolean).join(" · "))}</div></div></div>`).join("")}</details>`; }).join("")}</div>`, `<span class="note">From ${esc(shortDate(A.first))}</span>`) : "";
  const done = E.filter(e => e.state === "done").slice(-1)[0];
  return `<div class="page">${header("India", C?.main ? `<b>${esc(C.main.name)}</b>` : "", ["crease"])}
    ${!C ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${next ? blk(live ? "Live" : "Next match", nextCard(next)) : ""}
    ${done ? blk("Last result", resultCard(done)) : ""}
    ${series}
    ${after}
    ${srcLine("crease", "odds")}</div>`;
}

// ------------------------------------------------------------------ Tennis
function viewTennis() {
  const TP = val("tennis_players")?.players || [], EV = val("tennis")?.events || [], now = Date.now();
  const cards = TP.map(p => {
    const nx = p.next, ls = p.last;
    const p2 = nx ? sideProbs(oddsFor("tennis", [p.name, nx.opponent], nx.when_utc), [p.name, nx.opponent]) : null;
    const lastE = ls ? events().find(e => e.sp === "tennis" && e.state === "done" && e.player === p.name) : null;
    const status = nx ? `${esc(nx.event)} · ${esc(nx.round || "")}` : ls ? `${esc(ls.event)} · ${ls.won ? "won" : "out in"} ${esc(ls.round || "")}` : "No match listed";
    return `<section class="blk"><div class="blk-h"><h2>${esc(p.name)}</h2><span class="note">${status}</span></div>
      ${nx ? `<div class="card next sp-tennis"><div class="when">${chip("tennis", nx.round || "Next")}${nx.live ? `<span class="chip live"><i></i>Live</span>` : `<span class="count">${countdown(nx.when_utc)}</span>`}</div><div class="vs"><div class="side">${mono(p.name)}<b>${esc(last(p.name))}</b></div><div class="mid time tnum">${hm(nx.when_utc)}<small>${esc(dayLabel(nx.when_utc))}</small></div><div class="side">${mono(nx.opponent)}<b>${esc(nx.opponent || "TBC")}</b></div></div><div class="meta">${esc([nx.event, nx.court].filter(Boolean).join(" · "))}${nx.held ? `<br>${esc(nx.held)}` : ""}${p.agree === false && p.backup ? `<br>Another listing has ${esc(hm(p.backup.when_utc))}` : ""}</div>${p2 ? mktBar(p2, [last(p.name), last(nx.opponent)], "tennis") : ""}</div>` : ""}
      ${lastE ? `<div style="margin-top:12px">${resultCard(lastE)}</div>` : ""}</section>`;
  }).join("");
  const tours = EV.filter(ev => t(ev.end) > now - 864e5).map(ev => {
    const going = t(ev.start) <= now;
    const who = TP.map(p => { const inIt = (p.next && same(p.next.event, ev.name)) || (p.last && same(p.last.event, ev.name)); return inIt ? `<span class="chip sp sp-tennis">${esc(last(p.name))}${p.next && same(p.next.event, ev.name) ? " · in" : " · out"}</span>` : ""; }).join(" ");
    return `<div class="row"><div class="grow"><div class="t1">${esc(ev.name)}${ev.major ? " · Grand Slam" : ""}</div><div class="t2">${esc(ev.venue || "")} · ${going ? "until" : "from"} ${esc(shortDate(going ? ev.end : ev.start))}</div>${who ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${who}</div>` : ""}</div>${going ? `<span class="chip done">Under way</span>` : ""}</div>`;
  }).join("");
  return `<div class="page">${header("Tennis", `<b>${esc((follows().tennis_players || []).join(" and "))}</b>`, ["tennis_players", "tennis"])}
    ${!TP.length ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${cards}
    ${tours ? blk("Tournaments", `<div class="list">${tours}</div>`) : ""}
    ${srcLine("tennis_players", "tennis", "odds")}</div>`;
}

// ------------------------------------------------------------------ Warriors
function viewNba() {
  const B = val("nba"), E = events().filter(e => e.sp === "nba"), now = Date.now();
  const next = E.find(e => e.state === "live") || E.find(e => e.state === "next" && t(e.start) > now - 6e4), done = E.filter(e => e.state === "done").slice(-1)[0];
  const rows = (B?.next || []).map(g => `<div class="row">${mono(g.opponent, "sm")}<div class="grow"><div class="t1">${g.home ? "v" : "at"} ${esc(g.opponent)}</div><div class="t2">${esc(when(g.date))}${g.preseason ? " · Preseason" : ""}</div></div></div>`).join("");
  return `<div class="page">${header("Warriors", `<b>${B?.in_season ? "Regular season" : "Preseason"}</b>`, ["nba"])}
    ${next ? blk("Next game", nextCard(next)) : ""}
    ${done ? blk("Last result", resultCard(done)) : ""}
    ${rows ? blk("Schedule", `<div class="list">${rows}</div>`) : ""}
    ${srcLine("nba", "odds")}</div>`;
}

// ------------------------------------------------------------------ router and shell
const VIEWS = { home: viewHome, football: viewFootball, f1: viewF1, cricket: viewCricket, tennis: viewTennis, nba: viewNba };
const TITLES = { home: "Today", football: "Real Madrid", f1: "Formula 1", cricket: "India", tennis: "Tennis", nba: "Warriors" };
let route = null, io = null;
function current() { const h = location.hash.replace(/^#\/?/, "").split("/")[0]; return VIEWS[h] ? h : "home"; }
function render(navigated) {
  const r = current(), changed = r !== route; route = r;
  const y = window.scrollY;
  document.body.dataset.tab = r;
  for (const a of document.querySelectorAll(".tabs a")) {
    if (a.dataset.tab === r || (r === "nba" && a.dataset.tab === "home")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  $("#back").hidden = r !== "nba";
  $("#topTitle").textContent = TITLES[r];
  const html = VIEWS[r]();
  view.innerHTML = html;
  if (!changed && !navigated) { view.querySelector(".page")?.style.setProperty("animation", "none"); window.scrollTo(0, y); }
  else window.scrollTo(0, 0);
  document.title = `${TITLES[r]} · Sport`;
  // The small title in the bar appears once the large one scrolls away
  io?.disconnect();
  const h1 = $("#h1");
  if (h1 && "IntersectionObserver" in window) { io = new IntersectionObserver(([en]) => $("#top").classList.toggle("solid", !en.isIntersecting), { rootMargin: "-56px 0px 0px 0px" }); io.observe(h1); }
}
addEventListener("hashchange", () => { vibe(); render(true); view.focus({ preventScroll: true }); });
$("#back").addEventListener("click", () => { location.hash = "#home"; });
$("#refresh").addEventListener("click", () => { vibe(); loadAll(); });
view.addEventListener("click", e => {
  const b = e.target.closest("button[data-ui]"); if (!b) return;
  UI[b.dataset.ui] = b.dataset.v; vibe(); render(false);
});
// Countdowns tick; the data refreshes every minute while something is live, else every five, and on return to the app
setInterval(() => { for (const el of document.querySelectorAll("[data-cd]")) el.textContent = rel(el.dataset.cd); }, 20000);
setInterval(() => { if (document.hidden) return; const live = events().some(e => e.state === "live"); if (Date.now() - lastLoad > (live ? 60e3 : 300e3)) loadAll(); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastLoad > 60e3) loadAll(); });
render(true);
loadAll();
if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("/sport-sw.js", { scope: "/sport" }).catch(() => {});
