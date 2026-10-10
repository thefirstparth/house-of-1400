// Sport V2, the components. One mark system (a crest is drawn whole, never cropped; only a player's photo is round),
// one match row used everywhere (both sides, always), one session row for F1, one hero card, one match sheet.
import { D, S, esc, t, fmt, hm, dayKey, dayLabel, when, shortDate, longDate, rel, same, last, initials, ordinal, gpName, gpShort, val,
  club, clubId, favDriver, short, sideProbs, oddsFor, myChance, sessionMarket, f1Kind, F1MIN, resultWord, meetRecord, atp, soccerMark } from "./core.js";

// ------------------------------------------------------------------ marks
const PX = { s: 24, m: 32, l: 56, xl: 72 };
const CRIC = { India: 6, England: 1, Australia: 2, "South Africa": 3, "West Indies": 4, "New Zealand": 5, Pakistan: 7, "Sri Lanka": 8, Zimbabwe: 9, Bangladesh: 25, Ireland: 29, Afghanistan: 40 };
const espnImg = (path, px) => `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(path)}&w=${px * 2}&h=${px * 2}`;
const mono = (name, size) => `<span class="mk mono ${size}" aria-hidden="true">${esc(initials(name))}</span>`;
function img(url, name, size, kind, alt = "") {
  const fb = esc(mono(name, size)).replace(/'/g, "");
  return `<span class="mk ${kind} ${size}"><img src="${esc(url)}"${alt ? ` data-alt="${esc(alt)}"` : ""} alt="" loading="lazy" decoding="async" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt');this.parentNode.classList.add('wp')}else this.parentNode.outerHTML='${fb}'"></span>`;
}
// m: { t: soccer|nba|cricket|player, id?, abbr?, name }
export function mark(m, size = "m") {
  if (!m) return `<span class="mk none ${size}" aria-hidden="true"></span>`;
  const px = PX[size];
  if (m.t === "soccer") return m.id ? img(espnImg(`/i/teamlogos/soccer/500/${m.id}.png`, px), m.name, size, "crest") : mono(m.name, size);
  if (m.t === "nba") return m.abbr ? img(espnImg(`/i/teamlogos/nba/500/${String(m.abbr).toLowerCase()}.png`, px), m.name, size, "crest") : mono(m.name, size);
  if (m.t === "cricket") return CRIC[m.name] ? img(espnImg(`/i/teamlogos/cricket/500/${CRIC[m.name]}.png`, px), m.name, size, "crest") : mono(m.name, size);
  if (m.t === "player") {
    const r = atp(m.name), path = r?.photo ? new URL(r.photo).pathname : r?.id ? `/i/headshots/tennis/players/full/${r.id}.png` : null;
    const flag = r?.flag ? `<img class="pf" src="${esc(r.flag)}" alt="" loading="lazy">` : "";
    const ph = path ? img(espnImg(path, px), m.name, size, "photo", r.alt_photo || "") : r?.alt_photo ? img(r.alt_photo, m.name, size, "photo wp") : mono(m.name, size);
    return flag ? `<span class="mkw">${ph}${flag}</span>` : ph;
  }
  return mono(m.name, size);
}

// ------------------------------------------------------------------ small pieces
export const ICON = {
  football: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  intl: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  f1: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3.5"/><path d="M5 4h14v9H5"/><path class="f" d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"/></svg>',
  cricket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3l5.5 5.5-9.6 9.6-5.5-5.5z"/><path d="M5.9 12.6L3 19.5 4.5 21l6.9-2.9"/></svg>',
  tennis: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M5 6.3c3.2 1.6 4.6 5.7 3 10.1M19 6.3c-3.2 1.6-4.6 5.7-3 10.1"/></svg>',
  nba: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3.4 3 8.6 0 12M18 6c-3 3.4-3 8.6 0 12"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M12 13v5M9.5 15.5h5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4"/></svg>',
};
export const TAB_OF = { football: "football", intl: "football", f1: "f1", cricket: "cricket", tennis: "tennis", nba: "nba" };
export const TAB_NAME = { football: "Madrid", intl: "Madrid", f1: "F1", cricket: "India", tennis: "Tennis", nba: "NBA" };
export const tag = (sp, label) => `<span class="tag sp-${sp}">${ICON[sp]}${esc(label)}</span>`;
export const live = (txt = "Live") => `<span class="live"><i></i>${esc(txt)}</span>`;
export const countdown = iso => `<span data-cd="${esc(iso)}">${esc(rel(iso))}</span>`;
export const moreBox = (label, inner) => `<details class="more"><summary>${label}${ICON.down}</summary>${inner}</details>`;
export const blk = (title, body, extra = "", id = "") => (body ? `<section class="blk"${id ? ` id="${id}"` : ""}><div class="blk-h"><h2>${title}</h2>${extra}</div>${body}</section>` : "");
export const seg = (key, items, cur, label) => (items.length > 1 ? `<div class="seg" role="group" aria-label="${esc(label)}">${items.map(([k, n]) => `<button type="button" data-ui="${key}" data-v="${esc(k)}" aria-pressed="${k === cur}">${esc(n)}</button>`).join("")}</div>` : "");
export function header(title, sub, keys = []) {
  const st = keys.filter(k => D[k]?.stale);
  return `<header class="ph"><h1 id="h1">${title}</h1>${sub || st.length ? `<div class="sub">${sub || ""}${st.length ? `<span class="stale">Saved copy from ${esc(when(D[st[0]].as_of))}${S.loading ? ", refreshing" : ""}</span>` : ""}</div>` : ""}</header>`;
}
export const jump = items => { const it = items.filter(([id]) => id); return it.length > 2 ? `<nav class="jump" aria-label="On this page"><div class="jump-in">${it.map(([id, n]) => `<a href="#${S.route}/${id}" data-jump="${id}">${esc(n)}</a>`).join("")}</div></nav>` : ""; };
export function sources(...keys) {
  const parts = keys.filter(k => D[k]?.source).map(k => `<li>${esc(D[k].source)} · checked ${D[k].as_of ? (dayKey(t(D[k].as_of)) === dayKey(Date.now()) ? hm(D[k].as_of) : `${shortDate(D[k].as_of)}, ${hm(D[k].as_of)}`) : ""}${D[k].stale ? " · last saved copy" : ""}</li>`);
  return parts.length ? `<details class="srcs"><summary>Sources and times</summary><ul>${[...new Set(parts)].join("")}</ul><p>The time beside each source is when the app last checked it. All times IST. Markets are Kalshi and Polymarket prices, not forecasts, each rounded to a whole number, so a pair can add up to 99 or 101.</p></details>` : "";
}
export const formSquares = (rs, label) => `<span class="form" role="img" aria-label="${esc(label || "Form")}, oldest to latest: ${esc(rs.map(r => r.r).join(" "))}">${rs.map(r => `<i class="${esc(r.r)}" title="${esc(r.t || "")}">${esc(r.r)}</i>`).join("")}</span>`;
export function rankList(outcomes, { max = 6, nameFn = x => x, me = null } = {}) {
  const o = [...outcomes].sort((a, b) => b.prob - a.prob).slice(0, max);
  return `<div class="rank">${o.map((x, i) => { const m = me && same(x.name, me); return `<span class="n${i === 0 ? " lead" : ""}${m ? " me" : ""}">${esc(nameFn(x.name))}</span><span class="tr"><i class="${i === 0 ? "lead" : ""}${m ? " me" : ""}" style="width:${Math.max(1.5, Math.min(100, x.prob))}%"></i></span><b class="p tnum${i === 0 ? " lead" : ""}">${Math.round(x.prob)}%</b>`; }).join("")}</div>`;
}
export const barRow = (name, v, max, { me = false, sub = "", pos = "", colour = "", label = v } = {}) => `<div class="bar-row${me ? " me" : ""}"${colour ? ` style="--c:${esc(colour)}"` : ""}><div class="nm">${pos !== "" ? `<span class="ps tnum">${esc(pos)}</span>` : ""}<span class="tx">${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ""}</span></div><div class="bv"><span class="tk"><i style="width:${Math.max(2, (v / Math.max(max, 1e-9)) * 100)}%"></i></span><b class="tnum">${esc(label)}</b></div></div>`;
export function mktBar(p, names) {
  if (!p) return "";
  const lead = Math.max(p.a, p.b, p.d ?? -1), seg2 = (v, cls) => `<i class="${cls}${v === lead ? " lead" : ""}" style="flex:${Math.max(v, 3)}"></i>`;
  return `<div class="mkt" role="img" aria-label="Market: ${esc(names[0])} ${p.a}%, ${p.d != null ? `draw ${p.d}%, ` : ""}${esc(names[1])} ${p.b}%"><div class="track">${seg2(p.a, "a")}${p.d != null ? seg2(p.d, "d") : ""}${seg2(p.b, "b")}</div>
    <div class="lab"><span class="${p.a === lead ? "lead" : ""}"><b class="tnum">${p.a}%</b> ${esc(names[0])}</span>${p.d != null ? `<span class="${p.d === lead ? "lead" : ""}">Draw <b class="tnum">${p.d}%</b></span>` : ""}<span class="${p.b === lead ? "lead" : ""}">${esc(names[1])} <b class="tnum">${p.b}%</b></span></div>
    <div class="src">${esc(p.source)}${D.odds?.as_of ? ` · ${hm(D.odds.as_of)}` : ""}</div></div>`;
}

// ------------------------------------------------------------------ names on rows
export const sideName = (e, side) => { const n = side === "a" ? e.a : e.b; if (!n) return "To be decided"; return e.sp === "tennis" || e.sp === "nba" ? last(n) : e.sp === "football" ? short(n) : n; };
export const sessionTitle = e => (e.id.startsWith("gp") ? gpShort(e.gp) : e.session);

// ------------------------------------------------------------------ the right-hand status of a row
function status(e) {
  if (e.state === "live") return `<div class="st">${live(e.long ? "Live, running long" : "Live")}${e.clock ? `<small>${esc(e.clock)}</small>` : ""}</div>`;
  if (e.state === "off") return `<div class="st"><b class="dim">Off</b><small>${esc(shortDate(e.start))}</small></div>`;
  if (e.state === "done") {
    const w = e.sp === "cricket" ? resultWord(e) : e.sp === "f1" ? (e.provisional ? "Provisional" : "Final") : e.sp === "nba" ? "Final" : "FT";
    return `<div class="st"><b class="fin">${esc(w)}</b><small>${esc(dayLabel(e.start))}</small></div>`;
  }
  const c = myChance(e), soon = t(e.start) - Date.now() < 12 * 36e5;
  return `<div class="st"><b class="tnum">${e.tbc ? "TBC" : hm(e.start)}</b><small>${e.late ? "Delayed" : soon ? countdown(e.start) : esc(dayLabel(e.start))}</small>${c ? `<span class="ch tnum">${c.prob}%<small> ${esc(c.who)}</small></span>` : ""}</div>`;
}

// ------------------------------------------------------------------ the match row: both sides, always
export function row(e, { sub = true, extra = "" } = {}) {
  if (e.sp === "f1") return sessionRow(e);
  const done = e.state === "done", lv = e.state === "live";
  const sc = side => {
    if (e.sp === "tennis" && done) return `<span class="sets">${(side === "a" ? e.setsA : e.setsB).map((g, i) => `<b class="tnum${g > (side === "a" ? e.setsB : e.setsA)[i] ? " w" : ""}">${g}</b>`).join("")}</span>`;
    const v = side === "a" ? e.sa : e.sb, ov = side === "a" ? e.oa : e.ob;
    return v != null && (done || lv) ? `<b class="sc tnum">${esc(v)}${ov && lv ? `<small>${esc(ov)} ov</small>` : ""}</b>` : "";
  };
  const line = side => `<div class="ln${done && e.won === side ? " win" : done && e.won ? " lose" : ""}">${mark(side === "a" ? e.ma : e.mb, "s")}<span class="nm">${esc(sideName(e, side))}</span>${sc(side)}</div>`;
  const meta = [e.comp, e.sp === "cricket" && e.city ? e.city : ""].filter(Boolean).join(" · ");
  return `<a class="mr sp-${e.sp}${lv ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}"><div class="sides">${line("a")}${line("b")}${sub && meta ? `<div class="meta">${esc(meta)}</div>` : ""}${extra}</div>${status(e)}</a>`;
}
// An F1 session: the flag, the session and Grand Prix, then the time, the live state or the top three
export function sessionRow(e, { gp = true } = {}) {
  const S2 = val("f1_standings")?.drivers || [];
  const code = n => S2.find(d => same(last(d.name), last(n)) || same(d.shown, n))?.code || last(n).slice(0, 3).toUpperCase();
  const top = e.state === "live" && e.liveTop ? e.liveTop : e.state === "done" ? e.top : null;
  const podium = top ? `<div class="pod">${top.map((n, i) => `<span><b class="tnum">${i + 1}</b>${esc(code(n))}</span>`).join("")}</div>` : "";
  return `<a class="mr f1 sp-f1${e.state === "live" ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}"><div class="sides"><div class="ln"><span class="mk flagx s" aria-hidden="true">${esc(e.flag || "")}</span><span class="nm">${esc(sessionTitle(e))}</span></div>${gp ? `<div class="meta">${esc(e.id.startsWith("gp") ? `Round ${e.round}${e.heldIn ? `, held in ${e.heldIn}` : ""}` : gpShort(e.gp))}</div>` : ""}${podium}</div>${status(e)}</a>`;
}

// ------------------------------------------------------------------ the hero: the live or next event, large
export function hero(e) {
  if (!e) return "";
  const lv = e.state === "live";
  const top = `<div class="hh">${tag(e.sp, e.sp === "f1" ? `F1 · ${gpShort(e.gp)}` : e.comp || "")}${lv ? live(e.long ? "Live, running long" : "Live") : `<span class="cd">${e.tbc ? "Time to be confirmed" : e.late ? "Delayed" : countdown(e.start)}</span>`}</div>`;
  if (e.sp === "f1") {
    const S2 = val("f1_standings")?.drivers || [], fav = favDriver();
    const drv = n => S2.find(d => same(last(d.name), last(n)) || same(d.shown, n));
    const order = lv && e.liveTop ? `<ol class="order">${e.liveTop.map((n, i) => { const d = drv(n); return `<li class="${same(last(n), last(fav)) ? "me" : ""}"><b class="tnum">${i + 1}</b><i style="background:${esc(d?.colour || "var(--line)")}"></i><span>${esc(d?.shown || n)}</span></li>`; }).join("")}</ol><p class="foot">Running order from ESPN's live timing</p>` : "";
    // qualifying decides the grid: the race and sprint heroes say where Verstappen starts
    const qs = /^sprint$/i.test(e.session) ? /sprint (qualifying|shootout)/i : /^race$/i.test(e.session) ? /^qualifying$/i : null;
    const q = qs && (val("f1_sessions")?.results || []).find(r => qs.test(r.name) && dayKey(t(r.start)) >= dayKey(t(e.start) - 3 * 864e5));
    const qi = q ? q.top.findIndex(n => same(n, last(fav))) : -1;
    const c = myChance(e);
    const pills = [qi >= 0 ? `${last(fav)} qualified ${ordinal(qi + 1)}` : "", c ? `${last(fav)} <b class="tnum">${c.prob}%</b> ${c.what === "pole" ? "for pole" : "to win"}` : ""].filter(Boolean);
    return `<a class="hero sp-f1${lv ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}">${top}<div class="f1t"><span class="flagx l">${esc(e.flag || "")}</span><div><div class="big">${esc(e.session)}</div><div class="sm">${esc(e.circuit || gpName(e.gp))}</div></div></div>
      ${lv ? order : `<div class="clock tnum">${hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>`}${pills.length ? `<div class="pills">${pills.map(p => `<span class="pill">${p}</span>`).join("")}</div>` : ""}</a>`;
  }
  const side = s => `<div class="side">${mark(s === "a" ? e.ma : e.mb, "l")}<b>${esc(sideName(e, s))}</b></div>`;
  const mid = lv && e.sa != null ? `<div class="mid tnum">${esc(e.sa)}<span>–</span>${esc(e.sb)}${e.clock ? `<small>${esc(e.clock)}</small>` : ""}</div>`
    : lv && e.score ? `<div class="mid sm"><small>${esc(e.score)}</small></div>` : `<div class="mid tnum">${e.tbc ? "TBC" : hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>`;
  const sp = e.sp === "nba" ? "basketball" : e.sp === "intl" ? null : e.sp;
  const p = sp ? sideProbs(oddsFor(sp, [e.a, e.b], e.start), [e.a, e.b]) : null;
  const ev = e.sp === "football" && lv && e.ev ? scorers(e) : "";
  return `<a class="hero sp-${e.sp}${lv ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}">${top}<div class="vs">${side("a")}${mid}${side("b")}</div>${ev}${e.venue ? `<div class="venue">${esc(e.venue)}</div>` : ""}${p ? mktBar(p, [sideName(e, "a"), sideName(e, "b")]) : ""}</a>`;
}
// Goals and red cards, each side's under its name
export function scorers(e) {
  if (!e.ev?.length) return "";
  const cid = clubId(), home = same(e.a, club());
  const pick = isHome => e.ev.filter(x => ((isHome === home) ? x.team_id === cid : x.team_id !== cid));
  const line = list => { const by = new Map(); for (const x of list) { const k = (x.kind === "red" ? "red:" : "") + x.player; if (!by.has(k)) by.set(k, []); by.get(k).push(`${x.minute || ""}${x.kind === "pen" ? " pen" : x.kind === "og" ? " og" : ""}`); } return [...by].map(([k, ms]) => k.startsWith("red:") ? `<span class="rc" aria-label="red card"></span>${esc(last(k.slice(4)))} ${esc(ms.join(", "))}` : `${esc(last(k))} ${esc(ms.join(", "))}`).join("<br>"); };
  const a = line(pick(true)), b = line(pick(false));
  return a || b ? `<div class="scorers"><div>${a}</div><div>${b}</div></div>` : "";
}
// Madrid's goals in one line under a result: "Mbappé 2, Bellingham, Dituro og"
export function goalsLine(e) {
  const by = new Map(), cid = clubId();
  for (const x of e.ev || []) if (x.kind !== "red" && x.team_id === cid) { const k = last(x.player) + (x.kind === "og" ? " og" : ""); by.set(k, (by.get(k) || 0) + 1); }
  return [...by].map(([k, n]) => (n > 1 ? `${k} ${n}` : k)).join(", ");
}

// ------------------------------------------------------------------ the match sheet
const durOf = e => (e.sp === "cricket" ? (/T20/i.test(e.comp || "") ? 210 : 480) : e.sp === "f1" ? e.mins || F1MIN[f1Kind(e.session)] || 60 : e.sp === "nba" || e.sp === "tennis" ? 150 : 120);
const f1Title = (session, gp) => (/^race$/i.test(session) ? `F1 ${gpName(gp)}` : `F1 ${session} · ${gpName(gp)}`);
export const icsHref = e => `/api/ics?${new URLSearchParams({ t: e.sp === "f1" ? f1Title(e.session, e.gp) : e.sp === "cricket" ? `India v ${e.b}, ${e.comp || ""}` : `${e.a} v ${e.b || "TBC"}`, s: e.start, m: durOf(e), l: e.venue || "", d: e.sp === "f1" ? "" : e.comp || "", u: e.id })}`;
function weekendIcs(e) {
  const q = new URLSearchParams();
  for (const x of e.sessions) { q.append("t", f1Title(x.name, e.gp)); q.append("s", x.start); q.append("m", x.minutes || F1MIN[f1Kind(x.name)] || 60); }
  q.append("u", e.id); return `/api/ics?${q}`;
}
function sheetBody(e) {
  const done = e.state === "done", parts = [];
  // the score, the result's detail, or the hero for one to come
  if (e.sp === "f1") {
    if (e.state === "live" || (!done && !e.id.startsWith("gp"))) parts.push(hero(e).replace(/^<a ([^>]*?) href="[^"]*" data-match="[^"]*"/, "<div $1").replace(/<\/a>$/, "</div>"));
    else if (done && e.top) {
      const S2 = val("f1_standings")?.drivers || [], drv = n => S2.find(d => same(last(d.name), last(n)) || same(d.shown, n));
      parts.push(`<div class="card"><ol class="order">${e.top.map((n, i) => { const d = drv(n); return `<li class="${same(last(n), last(favDriver())) ? "me" : ""}"><b class="tnum">${i + 1}</b><i style="background:${esc(d?.colour || "var(--line)")}"></i><span>${esc(d?.shown || n)}</span></li>`; }).join("")}</ol>${e.provisional ? `<p class="foot">Provisional, from ESPN's timing at the flag; the final result follows once a second source confirms it.</p>` : ""}</div>`);
    }
    if (e.id.startsWith("gp") && e.sessions?.length) parts.push(`<div class="list">${e.sessions.map(x => `<div class="li"><div class="grow"><div class="t1">${esc(x.name)}</div><div class="t2">${esc(longDate(x.start))}, ${hm(x.start)} IST</div></div><a class="cal" href="${esc(icsHref({ sp: "f1", session: x.name, gp: e.gp, start: x.start, mins: x.minutes, id: e.id + x.name.replace(/\W/g, "") }))}" aria-label="Add ${esc(x.name)} to calendar">${ICON.cal}</a></div>`).join("")}</div>`);
    const mk = !done && e.id.startsWith("f1") ? sessionMarket(e.session, e.start) : null;
    if (mk) parts.push(`<div class="card"><div class="sub-h">Who the market expects</div>${rankList(mk.outcomes, { max: 5, me: favDriver(), nameFn: n => (val("f1_standings")?.drivers || []).find(d => same(d.name, n))?.shown || n })}<p class="foot">${esc(mk.source || "")}</p></div>`);
  } else if (done || e.state === "live" && e.sa != null) {
    parts.push(`<div class="card">${row(e, { sub: false }).replace(/^<a ([^>]*?) href="[^"]*" data-match="[^"]*"/, "<div $1").replace(/<\/a>$/, "</div>")}${e.sp === "football" ? scorers(e) : ""}${e.sp === "nba" && e.tops ? `<div class="scorers">${e.tops.map(x => `<div>${esc(last(x.name))} ${x.points} pts</div>`).join("")}</div>` : ""}${e.sp === "cricket" ? cricketCard(e) : ""}${e.retired ? `<p class="foot">${esc(last(e.won === "a" ? e.b : e.a))} retired</p>` : ""}</div>`);
  } else {
    parts.push(hero(e).replace(/^<a ([^>]*?) href="[^"]*" data-match="[^"]*"/, "<div $1").replace(/<\/a>$/, "</div>"));
    // Madrid's next match: both sides' form and the meetings
    const PV = e.sp === "football" ? val("madrid_hub")?.preview : null;
    if (PV && String(PV.match_id) === e.mid) {
      const r = meetRecord(PV);
      parts.push(`<div class="card pv">${PV.form.map(tm => `<div class="pvf"><div class="pvt">${mark(soccerMark(tm.id, tm.team), "s")}<b>${esc(short(tm.team))}</b></div>${formSquares(tm.games.map(g => ({ r: g.result || "D", t: `${g.score || ""} ${g.at ? "at" : "v"} ${g.opponent}` })), `${tm.team} form`)}</div>`).join("")}${r.w + r.d + r.l ? `<p class="foot">Last ${r.w + r.d + r.l} meetings: Madrid ${r.w}W ${r.d}D ${r.l}L</p>` : ""}</div>`);
    }
    if (e.sp === "tennis" && e.then) parts.push(`<div class="card then"><span class="k">If he wins</span><span>${e.then.round ? `${esc(e.then.round)} v ` : "v "}${(e.then.opponent ? [e.then.opponent] : e.then.from).map(n => `<span class="nw">${esc(n)}${atp(n)?.rank ? ` <span class="dim">(${atp(n).rank})</span>` : ""}</span>`).join(" or ")}</span></div>`);
  }
  // when and where
  const rows = [["When", e.id.startsWith("gp") ? "" : e.tbc ? `${longDate(e.start)}, time to be confirmed` : `${longDate(e.start)}, ${hm(e.start)} IST`], ["Where", done ? e.venue : ""], ["Competition", done && e.sp !== "f1" ? e.comp : ""]].filter(([, v]) => v);
  if (rows.length) parts.push(`<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`);
  const wk = e.id.startsWith("gp") && e.sessions?.length > 1;
  const acts = `${e.state === "next" && !e.tbc ? `<a class="btn" href="${esc(wk ? weekendIcs(e) : icsHref(e))}">${ICON.cal}<span class="long">${wk ? "Add the weekend" : "Add to calendar"}</span><span class="short">${wk ? "Add weekend" : "Calendar"}</span></a>` : ""}${S.route !== TAB_OF[e.sp] ? `<a class="btn ghost" href="${esc(e.href)}">Open ${esc(TAB_NAME[e.sp])}</a>` : ""}`;
  return parts.join("") + (acts ? `<div class="acts">${acts}</div>` : "");
}
// India's result: top batter and best bowler each side, the player of the match
export function cricketCard(e) {
  let body = e.status ? `<p class="res">${esc(String(e.status).replace(/ due to .*$/i, ""))}</p>` : "";
  const K = e.card?.innings;
  if (K?.length) {
    const lines = K.map(x => { const bw = K.find(y => y.bowl?.team === x.team)?.bowl; return [x.team, [x.bat && `<span class="pe"><small>bat</small> ${esc(last(x.bat.name))} ${x.bat.runs}${x.bat.out ? "" : "*"}${x.bat.balls != null ? ` (${x.bat.balls})` : ""}</span>`, bw && `<span class="pe"><small>bowl</small> ${esc(last(bw.name))} ${bw.wickets}/${bw.runs}</span>`].filter(Boolean).join("")]; }).filter(([, l]) => l);
    body += `<div class="perf">${lines.map(([tm, l]) => `<div><b>${esc(tm)}</b><span class="tnum">${l}</span></div>`).join("")}${e.card.potm?.length ? `<div class="potm">Player of the match: ${esc(e.card.potm.join(", "))}</div>` : ""}</div>`;
  }
  return body;
}
export function sheet(e) {
  const title = e.sp === "f1" ? (e.id.startsWith("gp") ? gpShort(e.gp) : `${e.session} · ${gpShort(e.gp)}`) : `${sideName(e, "a")} v ${sideName(e, "b")}`;
  return `<div class="sheet-bg" data-close="match"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><div class="grab" aria-hidden="true"></div><div class="sheet-h"><b id="sheet-t" tabindex="-1">${esc(title)}</b><button type="button" class="x" data-close="match" aria-label="Close">${ICON.x}</button></div><div class="sb">${sheetBody(e)}</div></div>`;
}
export function daySheet(dayIso, list) {
  return `<div class="sheet-bg" data-close="day"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><div class="grab" aria-hidden="true"></div><div class="sheet-h"><b id="sheet-t" tabindex="-1">${esc(dayKey(t(dayIso)) === dayKey(Date.now()) ? "Today" : fmt(dayIso, { weekday: "long", day: "numeric", month: "long" }))}</b><button type="button" class="x" data-close="day" aria-label="Close">${ICON.x}</button></div><div class="sb"><div class="list">${list.map(e => row(e)).join("")}</div></div></div>`;
}
