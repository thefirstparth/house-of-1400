// ================================================================ THE TRIAL'S SPORT MODULE (items 6 and 7)
// (6) Paddock Notes opens with a Race Weekend card (a countdown to lights out, the circuit map, the sessions by day in IST
// with the circuit's local time, the next one marked) and a Paddock Chatter card (r/formula1's top posts of the day,
// lib/look-sport.js look_f1_chatter; hidden when Reddit does not answer). The old session table goes; the market's view,
// Max Watch, the race ahead, the stories, the standings and the calendar stay.
// (7) Madridismo opens with a Last Result card (crests, score, scorers, a Match centre button to /match) and a Title Race
// card (points after each league match for Madrid and the leader, or the runner-up when Madrid lead; look_title_race),
// then the paper's own fixtures, form and tables. Each card draws only from good data and hides otherwise.
TRIAL_KEYS.push(["look_f1_chatter", ""], ["look_title_race", ""], ["look_last_match", ""]);

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
function tspRaceWeekend(N) {
  const race = N?.race, ss = race?.sessions || [];
  if (!race || !ss.length || ss.some(s => !s.start || isNaN(Date.parse(s.start)))) return "";
  const n = Date.now(), zone = tspZone(race), place = race.locality || race.circuit || "local";
  const st = s => stateOf({ start: Date.parse(s.start), end: Date.parse(s.start) + (s.minutes || 60) * 6e4 }, n);
  const raceS = ss.find(s => /^race$/i.test(s.name)) || ss.at(-1);
  const nextS = ss.find(s => st(s) !== "done");
  const raceState = st(raceS);
  // the countdown, or the race live, or nothing once it is over (the card then shows the weekend as done)
  const hero = raceState === "next" && raceS.time_confirmed !== false
    ? `${tspCountdown(raceS.start)}<p class="tsp-cdl">Until lights out · <span class="tnum">${esc(tspDay(raceS.start))}, ${esc(tspTime(raceS.start))} IST${zone ? ` (${esc(tspTime(raceS.start, zone))} ${esc(place)})` : ""}</span></p>`
    : raceState === "on" ? `<p class="tsp-cdlive"><span class="live"><i></i>Live</span> The race is on</p>` : "";
  const T = race.track;
  const map = T?.image && /^https:\/\/media\.formula1\.com\//.test(T.image) ? `<img class="tsp-track" src="${esc(T.image)}" alt="${esc(`${T.circuit || race.locality || ""} circuit map`)}" loading="lazy" decoding="async">` : "";
  // sessions under their IST day; the local time beside each, with its own day when that differs
  const days = [];
  for (const s of ss) { const d = tspDay(s.start); (days.at(-1)?.d === d ? days.at(-1) : (days.push({ d, list: [] }), days.at(-1))).list.push(s); }
  const row = s => {
    const k = st(s), on = s === nextS, tbc = s.time_confirmed === false;
    const loc = zone && !tbc ? (tspDay(s.start, zone) === tspDay(s.start) ? tspTime(s.start, zone) : `${tspDay(s.start, zone).split(" ")[0]} ${tspTime(s.start, zone)}`) : "";
    const tag = k === "on" ? ` <span class="live"><i></i>Live</span>` : on && !tbc ? ` <span class="tsp-in">in <span data-until="${esc(s.start)}" data-min="${s.minutes || 60}">${esc(cd(Date.parse(s.start) - n))}</span></span>` : k === "done" ? ` <small class="tsp-done">done</small>` : "";
    return `<li class="tsp-s${on ? " on" : ""}${k === "done" ? " done" : ""}"><span class="tsp-sn">${esc(s.name)}${tag}</span><span class="tsp-st tnum">${tbc ? "TBC" : `<b>${esc(tspTime(s.start))} IST</b>${loc ? `<small>${esc(loc)} ${esc(place)}</small>` : ""}`}</span></li>`;
  };
  const sessions = `<div class="tsp-sess"><div class="tsp-k">Race weekend${watchTag({ entity: "f1" })}</div>${days.map(g => `<div class="tsp-day">${esc(g.d)}</div><ul>${g.list.map(row).join("")}</ul>`).join("")}${zone ? "" : `<p class="tsp-note">Times in IST</p>`}</div>`;
  const title = `<div class="tsp-rwh"><div class="tsp-k">${esc([race.flag, N.next_season ? `${race.season} opener` : race.round ? `Round ${race.round}` : ""].filter(Boolean).join(" "))}</div><h3 class="tsp-rwt">${esc(race.name)}</h3><p class="tsp-rwp">${esc([T?.circuit && T.circuit !== race.locality ? T.circuit : race.circuit, race.locality].filter(Boolean).join(" · "))}</p></div>`;
  return `<div class="tsp-card tsp-rw"><div class="tsp-rwl">${title}${map}${hero}</div>${sessions}</div>`;
}

// ---------- (6) Paddock Chatter: r/formula1's top posts of the day ----------
const tspAgo = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return !Number.isFinite(m) || m < 0 ? "" : m < 60 ? `${Math.max(1, m)}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : ""; };
function tspChatter() {
  const C = LIVE.look_f1_chatter?.value, posts = (C?.posts || []).filter(p => p.title && /^https:\/\/(www\.)?reddit\.com\//.test(p.url || ""));
  if (posts.length < 3) return "";
  return `<div class="tsp-card tsp-chat"><div class="tsp-k">Paddock chatter <span>Top of ${esc(C.sub || "r/formula1")} today</span></div><ol>${posts.map(p => {
    const meta = [C.sub || "r/formula1", p.author, p.at ? tspAgo(p.at) : "", p.comments != null ? `${inr(p.comments, 0)} comments` : ""].filter(Boolean);
    return `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><small class="tnum">${meta.map(esc).join(" · ")}</small></li>`;
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
  const under = facts || chatter ? `<div class="tsp-under${facts && chatter ? " two" : ""}">${facts}${chatter}</div>` : "";
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
const tspScorers = list => (list?.length ? `<p class="tsp-scr">${list.map(s => `${esc(lastName(s.who || ""))} ${esc(String(s.minute || "").replace(/'$/, "’").replace(/'/g, "’"))}${s.pen ? " pen" : ""}${s.og ? " og" : ""}`).join(", ")}</p>` : "");
function tspLastResult() {
  const club = CFG.follows.football_club, M = LIVE.look_last_match?.value, F = LIVE.football?.value?.last;
  let m = null;
  // ours, unless the paper's feed knows a newer result (then the paper's, which has no scorers)
  const ours = M?.teams?.length === 2 && M.status?.completed && M.teams.every(t => t.score != null) && !(F?.date && M.date && Date.parse(M.date) < Date.parse(F.date));
  if (ours) m = { id: M.id, slug: M.league?.slug, comp: M.league?.name, date: M.date, teams: M.teams };
  else if (F?.id && F.score?.us != null && F.score?.them != null && !isNaN(Number(F.score.us)) && !isNaN(Number(F.score.them))) {
    const us = { id: String(club.espn_id), name: club.name, score: Number(F.score.us), scorers: null }, them = { id: F.opponent_id, name: F.opponent, score: Number(F.score.them), scorers: null };
    m = { id: F.id, slug: TSP_SLUG[F.competition] || null, comp: F.competition, date: F.date, teams: F.home ? [us, them] : [them, us] };
  }
  if (!m || !/^\d{5,12}$/.test(String(m.id))) return "";
  const [h, a] = m.teams, link = `/match?e=${encodeURIComponent(m.id)}&l=${encodeURIComponent(m.slug || "all")}`;
  const side = (t, right) => `<div class="tsp-side${right ? " r" : ""}">${tspCrest(t.id, t.logo, t.name)}<div><b class="tsp-team">${esc(t.short || t.name)}</b>${tspScorers(t.scorers)}</div></div>`;
  return `<div class="tsp-card tsp-last"><div class="tsp-lh"><div class="tsp-k">Last result <span>${esc([m.date ? tspDay(m.date) : "", m.comp].filter(Boolean).join(" · "))}</span></div><a class="tsp-mc" href="${esc(link)}">Match centre <span aria-hidden="true">›</span></a></div>
<div class="tsp-res">${side(h)}<div class="tsp-sc"><b class="tnum">${h.score}<i>–</i>${a.score}</b><small>Full time</small></div>${side(a, true)}</div></div>`;
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
  // the chart: x is the match number (0 to the most played), y the points, both lines start at 0
  const W = 560, H = 210, L = 8, Rr = 76, Tp = 12, B = 26, n = Math.max(us.series.length, them.series.length), top = Math.max(us.points, them.points, 3);
  const yMax = Math.ceil(top / 10) * 10 || 10;
  const x = i => L + i * (W - L - Rr) / n, y = v => Tp + (1 - v / yMax) * (H - Tp - B);
  const path = s => [0, ...s].map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const grid = [];
  for (let v = 0; v <= yMax; v += yMax > 40 ? 20 : 10) grid.push(`<line x1="${L}" x2="${W - Rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="gy" x="${W - Rr + 6}" y="${(y(v) + 4).toFixed(1)}">${v}</text>`);
  // end labels, kept apart when the two totals are close
  let yu = y(us.points), yt = y(them.points);
  if (Math.abs(yu - yt) < 16) { const mid = (yu + yt) / 2, up = us.points >= them.points; yu = mid + (up ? -8 : 8); yt = mid + (up ? 8 : -8); }
  const pts = (s, col, who) => s.series.map((v, i) => `<circle class="hit" cx="${x(i + 1).toFixed(1)}" cy="${y(v).toFixed(1)}" r="7" fill="transparent"><title>${esc(who)}: ${v} points after ${i + 1} game${i ? "s" : ""}${s.results?.[i] ? ` (${s.results[i]})` : ""}</title></circle>`).join("");
  const svg = `<svg class="tsp-tr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`League points after each match: ${us.short} ${us.points} after ${us.played}, ${them.short} ${them.points} after ${them.played}`)}">
<g class="grid">${grid.join("")}</g><text class="gx" x="${L}" y="${H - 6}">Game 1</text><text class="gx" x="${(W - Rr).toFixed(1)}" y="${H - 6}" text-anchor="end">Game ${n}</text>
<path d="${path(them.series)}" fill="none" stroke="${TSP_THEM}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${path(us.series)}" fill="none" stroke="${TSP_US}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
<text class="el" x="${(x(them.series.length) + 8).toFixed(1)}" y="${(yt + 4).toFixed(1)}">${esc(them.abbr || them.short)} ${them.points}</text>
<text class="el" x="${(x(us.series.length) + 8).toFixed(1)}" y="${(yu + 4).toFixed(1)}">${esc(us.abbr || us.short)} ${us.points}</text>
${pts(them, TSP_THEM, them.short)}${pts(us, TSP_US, us.short)}</svg>`;
  const key = `<p class="tsp-key"><span><i style="--c:${TSP_US}"></i>${esc(us.short)}</span><span><i style="--c:${TSP_THEM}"></i>${esc(them.short)}</span></p>`;
  const nx = R.next, next = nx?.date ? `<p class="tsp-next"><b>Next:</b> ${nx.home ? "v" : "at"} ${esc(nx.opponent)}, ${nx.time_confirmed ? `${esc(tspDay(nx.date))}, ${esc(tspTime(nx.date))} IST` : `${esc(tspDay(nx.date))}, time TBC`}</p>` : "";
  return `<div class="tsp-card tsp-race"><div class="tsp-k">Title race <span>${esc(R.league || "La Liga")} points after each match</span></div><p class="tsp-gap">${crest(lead?.id || us.id, "")}${line}</p>${svg}${key}${next}</div>`;
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
