// node design/sport-redesign/build.mjs: the Sport redesign mock (2 Oct 2026), baked into one self-contained page from
// the 2 Oct edition and its press-time live figures (snapshot). Nothing is typed by hand; nothing here is production.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const H = new URL("../../", import.meta.url).pathname, here = new URL("./", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8"), b64 = f => readFileSync(H + f).toString("base64");
const DATE = process.argv[2] || "2026-10-02";
const E = JSON.parse(read(`content/editions/${DATE}.json`)), S = E.snapshot || {}, C = JSON.parse(read("config/house.json"));
const v = k => S[k]?.value || null;

// ---- the news: every Sport item, front-page ones in their own section, with the team it belongs to
const SPORT = ["sidelines", "madrid", "paddock", "crease", "deuce", "pitch"], TEAM = { madrid: "madrid", paddock: "f1", crease: "cricket", deuce: "tennis", pitch: "football", sidelines: "other" };
const manifest = existsSync(H + `public/art/${DATE}/manifest.json`) ? JSON.parse(read(`public/art/${DATE}/manifest.json`)) : { pieces: [] };
const artOf = id => { const p = (manifest.pieces || manifest.art || manifest.items || []).find(x => x.story_id === id); const f = p?.file && `public/art/${DATE}/${p.file}`; return f && existsSync(H + f) ? `data:image/webp;base64,${b64(f)}` : null; };
const front = [["lead", E.front?.lead], ...(E.front?.seconds || []).map(x => ["second", x]), ...(E.front?.briefs || []).map(x => ["brief", x])].filter(([, x]) => x && SPORT.includes(x.section));
const stories = [];
for (const [rank, x] of front) stories.push({ id: x.id, section: x.section, team: TEAM[x.section], kind: rank === "brief" ? "brief" : "story", lead: rank === "lead", kicker: x.kicker, headline: x.headline, short: x.short || x.text, why: x.why?.text, sources: (x.sources || []).map(s => s.label).join(", "), art: artOf(x.id), update: x.update || null });
for (const id of SPORT) {
  const s = E.sections?.[id] || {};
  for (const x of s.stories || []) stories.push({ id: x.id, section: id, team: TEAM[id], kind: "story", kicker: x.kicker, headline: x.headline, short: x.short, why: x.why?.text, sources: (x.sources || []).map(s => s.label).join(", "), art: artOf(x.id), update: x.update || null });
  for (const x of s.briefs || []) stories.push({ id: x.id, section: id, team: TEAM[id], kind: "brief", kicker: x.kicker, headline: x.headline, short: x.text, sources: (x.sources || []).map(s => s.label).join(", ") });
  for (const x of s.lines || []) stories.push({ id: x.id, section: id, team: TEAM[id], kind: "line", kicker: x.kicker, headline: x.headline, sources: x.source });
}

// ---- where to watch (config watch_in_india), as the page prints it
const watch = (comp, entity) => (C.watch_in_india?.rules || []).find(r => (r.entity && r.entity === entity) || (r.competition && r.competition === comp))?.where || null;

// ---- the live figures, per team
const F = v("football"), T = v("laliga_table"), mk = k => v("signals")?.[k];
const madrid = F && {
  next: (F.next || []).slice(0, 4).map(m => ({ at: m.date, opp: m.opponent, home: m.home, comp: m.competition, where: watch(m.competition), confirmed: m.time_confirmed })),
  last: F.last && { at: F.last.date, opp: F.last.opponent, home: F.last.home, comp: F.last.competition, us: F.last.score?.us, them: F.last.score?.them, res: F.last.winner === "us" ? "W" : F.last.winner === "them" ? "L" : "D" },
  form: F.form || [], table: (T?.rows || []).map(r => ({ rank: r.rank, team: r.short || r.team, p: r.played, w: r.wins, d: r.draws, l: r.losses, gd: r.gd, pts: r.points, us: /real madrid/i.test(r.team) })),
  market: mk("madrid") && { title: mk("madrid").label, outs: mk("madrid").outcomes.map(o => [o.name.replace(/ CF$/, ""), o.prob]) },
};
const N = v("f1_next"), ST = v("f1_standings"), L = v("f1_last"), FM = v("f1_market");
const maxRow = ST?.drivers?.find(d => d.code === "VER"), lead = ST?.drivers?.[0];
const f1 = N && {
  race: { name: N.race.name, round: N.race.round, circuit: N.race.circuit, place: [N.race.locality, N.race.country].filter(Boolean).join(", "), flag: N.race.flag, sessions: N.race.sessions.map(s => ({ name: s.name, at: s.start })) },
  upcoming: (N.upcoming || []).map(u => ({ name: u.name.replace(" Grand Prix", ""), flag: u.flag, at: u.date, round: u.round })),
  max: maxRow && { pos: maxRow.pos, pts: maxRow.points, behind: lead.points - maxRow.points, leader: lead.name },
  drivers: (ST?.drivers || []).slice(0, 10).map(d => ({ pos: d.pos, name: d.name, code: d.code, team: d.team, pts: d.points })),
  constructors: (ST?.constructors || []).slice(0, 6).map(c => ({ pos: c.pos, name: c.name, pts: c.points })),
  last: L && { name: L.name.replace(" Grand Prix", ""), flag: L.flag, round: L.round, results: L.results.slice(0, 10).map(r => ({ pos: r.pos, name: r.name, code: r.code, team: r.team, time: r.time || r.status })) },
  market: FM?.markets?.[0] && { title: `${N.race.name}: the winner`, outs: FM.markets[0].outcomes.slice(0, 3).map(o => [o.name.split(" ").pop(), o.prob]) },
};
const CR = v("crease");
const cricket = CR && {
  next: CR.next && { at: CR.next.start, opp: CR.next.opponent, desc: CR.next.desc, series: CR.next.series, ground: [CR.next.ground, CR.next.city].filter(Boolean).join(", "), format: CR.next.format },
  series: [CR.main, ...(CR.also || [])].filter(Boolean).map(s => ({ name: s.name, now: s.now, formats: (s.formats || []).map(f => ({ label: f.label, status: f.status || f.score || null, matches: (f.matches || []).map(m => ({ desc: m.desc, at: m.start, state: m.state, status: m.status, opp: m.opponent })) })) })),
  knockouts: (CR.main?.knockouts || []).map(k => ({ stage: k.stage, teams: k.teams, status: k.status, india: k.india, state: k.state })),
  after: CR.after && { name: CR.after.name, first: CR.after.first },
  market: mk("crease") && { title: mk("crease").label, outs: mk("crease").outcomes.map(o => [o.name, o.prob]) },
};
const tennis = (v("tennis_players")?.players || []).map(p => ({ name: p.name, next: p.next && { at: p.next.when_utc, opp: p.next.opponent, event: p.next.event, round: p.next.round, court: p.next.court }, last: p.last && { opp: p.last.opponent, won: p.last.won, round: p.last.round, event: p.last.event, note: p.last.note } }));
const tmk = mk("deuce") && { title: mk("deuce").label, outs: mk("deuce").outcomes.map(o => [o.name.split(" ").pop(), o.prob]) };
const NB = v("nba"), nba = NB && { team: NB.team, preseason: !NB.in_season, next: (NB.next || []).slice(0, 2).map(g => ({ at: g.date, opp: g.opponent, home: g.home })) };
const NATIONS = ["Portugal", "Brazil", "Spain", "England"];
const intl = (v("intl_football")?.matches || []).filter(m => NATIONS.some(n => m.home === n || m.away === n)).slice(0, 8).map(m => ({ at: m.when_utc, home: m.home, away: m.away, score: m.score, state: m.state, league: m.league }));
const fixtures = (E.fixtures || []).map(f => ({ at: f.when_utc, label: f.label, entity: f.entity, where: f.where || watch(null, f.entity === "f1" ? "f1" : null) || (/La Liga/.test(f.label) ? "FanCode" : null), tbc: !!f.time_tbc }));

const P = E.sections?.paddock?.data || {}, f1Preview = P.preview?.text || null, creaseRows = E.sections?.crease?.data?.rows || [];
const DATA = { date: DATE, edition: E.edition_no, stories, fixtures, madrid, f1, cricket, tennis, tennisMarket: tmk, nba, intl, f1Preview, creaseRows, clock: `${DATE}T09:30:00Z` };
const font = (fam, file, w = "100 900", st = "normal") => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64("v2/fonts/" + file)}) format("woff2");font-weight:${w};font-style:${st}}`;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Sport, redesigned</title><style>
${font("Newsreader", "newsreader-latin-opsz-normal.woff2", "200 800")}
${font("Source Serif 4", "source-serif-4-latin-opsz-normal.woff2", "200 900")}
${font("Source Serif 4", "source-serif-4-latin-opsz-italic.woff2", "200 900", "italic")}
${font("Libre Franklin", "libre-franklin-latin-wght-normal.woff2")}
${font("Titillium Web", "titillium-web-latin-600-normal.woff2", "600")}
${font("UnifrakturMaguntia", "unifrakturmaguntia-latin-400-normal.woff2", "400")}
${readFileSync(here + "style.css", "utf8")}
</style></head><body>
<header class="top"><h1>Sport, redesigned</h1><p class="lede">Three ways to separate the sports news from the sports data without losing the context, each drawn from the real 2 Oct paper and its live figures as they stood at press time. Pick a concept, then a screen.</p>
<div class="controls"><div class="seg" id="concepts"></div><div class="seg" id="devices"></div><button type="button" id="theme">Night</button></div>
<p class="why" id="why"></p></header>
<main id="stage"></main>
<script>const DATA = ${JSON.stringify(DATA)};
(() => {
${readFileSync(here + "src.js", "utf8")}
})();</script></body></html>`;
writeFileSync(here + "index.html", page);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB · ${stories.length} items (${stories.filter(s => s.art).length} with art) · fixtures ${fixtures.length}`);
