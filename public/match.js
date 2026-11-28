// The match centre (/match?e=<ESPN event id>&l=<league slug>; the trial's item 7, 27 Nov 2026; views 28 Nov). A page of
// its own, opened from Madridismo's Last Result card, never on the homepage. The score with scorers stays on top; under
// it, four views (the address keeps the one open, #stats, #lineups, #commentary, so it can be shared or reloaded):
//   Match       the stat boxes, the momentum strip, goals and cards, the latest commentary; before kick-off, each side's
//               last five results
//   Stats       every figure ESPN has for both sides, and the shot map (each shot where it was taken, on the goal aimed at)
//   Line-ups    both sides on one pitch in their formations, then the benches
//   Commentary  every line, or the key moments only
// Everything comes from ESPN's match summary through the paper's own feed (/api/live/look_match, lib/look-sport.js), so
// the page never depends on ESPN answering a browser. A view ESPN gives nothing for is not offered; a match in play
// refreshes every minute.
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // ESPN's words, with no em dash (the paper's rule) and its straight minute marks curled
  const clean = s => String(s ?? "").replace(/\s*—\s*/g, ", ").replace(/–(?=\D)/g, "-");
  const min = s => String(s ?? "").replace(/'/g, "’");
  const TZ = "Asia/Kolkata";
  const day = iso => new Date(iso).toLocaleString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).replace(/,/g, "").replace(/\bSept\b/, "Sep");
  const time = iso => new Date(iso).toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const HOME = "#a9400c", AWAY = "#2e6da4"; // the Sport desk's orange and a blue, checked for colour-blind separation
  const SIDE = ["h", "a"];

  const q = new URLSearchParams(location.search);
  const e = String(q.get("e") || ""), l = String(q.get("l") || "all").toLowerCase();
  const ok = /^\d{5,12}$/.test(e), slug = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(l) ? l : "all";
  let timer = 0, last = null, keyOnly = false;
  const VIEWS = [["match", "Match"], ["stats", "Stats"], ["lineups", "Line-ups"], ["commentary", "Commentary"]];
  const hashView = () => { const h = location.hash.replace(/^#/, ""); return VIEWS.some(([k]) => k === h) ? h : "match"; };
  let view = hashView();

  const crest = (t, size = 64) => {
    if (!t.logo || !/^https:\/\/a\.espncdn\.com\//.test(t.logo)) return "";
    const src = `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(new URL(t.logo).pathname)}&h=${size * 2}&w=${size * 2}`;
    return `<img class="crest" src="${esc(src)}" width="${size}" height="${size}" alt="${esc(t.name)} crest" decoding="async">`;
  };
  // "Mbappé 64’, 84’"; a surname alone, unless the name ends in Júnior, Filho or the like (Vinícius Júnior stays whole)
  const who = n => { const w = String(n || "").trim().split(/\s+/); return w.length > 1 && /^(j[uú]nior|jr\.?|filho|neto|sobrinho)$/i.test(w[w.length - 1]) ? w.join(" ") : w[w.length - 1] || ""; };
  const scorers = t => {
    if (!t.scorers?.length) return "";
    const by = new Map();
    for (const s of t.scorers) { const k = who(s.who) + (s.og ? " og" : ""); if (!by.has(k)) by.set(k, []); by.get(k).push(min(s.minute) + (s.pen ? " pen" : "")); }
    return `<p class="scr">${[...by].map(([k, ms]) => `${esc(k.replace(/ og$/, ""))} ${esc(ms.join(", "))}${k.endsWith(" og") ? " og" : ""}`).join("; ")}</p>`;
  };
  const status = m => {
    const s = m.status || {};
    if (s.state === "in") return `<span class="live"><i></i>Live${s.detail ? ` · ${esc(min(s.detail))}` : ""}</span>`;
    if (s.completed) return esc(s.description === "Full Time" || s.detail === "FT" ? "Full time" : s.description || s.detail || "Full time");
    if (s.state === "pre" && m.date) return `${esc(day(m.date))}, ${esc(time(m.date))} IST`;
    return esc(s.description || s.detail || "");
  };
  const keyOf = (label, cls = "") => `<i class="sw ${cls}" style="background:${label}"></i>`;
  const legendTeams = m => `<span>${keyOf(HOME)}${esc(m.teams[0].short)}</span><span>${keyOf(AWAY)}${esc(m.teams[1].short)}</span>`;

  function head(m) {
    const [h, a] = m.teams, played = m.status?.state !== "pre" && h.score != null && a.score != null;
    const where = [m.league?.name, [m.venue, m.city].filter(Boolean).join(", "), m.date ? day(m.date) : ""].filter(Boolean).join(" · ");
    const pens = h.shootout != null && a.shootout != null ? `<small class="pens">${h.shootout}–${a.shootout} on penalties</small>` : "";
    return `<p class="where">${esc(where)}</p><h1>${esc(h.name)} <span>v</span> ${esc(a.name)}</h1>
<section class="card score" aria-label="Score"><div class="side">${crest(h)}<div><b class="team">${esc(h.short || h.name)}</b>${scorers(h)}</div></div>
<div class="mid">${played ? `<b class="sc">${h.score}<i>–</i>${a.score}</b>` : `<b class="sc v">v</b>`}<small class="st">${status(m)}</small>${pens}</div>
<div class="side r">${crest(a)}<div><b class="team">${esc(a.short || a.name)}</b>${scorers(a)}</div></div></section>`;
  }

  // ---------- Match view ----------
  const fmtStat = (k, v) => (k === "possessionPct" ? `${Math.round(v)}` : v.toLocaleString("en-IN"));
  // possession as two whole numbers that add up to 100 (61.5 and 38.5 read 62 and 38)
  const pair = s => (s.key === "possessionPct" ? [Math.round(s.home), 100 - Math.round(s.home)] : [s.home, s.away]);
  function tiles(m) {
    if (!m.stats?.length) return "";
    return `<section class="stats" aria-label="Match stats">${m.stats.map(s => {
      const tot = s.home + s.away, f = tot ? s.home / tot : 0.5, [vh, va] = pair(s);
      return `<div class="card stat"><div class="sl">${esc(s.label)}${s.key === "possessionPct" ? " %" : ""}</div><div class="sv"><b class="tnum">${esc(fmtStat(s.key, vh))}</b><b class="tnum">${esc(fmtStat(s.key, va))}</b></div>
<div class="bar" role="img" aria-label="${esc(`${s.label}: ${m.teams[0].short} ${fmtStat(s.key, vh)}, ${m.teams[1].short} ${fmtStat(s.key, va)}`)}"><i style="flex:${f.toFixed(3)};background:${HOME}"></i><i style="flex:${(1 - f).toFixed(3)};background:${AWAY}"></i></div></div>`;
    }).join("")}</section>`;
  }

  // shots and corners by five minutes: the home side above the line, the away side below; goals marked at the edge
  function momentum(m) {
    const M = m.momentum;
    if (!M?.buckets?.length) return "";
    const W = 900, H = 200, mid = 100, padX = 4, n = M.buckets.length, bw = (W - 2 * padX) / n;
    const peak = Math.max(3, ...M.buckets.map(b => Math.max(b.home, b.away))), unit = (mid - 34) / peak;
    const x = minute => padX + Math.min(minute, M.end) / M.end * (W - 2 * padX);
    const bars = M.buckets.map((b, i) => {
      const x0 = padX + i * bw + 1.5, w = Math.max(2, bw - 3), hh = b.home * unit, ah = b.away * unit;
      const tip = `${b.from}’ to ${b.from + M.step}’: ${m.teams[0].short} ${b.home}, ${m.teams[1].short} ${b.away}`;
      return `<g><title>${esc(tip)}</title><rect x="${x0.toFixed(1)}" y="${(mid - 1 - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${HOME}"/><rect x="${x0.toFixed(1)}" y="${mid + 1}" width="${w.toFixed(1)}" height="${ah.toFixed(1)}" fill="${AWAY}"/><rect x="${(padX + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"/></g>`;
    }).join("");
    const goals = (M.goals || []).map(g => `<span class="gm ${g.side ? "a" : "h"}" style="left:${(x(g.m + 0.5) / W * 100).toFixed(2)}%" title="${esc(`Goal, ${g.who || m.teams[g.side].short}, ${g.m}’`)}"></span>`).join("");
    const ticks = [0, 15, 30, 45, 60, 75, 90, ...(M.end > 95 ? [105, 120].filter(t => t <= M.end) : [])].map(t => `<span style="left:${(x(t) / W * 100).toFixed(2)}%">${t === 45 ? "HT" : `${t}’`}</span>`).join("");
    const guides = [15, 30, 45, 60, 75, 90].filter(t => t < M.end).map(t => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="20" y2="${H - 20}" class="${t === 45 ? "ht" : ""}"/>`).join("");
    return `<section class="card mom" aria-label="Momentum"><div class="k">Momentum <span>Shots and corners, every ${M.step} minutes</span></div>
<div class="momw"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`Shots and corners by five minutes: ${m.teams[0].short} above the line, ${m.teams[1].short} below; goals marked`)}"><g class="guides">${guides}</g><line class="base" x1="0" x2="${W}" y1="${mid}" y2="${mid}"/>${bars}</svg>${goals}<div class="ticks" aria-hidden="true">${ticks}</div></div>
<p class="legend">${legendTeams(m)}<span><i class="sw g"></i>Goal</span></p></section>`;
  }

  const MARK = { goal: "Goal", yellow: "Yellow card", red: "Red card" };
  function events(m) {
    if (!m.events?.length) return "";
    return `<section class="card evs" aria-label="Goals and cards"><div class="k">Goals and cards</div><ol>${m.events.map(ev => {
      const t = m.teams[ev.side];
      const what = ev.kind === "goal" ? `${esc(ev.who || "Goal")}${ev.pen ? " (pen)" : ""}${ev.og ? " (own goal)" : ""}${ev.assist ? `<small>Assist ${esc(ev.assist)}</small>` : ""}` : esc(ev.who || "");
      return `<li class="${SIDE[ev.side]}"><span class="mn tnum">${esc(min(ev.minute))}</span><span class="ico ${ev.kind}" role="img" aria-label="${MARK[ev.kind]}"></span><span class="who">${what}</span><span class="tm">${esc(t?.short || "")}</span></li>`;
    }).join("")}</ol></section>`;
  }

  const KEY = new Set(["goal", "red", "yellow", "sub", "whistle", "var"]);
  const lines = list => `<ol>${list.map(c => `<li class="${esc(c.kind)}"><span class="mn tnum">${esc(min(c.minute || ""))}</span><span class="dot" aria-hidden="true"></span><p>${esc(clean(c.text))}</p></li>`).join("")}</ol>`;
  function latest(m) {
    const C = m.commentary || [];
    if (!C.length) return "";
    return `<section class="card com" aria-label="Commentary"><div class="k">Commentary <span>Latest first</span></div>${lines(C.slice(0, 8))}${C.length > 8 ? `<button type="button" class="more" data-go="commentary">Every line <span class="tnum">(${C.length})</span></button>` : ""}</section>`;
  }

  // before kick-off: each side's last five, latest first
  function form(m) {
    if (!m.form || m.status?.state !== "pre") return "";
    const row = i => (m.form[i] ? `<div class="fr"><span class="fn">${crest(m.teams[i], 24)}${esc(m.teams[i].short)}</span><span class="pills">${m.form[i].map(r => `<b class="pill ${r}" aria-label="${r === "W" ? "Won" : r === "D" ? "Drew" : "Lost"}">${r}</b>`).join("")}</span></div>` : "");
    return `<section class="card form" aria-label="Form"><div class="k">Form <span>Last five, latest first</span></div>${row(0)}${row(1)}</section>`;
  }

  function vMatch(m) {
    const ev = events(m), com = latest(m);
    return form(m) + tiles(m) + momentum(m) + (ev || com ? `<div class="pair${ev && com ? "" : " one"}">${ev}${com}</div>` : "");
  }

  // ---------- Stats view ----------
  function statList(m) {
    const S = m.statsAll || [];
    if (S.length < 4) return "";
    return `<section class="card sl2" aria-label="Every figure"><div class="k">Match stats <span>${esc(m.teams[0].abbr || m.teams[0].short)} v ${esc(m.teams[1].abbr || m.teams[1].short)}</span></div><ul>${S.map(s => {
      const [vh, va] = pair(s), top = Math.max(vh, va) || 1, txt = v => (s.key === "possessionPct" ? `${v}%` : v.toLocaleString("en-IN"));
      return `<li><div class="sr"><b class="tnum${vh > va ? " lead" : ""}">${esc(txt(vh))}</b><span>${esc(s.label)}</span><b class="tnum${va > vh ? " lead" : ""}">${esc(txt(va))}</b></div>
<div class="sb" role="img" aria-label="${esc(`${s.label}: ${m.teams[0].short} ${txt(vh)}, ${m.teams[1].short} ${txt(va)}`)}"><span><i style="width:${(vh / top * 100).toFixed(1)}%;background:${HOME}"></i></span><span><i style="width:${(va / top * 100).toFixed(1)}%;background:${AWAY}"></i></span></div></li>`;
    }).join("")}</ul></section>`;
  }
  // the pitch markings, drawn in a 100-wide box (the whole pitch 100 x 150, half of it 100 x 68)
  const HALF = `<rect x="1" y="1" width="98" height="66" /><rect x="21" y="1" width="58" height="25" /><rect x="37" y="1" width="26" height="9" /><path d="M38.5 26a12 12 0 0 0 23 0" /><path d="M44 1h12" class="gl" /><circle cx="50" cy="18" r=".7" class="spot" />`;
  function shotMap(m) {
    const S = m.shots || [];
    if (S.length < 5) return "";
    const pts = S.map(s => {
      const cx = (100 - s.y).toFixed(1), cy = ((100 - s.x) * 1.36 + 1).toFixed(1), c = s.side ? AWAY : HOME;
      const tip = `${s.who || m.teams[s.side].short}${s.m != null ? `, ${s.m}’` : ""}: ${s.out === "goal" ? "goal" : s.out === "on" ? "on target" : s.out === "post" ? "hit the woodwork" : s.out === "blocked" ? "blocked" : "off target"}`;
      return s.out === "goal" ? `<g><title>${esc(tip)}</title><circle cx="${cx}" cy="${cy}" r="3.4" fill="none" stroke="${c}" stroke-width=".7"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="${c}"/></g>`
        : s.out === "on" ? `<circle cx="${cx}" cy="${cy}" r="1.7" fill="${c}" fill-opacity=".85"><title>${esc(tip)}</title></circle>`
        : `<circle cx="${cx}" cy="${cy}" r="1.5" fill="#fff" fill-opacity=".7" stroke="${c}" stroke-width=".55"><title>${esc(tip)}</title></circle>`;
    }).join("");
    const n = [0, 1].map(i => S.filter(s => s.side === i).length);
    return `<section class="card shots" aria-label="Shot map"><div class="k">Shot map <span>${S.length} shots with a place</span></div>
<div class="pitchw half"><svg viewBox="0 0 100 68" role="img" aria-label="${esc(`Where the shots were taken, all drawn on one goal: ${m.teams[0].short} ${n[0]}, ${m.teams[1].short} ${n[1]}`)}"><g class="mk">${HALF}</g>${pts}</svg></div>
<p class="legend">${legendTeams(m)}<span><i class="sw ring"></i>Goal</span><span><i class="sw solid"></i>On target</span><span><i class="sw hollow"></i>Off target or blocked</span></p></section>`;
  }
  function vStats(m) {
    const a = statList(m), b = shotMap(m);
    return a || b ? `<div class="pair even${a && b ? "" : " one"}">${a}${b}</div>` : "";
  }

  // ---------- Line-ups view ----------
  const ACROSS = { 1: [50], 2: [32, 68], 3: [20, 50, 80], 4: [13, 38, 62, 87], 5: [10, 30, 50, 70, 90], 6: [8, 24, 41, 59, 76, 92] };
  const marks = p => `${p.goals ? `<i class="mg" role="img" aria-label="${p.goals > 1 ? `${p.goals} goals` : "Scored"}"></i>${p.goals > 1 ? `<small>${p.goals}</small>` : ""}` : ""}${p.red ? `<i class="mr" role="img" aria-label="Sent off"></i>` : p.yellow ? `<i class="my" role="img" aria-label="Booked"></i>` : ""}`;
  function pitch(m) {
    const L = m.lineups || [];
    if (!L[0] && !L[1]) return "";
    const dots = [0, 1].flatMap(side => {
      const lu = L[side];
      if (!lu) return [];
      const n = lu.lines.length;
      return lu.lines.flatMap((row, li) => row.map((p, pi) => {
        const depth = 4 + li / Math.max(1, n - 1) * 40.5, across = (ACROSS[row.length] || ACROSS[4])[pi] ?? 50;
        // the home side defends the bottom goal, the away side the top one (so its left is the screen's right)
        const top = side ? depth : 100 - depth, left = side ? 100 - across : across;
        return `<div class="pl ${SIDE[side]}${p.off ? " off" : ""}" style="left:${left}%;top:${top.toFixed(2)}%"><b class="no tnum">${esc(p.no)}</b><span class="nm">${esc(p.short)}${marks(p)}</span></div>`;
      }));
    }).join("");
    return `<div class="pitchw full"><svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><g class="mk"><rect x="1" y="1" width="98" height="148" /><line x1="1" y1="75" x2="99" y2="75" /><circle cx="50" cy="75" r="11" /><rect x="21" y="1" width="58" height="22" /><rect x="37" y="1" width="26" height="8" /><rect x="21" y="127" width="58" height="22" /><rect x="37" y="141" width="26" height="8" /></g></svg>${dots}</div>`;
  }
  function bench(m, side) {
    const lu = m.lineups?.[side], t = m.teams[side];
    if (!lu) return `<div class="bench"></div>`;
    const starters = lu.lines.flat(), off = starters.filter(p => p.off), booked = starters.concat(lu.bench).filter(p => p.yellow || p.red);
    const row = p => `<li class="${p.on ? "on" : ""}"><span class="no tnum">${esc(p.no)}</span><span class="bn">${esc(p.name)}</span><span class="bm">${p.on ? `<i class="in" role="img" aria-label="Came on"></i>` : ""}${marks(p)}</span></li>`;
    return `<div class="bench ${SIDE[side]}"><div class="bh">${keyOf(side ? AWAY : HOME)}${crest(t, 22)}<b>${esc(t.short)}</b><span class="tnum">${esc(lu.formation)}</span></div>
${off.length ? `<div class="bk">Went off</div><p class="bl">${off.map(p => esc(p.short)).join(", ")}</p>` : ""}
${lu.bench.length ? `<div class="bk">Substitutes</div><ul>${lu.bench.map(row).join("")}</ul>` : ""}</div>`;
  }
  function vLineups(m) {
    const p = pitch(m);
    if (!p) return "";
    return `<section class="card lus" aria-label="Line-ups"><div class="k">Line-ups <span>${esc(m.teams[0].short)} from the bottom, ${esc(m.teams[1].short)} from the top</span></div>
<div class="lu">${bench(m, 0)}${p}${bench(m, 1)}</div>
<p class="legend"><span><i class="mg"></i>Scored</span><span><i class="my"></i>Booked</span><span><i class="in"></i>Came on</span><span><i class="sw faded"></i>Went off</span></p></section>`;
  }

  // ---------- Commentary view ----------
  function vCommentary(m) {
    const C = m.commentary || [];
    if (!C.length) return "";
    const list = keyOnly ? C.filter(c => KEY.has(c.kind)) : C;
    return `<section class="card com" aria-label="Commentary"><div class="k">Commentary <span class="seg" role="group" aria-label="Which lines"><button type="button" data-key="0" aria-pressed="${!keyOnly}">Every line</button><button type="button" data-key="1" aria-pressed="${keyOnly}">Key moments</button></span></div>${lines(list)}</section>`;
  }

  const BUILD = { match: vMatch, stats: vStats, lineups: vLineups, commentary: vCommentary };
  function paint(r) {
    const m = r.value;
    last = r;
    document.title = `${m.teams[0].short} ${m.status?.state !== "pre" && m.teams[0].score != null ? `${m.teams[0].score}–${m.teams[1].score}` : "v"} ${m.teams[1].short} · Match centre`;
    const have = VIEWS.filter(([k]) => BUILD[k](m));
    if (!have.some(([k]) => k === view)) view = have[0]?.[0] || "match";
    const tabs = have.length > 1 ? `<nav class="tabs" role="tablist" aria-label="Match views">${have.map(([k, label]) => `<button type="button" role="tab" id="t-${k}" aria-controls="view" aria-selected="${k === view}" tabindex="${k === view ? 0 : -1}" data-view="${k}">${label}</button>`).join("")}</nav>` : "";
    $("#m").innerHTML = head(m) + tabs + `<div id="view" role="tabpanel"${tabs ? ` aria-labelledby="t-${view}"` : ""}>${BUILD[view](m)}</div>`;
    $("#m").dataset.ready = "1";
    const f = $("#foot");
    f.hidden = false;
    f.innerHTML = `From ESPN${r.as_of ? ` · as of ${esc(day(r.as_of))}, ${esc(time(r.as_of))} IST` : ""} · <a href="/#d-sport">Back to the Sport desk</a>`;
    clearTimeout(timer);
    if (m.status?.state === "in" || (m.status?.state === "pre" && Date.parse(m.date) - Date.now() < 15 * 6e4)) timer = setTimeout(load, 60e3);
  }
  function go(k, focus) {
    view = k;
    history.replaceState(null, "", `${location.pathname}${location.search}${k === "match" ? "" : `#${k}`}`);
    if (last) paint(last);
    if (focus) $(`#t-${k}`)?.focus();
  }
  document.addEventListener("click", ev => {
    const t = ev.target.closest?.("[data-view],[data-go],[data-key]");
    if (!t) return;
    if (t.dataset.view) go(t.dataset.view);
    else if (t.dataset.go) { go(t.dataset.go); $(".tabs")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
    else { keyOnly = t.dataset.key === "1"; if (last) paint(last); }
  });
  // arrow keys move along the tabs
  document.addEventListener("keydown", ev => {
    const t = ev.target.closest?.("[role=tab]");
    if (!t || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(ev.key)) return;
    const all = [...document.querySelectorAll("[role=tab]")], i = all.indexOf(t);
    const n = ev.key === "Home" ? 0 : ev.key === "End" ? all.length - 1 : (i + (ev.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
    ev.preventDefault();
    go(all[n].dataset.view, true);
  });
  addEventListener("hashchange", () => { const v = hashView(); if (v !== view) { view = v; if (last) paint(last); } });

  function none(text) {
    $("#m").innerHTML = `<div class="card none"><p>${esc(text)}</p><p><a href="/#d-sport">Back to the Sport desk</a></p></div>`;
  }
  async function load() {
    if (!ok) return none("This link does not name a match.");
    try {
      const res = await fetch(`/api/live/look_match?e=${encodeURIComponent(e)}&l=${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } });
      const r = await res.json();
      if (!r?.ok || !r.value?.teams?.length) throw new Error(r?.error || "no match");
      paint(r);
    } catch {
      if (!$("#m").dataset.ready) none("ESPN has not sent this match. Try again in a few minutes.");
    }
  }
  load();
})();
