// The match centre (/match?e=<ESPN event id>&l=<league slug>; the trial's item 7, 27 Nov 2026). A page of its own, opened
// from Madridismo's Last Result card: the score with scorers, the stat boxes, a momentum strip, goals and cards, and the
// commentary, latest first. Everything comes from ESPN's match summary through the paper's own feed
// (/api/live/look_match, lib/look-sport.js), so the page never depends on ESPN answering a browser. A part ESPN does not
// give is left out; a match in play refreshes every minute.
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

  const q = new URLSearchParams(location.search);
  const e = String(q.get("e") || ""), l = String(q.get("l") || "all").toLowerCase();
  const ok = /^\d{5,12}$/.test(e), slug = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(l) ? l : "all";
  let timer = 0, shown = 15;

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

  function head(m) {
    const [h, a] = m.teams, played = m.status?.state !== "pre" && h.score != null && a.score != null;
    const where = [m.league?.name, [m.venue, m.city].filter(Boolean).join(", "), m.date ? day(m.date) : ""].filter(Boolean).join(" · ");
    const pens = h.shootout != null && a.shootout != null ? `<small class="pens">${h.shootout}–${a.shootout} on penalties</small>` : "";
    return `<p class="where">${esc(where)}</p><h1>${esc(h.name)} <span>v</span> ${esc(a.name)}</h1>
<section class="card score" aria-label="Score"><div class="side">${crest(h)}<div><b class="team">${esc(h.short || h.name)}</b>${scorers(h)}</div></div>
<div class="mid">${played ? `<b class="sc">${h.score}<i>–</i>${a.score}</b>` : `<b class="sc v">v</b>`}<small class="st">${status(m)}</small>${pens}</div>
<div class="side r">${crest(a)}<div><b class="team">${esc(a.short || a.name)}</b>${scorers(a)}</div></div></section>`;
  }

  const fmtStat = (k, v) => (k === "possessionPct" ? `${Math.round(v)}` : v.toLocaleString("en-IN"));
  // possession as two whole numbers that add up to 100 (61.5 and 38.5 read 62 and 38)
  const pair = s => (s.key === "possessionPct" ? [Math.round(s.home), 100 - Math.round(s.home)] : [s.home, s.away]);
  function stats(m) {
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
      return `<g><title>${esc(tip)}</title><rect x="${x0.toFixed(1)}" y="${(mid - 1 - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"  fill="${HOME}"/><rect x="${x0.toFixed(1)}" y="${mid + 1}" width="${w.toFixed(1)}" height="${ah.toFixed(1)}"  fill="${AWAY}"/><rect x="${(padX + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"/></g>`;
    }).join("");
    const goals = (M.goals || []).map(g => `<span class="gm ${g.side ? "a" : "h"}" style="left:${(x(g.m + 0.5) / W * 100).toFixed(2)}%" title="${esc(`Goal, ${g.who || m.teams[g.side].short}, ${g.m}’`)}"></span>`).join("");
    const ticks = [0, 15, 30, 45, 60, 75, 90, ...(M.end > 95 ? [105, 120].filter(t => t <= M.end) : [])].map(t => `<span style="left:${(x(t) / W * 100).toFixed(2)}%">${t === 45 ? "HT" : `${t}’`}</span>`).join("");
    const guides = [15, 30, 45, 60, 75, 90].filter(t => t < M.end).map(t => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="20" y2="${H - 20}" class="${t === 45 ? "ht" : ""}"/>`).join("");
    return `<section class="card mom" aria-label="Momentum"><div class="k">Momentum <span>Shots and corners, every ${M.step} minutes</span></div>
<div class="momw"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`Shots and corners by five minutes: ${m.teams[0].short} above the line, ${m.teams[1].short} below; goals marked`)}"><g class="guides">${guides}</g><line class="base" x1="0" x2="${W}" y1="${mid}" y2="${mid}"/>${bars}</svg>${goals}<div class="ticks" aria-hidden="true">${ticks}</div></div>
<p class="legend"><span><i style="background:${HOME}"></i>${esc(m.teams[0].short)}</span><span><i style="background:${AWAY}"></i>${esc(m.teams[1].short)}</span><span><i class="g"></i>Goal</span></p></section>`;
  }

  const MARK = { goal: "Goal", yellow: "Yellow card", red: "Red card" };
  function events(m) {
    if (!m.events?.length) return "";
    return `<section class="card evs" aria-label="Goals and cards"><div class="k">Goals and cards</div><ol>${m.events.map(ev => {
      const t = m.teams[ev.side];
      const what = ev.kind === "goal" ? `${esc(ev.who || "Goal")}${ev.pen ? " (pen)" : ""}${ev.og ? " (own goal)" : ""}${ev.assist ? `<small>Assist ${esc(ev.assist)}</small>` : ""}` : esc(ev.who || "");
      return `<li class="${ev.side ? "a" : "h"}"><span class="mn tnum">${esc(min(ev.minute))}</span><span class="ico ${ev.kind}" role="img" aria-label="${MARK[ev.kind]}"></span><span class="who">${what}</span><span class="tm">${esc(t?.short || "")}</span></li>`;
    }).join("")}</ol></section>`;
  }

  function commentary(m) {
    const C = m.commentary || [];
    if (!C.length) return "";
    const list = C.slice(0, shown);
    return `<section class="card com" aria-label="Commentary"><div class="k">Commentary <span>Latest first</span></div><ol>${list.map(c => `<li class="${esc(c.kind)}"><span class="mn tnum">${esc(min(c.minute || ""))}</span><span class="dot" aria-hidden="true"></span><p>${esc(clean(c.text))}</p></li>`).join("")}</ol>${C.length > shown ? `<button type="button" class="more" id="more">Show every line <span class="tnum">(${C.length})</span></button>` : ""}</section>`;
  }

  function paint(r) {
    const m = r.value;
    document.title = `${m.teams[0].short} ${m.status?.state !== "pre" && m.teams[0].score != null ? `${m.teams[0].score}–${m.teams[1].score}` : "v"} ${m.teams[1].short} · Match centre`;
    const ev = events(m), com = commentary(m);
    $("#m").innerHTML = head(m) + stats(m) + momentum(m) + (ev || com ? `<div class="pair${ev && com ? "" : " one"}">${ev}${com}</div>` : "");
    $("#m").dataset.ready = "1";
    const more = $("#more");
    if (more) more.addEventListener("click", () => { shown = Infinity; paint(r); });
    const f = $("#foot");
    f.hidden = false;
    f.innerHTML = `From ESPN${r.as_of ? ` · as of ${esc(day(r.as_of))}, ${esc(time(r.as_of))} IST` : ""} · <a href="/#d-sport">Back to the Sport desk</a>`;
    clearTimeout(timer);
    if (m.status?.state === "in" || (m.status?.state === "pre" && Date.parse(m.date) - Date.now() < 15 * 6e4)) timer = setTimeout(load, 60e3);
  }
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
