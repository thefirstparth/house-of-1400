import { CACHE as PAPER_CACHE, LIVE as PAPER } from "../../lib/live.js";
import { TRIAL, TRIAL_CACHE } from "../../lib/trial.js";
import { MONEY, MONEY_CACHE } from "../../lib/money.js";
import { CREASE, CREASE_CACHE } from "../../lib/crease-live.js";
import { FOOTBALL, FOOTBALL_CACHE } from "../../lib/football.js";
import { ODDS, ODDS_CACHE } from "../../lib/odds.js";
import { RAIN, RAIN_CACHE, rainTtl } from "../../lib/rain.js";
import { IMD, IMD_CACHE } from "../../lib/imd.js";

// The paper's keys, The Ledger's extra blocks (lib/money.js), Madridismo's competitions (lib/football.js), the odds on every followed match (lib/odds.js), Bengaluru's rain gauges (lib/rain.js) and the trial's keys (lib/trial.js).
const LIVE = { ...PAPER, ...MONEY, ...CREASE, ...FOOTBALL, ...ODDS, ...RAIN, ...IMD, ...TRIAL }, CACHE = { ...PAPER_CACHE, ...MONEY_CACHE, ...CREASE_CACHE, ...FOOTBALL_CACHE, ...ODDS_CACHE, ...RAIN_CACHE, ...IMD_CACHE, ...TRIAL_CACHE };

// GET /api/live/<key>. Returns {ok, value, source, as_of, stale}.
export async function GET(request) {
  const url = new URL(request.url);
  const key = url.pathname.split("/").filter(Boolean).pop();
  const fn = Object.hasOwn(LIVE, key) ? LIVE[key] : null;
  if (!fn) return Response.json({ ok: false, error: "unknown key", keys: Object.keys(LIVE) }, { status: 404 });
  let out;
  try { out = await fn(url.searchParams); }
  catch (e) { out = { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
  let [s, swr] = CACHE[key] || [300, 900];
  // No index trading anywhere: the market feed changes slowly (the rupee, oil, Bitcoin), so hold it for 30 minutes.
  if (key === "markets" && out.ok && !(out.value?.indices || []).some(i => i.live)) [s, swr] = [1800, 3600];
  // A match in play: The Crease's score is held for a minute, not ten (Parth, 1 Oct: "Live now" showed a stale score).
  if (key === "crease" && out.ok && [out.value?.next, ...(out.value?.main?.formats || []).flatMap(f => f.matches)].some(m => m?.state === "live")) [s, swr] = [60, 60];
  // Weather Union's gauges are read once a slot (every 30 minutes by day, 2 hours at night): held until the next slot
  if (key === "rain" && out.ok) { [s, swr] = [out.hold_s || rainTtl(), 60]; delete out.hold_s; }
  const personal = url.searchParams.has("lat");
  return Response.json(out, {
    headers: { "cache-control": out.ok && !personal ? `public, s-maxage=${s}, stale-while-revalidate=${swr}` : "no-store" },
  });
}
