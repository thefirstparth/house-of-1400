// The Fixture List at 00:32 IST on Saturday 10 Oct 2026, as the live feeds had it: every fixture, its round, place
// and channel, each finished one's result, each market with its source. Crests and flags from ESPN's logo service
// (which the site already uses for Madrid's crests), drivers' photos and team colours from OpenF1.
const NOW = "2026-10-10T00:32:00+05:30", ASOF = "00:32";
const logo = p => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${p}.png&h=80&w=80`;
const flag = c => logo(`countries/500/${c}`), club = id => logo(`soccer/500/${id}`), nba = id => logo(`nba/500/${id}`);
const hs = p => `https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/${p}.png.transform/2col/image.png`;
const DRV = {
  VER: { name: "Max Verstappen", last: "Verstappen", team: "Red Bull Racing", col: "#4781D7", img: hs("M/MAXVER01_Max_Verstappen/maxver01") },
  RUS: { name: "George Russell", last: "Russell", team: "Mercedes", col: "#00D7B6", img: hs("G/GEORUS01_George_Russell/georus01") },
  LEC: { name: "Charles Leclerc", last: "Leclerc", team: "Ferrari", col: "#ED1131", img: hs("C/CHALEC01_Charles_Leclerc/chalec01") },
  ANT: { name: "Kimi Antonelli", last: "Antonelli", team: "Mercedes", col: "#00D7B6", img: hs("K/ANDANT01_Kimi_Antonelli/andant01") },
};
const T = {
  djokovic: { name: "Novak Djokovic", short: "Djokovic", img: flag("srb") }, hurkacz: { name: "Hubert Hurkacz", short: "Hurkacz", img: flag("pol") },
  alcaraz: { name: "Carlos Alcaraz", short: "Alcaraz", img: flag("esp") }, cerundolo: { name: "Juan Manuel Cerundolo", short: "Cerundolo", img: flag("arg") },
  india: { name: "India", short: "India", abbr: "IND", img: flag("ind") }, wi: { name: "West Indies", short: "West Indies", abbr: "WI", img: flag("wi") },
  madrid: { name: "Real Madrid", short: "Real Madrid", img: club(86) }, villarreal: { name: "Villarreal", short: "Villarreal", img: club(102) }, roma: { name: "AS Roma", short: "Roma", img: club(104) },
  gsw: { name: "Golden State Warriors", short: "Warriors", img: nba("gs") }, sac: { name: "Sacramento Kings", short: "Kings", img: nba("sac") }, lal: { name: "Los Angeles Lakers", short: "Lakers", img: nba("lal") },
};
const GP = { name: "Singapore Grand Prix", short: "Singapore GP", place: "Marina Bay", img: flag("sgp") };
// sp: sport; a, b: the two sides (home first) or, for F1, ev: the weekend and session; state: next | done | live | off | tbc
const FIX = [
  { d: "2026-10-09", t: "15:40", sp: "tennis", comp: "Rolex Shanghai Masters", round: "Round 2", a: T.djokovic, b: T.hurkacz, state: "done",
    res: { win: "b", sets: [[4, 6], [3, 6]], line: "Lost 6–4 6–3" } },
  { d: "2026-10-09", t: "18:00", sp: "f1", ev: GP, session: "Sprint Qualifying", tv: "FanCode", state: "done",
    res: { label: "Sprint pole", grid: [["VER", "1:31.156"], ["RUS", "+0.120"], ["LEC", "+0.243"]] } },
  { d: "2026-10-09", t: "19:00", sp: "cricket", comp: "2nd T20I", round: "Ranchi", a: T.india, b: T.wi, tv: "JioHotstar", state: "done",
    res: { win: "b", a: ["249/5", "20"], b: ["252/4", "18.3"], line: "West Indies won by 6 wkts" } },
  { d: "2026-10-10", t: "14:30", sp: "f1", ev: GP, session: "Sprint", tv: "FanCode", state: "next",
    mkt: { src: "Polymarket", field: [["VER", 67], ["RUS", 23], ["LEC", 10]] } },
  { d: "2026-10-10", t: "15:30", sp: "tennis", comp: "Rolex Shanghai Masters", round: "Round 2", court: "Stadium Court", a: T.alcaraz, b: T.cerundolo, state: "next",
    mkt: { src: "Polymarket", a: 95, b: 6 } },
  { d: "2026-10-10", t: "18:30", sp: "f1", ev: GP, session: "Qualifying", tv: "FanCode", state: "next",
    mkt: { src: "Polymarket", field: [["VER", 46], ["ANT", 15], ["LEC", 13]] } },
  { d: "2026-10-11", t: "00:30", sp: "football", comp: "La Liga", a: T.madrid, b: T.villarreal, tv: "FanCode", state: "next",
    mkt: { src: "Kalshi", a: 72, draw: 15, b: 12 } },
  { d: "2026-10-11", t: "06:00", sp: "basketball", comp: "NBA preseason", a: T.gsw, b: T.sac, state: "next", mkt: { src: "Kalshi", a: 66, b: 34 } },
  { d: "2026-10-11", t: "17:30", sp: "f1", ev: GP, session: "Race", tv: "FanCode", state: "next",
    mkt: { src: "Polymarket", field: [["VER", 42], ["LEC", 15], ["ANT", 14]] } },
  { d: "2026-10-11", t: "19:00", sp: "cricket", comp: "3rd T20I", round: "Indore", a: T.india, b: T.wi, tv: "JioHotstar", state: "next", mkt: { src: "Kalshi", a: 76, b: 24 } },
  { d: "2026-10-14", t: "07:30", sp: "basketball", comp: "NBA preseason", a: T.lal, b: T.gsw, state: "next" },
  { d: "2026-10-14", t: "19:00", sp: "cricket", comp: "4th T20I", round: "Hyderabad", a: T.india, b: T.wi, tv: "JioHotstar", state: "next" },
  { d: "2026-10-15", t: "00:30", sp: "football", comp: "Champions League", a: T.roma, b: T.madrid, tv: "SonyLIV", state: "next", mkt: { src: "Kalshi", a: 24, draw: 23, b: 52 } },
];
// Made-up rows, shown apart and labelled as such, so each way can be judged when a match is live, called off or
// has no time yet.
const EXAMPLES = [
  { d: "2026-10-10", t: "19:00", sp: "cricket", comp: "3rd T20I", round: "Indore", a: T.india, b: T.wi, tv: "JioHotstar", state: "live",
    live: { a: ["142/3", "14.2"], b: ["187/6", "20"], line: "India need 46 from 34 balls" } },
  { d: "2026-10-11", t: "00:30", sp: "football", comp: "La Liga", a: T.madrid, b: T.villarreal, tv: "FanCode", state: "live", live: { a: 2, b: 1, clock: "67′" } },
  { d: "2026-10-14", t: "07:30", sp: "basketball", comp: "NBA preseason", a: T.lal, b: T.gsw, state: "off", off: "Postponed" },
  { d: "2026-10-16", t: null, sp: "cricket", comp: "5th T20I", round: "Lucknow", a: T.india, b: T.wi, tv: "JioHotstar", state: "tbc" },
];
const SPORT = { cricket: "Cricket", football: "Football", f1: "F1", tennis: "Tennis", basketball: "Basketball" };
const ICON = {
  cricket: '<svg viewBox="0 0 16 16"><path d="M10.5 1.5l4 4-7.2 7.2-4-4z"/><path d="M3.3 8.7L1.5 13l1.5 1.5 4.3-1.8"/><circle cx="12.5" cy="12.5" r="1.6"/></svg>',
  football: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.6l3 2.2-1.1 3.5H6.1L5 6.8z"/><path d="M8 1.5v3.1M11 6.8l3-1M9.9 10.3l1.8 2.6M6.1 10.3l-1.8 2.6M5 6.8l-3-1"/></svg>',
  f1: '<svg viewBox="0 0 16 16"><path d="M3 14.5V1.5"/><path d="M3 2h10v7H3"/><path d="M3 2h2.5v2.3H3zM8 2h2.5v2.3H8zM5.5 4.3H8v2.4H5.5zM10.5 4.3H13v2.4h-2.5zM3 6.7h2.5V9H3zM8 6.7h2.5V9H8z" class="fill"/></svg>',
  tennis: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M2.6 4.4c2.6 1.2 3.6 4.4 2.4 7.4M13.4 4.4c-2.6 1.2-3.6 4.4-2.4 7.4"/></svg>',
  basketball: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5v13M3.4 3.4c2.3 2.6 2.3 6.6 0 9.2M12.6 3.4c-2.3 2.6-2.3 6.6 0 9.2"/></svg>',
  tv: '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="9" rx="1.5"/><path d="M5.5 14.5h5"/><path d="M7 5.8v3.4l2.8-1.7z" class="fill"/></svg>',
};
