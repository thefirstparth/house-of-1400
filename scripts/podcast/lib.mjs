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

// The running order (Parth, 13 Oct 2026): the lead, then the paper's desks in a listening order, each item marked
// "deep" (a real back-and-forth) or "quick" (a line or two). Deep: the lead and the strongest stories by Bhide's
// importance score, front-page stories first among equals, at least one from Sport; quick: the rest, up to quick_max.
// Sport carries the latest results and what is coming up even when no story covers it (Parth, 13 Oct): The Week
// Ahead's sport entries for the next seven days, and each followed team's next fixture however far off; Money the
// market numbers; Close to Home the weather; The Week Ahead the other entries for the next three days.
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
  const deepN = Math.max(0, (P.deep_max || 6) - 1), deep = ranked.slice(0, deepN);
  if (!deep.some(s => desk(s).id === "sport") && desk(lead || {}).id !== "sport") { const sp = ranked.find(s => desk(s).id === "sport"); if (sp && deep.length) deep[deep.length - 1] = sp; else if (sp) deep.push(sp); }
  const deepIds = new Set(deep.map(s => s.id)), quick = ranked.filter(s => !deepIds.has(s.id)).slice(0, P.quick_max || 14);
  const item = (s, depth) => ({ id: s.id, desk: desk(s).name, section: nameOf[s.section] || null, kicker: s.kicker || null, headline: sayTimes(s.headline), tone: ["good", "bad", "mixed"].includes(s.tone) ? s.tone : "neutral", depth, text: sayTimes(cut(storyText(s), depth === "quick" ? 360 : 1100)), why: sayTimes(s.why?.text) || null });
  const snap = E.snapshot || {}, ok = k => (snap[k]?.value && !snap[k]?.error ? snap[k].value : null);
  const idx = ok("markets")?.indices || [], fx = ok("fx"), gold = ok("gold_in");
  const markets = [];
  for (const name of ["Nifty 50", "Sensex"]) { const i = idx.find(x => x.name === name); if (i && Number.isFinite(i.price)) markets.push(`${name} at ${Math.round(i.price).toLocaleString("en-IN")}, ${i.change_pct >= 0 ? "up" : "down"} ${Math.abs(i.change_pct).toFixed(1)}%${i.session_date && i.session_date !== E.date ? ` (${i.session_date})` : ""}`); }
  if (Number.isFinite(fx?.price)) markets.push(`the rupee at ${fx.price.toFixed(2)} to the dollar`);
  if (Number.isFinite(gold?.per_10g_24k)) markets.push(`24-carat gold at ₹${Math.round(gold.per_10g_24k).toLocaleString("en-IN")} for ten grams`);
  const NAMES = { madrid: "Real Madrid", india_cricket: "India (cricket)", f1: "Formula One" }, results = [], coming = [], ahead = [], times = [];
  const SPORT = new Set(["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"]);
  for (const w of E.week_ahead || []) {
    const t = w.time_ist ? Date.parse(`${w.date}T${w.time_ist}:00+05:30`) : Date.parse(`${w.date}T23:59:00+05:30`), sport = SPORT.has(w.area);
    if (!(t > now - 2 * 36e5 && t < now + (sport ? 7 : 3) * 864e5)) continue;
    const line = `${sayTimes(w.what)}, ${w.time_ist ? sayWhen(t, now) : sayDay(w.date, now)}${w.why ? ` (${w.why})` : ""}`;
    if (sport) { coming.push(line); if (w.time_ist) times.push(t); } else if (ahead.length < 5) ahead.push(line);
  }
  const near = t => times.some(x => Math.abs(x - t) < 3 * 36e5);
  for (const [k, c] of Object.entries(E.chronology || {})) {
    const l = c?.last, n = c?.next, lt = Date.parse(l?.when_utc), nt = Date.parse(n?.when_utc);
    if (lt > now - 60 * 36e5 && lt <= now) results.push(`${NAMES[k] || k}: ${l.label}${l.detail ? `, ${l.detail}` : ""} (${sayWhen(lt, now)})`);
    if (nt > now - 2 * 36e5 && !near(nt)) { coming.push(`${NAMES[k] || k} next: ${n.label}${n.detail ? `, ${n.detail}` : ""}, ${nt < now + 6 * 864e5 ? sayWhen(nt, now) : sayDay(new Date(nt + IST - 4 * 36e5).toISOString().slice(0, 10), now)}`); times.push(nt); }
  }
  for (const p of E.tennis?.players || []) { const t = Date.parse(p.next_match?.when_utc); if (t > now - 2 * 36e5 && t < now + 7 * 864e5 && !near(t)) coming.push(`${p.name}: ${String(p.next_match.text).replace(/,?\s*(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?,?\s*\d{1,2}:\d{2}\s*IST\.?/i, "").replace(/\.$/, "")}, ${sayWhen(t, now)}`); }
  for (const ev of E.tennis?.events || []) if (ev.note) results.push(`${ev.name}: ${ev.note}`);
  const city = ok("weather")?.cities?.[0], d0 = city?.daily?.[0];
  const weather = city && d0 ? `${city.name} today: top of ${Math.round(d0.max)} degrees${Number.isFinite(d0.min) ? `, low of ${Math.round(d0.min)}` : ""}, ${d0.rain_prob}% chance of rain` : null;
  const groups = {};
  for (const [s, depth] of [...deep.map(s => [s, "deep"]), ...quick.map(s => [s, "quick"])]) { const d = desk(s); (groups[d.id] ||= { desk: d.name, items: [] }).items.push(item(s, depth)); }
  for (const g of Object.values(groups)) g.items.sort((a, b) => (a.depth === b.depth ? 0 : a.depth === "deep" ? -1 : 1));
  const named = id => (paper.desks || []).find(d => d.id === id)?.name || { home: "Close to Home", money: "Money", sport: "Sport" }[id];
  if (markets.length) (groups.money ||= { desk: named("money"), items: [] }).markets = markets;
  if (results.length || coming.length) Object.assign(groups.sport ||= { desk: named("sport"), items: [] }, { results, coming });
  if (weather) (groups.home ||= { desk: named("home"), items: [] }).weather = weather;
  if (ahead.length) groups.week = { desk: "The Week Ahead", items: [], coming: ahead };
  const segments = [...ORDER, ...Object.keys(groups).filter(k => !ORDER.includes(k))].filter(k => groups[k]).map(k => groups[k]);
  return { date: E.date, day: longDate(E.date), lead: lead ? { ...item(lead, "deep"), desk: "Lead" } : null, segments, house_note: E.house_note || null, editor_note: E.big_day ? E.editor_note || null : null };
}
export const deepItems = R => [R.lead, ...(R.segments || []).flatMap(s => s.items.filter(i => i.depth === "deep"))].filter(Boolean);

const SERIOUS = new Set(["bad", "sombre", "concerned", "gentle"]);
export const EXAMPLE = `Asha [delighted]: Right, the chess club. They actually did it.
Ravi [surprised]: The village side? Beat the city champions?
Asha [delighted]: Beat them, and in the final round, with the youngest player on the team.
Ravi [amused]: How young?
Asha [warm]: Eleven.
Ravi [excited]: Eleven! I couldn't tie my shoelaces at eleven.
Asha [matter-of-fact]: And the bad news on the same board: the hall they play in shuts next month.
Ravi [concerned]: Oh no. So where do they go?
Asha [gentle]: Nobody knows yet. The council meets on Friday.`;

// What the writer is asked for (Gemini, free tier). Parth, 13 Oct 2026: a conversation, not two readers taking turns.
export function writerPrompt(R, P = {}) {
  const [A, B] = P.hosts || [{ id: "Asha" }, { id: "Ravi" }], W = P.words || { min: 1050, target: 1200, max: 1400 };
  const moods = Object.keys(P.moods || { neutral: 1 }).join(", ");
  return `You write the script of "${P.title || "The House of 1400"}", a daily podcast made from one family's private afternoon newspaper. The listeners are Parth and his wife in Bengaluru. It must sound like two friends who have both read today's paper, talking it through over chai. It is NOT a news bulletin and NOT two people taking turns to read the paper.

HOSTS
- ${A.id} (${A.gender || "woman"}): ${A.about || ""}
- ${B.id} (${B.gender || "man"}): ${B.about || ""}

THE SHOW, in this order (everything comes from the RUNDOWN below)
1. Open: ${A.id} greets with the day ("Good afternoon, it's ${R.day.split(" ")[0]}...") and goes straight into the lead as a hook. The two talk the lead through properly.
2. Then the desk segments in the order given. Items marked "deep" get a real back-and-forth of about 80 to 140 words: one host tells it, the other reacts and asks what a listener would ask (what does it mean for us, why now, who is this), answered from "why" and the text. Items marked "quick" get one or two sentences each; several quick ones can run together briskly. Mention every item.
3. If you name a segment, use the paper's desk names: News, Close to Home, Money, Tech and AI, Sport, Off Duty. "Close to Home" means Bengaluru only. A story from Delhi or anywhere else is News, never "close to home".
4. Sport gets real energy: every sport item, the recent results, and EVERY match in "coming", even when no story covers it (say each day and time EXACTLY as written, e.g. "on Thursday at twelve thirty a m, late on Wednesday night"; match times must be precise).
5. Money: the market numbers in one or two lines, no more than three numbers in all.
6. Weather, if given: one everyday line ("warm, with a fair chance of rain later").
7. The Week Ahead, if given: a couple of quick lines on what is coming in the next few days.
8. Close: the House Note retold in the hosts' own words with its punchline intact, then a short, warm goodbye.

HOW IT SOUNDS
- A real conversation: mix longer turns with plenty of quick reactions of two to eight words, each a natural response to exactly what was just said, in your own words (never reuse the example's lines). At least six genuine questions between the hosts.
- Real feeling that fits each story: delight at a win, shock and quiet sadness at deaths, worry about prices, amusement at the House Note. Never laugh or joke near bad news.
- Say each fact ONCE. The headline and the text repeat each other; never say the same fact twice.
- Never copy sentences from the rundown. Retell them the way people talk; contractions are good.
- Numbers are hard to follow by ear: at most two numbers in a turn, rounded when the exact figure does not matter ("about thirty-two and a half thousand crore", "nearly one per cent"). Leave out numbers that do not matter.
- Times: say them exactly as the rundown writes them, the twelve-hour way with "a m" or "p m". Never the twenty-four-hour clock and never "IST".
- Never use these: "Turning to", "In other news", "Moving on", "Let's look at", "Let us look at", "Meanwhile", "Closer to home", "Stay tuned", "On the cricket field".
- Use only facts in the rundown. Never add a fact, name, number or quote. Short personal reactions are fine ("I'd love to see that").
- No talk about how the paper or the show is made, about sources or checking, or about anything being missing.
- Every number, score, time and date in words, the Indian way (lakh and crore). No digits, no symbols like ₹, %, $ or &.
- About ${W.target} words in total (between ${W.min} and ${W.max}).
- "mood" sets the voice for that line; one of: ${moods}. Inline tags, sparingly: <laugh> (light moments only), <sigh>, <short pause>.

EXAMPLE OF THE SOUND ONLY (its facts are invented: never use them; this is the rhythm and feeling to aim for)
${EXAMPLE}

Return JSON only: {"turns":[{"speaker":"${A.id}"|"${B.id}","mood":"...","text":"..."}]}

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
  const W = P.words || { min: 1050, max: 1400 }, ids = new Set((P.hosts || [{ id: "Asha" }, { id: "Ravi" }]).map(h => h.id)), out = [];
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
    if (numberRuns(txt) > 3) soft(`turn ${i + 1}: ${numberRuns(txt)} numbers in one turn (at most two)`);
  });
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
  const [A, B] = (P.hosts || [{ id: "Asha" }, { id: "Ravi" }]).map(h => h.id), turns = [];
  const say = (speaker, mood, text) => text && turns.push({ speaker, mood, text });
  const first = (s, k = 3) => String(s?.text || "").split(/(?<=[.!?])\s+/).slice(0, k).join(" ");
  say(A, "warm", `Good afternoon. This is ${P.title || "The House of 1400"} for ${R.day}.`);
  if (R.lead) { say(B, R.lead.tone, `The big one today: ${R.lead.headline}.`); say(A, R.lead.tone, first(R.lead)); }
  let k = 0;
  for (const g of R.segments || []) {
    for (const s of g.items) { const [x, y] = k++ % 2 ? [A, B] : [B, A]; say(x, s.tone, `${s.headline}.`); if (s.depth === "deep") say(y, s.tone, first(s)); }
    if (g.markets?.length) say(B, "neutral", `On the markets: ${g.markets.join("; ")}.`);
    if (g.results?.length) say(A, "neutral", `The latest results: ${g.results.join("; ")}.`);
    if (g.coming?.length) say(B, "neutral", `Coming up: ${g.coming.join("; ")}.`);
    if (g.weather) say(A, "neutral", `And the weather. ${g.weather}.`);
  }
  if (R.house_note) say(A, "amused", R.house_note);
  say(B, "warm", "That's the afternoon. See you tomorrow.");
  return turns;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The private feed (Apple Podcasts "Follow a Show by URL"); itunes:block keeps it out of Apple's directory
export function feedXML({ P = {}, base, episodes, image }) {
  const items = episodes.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `  <item>
    <title>${esc(e.title)}</title>
    <description>${esc(e.description)}</description>
    <enclosure url="${esc(e.url)}" length="${e.bytes}" type="audio/mpeg"/>
    <guid isPermaLink="false">h1400-${e.date}</guid>
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
