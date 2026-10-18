import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { minuteOf, headlinesOf, editionAge, moneyOf, closeWord, marketsLine, windowsOf, contextOf, resultsOf, weekOf, standingsOf, cricketSeries, tennisLine, cricketWords } = await import("../lib/tv-saver.js");
const { periodsOf, yearBefore, daysBefore, move, nasdaqQuoteOf, parseGoodreturns, goldPeriods, moneycontrolQuoteOf, nseQuoteOf, parseMetno, metnoAsOpenMeteo } = await import("../lib/live.js");
const { endOf } = await import("../lib/tv.js");
const { events, using } = await import("../public/sport/js/core.js");

const cfg = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8"));
const T = cfg.tv, S = T.saver;
const NOW = Date.parse("2026-10-18T03:30:00Z"); // Sunday 09:00 IST
const H = 36e5, D = 864e5, iso = ms => new Date(ms).toISOString();

// ------------------------------------------------------------------ the day in a minute
const glance = n => Array.from({ length: n }, (_, i) => ({ line: `Line ${i + 1} — with a dash`, subject: i === 0 ? "Line 1" : "Elsewhere", section: "World — India", color: ["desh", "videsh", "ledger", "sidelines", "ai"][i % 5] }));
test("saver: the edition's glance lines word for word, each with its desk's night colour", () => {
  const m = minuteOf({ date: "2026-10-17", printed_at: "2026-10-17T08:46:00Z", glance: glance(9) }, cfg, NOW);
  assert.equal(m.kind, "edition"); assert.equal(m.date, "2026-10-17"); assert.equal(m.lines.length, 9, "all lines; the TV pages them five at a time");
  assert.equal(m.lines[0].text, "Line 1, with a dash", "no em-dashes on the TV");
  assert.deepEqual(m.lines.slice(0, 5).map(l => l.desk), ["news", "news", "money", "sport", "tech"]);
  assert.equal(m.lines[2].colour, "#F0A3C9"); assert.equal(m.lines[3].colour, "#F4A06A");
  assert.equal(m.lines[0].subject, "Line 1", "the subject, for bold, only when the line starts with it"); assert.equal(m.lines[1].subject, undefined);
  assert.equal(m.lines[0].section, "World, India", "the section tag, without em-dashes");
  assert.equal(minuteOf({ date: "2026-10-17", printed_at: "2026-10-17T08:46:00Z", glance: glance(4) }, cfg, NOW).lines.length, 4, "five or fewer: one page");
});

test("saver: an edition more than 36 hours old gives nothing (headlines instead); its age from printed_at, else its cut", () => {
  const ed = { date: "2026-10-16", printed_at: "2026-10-16T08:46:00Z", glance: glance(5) };
  assert.ok(editionAge(ed, NOW) > 36);
  assert.equal(minuteOf(ed, cfg, NOW), null);
  assert.equal(minuteOf({ ...ed, printed_at: "2026-10-16T15:40:00Z" }, cfg, NOW).lines.length, 5, "35h50m old: still the edition");
  assert.ok(Math.abs(editionAge({ date: "2026-10-17", cut_ist: "14:00" }, NOW) - 19) < 1e-9, "14:00 IST on 17 Oct to 09:00 IST on 18 Oct");
  assert.equal(minuteOf(null, cfg, NOW), null);
});

test("saver: headlines are the feed's top five in its order, publisher taken off, dashes as commas", () => {
  const items = [
    { title: "Third story - The Hindu", outlet: "The Hindu", position: 2 }, { title: "First — big news - NDTV", outlet: "NDTV", position: 0 },
    { title: "Second story - Mint", outlet: "Mint", position: 1 }, ...[3, 4, 5, 6].map(p => ({ title: `Story ${p}`, outlet: "X", position: p })),
  ];
  const h = headlinesOf(items, "Google News");
  assert.equal(h.kind, "headlines"); assert.equal(h.source, "Google News");
  assert.deepEqual(h.lines.map(l => l.text), ["First, big news", "Second story", "Third story", "Story 3", "Story 4"]);
  assert.deepEqual(h.lines.slice(0, 3).map(l => l.source), ["NDTV", "Mint", "The Hindu"], "each headline's source, for its tag");
  assert.equal(headlinesOf([], "Google News"), null);
});

// ------------------------------------------------------------------ money maths
const closes = [["2025-10-15", 100], ["2025-10-16", 110], ["2026-09-15", 180], ["2026-09-16", 190], ["2026-10-15", 195], ["2026-10-16", 200]].map(([d, c]) => ({ d, c }));
test("money: a day against the previous close, 30 days and a year against the last close on or before those dates", () => {
  const p = periodsOf(210, 200, closes, "2026-10-17", "Yahoo Finance");
  assert.deepEqual(p.d1, { amt: 10, pct: 5 });
  assert.deepEqual(p.d30, { amt: 20, pct: 10.53, from: "2026-09-16" }, "17 Oct less 30 days is 17 Sep: the close on 16 Sep");
  assert.deepEqual(p.y1, { amt: 100, pct: 90.91, from: "2025-10-16" }, "17 Oct 2025: the close on 16 Oct");
  assert.equal(p.source, "Yahoo Finance");
  // the session's own close is never its own base; a series that does not reach back a year leaves the year empty
  assert.equal(periodsOf(210, 200, closes.slice(2), "2026-10-17", "x").y1, null);
  assert.equal(yearBefore("2028-02-29"), "2027-02-28"); assert.equal(daysBefore("2026-03-01", 30), "2026-01-30");
  assert.equal(move(10, 0), null); assert.equal(move(null, 5), null);
});

test("money: backups bring their own moves, each against its own earlier close", () => {
  const n = nseQuoteOf({ index: "NIFTY 50", last: 23146.15, previousClose: 22997.35, oneMonthAgoVal: 23270.6, date30dAgo: "17-Sep-2026", oneYearAgoVal: 25709.85, date365dAgo: "17-Oct-2025", oneWeekAgoVal: 22520.45, oneMonthAgo: "x" }, "16-Oct-2026 15:30", { yahoo: "^NSEI" });
  assert.equal(n.source, "NSE"); assert.deepEqual(n.periods.d1, { amt: 148.8, pct: 0.65 });
  assert.deepEqual(n.periods.y1, { amt: -2563.7, pct: -9.97, from: "2025-10-17" });
  const mc = moneycontrolQuoteOf({ pricecurrent: "74729.27", priceprevclose: "74315.61", cl1mVal: "74336.45", cl1mDt: "2026-09-16", cl1yVal: "83467.66", cl1yDt: "2025-10-16", lastupd_epoch: "1792143000" }, { yahoo: "^BSESN" });
  assert.deepEqual(mc.periods.y1, { amt: -8738.39, pct: -10.47, from: "2025-10-16" });
  const us = moneycontrolQuoteOf({ pricecurrent: "7659.44", priceprevclose: "7744.06", "1mthCHG": 107.63, "1yrCHG": 1030.37, lastupd_epoch: "1792181075" }, { yahoo: "^GSPC" });
  assert.deepEqual(us.periods.d30, { amt: 107.63, pct: 1.43 }, "a global index: Moneycontrol's own month change");
  const rows = [["10/16/2026", "29,187.55"], ["10/15/2026", "29,935.59"], ["09/16/2026", "28,945.06"], ["10/16/2025", "24,657.24"]].map(([date, close]) => ({ date, close }));
  const nq = nasdaqQuoteOf({ data: { tradesTable: { rows } } }, { yahoo: "^NDX" });
  assert.equal(nq.source, "Nasdaq"); assert.equal(nq.price, 29187.55); assert.equal(nq.session_date, "2026-10-16"); assert.equal(nq.live, false);
  assert.deepEqual(nq.periods.d30, { amt: 242.49, pct: 0.84, from: "2026-09-16" });
  assert.deepEqual(nq.periods.y1, { amt: 4530.31, pct: 18.37, from: "2025-10-16" });
});

const GR = `<h2>Gold Rate in India for Last 10 Days (1 gram)</h2><table><tr><th>Date</th><th>24K</th><th>22K</th></tr>
<tr><td>Oct 18, 2026</td><td>&#x20b9;14,766 <span>(0)</span></td><td>&#x20b9;13,535 <span>(0)</span></td></tr>
<tr><td>Oct 17, 2026</td><td>&#x20b9;14,766 <span>(+22)</span></td><td>&#x20b9;13,535 <span>(+20)</span></td></tr>
<tr><td>Oct 16, 2026</td><td>&#x20b9;14,744 <span>(0)</span></td><td>&#x20b9;13,515 <span>(0)</span></td></tr></table>`;
test("gold: Goodreturns as the backup, with IBJA's checks; moves only against the same source's saved rates", () => {
  const g = parseGoodreturns(GR);
  assert.equal(g.per_10g_24k, 147660); assert.equal(g.rate_date, "18/10/2026"); assert.equal(g.prev_10g, 147660); assert.equal(g.prev_date, "2026-10-17");
  assert.throws(() => parseGoodreturns(GR.replace(/13,535/g, "9,000")), /ratio/);
  assert.throws(() => parseGoodreturns("<p>nothing</p>"), /no table/);
  // saved rates: IBJA's a year back, Goodreturns' none: the year from IBJA's own history only
  const days = { "2025-10-17": { IBJA: 120000 }, "2026-09-16": { IBJA: 152362, Goodreturns: 153000 } };
  const ib = goldPeriods({ per_10g_24k: 146430, prev_10g: 145942, rate_date: "17/10/2026", month_10g: 152000, month_from: "2026-09-16" }, "IBJA", days);
  assert.deepEqual(ib.d1, { amt: 488, pct: 0.33 }); assert.deepEqual(ib.d30, { amt: -5932, pct: -3.89, from: "2026-09-16" }, "the saved rate first");
  assert.deepEqual(ib.y1, { amt: 26430, pct: 22.03, from: "2025-10-17" });
  const none = goldPeriods({ per_10g_24k: 146430, prev_10g: 145942, rate_date: "17/10/2026", month_10g: 152000, month_from: "2026-09-16" }, "IBJA", {});
  assert.deepEqual(none.d30, { amt: -5570, pct: -3.66, from: "2026-09-16" }, "no saved rates yet: 30 days from IBJA's page");
  assert.equal(none.y1, null, "the year stays empty until a year of rates is saved");
  assert.equal(goldPeriods({ per_10g_24k: 147660, prev_10g: 147660, rate_date: "18/10/2026" }, "Goodreturns", { "2025-10-17": { IBJA: 120000 } }).y1, null, "never IBJA's rate against Goodreturns'");
});

// ------------------------------------------------------------------ Money's rows, labels and missing figures
const q = (name, price, periods, extra = {}) => ({ name, price, periods, source: periods?.source || "Yahoo Finance", ...extra });
const P = (src = "Yahoo Finance") => ({ d1: { amt: 1, pct: 0.1 }, d30: { amt: 2, pct: 0.2, from: "2026-09-16" }, y1: { amt: 3, pct: 0.3, from: "2025-10-16" }, source: src });
const mk = { value: { indices: [q("Sensex", 74729.27, P(), { session_date: "2026-10-16" }), q("Nifty 50", 23146.15, P("NSE"), { session_date: "2026-10-16" }), q("S&P 500", 7659.44, { ...P(), y1: null }, { session_date: "2026-10-16" })], cross: [q("USD/INR", 94.96, P())] } };
const gold = { value: { per_10g_24k: 146430, prev_10g: 145942, periods: { d1: { amt: 488, pct: 0.33 }, d30: null, y1: null, source: "IBJA" }, source: "IBJA" } };
test("money: the six rows in order, each move with its source; a missing figure is null, a row without a price is left out", () => {
  const m = moneyOf(mk, gold, cfg, NOW);
  assert.deepEqual(m.rows.map(r => r.name), ["Sensex", "Nifty 50", "S&P 500", "USD / INR", "Gold 24K · 10 g"], "no Nasdaq figure: no row");
  assert.equal(m.rows[1].source, "NSE"); assert.equal(m.rows[2].y1, null);
  assert.equal(m.rows[4].kind, "gold"); assert.equal(m.rows[4].y1, null);
  assert.equal(m.label, "Markets closed · Friday's close", "Sunday morning");
  // a snapshot copy from before periods: the day from its own price and previous close, the rest empty
  const old = moneyOf({ value: { indices: [{ name: "Sensex", price: 110, prev: 100, session_date: "2026-10-16" }], cross: [] }, stale: true, as_of: "2026-10-17T09:00:00Z" }, null, cfg, NOW);
  assert.deepEqual(old.rows[0].d1, { amt: 10, pct: 10 }); assert.equal(old.rows[0].d30, null); assert.equal(old.stale, true); assert.equal(old.as_of, "2026-10-17T09:00:00Z");
  assert.equal(moneyOf(null, null, cfg, NOW), null);
});

test("money: open or closed per market, and which close, in the paper's words", () => {
  const mon = Date.parse("2026-10-19T05:00:00Z"); // Monday 10:30 IST: India open, the US on Friday's close
  const m = moneyOf({ value: { indices: [q("Sensex", 1, P(), { session_date: "2026-10-19" }), q("S&P 500", 1, P(), { session_date: "2026-10-16" })], cross: [] } }, null, cfg, mon);
  assert.equal(m.label, "India open · US: Friday's close");
  assert.equal(closeWord("2026-10-16", "Asia/Kolkata", NOW), "Friday's close");
  assert.equal(closeWord("2026-10-18", "Asia/Kolkata", NOW), "today's close");
  assert.equal(closeWord("2026-10-05", "Asia/Kolkata", NOW), "5 Oct close");
  assert.equal(marketsLine([{ market: "India", open: false, close: "today's close" }, { market: "US", open: false, close: "Friday's close" }]), "Markets closed · India: today's close · US: Friday's close");
});

// ------------------------------------------------------------------ Sport mode
const ev = (sp, offH, state, extra = {}) => ({ sp, id: sp + offH + state + (extra.key || ""), key: extra.key || sp, start: iso(NOW + offH * H), state, a: "A", b: "B", ...extra });
test("sport mode: from an hour before a start until 30 minutes after the end, or while anything is live", () => {
  const at = n => windowsOf([ev("football", 0, "next")], T, NOW + n * 6e4, endOf).sport_mode;
  assert.equal(at(-61), false); assert.equal(at(-59), true);
  assert.equal(at(115 + 29), true, "football runs about 115 minutes: on until 30 minutes after"); assert.equal(at(115 + 31), false);
  // still live past its usual length: still on, and its window runs 30 minutes past now
  const live = windowsOf([ev("football", -4, "live")], T, NOW, endOf);
  assert.equal(live.sport_mode, true); assert.equal(Date.parse(live.sport_windows[0].to), NOW + 30 * 6e4);
  // postponed: no window; two close events: one window
  assert.equal(windowsOf([ev("football", 0, "off")], T, NOW, endOf).sport_windows.length, 0);
  assert.equal(windowsOf([ev("football", 5, "next"), ev("nba", 6, "next")], T, NOW, endOf).sport_windows.length, 1);
});

const data = {
  laliga_table: { value: { rows: [{ rank: 1, team: "Barcelona", short: "Barcelona", played: 9, points: 27 }, { rank: 2, team: "Atlético Madrid", short: "Atlético", played: 9, points: 22 }, { rank: 4, team: "Real Madrid", short: "Real Madrid", played: 8, points: 18 }, { rank: 5, team: "Sevilla", short: "Sevilla", played: 8, points: 14 }] } },
  f1_standings: { value: { drivers: [{ pos: 1, name: "Andrea Kimi Antonelli", points: 340, code: "ANT" }, { pos: 4, name: "Max Verstappen", points: 221, code: "VER" }] } },
  tennis_hub: { value: { ranks: [{ rank: 1, name: "Jannik Sinner" }, { rank: 3, name: "Carlos Alcaraz" }, { rank: 11, name: "Novak Djokovic" }] } },
  crease: { value: { main: { name: "India tour of New Zealand", opponent: "New Zealand", formats: [{ label: "T20Is", total: 5, score: null, matches: [{ id: 1, state: "next", start: iso(NOW + 4 * D) }] }] },
    also: [{ name: "West Indies tour of India", opponent: "West Indies", last: iso(NOW - D), formats: [{ label: "ODIs", total: 3, score: "Drawn 1-1", matches: [{ id: 2, state: "done", start: iso(NOW - 18 * D) }, { id: 3, state: "done", start: iso(NOW - 15 * D) }] }, { label: "T20Is", total: 5, score: "Drawn 2–2", matches: [1, 2, 3, 4, 5].map(i => ({ id: 10 + i, state: "done", start: iso(NOW - (12 - 2 * i) * D) })) }] }] } },
  f1_last: { value: { round: 17, name: "Singapore Grand Prix", date: iso(NOW - 7 * D), results: [{ name: "Max Verstappen", code: "VER" }, { name: "Charles Leclerc", code: "LEC" }, { name: "Andrea Kimi Antonelli", code: "ANT" }] } },
  nba: { value: { in_season: false, west: null } },
};
test("sport mode: where you stand, one line each and only when the data is there", () => {
  const st = using({ data, cfg, now: NOW }, () => standingsOf(data, cfg, NOW));
  assert.deepEqual(st.map(x => x.label), ["La Liga", "F1", "ATP", "Cricket"], "no NBA line out of season");
  assert.equal(st[0].runs.map(r => r.t).join(""), "Real Madrid 4th · 18 pts"); assert.equal(st[0].note, "9 behind Barcelona, a game in hand");
  assert.equal(st[1].note, "119 behind Antonelli");
  assert.equal(st[2].runs.map(r => r.t).join(""), "Alcaraz No. 3 · Djokovic No. 11"); assert.equal(st[2].note, "Sinner No. 1");
  assert.equal(st[3].runs.map(r => r.t).join(""), "India v West Indies T20Is drawn 2–2"); assert.equal(st[3].note, "Series over");
  const missing = using({ data, cfg, now: NOW }, () => standingsOf({ ...data, laliga_table: null, tennis_hub: { value: { ranks: [] } } }, cfg, NOW));
  assert.deepEqual(missing.map(x => x.label), ["F1", "Cricket"], "a missing table hides its line");
  const inSeason = using({ data, cfg, now: NOW }, () => standingsOf({ nba: { value: { in_season: true, west: [{ team: "Oklahoma City Thunder", wins: 9, losses: 1 }, { team: "Golden State Warriors", wins: 8, losses: 3 }] } } }, cfg, NOW));
  assert.equal(inSeason[0].runs.map(r => r.t).join(""), "Warriors 8–3 · 2nd in the West");
});

test("sport mode: results are the latest per follow within ten days, newest first, five at most, in each sport's words", () => {
  const E = [
    ev("football", -4 * 24, "done", { key: "madrid" }), ev("football", -10 * 24, "done", { key: "madrid" }), ev("nba", -30, "done", { key: "nba" }),
    ev("cricket", -14, "done", { key: "india", status: "No result due to rain" }), ev("tennis", -6 * 24, "done", { key: "tn:Carlos Alcaraz", a: "Carlos Alcaraz", b: "Zizou Bergs", won: "b", setsA: [5, 6], setsB: [7, 7] }),
    ev("tennis", -9 * 24, "done", { key: "tn:Novak Djokovic" }), ev("intl", -15 * 24, "done", { key: "nt:Brazil" }), ev("f1", -2, "done", { key: "f1" }),
  ];
  const R = using({ data, cfg, now: NOW }, () => resultsOf(E, data, NOW, S));
  assert.deepEqual(R.map(e => e.key), ["india", "nba", "madrid", "tn:Carlos Alcaraz", "f1"], "F1 without a top three this weekend: the last Grand Prix's podium");
  assert.equal(R[2].start, E[0].start, "Madrid's latest only");
  assert.deepEqual(R[4].top, ["Max Verstappen", "Charles Leclerc", "Andrea Kimi Antonelli"]); assert.equal(R[4].gp, "Singapore Grand Prix");
  assert.equal(cricketWords("No result due to rain"), "No result, rain"); assert.equal(cricketWords("India won by 8 wkts"), "India won by 8 wkts");
  assert.deepEqual(using({ data, cfg, now: NOW }, () => tennisLine(E[4])), { winner: "Bergs", loser: "Alcaraz", sets: "7–5 7–6" });
});

test("sport mode: this week is the next five after the headline, within 15 days, in time order", () => {
  const E = [ev("f1", 130, "next", { session: "Practice 1" }), ev("football", 15.5, "next"), ev("nba", 90, "next"), ev("cricket", 99, "next"), ev("tennis", 16 * 24, "next"), ev("intl", 40, "next", { a: "Chile", b: "Peru" }), ev("football", 80, "next"), ev("nba", 140, "next"), ev("football", -1, "done")];
  const head = E[1], W = weekOf(E, head, T, NOW);
  assert.deepEqual(W.map(e => e.start), [E[6], E[2], E[3], E[0], E[7]].map(e => e.start));
  assert.equal(weekOf([], null, T, NOW).length, 0);
});

test("sport mode: the headline's context is only facts from the feeds", () => {
  const c = using({ data, cfg, now: NOW }, () => contextOf({ sp: "football", a: "Real Madrid", b: "Sevilla", comp: "La Liga", venue: "Santiago Bernabéu" }, data, cfg));
  assert.equal(c, "Santiago Bernabéu · 4th v 5th in La Liga");
  assert.equal(using({ data, cfg, now: NOW }, () => contextOf({ sp: "football", a: "Real Madrid", b: "RB Leipzig", comp: "Champions League", venue: "Santiago Bernabéu" }, data, cfg)), "Santiago Bernabéu");
  assert.equal(using({ data, cfg, now: NOW }, () => contextOf({ sp: "f1", circuit: "Circuit of the Americas" }, data, cfg)), "Circuit of the Americas · Verstappen 4th in the championship");
  assert.equal(using({ data, cfg, now: NOW }, () => contextOf({ sp: "cricket", id: "in13", venue: "Eden Park, Auckland" }, data, cfg)), "Eden Park, Auckland · T20Is drawn 2–2");
  assert.equal(using({ data, cfg, now: NOW }, () => contextOf({ sp: "nba" }, data, cfg)), null, "nothing to say: nothing sent");
  assert.equal(cricketSeries(data.crease.value, NOW).label, "T20Is", "the format whose latest match is newest");
});

// ------------------------------------------------------------------ backups inside the shared getters
test("weather: a city Open-Meteo does not answer for comes from MET Norway inside the paper's own weather key", async () => {
  const { weather } = await import("../lib/live.js");
  const real = globalThis.fetch;
  const hours = Array.from({ length: 60 }, (_, i) => ({ time: iso(Date.now() + i * H), data: { instant: { details: { air_temperature: 24 + (i % 6), apparent_air_temperature: 25 } }, next_1_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 0.5 } } } }));
  globalThis.fetch = async url => {
    url = String(url);
    if (/api\.met\.no/.test(url)) return Response.json({ properties: { timeseries: hours } });
    return new Response("down", { status: 503 });
  };
  try {
    const r = await weather(new URLSearchParams());
    assert.equal(r.ok, true); assert.ok(r.value.cities.length >= 3);
    assert.ok(r.value.cities.every(c => c.source === "MET Norway")); assert.match(r.source, /MET Norway/);
    assert.equal(r.value.cities[0].current.temp, 24); assert.equal(r.value.cities[0].daily[0].rain_prob, null, "no chance of rain from MET");
  } finally { globalThis.fetch = real; }
  const m = metnoAsOpenMeteo(parseMetno({ properties: { timeseries: hours } }, Date.now()), Date.now());
  assert.equal(m.current.code, null); assert.deepEqual(m.past, []);
});

test("money: Yahoo down, the indices take their publisher's level and the gold its backup page", async () => {
  const { markets, gold_in } = await import("../lib/live.js");
  const real = globalThis.fetch;
  globalThis.fetch = async url => {
    url = String(url);
    if (/nseindia\.com\/api\/allIndices/.test(url)) return Response.json({ timestamp: "16-Oct-2026 15:30", data: [{ index: "NIFTY 50", last: 23146.15, previousClose: 22997.35, oneWeekAgoVal: 22520.45, oneMonthAgoVal: 23270.6, date30dAgo: "17-Sep-2026", oneYearAgoVal: 25709.85, date365dAgo: "17-Oct-2025" }] });
    if (/goodreturns/.test(url)) return new Response(GR, { status: 200 });
    return new Response("down", { status: 503 });
  };
  try {
    const m = await markets(new URLSearchParams());
    const n = m.value.indices.find(i => i.name === "Nifty 50");
    assert.equal(n.source, "NSE"); assert.equal(n.periods.source, "NSE"); assert.equal(n.periods.y1.from, "2025-10-17");
    const g = await gold_in();
    assert.equal(g.source, "Goodreturns"); assert.equal(g.value.periods.source, "Goodreturns"); assert.equal(g.value.periods.y1, null);
  } finally { globalThis.fetch = real; }
});
