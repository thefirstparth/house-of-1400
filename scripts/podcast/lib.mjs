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
  // (26 Nov 2026 audit) an HTML entity from a feed ("S&amp;P") is the character it stands for, never "and amp"
  let s = String(text || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
  // (26 Nov 2026) the list's words are matched at letter edges, so a name ending in an accent (Mbappé) is found too
  for (const [w, say] of Object.entries(pronounce)) s = s.replace(new RegExp(`(?<![\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "gu"), say);
  // a cricket total as it is said: "720/9 dec" is "seven hundred and twenty for nine declared"
  // (after a team's name or "&", at most ten wickets: "26/11" and "24/7" stay as they are)
  s = s.replace(/((?:\b[A-Z][a-z]+|&) )(\d{2,3})\/(10|\d)\b(\s?dec(?:lared)?\b)?/g, (_, pre, r, w, d) => `${pre}${r} for ${w}${d ? " declared" : ""}`);
  s = s.replace(/<[^>]*>/g, m => (/^<(short pause|long pause|pause|laugh|sigh|breath|chuckle)>$/i.test(m) ? m : ""));
  s = s.replace(/\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(trillion|billion|million|bn|m))?\b/gi, (_, n, u) => `${numWords(n)}${u ? " " + ({ bn: "billion", m: "million" }[u.toLowerCase()] || u.toLowerCase()) : ""} dollars`);
  s = s.replace(/(?:₹|Rs\.?\s?|INR\s?)(\d[\d,]*(?:\.\d+)?)(?:\s?(lakh crore|crore|lakh|thousand))?/gi, (_, n, u) => `${numWords(n)}${u ? " " + u.toLowerCase() : ""} rupees`);
  s = s.replace(/(\d+)\s?[–-]\s?(\d+)(?=\s|[,.;!?]|$)/g, (_, a, b) => `${numWords(a)}-${numWords(b)}`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s?%/g, (_, n) => `${numWords(n)} per cent`);
  s = s.replace(/(\d+)(st|nd|rd|th)\b/g, (_, n) => ordinal(Number(n)));
  s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => { const H = Number(h), h12 = H % 12 || 12; return `${intWords(h12)}${m === "00" ? "" : " " + (m[0] === "0" ? "oh " + ONES[Number(m[1])] : intWords(Number(m)))} ${H < 12 ? "a m" : "p m"}`; });
  s = s.replace(/(\d)\/(\d)/g, "$1 $2"); // "26/11" is "twenty-six eleven", "24/7" "twenty-four seven"
  s = s.replace(/\d(?:\d|,(?=\d))*(?:\.\d+)?/g, n => numWords(n)); // (a comma after a number is punctuation: "on 26/11, ...")
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
  // a follow weighted up for the show (config podcast.weights; Parth, 14 Oct: "7% more importance to Real Madrid"): its
  // stories rank that much higher for a back-and-forth and a place in the show, and the writer gets that much more of them
  // (by the paper's section, or the exact words in the kicker or headline: "Real Madrid", never Atlético). A desk's
  // weight works on its share of the show instead (below), so it is not counted here.
  const weight = s => (P.weights || []).filter(x => !x.desk).reduce((w, x) => ((x.section && s.section === x.section) || (x.words && new RegExp(`\\b${x.words}\\b`, "i").test(`${s.kicker || ""} ${s.headline || ""}`)) ? w * (x.factor || 1) : w), 1);
  const score = s => ((imp[s.id] ?? 1) + (front.has(s.id) ? 0.5 : 0) + (s.short ? 0.25 : 0)) * weight(s);
  const ranked = rest.map((x, i) => ({ x, i })).sort((a, b) => score(b.x) - score(a.x) || a.i - b.i).map(r => r.x);
  // Page One first, as the paper (Parth, 13 Oct): the lead, then the front page's stories in the paper's order (each a
  // real back-and-forth) and its briefs; then the desks with everything else, the strongest few as back-and-forths
  // (at least two, and at least one from Sport if the front page has none), the rest in a line or two.
  const seconds = (E.front?.seconds || []).filter(x => x?.headline && x.id !== lead?.id), fbriefs = (E.front?.briefs || []).filter(x => x?.headline && x.id !== lead?.id);
  const onFront = new Set([lead?.id, ...seconds.map(x => x.id), ...fbriefs.map(x => x.id)]), others = ranked.filter(x => !onFront.has(x.id));
  const deep = others.slice(0, Math.max(2, (P.deep_max || 6) - 1 - seconds.length));
  if (![lead, ...seconds, ...deep].some(x => x && desk(x).id === "sport")) { const sp = others.find(x => desk(x).id === "sport"); if (sp && !deep.includes(sp)) deep.splice(Math.max(0, deep.length - 1), 1, sp); }
  // The quick items (16 Oct: chosen by importance alone, the paper's order breaking ties, so News took every tie and
  // whole desks fell out: no Bengaluru, Prayagraj or Ranchi story since 13 Oct, one Sport story on 16 Oct). Now each
  // desk with a story left gets a where first, and so do Bengaluru, Prayagraj and Ranchi each (Back Home's two cities by
  // the kicker); then the rest go by importance, a tie to the desk with the smallest share of its stories in the show so far (a
  // desk with six stories in the paper gets more than one with two), then the paper's order. A desk's weight (Sport's
  // 1.2) then works as before, below.
  // A place is a story of the desk's own, in its own part of the show (20 Oct audit: the lead, India and New Zealand's
  // trade deal, was Money's, so Money's place counted as used and Brent above $110 had to win a tie): the lead and the
  // rest of Page One are told on Page One and use up no desk's place, so Money, News and Tech each still get one.
  const deepIds = new Set(deep.map(x => x.id)), D = s => desk(s).id, where = s => (s.section === "back" ? `back:${String(s.kicker || "").split(/\s*·\s*/)[0]}` : s.section === "namma" ? "namma" : D(s));
  const byDesk = {}, byPlace = new Set(), size = {};
  for (const x of list) size[D(x)] = (size[D(x)] || 0) + 1;
  for (const x of [lead, ...seconds, ...fbriefs, ...deep].filter(Boolean)) byDesk[D(x)] = (byDesk[D(x)] || 0) + 1;
  for (const x of deep) byPlace.add(where(x));
  const pool = others.filter(x => !deepIds.has(x.id)), order = new Map(pool.map((x, i) => [x.id, i])), quick = [], Q = P.quick_max || 18;
  const take = x => { quick.push(x); byDesk[D(x)] = (byDesk[D(x)] || 0) + 1; byPlace.add(where(x)); };
  // (26 Nov 2026 audit: Tech and AI ran with no AI story on 24 and 25 Nov) the Tech and AI desk's place goes to an AI
  // story first, when the paper has one and none is in the show yet
  const aiIn = [lead, ...seconds, ...fbriefs, ...deep].some(x => x?.section === "ai"), firstAi = aiIn ? null : pool.find(x => x.section === "ai");
  if (firstAi && !byPlace.has(where(firstAi)) && quick.length < Q) take(firstAi);
  for (const x of pool) if (!byPlace.has(where(x)) && quick.length < Q) take(x);
  while (quick.length < Q) {
    const left = pool.filter(x => !quick.includes(x)); if (!left.length) break;
    left.sort((x, y) => score(y) - score(x) || (byDesk[D(x)] || 0) / size[D(x)] - (byDesk[D(y)] || 0) / size[D(y)] || order.get(x.id) - order.get(y.id));
    take(left[0]);
  }
  quick.sort((x, y) => order.get(x.id) - order.get(y.id));
  // a where's only story of its own in the show (Page One not counted, as above) is never swapped out for a weighted
  // desk's (below; 20 Oct: Sport's 1.2 took out Brent above $110, Money's only story beside the lead)
  const firstOf = new Set(quick.filter(x => [...deep, ...quick].filter(y => where(y) === where(x)).length === 1));
  if (firstAi && quick.includes(firstAi)) firstOf.add(firstAi); // the AI story keeps its place too
  // A desk weighted up (config podcast.weights {desk, factor}; Parth, 14 Oct: Sport "1.2x or 20% higher than current,
  // but not forcefully"): the desk gets that many more places than the paper's own order gave it, rounded (four Sport
  // items become five), filled with its next-best stories in place of the weakest quick items from other desks. Never
  // more than its stories that are left: nothing is padded. (A weight on the score itself flipped every tie, the scores
  // being whole numbers, and turned four Sport items into nine on 14 Oct.)
  for (const x of (P.weights || []).filter(x => x.desk && x.factor > 1)) {
    const inShow = [lead, ...seconds, ...fbriefs, ...deep, ...quick].filter(Boolean), mine = s => desk(s).id === x.desk;
    const k = inShow.filter(mine).length, target = Math.round(k * x.factor), spare = others.filter(s => mine(s) && !inShow.includes(s));
    for (let n = k; n < target && spare.length; n++) {
      const out = [...quick].reverse().find(s => !mine(s) && !firstOf.has(s)); if (!out) break; // never a desk's only story
      quick.splice(quick.indexOf(out), 1, spare.shift());
    }
  }
  // (26 Nov 2026 audit: the UK-EU deal, the Seattle arrests, the SP-Congress seats and the rupee's eight-month high were
  // left out) every story the paper rates 2 or more is in the show, as a quick item if there is no other room
  for (const s of others) if ((imp[s.id] ?? 1) >= 2 && !deepIds.has(s.id) && !quick.includes(s)) { quick.push(s); quick.sort((x, y) => (order.get(x.id) ?? 1e9) - (order.get(y.id) ?? 1e9)); }
  const must = s => (imp[s.id] ?? 1) >= 2;
  const item = (s, depth) => ({ id: s.id, ...(must(s) ? { must: true } : {}), desk: desk(s).name, section: nameOf[s.section] || null, kicker: s.kicker || null, headline: sayTimes(s.headline), tone: ["good", "bad", "mixed"].includes(s.tone) ? s.tone : "neutral", depth, text: sayTimes(cut(storyText(s), Math.round((depth === "quick" ? 360 : 850) * weight(s)))), why: sayTimes(s.why?.text) || null });
  const snap = E.snapshot || {}, ok = k => (snap[k]?.value && !snap[k]?.error ? snap[k].value : null);
  const idx = ok("markets")?.indices || [], fx = ok("fx"), gold = ok("gold_in");
  // The money figures as a listener needs them (Parth, 13 Oct: "if Sensex is up 0.7%, I don't know what that means"): the
  // move today, the week and month, and where it sits in its range, from the same figures the Ledger board prints
  const markets = [], pc = x => (Math.abs(x) < 0.05 ? "flat" : `${x >= 0 ? "up" : "down"} ${Math.abs(x).toFixed(1)}%`), n0 = x => Math.round(x).toLocaleString("en-IN");
  // a level as the ear takes it, three figures (Parth, 19 Oct: "one lakh forty-six thousand four hundred and ten rupees"
  // read in full was hard to follow): 73,804 is "about 73,800", ₹1,46,410 "about ₹1,46,000"
  const ear = x => { if (Math.abs(x) < 1000) return n0(x); const k = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 2); return `about ${(Math.round(x / k) * k).toLocaleString("en-IN")}`; };
  // where it sits, in words only (Parth, 14 Oct: "between its low of twenty-two thousand two hundred and thirty-two and
  // high of twenty-four thousand seven hundred and seventy-four" was too much): near a three-month low or high, else nothing
  const place = (v, lo, hi, span) => { if (!(hi > lo)) return ""; const f = (v - lo) / (hi - lo); return f <= 0.001 ? `, at its lowest in ${span}` : f >= 0.999 ? `, at its highest in ${span}` : f <= 0.15 ? `, close to its lowest in ${span}` : f >= 0.85 ? `, close to its highest in ${span}` : ""; };
  // The Indian figures are the paper's, from about two o'clock, and the market closes at half past three (14 Oct: the
  // hosts said the Sensex "finished" and the Nifty "closed" an hour before either did)
  // which indices the show gives (config podcast.indices; Parth, 14 Oct: "Keep Sensex and Nasdaq only")
  const shown = P.indices || ["Sensex", "Nifty 50", "Nasdaq-100"];
  let open_now = null;
  for (const name of shown.filter(n => !/nasdaq/i.test(n))) {
    const i = idx.find(x => x.name === name); if (!(i && Number.isFinite(i.price))) continue;
    const live = i.live && i.session_date === E.date;
    if (live && i.market_time) open_now ||= new Date(Date.parse(i.market_time) + IST).toISOString().slice(11, 16);
    const day = i.session_date && i.session_date !== E.date ? `at the last close (${i.session_date})` : live ? "so far today" : "today";
    markets.push(`${name} at ${ear(i.price)}, ${pc(i.change_pct)} ${day}${Number.isFinite(i.chg_7d) ? `, ${pc(i.chg_7d)} over the past week` : ""}${Number.isFinite(i.chg_1m) ? `, ${pc(i.chg_1m)} over the past month` : ""}${place(i.price, i.lo3m, i.hi3m, "three months")}`);
  }
  // the Nasdaq-100 (Parth, 14 Oct): New York trades while India sleeps, so its figure is the last close: overnight for
  // us only when New York traded the day before the paper's date; after a weekend or a US holiday it is that day's close
  // (19 Oct: on a Monday the hosts said "overnight in New York" of Friday's close)
  const ndx = shown.some(n => /nasdaq/i.test(n)) ? idx.find(x => /nasdaq/i.test(x.name)) : null;
  if (ndx && Number.isFinite(ndx.price)) {
    const wd = ndx.session_date ? new Date(`${ndx.session_date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }) : null;
    const gap = ndx.session_date ? Math.round((Date.parse(`${E.date}T12:00:00Z`) - Date.parse(`${ndx.session_date}T12:00:00Z`)) / 864e5) : null;
    const when = !wd ? "" : gap === 1 ? ` (${wd} in New York, overnight for us)` : ` (${wd}'s close in New York; New York has not traded since, so it is NOT overnight: say "on ${wd}" or "at ${wd}'s close")`;
    markets.push(`the Nasdaq-100, New York's big technology index, at ${ear(ndx.price)}, ${pc(ndx.change_pct)} at its last close${when}${Number.isFinite(ndx.chg_7d) ? `, ${pc(ndx.chg_7d)} over the past week` : ""}${Number.isFinite(ndx.chg_1m) ? `, ${pc(ndx.chg_1m)} over the past month` : ""}`);
  }
  // after yesterday's paper (from 15 Oct): a big move between yesterday's two o'clock figure and the close, with the
  // paper's reason (checks.after_close); make.mjs finds the moves (lib/after-close.js)
  const after_close = (paper.after_close?.moves || []).filter(m => shown.includes(m.name)).map(m => `${m.name === "Nifty 50" ? "the Nifty" : `the ${m.name}`} closed yesterday at ${n0(m.close)}, ${Math.abs(m.points)} points ${m.points > 0 ? "above" : "below"} the two o'clock figure in yesterday's paper${m.day_pct != null ? `, ${pc(m.day_pct)} on the day` : ""}`);
  if (after_close.length && paper.after_close?.why) after_close.push(`why: ${paper.after_close.why}`);
  // (26 Nov 2026 audit) the rupee: on a weekend its figure is Friday's, never "today"; and when the paper has a rupee
  // story the live line gives the level only, so its own change and range never contradict the story's
  const rupeeStory = [...deep, ...quick, ...seconds, ...fbriefs].some(x => x && desk(x).id === "money" && /\brupee\b/i.test(`${x.headline} ${x.short || x.text || ""}`));
  if (Number.isFinite(fx?.price)) {
    const fxDay = fx.session_date && fx.session_date !== E.date ? `at the last close (${new Date(`${fx.session_date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })})` : "today";
    markets.push(rupeeStory ? `the rupee at ${fx.price.toFixed(2)} to the dollar (its story is in Money: tell them together, with the story's own figures for the move)` : `the rupee at ${fx.price.toFixed(2)} to the dollar, ${Math.abs(fx.change_pct) < 0.05 ? "flat" : `${fx.change_pct <= 0 ? "stronger" : "weaker"} by ${Math.abs(fx.change_pct).toFixed(1)}%`} ${fxDay}${fx.note ? ` (${fx.note})` : ""}`);
  }
  if (Number.isFinite(gold?.per_10g_24k)) {
    const g = gold, d = x => x ? new Date(x.replace(/^(\d\d)\/(\d\d)\/(\d{4})$/, "$3-$2-$1") + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : "";
    const months = g.range_from ? Math.max(1, Math.round((Date.parse(`${E.date}T12:00:00Z`) - Date.parse(`${g.range_from}T12:00:00Z`)) / (30.4 * 864e5))) : 3;
    markets.push(`24-carat gold at ${ear(g.per_10g_24k).replace(/^about /, "about ₹")} for ten grams, ${Number.isFinite(g.change_pct) ? `${pc(g.change_pct)} since the last rate${g.prev_date ? ` (${d(g.prev_date)})` : ""}` : ""}${Number.isFinite(g.change_7d_pct) ? `, ${pc(g.change_7d_pct)} over the past week` : ""}${Number.isFinite(g.change_1m_pct) ? `, ${pc(g.change_1m_pct)} over the past month` : ""}${g.hi && g.lo ? place(g.per_10g_24k, g.lo, g.hi, `${months} months`) : ""}`);
  }
  const market_notes = Object.entries(E.sections?.ledger?.data?.notes || {}).filter(([k]) => shown.includes(k) || !/^(Sensex|Nifty 50)$/.test(k)).map(([k, v]) => `${k}: ${v}`).slice(0, 6);
  const NAMES = { madrid: "Real Madrid", india_cricket: "India (cricket)", f1: "Formula One" }, results = [], next = [], ahead = [];
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
    // the next five days (15 Oct: seven days of fixtures, three teams twice each, made Fixture Watch the longest
    // stretch of a 12-minute episode; a match six days out comes up again in the days before it)
    if (!(t > now - 18e5 && t < now + 5 * 864e5)) continue;
    const why = whys.find(([x]) => Math.abs(x - t) < 3 * 36e5)?.[1];
    next.push({ t, entity: f.entity, text: `${f.label}, ${f.time_tbc ? `${sayDay(new Date(t + IST - 4 * 36e5).toISOString().slice(0, 10), now)}, time to be confirmed` : sayWhen(t, now)}${why ? ` (${why})` : ""}` });
    have.add(f.entity);
  }
  for (const [k, c] of Object.entries(E.chronology || {})) {
    const l = c?.last, n = c?.next, lt = Date.parse(l?.when_utc), nt = Date.parse(n?.when_utc);
    if (lt > now - 60 * 36e5 && lt <= now && !results.some(r => r.includes(l.label))) results.push(`${NAMES[k] || k}: ${l.label}${l.detail ? `, ${l.detail}` : ""} (${sayDay(new Date(lt + IST - 4 * 36e5).toISOString().slice(0, 10), now)}${new Date(lt + IST).getUTCHours() < 4 ? ", late at night" : ""})`);
    // a followed team with no Fixture List row in the window (nothing in seven days, or its live feed down): the paper's Next
    if (nt > now - 18e5 && !have.has(k)) next.push({ t: nt, entity: k, text: `${NAMES[k] || k} next: ${n.label}${n.detail ? `, ${n.detail.replace(/ · /g, ", ")}` : ""}, ${nt < now + 6 * 864e5 ? sayWhen(nt, now) : sayDay(new Date(nt + IST - 4 * 36e5).toISOString().slice(0, 10), now)}` });
  }
  for (const p of ok("tennis_players")?.players || []) { const l = p.last, t = Date.parse(l?.when_utc); if (l && t > now - 36 * 36e5 && t <= now) results.push(`${p.name}: ${l.won ? "beat" : "lost to"} ${l.opponent}, ${l.round}, ${l.event}`); }
  // a followed player's next tournament as the paper prints it from a report (from 14 Oct), when he has no match in a draw
  for (const p of E.tennis?.players || []) { const n = p.next_event; if (n?.text && !p.next_match && !(n.starts && n.starts < E.date)) next.push({ t: n.starts ? Date.parse(`${n.starts}T12:00:00+05:30`) : Infinity, entity: "tennis", text: `${p.name} next: ${sayTimes(n.text)}${n.source ? ` (reported by ${n.source})` : ""}` }); }
  // Fixture Watch is the matches that matter, not the whole list (Parth, 19 Oct: eight fixtures read as a list took 45
  // seconds): the soonest match of each follow in the order of config podcast.fixtures.order (the club, India, the
  // driver, the tennis players, the NBA team), at most podcast.fixtures.max of them, then told in time order
  const FX = P.fixtures || {}, fxOrder = FX.order || ["madrid", "india_cricket", "f1", "tennis", "nba"], rank = e => (fxOrder.includes(e) ? fxOrder.indexOf(e) : fxOrder.length);
  const firsts = [...new Set(next.map(x => x.entity))].map(e => next.filter(x => x.entity === e).sort((a, b) => a.t - b.t)[0]);
  // (26 Nov 2026 audit: Alcaraz's final that night was dropped as the fourth follow) anything starting before four in the
  // morning tonight is always in, whatever the order
  const tonight = Date.parse(new Date(now + IST + 864e5).toISOString().slice(0, 10) + "T04:00:00+05:30");
  const picked = firsts.sort((a, b) => rank(a.entity) - rank(b.entity)).slice(0, FX.max ?? 3);
  for (const x of next) if (x.t <= tonight && x.t > now - 18e5 && !picked.includes(x)) picked.push(x);
  const coming = picked.sort((a, b) => a.t - b.t).map(x => x.text);
  const city = ok("weather")?.cities?.[0], d0 = city?.daily?.[0];
  const weather = city && d0 ? `${city.name} today: top of ${Math.round(d0.max)} degrees${Number.isFinite(d0.min) ? `, low of ${Math.round(d0.min)}` : ""}, ${d0.rain_prob}% chance of rain` : null;
  const groups = {};
  for (const [s, depth] of [...deep.map(s => [s, "deep"]), ...quick.map(s => [s, "quick"])]) { const d = desk(s); (groups[d.id] ||= { desk: d.name, items: [] }).items.push(item(s, depth)); }
  for (const g of Object.values(groups)) g.items.sort((a, b) => (a.depth === b.depth ? 0 : a.depth === "deep" ? -1 : 1));
  const named = id => (paper.desks || []).find(d => d.id === id)?.name || { home: "Close to Home", money: "Money", sport: "Sport" }[id];
  if (markets.length) Object.assign(groups.money ||= { desk: named("money"), items: [] }, { markets, ...(open_now ? { market_open: `the Indian figures are from ${open_now} IST, with the market still open until 15:30` } : {}), ...(after_close.length ? { after_close } : {}), ...(market_notes.length ? { market_notes } : {}) });
  // Where the follows stand (Parth, 14 Oct: Sport 20% more, "not just stories but also scores"): the club's league
  // place, the driver's championship place and India's series score, from the paper's own snapshot and Crease rows, so
  // the extra Sport time says what a result means. (A longer results window was tried: it brought Sunday's results back
  // on Wednesday, already told on Monday.)
  const standings = [], ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
  const club = paper.follows?.football_club?.name, table = ok("laliga_table")?.rows || [], me = table.find(r => r.team === club), top = table[0];
  if (me && top) standings.push(`${club}: ${ord(me.rank)} in La Liga on ${me.points} points after ${me.played} games${me.rank === 1 ? `, ${me.points - (table[1]?.points ?? me.points)} clear at the top` : `, ${top.points - me.points} behind the leaders ${top.team} (on ${top.points})`}`);
  // (26 Nov 2026 audit: on 22 Nov the table was from before the Las Vegas race the paper reported) when the paper's last
  // race is later than the live results feed's, the live table has not caught up: it is left out
  const f1Last = Date.parse(E.chronology?.f1?.last?.when_utc || E.chronology?.max?.last?.when_utc), feedLast = Date.parse(ok("f1_last")?.date);
  const f1Stale = Number.isFinite(f1Last) && Number.isFinite(feedLast) && f1Last > feedLast + 3 * 36e5;
  const drv = paper.follows?.f1_driver?.name, ds = f1Stale ? [] : ok("f1_standings")?.drivers || [], dv = ds.find(d => d.name === drv), d1 = ds[0];
  if (dv && d1) standings.push(`${drv}: ${ord(dv.pos)} in the drivers' championship on ${dv.points} points${dv.pos === 1 ? `, ${dv.points - (ds[1]?.points ?? dv.points)} ahead` : `, ${d1.points - dv.points} behind the leader ${d1.shown || d1.name}`}`);
  for (const r of E.sections?.crease?.data?.rows || []) if (/\b(lead|leads|level|won|lost|drawn)\b/i.test(r.text || "")) standings.push(`India's cricket, ${r.label}: ${sayTimes(String(r.text).replace(/ · /g, ", "))}`);
  if (results.length || coming.length || standings.length) Object.assign(groups.sport ||= { desk: named("sport"), items: [] }, { results, coming, ...(standings.length ? { standings } : {}) });
  if (weather) (groups.home ||= { desk: named("home"), items: [] }).weather = weather;
  if (ahead.length) groups.week = { desk: "The Week Ahead", items: [], coming: ahead };
  const page1 = [...seconds.map(x => item(x, "deep")), ...fbriefs.map(x => item(x, "quick"))];
  const segments = [...(page1.length ? [{ desk: "Page One", items: page1 }] : []), ...[...ORDER, ...Object.keys(groups).filter(k => !ORDER.includes(k))].filter(k => groups[k]).map(k => groups[k])];
  return { date: E.date, day: longDate(E.date), editor: lastName(P.author || "T. A. Bhide"), lead: lead ? { ...item(lead, "deep"), desk: "Lead" } : null, segments, market_expects: marketsExpect(E, paper, P.betting_max ?? 1), house_note: E.house_note || null, editor_note: E.big_day ? E.editor_note || null : null };
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
  return `You write the script of "${P.title || "The House of 1400"}", a daily podcast made from one family's private afternoon newspaper. The family it is made for lives in Bengaluru, but the show is public (Apple Podcasts, Spotify): never name a listener or mention anyone's family. It must sound like two friends who have both read today's paper, talking it through over chai. It is NOT a news bulletin and NOT two people taking turns to read the paper.

HOSTS
- ${A.id} (${A.gender || "woman"}): ${A.about || ""}
- ${B.id} (${B.gender || "man"}): ${B.about || ""}
Both grew up in Allahabad (Prayagraj) and live in Bengaluru now: Bengaluru is "here", Prayagraj is "back home". Ranchi is NOT their home: a Ranchi story is "over in Ranchi" or "in Ranchi", never "back home". They speak natural Indian English, and now and then, where it comes naturally, a Hindi-belt word an Allahabadi would use ("arre", "haan", "bilkul", "ekdum", "yaar"): at most one every four or five turns, never a caricature, never in sad news.

THE SHOW, in this order, the way the paper is laid out (everything comes from the RUNDOWN below)
1. Open (first two turns): ${A.id} welcomes the listeners, names the show and gives the day, something like "Good afternoon, and welcome to ${P.title || "The House of 1400"}. It's ${R.day}, I'm ${A.id}..." and ${B.id} says hello too. Mention, lightly and in your own words, that this is ${R.editor}'s paper (the editor; say just "${R.editor}", never his initials), at the open or at the close.
2. The lead as a hook, and the two talk it through properly.
3. The front page's other stories in the order given, each a real back-and-forth, then its briefs briskly.
4. Then the desk segments in the order given. Items marked "deep" get a real back-and-forth of about 80 to 140 words: one host tells it, the other reacts and asks what a listener would ask (what does it mean for us, why now, who is this), answered from "why" and the text. Items marked "quick" get one or two sentences each; several quick ones can run together briskly. Mention every item.
5. Move from part to part the way two friends do, with a spoken bridge in your own words ("Right, money now...", "Something from here in Bengaluru...", "And in sport..."), never by reading out the paper's section names: never "On Page One today", "In News today", "In Money today", "In Close to Home", "In Tech and AI today", "the Betting Window" or "the House Note" (Parth, 26 Nov 2026: it sounded like reading the paper). The one name the show keeps is "Fixture Watch", said once as the coming matches begin. A Bengaluru story is "here"; a Prayagraj story is "back home in Prayagraj"; a Ranchi story is "over in Ranchi" (Ranchi is not the hosts' home). A story from Delhi or anywhere else is never "close to home" or "here". If a front-page story was about sport, the hosts can say there is more in sport later.
6. Sport gets real energy${(P.weights || []).some(x => x.desk === "sport" && x.factor > 1) ? `, and about ${Math.round(((P.weights.find(x => x.desk === "sport").factor) - 1) * 100)}% more airtime than you would naturally give it (its stories, the results, "standings", Fixture Watch and the betting line together): a line more on what a result means or where they stand, ONLY from the rundown, with the time taken from quick items elsewhere; on a quiet sport day it stays short, never padded. "standings", if given: weave each in once, where it gives a result or a coming match its meaning ("that keeps Madrid fourth, six behind Barcelona"), never as a list` : ""}: every sport item, the recent results (skip a result a story already covered; never give a result's clock time), and EVERY match in "coming" (Fixture Watch: two or three matches that matter, already chosen), even when no story covers it (say each day and time EXACTLY as written, e.g. "on Thursday at twelve thirty a m, late on Wednesday night"; match times must be precise). Share the fixtures out as a back-and-forth: never more than three matches in one turn.
7. Money: the listener hears these, so every figure needs its meaning. For each of the "markets" lines say the level (rounded), the move today, how the week or month went, and, only when its line says so, that it is close to a three-month high or low (in words; never read out a range). Numbers are welcome (Parth likes them), two at most in a turn, rounded the way people say them ("just above seventy-two and a half thousand", "down about three per cent this month"). Each market (${(P.indices || ["Sensex", "Nifty 50", "Nasdaq-100"]).map(n => `the ${n}`).join(", ")}, the rupee, gold) comes up in ONE place only, with ONE level, the one in its "markets" line: if a Money story is about the same market (say, the rupee firming), tell its story in that same moment and never give the level a second time.
   - Only the indices in the "markets" lines${(P.indices || []).includes("Nifty 50") ? "" : ": the Nifty 50 is not part of the show, so never give a Nifty figure"}.
   - "market_open", if given: the Indian markets are STILL OPEN as you speak. Say "so far today" or "as of two o'clock"; NEVER say the Sensex or Nifty closed, finished, ended or settled today.
   - "after_close", if given: yesterday, after the last paper went to press, an index moved a lot before the close. Tell it first, in the SAME turn as that index's figure, with its "why" ("Yesterday, after our paper, the Sensex shot up eleven hundred points by the close, after the Finance Minister said..."), then today's move.
   - Say each level as its line gives it: the levels are already rounded for the ear ("about seventy-three thousand eight hundred"). Never read a figure to the last rupee, paisa or cent.
   - At most two markets in one turn; pass Money back and forth like the rest of the show, never one long turn of figures.
   - The Nasdaq-100 is New York's: say when its figure is from exactly as its line does. "Overnight in New York" ONLY when its line says overnight; otherwise name the day ("at Friday's close in New York"), never "overnight" or "last night".
   - Why a market moved comes ONLY from "market_notes", "after_close" and the Money stories' own text and "why it matters". Never add a cause or an effect of your own.
8. "market_expects", if given: ONE sentence, wherever it fits best, that says plainly what the question is and what the betting markets expect ("the betting markets give Barcelona about a one-in-five chance of winning next year's Champions League"). Never a list of odds; if the question cannot be explained in a few words, leave it out.
9. Weather, if given: one everyday line ("warm, with a fair chance of rain later").
10. The Week Ahead, if given: a couple of quick lines on what is coming in the next few days.
11. Close: if the House Note has a joke or a wry line, retell just that in the hosts' own words with its punchline intact (never the stories again). If it is only a summary of the day's stories, do NOT read it and do not recap the show (Parth, 26 Nov 2026): close instead with one line on one thing worth watching tomorrow or in the next few days, from "coming" or The Week Ahead, and never a story already told. Then a short, warm goodbye whose very last line is the sign-off, word for word: "${P.signoff || `That's ${P.title || "The House of 1400"} for today.`}"

IT IS A RADIO SHOW, with the habits of one
- A time check in passing, early on, from "on_air" if given ("it's a little after two here in Bengaluru, and the chai's poured").
- The same shape every day: the open, the lead, the front page's stories, then the rest with natural spoken bridges, "Fixture Watch" for the coming matches, and the close.
${P.music === false ? "" : `- Mark the FIRST turn of each new part with "segment", one of: ${SEGMENTS.join(", ")}. A short musical sting plays just before that turn, so mark only real changes of part (about five to nine in an episode), never two in a row.
`}
FACTS (the listener trusts every word; 26 Nov 2026 audit)
- Every number, name, day and time comes from the rundown, said its way. Never work out a figure of your own (a difference, a total, an age, how long ago, how old something is) and never call anything the first, the biggest, the highest, a record or the worst unless the rundown says so.
- Keep comparisons the rundown's way round: a smaller figure never "beats" a bigger one.
- Keep every hedge: "reportedly", "allegedly", "at least", "about", "possibly", "expected", "a source said", "would have". A proposal is not done, a rejected draft never "said" anything, and an anonymous source is never "the government".
- Never connect people or things the rundown does not connect: a shared surname is not family, and two things in one story are not cause and effect unless the rundown says so.
- When someone resigns, returns, is freed, or a decision is reversed, say in one plain line why, from the rundown.
- Days and times only as the rundown gives them: "on Friday at three thirty a m, late on Thursday night" is Friday, never Thursday.
- A market figure from an earlier day is that day's ("on Friday"), never "today".

FUN: you have creative headroom in HOW things are said: banter between the two, a running joke, a playful line on the good news, the markets and the House Note. Never in WHAT is said: every fact, name, number, score, date and time stays exactly as in the rundown, and nothing is joked about near bad news.

HOW IT SOUNDS
- A real conversation: mix longer turns with plenty of quick reactions of two to eight words, each a natural response to exactly what was just said, in your own words (never reuse the example's lines).
- Both hosts tell the news. Share the telling roughly evenly (neither host above about three-fifths of the words): ${B.id} leads some stories and ${A.id} reacts and asks about them, not ${A.id} telling and ${B.id} asking all the way through. Six to ten genuine questions in all, from both hosts; most replies are reactions, opinions or the next fact, not another question.
- Real feeling that fits each story: delight at a win, shock and quiet sadness at deaths, worry about prices, amusement at the House Note. Never laugh or joke near bad news.
- Both hosts bring something to every big story: a fact, a view, a worry, a link to Bengaluru or back home. Never one host reading while the other only asks: no host asks more than two short questions in a row, and the same host never speaks twice in a row.
- A reaction responds to what was said; it never just echoes the other host's figure back ("Ninety-seven dollars!").
- Hindi words only as short reactions ("Arre!", "Haan.", "Bilkul."), never as the first word of a sentence that carries news.
- After any story with deaths or serious harm, the next line is a quiet, sober beat: never a cheerful word, and never straight into the weather, a joke or a light story.
- At most two figures in any one turn (match times apart): pass the numbers back and forth.
- Say each fact ONCE. The headline and the text repeat each other; never say the same fact twice.
- When an item's headline and its text seem to give a figure different meanings, the text is right: tell it the text's way.
- Never copy sentences from the rundown. Retell them the way people talk; contractions are good.
- Numbers are fine, two at most in a turn, rounded when the exact figure does not matter ("about thirty-two and a half thousand crore"). Never give the same figure twice, and never two different figures for the same thing.
- Times: say them exactly as the rundown writes them, the twelve-hour way with "a m" or "p m". Never the twenty-four-hour clock and never "IST".
- Never use these: "Turning to", "In other news", "Moving on", "Let's look at", "Let us look at", "Meanwhile", "Closer to home", "Stay tuned", "On the cricket field".
- Use only facts in the rundown. Never add a fact, name, number or quote. Short personal reactions are fine ("I'd love to see that").
- A host's question is answered ONLY with what the rundown says. Never answer "yes", "right there" or "exactly" to a detail the rundown does not state (which terminal, which app, which player); answer with what it does say instead. Best of all, ask questions the rundown can answer.
- Do not add descriptive details the rundown lacks, even small ones: a time of day ("that morning"), a kind of place ("commercial airport"), a size, a mood of a crowd. Colour comes from the hosts' reactions, never from new details.
- Round honestly: never round a number up past what it is. 0.7 per cent is "under one per cent" or "about three-quarters of a per cent", never "nearly one per cent"; "over three hundred" only when it is over three hundred.
- Never address the listeners by name; speak to them as "you" if at all.
- No talk about how the paper or the show is made, about sources or checking, or about anything being missing.
- Every number, score, time and date in words, the Indian way (lakh and crore). No digits, no symbols like ₹, %, $ or &.
- About ${W.target} words in total, and NEVER more than ${W.max} (at least ${W.min}): about ${Math.round(W.target / 150)} minutes on air. A budget that fits: the lead about one hundred and fifty words, each other back-and-forth story about eighty, each quick item ONE sentence, Money about one hundred and fifty, Fixture Watch about fifty. Long monologues are the usual way a script runs over: no turn over sixty words. Keep it tight: when it runs long, give quick items one line each rather than dropping the fixtures, the money or the close.
- "mood" sets the voice for that line; one of: ${moods}. Inline tags, sparingly: <laugh> (light moments only), <sigh>, <short pause>.

EXAMPLE OF THE SOUND ONLY (its facts are invented: never use them; this is the rhythm and feeling to aim for)
${EXAMPLE}

Return JSON only: {"turns":[{"speaker":"${A.id}"|"${B.id}","mood":"...","text":"..."${P.music === false ? "" : `,"segment":"(only on the first turn of a part)"`}}]}

RUNDOWN
${JSON.stringify(R, null, 1)}`;
}

// (27 Nov 2026: "a source said" is a hedge the paper keeps, and the bare word "source" threw out all three of the day's
// scripts; only talk about the show's own sources and checking counts)
const PROCESS = /\b(our sources?|the sources?|sourcing|sourced from|validator|edition file|the pool|pool story|rundown|script|prompt|we checked|second source|AI-generated|language model|generated)\b/i;
const NUMW = new Set([...ONES, ...TENS.filter(Boolean), "hundred", "thousand", "lakh", "crore", "million", "billion", "point", "per", "cent", "percent"]);
const words = t => String(t || "").replace(/<[^>]+>/g, " ").toLowerCase().replace(/[^a-z0-9' -]/g, " ").split(/[\s-]+/).filter(Boolean);
const numberRuns = t => { let n = 0, inRun = false, only = true; for (const w of words(t)) { if (NUMW.has(w) || (inRun && w === "and")) { if (!inRun) { inRun = true; only = true; } if (w !== "one" && w !== "and") only = false; } else { if (inRun && !only) n++; inRun = false; } } if (inRun && !only) n++; return n; };
const shingles = (ws, k) => { const out = []; for (let i = 0; i + k <= ws.length; i++) out.push(ws.slice(i, i + k).join(" ")); return out; };
const BANNED = /\b(turning to|in other news|moving on|let'?s look at|let us look at|meanwhile|closer to home|stay tuned|on the cricket field)\b/i;

// The checks before voicing. Each problem is { hard, msg }: a hard one means the script is never voiced; soft ones
// What a rewrite is told when the draft runs long (15 Oct: told only "2006 words (needs 1050 to 1550)", two rewrites came
// back at 2,070 and 1,913 words): how many words to cut and where they usually are, keeping what the show must carry.
export function cutNote(turns, P = {}) {
  const W = P.words || { target: 1150, max: 1400 }, n = (turns || []).reduce((a, t) => a + words(t?.text).length, 0);
  if (n <= W.max) return "";
  const long = (turns || []).map((t, i) => [i + 1, words(t?.text).length]).filter(([, k]) => k > 60).map(([i, k]) => `turn ${i} (${k})`);
  return `LENGTH: the script is ${n} words; bring it down to about ${W.target} (never over ${W.max}), cutting about ${n - W.target} words. Cut, in this order: quick items to ONE sentence each; ${long.length ? `the long turns (${long.slice(0, 8).join(", ")}) to under sixty words` : "any turn over sixty words"}; details in the back-and-forths a listener will not miss. Keep the lead, every fixture with its time, the money figures, the close and the goodbye.`;
}

// send it back for a rewrite, and after the last try the script with the fewest soft problems is voiced.
export function checkScript(turns, R, P = {}) {
  const W = P.words || { min: 1050, max: 1400 }, ids = new Set((P.hosts || [{ id: "Ashu" }, { id: "Tarun" }]).map(h => h.id)), out = [];
  // w: how much a soft problem counts when the best of several drafts is chosen (make.mjs); 26 Nov 2026: a figure the
  // paper does not give counts four times a stock phrase, but never stops a script on its own
  const hard = msg => out.push({ hard: true, msg }), soft = (msg, w = 1) => out.push({ hard: false, msg, w });
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
  for (const [name, re] of [["the rupee", /\brupee\b/i], ["the Sensex", /\bsensex\b/i], ["the Nifty", /\bnifty\b(?! it\b| bank\b| midcap| smallcap)/i], ["the Nasdaq", /\bnasdaq\b/i], ["gold", /\bgold\b/i]]) {
    // (gold's price, not a gold medal: 19 Oct, a shooter's gold counted as a second gold figure)
    const at = turns.map((t, i) => (re.test(t.text) && numberRuns(t.text) && (name !== "gold" || /\b(grams?|carat|rupees?|lakh)\b/i.test(t.text)) ? i : -1)).filter(i => i >= 0);
    if (at.length > 1) soft(`gives a figure for ${name} in ${at.length} turns (${at.map(i => i + 1).join(", ")}): say it once, in one turn`);
  }
  // money said right (14 Oct): an open market never "closed" today, and a reason only when the paper gives it
  const money = (R.segments || []).find(g => g.markets?.length);
  const sentences = t => String(t || "").replace(/<[^>]+>/g, " ").split(/(?<=[.!?])\s+/);
  const INDIA = /\b(sensex|nifty)\b/i, ENDED = /\b(closed|closing|finish(?:ed|ing)?|ended|ending|settled|at the close)\b/i, BEFORE = /\b(yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|last session|after (?:our|the|yesterday's) paper)\b/i;
  if (money && P.indices && !P.indices.includes("Nifty 50")) turns.forEach((t, i) => { if (/\bnifty\b(?! it\b| bank\b| midcap| smallcap)/i.test(t.text) && numberRuns(t.text)) soft(`turn ${i + 1}: gives a Nifty figure; the show gives only ${P.indices.join(" and ")}`); });
  if (money?.market_open) turns.forEach((t, i) => { const bad = sentences(t.text).find(x => INDIA.test(x) && ENDED.test(x) && !BEFORE.test(x)); if (bad) soft(`turn ${i + 1}: says an Indian index closed or finished today, but the market is still open until 3.30 ("${bad.slice(0, 80)}"); say "so far today" or "as of two o'clock"`); });
  if (money) {
    const stem = w => w.slice(0, 4), CAUSE = /\b(because|due to|thanks to|driven by|on the back of|weigh(?:ed|s|ing)?|dragg(?:ed|ing)|lift(?:ed|ing)|boost(?:ed|ing)?|slow(?:ed|ing|s)?|hurt(?:ing|s)?|push(?:ed|ing)|fuel(?:led|ling)?|spark(?:ed|ing)?|on hopes)\b/i;
    const MARKET = /\b(sensex|nifty|nasdaq|rupee|gold|dollar|today|week|month|points?|shares?|market|markets|index|indices)\b/i;
    const allowed = new Set(words([...(money.market_notes || []), ...(money.after_close || []), ...money.markets, ...money.items.flatMap(x => [x.headline, x.text, x.why])].join(" ")).filter(w => w.length >= 4).map(stem));
    turns.forEach((t, i) => {
      if (!/\b(sensex|nifty|nasdaq|rupee|gold)\b/i.test(t.text)) return;
      for (const x of sentences(t.text)) {
        if (!CAUSE.test(x)) continue;
        const cw = words(x).filter(w => w.length >= 4 && !/ly$/.test(w) && !NUMW.has(w) && !MARKET.test(w) && !CAUSE.test(w) && !/^(that|this|with|from|their|they|have|been|over|into|than|then|also|just|still|while|which|what|after|about|again|finally|really|actually|bilkul|arre|haan)$/.test(w));
        if (cw.length >= 2 && cw.filter(w => allowed.has(stem(w))).length * 3 < cw.length) soft(`turn ${i + 1}: gives a reason for a market move that the paper does not ("${x.slice(0, 90)}"); give only the paper's reasons`);
      }
    });
  }
  // 19 Oct audit: "overnight in New York" of Friday's close on a Monday; three markets read out in one 64-word turn
  if (money && !money.markets.some(m => /nasdaq/i.test(m) && /overnight for us/.test(m))) turns.forEach((t, i) => { const bad = sentences(t.text).find(x => /\b(overnight|last night)\b/i.test(x) && /\b(nasdaq|wall street|new york|us markets?|american markets?)\b/i.test(x)); if (bad) soft(`turn ${i + 1}: calls New York's figure "overnight", but its last close was not last night ("${bad.slice(0, 80)}"); name the day, as its Money line does`); });
  if (money) turns.forEach((t, i) => { const k = [/\bsensex\b/i, /\bnifty\b/i, /\bnasdaq\b/i, /\brupee\b/i, /\bgold\b/i, /\b(brent|crude|oil)\b/i, /\bbitcoin\b/i].filter(re => re.test(t.text)).length; if (k > 2 && numberRuns(t.text) > 2) soft(`turn ${i + 1}: reads out ${k} markets in one turn; at most two, passed back and forth`); });
  turns.forEach((t, i) => { const k = words(t.text).length; if (k > 60) soft(`turn ${i + 1}: ${k} words; no turn over sixty`); });
  // 19 Oct: "Page One" five times, twice inside a question; one host did two-thirds of the telling and the other asked
  // eighteen of his thirty turns
  const p1 = turns.filter(t => /\bpage one\b/i.test(t.text)).length;
  if (p1 > 2) soft(`says "Page One" in ${p1} turns: once, as the front page begins`);
  turns.forEach((t, i) => { if (sentences(t.text).some(x => /\?/.test(x) && /\bon page one\b/i.test(x))) soft(`turn ${i + 1}: puts "Page One" inside a question; name the segment once, as it begins`); });
  const share = {}, asks = {};
  for (const t of turns) { share[t.speaker] = (share[t.speaker] || 0) + words(t.text).length; if (/\?/.test(t.text)) asks[t.speaker] = (asks[t.speaker] || 0) + 1; }
  for (const [who, w] of Object.entries(share)) if (n && w / n > 0.62) soft(`${who} has ${Math.round((w / n) * 100)}% of the words; share the telling (neither host above about three-fifths)`);
  for (const [who, q] of Object.entries(asks)) if (q > 10) soft(`${who} asks ${q} questions; six to ten in all from both hosts, the rest reactions and opinions`);
  if (P.signoff) { const norm = x => words(x).join(" "); if (!norm(turns.at(-1)?.text).includes(norm(P.signoff))) soft(`the last line is not the sign-off, word for word: "${P.signoff}"`); }
  const marks = turns.filter(t => t.segment).length;
  if (P.music !== false && marks < 4) soft(`only ${marks} turns carry a "segment" mark (needs one on the first turn of each part, five or more)`);
  turns.forEach((t, i) => { if (t.segment && !SEGMENTS.includes(t.segment)) soft(`turn ${i + 1}: unknown segment "${t.segment}" (use one of ${SEGMENTS.join(", ")})`); });
  const title = String(P.title || "The House of 1400").toLowerCase().replace("1400", "(1400|fourteen hundred)");
  const named = t => new RegExp(title.replace(/^the /, "")).test(String(t?.text || "").toLowerCase());
  if (!turns.slice(0, 2).some(named)) soft(`the opening does not name the show ("${P.title || "The House of 1400"}") in the first two turns`);
  if (!turns.slice(-3).some(named)) soft(`the goodbye does not name the show`);
  turns.forEach((t, i) => { if (/\bParth\b/i.test(t.text)) soft(`turn ${i + 1}: addresses the listener by name`); });
  // the show is public (15 Oct rehearsal: "hello to your wife listening in with us"): never a listener's family
  turns.forEach((t, i) => { if (/\byour (wife|husband|dad|father|mum|mom|mother|family|parents)\b/i.test(t.text)) soft(`turn ${i + 1}: mentions the listener's family; the show is public, so never`); });
  // "back home" is only Ranchi or Prayagraj (14 Oct: the Bihar boat accident, national news, was called "back home in Bihar")
  // (26 Nov 2026) and Ranchi is not the hosts' home either: "over in Ranchi"
  turns.forEach((t, i) => {
    if (!/\bback home\b/i.test(t.text)) return;
    if (/\b(Ranchi|Jharkhand)\b/i.test(t.text) && !/\b(Prayagraj|Allahabad)\b/i.test(t.text)) soft(`turn ${i + 1}: says "back home" of Ranchi; the hosts are from Allahabad, so say "over in Ranchi"`, 2);
    else if (!/\b(Prayagraj|Allahabad|Ranchi|Jharkhand)\b/i.test(t.text)) soft(`turn ${i + 1}: says "back home" for somewhere that is not Prayagraj; only Prayagraj is back home`);
  });
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
  // (20 Oct: the Sensex down 1.2% and the Nasdaq up 1.2% are two facts: a run with a figure in it, repeated in turns that
  // name different markets, is not a repeat)
  const MKTS = [/\bsensex\b/i, /\bnifty\b/i, /\b(nasdaq|new york|wall street)\b/i, /\brupee\b/i, /\bgold\b/i, /\b(brent|crude|oil)\b/i, /\bbitcoin\b/i];
  const mkts = t => MKTS.map((re, k) => (re.test(t) ? k : -1)).filter(k => k >= 0), apart = (a, b) => { const x = mkts(turns[a].text), y = mkts(turns[b].text); return x.length && y.length && !x.some(k => y.includes(k)); };
  const seenAt = new Map(), twice = [];
  turns.forEach((t, i) => { for (const s of new Set(shingles(words(t.text), 6))) { if (seenAt.has(s) && seenAt.get(s) !== i) { if (!(s.split(" ").some(w => NUMW.has(w)) && apart(seenAt.get(s), i))) twice.push(s); } else seenAt.set(s, i); } });
  if (twice.length) soft(`says the same thing twice: "${twice[0]}"`);
  // the example's own lines reused (Flash Lite dropped "Thirteen. That's terrible." into the money news, 13 Oct test)
  const ex = new Set(shingles(words(EXAMPLE.replace(/^\w+ \[[^\]]+\]: /gm, "")), 4));
  const reused = turns.map((t, i) => [i, shingles(words(t.text), 4).find(s => ex.has(s))]).filter(x => x[1]);
  if (reused.length) soft(`reuses the example's lines in turn ${reused[0][0] + 1}: "${reused[0][1]}"`);
  // (20 Oct: "back to Earth in twenty thirty-one" is a year, not 20:30: a year runs on into "-one", or follows "in", "by",
  // "since", a month and the like)
  const H24 = /\b(i s t|ist|(?<!\b(?:in|by|since|until|till|from|of|before|after|year|the|january|february|march|april|may|june|july|august|september|october|november|december) )(thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty-one|twenty-two|twenty-three) (hundred|oh [a-z]+|fifteen|thirty|forty-five)(?![-a-z])( hours)?)\b/i;
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
  // (a fault in these checks never costs the day its script: they are skipped, the older checks still run)
  try { for (const c of auditChecks(turns, R, P)) soft(c.msg, c.w); } catch (e) { console.log("podcast: the audit checks failed and were skipped:", e.message); }
  return out;
}

// The 26 Nov 2026 audit's checks (seven episodes, 20-26 Nov: two or three bent facts a day, one host reading while the
// other prompted, the paper's section names read aloud): each a soft problem with a weight, so a draft that breaks them
// is sent back and loses to one that does not, but a script is never thrown away for them alone.
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
const SCALE = { hundred: 100, thousand: 1e3, lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7, million: 1e6, billion: 1e9, trillion: 1e12, bn: 1e9, cr: 1e7, k: 1e3 };
const ONEV = Object.fromEntries(ONES.map((w, i) => [w, i])), TENV = Object.fromEntries(TENS.map((w, i) => [w, i * 10]).filter(([w]) => w));
const QUAL = [["about", "~"], ["around", "~"], ["roughly", "~"], ["nearly", "~"], ["almost", "~"], ["close to", "~"], ["some", "~"], ["approximately", "~"], ["just under", "<"], ["just over", ">"], ["just above", ">"], ["just below", "<"], ["over", ">"], ["more than", ">"], ["above", ">"], ["at least", ">"], ["upwards of", ">"], ["under", "<"], ["below", "<"], ["less than", "<"], ["fewer than", "<"], ["up to", "<"]];
// The figures a text gives: { v, raw, q (qualifier: ~ < > or ""), pct, at (token index) }. A run of number words that is a
// time, a year or a score ("three thirty", "twenty twenty", "five-one") or an ordinal is skipped, as is a lone "a million".
export function figures(text) {
  const toks = String(text || "").replace(/<[^>]+>/g, " ").toLowerCase().replace(/(\d),(?=\d)/g, "$1").replace(/([a-z])(\d)/g, "$1 $2").replace(/[₹$]/g, " ").replace(/%/g, " per cent ").replace(/[^a-z0-9.\s'-]/g, " ").split(/[\s-]+/).map(t => t.replace(/^'+|'+$|\.$/g, "")).filter(Boolean);
  const word = t => t in ONEV || t in TENV || t in SCALE || t in ORD || t === "point", digit = t => /^\d+(\.\d+)?(bn|cr|k|m)?$/.test(t);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t0 = toks[i], back = toks.slice(Math.max(0, i - 2), i).join(" "), q = (QUAL.find(([w]) => back === w || back.endsWith(" " + w) || toks[i - 1] === w) || [])[1] || "";
    // digits (the paper's own form): "81.3bn", "1.2 crore", "92.45", "13.5%"
    if (digit(t0)) {
      const m = t0.match(/^(\d+(?:\.\d+)?)(bn|cr|k|m)?$/), v = Number(m[1]), sc = toks[i + 1] in SCALE ? toks[i + 1] : null, sc2 = sc && SCALE[toks[i + 2]] > SCALE[sc] ? toks[i + 2] : null;
      const unit = m[2] ? { bn: 1e9, cr: 1e7, k: 1e3, m: 1e6 }[m[2]] : sc ? SCALE[sc] * (sc2 ? SCALE[sc2] : 1) : 0, j = i + 1 + (sc ? 1 : 0) + (sc2 ? 1 : 0);
      const pct = (toks[j] === "per" && toks[j + 1] === "cent") || toks[j] === "percent";
      out.push({ v, raw: t0, q, pct, at: i }); if (unit) out.push({ v: v * unit, raw: `${t0}${sc ? " " + sc : ""}${sc2 ? " " + sc2 : ""}`, q, pct, at: i });
      i = j - 1; continue;
    }
    // number words: a run may start at a scale word only when a number follows ("a hundred and thirty")
    if (!word(t0) || t0 === "point" || (t0 in SCALE && !(word(toks[i + 1] || "") || (toks[i + 1] === "and" && word(toks[i + 2] || ""))))) continue;
    let j = i; const run = [];
    while (j < toks.length && (word(toks[j]) || (toks[j] === "and" && word(toks[j + 1] || "") && run.length))) run.push(toks[j++]);
    const raw = run.join(" "), pct = (toks[j] === "per" && toks[j + 1] === "cent") || toks[j] === "percent";
    i = j - 1;
    if (run.some(t => t in ORD) || /^(cents?|paise)$/.test(toks[j] || "")) continue;
    const r = run.filter(t => t !== "and");
    if (r.every(t => t in SCALE)) continue; // "a million", "hundreds of" are not figures
    let total = 0, cur = 0, dec = null, prev = null, multi = false, maxS = 0;
    for (const t of r) {
      if (t === "point") { dec = ""; prev = t; continue; }
      if (dec !== null && t in ONEV && ONEV[t] < 10) { dec += ONEV[t]; prev = "d"; continue; }
      if (dec !== null && t in TENV) { dec += String(TENV[t] / 10); prev = "d"; continue; } // "point ninety"
      if (t in SCALE) {
        const base = cur + (dec ? Number(`0.${dec}`) : 0); dec = null;
        if (t === "hundred") cur = (base || 1) * 100;
        else if (SCALE[t] > maxS && total) { total = (total + base) * SCALE[t]; cur = 0; maxS = SCALE[t]; } // "three lakh crore", "fifteen thousand five hundred crore"
        else { total += (base || 1) * SCALE[t]; cur = 0; maxS = Math.max(maxS, SCALE[t]); }
        prev = "s"; continue;
      }
      const v = t in TENV ? TENV[t] : ONEV[t];
      if (v === undefined) { multi = true; break; }
      // tens then a unit ("twenty five") is one number; any other two in a row without a scale word is a time, year or score
      if (prev && prev !== "s" && prev !== "point" && !(prev === "tens" && v < 10 && v > 0)) { if (!(prev === "s")) { multi = true; break; } }
      cur += v; prev = t in TENV ? "tens" : "unit";
    }
    if (multi) continue;
    const v = total + cur + (dec ? Number(`0.${dec}`) : 0);
    out.push({ v, raw, q, pct, at: i });
  }
  return out;
}
const WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export function auditChecks(turns, R, P = {}) {
  const out = [], add = (msg, w) => out.push({ msg, w });
  const ref = figures([JSON.stringify(R), P.title || "The House of 1400", "fourteen hundred", P.signoff || ""].join(" ")).map(f => f.v), near = v => ref.reduce((b, r) => (Math.abs(r - v) < Math.abs(b - v) ? r : b), Infinity);
  const ok = f => {
    if (f.q === ">") return ref.some(r => r >= f.v * 0.97 && r <= f.v * 3);
    if (f.q === "<") return ref.some(r => r <= f.v * 1.03 && r >= f.v / 3);
    const tol = f.q === "~" ? 0.12 : 0.03;
    return ref.some(r => Math.abs(r - f.v) <= Math.max(0.5, tol * Math.abs(r)));
  };
  // 1. every figure the script gives is the paper's (20 Nov: "up four hundred and sixty-two points" for a gain of about 990;
  // 22 Nov: "eight per cent this week" for 8.8)
  let bad = 0;
  turns.forEach((t, i) => { for (const f of figures(t.text)) if ((f.v >= 13 || f.pct) && !ok(f) && bad < 5) { bad++; const n = near(f.v); add(`turn ${i + 1}: "${f.raw}${f.pct ? " per cent" : ""}" is not a figure in the rundown${Number.isFinite(n) ? ` (the nearest it gives is ${+n.toFixed(2)})` : ""}; say the rundown's figure, or leave it out`, 4); } });
  // 2. a match's day as the rundown gives it (20 Nov: "the second Test is on Thursday" for Friday at three thirty a m)
  const today = String(R.day || "").split(/[ ,]/)[0].toLowerCase(), tomorrow = WEEK[(WEEK.indexOf(today) + 1) % 7];
  const STOP = new Set(["india", "formula", "one", "league", "champions", "grand", "prix", "test", "real", "next", "cricket", "the", "nitto", "finals", "today", "tomorrow", "late", "night", "tonight", ...WEEK]);
  const lines = (R.segments || []).filter(g => /sport/i.test(g.desk)).flatMap(g => [...(g.coming || []), ...(g.results || [])]);
  const keysOf = L => (L.split(/, (?:today|tomorrow|on \w+day)\b/)[0].match(/\b[A-Z][\p{L}'-]{3,}\b/gu) || []).filter(w => !STOP.has(w.toLowerCase()));
  const count = {}; for (const L of lines) for (const k of new Set(keysOf(L))) count[k] = (count[k] || 0) + 1;
  const sentences = t => String(t || "").replace(/<[^>]+>/g, " ").split(/(?<=[.!?])\s+/);
  turns.forEach((t, i) => { for (const x of sentences(t.text)) {
    const days = WEEK.filter(d => new RegExp(`\\b${d}\\b`, "i").test(x)); if (!days.length) continue;
    const hits = lines.filter(L => keysOf(L).filter(k => count[k] === 1).some(k => new RegExp(`\\b${k}\\b`, "i").test(x)));
    if (hits.length !== 1) continue; // a sentence about two matches is not judged
    for (const L of hits) {
      const allowed = new Set(WEEK.filter(d => new RegExp(`\\bon ${d}\\b(?! night)`, "i").test(L)).concat(/\btoday\b/.test(L) ? [today] : [], /\btomorrow\b(?! night)/.test(L) ? [tomorrow] : []));
      const nightOnly = WEEK.filter(d => new RegExp(`\\b${d} night\\b`, "i").test(L) && !allowed.has(d));
      // the day must follow the match's name closely ("...in Christchurch on Thursday"), not belong to another event in
      // the sentence ("an MRI on Thursday, but he plays Cobolli today")
      const keyAt = Math.min(...keysOf(L).filter(k => count[k] === 1).map(k => x.toLowerCase().search(new RegExp(`\\b${k.toLowerCase()}\\b`))).filter(n => n >= 0));
      const close = d => { const at = x.toLowerCase().indexOf(d, keyAt); return at > keyAt && x.slice(keyAt, at).split(/\s+/).length <= 9; };
      for (const d of days) if (close(d) && !allowed.has(d) && !(nightOnly.includes(d) && new RegExp(`\\b${d} night\\b|late on ${d}`, "i").test(x)) && (allowed.size || nightOnly.length)) add(`turn ${i + 1}: says "${d[0].toUpperCase() + d.slice(1)}" for ${L.split(",")[0]}; the rundown says "${(L.match(/(today|tomorrow|on \w+day)[^,(]*/) || [L])[0]}"`, 4);
    }
  } });
  // 3. the paper's hedge kept (25 Nov: a child "reportedly" died became a death; 23 Nov: "at least 258 seats" became "officially")
  const HEDGE = /\b(reportedly|allegedly|alleged|at least|unconfirmed)\b/i, SAID = /\b(reportedly|allegedly|alleged|accused|at least|over|more than|would have|said to|claims?|according to|reports?|says|said|unconfirmed|maybe|might)\b/i;
  const stories = [R.lead, ...(R.segments || []).flatMap(g => g.items || [])].filter(Boolean);
  for (const s of stories) {
    const h = String(s.text || "").match(HEDGE); if (!h) continue;
    const names = (String(s.headline).match(/\b[A-Z][\p{L}']{3,}\b/gu) || []).filter(w => !STOP.has(w.toLowerCase()));
    if (!names.length) continue;
    const at = turns.map((t, i) => (names.filter(n => new RegExp(`\\b${n}\\b`, "i").test(t.text)).length >= Math.min(2, names.length) ? i : -1)).filter(i => i >= 0);
    if (at.length && !at.some(i => SAID.test(turns[i].text) || SAID.test(turns[i + 1]?.text || ""))) add(`turn ${at[0] + 1}: tells "${s.headline}" without the paper's hedge ("${h[0]}")`, 2);
  }
  // 4. the stories the paper rates highly are all in (26 Nov audit: the UK-EU deal and the rupee's eight-month high left out)
  const all = turns.map(t => t.text).join(" ").toLowerCase();
  for (const s of stories.filter(x => x.must && x.depth === "quick")) {
    const names = (String(s.headline).match(/\b[A-Z][a-zA-Zé']{3,}\b/g) || []).filter(w => !STOP.has(w.toLowerCase()));
    if (names.length && !names.some(w => all.includes(w.toLowerCase().replace(/'s$/, "")))) add(`leaves out "${s.headline}" (the paper rates it highly: give it at least a line)`, 2);
  }
  // 5. a conversation, not a reading: no host twice in a row, no runs of prompting questions, no echoes
  const twice = turns.map((t, i) => (i && t.speaker === turns[i - 1].speaker ? i + 1 : 0)).filter(Boolean);
  if (twice.length) add(`the same host speaks twice in a row at turn${twice.length > 1 ? "s" : ""} ${twice.slice(0, 6).join(", ")}: merge them, or give the other host a line between`, Math.min(3, twice.length) * 2);
  const short = t => words(t.text).length <= 14 && /\?/.test(t.text);
  for (const sp of new Set(turns.map(t => t.speaker))) { const mine = turns.map((t, i) => [t, i]).filter(([t]) => t.speaker === sp); for (let k = 2; k < mine.length; k++) if ([0, 1, 2].every(d => short(mine[k - d][0]))) { add(`${sp} only asks short questions in turns ${mine.slice(k - 2, k + 1).map(([, i]) => i + 1).join(", ")}: let ${sp} bring a fact or a view of their own`, 2); break; } }
  const CONTENT = w => w.length >= 3 && !/^(the|and|that|this|what|wow|oh|yes|really|all|for|with|its|it's|was|are|now)$/.test(w);
  const echoes = turns.map((t, i) => { if (!i || words(t.text).length > 6 || !numberRuns(t.text)) return 0; const prev = new Set(words(turns[i - 1].text)), mine = words(t.text).filter(CONTENT); return mine.length && mine.every(w => prev.has(w)) ? i + 1 : 0; }).filter(Boolean);
  if (echoes.length >= 2) add(`turns ${echoes.slice(0, 5).join(", ")} only echo the other host's figure back; react to it instead`, 1);
  // 6. at most two figures in a turn (match times apart) (20-22 Nov: up to eight in one turn on markets)
  turns.forEach((t, i) => { const k = figures(t.text).filter(f => f.v >= 13 || f.pct).length; if (k > 2) add(`turn ${i + 1}: ${k} figures in one turn; at most two, passed back and forth`, 1); });
  // 7. Hindi words as reactions only (21 Nov: "Arre, Levent Alpöge, a mathematician there, says...")
  turns.forEach((t, i) => { const bad = sentences(t.text).find(x => /^(arre|haan|bilkul|ekdum|yaar)\b[,!.]?\s/i.test(x.trim()) && words(x).length > 9); if (bad) add(`turn ${i + 1}: opens a news sentence with a Hindi word ("${bad.slice(0, 50)}"); keep those for short reactions`, 1); });
  // 8. after deaths, a quiet beat (25 Nov: a child's death straight into the weather; 21 Nov: "Wonderful!" into liquor deaths)
  const DEATH = /\b(killed|kills|died|dies|dead|deaths?|death toll|murdered|drowned|lost their lives|killing)\b/i, CHEER = /\b(wonderful|brilliant|fantastic|amazing|great news|shabash|lovely|awesome|yay|what fun|weather|degrees)\b|<laugh>|<chuckle>/i;
  turns.forEach((t, i) => { if (i && DEATH.test(turns[i - 1].text) && CHEER.test(t.text)) add(`turn ${i + 1}: comes straight after a story with deaths with "${t.text.match(CHEER)[0]}"; give it a quiet, sober beat first`, 3); });
  // 9. the paper's section names are not read out (Parth, 26 Nov 2026); only "Fixture Watch" stays
  const SECT = /\b(on page one|in news today|in money today|in the money section|in close to home|on close to home|in tech and ai|betting window|house note)\b/i;
  turns.forEach((t, i) => { const m = String(t.text).match(SECT); if (m) add(`turn ${i + 1}: reads out the paper's section name ("${m[0]}"); use a spoken bridge instead`, 2); });
  return out;
}

// When the writer fails: a plain, correct conversation made by code from the rundown. (26 Nov 2026 audit: the old one
// was one host reading headlines and the other the paper's summary, no names, no "why", the section names read out and
// the markets in one breath.) Now: the hosts named, each big story told, then "why does it matter?" answered from the
// paper's own line, a spoken bridge into each part, one market or match a turn, never the same host twice in a row, and
// no House Note recap.
const BRIDGE = { "Page One": "Also on the front page:", News: "Elsewhere in the news:", "Close to Home": "From our part of the world:", Money: "On to money:", "Tech and AI": "From the tech world:", "Tech & AI": "From the tech world:", Sport: "And sport:", "Off Duty": "And something lighter:", "The Week Ahead": "Coming up in the next few days:" };
export function fallbackScript(R, P = {}) {
  const [A, B] = (P.hosts || [{ id: "Ashu" }, { id: "Tarun" }]).map(h => h.id), turns = [];
  const other = () => (turns.at(-1)?.speaker === A ? B : A);
  const say = (mood, text, speaker = other()) => { if (text) turns.push({ speaker, mood: mood || "neutral", text }); };
  const first = (s, k = 2) => String(s?.text || "").split(/(?<=[.!?])\s+/).slice(0, k).join(" ");
  const cap = t => String(t).charAt(0).toUpperCase() + String(t).slice(1);
  say("warm", `Good afternoon, and welcome to ${P.title || "The House of 1400"}. It's ${R.day}, and I'm ${A}.`, A);
  say("warm", `And I'm ${B}. This is ${R.editor}'s paper, and we start with the big one.`);
  const tell = (s, bridge = "") => {
    say(s.tone, `${bridge ? bridge + " " : ""}${s.headline}.`);
    if (s.depth !== "deep") return;
    say(s.tone, first(s));
    if (s.why) { say("curious", "Why does it matter?"); say(s.tone, s.why); }
  };
  if (R.lead) tell(R.lead);
  const SEG = { "Page One": "page-one", News: "news", Money: "money", "Tech and AI": "tech", "Tech & AI": "tech", Sport: "sport", "Off Duty": "off-duty", "The Week Ahead": "week-ahead" };
  for (const g of R.segments || []) {
    const at = turns.length;
    let bridge = BRIDGE[g.desk] || "";
    g.items.forEach(s => { tell(s, bridge); bridge = ""; });
    const lines = (list, lead = "") => (list || []).forEach((x, k) => { say("neutral", `${k === 0 && (lead || bridge) ? `${lead || bridge} ` : ""}${cap(x)}.`); if (k === 0) bridge = ""; });
    if (g.after_close?.length) lines([`yesterday after our paper, ${g.after_close.join("; ")}`]);
    // the level and today's move only; notes meant for the writer ("tell them together", "NOT overnight: say...") never read out
    lines((g.markets || []).map(x => x.replace(/\s*\((?:[^()]*\b(?:tell|say|NOT)\b[^()]*)\)/g, "").split(/, (?=(?:up|down|flat)\b[^,]*over the past)/)[0]));
    lines(g.results, "The latest results:");
    lines(g.standings);
    lines(g.coming, /sport/i.test(g.desk) ? "Fixture Watch:" : "");
    if (g.weather) say("neutral", `The weather here: ${g.weather}.`);
    if (turns[at]) turns[at].segment = SEG[g.desk] || (/home/i.test(g.desk) ? "close-to-home" : "news");
  }
  say("warm", "And that's the paper for today.");
  say("warm", P.signoff || "That's the afternoon. See you tomorrow.");
  return turns;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The private feed (Apple Podcasts "Follow a Show by URL"); itunes:block keeps it out of Apple's directory
// The episode's own transcript (Parth, 14 Oct): every line as the script has it, with its speaker and its time in the
// episode, as WebVTT, the form Apple Podcasts reads from the feed (podcast:transcript). cues[i] = [start, end] seconds.
export function vttOf(turns, cues) {
  const ts = s => { const ms = Math.max(0, Math.round(s * 1000)), h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, x = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`; };
  // (no em or en dash between words in the paper's copy, the transcript included: a comma takes its place)
  const clean = t => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+/g, " ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/-->/g, "->");
  const cuesOut = turns.map((t, i) => (cues?.[i] && clean(t.text) ? `${i + 1}\n${ts(cues[i][0])} --> ${ts(Math.max(cues[i][1], cues[i][0] + 0.5))}\n<v ${t.speaker}>${clean(t.text)}` : null)).filter(Boolean);
  return cuesOut.length ? `WEBVTT\n\n${cuesOut.join("\n\n")}\n` : null;
}

export function feedXML({ P = {}, base, episodes, image }) {
  const items = episodes.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `  <item>
    <title>${esc(e.title)}</title>
    <description>${esc(e.description)}</description>
    <enclosure url="${esc(e.url)}" length="${e.bytes}" type="audio/mpeg"/>${e.transcript_url ? `\n    <podcast:transcript url="${esc(e.transcript_url)}" type="text/vtt" language="en"/>` : ""}
    <guid isPermaLink="false">h1400-${e.date}${e.v > 1 ? `-v${e.v}` : ""}</guid>
    <pubDate>${new Date(e.published).toUTCString()}</pubDate>
    <itunes:duration>${Math.round(e.seconds)}</itunes:duration>
    <itunes:explicit>false</itunes:explicit>
  </item>`).join("\n");
  // Listed in Apple Podcasts, Spotify and the rest (Parth, 14 Oct: "I don't care, tell me how"): no block, the owner's
  // name and email (Spotify sends its ownership code there), a category, and the feed's public address, which also
  // moves any app still on the old secret address (itunes:new-feed-url). Unlisted (podcast.listed false): blocked.
  const L = P.listed && P.feed_url, O = P.owner || {}, [cat, sub] = String(P.category || "News/Daily News").split("/");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
  <title>${esc(P.title || "The House of 1400")}</title>
  <link>${esc(base)}</link>
  <description>${esc(P.description || P.subtitle || "")}</description>
  <language>en-in</language>
  <itunes:author>${esc(P.author || "")}</itunes:author>${L ? `
  <itunes:new-feed-url>${esc(P.feed_url)}</itunes:new-feed-url>
  <itunes:owner><itunes:name>${esc(O.name || P.author || "")}</itunes:name><itunes:email>${esc(O.email || "")}</itunes:email></itunes:owner>
  <itunes:category text="${esc(cat)}">${sub ? `<itunes:category text="${esc(sub)}"/>` : ""}</itunes:category>
  <itunes:type>episodic</itunes:type>
  <itunes:summary>${esc(P.description || P.subtitle || "")}</itunes:summary>` : `
  <itunes:block>Yes</itunes:block>`}
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

// Cuts a host's take at given times (seconds, from the listening model's word times: verify_lines.py align): each cut
// goes into the real pause between the two lines, the longest stretch of silence near the estimate, and each piece is
// trimmed of its silent ends. (16 Oct: the cut moved to the quietest 20 ms within a quarter second, and the listening
// model's times run early on a line that ends in a number, so four of 64 cuts fell inside a word, at the little dip of
// a "t" in "eighty-nine": "...to eighty-" ended one line and "nine" opened the host's next. A pause between lines runs
// 0.3 to 0.8 s; a dip inside a word, 20 to 80 ms.) The search runs 0.8 s either side, never past halfway to the next
// estimate; a cut with no pause of at least 0.12 s there is refused (null), and the caller falls back.
export function cutAt(pcm, secs, { start = 0, end = null, words = null } = {}) {
  const F = 480, frames = Math.floor(pcm.length / 2 / F), rms = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < F; i++) { const v = pcm.readInt16LE((f * F + i) * 2); s += v * v; } rms[f] = Math.sqrt(s / F); }
  const loud = [...rms].sort((a, b) => a - b)[Math.floor(frames * 0.95)] || 0, thr = Math.max(150, loud * 0.06), quiet = f => rms[f] < thr;
  const est = secs.map(x => Math.round(x * 50)), W = 40, MIN = 6;
  const at = est.map((c, k) => {
    const lo = Math.max(1, c - W, k ? Math.ceil((est[k - 1] + c) / 2) : 1), hi = Math.min(frames - 2, c + W, k < est.length - 1 ? Math.floor((c + est[k + 1]) / 2) : frames - 2);
    let best = null;
    for (let f = lo; f <= hi; f++) {
      if (!quiet(f)) continue;
      let e = f; while (e + 1 <= hi && quiet(e + 1)) e++;
      // the whole pause, even where it runs past the window, is what counts
      let s0 = f; while (s0 - 1 >= 0 && quiet(s0 - 1)) s0--; let e0 = e; while (e0 + 1 < frames && quiet(e0 + 1)) e0++;
      const len = e0 - s0 + 1, mid = Math.round((Math.max(s0, lo) + Math.min(e0, hi)) / 2), score = len - Math.abs(mid - c) / 4;
      if (len >= MIN && (!best || score > best.score)) best = { mid, score };
      f = e;
    }
    return best ? best.mid : -1;
  });
  if (at.some(x => x < 0)) return null;
  if (at.some((x, i) => i && x <= at[i - 1])) return null;
  const b0 = Math.max(0, Math.min(at[0] ?? frames, Math.floor(start * 50))), b1 = end == null ? frames : Math.min(frames, Math.max(at.at(-1) ?? 0, Math.ceil(end * 50)));
  // The pace check (18 Oct: the listening model heard "Bhide" as "we already", and the cut went into the comma pause
  // after "French riots", inside the next line: the Betting Window line ran 1.8 words a second and the House Note after
  // it 4.2, against about 2.7). Two neighbouring lines of four words or more whose paces differ by more than 1.45
  // times have their cut in the wrong place: it moves to the pause nearest where the words say the first line ends
  // (the longest within 1.2 s of that point), if that brings the two paces closer.
  if (words && words.length === at.length + 1) {
    const spoken = new Int32Array(frames + 1); for (let f = 0; f < frames; f++) spoken[f + 1] = spoken[f] + (quiet(f) ? 0 : 1); // frames of sound before f
    const pauseNear = (want, lo, hi) => {
      let best = null;
      for (let f = Math.max(lo, want - 60); f <= Math.min(hi, want + 60); f++) {
        if (!quiet(f)) continue;
        let e = f; while (e + 1 <= hi && quiet(e + 1)) e++;
        const len = e - f + 1, mid = Math.round((f + e) / 2), score = len - Math.abs(mid - want) / 4;
        if (len >= MIN && (!best || score > best.score)) best = { mid, score };
        f = e;
      }
      return best?.mid;
    };
    for (let k = 0; k < at.length; k++) {
      const s0 = k ? at[k - 1] : b0, e1 = k + 1 < at.length ? at[k + 1] : b1, w0 = words[k], w1 = words[k + 1];
      if (w0 < 12 || w1 < 12) continue; // short lines vary too much in pace to judge
      // pace on the sound only (a pause inside a line, after "Regime change?", is not slow speech)
      const ratio = c => ((spoken[c] - spoken[s0]) / w0) / ((spoken[e1] - spoken[c]) / w1), off = c => Math.abs(Math.log(ratio(c)));
      if (off(at[k]) < Math.log(1.7)) continue;
      // where the words say the first line ends, counted in sound, then the longest pause near it
      const target = spoken[s0] + (spoken[e1] - spoken[s0]) * w0 / (w0 + w1); let want = s0; while (want < e1 && spoken[want] < target) want++;
      const c = pauseNear(want, s0 + 8, e1 - 8);
      if (c != null && off(c) < Math.log(1.3)) at[k] = c;
    }
  }
  const bounds = [b0, ...at, b1];
  const pieces = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    let s = bounds[i], e = bounds[i + 1];
    while (s < e && quiet(s)) s++; while (e > s && quiet(e - 1)) e--;
    if (e - s < 8) return null;
    pieces.push(pcm.subarray(Math.max(0, s - 3) * F * 2, Math.min(frames, e + 5) * F * 2)); // a little more after: a soft last sound ("-teen") fades under the threshold
  }
  return pieces;
}
