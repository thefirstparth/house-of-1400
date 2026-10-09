// The Fixture List as the site showed it at 00:32 IST on 10 Oct 2026 (Parth's screenshot plus the sprint's market),
// every field kept: time, sport, the fixture, its round and place, where to watch, the market and its source, the result.
const DAYS = [
  { day: "Friday", date: "9 Oct", past: true, items: [
    { t: "15:40", sp: "tennis", title: "Djokovic v Hubert Hurkacz", sub: "Rolex Shanghai Masters, Round 2", done: { head: "Lost", score: "6–4 6–3", tennis: [["Hurkacz", [6, 6], true], ["Djokovic", [4, 3], false]] } },
    { t: "18:00", sp: "f1", title: "Sprint Qualifying", sub: "Singapore Grand Prix · Marina Bay", tv: "FanCode", done: { podium: ["Verstappen", "Russell", "Leclerc"], grid: [["VER", "Verstappen", "#4781D7", "1:31.156"], ["RUS", "Russell", "#00D7B6", "+0.120"], ["LEC", "Leclerc", "#ED1131", "+0.243"]], label: "Sprint pole" } },
    { t: "19:00", sp: "cricket", title: "India v West Indies", sub: "2nd T20I · Ranchi", tv: "JioHotstar", done: { head: "West Indies won by 6 wkts", score: "IND 249/5 (20 ov) · WI 252/4 (18.3 ov)", card: [["India", "249/5", "20 ov", false], ["West Indies", "252/4", "18.3 ov", true]] } },
  ] },
  { day: "Today", date: "10 Oct", today: true, items: [
    { t: "14:30", sp: "f1", title: "Sprint", sub: "Singapore Grand Prix · Marina Bay", tv: "FanCode", odds: { src: "Polymarket", field: true, o: [["Verstappen", 67], ["Russell", 23], ["Leclerc", 10]] } },
    { t: "15:30", sp: "tennis", title: "Alcaraz v Juan Manuel Cerundolo", sub: "Rolex Shanghai Masters, Round 2 · Stadium Court", odds: { src: "Polymarket", o: [["Alcaraz", 95], ["Cerundolo", 6]] } },
    { t: "18:30", sp: "f1", title: "Qualifying", sub: "Singapore Grand Prix · Marina Bay", tv: "FanCode", odds: { src: "Polymarket", field: true, o: [["Verstappen", 46], ["Antonelli", 15], ["Leclerc", 13]] } },
  ] },
  { day: "Sunday", date: "11 Oct", items: [
    { t: "00:30", sp: "football", title: "Real Madrid v Villarreal", sub: "La Liga", tv: "FanCode", odds: { src: "Kalshi", o: [["Real Madrid", 72], ["Draw", 15], ["Villarreal", 12]] } },
    { t: "06:00", sp: "basketball", title: "Golden State Warriors v Sacramento Kings", sub: "NBA preseason", odds: { src: "Kalshi", o: [["Golden State", 66], ["Sacramento", 34]] } },
    { t: "17:30", sp: "f1", title: "Singapore Grand Prix", sub: "Race · Marina Bay", tv: "FanCode", odds: { src: "Polymarket", field: true, o: [["Verstappen", 42], ["Leclerc", 15], ["Antonelli", 14]] } },
    { t: "19:00", sp: "cricket", title: "India v West Indies", sub: "3rd T20I · Indore", tv: "JioHotstar", odds: { src: "Kalshi", o: [["India", 76], ["West Indies", 24]] } },
  ] },
  { day: "Wednesday", date: "14 Oct", items: [
    { t: "07:30", sp: "basketball", title: "Los Angeles Lakers v Golden State Warriors", sub: "NBA preseason" },
    { t: "19:00", sp: "cricket", title: "India v West Indies", sub: "4th T20I · Hyderabad", tv: "JioHotstar" },
  ] },
  { day: "Thursday", date: "15 Oct", items: [
    { t: "00:30", sp: "football", title: "AS Roma v Real Madrid", sub: "Champions League", tv: "SonyLIV", odds: { src: "Kalshi", o: [["Real Madrid", 52], ["Roma", 24], ["Draw", 23]] } },
  ] },
];
const ASOF = "00:32", NOW = "2026-10-10T00:32+05:30";
const SPORT = { cricket: "Cricket", football: "Football", f1: "F1", tennis: "Tennis", basketball: "Basketball" };
// Small line drawings, one per sport, in currentColor
const ICON = {
  cricket: '<svg viewBox="0 0 16 16"><path d="M10.5 1.5l4 4-7.2 7.2-4-4z"/><path d="M3.3 8.7L1.5 13l1.5 1.5 4.3-1.8"/><circle cx="12.5" cy="12.5" r="1.6"/></svg>',
  football: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.6l3 2.2-1.1 3.5H6.1L5 6.8z"/><path d="M8 1.5v3.1M11 6.8l3-1M9.9 10.3l1.8 2.6M6.1 10.3l-1.8 2.6M5 6.8l-3-1"/></svg>',
  f1: '<svg viewBox="0 0 16 16"><path d="M3 14.5V1.5"/><path d="M3 2h10v7H3"/><path d="M3 2h2.5v2.3H3zM8 2h2.5v2.3H8zM5.5 4.3H8v2.4H5.5zM10.5 4.3H13v2.4h-2.5zM3 6.7h2.5V9H3zM8 6.7h2.5V9H8z" class="fill"/></svg>',
  tennis: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M2.6 4.4c2.6 1.2 3.6 4.4 2.4 7.4M13.4 4.4c-2.6 1.2-3.6 4.4-2.4 7.4"/></svg>',
  basketball: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5v13M3.4 3.4c2.3 2.6 2.3 6.6 0 9.2M12.6 3.4c-2.3 2.6-2.3 6.6 0 9.2"/></svg>',
};
