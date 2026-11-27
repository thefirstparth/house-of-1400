// ================================================================ THE NEW LOOK, ON TRIAL (Parth, 27 Nov 2026)
// Behind /?trial only (the switch is in v2/assemble.mjs, TRIAL); the live paper is untouched until Parth approves.
// Built on the Glass look (the class look-trial comes with look-glass), light only. Parth's 13 picks from the Daily Index
// review: (1) Newsreader for reading and Schibsted Grotesk for labels, (2) a source logo, name and date under each story,
// (3) the hover underline in the desk's colour, (4) betting cards with a trend line and why it moved, (5) the weather as a
// Sky Report, (6) the F1 race weekend and chatter cards, (7) the title race and a match centre, (8) the trends as The Search
// Bar, (9) Money as a Market Pulse, (10) the Week Ahead unchanged, (11) the masthead without blackletter, (12) bigger desk
// names and lead, a drop cap, (13) a reading line in the desk's colour. Every module only draws when its data is good; a
// failed feed hides its card (the paper's rule: never a wrong or empty field).
const trialOn = () => document.documentElement.classList.contains("look-trial");
// A module adds: TRIAL_BLOCKS[dataLiveKey] = () => html (replaces that live block while the trial is on),
// TRIAL_KEYS.push([liveKey, query]) (fetched with the paper's own live() on every refresh), and TRIAL_PAINT.push(fn)
// (runs after every paint; must be idempotent, since a repaint can redraw what it decorated).
const TRIAL_BLOCKS = {}, TRIAL_KEYS = [], TRIAL_PAINT = [];
const trialSafe = (name, fn) => { try { return fn(); } catch (e) { console.warn(`trial ${name}:`, e); return ""; } };
function trialPaint() {
  if (!trialOn()) return;
  for (const f of TRIAL_PAINT) trialSafe(f.name || "paint", f);
}

// ---------- (2) a source's logo, name and date under each story ----------
// Logos are the outlets' own small icons, stored with the paper (public/logos/<domain>.png, scripts/logos.mjs), so no
// outside image is loaded; an outlet without one gets its initials in a small tile.
const LOGOS = typeof TRIAL_LOGOS !== "undefined" ? TRIAL_LOGOS : {};
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const logoKey = host => { if (LOGOS[host]) return host; const parts = host.split("."); for (let i = 1; i < parts.length - 1; i++) { const h = parts.slice(i).join("."); if (LOGOS[h]) return h; } return null; };
const initials = label => String(label || "?").replace(/^the\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
// every story and brief in the edition by id, built once per edition
let TRIAL_STORIES = null, TRIAL_STORIES_FOR = null;
function trialStory(id) {
  if (TRIAL_STORIES_FOR !== E) {
    TRIAL_STORIES = new Map(); TRIAL_STORIES_FOR = E;
    const add = x => { if (x?.id && !TRIAL_STORIES.has(x.id)) TRIAL_STORIES.set(x.id, x); };
    add(E?.front?.lead); (E?.front?.seconds || []).forEach(add); (E?.front?.briefs || []).forEach(add);
    for (const S of Object.values(E?.sections || {})) { (S.stories || []).forEach(add); (S.briefs || []).forEach(add); }
  }
  return TRIAL_STORIES.get(id) || null;
}
const trialDay = d => { const t = Date.parse(`${d}T12:00:00Z`); return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : ""; };
const trialLogo = (url, label) => { const k = logoKey(hostOf(url)); return k ? `<img class="tlogo" src="/logos/${k}.png" alt="" width="16" height="16" loading="lazy" decoding="async">` : `<span class="tlogo ti" aria-hidden="true">${esc(initials(label))}</span>`; };
// The line: each outlet once, its logo and name linking to the report, then the story's date
function trialSourceLine(st) {
  const by = new Map(); for (const s of st.sources || []) if (s?.label && s?.url && !by.has(s.label)) by.set(s.label, s.url);
  if (!by.size) return "";
  const day = st.stamp?.date ? trialDay(st.stamp.date) : (String(st.byline || "").match(/\b(\d{1,2} [A-Z]{3})\b/)?.[1] || "").replace(/[A-Z]{2}$/, m => m.toLowerCase());
  return `<div class="tsrcline">${[...by].slice(0, 3).map(([l, u]) => `<a class="tsrc" href="${esc(u)}" target="_blank" rel="noopener">${trialLogo(u, l)}<span>${esc(l)}</span></a>`).join("")}${day ? `<span class="tdate">${esc(day)}</span>` : ""}</div>`;
}
function trialSources() {
  for (const card of document.querySelectorAll('[id^="s-"]:not([data-tsrc])')) {
    const st = trialStory(card.id.slice(2)); if (!st) continue;
    card.dataset.tsrc = "1";
    const line = trialSourceLine(st); if (!line) continue;
    const old = card.querySelector(":scope .by, :scope > .src, :scope .src");
    if (old) { old.insertAdjacentHTML("afterend", line); old.classList.add("t-replaced"); }
    else card.insertAdjacentHTML("beforeend", line);
  }
}
TRIAL_PAINT.push(trialSources);

// ---------- (13) a reading line under the bar, in the desk's colour ----------
function trialProgress() {
  let bar = document.getElementById("treadline");
  if (!bar) { bar = document.createElement("div"); bar.id = "treadline"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<i></i>"; document.body.appendChild(bar); addEventListener("scroll", trialProgressMove, { passive: true }); addEventListener("resize", trialProgressMove, { passive: true }); }
  trialProgressMove();
}
function trialProgressMove() {
  const bar = document.getElementById("treadline"); if (!bar) return;
  const h = document.documentElement.scrollHeight - innerHeight, f = h > 40 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
  bar.firstChild.style.transform = `scaleX(${f})`;
}
TRIAL_PAINT.push(trialProgress);
