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
