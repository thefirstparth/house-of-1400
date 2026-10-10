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

// Goals, penalties, own goals and red cards from an ESPN summary, with the match's state ("in", "post") and its clock
function eventsOf(summary, matchId) {
  if (!summary) return null;
  const st = summary.header?.competitions?.[0]?.status || {};
  const kind = t => (/own goal/i.test(t) ? "og" : /penalty - scored/i.test(t) ? "pen" : /^goal/i.test(t) ? "goal" : /red card/i.test(t) ? "red" : null);
  const events = (summary.keyEvents || []).map(k => ({ kind: kind(k.type?.text || ""), minute: k.clock?.displayValue || null, team_id: k.team?.id ? String(k.team.id) : null, player: k.participants?.[0]?.athlete?.displayName || null }))
    .filter(e => e.kind && e.player);
  return { match_id: matchId, state: st.type?.state || null, detail: st.type?.shortDetail || st.type?.detail || null, events };
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
    let xi = null, preview = null, live = null, recent = null;
    const upcoming = fixtures[0];
    if (upcoming) {
      const s = await getJSON(`${ESPN}/soccer/all/summary?event=${upcoming.id}`).catch(() => null), x = xiOf(s, id);
      if (x) xi = { kind: "official", match_id: upcoming.id, opponent: upcoming.opponent, date: upcoming.date, ...x };
      preview = previewOf(s, upcoming.id);
      // A match under way: its goals, cards and clock (the app refreshes every minute while it is on)
      if (Date.parse(upcoming.date) <= Date.now() + 5 * 6e4) live = eventsOf(s, upcoming.id);
    }
    // The last eight results' goals and red cards (the app lists them under each score and in the match sheet)
    const shown = results.slice(0, 8), sums = new Map(await Promise.all(shown.map(async r => [r.id, await getJSON(`${ESPN}/soccer/all/summary?event=${r.id}`).catch(() => null)])));
    for (const r of shown) { const ev = eventsOf(sums.get(r.id), r.id); if (ev) r.events = ev.events; }
    // The last result's scorers, for a day after it
    if (results[0] && Date.now() - Date.parse(results[0].date) < 30 * 36e5) recent = eventsOf(sums.get(results[0].id), results[0].id);
    if (!xi) {
      const last = results.find(r => r.competition !== "Friendly") || results[0];
      if (last) {
        const s = sums.get(last.id) || await getJSON(`${ESPN}/soccer/all/summary?event=${last.id}`).catch(() => null), x = xiOf(s, id);
        if (x) xi = { kind: "last", match_id: last.id, opponent: last.opponent, date: last.date, competition: last.competition, ...x };
      }
    }
    if (!results.length && !fixtures.length) throw new Error("espn schedule empty");
    return ok({ club: club.name, club_id: String(id), results: results.slice(0, 12), fixtures: fixtures.slice(0, 8), xi, preview, live, recent }, "ESPN");
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
    // each race's result, tried twice; if one still fails the form grid is left out rather than shown a race short
    const one = r => getJSON(`${JOLPICA}/${r.season}/${r.round}/results.json?limit=30`).then(j => j.MRData?.RaceTable?.Races?.[0] || null).catch(() => null);
    let rounds = await Promise.all(done.map(one));
    rounds = await Promise.all(rounds.map((x, i) => x || one(done[i])));
    const complete = rounds.every(Boolean);
    const form = {};
    for (const r of rounds.filter(Boolean)) for (const x of r.Results || []) {
      const code = x.Driver?.code; if (!code) continue;
      (form[code] ||= { code, name: `${x.Driver.givenName} ${x.Driver.familyName}`, results: [] }).results.push({ round: Number(r.round), race: r.raceName, pos: Number(x.position) || null, text: x.positionText, finished: /^\d+$/.test(x.positionText) });
    }
    return ok({
      race: { season: race.season, round: Number(race.round), name: race.raceName, circuit: race.Circuit?.circuitName, circuit_id: cid, locality: race.Circuit?.Location?.locality, country: race.Circuit?.Location?.country, date: new Date(at(race)).toISOString() },
      favourite: fav, winners: W.reverse(), poles: P.reverse(), tally, favourite_here: mine.reverse(),
      form: complete ? { rounds: rounds.map(r => ({ round: Number(r.round), name: r.raceName, country: r.Circuit?.Location?.country || null })), drivers: Object.values(form) } : null,
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
        return { id: e.id, date: e.date, competition: comp(e.league?.name || e.seasonType?.name), home: h.team?.displayName, home_id: h.team?.id || null, home_abbr: h.team?.abbreviation || null, away: a.team?.displayName, away_id: a.team?.id || null, away_abbr: a.team?.abbreviation || null,
          completed: !!st.completed, state: st.state || null, hs: score(h.score), as: score(a.score), venue: c.venue?.fullName || null };
      };
      const res = (past.events || []).map(row).filter(r => r.completed && r.hs != null).sort((x, y) => y.date.localeCompare(x.date));
      const fx = (next.events || []).map(row).filter(r => !r.completed).sort((x, y) => x.date.localeCompare(y.date));
      return { name, id: String(id), next: fx.slice(0, 2), last: res[0] || null };
    }));
    if (!teams.some(t => t.next.length || t.last)) throw new Error("espn national schedules empty");
    return ok({ teams }, "ESPN");
  } catch (e) { return fail(e); }
}

// The ATP rankings: the official list from Tennis Explorer (rank, points, the list's date), with ESPN's photo and flag
// for each player. ESPN's own list runs ahead of the official one (it counts results since the Monday list), so its
// ranks and points are not used; if Tennis Explorer fails, the app gets ESPN's order without points, marked as such.
// A second photo for players ESPN has none for: the lead image of each one's English Wikipedia page, kept only
// when the page describes a tennis player (so "Pedro Martinez" the pitcher is never shown). 50 titles a request.
async function wikiPhotos(names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=160&pilicense=any&titles=${encodeURIComponent(batch.join("|"))}`;
    const j = await fetch(u, { headers: { "user-agent": "HouseOf1400/1.0 (private newspaper)" }, signal: AbortSignal.timeout(8000) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!j?.query?.pages) continue;
    const to = new Map([...(j.query.normalized || []), ...(j.query.redirects || [])].map(x => [x.from, x.to]));
    const page = new Map(j.query.pages.filter(pg => pg.thumbnail?.source && /tennis player/i.test(pg.description || "")).map(pg => [pg.title, pg.thumbnail.source.replace(/\?utm_.*$/, "")]));
    for (const n of batch) { let tt = n; for (let k = 0; k < 3 && to.has(tt); k++) tt = to.get(tt); if (page.has(tt)) out.set(n, page.get(tt)); }
  }
  return out;
}
const withAlt = async ranks => {
  const need = ranks.filter(r => !r.photo).map(r => r.name);
  const w = need.length ? await wikiPhotos(need).catch(() => new Map()) : new Map();
  return ranks.map(r => (w.has(r.name) ? { ...r, alt_photo: w.get(r.name) } : r));
};

export async function tennis_hub() {
  const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
  const key = n => String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  try {
    const [espn, te] = await Promise.all([
      getJSON(`${ESPN}/tennis/atp/rankings`).then(j => j.rankings?.[0]?.ranks || []).catch(() => []),
      fetch("https://www.tennisexplorer.com/ranking/atp-men/", { headers: UA, signal: AbortSignal.timeout(12000) }).then(r => (r.ok ? r.text() : "")).catch(() => ""),
    ]);
    const look = new Map(espn.map(x => [key(x.athlete?.displayName), x.athlete || {}]));
    const date = te.match(/<select[^>]*name="date"[^>]*>[\s\S]*?selected[^>]*>\s*(\d{2})\.\s*(\d{2})\.\s*(\d{4})/);
    const rows = [...te.matchAll(/<td class="rank first">(\d+)\.<\/td>[\s\S]*?<td class="t-name"><a href="\/player\/[^"]+">([^<]+)<\/a>[\s\S]*?<td class="long-point">(\d+)<\/td>/g)];
    if (rows.length >= 20 && date) {
      const ranks = rows.map(([, rk, nm, pts]) => {
        const a = look.get(key(nm)), w = nm.trim().split(/\s+/);
        return { rank: Number(rk), name: a?.displayName || [w.at(-1), ...w.slice(0, -1)].join(" "), id: a?.id || null, points: Number(pts), flag: a?.flag || null, photo: a?.headshot || null };
      });
      // ESPN's players beyond the official top 50, for a photo only (no rank or points from ESPN)
      const have = new Set(ranks.map(r => key(r.name)));
      for (const x of espn) if (x.athlete?.displayName && !have.has(key(x.athlete.displayName))) ranks.push({ rank: null, name: x.athlete.displayName, id: x.athlete.id || null, points: null, flag: x.athlete.flag || null, photo: x.athlete.headshot || null });
      return ok({ name: "ATP", date: `${date[3]}-${date[2]}-${date[1]}`, official: true, ranks: await withAlt(ranks) }, "Tennis Explorer, ESPN, Wikipedia");
    }
    const ranks = espn.map(x => ({ rank: Number(x.current) || null, name: x.athlete?.displayName, id: x.athlete?.id || null, points: null, flag: x.athlete?.flag || null, photo: x.athlete?.headshot || null })).filter(x => x.name && x.rank);
    if (!ranks.length) throw new Error("no rankings from Tennis Explorer or ESPN");
    return ok({ name: "ATP", date: null, official: false, ranks: await withAlt(ranks) }, "ESPN, Wikipedia");
  } catch (e) { return fail(e); }
}

export const SPORTAPP = { madrid_hub, f1_hub, intl_hub, tennis_hub };
export const SPORTAPP_CACHE = { madrid_hub: [900, 3600], f1_hub: [3600, 21600], intl_hub: [3600, 21600], tennis_hub: [3600, 21600] };
