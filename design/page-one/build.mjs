// node design/page-one/build.mjs: bake the data snapshot into page-one.html and page-one-variants.html (the mocks).
// The variants file is self-hosted (fonts embedded, never Google) and carries the wordmark (wordmark.js). The fonts
// come from the Fontsource packages cached in /tmp/h1400-fonts by design/desks/src/make.mjs (run it once first).
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL(".", import.meta.url).pathname, FC = "/tmp/h1400-fonts/";
const data = readFileSync(H + "data-2026-09-30.json", "utf8");
writeFileSync(H + "page-one.html", readFileSync(H + "src.html", "utf8").replace("__DATA__", () => data));
const b64 = f => readFileSync(FC + f).toString("base64");
const face = (fam, f, w, st = "normal", range = "") => `@font-face{font-family:"${fam}";font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(f)}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`;
const EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2C60-2C7F,U+A720-A7FF";
const fonts = [
  face("Playfair Display", "playfair-display/files/playfair-display-latin-wght-normal.woff2", "400 900"),
  face("UnifrakturMaguntia", "unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2", "400"),
  ...["normal", "italic"].flatMap(st => [
    face("Newsreader", `newsreader/files/newsreader-latin-opsz-${st}.woff2`, "200 800", st),
    face("Newsreader", `newsreader/files/newsreader-latin-ext-opsz-${st}.woff2`, "200 800", st, EXT),
    face("Source Serif 4", `source-serif-4/files/source-serif-4-latin-opsz-${st}.woff2`, "200 900", st),
    face("Source Serif 4", `source-serif-4/files/source-serif-4-latin-ext-opsz-${st}.woff2`, "200 900", st, EXT),
  ]),
  face("Libre Franklin", "libre-franklin/files/libre-franklin-latin-wght-normal.woff2", "100 900"),
  face("Libre Franklin", "libre-franklin/files/libre-franklin-latin-ext-wght-normal.woff2", "100 900", "normal", EXT),
].join("\n");
const wordmark = readFileSync(H + "wordmark.js", "utf8").replace(/^export /gm, "");
const html = readFileSync(H + "src2.html", "utf8")
  .replace("__FONTS__", () => fonts).replace("__DATA__", () => data)
  .replace("__PLAYFAIR__", () => b64("playfair-display/files/playfair-display-latin-wght-normal.woff2"))
  .replace("__WORDMARK__", () => wordmark);
writeFileSync(H + "page-one-variants.html", html);
console.log("page-one-variants.html", Math.round(html.length / 1024) + " KB");
