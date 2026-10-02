// the preview: one frame at a laptop's size (1470x830, scaled to fit) or a phone's (402x874), scrolling like the page
const V = {
  now: ["Today, for comparison", "The desk as it is now: each sport's figures first, then its stories, one after another."],
  a: ["A · The paper, then the scoreboard", "Three parts with a pinned contents line. <b>The stories</b> first, set as a newspaper: the lead across, the rest in two columns with their illustrations, briefs in three. Then <b>Next up</b>: the week's fixtures and every team's next match with the market's view, side by side. Then <b>Tables and results</b>: every table, leader board and result, folded, each saying in one line what it holds; one button opens them all."],
  b: ["B · Team rooms", "The day's lead with the week beside it, then a room for each team, with chips to jump between them. A room's head is the team, its standing and the market's view; inside, <b>its stories on the left</b> and <b>its next match on the right</b>, with every table, leader board and result in a drawer just under it."],
  c: ["C · Two panes", "<b>The news on the left</b>, read top to bottom, each team's stories under a slim head with the market's view. <b>On the right, a pinned panel with every figure</b>, a tab for each team and one for the week, which follows the story you are reading. On a phone the panel slides up from the foot of each team's stories."],
};
const DEV = { laptop: [1470, 830], phone: [402, 874] };
let cur = { v: "a", d: "laptop", t: "light" };
try { Object.assign(cur, JSON.parse(location.hash.slice(1) ? decodeURIComponent(location.hash.slice(1)) : "{}")); } catch {}
const seg = (id, items, key) => { const el = document.getElementById(id); el.innerHTML = items.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${cur[key] === k}">${l}</button>`).join(""); el.onclick = e => { const b = e.target.closest("button"); if (!b) return; cur[key] = b.dataset.k; draw(); }; };
const fill = s => s.replace(/%%FONT:([^%]+)%%/g, (m, f) => `data:font/woff2;base64,${FONTS[f] || ""}`).replace(/%%ART:([^%]+)%%/g, (m, f) => `data:image/webp;base64,${ART[f] || ""}`);
const CSSF = fill(CSS);
function draw() {
  location.hash = encodeURIComponent(JSON.stringify(cur));
  seg("vs", Object.entries(V).map(([k, [n]]) => [k, n.split(" · ")[0]]), "v"); seg("ds", [["laptop", "Laptop"], ["phone", "Phone"]], "d"); seg("ts", [["light", "Day"], ["dark", "Night"]], "t");
  document.getElementById("why").innerHTML = `<b>${V[cur.v][0]}.</b> ${V[cur.v][1]}`;
  const doc = DOCS[`${cur.v}-${cur.d}`], [w, h] = DEV[cur.d], r = REPORT.find(x => x.v === cur.v && x.dev === cur.d), base = REPORT.find(x => x.v === "now" && x.dev === cur.d);
  const html = `<!doctype html><html ${doc.attrs} data-theme="${cur.t}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSSF}</style>${doc.links}<script>window.R3_STATIC=1;<\/script><script>${RUNTIME}<\/script></head>${fill(doc.body)}</html>`;
  const stage = document.getElementById("stage"), avail = stage.clientWidth, z = Math.min(1, avail / w);
  stage.innerHTML = `<div class="dev" style="width:${w}px;height:${h}px;transform:scale(${z})"><iframe width="${w}" height="${h}" title="${V[cur.v][0]}"></iframe></div><p class="cap" style="margin-top:${-(h * (1 - z)) + 8}px">${cur.d === "laptop" ? "MacBook Air window, 1470×830" : "Phone, 402×874"} · the whole desk is ${r.screens} screens tall${cur.v !== "now" ? ` (today's desk: ${base.screens})` : ""}</p>`;
  stage.querySelector("iframe").srcdoc = html;
}
addEventListener("resize", () => draw());
draw();
