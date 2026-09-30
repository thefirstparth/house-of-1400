// node design/weather/build.mjs: bake the data snapshot into the mock (design/weather/variants.html).
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL(".", import.meta.url).pathname;
writeFileSync(H + "variants.html", readFileSync(H + "src.html", "utf8").replace("__DATA__", readFileSync(H + "data-2026-10-01.json", "utf8")));
