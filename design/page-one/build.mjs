// node design/page-one/build.mjs: bake the data snapshot into page-one.html (the mock).
import { readFileSync, writeFileSync } from "node:fs";
const H = new URL(".", import.meta.url).pathname;
writeFileSync(H + "page-one.html", readFileSync(H + "src.html", "utf8").replace("__DATA__", readFileSync(H + "data-2026-09-30.json", "utf8")));
