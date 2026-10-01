// Back Home (from the 2 Oct 2026 edition, Parth): Ranchi and Prayagraj news in its own section, on the News desk
// after Namma Beat; the local searches answer only their top 3 in the desk check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateEdition } from "../scripts/validate.mjs";
import { topStories } from "../lib/trial.js";

const cfg = JSON.parse(readFileSync(new URL("../config/house.json", import.meta.url), "utf8"));
const base = JSON.parse(readFileSync(new URL("../content/editions/2026-10-01.json", import.meta.url), "utf8"));

test("Back Home is a section on the News desk, after Namma Beat", () => {
  assert.equal(cfg.sections.find(s => s.id === "back")?.name, "Back Home");
  const news = cfg.desks.find(d => d.id === "news").sections;
  assert.equal(news.indexOf("back"), news.indexOf("namma") + 1);
});

test("a brief filed to Back Home passes the schema", () => {
  const E = structuredClone(base);
  const any = Object.values(E.sections).flatMap(S => S.briefs || [])[0];
  E.sections.back = { briefs: [{ ...structuredClone(any), id: "ranchi-water-cut", thread_id: "ranchi-water-cut", section: "back", kicker: "Ranchi · Civic", headline: "Water cut in Doranda on Saturday" }] };
  const errs = validateEdition(E).errors.filter(e => /back|section/i.test(e));
  assert.deepEqual(errs, []);
});

test("the local searches are read 3 deep in the desk check, other feeds 5", () => {
  const items = feed => [0, 1, 2, 3, 4].map(position => ({ feed, kind: "search", position, outlet: "X", title: `${feed} story number ${["one", "two", "three", "four", "five"][position]} today` }));
  const top = topStories({ items: [...items("gn-ranchi"), ...items("gn-prayagraj"), ...items("gn-blr-civic")] }, cfg);
  assert.equal(top.filter(t => t.feed === "gn-ranchi").length, 3);
  assert.equal(top.filter(t => t.feed === "gn-prayagraj").length, 3);
  assert.equal(top.filter(t => t.feed === "gn-blr-civic").length, 5);
  assert.ok(top.filter(t => t.feed === "gn-ranchi").every(t => t.section === "back"));
});
