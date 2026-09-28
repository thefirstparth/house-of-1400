// Section size: floors with shown working, and a soft upper end (validate.mjs, config section_ranges).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-28.json", import.meta.url), "utf8"));
const waiverErrors = E => validateEdition(E).errors.filter(e => /^coverage/.test(e));
const thin = { ...base, date: "2026-09-29", sections: { ...base.sections, sidelines: { ...base.sections.sidelines, stories: [], briefs: [base.sections.sidelines.stories?.[0] || base.sections.sidelines.briefs?.[0]].filter(Boolean) } } };

test("a thin section after 28 Sep shows what was considered; a one-line reason is not enough", () => {
  const oneLine = waiverErrors({ ...thin, coverage_waivers: { ...base.coverage_waivers, sidelines: "Only one item today worth printing." } });
  assert.ok(oneLine.some(e => /coverage_waivers\.sidelines/.test(e)));
  const shown = waiverErrors({ ...thin, coverage_waivers: { ...base.coverage_waivers, sidelines: { why: "A quiet day outside the big events.", considered: ["Pro Kabaddi auction: routine, no records", "Diamond League final: already run on the Front Page"] } } });
  assert.ok(!shown.some(e => /sidelines/.test(e)));
  const looked = waiverErrors({ ...thin, coverage_waivers: { ...base.coverage_waivers, sidelines: { why: "Nothing new since yesterday.", looked_at: ["https://feeds.bbci.co.uk/sport/rss.xml", "https://sportstar.thehindu.com"] } } });
  assert.ok(!looked.some(e => /sidelines/.test(e)));
  assert.ok(!waiverErrors(base).some(e => /coverage_waivers/.test(e)), "editions up to 28 Sep keep the one-line reason");
});

test("a section past its usual range is a warning, never an error", () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ ...base.front.briefs[0], id: `extra-${i}`, thread_id: `extra-${i}`, headline: `Extra brief number ${i} about something` }));
  const r = validateEdition({ ...base, front: { ...base.front, briefs: [...base.front.briefs, ...many] } });
  assert.ok(r.warnings.some(w => /^long: The Front Page/.test(w)));
  assert.ok(!r.errors.some(e => /^long/.test(e)));
});
