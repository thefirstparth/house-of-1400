// The money sweep's two groups and the lessons ledger (validate.mjs, ledger/lessons.json, config money.groups).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-28.json", import.meta.url), "utf8"));
const lessonErrors = E => validateEdition(E).errors.filter(e => /checks\.(money_sweep|lessons)/.test(e));
// A copy of the 28 Sep edition dated 29 Sep (other date checks are not the point here).
const next = (checks = {}) => ({ ...base, date: "2026-09-29", checks: { ...base.checks, ...checks } });

test("from 29 Sep the money sweep needs a page from each group: money rules and prices people pay", () => {
  const onlyFinance = lessonErrors(next({ money_sweep: ["https://www.rbi.org.in/x", "https://www.livemint.com/rss/money", "https://economictimes.indiatimes.com/wealth"], lessons: [{ id: "2026-09-28-trai-recharge", action: "Printed as a Ledger brief today." }] }));
  assert.ok(onlyFinance.some(e => /prices and charges people pay/.test(e)), "TRAI, PIB and the other price-setters must be read");
  const both = lessonErrors(next({ money_sweep: ["https://www.rbi.org.in/x", "https://news.google.com/rss/search?q=site:pib.gov.in+when:2d&hl=en-IN", "https://www.livemint.com/rss/money"], lessons: [{ id: "2026-09-28-trai-recharge", action: "Printed as a Ledger brief today." }] }));
  assert.deepEqual(both, []);
  assert.deepEqual(lessonErrors(base), [], "editions before 29 Sep are not held to the new rule");
});

test("an owed story from a lesson must be printed or explained", () => {
  const sweep = ["https://www.rbi.org.in/x", "https://www.trai.gov.in/rss.xml", "https://www.livemint.com/rss/money"];
  assert.ok(lessonErrors(next({ money_sweep: sweep })).some(e => /2026-09-28-trai-recharge still owes/.test(e)));
  assert.ok(lessonErrors(next({ money_sweep: sweep, lessons: [{ id: "2026-09-28-trai-recharge", covered_by: "no-such-item" }] })).some(e => /not an item/.test(e)));
  const id = base.front.lead.id;
  assert.deepEqual(lessonErrors(next({ money_sweep: sweep, lessons: [{ id: "2026-09-28-trai-recharge", covered_by: id }] })), []);
  assert.deepEqual(lessonErrors({ ...next({ money_sweep: sweep }), date: "2026-10-23" }), [], "after its date the owed story is no longer asked for");
});
