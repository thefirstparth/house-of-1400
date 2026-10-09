// 1 · Broadsheet: a quality paper's listings page. Type does the work: the time in scoreboard figures, the fixture
// in the paper's serif with its crests or flags, and one typeset line under it for the market or the result.
function v1Line(f) {
  if (f.state === "live" && f.live?.clock) return `<div class="ln live"><b class="sc">${f.live.a}–${f.live.b}</b> <span class="lv">${f.live.clock}</span></div>`;
  if (f.state === "live") return `<div class="ln live inn"><span class="sc">${f.a.abbr} ${f.live.a[0]} <small>${f.live.a[1]} ov</small></span><span class="sc dim">${f.b.abbr} ${f.live.b[0]} <small>${f.live.b[1]} ov</small></span><span class="note">${esc(f.live.line)}</span></div>`;
  if (f.state === "off") return `<div class="ln off">${esc(f.off)}</div>`;
  if (f.state === "done") {
    const r = f.res;
    if (r.grid) return `<div class="ln"><span class="lab">${esc(r.label)}</span><div class="tim">${r.grid.map(([c, t], i) => `<span class="tr"><span class="sc p">${i + 1}</span>${drvPic(c)}<b>${c}</b><span class="nm">${esc(DRV[c].last)}</span><span class="sc">${t}</span></span>`).join("")}</div></div>`;
    const w = f[r.win];
    if (r.sets) return `<div class="ln"><span><b>${esc(w.short)}</b> won <span class="sc">${r.sets.map(s => r.win === "a" ? `${s[0]}–${s[1]}` : `${s[1]}–${s[0]}`).join(" ")}</span></span></div>`;
    return `<div class="ln"><b>${esc(r.line)}</b><span class="sc card">${f.a.abbr} ${r.a[0]} <small>(${r.a[1]})</small> · ${f.b.abbr} ${r.b[0]} <small>(${r.b[1]})</small></span></div>`;
  }
  const m = f.mkt; if (!m) return "";
  if (m.field) return `<div class="ln mk"><div class="g3">${m.field.map(([c, p], i) => `<span class="g${i ? "" : " fav"}">${drvPic(c)}<span><b>${c}</b><span class="sc">${p}%</span></span></span>`).join("")}</div>${src(m)}</div>`;
  const s = sides(f);
  return `<div class="ln mk"><span class="split" aria-hidden="true"><i class="${s.fav === "a" ? "on" : ""}" style="flex:${s.a}"></i>${s.draw != null ? `<i class="d" style="flex:${s.draw}"></i>` : ""}<i class="${s.fav === "b" ? "on" : ""}" style="flex:${s.b}"></i></span>
    <span class="o${s.fav === "a" ? " fav" : ""}">${esc(f.a.short)} <span class="sc">${s.a}%</span></span>${s.draw != null ? `<span class="o">Draw <span class="sc">${s.draw}%</span></span>` : ""}<span class="o${s.fav === "b" ? " fav" : ""}">${esc(f.b.short)} <span class="sc">${s.b}%</span></span>${src(m)}</div>`;
}
function v1Row(f) {
  const time = f.state === "live" ? `<span class="tm live"><i></i>Live</span>` : f.state === "tbc" ? `<span class="tm tbc">TBC</span>` : `<span class="tm${f.state === "off" ? " off" : ""}">${f.t}${f === next ? `<em class="in">${until(f)}</em>` : ""}</span>`;
  const who = f.sp === "f1" ? `${pic(f.ev.img, "lg")}<span>${esc(f.session)}</span>`
    : `<span class="sd${f.res?.win === "a" ? " w" : f.res?.win === "b" ? " l" : ""}">${pic(f.a.img, "lg", f.a.name)}${esc(f.a.short)}</span><span class="v">v</span><span class="sd${f.res?.win === "b" ? " w" : f.res?.win === "a" ? " l" : ""}">${pic(f.b.img, "lg", f.b.name)}${esc(f.b.short)}</span>`;
  return `<li class="b1 s-${f.sp} ${f.state}${f === next ? " nx" : ""}">${time}<div class="bd">
    <div class="kk">${ico(f.sp)}<b>${SPORT[f.sp]}</b><span>${esc(comp(f))}${where(f) ? ` · ${esc(where(f))}` : ""}</span>${tv(f)}</div>
    <div class="who">${who}</div>${v1Line(f)}</div></li>`;
}
const v1 = list => `<div class="v1">${byDay(list).map(([d, fs]) => `<section class="day${d === today ? " today" : ""}${d < today ? " past" : ""}"><h3><span class="w">${dayOf(d)}</span><span class="dt">${dateOf(d)}</span></h3><ol>${fs.map(v1Row).join("")}</ol></section>`).join("")}</div>`;
