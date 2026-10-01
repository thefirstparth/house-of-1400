// node design/weather/build.mjs: bake the data snapshots into the mocks (variants.html: round one, variants2.html: round two, variants3.html: round three).
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL(".", import.meta.url).pathname;
writeFileSync(H + "variants.html", readFileSync(H + "src.html", "utf8").replace("__DATA__", readFileSync(H + "data-2026-10-01.json", "utf8")));
writeFileSync(H + "variants3.html", readFileSync(H + "src3.html", "utf8").replace("__DATA__", readFileSync(H + "data3-2026-10-01.json", "utf8")));
writeFileSync(H + "variants2.html", readFileSync(H + "src2.html", "utf8").replace("__DATA__", readFileSync(H + "data2-2026-10-01.json", "utf8")));
