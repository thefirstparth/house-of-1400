// The trial's sport feeds (lib/look-sport.js): parsing only, from fixtures (ESPN's own answers, trimmed; Arctic Shift's
// archive of r/formula1 and r/F1Technical; Reddit's listing and Atom shapes; Jolpica, ESPN's F1 scoreboard and OpenF1's
// shapes for the Qatar weekend), no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRedditJSON, parseRedditRSS, tableRows, leagueSeries, titleRace, parseMatch, lastFrom, look_match, fromArctic, rankChatter, worthReading,
  weekendOf, espnSessions, openf1Sessions, jolpicaRows, agreeSession, buildWeekend, lapTime, trackIcon, lineupOf, formOf } from "../lib/look-sport.js";

const fx = f => readFileSync(new URL(`./fixtures/look-sport/${f}`, import.meta.url), "utf8");
const J = f => JSON.parse(fx(f));

// 28 Nov 2026, 18:45 UTC (qualifying in Qatar)
const NOW = Date.parse("2026-11-28T18:45:00Z");

test("chatter: Arctic Shift posts, less housekeeping, bots, off-topic, NSFW and what the moderators removed", () => {
  const all = J("arctic-f1.json").data.map(fromArctic).filter(Boolean);
  const titles = all.map(p => p.title);
  assert.ok(!titles.some(t => /Qualifying Discussion/.test(t)), "AutoModerator's session thread");
  assert.ok(!titles.some(t => /\[OT\]|F2/.test(t)), "off-topic");
  assert.ok(!titles.some(t => /not safe/.test(t)), "NSFW");
  assert.ok(!titles.some(t => /Bradley Lord/.test(t)), "removed by the moderators");
  const it = all.find(p => /protection software/.test(p.title));
  assert.equal(it.outlet, "Motorsport Italia");
  assert.match(it.title, /^Mercedes: New protection/);
  assert.equal(it.url, "https://www.reddit.com/r/formula1/comments/1y7nkx7/");
  assert.equal(it.domain, "it.motorsport.com");
  assert.equal(it.flair, "News");
  assert.equal(worthReading("2026 Qatar GP - Free Practice 3 Discussion"), false);
  assert.equal(worthReading("Hankook prepares a bid for the tyre deal"), true);
});

test("chatter: ranked by flair, age and the followed names; one post per story; old posts out", () => {
  const all = [...J("arctic-f1.json").data, ...J("arctic-f1tech.json").data].map(fromArctic).filter(Boolean);
  const p = rankChatter(all, { follows: ["Verstappen", "Red Bull"], now: NOW, max: 6 });
  assert.equal(p.length, 6);
  // the two posts naming Red Bull lead, tagged
  assert.deepEqual(p.slice(0, 2).map(x => x.tags), [["Red Bull"], ["Red Bull"]]);
  assert.ok(p.every(x => !("weight" in x) && !("score" in x)));
  // the Hankook story once, however many reposts
  assert.equal(p.filter(x => /Hankook/i.test(x.title)).length <= 1, true);
  // at most two from r/F1Technical
  assert.ok(p.filter(x => x.sub === "r/F1Technical").length <= 2);
  // a post from five days ago is not chatter
  assert.ok(!p.some(x => /Las Vegas after a late safety car/.test(x.title)));
});

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

// ---------------------------------------------------------------- the race weekend
test("weekend: Jolpica's weekend on the card, sessions in order, no sprint at Qatar", () => {
  const W = weekendOf(J("jolpica-current.json"), NOW);
  assert.equal(W.name, "Qatar Grand Prix");
  assert.equal(W.circuit_id, "losail");
  assert.deepEqual(W.sessions.map(s => s.name), ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]);
  assert.equal(W.sprint, false);
  // three hours after lights out the card moves on
  assert.equal(weekendOf(J("jolpica-current.json"), Date.parse("2026-11-29T19:30:00Z")).name, "Abu Dhabi Grand Prix");
  assert.match(trackIcon("losail"), /Track%20icons%204x3\/Qatar%20carbon\.png$/);
  assert.equal(trackIcon("madring"), null);
});

test("weekend: ESPN's states (qualifying on), OpenF1's rows, Jolpica's qualifying times", () => {
  const W = weekendOf(J("jolpica-current.json"), NOW);
  const e = espnSessions(J("espn-f1-qatar.json"), W);
  assert.deepEqual(e.map(x => [x.name, x.state]), [["Practice 1", "post"], ["Practice 2", "post"], ["Practice 3", "post"], ["Qualifying", "in"], ["Race", "pre"]]);
  assert.equal(e[0].order[0], "Kimi Antonelli");
  const o = J("openf1-qatar.json"), of1 = openf1Sessions(o.sessions, o.results, o.drivers);
  assert.deepEqual(of1["Practice 1"].rows[0], { sur: "Antonelli", code: "ANT", colour: "#27F4D2", time: "1:23.217" });
  assert.equal(lapTime(82.4), "1:22.400");
  assert.equal(lapTime(null), null);
  const jr = jolpicaRows({ MRData: { RaceTable: { Races: [{ QualifyingResults: [{ position: "2", Driver: { familyName: "Antonelli", code: "ANT" }, Q1: "1:23.0", Q2: "1:22.8", Q3: "1:22.708" }, { position: "1", Driver: { familyName: "Russell", code: "RUS" }, Q1: "1:23.1", Q2: "1:22.7", Q3: "1:22.557" }] }] } } }, "QualifyingResults");
  assert.deepEqual(jr.map(r => [r.code, r.time]), [["RUS", "1:22.557"], ["ANT", "1:22.708"]]);
});

test("weekend: a session's quickest and Max's place print only where two sources agree", () => {
  const W = weekendOf(J("jolpica-current.json"), NOW);
  const o = J("openf1-qatar.json");
  const v = buildWeekend({ W, espn: espnSessions(J("espn-f1-qatar.json"), W), openf1: openf1Sessions(o.sessions, o.results, o.drivers), follow: "Max Verstappen", now: NOW });
  const by = Object.fromEntries(v.sessions.map(s => [s.name, s]));
  assert.deepEqual(by["Practice 1"].top, { name: "Kimi Antonelli", code: "ANT", colour: "#27F4D2", time: "1:23.217", sources: ["ESPN", "OpenF1"] });
  // ESPN says Antonelli, OpenF1 (here) Russell: no quickest at all
  assert.equal(by["Practice 2"].top, null);
  // Max third in FP3 by both; fourth in FP1 by OpenF1 only (ESPN has him elsewhere): no place
  assert.deepEqual(by["Practice 3"].max, { pos: 3, sources: ["ESPN", "OpenF1"] });
  assert.equal(by["Practice 1"].max, null);
  // qualifying is on: no result yet; the race to come neither
  assert.equal(by.Qualifying.state, "in");
  assert.equal("top" in by.Qualifying, false);
  assert.equal("top" in by.Race, false);
  // OpenF1 locked (a session running): ESPN alone is not enough
  const locked = buildWeekend({ W, espn: espnSessions(J("espn-f1-qatar.json"), W), follow: "Max Verstappen", now: NOW });
  assert.equal(locked.sessions[0].top, null);
});

test("weekend: ESPN and Jolpica agree without OpenF1 (the time from Jolpica)", () => {
  const r = agreeSession({ espn: ["George Russell", "Kimi Antonelli", "Max Verstappen"], jolpica: [{ sur: "Russell", code: "RUS", time: "1:22.557" }, { sur: "Antonelli", code: "ANT", time: "1:22.708" }, { sur: "Verstappen", code: "VER", time: "1:22.833" }] }, "Max Verstappen");
  assert.deepEqual(r.top, { name: "George Russell", code: "RUS", colour: null, time: "1:22.557", sources: ["ESPN", "Jolpica"] });
  assert.deepEqual(r.max, { pos: 3, sources: ["ESPN", "Jolpica"] });
});

// ---------------------------------------------------------------- the match centre's views
test("match: line-ups placed in their formations, left to right as each side sees it", () => {
  const m = parseMatch(J("summary-sab-bar.json"));
  const [h, a] = m.lineups;
  assert.equal(h.formation, "4-2-3-1");
  assert.deepEqual(h.lines.map(l => l.length), [1, 4, 2, 3, 1]);
  assert.deepEqual(h.lines[1].map(p => p.pos), ["LB", "CD-L", "CD-R", "RB"]);
  assert.deepEqual(a.lines.map(l => l.map(p => p.pos)), [["G"], ["LB", "CD-L", "CD-R", "RB"], ["LM", "CM", "RM"], ["LF", "F", "RF"]]);
  const gordon = a.lines[3][0];
  assert.equal(gordon.short, "Gordon");
  assert.equal(gordon.goals, 2);
  assert.equal(gordon.off, true);
  // a mononym keeps its name (ESPN gives Gavi no last name)
  assert.equal(a.lines[2][1].short, "Gavi");
  assert.equal(a.bench[0].on, true);
  assert.equal(h.lines[2][0].yellow, true);
});

test("match: a line-up that cannot be drawn is not drawn", () => {
  const r = J("summary-sab-bar.json").rosters[0];
  assert.equal(lineupOf({ ...r, formation: "" }), null);
  assert.equal(lineupOf({ ...r, roster: r.roster.map((p, i) => (i === 3 ? { ...p, position: { abbreviation: "" } } : p)) }), null);
  assert.equal(lineupOf(null), null);
});

test("match: every shot with a place, the longer stat list, each side's form latest first", () => {
  const m = parseMatch(J("summary-sab-bar.json"));
  assert.equal(m.shots.length, 33);
  assert.equal(m.shots.filter(s => s.out === "goal").length, 5);
  assert.ok(m.shots.every(s => s.x >= 50 && s.x <= 100 && s.y >= 0 && s.y <= 100));
  assert.deepEqual(m.shots.filter(s => s.side === 0).length, 8);
  const keys = m.statsAll.map(s => s.key);
  assert.ok(keys.includes("saves") && keys.includes("totalTackles"));
  // no red cards for either side: no line for them
  assert.ok(!keys.includes("redCards"));
  assert.deepEqual(m.form, [["L", "L", "W", "L", "W"], ["W", "W", "W", "W", "L"]]);
  assert.deepEqual(formOf([], m.teams), [null, null]);
});

test("match: the old fixture (no rosters) has no line-ups and still parses", () => {
  const m = parseMatch(J("summary-rma-psv.json"));
  assert.equal(m.lineups, null);
  assert.equal(m.form, null);
});
