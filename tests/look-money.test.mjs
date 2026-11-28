// Offline tests for the trial's Market Pulse feeds (lib/look-money.js): Yahoo chart parsing, the Treasury backup, the
// policy-rate table's expiry. Fixtures are real answers saved on 27 Nov 2026 (tests/fixtures/look-money/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMODITIES, POLICY_RATES, parseChart, parseTreasury, policyRates, treasuryQuote } from "../lib/look-money.js";

const fx = f => readFileSync(new URL(`./fixtures/look-money/${f}`, import.meta.url), "utf8");
const tnx = JSON.parse(fx("tnx-3mo.json")), si = JSON.parse(fx("si-3mo.json"));

test("a Yahoo daily chart: price, previous close, the day's change and a month of closes", () => {
  const m = tnx.chart.result[0].meta;
  const q = parseChart(tnx, { now: Date.parse("2026-11-27T01:00:00Z") });
  assert.equal(q.price, m.regularMarketPrice);
  assert.ok(q.prev > 0 && q.prev !== q.price);
  assert.equal(q.change, Math.round((q.price - q.prev) * 1e4) / 1e4);
  assert.match(q.session_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(q.spark30.at(-1), Math.round(q.price * 1e4) / 1e4, "the line ends at the price");
  assert.ok(q.spark30.length >= 15 && q.spark30.length <= 25, `a month of daily closes, got ${q.spark30.length}`);
  assert.ok(q.spark30.every(v => typeof v === "number" && isFinite(v)), "no nulls in the line");
  assert.ok(q.spark_from >= "2026-10-25" && q.spark_to === q.session_date);
});

test("a future takes the previous settlement it is given, and is live while its prints are fresh", () => {
  const t = si.chart.result[0].meta.regularMarketTime * 1000;
  const q = parseChart(si, { prevClose: 40.538, now: t + 10 * 6e4 });
  assert.equal(q.prev, 40.538);
  assert.equal(q.change_pct, Math.round((q.price / 40.538 - 1) * 100 * 1e4) / 1e4);
  assert.equal(q.live, true);
  assert.equal(parseChart(si, { prevClose: 40.538, now: t + 3 * 36e5 }).live, false, "three hours without a print is closed");
});

test("a broken Yahoo answer throws instead of giving a figure", () => {
  assert.throws(() => parseChart({ chart: { result: [{ meta: { regularMarketPrice: null } }] } }));
  assert.throws(() => parseChart({}));
});

test("null closes never reach the line", () => {
  const j = structuredClone(tnx); j.chart.result[0].indicators.quote[0].close[5] = null;
  const q = parseChart(j);
  assert.ok(q.spark30.every(v => v != null));
});

test("the Treasury's par yield CSV: the 10 Yr column, oldest first, then a quote", () => {
  const rows = parseTreasury(fx("treasury-2026.csv"));
  assert.ok(rows.length >= 10);
  assert.deepEqual(rows.at(-1), { d: "2026-11-25", c: 4.85 });
  assert.deepEqual(rows.at(-2), { d: "2026-11-24", c: 4.91 });
  const q = treasuryQuote(rows);
  assert.equal(q.price, 4.85); assert.equal(q.prev, 4.91); assert.equal(q.change, -0.06); assert.equal(q.session_date, "2026-11-25");
  assert.throws(() => parseTreasury("Date,1 Mo\n11/25/2026,4.27"), /10 Yr/);
  assert.throws(() => treasuryQuote(rows.slice(0, 1)));
});

test("the policy-rate table: each card is good until its next decision is announced, then hides", () => {
  for (const p of POLICY_RATES) {
    for (const k of ["id", "label", "value", "set_on", "next_decision", "next_at", "checked", "source", "url", "evidence"]) assert.ok(p[k], `${p.id}.${k}`);
    assert.ok(Date.parse(p.next_at) > Date.parse(p.set_on), `${p.id}: next decision after the last`);
    assert.equal(p.next_at.slice(0, 10), p.next_decision, `${p.id}: next_at is on the decision day`);
    assert.doesNotMatch(p.value + p.move + p.label, /—/, "no em dashes");
  }
  assert.deepEqual(policyRates(Date.parse("2026-11-27T12:00:00Z")).map(p => p.id), ["repo", "fed"]);
  assert.deepEqual(policyRates(Date.parse("2026-12-04T04:30:00Z")).map(p => p.id), ["fed"], "the repo card hides at the MPC's announcement");
  assert.deepEqual(policyRates(Date.parse("2026-12-10T00:00:00Z")), []);
});

test("commodities keep their own units", () => {
  assert.deepEqual(COMMODITIES.map(c => [c.symbol, c.unit]), [["SI=F", "$ per ounce"], ["NG=F", "$ per MMBtu"], ["HG=F", "$ per lb"]]);
});

// ---------------------------------------------------------------- the rates, live (fixtures saved on 28 Nov 2026)
import { RBI_DECISIONS, chartSymbols, fedFrac, fedFrom, fomcAt, lastSession, parseChartRange, parseEffr, parseFomcCalendar, parseFomcStatement, parseNewsRss, parseRbiRepo, parseSpark, pickHeadline, pickOdds, repoFrom, WHY } from "../lib/look-money.js";

test("the RBI's home page: the policy repo rate, and nothing else passes for it", () => {
  assert.equal(parseRbiRepo(fx("rbi-home.html")), 5.5);
  assert.throws(() => parseRbiRepo("<p>Standing Deposit Facility Rate : 5.25%</p>"));
  assert.throws(() => parseRbiRepo("<p>Policy Repo Rate : 55%</p>"), /no repo rate/);
});

test("the repo card: the table's move while it is current, worked out after one decision, hidden right after a decision", () => {
  const before = Date.parse("2026-11-28T12:00:00Z");
  const a = repoFrom(5.5, { now: before });
  assert.equal(a.value, "5.50%"); assert.equal(a.move, "Raised 0.25 pts"); assert.equal(a.set_on, "2026-10-07");
  assert.equal(a.next_decision, "2026-12-04"); assert.equal(a.next_at, "2026-12-04T04:30:00.000Z");
  assert.equal(repoFrom(5.5, { now: Date.parse("2026-12-04T06:00:00Z") }), null, "within three hours of the decision: hidden");
  const held = repoFrom(5.5, { now: Date.parse("2026-12-05T06:00:00Z") });
  assert.equal(held.move, "Held"); assert.equal(held.set_on, "2026-12-04"); assert.equal(held.next_decision, null, "no next date until the schedule is added");
  const up = repoFrom(5.75, { now: Date.parse("2026-12-05T06:00:00Z") });
  assert.equal(up.move, "Raised 0.25 pts"); assert.equal(up.value, "5.75%");
  const odd = repoFrom(5.75, { now: before });
  assert.equal(odd.move, null, "a rate that differs from the table with no decision in between: no move claimed");
  assert.ok(RBI_DECISIONS.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
});

test("the FOMC calendar: each meeting's decision day, both years", () => {
  const days = parseFomcCalendar(fx("fomc-calendar.html"));
  assert.ok(days.includes("2026-10-28") && days.includes("2026-12-09") && days.includes("2027-01-27"), days.join(" "));
  assert.deepEqual(days, [...days].sort());
  assert.throws(() => parseFomcCalendar("<p>nothing</p>"));
});

test("a decision at 14:00 New York time, summer and winter", () => {
  assert.equal(new Date(fomcAt("2026-12-09")).toISOString(), "2026-12-09T19:00:00.000Z");
  assert.equal(new Date(fomcAt("2026-07-29")).toISOString(), "2026-07-29T18:00:00.000Z");
});

test("the FOMC statement: the range and what was decided", () => {
  assert.deepEqual(parseFomcStatement(fx("fomc-20261028.html")), { lower: 3.75, upper: 4, move: "Held" });
  assert.deepEqual(parseFomcStatement(fx("fomc-20260916.html")), { lower: 3.75, upper: 4, move: "Raised 0.25 pts" });
  assert.equal(fedFrac("3-3/4"), 3.75); assert.equal(fedFrac("1/2"), 0.5); assert.equal(fedFrac("4"), 4); assert.ok(Number.isNaN(fedFrac("four")));
  assert.throws(() => parseFomcStatement("<p>The Committee will continue to monitor.</p>"));
});

test("the New York Fed's record: the range in force, since when, and what it was before", () => {
  const e = parseEffr(JSON.parse(fx("effr.json")));
  assert.equal(e.lower, 3.75); assert.equal(e.upper, 4); assert.equal(e.since, "2026-09-17"); assert.equal(e.before, 3.75); assert.equal(e.last, "2026-11-25");
  assert.throws(() => parseEffr({ refRates: [] }));
});

test("the Fed card: the statement first, the record as backup, never across a decision it cannot see", () => {
  const cal = parseFomcCalendar(fx("fomc-calendar.html")), now = Date.parse("2026-11-28T12:00:00Z");
  const st = parseFomcStatement(fx("fomc-20261028.html")), e = parseEffr(JSON.parse(fx("effr.json")));
  const a = fedFrom({ cal, st, now });
  assert.equal(a.value, "3.75–4.00%"); assert.equal(a.move, "Held"); assert.equal(a.set_on, "2026-10-28"); assert.equal(a.next_decision, "2026-12-09");
  assert.match(a.url, /monetary20261028a\.htm$/); assert.doesNotMatch(a.value + a.move, /—/);
  const b = fedFrom({ cal, e, now });
  assert.equal(b.value, "3.75–4.00%"); assert.equal(b.move, "Held"); assert.equal(b.set_on, "2026-10-28"); assert.equal(b.source, "New York Fed");
  const c = fedFrom({ cal, e, now: Date.parse("2026-10-01T12:00:00Z") });
  assert.equal(c.move, "Raised 0.25 pts"); assert.equal(c.set_on, "2026-09-16", "the range took effect the day after its decision");
  assert.equal(fedFrom({ cal, e, now: Date.parse("2026-12-10T12:00:00Z") }), null, "after the December decision the record has not caught up: hidden");
  assert.equal(fedFrom({ now: Date.parse("2026-12-10T00:00:00Z") }), null, "the table expires at its next decision");
  assert.equal(fedFrom({ now }).live, false, "the table, when nothing else answers");
});

test("what traders expect: the event about that very decision, its leading outcome in plain words", () => {
  const { events } = JSON.parse(fx("polymarket-search.json"));
  const f = pickOdds(events, { id: "fed", decision: "2026-12-09" });
  assert.equal(f.prob, 95); assert.equal(f.outcome, "a 0.25 pt rise"); assert.match(f.url, /^https:\/\/polymarket\.com\/event\/fed-decision-in-december/);
  const r = pickOdds(events, { id: "repo", decision: "2026-12-04" });
  assert.equal(r.prob, 88); assert.equal(r.outcome, "a 0.25 pt rise"); assert.ok(r.vol < 50000);
  assert.equal(pickOdds(events, { id: "fed", decision: "2027-01-27" }), null, "no event for that meeting: nothing");
  assert.equal(pickOdds(events, { id: "fed", decision: null }), null);
});

// ---------------------------------------------------------------- the day's lines, the headline, the chart
test("Yahoo's spark: each symbol's latest session, thinned, with its previous close", () => {
  const L = parseSpark(JSON.parse(fx("spark-1d.json")));
  assert.ok(L["^NSEI"] && L["SI=F"] && L["INR=X"] && L["BTC-USD"]);
  const n = L["^NSEI"];
  assert.equal(n.points.at(-1), 25607.2); assert.equal(n.prev, 25884.5); assert.equal(n.day_pct, -1.071);
  assert.ok(n.points.length >= 50 && n.points.length <= 78 && n.points.every(Number.isFinite));
  assert.ok(n.t1 > n.t0 && n.t1 - n.t0 < 86400);
  assert.ok(L["BTC-USD"].points.length <= 78, "thinned");
  // a gap of more than three hours starts a new session
  const s = lastSession({ timestamp: [0, 300, 600, 20000, 20300, 20600], close: [1, 2, 3, 10, null, 11] });
  assert.deepEqual(s.points, [10, 11]);
  assert.equal(lastSession({ timestamp: [1], close: [1] }), null);
});

test("chart symbols are the paper's own", () => {
  const syms = chartSymbols({ markets: { indices: [{ yahoo: "^NSEI" }], cross: [{ yahoo: "BZ=F" }, { source: "ibja" }] } });
  assert.deepEqual(syms, ["^NSEI", "BZ=F", "SI=F", "NG=F", "HG=F"]);
});

test("a chart range: the day's session against the close before it; longer ranges from their first close", () => {
  const d = parseChartRange(JSON.parse(fx("nsei-1d.json")), "1D");
  assert.ok(d.points.length > 20); assert.equal(d.tz, "Asia/Kolkata");
  assert.ok(d.points.every(([t, c]) => Number.isInteger(t) && Number.isFinite(c)));
  const m = parseChartRange(JSON.parse(fx("tnx-3mo.json")), "6M");
  assert.equal(m.base, m.points[0][1]);
  assert.throws(() => parseChartRange({ chart: { result: [{ meta: {}, timestamp: [1], indicators: { quote: [{ close: [1] }] } }] } }, "6M"));
});

test("the headline beside a big move: about the day's close, the same way, a known publisher first", () => {
  const inItems = parseNewsRss(fx("news-in.xml")), usItems = parseNewsRss(fx("news-us.xml"));
  assert.ok(inItems.length >= 10 && inItems.every(x => x.title && x.url && isFinite(x.at)));
  assert.ok(inItems.every(x => !/ - [A-Z][\w .]+$/.test(x.title) || !x.source || !x.title.endsWith(x.source)), "the publisher is cut from the title");
  const from = Date.parse("2026-11-27T03:45:00Z"), to = Date.parse("2026-11-27T10:00:00Z"), now = Date.parse("2026-11-28T18:00:00Z");
  const h = pickHeadline(inItems, { pct: -1.2, about: WHY.India.about, from, to, now });
  assert.ok(h, "a headline for India's fall");
  assert.doesNotMatch(h.title, /\b(higher|rise|gain|rally|jump)s?\b/i, h.title);
  assert.doesNotMatch(h.title, /\bopen/i);
  assert.ok(h.at >= from);
  assert.equal(pickHeadline(inItems, { pct: 1.2, about: WHY.India.about, from, to, now })?.title?.match(/plunge|fall|slip|red/i) ?? null, null, "never a falling headline for a rise");
  const u = pickHeadline(usItems, { pct: 2.1, about: WHY.US.about, from: Date.parse("2026-11-27T14:30:00Z"), to: Date.parse("2026-11-27T18:00:00Z"), now });
  assert.equal(u.source, "AP News"); assert.match(u.title, /close out/);
  assert.equal(pickHeadline(usItems, { pct: 2.1, about: WHY.US.about, from: Date.parse("2026-11-29T00:00:00Z"), now }), null, "nothing published after the session opened: nothing");
  assert.equal(pickHeadline([{ title: "Sensex, Nifty end lower; what to expect next week", source: "Mint", url: "u", at: from + 1 }], { pct: -1, about: WHY.India.about, from, now }), null, "a look ahead is not the day");
});
