// Sport V2, the screens. Every fixture or result is a match row (ui.row) with both sides; every screen opens with what
// is live or next (ui.hero); tables, standings and stats follow. Tap any row for its sheet.
import { D, S, esc, t, fmt, hm, dayKey, dayLabel, when, shortDate, longDate, span, same, last, ordinal, gpName, gpShort, val,
  follows, club, clubId, favDriver, nbaTeam, nbaAbbr, sn, short, raceMarket, oddsFor, f1Kind, sessionMarket, events, nbaOn, meetRecord, atp, soccerMark, sinceLast, resultWord } from "./core.js";
import { mark, tag, live, countdown, moreBox, blk, seg, header, jump, sources, formSquares, rankList, barRow, row, sessionRow, hero, goalsLine, cricketCard, ICON, sideName, priceAt } from "./ui.js";

const list = (rows, n, what) => (rows.length ? `<div class="list">${rows.slice(0, n).join("")}${rows.length > n ? moreBox(`${rows.length - n} more ${what}`, rows.slice(n).join("")) : ""}</div>` : "");
const li = (lead, title, subline, end = "", href = "", cls = "") => `<${href ? `a href="${href}"` : "div"} class="li${cls ? " " + cls : ""}">${lead}<div class="grow"><div class="t1">${title}</div>${subline ? `<div class="t2">${subline}</div>` : ""}</div>${end ? `<div class="end">${end}</div>` : ""}</${href ? "a" : "div"}>`;
const skel = `<div class="skel"></div><div class="skel"></div>`;
const waitOr = (has, what) => (has ? "" : S.loading || !S.lastLoad ? skel : `<div class="empty"><b>The ${what} feed did not answer.</b><span>Nothing is shown rather than something old.</span><button type="button" class="chip" data-act="retry">Try again</button></div>`);
// the live event, else the next (a delayed one, or one the feed has not yet marked as started, stays as next)
const offRows = E => { const o = E.filter(e => e.state === "off" && (e.offWhy || e.seen) && Math.abs(Date.now() - t(e.start)) < 3 * 864e5); return o.length ? `<div class="list">${o.map(e => row(e)).join("")}</div>` : ""; };
// rows in a list that all share one competition: the competition goes once in the heading, the rows lose the line
const oneComp = E => { const c = [...new Set(E.map(e => e.comp).filter(Boolean))]; return c.length === 1 && E.length > 1 && E.every(e => e.comp) ? c[0] : null; };
const firstLiveOrNext = E => E.find(e => e.state === "live") || E.find(e => e.state === "next" && (t(e.start) > Date.now() - 6e4 || e.late || e.starting));

// why an item is in "Since you last looked", in the words of its sport
function whyNow(e, kind) {
  if (kind === "live") return "Now live";
  if (kind === "score") return e.sp === "football" || e.sp === "intl" ? `Goal, ${sideName(e, "a")} ${e.sa}–${e.sb} ${sideName(e, "b")}` : "Score moved on";
  if (e.sp === "f1") return e.top?.[0] ? `${last(e.top[0])} ${/qualif|shootout/i.test(e.session) ? "on pole" : "wins"}${e.provisional ? ", provisional" : ""}` : "Session over";
  const w = e.won ? sideName(e, e.won) : null;
  if (e.sp === "football" || e.sp === "intl") return `Full time, ${w ? `${w} won` : "a draw"}`;
  if (e.sp === "cricket") return `Result, ${w ? `${w} won${resultWord(e).match(/ by .+$/)?.[0] || ""}` : resultWord(e)}`;
  if (e.sp === "nba") return w ? `Final, ${w} won` : "Final";
  return w ? `Result, ${w} won` : "Result";
}

// ------------------------------------------------------------------ Today
// The day rail: yesterday to six days ahead, scrubbed by tap (the pill glides to the day). Today shows live, just
// finished, up next, what changed since you last looked, the latest results and the tables; any other day lists its
// fixtures and results in place.
function dayRail(all, sel) {
  const now = Date.now(), days = [-1, 0, 1, 2, 3, 4, 5, 6].map(i => dayKey(now + i * 864e5)), di = sel ? Math.max(0, days.indexOf(sel)) : 1;
  return `<nav class="rail" aria-label="Days, drag or swipe to change"><div class="rail-in" style="--di:${di}"><i class="rail-pill" aria-hidden="true"></i>${days.map((d, i) => {
    const ev = all.filter(e => dayKey(t(e.start)) === d && e.state !== "off" && !(e.sp === "f1" && !f1Kind(e.session))), dt = new Date(d + "T12:00:00+05:30").toISOString();
    const sps = [...new Set(ev.map(e => (e.sp === "intl" ? "football" : e.sp)))].slice(0, 4), on = sel ? d === sel : i === 1;
    return `<button type="button" class="day${i === 1 ? " today" : ""}${on ? " on" : ""}" data-ui="day" data-v="${i === 1 ? "" : d}" aria-pressed="${on}" aria-label="${esc(i === 1 ? "Today" : i === 0 ? "Yesterday" : fmt(dt, { weekday: "long" }))}, ${esc(fmt(dt, { day: "numeric", month: "long" }))}: ${ev.length} ${ev.length === 1 ? "event" : "events"}"${ev.length || i === 1 ? "" : " disabled"}><span class="dn">${i === 1 ? "Today" : i === 0 ? "Yest." : esc(fmt(dt, { weekday: "short" }))}</span><b class="tnum">${esc(fmt(dt, { day: "numeric" }))}</b><span class="dots">${sps.map(sp => `<i class="sp-${sp}"></i>`).join("")}</span></button>`;
  }).join("")}</div></nav>`;
}
export function viewHome() {
  const all = events(true), E = events(), now = Date.now(), ready = Object.keys(D).length > 0;
  const fresh = Object.values(D).some(x => x && !x.stale);
  const today = fmt(new Date(now).toISOString(), { weekday: "long" }) + " " + longDate(new Date(now).toISOString()).replace(/^\w+ /, "");
  if (!ready && S.lastLoad) return `<div class="page">${header("Today", `<b>${esc(today)}</b>`)}<div class="empty"><b>The feeds did not answer.</b><span>Nothing is shown rather than something old. Pull down or tap refresh to try again.</span></div></div>`;
  const sel = S.UI.day && S.UI.day !== dayKey(now) ? S.UI.day : null;
  const selD = sel ? new Date(sel + "T12:00:00+05:30").toISOString() : null;
  const head = header("Today", `<b>${esc(sel ? `Showing ${fmt(selD, { weekday: "long" })} ${shortDate(selD)}` : today)}</b>${S.lastLoad && fresh ? `<span>Updated ${hm(new Date(S.lastLoad).toISOString())}</span>` : ""}`, ["football", "madrid_hub", "f1_sessions", "crease", "tennis_players", "nba"]);
  if (!ready) return `<div class="page">${head}${skel}</div>`;
  const NAMES = [["Madrid", ["football", "madrid_hub"]], ["F1", ["f1_next", "f1_sessions"]], ["India", ["crease"]], ["Tennis", ["tennis_players"]], ["Warriors", ["nba"]]];
  const miss = S.lastLoad && !S.loading ? NAMES.filter(([, ks]) => ks.every(k => !D[k])).map(([n]) => n) : [];
  const missLine = miss.length ? `<p class="miss">No answer from the ${esc(miss.join(", ").replace(/, ([^,]*)$/, " and $1"))} feed${miss.length > 1 ? "s" : ""}. <button type="button" class="chip" data-act="retry">Try again</button></p>` : "";
  // another day: its events in place
  if (sel) {
    const list = all.filter(e => dayKey(t(e.start)) === sel && e.state !== "off" && !(e.sp === "f1" && !f1Kind(e.session) && e.id.startsWith("f1")));
    const dt = new Date(sel + "T12:00:00+05:30").toISOString();
    return `<div class="page">${head}${dayRail(all, sel)}${blk(esc(fmt(dt, { weekday: "long" }) + " " + shortDate(dt)), list.length ? `<div class="list">${list.map(e => row(e)).join("")}</div>` : " ", `<button type="button" class="chip" data-ui="day" data-v="">Back to today</button>`, "day")}</div>`;
  }
  const lives = E.filter(e => e.state === "live");
  // a live feed lost (a saved copy too old to believe), or a match called off today: a row, said plainly
  const odd = E.filter(e => e.state === "off" && (e.seen || e.offWhy) && Math.abs(now - t(e.start)) < 12 * 36e5);
  // just finished: inside three hours
  const just = E.filter(e => e.state === "done" && now - t(e.start) < 6 * 36e5 && now - t(e.start) > 0 && (e.sp !== "f1" || e.top)).filter(e => now - (t(e.start) + (e.mins || 120) * 6e4) < 3 * 36e5).reverse();
  // the next fixture per thing followed (national sides inside ten days); the rest under Later
  const per = new Map(), later = new Map();
  for (const e of E) {
    if (e.state !== "next" || (t(e.start) < now - 6e4 && !e.late && !e.starting && !e.due)) continue;
    if (per.has(e.key) || (e.sp === "intl" && t(e.start) - now > 10 * 864e5)) { if (!per.has(e.key) && !later.has(e.key)) later.set(e.key, e); continue; }
    per.set(e.key, e);
  }
  const ups = [...per.values()].sort((a, b) => t(a.start) - t(b.start)), top = lives.length ? null : ups[0], rest = ups.filter(e => e !== top);
  // since you last looked: what changed while the app was away, in words; nothing already on screen above it
  const onTop = new Set([...lives.map(e => e.id), ...just.map(e => e.id)]);
  const SL = sinceLast(E), items = SL.items.filter(x => !onTop.has(x.e.id) && (x.e.sp !== "f1" || x.e.top || x.kind === "live"));
  const slBlock = items.length ? blk("Since you last looked", `<div class="list">${items.map(({ e, kind }) => row(e, { why: whyNow(e, kind) })).join("")}</div>`, `<span class="note">since ${esc(when(new Date(SL.at).toISOString()))}</span>`, "since") : "";
  const slIds = new Set(items.map(x => x.e.id));
  // the latest results: the last per thing followed inside ten days, not already shown above
  const doneBy = new Map(), shown = new Set([...just.map(e => e.id), ...slIds]);
  for (const e of [...E].reverse()) if (e.state === "done" && now - t(e.start) < 10 * 864e5 && !doneBy.has(e.key) && (e.sp !== "f1" || e.top)) doneBy.set(e.key, e);
  const done = [...doneBy.values()].filter(e => !shown.has(e.id)).sort((a, b) => t(b.start) - t(a.start));
  // tournaments, series and championships
  const tours = [], TP = val("tennis_players")?.players || [];
  for (const ev of val("tennis")?.events || []) {
    if (t(ev.end) < now) continue;
    const st = TP.map(p => { const nx = p.next && same(p.next.event, ev.name) && t(p.next.when_utc) > now - 6 * 36e5 ? p.next : null, ls = p.last && same(p.last.event, ev.name) ? p.last : null; return nx ? `${last(p.name)} plays ${last(nx.opponent) || "TBC"}${nx.tbd || p.agree === false ? `, ${shortDate(nx.when_utc)}` : `, ${when(nx.when_utc)}`}` : ls ? `${last(p.name)} ${ls.won ? "through" : "out"}, ${ls.round || ""}` : null; }).filter(Boolean);
    if (st.length || ev.major) tours.push(li(`<span class="tile sp-tennis">${ICON.tennis}</span>`, esc(ev.name), esc(st.join(" · ") || ev.venue || ""), "", "#tennis"));
  }
  const C = val("crease");
  for (const X of [C?.main, ...(C?.also || [])].filter(Boolean)) tours.push(li(`<span class="tile sp-cricket">${ICON.cricket}</span>`, esc(X.name.replace(/,? \d{4}$/, "")), esc((X.formats || []).map(f => (f.score ? `${f.label} ${f.score}` : null)).filter(Boolean).join(" · ") || span(X.first, X.last)), "", "#cricket"));
  const ST = val("f1_standings");
  if (ST?.drivers?.length) { const me = ST.drivers.find(d => same(d.name, favDriver())), lead = ST.drivers[0]; tours.push(li(`<span class="tile sp-f1">${ICON.f1}</span>`, "Drivers’ championship", esc(`${last(lead.shown || lead.name)} leads on ${lead.points}${me && me !== lead ? ` · ${last(favDriver())} ${ordinal(me.pos)}, ${lead.points - me.points} behind` : ""}`), "", "#f1/standings")); }
  const TB = (val("club_stats")?.comps || []).find(c => c.key === "liga")?.rows?.find(r => same(r.team, club()));
  if (TB) tours.push(li(`<span class="tile sp-football">${ICON.football}</span>`, "La Liga", esc(`Madrid ${ordinal(TB.rank)}, ${TB.points} points from ${TB.played}`), "", "#football/table"));
  return `<div class="page">${head}${missLine}${dayRail(all, null)}
    ${lives.length || odd.some(e => e.seen) ? blk(lives.length ? "Live now" : "Live feed lost", lives.slice(0, 2).map(e => hero(e)).join("") + (lives.length > 2 ? `<div class="list">${lives.slice(2).map(e => row(e)).join("")}</div>` : "") + (odd.some(e => e.seen) ? `<div class="list">${odd.filter(e => e.seen).map(e => row(e)).join("")}</div>` : ""), "", "live") : ""}
    ${slBlock}
    ${just.length ? blk("Just finished", `<div class="list">${just.map(e => row(e, { extra: e.sp === "football" && goalsLine(e) ? `<span class="gl">${esc(goalsLine(e))}</span>` : "" })).join("")}</div>`, "", "just") : ""}
    ${top || rest.length || odd.some(e => !e.seen) ? blk("Up next", `${top ? hero(top) : ""}${rest.length || later.size || odd.some(e => !e.seen) ? `<div class="list">${odd.filter(e => !e.seen).map(e => row(e)).join("")}${rest.map(e => row(e)).join("")}${later.size ? moreBox(`Later · ${esc([...later.values()].map(e => e.who).join(", "))}`, [...later.values()].map(e => row(e)).join("")) : ""}</div>` : ""}`, "", "next") : ""}
    ${done.length ? blk("Latest results", `<div class="list">${done.slice(0, 6).map(e => row(e, { extra: e.sp === "football" && goalsLine(e) ? `<span class="gl">${esc(goalsLine(e))}</span>` : "" })).join("")}</div>`, "", "results") : ""}
    ${tours.length ? blk("Tournaments and tables", `<div class="list">${tours.join("")}</div>`) : ""}
    ${sources("football", "madrid_hub", "intl_hub", "crease", "f1_next", "f1_sessions", "tennis_players", "nba", "odds")}</div>`;
}

// ------------------------------------------------------------------ Madrid
const ZONE = { "knockout phase playoffs": "#8fd3a8", "round of 16|top 8|automatic": "#1f8a4c", "champions league": "#1f8a4c", "europa league": "#f0a04b", "conference": "#4b8fe0", "relegation": "#d1342f", "eliminated": "#b0b0b8" };
function pitch(xi) {
  const depth = p => { const s = String(p.pos || "").toUpperCase(); if (s === "G" || s === "GK") return 0; if (/^(CD|CB|SW|LB|RB|LWB|RWB|D)/.test(s)) return 1; if (/^(DM|CM|LM|RM|M)/.test(s)) return 2; if (/^(AM|LW|RW)/.test(s)) return 3; return 4; };
  const side = p => { const s = String(p.pos || "").toUpperCase(); return /^(LB|LWB|LW|LM)$/.test(s) ? 0 : /-L$/.test(s) ? 1 : /^(RB|RWB|RW|RM)$/.test(s) ? 4 : /-R$/.test(s) ? 3 : 2; };
  let lines = [0, 1, 2, 3, 4].map(d => xi.players.filter(p => depth(p) === d)).filter(l => l.length);
  const want = String(xi.formation || "").split("-").map(Number).filter(Boolean);
  if (want.length && want.reduce((a, b) => a + b, 0) === 10 && (lines.length - 1 !== want.length || lines.slice(1).some((l, i) => l.length !== want[i]))) {
    const out = xi.players.filter(p => depth(p) !== 0).sort((a, b) => depth(a) - depth(b) || side(a) - side(b)); lines = [xi.players.filter(p => depth(p) === 0)];
    let i = 0; for (const n of want) { lines.push(out.slice(i, i + n)); i += n; }
  }
  const L = lines.length, dots = lines.map((l, li2) => {
    const y = 90 - (li2 / Math.max(L - 1, 1)) * 78, sorted = [...l].sort((a, b) => side(a) - side(b));
    return sorted.map((p, i) => { const nm = String(p.short || p.name).replace(/^[A-Z]\. /, "").replace(/ Júnior$/, " Jr."); return `<div class="pl${nm.length > 8 ? " long" : ""}" style="left:${((i + 1) / (sorted.length + 1)) * 100}%;top:${y}%"><b class="tnum">${esc(p.shirt || "")}</b><span>${esc(nm)}</span></div>`; }).join("");
  }).join("");
  return `<div class="pitch" role="img" aria-label="${esc(xi.formation || "")}: ${esc(xi.players.map(p => p.name).join(", "))}"><svg class="lines" viewBox="0 0 68 80" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="64" height="76" rx="1"/><path d="M2 40h64"/><circle cx="34" cy="40" r="7"/><rect x="18" y="66" width="32" height="12"/><rect x="26" y="73" width="16" height="5"/><rect x="18" y="2" width="32" height="12"/><rect x="26" y="2" width="16" height="5"/></svg>${dots}</div>`;
}
export function viewFootball() {
  const H = val("madrid_hub"), F = val("football"), CS = val("club_stats"), cname = club(), UI = S.UI;
  const all = events(true), E = all.filter(e => e.sp === "football"), next = firstLiveOrNext(E);
  const offM = E.filter(e => e.state === "off" && (e.offWhy || e.seen) && Math.abs(Date.now() - t(e.start)) < 3 * 864e5);
  const liga = (CS?.comps || []).find(c => c.key === "liga"), me = liga?.rows?.find(r => same(r.team, cname));
  const form = (H?.results || []).slice(0, 5).reverse().map(m => ({ r: m.winner === "us" ? "W" : m.winner === "them" ? "L" : "D", t: `${m.home ? "v" : "at"} ${m.opponent} ${m.us}–${m.them}` }));
  const sub = [me ? `<b>${ordinal(me.rank)} in La Liga</b><span>${me.points} pts from ${me.played}</span>` : "", form.length ? formSquares(form, "Madrid form") : ""].join("");
  // the next match: both sides' last five and the meetings
  let preview = "";
  const PV = H?.preview;
  if (PV && next && next.mid === String(PV.match_id)) {
    const r = meetRecord(PV);
    const idOf = n => (same(n, cname) ? clubId() : PV.form.find(f => same(f.team, n))?.id || null);
    const mt = PV.meetings.map(m => li(`<span class="mtc">${mark(soccerMark(idOf(m.home), m.home), "s")}${mark(soccerMark(idOf(m.away), m.away), "s")}</span>`, `${esc(short(m.home))} <b class="tnum">${esc(m.hs)}–${esc(m.as)}</b> ${esc(short(m.away))}`, `${esc(m.competition || "")} · ${esc(shortDate(m.date))} ${esc(String(dayKey(t(m.date))).slice(0, 4))}`));
    preview = blk("Form and meetings", `<div class="card pv">${PV.form.map(tm => `<div class="pvf"><div class="pvt">${mark(soccerMark(tm.id, tm.team), "s")}<b>${esc(short(tm.team))}</b></div>${formSquares(tm.games.map(g => ({ r: g.result || "D", t: `${g.score || ""} ${g.at ? "at" : "v"} ${g.opponent}` })), `${tm.team} form`)}</div>`).join("")}</div>${mt.length ? `<div class="sub-h">Last ${r.w + r.d + r.l} meetings <span>Madrid ${r.w}W ${r.d}D ${r.l}L</span></div><div class="list">${mt.slice(0, 3).join("")}${mt.length > 3 ? moreBox(`${mt.length - 3} more`, mt.slice(3).join("")) : ""}</div>` : ""}`, "", "preview");
  }
  // the XI: the official one once announced, else the last starting XI
  let xi = "";
  const X = H?.xi;
  if (X?.players?.length === 11) {
    const official = X.kind === "official";
    xi = blk(official ? "Starting XI" : "Last starting XI", `<div class="card flush">${pitch(X)}<p class="foot pad">${official ? `${esc(X.formation || "")} · official XI v ${esc(X.opponent)}` : `${esc(X.formation || "")} · v ${esc(X.opponent)}, ${esc(shortDate(X.date))}`}</p>${X.bench?.length ? moreBox(official ? "Bench" : "Rest of that squad", `<p class="foot pad">${esc(X.bench.slice(0, 14).join(", "))}</p>`) : ""}</div>`, official ? `<span class="badge ok">Official</span>` : `<span class="note">Official XI not yet out</span>`, "xi");
  }
  const resE = E.filter(e => e.state === "done").reverse(), fxE = E.filter(e => e.state === "next" && e !== next), rc1 = oneComp(resE), fc1 = oneComp(fxE);
  const res = resE.map(e => row(e, { meta: !rc1, extra: goalsLine(e) ? `<div class="gl">${esc(goalsLine(e))}</div>` : "" }));
  const fx = fxE.map(e => row(e, { meta: !fc1 }));
  // tables and leaders
  const comps = (CS?.comps || []).filter(c => c.rows?.length), cur = comps.find(c => c.key === UI.table) || comps[0];
  let table = "", leaders = "";
  if (cur) {
    const rows = cur.rows, mi = rows.findIndex(r => same(r.team, cname));
    const zc = z => ZONE[Object.keys(ZONE).find(k => new RegExp(k, "i").test(z?.name || ""))] || z?.color || "var(--muted)";
    const zones = []; for (const r of rows) if (r.zone?.name && !zones.some(([n]) => n === r.zone.name)) zones.push([r.zone.name, zc(r.zone)]);
    const tr = r => `<tr class="${same(r.team, cname) ? "me" : ""}"><td class="pos tnum" style="--zone:${esc(r.zone ? zc(r.zone) : "transparent")}">${r.rank}</td><td class="team"><div>${mark(soccerMark(r.id, r.team), "s")}<span>${esc(follows().sport_app_short_teams?.[r.team] || r.short || r.team)}</span></div></td><td class="tnum">${r.played}</td><td class="tnum">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts tnum">${r.points}</td></tr>`;
    const head = `<thead><tr><th scope="col">#</th><th class="l" scope="col">Team</th><th scope="col">P</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>`;
    const show = rows.length > 12 ? [...new Set([...rows.slice(0, 4), ...rows.slice(Math.max(0, mi - 2), mi + 3)])] : rows;
    table = blk("Table", `${seg("table", comps.map(c => [c.key, sn(c.label)]), cur.key, "Competition")}<div class="list"><table class="tbl">${head}<tbody>${show.map((r, i) => (i && r.rank - show[i - 1].rank > 1 ? `<tr class="gap"><td colspan="5">···</td></tr>` : "") + tr(r)).join("")}</tbody></table>${show.length < rows.length ? moreBox("Full table", `<table class="tbl">${head}<tbody>${rows.map(tr).join("")}</tbody></table>`) : ""}${zones.length ? `<div class="legend">${zones.map(([n, c]) => `<span><i style="background:${esc(c)}"></i>${esc(n)}</span>`).join("")}</div>` : ""}</div>`, "", "table");
    const kinds = [["goals", "Goals"], ["assists", "Assists"], ["ratings", "Rating"]].filter(([k]) => cur[k]?.length), lk = kinds.find(([k]) => k === UI.leaders)?.[0] || kinds[0]?.[0];
    if (lk) {
      const L = cur[lk].slice(0, 8), mx = Math.max(...L.map(x => x.value)), rs = L.map(x => barRow(x.name, x.value, mx, { me: same(x.team, cname), sub: x.team, pos: x.rank, label: lk === "ratings" ? Number(x.value).toFixed(2) : x.value }));
      leaders = blk("Leaders", `${seg("leaders", kinds, lk, "Leader board")}<div class="list">${rs.slice(0, 5).join("")}${rs.length > 5 ? moreBox(`${rs.length - 5} more`, rs.slice(5).join("")) : ""}</div>`, "", "leaders");
    }
  }
  // the national sides: each one's next match and last result, as match rows
  const NT = val("intl_hub")?.teams || [];
  const nations = NT.length ? blk("National teams", NT.map(T => {
    const ev = all.filter(e => e.sp === "intl" && e.who === T.name), nx = ev.find(e => e.state === "next" || e.state === "live"), ls = [...ev].reverse().find(e => e.state === "done");
    const two = [nx, ls].filter(Boolean), c1 = oneComp(two);
    return two.length ? `<div class="sub-h">${mark(soccerMark(T.id, T.name), "s")}${esc(T.name)}${c1 ? ` <span>${esc(c1)}</span>` : ""}</div><div class="list">${two.map(e => row(e, { meta: !c1 })).join("")}</div>` : "";
  }).join(""), "", "nations") : "";
  return `<div class="page">${header(`<span class="ttl">${mark(soccerMark(clubId(), cname), "m")}${esc(cname)}</span>`, sub, ["football", "madrid_hub", "club_stats"])}
    ${jump([[next && "next", next?.state === "live" ? "Live" : "Next"], [xi && "xi", "XI"], [res.length && "results", "Results"], [cur && "table", "Table"], [leaders && "leaders", "Leaders"], [NT.length && "nations", "Nations"]])}
    ${waitOr(H || F, "Madrid")}
    ${next || offM.length ? blk(next?.state === "live" ? "Live" : "Next match", `${offM.length ? `<div class="list">${offM.map(e => row(e)).join("")}</div>` : ""}${next ? hero(next) : ""}`, "", "next") : ""}
    ${preview}${xi}
    ${blk("Results", list(res, 5, "results"), rc1 ? `<span class="note">${esc(rc1)}</span>` : "", "results")}
    ${blk("Fixtures", list(fx, 4, "fixtures"), fc1 ? `<span class="note">${esc(fc1)}</span>` : "", "fixtures")}
    ${table}${leaders}${nations}
    ${sources("football", "madrid_hub", "club_stats", "intl_hub", "odds")}</div>`;
}

// ------------------------------------------------------------------ F1
const fposCls = r => (!r ? "none" : !r.finished ? "out" : r.pos === 1 ? "p1" : r.pos === 2 ? "p2" : r.pos === 3 ? "p3" : "");
const CLASS = { R: "DNF", D: "DSQ", E: "EXC", W: "WD", F: "DNQ", N: "NC" };
const fpos = (r, title = "") => `<span class="fpos ${fposCls(r)} tnum" title="${esc(title || r?.race || "")}">${!r ? "·" : r.finished ? r.pos : esc(CLASS[r.text] || r.text || "DNF")}</span>`;
const CC = { Netherlands: "NED", Italy: "ITA", Spain: "ESP", Azerbaijan: "AZE", Malaysia: "MAS", Singapore: "SIN", USA: "USA", "United States": "USA", Mexico: "MEX", Brazil: "BRA", UK: "GBR", "United Kingdom": "GBR", Belgium: "BEL", Hungary: "HUN", Austria: "AUT", Canada: "CAN", Monaco: "MON", Japan: "JPN", China: "CHN", Bahrain: "BHR", "Saudi Arabia": "KSA", Australia: "AUS", Qatar: "QAT", UAE: "UAE", "United Arab Emirates": "UAE", Portugal: "POR", France: "FRA", Germany: "GER", Argentina: "ARG", Thailand: "THA", "South Africa": "RSA", Korea: "KOR" };
const raceCode = r => CC[r.country] || String(r.country || r.name).slice(0, 3).toUpperCase();
export function viewF1() {
  const N = val("f1_next"), R = N?.race, ST = val("f1_standings"), HB = val("f1_hub"), MK = val("f1_market"), LR = val("f1_last"), fav = favDriver(), UI = S.UI;
  const drivers = ST?.drivers || [], me = drivers.find(d => same(d.name, fav)), lead = drivers[0];
  const all = events(true).filter(e => e.sp === "f1"), sess = all.filter(e => e.id.startsWith("f1")), cal = all.filter(e => e.id.startsWith("gp"));
  const focus = firstLiveOrNext(sess.filter(e => f1Kind(e.session))) || null;
  const weekend = R && (focus || sess.length) ? blk(focus?.state === "live" ? "Live now" : "This weekend", `${focus ? hero(focus) : ""}<div class="list">${sess.filter(e => e !== focus).map(e => sessionRow(e, { gp: false })).join("")}</div>`, `<span class="note">Round ${R.round}</span>`, "weekend") : "";
  // Verstappen: the championship, this weekend's sessions (where he finished, else his chance), his record here
  let watch = "";
  if (me || HB) {
    const here = [...(HB?.favourite_here || [])].sort((a, b) => a.season - b.season).slice(-7), best = here.filter(r => r.pos).sort((a, b) => a.pos - b.pos)[0];
    const SH = { "Sprint Qualifying": "SQ", Qualifying: "Quali" };
    const steps = sess.filter(e => f1Kind(e.session)).map(e => {
      let v = "";
      if (e.state === "done" && e.top) { const i = e.top.findIndex(n => same(n, last(fav))); v = (i >= 0 ? fpos({ pos: i + 1, finished: true }) : `<span class="dim">Not top 3</span>`) + (e.provisional ? `<small class="prov">Prov.</small>` : ""); }
      else if (e.state === "live" && e.liveOrder) { const i = e.liveOrder.findIndex(n => same(last(n), last(fav))); if (i >= 0) v = `<span class="lvp">P${i + 1}</span>`; }
      else if (e.state === "live") { const i = (e.liveTop || []).findIndex(n => same(last(n), last(fav))); v = i >= 0 ? `<span class="lvp">P${i + 1}</span>` : live(""); }
      else if (e.state === "next") { const m = sessionMarket(e.session, e.start), o = m?.outcomes.find(x => same(x.name, fav)); if (o) v = `<b class="pct tnum">${Math.round(o.prob)}%</b><small class="prov">${esc(m.source || "")}</small>`; }
      return v ? `<div class="step${e.state === "done" ? " got" : ""}${e.state === "live" ? " on" : ""}"><span>${esc(SH[e.session] || e.session)}</span>${v}</div>` : "";
    }).join("");
    watch = blk(esc(follows().f1_driver?.label || `${last(fav)} watch`), `<div class="card"><div class="who">${me?.colour ? `<i style="background:${esc(me.colour)}"></i>` : ""}<div><div class="who-n">${esc(fav)}</div><div class="t2">${esc(me?.team || "")}${me ? ` · ${me.wins} win${me.wins === 1 ? "" : "s"} this season` : ""}</div></div></div>
      ${me ? `<div class="stats"><div class="stat"><b class="tnum">${ordinal(me.pos)}</b><span>Standing</span></div><div class="stat"><b class="tnum">${me.points}</b><span>Points</span></div><div class="stat"><b class="tnum">${me === lead ? "Lead" : lead.points - me.points}</b><span>${me === lead ? "Top of the table" : `Behind ${esc(last(lead.shown || lead.name))}`}</span></div></div>` : ""}
      ${steps ? `<div class="sub-h">This weekend</div><div class="steps">${steps}</div>` : ""}
      ${here.length ? `<div class="sub-h">At ${esc(HB.race?.circuit || "this track")}${best ? ` <span>best ${ordinal(best.pos)}, in ${esc(here.filter(r => r.pos === best.pos).map(r => r.season).join(", "))}</span>` : ""}</div><div class="fgrid yrs">${here.map(r => `<span class="yr">${fpos({ pos: r.pos, finished: /^\d+$/.test(r.text), text: r.text }, `${r.season}: from ${ordinal(r.grid || 0)} on the grid, ${r.status}`)}<small class="tnum">'${String(r.season).slice(2)}</small></span>`).join("")}</div>` : ""}</div>`, "", "max");
  }
  // the markets for each session still to come, the race first
  const segs = [["race", "Race"], ["qualifying", "Qualifying"], ["sprint", "Sprint"], ["sprint_qualifying", "Sprint quali"]].map(([k, n]) => {
    if (k === "race") { const m = raceMarket(); return m ? { k, n, m, other: (MK?.markets || []).find(x => x !== m) } : null; }
    const e = sess.find(x => f1Kind(x.session) === k && x.state === "next"), m = e && oddsFor("f1", null, e.start, k); return m ? { k, n, m } : null;
  }).filter(Boolean);
  const cm = segs.find(x => x.k === UI.f1mkt) || segs[0];
  const nameOf = n => drivers.find(d => same(d.name, n) || same(d.shown, n))?.shown || n;
  const expect = cm ? blk("What the markets expect", `${seg("f1mkt", segs.map(x => [x.k, x.n]), cm.k, "Session")}<div class="card">${rankList(cm.m.outcomes, { me: fav, nameFn: nameOf })}<p class="foot">${esc(cm.m.title || `${cm.n} winner`)} · <a href="${esc(cm.m.url)}" target="_blank" rel="noopener">${esc(cm.m.source)}</a>${(() => { const a = D[cm.k === "race" ? "f1_market" : "odds"]?.as_of; return a ? ` · ${esc(dayKey(t(a)) === dayKey(Date.now()) ? hm(a) : `${shortDate(a)} ${hm(a)}`)}` : ""; })()}${cm.other?.outcomes?.[0] ? ` · ${esc(cm.other.source)} has ${esc(last(nameOf(cm.other.outcomes[0].name)))} ${Math.round(cm.other.outcomes[0].prob)}%` : ""}</p></div>`, "", "markets") : "";
  // the circuit over the years
  let track = "";
  if (HB?.winners?.length) {
    const W = HB.winners, fromPole = W.filter(w => w.grid === 1).length, top = HB.tally.slice(0, 5), mx = top[0]?.wins || 1;
    const rows = W.map(w => li(`<span class="yr tnum">${esc(w.season)}</span>`, esc(w.driver), esc(`${w.team || ""}${w.grid ? ` · ${w.grid === 1 ? "from pole" : `from ${ordinal(w.grid)}`}` : ""}`)));
    track = blk(esc(HB.race?.circuit || "This track"), `<div class="stats tiles"><div class="stat"><b class="tnum">${W.length}</b><span>Races held</span></div><div class="stat"><b class="tnum">${fromPole}</b><span>Won from pole</span></div><div class="stat"><b class="tnum">${new Set(W.map(w => w.driver)).size}</b><span>Different winners</span></div></div>
      <div class="sub-h">Most wins here</div><div class="list">${top.map(x => barRow(x.driver, x.wins, mx, { me: same(x.driver, fav) })).join("")}</div>
      <div class="sub-h">Winners, latest first</div><div class="list">${rows.slice(0, 3).join("")}${rows.length > 3 ? moreBox(`All ${rows.length} winners`, rows.slice(3).join("")) : ""}</div>`, "", "track");
  }
  // form: the top six (and Verstappen) in each of the last five races
  let form = "";
  if (HB?.form?.drivers?.length && drivers.length) {
    const rounds = HB.form.rounds, pick = drivers.slice(0, 6); if (me && !pick.includes(me)) pick.push(me);
    const rowsF = pick.map(d => ({ d, f: HB.form.drivers.find(x => x.code === d.code || same(x.name, d.name)) })).filter(x => x.f);
    form = blk("Form", `<div class="list formt"><div class="fr hd"><span class="ps"></span><span class="nm"></span><div class="fgrid">${rounds.map(r => `<span class="fpos none rh" title="${esc(r.name)}">${esc(raceCode(r))}</span>`).join("")}</div></div>${rowsF.map(({ d, f }) => `<div class="fr${d === me ? " me" : ""}"><span class="ps tnum">${d.pos}</span><span class="nm">${d.colour ? `<i style="background:${esc(d.colour)}"></i>` : ""}${esc(last(d.shown || d.name))}</span><div class="fgrid">${rounds.map(r => fpos(f.results.find(x => x.round === r.round))).join("")}</div></div>`).join("")}</div><p class="foot">Finishing position in each race, oldest to latest: ${esc(rounds.map(r => `${raceCode(r)} ${r.name.replace(/ Grand Prix/, " GP")}`).join(", "))}. DNF: did not finish. A dot: not in the race.</p>`, "", "form");
  }
  // standings
  let table = "";
  if (drivers.length) {
    const isD = UI.f1table !== "constructors", L = isD ? drivers : ST.constructors || [], mx = L[0]?.points || 1;
    const rowOf = x => barRow(isD ? x.shown || x.name : x.name, x.points, mx, { me: isD && same(x.name, fav), pos: x.pos, colour: x.colour || "" });
    const head = L.slice(0, 6), mine = isD && me && !head.includes(me) ? [me] : [], rest = L.filter(x => !head.includes(x) && !mine.includes(x));
    table = blk("Standings", `${seg("f1table", [["drivers", "Drivers"], ["constructors", "Teams"]], isD ? "drivers" : "constructors", "Standings")}<div class="list">${head.map(rowOf).join("")}${mine.map(rowOf).join("")}${rest.length ? moreBox(`The other ${rest.length}`, rest.map(rowOf).join("")) : ""}</div><p class="foot">After round ${ST.round}${ST.prior ? ` of ${esc(ST.season)} (final)` : ""}</p>`, "", "standings");
  }
  // the last race
  let lastRace = "";
  if (LR?.results?.length) {
    const rr = LR.results.map(r => li(`<span class="fpos ${r.pos <= 3 ? "p" + r.pos : ""} tnum">${r.pos}</span>${r.colour ? `<i class="stripe" style="background:${esc(r.colour)}"></i>` : ""}`, esc(r.shown || r.name), esc(r.team || ""), `<span class="t2 num">${esc(r.time || r.status || "")}</span>`));
    lastRace = blk("Last race", `<div class="sub-h">${esc(LR.flag || "")} ${esc(gpName(LR.name))} <span>${/ in /.test(LR.name) ? `held in ${esc(LR.name.replace(/^.* in /, ""))} · ` : ""}${esc(shortDate(LR.date))}</span></div><div class="list">${rr.slice(0, 3).join("")}${moreBox("Full result", rr.slice(3).join(""))}</div>`, "", "last");
  }
  return `<div class="page">${header("Formula 1", R ? `<b>${esc(R.flag || "")} ${esc(gpName(R.name))}</b><span>${esc(R.circuit || "")}</span>` : "", ["f1_next", "f1_sessions", "f1_standings", "f1_hub"])}
    ${jump([[weekend && "weekend", "Weekend"], [watch && "max", last(fav)], [expect && "markets", "Markets"], [track && "track", "Track"], [form && "form", "Form"], [table && "standings", "Standings"], [cal.length && "calendar", "Calendar"]])}
    ${waitOr(R || ST, "F1")}
    ${weekend}${watch}${expect}${track}${form}${table}${lastRace}
    ${cal.length ? blk("Coming up", `<div class="list">${cal.map(e => sessionRow(e)).join("")}</div>`, "", "calendar") : ""}
    ${sources("f1_next", "f1_sessions", "f1_standings", "f1_hub", "f1_market", "odds", "f1_last")}</div>`;
}

// ------------------------------------------------------------------ India
export function viewCricket() {
  const C = val("crease"), E = events(true).filter(e => e.sp === "cricket"), next = firstLiveOrNext(E), done = E.filter(e => e.state === "done").slice(-1)[0], off = offRows(E);
  const byId = new Map(E.map(e => [e.id, e]));
  const seriesBlock = X => blk(esc(X.name.replace(/,? \d{4}$/, "")), (X.formats || []).map(f => `<div class="sub-h">${esc(f.label || f.format)}${f.score ? ` <span class="badge sp-cricket">${esc(f.score)}</span>` : ""}</div><div class="list">${(f.matches || []).map(m => byId.get("in" + m.id)).filter(Boolean).map(e => row(e)).join("")}</div>`).join(""), `<span class="note">${esc(span(X.first, X.last))}</span>`, "series");
  const series = [C?.main, ...(C?.also || [])].filter(Boolean).map(seriesBlock).join("");
  const A = C?.after;
  const after = A?.formats ? blk(`Next: ${esc(A.name.replace(/,? \d{4}$/, ""))}`, A.formats.map(f => { const ms = (f.matches || []).map(m => byId.get("in" + m.id)).filter(Boolean); return ms.length ? moreBox(`${ms.length} ${esc(f.label || f.format)} · ${esc(span(ms[0].start, ms.at(-1).start))}`, `<div class="list">${ms.map(e => row(e)).join("")}</div>`) : ""; }).join(""), `<span class="note">From ${esc(shortDate(A.first))}</span>`, "after") : "";
  return `<div class="page">${header("India", C?.main ? `<b>${esc(C.main.name.replace(/,? \d{4}$/, ""))}</b>` : "", ["crease"])}
    ${waitOr(C, "cricket")}
    ${next || off ? blk(next?.state === "live" ? "Live" : "Next match", off + (next ? hero(next) : ""), "", "next") : ""}
    ${done ? blk("Last result", `<div class="list">${row(done, { extra: cricketCard(done) })}</div>`, "", "last") : ""}
    ${series}${after}
    ${sources("crease", "odds")}</div>`;
}

// ------------------------------------------------------------------ Tennis
export function viewTennis() {
  const TP = val("tennis_players")?.players || [], EV = val("tennis")?.events || [], now = Date.now(), E = events().filter(e => e.sp === "tennis");
  const cards = TP.map(p => {
    const nx = E.find(e => e.player === p.name && (e.state === "next" || e.state === "live")), offT = offRows(E.filter(e => e.player === p.name)), ls = E.find(e => e.player === p.name && e.state === "done"), rk = atp(p.name);
    const status = p.next ? `${sn(p.next.event)} · ${p.next.round || ""}` : p.last ? `${sn(p.last.event)} · ${p.last.won ? "won" : "out in"} ${p.last.round || ""}` : "";
    const then = nx?.then ? `<div class="then"><span class="k">If he wins</span><span>${nx.then.round ? `${esc(nx.then.round)} v ` : "v "}${(nx.then.opponent ? [nx.then.opponent] : nx.then.from).map(n => `<span class="nw">${esc(n)}${atp(n)?.rank ? ` <span class="dim">(${atp(n).rank})</span>` : ""}</span>`).join(" or ")}</span></div>` : "";
    return `<section class="blk"><div class="who-h">${mark({ t: "player", name: p.name }, "l")}<div><h2>${esc(p.name)}</h2><div class="t2">${rk?.rank ? `<b class="tnum">No. ${rk.rank}</b>${rk.points ? ` · ${rk.points.toLocaleString("en-IN")} pts` : ""}${status ? " · " : ""}` : ""}${esc(status).replace(/(out in|won|Round) /g, "$1 ")}</div></div></div>
      ${offT}${nx ? hero(nx) : ""}${then}${ls ? `<div class="list">${row(ls, { meta: false })}</div>` : ""}</section>`;
  }).join("");
  const inEv = ev => TP.some(p => (p.next && same(p.next.event, ev.name)) || (p.last && same(p.last.event, ev.name)));
  const tours = EV.filter(ev => t(ev.end) > now - 864e5 && (inEv(ev) || ev.major)).map(ev => {
    const going = t(ev.start) <= now;
    const who = TP.map(p => { const inN = p.next && same(p.next.event, ev.name), inL = p.last && same(p.last.event, ev.name); return inN || inL ? `<span class="badge ${inN || p.last.won ? "sp-tennis" : ""}">${esc(last(p.name))} · ${inN ? "still in" : p.last.won ? "through" : "out"}</span>` : ""; }).join(" ");
    return li("", `${esc(ev.name)}${ev.major ? " · Grand Slam" : ""}`, `${esc(ev.venue || "")} · ${going ? "until" : "from"} ${esc(shortDate(going ? ev.end : ev.start))}${who ? `<span class="chips">${who}</span>` : ""}`, going ? `<span class="badge">Under way</span>` : "", "", "wrap");
  }).join("");
  const TH = val("tennis_hub"), RK = (TH?.ranks || []).filter(r => r.rank), mine = (follows().tennis_players || []).map(atp).filter(r => r?.rank);
  const top = RK.slice(0, 10); for (const m of mine) if (!top.includes(m)) top.push(m);
  const rankings = top.length ? blk("ATP rankings", `<div class="list">${top.map(r => li(`<span class="rkn tnum">${r.rank}</span>${mark({ t: "player", name: r.name }, "m")}`, esc(r.name), r.points ? `<span class="tnum">${r.points.toLocaleString("en-IN")} points</span>` : "", "", "", mine.includes(r) ? "me" : "")).join("")}</div>`, TH?.date ? `<span class="note">Official list of ${esc(shortDate(TH.date + "T12:00:00Z"))}</span>` : `<span class="note">ESPN's order</span>`, "rankings") : "";
  return `<div class="page">${header("Tennis", "", ["tennis_players", "tennis"])}
    ${waitOr(TP.length, "tennis")}${cards}
    ${tours ? blk("Tournaments", `<div class="list">${tours}</div>`) : ""}
    ${rankings}
    ${sources("tennis_players", "tennis", "tennis_hub", "odds")}</div>`;
}

// ------------------------------------------------------------------ Warriors
export function viewNba() {
  const B = val("nba"), E = events().filter(e => e.sp === "nba"), next = firstLiveOrNext(E), done = E.filter(e => e.state === "done").slice(-1)[0], off = offRows(E);
  const schedE = E.filter(e => e.state === "next" && e !== next), sc1 = oneComp(schedE), sched = schedE.map(e => row(e, { meta: !sc1 }));
  const op = B?.opener;
  const opener = op ? blk("Opening night", `<div class="list">${row({ plain: true,  sp: "nba", id: "op" + op.id, start: op.date, state: "next", a: op.home ? nbaTeam() : op.opponent, b: op.home ? op.opponent : nbaTeam(), ma: { t: "nba", abbr: op.home ? nbaAbbr() : op.opponent_abbr, name: op.home ? nbaTeam() : op.opponent }, mb: { t: "nba", abbr: op.home ? op.opponent_abbr : nbaAbbr(), name: op.home ? op.opponent : nbaTeam() }, comp: "Regular-season opener", href: "#nba" })}</div>`) : "";
  const W = B?.west ? blk("Western Conference", `<div class="list"><table class="tbl"><thead><tr><th scope="col">#</th><th class="l" scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">GB</th></tr></thead><tbody>${B.west.map(r => `<tr class="${same(r.team, nbaTeam()) ? "me" : ""}"><td class="pos tnum">${r.rank}</td><td class="team"><div>${mark({ t: "nba", abbr: r.abbr, name: r.team }, "s")}<span>${esc(r.team)}</span></div></td><td class="tnum">${r.wins}</td><td class="tnum">${r.losses}</td><td class="tnum">${esc(r.gb ?? "")}</td></tr>`).join("")}</tbody></table></div>`) : "";
  return `<div class="page">${header(`<span class="ttl">${mark({ t: "nba", abbr: nbaAbbr(), name: nbaTeam() }, "m")}Warriors</span>`, B ? `<b>${B.in_season ? "Regular season" : "Preseason"}</b>` : "", ["nba"])}
    ${waitOr(B, "Warriors")}
    ${next || off ? blk(next?.state === "live" ? "Live" : "Next game", off + (next ? hero(next) : ""), "", "next") : ""}
    ${opener}
    ${done ? blk("Last result", `<div class="list">${row(done, { extra: done.tops ? `<div class="gl">${done.tops.map(x => `${esc(last(x.name))} ${x.points} pts`).join(" · ")}</div>` : "" })}</div>`) : ""}
    ${sched.length ? blk("Schedule", `<div class="list">${sched.join("")}</div>`, sc1 ? `<span class="note">${esc(sc1)}</span>` : "") : ""}
    ${W}
    ${sources("nba", "odds")}</div>`;
}
export const VIEWS = { home: viewHome, football: viewFootball, f1: viewF1, cricket: viewCricket, tennis: viewTennis, nba: viewNba };
export const TITLES = { home: "Today", football: "Real Madrid", f1: "Formula 1", cricket: "India", tennis: "Tennis", nba: "Warriors" };
