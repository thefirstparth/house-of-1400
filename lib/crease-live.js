// The Crease's live key (/api/live/crease): lib/cricket.js does the work; this wraps it in the live layer's shape.
import { getText } from "./live.js";
import { crease } from "./cricket.js";

export const CREASE = {
  async crease() {
    try { return { ok: true, value: await crease(getText), source: "Cricbuzz", as_of: new Date().toISOString(), stale: false }; }
    catch (e) { return { ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) }; }
  },
};
export const CREASE_CACHE = { crease: [600, 1800] };
