// A follow-up leads with what changed (Parth, 2 Oct 2026: "Ronaldo walks out of the national camp: did we not run this
// story yesterday already?"). The 2 Oct Ronaldo story is replayed as if it were a later day's, against the ledger as
// it stood after 1 Oct, then rewritten the right way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const read = f => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const oct1 = read("content/editions/2026-10-01.json"), oct2 = read("content/editions/2026-10-02.json");
const was = oct1.sections.pitch.stories.find(s => s.thread_id === "ronaldo-portugal-2026");
const ledger = { threads: [{ thread_id: "ronaldo-portugal-2026", title: was.headline, entities: [], facts: { left: "30 Sep, Copenhagen", goals: "146", caps: "234", next: "Denmark v Portugal, 1 Oct" }, first_printed: "2026-10-01", last_printed: "2026-10-01", last_change: "2026-10-01", status: "active", votes: { up: 0, down: 0 } }] };
const about = E => validateEdition(E, { ledger }).errors.filter(e => /^follow-up/.test(e));
const RONALDO = s => s.thread_id === "ronaldo-portugal-2026";
// the 2 Oct paper, dated a day later so the rule applies (it starts on 3 Oct)
const asPrinted = () => {
  const E = structuredClone(oct2); E.date = "2026-10-03";
  const s = E.front.seconds.find(RONALDO); s.facts = { denmark_portugal: "2-4", statement: "not yet given" };
  // as it went out at 14:15 on 2 Oct, before the correction
  Object.assign(s, { headline: "Ronaldo walks out of Portugal's camp after being dropped; Portugal win in Denmark without him", short: "Coach Jorge Jesus said Cristiano Ronaldo would not start in Copenhagen after he spent the win over Norway on the bench; Ronaldo then left the squad, saying on Instagram he would explain his reasons to the Portuguese people in due course. Jesus says there is no rift. Without him Portugal won 4–2 in Copenhagen on Thursday." });
  delete s.update;
  E.glance.find(g => g.target === s.id).line = "Ronaldo walks out of the national camp";
  return E;
};
const SHORT = "Portugal won 4–2 in Copenhagen on Thursday without Cristiano Ronaldo, with Gonçalo Ramos, who took his place, scoring one and setting up another. Ronaldo left the camp on Wednesday after Jorge Jesus dropped him, and has not yet given the reasons he promised.";

test("the 2 Oct Ronaldo story, as printed, is refused on every count", () => {
  const errs = about(asPrinted());
  assert.ok(errs.some(e => /add update \{since: "2026-10-01"/.test(e)), "update missing");
  assert.ok(errs.some(e => /follow-up on the Front Page/.test(e)), "on the Front Page");
  assert.ok(errs.some(e => /headline opens with what was printed/.test(e)), "headline");
  assert.ok(errs.some(e => /first sentence retells/.test(e)), "first sentence");
  assert.ok(errs.some(e => /day-in-a-minute line "Ronaldo walks out of the national camp"/.test(e)), "glance line");
});

test("rewritten to lead with the result, in its section, it passes", () => {
  const E = asPrinted(), i = E.front.seconds.findIndex(RONALDO), [s] = E.front.seconds.splice(i, 1);
  Object.assign(s, { headline: "Portugal win 4–2 in Denmark without Ronaldo, who has still not said why he left", short: SHORT, update: { since: "2026-10-01", new: "Portugal won 4–2 in Denmark without him; his statement has still not come." } });
  (E.sections.pitch.stories ||= []).unshift(s);
  E.glance.find(g => g.target === s.id).line = "Portugal win in Denmark without Ronaldo";
  assert.deepEqual(about(E), []);
});

test("on the Front Page, a follow-up needs update.front; the wrong since date is named", () => {
  const E = asPrinted(), s = E.front.seconds.find(RONALDO);
  Object.assign(s, { headline: "Ronaldo retires from international football", short: "Cristiano Ronaldo retired from international football on Friday, ending 23 years with Portugal.", update: { since: "2026-09-30", new: "He retired." } });
  E.glance.find(g => g.target === s.id).line = "Ronaldo retires from Portugal duty";
  assert.deepEqual(about(E), ["follow-up: front.seconds[1] update.since should be 2026-10-01, when the thread last printed", "follow-up: front.seconds[1] is a follow-up on the Front Page; put it in its section, or say in update.front why what changed is front-page news on its own"]);
  s.update = { since: "2026-10-01", new: "He retired.", front: "The end of Portugal's record scorer's international career." };
  assert.deepEqual(about(E), []);
});

test("before 3 Oct nothing changes", () => {
  const E = asPrinted(); E.date = "2026-10-02";
  assert.deepEqual(about(E), []);
});

test("the corrected 2 Oct story passes", () => {
  const E = structuredClone(oct2); E.date = "2026-10-03";
  assert.deepEqual(about(E), []);
});
