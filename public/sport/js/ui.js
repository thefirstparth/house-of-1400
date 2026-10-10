// Sport V3, the components. One grid for every match row (status | sides | score, fixed tracks, so every time, score
// and divider lines up), one hero, one sheet. Marks: a crest is drawn whole; only a player's photo is round, cropped
// to the face from an undistorted image. Live is said once (dot, LIVE, clock); a saved copy says so.
import { D, S, events, esc, t, fmt, hm, dayKey, dayLabel, when, shortDate, longDate, rel, same, last, initials, ordinal, gpName, gpShort, val,
  club, clubId, favDriver, short, offWord, sideProbs, oddsFor, myChance, sessionMarket, f1Kind, F1MIN, resultWord, meetRecord, atp, soccerMark } from "./core.js";

// ------------------------------------------------------------------ marks
const PX = { s: 24, m: 32, l: 48, xl: 64 };
const CRIC = { India: 6, England: 1, Australia: 2, "South Africa": 3, "West Indies": 4, "New Zealand": 5, Pakistan: 7, "Sri Lanka": 8, Zimbabwe: 9, Bangladesh: 25, Ireland: 29, Afghanistan: 40 };
// ESPN's resizer stretches an image to any width and height given (its headshots are 600x436): only a width is asked
// photos are asked at 360 wide (160 and 240 for the small sizes; never a height, so nothing is stretched): sharp on a
// 3x phone at the largest circle; crests at three times their size
const espnImg = (path, px, photo = false) => `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(path)}&w=${photo ? (px <= 24 ? 160 : px <= 32 ? 240 : 360) : Math.max(px * 3, 120)}`;
const mono = (name, size, kind = "") => `<span class="mk mono${kind} ${size}" aria-hidden="true">${esc(initials(name))}</span>`;
// an image that failed once is drawn as initials from then on (a redraw never brings the broken image back)
const BAD = (globalThis.__badImg ||= new Set());
function img(url, name, size, kind, alt = "") {
  if (BAD.has(url)) return alt ? img(alt, name, size, kind) : mono(name, size, kind.includes("photo") ? " round" : "");
  const fb = esc(mono(name, size, kind.includes("photo") ? " round" : "")).replace(/'/g, "");
  return `<span class="mk ${kind} ${size}" aria-hidden="true"><img src="${esc(url)}"${alt ? ` data-alt="${esc(alt)}"` : ""} alt=""${/^https:\/\/a\.espncdn\.com\//.test(url) ? ` crossorigin="anonymous"` : ""} decoding="async" onerror="__badImg.add(this.src);if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt')}else this.parentNode.outerHTML='${fb}'"></span>`;
}
const ISO3 = { SG: "sgp", US: "usa", MX: "mex", BR: "bra", AE: "are", QA: "qat", AU: "aus", JP: "jpn", CN: "chn", BH: "bhr", SA: "ksa", IT: "ita", ES: "esp", MC: "mco", CA: "can", AT: "aut", GB: "gbr", HU: "hun", BE: "bel", NL: "nld", AZ: "aze" };
const iso2 = emoji => [...String(emoji || "")].map(c => c.codePointAt(0) - 0x1f1e6).filter(n => n >= 0 && n < 26).map(n => String.fromCharCode(65 + n)).join("");
export function flagMark(emoji, size = "s") {
  const c = ISO3[iso2(emoji)];
  return c ? img(espnImg(`/i/teamlogos/countries/500/${c}.png`, PX[size] || 24), iso2(emoji), size, "crest flag") : `<span class="mk flagx ${size}" aria-hidden="true">${esc(emoji || "")}</span>`;
}
export function mark(m, size = "m") {
  // no side yet (a draw still to be played): a neutral mark, so the row still has two
  if (!m) return `<span class="mk mono round ${size}" aria-hidden="true">?</span>`;
  const px = PX[size];
  const dark = document.documentElement.dataset.theme === "dark";
  if (m.t === "soccer") return m.id ? (dark ? img(espnImg(`/i/teamlogos/soccer/500-dark/${m.id}.png`, px), m.name, size, "crest", espnImg(`/i/teamlogos/soccer/500/${m.id}.png`, px)) : img(espnImg(`/i/teamlogos/soccer/500/${m.id}.png`, px), m.name, size, "crest")) : mono(m.name, size);
  if (m.t === "nba") return m.abbr ? img(espnImg(`/i/teamlogos/nba/500${document.documentElement.dataset.theme === "dark" ? "-dark" : ""}/${String(m.abbr).toLowerCase()}.png`, px), m.name, size, "crest") : mono(m.name, size);
  if (m.t === "cricket") return CRIC[m.name] ? img(espnImg(`/i/teamlogos/cricket/500/${CRIC[m.name]}.png`, px), m.name, size, "crest") : mono(m.name, size);
  if (m.t === "player") {
    // only ESPN's studio headshots (one light, one crop, one background for every player); a player without one gets
    // initials, never a cropped action photo (Parth, 10 Oct: "not a real, realistic image")
    const r = atp(m.name), path = r?.photo ? new URL(r.photo).pathname : r?.id && r.photo === undefined ? `/i/headshots/tennis/players/full/${r.id}.png` : null;
    const flag = r?.flag && size !== "s" ? `<img class="pf" src="${esc(/^https:\/\/a\.espncdn\.com\/i\//.test(r.flag) ? `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(new URL(r.flag).pathname)}&w=60` : r.flag)}" alt="" crossorigin="anonymous" decoding="async">` : "";
    const ph = path ? img(espnImg(path, px, true), m.name, size, "photo") : mono(m.name, size, " round");
    return flag ? `<span class="mkw">${ph}${flag}</span>` : ph;
  }
  return mono(m.name, size);
}

// ------------------------------------------------------------------ small pieces
export const ICON = {
  football: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  intl: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/></svg>',
  f1: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3.5"/><path d="M5 4h14v9H5"/><path class="f" d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"/></svg>',
  cricket: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M7.2 5.6c2.6 3.7 2.6 9.1 0 12.8M16.8 5.6c-2.6 3.7-2.6 9.1 0 12.8"/><path d="M8.6 8.2l1.3.4M9.3 11.4h1.3M8.6 14.8l1.3-.4M15.4 8.2l-1.3.4M14.7 11.4h-1.3M15.4 14.8l-1.3-.4"/></svg>',
  tennis: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M5 6.3c3.2 1.6 4.6 5.7 3 10.1M19 6.3c-3.2 1.6-4.6 5.7-3 10.1"/></svg>',
  nba: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3.4 3 8.6 0 12M18 6c-3 3.4-3 8.6 0 12"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M12 13v5M9.5 15.5h5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4"/></svg>',
  back: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M9 3L5 7l4 4"/></svg>',
};
export const TAB_OF = { football: "football", intl: "football", f1: "f1", cricket: "cricket", tennis: "tennis", nba: "nba" };
export const TAB_NAME = { football: "Madrid", intl: "National teams", f1: "F1", cricket: "India", tennis: "Tennis", nba: "Warriors" };
export const tag = (sp, label) => `<span class="tag sp-${sp}">${ICON[sp]}<span>${esc(label)}</span></span>`;
export const live = (txt = "Live") => `<span class="live"><i></i>${esc(txt)}</span>`;
export const countdown = iso => `<span data-cd="${esc(iso)}">${esc(rel(iso))}</span>`;
export const moreBox = (label, inner) => `<details class="more"><summary>${label}${ICON.down}</summary>${inner}</details>`;
export const blk = (title, body, extra = "", id = "") => (body ? `<section class="blk"${id ? ` id="${id}"` : ""}><div class="blk-h"><h2>${title}</h2>${extra}</div>${body}</section>` : "");
export const seg = (key, items, cur, label) => (items.length > 1 ? `<div class="seg" role="group" aria-label="${esc(label)}" style="--n:${items.length};--i:${Math.max(0, items.findIndex(([k]) => k === cur))}"><i class="thumb" aria-hidden="true"></i>${items.map(([k, n]) => `<button type="button" data-ui="${key}" data-v="${esc(k)}" aria-pressed="${k === cur}"><span>${esc(n)}</span></button>`).join("")}</div>` : "");
export function header(title, sub, keys = []) {
  const st = keys.filter(k => D[k]?.stale);
  return `<header class="ph"><h1 id="h1">${title}</h1>${sub || st.length ? `<div class="sub">${sub || ""}${st.length ? `<span class="stale">Saved copy, ${esc(when(D[st[0]].as_of))}${S.loading ? ", refreshing" : ""}</span>` : ""}</div>` : ""}</header>`;
}
export const jump = items => { const it = items.filter(([id]) => id); return it.length > 2 ? `<nav class="jump" aria-label="On this page"><div class="jump-in">${it.map(([id, n]) => `<a href="#${S.route}/${id}" data-jump="${id}">${esc(n)}</a>`).join("")}</div></nav>` : ""; };
export function sources(...keys) {
  const parts = keys.filter(k => D[k]?.source).map(k => `<li>${esc(D[k].source)} · checked ${D[k].as_of ? (dayKey(t(D[k].as_of)) === dayKey(Date.now()) ? hm(D[k].as_of) : `${shortDate(D[k].as_of)}, ${hm(D[k].as_of)}`) : ""}${D[k].stale ? " · saved copy" : ""}</li>`);
  return parts.length ? `<details class="srcs"><summary>Sources and times</summary><ul>${[...new Set(parts)].join("")}</ul><p>The time beside each source is when the app last checked it. All times IST. Prices are Kalshi and Polymarket markets, not forecasts, rounded to whole numbers; each outcome is its own market, so a set can add up to a little more or less than 100.</p></details>` : "";
}
export const formSquares = (rs, label) => `<span class="form" role="img" aria-label="${esc(label || "Form")}, oldest to latest: ${esc(rs.map(r => r.r).join(" "))}">${rs.map(r => `<i class="${esc(r.r)}" title="${esc(r.t || "")}">${esc(r.r)}</i>`).join("")}</span>`;
export function rankList(outcomes, { max = 6, nameFn = x => x, me = null } = {}) {
  const o = [...outcomes].sort((a, b) => b.prob - a.prob).slice(0, max);
  return `<div class="rank">${o.map((x, i) => { const m = me && same(x.name, me); return `<span class="n${m ? " me" : ""}">${esc(nameFn(x.name))}</span><span class="tr"><i class="${i === 0 ? "lead" : ""}${m ? " me" : ""}" style="width:${Math.max(1.5, Math.min(100, x.prob))}%"></i></span><b class="p tnum">${Math.round(x.prob)}%</b>`; }).join("")}</div>`;
}
export const barRow = (name, v, max, { me = false, sub = "", pos = "", colour = "", label = v } = {}) => `<div class="bar-row${me ? " me" : ""}${pos === "" ? " np" : ""}"${colour ? ` style="--c:${esc(colour)}"` : ""}>${pos !== "" ? `<span class="ps tnum">${esc(pos)}</span>` : ""}<span class="tx">${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="tk"><i style="width:${Math.max(2, (v / Math.max(max, 1e-9)) * 100)}%"></i></span><b class="tnum">${esc(label)}</b></div>`;
export function mktBar(p, names, note = "") {
  if (!p) return "";
  const lead = Math.max(p.a, p.b, p.d ?? -1), seg2 = (v, cls) => `<i class="${cls}${v === lead ? " lead" : ""}" style="flex:${Math.max(v, 3)}"></i>`;
  const asOf = D.odds?.as_of ? (dayKey(t(D.odds.as_of)) === dayKey(Date.now()) ? hm(D.odds.as_of) : `${shortDate(D.odds.as_of)} ${hm(D.odds.as_of)}`) : "";
  return `<div class="mkt" role="img" aria-label="${esc(note || "Market")}: ${esc(names[0])} ${p.a}%, ${p.d != null ? `draw ${p.d}%, ` : ""}${esc(names[1])} ${p.b}%"><div class="track">${seg2(p.a, "a")}${p.d != null ? seg2(p.d, "d") : ""}${seg2(p.b, "b")}</div>
    <div class="lab"><span><b class="tnum">${p.a}%</b> ${esc(names[0])}</span>${p.d != null ? `<span>Draw <b class="tnum">${p.d}%</b></span>` : ""}<span>${esc(names[1])} <b class="tnum">${p.b}%</b></span></div>
    <div class="src">${note ? `${esc(note)} · ` : ""}${esc(p.source)}${asOf ? ` · ${asOf}` : ""}</div></div>`;
}

// ------------------------------------------------------------------ names
export const sideName = (e, side) => { const n = side === "a" ? e.a : e.b; if (!n) return "To be decided"; return e.sp === "tennis" || e.sp === "nba" ? last(n) : e.sp === "football" ? short(n) : n; };
export const sessionTitle = e => (e.id.startsWith("gp") ? gpShort(e.gp) : e.session);

// ------------------------------------------------------------------ the status track (left, fixed width)
// the day in the status track: Today, Tmrw, Yest., else "20 Sep" (the track is narrow; the sheet gives the weekday)
const dayShort = iso => { const k = dayKey(t(iso)), now = Date.now(); return k === dayKey(now) ? "Today" : k === dayKey(now + 864e5) ? "Tmrw" : k === dayKey(now - 864e5) ? "Yest." : shortDate(iso); };
export const liveLabel = e => e.pause || "Live";
const at = iso => (dayKey(t(iso)) === dayKey(Date.now()) ? hm(iso) : `${shortDate(iso)} ${hm(iso)}`);
// in a word: why an event is not on (Postponed, Cancelled, Abandoned), or that its live feed was lost
const offShort = e => (e.seen ? "Last seen" : offWord(e.offWhy || "") || (/did not start/i.test(e.offWhy || "") ? "Not run" : "Off"));
const atDay = iso => (dayKey(t(iso)) === dayKey(Date.now()) ? hm(iso) : shortDate(iso));
function status(e) {
  if (e.state === "live" && e.pause && e.sp === "cricket") return `<span class="st"><b class="w${e.pause.length > 6 ? " l" : ""}">${esc(e.pause)}</b>${e.saved ? `<small class="sv">${hm(e.saved)}</small>` : /stumps/i.test(e.pause) ? (String(e.status || "").match(/\bDay \d+\b/i)?.[0] ? `<small>${esc(String(e.status).match(/\bDay \d+\b/i)[0])}</small>` : "") : `<small>Paused</small>`}</span>`;
  if (e.state === "live") return e.pause ? `<span class="st lv"><b class="w${e.pause.length > 6 ? " l" : ""}">${esc(e.pause)}</b>${e.saved ? `<small class="sv">${hm(e.saved)}</small>` : "<small>Live</small>"}</span>` : `<span class="st lv"><b>${live("Live")}</b><small${e.saved ? ` class="sv"` : ""}>${esc(e.saved ? hm(e.saved) : e.clock || (e.sp === "cricket" ? ((e.sb && e.ob ? e.ob : e.oa) ? `${e.sb && e.ob ? e.ob : e.oa} ov` : "") : ""))}</small></span>`;
  if (e.state === "off") return `<span class="st"><b class="w${offShort(e).length > 6 ? " l" : ""}">${esc(offShort(e))}</b><small>${esc(e.seen ? atDay(e.seen) : dayShort(e.start))}</small></span>`;
  if (e.state === "done") {
    const w = e.sp === "cricket" ? (e.won === "a" ? "Won" : e.won === "b" ? "Lost" : "Result") : e.sp === "f1" ? (e.provisional ? "Prov." : e.unconfirmed || !e.top ? "Ended" : "Final") : e.sp === "football" || e.sp === "intl" ? "FT" : "Final";
    return `<span class="st"><b class="w">${esc(w)}</b><small>${esc(dayShort(e.start))}</small></span>`;
  }
  const soon = t(e.start) - Date.now() < 12 * 36e5;
  return `<span class="st"><b class="tnum">${e.tbc ? "TBC" : hm(e.start)}</b><small>${e.due ? "On now" : e.nolive ? "Kicked off" : e.starting ? "Starting" : e.late ? "Delayed" : e.tbc ? esc(dayShort(e.start)) : soon ? countdown(e.start) : S.UI.day && dayKey(t(e.start)) === S.UI.day ? "" : esc(dayShort(e.start))}</small></span>`;
}
// what a screen reader hears for a row
export function said(e, { noWin = false } = {}) {
  const when2 = e.state === "live" ? `live${e.pause ? `, ${e.pause}` : e.clock ? `, ${e.clock}` : ""}${e.saved ? `, saved copy from ${at(e.saved)}` : ""}` : e.state === "done" ? `finished ${dayLabel(e.start)}` : e.state === "off" ? (e.seen ? `live feed lost, last seen at ${at(e.seen)}` : String(e.offWhy || "not played").toLowerCase()) : e.tbc ? `${dayLabel(e.start)}, time to be confirmed` : e.nolive ? `kicked off at ${hm(e.start)}, no live score` : e.late ? `due at ${hm(e.start)}, not yet started` : `${dayLabel(e.start)} at ${hm(e.start)}`;
  const order = e.state === "live" ? e.liveTop : e.state === "done" ? e.top : null;
  if (e.sp === "f1") return `${e.session}, ${gpName(e.gp)}, ${when2}${order ? `, ${e.provisional ? "provisional " : ""}${order.map((n, i) => `${i + 1} ${last(n)}`).join(", ")}` : ""}`;
  const done = e.state === "done";
  const sc = e.sp === "tennis" && done && e.setsA?.length ? `, ${e.setsA.map((g, i) => `${g}-${e.setsB[i]}`).join(", ")}` : (done || e.state === "live") && (e.sa != null || e.sb != null) ? `, ${[e.sa != null ? `${sideName(e, "a")} ${e.sa}` : "", e.sb != null ? `${sideName(e, "b")} ${e.sb}` : ""].filter(Boolean).join(", ")}` : "";
  const nm = side => ((side === "a" ? e.a : e.b) ? sideName(e, side) : "to be decided");
  const won = done && !noWin ? (e.won ? `, ${sideName(e, e.won)} won${e.sp === "cricket" ? (resultWord(e).match(/ by .+$/)?.[0] || "") : ""}` : e.sp === "football" || e.sp === "intl" ? ", a draw" : "") : "";
  return `${nm("a")} versus ${nm("b")}${sc}${won}, ${when2}${e.comp ? `, ${e.comp}` : ""}`.replace(/\bwkts?\b/g, "wickets");
}

// ------------------------------------------------------------------ the match row
export function row(e, { meta = true, extra = "", why = "" } = {}) {
  if (why) extra = `<span class="why">${esc(why)}</span>` + extra;
  if (e.sp === "f1") return sessionRow(e, { extra, why });
  const done = e.state === "done", lv = e.state === "live";
  const sc = side => {
    if (e.sp === "tennis" && done) return `<span class="sc sets">${(side === "a" ? e.setsA : e.setsB).map((g, i) => `<b class="tnum${g > (side === "a" ? e.setsB : e.setsA)[i] ? " w" : ""}">${g}</b>`).join("")}</span>`;
    const v = side === "a" ? e.sa : e.sb;
    return `<span class="sc tnum" data-sk="${esc(e.id + side)}" data-v="${esc(v ?? "")}">${v != null && (done || lv) ? esc(v) : ""}</span>`;
  };
  const inl = !done && !lv;
  const line = side => `<span class="ln${done && e.won === side ? " win" : done && e.won ? " lose" : ""}${inl ? " nx" : ""}">${mark(side === "a" ? e.ma : e.mb, "s")}<span class="nm">${esc(sideName(e, side))}</span>${inl && side === "b" && m0() ? `<span class="mx">${esc(m0())}</span>` : sc(side)}</span>`;
  // cricket: the city before the match, the margin after it ("by 8 wkts"; Won or Lost is in the status track)
  const margin = e.sp === "cricket" && done ? (resultWord(e).match(/\bby .+$/)?.[0] || "") : "";
  const m = meta ? [e.comp, e.sp === "cricket" && !done && e.city ? e.city : "", margin].filter(Boolean).join(" · ") : "";
  function m0() { return m; }
  const tagN = e.plain ? "div" : "a", link = e.plain ? "" : ` href="${e.href}" data-match="${esc(e.id)}"`;
  return `<${tagN} class="mr sc-${e.sp}${lv ? " is-live" : ""}"${link} aria-label="${esc((why ? why + ". " : "") + said(e, { noWin: !!why }))}">${status(e)}<span class="sides">${line("a")}${line("b")}${m ? `<span class="meta${inl ? " alt" : ""}">${esc(m)}</span>` : ""}${extra}</span></${tagN}>`;
}
// an F1 session: the status, then flag, session, and the top three (live order, provisional or final)
export function sessionRow(e, { gp = true, extra = "", why = "" } = {}) {
  const S2 = val("f1_standings")?.drivers || [];
  const code = n => S2.find(d => same(last(d.name), last(n)) || same(d.shown, n))?.code || last(n).slice(0, 3).toUpperCase();
  const top = e.state === "live" && e.liveTop ? e.liveTop : e.state === "done" ? e.top : null;
  const pod = top ? `<span class="pod">${top.map((n, i) => `<span><b class="tnum">${i + 1}</b>${esc(code(n))}</span>`).join("")}</span>` : "";
  const sub = gp ? (e.id.startsWith("gp") ? `Round ${e.round}${e.heldIn ? `, held in ${e.heldIn}` : ""}` : gpShort(e.gp)) : "";
  return `<a class="mr sc-f1${e.state === "live" ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}" aria-label="${esc((why ? why + ". " : "") + said(e))}">${status(e)}<span class="sides"><span class="ln f1">${flagMark(e.flag, "s")}<span class="nm">${esc(sessionTitle(e))}</span></span>${pod}${sub ? `<span class="meta">${esc(sub)}</span>` : ""}${extra}</span></a>`;
}

// ------------------------------------------------------------------ the hero
function f1Order(e, list, n = 3) {
  const S2 = val("f1_standings")?.drivers || [], fav = favDriver(), drv = x => S2.find(d => same(last(d.name), last(x)) || same(d.shown, x));
  const li = (x, i) => { const d = drv(x); return `<li class="${same(last(x), last(fav)) ? "me" : ""}"><b class="tnum">${i + 1}</b>${d?.colour ? `<i style="background:${esc(d.colour)}"></i>` : ""}<span>${esc(d?.shown || x)}</span></li>`; };
  const head = list.slice(0, n), mi = list.findIndex(x => same(last(x), last(fav)));
  return `<ol class="order">${head.map(li).join("")}${mi >= n ? `<li class="gap" aria-hidden="true"></li>${li(list[mi], mi)}` : ""}</ol>`;
}
export function hero(e, { inSheet = false } = {}) {
  if (!e) return "";
  const lv = e.state === "live";
  const right = lv ? `${e.pause && e.sp === "cricket" ? "" : e.pause ? `<span class="cd w">${esc(e.pause)}</span>` : live("Live")}${e.saved ? `<span class="cd">Saved ${esc(at(e.saved))}</span>` : ""}` : `<span class="cd">${e.tbc ? "" : e.due ? "On now by the timetable" : e.nolive ? "Kicked off, no live score" : e.starting ? "Starting" : e.late ? (e.sp === "tennis" ? "Not yet on court" : "Delayed") : countdown(e.start)}</span>`;
  const top = `<div class="hh">${tag(e.sp, e.sp === "f1" ? gpShort(e.gp) : e.comp || "")}<span class="hr">${right}</span></div>`;
  if (e.sp === "f1") {
    const fav = favDriver(), c = myChance(e);
    const qs = /^sprint$/i.test(e.session) ? /sprint (qualifying|shootout)/i : /^race$/i.test(e.session) ? /^qualifying$/i : null;
    const q = qs && (val("f1_sessions")?.results || []).find(r => qs.test(r.name) && dayKey(t(r.start)) >= dayKey(t(e.start) - 3 * 864e5));
    const qi = q ? q.top.findIndex(n => same(n, last(fav))) : -1;
    const body = lv && (e.liveOrder || e.liveTop) ? `${f1Order(e, e.liveOrder || e.liveTop)}<p class="foot">Running order, ESPN live timing</p>`
      : lv ? `<div class="clock uw">Under way<small>since ${hm(e.start)}</small></div>`
      : `<div class="clock tnum">${hm(e.start)}<small>${esc(dayLabel(e.start))}</small></div>${qi >= 0 || c ? `<p class="line">${qi >= 0 ? `${esc(last(fav))} qualified ${ordinal(qi + 1)}` : ""}${qi >= 0 && c ? " · " : ""}${c ? `${esc(last(fav))} <b class="tnum">${c.prob}%</b> ${c.what === "pole" ? "for pole" : "to win"}, ${esc(sessionMarket(e.session, e.start)?.source || "")}${priceAt(e) ? ` at ${esc(priceAt(e))}` : ""}` : ""}</p>` : ""}`;
    return `<a class="hero sc-f1${lv ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}" aria-label="${esc(said(e))}">${top}${inSheet ? "" : `<div class="f1t">${flagMark(e.flag, "l")}<div><div class="big">${esc(e.session)}</div><div class="sm">${esc(e.circuit || gpName(e.gp))}</div></div></div>`}${body}</a>`;
  }
  const crl = lv && e.sp === "cricket";
  const side = s => { const v = s === "a" ? e.sa : e.sb, o = s === "a" ? e.oa : e.ob; return `<div class="side">${mark(s === "a" ? e.ma : e.mb, "l")}<b>${esc(sideName(e, s))}</b>${crl ? `<span class="crs tnum">${v ? `<span>${esc(v)}</span>${o ? `<small>${esc(o)} ov</small>` : ""}` : `<small>Yet to bat</small>`}</span>` : ""}</div>`; };
  let mid;
  if (crl) mid = `<div class="mid tnum"><span class="vsw">v</span></div>`;
  else if (lv && e.sa != null) mid = `<div class="mid tnum"><span class="nums"><span data-sk="${esc(e.id)}a" data-v="${esc(e.sa)}">${esc(e.sa)}</span><i>–</i><span data-sk="${esc(e.id)}b" data-v="${esc(e.sb)}">${esc(e.sb)}</span></span><small>${esc(e.saved || (e.pause && e.clock === e.pause) ? "" : e.clock || "")}</small></div>`;
  else if (lv) mid = `<div class="mid tnum"><span class="nums sm">${hm(e.start)}</span><small>Under way</small></div>`;
  else mid = `<div class="mid tnum"><span class="nums">${e.tbc ? "TBC" : hm(e.start)}</span><small>${esc(dayLabel(e.start))}</small></div>`;
  const sp = e.sp === "nba" ? "basketball" : e.sp === "intl" ? null : e.sp;
  const p = !lv && !e.late && !e.starting && t(e.start) > Date.now() && sp ? sideProbs(oddsFor(sp, [e.a, e.b], e.start), [e.a, e.b]) : null;
  const extra = lv && e.sp === "football" && e.ev?.length && !inSheet ? scorers(e) : crl && e.status ? `<p class="line c${e.pause ? " paused" : ""}">${esc(e.status)}</p>` : "";
  return `<a class="hero sc-${e.sp}${lv && !(crl && e.pause) ? " is-live" : ""}" href="${e.href}" data-match="${esc(e.id)}" aria-label="${esc(said(e))}">${top}<div class="vs">${side("a")}${mid}${side("b")}</div>${extra}${e.venue && !lv ? `<div class="venue">${esc(e.venue)}${e.held ? ` · ${esc(e.held)}` : ""}</div>` : ""}${p ? mktBar(p, [sideName(e, "a"), sideName(e, "b")], "Before the start") : ""}</a>`;
}
export function scorers(e) {
  if (!e.ev?.length) return "";
  const cid = clubId(), home = same(e.a, club());
  const pick = isHome => e.ev.filter(x => ((isHome === home) ? x.team_id === cid : x.team_id !== cid));
  const line = list => { const by = new Map(); for (const x of list) { const k = (x.kind === "red" ? "red:" : "") + x.player; if (!by.has(k)) by.set(k, []); by.get(k).push(`${String(x.minute || "").replace(/'/g, "′")}${x.kind === "pen" ? " pen" : x.kind === "og" ? " og" : ""}`); } return [...by].map(([k, ms]) => k.startsWith("red:") ? `<span class="rc" aria-label="red card"></span>${esc(last(k.slice(4)))} ${esc(ms.join(", "))}` : `${esc(last(k))} ${esc(ms.join(", "))}`).join("<br>"); };
  const a = line(pick(true)), b = line(pick(false));
  return a || b ? `<div class="scorers"><div>${a}</div><div>${b}</div></div>` : "";
}
export function goalsLine(e) {
  const by = new Map(), cid = clubId();
  for (const x of e.ev || []) if (x.kind !== "red" && x.team_id === cid) { const k = last(x.player) + (x.kind === "og" ? " og" : ""); by.set(k, (by.get(k) || 0) + 1); }
  return [...by].map(([k, n]) => (n > 1 ? `${k} ${n}` : k)).join(", ");
}
export function cricketCard(e) {
  const K = e.card?.innings;
  if (!K?.length) return "";
  const lines = K.map(x => { const bw = K.find(y => y.bowl?.team === x.team)?.bowl; return [x.team, [x.bat && `<span class="pe"><small>bat</small> ${esc(last(x.bat.name))} ${x.bat.runs}${x.bat.out ? "" : "*"}${x.bat.balls != null ? ` (${x.bat.balls})` : ""}</span>`, bw && `<span class="pe"><small>bowl</small> ${esc(last(bw.name))} ${bw.wickets}/${bw.runs}</span>`].filter(Boolean).join("")]; }).filter(([, l]) => l);
  return `<span class="perf">${lines.map(([tm, l]) => `<span class="pl2"><b>${esc(tm)}</b><span class="tnum">${l}</span></span>`).join("")}${e.card.potm?.length ? `<span class="potm">Player of the match: ${esc(e.card.potm.join(", "))}</span>` : ""}</span>`;
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
// when an F1 price was read (the race market from f1_market, the session markets from odds)
export const priceAt = e => { const k = f1Kind(e.session) === "race" ? "f1_market" : "odds", a = D[k]?.as_of; return a ? at(a) : ""; };
// the match so far: each goal and red card with its minute, on the side it happened
function timeline(e) {
  const cid = clubId(), homeIsUs = same(e.a, club()), KIND = { goal: "Goal", pen: "Penalty goal", og: "Own goal", red: "Red card" };
  let h = 0, a = 0;
  const rows = [...e.ev].sort((x, y) => parseInt(x.minute) - parseInt(y.minute)).map(x => {
    const us = x.team_id === cid, left = us === homeIsUs;
    if (x.kind !== "red") { if (left) h++; else a++; }
    return `<div class="tl-r${left ? "" : " r"}"><b class="tnum">${esc(String(x.minute || "").replace(/'/g, "′"))}</b><span>${x.kind === "red" ? `<span class="rc" aria-hidden="true"></span>` : ""}${esc(last(x.player))}<small>${esc(KIND[x.kind] || "Goal")}${x.kind !== "red" ? ` · ${h}–${a}` : ""}</small></span></div>`;
  }).join("");
  return `<div class="card tl"><div class="sub-h">The match so far</div>${rows}</div>`;
}
const unlink = h => h.replace(/^<a ([^>]*?) href="[^"]*" data-match="[^"]*"( aria-label="[^"]*")?/, "<div $1").replace(/<\/a>$/, "</div>");
function sheetBody(e) {
  const done = e.state === "done", lv = e.state === "live", parts = [];
  if (e.sp === "f1") {
    if (lv) {
      parts.push(unlink(hero(e, { inSheet: true })));
      if ((e.liveOrder || []).length > 3) parts.push(`<div class="card"><div class="sub-h">Full running order</div>${f1Order(e, e.liveOrder, e.liveOrder.length)}</div>`);
    } else if (done && e.top) parts.push(`<div class="card">${f1Order(e, e.top, 3)}${e.provisional ? `<p class="foot">Provisional, from ESPN's timing; final once a second source confirms it.</p>` : ""}</div>`);
    else if (!e.id.startsWith("gp")) parts.push(unlink(hero(e, { inSheet: true })));
    if (e.id.startsWith("gp") && e.sessions?.length) parts.push(`<div class="list">${e.sessions.map(x => `<div class="li"><div class="grow"><div class="t1">${esc(x.name)}</div><div class="t2">${esc(longDate(x.start))}, ${hm(x.start)} IST</div></div><a class="cal" href="${esc(icsHref({ sp: "f1", session: x.name, gp: e.gp, start: x.start, mins: x.minutes, id: e.id + x.name.replace(/\W/g, "") }))}" aria-label="Add ${esc(x.name)} to calendar">${ICON.cal}</a></div>`).join("")}</div>`);
    // the rest of the weekend, each session with its state
    const wk2 = e.id.startsWith("f1") ? events(true).filter(x => x.sp === "f1" && x.id.startsWith("f1") && x.id !== e.id && f1Kind(x.session)) : [];
    const wkShow = wk2.filter(x => x.state !== "done" || x.top), wkGone = wk2.filter(x => x.state === "done" && !x.top);
    if (wkShow.length || wkGone.length) parts.push(`<div class="sub-h">The weekend</div>${wkGone.length ? `<p class="foot">Earlier: ${esc(wkGone.map(x => x.session).join(", "))}</p>` : ""}${wkShow.length ? `<div class="list">${wkShow.map(x => sessionRow(x, { gp: false })).join("")}</div>` : ""}`);
    const mk = e.state === "next" && e.id.startsWith("f1") ? sessionMarket(e.session, e.start) : null;
    if (mk) parts.push(`<div class="card"><div class="sub-h">Who the market expects</div>${rankList(mk.outcomes, { max: 6, me: favDriver(), nameFn: n => (val("f1_standings")?.drivers || []).find(d => same(d.name, n))?.shown || n })}<p class="foot">${esc(mk.source || "")}${priceAt(e) ? ` · ${esc(priceAt(e))}` : ""}</p></div>`);
  } else if (lv && e.sp !== "cricket") {
    parts.push(unlink(hero(e, { inSheet: true })));
    if ((e.sp === "football" || e.sp === "intl") && e.ev?.length) parts.push(timeline(e));
  } else if (done || (lv && e.sa != null)) {
    parts.push(`<div class="card flush">${unlink(row(e, { meta: false }))}${e.sp === "football" && e.ev?.length ? `<div class="pad">${scorers(e)}</div>` : ""}${e.sp === "nba" && e.tops ? `<div class="pad"><div class="scorers">${e.tops.map(x => `<div>${esc(last(x.name))} ${x.points} pts</div>`).join("")}</div></div>` : ""}${e.sp === "cricket" ? `<div class="pad"><p class="res">${esc(String(e.status || "").replace(/ due to .*$/i, ""))}</p>${cricketCard(e)}</div>` : ""}${e.retired ? `<p class="foot pad">${esc(last(e.won === "a" ? e.b : e.a))} retired</p>` : ""}</div>`);

  } else {
    parts.push(unlink(hero(e)));
    const PV = e.sp === "football" ? val("madrid_hub")?.preview : null;
    if (PV && String(PV.match_id) === e.mid) {
      const r = meetRecord(PV);
      parts.push(`<div class="card pv">${PV.form.map(tm => `<div class="pvf"><div class="pvt">${mark(soccerMark(tm.id, tm.team), "s")}<b>${esc(short(tm.team))}</b></div>${formSquares(tm.games.map(g => ({ r: g.result || "D", t: `${g.score || ""} ${g.at ? "at" : "v"} ${g.opponent}` })), `${tm.team} form`)}</div>`).join("")}${r.w + r.d + r.l ? `<p class="foot">Last ${r.w + r.d + r.l} meetings: Madrid ${r.w}W ${r.d}D ${r.l}L</p>` : ""}</div>`);
    }
    if (e.sp === "tennis" && e.then) parts.push(`<div class="card then"><span class="k">If he wins</span><span>${e.then.round ? `${esc(e.then.round)} v ` : "v "}${(e.then.opponent ? [e.then.opponent] : e.then.from).map(n => `<span class="nw">${esc(n)}${atp(n)?.rank ? ` <span class="dim">(${atp(n).rank})</span>` : ""}</span>`).join(" or ")}</span></div>`);
  }
  const rows = [["When", e.id.startsWith("gp") ? "" : e.tbc ? `${longDate(e.start)}, time to be confirmed` : `${longDate(e.start)}, ${hm(e.start)} IST`], ["Where", e.venue && (done || lv || e.sp === "f1") ? e.venue : ""], ["Competition", done && e.sp !== "f1" ? e.comp : ""], ["Status", e.state === "off" ? (e.seen ? `Live feed lost; last seen live at ${at(e.seen)}` : e.offWhy || "") : ""]].filter(([, v]) => v);
  if (rows.length) parts.push(`<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`);
  const wk = e.id.startsWith("gp") && e.sessions?.length > 1;
  const acts = `${e.state === "next" && !e.tbc ? `<a class="btn" href="${esc(wk ? weekendIcs(e) : icsHref(e))}">${ICON.cal}<span class="long">${wk ? "Add the weekend" : "Add to calendar"}</span><span class="short">${wk ? "Add weekend" : "Calendar"}</span></a>` : ""}${S.route !== TAB_OF[e.sp] ? `<a class="btn ghost" href="${esc(e.href)}">Open ${esc(TAB_NAME[e.sp])}</a>` : ""}`;
  return parts.join("") + (acts ? `<div class="acts">${acts}</div>` : "");
}
export function sheet(e) {
  const heroLed = e.sp !== "f1" && (e.state === "next" || (e.state === "live" && e.sp !== "cricket"));
  const title = e.sp === "f1" ? (e.id.startsWith("gp") ? gpShort(e.gp) : `${e.session} · ${gpShort(e.gp)}`) : heroLed ? `${e.comp || TAB_NAME[e.sp]} · ${e.state === "live" ? "Live" : "Next"}` : `${sideName(e, "a")} v ${sideName(e, "b")}`;
  return `<div class="sheet-bg" data-close="match"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(e.sp === "f1" ? title : `${sideName(e, "a")} v ${sideName(e, "b")}, ${e.comp || ""}${e.state === "live" ? ", live" : ""}`)}"><div class="grab" aria-hidden="true"></div><div class="sheet-h"><b id="sheet-t" tabindex="-1">${esc(title)}</b><button type="button" class="x" data-close="match" aria-label="Close">${ICON.x}</button></div><div class="sb">${sheetBody(e)}</div></div>`;
}
