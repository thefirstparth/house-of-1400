// The Crease's series summary, from the India schedule scripts/cricket-times.mjs reads from Cricbuzz.

// India's series in order: each with its formats, how many matches (the highest "Nth" still to come is the last one)
// and how many are already played (the lowest still to come, less one). A series is "now" if a match in it is within
// the next 10 days or it has matches played; the first series that is not is the next one.
export function seriesOf(matches, now = Date.now()) {
  const by = new Map();
  for (const m of matches) {
    if (!by.has(m.series)) by.set(m.series, { name: m.series, opponent: m.opponent, first: m.start, formats: new Map() });
    const s = by.get(m.series), n = Number((m.desc || "").match(/^(\d+)(?:st|nd|rd|th)\s+(?:ODI|T20I?|Test)\b/i)?.[1]) || null;
    const f = s.formats.get(m.format) || { format: m.format, lo: null, hi: null };
    if (n) { f.lo = f.lo == null ? n : Math.min(f.lo, n); f.hi = Math.max(f.hi ?? 0, n); }
    s.formats.set(m.format, f);
  }
  const soon = now + 10 * 864e5;
  const list = [...by.values()].map(s => {
    const parts = [...s.formats.values()].map(f => ({ format: f.format, total: f.hi, played: f.lo ? f.lo - 1 : null }));
    return { name: s.name, opponent: s.opponent, from: s.first.slice(0, 10), parts, now: Date.parse(s.first) < soon || parts.some(p => p.played > 0) };
  });
  const next = list.findIndex(s => !s.now);
  return list.filter((s, i) => s.now || i === next);
}

// Cricbuzz's team pages embed each match as a matchInfo object in their Next.js payload; this pulls them out, with the
// matchScore that follows it in the same match object (runs, wickets and overs per innings) when there is one.
export function parseCricbuzz(html) {
  const flat = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(m => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).join("");
  const objAt = i => {
    let depth = 0, j = i;
    for (; j < flat.length; j++) { const ch = flat[j]; if (ch === "{") depth++; else if (ch === "}") { depth--; if (!depth) break; } else if (ch === '"') { for (j++; j < flat.length && flat[j] !== '"'; j++) if (flat[j] === "\\") j++; } }
    return [flat.slice(i, j + 1), j];
  };
  const out = [], seen = new Map();
  for (const m of flat.matchAll(/"matchInfo":\{/g)) {
    try {
      const [txt, end] = objAt(m.index + 12), o = JSON.parse(txt);
      const sc = ',"matchScore":{';
      if (flat.startsWith(sc, end + 1)) o.matchScore = JSON.parse(objAt(end + sc.length)[0]);
      if (!o.matchId) continue;
      if (!seen.has(o.matchId)) { seen.set(o.matchId, o); out.push(o); }
      else if (o.matchScore && !seen.get(o.matchId).matchScore) seen.get(o.matchId).matchScore = o.matchScore;
    } catch {}
  }
  return out;
}

// ---------------------------------------------------------------- The Crease, live (from 1 Oct 2026)
// India's schedule and results from Cricbuzz's team pages, grouped the way a reader thinks about them: the next match,
// the series under way with every match in it (result or date), the score in that series, anything else India is
// playing in the next ten days (a multi-sport games, say), and the next tour after that.
let UA = {};
const TEAM = 2, CB = "https://www.cricbuzz.com/cricket-team/india/2";
const DAY = 864e5;
export function toMatch(o) {
  const us = o.team1?.teamId === TEAM ? o.team1 : o.team2, them = o.team1?.teamId === TEAM ? o.team2 : o.team1;
  // An abandoned or washed-out match is "off", never "live" (Cricbuzz's state for it is "Abandon")
  const state = /complete/i.test(o.state) ? "done" : /abandon|no result/i.test(`${o.state} ${o.status}`) ? "off" : /preview|upcoming|toss/i.test(o.state || "") || !o.state ? "next" : "live";
  const status = String(o.status || "").replace(/\s+-\s+/g, " · ").trim();
  const won = state === "done" ? (new RegExp(`^${(us?.teamName || "India").replace(/\W/g, ".")}\\s+won`, "i").test(status) ? true : /\swon\s/i.test(status) ? false : null) : null;
  const n = Number((o.matchDesc || "").match(/^(\d+)(?:st|nd|rd|th)\s/)?.[1]) || null;
  return { id: o.matchId, series: o.seriesName, series_id: o.seriesId ?? null, format: o.matchFormat, desc: o.matchDesc, n, opponent: them?.teamName || "TBC", start: new Date(Number(o.startDate)).toISOString(),
    time_announced: o.isTimeAnnounced !== false, city: o.venueInfo?.city || null, ground: o.venueInfo?.ground || null, state, status: state === "next" ? null : status, won,
    score: state === "next" ? null : inningsLine(o) };
}
// The scorecard in one line, innings in the order they were batted: "WI 245/8 (50 ov) · IND 246/2 (38.4 ov)".
// Cricbuzz writes a completed over as .6 (49.6 is 50 overs); ten wickets is all out, shown as the runs alone.
const oversOf = v => { const w = Math.floor(v), b = Math.round((v - w) * 10); return b >= 6 ? String(w + 1) : b ? `${w}.${b}` : String(w); };
export function inningsLine(o) {
  const S = o.matchScore; if (!S) return null;
  const inns = [["team1Score", o.team1], ["team2Score", o.team2]].flatMap(([k, t]) => Object.values(S[k] || {}).map(x => ({ ...x, team: t?.teamSName || t?.teamName || "" })))
    .filter(x => Number.isFinite(x.runs)).sort((a, b) => (a.inningsId ?? 0) - (b.inningsId ?? 0));
  if (!inns.length) return null;
  const by = new Map();
  // A finished innings (any but the one being batted) that Cricbuzz gives as a whole number of overs short of the full
  // allotment (41 for 41.4, seen 27 Sep to 6 Oct 2026) may have lost its balls: its overs are left out rather than
  // risk printing them wrong.
  const full = { ODI: 50, T20: 20 }[o.matchFormat], lastInn = inns.at(-1);
  const oversOk = x => Number.isFinite(x.overs) && o.matchFormat !== "TEST" && !((x !== lastInn || /complete/i.test(o.state || "")) && full && Number.isInteger(x.overs) && x.overs < full);
  for (const x of inns) { if (!by.has(x.team)) by.set(x.team, []); by.get(x.team).push(`${x.runs}${x.wickets != null && x.wickets < 10 ? "/" + x.wickets : ""}${oversOk(x) ? ` (${oversOf(x.overs)} ov)` : ""}`); }
  return [...by].map(([t, l]) => `${t} ${l.join(" & ")}`).join(" · ");
}
const plural = { ODI: "ODIs", T20: "T20Is", TEST: "Tests" };
const istDay = t => new Date(t + 5.5 * 36e5).toISOString().slice(0, 10);
// A match that started today (IST), or in the last 12 hours, is still "today's match" (it has already started).
export const keptToday = (start, now = Date.now()) => start <= now && (istDay(start) === istDay(now) || start > now - 12 * 36e5);
export function creaseView(matches, now = Date.now()) {
  const ms = [...new Map(matches.map(m => [m.id, m])).values()].sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = ms.filter(m => m.state !== "done" && Date.parse(m.start) > now - 12 * 36e5);
  const next = ms.find(m => m.state === "live") || upcoming[0] || null;
  const by = new Map();
  for (const m of ms) { if (!by.has(m.series)) by.set(m.series, []); by.get(m.series).push(m); }
  const series = [...by.entries()].map(([name, list]) => {
    const formats = [...new Set(list.map(m => m.format))].map(f => {
      const fm = list.filter(m => m.format === f), done = fm.filter(m => m.state === "done");
      // A bilateral series (every match numbered, one opponent) has a score and a length; a tournament has neither.
      const bilateral = fm.every(m => m.n) && new Set(fm.map(m => m.opponent)).size === 1;
      const w = done.filter(m => m.won === true).length, l = done.filter(m => m.won === false).length, total = bilateral ? Math.max(...fm.map(m => m.n)) : null;
      const opp = fm[0].opponent, left = fm.some(m => m.state !== "done");
      const score = !bilateral || !done.length ? null : w === l ? `${left ? "Level" : "Drawn"} ${w}–${l}` : `${w > l ? "India" : opp} ${left ? "lead" : "won"} ${Math.max(w, l)}–${Math.min(w, l)}`;
      return { format: f, label: plural[f] || f, total, score, matches: fm };
    });
    const first = Date.parse(list[0].start), last = Date.parse(list.at(-1).start);
    return { name, opponent: list[0].opponent, first: list[0].start, last: list.at(-1).start, formats,
      now: list.some(m => m.state === "live") || (first <= now + 10 * DAY && last >= now - 5 * DAY) };
  });
  // Today's match stays in charge until midnight IST, with its result (Parth, 1 Oct: the ODI vanished once it ended,
  // because the next match, a day later and in another series, took over). A late match keeps at least 12 hours.
  const today = ms.filter(m => m.state === "done" && keptToday(Date.parse(m.start), now)).at(-1) || null;
  const lead = ms.find(m => m.state === "live")?.series || today?.series || next?.series;
  const current = series.filter(s => s.now || s.name === lead).sort((a, b) => (a.name === lead ? -1 : b.name === lead ? 1 : a.first.localeCompare(b.first)));
  const after = series.filter(s => !current.includes(s) && Date.parse(s.first) > now).sort((a, b) => a.first.localeCompare(b.first))[0] || null;
  return { next, today, main: current[0] || null, also: current.slice(1), after };
}
const KO = /quarter-?final|semi-?final|^final$/i;
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Any knockout match, India's or not: stage, both teams, state and result, the score in a line.
function toKO(o) {
  const state = /complete/i.test(o.state) ? "done" : /abandon|no result/i.test(`${o.state} ${o.status}`) ? "off" : /preview|upcoming|toss/i.test(o.state || "") || !o.state ? "next" : "live";
  return { stage: o.matchDesc, teams: [o.team1?.teamName || "TBC", o.team2?.teamName || "TBC"], start: new Date(Number(o.startDate)).toISOString(), state,
    status: state === "next" ? null : String(o.status || "").replace(/\s+-\s+/g, " · ").replace(/\s*\([^)]*\)\s*$/, "").replace(/ due to .*$/i, "").trim(), score: state === "done" || state === "live" ? inningsLine(o) : null };
}
export async function crease(getText) {
  UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
  const [sch, res] = await Promise.allSettled([getText(`${CB}/schedule`, { timeout: 12000, headers: UA }), getText(`${CB}/results`, { timeout: 12000, headers: UA })]);
  const raw = [...(sch.status === "fulfilled" ? parseCricbuzz(sch.value) : []), ...(res.status === "fulfilled" ? parseCricbuzz(res.value) : [])]
    .filter(o => o.team1?.teamId === TEAM || o.team2?.teamId === TEAM);
  if (!raw.length) throw new Error(`crease: Cricbuzz gave no India matches (${[sch, res].map(r => r.status === "rejected" ? String(r.reason?.message || r.reason).slice(0, 60) : "ok").join(", ")})`);
  const v = creaseView(raw.map(toMatch));
  if (!v.next && !v.main) throw new Error("crease: nothing current");
  // India in a tournament's knockouts: the other quarter-finals, semi-finals and the final from the series' own page,
  // so the reader can see who India might meet (Parth, 1 Oct).
  for (const S of [v.main, ...(v.also || [])].filter(Boolean)) {
    const ms = S.formats.flatMap(f => f.matches), ko = ms.find(m => KO.test(m.desc || "") && m.series_id);
    if (!ko) continue;
    try {
      const html = await getText(`https://www.cricbuzz.com/cricket-series/${ko.series_id}/${slug(S.name)}/matches`, { timeout: 10000, headers: UA });
      S.knockouts = parseCricbuzz(html).filter(o => KO.test(o.matchDesc || "")).map(o => ({ ...toKO(o), india: o.team1?.teamId === TEAM || o.team2?.teamId === TEAM }))
        .sort((a, b) => a.start.localeCompare(b.start))
        // India's own rows take the score from India's page, read at the same moment as the rest of The Crease.
        .map(k => { const m = k.india && ms.find(x => x.start === k.start); return m && m.score && k.state !== "off" ? { ...k, score: m.score } : k; });
    } catch {}
  }
  // The last finished match's top batter and best bowler on each side, and the player of the match, from Cricbuzz's
  // scorecard for it (for the Sport app). Left out if the scorecard is missing or does not read cleanly.
  const done = [v.today, ...[v.main, ...(v.also || [])].filter(Boolean).flatMap(S => S.formats.flatMap(f => f.matches))].filter(m => m?.state === "done" && m.id).sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
  if (done) try { v.last_card = cardOf(JSON.parse(await getText(`https://www.cricbuzz.com/api/mcenter/scorecard/${done.id}`, { timeout: 8000, headers: UA })), done.id); } catch {}
  return v;
}
// Two innings of a scorecard: each batting side's top scorer and the best bowler against it
export function cardOf(j, id) {
  const inns = (j?.scoreCard || []).filter(x => x?.batTeamDetails?.batsmenData);
  if (!inns.length) return null;
  const sides = inns.map(x => {
    const bats = Object.values(x.batTeamDetails.batsmenData || {}).filter(b => b.batName && Number.isFinite(b.runs));
    const bowls = Object.values(x.bowlTeamDetails?.bowlersData || {}).filter(b => b.bowlName && Number.isFinite(b.wickets));
    const bat = bats.sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0], bowl = bowls.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
    return { team: x.batTeamDetails.batTeamShortName || x.batTeamDetails.batTeamName, bat: bat ? { name: bat.batName, runs: bat.runs, balls: bat.balls ?? null, out: !!bat.outDesc && !/not out|batting/i.test(bat.outDesc) } : null,
      bowl: bowl && bowl.wickets > 0 ? { name: bowl.bowlName, wickets: bowl.wickets, runs: bowl.runs, team: x.bowlTeamDetails.bowlTeamShortName || x.bowlTeamDetails.bowlTeamName } : null };
  });
  const potm = (j.matchHeader?.playersOfTheMatch || []).map(p => p.fullName || p.name).filter(Boolean);
  return { match_id: id, innings: sides, potm };
}
