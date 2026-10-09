// The Fixture List, round 2: way 1 (Listings, tidied) and three variations on it, from the same rows (data.js).
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ico = sp => `<i class="ico">${ICON[sp]}</i>`;
const where = f => [f.sub, f.tv && `on ${f.tv}`].filter(Boolean).map(esc).join(" · ");
const src = o => `<span class="src">${esc(o.src)} ${ASOF}</span>`;
const bar = o => `<span class="bar${o.field ? " field" : ""}">${o.o.map(([n, p], i) => `<i class="s${i}" style="flex:${p}"></i>`).join("")}${o.field ? `<i class="rest" style="flex:${Math.max(0, 100 - o.o.reduce((a, [, p]) => a + p, 0))}"></i>` : ""}</span>`;
const podium = p => `<span class="pod">${p.map((n, i) => `<span><b>${i + 1}</b>${esc(n)}</span>`).join("")}</span>`;
const result = (f, inline) => f.done.podium ? podium(f.done.podium) : `<b>${esc(f.done.head)}</b>${f.done.score ? `${inline ? " " : ""}<span class="tnum sc">${esc(f.done.score)}</span>` : ""}`;

// o.odds: "bar" (a bar, then the names) or "text" (one line of names and prices, the favourite in colour)
// o.big: the day's date as a big numeral; o.sport: each sport in its own colour; o.focus: today set apart, finished
// fixtures as one line each
function L(o) {
  const odds = f => !f.odds ? "" : o.odds === "text"
    ? `<div class="odds text"><span class="ol">${f.odds.o.map(([n, p], i) => `<span class="${i ? "" : "lead"}">${esc(n)} <b class="tnum">${p}%</b></span>`).join("")}</span>${src(f.odds)}</div>`
    : `<div class="odds">${bar(f.odds)}<div class="ol">${f.odds.o.map(([n, p], i) => `<span class="${i ? "" : "lead"}"><b class="tnum">${p}%</b> ${esc(n)}</span>`).join("")}${src(f.odds)}</div></div>`;
  const head = d => o.big
    ? `<h3 class="big"><span class="dn">${esc(d.date.split(" ")[0])}</span><span class="dw"><b>${esc(d.day)}</b>${esc(d.date.split(" ")[1])}</span></h3>`
    : `<h3>${esc(d.day)} <span>${esc(d.date)}</span></h3>`;
  const row = f => o.focus && f.done
    ? `<li class="done one sp-${f.sp}"><span class="tm tnum">${f.t}</span><div class="bd"><div class="kick">${ico(f.sp)}${SPORT[f.sp]}</div><div class="ti">${esc(f.title)}</div><div class="res">${result(f, true)}</div></div></li>`
    : `<li class="sp-${f.sp}${f.done ? " done" : ""}"><span class="tm tnum">${f.t}</span><div class="bd">
      <div class="kick">${ico(f.sp)}${SPORT[f.sp]}</div>
      <div class="ti">${esc(f.title)}</div><div class="meta">${where(f)}</div>
      ${f.done ? `<div class="res">${o.focus ? "" : `<span class="fin">Final</span>`}${result(f)}</div>` : ""}${odds(f)}</div></li>`;
  return DAYS.map(d => `<section class="day${d.today ? " today" : ""}${d.past ? " past" : ""}">${head(d)}<ol>${o.focus && d.today ? `<li class="now"><span class="tm tnum">${ASOF}</span><span class="nl">Now</span></li>` : ""}${d.items.map(row).join("")}</ol></section>`).join("");
}

const WAYS = { A: {}, A1: { odds: "text" }, A2: { big: true, sport: true }, A3: { focus: true, odds: "text" } };
for (const [id, o] of Object.entries(WAYS)) document.querySelector(`#${id} .agenda`).innerHTML = L(o);
document.getElementById("phone").onclick = e => { const on = document.body.classList.toggle("phone"); e.target.textContent = on ? "Laptop width" : "Phone width"; };
document.getElementById("theme").onclick = e => { const r = document.documentElement, dark = r.dataset.theme !== "dark"; r.dataset.theme = dark ? "dark" : "light"; e.target.textContent = dark ? "Day page" : "Night page"; };
