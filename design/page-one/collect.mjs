// node design/page-one/collect.mjs: freeze one day's paper and live figures into data-YYYY-MM-DD.json for the mock.
// Text the live page already computes (the weather trend, the cricket state) is read from the page itself.
import { chromium } from "../../node_modules/playwright-core/index.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const Z = "/tmp/claude-0/qa/fz/", J = k => (existsSync(Z + k + ".json") ? JSON.parse(readFileSync(Z + k + ".json", "utf8")) : null);
const E = JSON.parse(readFileSync("content/latest.json", "utf8"));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } });
const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
await p.route("**/api/live/**", r => { const k = new URL(r.request().url()).pathname.split("/").pop(), f = Z + k + ".json"; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: "application/json" }) : r.fulfill({ status: 500, body: "{}" }); });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" }); await p.waitForTimeout(3500);
const page = await p.evaluate(() => ({
  sky_head: document.querySelector(".sky-h")?.textContent || "",
  fam: [...document.querySelectorAll(".sky-fam>div")].map(d => ({ name: d.querySelector("h4")?.childNodes[0]?.textContent, line: d.querySelector(".l")?.textContent, now: d.querySelector("h4 small")?.textContent })),
  ear_left: document.querySelector("#earL")?.innerText, ear_right: document.querySelector("#earR")?.innerText,
}));
await b.close();
const W = J("weather")?.value?.cities?.[0];
writeFileSync("design/page-one/data-" + E.date + ".json", JSON.stringify({
  edition: { date: E.date, no: E.edition_no, weekday: E.weekday, glance: E.glance, lead: { id: E.front.lead.id, section: E.front.lead.section, kicker: E.front.lead.kicker, headline: E.front.lead.headline, deck: E.front.lead.deck || E.front.lead.short },
    seconds: E.front.seconds.map(x => ({ id: x.id, section: x.section, kicker: x.kicker, headline: x.headline })), screen: E.screen, betting: E.betting, bye: E.before_you_go, editor_note: E.editor_note,
    sections: Object.fromEntries(Object.entries(E.sections).map(([k, v]) => [k, [...(v.stories || []), ...(v.briefs || [])].map(x => ({ id: x.id, kicker: x.kicker, headline: x.headline }))])) },
  page, weather: W && { now: W.current, today: W.daily[0], air: W.air?.now }, markets: J("markets")?.value, gold: J("gold_in")?.value,
  f1: J("f1_next")?.value, f1_standings: J("f1_standings")?.value?.drivers?.slice(0, 6), football: J("football")?.value, crease: J("crease")?.value, tennis: J("tennis_players")?.value,
  betting: J("betting")?.value?.markets?.slice(0, 12), outlook: J("outlook")?.value, signals: J("signals")?.value, flows: J("flows")?.value, fixtures: E.fixtures,
}));
console.log("ok", JSON.stringify(page).slice(0, 400));
