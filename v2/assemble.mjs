// The new design (v2), assembled at build time from the paper's own renderer: a copy of public/app.js with the v2
// layer (layer.js, wordmark.js) patched in becomes /v2.js; public/styles.css with radii at 4px, then v2.css, becomes
// /v2.css. app.js and styles.css themselves are never changed, so the old design (v1) is exactly as it was.
// Every patch names its anchor in app.js; when one is missing assemble() throws and the build ships v1 alone.
import { readFileSync } from "node:fs";

const H = new URL("../", import.meta.url).pathname;
const read = f => readFileSync(H + f, "utf8");

// The self-hosted faces (v2/fonts, from the Fontsource packages; OFL, licences beside them)
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const face = (family, file, { weight = "100 900", style = "normal", range = LATIN } = {}) =>
  `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format("woff2");unicode-range:${range}}`;
export const FONTS = () => [
  ...["normal", "italic"].flatMap(s => [
    face("Newsreader", `newsreader-latin-opsz-${s}.woff2`, { weight: "200 800", style: s }),
    face("Newsreader", `newsreader-latin-ext-opsz-${s}.woff2`, { weight: "200 800", style: s, range: EXT }),
    face("Source Serif 4", `source-serif-4-latin-opsz-${s}.woff2`, { weight: "200 900", style: s }),
    face("Source Serif 4", `source-serif-4-latin-ext-opsz-${s}.woff2`, { weight: "200 900", style: s, range: EXT }),
    face("Libre Franklin", `libre-franklin-latin-wght-${s}.woff2`, { style: s }),
    face("Libre Franklin", `libre-franklin-latin-ext-wght-${s}.woff2`, { style: s, range: EXT }),
  ]),
  face("Playfair Display", "playfair-display-latin-wght-normal.woff2", { weight: "400 900" }),
  face("UnifrakturMaguntia", "unifrakturmaguntia-latin-400-normal.woff2", { weight: "400" }),
  ...[400, 600, 700, 900].map(w => face("Titillium Web", `titillium-web-latin-${w}-normal.woff2`, { weight: String(w) })),
  // the record's face: the lead story's time-and-place stamp (3 Oct 2026, after Fern), and nothing else
  face("IBM Plex Mono", "ibm-plex-mono-latin-500-normal.woff2", { weight: "500" }),
].join("\n");

export function assemble({ app = read("public/app.js"), styles = read("public/styles.css") } = {}) {
  let js = app;
  const rep = (a, b) => { if (!js.includes(a)) throw new Error("v2: app.js anchor missing: " + a.slice(0, 80)); js = js.replace(a, () => b); };
  const layer = `const GLYPHS = ${read("v2/glyphs.json").trim()};\n` + read("v2/sun.js") + "\n" + read("v2/layer.js") + "\n" + read("v2/sheet.js") + "\n" + read("v2/ink.js").replace(/^export /gm, "") + "\n" + read("v2/wordmark.js").replace(/^export /gm, "");
  rep("function render() {", layer + "\nfunction render() {");
  // the desks: v2's own (config desks_v2), one desk to a page
  rep("function desksHTML(S) {", "function desksHTML_v1(S) {");
  // section heads: a rule in the desk's colour and the name, no seal
  rep('<div class="sechead">${seal(id, 54)}<div>', '<div class="sechead"><div>');
  // the front page's stories print in their own sections; the "On the Front Page ↑" pointers go
  rep("  const st = S.stories || [], br = S.briefs || [];", '  const st = [...frontItems(id, "story"), ...(S.stories || [])], br = [...frontItems(id, "brief"), ...(S.briefs || [])];');
  rep("  let h = up.length ? ", "  let h = false ? ");
  rep("return `<div class=\"full-data\">${data}</div>${stories}`;", "return `<div class=\"full-data\">${data}</div><div class=\"after-data\">${storiesBlock(id)}</div>`;");
  // the page: the desk's opener (or Page One), its sections, its foot
  rep("  let h = frontHTML();", "  let h = deskOpener();");
  rep("  h += deskBlock();\n", "");
  js = js.replace(/\n  h \+= `<div class="house" id="house">[^\n]*/, "");
  if (js.includes('h += `<div class="house" id="house">')) throw new Error("v2: house anchor missing");
  const before = js;
  js = js.replace(/\n  h \+= `<div class="foot">[^\n]*/, "\n  h += deskFoot();");
  if (js === before) throw new Error("v2: foot anchor missing");
  rep("  const [eL, eR] = earsHTML();", "  paintShell(); readLine(); const [eL, eR] = earsHTML();");
  // the read time counts the live tables of the whole paper, not only the desk on screen
  rep('  const modules = $$("#main [data-live]").length;', '  const modules = Object.values(S).join("").split("data-live=").length - 1;');
  // the Betting Window's slips open their market in a sheet
  rep('return `<li class="slip${n === 0 ? " lead" : ""}">', 'return `<li class="slip${n === 0 ? " lead" : ""}" data-bet="${esc(b.id || "")}" tabindex="0">');
  // Sky & Streets' chart is drawn in the new design's style (layer.js skyChart)
  rep("function skyChart(o, {", "function skyChart_v1(o, {");
  rep("the dashed outline is the same month's 30-year average", "the pale band behind it is the same month's 30-year average");
  // the archive is a calendar in the new design
  rep('  if (ROUTE.kind === "archive") return renderArchive();', '  if (ROUTE.kind === "archive") return archiveV2();');
  // The Week Ahead in seven columns, Monday to Sunday
  rep('S.week = secWrap("week", weekBlock(),', 'S.week = secWrap("week", weekV2(),');
  rep("  paintSignals();\n", "  paintSignals(); paintJump(); liveFx(); flowAgenda(); paintMarks();\n");
  // Page One fits one screen and desk pages fill the width, with their masthead and tabs (layer.js, fitOne, fitDesk)
  rep("function fitMonitor() {", "function fitMonitor() {\n  return E && DESK.id === \"one\" ? fitOne() : fitDesk();");
  rep("  render();\n  loadArt();", "  render();\n  loadArt(); showDesk(DESK.id); followSun(); dthemeLabel(); hereBoot();");
  rep("    await refreshLive();", "    await refreshLive(); fitMonitor();");
  // The Crease's next tour breaks only between its parts
  js = js.replace(/^.*<b>Next tour:<\/b>.*$/m, line => line.replace("<b>Next tour:</b> ", '<b>Next tour:</b> <span class="nw">').replace(/ · /g, '</span> · <span class="nw">').replace("</p>`", "</span></p>`"));
  if (!js.includes('<b>Next tour:</b> <span class="nw">')) throw new Error("v2: next tour anchor missing");
  // The Fixture List (Parth, 1 Oct: "separate cricket from tennis from football from F1 cleanly"): each day's
  // fixtures in sport groups under a small label, in a fixed order
  rep("<ul>${list.map(f => {\n    const st = f.time_tbc", '<ul>${sportGroups(list).map(f => {\n    const st = f.time_tbc');
  rep('<span class="t tnum">${esc(when)}</span><span class="what">', '<span class="t tnum">${esc(when)}${f._sp ? `<i class="spt">${esc(f._sp)}</i>` : ""}</span><span class="what">');
  const css = styles.replace(/border-radius:([^;}]+)/g, (m, v) => "border-radius:" + v.replace(/(\d+(?:\.\d+)?)px/g, (x, n) => (Number(n) >= 99 ? "3px" : Number(n) > 4 ? "4px" : x)))
    + "\n" + FONTS() + "\n" + read("v2/v2.css");
  return { js, css, head: read("v2/head.html") };
}

// The switch in the page itself: the old design's links and script, or the new design's, written in place. For a
// reader of v1 the page loads exactly the files it always did.
export function withV2(html, head, js, css, home = null) {
  const tag = s => JSON.stringify(s).replace(/<\//g, "<\\/");
  const decide = `<script>(function(){var q=location.search,on=/[?&]v2(=|&|$)/.test(q),off=/[?&]v1(=|&|$)/.test(q),k="h1400-design",V=false;try{if(on)localStorage.removeItem(k);if(off)localStorage.setItem(k,"v1");V=on||(!off&&localStorage.getItem(k)!=="v1")}catch(e){V=!off}var p=location.pathname.replace(/\\/+$/,"")||"/";window.H1400V2=V&&!/[?&]poster=/.test(q)&&(p==="/"||p==="/today"||p==="/archive"||/^\\/e\\/\\d{4}-\\d\\d-\\d\\d$/.test(p))})()</script>`;
  const a = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">'), m = html.match(/<link rel="stylesheet" href="\/styles\.css[^"]*">/);
  if (a < 0 || !m || m.index < a) throw new Error("index.html: the stylesheet links are not where v2 expects them");
  const v1head = html.slice(a, m.index + m[0].length), app = html.match(/<script type="module" src="\/app\.js[^"]*"><\/script>/);
  if (!app || !html.includes("<body>\n")) throw new Error("index.html: the script or body is not where v2 expects it");
  return html
    .replace("</title>\n", () => `</title>\n${decide}\n${home ? night(home) : ""}`)
    .replace(v1head, () => `<script>document.write(window.H1400V2?${tag(`<link rel="stylesheet" href="${css}">`)}:${tag(v1head)})</script>`)
    .replace("<body>\n", () => `<body>\n<script>if(window.H1400V2)document.write(${tag(head)})</script>\n`)
    .replace(app[0], () => `<script>document.write(window.H1400V2?${tag(`<script type="module" src="${js}"></script>`)}:${tag(app[0])})</script>`);
}

// Night by the sun (Parth, 2 Oct: "auto-dark at night, chosen before the page appears"): before the first paint, a v2
// page with no theme chosen on this device takes day or night from the home city's sunrise and sunset. A choice made
// with the run line's Night/Day button (stored as h1400-theme) wins until "Auto" clears it.
const night = ({ lat, lon }) => `<script>${read("v2/sun.js").replace(/^\/\/.*\n/gm, "")}(function(){if(!window.H1400V2)return;try{if(localStorage.getItem("h1400-theme"))return}catch(e){}document.documentElement.setAttribute("data-theme",h1400Day(${Number(lat)},${Number(lon)},Date.now())[0]?"light":"dark")})()</script>\n`;

// The archive calendar's days (Parth, 2 Oct), worked out at build time from the editions themselves, so the daily run
// writes nothing new: the lead, how many items, the Sensex close, and the day's paper by desk (as the wordmark has it).
export async function archiveDays(editions, cfg, count) {
  const { storiesFromEdition } = await import("./wordmark.js");
  const desks = (cfg.desks_v2?.desks || []).filter(d => d.id !== "one");
  return editions.map(E => {
    const pieces = storiesFromEdition(E, desks), total = pieces.reduce((a, p) => a + p.words, 0) || 1;
    const sx = E.snapshot?.markets?.value?.indices?.find(i => i.name === "Sensex");
    return { date: E.date, no: E.edition_no, lead: E.front?.lead?.headline || "", items: count(E),
      sensex: Number.isFinite(sx?.change_pct) ? Math.round(sx.change_pct * 100) / 100 : null,
      desks: desks.map(d => [d.id, Math.round(1000 * pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0) / total) / 10]).filter(x => x[1] > 0) };
  });
}
