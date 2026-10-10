// The Sport app's own feeds (/sport, from 10 Oct 2026; Parth: "you know what I follow ... what I want to know").
// Everything else the app shows comes from the paper's keys (football, club_stats, f1_next, f1_standings, f1_last,
// f1_sessions, f1_market, odds, crease, tennis_players, tennis, nba). These add what the paper never needed:
//   madrid_hub: Madrid's results this season in every competition, and the line-up. The official XI once ESPN
//               publishes it (about an hour before kick-off); until then the last match's starting XI, marked as such.
//   f1_hub:     the current circuit's history (winners and pole sitters by year, wins by driver, Verstappen's record
//               there) and every driver's last five finishes this season.
// One source each (ESPN, Jolpica); the app names it beside every figure. Nothing is estimated.
import { config as readConfig, getJSON } from "./live.js";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const ok = (value, source) => ({ ok: true, value, source, as_of: new Date().toISOString(), stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });
const config = async () => readConfig();
const score = s => (s == null ? null : typeof s === "object" ? (s.displayValue ?? s.value ?? null) : s);
const COMP = { "spanish laliga": "La Liga", laliga: "La Liga", "uefa champions league": "Champions League", "spanish copa del rey": "Copa del Rey", "spanish supercopa": "Supercopa", "fifa club world cup": "Club World Cup", "club friendly": "Friendly" };
// "2025-26 LALIGA" and "Spanish LALIGA" are both La Liga
const comp = n => { if (!n) return null; const x = String(n).replace(/^\d{4}(-\d{2,4})?\s+/, "").trim(); return COMP[x.toLowerCase()] || x.replace(/^Spanish /, ""); };

// A team's starting XI from an ESPN match summary: formation, and each starter with shirt, position and formation slot
function xiOf(summary, teamId) {
  const r = (summary?.rosters || []).find(x => String(x.team?.id) === String(teamId));
  const starters = (r?.roster || []).filter(p => p.starter);
  if (starters.length !== 11) return null;
  return {
    formation: r.formation || null,
    players: starters.map(p => ({ name: p.athlete?.displayName, short: p.athlete?.shortName || p.athlete?.displayName, shirt: p.jersey || null, pos: p.position?.abbreviation || null, slot: Number(p.formationPlace) || null }))
      .sort((a, b) => (a.slot || 99) - (b.slot || 99)),
    bench: (r.roster || []).filter(p => !p.starter).map(p => p.athlete?.displayName).filter(Boolean),
  };
}

// The next match's preview from its ESPN summary: each side's last five results and the last meetings
function previewOf(summary, matchId) {
  if (!summary) return null;
  const form = (summary.lastFiveGames || []).map(t => ({ team: t.team?.displayName, id: t.team?.id || null,
    games: (t.events || []).map(e => ({ result: e.gameResult || null, score: e.score || null, opponent: e.opponent?.displayName || null, at: e.atVs === "@", date: e.gameDate || null, competition: comp(e.leagueName || e.leagueAbbreviation) })) })).filter(t => t.team && t.games.length);
  const ss = (summary.seasonseries || []).find(x => /head/i.test(x.type || "")) || null;
  const meetings = (ss?.events || []).filter(e => e.statusType?.completed).map(e => {
    const cs = e.competitors || [], h = cs.find(c => c.homeAway === "home") || {}, a = cs.find(c => c.homeAway === "away") || {};
    return { date: e.date, home: h.team?.displayName, away: a.team?.displayName, hs: score(h.score), as: score(a.score), competition: comp(e.competitionName) };
  }).filter(m => m.hs != null && m.as != null).sort((x, y) => y.date.localeCompare(x.date));
  return form.length || meetings.length ? { match_id: matchId, form, meetings: meetings.slice(0, 5), summary: ss?.summary || null } : null;
}

export async function madrid_hub() {
  try {
    const C = await config(), club = C.follows.football_club, id = club.espn_id;
    const [past, next] = await Promise.all([getJSON(`${ESPN}/soccer/all/teams/${id}/schedule`), getJSON(`${ESPN}/soccer/all/teams/${id}/schedule?fixture=true`).catch(() => ({ events: [] }))]);
    const row = e => {
      const c = e.competitions?.[0] || {}, cs = c.competitors || [];
      const me = cs.find(x => String(x.team?.id ?? x.id) === String(id)) || {}, opp = cs.find(x => x !== me) || {};
      const st = c.status?.type || e.status?.type || {};
      return { id: e.id, date: e.date, competition: comp(e.league?.name || e.seasonType?.name), home: me.homeAway === "home", opponent: opp.team?.displayName || null, opponent_id: opp.team?.id || null,
        venue: c.venue?.fullName || null, state: st.state || null, completed: !!st.completed, us: score(me.score), them: score(opp.score),
        winner: me.winner ? "us" : opp.winner ? "them" : st.completed ? "draw" : null };
    };
    const results = (past.events || []).map(row).filter(r => r.completed && r.us != null).sort((a, b) => b.date.localeCompare(a.date));
    const fixtures = (next.events || []).map(row).filter(r => !r.completed).sort((a, b) => a.date.localeCompare(b.date));
    // The line-up: the next match's official XI once published; otherwise the last competitive match's starting XI
    let xi = null, preview = null;
    const upcoming = fixtures[0];
    if (upcoming) {
      const s = await getJSON(`${ESPN}/soccer/all/summary?event=${upcoming.id}`).catch(() => null), x = xiOf(s, id);
      if (x) xi = { kind: "official", match_id: upcoming.id, opponent: upcoming.opponent, date: upcoming.date, ...x };
      preview = previewOf(s, upcoming.id);
    }
    if (!xi) {
      const last = results.find(r => r.competition !== "Friendly") || results[0];
      if (last) {
        const s = await getJSON(`${ESPN}/soccer/all/summary?event=${last.id}`).catch(() => null), x = xiOf(s, id);
        if (x) xi = { kind: "last", match_id: last.id, opponent: last.opponent, date: last.date, competition: last.competition, ...x };
      }
    }
    if (!results.length && !fixtures.length) throw new Error("espn schedule empty");
    return ok({ club: club.name, club_id: String(id), results: results.slice(0, 12), fixtures: fixtures.slice(0, 8), xi, preview }, "ESPN");
  } catch (e) { return fail(e); }
}

// The current race weekend's circuit (or the next one between weekends), its history, and the drivers' recent form
export async function f1_hub() {
  try {
    const C = await config(), fav = C.follows.f1_driver?.name || "Max Verstappen";
    const cal = (await getJSON(`${JOLPICA}/current.json?limit=40`)).MRData?.RaceTable?.Races || [];
    if (!cal.length) throw new Error("jolpica calendar empty");
    const now = Date.now(), at = r => Date.parse(`${r.date}T${r.time || "12:00:00Z"}`);
    const race = cal.find(r => at(r) + 3 * 36e5 > now) || cal.at(-1), cid = race.Circuit?.circuitId;
    const [wins, poles, drivers] = await Promise.all([
      getJSON(`${JOLPICA}/circuits/${cid}/results/1.json?limit=100`),
      getJSON(`${JOLPICA}/circuits/${cid}/qualifying/1.json?limit=100`).catch(() => null),
      getJSON(`${JOLPICA}/current/drivers.json?limit=60`),
    ]);
    const favId = (drivers.MRData?.DriverTable?.Drivers || []).find(d => `${d.givenName} ${d.familyName}` === fav)?.driverId || "max_verstappen";
    const favHere = await getJSON(`${JOLPICA}/drivers/${favId}/circuits/${cid}/results.json?limit=100`).catch(() => null);
    const W = (wins.MRData?.RaceTable?.Races || []).map(r => { const x = r.Results?.[0] || {}; return { season: r.season, driver: `${x.Driver?.givenName} ${x.Driver?.familyName}`, code: x.Driver?.code || null, team: x.Constructor?.name || null, grid: Number(x.grid) || null }; });
    const P = (poles?.MRData?.RaceTable?.Races || []).map(r => { const x = r.QualifyingResults?.[0] || {}; return { season: r.season, driver: `${x.Driver?.givenName} ${x.Driver?.familyName}`, team: x.Constructor?.name || null }; });
    const tally = Object.entries(W.reduce((m, w) => ((m[w.driver] = (m[w.driver] || 0) + 1), m), {})).map(([driver, n]) => ({ driver, wins: n })).sort((a, b) => b.wins - a.wins || a.driver.localeCompare(b.driver));
    const mine = (favHere?.MRData?.RaceTable?.Races || []).map(r => { const x = r.Results?.[0] || {}; return { season: r.season, pos: Number(x.position) || null, text: x.positionText, grid: Number(x.grid) || null, status: x.status, team: x.Constructor?.name || null }; });
    // Form: each driver's finishing position in the season's last five races (round order)
    const done = cal.filter(r => at(r) + 3 * 36e5 < now).slice(-5);
    const rounds = await Promise.all(done.map(r => getJSON(`${JOLPICA}/${r.season}/${r.round}/results.json?limit=30`).then(j => j.MRData?.RaceTable?.Races?.[0] || null).catch(() => null)));
    const form = {};
    for (const r of rounds.filter(Boolean)) for (const x of r.Results || []) {
      const code = x.Driver?.code; if (!code) continue;
      (form[code] ||= { code, name: `${x.Driver.givenName} ${x.Driver.familyName}`, results: [] }).results.push({ round: Number(r.round), race: r.raceName, pos: Number(x.position) || null, text: x.positionText, finished: /^\d+$/.test(x.positionText) });
    }
    return ok({
      race: { season: race.season, round: Number(race.round), name: race.raceName, circuit: race.Circuit?.circuitName, circuit_id: cid, locality: race.Circuit?.Location?.locality, country: race.Circuit?.Location?.country, date: new Date(at(race)).toISOString() },
      favourite: fav, winners: W.reverse(), poles: P.reverse(), tally, favourite_here: mine.reverse(),
      form: { rounds: rounds.filter(Boolean).map(r => ({ round: Number(r.round), name: r.raceName })), drivers: Object.values(form) },
    }, "Jolpica");
  } catch (e) { return fail(e); }
}

// The national sides Parth follows (config follows.national_teams, ESPN ids in national_team_espn_ids): each one's next
// two fixtures and last result, so the app always has every side's next match
export async function intl_hub() {
  try {
    const C = await config(), names = C.follows.national_teams || [], ids = C.follows.national_team_espn_ids || {};
    const teams = await Promise.all(names.filter(n => ids[n]).map(async name => {
      const id = ids[name];
      const [past, next] = await Promise.all([getJSON(`${ESPN}/soccer/all/teams/${id}/schedule`).catch(() => ({ events: [] })), getJSON(`${ESPN}/soccer/all/teams/${id}/schedule?fixture=true`).catch(() => ({ events: [] }))]);
      const row = e => {
        const c = e.competitions?.[0] || {}, cs = c.competitors || [], st = c.status?.type || {};
        const h = cs.find(x => x.homeAway === "home") || {}, a = cs.find(x => x.homeAway === "away") || {};
        return { id: e.id, date: e.date, competition: comp(e.league?.name || e.seasonType?.name), home: h.team?.displayName, home_id: h.team?.id || null, away: a.team?.displayName, away_id: a.team?.id || null,
          completed: !!st.completed, hs: score(h.score), as: score(a.score), venue: c.venue?.fullName || null };
      };
      const res = (past.events || []).map(row).filter(r => r.completed && r.hs != null).sort((x, y) => y.date.localeCompare(x.date));
      const fx = (next.events || []).map(row).filter(r => !r.completed).sort((x, y) => x.date.localeCompare(y.date));
      return { name, id: String(id), next: fx.slice(0, 2), last: res[0] || null };
    }));
    if (!teams.some(t => t.next.length || t.last)) throw new Error("espn national schedules empty");
    return ok({ teams }, "ESPN");
  } catch (e) { return fail(e); }
}

export const SPORTAPP = { madrid_hub, f1_hub, intl_hub };
export const SPORTAPP_CACHE = { madrid_hub: [900, 3600], f1_hub: [3600, 21600], intl_hub: [3600, 21600] };
