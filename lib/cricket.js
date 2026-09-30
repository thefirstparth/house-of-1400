// The Crease's series summary, from the India schedule scripts/cricket-times.mjs reads from Cricbuzz.

// India's series in order: each with its formats, how many matches (the highest "Nth" still to come is the last one)
// and how many are already played (the lowest still to come, less one). A series is "now" if a match in it is within
// the next 10 days or it has matches played; the first series that is not is the next one.
export function seriesOf(matches, now = Date.now()) {
  const by = new Map();
  for (const m of matches) {
    if (!by.has(m.series)) by.set(m.series, { name: m.series, opponent: m.opponent, first: m.start, formats: new Map() });
    const s = by.get(m.series), n = Number((m.desc || "").match(/^(\d+)(?:st|nd|rd|th)\s+(?:ODI|T20I?|Test)\b/i)?.[1]) || null;
    const f = s.formats.get(m.format) || { format: m.format, lo: null, hi: null };
    if (n) { f.lo = f.lo == null ? n : Math.min(f.lo, n); f.hi = Math.max(f.hi ?? 0, n); }
    s.formats.set(m.format, f);
  }
  const soon = now + 10 * 864e5;
  const list = [...by.values()].map(s => {
    const parts = [...s.formats.values()].map(f => ({ format: f.format, total: f.hi, played: f.lo ? f.lo - 1 : null }));
    return { name: s.name, opponent: s.opponent, from: s.first.slice(0, 10), parts, now: Date.parse(s.first) < soon || parts.some(p => p.played > 0) };
  });
  const next = list.findIndex(s => !s.now);
  return list.filter((s, i) => s.now || i === next);
}

// Cricbuzz's team pages embed each match as a matchInfo object in their Next.js payload; this pulls them out.
export function parseCricbuzz(html) {
  const flat = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(m => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).join("");
  const out = [], seen = new Set();
  for (const m of flat.matchAll(/"matchInfo":\{/g)) {
    let depth = 0, i = m.index + 12, j = i;
    for (; j < flat.length; j++) { const ch = flat[j]; if (ch === "{") depth++; else if (ch === "}") { depth--; if (!depth) break; } else if (ch === '"') { for (j++; j < flat.length && flat[j] !== '"'; j++) if (flat[j] === "\\") j++; } }
    try { const o = JSON.parse(flat.slice(i, j + 1)); if (o.matchId && !seen.has(o.matchId)) { seen.add(o.matchId); out.push(o); } } catch {}
  }
  return out;
}

// ---------------------------------------------------------------- The Crease, live (from 1 Oct 2026)
// India's schedule and results from Cricbuzz's team pages, grouped the way a reader thinks about them: the next match,
// the series under way with every match in it (result or date), the score in that series, anything else India is
// playing in the next ten days (a multi-sport games, say), and the next tour after that.
const TEAM = 2, CB = "https://www.cricbuzz.com/cricket-team/india/2";
const DAY = 864e5;
export function toMatch(o) {
  const us = o.team1?.teamId === TEAM ? o.team1 : o.team2, them = o.team1?.teamId === TEAM ? o.team2 : o.team1;
  const state = /complete/i.test(o.state) ? "done" : /preview|upcoming|toss/i.test(o.state || "") || !o.state ? "next" : "live";
  const status = String(o.status || "").replace(/\s+-\s+/g, " · ").trim();
  const won = state === "done" ? (new RegExp(`^${(us?.teamName || "India").replace(/\W/g, ".")}\\s+won`, "i").test(status) ? true : /\swon\s/i.test(status) ? false : null) : null;
  const n = Number((o.matchDesc || "").match(/^(\d+)(?:st|nd|rd|th)\s/)?.[1]) || null;
  return { id: o.matchId, series: o.seriesName, format: o.matchFormat, desc: o.matchDesc, n, opponent: them?.teamName || "TBC", start: new Date(Number(o.startDate)).toISOString(),
    time_announced: o.isTimeAnnounced !== false, city: o.venueInfo?.city || null, ground: o.venueInfo?.ground || null, state, status: state === "next" ? null : status, won };
}
const plural = { ODI: "ODIs", T20: "T20Is", TEST: "Tests" };
export function creaseView(matches, now = Date.now()) {
  const ms = [...new Map(matches.map(m => [m.id, m])).values()].sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = ms.filter(m => m.state !== "done" && Date.parse(m.start) > now - 12 * 36e5);
  const next = ms.find(m => m.state === "live") || upcoming[0] || null;
  const by = new Map();
  for (const m of ms) { if (!by.has(m.series)) by.set(m.series, []); by.get(m.series).push(m); }
  const series = [...by.entries()].map(([name, list]) => {
    const formats = [...new Set(list.map(m => m.format))].map(f => {
      const fm = list.filter(m => m.format === f), done = fm.filter(m => m.state === "done");
      // A bilateral series (every match numbered, one opponent) has a score and a length; a tournament has neither.
      const bilateral = fm.every(m => m.n) && new Set(fm.map(m => m.opponent)).size === 1;
      const w = done.filter(m => m.won === true).length, l = done.filter(m => m.won === false).length, total = bilateral ? Math.max(...fm.map(m => m.n)) : null;
      const opp = fm[0].opponent, left = fm.some(m => m.state !== "done");
      const score = !bilateral || !done.length ? null : w === l ? `${left ? "Level" : "Drawn"} ${w}–${l}` : `${w > l ? "India" : opp} ${left ? "lead" : "won"} ${Math.max(w, l)}–${Math.min(w, l)}`;
      return { format: f, label: plural[f] || f, total, score, matches: fm };
    });
    const first = Date.parse(list[0].start), last = Date.parse(list.at(-1).start);
    return { name, opponent: list[0].opponent, first: list[0].start, last: list.at(-1).start, formats,
      now: list.some(m => m.state === "live") || (first <= now + 10 * DAY && last >= now - 5 * DAY) };
  });
  const current = series.filter(s => s.now).sort((a, b) => (a.name === next?.series ? -1 : b.name === next?.series ? 1 : a.first.localeCompare(b.first)));
  const after = series.filter(s => !s.now && Date.parse(s.first) > now).sort((a, b) => a.first.localeCompare(b.first))[0] || null;
  return { next, main: current[0] || null, also: current.slice(1), after };
}
export async function crease(getText) {
  const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
  const [sch, res] = await Promise.allSettled([getText(`${CB}/schedule`, { timeout: 12000, headers: UA }), getText(`${CB}/results`, { timeout: 12000, headers: UA })]);
  const raw = [...(sch.status === "fulfilled" ? parseCricbuzz(sch.value) : []), ...(res.status === "fulfilled" ? parseCricbuzz(res.value) : [])]
    .filter(o => o.team1?.teamId === TEAM || o.team2?.teamId === TEAM);
  if (!raw.length) throw new Error(`crease: Cricbuzz gave no India matches (${[sch, res].map(r => r.status === "rejected" ? String(r.reason?.message || r.reason).slice(0, 60) : "ok").join(", ")})`);
  const v = creaseView(raw.map(toMatch));
  if (!v.next && !v.main) throw new Error("crease: nothing current");
  return v;
}
