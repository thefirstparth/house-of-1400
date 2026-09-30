// Madridismo's competitions (/api/live/club_stats): for each competition in config follows.football_club.competitions,
// the table (P W D L GD Pts) and the top ten scorers, assisters and ratings.
// Tables, goals and assists: ESPN, then FotMob's public pages. Ratings: FotMob only (ESPN has none), then the edition snapshot.
import { config, getJSON, getText } from "./live.js";

const ESPN_WEB = "https://site.web.api.espn.com/apis";
const TOP = 10;

// ESPN's league-phase or league table: {rank, team, short, id, played, wins, draws, losses, gd, points}.
export function espnTable(j) {
  const g = (j.children?.length ? j.children : [j])[0];
  const rows = (g?.standings?.entries || []).map(e => {
    const s = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.value ?? Number(x.displayValue)]));
    return { rank: s.rank ?? null, team: e.team?.displayName, short: e.team?.shortDisplayName, id: e.team?.id ?? null,
      played: s.gamesPlayed ?? null, wins: s.wins ?? null, draws: s.ties ?? null, losses: s.losses ?? null, gd: s.pointDifferential ?? null, points: s.points ?? null,
      // ESPN's own zone for the row (Round of 16, play-offs, relegation...), for the full table's markers.
      zone: e.note?.description ? { name: e.note.description, color: /^#[0-9a-f]{3,8}$/i.test(e.note.color || "") ? e.note.color : null } : null };
  }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (!rows.length || rows.some(r => r.rank == null || r.points == null || r.played == null)) throw new Error("espn table incomplete");
  return rows;
}

// Standard competition ranking: players level on the stat share a rank (1, 2, 2, 4).
const ranked = list => list.map(p => ({ ...p, rank: p.rank ?? 1 + list.filter(q => q.value > p.value).length }));

// The top ten, but a tie that runs past tenth is dropped rather than cut arbitrarily (one of twenty players on a goal),
// as long as five remain.
export function topN(list, n = TOP) {
  const L = [...list].sort((a, b) => b.value - a.value);
  if (L.length <= n) return L;
  const edge = L[n - 1].value;
  if (L[n].value !== edge) return L.slice(0, n);
  const cut = L.slice(0, n).filter(p => p.value !== edge);
  return cut.length >= 5 ? cut : L.slice(0, n);
}

// ESPN's goals and assists leaders. displayValue reads "Matches: 7, Goals: 12".
export function espnLeaders(j) {
  const pick = name => {
    const L = (j.stats || []).find(s => s.name === name)?.leaders || [];
    return topN(ranked(L.filter(l => l.athlete?.displayName && Number.isFinite(l.value)).map(l => ({
      name: l.athlete.displayName, team: l.athlete.team?.displayName || null, team_id: l.athlete.team?.id ?? null,
      value: l.value, matches: Number(/Matches:\s*(\d+)/.exec(l.displayValue || "")?.[1]) || null,
    }))));
  };
  return { goals: pick("goalsLeaders"), assists: pick("assistsLeaders") };
}

// FotMob's pages carry their data in __NEXT_DATA__.
export function nextData(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html || "");
  if (!m) throw new Error("fotmob: no page data");
  return JSON.parse(m[1]).props?.pageProps || {};
}

// FotMob's league page: its table and the season id its stats pages need.
export function fotmobLeague(p) {
  const d = p.table?.[0]?.data || {};
  const all = d.table?.all || d.tables?.[0]?.table?.all || [];
  const rows = all.map(r => {
    const [f, a] = String(r.scoresStr || "").split("-").map(Number);
    return { rank: r.idx ?? null, team: r.name, short: r.shortName, fotmob_id: r.id, played: r.played ?? null, wins: r.wins ?? null, draws: r.draws ?? null,
      losses: r.losses ?? null, gd: r.goalConDiff ?? (Number.isFinite(f) && Number.isFinite(a) ? f - a : null), points: r.pts ?? null };
  });
  const url = (p.stats?.players || []).map(x => x.fetchAllUrl).find(Boolean) || "";
  const season = /\/season\/(\d+)\//.exec(url)?.[1] || null;
  return { rows, season };
}

// FotMob's full stat list (rating, goals, goal_assist, mins_played): names, team ids (names from the table) and values.
export function fotmobStat(p, teams, { top = TOP } = {}) {
  const list = (p.data?.statsData || []).filter(x => x.name && Number.isFinite(x.statValue?.value));
  return topN(ranked(list.map(x => ({ name: x.name, team: teams.get(x.teamId) || null, team_id: null, fm_id: x.id ?? null, value: x.statValue.value }))), top);
}

// Minutes played (FotMob) for each leader. ESPN's names are matched by name without accents, then by surname and club;
// anyone left unmatched gets no minutes rather than someone else's.
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const clubWords = s => new Set(norm(s).split(" ").filter(w => w.length > 3 && !["club", "real", "sporting", "athletic"].includes(w)));
export function withMinutes(list, mins) {
  if (!list?.length || !mins?.length) return list;
  const byId = new Map(mins.filter(m => m.fm_id != null).map(m => [m.fm_id, m.value]));
  const byName = new Map();
  for (const m of mins) { const k = norm(m.name); byName.set(k, byName.has(k) ? null : m.value); } // null: two players share the name
  return list.map(p => {
    let v = p.fm_id != null ? byId.get(p.fm_id) : undefined;
    if (v === undefined) v = byName.get(norm(p.name));
    if (v === undefined) {
      const last = norm(p.name).split(" ").pop(), cw = clubWords(p.team);
      const hits = mins.filter(m => norm(m.name).split(" ").pop() === last && [...clubWords(m.team)].some(w => cw.has(w)));
      if (hits.length === 1) v = hits[0].value;
    }
    const { fm_id, ...rest } = p;
    return Number.isFinite(v) ? { ...rest, minutes: v } : rest;
  });
}

async function espnPart(comp) {
  const [st, le] = await Promise.allSettled([
    getJSON(`${ESPN_WEB}/v2/sports/soccer/${comp.espn}/standings`),
    getJSON(`${ESPN_WEB}/site/v2/sports/soccer/${comp.espn}/statistics`),
  ]);
  return {
    rows: st.status === "fulfilled" ? (() => { try { return espnTable(st.value); } catch { return null; } })() : null,
    ...(le.status === "fulfilled" ? espnLeaders(le.value) : {}),
  };
}

async function fotmobPart(comp, need) {
  const base = `https://www.fotmob.com/leagues/${comp.fotmob}`;
  const league = fotmobLeague(nextData(await getText(`${base}/stats/${comp.fotmob_slug}`)));
  const teams = new Map(league.rows.map(r => [r.fotmob_id, r.team]));
  const stat = async name => league.season ? fotmobStat(nextData(await getText(`${base}/stats/season/${league.season}/players/${name}/${comp.fotmob_slug}`)), teams) : [];
  const out = { rows: league.rows.length ? league.rows : null };
  const [ratings, goals, assists, mins] = await Promise.allSettled([stat("rating"), need.goals ? stat("goals") : [], need.assists ? stat("goal_assist") : [],
    league.season ? getText(`${base}/stats/season/${league.season}/players/mins_played/${comp.fotmob_slug}`).then(h => fotmobStat(nextData(h), teams, { top: Infinity })) : []]);
  if (mins.status === "fulfilled") out.minutes = mins.value;
  if (ratings.status === "fulfilled") out.ratings = ratings.value;
  if (goals.status === "fulfilled") out.goals = goals.value;
  if (assists.status === "fulfilled") out.assists = assists.value;
  return out;
}

export async function compStats(comp) {
  const E = await espnPart(comp).catch(() => ({}));
  const need = { goals: !E.goals?.length, assists: !E.assists?.length };
  const F = await fotmobPart(comp, need).catch(() => ({}));
  const src = [];
  const pick = (k, label) => { if (E[k]?.length) { src.push(`${label} ESPN`); return E[k]; } if (F[k]?.length) { src.push(`${label} FotMob`); return F[k]; } return null; };
  const rows = pick("rows", "table"), ratings = pick("ratings", "ratings")?.map(({ fm_id, ...p }) => p) || null;
  const goals = withMinutes(pick("goals", "goals"), F.minutes), assists = withMinutes(pick("assists", "assists"), F.minutes);
  if (F.minutes?.length && (goals || assists)?.some(p => p.minutes != null)) src.push("minutes FotMob");
  // FotMob's team ids are not ESPN's: its rows carry no id, so the page shows no crest rather than a wrong one.
  return { key: comp.key, label: comp.label, rows: rows?.map(({ fotmob_id, ...r }) => r) || null, goals, assists, ratings, sources: src };
}

export async function club_stats() {
  const comps = config().follows.football_club.competitions || [];
  try {
    const out = await Promise.all(comps.map(c => compStats(c)));
    const got = out.filter(c => c.rows || c.goals || c.assists || c.ratings);
    if (!got.length) throw new Error("no competition data");
    return { ok: true, value: { comps: got }, source: [...new Set(got.flatMap(c => c.sources.map(s => s.split(" ")[1])))].join(", "), as_of: new Date().toISOString(), stale: false };
  } catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
}

export const FOOTBALL = { club_stats };
export const FOOTBALL_CACHE = { club_stats: [1800, 21600] };
