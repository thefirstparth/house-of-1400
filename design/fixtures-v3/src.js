// The Fixture List, round three: way 1 with better visuals, not overboard (data.js). Results as the sport shows them
// (F1's grid with team colours, a cricket scorecard, a tennis set board), markets as two-sided bars, the next fixture
// counted down, the channel as a tag.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ico = sp => `<i class="ico">${ICON[sp]}</i>`;
const TV = '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="9" rx="1.5"/><path d="M5.5 14.5h5"/><path d="M7 5.8v3.4l2.8-1.7z" class="fill"/></svg>';
const src = o => `<span class="src">${esc(o.src)} · ${ASOF}</span>`;
const istAt = (day, t) => Date.parse(`2026-10-${day.date.split(" ")[0].padStart(2, "0")}T${t}:00+05:30`);
const until = ms => { const m = Math.round((ms - Date.parse(NOW)) / 6e4); return m < 60 ? `in ${m} min` : m < 36 * 60 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} days`; };

// A result, drawn the way its sport prints one
function result(f) {
  const d = f.done;
  if (d.grid) return `<div class="rbox f1"><div class="rcap">${esc(d.label)}</div>${d.grid.map(([code, name, col, time], i) => `<div class="gr"><span class="p">${i + 1}</span><i class="team" style="background:${col}"></i><b class="code">${code}</b><span class="nm">${esc(name)}</span><span class="tm2 tnum">${time}</span></div>`).join("")}</div>`;
  if (d.card) return `<div class="rbox ck">${d.card.map(([team, runs, ov, won]) => `<div class="cr${won ? " won" : ""}"><span class="nm">${esc(team)}</span><b class="tnum">${runs}</b><span class="ov tnum">${ov}</span></div>`).join("")}<div class="rcap">${esc(d.head)}</div></div>`;
  if (d.tennis) return `<div class="rbox tn">${d.tennis.map(([name, sets, won]) => `<div class="tr${won ? " won" : ""}"><span class="nm">${esc(name)}</span>${sets.map(x => `<b class="set tnum">${x}</b>`).join("")}</div>`).join("")}<div class="rcap">${esc(d.head)} ${esc(d.score)}</div></div>`;
  return `<div class="res"><b>${esc(d.head)}</b> <span class="sc tnum">${esc(d.score || "")}</span></div>`;
}

// A market as a small ranked chart: one row per outcome, its name, its share as a bar, the price; the favourite in colour.
// A race lists its favourite and the next two (the rest of the field is not drawn).
function odds(f) {
  const o = f.odds; if (!o) return "";
  return `<div class="mk"><div class="rows">${o.o.map(([n, p], i) => `<span class="n${i ? "" : " fav"}">${esc(n)}</span><span class="track"><i class="${i ? "" : "on"}" style="width:${p}%"></i></span><b class="p tnum${i ? "" : " fav"}">${p}%</b>`).join("")}</div>${src(o)}</div>`;
}

function R(opt) {
  let nextDone = false;
  return DAYS.map(d => `<section class="day${d.today ? " today" : ""}${d.past ? " past" : ""}">${opt.big
    ? `<h3 class="big"><span class="dn">${esc(d.date.split(" ")[0])}</span><span class="dw"><b>${esc(d.day)}</b>${esc(d.date.split(" ")[1])}</span></h3>`
    : `<h3>${esc(d.day)} <span>${esc(d.date)}</span></h3>`}<ol>${d.items.map(f => {
    const nx = !f.done && !nextDone && (nextDone = true);
    return `<li class="sp-${f.sp}${f.done ? " done" : ""}${nx ? " next" : ""}"><span class="tm tnum">${f.t}</span><div class="bd">
      <div class="kick">${ico(f.sp)}${SPORT[f.sp]}${f.done ? `<span class="fin">Final</span>` : ""}${nx ? `<span class="nxt">Next up · ${until(istAt(d, f.t))}</span>` : ""}</div>
      <div class="ti">${esc(f.title)}</div><div class="meta">${esc(f.sub)}${f.tv ? `<span class="tv">${TV}${esc(f.tv)}</span>` : ""}</div>
      ${f.done ? result(f) : odds(f)}</div></li>`;
  }).join("")}</ol></section>`).join("");
}

const WAYS = { R1: {}, R2: { big: true }, R3: { big: true } };
for (const [id, o] of Object.entries(WAYS)) document.querySelector(`#${id} .agenda`).innerHTML = R(o);
document.getElementById("phone").onclick = e => { const on = document.body.classList.toggle("phone"); e.target.textContent = on ? "Laptop width" : "Phone width"; };
document.getElementById("theme").onclick = e => { const r = document.documentElement, dark = r.dataset.theme !== "dark"; r.dataset.theme = dark ? "dark" : "light"; e.target.textContent = dark ? "Day page" : "Night page"; };
