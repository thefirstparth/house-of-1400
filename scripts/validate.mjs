// Validate an edition before it is published. Exit 1 on any error.
// Usage: node scripts/validate.mjs [content/editions/YYYY-MM-DD.json]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { matchItem } from "../lib/trial.js";
import { MAX_ORDERS } from "../lib/art.js";

export const BANNED_WORDS = ["pivotal", "crucial", "landmark", "testament", "underscores", "underscore", "highlights", "showcases", "delve", "delves", "landscape", "navigate", "navigates", "robust", "seamless", "seamlessly", "notably", "quietly", "amid", "amidst"];
const BANNED_PATTERNS = [
  [/—/, "em dash"],
  [/\bexperts (say|believe|warn)\b/i, "vague attribution"],
  [/\b(it'?s|this is|that'?s) not (just|only|merely)\b/i, "not-just reframe"],
  [/\bnot (just|only|merely) [^.;]{1,60}, but\b/i, "not-X-but-Y reframe"],
  [/, (highlighting|underscoring|signall?ing|reflecting|showcasing|cementing|emphasi[sz]ing|marking a|paving the way)\b/i, "-ing tail"],
  [/\b(nothing (cleared|worth|made) |no confirmed \w+ (was|were) found|could not (be )?(confirm|find|verif)|at press time|press time|by press time|we (searched|checked|looked)|our research|the (daily )?run\b|this edition's research|validator|placeholder|lorem ipsum|TODO|TBD\b)/i, "process or absence language"],
  [/\{\{|\}\}|\[(sample|insert|tk)\]/i, "template residue"],
  [/\bas an ai\b/i, "AI tell"],
];
const ALLOW_TBD = /match TBD/;
const SKIP_KEYS = new Set(["url", "id", "thread_id", "target", "section", "source", "when_utc", "until_utc", "date", "weekday", "cut_ist", "printed_at", "color", "verdict", "kind", "group", "language", "entity", "level", "snapshot", "as_of", "local_tz"]);

const root = fileURLToPath(new URL("..", import.meta.url));
const read = p => JSON.parse(readFileSync(new URL(p, `file://${root}`), "utf8"));

function walkStrings(obj, path, out) {
  if (typeof obj === "string") out.push([path, obj]);
  else if (Array.isArray(obj)) obj.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (!SKIP_KEYS.has(k)) walkStrings(v, path ? `${path}.${k}` : k, out);
  return out;
}

const STOP = new Set("a an the of in on at to for and or but with from by as is are was were be after before over under into than this that his her their its it he she they we you i".split(" "));
const toks = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)));
const jaccard = (a, b) => { const A = toks(a), B = toks(b); const i = [...A].filter(x => B.has(x)).length; return i / (A.size + B.size - i || 1); };

export function allItems(E) {
  const items = [];
  if (E.front) {
    items.push({ ...E.front.lead, _where: "front.lead", _kind: "story" });
    E.front.seconds?.forEach((s, i) => items.push({ ...s, _where: `front.seconds[${i}]`, _kind: "story" }));
    E.front.briefs?.forEach((s, i) => items.push({ ...s, _where: `front.briefs[${i}]`, _kind: "brief" }));
  }
  for (const [id, S] of Object.entries(E.sections || {})) {
    S.stories?.forEach((s, i) => items.push({ ...s, _where: `sections.${id}.stories[${i}]`, _kind: "story" }));
    S.briefs?.forEach((s, i) => items.push({ ...s, _where: `sections.${id}.briefs[${i}]`, _kind: "brief" }));
    S.lines?.forEach((s, i) => items.push({ ...s, section: id, sources: [{ label: s.source, url: s.url }], _where: `sections.${id}.lines[${i}]`, _kind: "line" }));
  }
  return items;
}

export function validateEdition(E, { ledger = null, schema = read("content/schema.json") } = {}) {
  const errors = [], warnings = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const v = ajv.compile(schema);
  if (!v(E)) for (const e of v.errors) errors.push(`schema: ${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
  if (!E || typeof E !== "object" || !E.date) return { errors, warnings };

  // Art orders (lib/art.js): printed stories only. From 2 Oct 2026 (Parth, 1 Oct): the lead always, and every desk
  // (config desks) that printed a story gets at least one drawing, on its top story; one or two more on a big day; at
  // most eight. Lazy loading keeps the page light. Errors, because the orders are only a list in the edition: missing
  // or late images never hold up the paper.
  {
    const ids = new Set(allItems(E).filter(i => i._kind === "story").map(i => i.id));
    for (const o of E.art_orders || []) if (!ids.has(o.story_id)) warnings.push(`art_orders: ${o.story_id} is not a printed story (briefs get no art)`);
    const got = new Set((E.art_orders || []).map(o => o.story_id).filter(id => ids.has(id)));
    if (E.date > "2026-10-01") {
      let DESKS = []; try { DESKS = read("config/house.json").desks || []; } catch {}
      const deskOf = sec => DESKS.find(d => d.id !== "front" && d.sections.includes(sec))?.id;
      if (E.front?.lead && !got.has(E.front.lead.id)) errors.push(`art_orders: order the lead (${E.front.lead.id}); it is drawn 16:9 on the Front Page`);
      // each desk's stories in the order they are printed: Front Page seconds first, then the sections in desk order
      const order = [...(E.front?.seconds || []), ...DESKS.flatMap(d => d.sections.flatMap(sec => E.sections?.[sec]?.stories || []))];
      for (const d of DESKS.filter(d => d.id !== "front")) {
        const mine = order.filter(st => deskOf(st.section) === d.id);
        if (mine.length && !mine.some(st => got.has(st.id))) errors.push(`art_orders: ${d.name} printed ${mine.length} ${mine.length > 1 ? "stories" : "story"} and has no drawing; order its top story (${mine[0].id})`);
      }
      if (got.size > MAX_ORDERS) errors.push(`art_orders: ${got.size} ordered; at most ${MAX_ORDERS}`);
    } else if (E.date > "2026-09-29") {
      if (got.size < Math.min(2, ids.size)) warnings.push(`art_orders: ${got.size} ordered; order 2 to 5 printed stories`);
      if (got.size > 5) warnings.push(`art_orders: ${got.size} ordered; at most 5 are drawn`);
    }
  }

  // Date and weekday
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(E.date + "T12:00:00Z").getUTCDay()];
  // Where to watch tennis: two independent sources for the Indian streamer, and never Tennis TV (Parth, 1 Oct).
  for (const ev of E.tennis?.events || []) {
    if (!ev.where) continue;
    if (/tennis\s*tv/i.test(ev.where)) errors.push(`tennis: ${ev.name} lists Tennis TV; name the Indian streaming partner, or leave "where" out`);
    const hosts = new Set((ev.where_sources || []).map(u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean));
    if (hosts.size < 2) errors.push(`tennis: ${ev.name} says "${ev.where}" with ${hosts.size} source(s); two different sites must name it, or leave "where" out`);
  }
  // The race ahead: prices at press time as published, and every pick linked to an open outlet.
  const pv = E.sections?.paddock?.data?.preview;
  if (pv) {
    if (!pv.text) errors.push("paddock: preview has no text");
    for (const o of pv.market?.outcomes || []) if (!(o.prob >= 0 && o.prob <= 100)) errors.push(`paddock: preview market price for ${o.name} is ${o.prob}`);
    let PH = []; try { PH = read("config/house.json").sources?.paywalled?.hosts || []; } catch {}
    const PAID = u => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return PH.some(p => h === p || h.endsWith("." + p)); } catch { return false; } };
    for (const x of pv.picks || []) if (!/^https:\/\//.test(x.url || "") || PAID(x.url)) errors.push(`paddock: preview pick from ${x.outlet} needs an open outlet's link`);
  }
  // Max Watch opens with the live position, points and gap; the note must not say them again (1 Oct audit).
  const mn = E.sections?.paddock?.data?.max_note;
  if (mn && /\bstandings\b|\bpoints?\b|\bbehind\b|\bchampionship\b/i.test(mn)) errors.push(`paddock: max_note repeats the standings the page already prints live ("${mn.slice(0, 60)}"); say only what the numbers do not`);
  if (E.weekday !== wd) errors.push(`weekday: ${E.weekday} but ${E.date} is ${wd}`);
  const cut = Date.parse(`${E.date}T${E.cut_ist || "14:00"}:00+05:30`);

  const items = allItems(E);

  // Sources on every substantive story
  for (const s of items) if (s._kind === "story" && !(s.sources || []).some(x => /^https?:\/\//.test(x.url))) errors.push(`sources: ${s._where} has no source URL`);
  // From 1 Oct 2026 (Parth has no subscription to them): nothing printed may rest only on paywalled outlets (config
  // sources.paywalled). Find the story at an open outlet and link that; the wire check lists open outlets for each lead.
  if (E.date >= "2026-10-01") {
    let PW = []; try { PW = read("config/house.json").sources?.paywalled?.hosts || []; } catch {}
    const paid = u => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return PW.some(p => h === p || h.endsWith("." + p)); } catch { return false; } };
    for (const s of items) {
      const urls = (s.sources || []).map(x => x.url).filter(u => /^https?:\/\//.test(u || ""));
      if (urls.length && urls.every(paid)) errors.push(`sources: ${s._where} links only paywalled outlets (${[...new Set(urls.map(u => new URL(u).hostname.replace(/^www\./, "")))].join(", ")}); link an open outlet that reports it (ledger/wire-check.json lists them under leads)`);
    }
  }

  // Unique ids and one editorial home per thread (trends and betting included)
  const seenId = new Map(), seenThread = new Map();
  for (const s of items) {
    if (seenId.has(s.id)) errors.push(`dedup: id ${s.id} used at ${seenId.get(s.id)} and ${s._where}`); else seenId.set(s.id, s._where);
    if (seenThread.has(s.thread_id)) errors.push(`dedup: thread ${s.thread_id} printed at ${seenThread.get(s.thread_id)} and ${s._where}`); else seenThread.set(s.thread_id, s._where);
  }
  for (const [k, list] of [["trends.india", E.trends?.india], ["trends.world", E.trends?.world], ["betting", E.betting]]) {
    (list || []).forEach((t, i) => {
      if (t.thread_id && seenThread.has(t.thread_id)) errors.push(`dedup: ${k}[${i}] repeats thread ${t.thread_id} from ${seenThread.get(t.thread_id)}`);
      else if (t.thread_id) seenThread.set(t.thread_id, `${k}[${i}]`);
    });
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const sim = jaccard(items[i].headline, items[j].headline);
    if (sim >= 0.6) errors.push(`dedup: near-identical headlines at ${items[i]._where} and ${items[j]._where} (${sim.toFixed(2)})`);
  }
  const heads = items.map(s => s.headline.toLowerCase());
  const trendTerms = [...(E.trends?.india || []), ...(E.trends?.world || [])];
  const seenTerm = new Set();
  for (const t of trendTerms) {
    const term = t.term.toLowerCase();
    if (seenTerm.has(term)) errors.push(`dedup: trend "${t.term}" listed twice`);
    seenTerm.add(term);
    if (term.length >= 5 && heads.some(h => h.includes(term))) errors.push(`dedup: trend "${t.term}" is already a story headline; refill with the next trend`);
  }

  // Chronology: NEXT is the earliest confirmed future fixture, LAST the latest completed one.
  for (const [ent, c] of Object.entries(E.chronology || {})) {
    const fx = (E.fixtures || []).filter(f => f.entity === ent && !f.time_tbc);
    if (c.next) {
      const t = Date.parse(c.next.when_utc);
      if (!(t > cut - 6 * 36e5)) errors.push(`chronology: ${ent}.next (${c.next.when_utc}) is not after the information cut`);
      const earlier = fx.filter(f => Date.parse(f.when_utc) > cut && Date.parse(f.when_utc) < t);
      for (const f of earlier) errors.push(`chronology: ${ent}.next is ${c.next.label} but "${f.label}" at ${f.when_utc} comes first`);
      if (fx.length && !fx.some(f => f.when_utc === c.next.when_utc)) warnings.push(`chronology: ${ent}.next is not in the fixture list`);
    }
    if (c.last && Date.parse(c.last.when_utc) > cut) errors.push(`chronology: ${ent}.last (${c.last.when_utc}) is after the information cut`);
  }
  for (const f of E.fixtures || []) if (Number.isNaN(Date.parse(f.when_utc))) errors.push(`fixtures: bad time ${f.when_utc}`);

  // The editor's note runs only on a big day, named from config paper.editor.big_days.kinds (Parth, 1 Oct)
  if (E.editor_note) {
    let K = {}; try { K = read("config/house.json").paper?.editor?.big_days?.kinds || {}; } catch {}
    if (!E.big_day) errors.push("editor_note: only on a big day; set big_day {kind, why} or drop the note");
    else if (!K[E.big_day.kind]) errors.push(`editor_note: big_day.kind "${E.big_day.kind}" is not one of ${Object.keys(K).join(", ")}`);
  }
  // Glance targets must exist
  const targets = new Set([...items.map(s => s.id), ...Object.keys(E.sections || {}), "front", "week", "fixtures", "madrid", "paddock", "tables", "ledger", "sky", "screen", "talk", "betting", "house", "deuce", "crease"]);
  for (const g of E.glance || []) if (!targets.has(g.target)) errors.push(`glance: target ${g.target} does not exist`);

  // Tennis: NEXT EVENT when no match is confirmed
  for (const p of E.tennis?.players || []) if (!p.next_match && !p.next_event && !p.note) warnings.push(`tennis: ${p.name} has no next match, next event or note`);

  // Screen: verdict "early" when fewer than 3 reviews is a judgement; just check languages via schema.

  // Banned patterns and empty strings
  for (const [path, str] of walkStrings(E, "", [])) {
    if (!str.trim()) { errors.push(`empty: ${path}`); continue; }
    for (const w of BANNED_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(str)) errors.push(`banned word "${w}" at ${path}`);
    for (const [re, name] of BANNED_PATTERNS) {
      const m = str.match(re);
      if (m && !(name === "process or absence language" && /TBD/.test(m[0]) && ALLOW_TBD.test(str))) errors.push(`${name} at ${path}: "${m[0]}"`);
    }
  }

  // Coverage minimums from Parth's review of 25 Sep. Each can be waived only with a written reason in
  // coverage_waivers.<key> (never printed), so a thin section is a decision, not an accident.
  const weekend = ["fri", "sat", "sun"].includes(E.weekday);
  const count = id => (E.sections?.[id]?.stories?.length || 0) + (E.sections?.[id]?.briefs?.length || 0);
  const need = [
    ["pitch", count("pitch") >= 2, "The Wider Pitch needs at least 2 items"],
    ["sidelines", count("sidelines") >= 2, "The Sidelines needs at least 2 items"],
    ["screen", (E.screen || []).filter(x => !x.coming_soon).length >= (weekend ? 5 : 3), `Screen & Stage needs at least ${weekend ? 5 : 3} current titles`],
    // From 29 Sep 2026 (Parth, 28 Sep): 2 to 4 Coming soon titles every day.
    ["screen_soon", E.date <= "2026-09-28" || (E.screen || []).filter(x => x.coming_soon).length >= 2, "Screen & Stage needs at least 2 Coming soon titles (coming_soon: true)"],
    ["talk", (E.trends?.india?.length || 0) >= 5 && (E.trends?.world?.length || 0) >= 5, "Talk of the Day needs at least 5 India and 5 world trends"],
    ["betting", (E.betting?.length || 0) >= 8, "The Betting Window needs 8 to 10 markets"],
    ["ledger_notes", ["Sensex", "Nifty 50", "Nasdaq-100"].some(n => E.sections?.ledger?.data?.notes?.[n]), "The Ledger needs driver notes (sections.ledger.data.notes) for the indices"],
  ];
  for (const [key, met, msg] of need) {
    if (met) continue;
    const w = E.coverage_waivers?.[key];
    if (!w) { errors.push(`coverage: ${msg}, or explain in coverage_waivers.${key}`); continue; }
    // From 29 Sep 2026 a thin section shows the working (Parth, 28 Sep): the stories considered and why each fell
    // short, or, when there were none, where Bhide looked. Floors are unchanged; a thin section is printed thin.
    if (E.date > "2026-09-28" && !((w.considered || []).length >= 2 || (w.looked_at || []).length >= 2))
      errors.push(`coverage_waivers.${key}: a thin section needs {why, considered: ["candidate: why it fell short", ...]} (at least two), or {why, looked_at: [pages or searches]} (at least two) when there was nothing to consider`);
  }
  // The usual upper end of each section (config section_ranges): a warning, never an error.
  let RG = {};
  try { RG = read("config/house.json").section_ranges || {}; } catch {}
  const over = (key, n, max, what) => { if (max && n > max) warnings.push(`long: ${RG[key]?.label || key} has ${n} ${what}; its usual range tops out at ${max}. Keep the strongest and move the rest to briefs, or keep it if the news is that big.`); };
  over("front", 1 + (E.front?.seconds?.length || 0) + (E.front?.briefs?.length || 0), RG.front?.max_items, "items");
  for (const k of ["madrid", "pitch", "sidelines"]) over(k, count(k), RG[k]?.max_items, "items");
  over("dateline", E.sections?.dateline?.stories?.length || 0, RG.dateline?.max_stories, "full stories");
  over("screen", (E.screen || []).filter(x => !x.coming_soon).length, weekend ? RG.screen?.max_weekend : RG.screen?.max_weekday, "current titles");
  over("screen", (E.screen || []).filter(x => x.coming_soon).length, RG.screen?.max_coming_soon, "Coming soon titles");
  for (const g of ["india", "world"]) over("talk", E.trends?.[g]?.length || 0, RG.talk?.max_each, `${g} trends`);
  over("week_ahead", E.week_ahead?.length || 0, RG.week_ahead?.max_items, "items");
  if ((E.betting?.length || 0) > 10) errors.push("coverage: The Betting Window shows at most 10 markets");
  // From 26 Sep 2026 the daily run must show its sweeps (checks) and keep what is still trending in The Betting Window.
  if (E.date > "2026-09-25") {
    const ids = new Set(items.map(s => s.id));
    // a) Every stock, industry and cluster flagged by /api/live/movers (in the snapshot) gets an answer: why it moved,
    //    and the story that covers it, or why it is not news.
    const MV = E.snapshot?.movers?.value;
    if (!MV) errors.push("checks: snapshot.movers is missing; run the snapshot so the market movers can be checked");
    else {
      const answers = E.checks?.movers || [];
      const answered = key => answers.some(a => a.about.toLowerCase().includes(key.toLowerCase()));
      for (const s of MV.stocks || []) if (!answered(s.symbol) && !answered(s.name)) errors.push(`checks.movers: ${s.name} (${s.symbol}) moved ${s.sessions.filter(v => v != null).map(v => v + "%").join(", ")}; say why in checks.movers`);
      for (const c of [...(MV.clusters || []), ...(MV.industries || [])]) if (!answered(c.industry)) errors.push(`checks.movers: ${c.industry} moved together${c.session ? " on " + c.session : ""}; say why in checks.movers`);
      for (const a of answers) if (a.covered_by && !ids.has(a.covered_by)) errors.push(`checks.movers: covered_by "${a.covered_by}" is not an item in this edition`);
    }
    // b) The India money sweep: at least three sources from three different sites, read for this edition.
    const hosts = new Set((E.checks?.money_sweep || []).map(u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean));
    if (hosts.size < 3) errors.push("checks.money_sweep: list the regulator and personal-finance pages read for the India money sweep (at least 3 sites)");
    //    From 29 Sep 2026 (ledger/lessons.json, the TRAI miss): at least one page from each group in config money.groups,
    //    the bodies that set rules on money and the bodies that set prices and charges people pay. A Google News search
    //    restricted to a body's site (site:pib.gov.in) counts for that body.
    if (E.date > "2026-09-28") {
      const G = read("config/house.json").money?.groups || {};
      const sweep = E.checks?.money_sweep || [];
      const hit = (u, h) => { try { const x = new URL(u); const host = x.hostname.replace(/^www\./, ""); return host === h || host.endsWith(`.${h}`) || decodeURIComponent(x.search).includes(`site:${h}`); } catch { return false; } };
      for (const [k, g] of Object.entries(G)) if (!sweep.some(u => (g.hosts || []).some(h => hit(u, h)))) errors.push(`checks.money_sweep: read at least one page from ${g.label} (config money.groups.${k}: ${(g.bodies || []).map(x => x.name).join(", ")})`);
    }
    // c) The national front-page sweep: the India stories leading the national press are in the paper or explained.
    const nat = E.checks?.national || [];
    const natHosts = new Set((E.checks?.national_sweep || []).map(u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean));
    if (natHosts.size < 3) errors.push("checks.national_sweep: list the national front pages read (at least 3 sites)");
    if (nat.length < 5) errors.push("checks.national: record the top India stories from the national front pages (at least 5), each covered or explained");
    for (const n of nat) {
      if (n.covered_by && !ids.has(n.covered_by)) errors.push(`checks.national: covered_by "${n.covered_by}" is not an item in this edition`);
      if (!n.covered_by && !(n.answer && n.answer.length >= 15)) errors.push(`checks.national: "${n.story}" is neither covered (covered_by) nor explained (answer)`);
    }
    // d) India's cricket times come from scripts/cricket-times.mjs (Cricbuzz's schedule, run today). A start time
    // Cricbuzz has announced is printed, never "TBC", and the edition's next match agrees with it to 30 minutes.
    if (E.date > "2026-09-26") {
      let ct = null;
      try { ct = read("ledger/cricket-times.json"); } catch {}
      if (!ct || ct.date !== E.date) errors.push("cricket: run `node scripts/cricket-times.mjs` for India's match times (ledger/cricket-times.json is missing or not from today)");
      else if (ct.error) warnings.push(`cricket: Cricbuzz was unavailable (${ct.error}); times must come from BCCI or ESPNcricinfo`);
      else {
        const ahead = ct.matches.filter(m => Date.parse(m.start) > cut);
        const nx = E.chronology?.india_cricket?.next, first = ahead[0];
        if (first && nx) {
          if (first.time_announced && nx.time_tbc) errors.push(`chronology.india_cricket.next: marked time TBC, but Cricbuzz has ${first.desc} v ${first.opponent} at ${first.ist} IST`);
          if (!nx.time_tbc && Math.abs(Date.parse(nx.when_utc) - Date.parse(first.start)) > 30 * 6e4) errors.push(`chronology.india_cricket.next: ${nx.when_utc} does not match Cricbuzz's ${first.desc} v ${first.opponent} at ${first.start}`);
        }
        for (const f of E.fixtures || []) {
          if (f.entity !== "india_cricket") continue;
          const m = ahead.find(x => Math.abs(Date.parse(x.start) - Date.parse(f.when_utc)) < 18 * 36e5);
          if (m?.time_announced && f.time_tbc) errors.push(`fixtures: "${f.label}" is marked time TBC, but Cricbuzz has it at ${m.ist} IST`);
          else if (m?.time_announced && Math.abs(Date.parse(m.start) - Date.parse(f.when_utc)) > 30 * 6e4) errors.push(`fixtures: "${f.label}" is at ${f.when_utc}, Cricbuzz has ${m.start}`);
        }
        // From 29 Sep 2026 (Parth, 28 Sep): The Crease says how many matches each series under way has, and always
        // carries an "After this" row with India's next series.
        if (E.date > "2026-09-28" && ct.series?.length) {
          const rows = E.sections?.crease?.data?.rows || [], txt = r => `${r.label} ${r.text}`;
          const next = ct.series.find(x => !x.now);
          if (next && !rows.some(r => /after this/i.test(r.label) && new RegExp(String(next.opponent || "").split(" ")[0], "i").test(r.text)))
            errors.push(`crease: add an "After this" row (sections.crease.data.rows) with India's next series: ${next.name} from ${next.from} (see ledger/cricket-times.json)`);
          for (const x of ct.series.filter(x => x.now && x.parts.some(p => p.total)))
            if (!rows.some(r => new RegExp(String(x.opponent || "").split(" ")[0], "i").test(txt(r)) && x.parts.some(p => p.total && new RegExp(`\\b${p.total}\\b`).test(txt(r)))))
              warnings.push(`crease: say how many matches the ${x.name} has (${x.parts.filter(p => p.total).map(p => `${p.format} ${p.total}`).join(", ")}) in its row`);
        }
      }
    }
    // Letters to the editor: every letter in today's inbox (scripts/letters.mjs) gets an answer in checks.letters,
    // saying what the editor did with it.
    let inbox = null;
    try { inbox = read("ledger/letters-inbox.json"); } catch {}
    if (inbox?.date === E.date) {
      const done = new Map((E.checks?.letters || []).map(l => [l.id, l]));
      for (const l of inbox.letters || []) {
        const a = done.get(l.id);
        if (!a || !(a.action || "").trim() || a.action.length < 15) errors.push(`checks.letters: letter ${l.id} ("${String(l.text).slice(0, 50)}") has no answer; say what the edition did about it`);
      }
    }
    for (const r of E.letters || []) if (!(E.checks?.letters || []).some(l => l.id === r.letter_id)) errors.push(`letters: reply to ${r.letter_id} is not in checks.letters`);
    // The wider net and the money calendar (ledger/changes.json), from 29 Sep 2026: the run records the broad pages and
    // searches it used, and every change taking effect in the next 30 days that has not been printed is printed or
    // answered in checks.changes. publish.mjs marks it printed.
    if (E.date > "2026-09-28") {
      if ((E.checks?.money_net || []).length < 2) errors.push("checks.money_net: record the pages and searches used for the wider net (at least two): what changed what people in India pay, earn, save, borrow, invest or insure?");
      let cal = null;
      try { cal = read("ledger/changes.json"); } catch {}
      const soon = new Date(Date.parse(E.date + "T00:00:00Z") + 30 * 864e5).toISOString().slice(0, 10);
      for (const c of cal?.changes || []) {
        if (c.printed_on || c.settled || !c.effective || c.effective < E.date || c.effective > soon) continue;
        const a = (E.checks?.changes || []).find(x => x.id === c.id);
        if (!a) errors.push(`checks.changes: "${c.what.slice(0, 80)}" (${c.who}, from ${c.effective}) takes effect within 30 days and has not been printed; print it and record {id: "${c.id}", covered_by}, or say why it is no longer news in {id, action}`);
        else if (a.covered_by && !ids.has(a.covered_by)) errors.push(`checks.changes: covered_by "${a.covered_by}" is not an item in this edition`);
        else if (!a.covered_by && !((a.action || "").trim().length >= 15)) errors.push(`checks.changes: ${c.id} needs covered_by or an action saying why it is no longer news`);
      }
    }
    // Tennis next matches (from 30 Sep 2026; Parth, 29 Sep): ESPN's time is printed, and Tennis Explorer is the second
    // opinion (tennis_players in the snapshot). ESPN lists a match in the next three days: it is printed at ESPN's time.
    // Tennis Explorer has a different time: the player's note says so, with that time in IST, so Parth knows to check.
    // Only Tennis Explorer lists one: a warning to check and print it.
    if (E.date > "2026-09-29") {
      const ist = iso => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
      for (const p of E.snapshot?.tennis_players?.value?.players || []) {
        const e = p.next, b = p.backup, soon = x => x && Date.parse(x.when_utc) > cut && Date.parse(x.when_utc) - cut <= 72 * 36e5;
        const P = (E.tennis?.players || []).find(x => x.name === p.name), mine = P?.next_match;
        const say = x => `${x.round ? x.round + " " : ""}v ${x.opponent} at ${x.event}, ${ist(x.when_utc)} IST`;
        if (soon(e)) {
          if (!mine) errors.push(`tennis: ESPN has ${p.name}'s next match (${say(e)}); print it as next_match`);
          else if (!mine.when_utc || Math.abs(Date.parse(mine.when_utc) - Date.parse(e.when_utc)) > 30 * 6e4) errors.push(`tennis: ${p.name}'s next match should be at ESPN's time (${say(e)})`);
          if (soon(b) && p.agree === false && !String(P?.note || "").includes(ist(b.when_utc)))
            errors.push(`tennis: Tennis Explorer has ${p.name}'s match at ${ist(b.when_utc)} IST, not ${ist(e.when_utc)}; say so in one line in the player's note so Parth can check`);
        } else if (soon(b) && !mine) warnings.push(`tennis: only Tennis Explorer lists ${p.name}'s next match (${say(b)}); check the tournament's order of play and print it (time TBC if unconfirmed)`);
      }
    }
    // The wire check (from 30 Sep 2026, Parth's review of 29 Sep; scripts/wire-check.mjs): every story the day's news
    // widely agreed on, every story about someone Parth follows from three outlets (lib/trial.js wireCandidates), and
    // every paywalled lead with an open outlet, is carried (a story, a brief or an "Also in" line) or answered in
    // checks.wire with {id, covered_by} or {id, skip} (why it is not for this paper).
    if (E.date > "2026-09-29") {
      let wc = null;
      try { wc = read("ledger/wire-check.json"); } catch {}
      if (!wc || wc.date !== E.date) warnings.push("wire: run `node scripts/wire-check.mjs content/editions/YYYY-MM-DD.json` and answer what it lists (checks.wire)");
      else if (wc.error) warnings.push(`wire: the reading list was unavailable (${wc.error})`);
      else {
        const printed = items, answers = new Map((E.checks?.wire || []).map(w => [w.id, w]));
        for (const c of wc.candidates || []) {
          const a = answers.get(c.id);
          if (a?.covered_by) { if (!ids.has(a.covered_by)) errors.push(`checks.wire: covered_by "${a.covered_by}" is not an item in this edition`); continue; }
          if (a?.skip) { if (a.skip.trim().length < 12) errors.push(`checks.wire: say why "${c.title}" is not for this paper`); continue; }
          if (printed.some(it => matchItem(it, [{ title: c.title }]))) continue;
          errors.push(`checks.wire: "${c.title}" (${c.n} outlets) is neither in the paper nor answered; print it (a story, a brief or an Also in line) and record {id: "${c.id}", covered_by}, or {id: "${c.id}", skip: "why not"}`);
        }
        // Leads (1 Oct, after the Ronaldo miss: The Athletic's lead on it had three open outlets and went unanswered).
        // A lead with an open outlet is answered like a candidate; one with none yet cannot be printed, so it may wait.
        for (const l of wc.leads || []) {
          if (!l.id || !l.elsewhere?.length || l.carried_by) continue;
          const a = answers.get(l.id);
          if (a?.covered_by) { if (!ids.has(a.covered_by)) errors.push(`checks.wire: covered_by "${a.covered_by}" is not an item in this edition`); continue; }
          if (a?.skip) { if (a.skip.trim().length < 12) errors.push(`checks.wire: say why lead "${l.title}" is not for this paper`); continue; }
          if (printed.some(it => matchItem(it, [{ title: l.title }, ...l.elsewhere]))) continue;
          errors.push(`checks.wire: lead "${l.title}" (${l.lead_from}; open at ${l.elsewhere.map(e => e.outlet).join(", ")}) is neither in the paper nor answered; print it from the open outlet and record {id: "${l.id}", covered_by}, or {id: "${l.id}", skip: "why not"}`);
        }
      }
    }
    // Lessons (ledger/lessons.json): a story the paper missed and still owes is printed, or its lesson is answered with
    // the reason it is no longer news. publish.mjs marks an owed story printed once checks.lessons covers it.
    let lessons = null;
    try { lessons = read("ledger/lessons.json"); } catch {}
    for (const l of lessons?.lessons || []) {
      const o = l.owed;
      if (!o || o.printed_on || o.settled || (o.until && E.date > o.until) || l.reported >= E.date) continue;
      const a = (E.checks?.lessons || []).find(x => x.id === l.id);
      if (!a) errors.push(`checks.lessons: lesson ${l.id} still owes ${o.what}; print it and record {id, covered_by}, or say why it is no longer news in {id, action}`);
      else if (a.covered_by && !ids.has(a.covered_by)) errors.push(`checks.lessons: covered_by "${a.covered_by}" is not an item in this edition`);
      else if (!a.covered_by && !((a.action || "").trim().length >= 15)) errors.push(`checks.lessons: lesson ${l.id} needs covered_by or an action saying why it is no longer news`);
    }
    // d) Markets still trending carry over (ledger/betting-carry.json, written by scripts/betting-candidates.mjs).
    let carry = null;
    try { carry = read("ledger/betting-carry.json"); } catch {}
    if (carry?.date === E.date) {
      const have = new Set((E.betting || []).map(b => b.id));
      const miss = carry.carry.filter(c => !have.has(c.id));
      if (miss.length && !E.coverage_waivers?.betting_carry) errors.push(`coverage: still-trending markets missing from The Betting Window (${miss.map(m => m.title).join("; ")}); keep them with "since", or explain in coverage_waivers.betting_carry`);
    }
  }
  if (E.date > "2026-09-25") {
    // Mondays: the week ahead across the paper's areas, and the Ledger's weekend-and-week card.
    if (E.weekday === "mon") {
      const W = E.week_ahead || [], end = new Date(Date.parse(E.date + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10);
      const areas = new Set(W.map(w => w.area));
      if ((W.length < 6 || areas.size < 3) && !E.coverage_waivers?.week_ahead) errors.push(`coverage: Monday needs The Week Ahead with at least 6 dated items across at least 3 areas (has ${W.length} across ${areas.size}), or explain in coverage_waivers.week_ahead`);
      W.forEach((w, i) => { if (w.date < E.date || w.date > end) errors.push(`week_ahead[${i}]: ${w.date} is outside ${E.date} to ${end}`); });
      const m = E.sections?.ledger?.data?.monday;
      if ((!m?.mood || m.mood.length < 60 || (m.weekend || []).length < 2 || (m.watch || []).length < 2) && !E.coverage_waivers?.monday_ledger)
        errors.push("coverage: Monday needs sections.ledger.data.monday with mood (the market so far today and global cues), weekend (at least 2 things that changed since Friday's close) and watch (at least 2 market dates this week), or explain in coverage_waivers.monday_ledger");
    }
  }
  // Polymarket only from 26 Sep 2026 (Kalshi retired; the page no longer refreshes "ks:" ids).
  if (E.date > "2026-09-25") (E.betting || []).forEach((b, i) => { if (!/^pm:/.test(b.id || "")) errors.push(`betting[${i}]: Polymarket only, id must start with "pm:"`); });

  // Talk of the Day is written in English, with search volume.
  const latin = t => /^[\x20-\x7E\u00C0-\u024F\u2018-\u201D\u2013\u2026₹]+$/.test(t || "");
  for (const [k, list] of [["india", E.trends?.india], ["world", E.trends?.world]]) (list || []).forEach((t, i) => {
    if (!latin(t.term) || !latin(t.what)) errors.push(`trends.${k}[${i}]: write the term and the line in English`);
    if (!t.traffic) errors.push(`trends.${k}[${i}]: add traffic (search volume, e.g. "10K+")`);
  });

  // The information cut is 14:00 IST (runs start then).
  if (E.cut_ist !== "14:00" && !E.coverage_waivers?.cut) errors.push(`cut_ist is ${E.cut_ist}; the information cut is 14:00`);

  // Ledger: a thread only reprints if a key fact changed or a new fact was added.
  if (ledger?.threads?.length) {
    const byId = new Map(ledger.threads.map(t => [t.thread_id, t]));
    for (const s of items) {
      const t = byId.get(s.thread_id);
      if (!t || t.last_printed >= E.date) continue;
      if (!s.facts || !Object.keys(s.facts).length) { errors.push(`ledger: ${s._where} reprints thread ${s.thread_id} (last ${t.last_printed}) without facts`); continue; }
      const changed = Object.entries(s.facts).some(([k, v]) => String(t.facts?.[k]) !== String(v));
      if (!changed) errors.push(`ledger: ${s._where} reprints thread ${s.thread_id} with no changed or new fact`);
    }
  }
  return { errors, warnings };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let file = process.argv[2];
  if (!file) {
    const eds = existsSync(new URL("content/editions/", `file://${root}`)) ? readdirSync(new URL("content/editions/", `file://${root}`)).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
    file = eds.length ? `content/editions/${eds.at(-1)}` : "content/latest.json";
  }
  const E = JSON.parse(readFileSync(file, "utf8"));
  let ledger = null;
  try { ledger = read("ledger/story-ledger.json"); } catch {}
  const { errors, warnings } = validateEdition(E, { ledger });
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(errors.length ? `\n${file}: ${errors.length} error(s). Do not publish.` : `\n${file}: valid (${warnings.length} warning(s)).`);
  process.exit(errors.length ? 1 : 0);
}
