import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "../api/notify.js";

const E = {
  date: "2026-10-12", edition_no: 18,
  glance: [{ section: "F1 · Max", line: "never used in the message" }],
  front: { lead: { id: "max", kicker: "F1 · Singapore GP", headline: "Max wins in Singapore" }, seconds: [{ id: "ind", kicker: "India · T20Is", headline: "India beat West Indies to lead 2–1" }], briefs: [] },
  sections: { namma: { briefs: [{ id: "bus", kicker: "Bengaluru · Buses", headline: "Live bus data for map apps" }] } },
  art_scores: [{ story_id: "max", importance: 3 }, { story_id: "ind", importance: 2 }, { story_id: "bus", importance: 1 }],
  chronology: { madrid: { next: { when_utc: "2026-10-14T19:00:00Z", label: "AS Roma" } }, f1: { next: { when_utc: "2026-10-25T20:00:00Z", label: "United States GP" } } },
  tennis: { players: [{ name: "Carlos Alcaraz", next_match: { text: "Third round v Zizou Bergs, today 15:30 IST.", when_utc: "2026-10-12T10:00:00Z" } }] },
  snapshot: { markets: { value: { indices: [{ name: "Nifty 50", price: 22365, change_pct: -0.69, session_date: "2026-10-12" }] } }, weather: { value: { cities: [{ name: "Bengaluru", current: { temp: 30 }, daily: [{ rain_prob: 27 }] }] } } },
};
const now = Date.parse("2026-10-12T09:15:00Z"), cfg = { follows: { football_club: { name: "Real Madrid" } } };

test("telegram: tagged headlines, money, what is coming up soon, weather and the link", () => {
  const t = summary(E, "https://x.app", "main", { cfg, now });
  assert.match(t, /<b>Max wins in Singapore<\/b>/);
  assert.match(t, /• India · T20Is: India beat West Indies/);
  assert.match(t, /• Bengaluru · Buses: Live bus data/, "padded to four headlines from the next most important");
  assert.doesNotMatch(t, /never used/, "the page's day-in-a-minute panel is not the message");
  assert.match(t, /Nifty 22,365 ▼0\.7%/);
  assert.match(t, /🎾 Alcaraz v Bergs, today 15:30/);
  assert.match(t, /⚽ Madrid v AS Roma, Thu 15 Oct 00:30/);
  assert.doesNotMatch(t, /United States GP/, "a race 13 days away is not 'up next'");
  assert.match(t, /Bengaluru 30° · rain 27%/);
});

test("telegram: missing data is left out and a retry says so", () => {
  const t = summary({ ...E, snapshot: {} }, "https://x.app", "retry1", { cfg, now });
  assert.doesNotMatch(t, /Nifty|Bengaluru \d+°/);
  assert.match(t, /⚠️ published by the 14:29 retry/);
});
