// The Crease's live key (/api/live/crease): lib/cricket.js does the work; this wraps it in the live layer's shape.
// Cricbuzz first; ESPN (ESPNcricinfo's data, lib/cricket-espn.js) when Cricbuzz fails (from 3 Oct 2026). ?via=espn
// asks for the backup alone, to check it.
import { getJSON, getText } from "./live.js";
import { crease } from "./cricket.js";
import { creaseEspn } from "./cricket-espn.js";

const done = (value, source) => ({ ok: true, value, source, as_of: new Date().toISOString(), stale: false });
export const CREASE = {
  async crease(params = new URLSearchParams()) {
    const errs = [];
    if (params.get?.("via") !== "espn") { try { return done(await crease(getText), "Cricbuzz"); } catch (e) { errs.push(String(e?.message || e)); } }
    try { return done(await creaseEspn(getJSON), "ESPNcricinfo"); } catch (e) { errs.push(String(e?.message || e)); }
    return { ok: false, value: null, source: null, as_of: null, stale: false, error: errs.join(" | ") };
  },
};
export const CREASE_CACHE = { crease: [600, 1800] };
