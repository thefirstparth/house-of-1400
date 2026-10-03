// The Crease's backup (Parth, 3 Oct: "ESPN Cricket, we should use it as backup"): ESPN's cricket API, which carries
// ESPNcricinfo's data, keyless. Used only when Cricbuzz fails. The header lists the series India is in now; each
// series' scoreboard, a day at a time, gives its matches (result, score, venue). They become the same match objects as
// lib/cricket.js toMatch, so The Crease draws them the same way. No knockout table and no next tour from this source.
import { creaseView } from "./cricket.js";

const HEADER = "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=cricket&lang=en&region=in";
const BOARD = (league, d) => `https://site.api.espn.com/apis/site/v2/sports/cricket/${league}/scoreboard?dates=${d}`;
const isIndia = c => /^India$/i.test(c?.team?.displayName || c?.displayName || c?.name || "");
const FORMAT = d => (/\bTest\b/i.test(d) ? "TEST" : /\bT20/i.test(d) ? "T20" : /\bODI\b/i.test(d) ? "ODI" : null);

// "406/2 (43.3/50 ov, target 406)" -> "406/2 (43.3 ov)"
const tidy = s => String(s || "").replace(/\((\d+(?:\.\d)?)\/\d+ ov[^)]*\)/, "($1 ov)").replace(/\s*\(target[^)]*\)/, "").trim();
export function espnMatch(e, series) {
  const c = e.competitions?.[0] || {}, cs = c.competitors || [], us = cs.find(isIndia), them = cs.find(x => !isIndia(x));
  if (!us) return null;
  const st = c.status?.type?.state, state = st === "post" ? "done" : st === "in" ? "live" : "next", desc = c.description || e.shortName || "";
  const format = FORMAT(`${desc} ${series}`) || "T20", n = Number(desc.match(/^(\d+)(?:st|nd|rd|th)\s/)?.[1]) || null;
  const status = state === "next" ? null : String(c.status?.summary || c.status?.type?.detail || "").replace(/\s*\(\d+b rem\)/, "").trim();
  const score = state === "next" ? null : cs.filter(x => x.score).map(x => `${x.team?.abbreviation || x.team?.displayName} ${tidy(x.score)}`).join(" · ") || null;
  return { id: `espn${e.id}`, series, series_id: null, format, desc, n, opponent: them?.team?.displayName || "TBC", start: new Date(Date.parse(e.date)).toISOString(),
    time_announced: true, city: c.venue?.address?.city || null, ground: c.venue?.fullName || null, state, status,
    won: state === "done" ? (String(us.winner) === "true" ? true : String(them?.winner) === "true" ? false : null) : null, score };
}
export async function creaseEspn(getJSON, now = Date.now()) {
  const h = await getJSON(HEADER, { timeout: 10000 });
  const leagues = (h.sports?.[0]?.leagues || []).filter(l => (l.events || []).some(e => (e.competitors || []).some(isIndia)));
  if (!leagues.length) throw new Error("espn cricket: India in no current series");
  const days = [...Array(22)].map((_, i) => new Date(now + (i - 8) * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10).replace(/-/g, ""));
  const lists = await Promise.all(leagues.flatMap(l => days.map(d => getJSON(BOARD(l.id, d), { timeout: 8000 })
    .then(j => (j.events || []).map(e => espnMatch(e, String(l.name || "").replace(/\s+\d{4}(\/\d{2})?$/, ""))).filter(Boolean)).catch(() => []))));
  const matches = lists.flat();
  if (!matches.length) throw new Error("espn cricket: no India matches");
  const v = creaseView(matches, now);
  if (!v.next && !v.main) throw new Error("espn cricket: nothing current");
  return v;
}
