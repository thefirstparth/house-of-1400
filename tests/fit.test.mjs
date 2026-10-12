// Page One fits one screen on Parth's MacBook Air, with the heaviest paper the rules allow (scripts/fit-check.mjs).
// Builds dist/ first. Skipped where no Chromium is installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fitCheck, CHROMIUM } from "../scripts/fit-check.mjs";

test("Page One: no scroll, all 11 day-in-a-minute lines, readable type, at MacBook Air 13 and 15 sizes", { skip: !existsSync(CHROMIUM) && "no Chromium here", timeout: 240000 }, async () => {
  const b = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(b.status, 0, `build failed: ${b.stderr}`);
  const fails = await fitCheck({ log: () => {} });
  assert.deepEqual(fails, [], `Page One does not fit:\n${fails.join("\n")}`);
});
