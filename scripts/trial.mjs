// The source trial's daily scorecard (config `trial`, docs/SOURCES-AUDIT.md). Runs after the day's edition is live
// and never changes it: it asks the trial sources what they would have given the paper at the 14:00 cut, compares
// that with what the paper printed, and writes ledger/trial/YYYY-MM-DD.json (the /trial page reads it) plus the
// raw reading list in ledger/trial/wire/. Any failure is recorded in the scorecard, never raised.
// Usage: node scripts/trial.mjs [YYYY-MM-DD] [--local] [--force]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureProxy } from "./proxy.mjs";
import { remoteLive, SITE_URL, useRemote } from "./remote.mjs";
import { allItems } from "./validate.mjs";
import { hostOf, tokens } from "../lib/trial.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJSON = p => JSON.parse(readFileSync(new URL(p, `file://${root}`), "utf8"));
const H = 36e5;

// ---------------------------------------------------------------- matching
const NOISE = /\b(hints?|answers?|wordle|strands|connections|horoscope|live updates?|lottery|price today|rate today|weather today|result today|live score|how to watch|where to watch|box office|collection day|viral|trailer|teaser|bigg boss|in all its colou?rs|review:)/i;
const normUrl = u => { try { const x = new URL(u); return (x.hostname.replace(/^(www|m|amp)\./, "") + x.pathname.replace(/\/amp\/?$|\/$/, "")).toLowerCase(); } catch { return null; } };

// A printed item is "in the Wire" when a Wire headline shares at least three meaningful words with it and those
// words are at least 40% of that headline, or when the Wire has the very page the story cites. The matched
// headline is kept so a person can check the call.
export function matchItem(item, candidates) {
  const urls = new Set((item.sources || []).map(s => normUrl(s.url)).filter(Boolean));
  for (const c of candidates) if (c.url && urls.has(normUrl(c.url))) return { how: "same page", title: c.title, outlet: c.outlet };
  const mine = new Set(tokens(`${item.headline || item.term || ""} ${String(item.short || item.text || item.what || "").slice(0, 400)} ${String(item.more || item.answer || "").slice(0, 1200)}`));
  let best = null;
  for (const c of candidates) {
    const t = [...new Set(tokens(c.title))];
    if (t.length < 3) continue;
    const shared = t.filter(w => mine.has(w)).length, score = shared / t.length;
    if (shared >= 3 && score >= 0.4 && (!best || score > best.score)) best = { how: "headline", title: c.title, outlet: c.outlet, score: Math.round(score * 100) / 100 };
  }
  return best;
}

export function candidatesOf(wire) {
  const out = [];
  for (const i of wire.items || []) {
    out.push({ title: i.title, outlet: i.outlet, url: i.kind === "signal" || i.kind === "search" ? null : i.url, section: i.section });
    for (const r of i.related || []) out.push({ title: r.title, outlet: r.outlet, url: null, section: i.section });
  }
  return out;
}

const sectionOf = it => it.section || (it._where.startsWith("front") ? "front" : it._where.split(".")[1]);

export function coverage(E, wire) {
  const cands = candidatesOf(wire);
  const rows = allItems(E).map(it => {
    const m = matchItem(it, cands);
    return { section: sectionOf(it), kind: it._kind, id: it.id, headline: it.headline, found: !!m, match: m };
  });
  const by = {};
  for (const r of rows) { const s = (by[r.section] ||= { printed: 0, found: 0 }); s.printed++; if (r.found) s.found++; }
  return { items: rows, by_section: by, printed: rows.length, found: rows.filter(r => r.found).length };
}

// Stories that India's national outlets led with (Google News India top and nation pages, three or more national
// outlets), and world stories that six or more outlets carried, which neither a printed item nor the run's own
// national check covers. These are for a person to judge: some are rightly left out.
export function missedCandidates(E, wire, nationalOutlets) {
  const printed = allItems(E), national = (E.checks?.national || []).map(n => ({ headline: n.story, answer: n.answer || "" }));
  const nat = new Set(nationalOutlets.map(x => x.toLowerCase()));
  const coveredBy = s => {
    const probe = [{ title: s.title, outlet: "" }, ...s.members.map(m => ({ title: m.title, outlet: m.outlet }))];
    for (const it of [...printed, ...national]) if (probe.some(p => matchItem(it, [p]))) return it.headline;
    return null;
  };
  const india = [], world = [];
  for (const s of wire.stories || []) {
    if (NOISE.test(s.title)) continue;
    const natN = s.outlets.filter(o => nat.has(o.toLowerCase())).length;
    const isIndia = s.signals.some(x => /^gn-in-(top|nation)#/.test(x)) && natN >= 3;
    const isWorld = !isIndia && s.signals.some(x => /^gn-(us-top|in-world)#/.test(x)) && s.n >= 6;
    if (!isIndia && !isWorld) continue;
    const by = coveredBy(s);
    const row = { title: s.title, outlets: s.outlets.slice(0, 8), n: s.n, national: natN, covered_by: by };
    (isIndia ? india : world).push(row);
  }
  return {
    india: { total: india.length, covered: india.filter(r => r.covered_by).length, not_covered: india.filter(r => !r.covered_by).sort((a, b) => b.national - a.national || b.n - a.n).slice(0, 15) },
    world: { total: world.length, covered: world.filter(r => r.covered_by).length, not_covered: world.filter(r => !r.covered_by).slice(0, 10) },
  };
}

// ---------------------------------------------------------------- source quality (tiers)
export function tierOf(url, tiers) {
  const h = hostOf(url); if (!h) return 3;
  const inList = list => list.some(d => h === d || h.endsWith(`.${d}`));
  return inList(tiers["1"]) ? 1 : inList(tiers["2"]) ? 2 : 3;
}
export function sourceQuality(E, tiers) {
  const counts = { 1: 0, 2: 0, 3: 0 }, weak = [], weakDomains = {};
  for (const it of allItems(E)) {
    const t = (it.sources || []).map(s => tierOf(s.url, tiers));
    t.forEach(x => counts[x]++);
    if (t.length && t.every(x => x === 3)) {
      weak.push({ section: sectionOf(it), headline: it.headline, domains: it.sources.map(s => hostOf(s.url)) });
      for (const s of it.sources) weakDomains[hostOf(s.url)] = (weakDomains[hostOf(s.url)] || 0) + 1;
    }
  }
  return { links_by_tier: counts, tier3_only: weak, tier3_domains: weakDomains };
}

// ---------------------------------------------------------------- Talk of the Day: would the attached articles have done?
export function talk(E, tiers) {
  const geos = E.snapshot?.trends?.value?.geos || {};
  const attached = {};
  for (const list of Object.values(geos)) for (const t of list) attached[t.term.toLowerCase()] = t.news || [];
  const rows = [...(E.trends?.india || []), ...(E.trends?.world || [])].map(r => {
    const news = attached[String(r.term).toLowerCase()] || [];
    const best = news.map(n => ({ outlet: n.source, url: n.url, tier: tierOf(n.url, tiers) })).sort((a, b) => a.tier - b.tier)[0] || null;
    const printedTier = r.url ? tierOf(r.url, tiers) : null;
    return { term: r.term, printed: r.url ? hostOf(r.url) : null, printed_tier: printedTier, attached: news.length, printed_is_attached: news.some(n => normUrl(n.url) === normUrl(r.url)),
      best_attached: best, attached_as_good: !!best && printedTier != null && best.tier <= printedTier };
  });
  return { rows, as_good: rows.filter(r => r.attached_as_good).length, total: rows.length };
}

// ---------------------------------------------------------------- tennis: ESPN against the paper's own next match
export function tennisCheck(E, tp) {
  return (tp?.players || []).map(p => {
    const paper = (E.tennis?.players || []).find(x => x.name === p.name);
    const pn = paper?.next_match, en = p.next;
    let verdict;
    if (!pn && !en) verdict = "agree: no match";
    else if (!pn) verdict = "ESPN has a match the paper did not print";
    else if (!en) verdict = "the paper has a match ESPN does not list";
    else verdict = Math.abs(Date.parse(pn.when_utc) - Date.parse(en.when_utc)) <= 30 * 60e3 ? "agree" : "different match or time";
    return { player: p.name, espn: en, paper: pn || null, paper_event: paper?.next_event?.text || null, verdict };
  });
}

// ---------------------------------------------------------------- Screen & Stage
export function screenCheck(E, sc) {
  const titles = (sc?.titles || []).map(t => {
    const p = (E.screen || []).find(x => x.title === t.title) || {};
    return { title: t.title, verdict: p.verdict, where: p.where, imdb: t.omdb?.imdb ?? null, rotten_tomatoes: t.omdb?.rotten_tomatoes ?? null, metacritic: t.omdb?.metacritic ?? null,
      omdb_error: t.omdb?.error || null, tmdb_stream_in: t.tmdb?.in_stream || null, tmdb_error: t.tmdb?.error || null };
  });
  const printed = new Set((E.screen || []).map(s => tokens(s.title).join(" ")));
  const chart = [...(sc?.chart?.movies || []).map(x => ({ ...x, type: "film" })), ...(sc?.chart?.shows || []).map(x => ({ ...x, type: "series" }))];
  return { titles, keys: sc?.keys || null,
    chart_not_printed: Array.isArray(sc?.chart?.movies) ? chart.filter(c => !printed.has(tokens(c.title).join(" "))).map(c => `${c.type} #${c.rank} ${c.title}${c.year ? ` (${c.year})` : ""}`) : sc?.chart,
    chart_printed: chart.filter(c => printed.has(tokens(c.title).join(" "))).map(c => c.title),
    box_office_tracked: Array.isArray(sc?.box_office) ? sc.box_office.slice(0, 12) : sc?.box_office };
}

// ---------------------------------------------------------------- The Ledger: NSE against the Yahoo scan
export function moversCheck(E, nse) {
  const snap = E.snapshot?.movers?.value;
  const flagged = (snap?.stocks || []).map(s => s.symbol);
  if (!nse) return { flagged };
  const lag = snap?.days?.[0] && nse.data_date ? Math.round((Date.parse(snap.days[0]) - Date.parse(nse.data_date)) / 864e5) : null;
  const nseBig = [...(nse.gainers || []), ...(nse.losers || [])].filter(s => Math.abs(s.pct) >= 8);
  return { yahoo_latest_session: snap?.days?.[0] || null, nse_data_date: nse.data_date, days_behind: lag, flagged,
    nse_8pct_moves: nseBig, nse_moves_not_flagged: lag === 0 ? nseBig.filter(s => !flagged.includes(s.symbol)).map(s => `${s.symbol} ${s.pct}%`) : "not comparable: NSE data is from an older session",
    corporate_actions: nse.actions, breadth: nse.breadth };
}

// ---------------------------------------------------------------- the rest
// WhereIsCricket prints "Wed 30 Sep" and "2:00 PM IST"; a paper fixture is the same match when it starts within
// three hours of that time.
export function wicTime(r, year) {
  const m = `${r.date} ${r.time}`.match(/(\d{1,2}) ([A-Za-z]{3})\S* (\d{1,2}):(\d{2}) ?(AM|PM)/i);
  if (!m) return null;
  const h = (+m[3] % 12) + (/pm/i.test(m[5]) ? 12 : 0);
  const d = new Date(`${m[1]} ${m[2]} ${year} ${String(h).padStart(2, "0")}:${m[4]}:00 GMT+0530`);
  return isNaN(d) ? null : d.toISOString();
}
export function cricketCheck(E, cw) {
  const fx = (E.fixtures || []).filter(f => f.entity === "india_cricket");
  return (cw?.india || []).map(r => {
    const when = wicTime(r, E.date.slice(0, 4));
    const f = when && fx.find(x => Math.abs(Date.parse(x.when_utc) - Date.parse(when)) <= 3 * H);
    return { match: `${r.teams} · ${r.format}`, when_utc: when, tv: r.tv, ott: r.ott, paper_fixture: f?.label || null, paper_where: f ? f.where ?? null : null };
  });
}

// ---------------------------------------------------------------- run
async function main() {
  ensureProxy();
  const args = process.argv.slice(2);
  const C = readJSON("config/house.json");
  const today = new Date(Date.now() + 5.5 * H).toISOString().slice(0, 10);
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || today;
  const force = args.includes("--force"), REMOTE = useRemote(args);
  if (!force && (date < C.trial.from || date > C.trial.until)) { console.log(`trial: ${date} is outside ${C.trial.from} to ${C.trial.until}; nothing to do`); return; }
  const file = `content/editions/${date}.json`;
  if (!existsSync(new URL(file, `file://${root}`))) { console.log(`trial: no edition for ${date}`); return; }
  const E = readJSON(file);
  const prev = readdirSync(new URL("content/editions/", `file://${root}`)).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${date}.json`).sort().pop();
  const P = prev ? readJSON(`content/editions/${prev}`) : null;
  const cut = (d, t) => new Date(`${d}T${t || "14:00"}:00+05:30`).toISOString();
  const window = { from: P ? cut(P.date, P.cut_ist) : new Date(Date.parse(cut(date, E.cut_ist)) - 24 * H).toISOString(), to: cut(date, E.cut_ist) };

  const T = REMOTE ? null : (await import("../lib/trial.js")).TRIAL;
  const get = async (key, qs = "") => {
    const t0 = Date.now();
    try {
      const r = REMOTE ? await remoteLive(key, qs ? `?${qs}` : "") : await T[key](new URLSearchParams(qs));
      return { ...r, ms: Date.now() - t0 };
    } catch (e) { return { ok: false, error: String(e.message || e), ms: Date.now() - t0 }; }
  };
  const snapM = E.snapshot?.movers?.value;
  const q = o => new URLSearchParams(o).toString();
  const keys = {
    wire: q({ from: window.from, to: window.to }),
    tennis_players: "",
    screen: q({ titles: (E.screen || []).map(s => s.title).join("|") }),
    nse: q({ date: snapM?.days?.[0] || date, symbols: (snapM?.stocks || []).map(s => s.symbol).join(",") }),
    alerts: "", cricket_where: "", intl_football: "", calendar: "",
  };
  console.error(`trial: ${date}, window ${window.from} to ${window.to}, ${REMOTE ? SITE_URL : "local getters"}`);
  const R = Object.fromEntries(await Promise.all(Object.entries(keys).map(async ([k, qs]) => [k, await get(k, qs)])));
  const v = k => (R[k]?.ok ? R[k].value : null);

  const card = { date, window, generated_at: new Date().toISOString(), sources: Object.fromEntries(Object.entries(R).map(([k, r]) => [k, { ok: !!r.ok, ms: r.ms, ...(r.ok ? {} : { error: r.error }) }])) };
  const wire = v("wire");
  const safe = (name, fn) => { try { card[name] = fn(); } catch (e) { card[name] = { error: String(e.message || e) }; } };
  if (wire) {
    safe("coverage", () => coverage(E, wire));
    safe("missed", () => missedCandidates(E, wire, C.sources.national_outlets));
    card.feeds = { total: wire.feeds.length, failed: wire.feeds.filter(f => !f.ok).map(f => `${f.id}: ${f.error}`), empty: wire.feeds.filter(f => f.ok && !f.kept).map(f => f.id), items: wire.items.length, stories: wire.stories.length };
  }
  safe("sources_quality", () => sourceQuality(E, C.sources.tiers));
  safe("talk", () => talk(E, C.sources.tiers));
  safe("tennis", () => tennisCheck(E, v("tennis_players")));
  safe("screen", () => screenCheck(E, v("screen")));
  safe("movers", () => moversCheck(E, v("nse")));
  safe("cricket_where", () => cricketCheck(E, v("cricket_where")));
  card.alerts = v("alerts")?.near ?? null;
  card.internationals = v("intl_football") ? { matches: v("intl_football").matches.length, upcoming: v("intl_football").matches.filter(m => m.state === "pre").slice(0, 12) } : null;
  card.calendar = v("calendar");
  const cov = card.coverage, miss = card.missed;
  card.summary = {
    coverage_pct: cov?.printed ? Math.round(100 * cov.found / cov.printed) : null,
    india_missed: miss?.india?.not_covered?.length ?? null,
    world_missed: miss?.world?.not_covered?.length ?? null,
    tier3_only: card.sources_quality?.tier3_only?.length ?? null,
    tennis_disagreements: Array.isArray(card.tennis) ? card.tennis.filter(t => !t.verdict.startsWith("agree")).length : null,
    sources_failed: Object.values(card.sources).filter(s => !s.ok).length,
  };

  const dir = new URL("ledger/trial/", `file://${root}`);
  mkdirSync(new URL("wire/", dir), { recursive: true });
  writeFileSync(new URL(`${date}.json`, dir), JSON.stringify(card, null, 1) + "\n");
  // The day's reading list, compact (Google's own links are long redirects and are never cited, so they are dropped).
  if (wire) writeFileSync(new URL(`wire/${date}.json`, dir), JSON.stringify({ window: wire.window, feeds: wire.feeds,
    stories: wire.stories.map(s => ({ title: s.title, n: s.n, outlets: s.outlets, signals: s.signals })),
    items: wire.items.map(i => ({ t: i.title, o: i.outlet, f: i.feed, d: i.date, ...(i.kind === "signal" || i.kind === "search" ? {} : { u: i.url }) })) }) + "\n");
  const idxUrl = new URL("index.json", dir);
  const idx = existsSync(idxUrl) ? JSON.parse(readFileSync(idxUrl, "utf8")) : { days: [] };
  idx.days = [...idx.days.filter(d => d.date !== date), { date, ...card.summary }].sort((a, b) => a.date.localeCompare(b.date));
  idx.from = C.trial.from; idx.until = C.trial.until;
  writeFileSync(idxUrl, JSON.stringify(idx, null, 1) + "\n");
  console.log(`trial: ${date} scored. ${JSON.stringify(card.summary)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
