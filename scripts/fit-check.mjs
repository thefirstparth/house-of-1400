// Page One fits one screen on Parth's MacBook Air (Parth, 12 Oct 2026: "Do 1 now", after kylo-news's Brief check).
// Opens the built site (dist/) offline with a deliberately heavy edition: today's paper with The day in a minute at
// its most (11 lines, every one a full 14-word headline with its subject in bold), the longest editor's note and a
// long House Note. Live figures come from the edition's own snapshot, and the clock is set to 15:00 IST on its date.
// At each window size it fails when the page scrolls, when any of the 11 lines is dropped or runs off the screen, when
// the type is scaled below 0.8, or when the page throws; and when ⌘+ to 125% does not make the text larger.
//   node scripts/fit-check.mjs            (run `npm run build` first; tests/fit.test.mjs does both)
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const H = new URL("../", import.meta.url).pathname, D = H + "dist";
export const CHROMIUM = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
// MacBook Air 13" and 15" (M4, default scaling): the browser window's page area with the tabs and address bar showing
export const SIZES = { "Air 13 Chrome": [1470, 832], "Air 13 Safari": [1470, 870], "Air 15 Chrome": [1710, 990], "Air 15 Safari": [1710, 1028] };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".gif": "image/gif" };

const LINES = [
  "Saudi Arabia says a strike on Riyadh airport killed thirteen people, including an Indian",
  "India beat West Indies in Indore to lead the five-match T20 series 2–1",
  "Delhi Police close Jantar Mantar to protests and name three other grounds instead",
  "SIPs hit a record ₹32,490 crore in September despite the falling stock market",
  "BMTC will share live bus data with map apps and plans five feeder routes",
  "Zelensky backs a Russian energy ceasefire if Moscow agrees to stop its strikes too",
  "RBI opens a dollar window for Indian Oil, HPCL and BPCL to steady the rupee",
  "Alcaraz loses to Zizou Bergs in a third-set tie-break at the Shanghai Masters",
  "Bengaluru gets its first metro feeder buses on the Purple Line from this Friday",
  "Nifty IT falls one per cent ahead of TCS results as US visa worries return",
];

// The heaviest Page One the rules allow, built on a real edition so every block has real data
export function heavyEdition(E) {
  const H = JSON.parse(JSON.stringify(E)), stories = [];
  if (H.front) stories.push(H.front.lead, ...(H.front.seconds || []), ...(H.front.briefs || []));
  for (const S of Object.values(H.sections || {})) stories.push(...(S.stories || []), ...(S.briefs || []));
  const lead = H.front.lead, rest = stories.filter(s => s && s.id !== lead.id);
  const pick = i => rest[i % rest.length] || lead;
  H.glance = [{ section: lead.kicker || "Lead", line: lead.headline, target: lead.id },
    ...LINES.map((line, i) => ({ section: pick(i).kicker || "News", line, subject: line.split(" ")[0], target: pick(i).id }))];
  H.big_day = true;
  H.editor_note = "Max won in Singapore at the tenth attempt and India went 2–1 up in Indore. The Riyadh strike killed an Indian, and we waited for a second source.";
  H.house_note = "Hamilton overruled his strategists, lost a podium and apologised on the in-lap. The strategists were too polite to say anything on the radio, which is the most British thing to happen at Marina Bay all year.";
  return H;
}

export async function fitCheck({ sizes = SIZES, log = console.log } = {}) {
  const E = heavyEdition(JSON.parse(readFileSync(`${D}/content/latest.json`, "utf8")));
  const snap = JSON.parse(readFileSync(`${H}content/editions/${E.date}.json`, "utf8")).snapshot || {};
  const want = E.glance.length; // the lead plus ten lines
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const fails = [];
  try {
    for (const [name, [w, h]] of Object.entries(sizes)) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      const T0 = Date.parse(`${E.date}T09:30:00Z`);
      await ctx.addInitScript(`(function(){var R=Date,O=${T0}-R.now();function D(){var a=[].slice.call(arguments);return a.length?new(Function.prototype.bind.apply(R,[null].concat(a))):new R(R.now()+O)}D.prototype=R.prototype;D.now=function(){return R.now()+O};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;})();try{sessionStorage.setItem("h1400-pressed","1")}catch(e){}`);
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", e => errs.push(e.message));
      await p.route(/^https?:/, r => r.abort());
      await p.route(/^https:\/\/house14\.test\//, r => {
        const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
        if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value, as_of: s.as_of, source: s.source, stale: false } }) : r.fulfill({ status: 404, json: {} }); }
        if (u.pathname === "/content/latest.json") return r.fulfill({ json: E });
        if (u.pathname.startsWith("/api/")) return r.fulfill({ status: 404, json: {} });
        let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html";
        return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" });
      });
      await p.goto("https://house14.test/#d-one");
      await p.waitForSelector("#p1-minute ol.min li", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const m = await p.evaluate(() => {
        const vh = innerHeight, se = document.scrollingElement;
        const lead = document.querySelector("#p1-minute .leadh"), lis = [...document.querySelectorAll("#p1-minute ol.min li")];
        const off = [lead, ...lis].filter(el => el && el.getBoundingClientRect().bottom > vh + 1).length;
        const end = document.querySelector(".p1end")?.getBoundingClientRect().bottom ?? 0;
        const cut = [...document.querySelectorAll("#p1-minute b, #p1-minute h3")].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === "ellipsis").length;
        return { scroll: se.scrollHeight - vh, lines: (lead ? 1 : 0) + lis.length, off, end: Math.round(end), vh, zoom: Number(document.getElementById("layout")?.style.zoom || 1), bold: document.querySelectorAll("#p1-minute strong").length, cut };
      });
      const bad = [];
      if (m.scroll > 1) bad.push(`the page scrolls by ${m.scroll}px`);
      if (m.lines < want) bad.push(`${m.lines} of ${want} day-in-a-minute lines show`);
      if (m.off) bad.push(`${m.off} line(s) run below the screen`);
      if (m.end > m.vh + 1) bad.push(`the House Note and foot end at ${m.end}px of ${m.vh}px`);
      if (m.zoom < 0.8) bad.push(`the type is scaled to ${m.zoom.toFixed(2)} (floor 0.8)`);
      if (m.cut) bad.push(`${m.cut} line(s) cut off with an ellipsis`);
      if (errs.length) bad.push(`page error: ${errs[0]}`);
      log(`${bad.length ? "FAIL" : "ok  "} ${name} ${w}x${h}: ${m.lines} lines, ${m.bold} bold subjects, type ${m.zoom.toFixed(2)}${bad.length ? ` · ${bad.join("; ")}` : ""}`);
      if (bad.length) fails.push(`${name}: ${bad.join("; ")}`);
      await ctx.close();
    }
    // ⌘+ must make the text larger (Parth, 12 Oct 2026): at 125% browser zoom on the Air 13, the day in a minute's text
    // on screen must be at least 15% larger than at 100% (the page may scroll then; that is the reader's choice).
    const size = async Z => {
      const ctx = await b.newContext({ viewport: { width: Math.round(1470 / Z), height: Math.round(832 / Z) }, deviceScaleFactor: 2 * Z });
      if (Z !== 1) await ctx.addInitScript(`try{localStorage.setItem("h1400-zoom-test","${Z}")}catch(e){}`);
      const p = await ctx.newPage();
      await p.route(/^https?:/, r => r.abort());
      await p.route(/^https:\/\/house14\.test\//, r => {
        const u = new URL(r.request().url()), k = (u.pathname.match(/^\/api\/live\/([a-z_0-9]+)$/) || [])[1];
        if (k) { const s = snap[k]; return s?.value ? r.fulfill({ json: { ok: true, value: s.value } }) : r.fulfill({ status: 404, json: {} }); }
        if (u.pathname === "/content/latest.json") return r.fulfill({ json: E });
        let f = D + u.pathname; if (u.pathname === "/") f = D + "/index.html";
        return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" }) : r.fulfill({ status: 404, body: "" });
      });
      await p.goto("https://house14.test/#d-one");
      await p.waitForSelector("#p1-minute ol.min b", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const v = await p.evaluate(() => { const el = document.querySelector("#p1-minute ol.min b"); return el ? parseFloat(getComputedStyle(el).fontSize) * Number(document.getElementById("layout")?.style.zoom || 1) : 0; });
      await ctx.close();
      return v * Z;
    };
    const s100 = await size(1), s125 = await size(1.25), grow = s100 ? s125 / s100 : 0;
    log(`${grow >= 1.15 ? "ok  " : "FAIL"} ⌘+ to 125% on the Air 13: text ${s100.toFixed(1)}pt -> ${s125.toFixed(1)}pt (x${grow.toFixed(2)})`);
    if (grow < 1.15) fails.push(`⌘+ to 125%: the text only grows x${grow.toFixed(2)} (needs x1.15)`);
  } finally { await b.close(); }
  return fails;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  if (!existsSync(`${D}/index.html`)) { console.error("fit-check: no dist/ yet; run `npm run build` first"); process.exit(2); }
  const fails = await fitCheck();
  if (fails.length) { console.error(`\nPage One does not fit:\n- ${fails.join("\n- ")}`); process.exit(1); }
  console.log("\nPage One fits one screen at every size.");
}
