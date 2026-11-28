// ---------- (9) Money as a Market Pulse (Parth, 27 Nov 2026: "very clean", "the fonts, the graphs and the gauges", "but I
// do not want to make it too cluttered") ----------
// The Ledger's data block, redrawn in three bands. (1) One strip of four: the RBI repo rate and Fed funds read live from
// the banks themselves, each with its next decision and what traders expect of it (a forecast, boxed and marked), the US
// 10-year yield, and who's buying (FII and DII, a tap for the day in full). (2) The markets one region at a time: two tabs
// (India, US) that carry each region's mood, open or closed, and average move; under them, on a move of 1% or more, the
// day's headline about that close; then the region's mood gauge beside its index cards, each with the day's line against
// the previous close. (3) Commodities, the dollar and Bitcoin, each with its day's line. Any card opens its chart (1D to
// 5Y) in the paper's sheet. Everything the old block showed and these do not (every market's row, who bought and sold in
// full, breadth, movers) folds into one "More": no data gone. Feeds: the paper's own (markets, gold_in, flows, movers)
// plus the trial's look_rates, look_commodities, look_daylines and look_why, and look_chart on a tap (lib/look-money.js).
// A card draws only when its figure is good; a missing figure hides its card, never a blank.
TRIAL_KEYS.push(["look_rates", ""], ["look_commodities", ""], ["look_daylines", ""], ["look_why", ""]);

const mpDay = ymd => (ymd ? fmt(ymd + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" }, "UTC").replace(/,/g, "") : "");
const mpDate = ymd => (ymd ? fmt(ymd + "T12:00:00Z", { day: "numeric", month: "short" }, "UTC") : "");
const mpNum = (v, d) => (v >= 1000 ? usd(v, d) : Number(v).toFixed(d));
// The day's move as a small tinted pill ("+0.46%"); a triangle drawn in CSS shows the direction.
const mpPill = v => (v == null || !isFinite(v) ? "" : `<span class="mp-pill ${v < 0 ? "dn" : "up"}">${pct(v)}</span>`);
const mpArrow = v => (v < 0 ? "▼" : "▲");

// ----- reveal once: a gauge's needle sweeps up and a line draws in the first time each comes into view, never again on
// a refresh (a repaint every five minutes would otherwise replay it). Reduced motion: drawn in place (trial-money.css).
const MP_SEEN = new Set();
// an element that reveals: its class (already shown when seen before) and its key
const mpRv = (cls, key) => `class="${cls}${MP_SEEN.has(key) ? " mp-in" : ""}" data-rv="${esc(key)}"`;
let mpIO = null;
function mpReveal() {
  const els = document.querySelectorAll(".mp [data-rv]:not(.mp-in)");
  if (!els.length) return;
  const show = el => { el.classList.add("mp-in"); MP_SEEN.add(el.dataset.rv); };
  if (!("IntersectionObserver" in window)) { els.forEach(show); return; }
  mpIO ||= new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { show(e.target); mpIO.unobserve(e.target); } }, { rootMargin: "0px 0px -6% 0px" });
  els.forEach(el => mpIO.observe(el));
}
TRIAL_PAINT.push(mpReveal);

// ----- the line on a card. Points against a base (the previous close for a day, the first close for a month): dashed at
// the base, green above it and red below, a dot at the end. A quiet day looks quiet: the scale never runs tighter than
// 0.6% of the base. The line is stretched to the card; the dot sits in its own element so it stays round.
function mpLine(points, base, { h = 46, key = "", label = "", caption = "", ink = false } = {}) {
  const a = (points || []).filter(v => typeof v === "number" && isFinite(v));
  if (a.length < 2 || !(base > 0)) return "";
  const W = 200, pad = 3, n = a.length - 1;
  let lo = Math.min(base, ...a), hi = Math.max(base, ...a);
  if (hi - lo < base * 0.006) { const m = (hi + lo) / 2; lo = m - base * 0.003; hi = m + base * 0.003; }
  const x = i => (i * W) / n, y = v => pad + ((hi - v) / (hi - lo)) * (h - 2 * pad);
  const d = a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = a[n] >= base, col = ink ? "var(--ink2)" : up ? "var(--good)" : "var(--bad)";
  return `<div class="mp-lw"><div ${mpRv("mp-spark", key)} style="--c:${col};height:${h}px"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}, ${up ? "up" : "down"} ${Math.abs((a[n] / base - 1) * 100).toFixed(2)}% from where it started"><line x1="0" x2="${W}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}" class="mp-base"/><path d="${d} L${W} ${h} L0 ${h} Z" class="mp-area"/><path d="${d}" class="mp-line"/></svg><i class="mp-dot" style="top:${((y(a[n]) / h) * 100).toFixed(1)}%"></i></div>${caption ? `<p class="mp-cap">${caption}</p>` : ""}</div>`;
}
// The day's line for a card, from look_daylines: its last point is the card's own price and its base the card's own
// previous close, so the line and the figures beside it agree. A line that ends far from the card's price is another
// session's, and is not drawn.
function mpDayOf(sym, price, chg) {
  const L = LIVE.look_daylines?.value?.lines?.[sym];
  if (!L || !(price > 0) || chg == null || !isFinite(chg) || L.points?.length < 2) return null;
  if (Math.abs(L.points.at(-1) / price - 1) > 0.015) return null;
  return { points: [...L.points.slice(0, -1), price], base: price / (1 + chg / 100), t1: L.t1 };
}
// The card's line: the day where we have it, else its month of daily closes (said under it)
function mpCardLine(q, sym, { h, label, closed }) {
  const D = mpDayOf(sym, q.price, q.change_pct);
  if (D) return mpLine(D.points, D.base, { h, key: `d:${sym}`, label: `${label}, ${closed ? "last session" : "today"}`, caption: closed ? `Closed, ${esc(closed)}` : "" });
  const m = (q.spark30 || q.spark?.slice(-22) || []).filter(v => typeof v === "number");
  return m.length > 1 ? mpLine(m, m[0], { h, key: `m:${sym}`, label: `${label}, a month of daily closes`, caption: "30 days", ink: true }) : "";
}
// "1.9× a usual day": the day's move against the month's typical daily move, when it is twice that and at least 1%
function mpUsual(closes, chg) {
  const c = (closes || []).filter(v => typeof v === "number" && v > 0).slice(-23, -1);
  if (c.length < 11 || chg == null) return "";
  const moves = c.slice(1).map((v, i) => Math.abs(v / c[i] - 1) * 100), usual = moves.reduce((s, v) => s + v, 0) / moves.length;
  if (!(usual > 0) || Math.abs(chg) < Math.max(1, 2 * usual)) return "";
  return `<span class="mp-usual ${chg < 0 ? "dn" : "up"}" title="A usual day this past month moved ${usual.toFixed(2)}%">${(Math.abs(chg) / usual).toFixed(1)}× a usual day</span>`;
}
// what opens a card's chart
const mpTap = (sym, { name, kicker, dp = 2, pre = "", price, chg }) => `data-mp-chart="${esc(sym)}" data-name="${esc(name)}" data-k="${esc(kicker)}" data-dp="${dp}" data-pre="${esc(pre)}" data-price="${price}" data-chg="${chg ?? ""}" role="button" tabindex="0" aria-label="${esc(name)}: open its chart"`;

// ================================================================ band 1: the rates and who's buying
function mpOdds(o) {
  if (!o || !(o.prob >= 0)) return "";
  return `<a class="mp-odds" href="${esc(o.url)}" target="_blank" rel="noopener" title="A forecast, not data: what traders on ${esc(o.source)} expect"><span class="mp-fc">Odds</span><span>${o.prob}% ${esc(o.outcome)}${o.vol < 50000 ? ", thin" : ""}</span></a>`;
}
function mpPolicy(p) {
  if (!p?.value || (p.next_at && Date.parse(p.next_at) <= Date.now())) return ""; // its decision is out and not yet read: hide
  const set = p.move && p.set_on ? `${esc(p.move)} on ${esc(mpDate(p.set_on))}` : p.move ? esc(p.move) : "";
  return `<div class="mp-cell"><div class="mp-ch"><span class="mp-cl">${esc(p.label)}</span><a class="mp-src" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.short)}</a></div>
<div class="mp-cv">${esc(p.value)}</div>${set ? `<p class="mp-cs">${set}</p>` : ""}${p.next_decision ? `<p class="mp-cs">Next decision <b>${esc(mpDay(p.next_decision))}</b></p>` : ""}${mpOdds(p.odds)}${p.live === false && p.checked ? `<p class="mp-cs mp-mut">as of ${esc(mpDate(p.checked))}</p>` : ""}</div>`;
}
function mpYield(q) {
  if (!q || !(q.price > 0)) return "";
  // a rise in the US yield is drawn red: it tends to pull money out of India
  const ch = q.change == null ? "" : Math.abs(q.change) < 0.005 ? "Flat" : `<span class="${q.change > 0 ? "dn" : "up"}">${mpArrow(q.change)} ${Math.abs(q.change).toFixed(2)} pts</span>`;
  const when = q.live ? "today" : `on ${esc(mpDay(q.session_date))}`;
  return `<div class="mp-cell"><div class="mp-ch"><span class="mp-cl">US 10-year yield</span><span class="mp-src">${q.source === "US Treasury" ? "Treasury" : "Yahoo"}</span></div>
<div class="mp-cv">${q.price.toFixed(2)}%</div>${ch ? `<p class="mp-cs">${ch} ${when}</p>` : ""}<p class="mp-cs mp-mut">Higher US yields tend to pull money out of India</p></div>`;
}
function mpFlows() {
  const F = LIVE.flows?.value?.day; if (!F || F.fii == null || F.dii == null) return "";
  // each bar: the day's buying against its selling, as wide as the day's trade against the larger of the two
  const gross = (b, s) => (b > 0 && s > 0 ? b + s : 0), max = Math.max(gross(F.fii_buy, F.fii_sell), gross(F.dii_buy, F.dii_sell), 1);
  const row = (k, net, buy, sell) => {
    const g = gross(buy, sell);
    return `<span class="mp-fl"><span class="mp-flk">${k}</span><b class="mp-flv ${net < 0 ? "dn" : "up"}">${net < 0 ? "−" : "+"}${crore(net)}</b>${g ? `<span class="mp-flbar" style="width:${Math.max(30, Math.round((g / max) * 100))}%" role="img" aria-label="${k}: bought ₹${inr(Math.round(buy))} cr, sold ₹${inr(Math.round(sell))} cr"><i style="width:${Math.round((buy / g) * 100)}%"></i></span>` : ""}</span>`;
  };
  return `<button type="button" class="mp-cell mp-flows" data-mp-flows aria-label="Who's buying: the day in full"><span class="mp-ch"><span class="mp-cl">Who's buying</span><span class="mp-src">NSE <span aria-hidden="true">›</span></span></span>
${row("FII", F.fii, F.fii_buy, F.fii_sell)}${row("DII", F.dii, F.dii_buy, F.dii_sell)}
<span class="mp-cs mp-mut mp-key"><span>${esc(mpDay(F.date))}</span><span><i class="up"></i>bought <i class="dn"></i>sold</span></span></button>`;
}
function mpRates() {
  const R = LIVE.look_rates?.value || {};
  const h = (R.policy || []).map(mpPolicy).join("") + mpYield(R.us10y) + mpFlows();
  return h ? `<h4 class="mp-h">Rates and who's buying</h4><div class="mp-strip">${h}</div>` : "";
}

// ================================================================ band 2: a region at a time
const MP_REGIONS = ["India", "US"];
let MP_REGION = (() => { try { return sessionStorage.getItem("h1400-mp-region") || "India"; } catch { return "India"; } })();
const mpIxOf = (M, R) => (M?.indices || []).filter(q => q?.price > 0 && CFG.markets.indices.find(i => i.name === q.name)?.exchange === R);
const mpAvg = list => (list.length ? list.reduce((s, q) => s + (q.change_pct || 0), 0) / list.length : null);
// The mood's zones: the publisher's own bands, red at fear through green at greed, the reading's zone lit
function mpZones(m) {
  const bands = m.bands?.length ? m.bands : [{ from: 0, word: "Extreme fear" }, { from: 25, word: "Fear" }, { from: 45, word: "Neutral" }, { from: 56, word: "Greed" }, { from: 76, word: "Extreme greed" }];
  const col = w => (/extreme fear/i.test(w) ? "var(--bad)" : /fear/i.test(w) ? "color-mix(in srgb,var(--bad) 72%,var(--paper))" : /extreme greed/i.test(w) ? "var(--good)" : /greed/i.test(w) ? "color-mix(in srgb,var(--good) 72%,var(--paper))" : "var(--muted)");
  return bands.map((b, i) => ({ from: b.from, to: bands[i + 1]?.from ?? 100, word: b.word, color: col(b.word) }));
}
// the word is printed in the full colour of its side, so it reads at any zone
const mpWordCol = w => (/fear/i.test(w) ? "var(--bad)" : /greed/i.test(w) ? "var(--good)" : "var(--ink)");
// the zone of the publisher's exact reading where it gives one, so the lit zone always agrees with its word
const mpLit = (m, Z = mpZones(m), v = m.exact ?? m.score) => Z.find((z, i) => v >= z.from && (v < z.to || i === Z.length - 1)) || Z[0];
function mpTab(R, M) {
  const list = mpIxOf(M, R), m = M?.mood?.[R], open = list.some(q => q.live), s = session(R), avg = mpAvg(list);
  if (!list.length && !m) return "";
  const lit = m && m.score != null ? mpLit(m) : null;
  const state = open ? `<span class="mp-op on">Open</span>` : `<span class="mp-op">${s?.next ? `Opens ${esc(istWhen(s.next))}` : "Closed"}</span>`;
  return `<button type="button" role="tab" id="mp-tab-${R}" aria-controls="mp-panel" aria-selected="${R === MP_REGION}" data-mp-region="${R}" class="mp-tab">
<span class="mp-tt"><b>${esc(CFG.markets.mood?.[R]?.label || R)}</b>${state}</span>
<span class="mp-tm">${lit ? `<span class="mp-tw" style="color:${mpWordCol(m.word || lit.word)}">${esc(m.word || moodWord(m.score))}</span>` : "<span></span>"}${avg == null ? "" : `<span class="mp-ta ${avg < 0 ? "dn" : "up"}">${pct(avg)}</span>`}</span>
${lit ? `<span class="mp-tb" aria-hidden="true"><i style="width:${Math.max(4, m.score)}%;background:${lit.color}"></i></span>` : ""}</button>`;
}
// The day's headline beside a big move, from look_why: only when the region moved 1% or more the same way on our cards
function mpWhy(R, M) {
  const W = LIVE.look_why?.value?.regions?.[R], avg = mpAvg(mpIxOf(M, R));
  if (!W?.headline || avg == null || Math.abs(avg) < 1 || Math.sign(avg) !== Math.sign(W.pct) || Math.abs(avg - W.pct) > 0.6) return "";
  const H = W.headline, at = Date.parse(H.at);
  return `<a class="mp-why" style="--mv:${avg < 0 ? "var(--bad)" : "var(--good)"}" href="${esc(H.url)}" target="_blank" rel="noopener">
<span class="mp-wr"><span class="mp-wa" aria-hidden="true">${avg < 0 ? "↘" : "↗"}</span><b>${esc(R)}</b><span class="mp-wp">${pct(avg)}</span></span>
<span class="mp-wt">${esc(H.title)}</span><span class="mp-ws">${trialLogo(H.site || H.url, H.source)}<span>${esc(H.source)}</span>${isFinite(at) ? `<span class="mp-wd">${esc(istTime(new Date(at).toISOString()))}</span>` : ""}</span></a>`;
}
// The gauge: the publisher's zones as a thin arc, the reading's zone in its colour, the rest grey; a slim needle that
// sweeps up from fear the first time it is seen
function mpGauge(R, m, M) {
  if (!m || m.score == null || !isFinite(m.score)) return "";
  const Z = mpZones(m), lit = mpLit(m, Z), word = m.word || moodWord(m.score);
  const cx = 80, cy = 78, r = 64, P = v => { const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = z => { const [x1, y1] = P(z.from + (z.from ? 1.2 : 0)), [x2, y2] = P(z.to - (z.to < 100 ? 1.2 : 0)); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${z === lit ? z.color : "var(--rule)"}" stroke-width="${z === lit ? 11 : 8}" stroke-linecap="round" fill="none"/>`; };
  const svg = `<svg viewBox="0 0 160 88" role="img" aria-label="${esc(R)} market mood ${m.score} of 100, ${esc(word)}">${Z.map(arc).join("")}<g class="mp-needle" style="--a:${(m.score / 100) * 180 - 90}deg"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r + 17}" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/></g><circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--ink)"/></svg>`;
  const bits = [m.prev_week != null && `A week ago <b>${Math.round(m.prev_week)}</b>`, m.prev_month != null && `a month ago <b>${Math.round(m.prev_month)}</b>`].filter(Boolean).join(", ");
  const vix = m.vix?.value != null ? `${esc(m.vix.name)} <b>${m.vix.value}</b>${m.vix.change_pct != null ? ` <span class="${m.vix.change_pct > 0 ? "dn" : "up"}">${pct(m.vix.change_pct)}</span>` : ""}` : "";
  // India: how broad the day was across the Nifty 500, when it is the same session as the cards
  const B = R === "India" ? LIVE.movers?.value?.breadth : null, sess = mpIxOf(M, R)[0]?.session_date;
  const br = B && B.up + B.down > 0 && (!sess || B.day === sess) ? (() => { const n = B.up + B.down + (B.flat || 0); return `<div class="mp-br"><div class="mp-brh"><span>Nifty 500 breadth</span><span><b class="up">${B.up} rose</b> <b class="dn">${B.down} fell</b></span></div><span class="mp-brb" role="img" aria-label="${B.up} of ${n} Nifty 500 stocks rose, ${B.down} fell"><i style="width:${Math.round((B.up / n) * 100)}%"></i></span></div>`; })() : "";
  // the day's move of each of the region's indices, as bars either side of zero (only where the card runs two rows tall)
  const list = mpIxOf(M, R), mx = Math.max(0.01, ...list.map(q => Math.abs(q.change_pct || 0)));
  const moves = list.length > 2 ? `<div class="mp-mv"><p class="mp-mvh">The day's moves</p>${CFG.markets.indices.filter(i => i.exchange === R).map(i => list.find(q => q.name === i.name)).filter(q => q?.change_pct != null).map(q => `<div class="mp-mvr"><span>${esc(q.name)}</span><span class="mp-mvt"><i class="${q.change_pct < 0 ? "dn" : "up"}" style="width:${((Math.abs(q.change_pct) / mx) * 50).toFixed(1)}%"></i></span><b class="${dir(q.change_pct)}">${pct(q.change_pct)}</b></div>`).join("")}</div>` : "";
  const old = m.stale || (m.as_of && Date.now() - Date.parse(m.as_of) > 30 * 36e5);
  return `<div class="mp-card mp-mood"><div class="mp-top"><h5 class="mp-n">${esc(CFG.markets.mood?.[R]?.label || R)} mood</h5>${m.url ? `<a class="mp-src" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(String(m.name || "").replace(/ Market Mood Index| Fear & Greed Index/, ""))}</a>` : ""}</div>
<div ${mpRv("mp-gw", `g:${R}`)}>${svg}</div><div class="mp-gs"><b style="color:${mpWordCol(word)}">${esc(word)}</b><span class="tnum">${m.score}/100</span></div>
${bits ? `<p class="mp-gb">${bits}</p>` : ""}${vix ? `<p class="mp-gb">${vix}</p>` : ""}${moves}${br}${old && m.as_of ? `<p class="mp-cs mp-mut">${esc(agoIST(m.as_of))}</p>` : ""}</div>`;
}
function mpIndex(q, R) {
  if (!q || !(q.price > 0)) return "";
  const cfg = CFG.markets.indices.find(i => i.name === q.name) || {}, closed = q.live ? "" : mpDay(q.session_date);
  const ret = (k, v, from) => (v == null ? "" : `<span class="mp-ret"${from ? ` title="vs ${esc(mpDate(from))}${q.returns_calc ? ", worked out from daily closes" : q.returns_source ? `, as ${esc(q.returns_source)} publishes it` : ""}"` : ""}><span>${k}</span><b class="${dir(v)}">${pct(v)}${q.returns_calc ? "<sup>†</sup>" : ""}</b></span>`);
  const level = R === "India" ? inr(q.price, 2) : usd(q.price, 2);
  const tap = cfg.yahoo ? mpTap(cfg.yahoo, { name: q.name, kicker: `${R === "US" ? "United States" : R}, index`, dp: 2, price: q.price, chg: q.change_pct }) : "";
  return `<div class="mp-card mp-ix" ${tap}><div class="mp-top"><h5 class="mp-n">${esc(q.name)}</h5>${mpPill(q.change_pct)}</div>
<div class="mp-big">${level}</div>${cfg.yahoo ? mpCardLine(q, cfg.yahoo, { h: 48, label: q.name, closed }) : ""}
<div class="mp-foot">${ret("7D", q.chg_7d, q.from_7d)}${ret("1M", q.chg_1m, q.from_1m)}${mpUsual(q.spark, q.change_pct)}${q.live ? `<span class="mp-live">Live</span>` : ""}</div></div>`;
}
function mpRegions(M) {
  const regions = MP_REGIONS.filter(R => mpIxOf(M, R).length || M?.mood?.[R]);
  if (!regions.length) return "";
  if (!regions.includes(MP_REGION)) MP_REGION = regions[0];
  const R = MP_REGION, list = mpIxOf(M, R);
  // the region's indices in the paper's own order
  const order = CFG.markets.indices.filter(i => i.exchange === R).map(i => list.find(q => q.name === i.name)).filter(Boolean);
  const gauge = mpGauge(R, M?.mood?.[R], M), cards = order.map(q => mpIndex(q, R)).join("");
  const tabs = regions.length > 1 ? `<div class="mp-tabs" role="tablist" aria-label="Markets by region">${regions.map(x => mpTab(x, M)).join("")}</div>` : "";
  return `<h4 class="mp-h">Indices and mood</h4>${tabs}${mpWhy(R, M)}<div class="mp-panel${order.length > 2 ? " mp-tall" : ""}" id="mp-panel" role="${tabs ? "tabpanel" : "group"}" aria-labelledby="mp-tab-${R}">${gauge}${cards}</div>`;
}
// a tab switches the region and repaints the block in place (the choice is kept for the visit)
function mpPickRegion(e) {
  const b = e.target.closest?.("[data-mp-region]"); if (!b || !trialOn()) return;
  MP_REGION = b.dataset.mpRegion; try { sessionStorage.setItem("h1400-mp-region", MP_REGION); } catch {}
  const el = document.querySelector('[data-live="ledger"]'); if (!el) return;
  const html = TRIAL_BLOCKS.ledger(); el.innerHTML = html; el.dataset.html = html; trialPaint();
  el.querySelector(`[data-mp-region="${MP_REGION}"]`)?.focus({ preventScroll: true });
}
addEventListener("click", mpPickRegion);
addEventListener("keydown", e => { // arrow keys move between the tabs
  const b = e.target.closest?.("[data-mp-region]"); if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const all = [...document.querySelectorAll("[data-mp-region]")], i = all.indexOf(b), n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
  if (n && n !== b) { e.preventDefault(); n.click(); }
});

// ================================================================ band 3: commodities, the dollar and Bitcoin
function mpCommodity({ name, unit, price, q, sym, tap = "", wide = false, line = "" }) {
  if (!price) return "";
  return `<div class="mp-card mp-co${wide ? " mp-wide" : ""}" ${tap}><div class="mp-top"><div><h5 class="mp-n">${esc(name)}</h5><span class="mp-u">${esc(unit)}</span></div>${mpPill(q.change_pct)}</div>
<div class="mp-big">${price}</div>${line}</div>`;
}
// Brent, the rupee and Bitcoin trade round the clock on weekdays (Bitcoin every day): "closed" only over the weekend.
const mpWeekendShut = () => { const d = new Date(), wd = d.getUTCDay(), h = d.getUTCHours(); return wd === 6 || (wd === 0 && h < 22) || (wd === 5 && h >= 22); };
function mpCommodities(M) {
  const G = LIVE.gold_in?.value, C = LIVE.look_commodities?.value?.items || [], X = s => M?.cross?.find(q => q.symbol === s);
  const fut = id => {
    const q = C.find(c => c.id === id); if (!q || !(q.price > 0)) return "";
    const price = `$${mpNum(q.price, q.dp ?? 2)}`, closed = q.live ? "" : mpDay(q.session_date);
    return mpCommodity({ name: q.name, unit: q.unit, price, q, tap: mpTap(q.symbol, { name: q.name, kicker: `Commodity, ${q.unit}`, dp: q.dp ?? 2, pre: "$", price: q.price, chg: q.change_pct }), line: mpCardLine(q, q.symbol, { h: 38, label: q.name, closed }) });
  };
  const cross = (s, name, unit, pre, dp) => {
    const q = X(s); if (!q || !(q.price > 0)) return "";
    const L = LIVE.look_daylines?.value?.lines?.[s], closed = s !== "BTC-USD" && mpWeekendShut() ? mpDay(L?.t1 ? new Date(L.t1 * 1000).toISOString().slice(0, 10) : q.session_date) : "";
    return mpCommodity({ name, unit, price: `${pre}${dp ? q.price.toFixed(dp) : usd(q.price)}`, q, tap: mpTap(s, { name, kicker: unit, dp, pre, price: q.price, chg: q.change_pct }), line: mpCardLine(q, s, { h: 38, label: name, closed }) });
  };
  const gd = G?.rate_date?.split("/"), gday = gd?.length === 3 ? `${gd[2]}-${gd[1]}-${gd[0]}` : null;
  // gold is IBJA's published rate: its line is IBJA's own month, never a converted futures price
  const gs = (G?.spark || []).slice(-22);
  const gold = G?.per_10g_24k > 0 ? mpCommodity({ name: "Gold", unit: "₹ per 10 g, 24K", price: `₹${inr(G.per_10g_24k)}`, q: G.change_pct != null ? { change_pct: G.change_pct } : {}, wide: true,
    line: (gs.length > 1 ? mpLine(gs, gs[0], { h: 38, key: "m:gold", ink: true, label: "Gold, IBJA's rates over a month", caption: [G.per_10g_22k > 0 && `22K ₹${inr(G.per_10g_22k)}`, gday && `IBJA rate, ${esc(mpDay(gday))}`, "line: 30 days"].filter(Boolean).join(" · ") }) : "") }) : "";
  const h = gold + fut("silver") + cross("BZ=F", "Brent crude", "$ per barrel", "$", 2) + fut("natgas") + fut("copper")
    + cross("INR=X", "US dollar", "₹ per dollar", "₹", 2) + cross("BTC-USD", "Bitcoin", "$ per coin", "$", 0);
  return h ? `<h4 class="mp-h">Commodities, the dollar and Bitcoin</h4><div class="mp-row mp-cos">${h}</div>` : "";
}

// ================================================================ the sheets: a card's chart, the day's flows in full
const MPC = { range: "1D", cache: new Map() };
const MPC_RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"];
async function mpcData(sym, range) {
  const k = `${sym}|${range}`, hit = MPC.cache.get(k);
  if (hit && Date.now() - hit.at < 5 * 6e4) return hit.v;
  const r = await fetch(`/api/live/look_chart?sym=${encodeURIComponent(sym)}&range=${range}`), j = await r.json();
  if (!j?.ok || !(j.value?.points?.length > 1)) throw new Error("no chart");
  MPC.cache.set(k, { at: Date.now(), v: j.value });
  return j.value;
}
function mpcOpen(el) {
  const d = el.dataset, price = Number(d.price), chg = d.chg === "" ? null : Number(d.chg), dp = Number(d.dp) || 0, pre = d.pre || "";
  const f = v => `${pre}${v >= 1000 ? usd(v, dp >= 2 && v < 1e5 ? 2 : dp) : Number(v).toFixed(dp)}`;
  const panel = Sheet.open(`<p class="vs-k">${esc(d.k)}</p><h2 class="vs-h">${esc(d.name)}</h2>
<div class="mpc"><div class="mpc-hero"><b class="tnum">${f(price)}</b><span class="mpc-chg"></span></div>
<div class="mpc-bar"><span class="mpc-lab"></span><span class="mpc-rng" role="group" aria-label="Time range">${MPC_RANGES.map(r => `<button type="button" data-mpr="${r}" aria-pressed="${r === MPC.range}">${r}</button>`).join("")}</span></div>
<div class="mpc-plot" aria-live="polite"></div></div>
<p class="vs-note">Prices from Yahoo Finance; times in IST. ${d.mpChart === "INR=X" ? "Up means a weaker rupee. " : ""}The dashed line is where the range starts: for a day, the close before it.</p>`, d.name);
  if (!panel) return;
  panel.classList.add("mpc-panel");
  const plot = panel.querySelector(".mpc-plot"), chgEl = panel.querySelector(".mpc-chg"), lab = panel.querySelector(".mpc-lab");
  let cur = null;
  const draw = () => { if (cur) mpcDraw(plot, cur, f); };
  const load = async range => {
    MPC.range = range;
    for (const b of panel.querySelectorAll("[data-mpr]")) b.setAttribute("aria-pressed", String(b.dataset.mpr === range));
    plot.classList.add("wait");
    try {
      const v = await mpcData(d.mpChart, range);
      if (MPC.range !== range || !plot.isConnected) return;
      // a day starts from the card's own previous close, so the chart and the card agree
      const base = range === "1D" && chg != null && isFinite(chg) ? price / (1 + chg / 100) : v.base;
      const last = v.points.at(-1)[1], move = range === "1D" && chg != null ? chg : (last / base - 1) * 100;
      cur = { ...v, base, range };
      chgEl.className = `mpc-chg ${move < 0 ? "dn" : "up"}`; chgEl.textContent = `${mpArrow(move)} ${Math.abs(move).toFixed(2)}%`;
      lab.textContent = range === "1D" ? "Today, or the last session" : `Over ${{ "5D": "five days", "1M": "a month", "6M": "six months", "1Y": "a year", "5Y": "five years" }[range]}`;
      draw();
    } catch { if (MPC.range === range) { cur = null; plot.innerHTML = `<p class="mpc-none">This range did not load. Try another.</p>`; chgEl.textContent = ""; lab.textContent = ""; } }
    plot.classList.remove("wait");
  };
  panel.querySelector(".mpc-rng").addEventListener("click", e => { const b = e.target.closest("[data-mpr]"); if (b) load(b.dataset.mpr); });
  if (window.ResizeObserver) { let w = 0; new ResizeObserver(() => { if (plot.isConnected && Math.abs(plot.clientWidth - w) > 4) { w = plot.clientWidth; draw(); } }).observe(plot); }
  load(MPC.range);
}
// The chart: the closes as a line over a soft fill, green when the range rose and red when it fell, the start dashed, a
// few round levels on the right, dates or times along the bottom, and a crosshair that reads the price at the pointer.
function mpcDraw(el, v, f) {
  const P = v.points, W = Math.max(260, el.clientWidth || 600), H = W < 520 ? 200 : 250, L = 4, R = W < 520 ? 58 : 72, T = 12, B = 24;
  let lo = Math.min(v.base, ...P.map(p => p[1])), hi = Math.max(v.base, ...P.map(p => p[1]));
  if (hi - lo < v.base * 0.006) { const m = (hi + lo) / 2; lo = m - v.base * 0.003; hi = m + v.base * 0.003; }
  const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
  const t0 = P[0][0], t1 = P.at(-1)[0], x = t => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R), y = c => T + ((hi - c) / (hi - lo)) * (H - T - B);
  const up = P.at(-1)[1] >= v.base, col = up ? "var(--good)" : "var(--bad)";
  // round levels: a step of 1, 2 or 5 times a power of ten, three to five of them
  const raw = (hi - lo) / 4, p10 = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(k => k * p10).find(s => (hi - lo) / s <= 5);
  const ticks = []; for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const intraday = v.range === "1D" || v.range === "5D", long = v.range === "5Y";
  const xl = t => fmt(new Date(t * 1000).toISOString(), intraday ? (v.range === "1D" ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short" }) : long ? { month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const nx = Math.max(2, Math.min(6, Math.floor((W - L - R) / 90))), xt = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * (i + 0.5)) / nx);
  const d = P.map(([t, c], i) => `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(c).toFixed(1)}`).join(" ");
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="From ${esc(f(P[0][1]))} to ${esc(f(P.at(-1)[1]))}" style="--c:${col}">
${ticks.map(t => `<line class="mpc-g" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="mpc-yl" x="${W - R + 8}" y="${(y(t) + 4).toFixed(1)}">${esc(f(t).replace(/\.\d+$/, m => (step < 1 ? m : "")))}</text>`).join("")}
${xt.map(t => `<text class="mpc-xl" x="${x(t).toFixed(1)}" y="${H - 6}">${esc(xl(t))}</text>`).join("")}
<line class="mpc-base" x1="${L}" x2="${W - R}" y1="${y(v.base).toFixed(1)}" y2="${y(v.base).toFixed(1)}"/>
<path class="mpc-area" d="${d} L${x(t1).toFixed(1)} ${H - B} L${x(t0).toFixed(1)} ${H - B} Z"/><path class="mpc-line" d="${d}"/>
<circle class="mpc-end" cx="${x(t1).toFixed(1)}" cy="${y(P.at(-1)[1]).toFixed(1)}" r="3.5"/>
<line class="mpc-xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><circle class="mpc-hd" r="4" visibility="hidden"/><rect class="mpc-hit" x="${L}" y="0" width="${W - L - R}" height="${H}"/></svg><div class="mpc-tip" hidden></div>`;
  const svg = el.querySelector("svg"), xh = svg.querySelector(".mpc-xh"), hd = svg.querySelector(".mpc-hd"), tip = el.querySelector(".mpc-tip");
  const hide = () => { xh.setAttribute("visibility", "hidden"); hd.setAttribute("visibility", "hidden"); tip.hidden = true; };
  const move = ev => {
    const r = svg.getBoundingClientRect(), px = ev.clientX - r.left;
    if (px < L || px > W - R) return hide();
    const t = t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    let lo2 = 0, hi2 = P.length - 1; while (hi2 - lo2 > 1) { const m = (lo2 + hi2) >> 1; if (P[m][0] < t) lo2 = m; else hi2 = m; }
    const p = Math.abs(P[lo2][0] - t) < Math.abs(P[hi2][0] - t) ? P[lo2] : P[hi2], cx = x(p[0]), cy = y(p[1]);
    xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.setAttribute("visibility", "visible");
    hd.setAttribute("cx", cx); hd.setAttribute("cy", cy); hd.setAttribute("visibility", "visible");
    const ch = (p[1] / v.base - 1) * 100;
    tip.innerHTML = `<span>${esc(fmt(new Date(p[0] * 1000).toISOString(), intraday ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }))}</span><b class="tnum">${esc(f(p[1]))}</b><span class="tnum ${ch < 0 ? "dn" : "up"}">${pct(ch)}</span>`;
    tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = `${Math.min(W - tw - 2, Math.max(2, cx + 12 + tw > W - R ? cx - tw - 12 : cx + 12))}px`;
  };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", hide);
}
// Who bought and sold, the day in full: one plain sentence, then bought, sold and net for each, and the month from NSDL
function mpFlowsSheet() {
  const F = LIVE.flows?.value?.day, Mo = LIVE.flows?.value?.fpi_month; if (!F) return;
  const c = v => crore(v), sg = v => `${v < 0 ? "−" : "+"}${crore(v)}`;
  const story = F.fii < 0 && F.dii > 0 ? `Foreign investors sold ${c(F.fii)} more than they bought; Indian funds bought ${c(F.dii)} more than they sold${F.dii >= -F.fii ? ", taking up all of it" : ", taking up part of it"}.`
    : F.fii > 0 && F.dii < 0 ? `Foreign investors bought ${c(F.fii)} more than they sold; Indian funds sold ${c(F.dii)} into them.`
    : F.fii >= 0 && F.dii >= 0 ? `Both bought: foreign investors ${c(F.fii)} net, Indian funds ${c(F.dii)}.` : `Both sold: foreign investors ${c(F.fii)} net, Indian funds ${c(F.dii)}.`;
  const row = (who, b, s, n) => `<tr><th scope="row">${who}</th><td>${b > 0 ? c(b) : ""}</td><td>${s > 0 ? c(s) : ""}</td><td class="${n < 0 ? "dn" : "up"}">${sg(n)}</td></tr>`;
  const month = Mo ? `<p class="mpf-m">Foreign investors have ${Mo.net >= 0 ? "put in" : "taken out"} <b class="tnum ${Mo.net >= 0 ? "up" : "dn"}">${c(Mo.net)}</b> in ${esc(new Date(Mo.month + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }))}${Mo.month === istDate().slice(0, 7) ? " so far" : ""}, over ${Mo.days} session${Mo.days === 1 ? "" : "s"} (NSDL).</p>` : "";
  const panel = Sheet.open(`<p class="vs-k">Cash market, ${esc(mpDay(F.date))}</p><h2 class="vs-h">Who bought India</h2>
<div class="mpf"><p class="mpf-s">${story}</p><table class="mpf-t"><thead><tr><th></th><th scope="col">Bought</th><th scope="col">Sold</th><th scope="col">Net</th></tr></thead><tbody>${row("Foreign (FII/FPI)", F.fii_buy, F.fii_sell, F.fii)}${row("Indian funds (DII)", F.dii_buy, F.dii_sell, F.dii)}<tr class="mpf-tot"><th scope="row">Together</th><td></td><td></td><td class="${F.fii + F.dii < 0 ? "dn" : "up"}">${sg(F.fii + F.dii)}</td></tr></tbody></table>${month}</div>
<p class="vs-note">NSE's provisional figures for the cash market (${esc(F.scope || "NSE")}), out each evening. FIIs are foreign institutions; DIIs are Indian mutual funds, insurers and banks. When foreign money leaves and Indian funds take the other side, the index holds up better than the foreign selling alone would suggest.</p>`, "Who bought India");
  panel?.classList.add("mpf-panel");
}
function mpOpen(e) {
  if (!trialOn()) return;
  const el = e.target.closest?.("[data-mp-chart],[data-mp-flows]"); if (!el || e.target.closest("a")) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  if (e.type === "keydown" && el.tagName === "BUTTON") return; // a button clicks itself
  e.preventDefault();
  trialSafe("money sheet", () => (el.dataset.mpChart ? mpcOpen(el) : mpFlowsSheet()));
}
addEventListener("click", mpOpen);
addEventListener("keydown", mpOpen);

// ================================================================ More, the sources, the block
function mpMore(M, G, D) {
  const rows = boardRows(M, G, D);
  const board = rows ? `<div class="board" data-fam="money"><div class="tbl"><table><thead><tr><th>Market</th><th class="r">Level</th><th class="r">1D</th><th class="r">7D</th><th class="r">1M</th><th class="r">30 days</th></tr></thead><tbody>${rows}</tbody></table></div></div>` : "";
  const body = board + flowsBlock() + breadthBlock();
  return body ? `<div class="mp-more">${fold("mp-more", "More", "Every market, who bought and sold, breadth and the movers", body)}</div>` : "";
}
function mpSources(M) {
  const R = LIVE.look_rates?.value || {}, pol = (R.policy || []).filter(p => !p.next_at || Date.parse(p.next_at) > Date.now());
  const lev = [...new Set([...(M?.indices || []), ...(M?.cross || [])].map(q => q.source || "Yahoo Finance"))].join(" and ") || "Yahoo Finance";
  const polSrc = p => (p.live === false ? `${esc(p.label)}: the ${esc(p.source)}'s own release, checked by hand on ${esc(mpDate(p.checked))}` : p.id === "repo" ? "RBI repo rate: the RBI's home page, its Current Rates" : `Fed funds: ${p.source === "Federal Reserve" ? "the FOMC's statement for its last decision" : "the New York Fed's daily record of the target range"}`);
  return aboutFig([
    pol.length && `${pol.map(polSrc).join("; ")}. A card hides from the moment its next decision is due until its source shows the outcome.`,
    pol.some(p => p.odds) && "Odds, in a dashed box: what traders on Polymarket expect of the next decision, a forecast and not a fact; thin means under $50,000 traded.",
    R.us10y && `US 10-year yield: ${R.us10y.source === "US Treasury" ? "the US Treasury's daily par yield" : "Yahoo Finance (^TNX), else the US Treasury's daily par yield"}; the change is in percentage points.`,
    LIVE.flows?.value?.day && `Who's buying: NSE's provisional cash-market figures (${esc(LIVE.flows.value.day.scope || "NSE")}); each bar is the day's buying against its selling.`,
    `Indices, Brent, the rupee and Bitcoin: ${esc(lev)}. 7D and 1M as NSE publishes them; † where no source we can reach publishes the figure, it is worked out from daily closes. Each card's line is its day, five-minute prices from Yahoo Finance against the previous close (dashed); "30 days" marks a month of daily closes where the day's line is missing. A usual day is the average daily move over the past month.`,
    LIVE.look_why?.value && "The line beside a move of 1% or more is the latest headline about that close found on Google News that agrees with the move, as its publisher wrote it; the paper does not claim to know why a market moved.",
    M?.mood && `Mood: ${Object.values(M.mood).map(m => m?.name).filter(Boolean).map(esc).join(" and ")}, in their own bands. Breadth: Nifty 500 closes from Yahoo Finance.`,
    LIVE.gold_in?.value && "Gold: IBJA's published rate, before GST; its line is IBJA's own month.",
    LIVE.look_commodities?.value && "Silver, natural gas and copper: front-month COMEX and NYMEX futures on Yahoo Finance, in the contracts' own units.",
  ].filter(Boolean).join(" "));
}

function mpPulse() {
  const M = LIVE.markets?.value, G = LIVE.gold_in?.value, D = E.sections?.ledger?.data || {};
  const rows = mpRates() + mpRegions(M) + (M ? staleNote("markets") : "") + mpCommodities(M);
  if (!rows) return mondayLedger(D);
  let h = mondayLedger(D) + `<div class="mp">${rows}${mpMore(M, G, D)}${mpSources(M)}</div>`;
  const prof = CFG.day_profiles[E.weekday] || {};
  if (prof.markets === "light_unless_important" && !(E.sections?.ledger?.stories?.length)) h = `<details class="mp-wk"><summary class="asof">Weekend: markets folded. Tap to open.</summary>${h}</details>`;
  return h;
}
// if the pulse ever throws, the paper's own block draws instead (and its extras with it), never an empty Ledger
TRIAL_BLOCKS.ledger = () => { try { return mpPulse(); } catch (e) { console.warn("trial money:", e); return ledgerBlock() + ledgerExtras(); } };
TRIAL_BLOCKS.ledgerx = () => ""; // folded into the pulse's "More"
