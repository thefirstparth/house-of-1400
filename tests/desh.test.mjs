// Desh and Videsh (from the 2 Oct 2026 edition, Parth): Bhide files India stories in desh and the world's in videsh;
// Dateline stays valid for older editions only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-01.json", import.meta.url), "utf8"));
const about = (E, re) => validateEdition(E).errors.filter(e => re.test(e));
const DESH = /Dateline is retired|desh|videsh/;
// The 1 Oct edition re-filed: its India stories to Desh, the rest to Videsh, front stories included.
function refile(E) {
  const C = structuredClone(E), to = x => (/^India\b/.test(x.kicker || "") ? "desh" : "videsh");
  for (const x of [C.front.lead, ...C.front.seconds, ...C.front.briefs]) if (x.section === "dateline") x.section = to(x);
  const D = C.sections.dateline; delete C.sections.dateline;
  for (const k of ["stories", "briefs", "lines"]) for (const x of D?.[k] || []) { const id = to(x); ((C.sections[id] ||= {})[k] ||= []).push({ ...x, ...(k === "lines" ? {} : { section: id }) }); }
  return C;
}

test("editions up to 1 Oct keep Dateline", () => {
  assert.deepEqual(about(base, DESH), []);
});

test("from 2 Oct a story filed to Dateline is refused, by id", () => {
  const errs = about({ ...structuredClone(base), date: "2026-10-02" }, /Dateline is retired/);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /flydubai-indian-captain/);
});

test("the same stories filed to Desh and Videsh pass the schema and the rule", () => {
  const E = { ...refile(base), date: "2026-10-02" };
  assert.ok(E.sections.desh?.briefs?.length && E.front.lead.section === "videsh");
  assert.deepEqual(about(E, DESH), []);
});
