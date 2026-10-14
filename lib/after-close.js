// No imports: the podcast job (scripts/podcast/make.mjs) uses this without the validator's packages.
// After yesterday's paper (15 Oct, after the LTCG miss): the paper prints the markets at 14:00 and the market closes
// at 15:30, so the last hour and a half of every session falls between two papers. On 13 Oct Sitharaman spoke at about
// 14:20, the Sensex went from +0.9% at the print to +1.5% at the close, its best day in four months, and the next
// paper only had the next day's trading. Each index named in config pool.after_close whose close moved at least `pct`
// percent from the price the last paper printed (that paper's own session, still open at the print) is a move the
// paper owes a reason for. Returns [{name, printed, close, points, pct, day_pct, session}].
export function afterClose(E, PE, cfg = {}) {
  const A = cfg.after_close || {}, out = [];
  const idx = X => new Map((X?.snapshot?.markets?.value?.indices || []).map(i => [i.name, i]));
  const now = idx(E), was = idx(PE);
  for (const name of A.indices || []) {
    const t = now.get(name), y = was.get(name);
    if (!t || !y || !y.live || !(t.session_date > y.session_date) || !(t.prev > 0) || !(y.price > 0)) continue;
    const pct = (t.prev / y.price - 1) * 100;
    if (Math.abs(pct) < (A.pct ?? 0.5)) continue;
    out.push({ name, printed: y.price, close: t.prev, points: Math.round(t.prev - y.price), pct: +pct.toFixed(2), day_pct: y.prev > 0 ? +((t.prev / y.prev - 1) * 100).toFixed(2) : null, session: y.session_date });
  }
  return out;
}
