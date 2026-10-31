// Blob budget (31 Oct 2026): the podcast feed's freshness rule, the small state files' fallback, and that the podcast
// job keeps one index instead of reading every record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedTtl, feedAge } from "../api/podcast.js";
import { stateGet, stateSet, stateConfigured } from "../lib/state.js";

const at = (h, m) => Date.UTC(2026, 9, 31, h, m) - 5.5 * 36e5;
test("the feed: an hour at a time once today's episode is in it, otherwise as feedAge", () => {
  assert.equal(feedTtl('<enclosure url="https://h/listen/2026-10-31.mp3"/>', at(15, 0)), 3600);
  assert.equal(feedTtl('<enclosure url="https://h/listen/2026-10-31-v2.mp3"/>', at(15, 0)), 3600);
  assert.equal(feedTtl('<enclosure url="https://h/listen/2026-10-30.mp3"/>', at(14, 0)), 300);
  assert.equal(feedTtl('<enclosure url="https://h/listen/2026-10-30.mp3"/>', at(9, 0)), feedAge(at(9, 0)));
});
test("state files: with no Redis and no Blob, nothing is read or written and nothing throws", async () => {
  for (const k of Object.keys(process.env)) if (/KV|REDIS|UPSTASH|BLOB/.test(k)) delete process.env[k];
  assert.equal(stateConfigured(), false);
  assert.equal(await stateGet("x", "notify/x.json"), null);
  assert.equal(await stateSet("x", "notify/x.json", { a: 1 }), false);
});
test("the podcast job: one index read, no list per run, no record-by-record rebuild once the index exists", () => {
  const s = readFileSync(new URL("../scripts/podcast/make.mjs", import.meta.url), "utf8");
  assert.match(s, /const INDEX = `\$\{folder\}\/episodes\.json`/);
  assert.match(s, /const idx = await readIndex\(get\)/);
  assert.match(s, /publishFeed\(\{ put, list, del, get \}, meta\)/);
});
test("notify, the TV feed and the gold history keep their state through lib/state.js, not Blob lists", () => {
  for (const f of ["api/notify.js", "lib/tv.js"]) assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /\blist\(\{ prefix: `notify/);
  assert.match(readFileSync(new URL("../lib/live.js", import.meta.url), "utf8"), /stateGet\("gold-history", GOLD_FILE\)/);
});
