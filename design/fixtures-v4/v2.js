// 2 · Scoreboard: each match as two sides facing each other, crest over name, the time or the score large between
// them, the market as one bar under the pair. An F1 session shows its three drivers as photos in team-colour rings.
function v2Side(f, k) {
  const s = f[k], r = f.res, L = f.live;
  const won = r?.win === k ? " w" : r?.win && r.win !== k ? " l" : "";
  const sub = r?.sets ? `<span class="sets">${r.sets.map(x => `<b class="${x[k === "a" ? 0 : 1] > x[k === "a" ? 1 : 0] ? "on" : ""}">${x[k === "a" ? 0 : 1]}</b>`).join("")}</span>`
    : r?.a ? `<span class="runs"><b>${r[k][0]}</b> ${r[k][1]} ov</span>` : L?.a?.[0] ? `<span class="runs"><b>${L[k][0]}</b> ${L[k][1]} ov</span>` : "";
  return `<div class="side ${k}${won}">${pic(s.img, "lg", s.name)}<span class="nm">${esc(s.short)}</span>${sub}</div>`;
}
function v2Mid(f) {
  if (f.state === "live" && f.live.clock) return `<div class="mid live"><b class="big">${f.live.a}–${f.live.b}</b><span class="st"><i></i>${f.live.clock}</span></div>`;
  if (f.state === "live") return `<div class="mid live"><b class="big sm">Live</b><span class="st"><i></i>${f.live.a[1]} ov</span></div>`;
  if (f.state === "done") return `<div class="mid"><b class="big sm">Final</b><span class="st">${f.t}</span></div>`;
  if (f.state === "off") return `<div class="mid off"><b class="big sm">${esc(f.off)}</b><span class="st"><s>${f.t}</s></span></div>`;
  if (f.state === "tbc") return `<div class="mid"><b class="big sm">TBC</b><span class="st">Time to come</span></div>`;
  return `<div class="mid"><b class="big">${f.t}</b>${f === next ? `<span class="st"><em>${until(f)}</em></span>` : ""}</div>`;
}
function v2Market(f) {
  const s = sides(f); if (!s) return "";
  return `<div class="mk"><span class="pa${s.fav === "a" ? " fav" : ""}">${s.a}%</span><span class="bar"><i class="${s.fav === "a" ? "on" : ""}" style="flex:${s.a}"></i>${s.draw != null ? `<i class="d" style="flex:${s.draw}"></i>` : ""}<i class="${s.fav === "b" ? "on" : ""}" style="flex:${s.b}"></i></span><span class="pb${s.fav === "b" ? " fav" : ""}">${s.b}%</span></div>
    <div class="mkf">${s.draw != null ? `<span>Draw ${s.draw}%</span>` : ""}${src(f.mkt)}</div>`;
}
function v2Card(f) {
  const cap = `<header class="cap">${ico(f.sp)}<span>${esc(comp(f))}${where(f) ? ` · ${esc(where(f))}` : ""}</span>${tv(f)}</header>`;
  if (f.sp === "f1") {
    const done = f.state === "done", list = done ? f.res.grid : f.mkt?.field || [];
    return `<article class="s2 f1 s-${f.sp} ${f.state}${f === next ? " nx" : ""}">${cap}
      <div class="ev">${pic(f.ev.img, "lg")}<div class="ses"><b>${esc(f.session)}</b><span>${done ? esc(f.res.label) : f.mkt ? "Who the market favours" : ""}</span></div><div class="mid${done ? "" : ""}"><b class="big${done ? " sm" : ""}">${done ? "Final" : f.t}</b>${done ? `<span class="st">${f.t}</span>` : f === next ? `<span class="st"><em>${until(f)}</em></span>` : ""}</div></div>
      ${list.length ? `<div class="drv">${list.map(([c, v], i) => `<figure>${drvPic(c)}${done ? `<span class="pos">${i + 1}</span>` : ""}<figcaption><b>${c}</b><span>${done ? v : `${v}%`}</span></figcaption></figure>`).join("")}</div>${f.mkt ? `<div class="mkf">${src(f.mkt)}</div>` : ""}` : ""}</article>`;
  }
  const foot = f.state === "done" && f.res.line && !f.res.sets ? `<div class="rl">${esc(f.res.line)}</div>` : f.state === "live" && f.live.line ? `<div class="rl live">${esc(f.live.line)}</div>` : "";
  return `<article class="s2 s-${f.sp} ${f.state}${f === next ? " nx" : ""}">${cap}<div class="vs">${v2Side(f, "a")}${v2Mid(f)}${v2Side(f, "b")}</div>${foot}${f.state === "next" ? v2Market(f) : ""}</article>`;
}
const v2 = list => `<div class="v2">${byDay(list).map(([d, fs]) => `<section class="day${d === today ? " today" : ""}${d < today ? " past" : ""}"><h3><b>${dayOf(d)}</b><span>${dateOf(d)}</span></h3>${fs.map(v2Card).join("")}</section>`).join("")}</div>`;
