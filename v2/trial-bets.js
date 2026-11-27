// ---------- (4) the betting cards, with a trend line and the headlines around a move (Parth, 27 Nov 2026) ----------
// From the Daily Index's "Straw Poll": "I like how it is showing a graph with the trend as well, how it is moving up and
// down", and "the graph as well as the why it moved section along with it. That is very, very useful."
// Every market card the trial draws (the Betting Window, Page One's "The market expects", the market's view in the
// sport desks) gains the favourite's line over the week, its change in 24 hours and a stacked bar of the outcomes;
// tapping a card opens the market's sheet with the front-runners over time (1D, 1W, 1M), the moves of 8 points or more
// numbered on the chart, the headlines published around each move, and the field. History comes from
// /api/live/look_bet_history (lib/look-bets.js, Polymarket's own price history). A market without history (Kalshi, a
// feed that did not answer) shows its card without a line; nothing is drawn from invented points. Forecasts stay in
// their dashed box, set apart from the facts.
const TB = { hist: {}, asked: "", at: 0, busy: false, range: "w" };
// the front-runners' colours, in fixed order (checked for colour-blind separation on the card colour #f2f0eb)
const TB_C = ["#2b5aa0", "#d36a2b", "#8e5bc4"];
const tbNorm = id => (!id ? null : String(id).includes(":") ? String(id) : `pm:${id}`);
const tbFromUrl = u => { const m = String(u || "").match(/polymarket\.com\/event\/([a-z0-9-]+)/); return m ? `pm:${m[1]}` : null; };
const tbVol = v => (!(v > 0) ? "" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const tbIST = (ms, o) => new Date(ms).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false, ...o }).replace(/\bSept\b/, "Sep");
const tbAgo = ms => { const h = (Date.now() - ms) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };
const tbW = v => Math.max(0, Math.min(100, v)).toFixed(1);

// ---------------------------------------------------------------- one market, from whichever feed has it
// The edition's own market (with its press-time prices) and the live prices where the live feed has it; else a live
// market; else a sport desk's market's view. Outcomes as the paper prints them: a yes/no as Yes, a date ladder in date
// order, anything else likeliest first; the headline figure is always the likeliest (a yes/no's is its Yes).
function tbMarket(rawId) {
  const id = tbNorm(rawId); if (!id) return null;
  const liveM = (!LIVE.betting?.stale && LIVE.betting?.value?.markets) || [];
  const b = (E?.betting || []).find(x => tbNorm(x.id) === id), L = liveM.find(m => m.id === id);
  let sig = null;
  if (!b && !L) for (const [k, g] of Object.entries(LIVE.signals?.value || {})) if (tbFromUrl(g?.url) === id) sig = { k, ...g };
  const src = b || L || sig; if (!src) return null;
  const got = ladder(((L?.outcomes?.length ? L.outcomes : src.outcomes) || []).filter(o => Number.isFinite(o?.prob)));
  if (!got.length) return null;
  const isLadder = got.length > 1 && got.every(o => /^(By|Through) /.test(o.name)), yesNo = got.length === 1;
  const outs = yesNo ? [{ name: got[0].name, prob: got[0].prob }] : isLadder ? got.slice(0, 3) : [...got].sort((x, y) => y.prob - x.prob).slice(0, 3);
  const fav = yesNo ? outs[0] : outs.reduce((x, y) => (y.prob > x.prob ? y : x));
  const rest = isLadder || yesNo ? 0 : Math.max(0, 100 - outs.reduce((a, o) => a + o.prob, 0));
  const press = b && L ? Object.fromEntries((b.outcomes || []).map(o => [o.name, o.prob])) : null;
  return { id, title: src.label || src.title || "", full: src.title || "", category: b?.category || L?.category || (sig ? "The market's view" : "Market"),
    url: src.url || "", source: src.source || "Polymarket", since: b?.since && b.since < E.date ? b.since : null,
    vol: L?.volume24h ? `${tbVol(L.volume24h)} in 24h` : sig?.volume ? `${tbVol(sig.volume)} traded` : "",
    outs, fav, rest, isLadder, yesNo, press, live: !!(L || sig), asof: L ? LIVE.betting?.as_of : sig ? LIVE.signals?.as_of : null };
}
const tbHist = id => TB.hist[tbNorm(id)] || null;
const tbHo = (H, name) => H?.outcomes?.find(o => o.name === name) || null;
// an outcome's colour follows the outcome: its place among the printed outcomes
const tbCol = (M, name) => { const i = M.outs.findIndex(o => o.name === name); return i >= 0 && i < 3 ? TB_C[i] : "var(--muted)"; };
const tbLabel = (M, o) => (M.yesNo ? "Yes" : outcomeLabel(o.name));

// ---------------------------------------------------------------- loading the history
// The markets on screen: Page One's picks, the sport desks' views, then the Betting Window's; Polymarket only, eight
// to a call, two calls at most, again every 15 minutes.
function tbWanted() {
  const ids = [];
  const add = id => { id = tbNorm(id); if (id && id.startsWith("pm:") && !ids.includes(id)) ids.push(id); };
  try { if (typeof betsPick === "function") betsPick(3).forEach(b => add(b.id)); } catch {}
  for (const g of Object.values(LIVE.signals?.value || {})) add(tbFromUrl(g?.url));
  const list = E?.betting?.length ? E.betting : LIVE.betting?.value?.markets || [];
  list.slice(0, CFG?.betting?.show || 10).forEach(b => add(b.id));
  return ids.slice(0, 16);
}
function tbLoad() {
  if (!E || ROUTE?.kind === "edition" || TB.busy) return;
  const ids = tbWanted(), key = ids.join(",");
  if (!ids.length || (key === TB.asked && Date.now() - TB.at < 15 * 6e4)) return;
  TB.busy = true; TB.asked = key; TB.at = Date.now();
  const chunks = [ids.slice(0, 8), ids.slice(8, 16)].filter(c => c.length);
  Promise.all(chunks.map(c => live("look_bet_history", `?ids=${encodeURIComponent(c.join(","))}`).catch(() => null)))
    .then(rs => { let n = 0; for (const r of rs) if (r && !r.stale && r.value?.markets) for (const [k, v] of Object.entries(r.value.markets)) { TB.hist[k] = v; n++; } if (n) paintSoon(); })
    .finally(() => { TB.busy = false; });
}

// ---------------------------------------------------------------- the small pieces
// The favourite's week as a line, scaled to its own range (never less than 8 points tall, so a flat market reads flat)
function tbSpark(H, M, cls = "") {
  const o = tbHo(H, M.fav.name), p = o?.w?.p; if (!p || p.length < 6) return "";
  const pts = [...p, o.now], lo0 = Math.min(...pts), hi0 = Math.max(...pts), pad = Math.max(0, 8 - (hi0 - lo0)) / 2, lo = lo0 - pad, hi = hi0 + pad;
  const y = v => (100 - ((v - lo) / (hi - lo || 1)) * 100).toFixed(1), n = pts.length - 1;
  const d = pts.map((v, i) => `${((i / n) * 100).toFixed(2)},${y(v)}`).join(" ");
  return `<span class="tb-sp ${cls}" style="--c:${tbCol(M, M.fav.name)}" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${d}" vector-effect="non-scaling-stroke"/></svg><i style="top:${y(o.now)}%"></i></span>`;
}
// the favourite's change over 24 hours (from the history), else since press time (from the edition)
function tbChange(H, M) {
  const o = tbHo(H, M.fav.name);
  if (o?.d24 != null && Math.abs(o.d24) >= 1) return { d: o.d24, txt: "in 24h" };
  const was = M.press?.[M.fav.name];
  if (was != null && Math.abs(M.fav.prob - was) >= (CFG.betting?.carry?.min_move_pts || 5)) return { d: M.fav.prob - was, txt: "since press" };
  return null;
}
const tbPts = d => (Math.abs(Math.round(d)) === 1 ? "pt" : "pts");
const tbChg = (c, short) => (c ? `<span class="tb-chg ${c.d > 0 ? "up" : "dn"}"><b>${c.d > 0 ? "▲" : "▼"}</b> ${Math.abs(Math.round(c.d))}${short ? "" : ` ${tbPts(c.d)}`}${short ? "" : ` <em>${c.txt}</em>`}</span>` : "");
function tbBar(M) {
  if (M.yesNo || M.isLadder) return `<span class="tb-bar" aria-hidden="true"><i style="width:${tbW(M.fav.prob)}%;background:${tbCol(M, M.fav.name)}"></i></span>`;
  return `<span class="tb-bar" aria-hidden="true">${M.outs.map(o => `<i style="width:${tbW(o.prob)}%;background:${tbCol(M, o.name)}"></i>`).join("")}</span>`;
}
const tbLegend = M => (M.yesNo ? "" : M.outs.filter(o => o !== M.fav).map(o => `<span><i style="background:${tbCol(M, o.name)}"></i><em>${esc(tbLabel(M, o))}</em><b class="tnum">${Math.round(o.prob)}%</b></span>`).join("") + (M.rest >= 1 ? `<span><i class="r"></i><em>Others</em><b class="tnum">${Math.round(M.rest)}%</b></span>` : ""));

// ---------------------------------------------------------------- the Betting Window, as cards
// The first card spans what is left of its row, so the grid ends on a full row at three columns and at two.
function tbBetting() {
  const liveM = LIVE.betting?.value?.markets || [];
  const list = (E.betting?.length ? E.betting : liveM).slice(0, CFG.betting.show || 10);
  const Ms = list.map(b => tbMarket(b.id)).filter(Boolean);
  if (!Ms.length) return "";
  const n = Ms.length, span = c => { const r = (n - 1) % c; return r === 0 ? c : c - r; };
  const cards = Ms.map((M, i) => {
    const H = tbHist(M.id), c = tbChange(H, M);
    const lead = i === 0 ? ` lead" style="--s3:${span(3)};--s2:${span(2)}` : "";
    return `<li class="tb-cell${lead}"><div class="tb-card" data-bet="${esc(M.id)}" tabindex="0" role="button" aria-label="${esc(M.full || M.title)}: the trend and the field">
<div class="tb-top"><span class="tb-cat">${esc(M.category)}</span>${tbChg(c)}</div>
<p class="tb-q">${esc(vsV(M.title).replace(/\.\.\.\?$/, "…?"))}</p>
<div class="tb-mid"><div class="tb-fig"><b class="tnum">${Math.round(M.fav.prob)}<small>%</small></b><span>${esc(tbLabel(M, M.fav))}</span></div>${tbSpark(H, M, i === 0 ? "big" : "")}</div>
${tbBar(M)}${tbLegend(M) ? `<p class="tb-leg">${tbLegend(M)}</p>` : ""}
<p class="tb-src">${esc(M.source)}${M.vol ? ` · ${esc(M.vol)}` : ""}${M.since ? ` · in the paper since ${esc(sparkLabel(M.since))}` : ""}</p></div></li>`;
  }).join("");
  const asof = LIVE.betting?.as_of ? `Prices ${LIVE.betting.stale ? "last read" : "updated"} ${esc(istFull(LIVE.betting.as_of))} IST` : "Prices at press time";
  return `<ol class="tb-grid" data-n="${n}">${cards}</ol><p class="asof tb-asof">${asof}. Tap a market for its trend and the field.</p>${aboutFig("Prices and their history from Polymarket. A price is what traders pay for a yes, read as the chance they give it. The headlines beside a move are the news published in the day and a half before it, shown for context: they are not given as its cause.")}`;
}
TRIAL_BLOCKS.betting = () => trialSafe("bets", tbBetting);

// ---------------------------------------------------------------- Page One and the sport desks: decorate in place
function tbPaint() {
  tbLoad();
  // Page One's "The market expects": the favourite's line and its change beside the name, the outcomes in one bar
  for (const btn of document.querySelectorAll(".p1 ol.bets button.bet[data-bet]")) {
    const M = tbMarket(btn.dataset.bet); if (!M) continue;
    const H = tbHist(M.id), c = tbChange(H, M), sig = `${M.id}|${M.fav.prob}|${M.outs.map(o => o.prob).join()}|${H ? H.outcomes[0]?.now : ""}`;
    if (btn.dataset.tb === sig) continue;
    btn.dataset.tb = sig; btn.classList.add("tb-p1");
    btn.innerHTML = `<span class="t">${esc(vsV(M.title).replace(/^UEFA /, ""))}</span><b class="tnum tb-pc">${Math.round(M.fav.prob)}%</b><span class="tb-nm">${esc(tbLabel(M, M.fav))}${tbChg(c, true)}</span>${tbSpark(H, M, "p1")}${tbBar(M)}`;
  }
  // the market's view in a sport desk: the line and the change, a button that opens the market
  for (const box of document.querySelectorAll(".signal")) {
    const id = tbFromUrl(box.querySelector("a.sg-src")?.getAttribute("href")), M = id && tbMarket(id);
    const H = M && tbHist(M.id), sig = M ? `${M.id}|${M.fav.prob}|${H ? H.outcomes[0]?.now : ""}` : "";
    const was = box.querySelector(":scope > .tb-sg");
    if ((was?.dataset.sig || "") === sig && (!M || was)) continue;
    was?.remove();
    if (!M) continue;
    const c = tbChange(H, M);
    box.querySelector(".sg-o")?.insertAdjacentHTML("afterend", `<button type="button" class="tb-sg" data-sig="${esc(sig)}" data-bet="${esc(M.id)}" aria-label="${esc(M.title)}: the trend and the field">${tbSpark(H, M) || ""}${tbChg(c) || (H ? "" : `<span class="tb-chg"><em>The field</em></span>`)}</button>`);
  }
}
TRIAL_PAINT.push(tbPaint);

// ---------------------------------------------------------------- the market, in detail
function tbSheet(id) {
  const M = tbMarket(id); if (!M) return false;
  const H = tbHist(M.id), ho = tbHo(H, M.fav.name);
  const ch = (d, t) => (d == null || Math.abs(d) < 1 ? "" : `<span class="tb-chg ${d > 0 ? "up" : "dn"}"><b>${d > 0 ? "▲" : "▼"}</b> ${Math.abs(Math.round(d))} <em>${t}</em></span>`);
  const hero = `<div class="tb-hero"><b class="tnum" style="color:${tbCol(M, M.fav.name)}">${Math.round(M.fav.prob)}%</b><div><span class="tb-hn">${esc(tbLabel(M, M.fav))}</span><span class="tb-hc">${ch(ho?.d24, "in 24h")}${ch(ho?.d7, "this week")}</span></div></div>`;
  const named = H ? M.outs.filter(o => tbHo(H, o.name)) : [];
  const chart = named.length ? `<div class="tb-chart"><div class="tb-ch-h"><span class="tb-lab">The front-runners over time</span><span class="tb-rng" role="group" aria-label="Time range">${[["d", "1D"], ["w", "1W"], ["m", "1M"]].map(([k, l]) => `<button type="button" data-tbr="${k}" aria-pressed="${TB.range === k}">${l}</button>`).join("")}</span></div>
<ul class="tb-key">${named.map(o => `<li><i style="background:${tbCol(M, o.name)}"></i>${esc(tbLabel(M, o))} <b class="tnum">${Math.round(o.prob)}%</b></li>`).join("")}</ul><div class="tb-plot" data-tbplot="${esc(M.id)}"></div></div>` : "";
  const moves = (H?.moves || []).filter(m => m.heads?.length);
  const why = moves.length ? `<div class="tb-why"><p class="tb-lab">Headlines around the move${moves.length > 1 ? "s" : ""}</p><ol>${[...moves].reverse().map(m => `<li><p class="tb-mv"><span class="tb-n" aria-label="Move ${m.n}">${m.n}</span><span>${esc(tbIST(m.at * 1000, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))} IST · ${esc(M.yesNo ? "Yes" : outcomeLabel(m.name))} <span class="tb-chg ${m.pts > 0 ? "up" : "dn"}"><b>${m.pts > 0 ? "▲" : "▼"}</b> ${Math.abs(m.pts)} ${tbPts(m.pts)}</span> within a day, ${Math.round(m.from)}% to ${Math.round(m.to)}%</span></p>
<ul>${m.heads.slice(0, moves.length > 1 ? 2 : 3).map(h => `<li><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a><small>${esc(h.source || "")}${h.source ? " · " : ""}${esc(tbAgo(h.at))}</small></li>`).join("")}</ul></li>`).join("")}</ol></div>` : "";
  const field = `<div class="tb-field"><p class="tb-lab">The field</p><ol class="vs-outs">${M.outs.map(o => {
    const p = M.press?.[o.name], d = p != null ? o.prob - p : 0, h = tbHo(H, o.name);
    const notes = [h?.d24 != null && Math.abs(h.d24) >= 1 ? `${h.d24 > 0 ? "▲" : "▼"} ${Math.abs(Math.round(h.d24))} in 24h` : "", Math.abs(d) >= 1 ? `${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d))} since press (${Math.round(p)}%)` : ""].filter(Boolean).join(" · ");
    return `<li><span class="n"><i style="background:${tbCol(M, o.name)}"></i>${esc(tbLabel(M, o))}</span><b class="tnum">${Math.round(o.prob)}%</b><span class="bar"><i style="width:${tbW(o.prob)}%;background:${tbCol(M, o.name)}"></i></span>${notes ? `<small class="tnum">${esc(notes)}</small>` : ""}</li>`; }).join("")}${M.rest >= 1 ? `<li><span class="n"><i class="r"></i>Others</span><b class="tnum">${Math.round(M.rest)}%</b><span class="bar"><i style="width:${tbW(M.rest)}%;background:var(--rule)"></i></span></li>` : ""}</ol></div>`;
  const meta = [M.vol, M.since ? `in the paper since ${sparkLabel(M.since)}` : "", M.live && M.asof ? `prices at ${istTime(M.asof)} IST` : !M.live ? "prices at press time" : ""].filter(Boolean).join(" · ");
  const panel = Sheet.open(`<p class="vs-k">${esc(M.category)} <span class="vs-fc">Forecast</span></p><h2 class="vs-h vs-t">${esc(vsV(M.full || M.title))}</h2>
<div class="tb-sheet">${hero}${chart}${why}${field}</div>
${meta ? `<p class="vs-meta">${esc(meta)}</p>` : ""}<p class="vs-note">A price is what traders pay for a yes, read as the chance they give it. It is a forecast, not a result.${why ? " The headlines are what was published in the day and a half before each move, for context, not given as its cause." : ""}</p>
${M.url ? `<a class="vs-pri vs-btn" href="${esc(M.url)}" target="_blank" rel="noopener">Open on ${esc(M.source)} ↗</a>` : ""}`, M.full || M.title);
  panel?.classList.add("tb-panel");
  const plot = panel?.querySelector(".tb-plot");
  if (plot) {
    const draw = () => tbDraw(plot, H, M, TB.range);
    requestAnimationFrame(draw);
    panel.querySelector(".tb-rng")?.addEventListener("click", e => { const b = e.target.closest("[data-tbr]"); if (!b) return; TB.range = b.dataset.tbr; for (const x of panel.querySelectorAll("[data-tbr]")) x.setAttribute("aria-pressed", String(x === b)); draw(); });
    if (window.ResizeObserver) { let w = 0; new ResizeObserver(() => { if (plot.isConnected && Math.abs(plot.clientWidth - w) > 4) { w = plot.clientWidth; draw(); } }).observe(plot); }
  }
  return true;
}

// The chart: one line per front-runner (the favourite on top), a light grid, each line's price as the paper prints it
// (the same figure as the card) at its end, the
// moves numbered where they happened, and a crosshair that reads every line at the pointer.
function tbDraw(el, H, M, range) {
  const W = Math.max(260, el.clientWidth || 600), Ht = W < 520 ? 190 : 230, L = 34, R = 44, T = 14, B = 26;
  const ser = M.outs.map(o => ({ o, h: tbHo(H, o.name) })).filter(x => x.h).map(({ o, h }) => {
    const s = range === "m" && h.m ? h.m : h.w, pts = s.p.map((p, i) => [s.t0 + i * s.dt, p]);
    if (h.t > pts.at(-1)[0]) pts.push([h.t, h.now]);
    const end = pts.at(-1)[0];
    return { o, h, pts: range === "d" ? pts.filter(([t]) => t >= end - 86400) : pts };
  }).filter(s => s.pts.length > 1);
  if (!ser.length) { el.innerHTML = ""; return; }
  const t0 = Math.min(...ser.map(s => s.pts[0][0])), t1 = Math.max(...ser.map(s => s.pts.at(-1)[0]));
  const all = ser.flatMap(s => s.pts.map(p => p[1]));
  let lo = Math.min(...all), hi = Math.max(...all); const pad = Math.max(2, (hi - lo) * 0.12); lo = Math.max(0, lo - pad); hi = Math.min(100, hi + pad);
  if (hi - lo < 10) { const m = (hi + lo) / 2; lo = Math.max(0, m - 5); hi = Math.min(100, lo + 10); lo = Math.max(0, hi - 10); }
  const x = t => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo || 1)) * (Ht - T - B);
  const step = [1, 2, 5, 10, 20, 25, 50].find(s => (hi - lo) / s <= 4) || 50, ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const xt = [], dayS = 86400, tick = range === "d" ? 6 * 3600 : range === "w" ? dayS : 7 * dayS;
  const off = 19800; // IST
  // as many date labels as fit: one every 64 pixels at the least
  const every = Math.max(1, Math.ceil(64 / ((tick / (t1 - t0 || 1)) * (W - L - R))));
  for (let t = Math.ceil((t0 + off) / tick) * tick - off, i = 0; t <= t1; t += tick, i++) if (i % every === 0) xt.push(t);
  const xl = t => tbIST(t * 1000, range === "d" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
  // the current price at each line's end, nudged apart so the labels never overlap
  const ends = ser.map(s => ({ s, v: s.pts.at(-1)[1], y: y(s.pts.at(-1)[1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  const path = s => s.pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marks = (H.moves || []).filter(m => m.at >= t0 && m.at <= t1).map(m => {
    const s = ser.find(s => s.o.name === m.name); if (!s) return "";
    // the marker sits halfway up the move, where it happened, whatever the chart's grain
    const cx = x(m.at), cy = y((m.from + m.to) / 2);
    return `<line class="tb-ml" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T}" y2="${Ht - B}"/><circle class="tb-mc" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9"/><text class="tb-mt" x="${cx.toFixed(1)}" y="${(cy + 3.6).toFixed(1)}">${m.n}</text>`;
  }).join("");
  el.innerHTML = `<svg width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(`${M.full || M.title}: ${ser.map(s => `${tbLabel(M, s.o)} ${Math.round(s.pts[0][1])}% to ${Math.round(s.pts.at(-1)[1])}%`).join("; ")}`)}">
${ticks.map(v => `<line class="tb-g" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tb-yl" x="${L - 6}" y="${(y(v) + 4).toFixed(1)}">${v}%</text>`).join("")}
${xt.map(t => `<text class="tb-xl" x="${x(t).toFixed(1)}" y="${Ht - 7}">${esc(xl(t))}</text>`).join("")}
${[...ser].reverse().map(s => `<path class="tb-ln" d="${path(s)}" stroke="${tbCol(M, s.o.name)}"/>`).join("")}
${marks}
${ends.map(e => `<circle class="tb-ed" cx="${x(e.s.pts.at(-1)[0]).toFixed(1)}" cy="${y(e.v).toFixed(1)}" r="3.5" fill="${tbCol(M, e.s.o.name)}"/><text class="tb-el" x="${W - R + 8}" y="${(e.y + 4).toFixed(1)}">${Math.round(e.s.o.prob)}%</text>`).join("")}
<line class="tb-xh" x1="0" x2="0" y1="${T}" y2="${Ht - B}" visibility="hidden"/><rect class="tb-hit" x="${L}" y="0" width="${W - L - R}" height="${Ht}"/></svg><div class="tb-tip" hidden></div>`;
  const svg = el.querySelector("svg"), xh = svg.querySelector(".tb-xh"), tip = el.querySelector(".tb-tip");
  const move = ev => {
    const r = svg.getBoundingClientRect(), px = ev.clientX - r.left, t = t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    if (px < L || px > W - R) return hide();
    const rows = ser.map(s => ({ s, p: s.pts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a)) }));
    const tx = x(rows[0].p[0]);
    xh.setAttribute("x1", tx); xh.setAttribute("x2", tx); xh.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${esc(tbIST(rows[0].p[0] * 1000, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</b>${rows.map(({ s, p }) => `<span><i style="background:${tbCol(M, s.o.name)}"></i>${esc(tbLabel(M, s.o))} <b class="tnum">${Math.round(p[1])}%</b></span>`).join("")}`;
    tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = `${Math.min(W - tw - 4, Math.max(4, tx + 10 + tw > W ? tx - tw - 10 : tx + 10))}px`;
  };
  const hide = () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", hide);
}

// A tap on any market (a card, Page One's list, a desk's market's view, "Since we printed") opens this sheet while the
// trial is on; it listens before the paper's own handler (v2/sheet.js) and leaves links alone.
function tbOpen(e) {
  if (!trialOn()) return;
  const el = e.target.closest?.("[data-bet]"); if (!el || e.target.closest("a")) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  if (!tbMarket(el.dataset.bet)) return;
  e.preventDefault(); e.stopPropagation();
  trialSafe("bets sheet", () => tbSheet(el.dataset.bet));
}
addEventListener("click", tbOpen, true);
addEventListener("keydown", tbOpen, true);
