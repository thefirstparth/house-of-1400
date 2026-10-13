// The daily episode's pieces that need no network (tests/podcast.test.mjs): the running order built from the edition,
// numbers and symbols turned into spoken words, the checks a script must pass before it is voiced, a plain script made
// by code when the writer fails, and the podcast feed. Parth, 12-13 Oct 2026: two hosts, free, automatic.

const TZ = "Asia/Kolkata";
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(`${ONES[h]} hundred`);
  if (r) out.push((h ? "and " : "") + (r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : "")));
  return out.join(" ");
}
// Indian style: crore and lakh
export function intWords(n) {
  n = Math.round(Math.abs(n));
  if (n === 0) return "zero";
  const parts = [], crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thou = Math.floor((n % 1e5) / 1000), rest = n % 1000;
  if (crore) parts.push(`${crore >= 1000 ? intWords(crore) : under1000(crore)} crore`);
  if (lakh) parts.push(`${under1000(lakh)} lakh`);
  if (thou) parts.push(`${under1000(thou)} thousand`);
  if (rest) parts.push((parts.length && rest < 100 ? "and " : "") + under1000(rest));
  return parts.join(" ");
}
export function numWords(s) {
  const t = String(s).replace(/,/g, "");
  const [i, d] = t.split(".");
  return d ? `${intWords(Number(i))} point ${[...d].map(x => ONES[Number(x)]).join(" ")}` : intWords(Number(i));
}

// Everything as it is said: "₹32,490 crore" -> "thirty-two thousand four hundred and ninety crore rupees", "2–1" ->
// "two-one", "0.76%" -> "zero point seven six per cent", then the pronunciation list (config podcast.pronounce).
export function spoken(text, pronounce = {}) {
  let s = String(text || "");
  for (const [w, say] of Object.entries(pronounce)) s = s.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), say);
  s = s.replace(/<[^>]*>/g, m => (/^<(short pause|long pause|pause|laugh|sigh|breath|chuckle)>$/i.test(m) ? m : ""));
  s = s.replace(/\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(trillion|billion|million|bn|m))?\b/gi, (_, n, u) => `${numWords(n)}${u ? " " + ({ bn: "billion", m: "million" }[u.toLowerCase()] || u.toLowerCase()) : ""} dollars`);
  s = s.replace(/(?:₹|Rs\.?\s?|INR\s?)(\d[\d,]*(?:\.\d+)?)(?:\s?(lakh crore|crore|lakh|thousand))?/gi, (_, n, u) => `${numWords(n)}${u ? " " + u.toLowerCase() : ""} rupees`);
  s = s.replace(/(\d+)\s?[–-]\s?(\d+)(?=\s|[,.;!?]|$)/g, (_, a, b) => `${numWords(a)}-${numWords(b)}`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s?%/g, (_, n) => `${numWords(n)} per cent`);
  s = s.replace(/(\d+)(st|nd|rd|th)\b/g, (_, n) => ordinal(Number(n)));
  s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => { const H = Number(h), h12 = H % 12 || 12; return `${intWords(h12)}${m === "00" ? "" : " " + (m[0] === "0" ? "oh " + ONES[Number(m[1])] : intWords(Number(m)))} ${H < 12 ? "a m" : "p m"}`; });
  s = s.replace(/\d[\d,]*(?:\.\d+)?/g, n => numWords(n));
  s = s.replace(/&/g, " and ").replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();
  return s;
}
function ordinal(n) {
  const w = intWords(n), irregular = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
  const m = w.match(/(\w+)$/), last = m[1];
  if (irregular[last]) return w.slice(0, -last.length) + irregular[last];
  if (/y$/.test(last)) return w.slice(0, -1) + "ieth";
  return w + "th";
}

const kickerTag = k => String(k || "").split("·")[0].trim();
const storyText = s => [s.short || s.text, ...(s.more || [])].filter(Boolean).join(" ");
const longDate = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const clock12 = (h, m) => `${intWords(h % 12 || 12)}${m ? " " + (m < 10 ? "oh " + ONES[m] : intWords(m)) : ""} ${h < 12 ? "a m" : "p m"}`;
const sayTimes = t => String(t || "").replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(?:IST|hrs|hours))?\b/g, (_, h, m) => clock12(Number(h), Number(m))).replace(/\s*\bIST\b/g, "");
const cut = (t, n) => { t = String(t || ""); if (t.length <= n) return t; const s = t.slice(0, n), i = s.lastIndexOf(". "); return i > n * 0.5 ? s.slice(0, i + 1) : s.replace(/\s+\S*$/, "") + "…"; };

// A match time, exact, in IST (Parth, 13 Oct: "a Real Madrid match will always start at a specific time"): the
// calendar day and the clock as Indians say it, with the night spelt out after midnight: "Wednesday at seven p m",
// "on Thursday at twelve thirty a m, late on Wednesday night", "today at three thirty p m".
const IST = 5.5 * 36e5;
export function sayWhen(utc, now = Date.now()) {
  const t = typeof utc === "number" ? utc : Date.parse(utc); if (!Number.isFinite(t)) return null;
  const d = new Date(t + IST), h = d.getUTCHours(), m = d.getUTCMinutes(), day = Math.floor((t + IST) / 864e5) - Math.floor((now + IST) / 864e5);
  const wd = ms => new Date(ms + IST).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const dayWord = k => (k === 0 ? "today" : k === 1 ? "tomorrow" : k === -1 ? "yesterday" : `on ${wd(t + (k - day) * 864e5)}`);
  const clock = h === 0 && m === 0 ? "twelve midnight" : h === 12 && m === 0 ? "twelve noon" : clock12(h, m);
  const night = h < 4 ? `, late ${day - 1 === 0 ? "tonight" : day - 1 === 1 ? "tomorrow night" : day - 1 === -1 ? "last night" : `on ${wd(t - 864e5)} night`}` : "";
  return `${dayWord(day)} at ${clock}${night}`;
}
export const clockOf = line => (String(line).match(/\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?: oh [a-z]+| [a-z]+(?:-[a-z]+)?)? [ap] m|twelve midnight|twelve noon)\b/) || [])[0] || null;

// A day as people say it: "today", "tomorrow", "on Wednesday", "on Sunday the twenty-fifth"
export function sayDay(ymd, now = Date.now()) {
  const t = Date.parse(`${ymd}T12:00:00+05:30`); if (!Number.isFinite(t)) return null;
  const day = Math.round((t - Date.parse(new Date(now + IST).toISOString().slice(0, 10) + "T12:00:00+05:30")) / 864e5);
  const wd = new Date(t).toLocaleDateString("en-GB", { weekday: "long", timeZone: TZ });
  return day === 0 ? "today" : day === 1 ? "tomorrow" : day === -1 ? "yesterday" : day > 6 ? `on ${wd} the ${ordinal(new Date(t).getUTCDate())}` : `on ${wd}`;
}

// The Fixture List's rows, as the page builds them (public/app.js feedFixtures, allFixtures, liveTennis) from the
// edition's snapshot: India's cricket, Real Madrid, the F1 weekend's qualifying, sprint and race, the Warriors
// (pre-season marked), the followed tennis players, and the edition's own rows for anything no feed covers.
const lastName = n => String(n || "").trim().split(/\s+/).pop();
export function fixtureList(E, follows = {}) {
  const snap = E.snapshot || {}, v = k => (snap[k]?.value && !snap[k]?.error ? snap[k].value : null), out = [], have = new Set();
  const C = v("crease");
  if (C) {
    have.add("india_cricket");
    const short = x => (/asian games/i.test(x) ? "Asian Games cricket" : String(x || "").replace(/,?\s*\d{4}(\/\d{2})?$/, ""));
    const all = [C.today, C.next, ...[C.main, ...(C.also || [])].filter(Boolean).flatMap(S => (S.formats || []).flatMap(f => f.matches || []))].filter(Boolean);
    for (const m of [...new Map(all.map(m => [m.id, m])).values()]) {
      const bilateral = m.n && !/games|cup|trophy|championship/i.test(m.series || "");
      out.push({ when_utc: m.start, entity: "india_cricket", time_tbc: m.time_announced === false, label: bilateral ? `India v ${m.opponent}, ${m.desc}${m.city ? `, ${m.city}` : ""}` : `${short(m.series)}: India v ${m.opponent}, ${m.desc}`, ...(m.state === "done" && m.status ? { result: String(m.status).replace(/\bwkts?\b/g, "wickets").replace(/\binns\b/g, "innings") } : {}) });
    }
  }
  const F = v("football"), club = follows.football_club?.name || "Real Madrid";
  if (F) {
    have.add("madrid");
    for (const m of [...(F.next || []), ...(F.last ? [F.last] : [])])
      out.push({ when_utc: new Date(Date.parse(m.date)).toISOString(), entity: "madrid", time_tbc: m.time_confirmed === false, label: `${m.home ? `${club} v ${m.opponent}` : `${m.opponent} v ${club}`}, ${m.competition || "football"}`,
        ...(m.completed && m.score?.us != null ? { result: `${club} ${m.winner === "us" ? "won" : m.winner === "them" ? "lost" : "drew"} ${m.score.us}–${m.score.them}` } : {}) });
  }
  const R0 = v("f1_next")?.race, W = v("f1_sessions")?.race;
  for (const R of [R0, W && W.round !== R0?.round ? W : null]) {
    if (!R?.sessions?.length) continue;
    have.add("f1");
    const gp = String(R.name || "").replace(/\s+in\s+.*$/, "");
    for (const x of R.sessions.filter(x => /^(qualifying|sprint|sprint qualifying|race)$/i.test(x.name)))
      out.push({ when_utc: new Date(Date.parse(x.start)).toISOString(), entity: "f1", time_tbc: x.time_confirmed === false, label: /^race$/i.test(x.name) ? `Formula One, the ${gp}` : `Formula One, ${gp}, ${x.name.toLowerCase()}` });
  }
  const B = v("nba"), team = follows.nba_team?.name || "Golden State Warriors";
  if (B) {
    have.add("nba");
    for (const g of [...(B.next || []), ...(B.last ? [B.last] : [])])
      out.push({ when_utc: new Date(Date.parse(g.date)).toISOString(), entity: "nba", label: `${g.home ? `${team} v ${g.opponent}` : `${g.opponent} v ${team}`}${g.preseason ? ", pre-season" : ""}`,
        ...(g.completed && g.score?.us != null ? { result: `${team} ${g.winner === "us" ? "won" : "lost"} ${g.score.us}–${g.score.them}` } : {}) });
  }
  const T = (v("tennis_players")?.players || []).filter(p => p.next?.when_utc).map(p => ({ when_utc: new Date(Date.parse(p.next.when_utc)).toISOString(), entity: "tennis", label: `${lastName(p.name)} v ${p.next.opponent || "an opponent to be decided"}, ${p.next.event}${p.next.round ? `, ${p.next.round}` : ""}` }));
  const names = T.map(t => t.label.split(" v ")[0]);
  const keep = (E.fixtures || []).filter(f => !have.has(f.entity) && (f.until_utc || f.entity !== "tennis" || !names.some(nm => String(f.label).includes(nm)))).map(f => ({ ...f, label: String(f.label).replace(/ · /g, ", ") }));
  return [...keep, ...out, ...T].filter(f => Number.isFinite(Date.parse(f.when_utc))).sort((a, b) => String(a.when_utc).localeCompare(String(b.when_utc)));
}

// "The market expects", as Page One picks it (v2/layer.js betsPick, config betting.page_one): the busiest prediction
// markets that touch what Parth follows; the podcast says at most two, each with its favourite (Parth, 13 Oct).
export function marketsExpect(E, paper = {}, k = 2) {
  const P = paper.betting?.page_one || {}, F = paper.follows || {};
  const names = [F.football_club?.name, F.football_club?.name?.replace(/^Real /, ""), F.f1_driver?.name, ...(F.tennis_players || []), "India",
    ...(F.cricket_team?.priority || []).filter(x => !/^(team|others)$/.test(x)), F.nba_team?.name].filter(Boolean).flatMap(n => [n, lastName(n)]), teams = F.national_teams || [];
  const has = (t, n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t);
  const cats = new Set((P.then?.categories || []).map(c => c.toLowerCase())), last = P.last?.pattern ? new RegExp(P.last.pattern, "i") : null;
  const match = b => / vs?\.? /i.test(b.title || "");
  const score = b => { const t = `${b.title} ${(b.outcomes || []).map(o => o.name).join(" ")}`;
    if (names.some(n => has(t, n))) return 3;
    if (match(b)) return teams.some(n => has(b.title, n)) ? 2 : 0;
    return cats.has(String(b.category || "").toLowerCase()) ? 2 : last && last.test(`${b.title} ${b.category || ""}`) ? 1 : 0; };
  return (Array.isArray(E.betting) ? E.betting : []).map((b, i) => ({ b, s: score(b), i })).filter(x => x.s > 0).sort((x, y) => y.s - x.s || (y.b.volume24h || 0) - (x.b.volume24h || 0) || x.i - y.i).slice(0, k)
    .map(({ b }) => { const o = [...(b.outcomes || [])].sort((x, y) => y.prob - x.prob)[0]; return o ? `${b.title}: the favourite is ${o.name}, about ${Math.round(o.prob)}%` : null; }).filter(Boolean);
}

// The running order (Parth, 13 Oct 2026): the lead, then the paper's desks in a listening order, each item marked
// "deep" (a real back-and-forth) or "quick" (a line or two). Deep: the lead and the strongest stories by Bhide's
// importance score, front-page stories first among equals, at least one from Sport; quick: the rest, up to quick_max.
// Sport carries the latest results and what is coming up even when no story covers it (Parth, 13 Oct): the paper's
// Fixture List for the next seven days; Money the market numbers; Close to Home the weather; The Week Ahead the other
// entries for the next three days.
// Desk names come from the paper (config desks_v2), so the hosts never file Delhi under Close to Home. Nothing
// outside the edition. `now` defaults to 14:30 IST on the edition's day, whenever the episode is made.
const ORDER = ["news", "home", "money", "tech", "sport", "off", "week"];
export function rundown(E, P = {}, now, paper = {}) {
  now ??= Date.parse(`${E.date}T09:00:00Z`);
  const deskOf = {}, nameOf = {};
  for (const d of paper.desks || []) for (const s of d.sections || []) deskOf[s] = d;
  for (const s of paper.sections || []) if (s?.id) nameOf[s.id] = s.name;
  const desk = s => deskOf[s.section] || (/^(F1|Tennis|La Liga|Football|Cricket|India · T20|MotoGP|Golf|Athletics)/i.test(s.kicker || "") ? { id: "sport", name: "Sport" } : { id: "news", name: "News" });
  const items = [];
  if (E.front) items.push(E.front.lead, ...(E.front.seconds || []), ...(E.front.briefs || []));
  const front = new Set(items.filter(Boolean).map(i => i.id));
  for (const S of Object.values(E.sections || {})) items.push(...(S.stories || []), ...(S.briefs || []));
  const seen = new Set(), list = items.filter(i => i?.headline && !seen.has(i.id) && seen.add(i.id));
  const imp = Object.fromEntries((E.art_scores || []).map(x => [x.story_id, x.importance ?? 1]));
  const [lead, ...rest] = list;
  const score = s => (imp[s.id] ?? 1) + (front.has(s.id) ? 0.5 : 0) + (s.short ? 0.25 : 0);
  const ranked = rest.map((x, i) => ({ x, i })).sort((a, b) => score(b.x) - score(a.x) || a.i - b.i).map(r => r.x);
  // Page One first, as the paper (Parth, 13 Oct): the lead, then the front page's stories in the paper's order (each a
  // real back-and-forth) and its briefs; then the desks with everything else, the strongest few as back-and-forths
  // (at least two, and at least one from Sport if the front page has none), the rest in a line or two.
  const seconds = (E.front?.seconds || []).filter(x => x?.headline && x.id !== lead?.id), fbriefs = (E.front?.briefs || []).filter(x => x?.headline && x.id !== lead?.id);
  const onFront = new Set([lead?.id, ...seconds.map(x => x.id), ...fbriefs.map(x => x.id)]), others = ranked.filter(x => !onFront.has(x.id));
  const deep = others.slice(0, Math.max(2, (P.deep_max || 6) - 1 - seconds.length));
  if (![lead, ...seconds, ...deep].some(x => x && desk(x).id === "sport")) { const sp = others.find(x => desk(x).id === "sport"); if (sp && !deep.includes(sp)) deep.splice(Math.max(0, deep.length - 1), 1, sp); }
  const deepIds = new Set(deep.map(x => x.id)), quick = others.filter(x => !deepIds.has(x.id)).slice(0, P.quick_max || 18);
  const item = (s, depth) => ({ id: s.id, desk: desk(s).name, section: nameOf[s.section] || null, kicker: s.kicker || null, headline: sayTimes(s.headline), tone: ["good", "bad", "mixed"].includes(s.tone) ? s.tone : "neutral", depth, text: sayTimes(cut(storyText(s), depth === "quick" ? 360 : 1100)), why: sayTimes(s.why?.text) || null });
  const snap = E.snapshot || {}, ok = k => (snap[k]?.value && !snap[k]?.error ? snap[k].value : null);
  const idx = ok("markets")?.indices || [], fx = ok("fx"), gold = ok("gold_in");
  // The money figures as a listener needs them (Parth, 13 Oct: "if Sensex is up 0.7%, I don't know what that means"): the
  // move today, the week and month, and where it sits in its range, from the same figures the Ledger board prints
  const markets = [], pc = x => `${x >= 0 ? "up" : "down"} ${Math.abs(x).toFixed(1)}%`, n0 = x => Math.round(x).toLocaleString("en-IN");
  const place = (v, lo, hi, span) => { if (!(hi > lo)) return ""; const f = (v - lo) / (hi - lo); return f <= 0.15 ? `, near its ${span} low (${n0(lo)})` : f >= 0.85 ? `, near its ${span} high (${n0(hi)})` : `, between its ${span} low of ${n0(lo)} and high of ${n0(hi)}`; };
  for (const name of ["Sensex", "Nifty 50"]) {
    const i = idx.find(x => x.name === name); if (!(i && Number.isFinite(i.price))) continue;
    const day = i.session_date && i.session_date !== E.date ? `at the last close (${i.session_date})` : "today";
    markets.push(`${name} at ${n0(i.price)}, ${pc(i.change_pct)} ${day}${Number.isFinite(i.chg_7d) ? `, ${pc(i.chg_7d)} over the past week` : ""}${Number.isFinite(i.chg_1m) ? `, ${pc(i.chg_1m)} over the past month` : ""}${place(i.price, i.lo3m, i.hi3m, "three-month")}`);
  }
  if (Number.isFinite(fx?.price)) markets.push(`the rupee at ${fx.price.toFixed(2)} to the dollar, ${fx.change_pct <= 0 ? "stronger" : "weaker"} by ${Math.abs(fx.change_pct).toFixed(1)}% today${fx.note ? ` (${fx.note})` : ""}`);
  if (Number.isFinite(gold?.per_10g_24k)) {
    const g = gold, d = x => x ? new Date(x.replace(/^(\d\d)\/(\d\d)\/(\d{4})$/, "$3-$2-$1") + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : "";
    markets.push(`24-carat gold at ₹${n0(g.per_10g_24k)} for ten grams, ${Number.isFinite(g.change_pct) ? `${pc(g.change_pct)} since the last rate${g.prev_date ? ` (${d(g.prev_date)})` : ""}` : ""}${Number.isFinite(g.change_7d_pct) ? `, ${pc(g.change_7d_pct)} over the past week` : ""}${Number.isFinite(g.change_1m_pct) ? `, ${pc(g.change_1m_pct)} over the past month` : ""}${g.hi && g.lo ? `; since ${d(g.range_from)} its high was ₹${n0(g.hi)} (${d(g.hi_date)}) and its low ₹${n0(g.lo)} (${d(g.lo_date)})` : ""}`);
  }
  const market_notes = Object.entries(E.sections?.ledger?.data?.notes || {}).map(([k, v]) => `${k}: ${v}`).slice(0, 6);
  const NAMES = { madrid: "Real Madrid", india_cricket: "India (cricket)", f1: "Formula One" }, results = [], coming = [], ahead = [];
  const SPORT = new Set(["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"]), whys = [];
  for (const w of E.week_ahead || []) {
    const t = w.time_ist ? Date.parse(`${w.date}T${w.time_ist}:00+05:30`) : Date.parse(`${w.date}T23:59:00+05:30`);
    if (SPORT.has(w.area)) { if (w.why && w.time_ist) whys.push([t, w.why]); continue; }
    if (t > now - 18e5 && t < now + 3 * 864e5 && ahead.length < 5) ahead.push(`${sayTimes(w.what)}, ${w.time_ist ? sayWhen(t, now) : sayDay(w.date, now)}${w.why ? ` (${w.why})` : ""}`);
  }
  const rows = fixtureList(E, paper.follows || {}), have = new Set();
  for (const f of rows) {
    const t = Date.parse(f.when_utc);
    if (f.result) { if (t > now - 60 * 36e5 && t <= now) results.push(`${f.label}: ${f.result} (${sayDay(new Date(t + IST - 4 * 36e5).toISOString().slice(0, 10), now)})`); continue; }
    if (!(t > now - 18e5 && t < now + 7 * 864e5)) continue;
    const why = whys.find(([x]) => Math.abs(x - t) < 3 * 36e5)?.[1];
    coming.push(`${f.label}, ${f.time_tbc ? `${sayDay(new Date(t + IST - 4 * 36e5).toISOString().slice(0, 10), now)}, time to be confirmed` : sayWhen(t, now)}${why ? ` (${why})` : ""}`);
    have.add(f.entity);
  }
  for (const [k, c] of Object.entries(E.chronology || {})) {
    const l = c?.last, n = c?.next, lt = Date.parse(l?.when_utc), nt = Date.parse(n?.when_utc);
    if (lt > now - 60 * 36e5 && lt <= now && !results.some(r => r.includes(l.label))) results.push(`${NAMES[k] || k}: ${l.label}${l.detail ? `, ${l.detail}` : ""} (${sayDay(new Date(lt + IST - 4 * 36e5).toISOString().slice(0, 10), now)}${new Date(lt + IST).getUTCHours() < 4 ? ", late at night" : ""})`);
    // a followed team with no Fixture List row in the window (nothing in seven days, or its live feed down): the paper's Next
    if (nt > now - 18e5 && !have.has(k)) coming.push(`${NAMES[k] || k} next: ${n.label}${n.detail ? `, ${n.detail.replace(/ · /g, ", ")}` : ""}, ${nt < now + 6 * 864e5 ? sayWhen(nt, now) : sayDay(new Date(nt + IST - 4 * 36e5).toISOString().slice(0, 10), now)}`);
  }
  for (const p of ok("tennis_players")?.players || []) { const l = p.last, t = Date.parse(l?.when_utc); if (l && t > now - 36 * 36e5 && t <= now) results.push(`${p.name}: ${l.won ? "beat" : "lost to"} ${l.opponent}, ${l.round}, ${l.event}`); }
  const city = ok("weather")?.cities?.[0], d0 = city?.daily?.[0];
  const weather = city && d0 ? `${city.name} today: top of ${Math.round(d0.max)} degrees${Number.isFinite(d0.min) ? `, low of ${Math.round(d0.min)}` : ""}, ${d0.rain_prob}% chance of rain` : null;
  const groups = {};
  for (const [s, depth] of [...deep.map(s => [s, "deep"]), ...quick.map(s => [s, "quick"])]) { const d = desk(s); (groups[d.id] ||= { desk: d.name, items: [] }).items.push(item(s, depth)); }
  for (const g of Object.values(groups)) g.items.sort((a, b) => (a.depth === b.depth ? 0 : a.depth === "deep" ? -1 : 1));
  const named = id => (paper.desks || []).find(d => d.id === id)?.name || { home: "Close to Home", money: "Money", sport: "Sport" }[id];
  if (markets.length) Object.assign(groups.money ||= { desk: named("money"), items: [] }, { markets, ...(market_notes.length ? { market_notes } : {}) });
  if (results.length || coming.length) Object.assign(groups.sport ||= { desk: named("sport"), items: [] }, { results, coming });
  if (weather) (groups.home ||= { desk: named("home"), items: [] }).weather = weather;
  if (ahead.length) groups.week = { desk: "The Week Ahead", items: [], coming: ahead };
  const page1 = [...seconds.map(x => item(x, "deep")), ...fbriefs.map(x => item(x, "quick"))];
  const segments = [...(page1.length ? [{ desk: "Page One", items: page1 }] : []), ...[...ORDER, ...Object.keys(groups).filter(k => !ORDER.includes(k))].filter(k => groups[k]).map(k => groups[k])];
  return { date: E.date, day: longDate(E.date), editor: P.author || "T. A. Bhide", lead: lead ? { ...item(lead, "deep"), desk: "Lead" } : null, segments, market_expects: marketsExpect(E, paper), house_note: E.house_note || null, editor_note: E.big_day ? E.editor_note || null : null };
}
export const deepItems = R => [R.lead, ...(R.segments || []).flatMap(s => s.items.filter(i => i.depth === "deep"))].filter(Boolean);

const SERIOUS = new Set(["bad", "sombre", "concerned", "gentle"]);
export const EXAMPLE = `Ashu [delighted]: Right, the chess club. They actually did it.
Tarun [surprised]: The village side? Beat the city champions?
Ashu [delighted]: Beat them, and in the final round, with the youngest player on the team.
Tarun [amused]: How young?
Ashu [warm]: Eleven.
Tarun [excited]: Eleven! I couldn't tie my shoelaces at eleven.
Ashu [matter-of-fact]: And the bad news on the same board: the hall they play in shuts next month.
Tarun [concerned]: Oh no. So where do they go?
Ashu [gentle]: Nobody knows yet. The council meets on Friday.`;

// The parts of the show a musical sting can open (the writer marks the first turn of each; studio.mjs plays it)
export const SEGMENTS = ["page-one", "news", "back-home", "close-to-home", "money", "tech", "sport", "fixture-watch", "betting-window", "off-duty", "week-ahead", "house-note"];
// A radio-style time check from the clock at writing time (IST): "a little after two in the afternoon"
export function onAir(ms = Date.now()) {
  const d = new Date(ms + IST), h = d.getUTCHours(), m = d.getUTCMinutes(), w = x => ONES[((x + 11) % 12) + 1] || intWords(((x + 11) % 12) + 1);
  const part = x => (x < 12 ? "in the morning" : x < 17 ? "in the afternoon" : "in the evening");
  if (m < 10) return `just after ${w(h)} ${part(h)}`;
  if (m < 25) return `a little after ${w(h)} ${part(h)}`;
  if (m < 36) return `half past ${w(h)} ${part(h)}`;
  if (m < 50) return `getting on for ${w(h + 1)} ${part(h + 1)}`;
  return `just before ${w(h + 1)} ${part(h + 1)}`;
}

// What the writer is asked for (Gemini, free tier). Parth, 13 Oct 2026: a conversation, not two readers taking turns.
export function writerPrompt(R, P = {}) {
  const [A, B] = P.hosts || [{ id: "Ashu" }, { id: "Tarun" }], W = P.words || { min: 1050, target: 1200, max: 1400 };
  const moods = Object.keys(P.moods || { neutral: 1 }).join(", ");
  return `You write the script of "${P.title || "The House of 1400"}", a daily podcast made from one family's private afternoon newspaper. The listeners are Parth and his wife in Bengaluru. It must sound like two friends who have both read today's paper, talking it through over chai. It is NOT a news bulletin and NOT two people taking turns to read the paper.

HOSTS
- ${A.id} (${A.gender || "woman"}): ${A.about || ""}
- ${B.id} (${B.gender || "man"}): ${B.about || ""}
Both grew up in Allahabad (Prayagraj) and live in Bengaluru now: Bengaluru is "here", Prayagraj is "back home". They speak natural Indian English, and now and then, where it comes naturally, a Hindi-belt word an Allahabadi would use ("arre", "haan", "bilkul", "ekdum", "yaar"): at most one every four or five turns, never a caricature, never in sad news.

THE SHOW, in this order, the way the paper is laid out (everything comes from the RUNDOWN below)
1. Open (first two turns): ${A.id} welcomes the listeners to the show BY NAME and gives the day, something like "Good afternoon, and welcome to ${P.title || "The House of 1400"}. It's ${R.day}, I'm ${A.id}..." and ${B.id} says hello too. Mention, lightly and in your own words, that this is ${R.editor}'s paper (the editor), at the open or at the close.
2. The lead as a hook, and the two talk it through properly.
3. Page One: the front page's other stories in the order given, each a real back-and-forth, then its briefs briskly.
4. Then the desk segments in the order given. Items marked "deep" get a real back-and-forth of about 80 to 140 words: one host tells it, the other reacts and asks what a listener would ask (what does it mean for us, why now, who is this), answered from "why" and the text. Items marked "quick" get one or two sentences each; several quick ones can run together briskly. Mention every item.
5. If you name a segment, use the paper's names: Page One, News, Close to Home, Money, Tech and AI, Sport, Off Duty. "Close to Home" is Bengaluru; a story from Ranchi or Prayagraj (the paper's Back Home, where the listener's parents live) is introduced as "back home in Ranchi" or "back home in Prayagraj", never as Bengaluru news. A story from Delhi or anywhere else is News, never "close to home". If a front-page story was about sport, the hosts can say there is more in Sport later.
6. Sport gets real energy: every sport item, the recent results (skip a result a story already covered; never give a result's clock time), and EVERY match in "coming", even when no story covers it (say each day and time EXACTLY as written, e.g. "on Thursday at twelve thirty a m, late on Wednesday night"; match times must be precise). Share the fixtures out as a back-and-forth: never more than three matches in one turn.
7. Money: the listener hears these, so every figure needs its meaning. For each of the "markets" lines say the level (rounded), the move TODAY (say "today"), how the week or month went, and whether it is near a high or a low; use "market_notes" for why it moved. Numbers are welcome (Parth likes them), rounded the way people say them ("just above seventy-two and a half thousand", "down about three per cent this month"). Each market (the Sensex, the Nifty, the rupee, gold) comes up in ONE place only, with ONE figure, the one in its "markets" line: if a Money story is about the same market (say, the rupee firming), tell its story in that same moment and never give the level a second time.
8. "market_expects", if given: one short, playful moment on what the betting markets expect, in words ("the markets make him a near-certainty", "about a two-in-three chance"), at most the two given, wherever it fits best (Sport or just before the close). Never read out a list of percentages.
9. Weather, if given: one everyday line ("warm, with a fair chance of rain later").
10. The Week Ahead, if given: a couple of quick lines on what is coming in the next few days.
11. Close: the House Note retold in the hosts' own words with its punchline intact (if it is about a story already told, do not tell the story again: go straight to the joke), then a short, warm goodbye whose very last line is the sign-off, word for word: "${P.signoff || `That's ${P.title || "The House of 1400"} for today.`}"

IT IS A RADIO SHOW, with the habits of one
- A time check in passing, early on, from "on_air" if given ("it's a little after two here in Bengaluru, and the chai's poured").
- The same segment names every day, said the way a radio host would: "Page One", then the desks by the paper's names, "Fixture Watch" for the coming matches, "the Betting Window" for what the markets expect, and "Bhide's House Note" for the House Note, introduced like a letter read on air ("and here's Bhide's House Note for today").
${P.music === false ? "" : `- Mark the FIRST turn of each new part with "segment", one of: ${SEGMENTS.join(", ")}. A short musical sting plays just before that turn, so mark only real changes of part (about five to nine in an episode), never two in a row.
`}
FUN: you have creative headroom in HOW things are said: banter between the two, a running joke, a playful line on the good news, the markets and the House Note. Never in WHAT is said: every fact, name, number, score, date and time stays exactly as in the rundown, and nothing is joked about near bad news.

HOW IT SOUNDS
- A real conversation: mix longer turns with plenty of quick reactions of two to eight words, each a natural response to exactly what was just said, in your own words (never reuse the example's lines). At least six genuine questions between the hosts.
- Real feeling that fits each story: delight at a win, shock and quiet sadness at deaths, worry about prices, amusement at the House Note. Never laugh or joke near bad news.
- Say each fact ONCE. The headline and the text repeat each other; never say the same fact twice.
- Never copy sentences from the rundown. Retell them the way people talk; contractions are good.
- Numbers are fine, as many as the story needs, rounded when the exact figure does not matter ("about thirty-two and a half thousand crore"). Never give the same figure twice, and never two different figures for the same thing.
- Times: say them exactly as the rundown writes them, the twelve-hour way with "a m" or "p m". Never the twenty-four-hour clock and never "IST".
- Never use these: "Turning to", "In other news", "Moving on", "Let's look at", "Let us look at", "Meanwhile", "Closer to home", "Stay tuned", "On the cricket field".
- Use only facts in the rundown. Never add a fact, name, number or quote. Short personal reactions are fine ("I'd love to see that").
- A host's question is answered ONLY with what the rundown says. Never answer "yes", "right there" or "exactly" to a detail the rundown does not state (which terminal, which app, which player); answer with what it does say instead. Best of all, ask questions the rundown can answer.
- Do not add descriptive details the rundown lacks, even small ones: a time of day ("that morning"), a kind of place ("commercial airport"), a size, a mood of a crowd. Colour comes from the hosts' reactions, never from new details.
- Round honestly: never round a number up past what it is. 0.7 per cent is "under one per cent" or "about three-quarters of a per cent", never "nearly one per cent"; "over three hundred" only when it is over three hundred.
- Never address the listeners by name; speak to them as "you" if at all.
- No talk about how the paper or the show is made, about sources or checking, or about anything being missing.
- Every number, score, time and date in words, the Indian way (lakh and crore). No digits, no symbols like ₹, %, $ or &.
- About ${W.target} words in total, and NEVER more than ${W.max} (at least ${W.min}). Keep it tight: when it runs long, give quick items one line each rather than dropping the fixtures, the money or the House Note.
- "mood" sets the voice for that line; one of: ${moods}. Inline tags, sparingly: <laugh> (light moments only), <sigh>, <short pause>.

EXAMPLE OF THE SOUND ONLY (its facts are invented: never use them; this is the rhythm and feeling to aim for)
${EXAMPLE}

Return JSON only: {"turns":[{"speaker":"${A.id}"|"${B.id}","mood":"...","text":"..."${P.music === false ? "" : `,"segment":"(only on the first turn of a part)"`}}]}

RUNDOWN
${JSON.stringify(R, null, 1)}`;
}

const PROCESS = /\b(source[sd]?|sourcing|validator|edition file|the pool|pool story|rundown|script|prompt|we checked|second source|AI-generated|language model|generated)\b/i;
const NUMW = new Set([...ONES, ...TENS.filter(Boolean), "hundred", "thousand", "lakh", "crore", "million", "billion", "point", "per", "cent", "percent"]);
const words = t => String(t || "").replace(/<[^>]+>/g, " ").toLowerCase().replace(/[^a-z0-9' -]/g, " ").split(/[\s-]+/).filter(Boolean);
const numberRuns = t => { let n = 0, inRun = false, only = true; for (const w of words(t)) { if (NUMW.has(w) || (inRun && w === "and")) { if (!inRun) { inRun = true; only = true; } if (w !== "one" && w !== "and") only = false; } else { if (inRun && !only) n++; inRun = false; } } if (inRun && !only) n++; return n; };
const shingles = (ws, k) => { const out = []; for (let i = 0; i + k <= ws.length; i++) out.push(ws.slice(i, i + k).join(" ")); return out; };
const BANNED = /\b(turning to|in other news|moving on|let'?s look at|let us look at|meanwhile|closer to home|stay tuned|on the cricket field)\b/i;

// The checks before voicing. Each problem is { hard, msg }: a hard one means the script is never voiced; soft ones
// send it back for a rewrite, and after the last try the script with the fewest soft problems is voiced.
export function checkScript(turns, R, P = {}) {
  const W = P.words || { min: 1050, max: 1400 }, ids = new Set((P.hosts || [{ id: "Ashu" }, { id: "Tarun" }]).map(h => h.id)), out = [];
  const hard = msg => out.push({ hard: true, msg }), soft = msg => out.push({ hard: false, msg });
  if (!Array.isArray(turns) || turns.length < 8) return [{ hard: true, msg: "fewer than 8 turns" }];
  const n = turns.reduce((a, t) => a + words(t.text).length, 0);
  if (n < W.min * 0.7 || n > W.max * 1.3) hard(`${n} words (needs ${W.min} to ${W.max})`); else if (n < W.min || n > W.max) soft(`${n} words (needs ${W.min} to ${W.max})`);
  const sad = new Set(deepItems(R).concat((R.segments || []).flatMap(s => s.items)).filter(s => s?.tone === "bad").flatMap(s => String(s.headline).toLowerCase().match(/[a-z]{5,}/g) || []));
  turns.forEach((t, i) => {
    const txt = String(t.text || "");
    if (!ids.has(t.speaker)) hard(`turn ${i + 1}: unknown speaker ${t.speaker}`);
    if (!txt.trim()) hard(`turn ${i + 1}: empty`);
    if (/<laugh>|<chuckle>/i.test(txt) && (SERIOUS.has(t.mood) || [...sad].some(w => txt.toLowerCase().includes(w)))) hard(`turn ${i + 1}: laughter in a serious moment`);
    if (PROCESS.test(txt.replace(/<[^>]+>/g, ""))) hard(`turn ${i + 1}: talks about how the show is made ("${txt.match(PROCESS)[0]}")`);
    const b = txt.match(BANNED); if (b) soft(`turn ${i + 1}: uses the stock phrase "${b[0]}"`);
  });
  // each market's level in one place only (13 Oct redo: the rupee at "95.25" and then "95.28" two turns later)
  for (const [name, re] of [["the rupee", /\brupee\b/i], ["the Sensex", /\bsensex\b/i], ["the Nifty", /\bnifty\b(?! it\b| bank\b| midcap| smallcap)/i], ["gold", /\bgold\b/i]]) {
    const at = turns.map((t, i) => (re.test(t.text) && numberRuns(t.text) ? i : -1)).filter(i => i >= 0);
    if (at.length > 1) soft(`gives a figure for ${name} in ${at.length} turns (${at.map(i => i + 1).join(", ")}): say it once, in one turn`);
  }
  if (P.signoff) { const norm = x => words(x).join(" "); if (!norm(turns.at(-1)?.text).includes(norm(P.signoff))) soft(`the last line is not the sign-off, word for word: "${P.signoff}"`); }
  const marks = turns.filter(t => t.segment).length;
  if (P.music !== false && marks < 4) soft(`only ${marks} turns carry a "segment" mark (needs one on the first turn of each part, five or more)`);
  turns.forEach((t, i) => { if (t.segment && !SEGMENTS.includes(t.segment)) soft(`turn ${i + 1}: unknown segment "${t.segment}" (use one of ${SEGMENTS.join(", ")})`); });
  const title = String(P.title || "The House of 1400").toLowerCase().replace("1400", "(1400|fourteen hundred)");
  const named = t => new RegExp(title.replace(/^the /, "")).test(String(t?.text || "").toLowerCase());
  if (!turns.slice(0, 2).some(named)) soft(`the opening does not name the show ("${P.title || "The House of 1400"}") in the first two turns`);
  if (!turns.slice(-3).some(named)) soft(`the goodbye does not name the show`);
  turns.forEach((t, i) => { if (/\bParth\b/i.test(t.text)) soft(`turn ${i + 1}: addresses the listener by name`); });
  const ed = lastName(R.editor || P.author || "Bhide"), edRe = new RegExp(`\\b${ed}\\b`, "i");
  if (![...turns.slice(0, 4), ...turns.slice(-5)].some(t => edRe.test(t.text))) soft(`the editor (${R.editor || P.author || "T. A. Bhide"}) is not mentioned at the open or the close`);
  const avg = n / turns.length, shortN = turns.filter(t => words(t.text).length <= 8).length, qs = turns.filter(t => /\?/.test(t.text)).length;
  if (avg > 40) soft(`turns average ${Math.round(avg)} words: too much reading, not enough conversation`);
  if (shortN < 6) soft(`only ${shortN} quick reactions of eight words or fewer (needs six or more)`);
  if (qs < 6) soft(`only ${qs} turns ask a question (needs six or more)`);
  // copied from the paper: eight words in a row from the rundown's text
  const paper = new Set([R.lead, ...(R.segments || []).flatMap(s => s.items)].filter(Boolean).flatMap(s => shingles(words(`${s.headline}. ${s.text} ${s.why || ""}`), 8)));
  const copied = turns.map((t, i) => [i, shingles(words(t.text), 8).find(s => paper.has(s))]).filter(x => x[1]);
  if (copied.length) soft(`reads the paper word for word in ${copied.length} turn(s), e.g. turn ${copied[0][0] + 1}: "${copied[0][1]}"`);
  // a fact said twice: six words in a row repeated in another turn
  const seenAt = new Map(), twice = [];
  turns.forEach((t, i) => { for (const s of new Set(shingles(words(t.text), 6))) { if (seenAt.has(s) && seenAt.get(s) !== i) twice.push(s); else seenAt.set(s, i); } });
  if (twice.length) soft(`says the same thing twice: "${twice[0]}"`);
  // the example's own lines reused (Flash Lite dropped "Thirteen. That's terrible." into the money news, 13 Oct test)
  const ex = new Set(shingles(words(EXAMPLE.replace(/^\w+ \[[^\]]+\]: /gm, "")), 4));
  const reused = turns.map((t, i) => [i, shingles(words(t.text), 4).find(s => ex.has(s))]).filter(x => x[1]);
  if (reused.length) soft(`reuses the example's lines in turn ${reused[0][0] + 1}: "${reused[0][1]}"`);
  const H24 = /\b(i s t|ist|(thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty-one|twenty-two|twenty-three) (hundred|oh [a-z]+|fifteen|thirty|forty-five)( hours)?)\b/i;
  turns.forEach((t, i) => { const m = String(t.text).match(H24); if (m) soft(`turn ${i + 1}: twenty-four-hour clock or IST ("${m[0]}"); use "a m" or "p m"`); });
  // every match time is said exactly as written (the clock words, e.g. "twelve thirty a m")
  const said = turns.map(t => String(t.text)).join(" ").toLowerCase().replace(/\b([ap])\.\s?m\.?/g, "$1 m").replace(/\b([ap])m\b/g, "$1 m").replace(/-/g, " ");
  for (const g of R.segments || []) for (const c of g.coming || []) { const k = clockOf(c); if (k && /sport/i.test(g.desk) && !said.includes(k.replace(/-/g, " "))) soft(`leaves out or changes the time "${k}" for: ${c.split(",")[0]}`); }
  // every deep story and every sport item is mentioned (one of its names appears)
  const all = turns.map(t => t.text).join(" ").toLowerCase();
  for (const s of [...deepItems(R), ...(R.segments || []).filter(g => /sport/i.test(g.desk)).flatMap(g => g.items)]) {
    const names = (String(s.headline).match(/\b[A-Z][a-zA-Zé']{3,}\b/g) || []).slice(1).concat(String(s.headline).match(/^[A-Z][a-zA-Zé']{3,}/) || []);
    if (names.length && !names.some(w => all.includes(w.toLowerCase().replace(/'s$/, "")))) soft(`leaves out "${s.headline}"`);
  }
  return out;
}

// When the writer fails: a plain, correct conversation made by code from the rundown
export function fallbackScript(R, P = {}) {
  const [A, B] = (P.hosts || [{ id: "Ashu" }, { id: "Tarun" }]).map(h => h.id), turns = [];
  const say = (speaker, mood, text) => text && turns.push({ speaker, mood, text });
  const first = (s, k = 3) => String(s?.text || "").split(/(?<=[.!?])\s+/).slice(0, k).join(" ");
  say(A, "warm", `Good afternoon. This is ${P.title || "The House of 1400"} for ${R.day}, ${R.editor}'s paper.`);
  if (R.lead) { say(B, R.lead.tone, `The big one today: ${R.lead.headline}.`); say(A, R.lead.tone, first(R.lead)); }
  let k = 0;
  const SEG = { "Page One": "page-one", News: "news", Money: "money", "Tech and AI": "tech", Sport: "sport", "Off Duty": "off-duty", "The Week Ahead": "week-ahead" };
  for (const g of R.segments || []) {
    const at = turns.length;
    for (const s of g.items) { const [x, y] = k++ % 2 ? [A, B] : [B, A]; say(x, s.tone, `${s.headline}.`); if (s.depth === "deep") say(y, s.tone, first(s)); }
    if (g.markets?.length) say(B, "neutral", `On the markets: ${g.markets.join("; ")}.`);
    if (g.results?.length) say(A, "neutral", `The latest results: ${g.results.join("; ")}.`);
    if (g.coming?.length) say(B, "neutral", `Coming up: ${g.coming.join("; ")}.`);
    if (g.weather) say(A, "neutral", `And the weather. ${g.weather}.`);
    if (turns[at]) turns[at].segment = SEG[g.desk] || (/home/i.test(g.desk) ? "close-to-home" : "news");
  }
  if (R.house_note) { say(A, "amused", `And here's ${R.editor}'s House Note. ${R.house_note}`); turns.at(-1).segment = "house-note"; }
  say(B, "warm", P.signoff || "That's the afternoon. See you tomorrow.");
  return turns;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The private feed (Apple Podcasts "Follow a Show by URL"); itunes:block keeps it out of Apple's directory
export function feedXML({ P = {}, base, episodes, image }) {
  const items = episodes.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `  <item>
    <title>${esc(e.title)}</title>
    <description>${esc(e.description)}</description>
    <enclosure url="${esc(e.url)}" length="${e.bytes}" type="audio/mpeg"/>
    <guid isPermaLink="false">h1400-${e.date}${e.v > 1 ? `-v${e.v}` : ""}</guid>
    <pubDate>${new Date(e.published).toUTCString()}</pubDate>
    <itunes:duration>${Math.round(e.seconds)}</itunes:duration>
    <itunes:explicit>false</itunes:explicit>
  </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>${esc(P.title || "The House of 1400")}</title>
  <link>${esc(base)}</link>
  <description>${esc(P.subtitle || "")}</description>
  <language>en-in</language>
  <itunes:author>${esc(P.author || "")}</itunes:author>
  <itunes:block>Yes</itunes:block>
  <itunes:explicit>false</itunes:explicit>${image ? `\n  <itunes:image href="${esc(image)}"/>\n  <image><url>${esc(image)}</url><title>${esc(P.title || "The House of 1400")}</title><link>${esc(base)}</link></image>` : ""}
${items}
</channel>
</rss>
`;
}

// Cuts one host's single-voice take (24 kHz, 16-bit mono PCM: every line of theirs read in order, with a pause asked
// for between lines) back into its lines. Each cut is a silence inside the take, chosen together so that they fall in
// order, near where the line lengths say each line should end, and on the longer pauses (13 Oct: Tarun's first solo
// take had pauses between lines no longer than the breaths inside them, and "the n-1 longest silences" failed).
// Returns null when the take does not split cleanly (too few pauses, or a piece far off its line's length), and the
// caller falls back.
export function splitLines(pcm, words) {
  const n = words.length, F = 480, frames = Math.floor(pcm.length / 2 / F), rms = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < F; i++) { const v = pcm.readInt16LE((f * F + i) * 2); s += v * v; } rms[f] = Math.sqrt(s / F); }
  const loud = [...rms].sort((a, b) => a - b)[Math.floor(frames * 0.95)] || 0, thr = Math.max(150, loud * 0.06);
  const quiet = f => rms[f] < thr;
  let a = 0, b = frames - 1; while (a < frames && quiet(a)) a++; while (b > a && quiet(b)) b--;
  if (a > b) return null;
  if (n === 1) return [pcm.subarray(a * F * 2, (b + 1) * F * 2)];
  // silences of 0.1 s or more inside the take are the possible cuts
  const runs = [];
  for (let f = a; f <= b; f++) if (quiet(f)) { const s = f; while (f <= b && quiet(f)) f++; if (f - s >= 5) runs.push({ s, e: f, len: f - s, mid: (s + f) / 2 }); }
  if (runs.length < n - 1) return null;
  // where each line should end, from the words (plus one for each line's own start and finish)
  const span = b - a, wt = words.map(w => w + 1), all = wt.reduce((x, y) => x + y, 0);
  const want = []; for (let k = 0, c = 0; k < n - 1; k++) { c += wt[k]; want.push(a + span * c / all); }
  const longest = Math.max(...runs.map(r => r.len));
  const cost = (k, j) => 4 * Math.abs(runs[j].mid - want[k]) / span - runs[j].len / longest;
  // the cheapest set of n-1 cuts in order (dynamic programming over boundaries and candidate silences)
  const m = runs.length, best = [], from = [];
  for (let k = 0; k < n - 1; k++) {
    best.push(new Float64Array(m).fill(Infinity)); from.push(new Int32Array(m).fill(-1));
    let run = Infinity, at = -1;
    for (let j = k; j < m - (n - 2 - k); j++) {
      if (k) { const p = best[k - 1][j - 1]; if (p < run) { run = p; at = j - 1; } if (at < 0) continue; }
      best[k][j] = (k ? run : 0) + cost(k, j); from[k][j] = at;
    }
  }
  let j = -1, low = Infinity; best[n - 2].forEach((v, i) => { if (v < low) { low = v; j = i; } });
  if (j < 0) return null;
  const cuts = []; for (let k = n - 2; k >= 0; k--) { cuts.unshift(runs[j]); j = from[k][j]; }
  const pieces = [];
  for (let i = 0, start = a; i < n; i++) {
    let s = start, e = i < n - 1 ? cuts[i].s : b + 1;
    while (s < e && quiet(s)) s++; while (e > s && quiet(e - 1)) e--;
    pieces.push([Math.max(0, s - 3), Math.min(frames, e + 3)]);
    if (i < n - 1) start = cuts[i].e;
  }
  // seconds per word, line by line, against the take's own pace
  const pace = pieces.map(([s, e], i) => ((e - s) * F / 24000) / Math.max(1, words[i]));
  const mid = pace.slice().sort((x, y) => x - y)[Math.floor(n / 2)];
  if (pieces.some(([s, e], i) => e - s < 8 || (words[i] >= 4 && (pace[i] > mid * 2.6 || pace[i] < mid / 2.6)))) return null;
  return pieces.map(([s, e]) => pcm.subarray(s * F * 2, e * F * 2));
}
