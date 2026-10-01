// node design/desks/src/make.mjs [desk]: build the desk page mock as one self-contained, working HTML file.
// The paper's own renderer (public/app.js) with the mock layer (proto.js, proto.css) patched in; the edition of
// content/latest.json as the build serves it; its press-time snapshot answers every live call; the clock is held at
// 15:00 IST on the edition's day; the fonts are embedded (self-hosted, never Google). Your Desk is removed.
// Run node scripts/build.mjs first (it writes dist/content/latest.json and the checked art manifest).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const H = new URL("../../../", import.meta.url).pathname, SRC = H + "design/desks/src/";
const desk = process.argv[2] || "sport";
const read = f => readFileSync(H + f, "utf8");

// ---------------------------------------------------------------- fonts (Fontsource packages, cached outside the repo)
const FC = "/tmp/h1400-fonts/";
const PKGS = ["@fontsource-variable/newsreader", "@fontsource-variable/source-serif-4", "@fontsource-variable/libre-franklin", "@fontsource-variable/playfair-display", "@fontsource/unifrakturmaguntia", "@fontsource/titillium-web"];
mkdirSync(FC, { recursive: true });
for (const p of PKGS) {
  const dir = FC + p.split("/")[1];
  if (existsSync(dir)) continue;
  const tgz = execSync(`npm pack -q ${p}`, { cwd: FC }).toString().trim().split("\n").pop();
  mkdirSync(dir); execSync(`tar xzf ${tgz} -C ${dir} --strip-components=1`, { cwd: FC });
}
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const face = (family, pkg, file, { weight = "100 900", style = "normal", range = LATIN } = {}) =>
  `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(`${FC}${pkg}/files/${file}`).toString("base64")}) format("woff2");unicode-range:${range}}`;
const fonts = [
  ...["normal", "italic"].flatMap(s => [
    face("Newsreader", "newsreader", `newsreader-latin-opsz-${s}.woff2`, { weight: "200 800", style: s }),
    face("Newsreader", "newsreader", `newsreader-latin-ext-opsz-${s}.woff2`, { weight: "200 800", style: s, range: EXT }),
    face("Source Serif 4", "source-serif-4", `source-serif-4-latin-opsz-${s}.woff2`, { weight: "200 900", style: s }),
    face("Source Serif 4", "source-serif-4", `source-serif-4-latin-ext-opsz-${s}.woff2`, { weight: "200 900", style: s, range: EXT }),
    face("Libre Franklin", "libre-franklin", `libre-franklin-latin-wght-${s}.woff2`, { style: s }),
    face("Libre Franklin", "libre-franklin", `libre-franklin-latin-ext-wght-${s}.woff2`, { style: s, range: EXT }),
  ]),
  face("Playfair Display", "playfair-display", "playfair-display-latin-wght-normal.woff2", { weight: "400 900" }),
  face("UnifrakturMaguntia", "unifrakturmaguntia", "unifrakturmaguntia-latin-400-normal.woff2", { weight: "400" }),
  ...[400, 600, 700, 900].map(w => face("Titillium Web", "titillium-web", `titillium-web-latin-${w}-normal.woff2`, { weight: String(w) })),
].join("\n");

// ---------------------------------------------------------------- the renderer, patched
let js = read("public/app.js");
const rep = (a, b) => { if (!js.includes(a)) throw new Error("app.js anchor missing: " + a.slice(0, 80)); js = js.replace(a, () => b); };
rep("function render() {", readFileSync(SRC + "proto.js", "utf8") + "\nfunction render() {");
rep("function desksHTML(S) {", "function desksHTML_v1(S) {");
rep('<div class="sechead">${seal(id, 54)}<div>', '<div class="sechead"><div>');
rep("  const st = S.stories || [], br = S.briefs || [];", '  const st = [...frontItems(id, "story"), ...(S.stories || [])], br = [...frontItems(id, "brief"), ...(S.briefs || [])];');
rep("  let h = up.length ? ", "  let h = false ? ");
// A section whose only stories are front-page ones prints its data full width and the stories under it as a normal
// section does (in pairs, a drawing beside its text), not in a narrow column beside nothing.
rep("return `<div class=\"full-data\">${data}</div>${stories}`;", "return `<div class=\"full-data\">${data}</div><div class=\"after-data\">${storiesBlock(id)}</div>`;");
rep("  let h = frontHTML();", "  let h = deskOpener();");
rep("  h += deskBlock();\n", "");
js = js.replace(/\n  h \+= `<div class="house" id="house">[^\n]*/, "");
js = js.replace(/\n  h \+= `<div class="foot">[^\n]*/, "\n  h += deskFoot();");
if (!js.includes("h += deskFoot();")) throw new Error("foot anchor missing");
rep("  const [eL, eR] = earsHTML();", "  paintShell(); const [eL, eR] = earsHTML();");
rep("    observeIndex(present);", "    observeIndex(present); paintJump();");
// News (mock only): Dateline printed as Desh (India) and Videsh (the world), split by the story's kicker. In production
// Bhide would file each story to its section; that is a schema and editorial change for Parth to agree.
rep('  S.dateline = secWrap("dateline", storiesBlock("dateline"), "World & India");', '  S.dateline = secWrap("dateline", storiesBlock("dateline"), "World & India");\n  S.desh = secWrap("desh", storiesBlock("desh"), "India: the country, its courts, its institutions");\n  S.videsh = secWrap("videsh", storiesBlock("videsh"), "The world, as it touches India");');
// Big monitors: the masthead and the tabs scale with the page, so all three share one width.
rep('for (const id of ["top", "idx", "layout", "late", "pastbar"])', 'for (const id of ["top", "idx", "layout", "late", "pastbar", "dtop", "dtabs"])');
// The Crease's next tour breaks only between its parts, never inside one ("2 / Tests").
js = js.replace(/^.*<b>Next tour:<\/b>.*$/m, line => line.replace("<b>Next tour:</b> ", '<b>Next tour:</b> <span class="nw">').replace(/ · /g, '</span> · <span class="nw">').replace("</p>`", "</span></p>`"));
if (!js.includes('<b>Next tour:</b> <span class="nw">')) throw new Error("next tour anchor missing");
if (js.includes("</script")) throw new Error("app.js contains </script");

// ---------------------------------------------------------------- styles: the live sheet, radii down to 4px, then the mock's
let css = read("public/styles.css").replace(/border-radius:([^;}]+)/g, (m, v) => "border-radius:" + v.replace(/(\d+(?:\.\d+)?)px/g, (x, n) => (Number(n) >= 99 ? "3px" : Number(n) > 4 ? "4px" : x)));
css += "\n" + readFileSync(SRC + "proto.css", "utf8") + "\n.mockbar{background:#15140f;color:#f3f1ea;font:600 12px/1.4 system-ui,sans-serif;padding:6px 16px;text-align:center}";

// ---------------------------------------------------------------- data
const cfg = JSON.parse(read("dist/config/house.json"));
const E = JSON.parse(read("dist/content/latest.json"));
delete E.desk; delete E.coverage_waivers; // Your Desk (Gmail, Calendar) never leaves the edition JSON
const secOf = {};
for (const x of [E.front.lead, ...E.front.seconds, ...E.front.briefs, ...Object.values(E.sections || {}).flatMap(s => [...(s.stories || []), ...(s.briefs || [])])]) secOf[x.id] = x.section;
// the edition's own sections on each desk (Desh and Videsh are both Dateline), for the drawings to embed
const deskSecs = { sport: ["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"], news: ["dateline", "talk", "betting"] }[desk] || [];
const man = JSON.parse(read(`dist/art/${E.date}/manifest.json`));
man.items = man.items.filter(i => deskSecs.includes(secOf[i.story_id])).map(i => {
  const f = H + "public" + i.src.split("?")[0];
  return { ...i, src: `data:image/${f.split(".").pop()};base64,${readFileSync(f).toString("base64")}` };
});
const T0 = Date.parse(`${E.date}T09:30:00Z`); // 15:00 IST
const data = JSON.stringify({ cfg, E, man }).replace(/</g, "\\u003c");

// ---------------------------------------------------------------- the page
const boot = `<script>
// Mock only: the clock runs from 15:00 IST on the edition's day; every request is answered from this file.
(function(){var R=Date,O=${T0}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}
D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;
var M=${data};window.MOCK_DESK=${JSON.stringify(desk)};
var ok=function(x){return Promise.resolve(new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}}))},no=function(){return Promise.resolve(new Response("{}",{status:404}))};
window.fetch=function(u){var p=new URL(String(u),"https://house14.vercel.app/").pathname;
if(p==="/config/house.json")return ok(M.cfg);if(p==="/content/latest.json")return ok(M.E);if(p==="/art/"+M.E.date+"/manifest.json")return ok(M.man);
var k=(p.match(/^\\/api\\/live\\/([a-z_0-9]+)$/)||[])[1],s=k&&M.E.snapshot&&M.E.snapshot[k];if(s&&s.value)return ok({ok:true,value:s.value,as_of:s.as_of,source:s.source,stale:false});return no()};
})();
</script>`;
let html = read("public/index.html")
  .replace(/<script>\n\/\/ Start the data requests[\s\S]*?<\/script>\n/, "")
  .replace(/<link rel="preconnect"[^>]*>\n/g, "")
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\n/g, "")
  .replace(/<link rel="icon"[^>]*>/, "")
  .replace('<link rel="stylesheet" href="/styles.css">', () => `<style>${fonts}\n${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>', () => `${boot}\n<script type="module">\n${js}\n</script>`)
  .replace('<nav class="idx"', `<header class="dtop" id="dtop"><div class="dwrap"><div class="drun"><span><span id="r-date"></span><span id="r-no"></span><span id="r-print"></span></span><span class="tag" id="r-tag"></span></div>
 <div class="dbar"><a class="np" href="/" aria-label="The House of 1400, Page One"><span class="the">The</span><span class="hof">House of</span><span class="n">1400</span></a><div class="now" id="now"></div></div></div></header>
<nav class="dtabs" id="dtabs" aria-label="Desks"><ol></ol></nav>
<nav class="idx"`)
  .replace("<body>", `<body>\n<div class="mockbar">Desk page mock · ${desk} · the edition of ${E.date}, live figures as printed at press time · not the live paper</div>`);
const out = H + `design/desks/${desk}-desk.html`;
writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + " KB", "art:", man.items.map(i => i.story_id).join(", "));
