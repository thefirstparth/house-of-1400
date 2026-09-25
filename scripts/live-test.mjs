// Hit every live getter and assert shape, freshness and sane ranges. Exit 1 on failure.
import { LIVE } from "../lib/live.js";

const H = 36e5;
const checks = {
  weather: v => { const c = v.cities[0]; return c.name === "Bengaluru" && c.current.temp >= 5 && c.current.temp <= 45 && c.daily.length >= 7; },
  f1_next: v => v.season_over || (v.race && v.race.sessions.length >= 3),
  f1_standings: v => v.drivers.length >= 18 && v.drivers[0].points > 0,
  f1_last: v => v.results.length >= 10,
  football: v => (v.next.length || v.last) && (!v.next[0] || Date.parse(v.next[0].date) > Date.now() - 3 * H),
  laliga_table: v => v.rows.length === 20,
  nba: v => typeof v.in_season === "boolean",
  tennis: v => v.events.length >= 1,
  markets: v => { const s = v.indices.find(i => i.name === "Sensex"); return s && s.price > 40000 && s.price < 150000 && s.spark.every(Number.isFinite); },
  fx: v => v.price > 70 && v.price < 130,
  crypto: v => v.price > 5000,
  gold_in: v => v.per_10g_24k > 50000 && v.per_10g_24k < 400000,
  trends: v => (v.geos.IN || []).length >= 3,
  betting: v => v.markets.length >= 3,
};

let failed = 0;
for (const [k, fn] of Object.entries(LIVE)) {
  const t0 = Date.now();
  let r;
  try { r = await fn(new URLSearchParams()); } catch (e) { r = { ok: false, error: e.message }; }
  let pass = false, why = r.error || "";
  if (r.ok) {
    try { pass = !!checks[k]?.(r.value); if (!pass) why = "range or shape check failed"; } catch (e) { why = e.message; }
    if (pass && Date.now() - Date.parse(r.as_of) > 6 * H) { pass = false; why = "stale"; }
  }
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${k.padEnd(13)} ${String(Date.now() - t0).padStart(5)}ms ${r.source || ""} ${pass ? "" : why}`);
}
console.log(failed ? `\n${failed} live source(s) failing.` : "\nAll live sources healthy.");
process.exit(failed ? 1 : 0);
