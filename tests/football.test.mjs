// Madridismo's competitions (lib/football.js): ESPN's tables and leaders, FotMob's pages, and the tie rule at tenth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { espnTable, espnLeaders, fotmobLeague, fotmobStat, nextData, topN, withMinutes } from "../lib/football.js";

const st = (o) => Object.entries(o).map(([name, value]) => ({ name, value, displayValue: String(value) }));
const entry = (id, name, rank, p, w, d, l, gd, pts) => ({ team: { id, displayName: name, shortDisplayName: name.split(" ")[0] }, stats: st({ rank, gamesPlayed: p, wins: w, ties: d, losses: l, pointDifferential: gd, points: pts }) });

test("espnTable: P W D L GD Pts in rank order, and an incomplete table is refused", () => {
  const j = { children: [{ standings: { entries: [entry("86", "Real Madrid", 2, 7, 5, 0, 2, 10, 15), entry("83", "Barcelona", 1, 7, 7, 0, 0, 24, 21)] } }] };
  assert.deepEqual(espnTable(j).map(r => [r.rank, r.team, r.played, r.wins, r.draws, r.losses, r.gd, r.points]),
    [[1, "Barcelona", 7, 7, 0, 0, 24, 21], [2, "Real Madrid", 7, 5, 0, 2, 10, 15]]);
  const bad = { standings: { entries: [{ team: { id: "1", displayName: "X" }, stats: st({ rank: 1 }) }] } };
  assert.throws(() => espnTable(bad), /incomplete/);
});

test("espnLeaders: shared ranks, matches from the display value, team ids kept", () => {
  const L = (n, v, team = "Barcelona", id = "83") => ({ value: v, displayValue: `Matches: 7, Goals: ${v}`, athlete: { displayName: n, team: { displayName: team, id } } });
  const j = { stats: [{ name: "goalsLeaders", leaders: [L("Raphinha", 12), L("Kylian Mbappé", 7, "Real Madrid", "86"), L("Lamine Yamal", 7), L("Camello", 6, "Rayo")] }] };
  const g = espnLeaders(j).goals;
  assert.deepEqual(g.map(p => [p.rank, p.name, p.value, p.matches]), [[1, "Raphinha", 12, 7], [2, "Kylian Mbappé", 7, 7], [2, "Lamine Yamal", 7, 7], [4, "Camello", 6, 7]]);
  assert.equal(g[1].team_id, "86");
  assert.deepEqual(espnLeaders(j).assists, []);
});

test("topN: a tie running past tenth is dropped, unless fewer than five would remain", () => {
  const v = xs => xs.map((value, i) => ({ name: "p" + i, value }));
  assert.deepEqual(topN(v([3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1])).map(p => p.value), [3, 3, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(topN(v([2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1])).map(p => p.value), [2, 2, 2, 2, 2]);
  assert.equal(topN(v([2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).length, 10, "only one would remain: keep ten");
  assert.equal(topN(v([9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5, 0.2])).length, 10);
});

test("FotMob: the table, the season id and a stat list with team names", () => {
  const page = { table: [{ data: { table: { all: [{ name: "Barcelona", shortName: "Barça", id: 8634, played: 7, wins: 7, draws: 0, losses: 0, scoresStr: "31-7", goalConDiff: 24, pts: 21, idx: 1 }] } } }],
    stats: { players: [{ fetchAllUrl: "https://data.fotmob.com/stats/87/season/38843/goals.json" }] } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: page } })}</script>`;
  const lg = fotmobLeague(nextData(html));
  assert.equal(lg.season, "38843");
  assert.deepEqual(lg.rows[0], { rank: 1, team: "Barcelona", short: "Barça", fotmob_id: 8634, played: 7, wins: 7, draws: 0, losses: 0, gd: 24, points: 21 });
  const teams = new Map([[8634, "Barcelona"], [8633, "Real Madrid"]]);
  const r = fotmobStat({ data: { statsData: [{ name: "Raphinha", teamId: 8634, statValue: { value: 9.01 } }, { name: "Kylian Mbappé", teamId: 8633, statValue: { value: 8.18 } }] } }, teams);
  assert.deepEqual(r.map(p => [p.rank, p.name, p.team, p.value]), [[1, "Raphinha", "Barcelona", 9.01], [2, "Kylian Mbappé", "Real Madrid", 8.18]]);
  assert.throws(() => nextData("<html></html>"), /no page data/);
});

test("withMinutes: by FotMob id, by name without accents, by surname and club; never a guess", () => {
  const mins = [
    { name: "Javi Hernández", team: "Espanyol", fm_id: 1, value: 561 },
    { name: "Tete Morente", team: "Elche", fm_id: 2, value: 398 },
    { name: "Raphinha", team: "Barcelona", fm_id: 3, value: 555 },
    { name: "Iñaki Williams", team: "Athletic Club", fm_id: 4, value: 600 },
    { name: "Nico Williams", team: "Athletic Club", fm_id: 5, value: 500 },
  ];
  const out = withMinutes([
    { name: "Javi Hernandez", team: "Espanyol", value: 4 },
    { name: "José Antonio Morente", team: "Elche", value: 3 },
    { name: "Someone", team: "Barcelona", fm_id: 3, value: 2 },
    { name: "I. Williams", team: "Athletic Club", value: 1 },
    { name: "Unknown Player", team: "Girona", value: 1 },
  ], mins);
  assert.deepEqual(out.map(p => p.minutes ?? null), [561, 398, 555, null, null], "two Williamses at one club: no minutes rather than the wrong ones");
  assert.ok(out.every(p => !("fm_id" in p)));
});

test("espnTable keeps ESPN's zone for each row", () => {
  const e = entry("86", "Real Madrid", 1, 1, 1, 0, 0, 1, 3);
  e.note = { description: "Qualifies for round of 16", color: "#81D6AC" };
  assert.deepEqual(espnTable({ standings: { entries: [e] } })[0].zone, { name: "Qualifies for round of 16", color: "#81D6AC" });
});
