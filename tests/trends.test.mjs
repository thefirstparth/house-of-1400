import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrendingItem, trafficLabel } from "../lib/live.js";

test("trafficLabel: Google's buckets", () => {
  assert.equal(trafficLabel(100000), "100K+"); assert.equal(trafficLabel(2000000), "2M+"); assert.equal(trafficLabel(500), "500+");
});
test("parseTrendingItem: term, volume, start, related searches, news keys", () => {
  const it = ["sri lanka vs bangladesh", null, "IN", [1790985000], null, null, 100000, null, 1000, ["sri lanka vs bangladesh", "sl vs ban"], [17], [[1, "en", "IN"]], "sri lanka vs bangladesh"];
  const t = parseTrendingItem(it);
  assert.equal(t.term, "sri lanka vs bangladesh"); assert.equal(t.volume, 100000); assert.equal(t.traffic, "100K+");
  assert.equal(t.started, "2026-10-02T23:50:00.000Z"); assert.deepEqual(t.related, ["sl vs ban"]); assert.equal(t.keys.length, 1);
  assert.equal(parseTrendingItem(["", 1]), null);
});
