// The editor's note (from the 2 Oct 2026 edition, Parth: the 1 Oct note "read too AI"): one point, two sentences and
// 35 words at most, no sentimental turn, no reading order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";

const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-01.json", import.meta.url), "utf8"));
const about = E => validateEdition(E).errors.filter(e => /^editor_note/.test(e));
const on = (note, date = "2026-10-02") => ({ ...structuredClone(base), date, editor_note: note });

test("the 1 Oct note stands on 1 Oct and is refused from 2 Oct", () => {
  assert.deepEqual(about(base), []);
  const errs = about(on(base.editor_note));
  assert.equal(errs.length, 2);
  assert.match(errs[0], /48 words in 3 sentences/);
  assert.match(errs[1], /sentimental/);
});

test("the 25 Sep note is the model and passes", () => {
  assert.deepEqual(about(on("Readers are reminded that the Azerbaijan Grand Prix is on Saturday this year. The editor will not be taking complaints from anyone who switches on at 16:30 on Sunday.")), []);
});

test("a reading order is refused", () => {
  assert.equal(about(on("Read The Ledger before the scores. The editor insists.")).length, 1);
});
