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

// The running order: the lead, then the strongest stories by Bhide's importance score, then money, what is coming up
// for the teams and players Parth follows, the weather, and the House Note. Nothing outside the edition.
export function rundown(E, P = {}, now = Date.now()) {
  const items = [];
  if (E.front) items.push(E.front.lead, ...(E.front.seconds || []), ...(E.front.briefs || []));
  for (const S of Object.values(E.sections || {})) items.push(...(S.stories || []), ...(S.briefs || []));
  const seen = new Set(), list = items.filter(i => i?.headline && !seen.has(i.id) && seen.add(i.id));
  const imp = Object.fromEntries((E.art_scores || []).map(x => [x.story_id, x.importance ?? 1]));
  const [lead, ...rest] = list;
  const top = rest.map((x, i) => ({ x, i })).sort((a, b) => (imp[b.x.id] ?? 1) - (imp[a.x.id] ?? 1) || a.i - b.i).map(r => r.x).slice(0, (P.stories_max || 6) - 1);
  const story = s => ({ id: s.id, tag: kickerTag(s.kicker), headline: s.headline, tone: ["good", "bad", "mixed"].includes(s.tone) ? s.tone : "neutral", text: storyText(s).slice(0, 1400), why: s.why?.text || null });
  const snap = E.snapshot || {}, ok = k => (snap[k]?.value && !snap[k]?.error ? snap[k].value : null);
  const idx = ok("markets")?.indices || [], fx = ok("fx"), gold = ok("gold_in");
  const money = [];
  for (const name of ["Nifty 50", "Sensex"]) { const i = idx.find(x => x.name === name); if (i && Number.isFinite(i.price)) money.push(`${name} at ${Math.round(i.price).toLocaleString("en-IN")}, ${i.change_pct >= 0 ? "up" : "down"} ${Math.abs(i.change_pct).toFixed(1)}%${i.session_date && i.session_date !== E.date ? ` (${i.session_date})` : ""}`); }
  if (Number.isFinite(fx?.price)) money.push(`the rupee at ${fx.price.toFixed(2)} to the dollar`);
  if (Number.isFinite(gold?.per_10g_24k)) money.push(`24-carat gold at ₹${Math.round(gold.per_10g_24k).toLocaleString("en-IN")} for ten grams`);
  const upcoming = [];
  const soon = u => { const t = Date.parse(u); return t > now - 2 * 36e5 && t < now + 3 * 864e5; };
  const when = u => new Date(u).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
  const NAMES = { madrid: "Real Madrid", india_cricket: "India", f1: "Formula One" };
  for (const [k, c] of Object.entries(E.chronology || {})) if (c?.next?.when_utc && soon(c.next.when_utc)) upcoming.push(`${NAMES[k] || k}: ${c.next.label}${c.next.detail ? ` (${c.next.detail})` : ""}, ${when(c.next.when_utc)} IST`);
  for (const p of E.tennis?.players || []) if (p.next_match?.when_utc && soon(p.next_match.when_utc)) upcoming.push(`${p.name}: ${p.next_match.text}`);
  const city = ok("weather")?.cities?.[0], d0 = city?.daily?.[0];
  const weather = city && d0 ? `${city.name}: ${Math.round(d0.max)} degrees today, ${d0.rain_prob}% chance of rain` : null;
  return { date: E.date, day: longDate(E.date), lead: lead ? story(lead) : null, stories: top.map(story), money, upcoming, weather, house_note: E.house_note || null, big_day: !!E.big_day, editor_note: E.big_day ? E.editor_note || null : null };
}

// What the writer is asked for (Gemini, free tier)
export function writerPrompt(R, P = {}) {
  const [A, B] = P.hosts || [{ id: "Asha" }, { id: "Ravi" }], W = P.words || { min: 650, target: 850, max: 1100 };
  return `You write the script of a daily two-host news podcast for one listener in Bengaluru and his wife. The show is "${P.title || "The House of 1400"}", the spoken version of their private afternoon newspaper.

Hosts: ${A.id} (${A.about || "asks and reacts"}) and ${B.id} (${B.about || "explains"}). They are friends talking naturally: questions, reactions, handovers, the odd light remark. They never read headlines out like a bulletin.

Write about ${W.target} words in total (between ${W.min} and ${W.max}), covering the rundown below IN ORDER: open with the date and the lead, then the stories, then money, then what is coming up in sport, then the weather, and close with the house note in the hosts' own words and a short goodbye.

Rules:
- Use only facts in the rundown. Never add a fact, number, name, quote or opinion that is not there. If something is unclear, leave it out.
- Write every number, amount, score and date in words, the way an Indian speaker says them (lakh and crore for rupees; "two-one" for a series score). No digits, no symbols like ₹, %, $ or &.
- Bad news (deaths, disasters, violence, illness) is handled gently and seriously: no jokes, no laughter, no light remarks near it.
- No talk about how the paper or the show is made, sources being checked, or anything being absent. No "stay tuned", no clichés, no telling the listener how to feel.
- Each turn is one to four sentences. Alternate speakers naturally; one may briefly react inside the other's story.
- You may use these inline tags sparingly: <short pause>, <laugh> (only for genuinely light moments), <sigh>.
- "mood" for each turn is one of: good, bad, mixed, neutral, matching the story being discussed.

Return JSON only: {"turns":[{"speaker":"${A.id}"|"${B.id}","mood":"good|bad|mixed|neutral","text":"..."}]}

RUNDOWN:
${JSON.stringify(R, null, 1)}`;
}

const PROCESS = /\b(source[sd]?|sourcing|validator|edition file|the pool|pool story|rundown|script|prompt|we checked|second source|AI|model|generated)\b/i;
// The checks before voicing; returns a list of problems (empty = fine)
export function checkScript(turns, R, P = {}) {
  const W = P.words || { min: 650, max: 1100 }, ids = new Set((P.hosts || [{ id: "Asha" }, { id: "Ravi" }]).map(h => h.id)), out = [];
  if (!Array.isArray(turns) || turns.length < 8) return ["fewer than 8 turns"];
  const words = turns.reduce((a, t) => a + String(t.text || "").split(/\s+/).filter(Boolean).length, 0);
  if (words < W.min || words > W.max) out.push(`${words} words (needs ${W.min} to ${W.max})`);
  turns.forEach((t, i) => {
    if (!ids.has(t.speaker)) out.push(`turn ${i + 1}: unknown speaker ${t.speaker}`);
    if (!String(t.text || "").trim()) out.push(`turn ${i + 1}: empty`);
    if (/<laugh>|<chuckle>/i.test(t.text) && t.mood === "bad") out.push(`turn ${i + 1}: laughter in a serious moment`);
    if (PROCESS.test(String(t.text).replace(/<[^>]+>/g, ""))) out.push(`turn ${i + 1}: talks about how the show is made ("${String(t.text).match(PROCESS)[0]}")`);
  });
  const sad = new Set([R.lead, ...(R.stories || [])].filter(s => s?.tone === "bad").flatMap(s => String(s.headline).toLowerCase().match(/[a-z]{5,}/g) || []));
  turns.forEach((t, i) => { if (/<laugh>/i.test(t.text) && [...sad].some(w => String(t.text).toLowerCase().includes(w))) out.push(`turn ${i + 1}: laughter beside a sad story`); });
  return out;
}

// When the writer fails twice: a plain, correct conversation made by code from the rundown
export function fallbackScript(R, P = {}) {
  const [A, B] = (P.hosts || [{ id: "Asha" }, { id: "Ravi" }]).map(h => h.id), turns = [];
  const say = (speaker, mood, text) => text && turns.push({ speaker, mood, text });
  const first = s => String(s?.text || "").split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
  say(A, "neutral", `Good afternoon. This is ${P.title || "The House of 1400"} for ${R.day}.`);
  if (R.lead) { say(B, R.lead.tone, `The big one today: ${R.lead.headline}.`); say(A, R.lead.tone, first(R.lead)); }
  (R.stories || []).forEach((s, i) => { const [x, y] = i % 2 ? [A, B] : [B, A]; say(x, s.tone, `${s.tag ? s.tag + ". " : ""}${s.headline}.`); say(y, s.tone, first(s)); });
  if (R.money?.length) say(B, "neutral", `On money: ${R.money.join("; ")}.`);
  if (R.upcoming?.length) say(A, "neutral", `Coming up: ${R.upcoming.join("; ")}.`);
  if (R.weather) say(B, "neutral", `And the weather in ${R.weather}.`);
  if (R.house_note) say(A, "neutral", R.house_note);
  say(B, "neutral", "That's the afternoon. See you tomorrow.");
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
  <itunes:explicit>false</itunes:explicit>${image ? `\n  <itunes:image href="${esc(image)}"/>` : ""}
${items}
</channel>
</rss>
`;
}
