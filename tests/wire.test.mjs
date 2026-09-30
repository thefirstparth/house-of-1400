// The wire check, "Also in" lines and the ESPN tennis check (from 30 Sep 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

import { wireCandidates } from "../lib/trial.js";
import { validateEdition } from "../scripts/validate.mjs";

const cfg = { sources: { national_outlets: ["NDTV", "The Hindu", "The Times of India", "Hindustan Times"], feeds: [{ id: "gn-in-top", section: "front" }, { id: "gn-us-top", section: "front" }, { id: "gn-in-tech", section: "workshop" }] } };
const story = (title, signals, outlets) => ({ title, signals, outlets, n: outlets.length, members: [], url: "https://example.com/" + title.length });
const WIRE = { stories: [
  story("Delhi turns chilly as snow hits Uttarakhand early", ["gn-in-top#3"], ["NDTV", "The Hindu", "The Times of India", "News18"]),
  story("Minor Delhi story in two papers today", ["gn-in-top#9"], ["NDTV", "The Hindu"]),
  story("Starship reaches orbit for the first time", ["gn-us-top#2"], ["BBC", "CNN", "NYT", "Reuters", "AP", "The Hindu"]),
  story("Anthropic IPO prospectus shows surging costs", ["gn-in-tech#1"], ["Reuters", "CNBC", "The Verge", "TechCrunch", "Mint", "ET"]),
  story("Wordle hints and answers for today", ["gn-in-top#1"], ["NDTV", "The Hindu", "The Times of India"]),
] };

test("candidates: what the day widely agreed on, with nothing named in advance", () => {
  const c = wireCandidates(WIRE, cfg);
  assert.deepEqual(c.map(x => `${x.region}:${x.section_hint}`), ["world:dateline", "topic:workshop", "india:dateline"]);
});

test("validator: every candidate is carried, answered or skipped with a reason; lines count as carrying", () => {
  const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-29.json", import.meta.url), "utf8"));
  const path = new URL("../ledger/wire-check.json", import.meta.url), had = existsSync(path), saved = had ? readFileSync(path, "utf8") : null;
  try {
    writeFileSync(path, JSON.stringify({ date: "2026-09-30", candidates: wireCandidates(WIRE, cfg) }));
    const E = { ...base, date: "2026-09-30", weekday: "wed", snapshot: {} };
    const wireErrs = x => validateEdition(x).errors.filter(e => /checks\.wire/.test(e));
    assert.ok(wireErrs(E).length >= 2, "unanswered candidates are errors (one may already match a printed story)");
    const line = { id: "starship-orbit", thread_id: "starship-orbit", headline: "Starship reaches orbit for the first time", url: "https://www.bbc.com/news/starship", source: "BBC", time_ist: "07:38" };
    const E2 = { ...E, sections: { ...E.sections, workshop: { ...E.sections.workshop, lines: [line] } },
      checks: { ...E.checks, wire: [{ id: wireCandidates(WIRE, cfg)[1].id, skip: "Covered tomorrow once the filing is read in full." }, { id: wireCandidates(WIRE, cfg)[2].id, covered_by: base.front.lead.id }] } };
    assert.deepEqual(wireErrs(E2), []);
    assert.ok(!validateEdition(E2).errors.some(e => /lines/.test(e)), "a line is valid schema");
  } finally { if (had) writeFileSync(path, saved); else rmSync(path); }
});

test("validator: tennis prints ESPN's time, and says so when Tennis Explorer differs", () => {
  const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-29.json", import.meta.url), "utf8"));
  const espn = { event: "Japan Open", round: "Round 1", when_utc: "2026-10-01T04:00Z", opponent: "Alex Michelsen" };
  const snap = (next, backup, agree) => ({ tennis_players: { value: { players: [{ name: "Carlos Alcaraz", next, backup, agree }] }, as_of: "x", source: "ESPN, Tennis Explorer" } });
  const E = (n, b, a) => ({ ...base, date: "2026-09-30", weekday: "wed", snapshot: { ...base.snapshot, ...snap(n, b, a) } });
  const errs = x => validateEdition(x).errors.filter(e => /^tennis:/.test(e));
  const nm = { text: "Japan Open R1 v Alex Michelsen, Thu 1 Oct, 09:30 IST", when_utc: "2026-10-01T04:00:00Z" };
  const other = { ...espn, when_utc: "2026-10-01T01:00:00Z", opponent: "Michelsen A.", source: "Tennis Explorer" };
  assert.equal(errs(E(espn, null, null)).length, 1, "ESPN has a match and the paper has nothing");
  assert.deepEqual(errs({ ...E(espn, null, null), tennis: { ...base.tennis, players: [{ name: "Carlos Alcaraz", next_match: nm }] } }), []);
  const split = E(espn, other, false);
  assert.ok(errs({ ...split, tennis: { ...base.tennis, players: [{ name: "Carlos Alcaraz", next_match: nm }] } }).some(e => /06:30/.test(e)), "a different time must be mentioned");
  assert.deepEqual(errs({ ...split, tennis: { ...base.tennis, players: [{ name: "Carlos Alcaraz", next_match: nm, note: "Tennis Explorer has it at 06:30 IST. Worth a look at Tokyo's order of play before you set an alarm." }] } }), []);
  assert.deepEqual(errs(E(null, other, null)), [], "only the backup lists it: a warning, never a block");
});

// Paywalled feeds are leads (Parth, 1 Oct: no NYT subscription): the paper finds the story at an open outlet.
test("leads: the name in a summary, open outlets only, and the same story", async () => {
  const { leadName, pickElsewhere } = await import("../lib/trial.js");
  assert.equal(leadName("Bill Draper began funding start-ups in the early 1960s. He has died at 98."), null, "a name that opens a sentence is not used");
  assert.equal(leadName("For safety reasons, Gemini 4 Argon will initially be available only to some companies."), "Gemini 4 Argon");
  assert.equal(leadName("Researchers ask why patients, like former Senator Ben Sasse, develop resistance."), "Senator Ben Sasse");
  const S = { paywalled: { outlets: ["The New York Times", "Financial Times"], hosts: ["nytimes.com", "ft.com"] }, not_outlets: { names: ["instagram.com", "reddit"] }, national_outlets: ["NDTV"] };
  const ftc = { title: "F.T.C. Investigates OpenAI and Anthropic Over Potential Consumer Harms", summary: "The agency will examine whether A.I. labs have broken federal laws." };
  const hits = [
    { title: "FTC is investigating OpenAI, Anthropic and other AI companies over consumer harms", outlet: "CNBC", url: "u1" },
    { title: "FTC investigates OpenAI and Anthropic over potential consumer harms", outlet: "The New York Times", url: "u2" },
    { title: "FTC probes OpenAI Anthropic consumer harms", outlet: "ft.com", url: "u3" },
    { title: "FTC investigating OpenAI Anthropic over consumer harms", outlet: "instagram.com", url: "u4" },
    { title: "OpenAI launches a new model", outlet: "The Verge", url: "u5" },
    { title: "FTC opens probe into AI giants including Anthropic and OpenAI over consumer harms", outlet: "NDTV", url: "u6" },
  ];
  assert.deepEqual(pickElsewhere(ftc, hits, S).map(h => h.outlet), ["NDTV", "CNBC"], "national outlets first; no paywalled, social or unrelated results");
  const argon = { title: "Google Releases a New Flagship A.I. Model, With Limits", summary: "For safety reasons, Gemini 4 Argon will initially be available only to some companies." };
  assert.deepEqual(pickElsewhere(argon, [
    { title: "Google announces Gemini 4 Argon as its new frontier model", outlet: "9to5Google", url: "a" },
    { title: "Google releases a new flagship AI model", outlet: "Tech Site", url: "b" },
  ], S).map(h => h.outlet), ["9to5Google"], "a lead that names something needs the name");
});

test("validator: from 1 Oct nothing may rest only on paywalled outlets", async () => {
  const { validateEdition } = await import("../scripts/validate.mjs");
  const base = JSON.parse(readFileSync(new URL("../content/latest.json", import.meta.url), "utf8"));
  const E = structuredClone(base); E.date = "2026-10-01"; E.weekday = "thu";
  const b = Object.values(E.sections).flatMap(s => s.briefs || [])[0];
  const pay = e => validateEdition(e).errors.filter(x => /paywalled/.test(x));
  b.sources = [{ label: "The New York Times", url: "https://www.nytimes.com/2026/09/30/technology/x.html" }];
  assert.equal(pay(E).length, 1);
  b.sources.push({ label: "CNBC", url: "https://www.cnbc.com/x" });
  assert.equal(pay(E).length, 0, "an open outlet beside it is enough");
});
