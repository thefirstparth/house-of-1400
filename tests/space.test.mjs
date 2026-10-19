// No story leaves a wide empty space beside it, with or without its drawing (scripts/space-check.mjs).
// Builds dist/ first. Skipped where no Chromium is installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { spaceCheck } from "../scripts/space-check.mjs";
import { CHROMIUM } from "../scripts/fit-check.mjs";

test("every desk of the last editions: no story's text ends a third of its width short, with drawings and without", { skip: !existsSync(CHROMIUM) && "no Chromium here", timeout: 600000 }, async () => {
  const b = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(b.status, 0, `build failed: ${b.stderr}`);
  const fails = await spaceCheck({ log: () => {} });
  assert.deepEqual(fails, [], `White space beside a story:\n${fails.join("\n")}`);
});
