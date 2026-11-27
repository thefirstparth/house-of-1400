// The trial's bets feed (lib/look-bets.js): ids, outcome tokens, the series, the moves and the headlines around them.
// Fixtures in tests/fixtures/look-bets (real gamma events, a real CLOB history and a real Google News search, 27 Nov 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseIds, outcomeTokens, resample, seriesOf, movesIn, pickMoves, parseRss, pickHeadlines, newsQuery, nameWorth, namesIn, look_bet_history, LOOK_BETS, LOOK_BETS_CACHE } from "../lib/look-bets.js";

const F = n => readFileSync(new URL(`./fixtures/look-bets/${n}`, import.meta.url), "utf8");
const J = n => JSON.parse(F(n));
const H = 3600;

test("ids: Polymarket only, bare slugs read as Polymarket, at most eight, no repeats", () => {
  assert.deepEqual(parseIds("pm:a-b-c,ks:KXFOO,taipei-mayor,pm:a-b-c,PM:BAD,pm:x"), ["pm:a-b-c", "pm:taipei-mayor"]);
  assert.equal(parseIds(Array.from({ length: 12 }, (_, i) => `pm:slug-${i}`).join(",")).length, 8);
  assert.deepEqual(parseIds(""), []);
});

test("outcome tokens: the printed outcomes of a multi-market event, each with its Yes token", () => {
  const e = J("event-taipei.json"), t = outcomeTokens(e);
  assert.ok(t.length >= 2 && t.length <= 3);
  assert.deepEqual(t.slice(0, 2).map(o => o.name).sort(), ["Chiang Wan-an", "Puma Shen"]);
  const shen = e.markets.find(m => m.groupItemTitle === "Puma Shen");
  assert.equal(t.find(o => o.name === "Puma Shen").token, JSON.parse(shen.clobTokenIds)[0]);
});

test("outcome tokens: a football match's three moneyline markets, the draw named Draw", () => {
  const t = outcomeTokens(J("event-match.json"));
  assert.equal(t.length, 3);
  assert.ok(t.some(o => o.name === "Draw"));
  assert.ok(t.every(o => /^\d{20,}$/.test(o.token)));
});

test("outcome tokens: a date ladder's rungs", () => {
  const t = outcomeTokens(J("event-ladder.json"));
  assert.ok(t.length >= 1);
  assert.ok(t.every(o => /^By /.test(o.name) && o.token));
});

test("outcome tokens: a single yes/no market keeps only Yes; a single two-name market keeps both", () => {
  const yn = { title: "Will X happen?", slug: "x", markets: [{ outcomes: '["Yes","No"]', outcomePrices: '["0.06","0.94"]', clobTokenIds: '["111","222"]' }] };
  assert.deepEqual(outcomeTokens(yn), [{ name: "Yes", token: "111" }]);
  const two = { title: "A vs B", slug: "ab", markets: [{ outcomes: '["Alpha","Beta"]', outcomePrices: '["0.7","0.3"]', clobTokenIds: '["1","2"]' }] };
  assert.deepEqual(outcomeTokens(two).map(o => o.token), ["1", "2"]);
});

test("resample: the last price at or before each grid point; nothing before the first trade", () => {
  const h = [{ t: 1000, p: 0.2 }, { t: 1000 + 2 * H, p: 0.5 }, { t: 1000 + 2 * H + 10, p: 0.55 }];
  const s = resample(h, 1000 - H, 1000 + 3 * H, H);
  assert.equal(s.t0, 1000);
  assert.deepEqual(s.p, [20, 20, 55, 55]);
  assert.equal(resample([{ t: 1, p: 0.5 }], 0, 10, 1), null);
});

test("series: a week hourly, a month six-hourly, the change in 24 hours and in the week", () => {
  const h = J("history-shen.json").history, last = h.at(-1);
  const s = seriesOf(h, last.t);
  assert.equal(s.now, Math.round(last.p * 1000) / 10);
  assert.equal(s.w.dt, H);
  assert.ok(s.w.p.length >= 160 && s.w.p.length <= 169);
  assert.equal(s.m.dt, 6 * H);
  assert.ok(s.m.p.length > 100);
  assert.ok(s.w.p.every(p => p >= 0 && p <= 100));
  assert.equal(typeof s.d24, "number");
  assert.equal(typeof s.d7, "number");
});

test("moves: the biggest change within a day, a spike that falls straight back is not one", () => {
  const flat = Array(60).fill(40);
  const step = [...flat.slice(0, 30), 42, 46, 52, 53, ...Array(26).fill(53)];
  const m = movesIn({ t0: 0, dt: H, p: step });
  assert.equal(m.length, 1);
  assert.equal(m[0].pts, 13);
  assert.equal(m[0].at, 32 * H); // the steepest hour (46 to 52)
  const spike = [...flat.slice(0, 30), 60, 40, ...Array(28).fill(40)];
  assert.deepEqual(movesIn({ t0: 0, dt: H, p: spike }), []);
  assert.deepEqual(movesIn({ t0: 0, dt: H, p: flat.map((v, i) => v + (i % 2 ? 3 : 0)) }), []);
});

test("moves: two at most, a day apart, numbered in time order; a new market's opening price is not a move", () => {
  const p = [...Array(30).fill(30), ...Array(50).fill(45), ...Array(40).fill(30)];
  const o = [{ name: "A", t: 120 * H, w: { t0: 0, dt: H, p } }, { name: "B", t: 120 * H, w: { t0: 0, dt: H, p: p.map(v => 100 - v) } }];
  const mv = pickMoves(o);
  assert.equal(mv.length, 2);
  assert.deepEqual(mv.map(m => m.n), [1, 2]);
  assert.ok(mv[1].at - mv[0].at > 24 * H);
  // born inside the week at 50%, straight down to 20%: no move
  const born = [{ name: "Draw", t: 200 * H, w: { t0: 150 * H, dt: H, p: [50, 50, 20, ...Array(40).fill(20)] } }];
  assert.deepEqual(pickMoves(born), []);
});

test("headlines: parsed from Google News, the outlet cut from the title", () => {
  const items = parseRss(F("rss-taipei.xml"));
  assert.ok(items.length >= 5);
  for (const i of items) { assert.ok(i.title && i.url && i.at); assert.ok(!i.source || !i.title.endsWith(` - ${i.source}`)); }
});

test("headlines: inside the window, about the question, never about the betting", () => {
  const items = parseRss(F("rss-taipei.xml")), at = Date.parse("2026-11-26T04:00:00Z");
  const got = pickHeadlines(items, { title: "Taipei Mayor Election Winner", name: "Puma Shen", from: at - 36 * 36e5, to: at + 2 * 36e5, moveAt: at });
  assert.ok(got.length >= 1 && got.length <= 3);
  for (const g of got) { assert.ok(g.at >= at - 36 * 36e5 && g.at <= at + 2 * 36e5); assert.match(g.title, /taipei|shen/i); }
  const made = [{ title: "Polymarket odds: Puma Shen surges in Taipei race", source: "X", url: "u", at }, { title: "Weather in Paris", source: "Y", url: "v", at }];
  assert.deepEqual(pickHeadlines(made, { title: "Taipei Mayor Election Winner", name: "Puma Shen", from: at - 1, to: at + 1, moveAt: at }), []);
  // a headline sharing only common words with the question is left out: both of the question's names are needed
  const gaza = [{ title: "Palestinian killed as Israel continues to violate Gaza ceasefire", source: "A", url: "w", at }];
  assert.deepEqual(pickHeadlines(gaza, { title: "Israel x Iran ceasefire continues through...?", name: "Through November 30", from: at - 1, to: at + 1, moveAt: at }), []);
});

test("search words: the outcome's name with the question's names first; no date rung or price band as a name", () => {
  assert.equal(newsQuery("Next Prime Minister of Serbia?", "Dejan Šoškić"), "Dejan Soskic Serbia Prime Minister");
  assert.equal(newsQuery("Israel x Iran ceasefire continues through...?", "Through November 30"), "Israel Iran ceasefire");
  assert.deepEqual(namesIn("Taipei Mayor Election Winner"), ["taipei"]);
  assert.equal(nameWorth("Above $6.20"), false);
  assert.equal(nameWorth("Yes"), false);
  assert.equal(nameWorth("Puma Shen"), true);
});

test("the feed: registered with a cache entry; no ids is a failure, not an empty success", async () => {
  assert.equal(typeof LOOK_BETS.look_bet_history, "function");
  assert.deepEqual(LOOK_BETS_CACHE.look_bet_history.length, 2);
  const r = await look_bet_history(new URLSearchParams({ ids: "ks:KXFOO" }));
  assert.equal(r.ok, false);
  assert.equal(r.value, null);
});
