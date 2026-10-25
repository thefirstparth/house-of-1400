import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { pick, item, oursOf, endOf, weatherWord, warningFor, cityLine, parseMetno, track, restOfDay, skyOf } = await import("../lib/tv.js");
const { events, using } = await import("../public/sport/js/core.js");

const cfg = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8"));
const T = cfg.tv;
const NOW = Date.parse("2026-10-18T07:00:00Z"); // 12:30 IST
const H = 36e5, iso = ms => new Date(ms).toISOString();
const ev = (sp, offH, state, extra = {}) => ({ sp, id: sp + offH + state + (extra.a || ""), start: iso(NOW + offH * H), state, a: "A", b: "B", ...extra });

test("tv: live first, then a recent result, then upcoming in time order, four at most", () => {
  const E = [ev("football", 30, "next"), ev("nba", 2, "next"), ev("cricket", -5, "live", { sa: "245/3" }), ev("football", -3, "done", { sa: 2, sb: 1 }), ev("tennis", 50, "next"), ev("f1", 80, "next")];
  assert.deepEqual(pick(E, T, NOW).map(e => `${e.sp}:${e.state}`), ["cricket:live", "football:done", "nba:next", "football:next"]);
});

test("tv: two live at once follow the app's order, the Warriors always last", () => {
  const E = [ev("nba", -1, "live", { sa: 74, sb: 78 }), ev("football", -1, "live", { sa: 2, sb: 1 }), ev("tennis", -1, "live")];
  assert.deepEqual(pick(E, T, NOW).map(e => e.sp), ["football", "nba", "tennis"], "a score first, then football before the NBA");
  const noScore = [ev("nba", -1, "live"), ev("cricket", -1, "live")];
  assert.deepEqual(pick(noScore, T, NOW).map(e => e.sp), ["cricket", "nba"]);
});

test("tv: the same start time breaks ties by the app's order (football, F1, cricket, nations, tennis, NBA)", () => {
  const E = [ev("nba", 10, "next"), ev("f1", 10, "next"), ev("football", 10, "next")];
  assert.deepEqual(pick(E, T, NOW).map(e => e.sp), ["football", "f1", "nba"]);
});

test("tv: nothing more than 15 days ahead", () => {
  const E = [ev("football", 14 * 24 + 23, "next"), ev("football", 15 * 24 + 1, "next")];
  assert.equal(pick(E, T, NOW).length, 1);
  assert.equal(pick([ev("f1", 16 * 24, "next")], T, NOW).length, 0);
});

test("tv: a result stays for 3 hours after the event's end, not after its start", () => {
  // football runs about 115 minutes: started 4 h ago, ended about 2 h ago, still shown; started 5 h 10 min ago, gone
  assert.equal(pick([ev("football", -4, "done")], T, NOW).length, 1);
  assert.equal(pick([ev("football", -5.2, "done")], T, NOW).length, 0);
  // an ODI runs eight hours: a result 10 hours after the start is still inside the window
  assert.equal(pick([ev("cricket", -10, "done", { comp: "2nd ODI" })], T, NOW).length, 1);
  assert.equal(endOf(ev("f1", 0, "done", { mins: 60 }), T), NOW + 60 * 6e4);
  // an F1 session without its top three is not a result yet
  assert.equal(pick([ev("f1", -1, "done", { mins: 60 })], T, NOW).length, 0);
});

test("tv: postponed or abandoned within 12 hours is sent as off, with the word", () => {
  const E = [ev("football", -2, "off", { offWhy: "Postponed" }), ev("cricket", -20, "off", { offWhy: "Abandoned" }), ev("nba", -1, "off")];
  const P = pick(E, T, NOW);
  assert.deepEqual(P.map(e => e.offWhy), ["Postponed"]);
});

test("tv: only Brazil and Spain among the national sides (the TV's own list)", () => {
  const E = [ev("intl", 5, "next", { a: "Portugal", b: "Ireland" }), ev("intl", 6, "next", { a: "Spain", b: "England" }), ev("intl", 7, "next", { a: "Chile", b: "Brazil" })];
  assert.deepEqual(pick(E, T, NOW).map(e => e.b), ["England", "Brazil"]);
});

test("tv: live only on the feed's word, and a saved copy older than ten minutes is never live (sent as seen)", () => {
  const nba = (live, as_of, stale) => ({ value: { next: [{ id: "g1", date: iso(NOW - H), home: true, opponent: "Los Angeles Lakers", live, clock: "Q3 4:12", score: { us: 70, them: 68 } }] }, as_of, stale });
  const run = data => using({ data, cfg, now: NOW }, () => pick(events(true), T, NOW));
  // the clock alone (an hour after tip-off, no live word) never makes it live
  assert.notEqual(run({ nba: nba(false, iso(NOW), false) })[0]?.state, "live");
  assert.equal(run({ nba: nba(true, iso(NOW), false) })[0].state, "live");
  const old = run({ nba: nba(true, iso(NOW - 11 * 6e4), true) })[0];
  assert.equal(old.state, "off"); assert.ok(old.seen);
});

test("tv: an item says only what it knows; long names step down; competitions have their short form", () => {
  const ctx = { cfg, T, codes: { "Max Verstappen": "VER", Norris: "NOR", Leclerc: "LEC" }, f1city: { gp: "United States Grand Prix", city: "Austin" } };
  const run = e => using({ data: {}, cfg, now: NOW }, () => item(e, ctx));
  const m = run(ev("football", 2, "next", { a: "Real Madrid", b: "Paris Saint-Germain", comp: "UCL" }));
  assert.equal(m.a, "Real Madrid"); assert.equal(m.a_short, "Madrid"); assert.equal(m.b, "PSG", "a long name is sent short");
  assert.equal(m.comp, "Champions League"); assert.equal(m.comp_short, "UCL");
  assert.ok(!("sa" in m) && !("pause" in m) && !("result" in m), "nothing empty is sent");
  const nba = run(ev("nba", -1, "live", { a: "Los Angeles Lakers", b: "Golden State Warriors", sa: 74, sb: 78, clock: "Q3 4:12", comp: "NBA" }));
  assert.deepEqual([nba.a, nba.b, nba.sa, nba.sb, nba.clock], ["Lakers", "Warriors", "74", "78", "Q3 4:12"]);
  const ht = run(ev("football", -1, "live", { a: "Real Madrid", b: "Sevilla", sa: 1, sb: 0, clock: "HT", comp: "La Liga" }));
  assert.equal(ht.pause, "HT"); assert.ok(!ht.clock);
  const odi = run(ev("cricket", -3, "live", { a: "India", b: "Australia", sa: "245/3", oa: "42", comp: "2nd ODI", pause: "Rain" }));
  assert.equal(odi.sa, "245/3 (42 ov)"); assert.equal(odi.pause, "Rain");
  const test1 = run(ev("cricket", -30, "live", { a: "India", b: "Australia", sa: "120/2", comp: "1st Test", status: "Day 2: Stumps - India trail by 80 runs" }));
  assert.equal(test1.clock, "Day 2");
  const won = run(ev("cricket", -9, "done", { a: "India", b: "Australia", comp: "2nd ODI", status: "India won by 14 runs" }));
  assert.equal(won.result, "India won by 14 runs");
  const tn = run(ev("tennis", -3, "done", { a: "Carlos Alcaraz", b: "Jannik Sinner", won: "a", comp: "Shanghai" }));
  assert.deepEqual([tn.a, tn.b, tn.result], ["Alcaraz", "Sinner", "Alcaraz won"]);
  const f1 = run(ev("f1", -1, "live", { gp: "United States Grand Prix", session: "Qualifying", liveTop: ["Max Verstappen", "Lando Norris", "Charles Leclerc"], a: undefined, b: undefined }));
  assert.deepEqual([f1.gp, f1.city, f1.session, f1.top], ["US GP", "Austin", "Qualifying", ["VER", "NOR", "LEC"]]);   // tv.gp_short (25 Oct)
  assert.ok(!("a" in f1));
  const off = run(ev("football", -2, "off", { a: "Real Madrid", b: "Sevilla", offWhy: "Postponed", comp: "La Liga" }));
  assert.equal(off.offWhy, "Postponed");
  const tbc = run(ev("cricket", 30, "next", { a: "India", b: "England", tbc: true, comp: "1st Test" }));
  assert.equal(tbc.tbc, true);
  assert.ok(!JSON.stringify([m, nba, odi, won, test1]).includes("—"), "no em-dashes");
});

test("tv weather: first matching word wins, and a figure the day lacks fails its rule", () => {
  const W = T.weather_words, d = x => ({ max: 30, min: 20, rain_mm: 0, rain_prob: 0, code: 3, feels_max: 32, ...x });
  assert.equal(weatherWord(d({ rain_mm: 120, rain_prob: 90, code: 95 }), W), "Very heavy rain");
  assert.equal(weatherWord(d({ rain_mm: 70 }), W), "Heavy rain");
  assert.equal(weatherWord(d({ code: 95, rain_prob: 91, rain_mm: 4 }), W), "Storms likely", "storms beat rain likely");
  assert.equal(weatherWord(d({ code: 95, rain_prob: 40 }), W), null, "storms need a 50% chance");
  assert.equal(weatherWord(d({ rain_prob: 60, rain_mm: 2.5 }), W), "Rain likely");
  assert.equal(weatherWord(d({ rain_prob: 80, rain_mm: 1 }), W), null, "rain likely needs 2.5 mm");
  assert.equal(weatherWord(d({ max: 45 }), W), "Extreme heat");
  assert.equal(weatherWord(d({ max: 41 }), W), "Very hot");
  assert.equal(weatherWord(d({ feels_max: 43 }), W), "Feels very hot");
  assert.equal(weatherWord(d({ feels_max: null, max: 35 }), W), null);
  assert.equal(weatherWord(d({ min: 3 }), W), "Very cold");
  assert.equal(weatherWord(d({ min: 9 }), W), "Cold night");
  assert.equal(weatherWord(d({ code: 45 }), W), "Fog");
  assert.equal(weatherWord(d({}), W), null, "otherwise no word");
});

test("tv weather: today's word until 18:00 IST, tomorrow's after, said so", () => {
  const w = { now: 24.4, feels: 26.6, today: { max: 28.4, min: 19.6, rain_prob: 10, rain_mm: 0, code: 3 }, tomorrow: { max: 27, min: 20, rain_prob: 80, rain_mm: 8, code: 61 }, source: "Open-Meteo" };
  const at = h => Date.parse(`2026-10-18T${String(h).padStart(2, "0")}:00:00+05:30`);
  const day = cityLine({ name: "Ranchi" }, w, null, T, at(17));
  assert.deepEqual(day, { city: "Ranchi", now: 24, feels: 27, hi: 28, lo: 20, source: "Open-Meteo" });
  assert.equal(cityLine({ name: "Ranchi" }, w, null, T, at(18)).word, "Rain likely tomorrow");
  const noFeels = cityLine({ name: "Ranchi" }, { ...w, feels: null }, null, T, at(10));
  assert.ok(!("feels" in noFeels), "a missing figure is left out");
});

test("tv weather: a warning goes in its own city's slot and beats the forecast word; the nowcast is Bengaluru's only", () => {
  const alerts = { by_city: { Ranchi: { city: "Ranchi", colour: "Orange", type: "Heavy Rain" } } };
  const nowcast = { cities: [{ city: "Bengaluru", warning: { what: ["a moderate thunderstorm, gusts to 61 km/h"], level: 3 } }, { city: "Prayagraj", warning: { what: ["heavy rain"], level: 3 } }] };
  assert.deepEqual(warningFor("Ranchi", alerts, nowcast, T), { word: "Orange alert · heavy rain", word_short: "Orange alert" });
  assert.deepEqual(warningFor("Bengaluru", alerts, nowcast, T), { word: "IMD warning · moderate thunderstorm", word_short: "IMD warning" });
  assert.equal(warningFor("Prayagraj", alerts, nowcast, T), null, "the nowcast is used for Bengaluru only");
  const light = { cities: [{ city: "Bengaluru", warning: { what: ["light rain"], level: 1 } }] };
  assert.equal(warningFor("Bengaluru", null, light, T), null, "light rain is not a warning");
  const w = { now: 22, feels: 24, today: { max: 28, min: 20, rain_prob: 91, rain_mm: 6, code: 95 }, source: "Open-Meteo" };
  const line = cityLine({ name: "Ranchi" }, w, warningFor("Ranchi", alerts, nowcast, T), T, NOW);
  assert.equal(line.word, "Orange alert · heavy rain"); assert.equal(line.warn, true);
  assert.equal(cityLine({ name: "Prayagraj" }, w, null, T, NOW).word, "Storms likely", "the other cities keep their own");
});

test("tv weather: MET Norway as the backup, its own feels-like, and no high or low from a part day", () => {
  const start = Date.parse("2026-10-17T20:30:00Z"); // 02:00 IST: the rest of the day is 22 hours
  const ts = Array.from({ length: 50 }, (_, i) => ({ time: iso(start + i * H), data: { instant: { details: { air_temperature: 20 + (i % 24) / 3, apparent_air_temperature: 21 + (i % 24) / 3 } },
    next_1_hours: { summary: { symbol_code: i === 14 ? "heavyrainandthunder" : "cloudy" }, details: { precipitation_amount: i === 14 ? 6 : 0, probability_of_precipitation: i === 14 ? 70 : 5 } } } }));
  const w = parseMetno({ properties: { timeseries: ts } }, start);
  assert.equal(w.source, "MET Norway"); assert.equal(w.now, 20); assert.equal(w.feels, 21);
  assert.equal(w.today.code, 95); assert.equal(w.today.rain_prob, 70); assert.equal(w.today.rain_mm, 6);
  assert.ok(Number.isFinite(w.today.max) && Number.isFinite(w.today.min), "22 hours left: high and low given");
  assert.equal(weatherWord(w.today, T.weather_words), "Storms likely");
  const late = parseMetno({ properties: { timeseries: ts.slice(12) } }, start + 12 * H); // 14:00 IST: 10 hours left
  assert.equal(late.today.max, null, "a part day has no high"); assert.equal(late.today.min, null);
  assert.throws(() => parseMetno({ properties: {} }, start));
  const line = cityLine({ name: "Bengaluru" }, late, null, T, start + 12 * H);
  assert.ok(!("hi" in line) && !("lo" in line)); assert.equal(line.feels, 25);
});

test("tv: one Telegram message after a day down, one when back, at most one a day per source", () => {
  const S = {}, day = 864e5, names = { nba: "Warriors (ESPN)" };
  let r = track(S, { nba: false }, T, NOW, names);
  assert.equal(r.msgs.length, 0); assert.equal(S.nba.since, NOW);
  r = track(S, { nba: false }, T, NOW + 23 * H, names); assert.equal(r.msgs.length, 0, "not before 24 hours");
  r = track(S, { nba: false }, T, NOW + 25 * H, names); assert.equal(r.msgs.length, 1); assert.match(r.msgs[0], /Warriors \(ESPN\)/);
  r = track(S, { nba: false }, T, NOW + 30 * H, names); assert.equal(r.msgs.length, 0, "once per outage");
  r = track(S, { nba: true }, T, NOW + 26 * H, names); assert.equal(r.msgs.length, 0, "a recovery on the alert's day waits");
  r = track(S, { nba: true }, T, NOW + 2 * day, names); assert.equal(r.msgs.length, 1); assert.match(r.msgs[0], /answering again/);
  assert.equal(S.nba, undefined);
  r = track(S, { nba: false }, T, NOW + 3 * day, names); r = track(S, { nba: true }, T, NOW + 3 * day + H, names);
  assert.equal(r.msgs.length, 0, "a short outage says nothing");
  assert.ok(!r.msgs.join("").includes("—"));
});

test("tv weather: the word is for the hours still ahead, never the morning that has passed (19 Oct: \"Fog\" at 2 pm in Prayagraj)", () => {
  // Prayagraj on 19 Oct as Open-Meteo had it: fog at 5 and 6 am (the whole day's code 45), clear from 7 am
  const hours = Array.from({ length: 24 }, (_, h) => ({ time: `2026-10-19T${String(h).padStart(2, "0")}:00`, temp: h < 7 ? 22 : 30, feels: h < 7 ? 23 : 33, rain_prob: 0, rain_mm: 0, code: h === 5 || h === 6 ? 45 : 0 }));
  const at = hm => Date.parse(`2026-10-19T${hm}:00+05:30`);
  const w = { now: 32, feels: 34, hum: 52, today: { max: 32, min: 24, rain_mm: 0, rain_prob: 0, code: 45, feels_max: 34 }, tomorrow: { max: 31, min: 23, rain_mm: 0, rain_prob: 0, code: 0, feels_max: 33 }, hours, source: "Open-Meteo" };
  const word = hm => cityLine({ name: "Prayagraj" }, w, null, T, at(hm)).word;
  assert.equal(word("14:08"), undefined, "no fog at 2 pm");
  assert.equal(word("05:30"), "Fog", "fog while it is there");
  assert.equal(restOfDay(hours, at("14:08"), T.evening_from).code, 0);
  // rain later today still shows; rain that has passed does not
  const rainAt = h => hours.map(x => (Number(x.time.slice(11, 13)) === h ? { ...x, rain_prob: 80, rain_mm: 5, code: 63 } : x));
  assert.equal(cityLine({ name: "Prayagraj" }, { ...w, hours: rainAt(16) }, null, T, at("14:08")).word, "Rain likely");
  assert.equal(cityLine({ name: "Prayagraj" }, { ...w, hours: rainAt(9) }, null, T, at("14:08")).word, undefined);
  // without hours (MET Norway's backup, whose "today" already starts now) the day's figures are used, as before
  assert.equal(cityLine({ name: "Prayagraj" }, { ...w, hours: null }, null, T, at("14:08")).word, "Fog");
  // the TV asks the shared weather key for every city's hours
  assert.match(readFileSync(new URL("../lib/tv.js", import.meta.url), "utf8"), /PAPER\.weather\(new URLSearchParams\("hourly=all"\)\)/);
});

test("tv: ours marks the one followed side, and only one", () => {
  const ctx = { cfg, T, codes: {}, f1city: null };
  const run = e => using({ data: {}, cfg, now: NOW }, () => item(e, ctx));
  // one followed side, in each sport, on either side
  assert.equal(run(ev("football", 5, "next", { a: "Real Madrid", b: "Sevilla" })).ours, "a");
  assert.equal(run(ev("football", 5, "next", { a: "Getafe", b: "Real Madrid" })).ours, "b");
  assert.equal(run(ev("cricket", 5, "live", { a: "India", b: "New Zealand", sa: "120/2" })).ours, "a");
  assert.equal(run(ev("nba", 5, "next", { a: "Los Angeles Lakers", b: "Golden State Warriors" })).ours, "b");
  assert.equal(run(ev("tennis", 5, "next", { a: "Jannik Sinner", b: "Carlos Alcaraz" })).ours, "b");
  assert.equal(run(ev("intl", 5, "next", { a: "Brazil", b: "Chile" })).ours, "a");
  // both followed, or neither: nothing
  assert.equal(run(ev("tennis", 5, "next", { a: "Novak Djokovic", b: "Carlos Alcaraz" })).ours, undefined);
  assert.equal(run(ev("intl", 5, "next", { a: "Spain", b: "Portugal" })).ours, undefined);
  assert.equal(run(ev("football", 5, "next", { a: "Getafe", b: "Sevilla" })).ours, undefined);
  // sport by sport: India in football is not the cricket team; Atlético Madrid is not Real Madrid
  assert.equal(oursOf({ sp: "intl", a: "India", b: "Brazil" }, cfg), "b");
  assert.equal(oursOf({ sp: "football", a: "Atlético Madrid", b: "Sevilla" }, cfg), null);
  // F1 never has one
  assert.equal(oursOf({ sp: "f1", a: "Max Verstappen", b: "Lando Norris" }, cfg), null);
});


test("tv weather: the sky right now, from the current weather code", () => {
  assert.equal(skyOf(0), "clear"); assert.equal(skyOf(1), "clear"); assert.equal(skyOf(2), "partly"); assert.equal(skyOf(3), "overcast");
  assert.equal(skyOf(45), "fog"); assert.equal(skyOf(48), "fog"); assert.equal(skyOf(61), "rain"); assert.equal(skyOf(81), "rain");
  assert.equal(skyOf(95), "storm"); assert.equal(skyOf(99), "storm"); assert.equal(skyOf(null), null); assert.equal(skyOf(undefined), null);
  const w = { now: 22, feels: 22, code: 3, today: { max: 27, min: 19, rain_prob: 10, rain_mm: 0, code: 3 }, source: "Open-Meteo" };
  const at = Date.parse("2026-10-20T15:00:00+05:30");
  assert.equal(cityLine({ name: "Bengaluru" }, w, null, T, at).sky, "overcast");
  assert.ok(!("sky" in cityLine({ name: "Bengaluru" }, { ...w, code: null }, null, T, at)), "no code, no sky (MET Norway's backup)");
});
