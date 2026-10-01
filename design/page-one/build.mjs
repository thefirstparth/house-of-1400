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
// The wordmark's pieces, from the full edition the mock is built from, with the desks as agreed on 1 Oct.
const { storiesFromEdition } = await import(H + "wordmark.js");
const full = JSON.parse(readFileSync(H + "../../content/editions/" + JSON.parse(data).edition.date + ".json", "utf8"));
const DESKS = [
  { id: "news", name: "News", sections: ["week", "dateline", "talk", "betting"] },
  { id: "home", name: "Close to Home", sections: ["namma", "sky"] },
  { id: "sport", name: "Sport", sections: ["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"] },
  { id: "tech", name: "Tech & AI", sections: ["workshop", "pipeline"] },
  { id: "money", name: "Money", sections: ["ledger"] },
  { id: "off", name: "Off Duty", sections: ["screen", "bye"] },
];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pieces = storiesFromEdition(full, DESKS).map(p => ({ ...p, headline: esc(p.headline) }));
const share = Object.fromEntries(DESKS.map(d => [d.name, pieces.filter(p => p.desk === d.id).reduce((a, p) => a + p.words, 0)]));
const all = Object.values(share).reduce((a, b) => a + b, 0);
console.log("wordmark:", pieces.length, "pieces;", Object.entries(share).map(([k, v]) => `${k} ${Math.round(100 * v / all)}%`).join(", "));
const dataWithMark = JSON.stringify({ ...JSON.parse(data), wordmark: pieces });
const html = readFileSync(H + "src2.html", "utf8")
  .replace("__FONTS__", () => fonts).replace("__DATA__", () => dataWithMark.replace(/</g, "\\u003c"))
  .replace("__PLAYFAIR__", () => b64("playfair-display/files/playfair-display-latin-wght-normal.woff2"))
  .replace("__WORDMARK__", () => wordmark);
writeFileSync(H + "page-one-variants.html", html);
console.log("page-one-variants.html", Math.round(html.length / 1024) + " KB");
