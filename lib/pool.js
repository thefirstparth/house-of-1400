// The day's pool (from the 13 Oct 2026 edition, Parth, 12 Oct: "code picks the shortlist, not the AI"; "every desk
// gets a minimum"; "the editor writes to fixed numbers"). Code reads the whole reading list (config sources.feeds,
// through /api/live/wire), groups the same story across outlets, ranks the groups, and keeps a fixed shortlist with a
// floor for every desk; then it reads each shortlisted story's own article (through /api/live/read), so the editor
// writes from the text in front of it instead of searching the web. The editor chooses and writes; it does not hunt.
// Pure functions here (buildPool, compactPool) plus the run-only live key `read`.
import { config, getText } from "./live.js";
import { tokens, NOISE, followNames, hostOf, decode } from "./trial.js";

const H = 36e5;

// ---------------------------------------------------------------- reading one article (GET /api/live/read?u=..&u=..)
// Each `u` is one story: up to three addresses separated by "|", tried in order until one gives real text. A Google
// News address is first turned into the publisher's own (Google's page carries a signature its own batchexecute call
// wants); a paywalled host is never read. The text is the page's article body (JSON-LD articleBody, else its <p>
// paragraphs), at most 2,400 characters, with the page's own description as a fallback.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const isGoogle = u => /(^|\.)news\.google\.com$/.test(hostOf(u) || "") || /(^|\.)google\.com$/.test(hostOf(u) || "");

export function parseBatchexecute(text) {
  for (const line of String(text).replace(/^\)\]\}'/, "").split("\n")) {
    if (!line.startsWith("[")) continue;
    try {
      for (const row of JSON.parse(line)) {
        if (!Array.isArray(row) || row[0] !== "wrb.fr" || row[1] !== "Fbv4je" || typeof row[2] !== "string") continue;
        const addr = JSON.parse(row[2])?.[1];
        if (typeof addr === "string" && /^https:\/\//.test(addr) && !isGoogle(addr)) return addr;
      }
    } catch {}
  }
  return null;
}
async function publisherOf(url) {
  if (!isGoogle(url)) return url;
  const id = (() => { try { return new URL(url).pathname.match(/^\/(?:rss\/)?articles\/([\w-]+)/)?.[1] || null; } catch { return null; } })();
  if (!id) return null;
  const page = await getText(`https://news.google.com/rss/articles/${id}`, { timeout: 6000, headers: { "user-agent": UA } });
  const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1], ts = Number(page.match(/data-n-a-ts="(\d+)"/)?.[1]);
  if (!sg || !ts) return null;
  const inner = JSON.stringify(["garturlreq", [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, ts, sg]);
  const r = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST", signal: AbortSignal.timeout(6000),
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": UA },
    body: "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]])),
  });
  return r.ok ? parseBatchexecute(await r.text()) : null;
}

// Not news, whatever feed it came from: price and rate listings, photo galleries, exam and job notices, forum threads
export const LISTING = /\b(price in|on[- ]road price|gold rate|silver rate|petrol price|diesel price|rate today|#?gallery|in photos|time ?table|admit card|dv schedule|cut ?off|answer key|daily thread|day of rest|significant others|open thread|horoscope)\b/i;
const JUNK = /\b(subscribe|sign up|newsletter|cookie|advertisement|all rights reserved|read more:|also read|follow us|download the app|click here|whatsapp channel|recommended stories|watch:|listen to)\b/i;
// a site's own banner that some pages put inside the article body (The Hindu's subscription menu)
const BOILER = [/^Subscribed with another email\?[\s\S]{0,1500}?new titles and features\.\s*/i];
const unboiler = t => BOILER.reduce((x, re) => x.replace(re, ""), t);
export function articleText(html) {
  const s = String(html || "");
  // JSON-LD articleBody, when the page carries it
  for (const m of s.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = o => (Array.isArray(o) ? o.map(walk).find(Boolean) : o && typeof o === "object" ? (typeof o.articleBody === "string" && o.articleBody.length > 300 ? o.articleBody : Object.values(o).map(walk).find(Boolean)) : null);
      const body = walk(JSON.parse(m[1].trim()));
      if (body) return unboiler(decode(body).replace(/\s+/g, " ").trim());
    } catch {}
  }
  const scope = s.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0] || s;
  const paras = [...scope.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)].map(m => decode(m[0].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(p => p.length >= 60 && !JUNK.test(p));
  return unboiler([...new Set(paras)].join(" "));
}
const metaOf = (html, prop) => decode(String(html).match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, "i"))?.[1] || "");

export async function read(qs = new URLSearchParams()) {
  const S = config().sources || {}, pay = new Set(S.paywalled?.hosts || []);
  const paywalled = u => { const h = hostOf(u) || ""; return [...pay].some(p => h === p || h.endsWith(`.${p}`)); };
  const asks = qs.getAll("u").slice(0, 10);
  const value = await Promise.all(asks.map(async ask => {
    const tried = [];
    for (const raw of ask.split("|").slice(0, 3)) {
      try {
        const url = await publisherOf(raw);
        if (!url || paywalled(url)) { tried.push(url ? `paywalled: ${hostOf(url)}` : "unresolved"); continue; }
        const html = await getText(url, { timeout: 7000, headers: { "user-agent": UA, accept: "text/html" } });
        let text = articleText(html);
        const desc = metaOf(html, "og:description") || metaOf(html, "description");
        if (text.length < 300 && desc.length > text.length) text = desc;
        if (text.length >= 200) return { ask, url, text: text.slice(0, 2400), chars: text.length };
        tried.push(`short: ${hostOf(url)}`);
      } catch (e) { tried.push(String(e.message || e).slice(0, 60)); }
    }
    return { ask, url: null, text: null, tried };
  }));
  return { ok: true, value, source: "Publishers", as_of: new Date().toISOString(), stale: false };
}

// ---------------------------------------------------------------- the shortlist
// Desk of a story: the desks of the feeds that carried it (config sources.feeds[].desk), by vote, then a few plain
// word rules where a general feed (Google's front page, a wire search) is the only carrier.
const AI_WORDS = /\b(ai|a\.i\.|artificial intelligence|openai|chatgpt|anthropic|claude|gemini|deepmind|llm|copilot|nvidia|grok|xai|mistral|perplexity|agentic|chatbot|model|gpt)\b/i;
const TECH_WORDS = /\b(apple|iphone|ipad|mac|android|google|samsung|pixel|oneplus|xiaomi|whatsapp|instagram|meta|microsoft|windows|amazon|tesla|spacex|isro|nasa|launch(?:ed|es)?|cyber|hack|breach|chip|semiconductor|app|startup|smartphone|laptop|update|game|gaming|gta|playstation|xbox|nintendo|robot\w*|5g|display|amoled|oled|processor|snapdragon|mediatek|dimensity|qualcomm|intel|amd|battery|\d+mah|camera|earbuds|headphones|speakers?|smartwatch|wearable|tablet|phones?|gadgets?|realme|vivo|oppo|poco|honor|motorola|nothing (?:phone|os)|cmf|dell|lenovo|asus|acer|sony|fitbit|touchscreen)\b/i;
const INDIA_WORDS = /\b(india|indian|delhi|mumbai|bengaluru|bangalore|kolkata|chennai|hyderabad|pune|modi|bjp|congress|lok sabha|rajya sabha|supreme court|high court|rbi|sebi|isro|bihar|kerala|karnataka|tamil nadu|maharashtra|gujarat|uttar pradesh|punjab|assam|odisha|jharkhand|rajasthan|kashmir|telangana|andhra|bengal)\b/i;
const AI_LABS = /\b(openai|anthropic|chatgpt|claude|gemini|deepmind|sam altman|dario amodei|demis hassabis|llm|ai model|xai|grok|mistral|perplexity|ai (?:startup|lab|company|chips?|agents?))\b/i;
const SCIENCE = /\b(astronom\w*|planet|fossil|galaxy|telescope|physics|scientists?|species|quantum|asteroid|mars|moon|orbit|clock|laser)\b/i;
const SCREEN_WORDS = /\b(film|movie|actor|actress|box office|series|trailer|ott|netflix|bollywood|hollywood|sequel|director)\b/i;
const OPINION = /\b(opinion|column|editorial|analysis|explained|explainer|what we know|podcast|newsletter|quiz|photos?:|in pictures|gallery)\b/i;

export function deskOf(story, feeds) {
  const votes = {};
  const text = [story.title, ...(story.members || []).map(m => m.title)].join(" · ");
  for (const sig of story.signals || []) {
    const f = feeds[sig.split("#")[0]]; if (!f) continue;
    const w = f.kind === "signal" ? 0.5 : f.kind === "search" ? 0.7 : 1;
    let d = f.desk || f.section;
    if (d === "front" || (f.kind === "signal" && ["desh", "videsh"].includes(d))) d = INDIA_WORDS.test(text) ? "desh" : "videsh";
    votes[d] = (votes[d] || 0) + w;
  }
  let desk = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || (INDIA_WORDS.test(text) ? "desh" : "videsh");
  // a story about the AI companies or their models is AI wherever it was carried; tech and AI need their own words
  if (AI_LABS.test(story.title) && ["tech", "ledger", "desh", "videsh", "sales"].includes(desk)) desk = "ai";
  if (desk === "tech" && AI_WORDS.test(story.title)) desk = "ai";
  if (desk === "ai" && !AI_WORDS.test(text)) desk = "tech";
  if ((desk === "tech" || desk === "ai") && !TECH_WORDS.test(text) && !AI_WORDS.test(text) && !SCIENCE.test(text)) desk = INDIA_WORDS.test(text) ? "desh" : "videsh";
  if (["desh", "videsh"].includes(desk) && SCREEN_WORDS.test(story.title)) desk = "screen";
  if ((desk === "videsh" || desk === "desh") && TECH_WORDS.test(story.title) && (votes.tech || votes.ai)) desk = AI_WORDS.test(story.title) ? "ai" : "tech";
  if (desk === "desh" && !INDIA_WORDS.test(text) && (votes.videsh || 0) >= (votes.desh || 0)) desk = "videsh";
  if (desk === "videsh" && INDIA_WORDS.test(story.title) && (votes.desh || 0) > 0) desk = "desh";
  return desk;
}

// Score: how widely it is carried, how high Google's front pages put it, whether it is about someone Parth follows,
// how fresh it is; minus noise (live blogs, puzzles, opinion, a single official notice).
export function scoreOf(story, feeds, P, follows, now) {
  const n = story.outlets?.length || 1, text = [story.title, ...(story.members || []).map(m => m.title)].join(" · ");
  let prom = 0;
  for (const sig of story.signals || []) {
    const [id, pos] = sig.split("#"), f = feeds[id], p = Number(pos) || 99;
    if (f?.kind !== "signal") continue;
    if (/-top$/.test(id)) prom += Math.max(0, (13 - p) / 12) * 2; else prom += Math.max(0, (16 - p) / 15);
  }
  const tok = ` ${tokens(text).join(" ")} `, has = x => tok.includes(` ${x} `);
  const follow = follows.always.some(has) ? 2.5 : 0;
  const interest = (P.interest || []).some(w => new RegExp(`\\b${w}\\b`, "i").test(text)) ? 0.75 : 0;
  const age = story.date ? Math.max(0, (now - Date.parse(story.date)) / H) : 12;
  const official = (story.signals || []).every(s => feeds[s.split("#")[0]]?.kind === "official");
  const noise = (NOISE.test(story.title) ? 6 : 0) + (OPINION.test(story.title) ? 1 : 0) + (official && n === 1 ? 0.5 : 0);
  return +(Math.log2(1 + n) * 2 + Math.min(4, prom) + follow + interest + 1.5 * Math.exp(-age / 24) - noise).toFixed(2);
}

const idOf = (title, used) => {
  let id = tokens(title).slice(0, 6).join("-").slice(0, 60) || "story";
  for (let i = 2; used.has(id); i++) id = `${id.replace(/-\d+$/, "")}-${i}`;
  used.add(id); return id;
};

// buildPool(wire value, config) -> { clusters: [...], headlines: [...], counts }. The pool's numbers live in config
// `pool`: how many clusters, the top N kept whatever their desk, each desk's minimum and maximum, how many headlines.
export function buildPool(wire, cfg, now = Date.now()) {
  const P = cfg.pool || {}, feeds = Object.fromEntries((cfg.sources?.feeds || []).map(f => [f.id, f]));
  const follows = followNames(cfg), byUrl = new Map((wire.items || []).map(i => [i.url, i]));
  const pay = new Set(cfg.sources?.paywalled?.hosts || []), paywalled = u => { const h = hostOf(u) || ""; return [...pay].some(p => h === p || h.endsWith(`.${p}`)); };
  const stories = (wire.stories || []).filter(s => s.title && !NOISE.test(s.title)).map(s => {
    const urls = [s.url, ...(s.members || []).map(m => m.url)].filter(Boolean);
    const open = urls.filter(u => !paywalled(u));
    // the outlet's own address first (it can be read directly), Google's last
    const read = [...open.filter(u => !isGoogle(u)), ...open.filter(isGoogle)].slice(0, 3);
    const snippet = urls.map(u => byUrl.get(u)?.snippet).find(Boolean) || null;
    return { title: s.title, outlets: s.outlets || [], n: (s.outlets || []).length, date: s.date, signals: s.signals || [], members: (s.members || []).slice(0, 6), read, snippet,
      desk: deskOf(s, feeds), score: scoreOf(s, feeds, P, follows, now) };
  }).filter(s => s.read.length).sort((a, b) => b.score - a.score || b.n - a.n);
  const max = P.clusters || 40, top = P.top || 12, mins = P.desk_min || {}, maxes = P.desk_max || {}, cap = d => maxes[d] ?? P.desk_max_default ?? 8;
  // Sources with places of their own (config pool.quotas; Parth, 13 Oct): Ranchi and Prayagraj each, and Managing
  // Madrid. Their stories are mostly one outlet's, so ranking by how widely a story is carried never let them in (13
  // Oct: no Prayagraj story and no Managing Madrid piece in the pool). A story counts for a source when that feed
  // carries it and it sits on the source's own desk (a Ranchi T20 report is sport, not Ranchi news); listings,
  // galleries and open threads never fill a place. Each place is one the run must answer: print it or say why not.
  const Q = (P.quotas || []).map(q => ({ ...q, n: 0 })), qOf = s => Q.filter(q => s.desk === (q.desk || feeds[q.feed]?.desk) && s.signals.some(x => x.split("#")[0] === q.feed));
  const full = s => qOf(s).some(q => q.n >= (q.max ?? 99));
  const chosen = [], per = {}, take = (s, q) => { chosen.push(s); per[s.desk] = (per[s.desk] || 0) + 1; s.taken = true; for (const x of qOf(s)) x.n++; if (q) s.quota = q.label || q.feed; };
  for (const s of stories) { if (chosen.length >= top) break; if ((per[s.desk] || 0) < cap(s.desk) && !full(s)) take(s); }
  // within a source's places: the most widely carried first, then the source's own order (Google News ranks a city's
  // stories by how local and relevant they are; freshness alone picked a national railway list for Prayagraj)
  const pos = (s, q) => Math.min(...s.signals.filter(x => x.split("#")[0] === q.feed).map(x => Number(x.split("#")[1]) || 99));
  for (const q of Q) for (const s of stories.filter(s => qOf(s).includes(q)).sort((a, b) => b.n - a.n || pos(a, q) - pos(b, q))) {
    if (q.n >= (q.min || 0)) break; if (!s.taken && !LISTING.test(s.title) && !full(s)) take(s, q);
  }
  for (const [d, m] of Object.entries(mins)) for (const s of stories) { if ((per[d] || 0) >= m) break; if (!s.taken && s.desk === d && !full(s)) take(s); }
  for (const s of stories) { if (chosen.length >= max) break; if (!s.taken && (per[s.desk] || 0) < cap(s.desk) && !full(s)) take(s); }
  const used = new Set();
  const clusters = chosen.sort((a, b) => b.score - a.score).map((s, i) => ({ id: "p-" + idOf(s.title, used), rank: i + 1, top: i < top, ...(s.quota ? { quota: s.quota } : {}), desk: s.desk, score: s.score, title: s.title,
    outlets: s.outlets.slice(0, 8), n: s.n, date: s.date, read: s.read, snippet: s.snippet, also: s.members.map(m => m.title).filter(t => t !== s.title).slice(0, 3) }));
  const headlines = stories.filter(s => !s.taken).slice(0, P.headlines || 40).map(s => ({ id: "h-" + idOf(s.title, used), desk: s.desk, title: s.title, outlets: s.outlets.slice(0, 4), n: s.n, url: s.read[0] }));
  const counts = {}; for (const c of clusters) counts[c.desk] = (counts[c.desk] || 0) + 1;
  return { clusters, headlines, counts, candidates: stories.length };
}

// What the editor reads: one block per cluster (the top ones with more of their text), then the headlines, within a
// fixed size so the run's cost cannot grow with the news.
export function compactPool(pool, P = {}) {
  const ist = d => d ? new Date(Date.parse(d) + 5.5 * H).toISOString().slice(5, 16).replace("T", " ") : "?";
  const lim = P.text_chars || { top: 1600, rest: 900 }, out = [];
  out.push(`POOL ${pool.date} · ${pool.clusters.length} stories · desks: ${Object.entries(pool.counts).map(([d, n]) => `${d} ${n}`).join(", ")} · window ${pool.window?.from?.slice(0, 16)}Z to ${pool.window?.to?.slice(0, 16)}Z`);
  for (const c of pool.clusters) {
    out.push(`\n[${c.id}] ${c.top ? "TOP · " : ""}${c.quota ? `ANSWER (${c.quota}) · ` : ""}${c.desk} · ${c.n} outlets · ${ist(c.date)} IST\n${c.title}\nOutlets: ${c.outlets.join(", ")}${c.also.length ? `\nAlso headlined: ${c.also.join(" | ")}` : ""}`);
    if (c.text) out.push(`Source: ${c.text_url}\n${c.text.slice(0, c.top ? lim.top : lim.rest)}`);
    else out.push(`Source: ${c.read[0]} (text not read${c.snippet ? `; summary: ${c.snippet}` : ""})`);
  }
  out.push(`\nHEADLINES (not shortlisted; usable for briefs, lines or as leads)`);
  for (const h of pool.headlines) out.push(`[${h.id}] ${h.desk} · ${h.n} · ${h.title} (${h.outlets.slice(0, 2).join(", ")}) ${h.url || ""}`);
  return out.join("\n");
}

export const POOL = { read };
export const POOL_CACHE = { read: [3600, 7200] };
