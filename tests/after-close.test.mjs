// After yesterday's paper (15 Oct 2026, after the LTCG miss): a big move between the last paper's 14:00 print and the
// close is a move the next paper prints with its reason (scripts/validate.mjs afterClose, config pool.after_close).
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterClose } from "../scripts/validate.mjs";

const C = { after_close: { from: "2026-10-15", indices: ["Sensex", "Nifty 50"], pct: 0.5 } };
const ed = (date, rows) => ({ date, snapshot: { markets: { value: { indices: rows } } } });
const row = (name, price, prev, session_date, live) => ({ name, price, prev, session_date, live });

test("13 Oct: the Sensex printed at +0.9% and closed +1.5%; the next paper owes the reason", () => {
  const was = ed("2026-10-13", [row("Sensex", 72565.76, 71924.68, "2026-10-13", true), row("Nifty 50", 22584.9, 22362.4, "2026-10-13", true)]);
  const now = ed("2026-10-14", [row("Sensex", 72861.84, 73033.78, "2026-10-14", true), row("Nifty 50", 22650, 22721.95, "2026-10-14", true)]);
  const m = afterClose(now, was, C);
  assert.deepEqual(m.map(x => x.name), ["Sensex", "Nifty 50"]);
  assert.equal(m[0].points, 468);
  assert.equal(m[0].pct, 0.64);
  assert.equal(m[0].day_pct, 1.54);
});

test("a quiet last hour, a paper printed after the close, or no new session owes nothing", () => {
  const quiet = afterClose(ed("d2", [row("Sensex", 1, 1001, "s2", true)]), ed("d1", [row("Sensex", 1000, 990, "s1", true)]), C);
  assert.equal(quiet.length, 0, "0.1% is not a move");
  const closed = afterClose(ed("d2", [row("Sensex", 1, 1100, "s2", true)]), ed("d1", [row("Sensex", 1000, 990, "s1", false)]), C);
  assert.equal(closed.length, 0, "a weekend paper printed the close itself");
  const same = afterClose(ed("d2", [row("Sensex", 1, 1100, "s1", false)]), ed("d1", [row("Sensex", 1000, 990, "s1", true)]), C);
  assert.equal(same.length, 0, "no session since the print");
  assert.equal(afterClose(ed("d2", []), null, C).length, 0);
});
