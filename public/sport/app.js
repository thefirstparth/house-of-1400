// Sport (/sport): everything Parth follows, in one app. Reads the paper's live feeds (/api/live/<key>) and the three the
// app adds (madrid_hub, f1_hub, intl_hub; lib/sportapp.js). Rules from the paper: a figure shows only from its source,
// with its time; a feed that fails falls back to the last copy this phone saw, then the day's edition snapshot, marked
// with its time; otherwise the block is left out. Times are IST. No LLM anywhere.
const TZ = "Asia/Kolkata";
const KEYS = ["football", "madrid_hub", "club_stats", "intl_hub", "f1_next", "f1_sessions", "f1_standings", "f1_last", "f1_market", "f1_hub", "odds", "crease", "tennis_players", "tennis", "tennis_hub", "nba"];
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
  const txt = a < 60 ? `${a} min` : a < 48 * 60 ? `${Math.floor(a / 60)}h${a % 60 && a < 600 ? ` ${a % 60}m` : ""}` : `${Math.round(a / 1440)} days`;
  return a < 1 ? "now" : m > 0 ? `in ${txt}` : `${txt} ago`;
}
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(cf|fc|club de futbol|sad)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Two names for the same side: equal, or one is the other with words added ("Golden State" / "Golden State Warriors").
// Whole words only, so "Real Madrid" is never "Atlético Madrid" and "India" never "West Indies".
const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)); };
const last = n => String(n || "").split(" ").pop();
// "IND", "WI", "NZ", "JMC": a one-word name gives its first three letters, longer names their initials
const initials = n => { const w = String(n || "").split(/\s+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, 3) : w.map(x => x[0]).join("").slice(0, 3)).toUpperCase(); };
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
const gpName = n => String(n || "").replace(/ in .*$/, "");
const val = k => D[k]?.value || null;
const vibe = () => { try { navigator.vibrate?.(8); } catch {} };
const ICON = {
  football: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  f1: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3.5"/><path d="M5 4h14v9H5"/><path class="f" d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"/></svg>',
  cricket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3l5.5 5.5-9.6 9.6-5.5-5.5z"/><path d="M5.9 12.6L3 19.5 4.5 21l6.9-2.9"/></svg>',
  tennis: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M5 6.3c3.2 1.6 4.6 5.7 3 10.1M19 6.3c-3.2 1.6-4.6 5.7-3 10.1"/></svg>',
  nba: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3.4 3 8.6 0 12M18 6c-3 3.4-3 8.6 0 12"/></svg>',
  intl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4.5c4-2 7 2 14 0v9c-7 2-10-2-14 0"/></svg>',
};
const SPORT_NAME = { football: "Football", f1: "F1", cricket: "Cricket", tennis: "Tennis", nba: "NBA", intl: "Football" };
const chip = (sp, label) => `<span class="chip sp sp-${sp}">${ICON[sp]}${esc(label || SPORT_NAME[sp])}</span>`;
const tile = sp => `<span class="tile sp-${sp}" aria-hidden="true">${ICON[sp]}</span>`;
const chev = '<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const down = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4"/></svg>';
const moreBox = (label, inner) => `<details class="more-box"><summary>${label} ${down}</summary>${inner}</details>`;
// Images: ESPN's crests and NBA logos, a flag for a cricket country, else the initials
const monoHTML = (name, size) => `<span class="mono ${size}" aria-hidden="true">${esc(initials(name))}</span>`;
function logo(url, name, size = "lg") {
  if (!url) return monoHTML(name, size);
  const fb = esc(`<span class="mono ${size}">${esc(initials(name))}</span>`).replace(/'/g, "");
  return `<img class="crest ${size}" src="${esc(url)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.outerHTML='${fb}'">`;
}
const px = size => (size === "lg" ? 128 : 64);
const crest = (id, name, size = "lg") => logo(id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${encodeURIComponent(id)}.png&w=${px(size)}&h=${px(size)}` : null, name, size);
const nbaLogo = (abbr, name, size = "lg") => logo(abbr ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${encodeURIComponent(String(abbr).toLowerCase())}.png&w=${px(size)}&h=${px(size)}` : null, name, size);
// A tennis player: ESPN's photo where the ATP list has one, else the initials; and his ranking
const atp = name => (val("tennis_hub")?.ranks || []).find(r => same(r.name, name)) || null;
function player(name, size = "lg") {
  const r = atp(name);
  const path = r?.photo ? new URL(r.photo).pathname : r?.id ? `/i/headshots/tennis/players/full/${r.id}.png` : null;
  if (path) return `<span class="ph ${size}">${logo(`https://a.espncdn.com/combiner/i?img=${encodeURIComponent(path)}&w=${size === "lg" ? 160 : 80}&h=${size === "lg" ? 160 : 80}`, name, size)}${r.flag ? `<img class="pf" src="${esc(r.flag)}" alt="" loading="lazy">` : ""}</span>`;
  return monoHTML(name, size);
}
const rankTxt = name => { const r = atp(name); if (!r) return ""; const mv = r.previous ? r.previous - r.rank : 0; return `No. ${r.rank}${mv > 0 ? ` ▲${mv}` : mv < 0 ? ` ▼${-mv}` : ""}`; };
const FLAG = { India: "🇮🇳", "New Zealand": "🇳🇿", Australia: "🇦🇺", "South Africa": "🇿🇦", Pakistan: "🇵🇰", "Sri Lanka": "🇱🇰", Bangladesh: "🇧🇩", Afghanistan: "🇦🇫", Zimbabwe: "🇿🇼", Ireland: "🇮🇪", Netherlands: "🇳🇱", Nepal: "🇳🇵", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", USA: "🇺🇸", "United Arab Emirates": "🇦🇪", Oman: "🇴🇲" };
const country = (name, size = "lg") => (FLAG[name] ? `<span class="mono ${size} flagm" aria-hidden="true">${FLAG[name]}</span>` : monoHTML(name, size));
// Where the figures come from, folded away at the foot of a page
function sources(...keys) {
  const parts = keys.filter(k => D[k]?.source).map(k => `<li>${esc(D[k].source)} · ${D[k].as_of ? (dayKey(t(D[k].as_of)) === dayKey(Date.now()) ? hm(D[k].as_of) : `${shortDate(D[k].as_of)}, ${hm(D[k].as_of)}`) : ""}${D[k].stale ? " · last saved copy" : ""}</li>`);
  return parts.length ? `<details class="srcs"><summary>Sources and times</summary><ul>${[...new Set(parts)].join("")}</ul><p>All times IST. Markets are Kalshi and Polymarket prices, not forecasts.</p></details>` : "";
}

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
    const j = await getJSON(`/api/live/${k}`, /_hub$/.test(k) ? 45000 : 25000);
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
  if (!CFG) { try { CFG = await getJSON("/config/house.json", 15000); store.set("cfg", CFG); } catch { CFG = store.get("cfg"); } }
  render(false);
  await Promise.all(KEYS.map(k => loadKey(k).then(paintSoon)));
  lastLoad = Date.now(); loading = false; $("#refresh").classList.remove("spin");
  render(false);
}

// ------------------------------------------------------------------ what Parth follows
const follows = () => CFG?.follows || {};
const club = () => follows().football_club?.name || "Real Madrid";
const favDriver = () => follows().f1_driver?.name || "Max Verstappen";
const nbaTeam = () => follows().nba_team?.name || "Golden State Warriors";
const CLUB_SHORT = n => (same(n, club()) ? "Madrid" : n);
// The markets for a match: Kalshi or Polymarket via the paper's odds feed, matched by sport, the two sides and the day
function oddsFor(sport, sides, iso, kind = "match") {
  const M = (val("odds")?.matches || []).filter(m => m.sport === sport && m.kind === kind && (m.start && m.date_exact !== false ? Math.abs(t(m.start) - t(iso)) <= 3 * 36e5 : Math.abs(Date.parse(m.date) - Date.parse(dayKey(t(iso)))) <= 864e5));
  if (kind !== "match") return M[0] || null;
  return M.find(m => m.sides?.length === 2 && ((same(m.sides[0], sides[0]) && same(m.sides[1], sides[1])) || (same(m.sides[0], sides[1]) && same(m.sides[1], sides[0])))) || null;
}
// The race winner market: the better-traded of Kalshi and Polymarket in the paper's f1_market feed
const raceMarket = () => {
  const M = val("f1_market"), gp = gpName(val("f1_next")?.race?.name);
  if (!M || (gp && M.race && !same(gpName(M.race), gp))) return null; // never another weekend's market
  return [...(M.markets || [])].sort((a, b) => (b.volume || 0) - (a.volume || 0))[0] || null;
};
// A session's winner market: the race from f1_market; qualifying and sprints from the odds feed
const sessionMarket = (name, start) => { const k = f1Kind(name); return k === "race" ? raceMarket() : k ? oddsFor("f1", null, start, k) : null; };
const f1Kind = s => (/sprint qualif|shootout/i.test(s) ? "sprint_qualifying" : /sprint/i.test(s) ? "sprint" : /qualif/i.test(s) ? "qualifying" : /^race$/i.test(s) ? "race" : null);
// Outcomes laid out as the fixture reads: first side, draw, second side
// Rounded shares that add up to exactly 100 (largest remainder), so a bar never reads 95% + 6%
function to100(xs) {
  const tot = xs.reduce((a, b) => a + b, 0) || 1, raw = xs.map(x => (x / tot) * 100), fl = raw.map(Math.floor);
  let left = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
  return fl;
}
function sideProbs(m, sides) {
  if (!m) return null;
  const find = s => m.outcomes.find(o => same(o.name, s));
  const a = find(sides[0]), b = find(sides[1]), d = m.outcomes.find(o => /^draw$/i.test(o.name));
  if (!a || !b) return null;
  const [pa, pb, pd] = to100([a.prob, b.prob, ...(d ? [d.prob] : [])]);
  return { a: pa, b: pb, d: d ? pd : null, source: m.source, url: m.url };
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
// A ranked chart: one row per outcome, bars on a common 0-100 scale so their lengths compare honestly
function rankList(outcomes, sp, { max = 6, nameFn = x => x, mark = null } = {}) {
  const o = [...outcomes].sort((a, b) => b.prob - a.prob).slice(0, max);
  return `<div class="rank sp-${sp}">${o.map((x, i) => { const me = mark && same(x.name, mark); return `<span class="n${i === 0 ? " lead" : ""}${me ? " me" : ""}">${esc(nameFn(x.name))}</span><span class="tr"><i class="${i === 0 ? "lead" : ""}${me ? " me" : ""}" style="width:${Math.max(1.5, Math.min(100, x.prob))}%"></i></span><b class="p tnum${i === 0 ? " lead" : ""}">${Math.round(x.prob)}%</b>`; }).join("")}</div>`;
}
// A horizontal bar on its own track, value at the end: lengths are value / max of the set
const barRow = (name, v, max, { me = false, sub = "", pos = "", colour = "", label = v } = {}) => `<div class="barrow${me ? " me" : ""}"${colour ? ` style="--c:${esc(colour)}"` : ""}><div class="nm">${pos !== "" ? `<span class="ps tnum">${esc(pos)}</span>` : ""}<span>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></div><div class="bv"><span class="tk"><i style="width:${Math.max(2, (v / Math.max(max, 1e-9)) * 100)}%"></i></span><b class="tnum">${esc(label)}</b></div></div>`;

// Every followed fixture as one shape: { sp, id, start, state: live|next|done|off, title, a, b, logos, score, href }
function events() {
  const out = [], now = Date.now();
  // Real Madrid (football: live state and score; madrid_hub: the season)
  const F = val("football"), H = val("madrid_hub"), cname = club(), cid = H?.club_id || String(follows().football_club?.espn_id || 86);
  const fx = new Map();
  for (const m of [...(H?.fixtures || []), ...(H?.results || []).slice(0, 4)]) fx.set(String(m.id), m);
  for (const m of [...(F?.next || []), ...(F?.last ? [F.last] : [])]) { const o = fx.get(String(m.id)) || {}; fx.set(String(m.id), { ...o, ...m, us: m.score?.us ?? o.us, them: m.score?.them ?? o.them }); }
  for (const m of fx.values()) {
    const home = m.home, a = home ? cname : m.opponent, b = home ? m.opponent : cname;
    const state = m.state === "in" ? "live" : m.completed ? "done" : m.state === "post" ? "off" : "next"; // "post" unfinished: postponed or abandoned
    out.push({ sp: "football", id: "rm" + m.id, mid: String(m.id), start: m.date, state, title: `${CLUB_SHORT(a)} v ${CLUB_SHORT(b)}`, a, b, la: crest(home ? cid : m.opponent_id, a), lb: crest(home ? m.opponent_id : cid, b),
      sla: crest(home ? cid : m.opponent_id, a, "sm"), slb: crest(home ? m.opponent_id : cid, b, "sm"), comp: m.competition, venue: m.venue, sa: home ? m.us : m.them, sb: home ? m.them : m.us, clock: m.clock,
      won: m.winner === "us" ? (home ? "a" : "b") : m.winner === "them" ? (home ? "b" : "a") : null, who: "Madrid", href: "#football" });
  }
  // The national sides
  for (const T of val("intl_hub")?.teams || []) for (const m of [...T.next, ...(T.last ? [T.last] : [])]) {
    out.push({ sp: "intl", id: "nt" + m.id, start: m.date, state: m.completed ? "done" : t(m.date) < now ? "off" : "next", title: `${m.home} v ${m.away}`, a: m.home, b: m.away, la: crest(m.home_id, m.home), lb: crest(m.away_id, m.away),
      sla: crest(m.home_id, m.home, "sm"), slb: crest(m.away_id, m.away, "sm"), comp: m.competition, venue: m.venue, sa: m.hs, sb: m.as, won: m.completed ? (+m.hs > +m.as ? "a" : +m.hs < +m.as ? "b" : null) : null, who: T.name, href: "#football/nations" });
  }
  // India (The Crease)
  const C = val("crease");
  if (C) {
    const all = [C.today, C.next, ...[C.main, ...(C.also || []), C.after].filter(Boolean).flatMap(S => (S.formats || []).flatMap(f => f.matches || []))].filter(Boolean);
    for (const m of new Map(all.map(m => [m.id, m])).values()) {
      const state = m.state === "live" ? "live" : m.state === "done" ? "done" : m.state === "off" ? "off" : "next";
      out.push({ sp: "cricket", id: "in" + m.id, start: m.start, state, title: `India v ${m.opponent}`, a: "India", b: m.opponent, la: country("India"), lb: country(m.opponent), comp: m.desc, venue: [m.ground, m.city].filter(Boolean).join(", "), status: m.status, score: m.score, won: m.won === true ? "a" : m.won === false ? "b" : null, tbc: m.time_announced === false, who: "India", href: "#cricket" });
    }
  }
  // F1: the weekend's sessions that count (qualifying, sprints, the race)
  const N = val("f1_next")?.race, R = val("f1_sessions")?.results || [];
  for (const s of N?.sessions || []) {
    if (!f1Kind(s.name)) continue;
    const st = t(s.start), end = st + (s.minutes || 60) * 6e4, res = R.find(r => Math.abs(t(r.start) - st) < 45 * 6e4);
    out.push({ sp: "f1", id: "f1" + s.start, start: s.start, state: now >= end ? "done" : now >= st ? "live" : "next", title: /^race$/i.test(s.name) ? gpName(N.name) : s.name, sub: /^race$/i.test(s.name) ? N.circuit : gpName(N.name), flag: N.flag, session: s.name, top: res?.top || null, who: "F1", href: "#f1" });
  }
  // Tennis
  for (const p of val("tennis_players")?.players || []) {
    if (p.next) out.push({ sp: "tennis", id: "tn" + p.name + p.next.when_utc, start: p.next.when_utc, state: p.next.live ? "live" : "next", title: `${last(p.name)} v ${last(p.next.opponent) || "TBC"}`, a: p.name, b: p.next.opponent, la: player(p.name), lb: player(p.next.opponent), comp: [p.next.event, p.next.round].filter(Boolean).join(", "), venue: p.next.court, player: p.name, who: last(p.name), href: "#tennis" });
    if (p.last) out.push({ sp: "tennis", id: "tl" + p.name + p.last.when_utc, start: p.last.when_utc, state: "done", title: `${last(p.name)} v ${last(p.last.opponent)}`, a: p.name, b: p.last.opponent, comp: [p.last.event, p.last.round].filter(Boolean).join(", "), won: p.last.won ? "a" : "b", note: p.last.note, player: p.name, who: last(p.name), href: "#tennis" });
  }
  // The Warriors
  const B = val("nba"), team = nbaTeam();
  for (const g of [...(B?.next || []), ...(B?.last ? [B.last] : [])]) {
    const a = g.home ? team : g.opponent, b = g.home ? g.opponent : team, me = follows().nba_team?.espn_abbr || "gs";
    out.push({ sp: "nba", id: "nb" + g.id, start: g.date, state: g.live ? "live" : g.completed ? "done" : t(g.date) < now - 6 * 36e5 ? "off" : "next", title: `${last(a)} v ${last(b)}`, a, b, la: nbaLogo(g.home ? me : g.opponent_abbr, a), lb: nbaLogo(g.home ? g.opponent_abbr : me, b),
      sla: nbaLogo(g.home ? me : g.opponent_abbr, a, "sm"), slb: nbaLogo(g.home ? g.opponent_abbr : me, b, "sm"), comp: g.preseason ? "Preseason" : "NBA", sa: g.score ? (g.home ? g.score.us : g.score.them) : null, sb: g.score ? (g.home ? g.score.them : g.score.us) : null,
      won: g.winner === "us" ? (g.home ? "a" : "b") : g.winner === "them" ? (g.home ? "b" : "a") : null, clock: g.clock, who: "Warriors", href: "#nba" });
  }
  return out.filter(e => e.start && !isNaN(t(e.start))).sort((x, y) => t(x.start) - t(y.start));
}
const followKey = e => (e.sp === "tennis" ? "tn:" + e.player : e.sp === "intl" ? "nt:" + e.who : e.sp);
// The followed side's price for an event, for the Up next rows
function evOdds(e) {
  if (e.sp === "f1") {
    const m = sessionMarket(e.session, e.start); if (!m) return null;
    const fav = favDriver(), o = m.outcomes.find(x => same(x.name, fav));
    return o ? { label: last(fav), prob: Math.round(o.prob) } : null;
  }
  if (!e.a || !e.b || e.sp === "intl") return null;
  const sp = e.sp === "nba" ? "basketball" : e.sp, m = oddsFor(sp, [e.a, e.b], e.start); if (!m) return null;
  const mine = e.sp === "football" ? club() : e.sp === "cricket" ? "India" : e.sp === "nba" ? nbaTeam() : e.player;
  const o = m.outcomes.find(x => same(x.name, mine)); return o ? { label: e.sp === "football" ? "Madrid" : last(mine), prob: Math.round(o.prob) } : null;
}
const isOn = () => { const B = val("nba"); return !!B && (B.in_season || (B.next || []).some(g => t(g.date) - Date.now() < 10 * 864e5) || (B.last && Date.now() - t(B.last.date) < 3 * 864e5)); };

// ------------------------------------------------------------------ shared pieces
function header(title, sub, stalekeys = []) {
  const st = stalekeys.filter(k => D[k]?.stale);
  return `<header class="hero-h"><h1 id="h1">${title}</h1>${sub || st.length ? `<div class="sub">${sub || ""}${st.length ? `<span class="stale"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>Saved copy from ${esc(when(D[st[0]].as_of))}${loading ? ", refreshing" : ""}</span>` : ""}</div>` : ""}</header>`;
}
const blk = (title, body, extra = "", id = "") => (body ? `<section class="blk"${id ? ` id="${id}"` : ""}><div class="blk-h"><h2>${title}</h2>${extra}</div>${body}</section>` : "");
const countdown = iso => `<span data-cd="${esc(iso)}">${esc(rel(iso))}</span>`;
// Jump bar: the page's sections as chips under the title, for long pages
const jump = items => { const it = items.filter(([id]) => id); return it.length > 2 ? `<nav class="jump" aria-label="On this page"><div class="jump-in">${it.map(([id, n]) => `<a href="#${route}/${id}" data-jump="${id}">${esc(n)}</a>`).join("")}</div></nav>` : ""; };

// The hero for an event: two sides and the time (or the score), or one title for F1
function nextCard(e, { odds = true } = {}) {
  if (!e) return "";
  const head = `<div class="when">${chip(e.sp, e.sp === "f1" ? "F1" : e.comp || SPORT_NAME[e.sp])}${e.state === "live" ? `<span class="chip live"><i></i>Live</span>` : `<span class="count">${e.tbc ? "Time to be confirmed" : countdown(e.start)}</span>`}</div>`;
  if (e.sp === "f1") {
    const o = odds ? evOdds(e) : null, fav = favDriver();
    const qs = /^sprint$/i.test(e.session) ? /sprint (qualifying|shootout)/i : /^race$/i.test(e.session) ? /^qualifying$/i : null;
    const q = qs && (val("f1_sessions")?.results || []).find(r => qs.test(r.name) && dayKey(t(r.start)) >= dayKey(t(e.start) - 3 * 864e5));
    const qi = q ? q.top.findIndex(n => same(n, last(fav))) : -1;
    const qline = qi >= 0 ? `<span class="pill res">${fpos({ pos: qi + 1, finished: true })}${esc(last(fav))} qualified ${ordinal(qi + 1)}</span>` : "";
    return `<a class="card next one sp-f1" href="${e.href}">${head}<div class="title">${e.flag ? `<span class="fl">${esc(e.flag)}</span> ` : ""}${esc(e.title)}<small>${esc(e.sub || "")}</small></div><div class="clock tnum">${hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>${o || qline ? `<div class="pill-row">${qline}${o ? `<span class="pill">${esc(o.label)} <b class="tnum">${o.prob}%</b> to win, in the markets</span>` : ""}</div>` : ""}</a>`;
  }
  const side = (name, lg) => `<div class="side">${lg || monoHTML(name, "lg")}<b>${esc(e.sp === "tennis" || e.sp === "nba" ? last(name) : name)}</b></div>`;
  const live = e.state === "live" && e.sa != null;
  const mid = live ? `<div class="mid tnum">${esc(e.sa)}–${esc(e.sb)}${e.clock ? `<small>${esc(e.clock)}</small>` : ""}</div>` : e.state === "live" && e.score ? `<div class="mid time"><small class="sc">${esc(e.score)}</small></div>` : `<div class="mid time tnum">${e.tbc ? "TBC" : hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>`;
  const sp = e.sp === "nba" ? "basketball" : e.sp === "intl" ? null : e.sp;
  const p = odds && sp && e.state !== "done" ? sideProbs(oddsFor(sp, [e.a, e.b], e.start), [e.a, e.b]) : null;
  const nm = n => (e.sp === "tennis" || e.sp === "nba" ? last(n) : CLUB_SHORT(n));
  return `<a class="card next sp-${e.sp}" href="${e.href}">${head}<div class="vs">${side(e.a, e.la)}${mid}${side(e.b, e.lb)}</div>${e.venue ? `<div class="meta">${esc(e.venue)}</div>` : ""}${p ? mktBar(p, [nm(e.a), nm(e.b)], e.sp) : ""}</a>`;
}
// A finished event as a small scoreboard
function scoreboard(e) {
  if (e.sp === "f1") {
    if (!e.top) return "";
    const S = val("f1_standings")?.drivers || [];
    return `<div class="sb podium">${e.top.map((n, i) => { const d = S.find(x => same(last(x.name), n) || same(x.shown, n)); return `<div class="ln${i === 0 ? " won" : ""}"><span class="pos tnum">${i + 1}</span><i class="tstripe" style="${d?.colour ? `background:${esc(d.colour)}` : ""}"></i><span class="code">${esc(d?.code || "")}</span><span class="nm">${esc(n)}</span></div>`; }).join("")}</div>`;
  }
  if (e.sp === "cricket") {
    const inn = String(e.score || "").split(" · ").map(s => s.match(/^([A-Z]{2,4})\s+(\d+(?:\/\d+)?d?)(?:\s*\(([\d.]+) ov\))?$/));
    let body = inn.length === 2 && inn.every(Boolean) ? `<div class="sb">${inn.map(([, code, runs, ov]) => { const won = e.won === "a" ? code === "IND" : e.won === "b" ? code !== "IND" : false; return `<div class="ln${won ? " won" : ""}"><span class="nm">${esc(code)}</span>${won ? '<i class="w" aria-label="winner"></i>' : ""}<span class="v tnum">${esc(runs)}${ov ? `<small>${esc(ov)} ov</small>` : ""}</span></div>`; }).join("")}</div>` : e.score ? `<div class="cap tnum">${esc(e.score)}</div>` : "";
    if (e.status) body += `<div class="cap">${esc(String(e.status).replace(/ due to .*$/i, ""))}</div>`;
    return body;
  }
  if (e.sp === "tennis") {
    // ESPN's note names the winner first ("Hurkacz (POL) bt (10) Djokovic (SER) 6-4 6-3"), so the games are winner-first
    const sets = [...String(e.note || "").replace(/^.*?\bbt\b/, "").matchAll(/(\d+)-(\d+)(?:\s*\((\d+)-(\d+)\))?/g)].map(x => [Number(x[1]), Number(x[2]), x[3] != null ? Math.min(+x[3], +x[4]) : null]);
    const winner = e.won === "a" ? e.a : e.b, loser = e.won === "a" ? e.b : e.a;
    let body = sets.length ? `<div class="sb">${[[winner, 0, true], [loser, 1, false]].map(([n, i, w]) => `<div class="ln${w ? " won" : ""}"><span class="nm">${esc(last(n))}</span><span class="sets">${sets.map(s => `<b class="tnum">${s[i]}${!w && s[2] != null && s[1] === 6 && s[0] === 7 ? `<sup>${s[2]}</sup>` : w && s[2] != null && s[0] === 6 && s[1] === 7 ? `<sup>${s[2]}</sup>` : ""}</b>`).join("")}</span></div>`).join("")}</div>` : "";
    if (/\bret/i.test(e.note || "")) body += `<div class="cap">${esc(last(loser))} retired</div>`;
    return body;
  }
  if (e.sa == null) return "";
  return `<div class="sb">${[[e.a, e.sa, e.won === "a", e.sla], [e.b, e.sb, e.won === "b", e.slb]].map(([n, v, w, lg]) => `<div class="ln${w ? " won" : ""}">${lg || ""}<span class="nm">${esc(e.sp === "nba" ? last(n) : n)}</span>${w ? '<i class="w" aria-label="winner"></i>' : ""}<span class="v tnum">${esc(v)}</span></div>`).join("")}</div>`;
}
function resultCard(e) {
  const body = scoreboard(e); if (!body) return "";
  const label = e.sp === "f1" ? e.session : e.sp === "intl" ? e.who : e.comp || SPORT_NAME[e.sp];
  const cap = e.sp === "f1" ? e.sub : e.sp === "cricket" ? e.title : e.sp === "intl" ? e.comp : "";
  return `<a class="card res-card sp-${e.sp}" href="${e.href}"><div class="hd">${chip(e.sp, label)}<time datetime="${esc(e.start)}">${esc(dayLabel(e.start))}</time></div>${cap ? `<div class="cap">${esc(cap)}</div>` : ""}${body}</a>`;
}

// ------------------------------------------------------------------ Today
// The week at a glance: seven days, a dot per followed fixture in its sport's colour. Tap a day for its fixtures.
function weekStrip(E) {
  const now = Date.now(), days = [...Array(7)].map((_, i) => dayKey(now + i * 864e5));
  const by = d => E.filter(e => dayKey(t(e.start)) === d && e.state !== "off");
  const sel = days.includes(UI.day) ? UI.day : null;
  const cells = days.map((d, i) => {
    const ev = by(d), dt = new Date(d + "T12:00:00+05:30");
    const sps = [...new Set(ev.map(e => e.sp))];
    return `<button type="button" class="wd${i === 0 ? " today" : ""}${d === sel ? " on" : ""}" data-ui="day" data-v="${d}" aria-pressed="${d === sel}" aria-label="${esc(fmt(dt.toISOString(), { weekday: "long", day: "numeric", month: "long" }))}: ${ev.length} fixture${ev.length === 1 ? "" : "s"}"${ev.length ? "" : " disabled"}>
      <span class="wdn">${i === 0 ? "Today" : esc(fmt(dt.toISOString(), { weekday: "short" }))}</span><b class="tnum">${esc(fmt(dt.toISOString(), { day: "numeric" }))}</b>
      <span class="dots">${(sps.length > 3 ? sps.slice(0, 2) : sps).map(sp => `<i class="sp-${sp}"></i>`).join("")}${sps.length > 3 ? `<em>+${sps.length - 2}</em>` : ""}</span></button>`;
  }).join("");
  const list = sel ? by(sel).map(e => {
    const res = e.state === "done" ? (e.sa != null ? `${e.sa}–${e.sb}` : e.sp === "f1" && e.top ? `1 ${e.top[0]}` : e.sp === "tennis" ? (e.won === "a" ? "Won" : "Lost") : e.sp === "cricket" && e.status ? resultWord({ status: e.status, won: e.won === "a" ? true : e.won === "b" ? false : null }) : "Final") : null;
    return `<a class="row" href="${e.href}">${tile(e.sp)}<div class="grow"><div class="t1">${esc(e.title)}</div><div class="t2">${esc(e.tbc ? "Time TBC" : hm(e.start))}${e.comp && e.sp !== "f1" ? ` · ${esc(e.comp)}` : e.sp === "f1" && e.sub ? ` · ${esc(e.sub)}` : ""}</div></div><div class="end">${e.state === "live" ? `<span class="chip live"><i></i>Live</span>` : res ? `<span class="t2">${esc(res)}</span>` : t(e.start) - Date.now() < 12 * 36e5 ? `<span class="t2">${countdown(e.start)}</span>` : ""}</div></a>`;
  }).join("") : "";
  const selDt = sel && new Date(sel + "T12:00:00+05:30").toISOString();
  SHEET = list ? `<div class="sheet-bg" data-close="day"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><div class="grab" aria-hidden="true"></div><div class="sheet-h"><b id="sheet-t" tabindex="-1">${esc(sel === dayKey(Date.now()) ? "Today" : fmt(selDt, { weekday: "long", day: "numeric", month: "long" }))}</b><button type="button" class="x" data-close="day" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="list">${list}</div></div>` : "";
  return `<section class="week" aria-label="The week ahead"><div class="wk7">${cells}</div></section>`;
}
function viewHome() {
  const E = events(), now = Date.now();
  const live = E.filter(e => e.state === "live");
  const next = E.filter(e => e.state === "next" && t(e.start) > now - 6e4);
  // One next fixture per thing followed; national sides only inside ten days
  const per = new Map();
  for (const e of next) { if (e.sp === "intl" && t(e.start) - now > 10 * 864e5) continue; const k = followKey(e); if (!per.has(k)) per.set(k, e); }
  const ups = [...per.values()].sort((a, b) => t(a.start) - t(b.start));
  const laterBy = new Map();
  for (const e of next) { const k = followKey(e); if (!per.has(k) && !laterBy.has(k)) laterBy.set(k, e); }
  const later = [...laterBy.values()].sort((a, b) => t(a.start) - t(b.start));
  const hero = ups[0];
  const rows = ups.slice(1).map(e => {
    const o = evOdds(e);
    const title = e.sp === "f1" ? `${e.title}${e.session !== "Race" ? ` · ${e.sub.replace(/ Grand Prix$/, " GP")}` : ""}` : e.title;
    return `<a class="row" href="${e.href}">${tile(e.sp)}<div class="grow"><div class="t1">${esc(title)}</div><div class="t2">${esc(e.tbc ? `${shortDate(e.start)}, time TBC` : when(e.start))}${e.comp && e.sp !== "f1" ? ` · ${esc(e.comp)}` : ""}</div></div><div class="end">${o ? `<div class="pc tnum">${o.prob}%</div><div class="t2">${esc(o.label)}</div>` : `<div class="t2">${countdown(e.start)}</div>`}</div></a>`;
  }).join("");
  // Latest results: the most recent finished event per follow in the last ten days
  const doneBy = new Map();
  for (const e of [...E].reverse()) { if (e.state !== "done" || now - t(e.start) > 10 * 864e5) continue; const k = followKey(e); if (!doneBy.has(k)) doneBy.set(k, e); }
  const done = [...doneBy.values()].sort((a, b) => t(b.start) - t(a.start));
  const nats = done.filter(e => e.sp === "intl");
  const natCard = nats.length ? `<a class="card res-card sp-intl" href="#football/nations"><div class="hd">${chip("intl", "National teams")}<time>${esc(dayLabel(nats[0].start))}</time></div><div class="sb">${nats.map(e => { const us = same(e.a, e.who) ? "a" : "b", g = us === "a" ? [e.sa, e.sb] : [e.sb, e.sa], r = +g[0] > +g[1] ? "W" : +g[0] < +g[1] ? "L" : "D"; return `<div class="ln${r === "W" ? " won" : ""}">${us === "a" ? e.sla : e.slb}<span class="nm">${esc(e.who)} <span class="dim">v ${esc(us === "a" ? e.b : e.a)}</span></span><span class="v tnum">${esc(g[0])}–${esc(g[1])}</span></div>`; }).join("")}</div></a>` : "";
  const results = [...done.filter(e => e.sp !== "intl").map(resultCard).filter(Boolean).slice(0, nats.length ? 4 : 5), natCard].filter(Boolean).join("");
  // Tournaments and tables: tennis events his players are in, India's series, the championships
  const tours = [];
  const TP = val("tennis_players")?.players || [];
  for (const ev of val("tennis")?.events || []) {
    if (t(ev.end) < now) continue;
    const st = TP.map(p => {
      const nx = p.next && same(p.next.event, ev.name) ? p.next : null, ls = p.last && same(p.last.event, ev.name) ? p.last : null;
      if (nx) return `${last(p.name)} plays ${last(nx.opponent) || "TBC"}, ${when(nx.when_utc)}`;
      if (ls) return ls.won ? `${last(p.name)} through, ${ls.round || ""}` : `${last(p.name)} out, ${ls.round || ""}`;
      return null;
    }).filter(Boolean);
    if (!st.length && !ev.major) continue;
    tours.push(`<a class="row" href="#tennis">${tile("tennis")}<div class="grow"><div class="t1">${esc(ev.name)}</div><div class="t2 wrap">${esc(st.join(" · ") || `${t(ev.start) <= now ? "Under way" : `From ${shortDate(ev.start)}`} · ${ev.venue || ""}`)}</div></div>${chev}</a>`);
  }
  const C = val("crease");
  for (const S of [C?.main, ...(C?.also || [])].filter(Boolean)) {
    const sc = (S.formats || []).map(f => (f.score ? `${f.label} ${f.score}` : null)).filter(Boolean).join(" · ");
    tours.push(`<a class="row" href="#cricket">${tile("cricket")}<div class="grow"><div class="t1">${esc(S.name.replace(/,? \d{4}$/, ""))}</div><div class="t2 wrap">${esc(sc || `${shortDate(S.first)} to ${shortDate(S.last)}`)}</div></div>${chev}</a>`);
  }
  const ST = val("f1_standings");
  if (ST?.drivers?.length) {
    const me = ST.drivers.find(d => same(d.name, favDriver())), lead = ST.drivers[0];
    tours.push(`<a class="row" href="#f1/standings">${tile("f1")}<div class="grow"><div class="t1">Drivers' championship</div><div class="t2 wrap">${esc(last(lead.shown || lead.name))} leads on ${lead.points}${me && me !== lead ? ` · ${esc(last(favDriver()))} ${ordinal(me.pos)}, ${lead.points - me.points} behind` : ""}</div></div>${chev}</a>`);
  }
  const TB = (val("club_stats")?.comps || []).find(c => c.key === "liga")?.rows?.find(r => same(r.team, club()));
  if (TB) tours.push(`<a class="row" href="#football/table">${tile("football")}<div class="grow"><div class="t1">La Liga</div><div class="t2 wrap">Madrid ${ordinal(TB.rank)}, ${TB.points} points from ${TB.played}</div></div>${chev}</a>`);
  const today = fmt(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" });
  const ready = Object.keys(D).length > 0;
  return `<div class="page">${header("Today", `<b>${esc(today)}</b>${lastLoad ? `<span>Updated ${hm(new Date(lastLoad).toISOString())}</span>` : ""}`)}
    ${ready ? weekStrip(E) : ""}
    ${!ready ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${live.length ? blk("Live now", live.map(e => nextCard(e)).join("")) : ""}
    ${hero ? blk("Up next", nextCard(hero) + (rows || later.length ? `<div class="list" style="margin-top:12px">${rows}${later.length ? moreBox(`<span class="later">Later · ${esc(later.map(e => e.who).join(", "))}</span>`, later.map(e => `<a class="row" href="${e.href}">${tile(e.sp)}<div class="grow"><div class="t1">${esc(e.title)}</div><div class="t2">${esc(when(e.start))}${e.comp ? ` · ${esc(e.comp)}` : ""}</div></div><div class="end"><div class="t2">${countdown(e.start)}</div></div></a>`).join("")) : ""}</div>` : "")) : ""}
    ${results ? blk("Latest results", `<div class="shelf">${results}</div>`) : ""}
    ${tours.length ? blk("Tournaments and tables", `<div class="list">${tours.join("")}</div>`) : ""}
    ${ready ? sources("football", "madrid_hub", "intl_hub", "crease", "f1_next", "f1_sessions", "tennis_players", "nba", "odds") : ""}</div>`;
}

// ------------------------------------------------------------------ Madrid
// The XI on a pitch: lines by position depth, left to right by side; the formation string checks the line sizes
function pitch(xi) {
  const depth = p => { const s = String(p.pos || "").toUpperCase(); if (s === "G" || s === "GK") return 0; if (/^(CD|CB|SW|LB|RB|LWB|RWB|D)/.test(s)) return 1; if (/^(DM|CM|LM|RM|M)/.test(s)) return 2; if (/^(AM|LW|RW)/.test(s)) return 3; return 4; };
  // Five lanes, so a full-back sits outside his centre-back: LB 0, CD-L 1, centre 2, CD-R 3, RB 4
  const side = p => { const s = String(p.pos || "").toUpperCase(); return /^(LB|LWB|LW|LM)$/.test(s) ? 0 : /-L$/.test(s) ? 1 : /^(RB|RWB|RW|RM)$/.test(s) ? 4 : /-R$/.test(s) ? 3 : 2; };
  let lines = [0, 1, 2, 3, 4].map(d => xi.players.filter(p => depth(p) === d)).filter(l => l.length);
  const want = String(xi.formation || "").split("-").map(Number).filter(Boolean);
  if (want.length && want.reduce((a, b) => a + b, 0) === 10 && (lines.length - 1 !== want.length || lines.slice(1).some((l, i) => l.length !== want[i]))) {
    const out = xi.players.filter(p => depth(p) !== 0).sort((a, b) => depth(a) - depth(b) || side(a) - side(b)); lines = [xi.players.filter(p => depth(p) === 0)];
    let i = 0; for (const n of want) { lines.push(out.slice(i, i + n)); i += n; }
  }
  const L = lines.length, dots = lines.map((l, li) => {
    const y = 91 - (li / Math.max(L - 1, 1)) * 79;
    const sorted = [...l].sort((a, b) => side(a) - side(b));
    return sorted.map((p, i) => `<div class="pl${li === 0 ? " gk" : ""}" style="left:${((i + 1) / (sorted.length + 1)) * 100}%;top:${y}%"><b class="tnum">${esc(p.shirt || "")}</b>${(nm => `<span${nm.length > 10 ? ' class="lg"' : ""}>${esc(nm)}</span>`)(String(p.short || p.name).replace(/^[A-Z]\. /, "").replace(/ Júnior$/, " Jr."))}</div>`).join("");
  }).join("");
  return `<div class="pitch" role="img" aria-label="${esc(xi.formation || "")}: ${esc(xi.players.map(p => p.name).join(", "))}"><svg class="lines" viewBox="0 0 68 80" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="64" height="76" rx="1"/><path d="M2 40h64"/><circle cx="34" cy="40" r="7"/><rect x="18" y="66" width="32" height="12"/><rect x="26" y="73" width="16" height="5"/><rect x="18" y="2" width="32" height="12"/><rect x="26" y="2" width="16" height="5"/></svg>${dots}</div>`;
}
const ZONE = { "knockout phase playoffs": "#8fd3a8", "round of 16|top 8|automatic": "#1f8a4c", "champions league": "#1f8a4c", "europa league": "#f0a04b", "conference": "#4b8fe0", "relegation": "#d1342f", "eliminated": "#b0b0b8" };
const UI = { day: null, table: "liga", leaders: "goals", f1table: "drivers", f1mkt: "race" }; // segmented controls, per visit
const formSquares = (rs, label) => `<span class="form" role="img" aria-label="${esc(label || "Form")}, oldest to latest: ${esc(rs.map(r => r.r).join(" "))}">${rs.map(r => `<i class="${esc(r.r)}" title="${esc(r.t || "")}">${esc(r.r)}</i>`).join("")}</span>`;
function viewFootball() {
  const H = val("madrid_hub"), F = val("football"), CS = val("club_stats"), cname = club(), now = Date.now();
  const E = events().filter(e => e.sp === "football");
  const next = E.find(e => e.state === "live") || E.find(e => e.state === "next" && t(e.start) > now - 6e4);
  const liga = (CS?.comps || []).find(c => c.key === "liga"), me = liga?.rows?.find(r => same(r.team, cname));
  const form = (H?.results || []).slice(0, 5).reverse().map(m => ({ r: m.winner === "us" ? "W" : m.winner === "them" ? "L" : "D", t: `${m.home ? "v" : "at"} ${m.opponent} ${m.us}–${m.them}` }));
  const sub = [me ? `<b>${ordinal(me.rank)} in La Liga</b><span>${me.points} pts from ${me.played}</span>` : "", form.length ? formSquares(form, "Madrid form") : ""].join("");
  // The next match's preview: both sides' last five, the last meetings
  let preview = "";
  const PV = H?.preview;
  if (PV && next && next.mid === String(PV.match_id)) {
    const fm = PV.form.map(tm => `<div class="pvf"><div class="pvt">${crest(tm.id, tm.team, "sm")}<b>${esc(tm.team)}</b></div>${formSquares(tm.games.map(g => ({ r: g.result || "D", t: `${g.result === "W" ? "Won" : g.result === "L" ? "Lost" : "Drew"} ${g.score || ""} ${g.at ? "at" : "v"} ${g.opponent}` })), `${tm.team} form`)}</div>`).join("");
    let w = 0, d = 0, l = 0;
    for (const m of PV.meetings) { const us = same(m.home, cname) ? m.hs : same(m.away, cname) ? m.as : null, them = same(m.home, cname) ? m.as : m.hs; if (us == null) continue; if (+us > +them) w++; else if (+us < +them) l++; else d++; }
    const mtRows = PV.meetings.map(m => `<div class="row"><div class="grow"><div class="t1">${esc(CLUB_SHORT(m.home))} <b class="tnum">${esc(m.hs)}–${esc(m.as)}</b> ${esc(CLUB_SHORT(m.away))}</div><div class="t2">${esc(m.competition || "")} · ${esc(fmt(m.date, { day: "numeric", month: "short", year: "numeric" }))}</div></div></div>`), mt = mtRows.join("");
    const opp = PV.form.find(x => !same(x.team, cname))?.team || next.b;
    preview = blk("Form and meetings", `${fm ? `<div class="card pv">${fm}<p class="foot" style="margin:2px 0 0">Each side's last five matches, oldest first.</p></div>` : ""}${mt ? `<div class="sub-h out">Last ${w + d + l} meetings${w + d + l ? ` <span>Madrid ${w}W ${d}D ${l}L v ${esc(opp)}</span>` : ""}</div><div class="list">${mtRows.slice(0, 3).join("")}${mtRows.length > 3 ? moreBox(`${mtRows.length - 3} more`, mtRows.slice(3).join("")) : ""}</div>` : ""}`, "", "preview");
  }
  // The XI: the official one once announced, else the expected one (the last starting XI)
  let xi = "";
  const X = H?.xi;
  if (X?.players?.length === 11) {
    const official = X.kind === "official";
    xi = blk(official ? "Starting XI" : "Last starting XI", `<div class="card">${pitch(X)}<p class="foot">${official ? `${esc(X.formation || "")} · official XI v ${esc(X.opponent)}, from ESPN's line-up` : `${esc(X.formation || "")} · the XI that started v ${esc(X.opponent)} on ${esc(shortDate(X.date))}. The official XI replaces it here about an hour before kick-off.`}</p>${X.bench?.length ? moreBox(official ? "Bench" : "Rest of that squad", `<p class="foot" style="padding:4px 18px 12px">${esc(X.bench.slice(0, 14).join(", "))}</p>`) : ""}</div>`, official ? `<span class="chip ok">Official</span>` : `<span class="note">Official XI not yet announced</span>`, "xi");
  }
  // Results and fixtures
  const resRows = (H?.results || []).map(m => {
    const r = m.winner === "us" ? "W" : m.winner === "them" ? "L" : "D", sc = `${m.us}–${m.them}`;
    return `<div class="row">${crest(m.opponent_id, m.opponent, "sm")}<div class="grow"><div class="t1">${m.home ? "v" : "at"} ${esc(m.opponent)}</div><div class="t2">${esc(m.competition || "")} · ${esc(shortDate(m.date))}</div></div><span class="score ${r} tnum" aria-label="${r === "W" ? "Won" : r === "L" ? "Lost" : "Drew"} ${esc(sc)}">${esc(sc)}</span></div>`;
  });
  const fxRows = (H?.fixtures || []).map(m => {
    const sides = m.home ? [cname, m.opponent] : [m.opponent, cname], p = sideProbs(oddsFor("football", sides, m.date), sides), mine = p ? (m.home ? p.a : p.b) : null;
    return `<div class="row">${crest(m.opponent_id, m.opponent, "sm")}<div class="grow"><div class="t1">${m.home ? "v" : "at"} ${esc(m.opponent)}</div><div class="t2">${esc(when(m.date))} · ${esc(m.competition || "")}</div></div>${mine != null ? `<div class="end"><div class="pc tnum">${mine}%</div><div class="t2">to win</div></div>` : ""}</div>`;
  });
  const list = (rows, n, what) => (rows.length ? `<div class="list">${rows.slice(0, n).join("")}${rows.length > n ? moreBox(`${rows.length - n} more ${what}`, rows.slice(n).join("")) : ""}</div>` : "");
  // Tables
  const comps = (CS?.comps || []).filter(c => c.rows?.length);
  const cur = comps.find(c => c.key === UI.table) || comps[0];
  let table = "", leaders = "";
  if (cur) {
    const rows = cur.rows, mi = rows.findIndex(r => same(r.team, cname));
    const tr = r => `<tr class="${same(r.team, cname) ? "me" : ""}"><td class="pos tnum" style="--zone:${esc(r.zone ? (zones.find(([n]) => n === r.zone.name)?.[1] || "transparent") : "transparent")}">${r.rank}</td><td class="team l"><div>${crest(r.id, r.team, "xs")}<span>${esc(r.short || r.team)}</span></div></td><td class="tnum">${r.played}</td><td class="tnum">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts tnum">${r.points}</td></tr>`;
    const head = `<thead><tr><th class="l" scope="col">#</th><th class="l" scope="col">Team</th><th scope="col">P</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>`;
    const show = rows.length > 12 ? [...new Set([...rows.slice(0, 4), ...rows.slice(Math.max(0, mi - 2), mi + 3)])] : rows;
    const zc = z => ZONE[Object.keys(ZONE).find(k => new RegExp(k, "i").test(z?.name || ""))] || z?.color || "var(--muted)";
    const zones = []; for (const r of rows) if (r.zone?.name && !zones.some(([n]) => n === r.zone.name)) zones.push([r.zone.name, zc(r.zone)]);
    const seg = comps.length > 1 ? `<div class="seg" role="group" aria-label="Competition">${comps.map(c => `<button type="button" data-ui="table" data-v="${esc(c.key)}" aria-pressed="${c === cur}">${esc(c.label)}</button>`).join("")}</div>` : "";
    table = blk("Table", `${seg}<div class="list sp-football"><table class="tbl">${head}<tbody>${show.map((r, i) => (i && r.rank - show[i - 1].rank > 1 ? `<tr class="gap"><td colspan="5">···</td></tr>` : "") + tr(r)).join("")}</tbody></table>${show.length < rows.length ? moreBox("Full table", `<table class="tbl">${head}<tbody>${rows.map(tr).join("")}</tbody></table>`) : ""}${zones.length ? `<div class="legend">${zones.map(([n, c]) => `<span><i style="background:${esc(c)}"></i>${esc(n)}</span>`).join("")}</div>` : ""}</div>`, "", "table");
    const kinds = [["goals", "Goals"], ["assists", "Assists"], ["ratings", "Rating"]].filter(([k]) => cur[k]?.length);
    const lk = kinds.find(([k]) => k === UI.leaders)?.[0] || kinds[0]?.[0];
    if (lk) {
      const L = cur[lk].slice(0, 8), top = Math.max(...L.map(x => x.value));
      leaders = blk(`Leaders`, `<div class="seg" role="group" aria-label="Leader board">${kinds.map(([k, n]) => `<button type="button" data-ui="leaders" data-v="${k}" aria-pressed="${k === lk}">${n}</button>`).join("")}</div><div class="list sp-football">${(rows => rows.slice(0, 5).join("") + (rows.length > 5 ? moreBox(`${rows.length - 5} more`, rows.slice(5).join("")) : ""))(L.map(x => barRow(x.name, x.value, top, { me: same(x.team, cname), sub: x.team, pos: x.rank, label: lk === "ratings" ? Number(x.value).toFixed(2) : x.value })))}</div>`, "", "leaders");
    }
  }
  // The national sides: each one's next match, and its last result
  const NT = val("intl_hub")?.teams || [];
  const nations = NT.length ? blk("National teams", `<div class="list">${NT.map(T => {
    const n = T.next.find(m => t(m.date) > Date.now()), l = T.last;
    const opp = m => (same(m.home, T.name) ? { name: m.away, id: m.away_id } : { name: m.home, id: m.home_id });
    const o = n ? opp(n) : null, lr = l ? (+(same(l.home, T.name) ? l.hs : l.as) > +(same(l.home, T.name) ? l.as : l.hs) ? "W" : +(same(l.home, T.name) ? l.hs : l.as) < +(same(l.home, T.name) ? l.as : l.hs) ? "L" : "D") : null;
    const ls = l ? (same(l.home, T.name) ? `${l.hs}–${l.as}` : `${l.as}–${l.hs}`) : "";
    const away = n && !same(n.home, T.name);
    return `<details class="row-d"><summary class="row">${crest(T.id, T.name, "sm")}<div class="grow"><div class="t1">${esc(T.name)}</div><div class="t2">Next ${n ? `${away ? "at" : "v"} ${esc(o.name)} · ${esc(shortDate(n.date))}` : "not listed"}</div></div>${l ? `<div class="end"><span class="score ${lr} tnum" aria-label="Last result">${lr} ${esc(ls)}</span><div class="t2">last, v ${esc(initials(same(l.home, T.name) ? l.away : l.home))}</div></div>` : ""}<svg class="chev dn" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></summary><div class="nt"><div class="grow">
      <div class="nl"><span class="k">Next</span>${n ? `<span>${away ? "at" : "v"} ${esc(o.name)} · ${esc(when(n.date))}<small>${esc([n.competition, n.venue].filter(Boolean).join(" · "))}</small></span>` : "<span>No fixture listed</span>"}</div>
      ${T.next[1] ? `<div class="nl"><span class="k">Then</span><span>${same(T.next[1].home, T.name) ? "v" : "at"} ${esc(same(T.next[1].home, T.name) ? T.next[1].away : T.next[1].home)} · ${esc(when(T.next[1].date))}<small>${esc(T.next[1].competition || "")}</small></span></div>` : ""}
      ${l ? `<div class="nl"><span class="k">Last</span><span><b class="score ${lr} tnum">${lr} ${esc(ls)}</b> v ${esc(same(l.home, T.name) ? l.away : l.home)}<small>${esc(shortDate(l.date))}</small></span></div>` : ""}</div></div></details>`;
  }).join("")}</div>`, "", "nations") : "";
  return `<div class="page">${header(`<span class="ttl">${crest(H?.club_id || "86", cname, "sm")}${esc(cname)}</span>`, sub, ["football", "madrid_hub", "club_stats"])}
    ${jump([[next && "next", "Next"], [H?.xi && "xi", "XI"], [resRows.length && "results", "Results"], [cur && "table", "Table"], [cur && "leaders", "Leaders"], [NT.length && "nations", "Nations"]])}
    ${!H && !F ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${next ? blk(next.state === "live" ? "Live" : "Next match", nextCard(next), "", "next") : ""}
    ${preview}${xi}
    ${blk("Results", list(resRows, 5, "results"), "", "results")}
    ${blk("Fixtures", list(fxRows, 4, "fixtures"), "", "fixtures")}
    ${table}${leaders}${nations}
    ${sources("football", "madrid_hub", "club_stats", "intl_hub", "odds")}</div>`;
}

// ------------------------------------------------------------------ F1
const fposCls = r => (!r ? "none" : !r.finished ? "out" : r.pos === 1 ? "p1" : r.pos === 2 ? "p2" : r.pos === 3 ? "p3" : "");
const CLASS = { R: "DNF", D: "DSQ", E: "EXC", W: "WD", F: "DNQ", N: "NC" };
const fpos = (r, title = "") => `<span class="fpos ${fposCls(r)} tnum" title="${esc(title || r?.race || "")}">${!r ? "·" : r.finished ? r.pos : esc(CLASS[r.text] || r.text || "DNF")}</span>`;
const CC = { Netherlands: "NED", Italy: "ITA", Spain: "ESP", Azerbaijan: "AZE", Malaysia: "MAS", Singapore: "SIN", USA: "USA", "United States": "USA", Mexico: "MEX", Brazil: "BRA", UK: "GBR", "United Kingdom": "GBR", Belgium: "BEL", Hungary: "HUN", Austria: "AUT", Canada: "CAN", Monaco: "MON", Japan: "JPN", China: "CHN", Bahrain: "BHR", "Saudi Arabia": "KSA", Australia: "AUS", Qatar: "QAT", UAE: "UAE", "United Arab Emirates": "UAE", Portugal: "POR", France: "FRA", Germany: "GER", Argentina: "ARG", Thailand: "THA", "South Africa": "RSA", Korea: "KOR" };
const raceCode = r => CC[r.country] || String(r.country || r.name).slice(0, 3).toUpperCase();
function viewF1() {
  const N = val("f1_next"), R = N?.race, S = val("f1_standings"), HB = val("f1_hub"), MK = val("f1_market"), SR = val("f1_sessions")?.results || [], LR = val("f1_last"), fav = favDriver(), now = Date.now();
  const drivers = S?.drivers || [], me = drivers.find(d => same(d.name, fav)), lead = drivers[0];
  const nameOf = n => { const d = drivers.find(x => same(x.name, n) || same(x.shown, n)); return d ? last(d.shown || d.name) : last(n); };
  // The weekend
  let weekend = "", nx = null, sess = [];
  if (R) {
    sess = (R.sessions || []).map(s => { const st = t(s.start), end = st + (s.minutes || 60) * 6e4; return { ...s, state: now >= end ? "done" : now >= st ? "now" : "later", res: SR.find(r => Math.abs(t(r.start) - st) < 45 * 6e4) }; });
    nx = sess.find(s => s.state !== "done");
    const rows = sess.map(s => {
      const m = s.state !== "done" ? sessionMarket(s.name, s.start) : null, top = m && [...m.outcomes].sort((a, b) => b.prob - a.prob)[0];
      const line = s.res ? s.res.top.map((n, i) => `${i + 1} ${nameOf(n)}`).join("  ·  ") : top ? `${Math.round(top.prob)}% ${nameOf(top.name)}, the favourite` : s.state === "done" ? "" : esc(dayLabel(s.start));
      return `<div class="row ${s.state}${s === nx ? " is-next" : ""}"><span class="dot"></span><div class="grow"><div class="t1">${esc(s.name)}</div>${line ? `<div class="t2">${esc(line)}</div>` : ""}</div><div class="end">${s.state === "now" ? `<span class="chip live"><i></i>On now</span>` : s.state === "done" ? `<span class="t2">${esc(dayLabel(s.start))}</span>` : `<div class="t1 tnum">${hm(s.start)}</div><div class="t2">${s === nx ? countdown(s.start) : esc(dayLabel(s.start))}</div>`}</div></div>`;
    }).join("");
    weekend = blk("This weekend", `<div class="card sp-f1 wk"><div class="wk-h"><div><div class="wk-t">${R.flag ? `<span class="fl">${esc(R.flag)}</span> ` : ""}${esc(gpName(R.name))}</div><div class="src">${esc(R.circuit || "")}${R.locality ? `, ${esc(R.locality)}` : ""} · Round ${R.round}</div></div>${R.track?.image ? `<img class="track" src="${esc(R.track.image)}" alt="${esc(R.circuit || "")} layout" loading="lazy">` : ""}</div></div><div class="list sess sp-f1" style="margin-top:12px">${rows}</div>`, nx ? `<span class="note">${esc(nx.name)} ${countdown(nx.start)}</span>` : "", "weekend");
  }
  // Max Watch: the championship, the markets for each session still to come, his form, his record here
  let watch = "";
  if (me || HB) {
    const form = HB?.form?.drivers?.find(d => same(d.name, fav))?.results || [];
    const here = [...(HB?.favourite_here || [])].sort((a, b) => a.season - b.season), best = here.filter(r => r.pos).sort((a, b) => a.pos - b.pos)[0];
    const label = follows().f1_driver?.label || `${last(fav)} watch`;
    const SHORT = { "Sprint Qualifying": "Sprint quali", "Sprint Shootout": "Shootout", Qualifying: "Quali" };
    const wk = sess.filter(s => f1Kind(s.name)).map(s => {
      let v = "";
      if (s.res) { const i = s.res.top.findIndex(n => same(n, last(fav))); v = i >= 0 ? fpos({ pos: i + 1, finished: true }) : `<span class="dim">Not top 3</span>`; }
      else if (s.state !== "done") { const m = sessionMarket(s.name, s.start), o = m?.outcomes.find(x => same(x.name, fav)); v = o ? `<b class="pct tnum">${Math.round(o.prob)}%</b>` : `<span class="dim">·</span>`; }
      return `<div class="step${s.res ? " got" : ""}"><span>${esc(SHORT[s.name] || s.name)}</span>${v}</div>`;
    }).join("");
    watch = blk(esc(label), `<div class="card sp-f1"><div class="who"><i style="background:${esc(me?.colour || "var(--line)")}"></i><div><div class="who-n">${esc(fav)}</div><div class="src">${esc(me?.team || "")}${me ? ` · ${me.wins} win${me.wins === 1 ? "" : "s"} this season` : ""}</div></div></div>
      ${me ? `<div class="stats"><div class="stat"><b class="tnum">${ordinal(me.pos)}</b><span>In the championship</span></div><div class="stat"><b class="tnum">${me.points}</b><span>Points</span></div><div class="stat"><b class="tnum">${me === lead ? "Lead" : `${lead.points - me.points}`}</b><span>${me === lead ? "Top of the table" : `Behind ${esc(last(lead.shown || lead.name))}`}</span></div></div>` : ""}
      ${wk ? `<div class="sub-h">This weekend <span>where he finished, then his chance</span></div><div class="steps">${wk}</div>` : ""}
      ${here.length ? `<div class="sub-h">At ${esc(HB.race?.circuit || "this track")}${best ? ` <span>best ${ordinal(best.pos)}, in ${esc(here.filter(r => r.pos === best.pos).map(r => r.season).join(", "))}</span>` : ""}</div><div class="fgrid yrs">${here.map(r => `<span class="yr">${fpos({ pos: r.pos, finished: /^\d+$/.test(r.text), text: r.text }, `${r.season}: from ${ordinal(r.grid || 0)} on the grid, ${r.status}`)}<small class="tnum">'${String(r.season).slice(2)}</small></span>`).join("")}</div>` : ""}</div>`, "", "max");
  }
  // Expectations: each session's winner market, the race first
  const segs = [["race", "Race"], ["qualifying", "Qualifying"], ["sprint", "Sprint"], ["sprint_qualifying", "Sprint quali"]].map(([k, n]) => {
    if (k === "race") { const m = raceMarket(); return m ? { k, n, m, other: (MK?.markets || []).find(x => x !== m) } : null; }
    const s = sess.find(x => f1Kind(x.name) === k && x.state !== "done"); const m = s && oddsFor("f1", null, s.start, k); return m ? { k, n, m } : null;
  }).filter(Boolean);
  const cur = segs.find(x => x.k === UI.f1mkt) || segs[0];
  const expect = cur ? blk("What the markets expect", `${segs.length > 1 ? `<div class="seg" role="group" aria-label="Session">${segs.map(x => `<button type="button" data-ui="f1mkt" data-v="${x.k}" aria-pressed="${x === cur}">${x.n}</button>`).join("")}</div>` : ""}<div class="card sp-f1">${rankList(cur.m.outcomes, "f1", { mark: fav, nameFn: n => drivers.find(d => same(d.name, n))?.shown || n })}<p class="foot">${esc(cur.m.title || `${cur.n} winner`)} · <a href="${esc(cur.m.url)}" target="_blank" rel="noopener">${esc(cur.m.source)}</a>${cur.other?.outcomes?.[0] ? ` · ${esc(cur.other.source)} has ${esc(nameOf(cur.other.outcomes[0].name))} ${Math.round(cur.other.outcomes[0].prob)}%` : ""}.</p></div>`, "", "markets") : "";
  // This track over the years
  let track = "";
  if (HB?.winners?.length) {
    const W = HB.winners, fromPole = W.filter(w => w.grid === 1).length, top = HB.tally.slice(0, 5), mx = top[0]?.wins || 1;
    const rows = W.map(w => `<div class="row"><span class="yr tnum">${esc(w.season)}</span><div class="grow"><div class="t1">${esc(w.driver)}</div><div class="t2">${esc(w.team || "")}${w.grid ? ` · from ${ordinal(w.grid)} on the grid` : ""}</div></div></div>`);
    track = blk(`${esc(HB.race?.circuit || "This track")}`, `<div class="stats tiles"><div class="stat"><b class="tnum">${W.length}</b><span>Races held</span></div><div class="stat"><b class="tnum">${fromPole}</b><span>Won from pole</span></div><div class="stat"><b class="tnum">${new Set(W.map(w => w.driver)).size}</b><span>Different winners</span></div></div>
      <div class="sub-h out">Most wins here</div><div class="list sp-f1">${top.map(x => barRow(x.driver, x.wins, mx, { me: same(x.driver, fav) })).join("")}</div>
      <div class="sub-h out">Winners, latest first</div><div class="list hist">${rows.slice(0, 3).join("")}${rows.length > 3 ? moreBox(`All ${rows.length} winners`, rows.slice(3).join("")) : ""}</div>`, "", "track");
  }
  // Form: the top ten (and Verstappen) in each of the last five races, aligned by race
  let form = "";
  if (HB?.form?.drivers?.length && drivers.length) {
    const rounds = HB.form.rounds;
    const pick = drivers.slice(0, 6);
    if (me && !pick.includes(me)) pick.push(me);
    const rowsF = pick.map(d => ({ d, f: HB.form.drivers.find(x => x.code === d.code || same(x.name, d.name)) })).filter(x => x.f);
    form = blk("Form", `<div class="list formt"><div class="row hd"><span class="ps"></span><div class="grow"></div><div class="fgrid">${rounds.map(r => `<span class="fpos none rh" title="${esc(r.name)}">${esc(raceCode(r))}</span>`).join("")}</div></div>${rowsF.map(({ d, f }) => `<div class="row${d === me ? " me" : ""}"><span class="ps tnum">${d.pos}</span><i class="tstripe" style="background:${esc(d.colour || "var(--line)")}"></i><div class="grow"><div class="t1">${esc(last(d.shown || d.name))}</div></div><div class="fgrid">${rounds.map(r => fpos(f.results.find(x => x.round === r.round))).join("")}</div></div>`).join("")}</div><p class="foot">Finishing position in each race, oldest to latest: ${esc(rounds.map(r => `${raceCode(r)} ${r.name.replace(/ Grand Prix/, " GP")}`).join(", "))}. DNF: did not finish. A dot: not in the race.</p>`, "", "form");
  }
  // Standings
  let table = "";
  if (drivers.length) {
    const isD = UI.f1table !== "constructors", L = isD ? drivers : S.constructors || [], mx = L[0]?.points || 1;
    const rowOf = x => barRow(isD ? x.shown || x.name : x.name, x.points, mx, { me: isD && same(x.name, fav), pos: x.pos, colour: x.colour || "" });
    table = blk("Standings", `<div class="seg" role="group" aria-label="Standings">${[["drivers", "Drivers"], ["constructors", "Teams"]].map(([k, n]) => `<button type="button" data-ui="f1table" data-v="${k}" aria-pressed="${(k === "drivers") === isD}">${n}</button>`).join("")}</div><div class="list">${(() => { const head = L.slice(0, 6), mine = isD && me && !head.includes(me) ? [me] : [], rest = L.filter(x => !head.includes(x) && !mine.includes(x)); return head.map(rowOf).join("") + mine.map(rowOf).join("") + (rest.length ? moreBox(`The other ${rest.length}`, rest.map(rowOf).join("")) : ""); })()}</div><p class="foot">After round ${S.round}${S.prior ? ` of ${esc(S.season)} (final)` : ""}.</p>`, "", "standings");
  }
  // Last race
  let lastRace = "";
  if (LR?.results?.length) {
    const rr = LR.results.map(r => `<div class="row"><span class="fpos ${r.pos <= 3 ? "p" + r.pos : ""} tnum">${r.pos}</span><i class="tstripe" style="background:${esc(r.colour || "var(--line)")}"></i><div class="grow"><div class="t1">${esc(r.shown || r.name)}</div><div class="t2">${esc(r.team || "")}</div></div><div class="end t2 tnum">${esc(r.time || r.status || "")}</div></div>`);
    lastRace = blk(`Last race`, `<div class="list"><div class="row hdr"><div class="grow"><div class="t1">${LR.flag ? `${esc(LR.flag)} ` : ""}${esc(gpName(LR.name))}</div><div class="t2">${esc(shortDate(LR.date))}</div></div></div>${rr.slice(0, 3).join("")}${moreBox("Full result", rr.slice(3).join(""))}</div>`, "", "last");
  }
  const cal = (N?.upcoming || []).map(u => `<div class="row"><span class="fl lg">${esc(u.flag || "")}</span><div class="grow"><div class="t1">${esc(gpName(u.name))}</div><div class="t2">Round ${u.round} · ${esc(shortDate(u.date))}</div></div></div>`).join("");
  return `<div class="page">${header("Formula 1", R ? `<b>Round ${R.round}</b><span>${esc(gpName(R.name))}</span>` : "", ["f1_next", "f1_standings", "f1_hub"])}
    ${jump([[R && "weekend", "Weekend"], [watch && "max", last(fav)], [expect && "markets", "Markets"], [track && "track", "Track"], [form && "form", "Form"], [table && "standings", "Standings"], [cal && "calendar", "Calendar"]])}
    ${!R && !S ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${weekend}${watch}${expect}${track}${form}${table}${lastRace}
    ${cal ? blk("Coming up", `<div class="list">${cal}</div>`, "", "calendar") : ""}
    ${sources("f1_next", "f1_sessions", "f1_standings", "f1_hub", "f1_market", "odds", "f1_last")}</div>`;
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
  const done = E.filter(e => e.state === "done").slice(-1)[0];
  const seriesBlock = S => blk(esc(S.name.replace(/,? \d{4}$/, "")), (S.formats || []).map(f => {
    const rows = (f.matches || []).map(m => {
      const st = m.state === "done" ? (m.won === true ? "W" : m.won === false ? "L" : "D") : null;
      return `<div class="row"><div class="grow"><div class="t1 wrap">${esc(m.desc)} <span class="dim">${esc(m.city || "")}</span></div><div class="t2 wrap">${m.state === "done" ? `${esc(shortDate(m.start))}${m.score ? ` · ${String(m.score).split(" · ").map(x => `<span class="inn">${esc(x)}</span>`).join(" · ")}` : ""}` : esc(m.time_announced === false ? `${shortDate(m.start)}, time TBC` : when(m.start))}</div></div><div class="end">${m.state === "done" ? `<span class="score txt ${st}">${esc(resultWord(m))}</span>` : m.state === "live" ? `<span class="chip live"><i></i>Live</span>` : m.state === "off" ? `<span class="chip done">${esc(m.status || "No result")}</span>` : `<span class="t2">${countdown(m.start)}</span>`}</div></div>`;
    }).join("");
    return `<div class="sub-h out">${esc(f.label || f.format)}${f.score ? ` <span class="chip sp sp-cricket">${esc(f.score)}</span>` : ""}</div><div class="list">${rows}</div>`;
  }).join(""), `<span class="note">${esc(shortDate(S.first))} to ${esc(shortDate(S.last))}</span>`, "series");
  const series = [C?.main, ...(C?.also || [])].filter(Boolean).map(seriesBlock).join("");
  const A = C?.after;
  const after = A?.formats ? blk(`Next: ${esc(A.name.replace(/,? \d{4}$/, ""))}`, `<div class="list">${A.formats.map(f => { const ms = f.matches || []; return `<details class="row-d"><summary class="row"><div class="grow"><div class="t1">${ms.length} ${esc(f.label || f.format)}</div><div class="t2">${ms[0] ? `${esc(shortDate(ms[0].start))} to ${esc(shortDate(ms.at(-1).start))} · ${esc([...new Set(ms.map(m => m.city).filter(Boolean))].slice(0, 3).join(", "))}` : ""}</div></div><svg class="chev dn" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></summary>${ms.map(m => `<div class="row sub"><div class="grow"><div class="t1">${esc(m.desc)} <span class="dim">${esc(m.city || "")}</span></div><div class="t2">${esc(m.time_announced === false ? `${shortDate(m.start)}, time TBC` : when(m.start))}</div></div></div>`).join("")}</details>`; }).join("")}</div>`, `<span class="note">From ${esc(shortDate(A.first))}</span>`, "after") : "";
  return `<div class="page">${header("India", C?.main ? `<b>${esc(C.main.name.replace(/,? \d{4}$/, ""))}</b>` : "", ["crease"])}
    ${!C ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${next ? blk(live ? "Live" : "Next match", nextCard(next)) : ""}
    ${done ? blk("Last result", resultCard(done)) : ""}
    ${series}${after}
    ${sources("crease", "odds")}</div>`;
}

// ------------------------------------------------------------------ Tennis
function viewTennis() {
  const TP = val("tennis_players")?.players || [], EV = val("tennis")?.events || [], now = Date.now();
  const cards = TP.map(p => {
    const nx = p.next, ls = p.last;
    const p2 = nx ? sideProbs(oddsFor("tennis", [p.name, nx.opponent], nx.when_utc), [p.name, nx.opponent]) : null;
    const lastE = ls ? events().find(e => e.sp === "tennis" && e.state === "done" && e.player === p.name) : null;
    const status = nx ? `${nx.event} · ${nx.round || ""}` : ls ? `${ls.event} · ${ls.won ? "won" : "out in"} ${ls.round || ""}` : "No match listed";
    const rk = atp(p.name);
    return `<section class="blk"><div class="who-h">${player(p.name, "md")}<div><h2>${esc(p.name)}</h2><div class="note">${rk ? `<b class="tnum">${esc(rankTxt(p.name))}</b> · ${rk.points?.toLocaleString("en-IN")} pts · ` : ""}${esc(status)}</div></div></div>
      ${nx ? `<div class="card next sp-tennis"><div class="when">${chip("tennis", nx.round || "Next")}${nx.live ? `<span class="chip live"><i></i>Live</span>` : `<span class="count">${countdown(nx.when_utc)}</span>`}</div><div class="vs"><div class="side">${player(p.name)}<b>${esc(last(p.name))}</b>${rankTxt(p.name) ? `<small class="rk">${esc(rankTxt(p.name))}</small>` : ""}</div><div class="mid time tnum">${hm(nx.when_utc)}<small>${esc(dayLabel(nx.when_utc))}</small></div><div class="side">${player(nx.opponent)}<b>${esc(last(nx.opponent) || "TBC")}</b>${rankTxt(nx.opponent) ? `<small class="rk">${esc(rankTxt(nx.opponent))}</small>` : ""}</div></div><div class="meta">${esc([nx.event, nx.court].filter(Boolean).join(" · "))}${nx.held ? `<br>${esc(nx.held)}` : ""}${p.agree === false && p.backup ? `<br>Another listing has ${esc(hm(p.backup.when_utc))}` : ""}</div>${p2 ? mktBar(p2, [last(p.name), last(nx.opponent)], "tennis") : ""}</div>` : ""}
      ${lastE ? `<div style="margin-top:12px">${resultCard(lastE)}</div>` : ""}</section>`;
  }).join("");
  const inEv = ev => TP.some(p => (p.next && same(p.next.event, ev.name)) || (p.last && same(p.last.event, ev.name)));
  const tours = EV.filter(ev => t(ev.end) > now - 864e5 && (inEv(ev) || ev.major)).map(ev => {
    const going = t(ev.start) <= now;
    const who = TP.map(p => { const inN = p.next && same(p.next.event, ev.name), inL = p.last && same(p.last.event, ev.name); return inN || inL ? `<span class="chip ${inN || p.last.won ? "sp sp-tennis" : "done"}">${esc(last(p.name))} · ${inN ? "still in" : p.last.won ? "through" : "out"}</span>` : ""; }).join(" ");
    return `<div class="row"><div class="grow"><div class="t1">${esc(ev.name)}${ev.major ? " · Grand Slam" : ""}</div><div class="t2">${esc(ev.venue || "")} · ${going ? "until" : "from"} ${esc(shortDate(going ? ev.end : ev.start))}</div>${who ? `<div class="chips">${who}</div>` : `<div class="t2">Neither player has a match listed</div>`}</div>${going ? `<span class="chip done">Under way</span>` : ""}</div>`;
  }).join("");
  const RK = val("tennis_hub")?.ranks || [], mine = (follows().tennis_players || []).map(atp).filter(Boolean);
  const top = RK.slice(0, 10); for (const m of mine) if (!top.includes(m)) top.push(m);
  const rankings = top.length ? blk("ATP rankings", `<div class="list">${top.map(r => { const mv = r.previous ? r.previous - r.rank : 0, me = mine.includes(r); return `<div class="row${me ? " me" : ""}"><span class="rkn tnum">${r.rank}</span>${player(r.name, "sm")}<div class="grow"><div class="t1">${esc(r.name)}</div><div class="t2 tnum">${r.points ? `${r.points.toLocaleString("en-IN")} points` : ""}</div></div><span class="mv ${mv > 0 ? "up" : mv < 0 ? "dn" : ""} tnum">${mv > 0 ? `▲ ${mv}` : mv < 0 ? `▼ ${-mv}` : "·"}</span></div>`; }).join("")}</div><p class="foot">Movement since the previous list.</p>`, "", "rankings") : "";
  return `<div class="page">${header("Tennis", `<b>${esc((follows().tennis_players || []).join(" and "))}</b>`, ["tennis_players", "tennis"])}
    ${!TP.length ? `<div class="skel"></div><div class="skel"></div>` : ""}
    ${cards}
    ${tours ? blk("Tournaments", `<div class="list">${tours}</div>`) : ""}
    ${rankings}
    ${sources("tennis_players", "tennis", "tennis_hub", "odds")}</div>`;
}

// ------------------------------------------------------------------ Warriors
function viewNba() {
  const B = val("nba"), E = events().filter(e => e.sp === "nba"), now = Date.now();
  const next = E.find(e => e.state === "live") || E.find(e => e.state === "next" && t(e.start) > now - 6e4), done = E.filter(e => e.state === "done").slice(-1)[0];
  const rows = (B?.next || []).map(g => `<div class="row">${nbaLogo(g.opponent_abbr, g.opponent, "sm")}<div class="grow"><div class="t1">${g.home ? "v" : "at"} ${esc(g.opponent)}</div><div class="t2">${esc(when(g.date))}${g.preseason ? " · Preseason" : ""}</div></div></div>`).join("");
  const W = B?.west ? blk("Western Conference", `<div class="list"><table class="tbl"><thead><tr><th class="l" scope="col">#</th><th class="l" scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">GB</th></tr></thead><tbody>${B.west.map(r => `<tr class="${same(r.team, nbaTeam()) ? "me" : ""}"><td class="pos tnum">${r.rank}</td><td class="team l"><div>${nbaLogo(r.abbr, r.team, "xs")}<span>${esc(r.team)}</span></div></td><td class="tnum">${r.wins}</td><td class="tnum">${r.losses}</td><td class="tnum">${esc(r.gb ?? "")}</td></tr>`).join("")}</tbody></table></div>`) : "";
  return `<div class="page">${header(`<span class="ttl">${nbaLogo(follows().nba_team?.espn_abbr || "gs", nbaTeam(), "sm")}Warriors</span>`, `<b>${B?.in_season ? "Regular season" : "Preseason"}</b>`, ["nba"])}
    ${!B ? `<div class="skel"></div>` : ""}
    ${next ? blk("Next game", nextCard(next)) : ""}
    ${B?.opener ? blk("Opening night", `<div class="list"><div class="row">${nbaLogo(B.opener.opponent_abbr, B.opener.opponent, "sm")}<div class="grow"><div class="t1">${B.opener.home ? "v" : "at"} ${esc(B.opener.opponent)}</div><div class="t2">${esc(when(B.opener.date))} · regular season</div></div><div class="end"><div class="pc tnum">${countdown(B.opener.date).replace("in ", "")}</div></div></div></div>`) : ""}
    ${done ? blk("Last result", resultCard(done)) : ""}
    ${rows ? blk("Schedule", `<div class="list">${rows}</div>`) : ""}
    ${W}
    ${sources("nba", "odds")}</div>`;
}

// ------------------------------------------------------------------ router and shell
const VIEWS = { home: viewHome, football: viewFootball, f1: viewF1, cricket: viewCricket, tennis: viewTennis, nba: viewNba };
const TITLES = { home: "Today", football: "Real Madrid", f1: "Formula 1", cricket: "India", tennis: "Tennis", nba: "Warriors" };
let route = null, io = null, jio = null, jcur = null, onBottom = () => {}, SHEET = "", sheetFor = null;
const parse = () => { const [r, sec] = location.hash.replace(/^#\/?/, "").split("/"); return { r: VIEWS[r] ? r : "home", sec: sec || null }; };
function render(navigated) {
  const { r, sec } = parse(), changed = r !== route; route = r;
  const y = window.scrollY;
  document.body.dataset.tab = r;
  // The Warriors get a tab while they are playing (in season, or a game within ten days)
  const nbaTab = $('.tabs a[data-tab="nba"]'); if (nbaTab) nbaTab.hidden = false;
  $("#tabs").style.setProperty("--n", [...document.querySelectorAll(".tabs a")].filter(a => !a.hidden).length);
  for (const a of document.querySelectorAll(".tabs a")) { if (a.dataset.tab === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
  $("#topTitle").textContent = TITLES[r];
  SHEET = "";
  view.innerHTML = VIEWS[r]();
  // The day sheet sits in its own layer above the app, which goes inert behind it
  const root = $("#sheet-root"), opening = SHEET && !root.innerHTML;
  root.innerHTML = r === "home" ? SHEET : "";
  $("#app").inert = !!root.innerHTML;
  if (opening) { sheetFor = UI.day; requestAnimationFrame(() => $("#sheet-t")?.focus()); dragSheet(root.querySelector(".sheet")); }
  else if (!root.innerHTML && sheetFor) { const b = view.querySelector(`.wd[data-v="${sheetFor}"]`); sheetFor = null; b?.focus(); }
  if (!changed && !navigated) { view.querySelector(".page")?.style.setProperty("animation", "none"); window.scrollTo(0, y); }
  else if (sec && document.getElementById(sec)) requestAnimationFrame(() => document.getElementById(sec).scrollIntoView({ block: "start" }));
  else window.scrollTo(0, 0);
  document.title = `${TITLES[r]} · Sport`;
  io?.disconnect(); jio?.disconnect(); jcur = null;
  const chips = [...document.querySelectorAll(".jump a[data-jump]")];
  if (chips.length && "IntersectionObserver" in window) {
    const seen = new Map();
    jio = new IntersectionObserver(es => {
      for (const en of es) seen.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : null);
      const cur = [...seen].filter(([, y]) => y != null).sort((a, b) => a[1] - b[1])[0]?.[0];
      if (cur === jcur) return; jcur = cur;
      for (const c of chips) { const on = c.dataset.jump === cur; c.toggleAttribute("aria-current", on); if (on) { const bar = c.parentElement; bar.scrollTo({ left: Math.max(0, c.offsetLeft - (bar.clientWidth - c.offsetWidth) / 2), behavior: "smooth" }); } }
    }, { rootMargin: "-110px 0px -55% 0px" });
    for (const c of chips) { const el = document.getElementById(c.dataset.jump); if (el) jio.observe(el); }
    onBottom = () => { if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) { const lastC = chips.at(-1); if (jcur !== lastC.dataset.jump) { jcur = lastC.dataset.jump; for (const c of chips) c.toggleAttribute("aria-current", c === lastC); const bar = lastC.parentElement; bar.scrollTo({ left: bar.scrollWidth, behavior: "smooth" }); } } };
  }
  const h1 = $("#h1");
  if (h1 && "IntersectionObserver" in window) { io = new IntersectionObserver(([en]) => $("#top").classList.toggle("solid", !en.isIntersecting), { rootMargin: "-56px 0px 0px 0px" }); io.observe(h1); }
}
addEventListener("hashchange", () => { vibe(); const { r } = parse(); render(r !== route); });
$("#refresh").addEventListener("click", () => { vibe(); loadAll(); });
function dragSheet(el) {
  if (!el) return; let y0 = null, dy = 0;
  el.addEventListener("touchstart", e => { if (el.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; el.style.transition = "none"; }, { passive: true });
  el.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener("touchend", () => { if (y0 == null) return; el.style.transition = ""; if (dy > 80) { UI.day = null; render(false); } else el.style.transform = ""; y0 = null; }, { passive: true });
}
$("#sheet-root").addEventListener("click", e => { const c = e.target.closest("[data-close]"); if (c) { UI[c.dataset.close] = null; render(false); } });
view.addEventListener("click", e => {
  const b = e.target.closest("button[data-ui]");
  if (b) { UI[b.dataset.ui] = b.dataset.ui === "day" && UI.day === b.dataset.v ? null : b.dataset.v; vibe(); render(false); return; }
  if (e.target.closest("[data-close]")) { UI[e.target.closest("[data-close]").dataset.close] = null; render(false); return; }
  const j = e.target.closest("a[data-jump]");
  if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.jump); if (el) { el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); history.replaceState(null, "", j.getAttribute("href")); } }
});
// Pull to refresh (a home-screen web app on iPhone has none of its own): drag down from the top past 70px
{
  let y0 = null, pulled = 0; const ind = document.createElement("div"); ind.className = "ptr"; ind.setAttribute("aria-hidden", "true"); document.body.append(ind);
  addEventListener("touchstart", e => { y0 = window.scrollY <= 0 && !UI.day ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
  addEventListener("touchmove", e => { if (y0 == null) return; pulled = Math.max(0, e.touches[0].clientY - y0); ind.style.setProperty("--p", Math.min(pulled / 70, 1)); ind.classList.toggle("on", pulled > 8); ind.classList.toggle("ready", pulled > 70); }, { passive: true });
  addEventListener("touchend", () => { if (y0 != null && pulled > 70) { vibe(); loadAll(); } y0 = null; ind.classList.remove("on", "ready"); }, { passive: true });
}
addEventListener("scroll", () => onBottom(), { passive: true });
addEventListener("keydown", e => { if (e.key === "Escape" && UI.day) { UI.day = null; render(false); } });
// Countdowns tick; the data refreshes every minute while something is live, else every five, and on return to the app
setInterval(() => { for (const el of document.querySelectorAll("[data-cd]")) el.textContent = rel(el.dataset.cd); }, 20000);
setInterval(() => { if (document.hidden) return; const live = events().some(e => e.state === "live"); if (Date.now() - lastLoad > (live ? 60e3 : 300e3)) loadAll(); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastLoad > 60e3) loadAll(); });
// Very large text (Dynamic Type, Android font size): the tab bar keeps its icons and drops the labels
const sizeCheck = () => {
  const h = document.documentElement; h.style.fontSize = "";
  const px = parseFloat(getComputedStyle(h).fontSize);
  if (px > 21) h.style.fontSize = "21px";
  document.body.classList.toggle("big", px > 19);
};
sizeCheck(); addEventListener("resize", sizeCheck);
render(true);
loadAll();
if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("/sport-sw.js", { scope: "/sport" }).catch(() => {});
