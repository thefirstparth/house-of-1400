// Trial sources (Parth, 28 Sep 2026; docs/SOURCES-AUDIT.md). Run-only live keys: the page never requests them,
// the edition snapshot never stores them and `npm test` skips them. scripts/trial.mjs calls them after the day's
// edition is live and scores what they found against what the paper printed. Nothing here reaches the paper.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config, getJSON, getText, parseNifty500 } from "./live.js";

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });
const guard = async (fn) => { try { return await fn(); } catch (e) { return fail(e); } };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const H = 36e5;

// ---------------------------------------------------------------- RSS
export const decode = s => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
const strip = s => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? m[1] : null; };
const attrOf = (x, t, a) => { const m = x.match(new RegExp(`<${t}\\b[^>]*\\b${a}="([^"]*)"`, "i")); return m ? decode(m[1]) : null; };
export const hostOf = u => { try { return new URL(u).hostname.replace(/^(www|m|amp|feeds|rss)\./, ""); } catch { return null; } };

// Most feeds use RFC 822 or ISO dates; SEBI writes "24 Sep, 2026 +0530" (no time).
export const parseDate = s => { const d = Date.parse(s); return !isNaN(d) ? d : Date.parse(s.replace(/,/g, "").replace(/(\d{4})\s+([+-]\d{4})$/, "$1 00:00:00 GMT$2")); };

// Google News item: "Headline - Publisher"; the real outlet in <source url>; the description lists up to five
// outlets that ran the same story (title and publisher). That list groups the day's stories without guessing.
export function parseFeed(xml, feed) {
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  return blocks.map((b, position) => {
    const google = feed.kind === "signal" || feed.kind === "search";
    let title = strip(tagOf(b, "title"));
    const link = decode(tagOf(b, "link") || "") || attrOf(b, "link", "href") || "";
    const date = parseDate(decode(tagOf(b, "pubDate") || tagOf(b, "published") || tagOf(b, "updated") || tagOf(b, "dc:date") || ""));
    let outlet = feed.name, related = [];
    if (google) {
      outlet = strip(tagOf(b, "source")) || title.split(" - ").pop();
      const d = decode(tagOf(b, "description") || "");
      related = [...d.matchAll(/<a [^>]*>([\s\S]*?)<\/a>(?:\s|&nbsp;| )*<font[^>]*>([\s\S]*?)<\/font>/g)].map(m => ({ title: strip(m[1]), outlet: strip(m[2]) }));
      if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    }
    const snippet = google ? "" : strip(tagOf(b, "description") || tagOf(b, "summary") || "").slice(0, 280);
    return { title, url: link, outlet, feed: feed.id, section: feed.section, kind: feed.kind, date: isNaN(date) ? null : new Date(date).toISOString(), position, ...(related.length ? { related } : {}), ...(snippet ? { snippet } : {}) };
  }).filter(i => i.title);
}

const STOP = new Set("a an the of in on at to for and or but with from by as is are was were be after before over under into than this that his her their its it he she they we you i will has have had not no new says said amid vs v".split(" "));
export const tokens = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const normTitle = s => tokens(s).join(" ");
const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

// Group the day: each Google signal item is a story with its outlets; an outlet's own item joins the story whose
// related list carries the same headline, or (rarely) a near-identical headline. Headline overlap alone is not
// used to group two outlets (kylo-news measured it: it either misses or wrongly merges).
export function cluster(items) {
  const stories = [], byTitle = new Map();
  for (const it of items.filter(i => i.kind === "signal")) {
    const outlets = [...new Set([it.outlet, ...(it.related || []).map(r => r.outlet)].filter(Boolean))];
    const s = { title: it.title, url: it.url || null, outlets, signals: [`${it.feed}#${it.position + 1}`], date: it.date, members: [] };
    const keys = [it.title, ...(it.related || []).map(r => r.title)].map(normTitle);
    const hit = keys.map(k => byTitle.get(k)).find(Boolean);
    if (hit) { hit.outlets = [...new Set([...hit.outlets, ...outlets])]; hit.signals.push(...s.signals); keys.forEach(k => byTitle.set(k, hit)); continue; }
    stories.push(s); keys.forEach(k => byTitle.set(k, s));
  }
  // Second pass (1 Oct, after the Ronaldo miss: BBC, the Guardian, Al Jazeera, Sportstar and NDTV all ran it in
  // different words, so it never reached a candidate). An outlet's item joins the story whose headlines share at
  // least three words with it, two of them rare in the day's headlines (in eight or fewer), carrying 55% or more of
  // the shorter headline's weight (words weighted by rarity); an item that matches no story starts its own, so a story
  // only outlets' own feeds carry still counts. Measured on the 1 Oct window: Ronaldo grew from 4 outlets to 8.
  const df = new Map(), all = items.length || 1;
  for (const it of items) for (const t of new Set(tokens(it.title))) df.set(t, (df.get(t) || 0) + 1);
  const idf = t => Math.log(all / (df.get(t) || 1)), rare = t => (df.get(t) || 0) <= 8;
  const head = toks => { const S = new Set(toks); return { S, w: [...S].reduce((x, t) => x + idf(t), 0) }; };
  const near = (a, b) => { let n = 0, r = 0, w = 0; for (const t of b.S) if (a.S.has(t)) { n++; if (rare(t)) r++; w += idf(t); }
    return n < 3 || r < 2 ? 0 : w / (Math.min(a.w, b.w) || 1); };
  // headlines per story, and an index from each rare word to the stories that use it, so only stories sharing a
  // rare word are compared (the day has well over a thousand)
  const heads = new Map(), index = new Map();
  const addHead = (x, h) => { (heads.get(x) || heads.set(x, []).get(x)).push(h); for (const t of h.S) if (rare(t)) (index.get(t) || index.set(t, new Set()).get(t)).add(x); };
  for (const x of stories) addHead(x, head(tokens(x.title)));
  const bestFor = (h, not) => { let best = 0, to = null; const seen = new Set();
    for (const t of h.S) for (const y of index.get(t) || []) { if (y === not || seen.has(y)) continue; seen.add(y);
      for (const g of heads.get(y)) { const v = near(g, h); if (v > best) { best = v; to = y; } } }
    return best >= 0.55 ? to : null; };
  const join = (to, title, outlet, url, sig, h) => { to.members.push({ title, outlet, url }); addHead(to, h);
    if (!to.outlets.includes(outlet)) to.outlets.push(outlet); if (sig && !to.signals.some(x => x.split("#")[0] === sig.split("#")[0])) to.signals.push(sig); };
  const own = [], sigs = stories.map(x => ({ s: x, t: tokens(x.title) }));
  for (const it of items.filter(i => i.kind !== "signal")) {
    const k = normTitle(it.title), t = tokens(it.title), h = head(t), sig = `${it.feed}#${it.position + 1}`;
    let s = byTitle.get(k);
    if (!s && t.length >= 5) s = sigs.find(x => jac(x.t, t) >= 0.7)?.s;
    if (!s) s = bestFor(h, null);
    if (!s) { s = { title: it.title, url: it.url || null, outlets: [it.outlet], signals: [sig], date: it.date, members: [] }; stories.push(s); addHead(s, h); byTitle.set(k, s); own.push(s); continue; }
    join(s, it.title, it.outlet, it.url, sig, h);
  }
  // Order must not decide: a story an outlet started on its own joins a bigger story it now matches (that story's
  // headlines may have grown since), so "Cristiano Ronaldo leaves Portugal camp" read before "Why did Cristiano
  // Ronaldo leave..." still finds its group.
  for (const x of own) {
    if (x.members.length) continue;
    const h = heads.get(x)[0], to = bestFor(h, x);
    if (!to) continue;
    join(to, x.title, x.outlets[0], x.url, x.signals[0], h);
    for (const t of h.S) index.get(t)?.delete(x); heads.delete(x); stories.splice(stories.indexOf(x), 1);
  }
  return stories.map(s => ({ ...s, n: s.outlets.length })).sort((a, b) => b.n - a.n || a.signals.length - b.signals.length);
}

// Leads (Parth, 1 Oct: no NYT subscription, "understand from that and find that story from another outlet"). For each
// lead, Google News is searched for its most telling words over the last week; results from the paywalled outlets
// and from social networks or aggregators (config sources.paywalled, sources.not_outlets) are dropped, and a result
// counts only if it shares half the lead's words (at least three). National outlets first. The newest five per lead feed, 30 at most, four searches at a time.
const LEAD_PER_FEED = 5, LEAD_MAX = 30;
export function leadQuery(title) {
  const t = tokens(String(title).replace(/\b([A-Z])\.(?:([A-Z])\.)(?:([A-Z])\.)?(?:([A-Z])\.)?/g, m => m.replace(/\./g, "")));
  return { t, key: [...t].sort((a, b) => b.length - a.length).slice(0, 4) };
}
// The person or thing a lead is about, from its summary: the first run of two or more capitalised words (or a name
// with a number, "Gemini 4 Argon") that does not start a sentence. Headlines are in title case, so they are not used.
export function leadName(summary) {
  for (const sentence of String(summary || "").split(/(?<=[.!?])\s+/)) {
    const words = sentence.split(/\s+/).slice(1).join(" ");
    const m = /\b([A-Z][\p{L}'’-]+(?:\s+(?:[A-Z][\p{L}'’-]*|\d+\p{L}*)){1,3})/u.exec(words);
    if (m && !/^(Here|What|The|This|That|These|Those|It|In|On|At|For|But|And)\b/.test(m[1])) return m[1].replace(/[’']s$/, "");
  }
  return null;
}
export function pickElsewhere(lead, hits, S) {
  const { t } = leadQuery(lead.title), name = leadName(lead.summary ?? lead.snippet);
  const full = name ? tokens(name).join(" ") : null;
  const lower = x => String(x || "").toLowerCase().replace(/^www\./, "");
  const pay = (S.paywalled?.outlets || []).map(lower), bad = (S.not_outlets?.names || []).map(lower), nat = (S.national_outlets || []).map(lower);
  // Half the lead's words (at least three), compared by stem so "investigates" meets "investigating".
  const stem = w => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w), T = [...new Set(t.map(stem))], need = Math.max(3, Math.ceil(T.length / 2));
  return hits.filter(h => {
    const o = lower(h.outlet);
    const hosts = (S.paywalled?.hosts || []).map(lower);
    if (!o || pay.includes(o) || bad.includes(o) || [...bad, ...hosts].some(b => o === b || o.endsWith("." + b))) return false;
    const ht = new Set(tokens(h.title).map(stem)), shared = T.filter(x => ht.has(x)).length;
    // A lead that names someone or something needs the whole name in the other outlet's headline, and two more of the
    // lead's headline words: a famous name alone ("Carlos Alcaraz", "Europa League") would match any story about it.
    if (full) { const own = new Set(tokens(name).map(stem)); return ` ${tokens(h.title).join(" ")} `.includes(` ${full} `) && T.filter(x => !own.has(x) && ht.has(x)).length >= 2; }
    return shared >= need;
  }).sort((a, b) => nat.includes(lower(b.outlet)) - nat.includes(lower(a.outlet))).slice(0, 3).map(h => ({ title: h.title, outlet: h.outlet, url: h.url }));
}
// The live function has 30 seconds: searching stops at the deadline and the rest come back unsearched (elsewhere: null).
async function openElsewhere(leads, S, deadline = Infinity) {
  // The newest five from each lead feed, so a busy one (The Athletic's football) cannot crowd out the rest.
  const byFeed = new Map();
  for (const l of [...leads].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) { const k = byFeed.get(l.feed) || []; if (k.length < LEAD_PER_FEED) k.push(l); byFeed.set(l.feed, k); }
  const list = [...byFeed.values()].flat().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, LEAD_MAX);
  const out = [];
  for (let i = 0; i < list.length; i += 4) {
    const late = Date.now() > deadline;
    out.push(...await Promise.all(list.slice(i, i + 4).map(async l => {
      let elsewhere = late ? null : [];
      if (!late) try {
        const name = leadName(l.snippet), key = leadQuery(l.title).key;
        const q = encodeURIComponent(`${name ? `"${name}" ${key.slice(0, 2).join(" ")}` : key.join(" ")} when:7d`);
        elsewhere = pickElsewhere(l, parseFeed(await feedText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`), { id: "elsewhere", kind: "search", name: "Google News" }), S);
      } catch {}
      return { title: l.title, lead_from: l.outlet, feed: l.feed, section: l.section, date: l.date, summary: l.snippet || null, elsewhere };
    })));
  }
  return out;
}

// Some hosts refuse one identity and accept another (LiveFromALounge: 403 to "Mozilla/5.0", 200 to a named bot).
async function feedText(url) {
  let last;
  for (const ua of [/google\.com/.test(url) ? UA : "Mozilla/5.0", "house-of-1400/1.0 (+private newspaper)", UA]) {
    try { return await getText(url, { timeout: 9000, headers: { "user-agent": ua, accept: "application/rss+xml, application/xml, text/xml, */*" } }); }
    catch (e) { last = e; if (!/^(403|429) /.test(e.message)) break; }
  }
  throw last;
}

// GET /api/live/wire?from=ISO&to=ISO (defaults: the last 24 hours). Every feed in config.sources.feeds, read at
// once; items inside the window; failures listed per feed so a feed that goes quiet shows up.
export async function wire(qs = new URLSearchParams()) {
  const t0 = Date.now();
  return guard(async () => {
    const S = config().sources;
    const to = Date.parse(qs.get("to") || "") || Date.now(), from = Date.parse(qs.get("from") || "") || to - 24 * H;
    const only = qs.get("sections") ? new Set(qs.get("sections").split(",")) : null;
    const feeds = S.feeds.filter(f => !only || only.has(f.section));
    const results = await Promise.all(feeds.map(async f => {
      const t0 = Date.now();
      try {
        const xml = await feedText(f.url);
        const all = parseFeed(xml, f);
        const lo = f.max_age_h ? Math.min(from, to - f.max_age_h * H) : from;
        const kept = all.filter(i => i.date ? Date.parse(i.date) >= lo && Date.parse(i.date) <= to + 15 * 60e3 : f.undated).slice(0, f.max || 50);
        return { f, items: kept, stat: { id: f.id, section: f.section, ok: true, read: all.length, kept: kept.length, undated: all.filter(i => !i.date).length, ms: Date.now() - t0 } };
      } catch (e) {
        return { f, items: [], stat: { id: f.id, section: f.section, ok: false, error: String(e.message || e).slice(0, 120), ms: Date.now() - t0 } };
      }
    }));
    const all = results.flatMap(r => r.items);
    const failed = results.filter(r => !r.stat.ok).length;
    if (failed > feeds.length / 2) throw new Error(`wire: ${failed} of ${feeds.length} feeds failed`);
    // Paywalled feeds (kind "lead") tip the paper off but are never its source: they stay out of the day's items and
    // come back as leads, each with the open outlets carrying the same story.
    const items = all.filter(i => i.kind !== "lead");
    const leads = await openElsewhere(all.filter(i => i.kind === "lead"), S, t0 + 20e3);
    return ok({ window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() }, feeds: results.map(r => r.stat), items, stories: cluster(items), leads }, "Wire");
  });
}

// ---------------------------------------------------------------- tennis: each followed player's next and last match
export function tennisPlayers(scoreboard, names) {
  const matches = (scoreboard.events || []).flatMap(e => (e.groupings || []).flatMap(g => (g.competitions || []).map(c => ({
    event: e.name, draw: g.grouping?.displayName || null, date: c.date || c.startDate, state: c.status?.type?.state, detail: c.status?.type?.detail || null,
    status_name: c.status?.type?.name || null, round: c.round?.displayName || null, court: c.venue?.court || null, note: c.notes?.[0]?.text || null,
    players: (c.competitors || []).map(x => ({ name: x.athlete?.displayName, winner: !!x.winner, sets: (x.linescores || []).map(l => l.value) })),
  }))));
  // Why a match has not started (Parth, 1 Oct): the match on the same court still in play (with its score so far) and
  // how many more are due before it there; or ESPN's own word when it is postponed, suspended or delayed.
  const courtNow = m => {
    if (!m.court) return {};
    const same = matches.filter(x => x !== m && x.event === m.event && x.court === m.court);
    const on = same.find(x => x.state === "in");
    const ahead = same.filter(x => x.state === "pre" && Date.parse(x.date) <= Date.parse(m.date)).length;
    const score = on && on.players.length === 2 ? on.players[0].sets.map((v, i) => `${v}–${on.players[1].sets[i] ?? ""}`).join(", ") : null;
    return { court_now: on ? { players: on.players.map(p => p.name), score } : null, ahead_on_court: ahead };
  };
  const hold = m => /POSTPON|SUSPEND|DELAY|RAIN|CANCEL/i.test(`${m.status_name || ""} ${m.detail || ""}`) ? m.detail || m.status_name : null;
  return names.map(name => {
    const mine = matches.filter(m => m.players.some(p => p.name === name) && /singles/i.test(m.draw || "singles"));
    const opp = m => m.players.find(p => p.name !== name)?.name || null;
    const next = mine.filter(m => m.state === "pre" || m.state === "in").sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
    const last = mine.filter(m => m.state === "post").sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    return {
      name,
      next: next ? { event: next.event, round: next.round, when_utc: next.date, opponent: opp(next), live: next.state === "in", court: next.court, held: hold(next), ...(next.state === "pre" ? courtNow(next) : {}) } : null,
      last: last ? { event: last.event, round: last.round, when_utc: last.date, opponent: opp(last), won: !!last.players.find(p => p.name === name)?.winner, note: last.note } : null,
    };
  });
}

// A second, independent source for the same players: Tennis Explorer's player pages (free, no key), whose
// "upcoming matches" table gives tournament, round, start and opponent. Its times are Central European (Prague).
// The player page is found by searching the name, so nothing about a player is written in advance.
const TE = "https://www.tennisexplorer.com", TE_UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const pragueToUtc = (y, mo, d, h, mi) => {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const P = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const local = Date.UTC(+P.year, +P.month - 1, +P.day, +P.hour, +P.minute);
  return new Date(guess - (local - guess)).toISOString();
};
export function parseTennisExplorer(html, name, now = Date.now()) {
  const last = name.split(" ").pop().toLowerCase();
  const i = html.search(/<table class="result gamedetail"/);
  if (i < 0) return null;
  const table = html.slice(i, html.indexOf("</table>", i));
  for (const row of table.match(/<tr class="(?:one|two)">[\s\S]*?<\/tr>/g) || []) {
    const ev = row.match(/<a href="\/[^"]+\/(?:\d{4})\/atp-men\/">([^<]+)<\/a>/)?.[1];
    const round = row.match(/<td title="([^"]+)"/)?.[1] || null;
    const t = row.match(/class="time noWrp">(\d{2})\.(\d{2})\.\s*(\d{2}):(\d{2})</);
    const match = row.match(/title="Click for match detail">([^<]+)<\/a>/)?.[1];
    if (!ev || !t || !match) continue;
    const [a, b] = match.split(" - ").map(x => x.trim());
    const opp = a.toLowerCase().startsWith(last) ? b : a;
    const y0 = new Date(now).getUTCFullYear(), mo = +t[2], y = mo < new Date(now).getUTCMonth() - 5 ? y0 + 1 : y0;
    return { event: ev.replace(/&amp;/g, "&"), round, when_utc: pragueToUtc(y, mo, +t[1], +t[3], +t[4]), opponent: opp, source: "Tennis Explorer" };
  }
  return null;
}
async function tennisExplorer(name) {
  const [first, ...rest] = name.split(" "), last = rest.join(" ");
  const list = await getText(`${TE}/list-players/?search-text-pl=${encodeURIComponent(last)}`, { timeout: 8000, headers: TE_UA });
  const slug = [...list.matchAll(/href="(\/player\/[^"]+\/)"[^>]*>([^<]+)</g)].find(m => m[2].trim().toLowerCase() === `${last}, ${first}`.toLowerCase())?.[1];
  if (!slug) throw new Error(`Tennis Explorer: ${name} not found`);
  return parseTennisExplorer(await getText(`${TE}${slug}`, { timeout: 8000, headers: TE_UA }), name);
}

// Each followed player's next match from two independent sources, ESPN's scoreboard and Tennis Explorer. Either may
// fail; the answer says which sources answered and whether they agree (same opponent, start within 30 minutes).
export async function tennis_players() {
  return guard(async () => {
    const names = config().follows.tennis_players;
    const settle = p => p.then(v => ({ v }), e => ({ e: String(e.message || e) }));
    const [espn, ...backs] = await Promise.all([settle(getJSON("https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", { timeout: 10000 })), ...names.map(n => settle(tennisExplorer(n)))]);
    if (espn.e && backs.every(b => b.e)) throw new Error(`ESPN: ${espn.e} | Tennis Explorer: ${backs[0].e}`);
    const fromEspn = espn.v ? tennisPlayers(espn.v, names) : names.map(name => ({ name, next: null, last: null }));
    const same = (a, b) => a && b && String(a.opponent || "").split(" ").pop().toLowerCase() === String(b.opponent || "").replace(/\s+\S+\.?$/, "").split(" ").pop().toLowerCase() && Math.abs(Date.parse(a.when_utc) - Date.parse(b.when_utc)) <= 30 * 6e4;
    const players = fromEspn.map((p, i) => {
      const backup = backs[i].v || null;
      const agree = p.next && backup ? same(p.next, backup) : null;
      return { ...p, backup, backup_error: backs[i].e || null, agree };
    });
    return ok({ players, espn_error: espn.e || null }, espn.e ? "Tennis Explorer" : backs.some(b => b.v) ? "ESPN, Tennis Explorer" : "ESPN");
  });
}

// ---------------------------------------------------------------- Screen & Stage: OMDb, TMDB, JustWatch, Sacnilk
// Keyed calls never put the URL (and so the key) into an error message.
async function keyed(url, label) {
  let r;
  try { r = await fetch(url, { headers: { accept: "application/json", "user-agent": "house-of-1400/1.0" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new Error(`${label}: network error`); }
  if (!r.ok) {
    // OMDb and TMDB explain a refusal in the body ("Invalid API key!", "Request limit reached!"); it never holds the key.
    let why = ""; try { const j = await r.json(); why = String(j.Error || j.status_message || "").slice(0, 80); } catch {}
    throw new Error(`${label}: HTTP ${r.status}${why ? ` (${why})` : ""}`);
  }
  return r.json();
}

async function omdb(title, year) {
  const key = process.env.OMDB_KEY;
  if (!key) return { error: "OMDB_KEY not set" };
  const j = await keyed(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}`, "OMDb");
  if (j.Response === "False") return { error: `OMDb: ${j.Error || "not found"}` };
  const rating = src => j.Ratings?.find(r => r.Source === src)?.Value || null;
  return { title: j.Title, year: j.Year, type: j.Type, imdb: j.imdbRating !== "N/A" ? j.imdbRating : null, imdb_votes: j.imdbVotes !== "N/A" ? j.imdbVotes : null,
    rotten_tomatoes: rating("Rotten Tomatoes"), metacritic: rating("Metacritic"), language: j.Language, released: j.Released !== "N/A" ? j.Released : null, imdb_id: j.imdbID };
}

async function tmdb(title) {
  const key = process.env.TMDB_KEY;
  if (!key) return { error: "TMDB_KEY not set" };
  const s = await keyed(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(title)}&region=IN`, "TMDB");
  const hit = (s.results || []).find(r => r.media_type === "movie" || r.media_type === "tv");
  if (!hit) return { error: "TMDB: not found" };
  const p = await keyed(`https://api.themoviedb.org/3/${hit.media_type}/${hit.id}/watch/providers?api_key=${encodeURIComponent(key)}`, "TMDB");
  const IN = p.results?.IN || {};
  return { id: hit.id, type: hit.media_type, title: hit.title || hit.name, date: hit.release_date || hit.first_air_date || null,
    in_stream: (IN.flatrate || []).map(x => x.provider_name), in_rent: (IN.rent || []).map(x => x.provider_name), in_link: IN.link || null };
}

// Coming soon and new on streaming: candidates for the run to check, never verdicts. Everything is found from TMDB's
// own data for India, with no list of shows or services: a service counts if TMDB lists it as streaming in India, and
// a series counts only when its next episode is episode 1 (a new show or a new season, however old the show), so a
// long-running show's weekly episode never qualifies. Hindi and English are asked for separately, because TMDB's
// popularity is worldwide and in one list Hindi titles sink below minor Hollywood ones. Windows: config screen.upcoming.
async function tmdbUpcoming() {
  const key = process.env.TMDB_KEY;
  if (!key) return { error: "TMDB_KEY not set" };
  const W = config().screen?.upcoming || {}, ahead = W.days_ahead ?? 35, back = W.days_back ?? 60, per = W.per_language ?? 6;
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const today = day(0), until = day(ahead), since = day(-back);
  const T = (path, qs = "") => keyed(`https://api.themoviedb.org/3/${path}?api_key=${encodeURIComponent(key)}${qs}`, "TMDB");
  const LANGS = ["hi", "en"], lang = l => (l === "hi" ? "Hindi" : "English");
  const streamIN = wp => (wp?.results?.IN?.flatrate || []).map(x => x.provider_name).filter(n => !/with ads$/i.test(n));
  // At most eight TMDB calls at once.
  const pool = async (list, fn) => { const out = []; for (let i = 0; i < list.length; i += 8) out.push(...await Promise.all(list.slice(i, i + 8).map(x => fn(x).catch(() => null)))); return out.filter(Boolean); };
  const films = (l, qs) => T("discover/movie", `&with_original_language=${l}&sort_by=popularity.desc&region=IN${qs}`).then(r => (r.results || []).slice(0, per).map((x, i) => ({ ...x, rank: i + 1 })));
  const inIndia = (rd, type) => (rd?.results || []).find(c => c.iso_3166_1 === "IN")?.release_dates?.filter(d => d.type === type).map(d => d.release_date.slice(0, 10)).sort()[0] || null;

  const [cinema, digital, recent, tv] = await Promise.all([
    Promise.all(LANGS.map(l => films(l, `&with_release_type=2|3&release_date.gte=${today}&release_date.lte=${until}`))).then(x => x.flat()),
    Promise.all(LANGS.map(l => films(l, `&with_release_type=4&release_date.gte=${today}&release_date.lte=${until}`))).then(x => x.flat()),
    Promise.all(LANGS.map(l => films(l, `&with_release_type=3&release_date.gte=${since}&release_date.lte=${today}`))).then(x => x.flat()),
    Promise.all(LANGS.map(l => T("discover/tv", `&with_original_language=${l}&sort_by=popularity.desc&watch_region=IN&with_watch_monetization_types=flatrate&air_date.gte=${today}&air_date.lte=${until}`)
      .then(r => (r.results || []).slice(0, per * 3).map((x, i) => ({ ...x, rank: i + 1 }))))).then(x => x.flat()),
  ]);
  const film = async (x, kind) => {
    const d = await T(`movie/${x.id}`, "&append_to_response=release_dates,watch/providers");
    // A film still to open in cinemas may already list its later streaming home: that is where it goes later, not now.
    const on = streamIN(d["watch/providers"]);
    return { type: "Film", kind, title: d.title, language: lang(d.original_language), popularity_rank: x.rank, tmdb_id: d.id, first_released: d.release_date || null,
      cinema_date: inIndia(d.release_dates, 3) || inIndia(d.release_dates, 2), streaming_date: inIndia(d.release_dates, 4),
      ...(kind === "cinema" ? { streams_later_on: on } : { streaming_on: on }) };
  };
  const [coming, onOtt, streaming] = await Promise.all([
    pool(cinema, x => film(x, "cinema")), pool(digital, x => film(x, "streaming premiere")), pool(recent, x => film(x, "now streaming")),
  ]);
  const series = (await pool(tv, async x => {
    const d = await T(`tv/${x.id}`, "&append_to_response=watch/providers");
    const nx = d.next_episode_to_air;
    if (!nx || nx.episode_number !== 1 || !nx.air_date || nx.air_date < today || nx.air_date > until) return null;
    // Day one in India: the show's own network is a service TMDB lists as streaming in India (a Netflix or Prime Video
    // original). A US broadcast show's new season airs there first and reaches India later, on a date to confirm.
    const on = streamIN(d["watch/providers"]), nets = (d.networks || []).map(n => n.name);
    const norm = n => n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const dayOne = nets.some(n => on.some(o => norm(o).includes(norm(n)) || norm(n).includes(norm(o))));
    return { type: "Series", kind: nx.season_number > 1 ? `season ${nx.season_number}` : "new show", title: d.name, language: lang(d.original_language), date: nx.air_date,
      india_day_one: dayOne, network: nets, streaming_on: on, popularity_rank: x.rank, first_aired: d.first_air_date || null, tmdb_id: d.id };
  })).filter(Boolean);
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
  return {
    window: { from: today, to: until, recent_from: since },
    films: [...coming.map(f => ({ ...f, date: f.cinema_date })), ...onOtt.map(f => ({ ...f, date: f.streaming_date }))].filter(f => f.date && f.date >= today).sort(byDate),
    series: series.sort((a, b) => b.india_day_one - a.india_day_one || byDate(a, b)),
    now_streaming: streaming.filter(f => f.streaming_on.length && (f.first_released || "") >= since).map(f => ({ ...f, date: f.cinema_date })),
  };
}

const JW_QUERY = `query StreamingCharts($country: Country!, $filter: StreamingChartsFilter, $first: Int!, $after: String) {
  streamingCharts(country: $country, filter: $filter, first: $first, after: $after) {
    edges { streamingChartInfo { rank } node { objectType content(country: $country, language: "en") { title originalReleaseYear } } } } }`;
async function justwatch(objectType) {
  const r = await fetch("https://apis.justwatch.com/graphql", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ query: JW_QUERY, variables: { country: "IN", first: 10, after: "", filter: { category: "WEEKLY_POPULARITY_SAME_CONTENT_TYPE", objectType, startDate: null } } }) });
  if (!r.ok) throw new Error(`JustWatch ${r.status}`);
  const j = await r.json();
  if (j.errors?.length) throw new Error(`JustWatch: ${j.errors[0].message}`);
  return (j.data?.streamingCharts?.edges || []).map(e => ({ rank: e.streamingChartInfo.rank, title: e.node.content.title, year: e.node.content.originalReleaseYear }));
}

export const sacnilkTitles = html => [...new Set([...html.matchAll(/sacnilk\.com\/news\/([A-Za-z0-9_]+?)_(\d{4})_Box_Office_Collection_Day_Wise/g)].map(m => `${m[1].replace(/_/g, " ")} (${m[2]})`))];

// GET /api/live/screen?titles=A|B|C  (titles: the edition's Screen & Stage list; at most 12)
export async function screen(qs = new URLSearchParams()) {
  return guard(async () => {
    const titles = (qs.get("titles") || "").split("|").map(s => s.trim()).filter(Boolean).slice(0, 12);
    const settle = p => p.then(v => v, e => ({ error: String(e.message || e) }));
    const [lookups, movies, shows, sac, upcoming] = await Promise.all([
      Promise.all(titles.map(async t => ({ title: t, omdb: await settle(omdb(t)), tmdb: await settle(tmdb(t)) }))),
      settle(justwatch("MOVIE")), settle(justwatch("SHOW")),
      settle(getText("https://www.sacnilk.com/entertainmenttopbar/Box_Office", { timeout: 8000 }).then(sacnilkTitles)),
      settle(tmdbUpcoming()),
    ]);
    return ok({ titles: lookups, chart: { movies, shows }, box_office: sac, upcoming, keys: { omdb: !!process.env.OMDB_KEY, tmdb: !!process.env.TMDB_KEY } }, "OMDb, TMDB, JustWatch, Sacnilk");
  });
}

// ---------------------------------------------------------------- NSE's official MCP server (bhavcopy)
async function nseSession(url) {
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "house-of-1400/1.0" };
  const r = await fetch(url, { method: "POST", headers: h, signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "house-of-1400", version: "1.0" } } }) });
  const sid = r.headers.get("mcp-session-id"); await r.text();
  if (!r.ok || !sid) throw new Error(`NSE MCP initialize ${r.status}`);
  await (await fetch(url, { method: "POST", headers: { ...h, "mcp-session-id": sid }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) })).text();
  let id = 1;
  return async (name, args) => {
    const x = await fetch(url, { method: "POST", headers: { ...h, "mcp-session-id": sid }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }) });
    const b = await x.text(), m = b.match(/^data:(.*)$/m), j = JSON.parse(m ? m[1] : b);
    if (j.error) throw new Error(`NSE MCP ${name}: ${j.error.message}`);
    const t = j.result?.content?.[0]?.text;
    if (j.result?.isError) throw new Error(`NSE MCP ${name}: ${String(t).slice(0, 120)}`);
    try { return JSON.parse(t); } catch { return t; }
  };
}

let N500SET;
const nifty500 = () => N500SET ||= new Set(parseNifty500(readFileSync(join(process.cwd(), "config", "nifty500.csv"), "utf8")).map(x => x.symbol));

// GET /api/live/nse?date=YYYY-MM-DD&symbols=A,B (symbols: the day's flagged movers, for corporate actions; at most 8)
export async function nse(qs = new URLSearchParams()) {
  return guard(async () => {
    const date = qs.get("date") || new Date(Date.now() + 5.5 * H).toISOString().slice(0, 10);
    const symbols = (qs.get("symbols") || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
    const call = await nseSession("https://mcp.nseindia.in/bhavcopy/cm/mcp");
    const [breadth, gain, loss] = await Promise.all([call("get_market_breadth", { date }), call("get_top_movers", { date, n: 50, direction: "gain" }), call("get_top_movers", { date, n: 50, direction: "loss" })]);
    const n5 = nifty500();
    const pick = r => (r.stocks || []).filter(s => n5.has(s.symbol)).map(s => ({ symbol: s.symbol, pct: s.pct_change, close: s.close }));
    const from = new Date(Date.parse(date) - 30 * 864e5).toISOString().slice(0, 10);
    const actions = {};
    await Promise.all(symbols.map(async s => { try { actions[s] = (await call("get_corporate_actions", { symbol: s, fromDate: from, toDate: date })).actions || []; } catch (e) { actions[s] = { error: String(e.message).slice(0, 100) }; } }));
    return ok({ requested: date, data_date: breadth.date || gain.date || null, breadth, gainers: pick(gain), losers: pick(loss), actions }, "NSE MCP (bhavcopy)");
  });
}

// ---------------------------------------------------------------- Sachet: NDMA and IMD alerts near the paper's cities
const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon); return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2)); };
export function nearAlerts(rows, cities, places, radius) {
  return cities.flatMap(c => rows.filter(a => {
    const names = places[c.name] || [c.name];
    if (names.some(n => new RegExp(`\\b${n}\\b`, "i").test(a.area_description || ""))) return true;
    const [lon, lat] = String(a.centroid || "").split(",").map(Number);
    return Number.isFinite(lat) && km(c, { lat, lon }) <= radius;
  }).map(a => ({ city: c.name, severity: a.severity, colour: a.severity_color || null, type: a.disaster_type, area: a.area_description, from: a.effective_start_time, until: a.effective_end_time, source: a.alert_source, message: a.actual_lang === "en" ? String(a.warning_message || "").slice(0, 300) : null, language: a.actual_lang })));
}

export async function alerts() {
  return guard(async () => {
    const C = config(), T = C.trial;
    const rows = await getJSON("https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails", { timeout: 12000 });
    if (!Array.isArray(rows)) throw new Error("sachet shape");
    return ok({ total: rows.length, near: nearAlerts(rows, [...C.weather.always, ...C.weather.family], T.alert_places, T.alert_radius_km) }, "Sachet (NDMA, IMD)");
  });
}

// ---------------------------------------------------------------- WhereIsCricket: India's matches and where to watch
export function parseWhereIsCricket(html) {
  return html.split('<article class="match-row"').slice(1).map(a => {
    const text = sel => { const m = a.match(new RegExp(`class="${sel}"[^>]*>([\\s\\S]*?)</(?:span|div|strong)>`)); return m ? strip(m[1]) : ""; };
    const fmt = text("fmt[^\"]*");
    const teams = strip((a.match(/class="match-teams">([\s\S]*?)<\/div>/) || [])[1] || "").replace(fmt, "").replace(/\s*LIVE\s*$/, "").trim();
    const where = tag => { const m = a.match(new RegExp(`where-tag ${tag}"[\\s\\S]*?<span class="where-val([^"]*)">([\\s\\S]*?)</span></span>`)); return !m ? null : /is-none/.test(m[1]) ? "not in India" : strip(m[2]).split(/[(.]/)[0].trim() || null; };
    return { date: text("match-date"), time: text("time-wide"), teams, format: fmt, sub: strip((a.match(/class="match-sub">([\s\S]*?)<\/div>/) || [])[1] || ""), tv: where("is-tv"), ott: where("is-ott") };
  });
}

export async function cricket_where() {
  return guard(async () => {
    const rows = parseWhereIsCricket(await getText("https://www.whereiscricket.com/", { timeout: 10000 }));
    if (!rows.length) throw new Error("whereiscricket: no rows");
    const india = rows.filter(r => /(^|\s)India(\s|$)/.test(r.teams) && !/India (A|Women|U19|Under|Legends|Masters)/i.test(r.teams));
    return ok({ india, total: rows.length }, "WhereIsCricket");
  });
}

// ---------------------------------------------------------------- ESPN: national-team football for the next week
export async function intl_football() {
  return guard(async () => {
    const leagues = config().trial.intl_football;
    const days = [...Array(8)].map((_, i) => new Date(Date.now() + (i - 1) * 864e5).toISOString().slice(0, 10).replace(/-/g, ""));
    const lists = await Promise.all(leagues.flatMap(l => days.map(d => getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/scoreboard?dates=${d}`, { timeout: 8000 }).then(j => (j.events || []).map(e => ({ league: l, e }))).catch(() => []))));
    const seen = new Set(), matches = [];
    for (const { league, e } of lists.flat()) {
      if (seen.has(e.id)) continue; seen.add(e.id);
      const c = e.competitions?.[0] || {};
      const side = h => c.competitors?.find(x => x.homeAway === h);
      matches.push({ league, when_utc: e.date, home: side("home")?.team?.displayName, away: side("away")?.team?.displayName, state: c.status?.type?.state,
        score: c.status?.type?.completed ? `${side("home")?.score}-${side("away")?.score}` : null });
    }
    return ok({ matches: matches.sort((a, b) => Date.parse(a.when_utc) - Date.parse(b.when_utc)) }, "ESPN");
  });
}

// ---------------------------------------------------------------- Calendars for the Week Ahead
export function parseFomc(html, year) {
  const i = html.indexOf(`${year} FOMC Meetings`); if (i < 0) return [];
  const block = html.slice(i, html.indexOf("FOMC Meetings", i + 20) > 0 ? html.indexOf("FOMC Meetings", i + 20) : i + 60000);
  return [...block.matchAll(/fomc-meeting__month[^>]*><strong>([A-Za-z/]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)].map(m => {
    const month = m[1].split("/").pop(), days = m[2].replace(/\*/g, "").trim(), last = days.split("-").pop().trim();
    const d = new Date(`${month} ${parseInt(last)}, ${year} 12:00 UTC`);
    return { what: "US Federal Reserve (FOMC) decision", date: isNaN(d) ? null : d.toISOString().slice(0, 10), days: `${m[1]} ${days}` };
  }).filter(x => x.date);
}
export function parseIcs(ics) {
  return ics.split("BEGIN:VEVENT").slice(1).map(v => ({ date: (v.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1], what: (v.match(/SUMMARY:(.*)/) || [])[1]?.trim() }))
    .filter(x => x.date && x.what).map(x => ({ what: x.what, date: `${x.date.slice(0, 4)}-${x.date.slice(4, 6)}-${x.date.slice(6)}` }));
}

export async function calendar() {
  return guard(async () => {
    const now = Date.now(), until = now + 30 * 864e5, inside = x => Date.parse(x.date) >= now - 864e5 && Date.parse(x.date) <= until;
    const y = new Date().getUTCFullYear();
    const [fomc, hol] = await Promise.all([
      getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", { timeout: 10000 }).then(h => [...parseFomc(h, y), ...parseFomc(h, y + 1)]).catch(e => ({ error: e.message })),
      getText("https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics", { timeout: 10000 }).then(parseIcs).catch(e => ({ error: e.message })),
    ]);
    return ok({ fomc: Array.isArray(fomc) ? fomc.filter(inside) : fomc, india_holidays: Array.isArray(hol) ? hol.filter(inside).sort((a, b) => a.date.localeCompare(b.date)) : hol }, "Federal Reserve, Google Calendar");
  });
}

export const TRIAL = { wire, tennis_players, screen, nse, alerts, cricket_where, intl_football, calendar };
export const TRIAL_CACHE = { wire: [600, 1800], tennis_players: [300, 900], screen: [21600, 43200], nse: [1800, 7200], alerts: [900, 3600], cricket_where: [3600, 21600], intl_football: [3600, 21600], calendar: [21600, 86400] };

// ---------------------------------------------------------------- matching a printed item to Wire headlines
export const NOISE = /\b(hints?|answers?|wordle|strands|connections|horoscope|live updates?|lottery|price today|rate today|weather today|result today|live score|how to watch|where to watch|box office|collection day|viral|trailer|teaser|bigg boss|in all its colou?rs|review:)/i;
export const normUrl = u => { try { const x = new URL(u); return (x.hostname.replace(/^(www|m|amp)\./, "") + x.pathname.replace(/\/amp\/?$|\/$/, "")).toLowerCase(); } catch { return null; } };

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

// ---------------------------------------------------------------- the wire check (in the paper from 30 Sep 2026)
// The stories the day's news widely agreed on, which the edition must answer: printed (a story, a brief or an "Also
// in" line) or skipped with a reason. India: on India's top or national pages and carried by 3 or more national
// outlets. World: on a top or world page and carried by 6 or more outlets. Any topic page (business, technology,
// science, sport): 6 or more outlets, with that page's section as the likely home. Nothing is named in advance: what
// qualifies is whatever the day's coverage says.
// Who Parth follows (config follows): a story about one of them counts from three outlets, not six (1 Oct, after
// the Ronaldo miss: Portugal is a followed team). People match on the surname too; national teams only on stories a
// sports feed carries, so "Spain" or "England" in the politics news does not count.
const SPORT = new Set(["madrid", "pitch", "paddock", "crease", "deuce", "sidelines"]);
export function followNames(cfg) {
  const F = cfg.follows || {}, people = [F.f1_driver?.name, ...(F.tennis_players || []), ...((F.cricket_team?.priority || []).filter(x => !/^(team|others)$/.test(x)))].filter(Boolean);
  return { always: [F.football_club?.name, F.nba_team?.name, ...people, ...people.map(p => p.split(" ").pop())].filter(Boolean).map(x => tokens(x).join(" ")),
    sport: (F.national_teams || []).map(x => tokens(x).join(" ")) };
}
// The desk check (from 2 Oct 2026, Parth, after the Ronaldo and Ocon misses, "don't we read the story?"): what every
// outlet in the reading list leads with, its top stories (config sources.top_check.per_feed), for the editor to read
// and answer by event, whatever the wording. No word matching decides anything here; the editor groups and judges.
// Ids are stable across runs (feed and headline), so the check can be run again after writing.
export function topStories(wire, cfg) {
  const T = cfg.sources?.top_check || {}, per = T.per_feed || 5, skip = (T.skip || []).map(x => new RegExp(x, "i"));
  // a feed may set its own top (Back Home's local searches read 3 deep, not 5)
  const own = Object.fromEntries((cfg.sources?.feeds || []).filter(f => f.top).map(f => [f.id, f.top]));
  const seen = new Set(), out = [];
  for (const i of wire.items || []) {
    if (i.kind === "lead" || i.position >= (own[i.feed] ?? per) || NOISE.test(i.title) || skip.some(r => r.test(i.title))) continue;
    const key = normTitle(i.title); if (!key || seen.has(key)) continue; seen.add(key);
    const id = `${i.feed}-${tokens(i.title).slice(0, 5).join("-")}`.slice(0, 60);
    out.push({ id, feed: i.feed, section: (cfg.sources?.feeds || []).find(f => f.id === i.feed)?.section || null, outlet: i.outlet, title: i.title, url: i.url || null });
  }
  return out;
}
export function wireCandidates(wire, cfg, max = 40) {
  const nat = new Set((cfg.sources?.national_outlets || []).map(x => x.toLowerCase()));
  const feedSection = Object.fromEntries((cfg.sources?.feeds || []).map(f => [f.id, f.section]));
  const FN = followNames(cfg), has = (txt, n) => ` ${tokens(txt).join(" ")} `.includes(` ${n} `);
  const out = [];
  for (const s of wire.stories || []) {
    if (NOISE.test(s.title)) continue;
    const feeds = s.signals.map(x => x.split("#")[0]);
    const natN = s.outlets.filter(o => nat.has(o.toLowerCase())).length;
    const heads = [s.title, ...(s.members || []).map(m => m.title)].join(" · "), sporty = feeds.some(f => SPORT.has(feedSection[f]));
    const follow = FN.always.find(n => has(heads, n)) || (sporty ? FN.sport.find(n => has(heads, n)) : null);
    let region = null;
    if (feeds.some(f => /^gn-in-(top|nation)$/.test(f)) && natN >= 3) region = "india";
    else if (feeds.some(f => /^gn-(us-top|in-world)$/.test(f)) && s.n >= 6) region = "world";
    else if (s.n >= 6) region = "topic";
    if (follow && s.n >= 3 && region !== "india") region = "follow";
    if (!region) continue;
    // the most specific desk wins: on a sports story a football feed's "pitch" beats a business feed or the general
    // sports feeds' "sidelines"
    const secs = feeds.map(f => feedSection[f]).filter(x => x && x !== "front");
    const section = (sporty && secs.find(x => SPORT.has(x) && x !== "sidelines")) || secs.find(x => x !== "sidelines") || secs[0] || (region === "india" ? "dateline" : region === "world" ? "dateline" : null);
    const id = tokens(s.title).slice(0, 7).join("-").slice(0, 70) || `wire-${out.length}`;
    out.push({ id, title: s.title, region, section_hint: section, n: s.n, national: natN, ...(follow ? { follows: follow } : {}), outlets: s.outlets.slice(0, 8),
      links: [s.url, ...s.members.map(m => m.url)].filter(Boolean).slice(0, 3) });
  }
  const seen = new Set();
  // A desk's own story (1 Oct, after the Ocon miss: formula1.com, Motorsport, The Race and SB Nation each ran Ocon
  // leaving Haas, every headline different, so it never grouped). Within each sports desk's own feeds, two words rare
  // in the day's headlines (in 2 to 8) that appear together in headlines from three or more of that desk's feeds mark
  // one story. Measured on 1 Oct: one hit across all six sports desks, and it was Ocon.
  const SPORT_DESKS = [...SPORT], items = (wire.items || []).filter(i => i.kind !== "signal"), df = new Map();
  for (const i of wire.items || []) for (const t of new Set(tokens(i.title))) df.set(t, (df.get(t) || 0) + 1);
  const rare = t => { const d = df.get(t) || 0; return d >= 2 && d <= 8 && t.length > 2 && !/^\d+$/.test(t); };
  for (const S of SPORT_DESKS) {
    const mine = items.filter(i => feedSection[i.feed] === S), pairs = new Map(), used = new Set();
    mine.forEach((x, k) => { const T = [...new Set(tokens(x.title).filter(rare))].sort();
      for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) { const key = `${T[a]} ${T[b]}`; (pairs.get(key) || pairs.set(key, []).get(key)).push(k); } });
    const feedsOf = ks => new Set(ks.map(k => mine[k].feed));
    for (const [key, ks] of [...pairs].sort((a, b) => feedsOf(b[1]).size - feedsOf(a[1]).size)) {
      const F = feedsOf(ks); if (F.size < 3) continue;
      if (ks.filter(k => used.has(k)).length * 2 >= ks.length) continue;
      ks.forEach(k => used.add(k));
      const its = ks.map(k => mine[k]);
      if (out.some(c => its.some(x => c.title === x.title))) continue;
      const id = tokens(its[0].title).slice(0, 7).join("-").slice(0, 70);
      out.push({ id, title: its[0].title, region: "desk", section_hint: S, n: new Set(its.map(x => x.outlet)).size, national: 0, words: key,
        outlets: [...new Set(its.map(x => x.outlet))].slice(0, 8), links: its.map(x => x.url).filter(Boolean).slice(0, 3), also: its.slice(1, 4).map(x => x.title) });
    }
  }
  // The widest-covered stories up to max, but every story about someone Parth follows, and each desk's three
  // widest, always make the list: tech and world feeds are many, so a sports story could fall off a plain top 40.
  const all = out.filter(c => (seen.has(c.id) ? false : seen.add(c.id))).sort((a, b) => b.n - a.n), per = {};
  return all.filter((c, i) => { const k = c.section_hint || "?"; per[k] = (per[k] || 0) + 1; return i < max || c.region === "follow" || c.region === "desk" || per[k] <= 3; });
}
