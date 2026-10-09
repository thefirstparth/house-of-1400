// Paddock Notes' data through the year (1 Oct 2026): team colours from F1's data, the circuit map, and the off-season
// (December: the season just finished, then next year's opener once its calendar is out; January to March: last
// season's final table and finale until the new season's first race).
import { test } from "node:test";
import assert from "node:assert/strict";

const J = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const day = 864e5, now = Date.now(), d = ms => new Date(ms).toISOString().slice(0, 10);
const race = (season, round, name, off) => ({ season: String(season), round: String(round), raceName: name, Circuit: { circuitName: "C", Location: { locality: "L", country: "Spain" } }, date: d(now + off), time: "12:00:00Z" });
const standings = (season, list) => ({ MRData: { StandingsTable: { season: String(season), StandingsLists: list } } });
const drivers = [{ position: "1", points: "400", wins: "9", Driver: { givenName: "Andrea Kimi", familyName: "Antonelli", code: "ANT" }, Constructors: [{ name: "Mercedes" }] },
  { position: "2", points: "300", wins: "5", Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" }, Constructors: [{ name: "Red Bull" }] }];
const results = season => ({ MRData: { RaceTable: { season: String(season), Races: [{ season: String(season), round: "24", raceName: "Abu Dhabi Grand Prix", date: d(now - 20 * day), time: "13:00:00Z", Circuit: { Location: { country: "UAE" } },
  Results: [{ position: "1", points: "25", status: "Finished", Time: { time: "1:30:00.000" }, laps: "58", Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" }, Constructor: { name: "Red Bull" } },
    { position: "2", points: "18", status: "+1 Lap", laps: "57", Driver: { givenName: "Andrea Kimi", familyName: "Antonelli", code: "ANT" }, Constructor: { name: "Mercedes" } }] }] } } });

async function withRoutes(routes, fn) {
  const saved = globalThis.fetch;
  globalThis.fetch = async url => { for (const [re, body] of routes) if (re.test(String(url))) return J(typeof body === "function" ? body(String(url)) : body); return new Response("no", { status: 404 }); };
  try { return await fn(); } finally { globalThis.fetch = saved; }
}
const openf1 = [
  [/openf1\.org\/v1\/drivers/, [{ name_acronym: "ANT", team_colour: "00d7b6", first_name: "Kimi", last_name: "Antonelli" }, { name_acronym: "VER", team_colour: "4781D7", first_name: "Max", last_name: "Verstappen" }]],
  [/openf1\.org\/v1\/meetings/, [{ date_start: new Date(now + 40 * day).toISOString(), date_end: new Date(now + 43 * day).toISOString(), circuit_short_name: "Melbourne", circuit_image: "https://media.formula1.com/x/melbourne.webp", is_cancelled: false }]],
];

test("December: the season is over; next year's opener (with its map) once the calendar is out", async () => {
  const { LIVE } = await import("../lib/live.js");
  const done = [race(2026, 23, "Qatar Grand Prix", -30 * day), race(2026, 24, "Abu Dhabi Grand Prix", -20 * day)];
  const before = await withRoutes([[/current\.json/, { MRData: { RaceTable: { Races: done } } }], [/2027\.json/, { MRData: { RaceTable: { Races: [] } } }], ...openf1], () => LIVE.f1_next());
  assert.equal(before.value.season_over, true);
  assert.equal(before.value.race, null);
  const after = await withRoutes([[/current\.json/, { MRData: { RaceTable: { Races: done } } }], [/2027\.json/, { MRData: { RaceTable: { Races: [race(2027, 1, "Australian Grand Prix", 42 * day), race(2027, 2, "Chinese Grand Prix", 56 * day)] } } }], ...openf1], () => LIVE.f1_next());
  assert.equal(after.value.next_season, true);
  assert.equal(after.value.race.name, "Australian Grand Prix");
  assert.equal(after.value.race.track.image, "https://media.formula1.com/x/melbourne.webp");
  assert.equal(after.value.upcoming[0].name, "Chinese Grand Prix");
});

test("January: last season's final table and finale until the new season's first race; colours and names from F1", async () => {
  const { LIVE } = await import("../lib/live.js");
  const routes = [
    [/current\/driverStandings/, standings(2027, [])], [/current\/constructorStandings/, standings(2027, [])],
    [/2026\/driverStandings/, standings(2026, [{ season: "2026", round: "24", DriverStandings: drivers }])],
    [/2026\/constructorStandings/, standings(2026, [{ season: "2026", round: "24", ConstructorStandings: [{ position: "1", points: "700", wins: "12", Constructor: { name: "Mercedes" } }] }])],
    [/current\/last\/results/, { MRData: { RaceTable: { season: "2027", Races: [] } } }], [/2026\/last\/results/, results(2026)], ...openf1,
  ];
  const S = await withRoutes(routes, () => LIVE.f1_standings());
  assert.equal(S.value.prior, true);
  assert.equal(S.value.season, "2026");
  assert.deepEqual(S.value.drivers.map(x => [x.code, x.colour, x.shown]), [["ANT", "#00D7B6", "Kimi Antonelli"], ["VER", "#4781D7", "Max Verstappen"]]);
  assert.equal(S.value.constructors[0].colour, "#00D7B6", "a team's colour is its drivers' colour");
  const L = await withRoutes(routes, () => LIVE.f1_last());
  assert.equal(L.value.season, "2026");
  assert.deepEqual(L.value.results.map(r => [r.code, r.time, r.status]), [["VER", "1:30:00.000", "Finished"], ["ANT", null, "+1 Lap"]]);
});

// The fixture list's F1 results (9 Oct 2026): a session's top three only where two sources agree on them.
test("f1_sessions: a finished session's top three where two sources agree; none where they differ", async () => {
  const { LIVE, agreedTop } = await import("../lib/live.js");
  const at = ms => new Date(ms).toISOString(), sq = now - 3 * 36e5, q = now - 1 * 36e5, rc = now + day;
  const weekend = { season: "2026", round: "17", raceName: "Singapore Grand Prix", Circuit: { circuitName: "Marina Bay Street Circuit", Location: { locality: "Marina Bay", country: "Singapore" } },
    date: d(rc), time: at(rc).slice(11, 19) + "Z", FirstPractice: { date: d(sq - day), time: at(sq - day).slice(11, 19) + "Z" },
    SprintQualifying: { date: d(sq), time: at(sq).slice(11, 19) + "Z" }, Qualifying: { date: d(q), time: at(q).slice(11, 19) + "Z" } };
  const drv = [[3, "Verstappen"], [63, "Russell"], [16, "Leclerc"], [12, "Antonelli"]].map(([n, l]) => ({ driver_number: n, last_name: l }));
  const routes = [
    [/current\.json/, { MRData: { RaceTable: { Races: [weekend] } } }],
    [/openf1\.org\/v1\/sessions/, [{ session_key: 1, meeting_key: 9, session_name: "Sprint Qualifying", date_start: at(sq) }, { session_key: 2, meeting_key: 9, session_name: "Qualifying", date_start: at(q) }]],
    [/openf1\.org\/v1\/session_result/, [[1, 3, 1], [1, 63, 2], [1, 16, 3], [2, 3, 1], [2, 63, 2], [2, 16, 3]].map(([s, n, p]) => ({ session_key: s, driver_number: n, position: p }))],
    [/openf1\.org\/v1\/drivers/, drv],
    [/racing\/f1\/scoreboard/, { events: [{ competitions: [
      { date: at(sq), type: { abbreviation: "SS" }, status: { type: { completed: true } }, competitors: ["Max Verstappen", "George Russell", "Charles Leclerc"].map((n, i) => ({ order: i + 1, athlete: { displayName: n } })) },
      { date: at(q), type: { abbreviation: "Qual" }, status: { type: { completed: true } }, competitors: ["Max Verstappen", "Kimi Antonelli", "Charles Leclerc"].map((n, i) => ({ order: i + 1, athlete: { displayName: n } })) }] }] }],
    [/2026\/17\/qualifying/, { MRData: { RaceTable: { Races: [] } } }],
  ];
  const r = await withRoutes(routes, () => LIVE.f1_sessions());
  assert.equal(r.value.race.round, 17);
  assert.deepEqual(r.value.results.map(x => [x.name, x.top, x.sources]), [["Sprint Qualifying", ["Verstappen", "Russell", "Leclerc"], ["OpenF1", "ESPN"]]], "qualifying: OpenF1 and ESPN differ, Jolpica has nothing yet");
  assert.deepEqual(agreedTop([null, { top: ["Hülkenberg", "Kimi Antonelli", "Norris"], source: "Jolpica" }, { top: ["HULKENBERG", "Antonelli", "Norris"], source: "OpenF1" }]).sources, ["Jolpica", "OpenF1"]);
});
