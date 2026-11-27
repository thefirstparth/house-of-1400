// ---------- (9) Money as a Market Pulse (Parth, 27 Nov 2026: "very clean", "the fonts, the graphs and the gauges", "but I
// do not want to make it too cluttered") ----------
// The Ledger's data block, redrawn as three tidy rows of small cards: rates and flows (the RBI repo rate, Fed funds, the
// US 10-year yield, who's buying), the indices with the two mood gauges, and commodities (gold, silver, crude, natural
// gas, copper, the dollar, Bitcoin). The Ledger's stories are untouched. Everything the old block showed and these cards
// do not (every market's row, who bought and sold in full, breadth, movers) folds into one "More" under the rows: no
// data gone. Feeds: the paper's own (markets, gold_in, flows, movers) plus the trial's look_rates and look_commodities
// (lib/look-money.js). A card draws only when its figure is good; a missing figure hides its card, never a blank.
TRIAL_KEYS.push(["look_rates", ""], ["look_commodities", ""]);

const mpDay = ymd => (ymd ? fmt(ymd + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" }, "UTC").replace(/,/g, "") : "");
const mpDate = ymd => (ymd ? fmt(ymd + "T12:00:00Z", { day: "numeric", month: "short" }, "UTC") : "");
const mpNum = (v, d) => (v >= 1000 ? usd(v, d) : Number(v).toFixed(d));
const mpSign = (v, d = 2) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(d)}`;
// The day's move as a small tinted pill ("+0.46%"); a triangle drawn in CSS shows the direction.
const mpPill = v => (v == null || !isFinite(v) ? "" : `<span class="mp-pill ${v < 0 ? "dn" : "up"}">${pct(v)}</span>`);

// A month's line: the closes, a soft fill under them, a dotted line at where the month began, a dot at today. Green if the
// month ended higher, red if lower; `tone: "ink"` for a figure where up is neither good nor bad (a yield).
function mpSpark(a, { h = 44, tone, from, to } = {}) {
  a = (a || []).filter(v => typeof v === "number" && isFinite(v));
  if (a.length < 2) return "";
  const w = 200, pad = 4, mn = Math.min(...a), mx = Math.max(...a), span = mx - mn || 1, n = a.length - 1;
  const x = i => (i * w) / n, y = v => pad + (1 - (v - mn) / span) * (h - 2 * pad);
  const d = a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const col = tone === "ink" ? "var(--ink2)" : a[n] >= a[0] ? "var(--good)" : "var(--bad)";
  const label = `Daily closes over a month${from ? `, ${mpDate(from)} to ${mpDate(to)}` : ""}`;
  return `<div class="mp-spark" style="--c:${col};height:${h}px"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line x1="0" x2="${w}" y1="${y(a[0]).toFixed(1)}" y2="${y(a[0]).toFixed(1)}" class="mp-base"/><path d="${d} L${w} ${h} L0 ${h} Z" class="mp-area"/><path d="${d}" class="mp-line" fill="none"/></svg><i class="mp-dot" style="top:${((y(a[n]) / h) * 100).toFixed(1)}%"></i></div>`;
}

// ----- row 1: rates and flows
function mpPolicy(p) {
  if (!p || Date.parse(p.next_at) <= Date.now()) return ""; // its decision is out and the table is not updated: hide
  const set = `${p.move ? `${esc(p.move)} on` : "Set"} ${esc(mpDate(p.set_on))}`;
  return `<div class="mp-card mp-rate"><div class="mp-top"><h5 class="mp-n">${esc(p.label)}</h5><a class="mp-src" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.short)}</a></div>
<div class="mp-big">${esc(p.value)}</div><p class="mp-sub">${set}</p><p class="mp-next">Next decision <b>${esc(mpDay(p.next_decision))}</b></p><p class="mp-asof">as of ${esc(mpDate(p.checked))}</p></div>`;
}
function mpYield(q) {
  if (!q || !(q.price > 0)) return "";
  const ch = q.change == null ? "" : `<span class="mp-chg ${q.change < 0 ? "dn" : "up"}">${mpSign(q.change)} pts</span>`;
  const when = q.live ? `<span class="mp-live">Live</span>` : `${esc(mpDay(q.session_date))} close`;
  return `<div class="mp-card mp-rate mp-y10"><div class="mp-top"><h5 class="mp-n">US 10-year yield</h5><span class="mp-src">${q.source === "US Treasury" ? "Treasury" : "Yahoo"}</span></div>
<div class="mp-big">${q.price.toFixed(2)}%</div><p class="mp-sub">${ch}</p>${mpSpark(q.spark30, { h: 34, tone: "ink", from: q.spark_from, to: q.spark_to })}<p class="mp-asof">${when}</p></div>`;
}
function mpFlows() {
  const F = LIVE.flows?.value?.day; if (!F || F.fii == null || F.dii == null) return "";
  // each bar: the day's buying against its selling (gross), when NSE gives both; the net figure beside it
  const row = (k, net, buy, sell) => {
    const share = buy > 0 && sell > 0 ? Math.round((buy / (buy + sell)) * 100) : null;
    return `<div class="mp-fl"><span class="mp-flk">${k}</span><b class="mp-flv ${net < 0 ? "dn" : "up"}">${net < 0 ? "−" : "+"}${crore(net)}</b>${share == null ? "" : `<span class="mp-flbar" role="img" aria-label="${k}: bought ₹${inr(Math.round(buy))} cr, sold ₹${inr(Math.round(sell))} cr"><i style="width:${share}%"></i></span>`}</div>`;
  };
  return `<div class="mp-card mp-flows"><div class="mp-top"><h5 class="mp-n">Who's buying</h5><span class="mp-src">NSE</span></div>
${row("FII", F.fii, F.fii_buy, F.fii_sell)}${row("DII", F.dii, F.dii_buy, F.dii_sell)}
<p class="mp-asof"><span>${esc(mpDay(F.date))}, provisional</span><span class="mp-key"><i class="up"></i>bought <i class="dn"></i>sold</span></p></div>`;
}
function mpRates() {
  const R = LIVE.look_rates?.value || {};
  const h = (R.policy || []).map(mpPolicy).join("") + mpYield(R.us10y) + mpFlows();
  return h ? `<div class="mp-row mp-rates">${h}</div>` : "";
}

// ----- row 2: the indices and the mood
const MP_INDICES = ["Sensex", "Nifty 50", "Nifty Bank", "Nasdaq-100"];
function mpIndex(q) {
  if (!q || !(q.price > 0)) return "";
  const ex = CFG.markets.indices.find(i => i.name === q.name)?.exchange;
  const ret = (k, v, from) => (v == null ? "" : `<span class="mp-ret"${from ? ` title="vs ${esc(mpDate(from))}${q.returns_calc ? ", worked out from daily closes" : q.returns_source ? `, as ${esc(q.returns_source)} publishes it` : ""}"` : ""}><span>${k}</span> <b class="${dir(v)}">${pct(v)}${q.returns_calc ? "<sup>†</sup>" : ""}</b></span>`);
  const when = q.live ? `<span class="mp-live">Live</span>` : `${esc(mpDay(q.session_date))} close`;
  return `<div class="mp-card mp-ix"><div class="mp-top"><div><span class="mp-k">${esc(REGION[ex] === "United States" ? "US" : REGION[ex] || ex || "")}</span><h5 class="mp-n">${esc(q.name)}</h5></div>${mpPill(q.change_pct)}</div>
<div class="mp-big">${inr(q.price, 2)}</div>${mpSpark(q.spark30 || q.spark?.slice(-22), { h: 46 })}
<div class="mp-foot">${ret("7D", q.chg_7d, q.from_7d)}${ret("1M", q.chg_1m, q.from_1m)}<span class="mp-st">${when}</span></div></div>`;
}
// A compact gauge: the publisher's bands as a thin arc, grey but for the band the reading is in, a slim needle; the score
// and its word under it, then a week ago and the volatility index on one line.
function mpGauge(m) {
  if (!m || m.score == null || !isFinite(m.score)) return "";
  const word = m.word || moodWord(m.score), tone = moodTone(m);
  const bands = m.bands || [{ from: 0 }, { from: 25 }, { from: 45 }, { from: 56 }, { from: 75 }];
  const cx = 80, cy = 76, r = 64, P = v => { const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = (f, t, col, wd) => { const [x1, y1] = P(f), [x2, y2] = P(t); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${col}" stroke-width="${wd}" fill="none"/>`; };
  const segs = bands.map((b, i) => { const to = bands[i + 1]?.from ?? 100, on = m.score >= b.from && m.score < (bands[i + 1]?.from ?? 101); return arc(b.from + (i ? 1 : 0), to - (i < bands.length - 1 ? 1 : 0), on ? tone : "var(--rule)", on ? 10 : 7); }).join("");
  const a = Math.PI * (1 - m.score / 100), nx = cx + (r - 18) * Math.cos(a), ny = cy - (r - 18) * Math.sin(a);
  const svg = `<svg viewBox="0 0 160 84" role="img" aria-label="${esc(m.region || "")} market mood ${m.score} of 100, ${esc(word)}">${segs}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--ink)"/></svg>`;
  const bits = [m.prev_week != null && `A week ago <b>${Math.round(m.prev_week)}</b>`, m.vix?.value != null && `${esc(m.vix.name)} <b>${m.vix.value}</b>`].filter(Boolean).join(" · ");
  const old = m.stale || (m.as_of && Date.now() - Date.parse(m.as_of) > 30 * 36e5);
  return `<div class="mp-g"><div class="mp-gh"><span class="mp-k">${esc(m.region || "")}</span></div>${svg}<div class="mp-gs"><b class="tnum">${m.score}</b><span style="color:${tone}">${esc(word)}</span></div>${bits ? `<p class="mp-gb">${bits}</p>` : ""}${old && m.as_of ? `<p class="mp-asof">${esc(agoIST(m.as_of))}</p>` : ""}</div>`;
}
function mpIndices(M) {
  const cards = MP_INDICES.map(n => mpIndex(M?.indices?.find(q => q.name === n))).join("");
  const moods = Object.keys(CFG.markets.mood || {}).map(k => mpGauge(M?.mood?.[k])).join("");
  if (!cards && !moods) return "";
  return `<h4 class="mp-h">Indices and mood</h4><div class="mp-row mp-ixs">${moods ? `<div class="mp-card mp-moods"><h5 class="mp-n">Market mood</h5><div class="mp-gg">${moods}</div></div>` : ""}${cards}</div>`;
}

// ----- row 3: commodities
// Brent, the rupee and Bitcoin trade round the clock on weekdays (Bitcoin every day): "closed" only over the weekend.
const mpWeekendShut = () => { const d = new Date(), wd = d.getUTCDay(), h = d.getUTCHours(); return wd === 6 || (wd === 0 && h < 22) || (wd === 5 && h >= 22); };
function mpCommodity({ name, unit, price, change_pct, spark, from, to, foot, wide = false, extra = "" }) {
  if (!(price > 0) && typeof price !== "string") return "";
  return `<div class="mp-card mp-co${wide ? " mp-wide" : ""}"><div class="mp-top"><div><h5 class="mp-n">${esc(name)}</h5><span class="mp-u">${esc(unit)}</span></div>${mpPill(change_pct)}</div>
<div class="mp-big">${price}</div>${extra}${mpSpark(spark, { h: wide ? 46 : 36, from, to })}${foot ? `<p class="mp-asof">${foot}</p>` : ""}</div>`;
}
function mpCommodities(M) {
  const G = LIVE.gold_in?.value, C = LIVE.look_commodities?.value?.items || [], X = s => M?.cross?.find(q => q.symbol === s);
  const fut = id => { const q = C.find(c => c.id === id); if (!q) return ""; return mpCommodity({ name: q.name, unit: q.unit, price: `$${mpNum(q.price, q.dp ?? 2)}`, change_pct: q.change_pct, spark: q.spark30, from: q.spark_from, to: q.spark_to, foot: q.live ? "" : `Closed, ${esc(mpDay(q.session_date))}` }); };
  const cross = (s, name, unit, price) => { const q = X(s); if (!q || !(q.price > 0)) return ""; return mpCommodity({ name, unit, price: price(q), change_pct: q.change_pct, spark: q.spark30, foot: s !== "BTC-USD" && mpWeekendShut() ? `Closed, ${esc(mpDay(q.session_date))}` : "" }); };
  const gd = G?.rate_date?.split("/"), gday = gd?.length === 3 ? `${gd[2]}-${gd[1]}-${gd[0]}` : null;
  const gold = G?.per_10g_24k > 0 ? mpCommodity({ name: "Gold", unit: "₹ per 10 g, 24K", price: `₹${inr(G.per_10g_24k)}`, change_pct: G.change_pct, spark: G.spark?.slice(-22), wide: true,
    extra: G.per_10g_22k > 0 ? `<p class="mp-sub">22K ₹${inr(G.per_10g_22k)}</p>` : "", foot: gday ? `IBJA rate, ${esc(mpDay(gday))}` : "" }) : "";
  const h = gold + fut("silver")
    + cross("BZ=F", "Brent crude", "$ per barrel", q => `$${q.price.toFixed(2)}`)
    + fut("natgas") + fut("copper")
    + cross("INR=X", "US dollar", "₹ per dollar", q => `₹${q.price.toFixed(2)}`)
    + cross("BTC-USD", "Bitcoin", "$ per coin", q => `$${usd(q.price)}`);
  return h ? `<h4 class="mp-h">Commodities, the dollar and Bitcoin</h4><div class="mp-row mp-cos">${h}</div>` : "";
}

// ----- More: every market's row, who bought and sold in full, breadth and the movers
function mpMore(M, G, D) {
  const rows = boardRows(M, G, D);
  const board = rows ? `<div class="board" data-fam="money"><div class="tbl"><table><thead><tr><th>Market</th><th class="r">Level</th><th class="r">1D</th><th class="r">7D</th><th class="r">1M</th><th class="r">30 days</th></tr></thead><tbody>${rows}</tbody></table></div></div>` : "";
  const body = board + flowsBlock() + breadthBlock();
  return body ? `<div class="mp-more">${fold("mp-more", "More", "Every market, who bought and sold, breadth and the movers", body)}</div>` : "";
}
function mpSources(M) {
  const R = LIVE.look_rates?.value || {}, pol = (R.policy || []).filter(p => Date.parse(p.next_at) > Date.now());
  const lev = [...new Set([...(M?.indices || []), ...(M?.cross || [])].map(q => q.source || "Yahoo Finance"))].join(" and ") || "Yahoo Finance";
  return aboutFig([
    pol.length && `Policy rates from the central banks' own releases (${pol.map(p => `${esc(p.short)}: ${esc(p.source)}, set ${esc(mpDate(p.set_on))}`).join("; ")}), checked by hand; each card hides once its next decision is due until it is checked again.`,
    R.us10y && `US 10-year yield: ${R.us10y.source === "US Treasury" ? "the US Treasury's daily par yield" : "Yahoo Finance (^TNX), else the US Treasury's daily par yield"}; the change is in percentage points.`,
    LIVE.flows?.value?.day && `Who's buying: NSE's provisional cash-market figures (${esc(LIVE.flows.value.day.scope || "NSE")}); the bar is the day's buying against its selling.`,
    `Indices, Brent, the rupee and Bitcoin: ${esc(lev)}. 7D and 1M as NSE publishes them; † where no source we can reach publishes the figure, it is worked out from daily closes. The lines are a month of daily closes; the dotted line is where the month began.`,
    M?.mood && `Mood: ${Object.values(M.mood).map(m => m?.name).filter(Boolean).map(esc).join(" and ")}, in their own bands.`,
    LIVE.gold_in?.value && "Gold: IBJA's published rate, before GST.",
    LIVE.look_commodities?.value && "Silver, natural gas and copper: front-month COMEX and NYMEX futures on Yahoo Finance, in the contracts' own units.",
  ].filter(Boolean).join(" "));
}

function mpPulse() {
  const M = LIVE.markets?.value, G = LIVE.gold_in?.value, D = E.sections?.ledger?.data || {};
  const rows = mpRates() + mpIndices(M) + (M ? staleNote("markets") : "") + mpCommodities(M);
  if (!rows) return mondayLedger(D);
  let h = mondayLedger(D) + `<div class="mp">${rows}${mpMore(M, G, D)}${mpSources(M)}</div>`;
  const prof = CFG.day_profiles[E.weekday] || {};
  if (prof.markets === "light_unless_important" && !(E.sections?.ledger?.stories?.length)) h = `<details class="mp-wk"><summary class="asof">Weekend: markets folded. Tap to open.</summary>${h}</details>`;
  return h;
}
// if the pulse ever throws, the paper's own block draws instead (and its extras with it), never an empty Ledger
TRIAL_BLOCKS.ledger = () => { try { return mpPulse(); } catch (e) { console.warn("trial money:", e); return ledgerBlock() + ledgerExtras(); } };
TRIAL_BLOCKS.ledgerx = () => ""; // folded into the pulse's "More"
