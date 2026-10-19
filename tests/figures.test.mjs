// Figures keep their meaning (Parth, 19 Oct 2026, from the 20 Oct edition): each figure in a headline, a day-in-a-minute
// line or the House Note is shown beside the story's own sentence, and the run says what it counts in checks.figures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-19.json", import.meta.url), "utf8"));
const figErrs = E => validateEdition(E).errors.filter(e => /^figures:/.test(e));
const as = date => { const E = structuredClone(base); E.date = date; return E; };

test("figures: older editions are left alone", () => {
  assert.deepEqual(figErrs(as("2026-10-19")), []);
});

test("figures: the 19 Oct Anthropic slip is put beside the story's own sentence", () => {
  const errs = figErrs(as("2026-10-20"));
  const h = errs.find(e => e.includes('headline:anthropic-public-benefit-fund says "20%"'));
  assert.match(h, /rising to about 20% as it grows/);
  assert.match(h, /roughly 20% of its shares are now committed to the public good/);
  assert.doesNotMatch(h, /\$200 million/); // a number matches only whole
  const n = errs.find(e => e.startsWith('figures: house_note says "a fifth"'));
  assert.match(n, /gave a fifth of itself to a fund/);
  assert.match(n, /roughly 20% of its shares/);
  assert.match(errs.find(e => e.includes('headline:pink-line-cost says "₹17,346 crore"')), /never gives it/);
});

test("figures: every figure answered in checks.figures passes", () => {
  const E = as("2026-10-20");
  const want = figErrs(E).map(e => e.match(/where: "([^"]+)", figure: "([^"]+)"/).slice(1));
  assert.ok(want.length >= 8);
  E.checks.figures = want.map(([where, figure]) => ({ where, figure, means: "what this figure counts, read against the story" }));
  assert.deepEqual(figErrs(E), []);
  E.checks.figures[0].means = "short";
  assert.equal(figErrs(E).length, 1);
});
