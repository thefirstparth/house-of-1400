// The trial's sport feeds (lib/look-sport.js): parsing only, from fixtures (ESPN's own answers, trimmed; Reddit's
// listing and Atom shapes), no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRedditJSON, parseRedditRSS, tableRows, leagueSeries, titleRace, parseMatch, lastFrom, look_match } from "../lib/look-sport.js";

const fx = f => readFileSync(new URL(`./fixtures/look-sport/${f}`, import.meta.url), "utf8");
const J = f => JSON.parse(fx(f));

test("chatter: Reddit JSON drops stickied and NSFW posts, decodes titles, best-scored first", () => {
  const p = parseRedditJSON(J("reddit-top.json"));
  assert.deepEqual(p.map(x => x.title), ["Lusail onboard lap", "Verstappen & Red Bull fastest in FP1", "Bearman stays at Haas for 2027"]);
  assert.equal(p[0].url, "https://www.reddit.com/r/formula1/comments/ccc333/onboard/");
  assert.equal(p[0].author, "u/fan_two");
  assert.equal(p[1].comments, 512);
  assert.equal(p[1].flair, "News");
  assert.match(p[0].at, /^2026-11-/);
});

test("chatter: Reddit Atom keeps the day's r/formula1 posts only", () => {
  const p = parseRedditRSS(fx("reddit-top.rss"), Date.parse("2026-11-27T12:00:00Z"));
  assert.deepEqual(p.map(x => x.title), ["Lusail onboard lap", "Verstappen & Red Bull fastest in FP1"]);
  assert.equal(p[0].author, "u/fan_two");
  assert.equal(p[0].score, null);
});

test("chatter: an empty or refused answer gives no posts", () => {
  assert.deepEqual(parseRedditJSON({}), []);
  assert.deepEqual(parseRedditRSS("<html>blocked</html>"), []);
});

test("title race: points after each league match, checked against the table", () => {
  const table = tableRows(J("table-esp1.json"));
  assert.equal(table[0].team, "Barcelona");
  const r = titleRace({ table, us: J("sched-rm.json"), them: J("sched-bar.json"), fixtures: J("sched-rmfx.json"), clubId: 86, now: Date.parse("2026-11-27T12:00:00Z") });
  assert.equal(r.us.name, "Real Madrid");
  assert.equal(r.rival.name, "Barcelona");
  assert.deepEqual(r.us.series, [3, 6, 9, 9, 12, 15, 15, 18, 21, 24, 27, 30, 33]);
  assert.equal(r.rival.series.at(-1), 36);
  assert.equal(r.us.series.length, r.us.played);
  assert.equal(r.next.opponent, "Alavés");
  assert.equal(r.next.home, true);
});

test("title race: refuses when the computed points do not match the table", () => {
  const table = tableRows(J("table-esp1.json")).map(r => (r.id === "86" ? { ...r, points: r.points + 1 } : r));
  assert.throws(() => titleRace({ table, us: J("sched-rm.json"), them: J("sched-bar.json"), fixtures: J("sched-rmfx.json"), clubId: 86 }), /computed/);
});

test("title race: when the club leads, the rival is the runner-up", () => {
  const table = tableRows(J("table-esp1.json")).map(r => ({ ...r, rank: r.id === "86" ? 0 : r.rank })).sort((a, b) => a.rank - b.rank);
  // the runner-up is now Barcelona (rank 1), so the same two schedules still apply
  const r = titleRace({ table, us: J("sched-rm.json"), them: J("sched-bar.json"), fixtures: { events: [] }, clubId: 86 });
  assert.equal(r.rival.name, "Barcelona");
  assert.equal(r.next, null);
});

test("league series: a draw is one point, scores read from ESPN's objects", () => {
  const ev = (id, date, us, them) => ({ id, date, competitions: [{ status: { type: { completed: true, state: "post" } }, competitors: [{ homeAway: "home", team: { id: "1" }, score: { displayValue: String(us) } }, { homeAway: "away", team: { id: "2", displayName: "B" }, score: { displayValue: String(them) } }] }] });
  const s = leagueSeries({ events: [ev("b", "2026-09-02T00:00Z", 1, 1), ev("a", "2026-09-01T00:00Z", 2, 0), ev("c", "2026-09-03T00:00Z", 0, 3)] }, "1");
  assert.deepEqual(s.map(r => [r.res, r.pts]), [["W", 3], ["D", 4], ["L", 4]]);
});

test("match: score, scorers by side (penalty marked), stat boxes, momentum, cards, commentary latest first", () => {
  const m = parseMatch(J("summary-rma-psv.json"));
  assert.equal(m.league.slug, "uefa.champions");
  assert.equal(m.league.name, "Champions League");
  assert.deepEqual(m.teams.map(t => [t.name, t.score, t.home]), [["Real Madrid", 5, true], ["PSV Eindhoven", 1, false]]);
  assert.deepEqual(m.teams[0].scorers.map(s => s.who), ["Federico Valverde", "Jude Bellingham", "Kylian Mbappé", "Kylian Mbappé", "Vinícius Júnior"]);
  assert.deepEqual(m.teams[1].scorers, [{ who: "Ivan Perisic", minute: "32'", pen: true, og: false }]);
  assert.deepEqual(m.stats.map(s => s.label), ["Possession", "Shots", "On target", "Corners", "Passes", "Fouls"]);
  assert.deepEqual(m.stats.find(s => s.key === "totalShots"), { key: "totalShots", label: "Shots", home: 24, away: 10 });
  // every shot in the commentary is counted (24 + 10 in the box score)
  const shots = m.momentum.buckets.reduce((a, b) => a + b.home + b.away, 0);
  assert.ok(shots >= 34, `momentum counts ${shots}`);
  assert.equal(m.momentum.goals.length, 6);
  assert.equal(m.events.filter(e => e.kind === "yellow").length, 4);
  assert.equal(m.events.filter(e => e.kind === "goal").length, 6);
  assert.match(m.commentary[0].text, /^Match ends/);
  assert.equal(m.teams[0].logo, "https://a.espncdn.com/i/teamlogos/soccer/500/86.png");
});

test("match: a match not yet played has no stats, goals or momentum", () => {
  const j = J("summary-rma-psv.json");
  j.header.competitions[0].status = { type: { state: "pre", completed: false, shortDetail: "Sat 20:00" } };
  const m = parseMatch(j);
  assert.deepEqual(m.stats, []);
  assert.deepEqual(m.events, []);
  assert.deepEqual(m.teams[0].scorers, []);
});

test("match: an own goal goes to the side it counted for", () => {
  const j = J("summary-rma-psv.json");
  j.keyEvents = [{ type: { type: "own-goal" }, scoringPlay: true, text: "Own Goal by X, PSV Eindhoven. Real Madrid 1, PSV Eindhoven 0.", clock: { displayValue: "10'" }, team: { id: "148" }, participants: [{ athlete: { displayName: "X" } }] },
    { type: { type: "goal" }, scoringPlay: true, text: "Goal! Real Madrid 1, PSV Eindhoven 1. Y (PSV Eindhoven) header.", clock: { displayValue: "20'" }, team: { id: "148" }, participants: [{ athlete: { displayName: "Y" } }] }];
  const m = parseMatch(j);
  // the own goal's text has no "Goal!" running score: it falls back to nothing rather than guess the side
  assert.deepEqual(m.teams[1].scorers.map(s => s.who), ["Y"]);
  j.keyEvents[0].text = "Goal! Real Madrid 1, PSV Eindhoven 0. Own Goal by X, PSV Eindhoven.";
  assert.deepEqual(parseMatch(j).teams[0].scorers.map(s => [s.who, s.og]), [["X", true]]);
});

test("match feed: a bad event id is refused without a request", async () => {
  const r = await look_match(new URLSearchParams("e=abc&l=esp.1"));
  assert.equal(r.ok, false);
  assert.match(r.error, /bad event id/);
});

test("last match: the latest finished one", () => {
  const e = lastFrom(J("sched-rm.json"), Date.parse("2026-11-27T12:00:00Z"));
  assert.equal(e.id, "401882798");
});
