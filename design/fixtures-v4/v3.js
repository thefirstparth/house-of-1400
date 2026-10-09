// 3 · Front page: ranked by what matters now. What finished overnight, as scoreboard tiles; the next fixture as the
// lead, large, with its market; then the rest of the week as one clean table, a day to a band.
function v3Tile(f) {
  const r = f.res;
  if (f.sp === "f1") {
    const [p1, p2, p3] = r.grid;
    return `<article class="tile f1"><header>${ico("f1")}<b>${esc(f.session)}</b><span>${esc(f.ev.short)}</span></header>
      <div class="pod">${[[p2, 2], [p1, 1], [p3, 3]].map(([[c, t], n]) => `<figure class="p${n}">${drvPic(c)}<figcaption><b>${c}</b><span>${t}</span></figcaption><span class="step">${n}</span></figure>`).join("")}</div></article>`;
  }
  const row = k => `<div class="tr${r.win === k ? " w" : " l"}">${pic(f[k].img, "lg", f[k].name)}<span class="nm">${esc(f[k].short)}</span>${r.sets ? r.sets.map(x => `<b class="set${x[k === "a" ? 0 : 1] > x[k === "a" ? 1 : 0] ? " on" : ""}">${x[k === "a" ? 0 : 1]}</b>`).join("") : `<b class="runs">${r[k][0]}</b><span class="ov">${r[k][1]}</span>`}</div>`;
  return `<article class="tile s-${f.sp}"><header>${ico(f.sp)}<b>${esc(f.comp)}</b><span>${esc(f.round)}</span></header>${row("a")}${row("b")}<footer>${r.sets ? `${esc(f[r.win].short)} won in straight sets` : esc(r.line)}</footer></article>`;
}
function v3Hero(f) {
  const m = f.mkt;
  const who = f.sp === "f1" ? `<div class="hw">${pic(f.ev.img, "lg")}<div><b>${esc(f.session)}</b><span>${esc(f.ev.name)} · ${esc(f.ev.place)}</span></div></div>`
    : `<div class="hw">${pic(f.a.img, "lg")}<b>${esc(f.a.short)}</b><span class="v">v</span><b>${esc(f.b.short)}</b>${pic(f.b.img, "lg")}</div>`;
  const mk = m?.field ? `<div class="hm">${m.field.map(([c, p], i) => `<figure class="${i ? "" : "fav"}">${drvPic(c)}<figcaption><b>${DRV[c].last}</b><span>${p}%</span></figcaption><span class="bar"><i style="width:${p}%"></i></span></figure>`).join("")}<p>${src(m)}</p></div>` : "";
  return `<article class="hero s-${f.sp}"><div class="hl"><span class="kick">Next up</span><b class="big">${f.t}</b><span class="cd">${until(f)} · ${dayOf(f.d)}</span></div>
    <div class="hc"><span class="cap">${ico(f.sp)}${SPORT[f.sp]}${tv(f)}</span>${who}</div>${mk}</article>`;
}
function v3Row(f) {
  const s = sides(f);
  const who = f.sp === "f1" ? `${pic(f.ev.img, "lg")}<span class="nm">${esc(f.session)}</span>`
    : `<span class="s">${pic(f.a.img, "lg")}<span class="nm">${esc(f.a.short)}</span></span>${f.state === "live" && f.live.clock ? `<b class="sc">${f.live.a}–${f.live.b}</b>` : `<span class="v">v</span>`}<span class="s">${pic(f.b.img, "lg")}<span class="nm">${esc(f.b.short)}</span></span>`;
  const fav = f.mkt?.field ? `<span class="fv">${drvPic(f.mkt.field[0][0], "ph sm")}${f.mkt.field[0][0]} <b>${f.mkt.field[0][1]}%</b></span>`
    : s ? `<span class="fv">${esc(f[s.fav].short)} <b>${s[s.fav]}%</b></span>` : "";
  const time = f.state === "live" ? `<span class="lv"><i></i>${f.live.clock || "Live"}</span>` : f.state === "tbc" ? "TBC" : f.state === "off" ? `<s>${f.t}</s>` : f.t;
  const end = f.state === "off" ? `<span class="offl">${esc(f.off)}</span>` : f.state === "live" && f.live.line ? `<span class="lvs"><b class="sc">${f.a.abbr} ${f.live.a[0]}</b> <span class="mut">${f.live.a[1]} ov</span></span>` : fav;
  return `<tr class="s-${f.sp} ${f.state}"><td class="t">${time}</td><td class="sp">${ico(f.sp)}</td><td class="fx"><span class="w${f.sp === "f1" ? "" : " vs"}">${who}</span><span class="c">${esc(comp(f))}${where(f) ? ` · ${esc(where(f))}` : ""}</span>${f.state === "live" && f.live.line ? `<span class="c lvl">${esc(f.live.line)}</span>` : ""}</td><td class="tvc">${f.tv ? tv(f) : ""}</td><td class="mk">${end}</td></tr>`;
}
const v3Table = list => `<table class="wk"><tbody>${byDay(list).map(([d, fs]) => `<tr class="dh${d === today ? " today" : ""}"><th colspan="5"><b>${dayOf(d)}</b> ${dateOf(d)}</th></tr>${fs.map(v3Row).join("")}`).join("")}</tbody></table>`;
const v3 = list => {
  const done = list.filter(f => f.state === "done"), rest = list.filter(f => f.state !== "done" && f !== next);
  return `<div class="v3">${done.length ? `<section class="tray"><h4>Overnight</h4><div class="tiles">${done.map(v3Tile).join("")}</div></section>` : ""}
    ${list.includes(next) ? v3Hero(next) : ""}<section class="week"><h4>The week</h4>${v3Table(rest)}</section></div>`;
};
const v3Examples = list => `<div class="v3"><section class="week">${v3Table(list)}</section></div>`;
