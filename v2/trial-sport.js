// ================================================================ THE TRIAL'S SPORT MODULE (items 6 and 7)
// (6) Paddock Notes opens with a Race Weekend card (a countdown to lights out, the circuit map, the sessions by day in IST
// with the circuit's local time, the next one marked; ESPN's own state marks a session live, so a late start or an
// overrun reads right; a finished session names its quickest driver, or its winner, in the team's colour with the lap,
// and where Max finished, each only where two sources agree: lib/look-sport.js look_f1_weekend) and a Paddock Chatter
// card (the newest worthwhile posts on r/formula1 and r/F1Technical, through Arctic Shift since Reddit refuses servers;
// posts naming Max or his team first and tagged; look_f1_chatter, hidden with fewer than three posts). The old session
// table goes; the market's view, Max Watch, the race ahead, the stories, the standings and the calendar stay.
// (7) Madridismo opens with a Last Result card (crests, score, scorers, a Match centre button to /match) and a Title Race
// card (points after each league match for Madrid and the leader, or the runner-up when Madrid lead; look_title_race),
// then the paper's own fixtures, form and tables. Each card draws only from good data and hides otherwise.
TRIAL_KEYS.push(["look_f1_chatter", ""], ["look_f1_weekend", ""], ["look_title_race", ""], ["look_last_match", ""]);

// The circuit's own clock, from an IANA zone by place (never a guessed offset). A place not listed shows IST only.
const TSP_ZONE_PLACE = { melbourne: "Australia/Melbourne", "albert park": "Australia/Melbourne", miami: "America/New_York", austin: "America/Chicago", "las vegas": "America/Los_Angeles", montreal: "America/Toronto", "montréal": "America/Toronto", imola: "Europe/Rome", monza: "Europe/Rome", "mexico city": "America/Mexico_City", "são paulo": "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo", madrid: "Europe/Madrid", barcelona: "Europe/Madrid", "montmeló": "Europe/Madrid", "kuala lumpur": "Asia/Kuala_Lumpur", sepang: "Asia/Kuala_Lumpur" };
const TSP_ZONE_COUNTRY = { qatar: "Asia/Qatar", uae: "Asia/Dubai", "united arab emirates": "Asia/Dubai", bahrain: "Asia/Bahrain", "saudi arabia": "Asia/Riyadh", australia: "Australia/Melbourne", japan: "Asia/Tokyo", china: "Asia/Shanghai", italy: "Europe/Rome", monaco: "Europe/Monaco", spain: "Europe/Madrid", canada: "America/Toronto", austria: "Europe/Vienna", uk: "Europe/London", "united kingdom": "Europe/London", "great britain": "Europe/London", belgium: "Europe/Brussels", hungary: "Europe/Budapest", netherlands: "Europe/Amsterdam", azerbaijan: "Asia/Baku", singapore: "Asia/Singapore", mexico: "America/Mexico_City", brazil: "America/Sao_Paulo", portugal: "Europe/Lisbon", malaysia: "Asia/Kuala_Lumpur", germany: "Europe/Berlin", france: "Europe/Paris", turkey: "Europe/Istanbul" };
// The USA has several zones: only the listed places get a local time there.
const tspZoneOk = z => { try { new Intl.DateTimeFormat("en-GB", { timeZone: z }); return true; } catch { return false; } };
function tspZone(race) {
  const p = String(race?.locality || "").toLowerCase(), c = String(race?.country || "").toLowerCase();
  const z = TSP_ZONE_PLACE[p] || (c === "usa" || c === "united states" ? null : TSP_ZONE_COUNTRY[c]);
  return z && tspZoneOk(z) && z !== TZ ? z : null;
}
const tspDay = (iso, tz = TZ) => fmt(iso, { weekday: "short", day: "numeric", month: "short" }, tz).replace(/,/g, "");
const tspTime = (iso, tz = TZ) => fmt(iso, { hour: "2-digit", minute: "2-digit" }, tz);

// ---------- the countdown: days, hours, minutes and seconds to lights out (ticks every second while shown) ----------
const tspCdParts = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60]; };
const TSP_CD_UNITS = ["Days", "Hrs", "Min", "Sec"];
function tspCountdown(iso) {
  const p = tspCdParts(Date.parse(iso) - Date.now());
  return `<div class="tsp-cd" data-tcd="${esc(iso)}" role="timer" aria-label="Time until lights out">${p.map((v, i) => `<span class="tsp-cdb"><b class="tnum">${String(v).padStart(2, "0")}</b><small>${TSP_CD_UNITS[i]}</small></span>`).join("")}</div>`;
}
let tspTimer = 0;
function tspTick() {
  const els = document.querySelectorAll("[data-tcd]");
  if (!els.length) { clearInterval(tspTimer); tspTimer = 0; return; }
  for (const el of els) {
    const ms = Date.parse(el.dataset.tcd) - Date.now();
    if (ms <= 0) { paintSoon(); continue; }
    tspCdParts(ms).forEach((v, i) => { const b = el.children[i]?.firstChild; const t = String(v).padStart(2, "0"); if (b && b.textContent !== t) b.textContent = t; });
  }
}
function tspStartTimer() { if (!tspTimer && document.querySelector("[data-tcd]")) tspTimer = setInterval(tspTick, 1000); }
TRIAL_PAINT.push(tspStartTimer);

// ---------- (6) the Race Weekend card ----------
// look_f1_weekend's session for one of the card's (Jolpica's "Sprint Shootout" is the same session), when the feed is
// about this weekend
const tspSessName = n => (/^sprint (shootout|qualifying)$/i.test(n) ? "Sprint Qualifying" : n);
function tspWeekendFeed(race) {
  const W = LIVE.look_f1_weekend?.value;
  return W?.sessions?.length && W.name === race.name && String(W.season) === String(race.season) ? W : null;
}
// A driver's three-letter code and team colour from the championship table (F1's colours, via OpenF1), by surname
const tspSur = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().split(/\s+/).pop().toLowerCase();
function tspDriver(sur) {
  const d = (LIVE.f1_standings?.value?.drivers || []).find(x => tspSur(x.name) === tspSur(sur) || tspSur(x.shown) === tspSur(sur));
  return d ? { code: d.code || null, colour: d.colour || null, name: f1Name(d) } : null;
}
// the quickest (or the winner) of a finished session, and Max's place, as "▌ANT 1:22.400 · VER 3rd"
function tspTop(ws, fallback, isRace) {
  const who = CFG.follows.f1_driver.name, me = tspSur(who);
  const t = ws?.top || (fallback ? { name: fallback } : null);
  if (!t?.name) return "";
  const d = tspDriver(t.name), code = t.code || d?.code || t.name.slice(0, 3).toUpperCase(), colour = /^#[0-9a-f]{6}$/i.test(t.colour || "") ? t.colour : d?.colour || "";
  const mine = tspSur(t.name) === me;
  const label = `${isRace ? "Won by" : "Quickest"} ${d?.name || t.name}${t.time ? `, ${t.time}` : ""}`;
  const max = !mine && ws?.max?.pos ? `<span class="tsp-mx">${esc((tspDriver(who)?.code) || lastName(who).slice(0, 3).toUpperCase())} ${esc(ordinal(ws.max.pos))}</span>` : "";
  return `<span class="tsp-top${mine ? " me" : ""}" title="${esc(label)}"><span class="tsp-tv" aria-hidden="true"><i${colour ? ` style="background:${esc(colour)}"` : ""}></i><b>${esc(code)}</b>${t.time ? `<span class="tnum">${esc(t.time)}</span>` : isRace ? `<span>won</span>` : ""}</span><span class="vh">${esc(label)}</span></span>${max}`;
}
function tspRaceWeekend(N) {
  const race = N?.race, ss = race?.sessions || [];
  if (!race || !ss.length || ss.some(s => !s.start || isNaN(Date.parse(s.start)))) return "";
  const n = Date.now(), zone = tspZone(race), place = race.locality || race.circuit || "local", W = tspWeekendFeed(race);
  const wsOf = s => W?.sessions.find(x => x.name === tspSessName(s.name) && Math.abs(Date.parse(x.start) - Date.parse(s.start)) < 12 * 36e5) || null;
  // ESPN's state first (a late start or an overrun is still on; "End of Session" is over), else the clock
  const st = s => { const w = wsOf(s); if (w?.state === "in") return "on"; if (w?.state === "post") return "done"; const k = stateOf({ start: Date.parse(s.start), end: Date.parse(s.start) + (s.minutes || 60) * 6e4 }, n); return w?.state === "pre" && k === "done" ? "next" : k; };
  const raceS = ss.find(s => /^race$/i.test(s.name)) || ss.at(-1);
  const nextS = ss.find(s => st(s) !== "done");
  const raceState = st(raceS);
  // the countdown, or the race live, or nothing once it is over (the card then shows the weekend as done)
  const hero = raceState === "next" && raceS.time_confirmed !== false && Date.parse(raceS.start) > n
    ? `${tspCountdown(raceS.start)}<p class="tsp-cdl">Until lights out · <span class="tnum">${esc(tspDay(raceS.start))}, ${esc(tspTime(raceS.start))} IST${zone ? ` (${esc(tspTime(raceS.start, zone))} ${esc(place)})` : ""}</span></p>`
    : raceState === "on" ? `<p class="tsp-cdlive"><span class="live"><i></i>Live</span> The race is on</p>` : "";
  const T = race.track, img = T?.image && /^https:\/\/media\.formula1\.com\//.test(T.image) ? T.image : W?.map && /^https:\/\/media\.formula1\.com\//.test(W.map) ? W.map : "";
  const map = img ? `<img class="tsp-track" src="${esc(img)}" alt="${esc(`${T?.circuit || race.locality || ""} circuit map`)}" loading="lazy" decoding="async">` : "";
  // the paper's own agreed top three (lib/live.js f1_sessions) stands in for a session the weekend feed has no top for
  const agreed = s => (LIVE.f1_sessions?.value?.results || []).find(x => x.name === s.name && Math.abs(Date.parse(x.start) - Date.parse(s.start)) < 6e5)?.top?.[0] || null;
  // sessions under their IST day; the local time beside each, with its own day when that differs
  const days = [];
  for (const s of ss) { const d = tspDay(s.start); (days.at(-1)?.d === d ? days.at(-1) : (days.push({ d, list: [] }), days.at(-1))).list.push(s); }
  const row = s => {
    const k = st(s), on = s === nextS && k !== "on", tbc = s.time_confirmed === false, ws = wsOf(s);
    const loc = zone && !tbc ? (tspDay(s.start, zone) === tspDay(s.start) ? tspTime(s.start, zone) : `${tspDay(s.start, zone).split(" ")[0]} ${tspTime(s.start, zone)}`) : "";
    const top = k === "done" ? tspTop(ws, agreed(s), /^(sprint|race)$/i.test(s.name)) : "";
    const late = on && ws?.state === "pre" && Date.parse(s.start) < n;
    const tag = k === "on" ? ` <span class="live"><i></i>Live</span>` : late ? ` <span class="tsp-in">delayed</span>` : on && !tbc ? ` <span class="tsp-in">in <span data-until="${esc(s.start)}" data-min="${s.minutes || 60}">${esc(cd(Date.parse(s.start) - n))}</span></span>` : k === "done" && !top ? ` <small class="tsp-done">done</small>` : "";
    return `<li class="tsp-s${on || k === "on" ? " on" : ""}${k === "done" ? " done" : ""}"><span class="tsp-sn"><span class="tsp-nm">${esc(s.name)}${tag}</span>${top ? `<span class="tsp-tops">${top}</span>` : ""}</span><span class="tsp-st tnum">${tbc ? "TBC" : `<b>${esc(tspTime(s.start))} IST</b>${loc ? `<small>${esc(loc)} ${esc(place)}</small>` : ""}`}</span></li>`;
  };
  const sprint = ss.some(s => /^sprint$/i.test(s.name));
  const sessions = `<div class="tsp-sess"><div class="tsp-k">Race weekend${sprint ? " <span>Sprint weekend</span>" : ""}${watchTag({ entity: "f1" })}</div>${days.map(g => `<div class="tsp-day">${esc(g.d)}</div><ul>${g.list.map(row).join("")}</ul>`).join("")}${zone ? "" : `<p class="tsp-note">Times in IST</p>`}</div>`;
  const title = `<div class="tsp-rwh"><div class="tsp-k">${esc([race.flag, N.next_season ? `${race.season} opener` : race.round ? `Round ${race.round}` : ""].filter(Boolean).join(" "))}</div><h3 class="tsp-rwt">${esc(race.name)}</h3><p class="tsp-rwp">${esc([T?.circuit && T.circuit !== race.locality ? T.circuit : race.circuit, race.locality].filter(Boolean).join(" · "))}</p></div>`;
  return `<div class="tsp-card tsp-rw"><div class="tsp-rwl">${title}${map}${hero}</div>${sessions}</div>`;
}

// ---------- (6) Paddock Chatter: the newest worthwhile posts on r/formula1 and r/F1Technical ----------
const tspAgo = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return !Number.isFinite(m) || m < 0 ? "" : m < 60 ? `${Math.max(1, m)}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : ""; };
function tspChatter() {
  const C = LIVE.look_f1_chatter?.value, posts = (C?.posts || []).filter(p => p.title && /^https:\/\/(www\.)?reddit\.com\//.test(p.url || "") && (!p.at || tspAgo(p.at)));
  if (posts.length < 3) return "";
  const subs = (C.subs || ["r/formula1"]).join(" and ");
  return `<div class="tsp-card tsp-chat"><div class="tsp-k">Paddock chatter <span>${esc(C.order === "newest" ? `Newest on ${subs}` : `Top of ${subs} today`)}</span></div><ol>${posts.slice(0, 4).map(p => {
    const meta = [p.outlet || p.domain, p.sub, p.at ? tspAgo(p.at) : ""].filter(Boolean);
    const tags = (p.tags || []).slice(0, 2).map(t => `<span class="tsp-tag">${esc(t)}</span>`).join("");
    return `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><small>${tags}<span class="tnum">${meta.map(esc).join(" · ")}</span></small></li>`;
  }).join("")}</ol></div>`;
}

// ---------- (6) Paddock Notes in the trial: the paper's own pieces, with the two cards ahead of them ----------
function tspPaddock() {
  const N = LIVE.f1_next?.value, S = LIVE.f1_standings?.value, Lr = LIVE.f1_last?.value, D = E.sections?.paddock?.data || {};
  const weekend = tspRaceWeekend(N), chatter = tspChatter();
  const bits = [], who = CFG.follows.f1_driver.name, isMax = d => d?.name === who || d?.shown === who;
  const done = !!N?.season_over, season = S?.season || N?.season || "";
  const max = S?.drivers?.find(isMax), lead = S?.drivers?.[0];
  if (max) bits.push(`<p><b>${esc(CFG.follows.f1_driver.label)}:</b> ${done || S.prior ? `Finished the ${season} season ${ordinal(max.pos)} on ${max.points} points` : `${ordinal(max.pos)} on ${max.points} points`}${max === lead ? (done || S.prior ? ", champion" : ", leading the championship") : `, ${lead.points - max.points} behind ${esc(f1Name(lead))}`}.${maxNote(D.max_note) ? " " + esc(maxNote(D.max_note)) : ""}</p>`);
  if ((done || S?.prior) && lead) { const C = S.constructors?.[0]; bits.unshift(`<p><b>${esc(season)} champions:</b> ${esc(f1Name(lead))} won the drivers' title${lead.team ? ` for ${esc(lead.team)}` : ""}${C ? `; ${esc(C.name)} the constructors'` : ""}.</p>`); }
  for (const note of D.notes || []) bits.push(`<p><b>${esc(note.label)}:</b> ${esc(note.text)}</p>`);
  const facts = bits.length ? `<div class="facts tsp-facts">${bits.join("")}${staleNote("f1_standings")}</div>` : "";
  const champ = f1Champ(S, isMax, done), last = f1LastRace(Lr, isMax), stories = storiesBlock("paddock");
  if (!weekend && !chatter && !facts && !champ && !last) return stories;
  let calendar = "";
  if (N?.upcoming?.length) calendar = `<div class="f1-next"><h5>${N.next_season ? `${esc(N.race.season)} season` : "Next races"}</h5><ol>${N.upcoming.map(r => `<li><span class="flag" aria-hidden="true">${esc(r.flag)}</span><b>${esc(r.name.replace(/ Grand Prix$/, ""))}</b><small class="tnum">${r.round ? `R${r.round} · ` : ""}${esc(sparkLabel(istDate(new Date(r.date))))}</small></li>`).join("")}</ol></div>`;
  const under = facts || chatter ? `<div class="tsp-under">${facts}${chatter}</div>` : "";
  return `<div class="tsp-f1">${weekend}${under}</div>` + racePreview(D.preview, N?.race) + (stories ? `<div class="f1-stories">${stories}</div>` : "") +
    fold("f1-tables", [champ && "Championship", last && "Last race"].filter(Boolean).join(" and "), [
      max ? `${esc(lastName(f1Name(max)))} ${ordinal(max.pos)} on ${max.points}${lead && lead !== max ? `, ${esc(lastName(f1Name(lead)))} leads on ${lead.points}` : ""}` : "",
      Lr?.results?.[0] ? `${esc(lastName(f1Name(Lr.results[0])))} won ${Lr.name ? `the ${esc(Lr.name)}` : "the last race"}` : ""].filter(Boolean).join(" · "),
      champ || last ? `<div class="cols2 gap-top f1">${champ ? `<div>${champ}</div>` : "<div></div>"}${last ? `<div>${last}</div>` : "<div></div>"}</div>` : "") + calendar;
}
TRIAL_BLOCKS.paddock = () => trialSafe("paddock", tspPaddock) || paddockBlock();

// ---------- (7) the Last Result card ----------
const TSP_SLUG = { "La Liga": "esp.1", "Champions League": "uefa.champions", "Copa del Rey": "esp.copa_del_rey", "Supercopa": "esp.super_cup", "Club World Cup": "fifa.cwc" };
const tspCrest = (id, logo, name, size = 44) => {
  const src = logo && /^https:\/\/a\.espncdn\.com\//.test(logo) ? `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(new URL(logo).pathname)}&h=96&w=96` : id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${encodeURIComponent(id)}.png&h=96&w=96` : "";
  return src ? `<img class="tsp-crest" src="${esc(src)}" width="${size}" height="${size}" alt="${esc(name ? `${name} crest` : "")}" loading="lazy" decoding="async">` : "";
};
// "Mbappé 64’, 84’"; a surname alone, unless the name ends in Júnior, Filho or the like (Vinícius Júnior stays whole)
const tspWho = n => { const w = String(n || "").trim().split(/\s+/); return w.length > 1 && /^(j[uú]nior|jr\.?|filho|neto|sobrinho)$/i.test(w.at(-1)) ? w.join(" ") : w.at(-1) || ""; };
function tspScorers(list) {
  if (!list?.length) return "";
  const by = new Map();
  for (const s of list) { const k = tspWho(s.who) + (s.og ? " og" : ""); (by.get(k) || by.set(k, []).get(k)).push(String(s.minute || "").replace(/'/g, "’") + (s.pen ? " pen" : "")); }
  return `<p class="tsp-scr">${[...by].map(([k, ms]) => `${esc(k.replace(/ og$/, ""))} ${esc(ms.join(", "))}${k.endsWith(" og") ? " og" : ""}`).join("; ")}</p>`;
}
// three of the match's figures under the score, when ESPN has them: possession, shots, on target
function tspLastStats(st, homeIsUs = true) {
  const [ch, ca] = homeIsUs ? [TSP_US, TSP_THEM] : [TSP_THEM, TSP_US];
  const pick = ["possessionPct", "totalShots", "shotsOnTarget"].map(k => (st || []).find(s => s.key === k)).filter(Boolean);
  if (pick.length < 2) return "";
  return `<div class="tsp-ls">${pick.map(s => { const t = s.home + s.away, f = t ? s.home / t : 0.5, [vh, va] = s.key === "possessionPct" ? [`${Math.round(s.home)}%`, `${100 - Math.round(s.home)}%`] : [s.home, s.away];
    return `<div><div class="l">${esc(s.label)}</div><div class="v"><span>${vh}</span><span>${va}</span></div><div class="b" aria-hidden="true"><i style="flex:${f.toFixed(3)};background:${ch}"></i><i style="flex:${(1 - f).toFixed(3)};background:${ca}"></i></div></div>`; }).join("")}</div>`;
}
const h0 = M => M.teams || [];
function tspLastResult() {
  const club = CFG.follows.football_club, M = LIVE.look_last_match?.value, F = LIVE.football?.value?.last;
  let m = null;
  // ours, unless the paper's feed knows a newer result (then the paper's, which has no scorers)
  const ours = M?.teams?.length === 2 && M.status?.completed && M.teams.every(t => t.score != null) && !(F?.date && M.date && Date.parse(M.date) < Date.parse(F.date));
  if (ours) m = { id: M.id, slug: M.league?.slug, comp: M.league?.name, date: M.date, teams: M.teams, stats: M.stats };
  else if (F?.id && F.score?.us != null && F.score?.them != null && !isNaN(Number(F.score.us)) && !isNaN(Number(F.score.them))) {
    const us = { id: String(club.espn_id), name: club.name, score: Number(F.score.us), scorers: null }, them = { id: F.opponent_id, name: F.opponent, score: Number(F.score.them), scorers: null };
    m = { id: F.id, slug: TSP_SLUG[F.competition] || null, comp: F.competition, date: F.date, teams: F.home ? [us, them] : [them, us] };
  }
  if (!m || !/^\d{5,12}$/.test(String(m.id))) return "";
  // how it ended, as ESPN says it: after extra time or on penalties, else full time
  const det = String((ours ? M.status?.detail || M.status?.description : F?.detail) || "");
  const pens = ours && h0(M).every(t => t.shootout != null) ? ` ${M.teams[0].shootout}–${M.teams[1].shootout}` : "";
  const end = /pen/i.test(det) ? `On penalties${pens}` : /aet|extra/i.test(det) ? "After extra time" : "Full time";
  const [h, a] = m.teams, link = `/match?e=${encodeURIComponent(m.id)}&l=${encodeURIComponent(m.slug || "all")}`;
  const side = (t, right) => `<div class="tsp-side${right ? " r" : ""}">${tspCrest(t.id, t.logo, t.name)}<div><b class="tsp-team">${esc(t.short || t.name)}</b>${tspScorers(t.scorers)}</div></div>`;
  return `<div class="tsp-card tsp-last"><div class="tsp-lh"><div class="tsp-k">Last result <span>${esc([m.date ? tspDay(m.date) : "", m.comp].filter(Boolean).join(" · "))}</span></div><a class="tsp-mc" href="${esc(link)}">Match centre <span aria-hidden="true">›</span></a></div>
<div class="tsp-res">${side(h)}<div class="tsp-sc"><b class="tnum">${h.score}<i>–</i>${a.score}</b><small>${esc(end)}</small></div>${side(a, true)}</div>${tspLastStats(m.stats, String(h.id) === String(club.espn_id))}</div>`;
}

// ---------- (7) the Title Race card: points after each league match, two lines ----------
const TSP_US = "#a9400c", TSP_THEM = "#2e6da4"; // the desk's own orange and a blue, checked for colour-blind separation
function tspTitleRace() {
  const R = LIVE.look_title_race?.value, club = CFG.follows.football_club;
  if (!R?.us?.series?.length || !R?.rival?.series?.length) return "";
  // the paper's own table must agree (points and games) when it is fresh, or the card is not drawn
  const T = LIVE.laliga_table;
  if (T?.value?.rows?.length && !T.stale) {
    for (const s of [R.us, R.rival]) { const row = T.value.rows.find(r => String(r.id) === String(s.id)); if (row && (row.points !== s.points || row.played !== s.played)) return ""; }
  }
  for (const s of [R.us, R.rival]) if (s.series.length !== s.played || s.series.at(-1) !== s.points) return "";
  const us = R.us, them = R.rival, gap = Math.abs(us.points - them.points);
  const lead = us.points > them.points ? us : them.points > us.points ? them : null, trail = lead === us ? them : us;
  const same = us.played === them.played;
  const games = same ? `both after ${us.played} games` : `${us.short} after ${us.played}, ${them.short} after ${them.played}`;
  const line = lead ? `<b class="tnum">+${gap}</b> <span>${esc(lead.short)} on ${esc(trail.short)}, ${esc(games)}</span>` : `<b>Level</b> <span>on ${us.points} points, ${esc(games)}</span>`;
  // the chart: x is the match number (0 to the most played), y the points, both lines from 0. The lines are drawn in an
  // SVG stretched to the box; the labels are HTML on top, so they stay legible at any width.
  const W = 100, H = 100, n = Math.max(us.series.length, them.series.length), top = Math.max(us.points, them.points, 3);
  const step = top > 40 ? 20 : 10, yMax = Math.ceil(top / step) * step;
  const x = i => i * W / n, y = v => H - v / yMax * H;
  const path = s => [0, ...s].map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join("");
  const grid = [], ylab = [];
  for (let v = 0; v <= yMax; v += step) { grid.push(`<line x1="0" x2="${W}" y1="${y(v).toFixed(2)}" y2="${y(v).toFixed(2)}"/>`); ylab.push(`<span class="gy" style="top:${y(v).toFixed(2)}%">${v}</span>`); }
  // end labels at the lines' ends, kept apart when the two totals are close (in % of the box height)
  let yu = y(us.points), yt = y(them.points);
  if (Math.abs(yu - yt) < 11) { const mid = (yu + yt) / 2, up = us.points >= them.points; yu = mid + (up ? -5.5 : 5.5); yt = mid + (up ? 5.5 : -5.5); }
  // one hover column per game, naming both totals
  const cols = Array.from({ length: n }, (_, i) => `<rect x="${(x(i) + x(1) / 2).toFixed(2)}" y="0" width="${x(1).toFixed(2)}" height="${H}" fill="transparent"><title>${esc(`Game ${i + 1}: ${us.short} ${us.series[i] ?? "-"}, ${them.short} ${them.series[i] ?? "-"}`)}</title></rect>`).join("");
  const svg = `<div class="tsp-trw"><svg class="tsp-tr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`League points after each match: ${us.short} ${us.points} after ${us.played}, ${them.short} ${them.points} after ${them.played}`)}">
<g class="grid">${grid.join("")}</g>
<path d="${path(them.series)}" fill="none" stroke="${TSP_THEM}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
<path d="${path(us.series)}" fill="none" stroke="${TSP_US}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${cols}</svg>
${ylab.join("")}<span class="el" style="top:${yt.toFixed(2)}%">${esc(them.abbr || them.short)} <b class="tnum">${them.points}</b></span><span class="el" style="top:${yu.toFixed(2)}%">${esc(us.abbr || us.short)} <b class="tnum">${us.points}</b></span>
<span class="gx">Game 1</span><span class="gx r">Game ${n}</span></div>`;
  const key = `<p class="tsp-key"><span><i style="--c:${TSP_US}"></i>${esc(us.short)}</span><span><i style="--c:${TSP_THEM}"></i>${esc(them.short)}</span></p>`;
  // (no "Next" line here: the paper's fixture list straight under the cards opens on that match)
  return `<div class="tsp-card tsp-race"><div class="tsp-k">Title race <span>${esc(R.league || "La Liga")} points after each match</span></div><p class="tsp-gap">${crest(lead?.id || us.id, "")}${line}</p>${svg}${key}</div>`;
}

// ---------- (7) Madridismo in the trial: the two cards, then the paper's own block less its "Last:" line ----------
function tspMadrid() {
  const last = trialSafe("last result", tspLastResult), race = trialSafe("title race", tspTitleRace);
  let rest = madridBlock();
  if (last) rest = rest.replace(/<p><b>Last:<\/b>[\s\S]*?<\/p>/, "");
  const cards = last || race ? `<div class="tsp-mad${last && race ? " two" : ""}">${last}${race}</div>` : "";
  return cards + rest;
}
TRIAL_BLOCKS.madrid = () => trialSafe("madrid", tspMadrid) || madridBlock();
