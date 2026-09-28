// Offline tests for the source trial's parsers and scoring (lib/trial.js, scripts/trial.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";

import { cluster, nearAlerts, parseDate, parseFeed, parseFomc, parseIcs, parseWhereIsCricket, sacnilkTitles, tennisPlayers } from "../lib/trial.js";
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
  assert.equal(s.length, 1);
  assert.equal(s[0].members.length, 1);
  assert.ok(s[0].outlets.includes("The Hindu"));
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
