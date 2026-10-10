// Polymarket shaping (1 Oct 2026 audit): a match's "who wins" market only, not its side bets; a date ladder does not
// lead with a deadline closing within a day; "Draw (A vs. B)" reads "Draw".
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapePolymarket } from "../lib/live.js";

const m = (o) => ({ active: true, closed: false, ...o });
test("a tennis match: the moneyline, not the toss, sets or totals", () => {
  const e = { slug: "x", title: "Japan Open: Carlos Alcaraz vs Alex Michelsen", markets: [
    m({ question: "Japan Open: Carlos Alcaraz vs Alex Michelsen", sportsMarketType: "moneyline", outcomes: '["Carlos Alcaraz","Alex Michelsen"]', outcomePrices: '["0.835","0.165"]' }),
    m({ question: "Completed Match", groupItemTitle: "Completed Match", sportsMarketType: "tennis_completed_match", outcomes: '["Yes","No"]', outcomePrices: '["0.62","0.38"]' }),
    m({ question: "Set 1 Winner", groupItemTitle: "Set 1 Winner", sportsMarketType: "tennis_first_set_winner", outcomes: '["Carlos Alcaraz","Alex Michelsen"]', outcomePrices: '["0.77","0.23"]' }),
  ] };
  assert.deepEqual(shapePolymarket(e).outcomes, [{ name: "Carlos Alcaraz", prob: 83.5 }, { name: "Alex Michelsen", prob: 16.5 }]);
});
test("a football match: win, draw, win from three moneyline markets; the draw reads Draw", () => {
  const e = { slug: "y", title: "Denmark vs. Portugal", markets: [
    m({ groupItemTitle: "Portugal", sportsMarketType: "moneyline", outcomes: '["Yes","No"]', outcomePrices: '["0.48","0.52"]' }),
    m({ groupItemTitle: "Draw (Denmark vs. Portugal)", sportsMarketType: "moneyline", outcomes: '["Yes","No"]', outcomePrices: '["0.27","0.73"]' }),
    m({ groupItemTitle: "Denmark", sportsMarketType: "moneyline", outcomes: '["Yes","No"]', outcomePrices: '["0.25","0.75"]' }),
    m({ groupItemTitle: "Both teams to score", sportsMarketType: "both_teams_to_score", outcomes: '["Yes","No"]', outcomePrices: '["0.9","0.1"]' }),
  ] };
  assert.deepEqual(shapePolymarket(e).outcomes.map(o => o.name), ["Portugal", "Draw", "Denmark"]);
});
test("a date ladder skips a rung closing within a day, unless nothing is later", () => {
  const at = h => new Date(Date.now() + h * 36e5).toISOString();
  const rung = (d, h, p) => m({ groupItemTitle: d, endDate: at(h), outcomes: '["Yes","No"]', outcomePrices: `["${p}","${1 - p}"]` });
  const e = { slug: "z", title: "US-Iran ceasefire continues through...?", markets: [rung("September 30", 6, 1), rung("October 7", 150, 0.89), rung("October 15", 330, 0.77)] };
  assert.deepEqual(shapePolymarket(e).outcomes.map(o => o.name), ["Through October 7", "Through October 15"]);
  const last = { ...e, markets: [rung("September 30", 6, 0.02), rung("October 1", 20, 0.05)] };
  assert.deepEqual(shapePolymarket(last).outcomes.map(o => o.name), ["Through September 30", "Through October 1"]);
});

test("Polymarket: a runner with no bid or a wide book is left out of a many-runner market", async () => {
  const { shapePolymarket } = await import("../lib/live.js");
  const m = (name, p, bid, ask) => ({ groupItemTitle: name, outcomePrices: JSON.stringify([String(p), String(1 - p)]), active: true, closed: false, ...(bid != null ? { bestBid: bid } : {}), ...(ask != null ? { bestAsk: ask } : {}) });
  const e = { slug: "f1-x-driver-pole-position-2026-10-10", title: "X Grand Prix: Driver Pole Position", markets: [m("Max Verstappen", 0.475, 0.47, 0.48), m("Arvid Lindblad", 0.12, null, 0.2), m("Yuki Tsunoda", 0.08, null, 0.16), m("Lewis Hamilton", 0.1, 0.09, 0.11), m("Lando Norris", 0.11, 0.02, 0.2)] };
  assert.deepEqual(shapePolymarket(e).outcomes.map(o => o.name), ["Max Verstappen", "Lewis Hamilton"]);
});
