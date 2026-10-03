// football-data.org (Daniel Freitag's free API, since 2014): the backup for Madrid's matches and the La Liga table when
// ESPN fails (Parth, 3 Oct; "No football backup API" until then). Free tier: La Liga, the Champions League and the
// other top leagues, 10 calls a minute. The token is the Vercel env var "football", sent as the X-Auth-Token header
// (football-data's instruction). Shapes match lib/live.js espnEvent and laliga_table rows, so the page cannot tell.
import { getJSON } from "./live.js";

const FD = "https://api.football-data.org/v4";
const token = () => process.env.football || process.env.FOOTBALL || process.env.FOOTBALL_DATA || "";
const get = path => { const t = token(); if (!t) throw new Error("no football-data token in the environment"); return getJSON(`${FD}${path}`, { timeout: 8000, headers: { "X-Auth-Token": t } }); };
const COMP = { PD: "La Liga", CL: "Champions League", CDR: "Copa del Rey", SA: "Serie A", PL: "Premier League", BL1: "Bundesliga", FL1: "Ligue 1", PPL: "Primeira Liga", WC: "World Cup", EC: "European Championship" };
const STATE = { SCHEDULED: "pre", TIMED: "pre", IN_PLAY: "in", PAUSED: "in", FINISHED: "post", AWARDED: "post", POSTPONED: "pre", SUSPENDED: "pre", CANCELLED: "post" };

// One match, from the club's side, in ESPN's shape
export function fdEvent(m, teamId) {
  const home = m.homeTeam?.id === teamId, me = home ? m.homeTeam : m.awayTeam, opp = home ? m.awayTeam : m.homeTeam;
  const ft = m.score?.fullTime || {}, us = home ? ft.home : ft.away, them = home ? ft.away : ft.home, w = m.score?.winner;
  const state = STATE[m.status] || null, completed = state === "post";
  return {
    id: `fd${m.id}`, date: m.utcDate, name: `${m.awayTeam?.name} at ${m.homeTeam?.name}`,
    competition: COMP[m.competition?.code] || m.competition?.name || null, home, opponent: opp?.shortName || opp?.name || null, opponent_id: null,
    venue: m.venue || null, state, completed, detail: m.status, time_confirmed: m.status !== "SCHEDULED",
    score: { us: us ?? null, them: them ?? null },
    winner: !completed ? null : w === "DRAW" ? null : (w === "HOME_TEAM") === home ? "us" : "them",
    _me: me?.id,
  };
}
export async function fdTeam(teamId, now = Date.now()) {
  const d = ms => new Date(ms).toISOString().slice(0, 10);
  const j = await get(`/teams/${teamId}/matches?dateFrom=${d(now - 75 * 864e5)}&dateTo=${d(now + 75 * 864e5)}`);
  const all = (j.matches || []).map(m => fdEvent(m, teamId));
  const next = all.filter(e => !e.completed && Date.parse(e.date) > now - 3 * 36e5).sort((a, b) => a.date.localeCompare(b.date));
  const done = all.filter(e => e.completed && e.detail !== "CANCELLED").sort((a, b) => b.date.localeCompare(a.date));
  if (!next.length && !done.length) throw new Error("football-data: no matches");
  return { next: next.slice(0, 5), last: done[0] || null, form: done.slice(0, 5).map(e => (e.winner === "us" ? "W" : e.winner === "them" ? "L" : "D")) };
}
export async function fdTable(code = "PD") {
  const j = await get(`/competitions/${code}/standings`);
  const t = (j.standings || []).find(s => s.type === "TOTAL")?.table || [];
  if (!t.length) throw new Error("football-data: empty table");
  return t.map(r => ({ rank: r.position, team: r.team?.name, short: r.team?.shortName, id: null, played: r.playedGames, wins: r.won, draws: r.draw, losses: r.lost, points: r.points, gd: r.goalDifference }));
}
