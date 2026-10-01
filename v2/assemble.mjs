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
].join("\n");

export function assemble({ app = read("public/app.js"), styles = read("public/styles.css") } = {}) {
  let js = app;
  const rep = (a, b) => { if (!js.includes(a)) throw new Error("v2: app.js anchor missing: " + a.slice(0, 80)); js = js.replace(a, () => b); };
  const layer = read("v2/layer.js") + "\n" + read("v2/wordmark.js").replace(/^export /gm, "");
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
  rep("  const [eL, eR] = earsHTML();", "  paintShell(); const [eL, eR] = earsHTML();");
  rep("  paintSignals();\n", "  paintSignals(); paintJump();\n");
  // Page One fits one screen; desk pages scale on big monitors with their masthead and tabs
  rep("function fitMonitor() {", "function fitMonitor() {\n  if (DESK.id === \"one\") return fitOne();");
  rep('for (const id of ["top", "idx", "layout", "late", "pastbar"])', 'for (const id of ["top", "idx", "layout", "late", "pastbar", "dtop", "dtabs"])');
  rep("  render();\n  loadArt();", "  render();\n  loadArt(); showDesk(DESK.id); dthemeLabel();");
  rep("    await refreshLive();", "    await refreshLive(); fitMonitor();");
  // The Crease's next tour breaks only between its parts
  js = js.replace(/^.*<b>Next tour:<\/b>.*$/m, line => line.replace("<b>Next tour:</b> ", '<b>Next tour:</b> <span class="nw">').replace(/ · /g, '</span> · <span class="nw">').replace("</p>`", "</span></p>`"));
  if (!js.includes('<b>Next tour:</b> <span class="nw">')) throw new Error("v2: next tour anchor missing");
  // The Fixture List (Parth, 1 Oct: "separate cricket from tennis from football from F1 cleanly"): each day's
  // fixtures in sport groups under a small label, in a fixed order
  rep("<ul>${list.map(f => {\n    const st = f.time_tbc", '<ul>${sportGroups(list).map(f => {\n    if (f.sp) return `<li class="sp">${esc(f.sp)}</li>`;\n    const st = f.time_tbc');
  const css = styles.replace(/border-radius:([^;}]+)/g, (m, v) => "border-radius:" + v.replace(/(\d+(?:\.\d+)?)px/g, (x, n) => (Number(n) >= 99 ? "3px" : Number(n) > 4 ? "4px" : x)))
    + "\n" + FONTS() + "\n" + read("v2/v2.css");
  return { js, css, head: read("v2/head.html") };
}

// The switch in the page itself: the old design's links and script, or the new design's, written in place. For a
// reader of v1 the page loads exactly the files it always did.
export function withV2(html, head, js, css) {
  const tag = s => JSON.stringify(s).replace(/<\//g, "<\\/");
  const decide = `<script>(function(){var q=location.search,on=/[?&]v2(=|&|$)/.test(q),off=/[?&]v1(=|&|$)/.test(q),k="h1400-design",V=false;try{if(on)localStorage.setItem(k,"v2");if(off)localStorage.removeItem(k);V=!off&&(on||localStorage.getItem(k)==="v2")}catch(e){V=on}var p=location.pathname.replace(/\\/+$/,"")||"/";window.H1400V2=V&&(p==="/"||p==="/today"||/^\\/e\\/\\d{4}-\\d\\d-\\d\\d$/.test(p))})()</script>`;
  const a = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">'), m = html.match(/<link rel="stylesheet" href="\/styles\.css[^"]*">/);
  if (a < 0 || !m || m.index < a) throw new Error("index.html: the stylesheet links are not where v2 expects them");
  const v1head = html.slice(a, m.index + m[0].length), app = html.match(/<script type="module" src="\/app\.js[^"]*"><\/script>/);
  if (!app || !html.includes("<body>\n")) throw new Error("index.html: the script or body is not where v2 expects it");
  return html
    .replace("</title>\n", () => `</title>\n${decide}\n`)
    .replace(v1head, () => `<script>document.write(window.H1400V2?${tag(`<link rel="stylesheet" href="${css}">`)}:${tag(v1head)})</script>`)
    .replace("<body>\n", () => `<body>\n<script>if(window.H1400V2)document.write(${tag(head)})</script>\n`)
    .replace(app[0], () => `<script>document.write(window.H1400V2?${tag(`<script type="module" src="${js}"></script>`)}:${tag(app[0])})</script>`);
}
