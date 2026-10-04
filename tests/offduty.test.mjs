// Off Duty (from 4 Oct 2026): the parsers and rules behind In Cinemas, Streaming Top 10, Coming Up and Bengaluru Stage.
import { test } from "node:test";
import assert from "node:assert/strict";

import { sameTitle, languageOf, isStandup, netflixRows, rankService, jwUpcomingRows, parseSacnilkList, parseSacnilkFilm, parseRT, classifyReviews,
  parseAllevents, parseDistrict, classify, inBengaluru, cleanTitle, mergeStage, districtCandidates } from "../lib/offduty.js";

const S = {
  days: 150, new_days: 7, comedians_follow: ["Samay Raina", "Bassi"], comedians: ["Zakir Khan", "Samay Raina", "Bassi"], never: ["Harsh Gujral", "Amit Tandon", "Kenny Sebastian"],
  sufi_words: ["sufi", "qawwali"], sufi_artists: ["Wadali", "Bhuwin", "Once Upon India"], skip_words: ["open mic", "line-up", "board game"], regional_words: ["kannada", "tamil", "telugu"],
};

test("sameTitle: one title's words inside the other's, never on one shared word", () => {
  assert.ok(sameTitle("Drishyam: The Conclusion", "Drishyam 3: The Conclusion"));
  assert.ok(sameTitle("The Diplomat", "Diplomat"));
  assert.ok(!sameTitle("The Diplomat", "The Diplomat's Wife and Other Stories"));
  assert.ok(!sameTitle("", "Anything"));
});

test("languageOf: English and Hindi only; an Indian title in Latin letters is checked", () => {
  assert.equal(languageOf({ title: "Haiwaan", productionCountries: ["IN"], shortDescription: "A Hindi thriller." }), "Hindi");
  assert.equal(languageOf({ title: "हैवान" }), "Hindi");
  assert.equal(languageOf({ title: "Kantara", productionCountries: ["IN"], shortDescription: "A Kannada folk epic." }), null);
  assert.equal(languageOf({ title: "Papa Yaar", productionCountries: ["IN"], shortDescription: "Zakir Khan on fathers." }), "Hindi?");
  assert.equal(languageOf({ title: "Slow Horses", productionCountries: ["GB"] }), "English");
  assert.equal(languageOf({ title: "Squid Game", productionCountries: ["KR"] }), null);
  assert.equal(languageOf({ title: "Papa Yaar", _lang: "Hindi" }), "Hindi");
});

test("isStandup: the words, or a comedy named after a listed comedian; not a talk show", () => {
  assert.ok(isStandup({ title: "Anything", shortDescription: "A stand-up special." }));
  assert.ok(isStandup({ title: "Papa Yaar by Zakir Khan", genres: [{ shortName: "cmy" }] }, ["Zakir Khan"]));
  assert.ok(!isStandup({ title: "The Great Indian Kapil Show", shortDescription: "A comedy talk show.", genres: [{ shortName: "cmy" }] }, ["Kapil Sharma"]));
});

test("netflixRows: India's newest week only, seasons read from the season title", () => {
  const tsv = ["country_name\tcountry_iso2\tweek\tcategory\tweekly_rank\tshow_title\tseason_title\tcumulative_weeks_in_top_10",
    "Hungary\tHU\t2026-09-27\tFilms\t1\tX\tN/A\t1",
    "India\tIN\t2026-09-27\tFilms\t1\tHaiwaan\tN/A\t1",
    "India\tIN\t2026-09-27\tTV\t1\tThe Diplomat\tThe Diplomat: Season 3\t2",
    "India\tIN\t2026-09-20\tFilms\t1\tOld\tN/A\t3",
    "Indonesia\tID\t2026-09-27\tFilms\t1\tY\tN/A\t1"].join("\n");
  assert.deepEqual(netflixRows(tsv), [
    { week: "2026-09-27", category: "Films", rank: 1, title: "Haiwaan", season: null },
    { week: "2026-09-27", category: "TV", rank: 1, title: "The Diplomat", season: 3 },
  ]);
});

test("rankService: both charts together, English and Hindi, old chart titles dropped, stand-up marked", () => {
  const official = [{ title: "The Diplomat", season: 3, category: "TV", rank: 2, lang: "English" }, { title: "Haiwaan", category: "Films", rank: 1, lang: "Hindi" }];
  const chart = [
    { title: "Papa Yaar", rank: 1, kind: "Film", originalReleaseYear: 2026, productionCountries: ["IN"], shortDescription: "A stand-up special.", _lang: "Hindi" },
    { title: "The Diplomat", rank: 2, kind: "Series", originalReleaseYear: 2023, productionCountries: ["US"] },
    { title: "Squid Game", rank: 3, kind: "Series", originalReleaseYear: 2026, productionCountries: ["KR"] },
    { title: "Friends", rank: 4, kind: "Series", originalReleaseYear: 1994, productionCountries: ["US"] },
  ];
  const r = rankService({ official, chart }, 2026);
  assert.deepEqual(r.map(x => x.title), ["The Diplomat, season 3", "Haiwaan", "Papa Yaar"]);
  assert.equal(r.find(x => x.title === "Papa Yaar").kind, "Stand-up");
});

test("jwUpcomingRows: a new season is named with its number; undated rows dropped", () => {
  const edges = [
    { node: { objectType: "SHOW_SEASON", content: { seasonNumber: 4, upcomingReleases: [{ releaseDate: "2026-10-20", package: { shortName: "nfx" } }] }, show: { content: { title: "The Diplomat", productionCountries: ["US"], scoring: { tmdbPopularity: 41.6, imdbVotes: 90000 } } } } },
    { node: { objectType: "MOVIE", content: { title: "No Date", upcomingReleases: [] } } },
  ];
  assert.deepEqual(jwUpcomingRows(edges, "nfx", "Netflix"), [{ title: "The Diplomat, season 4", kind: "series", date: "2026-10-20", where: "Netflix", lang: "English", pop: 42, votes: 90000 }]);
});

test("Sacnilk: the list's films and languages; a film's India net and days", () => {
  const list = `<a href="https://www.sacnilk.com/news/Haiwaan_Box_Office_Collection_Day_Wise_Worldwide"><img alt="Haiwaan Box Office Collection" src="x"></a><p>Here is the Hindi movie Haiwaan</p>`;
  assert.deepEqual(parseSacnilkList(list), [{ url: "https://www.sacnilk.com/news/Haiwaan_Box_Office_Collection_Day_Wise_Worldwide", title: "Haiwaan", language: "Hindi" }]);
  const film = `<table><tr><td>Day 1</td><td>[1st Fri]</td><td>x</td><td>₹ 5.2 Cr</td></tr><tr><td>Day 2</td><td>[1st Sat]</td><td>x</td><td>₹ 7.1 Cr</td></tr></table><div>Total Collection (Net)</div><div>₹ 12.30 Cr</div>`;
  assert.deepEqual(parseSacnilkFilm(film), { net_cr: 12.3, days: 2 });
  assert.equal(parseSacnilkFilm("<p>nothing</p>"), null);
});

test("parseRT: critics with no score yet keep the count of positive reviews", () => {
  const html = `"criticsScore":{"likedCount":5,"reviewCount":7,"score":null},"audienceScore":{"ratingCount":"250","score":"81"}
<script type="application/ld+json">{"@type":"Movie","dateCreated":"2026-10-02"}</script><div id="critics-consensus"><h2>Critics Consensus</h2><p>Tense &amp; well made.</p></div>`;
  assert.deepEqual(parseRT(html), { critics: { score: null, count: 7, liked: 5 }, audience: { score: 81, count: 250, liked: null }, date: "2026-10-02", consensus: "Tense & well made." });
});

test("classifyReviews: independent critics and trade sites apart; fan and X reactions dropped", () => {
  const cfg = { independent: ["The Hindu", "Film Companion"], trade: ["Koimoi"] };
  const r = classifyReviews([
    { title: "Haiwaan review: a tense thriller", source: "The Hindu" },
    { title: "Haiwaan Movie Review: 4 stars", source: "Koimoi" },
    { title: "Haiwaan X review: netizens love it", source: "The Hindu" },
    { title: "Haiwaan review", source: "Some Blog" },
    { title: "Haiwaan box office day 2", source: "Film Companion" },
  ], cfg);
  assert.deepEqual(r.map(x => [x.source, x.kind]), [["The Hindu", "independent"], ["Koimoi", "trade"]]);
});

test("classify: Sufi by words or artist, stand-up needs a named act; open mics, regional and the never-list out", () => {
  assert.equal(classify({ title: "Lakhwinder Wadali India Tour" }, S), "sufi");
  assert.equal(classify({ title: "Once Upon India: An Evening" }, S), "sufi");
  assert.equal(classify({ title: "Rehnuma: Sufi Night" }, S), "sufi");
  assert.equal(classify({ title: "Samay Raina Live" }, S, "comedy"), "comedy");
  assert.equal(classify({ title: "Comedy Night" }, S, "comedy"), null);
  assert.equal(classify({ title: "Comedy Open Mic ft. Someone" }, S, "comedy"), null);
  assert.equal(classify({ title: "Kannada Comedy Live" }, S, "comedy"), null);
  assert.equal(classify({ title: "Harsh Gujral Live" }, S, "comedy"), null);
  assert.equal(classify({ title: "Kenny Sebastian: solo tour" }, S, "comedy"), null);
  assert.equal(classify({ title: "Indie rock night" }, S, "music"), null);
});

test("Bengaluru by name or PIN; titles lose the city and venue the page prints beside them", () => {
  assert.ok(inBengaluru({ title: "X", city: "Yelahanka 562157", venue: "Arena" }));
  assert.ok(inBengaluru({ title: "X", city: "", venue: "Bangalore International Centre" }));
  assert.ok(!inBengaluru({ title: "X", city: "Mumbai 400001", venue: "NCPA" }));
  assert.equal(cleanTitle("Samay Raina Live | Bengaluru | Koramangala Indoor Stadium", "Koramangala Indoor Stadium"), "Samay Raina Live");
  assert.equal(cleanTitle("Lakhwinder Wadali India Tour - Bengaluru"), "Lakhwinder Wadali India Tour");
  assert.equal(cleanTitle("Bassi in Bengaluru"), "Bassi");
});

test("parseAllevents and parseDistrict read schema.org events; an empty offers list is fine", () => {
  const ae = `<script type="application/ld+json">[{"@type":"Event","name":"Rehnuma Sufi Night","startDate":"2026-10-17T19:30:00+05:30","location":{"name":"Hard Rock Cafe: Bengaluru","address":{"addressLocality":"Bengaluru"}},"offers":[],"url":"https://allevents.in/x"}]</script>`;
  assert.deepEqual(parseAllevents(ae), [{ title: "Rehnuma Sufi Night", dates: ["2026-10-17T19:30"], venue: "Hard Rock Cafe", city: "Bengaluru", price_from: null, url: "https://allevents.in/x", source: "allevents", performers: [] }]);
  const di = `<script type="application/ld+json">{"@type":"Event","name":"Sartaaj Live","startDate":"2026-11-08T19:00:00+05:30","location":{"name":"Phoenix Marketcity","address":{"addressLocality":"Bengaluru","streetAddress":"Whitefield 560048"}},"offers":{"price":"1000"},"performer":[{"name":"Satinder Sartaaj"}]}</script>
<script>self.__next_f.push("{\\"published_at_timestamp\\":\\"2026-10-01T10:00:00Z\\",\\"heading\\":\\"Seating Arrangement\\",\\"subheading\\":\\"Seated\\"}")</script>`;
  const d = parseDistrict(di, "https://www.district.in/events/sartaaj");
  assert.equal(d.price_from, 1000); assert.equal(d.seated, true); assert.equal(d.listed, "2026-10-01T10:00:00Z"); assert.deepEqual(d.performers, ["Satinder Sartaaj"]);
  assert.equal(parseDistrict("<p>none</p>", "u"), null);
});

test("mergeStage: Bengaluru, in the window, one row a show (District wins), new by listing or first sighting", () => {
  const today = "2026-10-05";
  const list = [
    { title: "Samay Raina Live | Bengaluru", dates: ["2026-10-20T19:00:00+05:30"], venue: "Chowdiah", city: "Bengaluru", price_from: 999, source: "District", performers: [], listed: "2026-10-04T08:00:00Z" },
    { title: "Samay Raina Live", dates: ["2026-10-20T19:00"], venue: "Chowdiah", city: "Bengaluru", price_from: 799, source: "allevents", from: "comedy" },
    { title: "Lakhwinder Wadali", dates: ["2027-02-14T19:00"], venue: "Palace Grounds", city: "Bengaluru", source: "allevents", from: "music" },
    { title: "Lakhwinder Wadali", dates: ["2026-10-25T19:00"], venue: "NCPA", city: "Mumbai", source: "allevents", from: "music" },
    { title: "Sufi Evening", dates: ["2026-10-01T19:00"], venue: "BIC", city: "Bengaluru", source: "allevents", from: "music" },
    { title: "Sufi Far Off", dates: ["2027-06-01T19:00"], venue: "BIC", city: "Bengaluru", source: "allevents", from: "music" },
  ];
  const first = mergeStage(list, S, [], today);
  assert.deepEqual(first.map(x => [x.title, x.kind, x.source]), [["Samay Raina Live", "comedy", "District"], ["Lakhwinder Wadali", "sufi", "allevents"]]);
  const [samay, wadali] = first;
  assert.equal(samay.price_from, 999); assert.equal(samay.follow, true); assert.equal(samay.new, true); // listed yesterday on District
  assert.equal(wadali.first_seen, null); assert.equal(wadali.new, false); // the first run marks nothing new by sighting
  // the next day: a show seen before keeps its first sighting (even none); a show never seen is new
  const fresh = { title: "Bhuwin Khursija Sufi Night", dates: ["2026-12-12T19:00"], venue: "BIC", city: "Bengaluru", source: "allevents", from: "music" };
  const next = mergeStage([...list, fresh], S, first, "2026-10-06");
  assert.equal(next.find(x => x.title.startsWith("Lakhwinder")).new, false);
  const b = next.find(x => x.title.startsWith("Bhuwin")); assert.equal(b.first_seen, "2026-10-06"); assert.equal(b.new, true);
});

test("districtCandidates: Bengaluru slugs, or a followed name not plainly for another city; past dates out", () => {
  const xml = ["samay-raina-live-bengaluru-oct20-2026", "lakhwinder-wadali-live-in-mumbai-2026", "once-upon-india-sufi-evening", "bassi-blr-aug3-2026", "some-show-delhi", "old-show-bengaluru-2024"]
    .map(s => `<loc>https://www.district.in/events/${s}</loc>`).join("");
  assert.deepEqual(districtCandidates(xml, S, "2026-10-05"), ["samay-raina-live-bengaluru-oct20-2026", "once-upon-india-sufi-evening"]);
});
