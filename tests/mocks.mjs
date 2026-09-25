// Canned API payloads for offline tests and the local dev server.
const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const day = 864e5;
const d = ms => iso(ms).slice(0, 10), t = ms => iso(ms).slice(11, 19) + "Z";

function yahoo(price, closes, state = "CLOSED") {
  const ts = closes.map((_, i) => Math.floor((now - (closes.length - i) * day) / 1000));
  return { chart: { result: [{ meta: { regularMarketPrice: price, regularMarketTime: Math.floor(now / 1000), exchangeTimezoneName: "Asia/Kolkata", currency: "INR", marketState: state },
    timestamp: [...ts, Math.floor(now / 1000)], indicators: { quote: [{ close: [...closes, null] }] } }] } };
}
const race = (off, round, name, country) => ({ season: "2026", round: String(round), raceName: name, Circuit: { circuitName: "C", Location: { locality: "L" + round, country } },
  date: d(now + off), time: "11:00:00Z", Qualifying: { date: d(now + off - day), time: "12:00:00Z" }, FirstPractice: { date: d(now + off - 2 * day), time: "08:30:00Z" } });

const ROUTES = [
  [/open-meteo/, () => ({ current: { temperature_2m: 22.4, apparent_temperature: 23, weather_code: 63, relative_humidity_2m: 80, time: "now" },
    daily: { time: [...Array(7)].map((_, i) => d(now + i * day)), weather_code: Array(7).fill(3), temperature_2m_max: Array(7).fill(28), temperature_2m_min: Array(7).fill(20), precipitation_probability_max: Array(7).fill(40), precipitation_sum: Array(7).fill(1) } })],
  [/jolpi.*current\.json/, () => ({ MRData: { RaceTable: { Races: [race(-10 * day, 14, "Spanish Grand Prix", "Spain"), race(2 * day, 15, "Azerbaijan Grand Prix", "Azerbaijan"), race(20 * day, 16, "Singapore Grand Prix", "Singapore"), race(30 * day, 17, "United States Grand Prix", "USA")] } } })],
  [/driverStandings/, () => ({ MRData: { StandingsTable: { StandingsLists: [{ round: "14", DriverStandings: [
    { position: "1", points: "292", wins: "6", Driver: { givenName: "Kimi", familyName: "Antonelli", code: "ANT" }, Constructors: [{ name: "Mercedes" }] },
    { position: "6", points: "145", wins: "1", Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" }, Constructors: [{ name: "Red Bull" }] }] }] } } })],
  [/constructorStandings/, () => ({ MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [{ position: "1", points: "500", Constructor: { name: "Mercedes" } }] }] } } })],
  [/last\/results/, () => ({ MRData: { RaceTable: { Races: [{ round: "14", raceName: "Spanish Grand Prix", date: d(now - 10 * day), time: "13:00:00Z", Circuit: { Location: { country: "Spain" } },
    Results: [{ position: "1", points: "25", status: "Finished", Driver: { givenName: "Kimi", familyName: "Antonelli" }, Constructor: { name: "Mercedes" } }, { position: "2", points: "18", status: "Finished", Driver: { givenName: "Max", familyName: "Verstappen" }, Constructor: { name: "Red Bull" } }] }] } } })],
  [/soccer\/all\/teams\/86\/schedule\?fixture=true/, () => ({ events: [{ id: "1", date: iso(now + 16 * day), name: "Villarreal at Real Madrid", league: { name: "Spanish LALIGA" },
    competitions: [{ venue: { fullName: "Santiago Bernabéu" }, status: { type: { state: "pre", completed: false } }, competitors: [{ homeAway: "home", id: "86", team: { id: "86", displayName: "Real Madrid" } }, { homeAway: "away", id: "102", team: { id: "102", displayName: "Villarreal" } }] }] }] })],
  [/soccer\/all\/teams\/86\/schedule$/, () => ({ events: [{ id: "0", date: iso(now - 5 * day), league: { name: "Spanish LALIGA" },
    competitions: [{ status: { type: { state: "post", completed: true } }, competitors: [{ homeAway: "away", id: "86", team: { id: "86", displayName: "Real Madrid" }, score: { value: 1, displayValue: "1" }, winner: false }, { homeAway: "home", id: "1068", team: { id: "1068", displayName: "Atlético Madrid" }, score: { value: 1, displayValue: "1" }, winner: false }] }] }] })],
  [/esp\.1\/standings/, () => ({ children: [{ name: "LALIGA", standings: { entries: [
    { team: { id: "83", displayName: "Barcelona" }, stats: [{ name: "rank", value: 1 }, { name: "gamesPlayed", value: 7 }, { name: "points", value: 21 }, { name: "pointDifferential", value: 24 }] },
    { team: { id: "86", displayName: "Real Madrid" }, stats: [{ name: "rank", value: 4 }, { name: "gamesPlayed", value: 7 }, { name: "points", value: 15 }, { name: "pointDifferential", value: 10 }] }] } }] })],
  [/BSESN/, () => yahoo(73581, [74000, null, 74828])],
  [/NSEI/, () => yahoo(23063, [23400, 23447])],
  [/NDX|GSPC|NSEBANK|BZ%3DF|BZ=F/, u => yahoo(/NDX/.test(u) ? 30479 : /GSPC/.test(u) ? 7704 : /NSEBANK/.test(u) ? 55439 : 106.45, [1, 1].map(() => /NDX/.test(u) ? 30470 : /GSPC/.test(u) ? 7700 : /NSEBANK/.test(u) ? 55000 : 105))],
  [/INR%3DX|INR=X/, () => yahoo(95.95, [95.5, 95.8])],
  [/BTC-USD/, () => yahoo(84221, [83000, 84000])],
  [/ibjarates/, () => `<html><body><table><tr><td>Gold 999</td><td>15079</td></tr><tr><td>Gold 916</td><td>13812</td></tr></table>25/09/2026</body></html>`],
  [/trends\.google/, () => `<rss><channel><item><title>Netherlands vs Germany</title><ht:approx_traffic>50000+</ht:approx_traffic><pubDate>x</pubDate><ht:news_item><ht:news_item_title><![CDATA[Dutch beat Germany]]></ht:news_item_title><ht:news_item_url>https://e.com/a</ht:news_item_url><ht:news_item_source>E</ht:news_item_source></ht:news_item></item><item><title>SonyLIV</title></item><item><title>Third</title></item></channel></rss>`],
  [/gamma-api/, () => [
    { slug: "brazil-presidential-election", title: "Brazil presidential election", volume24hr: 900000, tags: [{ slug: "world", label: "World" }], markets: [
      { groupItemTitle: "Flávio Bolsonaro", outcomePrices: '["0.563","0.437"]', active: true }, { groupItemTitle: "Lula da Silva", outcomePrices: '["0.435","0.565"]', active: true }] },
    { slug: "fed-decision-october", title: "Fed decision in October?", volume24hr: 5e6, tags: [{ slug: "fed", label: "Fed" }], markets: [] },
    { slug: "midterms-x", title: "Balance of Power: 2026 Midterms", volume24hr: 5e6, tags: [{ slug: "politics", label: "Politics" }, { slug: "united-states" }, { slug: "midterms" }], markets: [{ outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]' }] },
    { slug: "iran-blockade", title: "US announces end of Iran blockade by 31 Dec", volume24hr: 400000, tags: [{ slug: "geopolitics", label: "Geopolitics" }], markets: [{ outcomes: '["Yes","No"]', outcomePrices: '["0.618","0.382"]' }] }]],
  [/tennis\/atp\/scoreboard/, () => ({ events: [{ name: "Laver Cup", date: iso(now), endDate: iso(now + 2 * day) }] })],
  [/basketball\/nba\/teams\/gs\/schedule/, () => ({ events: [{ id: "n1", date: iso(now + 10 * day), seasonType: { type: 1 }, competitions: [{ status: { type: { completed: false } }, competitors: [{ homeAway: "away", team: { abbreviation: "GS", displayName: "Golden State Warriors" } }, { homeAway: "home", team: { abbreviation: "LAC", displayName: "LA Clippers" } }] }] }] })],
];


export function installMocks() {
  globalThis.fetch = async url => {
    url = String(url);
    const hit = ROUTES.find(([re]) => re.test(url));
    if (!hit) return new Response("not mocked", { status: 404 });
    const body = hit[1](url);
    return typeof body === "string" ? new Response(body, { status: 200 }) : Response.json(body);
  };
}
