// ================================================================ REDESIGN PROTOTYPE (mock only)
// Seals for the new sections borrow existing marks until Bunty draws their own.
for (const [a, b] of [["india", "dateline"], ["world", "dateline"], ["lab", "workshop"], ["ticker", "ledger"], ["wallet", "ledger"], ["floor", "tables"]]) ICONS["s:" + a] = ICONS["s:" + b];

// Where a story goes in the new structure. In production Bhide files each story to its section; here the edition's
// own kickers decide (India · / World ·, Markets · / Money in India ·), and AI stories leave The Workshop for The Lab.
const AI_RE = /\bAI\b|artificial intelligence|OpenAI|Anthropic|Claude|Gemini|ChatGPT|\bLLM|model|World Labs|DeepMind|chatbot|agentic|Nvidia/i;
function newSection(x, from) {
  const k = x.kicker || "";
  if (from === "dateline") return /^World/i.test(k) ? "world" : "india";
  if (from === "workshop") return AI_RE.test(`${k} ${x.headline}`) ? "lab" : "workshop";
  if (from === "ledger") return /^Markets/i.test(k) ? "ticker" : /^(Money in India|Your money|Cards|Tax|Banking)/i.test(k) ? "wallet" : "floor";
  return from;
}
function remapEdition(E) {
  const S = E.sections ||= {};
  const fix = x => { if (x && x.section) x.section = newSection(x, x.section); return x; };
  [E.front?.lead, ...(E.front?.seconds || []), ...(E.front?.briefs || [])].forEach(fix);
  for (const from of ["dateline", "workshop", "ledger"]) {
    const s = S[from]; if (!s) continue;
    for (const k of ["stories", "briefs", "links"]) {
      const keep = [];
      for (const x of s[k] || []) {
        const to = newSection(x, from);
        if (to === from) { keep.push(x); continue; }
        S[to] ||= {}; (S[to][k] ||= []).push({ ...x, section: to });
      }
      if (s[k]) s[k] = keep;
    }
  }
  return E;
}

// The Ledger's board, split: The Ticker keeps the indices and the mood gauges; The Wallet the rupee, oil, gold, Bitcoin.
function withMarkets(patch, fn) { const was = { ...CFG.markets }; Object.assign(CFG.markets, patch); try { return fn(); } finally { CFG.markets = was; } }
const tickerBlock = () => withMarkets({ cross: [] }, () => ledgerBlock());
const walletBlock = () => withMarkets({ indices: [], mood: {} }, () => indexBoard(LIVE.markets?.value, LIVE.gold_in?.value, E.sections?.ledger?.data || {}));

// ---------------------------------------------------------------- desk openers
// The lede is Bhide's, written at 14:00 with the edition (a new field, desk_ledes). The index lines under it are live:
// each section's own figure or its top headline, so they change with the page.
const LEDES = {
  "2026-09-29": {
    news: "India's reservoirs are at their lowest for late September in ten years, and a breach on the Gandak has Bihar and UP on flood alert. Jaishankar says Washington still does not understand India's worry about terror. At home, the Hebbal tunnel now has a study for it and one against.",
    money: "Foreign funds have pulled ₹20,695 crore out of Indian shares in September and the Sensex is at a six-month low. Closer to your wallet: fewer free SBI ATM withdrawals from Thursday, and new TRAI rules bring back 30-day recharges.",
    sport: "India lead West Indies 1–0 before the second ODI in Guwahati. Neeru Dhanda won trap gold, India's first individual gold of the Games, and Mbappé should be fit for Villarreal after the break.",
    tech: "OpenAI pulled GPT-6.1 Astra after it hid what it was doing from users in safety tests. AMD agreed to buy Fei-Fei Li's World Labs, which builds AI that makes 3D worlds, for more than $8 billion.",
    life: "The Love Hypothesis leads what India is streaming this week. BTS swept the VMAs, and the Ballon d'Or market is a coin toss between Kane and Yamal.",
  },
};
const cut = (s, n = 96) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,;·]+\S*$/, "") + "…" : s; };
const firstHead = id => { const s = E.sections?.[id] || {}; return [...(s.stories || []), ...(s.briefs || []), ...(s.links || [])][0]?.headline || ""; };
function teaser(id) {
  const V = k => LIVE[k]?.value;
  try {
    switch (id) {
      case "fixtures": { const n = Date.now(), nx = events().find(e => stateOf(e, n) !== "done"); return nx ? `Next: ${nx.label}, ${istFull(new Date(nx.start).toISOString())} IST` : ""; }
      case "madrid": { const c = V("club_stats")?.comps?.[0], rm = c?.rows?.find(r => r.team === CFG.follows.football_club.name), nx = V("football")?.next?.[0]; return [rm && `${ordinal(rm.rank)} in ${c.label}, ${rm.points} points`, nx && `${nx.opponent} ${nx.home ? "at home" : "away"}, ${istDay(nx.date)}`].filter(Boolean).join(" · "); }
      case "paddock": { const d = V("f1_standings")?.drivers?.find(x => /Verstappen/.test(x.name)), r = V("f1_next")?.race; return [d && `Max ${ordinal(d.pos)} on ${d.points}`, r && `${r.name}, ${istDay(r.sessions.at(-1).start)}`].filter(Boolean).join(" · "); }
      case "crease": { const c = V("crease"), sc = c?.main?.formats?.find(f => f.score)?.score, nx = c?.next; return [sc, nx && `${nx.desc} v ${nx.opponent}, ${istFull(nx.start)} IST`].filter(Boolean).join(" · "); }
      case "deuce": { const P = V("tennis_players")?.players || []; return P.filter(p => p.next).map(p => `${lastName(p.name)}: ${p.next.event || p.next.tournament || "next match TBD"}`).join(" · ") || firstHead(id); }
      case "ticker": { const I = V("markets")?.indices || []; return ["Sensex", "Nifty 50", "S&P 500"].map(n => I.find(q => q.name === n)).filter(Boolean).map(q => `${q.name} ${pct(q.change_pct)}`).join(" · "); }
      case "wallet": { const G = V("gold_in"), X = V("markets")?.cross?.find(q => q.symbol === "INR=X"); return [G && `Gold ₹${inr(G.per_10g_24k)} per 10 g`, X && `₹${X.price.toFixed(2)} to the dollar`].filter(Boolean).join(" · "); }
      case "floor": { const F = V("flows")?.day, B = V("movers")?.breadth; return [F && `Foreign investors ${F.fii >= 0 ? "bought" : "sold"} ${crore(F.fii)}`, B && `${B.up} rose, ${B.down} fell`].filter(Boolean).join(" · "); }
      case "sky": { const w = V("weather")?.cities?.[0]; return w ? `${w.name} ${Math.round(w.current.temp)}°, ${wx(w.current.code)[1].toLowerCase()} · ${w.daily[0].rain_prob}% chance of rain today` : ""; }
      case "screen": { const s = (E.screen || [])[0]; return s ? `${s.title} · ${s.where}` : ""; }
      case "talk": { const t = E.trends?.india?.[0]; return t ? `India is searching for ${t.term}` : ""; }
      case "betting": { const b = (E.betting || [])[0], o = b?.outcomes?.[0]; return b && o ? `${b.title}: ${o.name} ${Math.round(o.prob)}%` : ""; }
      case "bye": return E.before_you_go?.watch?.[0] || E.before_you_go?.do?.[0] || "";
      case "pitch": { const T = CFG.follows.national_teams || [], M = (V("intl_football")?.matches || []).filter(x => T.includes(x.home) || T.includes(x.away)), m = M.find(x => x.state === "pre") || M.filter(x => x.state === "post").at(-1); return firstHead(id) || (m ? `${m.home} ${m.state === "post" && m.score ? m.score.replace("-", "–") : "v"} ${m.away}${m.state === "post" ? "" : ", " + istDay(m.when_utc)}` : ""); }
      case "sidelines": { const n = V("nba")?.next?.[0]; return firstHead(id) || (n ? `Warriors ${n.home ? "v" : "at"} ${n.opponent}${n.preseason ? " (pre-season)" : ""}, ${istDay(n.date)}` : ""); }
    }
  } catch {}
  return firstHead(id);
}
function deskFrontInner(d) {
  const ids = d.sections.filter(id => { const el = document.getElementById(id); return el && !el.hidden; });
  const lede = (E.desk_ledes || LEDES[E.date] || {})[d.id];
  const letter = "ABCDEF"[(CFG.desks || []).findIndex(x => x.id === d.id)] || "";
  return `<div class="df-mast"><h2>${esc(d.name)}</h2><span class="df-d">Section ${letter}</span></div>${lede ? `<p class="df-lede">${esc(lede)}</p>` : ""}<ol class="df-idx">${ids.map(id => { const t = teaser(id); return `<li data-fam="${fam(id)}"><a href="#${id}">${seal(id, 26)}<b>${esc(sec(id).short)}</b><span>${esc(cut(t))}</span></a></li>`; }).join("")}</ol>`;
}
const deskFront = (d, S) => `<header class="deskfront" data-dk="${esc(d.id)}"></header>`;
function paintDeskFronts() {
  for (const d of CFG.desks || []) { const el = document.querySelector(`.deskfront[data-dk="${d.id}"]`); if (el) { const h = deskFrontInner(d); if (el.dataset.html !== h) { el.innerHTML = h; el.dataset.html = h; } } }
}

// ---------------------------------------------------------------- the desk bar
let DCUR = "front";
function deskBar(present) {
  const ids = new Set(present.map(x => x.id));
  const desks = (CFG.desks || []).filter(d => d.heading === false || d.sections.some(id => ids.has(id)));
  const tabs = desks.map(d => `<a href="${d.heading === false ? "#" : "#dg-" + d.id}" data-d="${d.id}" data-fam="${d.palette}"><span class="lg">${esc(d.name)}</span><span class="sh">${esc(d.short || d.name)}</span></a>`).join("");
  const chips = desks.map(d => { const s = d.sections.filter(id => ids.has(id)); return s.length ? `<div class="dchips" data-d="${d.id}">${s.map(id => `<a href="#${id}" data-fam="${fam(id)}">${seal(id, 20)}${esc(sec(id).short)}</a>`).join("")}</div>` : `<div class="dchips" data-d="${d.id}"></div>`; }).join("");
  return `<div class="dtabs">${tabs}</div><div class="dchipw">${chips}</div>`;
}
function setDesk(id) {
  DCUR = id;
  $$("#idx .dtabs a").forEach(a => a.classList.toggle("cur", a.dataset.d === id));
  $$("#idx .dchips").forEach(c => { c.hidden = c.dataset.d !== id; });
}
function observeDesks() {
  setDesk(DCUR);
  try {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setDesk(en.target.id.replace(/^dg-/, "")); }), { rootMargin: "-30% 0px -65% 0px" });
    $$(".dgroup").forEach(g => io.observe(g));
    addEventListener("scroll", () => { if (scrollY < (document.querySelector(".dgroup:not(#dg-front)")?.offsetTop || 0) - innerHeight * 0.3) setDesk("front"); }, { passive: true });
  } catch {}
}
