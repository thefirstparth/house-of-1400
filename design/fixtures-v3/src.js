// Three ways to set the Fixture List from the same rows (data.js). Built into #A, #B and #C.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ico = sp => `<i class="ico">${ICON[sp]}</i>`;
const where = f => [f.sub, f.tv && `on ${f.tv}`].filter(Boolean).map(esc).join(" · ");
const src = o => `<span class="src">${esc(o.src)} ${ASOF}</span>`;
// The market as one bar: each outcome its share; a race's top three leave the rest of the field as a quiet tail.
const bar = o => `<span class="bar${o.field ? " field" : ""}">${o.o.map(([n, p], i) => `<i class="s${i}" style="flex:${p}"></i>`).join("")}${o.field ? `<i class="rest" style="flex:${Math.max(0, 100 - o.o.reduce((a, [, p]) => a + p, 0))}"></i>` : ""}</span>`;
const podium = p => `<span class="pod">${p.map((n, i) => `<span><b>${i + 1}</b>${esc(n)}</span>`).join("")}</span>`;

// A · Listings, tidied: the same columns, one colour (the desk's), each row in three steps: what, where, the number.
function A() {
  return DAYS.map(d => `<section class="day${d.today ? " today" : ""}${d.past ? " past" : ""}"><h3>${esc(d.day)} <span>${esc(d.date)}</span></h3><ol>${d.items.map(f => `
    <li class="${f.done ? "done" : ""}"><span class="tm tnum">${f.t}</span><div class="bd">
      <div class="kick">${ico(f.sp)}${SPORT[f.sp]}</div>
      <div class="ti">${esc(f.title)}</div><div class="meta">${where(f)}</div>
      ${f.done ? `<div class="res"><span class="fin">Final</span>${f.done.podium ? podium(f.done.podium) : `<b>${esc(f.done.head)}</b>${f.done.score ? ` <span class="tnum sc">${esc(f.done.score)}</span>` : ""}`}</div>` : ""}
      ${f.odds ? `<div class="odds">${bar(f.odds)}<div class="ol">${f.odds.o.map(([n, p], i) => `<span class="${i ? "" : "lead"}"><b class="tnum">${p}%</b> ${esc(n)}</span>`).join("")}${src(f.odds)}</div></div>` : ""}
    </div></li>`).join("")}</ol></section>`).join("");
}

// B · Ticket stubs: each fixture a stub torn from a programme, the time and the sport on the stub, a stamp once it is over.
function B() {
  return DAYS.map(d => `<section class="day${d.today ? " today" : ""}${d.past ? " past" : ""}"><h3><b>${esc(d.day)}</b> ${esc(d.date)}</h3>${d.items.map(f => `
    <article class="tk sp-${f.sp}${f.done ? " done" : ""}"><div class="stub"><span class="tm tnum">${f.t}</span>${ico(f.sp)}<span class="spn">${SPORT[f.sp]}</span></div><div class="bd">
      <div class="ti">${esc(f.title)}</div><div class="meta">${where(f)}</div>
      ${f.done ? `<div class="res">${f.done.podium ? podium(f.done.podium) : `<b>${esc(f.done.head)}</b>${f.done.score ? `<span class="tnum sc">${esc(f.done.score)}</span>` : ""}`}</div><span class="stamp">Final</span>` : ""}
      ${f.odds ? `<div class="chips">${f.odds.o.map(([n, p], i) => `<span class="chip${i ? "" : " lead"}"><b class="tnum">${p}%</b> ${esc(n)}</span>`).join("")}${src(f.odds)}</div>` : ""}
    </div></article>`).join("")}</section>`).join("");
}

// C · The day's line: each day a rail with its fixtures as stops, a sport's colour on each, the moment we are at marked.
function C() {
  return DAYS.map(d => `<section class="day${d.today ? " today" : ""}${d.past ? " past" : ""}"><h3><span class="dn">${esc(d.date.split(" ")[0])}</span><span class="dw"><b>${esc(d.day)}</b>${esc(d.date.split(" ")[1])}</span></h3><ol>${d.today ? `<li class="now"><span class="tm tnum">${ASOF}</span><span class="nl">Now</span></li>` : ""}${d.items.map(f => `
    <li class="sp-${f.sp}${f.done ? " done" : ""}"><span class="tm tnum">${f.t}</span><span class="dot">${f.done ? '<svg viewBox="0 0 12 12"><path d="M3 6.2l2 2 4-4.4"/></svg>' : ""}</span><div class="bd">
      <div class="kick">${ico(f.sp)}${SPORT[f.sp]}</div>
      <div class="ti">${esc(f.title)}</div><div class="meta">${where(f)}</div>
      ${f.done ? `<div class="res">${f.done.podium ? podium(f.done.podium) : `<b>${esc(f.done.head)}</b>${f.done.score ? `<span class="tnum sc">${esc(f.done.score)}</span>` : ""}`}</div>` : ""}
      ${f.odds ? `<div class="odds">${bar(f.odds)}<div class="ol">${f.odds.o.map(([n, p], i) => `<span class="${i ? "" : "lead"}"><b class="tnum">${p}</b> ${esc(n)}</span>`).join("")}${src(f.odds)}</div></div>` : ""}
    </div></li>`).join("")}</ol></section>`).join("");
}

for (const [id, fn] of [["A", A], ["B", B], ["C", C]]) document.querySelector(`#${id} .agenda`).innerHTML = fn();
document.getElementById("phone").onclick = e => { const on = document.body.classList.toggle("phone"); e.target.textContent = on ? "Laptop width" : "Phone width"; };
document.getElementById("theme").onclick = e => { const r = document.documentElement, dark = r.dataset.theme !== "dark"; r.dataset.theme = dark ? "dark" : "light"; e.target.textContent = dark ? "Day page" : "Night page"; };
