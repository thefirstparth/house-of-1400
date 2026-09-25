// Validate an edition before it is published. Exit 1 on any error.
// Usage: node scripts/validate.mjs [content/editions/YYYY-MM-DD.json]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

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
const SKIP_KEYS = new Set(["url", "id", "thread_id", "target", "section", "source", "when_utc", "until_utc", "date", "weekday", "cut_ist", "color", "verdict", "kind", "group", "language", "entity", "level", "snapshot", "as_of", "local_tz"]);

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

  // Date and weekday
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(E.date + "T12:00:00Z").getUTCDay()];
  if (E.weekday !== wd) errors.push(`weekday: ${E.weekday} but ${E.date} is ${wd}`);
  const cut = Date.parse(`${E.date}T${E.cut_ist || "14:00"}:00+05:30`);

  const items = allItems(E);

  // Sources on every substantive story
  for (const s of items) if (s._kind === "story" && !(s.sources || []).some(x => /^https?:\/\//.test(x.url))) errors.push(`sources: ${s._where} has no source URL`);

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

  // Glance targets must exist
  const targets = new Set([...items.map(s => s.id), ...Object.keys(E.sections || {}), "front", "fixtures", "madrid", "paddock", "tables", "ledger", "sky", "screen", "talk", "betting", "house", "deuce", "crease"]);
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
    ["talk", (E.trends?.india?.length || 0) >= 5 && (E.trends?.world?.length || 0) >= 5, "Talk of the Day needs at least 5 India and 5 world trends"],
    ["betting", (E.betting?.length || 0) >= 8, "The Betting Window needs 8 to 10 markets"],
    ["ledger_notes", ["Sensex", "Nifty 50", "Nasdaq-100"].some(n => E.sections?.ledger?.data?.notes?.[n]), "The Ledger needs driver notes (sections.ledger.data.notes) for the indices"],
  ];
  for (const [key, met, msg] of need) if (!met && !E.coverage_waivers?.[key]) errors.push(`coverage: ${msg}, or explain in coverage_waivers.${key}`);
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
    // c) Markets still trending carry over (ledger/betting-carry.json, written by scripts/betting-candidates.mjs).
    let carry = null;
    try { carry = read("ledger/betting-carry.json"); } catch {}
    if (carry?.date === E.date) {
      const have = new Set((E.betting || []).map(b => b.id));
      const miss = carry.carry.filter(c => !have.has(c.id));
      if (miss.length && !E.coverage_waivers?.betting_carry) errors.push(`coverage: still-trending markets missing from The Betting Window (${miss.map(m => m.title).join("; ")}); keep them with "since", or explain in coverage_waivers.betting_carry`);
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
