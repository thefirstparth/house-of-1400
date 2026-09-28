// The money sweep's must-reads, the wider net, the money calendar (ledger/changes.json) and the lessons ledger.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-09-28.json", import.meta.url), "utf8"));
const moneyErrors = E => validateEdition(E).errors.filter(e => /checks\.(money_sweep|money_net|changes|lessons)/.test(e));
// A copy of the 28 Sep edition dated 29 Sep (other date checks are not the point here).
const SWEEP = ["https://www.rbi.org.in/x", "https://news.google.com/rss/search?q=site:pib.gov.in+when:2d&hl=en-IN", "https://www.livemint.com/rss/money"];
const NET = ["https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN", "https://economictimes.indiatimes.com/wealth"];
const TRAI = { id: "trai-recharge-rules-2026", covered_by: base.front.lead.id };
const next = (checks = {}, date = "2026-09-29") => ({ ...base, date, checks: { ...base.checks, money_sweep: SWEEP, money_net: NET, changes: [TRAI], ...checks } });

test("editions before 29 Sep are not held to the new rules", () => {
  assert.deepEqual(moneyErrors(base), []);
});

test("the must-reads: a page from each group, money rules and prices people pay", () => {
  const e = moneyErrors(next({ money_sweep: ["https://www.rbi.org.in/x", "https://www.livemint.com/rss/money", "https://economictimes.indiatimes.com/wealth"] }));
  assert.ok(e.some(x => /prices and charges people pay/.test(x)));
  assert.deepEqual(moneyErrors(next()), []);
});

test("the wider net must be recorded", () => {
  assert.ok(moneyErrors(next({ money_net: [] })).some(x => /money_net/.test(x)));
});

test("a change taking effect within 30 days stays owed until printed or explained", () => {
  assert.ok(moneyErrors(next({ changes: [] })).some(x => /trai-recharge-rules-2026/.test(x)), "TRAI (from 22 Oct) is owed on 29 Sep");
  assert.ok(moneyErrors(next({ changes: [{ id: "trai-recharge-rules-2026", covered_by: "no-such-item" }] })).some(x => /not an item/.test(x)));
  assert.deepEqual(moneyErrors(next({ changes: [{ id: "trai-recharge-rules-2026", action: "Withdrawn by TRAI on 28 Sep; nothing changes." }] })), []);
  assert.deepEqual(moneyErrors(next({ changes: [] }, "2026-10-23")), [], "after it takes effect it is no longer asked for");
});
