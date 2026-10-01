// AI, Tech, and Sales & SaaS (from the 2 Oct 2026 edition, Parth): Bhide files to them in place of The Workshop and
// The Pipeline, which stay valid for older editions only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-01.json", import.meta.url), "utf8"));
const retired = E => validateEdition(E).errors.filter(e => /The Workshop is retired|The Pipeline is retired/.test(e));
const schema = E => validateEdition(E).errors.filter(e => /schema|must be equal to one of the allowed values/i.test(e));
const onWorkshop = [base.front.lead, ...base.front.seconds, ...base.front.briefs, ...Object.values(base.sections).flatMap(s => [...(s.stories || []), ...(s.briefs || [])])].filter(x => x.section === "workshop");

test("editions up to 1 Oct keep The Workshop and The Pipeline", () => {
  assert.ok(onWorkshop.length > 0, "the 1 Oct edition has a Workshop story to test with");
  assert.deepEqual(retired(base), []);
});

test("from 2 Oct a story filed to The Workshop is refused, by id", () => {
  const errs = retired({ ...structuredClone(base), date: "2026-10-02" });
  assert.equal(errs.length, 1);
  for (const x of onWorkshop) assert.match(errs[0], new RegExp(x.id));
});

test("the same story filed to AI passes the schema and the rule", () => {
  const E = { ...structuredClone(base), date: "2026-10-02" };
  for (const x of [E.front.lead, ...E.front.seconds, ...E.front.briefs]) if (x.section === "workshop") x.section = "ai";
  for (const [id, s] of Object.entries(E.sections)) if (id === "workshop" || id === "pipeline") { (E.sections.ai ||= {}); for (const k of ["stories", "briefs", "lines"]) if (s[k]) (E.sections.ai[k] ||= []).push(...s[k].map(x => (k === "lines" ? x : { ...x, section: "ai" }))); delete E.sections[id]; }
  assert.deepEqual(retired(E), []);
  assert.deepEqual(schema(E), []);
});
