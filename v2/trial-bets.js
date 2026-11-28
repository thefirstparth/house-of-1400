// ---------- (4) the betting cards, with a trend line and why it moved (Parth, 27 Nov 2026) ----------
// From the Daily Index's "Straw Poll": "I like how it is showing a graph with the trend as well, how it is moving up and
// down", and "the graph as well as the why it moved section along with it. That is very, very useful."
// The Betting Window leads with the week's story: the market with the biggest move (or the one that just settled),
// drawn on its card as every front-runner's line with the move numbered, and the headlines published around it under
// "Why it moved". The other markets are cards with the favourite's week as a small line, its change in 24 hours and
// the field as one bar (on a phone, after the first three, slim rows). Page One's "The market expects" and the sport
// desks' market's view get the same line. Tapping any market opens its sheet: the front-runners over 1D, 1W, 1M and
// All, the moves numbered, the headlines around each (or, on a quiet week, what the news says), the field with where
// each stood a day ago, when it settles, the money and how it is decided.
// History comes from /api/live/look_bet_history (lib/look-bets.js: Polymarket's CLOB price history, Google News). A
// market without history shows its card without a line; a market whose live price did not answer shows its press-time
// price and says so; a market Polymarket has settled shows the result, never its last price. Nothing is drawn from
// invented points. Forecasts stay in their dashed box, set apart from the facts.
const TB = { hist: {}, all: {}, asked: "", at: 0, busy: false, range: "w", gid: 0 };
// the front-runners' colours, in fixed order (checked for colour-blind separation on the card colour #f2f0eb)
const TB_C = ["#2b5aa0", "#d36a2b", "#8e5bc4"];
const tbNorm = id => (!id ? null : String(id).includes(":") ? String(id) : `pm:${id}`);
const tbFromUrl = u => { const m = String(u || "").match(/polymarket\.com\/event\/([a-z0-9-]+)/); return m ? `pm:${m[1]}` : null; };
const tbVol = v => (!(v > 0) ? "" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const tbIST = (ms, o) => new Date(ms).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false, ...o }).replace(/\bSept\b/, "Sep");
const tbAgo = ms => { const h = (Date.now() - ms) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };
const tbW = v => Math.max(0, Math.min(100, v)).toFixed(1);
// a chance as the paper prints it: under half a point is "<1%", never a bare 0%
const tbPc = p => (p > 0 && p < 0.5 ? "<1%" : `${Math.round(p)}%`);
const tbMkt = () => `<span class="tb-mk">${typeof trialLogo === "function" ? trialLogo("https://polymarket.com/", "Polymarket") : ""}Polymarket</span>`;

// ---------------------------------------------------------------- one market, from whichever feed has it
// The edition's own market (with its press-time prices) and the live prices where the live feed has them; else a live
// market; else a sport desk's market's view. Outcomes as the paper prints them: a yes/no as Yes, a date ladder in date
// order, anything else likeliest first; the headline figure is always the likeliest (a yes/no's is its Yes).
function tbMarket(rawId) {
  const id = tbNorm(rawId); if (!id) return null;
  const liveM = (!LIVE.betting?.stale && LIVE.betting?.value?.markets) || [];
  const b = (E?.betting || []).find(x => tbNorm(x.id) === id), L = liveM.find(m => m.id === id);
  let sig = null;
  if (!b && !L) for (const [k, g] of Object.entries(LIVE.signals?.value || {})) if (tbFromUrl(g?.url) === id) sig = { k, ...g };
  const src = b || L || sig; if (!src) return null;
  // the live feed can know a market and still give no price (a book that has gone one-sided while it settles)
  const liveOuts = L?.outcomes?.length ? L.outcomes : null;
  const got = ladder(((liveOuts || src.outcomes) || []).filter(o => Number.isFinite(o?.prob)));
  const H = TB.hist[id] || null, settled = H?.settled?.winner ? H.settled : null;
  if (!got.length && !settled) return null;
  const isLadder = got.length > 1 && got.every(o => /^(By|Through) /.test(o.name)), yesNo = got.length === 1;
  const outs = yesNo ? [{ name: got[0].name, prob: got[0].prob }] : isLadder ? got.slice(0, 3) : [...got].sort((x, y) => y.prob - x.prob).slice(0, 3);
  const fav = outs.length ? (yesNo ? outs[0] : outs.reduce((x, y) => (y.prob > x.prob ? y : x))) : { name: settled.winner, prob: 100 };
  const rest = isLadder || yesNo ? 0 : Math.max(0, 100 - outs.reduce((a, o) => a + o.prob, 0));
  const press = b && liveOuts ? Object.fromEntries((b.outcomes || []).map(o => [o.name, o.prob])) : null;
  const live = !!(liveOuts || sig);
  return { id, title: src.label || src.title || "", full: src.title || "", category: b?.category || L?.category || (sig ? "The market's view" : "Market"),
    url: src.url || "", source: src.source || "Polymarket", since: b?.since && b.since < E.date ? b.since : null,
    vol: L?.volume24h ? `${tbVol(L.volume24h)} in 24h` : sig?.volume ? `${tbVol(sig.volume)} traded` : "",
    outs, fav, rest, isLadder, yesNo, press, live, settled, asof: L && liveOuts ? LIVE.betting?.as_of : sig ? LIVE.signals?.as_of : null };
}
const tbHist = id => TB.hist[tbNorm(id)] || null;
const tbHo = (H, name) => H?.outcomes?.find(o => o.name === name) || null;
// an outcome's colour follows the outcome: its place among the printed outcomes (a settled market's, among its lines)
const tbCol = (M, name) => { const list = M.outs.length ? M.outs : tbHist(M.id)?.outcomes || []; const i = list.findIndex(o => o.name === name); return i >= 0 && i < 3 ? TB_C[i] : "var(--muted)"; };
const tbLabel = (M, o) => (M.yesNo ? "Yes" : outcomeLabel(o.name));
const tbWinner = M => (M.settled ? (/^(yes|no)$/i.test(M.settled.winner) ? `Resolved ${M.settled.winner}` : outcomeLabel(M.settled.winner)) : "");
const tbDay = s => (s ? tbIST(s, { day: "numeric", month: "short" }) : "");

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
// The favourite's week as a line (a settled market's: the winner's), a point every three hours so a thin hour does
// not read as a jolt, never less than ten points tall so a flat week reads flat, a fill that fades out, a dotted line
// at where the week began and a dot on now. Drawn only beside a live price (or a result): a press-time figure beside
// a line that ends somewhere else would contradict itself.
function tbSpark(H, M, cls = "") {
  if (!M.live && !M.settled) return "";
  const o = tbHo(H, M.settled ? M.settled.winner : M.fav.name), w = o?.w?.p; if (!w || w.length < 6) return "";
  const p = w.filter((_, i) => (w.length - 1 - i) % 3 === 0), pts = [...p, o.now];
  const lo0 = Math.min(...pts), hi0 = Math.max(...pts), pad = Math.max(0, 10 - (hi0 - lo0)) / 2;
  let lo = lo0 - pad, hi = hi0 + pad; if (lo < 0) { hi -= lo; lo = 0; } if (hi > 100) { lo -= hi - 100; hi = 100; }
  const y = v => (6 + (1 - (v - lo) / (hi - lo || 1)) * 88).toFixed(1), n = pts.length - 1, x = i => ((i / n) * 100).toFixed(2);
  const d = pts.map((v, i) => `${x(i)},${y(v)}`).join(" "), g = `tbg${++TB.gid}`, c = tbCol(M, o.name);
  return `<span class="tb-sp ${cls}" style="--c:${c}" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="${g}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".2"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><polygon points="0,100 ${d} 100,100" fill="url(#${g})"/><line class="b" x1="0" x2="100" y1="${y(pts[0])}" y2="${y(pts[0])}" vector-effect="non-scaling-stroke"/><polyline points="${d}" vector-effect="non-scaling-stroke"/></svg><i style="top:${y(o.now)}%"></i></span>`;
}
// the favourite's change over 24 hours (from the history), else since press time (from the edition)
function tbChange(H, M) {
  if (M.settled) return null;
  const o = M.live ? tbHo(H, M.fav.name) : null;
  if (o?.d24 != null && Math.abs(o.d24) >= 1) return { d: o.d24, txt: "in 24h" };
  const was = M.press?.[M.fav.name];
  if (was != null && Math.abs(M.fav.prob - was) >= (CFG.betting?.carry?.min_move_pts || 5)) return { d: M.fav.prob - was, txt: "since press" };
  return null;
}
const tbPts = d => (Math.abs(Math.round(d)) === 1 ? "pt" : "pts");
const tbChg = (c, short) => (c ? `<span class="tb-chg ${c.d > 0 ? "up" : "dn"}"><b>${c.d > 0 ? "▲" : "▼"}</b> ${Math.abs(Math.round(c.d))}${short ? "" : ` ${tbPts(c.d)}`}${short ? "" : ` <em>${c.txt}</em>`}</span>` : "");
function tbBar(M) {
  if (M.settled) return "";
  if (M.yesNo || M.isLadder) return `<span class="tb-bar" aria-hidden="true"><i style="width:${tbW(M.fav.prob)}%;background:${tbCol(M, M.fav.name)}"></i></span>`;
  return `<span class="tb-bar" aria-hidden="true">${M.outs.map(o => `<i style="width:${tbW(o.prob)}%;background:${tbCol(M, o.name)}"></i>`).join("")}</span>`;
}
// the runners-up beside the favourite: a runner under 1% is left out of the card (the sheet lists it)
const tbLegend = M => (M.yesNo || M.settled ? "" : M.outs.filter(o => o !== M.fav && o.prob >= 1).map(o => `<span><i style="background:${tbCol(M, o.name)}"></i><em>${esc(tbLabel(M, o))}</em><b class="tnum">${Math.round(o.prob)}%</b></span>`).join("") + (M.rest >= 1 ? `<span class="rest"><i class="r"></i><em>Others</em><b class="tnum">${Math.round(M.rest)}%</b></span>` : ""));
// the big figure and its name, or the result
const tbFig = M => (M.settled
  ? `<div class="tb-fig won"><b>${esc(tbWinner(M))}</b><span>${/^Resolved /.test(tbWinner(M)) ? "" : "Won · "}settled${M.settled.at ? ` ${esc(tbDay(M.settled.at))}` : ""}</span></div>`
  : `<div class="tb-fig"><b class="tnum">${tbPc(M.fav.prob).replace("%", "<small>%</small>")}</b><span>${esc(tbLabel(M, M.fav))}</span></div>`);
const tbSrc = M => `<p class="tb-src">${tbMkt()}${M.vol && M.live ? ` · ${esc(M.vol)}` : ""}${!M.live && !M.settled ? " · price at press time" : ""}${M.since ? ` · in the paper since ${esc(sparkLabel(M.since))}` : ""}</p>`;
const tbQ = M => esc(vsV(M.title).replace(/\.\.\.\?$/, "…?"));

// ---------------------------------------------------------------- the week's story: which market leads, and why
// The market that settled this week with a move behind it, else the biggest move (8 points or more within a day) that
// has headlines around it, else the biggest move; on a quiet week the edition's own first market.
function tbStory(M) {
  const H = tbHist(M.id); if (!H?.outcomes?.length) return null;
  const mv = (H.moves || []).filter(m => m.heads?.length).sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))[0] || null;
  const big = [...(H.moves || [])].sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))[0] || null;
  return { H, mv, score: (M.settled && big ? 1000 : 0) + (mv ? 100 + Math.abs(mv.pts) : big ? Math.abs(big.pts) : 0) };
}
function tbKicker(M, st) {
  if (M.settled) return `Settled${M.settled.at ? ` ${tbDay(M.settled.at)}` : ""}`;
  const m = st?.mv || (st?.H?.moves || [])[0];
  return m ? `Biggest move this week: ${m.pts > 0 ? "up" : "down"} ${Math.abs(m.pts)} ${tbPts(m.pts)}` : M.category;
}
// a move's line: its number, when, who, how far
// A move's time: the history is hourly, so the steepest step happened in the hour before its grid point; the paper says
// "around" the middle of that hour, and the chart puts its number there.
const tbMoveAt = m => m.at - 1800;
const tbMoveLine = (M, m) => `<p class="tb-mv"><span class="tb-n" aria-label="Move ${m.n}">${m.n}</span><span>${esc(tbIST(tbMoveAt(m) * 1000, { day: "numeric", month: "short" }))}, around ${esc(tbIST(tbMoveAt(m) * 1000, { hour: "2-digit", minute: "2-digit" }))} IST · ${esc(M.yesNo ? "Yes" : outcomeLabel(m.name))} <span class="tb-chg ${m.pts > 0 ? "up" : "dn"}"><b>${m.pts > 0 ? "▲" : "▼"}</b> ${Math.abs(m.pts)} ${tbPts(m.pts)}</span> within a day, ${Math.round(m.from)}% to ${Math.round(m.to)}%</span></p>`;
const tbHeads = (list, k) => `<ul>${list.slice(0, k).map(h => `<li><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a><small>${esc(h.source || "")}${h.source ? " · " : ""}${esc(tbAgo(h.at))}</small></li>`).join("")}</ul>`;

// The lead card: the question and the figure, every front-runner's line over the week with the moves numbered, and
// the headlines around the latest move. Without history it is a plain card, larger.
function tbLeadCard(M, st, spans) {
  const H = st?.H, named = H ? (M.settled ? H.outcomes : M.outs.filter(o => tbHo(H, o.name))) : [];
  const style = ` style="--s3:${spans[0]};--s2:${spans[1]}"`;
  if (!named.length) return tbCard(M, "lead", style);
  const moves = (H.moves || []).filter(m => m.heads?.length), latest = moves.at(-1);
  const why = latest ? `<div class="tb-why in"><p class="tb-lab">Why it moved</p>${tbMoveLine(M, latest)}${tbHeads(latest.heads, 2)}</div>`
    : H.news?.length ? `<div class="tb-why in"><p class="tb-lab">In the news</p>${tbHeads(H.news, 2)}</div>` : "";
  const key = named.map(o => { const h = tbHo(H, o.name); const v = M.settled ? h?.now : o.prob; return v == null ? "" : `<li><i style="background:${tbCol(M, o.name)}"></i>${esc(M.yesNo ? "Yes" : outcomeLabel(o.name))} <b class="tnum">${tbPc(v)}</b></li>`; }).join("");
  return `<li class="tb-cell lead"${style}><article class="tb-card tb-lead" data-bet="${esc(M.id)}">
<div class="tb-top"><span class="tb-cat">${esc(tbKicker(M, st))}</span><button type="button" class="tb-more" data-bet="${esc(M.id)}" aria-label="${esc(M.full || M.title)}: the whole market">The whole market <span aria-hidden="true">›</span></button></div>
<div class="tb-lh"><p class="tb-q">${tbQ(M)}</p>${tbFig(M)}</div>
<ul class="tb-key">${key}</ul><div class="tb-plot in" data-tbplot="${esc(M.id)}"></div>${why}${tbSrc(M)}</article></li>`;
}
function tbCard(M, cls, style = "") {
  const H = tbHist(M.id), c = tbChange(H, M), lead = cls === "lead";
  return `<li class="tb-cell ${cls}"${style}><div class="tb-card" data-bet="${esc(M.id)}" tabindex="0" role="button" aria-label="${esc(M.full || M.title)}: the trend and the field">
<div class="tb-top"><span class="tb-cat">${esc(M.settled ? tbKicker(M) : M.category)}</span>${tbChg(c)}</div>
<p class="tb-q">${tbQ(M)}</p>
<div class="tb-mid">${tbFig(M)}${tbSpark(H, M, lead ? "big" : "")}</div>
${tbBar(M)}${tbLegend(M) ? `<p class="tb-leg">${tbLegend(M)}</p>` : ""}
${tbSrc(M)}</div></li>`;
}

// ---------------------------------------------------------------- the Betting Window
// The lead spans what is left of its row, so the grid ends on a full row at three columns and at two. On a phone the
// cards after the first three are slim rows (class "sm").
function tbBetting() {
  const liveM = LIVE.betting?.value?.markets || [];
  const list = (E.betting?.length ? E.betting : liveM).slice(0, CFG.betting.show || 10);
  const Ms = list.map(b => tbMarket(b.id)).filter(Boolean);
  if (!Ms.length) return "";
  const stories = Ms.map(tbStory);
  let li = 0; stories.forEach((s, i) => { if ((s?.score || 0) > (stories[li]?.score || 0)) li = i; });
  const order = [li, ...Ms.map((_, i) => i).filter(i => i !== li)];
  const n = Ms.length, span = c => { const r = (n - 1) % c; return r === 0 ? c : c - r; };
  const cards = order.map((i, k) => (k === 0 ? tbLeadCard(Ms[i], stories[i], [span(3), span(2)]) : tbCard(Ms[i], k >= 3 ? "sm" : ""))).join("");
  const asof = LIVE.betting?.as_of ? `Prices ${LIVE.betting.stale ? "last read" : "updated"} ${esc(istFull(LIVE.betting.as_of))} IST` : "Prices at press time";
  return `<ol class="tb-grid" data-n="${n}">${cards}</ol><p class="asof tb-asof">${asof}. Tap a market for its trend and the field.</p>${aboutFig("Prices and their history from Polymarket. A price is what traders pay for a yes, read as the chance they give it. The headlines beside a move are the news published in the day and a half before it, shown for context: they are not given as its cause. A settled market shows Polymarket's result.")}`;
}
TRIAL_BLOCKS.betting = () => trialSafe("bets", tbBetting);

// ---------------------------------------------------------------- Page One and the sport desks: decorate in place
function tbPaint() {
  tbLoad();
  // the lead card's chart, drawn once per painted element at its own width
  for (const plot of document.querySelectorAll(".tb-lead .tb-plot[data-tbplot]:not([data-drawn])")) {
    const M = tbMarket(plot.dataset.tbplot), H = M && tbHist(M.id); if (!H) continue;
    plot.dataset.drawn = "1";
    const draw = () => trialSafe("bets chart", () => tbDraw(plot, H, M, "w", { compact: true }));
    draw(); tbWatch(plot, draw);
  }
  // Page One's "The market expects": the favourite's line and its change beside the name, the outcomes in one bar
  for (const btn of document.querySelectorAll(".p1 ol.bets button.bet[data-bet]")) {
    const M = tbMarket(btn.dataset.bet); if (!M) continue;
    const H = tbHist(M.id), c = tbChange(H, M), sig = `${M.id}|${M.fav.prob}|${M.outs.map(o => o.prob).join()}|${H ? H.outcomes[0]?.now : ""}|${M.settled ? 1 : 0}`;
    if (btn.dataset.tb === sig) continue;
    btn.dataset.tb = sig; btn.classList.add("tb-p1");
    btn.innerHTML = M.settled
      ? `<span class="t">${esc(vsV(M.title).replace(/^UEFA /, ""))}</span><b class="tb-pc won">Settled</b><span class="tb-nm">${esc(tbWinner(M))}</span>${tbSpark(H, M, "p1")}`
      : `<span class="t">${esc(vsV(M.title).replace(/^UEFA /, ""))}</span><b class="tnum tb-pc">${tbPc(M.fav.prob)}</b><span class="tb-nm">${esc(tbLabel(M, M.fav))}${tbChg(c, true)}</span>${tbSpark(H, M, "p1")}${tbBar(M)}`;
  }
  // the market's view in a sport desk: the line and the change, a button that opens the market
  for (const box of document.querySelectorAll(".signal")) {
    const id = tbFromUrl(box.querySelector("a.sg-src")?.getAttribute("href")), M = id && tbMarket(id);
    const H = M && tbHist(M.id), sig = M ? `${M.id}|${M.fav.prob}|${H ? H.outcomes[0]?.now : ""}` : "";
    const was = box.querySelector(":scope > .tb-sg");
    if ((was?.dataset.sig || "") === sig && (!M || was)) continue;
    was?.remove();
    if (!M || M.settled) continue;
    const c = tbChange(H, M);
    box.querySelector(".sg-o")?.insertAdjacentHTML("afterend", `<button type="button" class="tb-sg" data-sig="${esc(sig)}" data-bet="${esc(M.id)}" aria-label="${esc(M.title)}: the trend and the field">${tbSpark(H, M) || ""}${tbChg(c) || (H ? "" : `<span class="tb-chg"><em>The field</em></span>`)}</button>`);
  }
}
TRIAL_PAINT.push(tbPaint);
// redraw a chart when its box changes width (a rotated phone, a resized window)
function tbWatch(el, draw) {
  if (!window.ResizeObserver) return;
  let w = el.clientWidth;
  const ro = new ResizeObserver(() => { if (!el.isConnected) return ro.disconnect(); if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
  ro.observe(el);
}

// ---------------------------------------------------------------- the market, in detail
// "All" is offered for a market older than the month, and asked for only when it is tapped.
function tbAll(id) {
  if (TB.all[id]) return Promise.resolve(TB.all[id]);
  return live("look_bet_all", `?id=${encodeURIComponent(id)}`).then(r => (r && !r.stale && r.value?.outcomes?.length ? (TB.all[id] = r.value) : null)).catch(() => null);
}
function tbSheet(id) {
  const M = tbMarket(id); if (!M) return false;
  const H = tbHist(M.id), ho = tbHo(H, M.fav.name);
  const ch = (d, t) => (d == null || Math.abs(d) < 1 ? "" : `<span class="tb-chg ${d > 0 ? "up" : "dn"}"><b>${d > 0 ? "▲" : "▼"}</b> ${Math.abs(Math.round(d))} <em>${t}</em></span>`);
  const hero = M.settled
    ? `<div class="tb-hero won"><b>${esc(tbWinner(M))}</b><div><span class="tb-hn">${/^Resolved /.test(tbWinner(M)) ? "Settled" : "Won"}</span><span class="tb-hc"><span class="tb-chg"><em>Polymarket settled it${M.settled.at ? ` on ${esc(tbIST(M.settled.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))} IST` : ""}</em></span></span></div></div>`
    : `<div class="tb-hero"><b class="tnum" style="color:${tbCol(M, M.fav.name)}">${tbPc(M.fav.prob)}</b><div><span class="tb-hn">${esc(tbLabel(M, M.fav))}</span><span class="tb-hc">${M.live ? `${ch(ho?.d24, "in 24h")}${ch(ho?.d7, "this week")}` : `<span class="tb-chg"><em>Price at press time</em></span>`}</span></div></div>`;
  const named = H ? (M.settled ? H.outcomes : M.outs.filter(o => tbHo(H, o.name))) : [];
  const h0 = named.length && tbHo(H, named[0].name), old = h0?.m && h0.m.t0 <= h0.t - 29 * 86400;
  const ranges = [["d", "1D"], ["w", "1W"], ["m", "1M"], ...(old ? [["a", "All"]] : [])];
  if (TB.range === "a" && !old) TB.range = "m";
  const chart = named.length ? `<div class="tb-chart"><div class="tb-ch-h"><span class="tb-lab">${M.yesNo ? "The chance" : "The front-runners"} over time</span><span class="tb-rng" role="group" aria-label="Time range">${ranges.map(([k, l]) => `<button type="button" data-tbr="${k}" aria-pressed="${TB.range === k}">${l}</button>`).join("")}</span></div>
<ul class="tb-key">${named.map(o => { const v = M.settled ? tbHo(H, o.name)?.now : o.prob; return `<li><i style="background:${tbCol(M, o.name)}"></i>${esc(M.yesNo ? "Yes" : outcomeLabel(o.name))} <b class="tnum">${tbPc(v ?? 0)}</b></li>`; }).join("")}</ul><div class="tb-plot" data-tbplot="${esc(M.id)}"></div></div>` : "";
  const moves = (H?.moves || []).filter(m => m.heads?.length);
  const why = moves.length ? `<div class="tb-why"><p class="tb-lab">Why it moved: the headlines around the move${moves.length > 1 ? "s" : ""}</p><ol>${[...moves].reverse().map(m => `<li>${tbMoveLine(M, m)}${tbHeads(m.heads, moves.length > 1 ? 2 : 3)}</li>`).join("")}</ol></div>`
    : H?.news?.length ? `<div class="tb-why"><p class="tb-lab">In the news</p><ol><li>${tbHeads(H.news, 3)}</li></ol></div>` : "";
  let ticks = false;
  const field = M.settled || !M.outs.length ? "" : `<div class="tb-field"><p class="tb-lab">The field</p><ol class="vs-outs">${M.outs.map(o => {
    const p = M.press?.[o.name], d = p != null ? o.prob - p : 0, h = M.live ? tbHo(H, o.name) : null;
    const was = h?.d24 != null && Math.abs(h.d24) >= 1 ? Math.max(0, Math.min(100, o.prob - h.d24)) : null; if (was != null) ticks = true;
    const notes = [h?.d24 != null && Math.abs(h.d24) >= 1 ? `${h.d24 > 0 ? "▲" : "▼"} ${Math.abs(Math.round(h.d24))} in 24h` : "", Math.abs(d) >= 1 ? `${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d))} since press (${Math.round(p)}%)` : ""].filter(Boolean).join(" · ");
    return `<li><span class="n"><i style="background:${tbCol(M, o.name)}"></i>${esc(tbLabel(M, o))}</span><b class="tnum">${tbPc(o.prob)}</b><span class="bar"><i style="width:${tbW(o.prob)}%;background:${tbCol(M, o.name)}"></i>${was != null ? `<u style="left:${tbW(was)}%" title="A day ago: ${Math.round(was)}%"></u>` : ""}</span>${notes ? `<small class="tnum">${esc(notes)}</small>` : ""}</li>`; }).join("")}${M.rest >= 1 ? `<li><span class="n"><i class="r"></i>Others</span><b class="tnum">${Math.round(M.rest)}%</b><span class="bar"><i style="width:${tbW(M.rest)}%;background:var(--rule)"></i></span></li>` : ""}</ol>${ticks ? `<p class="tb-tick">The thin mark is where each stood a day ago.</p>` : ""}</div>`;
  const ends = H?.end && !M.settled ? Date.parse(H.end) : NaN;
  const meta = [Number.isFinite(ends) && ends > Date.now() ? `settles ${tbIST(ends, { day: "numeric", month: "short", year: "numeric" })}` : "", H?.vol ? `${tbVol(H.vol)} traded in all` : "", M.live ? M.vol : "",
    M.since ? `in the paper since ${sparkLabel(M.since)}` : "", M.settled ? "" : M.live && M.asof ? `prices at ${istTime(M.asof)} IST` : !M.live ? "prices at press time" : ""].filter(Boolean).join(" · ");
  const rules = H?.rules ? `<details class="tb-rules"><summary>How it is decided</summary><p>${esc(H.rules)}</p></details>` : "";
  const panel = Sheet.open(`<p class="vs-k">${esc(M.category)} <span class="vs-fc">Forecast</span></p><h2 class="vs-h vs-t">${esc(vsV(M.full || M.title))}</h2>
<div class="tb-sheet">${hero}${chart}${why}${field}</div>
${meta ? `<p class="vs-meta">${tbMkt()} · ${esc(meta.replace(/^./, c => c.toUpperCase()))}</p>` : ""}${rules}<p class="vs-note">A price is what traders pay for a yes, read as the chance they give it. It is a forecast, not a result.${why ? " The headlines are what was published around each move (or this week), for context, not given as its cause." : ""}</p>
${M.url ? `<a class="vs-pri vs-btn" href="${esc(M.url)}" target="_blank" rel="noopener">Open on ${esc(M.source)} ↗</a>` : ""}`, M.full || M.title);
  panel?.classList.add("tb-panel");
  const plot = panel?.querySelector(".tb-plot");
  if (plot) {
    let seq = 0;
    const draw = () => {
      const k = ++seq;
      if (TB.range !== "a") return trialSafe("bets chart", () => tbDraw(plot, H, M, TB.range));
      if (TB.all[M.id]) return trialSafe("bets chart", () => tbDraw(plot, H, M, "a"));
      plot.classList.add("wait");
      tbAll(M.id).then(A => {
        plot.classList.remove("wait"); if (k !== seq || !plot.isConnected) return;
        if (!A) { panel.querySelector('[data-tbr="a"]')?.remove(); TB.range = "m"; panel.querySelector('[data-tbr="m"]')?.setAttribute("aria-pressed", "true"); }
        trialSafe("bets chart", () => tbDraw(plot, H, M, TB.range));
      });
    };
    requestAnimationFrame(draw);
    panel.querySelector(".tb-rng")?.addEventListener("click", e => { const b = e.target.closest("[data-tbr]"); if (!b) return; TB.range = b.dataset.tbr; for (const x of panel.querySelectorAll("[data-tbr]")) x.setAttribute("aria-pressed", String(x === b)); draw(); });
    tbWatch(plot, draw);
  }
  return true;
}

// The chart: one line per front-runner (the favourite on top and a little heavier), a light grid with 50% marked, each
// line's price at its end (the card's figure while the price is live), the moves numbered where they happened, and a
// crosshair that reads every line at the pointer. A sideways drag reads it; a vertical one scrolls the page.
function tbDraw(el, H, M, range, { compact = false } = {}) {
  const W = Math.max(260, el.clientWidth || 600), Ht = compact ? (W < 520 ? 170 : 200) : W < 520 ? 190 : 230, L = 34, R = 44, T = 12, B = 24;
  const named = M.settled ? H.outcomes : M.outs.filter(o => tbHo(H, o.name));
  const A = range === "a" ? TB.all[M.id] : null;
  const ser = named.map(o => ({ o, h: tbHo(H, o.name) })).filter(x => x.h).map(({ o, h }) => {
    let pts;
    if (A) { const a = A.outcomes.find(x => x.name === o.name)?.a; if (!a) return null; pts = a.p.map((p, i) => [a.t0 + i * a.dt, p]); if (a.last) pts.push(a.last); }
    else { const s = range === "m" && h.m ? h.m : h.w; pts = s.p.map((p, i) => [s.t0 + i * s.dt, p]); }
    if (h.t > pts.at(-1)[0]) pts.push([h.t, h.now]);
    const end = pts.at(-1)[0];
    return { o, h, pts: range === "d" ? pts.filter(([t]) => t >= end - 86400) : pts };
  }).filter(s => s && s.pts.length > 1);
  if (!ser.length) { el.innerHTML = ""; return; }
  const t0 = Math.min(...ser.map(s => s.pts[0][0])), t1 = Math.max(...ser.map(s => s.pts.at(-1)[0]));
  const all = ser.flatMap(s => s.pts.map(p => p[1]));
  let lo = Math.min(...all), hi = Math.max(...all); const pad = Math.max(2, (hi - lo) * 0.12); lo = Math.max(0, lo - pad); hi = Math.min(100, hi + pad);
  if (hi - lo < 12) { const m = (hi + lo) / 2; lo = Math.max(0, m - 6); hi = Math.min(100, lo + 12); lo = Math.max(0, hi - 12); }
  const x = t => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo || 1)) * (Ht - T - B);
  const step = [1, 2, 5, 10, 20, 25, 50].find(s => (hi - lo) / s <= 4) || 50, ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  // date labels: as many as fit, one every 64 pixels at the least; "All" by month
  const xt = [], dayS = 86400, off = 19800; // IST
  let xl;
  if (range === "a") {
    const d = new Date((t0 + off) * 1000), months = [];
    for (let m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); m.getTime() / 1000 - off <= t1; m.setUTCMonth(m.getUTCMonth() + 1)) months.push(m.getTime() / 1000 - off);
    const every = Math.max(1, Math.ceil(64 / ((30 * dayS / (t1 - t0 || 1)) * (W - L - R))));
    months.forEach((t, i) => { if (i % every === 0) xt.push(t); });
    xl = t => tbIST(t * 1000, t1 - t0 > 300 * dayS ? { month: "short", year: "2-digit" } : { month: "short" });
  } else {
    const tick = range === "d" ? 6 * 3600 : range === "w" ? dayS : 7 * dayS;
    const every = Math.max(1, Math.ceil(64 / ((tick / (t1 - t0 || 1)) * (W - L - R))));
    for (let t = Math.ceil((t0 + off) / tick) * tick - off, i = 0; t <= t1; t += tick, i++) if (i % every === 0) xt.push(t);
    xl = t => tbIST(t * 1000, range === "d" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
  }
  // the price at each line's end, nudged apart so the labels never overlap
  const endV = s => (M.live && !M.settled ? s.o.prob : s.pts.at(-1)[1]);
  const ends = ser.map(s => ({ s, v: s.pts.at(-1)[1], y: y(s.pts.at(-1)[1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  const path = s => s.pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marks = range === "a" ? "" : (H.moves || []).filter(m => m.at >= t0 && m.at <= t1).map(m => {
    if (!ser.find(s => s.o.name === m.name)) return "";
    // the marker sits halfway up the move, where it happened, whatever the chart's grain
    const cx = x(Math.min(t1, tbMoveAt(m))), cy = y((m.from + m.to) / 2);
    return `<line class="tb-ml" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T}" y2="${Ht - B}"/><circle class="tb-mc" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9"/><text class="tb-mt" x="${cx.toFixed(1)}" y="${(cy + 3.6).toFixed(1)}">${m.n}</text>`;
  }).join("");
  el.innerHTML = `<svg width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${esc(`${M.full || M.title}: ${ser.map(s => `${tbLabel(M, s.o)} ${Math.round(s.pts[0][1])}% to ${Math.round(s.pts.at(-1)[1])}%`).join("; ")}`)}">
${ticks.map(v => `<line class="tb-g${v === 50 ? " h" : ""}" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tb-yl" x="${L - 6}" y="${(y(v) + 4).toFixed(1)}">${v}%</text>`).join("")}
${xt.map(t => `<text class="tb-xl" x="${x(t).toFixed(1)}" y="${Ht - 6}">${esc(xl(t))}</text>`).join("")}
${[...ser].reverse().map((s, ri) => `<path class="tb-ln${ri === ser.length - 1 ? " f" : ""}" d="${path(s)}" stroke="${tbCol(M, s.o.name)}"/>`).join("")}
${marks}
${ends.map(e => `<circle class="tb-ed" cx="${x(e.s.pts.at(-1)[0]).toFixed(1)}" cy="${y(e.v).toFixed(1)}" r="3.5" fill="${tbCol(M, e.s.o.name)}"/><text class="tb-el" x="${W - R + 8}" y="${(e.y + 4).toFixed(1)}">${tbPc(endV(e.s))}</text>`).join("")}
<line class="tb-xh" x1="0" x2="0" y1="${T}" y2="${Ht - B}" visibility="hidden"/><rect class="tb-hit" x="${L}" y="0" width="${W - L - R}" height="${Ht}"/></svg><div class="tb-tip" hidden></div>`;
  const svg = el.querySelector("svg"), xh = svg.querySelector(".tb-xh"), tip = el.querySelector(".tb-tip");
  const move = ev => {
    const r = svg.getBoundingClientRect(), px = ev.clientX - r.left, t = t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    if (px < L || px > W - R) return hide();
    const rows = ser.map(s => ({ s, p: s.pts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a)) }));
    const tx = x(rows[0].p[0]);
    xh.setAttribute("x1", tx); xh.setAttribute("x2", tx); xh.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${esc(tbIST(rows[0].p[0] * 1000, range === "a" ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</b>${rows.map(({ s, p }) => `<span><i style="background:${tbCol(M, s.o.name)}"></i>${esc(tbLabel(M, s.o))} <b class="tnum">${tbPc(p[1])}</b></span>`).join("")}`;
    tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = `${Math.min(W - tw - 4, Math.max(4, tx + 10 + tw > W ? tx - tw - 10 : tx + 10))}px`;
  };
  const hide = () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
}

// A tap on any market (a card, Page One's list, a desk's market's view, "Since we printed") opens this sheet while the
// trial is on; it listens before the paper's own handler (v2/sheet.js) and leaves links alone. On the lead card a
// click anywhere but a headline opens it too; its button is the keyboard's way in.
function tbOpen(e) {
  if (!trialOn()) return;
  const el = e.target.closest?.("[data-bet]"); if (!el || e.target.closest("a")) return;
  if (e.type === "keydown" && (e.key !== "Enter" && e.key !== " " || el.tagName === "ARTICLE")) return;
  if (!tbMarket(el.dataset.bet)) return;
  e.preventDefault(); e.stopPropagation();
  trialSafe("bets sheet", () => tbSheet(el.dataset.bet));
}
addEventListener("click", tbOpen, true);
addEventListener("keydown", tbOpen, true);
