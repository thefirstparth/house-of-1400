import { readFileSync } from "node:fs";
// Offline tests for the source trial's parsers and scoring (lib/trial.js, scripts/trial.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";

import { cluster, nearAlerts, parseDate, parseFeed, parseFomc, parseIcs, parseWhereIsCricket, sacnilkTitles, tennisPlayers, wireCandidates } from "../lib/trial.js";
import { coverage, matchItem, missedCandidates, sourceQuality, tennisCheck, tierOf, wicTime } from "../scripts/trial.mjs";

const gnItem = (title, outlet, related) => `<item><title>${title} - ${outlet}</title><link>https://news.google.com/rss/articles/x</link><pubDate>Mon, 28 Sep 2026 03:36:39 GMT</pubDate>
<description>&lt;ol&gt;${related.map(([t, o]) => `&lt;li&gt;&lt;a href="https://news.google.com/rss/articles/y" target="_blank"&gt;${t}&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;${o}&lt;/font&gt;&lt;/li&gt;`).join("")}&lt;/ol&gt;</description><source url="https://x.com">${outlet}</source></item>`;

test("Google News items: title without the outlet, the outlet, and the related coverage", () => {
  const xml = `<rss><channel>${gnItem("Toll soars to 81 as UP is lashed by rain", "The Times of India", [["Toll soars to 81 as UP is lashed by rain", "The Times of India"], ["UP rain deaths rise to 81", "The Hindu"], ["81 dead in Uttar Pradesh rain", "NDTV"]])}</channel></rss>`;
  const [i] = parseFeed(xml, { id: "gn-in-top", section: "front", kind: "signal", name: "Google News" });
  assert.equal(i.title, "Toll soars to 81 as UP is lashed by rain");
  assert.equal(i.outlet, "The Times of India");
  assert.deepEqual(i.related.map(r => r.outlet), ["The Times of India", "The Hindu", "NDTV"]);
  assert.equal(i.date, "2026-09-28T03:36:39.000Z");
});

test("outlet feeds: CDATA, entities and SEBI's date without a time", () => {
  const xml = `<rss><channel><item><title><![CDATA[IRDAI&#8217;s caps]]></title><link>https://www.livemint.com/a</link><pubDate><![CDATA[Sat, 26 Sep 2026 23:27:11 +0530]]></pubDate><description>Short &amp; clear</description></item></channel></rss>`;
  const [i] = parseFeed(xml, { id: "mint", section: "ledger", kind: "news", name: "Mint" });
  assert.equal(i.title, "IRDAI’s caps"); assert.equal(i.snippet, "Short & clear"); assert.equal(i.url, "https://www.livemint.com/a");
  assert.equal(new Date(parseDate("24 Sep, 2026 +0530")).toISOString(), "2026-09-23T18:30:00.000Z");
});

test("clustering joins an outlet's own item to the Google story that lists its headline", () => {
  const items = [
    { kind: "signal", feed: "gn-in-top", position: 0, title: "Toll soars to 81 as UP is lashed by rain", outlet: "The Times of India", related: [{ title: "UP rain deaths rise to 81", outlet: "The Hindu" }] },
    { kind: "news", feed: "hindu-national", title: "UP rain deaths rise to 81", outlet: "The Hindu, national", url: "https://thehindu.com/a" },
    { kind: "news", feed: "ie-india", title: "Election Commission meets parties", outlet: "The Indian Express, India", url: "https://indianexpress.com/b" },
  ];
  const s = cluster(items);
  // an outlet's item that matches no story now starts its own (1 Oct), so it still counts if other outlets carry it
  assert.equal(s.length, 2);
  assert.equal(s[0].members.length, 1);
  assert.ok(s[0].outlets.includes("The Hindu"));
  assert.equal(s[1].n, 1);
});

// 1 Oct: the Ronaldo story ran in five reading-list feeds in different words (the day's real reading list, frozen in
// fixtures/wire-2026-10-01.json); they must group, unrelated stories must not join, and a story about a followed
// national team must reach the wire check.
test("clustering groups the same story told in different words; a followed team's story is a candidate", () => {
  const items = JSON.parse(readFileSync(new URL("./fixtures/wire-2026-10-01.json", import.meta.url)));
  const s = cluster(items), r = s.find(x => /Ronaldo leaves Portugal camp amid/.test(x.title));
  assert.ok(r.n >= 7, `Ronaldo story has ${r.n} outlets`);
  for (const m of r.members) assert.match(m.title, /Ronaldo|Jesus/);
  const cfg = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url)));
  const c = wireCandidates({ stories: s }, cfg).find(x => x.title === r.title);
  assert.equal(c.region, "follow"); assert.equal(c.follows, "portugal"); assert.equal(c.section_hint, "pitch");
});

test("tennis: next and last match per followed player", () => {
  const sb = { events: [{ name: "Japan Open", groupings: [{ grouping: { displayName: "Men's Singles" }, competitions: [
    { date: "2026-09-30T04:00Z", status: { type: { state: "pre" } }, competitors: [{ athlete: { displayName: "Alex Michelsen" } }, { athlete: { displayName: "Carlos Alcaraz" } }] },
    { date: "2026-09-28T04:00Z", status: { type: { state: "post" } }, competitors: [{ athlete: { displayName: "Carlos Alcaraz" }, winner: true }, { athlete: { displayName: "X" } }] },
  ] }] }] };
  const [a, d] = tennisPlayers(sb, ["Carlos Alcaraz", "Novak Djokovic"]);
  assert.equal(a.next.opponent, "Alex Michelsen"); assert.equal(a.last.won, true); assert.equal(d.next, null);
  const E = { tennis: { players: [{ name: "Carlos Alcaraz", next_match: { text: "Laver Cup", when_utc: "2026-09-27T11:00:00Z" } }] } };
  assert.equal(tennisCheck(E, { players: [a] })[0].verdict, "different match or time");
});

test("Sachet: an alert naming the city or centred near it", () => {
  const rows = [{ area_description: "Bangalore Urban", centroid: "0,0", severity: "WATCH" }, { area_description: "Somewhere", centroid: "77.6,13.0", severity: "WARNING" }, { area_description: "Patna, Bihar", centroid: "85.1,25.6", severity: "WARNING" }];
  const near = nearAlerts(rows, [{ name: "Bengaluru", lat: 12.97, lon: 77.59 }], { Bengaluru: ["Bengaluru", "Bangalore"] }, 60);
  assert.equal(near.length, 2);
});

test("WhereIsCricket rows and their IST start", () => {
  const html = `<article class="match-row"><div class="match-time"><span class="match-date">Wed 30 Sep</span><span class="time-narrow">2:00 PM</span><span class="time-wide">2:00 PM IST</span></div><div class="match-body"><div class="match-teams"><span class="fmt fmt-odi">ODI</span>India v West Indies</div><div class="match-sub"><strong class="match-stage">2nd ODI</strong> · West Indies tour of India · Guwahati</div></div><div class="where"><div class="where-line"><span class="where-tag is-tv">TV</span><span class="where-cell"><span class="where-val">Star Sports Network (Star Sports 1)</span></span></div><div class="where-line"><span class="where-tag is-ott">OTT</span><span class="where-cell"><span class="where-val"><span><a>JioHotstar</a></span></span></span></div></div></article>`;
  const [r] = parseWhereIsCricket(html);
  assert.equal(r.teams, "India v West Indies"); assert.equal(r.format, "ODI"); assert.equal(r.tv, "Star Sports Network");
  assert.equal(wicTime(r, "2026"), "2026-09-30T08:30:00.000Z");
});

test("calendars and box office list", () => {
  const html = `2026 FOMC Meetings</a></h4></div><div class="row fomc-meeting"><div class="fomc-meeting__month col"><strong>October</strong></div><div class="fomc-meeting__date col">27-28</div></div> 2027 FOMC Meetings`;
  assert.deepEqual(parseFomc(html, 2026).map(x => x.date), ["2026-10-28"]);
  assert.deepEqual(parseIcs("BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261002\nSUMMARY:Mahatma Gandhi Jayanti\nEND:VEVENT"), [{ what: "Mahatma Gandhi Jayanti", date: "2026-10-02" }]);
  assert.deepEqual(sacnilkTitles('href="https://www.sacnilk.com/news/drishyam_3_hindi_2026_Box_Office_Collection_Day_Wise_Worldwide"'), ["drishyam 3 hindi (2026)"]);
});

test("scoring: a printed story is found by its page or by its headline, not by chance", () => {
  const E = { front: { lead: { id: "a", headline: "Mbappe diagnosed with a hyperextended knee", short: "Real Madrid said on Sunday that Mbappe has a knee hyperextension.", sources: [{ url: "https://realmadrid.com/x" }], section: "madrid" } }, sections: {} };
  const wire = { items: [{ kind: "search", title: "Mbappe diagnosed with knee hyperextension, say Real Madrid", outlet: "AS", url: "g" }, { kind: "news", title: "Arsenal win again", outlet: "BBC", url: "https://bbc.co.uk/y" }], stories: [] };
  const c = coverage(E, wire);
  assert.equal(c.found, 1);
  assert.equal(matchItem({ headline: "Sensex falls 900 points", short: "" }, [{ title: "Mbappe diagnosed with knee hyperextension" }]), null);
  const miss = missedCandidates({ ...E, checks: { national: [] } }, { stories: [{ title: "Toll soars to 81 in UP rain", outlets: ["The Hindu", "NDTV", "The Times of India"], signals: ["gn-in-top#1"], members: [], n: 3 }] }, ["The Hindu", "NDTV", "The Times of India"]);
  assert.equal(miss.india.not_covered.length, 1);
});

test("source tiers", () => {
  const tiers = { 1: ["rbi.org.in"], 2: ["thehindu.com"] };
  assert.equal(tierOf("https://www.rbi.org.in/x", tiers), 1); assert.equal(tierOf("https://sportstar.thehindu.com/x", tiers), 2); assert.equal(tierOf("https://www.latestly.com/x", tiers), 3);
  const q = sourceQuality({ front: { lead: { headline: "h", sources: [{ url: "https://latestly.com/a" }] } }, sections: {} }, tiers);
  assert.equal(q.tier3_only.length, 1);
});

test("Tennis Explorer: next match from a player's page, Prague time to UTC", async () => {
  const { parseTennisExplorer } = await import("../lib/trial.js");
  const html = `<table class="result gamedetail"><tbody><tr class="one"><td><a href="/beijing/2026/atp-men/">Beijing</a></td><td title="1. round">1R</td><td class="time noWrp">30.09. 13:00</td><th class="t-name"><a href="/match-detail/?id=1" title="Click for match detail">Borges N. - Djokovic N.</a></th></tr></tbody></table>`;
  assert.deepEqual(parseTennisExplorer(html, "Novak Djokovic", Date.parse("2026-09-29T12:00:00Z")),
    { event: "Beijing", round: "1. round", when_utc: "2026-09-30T11:00:00.000Z", opponent: "Borges N.", source: "Tennis Explorer" });
  assert.equal(parseTennisExplorer("<p>No upcoming matches.</p>", "Novak Djokovic"), null);
});

test("tennis: why a due match has not started (the match on its court, or ESPN's own word)", () => {
  const comp = (date, state, court, a, b, extra = {}) => ({ date, status: { type: { state, detail: extra.detail || "Scheduled", name: extra.name || "STATUS_SCHEDULED" } }, venue: { court },
    competitors: [{ athlete: { displayName: a }, linescores: extra.sa || [] }, { athlete: { displayName: b }, linescores: extra.sb || [] }] });
  const sb = { events: [{ name: "China Open", groupings: [{ grouping: { displayName: "Men's Singles" }, competitions: [
    comp("2026-09-30T08:00Z", "in", "Diamond", "Jannik Sinner", "Holger Rune", { sa: [{ value: 6 }, { value: 3 }], sb: [{ value: 4 }, { value: 2 }] }),
    comp("2026-09-30T09:30Z", "pre", "Diamond", "Casper Ruud", "Tommy Paul"),
    comp("2026-09-30T11:00Z", "pre", "Diamond", "Novak Djokovic", "Nuno Borges"),
    comp("2026-09-30T11:00Z", "pre", "Lotus", "Carlos Alcaraz", "Alex Michelsen", { detail: "Postponed", name: "STATUS_POSTPONED" }),
  ] }] }] };
  const [d, a] = tennisPlayers(sb, ["Novak Djokovic", "Carlos Alcaraz"]);
  assert.deepEqual(d.next.court_now, { players: ["Jannik Sinner", "Holger Rune"], score: "6–4, 3–2" });
  assert.equal(d.next.ahead_on_court, 1);
  assert.equal(a.next.held, "Postponed");
});
