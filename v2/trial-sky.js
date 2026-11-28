// ================================================================ (5) THE SKY REPORT and (8) THE SEARCH BAR (trial)
// The trial's sky module (v2/trial.js explains the registry). Both draw only while the trial is on (TRIAL_BLOCKS are
// used only then) and only from good data: a missing figure drops its line or its card, never shows a blank.

// ---------- (5) the Sky Report: Sky & Streets opens with Bengaluru right now ----------
// Parth picked the Daily Index's Sky Report ("very clean and very easy to understand, though it feels a bit
// cluttered"), so it is trimmed: no quips or chatty lines. Warnings first (as theirs, and only while one runs), then the
// big temperature and its sky, feels like, today's low to high with where it is now; beside it the sun's arc (by night
// the night's, with the moon in tonight's phase) and two or three meters (humidity, UV by day, air); then the rest of
// the day in four parts with the chance of rain, and one row each for Ranchi and Prayagraj. The paper's own
// week-and-month chart and its words follow, unchanged (skyBlock in public/app.js), less the warnings already printed.
// Data: LIVE.weather (the paper's feed: now, today, sunrise and sunset, UV, air), LIVE.alerts and LIVE.nowcast (Sachet's
// NDMA and IMD warnings within 60 km, IMD's three-hour nowcast: the paper's own, lib/trial.js and lib/imd.js) and
// LIVE.look_sky (lib/look-sky.js: the parts of the day from Open-Meteo's hours, MET Norway as backup, which has no
// chance of rain). A part of the report with no good figure is left out; with no temperature, the report is.
TRIAL_KEYS.push(["look_sky", ""]);

const tskP = s => (s ? Date.parse(String(s).length <= 16 ? s + ":00+05:30" : s) : NaN);
const tskT = ms => istTime(new Date(ms).toISOString());
const tskDur = ms => { const m = Math.max(0, Math.round(ms / 6e4)), h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m} min`; };
const tskDeg = v => `${Math.round(v)}°`;
const tskRange = (a, b) => (Math.round(a) === Math.round(b) ? tskDeg(a) : `${Math.round(a)} to ${Math.round(b)}°`);

// Light line icons, no emoji: sun, moon, cloud, rain, storm, fog. Colours stay soft on the light sheet.
function tskIcon(code, night = false, size = 28) {
  const sun = `<circle cx="12" cy="12" r="4.2" fill="#f2c14e" stroke="#d99a1e"/><g stroke="#d99a1e"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/></g>`;
  const moon = (x = 0, y = 0, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M15.6 4.2a7.6 7.6 0 1 0 4.2 12.6 6.3 6.3 0 0 1-4.2-12.6z" fill="#d9dce8" stroke="#7d86a3"/>`;
  const cloud = (fill = "#eceae4") => `<path d="M7.2 18.6h10.1a3.9 3.9 0 0 0 .5-7.8 5.4 5.4 0 0 0-10.4-.9 4.4 4.4 0 0 0-.2 8.7z" fill="${fill}" stroke="#8b877d"/>`;
  const small = night ? moon(-3.2, -2.6, .62) : `<g transform="translate(-3 -3.2) scale(.62)">${sun}</g>`;
  const drops = n => `<g stroke="#2f6fd0">${[8.5, 12, 15.5].slice(0, n).map(x => `<path d="M${x} 20.2l-.9 2.2"/>`).join("")}</g>`;
  let body;
  const c = Number(code);
  if (!Number.isFinite(c) || code === null) return "";
  if (c === 0) body = night ? moon() : sun;
  else if (c === 1 || c === 2) body = small + `<g transform="translate(2.4 1.4) scale(.86)">${cloud("#f5f3ee")}</g>`;
  else if (c === 3) body = cloud();
  else if (c === 45 || c === 48) body = `<g stroke="#8b877d"><path d="M4 9h16M3 13h18M5 17h14"/></g>`;
  else if (c >= 95) body = `<g transform="translate(0 -2.4)">${cloud("#dedbd3")}</g><path d="M12.6 15.2l-2.2 3.6h2.4l-1.6 3.4" stroke="#d99a1e" fill="none"/>`;
  else if (c >= 51) body = `<g transform="translate(0 -2.4)">${cloud()}</g>${drops(c === 51 || c === 61 || c === 80 ? 2 : 3)}`;
  else body = cloud();
  return `<svg class="tsk-ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const tskWord = (code, night) => { const w = WMO[code]?.[1]; if (!w) return ""; return night && code === 0 ? "Clear night" : w; };
const tskRainWord = p => (p >= 60 ? "Rain likely" : p >= 35 ? "Rain possible" : p >= 15 ? "Low chance" : "Dry");
const tskWhen = (p, today) => {
  const day = istDate(new Date(tskP(p.start))), tom = day > today;
  return p.key === "tonight" ? (tom ? "tomorrow night" : "tonight") : `${tom ? "tomorrow" : "this"} ${p.key}`;
};

// The moon tonight, worked out on the device (a mean lunation from a known new moon: good to about a day, enough to
// draw it and name it): phase 0 new, 0.5 full; the lit share of the disc
function tskMoon(at = Date.now()) {
  const phase = ((((at - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1) + 1) % 1, lit = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  const name = phase < 0.034 || phase >= 0.966 ? "New moon" : phase < 0.216 ? "Waxing crescent" : phase < 0.284 ? "First quarter" : phase < 0.466 ? "Waxing gibbous" : phase < 0.534 ? "Full moon" : phase < 0.716 ? "Waning gibbous" : phase < 0.784 ? "Last quarter" : "Waning crescent";
  return { phase, lit, name };
}
// the moon at (x, y): the dark disc faintly, the lit part on top (a shadow disc slid off it: lit on the right while
// waxing, as seen from India)
function tskMoonSVG(x, y, r, m, id) {
  const dx = (m.phase < 0.5 ? -1 : 1) * 2.1 * r * m.lit;
  return `<defs><mask id="${id}"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${(x + dx).toFixed(1)}" cy="${y}" r="${(r * 1.05).toFixed(1)}" fill="#000"/></mask></defs>
<circle cx="${x}" cy="${y}" r="${r + 7}" fill="#9aa3c0" opacity=".16"/><circle cx="${x}" cy="${y}" r="${r}" fill="#8e97b5"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="#fbf8ec" mask="url(#${id})"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#7d86a3" stroke-width="1.2"/>`;
}
// The sun's arc between sunrise and sunset, or the night's between sunset and sunrise, with where we are in it now
function tskArc(c, today, now) {
  const rise = tskP(today?.sunrise), set = tskP(today?.sunset);
  if (!Number.isFinite(rise) || !Number.isFinite(set) || set <= rise) return "";
  let a, b, day = false;
  if (now >= rise && now < set) { a = rise; b = set; day = true; }
  else if (now >= set) { a = set; b = tskP(c.daily?.find(d => d.date > today.date)?.sunrise); if (!Number.isFinite(b)) b = rise + 864e5; }
  else { b = rise; const y = c.past?.at(-1); a = y && y.date < today.date ? tskP(y.sunset) : NaN; if (!Number.isFinite(a)) a = set - 864e5; }
  const f = Math.min(1, Math.max(0, (now - a) / (b - a))), R = 120, cx = 150, cy = 132;
  const x = cx - R * Math.cos(Math.PI * f), y = cy - R * Math.sin(Math.PI * f);
  const moon = tskMoon(now);
  const stars = day ? "" : [[70, 46], [112, 26], [196, 34], [236, 70], [150, 62], [92, 92]].map(([sx, sy]) => `<circle cx="${sx}" cy="${sy}" r="1.3" fill="#7d86a3" opacity=".45"/>`).join("");
  const svg = `<svg viewBox="0 0 300 146" role="img" aria-label="${day ? `The sun is up: sunrise ${tskT(a)}, sunset ${tskT(b)}` : `Night: sunset ${tskT(a)}, sunrise ${tskT(b)}, ${moon.name.toLowerCase()}`}">${stars}
<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="var(--rule)" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>
${f > 0.004 ? `<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${day ? "#d99a1e" : "#7d86a3"}" stroke-width="3" stroke-linecap="round"/>` : ""}
<line x1="14" y1="${cy}" x2="286" y2="${cy}" stroke="var(--rule)" stroke-width="1.5"/>
${day ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="#f2c14e" opacity=".28"/>
<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#f2c14e" stroke="#d99a1e" stroke-width="1.5"/>` : tskMoonSVG(+x.toFixed(1), +y.toFixed(1), 11, moon, "tsk-moon")}</svg>`;
  const left = day ? "Sunrise" : "Sunset", right = day ? "Sunset" : "Sunrise", mid = day ? `${tskDur(b - now)} of daylight left` : `${tskDur(b - now)} to sunrise`;
  return `<figure class="tsk-arc">${svg}<figcaption><span><small>${left}</small>${esc(tskT(a))}</span><b>${esc(mid)}${day ? "" : `<small>${esc(moon.name)}</small>`}</b><span class="r"><small>${right}</small>${esc(tskT(b))}</span></figcaption></figure>`;
}

// Warnings first, as the Daily Index puts them: Sachet's NDMA and IMD warnings near the three cities, then IMD's
// three-hour nowcast, one quiet line each with a stripe in the warning's colour. Nothing on a quiet day.
function tskAlerts() {
  const A = (typeof alertsNow === "function" ? alertsNow() : []).map(a => {
    const c = String(a.colour || "").toLowerCase(), u = alertUntil(a);
    return `<li class="tsk-al" data-c="${esc(c)}"><p><b>${esc(alertWord(a))}</b> ${esc(a.type)}, ${esc(a.city)}${u ? `<span>${esc(u)} IST</span>` : ""}</p>${a.message ? `<p class="tsk-alm">${esc(a.message)}</p>` : ""}<p class="tsk-als">${esc(a.source || "NDMA")} via Sachet</p></li>`;
  });
  const N = (typeof nowcastNow === "function" ? nowcastNow() : []).map(c => `<li class="tsk-al" data-c="${ncColour(c.warning.level)}"><p><b>Next three hours</b> ${esc(ncWhat(c.warning).replace(/^./, x => x.toUpperCase()))}, ${esc(c.city)}<span>${esc(ncUntil(c.warning))} IST</span></p><p class="tsk-als">IMD nowcast, issued ${esc(istTime(c.warning.from))}</p></li>`);
  const all = [...A, ...N].slice(0, 4);
  return all.length ? `<ul class="tsk-alerts" aria-label="Weather warnings">${all.join("")}</ul>` : "";
}
const TSK_UV = uv => (uv < 3 ? ["Low", "ok"] : uv < 6 ? ["Moderate", "mid"] : uv < 8 ? ["High", "hi"] : uv < 11 ? ["Very high", "hi"] : ["Extreme", "hi"]);

const tskMeter = (label, val, unit, word, frac, tone = "", title = "") => `<div class="tsk-m"${title ? ` title="${esc(title)}"` : ""}><p class="tsk-ml"><span>${esc(label)}</span>${word ? `<em>${esc(word)}</em>` : ""}</p><p class="tsk-mv">${val}${unit ? `<small>${unit}</small>` : ""}</p><i class="tsk-mb${tone ? " " + tone : ""}"><i style="width:${(Math.min(1, Math.max(0.03, frac)) * 100).toFixed(1)}%"></i></i></div>`;
const TSK_AIR = { good: ["Good", "ok"], mod: ["Moderate", "mid"], usg: ["Poor for some", "hi"], bad: ["Unhealthy", "hi"], vbad: ["Very unhealthy", "hi"], haz: ["Hazardous", "hi"] };

// The parts of the day still to come (the feed is held up to an hour at the edge, so a part that has ended is dropped)
function tskParts(name, now) {
  const C = LIVE.look_sky?.value?.cities?.find(c => c.name === name);
  const P = (C?.parts || []).filter(p => tskP(p.end) > now && Number.isFinite(p.tmin) && Number.isFinite(p.tmax)).slice(0, 4);
  return P.length >= 2 ? P : [];
}
function tskPart(p, now) {
  const night = p.key === "tonight" || p.key === "evening", underway = tskP(p.start) <= now;
  const has = Number.isFinite(p.rain);
  const val = has ? `${p.rain}<small>%</small>` : esc(tskWord(p.code, night) || "");
  const word = has ? tskRainWord(p.rain) : p.rain_mm != null ? (p.rain_mm >= 0.2 ? `About ${p.rain_mm} mm of rain` : "Dry") : "";
  return `<div class="tsk-p${has && p.rain >= 60 ? " wet" : ""}">${has ? `<i class="tsk-pbar" aria-hidden="true"><i style="height:${Math.max(4, p.rain)}%"></i></i>` : ""}<div class="tsk-pb"><p class="tsk-pl"><b>${esc(p.label)}</b>${tskIcon(p.code, night, 22)}</p><p class="tsk-pt">${underway ? `Now to ${esc(p.to)}` : `${p.key !== "tonight" && istDate(new Date(tskP(p.start))) > istDate() ? "Tomorrow, " : ""}${esc(p.from)} to ${esc(p.to)}`}</p>${val ? `<p class="tsk-pv">${val}</p>` : ""}${word ? `<p class="tsk-pw">${esc(word)}</p>` : ""}<p class="tsk-pr">${esc(tskRange(p.tmin, p.tmax))}</p></div></div>`;
}
// today's low to high, with a dot where it is now
function tskBar(lo, hi, now, compact = false) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return "";
  const f = hi > lo && Number.isFinite(now) ? Math.min(1, Math.max(0, (now - lo) / (hi - lo))) : null;
  return `<div class="tsk-range${compact ? " c" : ""}">${compact ? "" : "<small>Low</small>"}<b>${tskDeg(lo)}</b><i class="tsk-rb" aria-hidden="true">${f != null ? `<i style="left:${(f * 100).toFixed(1)}%"></i>` : ""}</i><b>${tskDeg(hi)}</b>${compact ? "" : "<small>High</small>"}</div>`;
}

function tskReport() {
  const W = LIVE.weather?.value?.cities; if (!W?.length) return "";
  const B = W.find(c => !c.family && !c.here) || W[0], k = B.current, td = istDate(), today = B.daily?.find(d => d.date === td);
  if (!Number.isFinite(k?.temp)) return "";
  const now = Date.now(), rise = tskP(today?.sunrise), set = tskP(today?.sunset);
  const night = Number.isFinite(rise) && Number.isFinite(set) ? !(now >= rise && now < set) : k.is_day === 0;
  const hr = Number(fmt(new Date(now).toISOString(), { hour: "2-digit" }));
  const partNow = hr >= 21 || hr < 6 ? "tonight" : hr < 12 ? "this morning" : hr < 17 ? "this afternoon" : "this evening";
  const parts = tskParts(B.name, now), withRain = parts.filter(p => Number.isFinite(p.rain));
  const peak = withRain.length ? withRain.reduce((m, p) => (p.rain > m.rain ? p : m)) : null;
  // one short line: the rain to come and, before the afternoon is out, how warm it gets
  const bits = [];
  if (peak && peak.rain >= 35) bits.push(`${peak.rain >= 60 ? "Rain likely" : "Some chance of rain"} ${tskWhen(peak, td)}.`);
  else if (peak && withRain.length >= 3) bits.push(`Dry through ${tskWhen(parts[parts.length - 1], td)}.`);
  if (Number.isFinite(today?.max) && hr < 15 && today.max - k.temp >= 2) bits.push(`Up to ${tskDeg(today.max)} today.`);
  const word = tskWord(k.code, night);
  let h = `<div class="tsk-top"><div class="tsk-now"><p class="tsk-kick">${esc(B.name)}, ${partNow}</p>
<div class="tsk-big"><span class="tsk-t tnum">${tskDeg(k.temp)}</span>${tskIcon(k.code, night, 64)}</div>
${word ? `<p class="tsk-cond">${esc(word)}</p>` : ""}${bits.length ? `<p class="tsk-line">${esc(bits.join(" "))}</p>` : ""}
${Number.isFinite(k.feels) ? `<p class="tsk-feel">Feels like ${tskDeg(k.feels)}</p>` : ""}
${today ? tskBar(today.min, today.max, k.temp) : ""}</div>`;
  const meters = [];
  if (Number.isFinite(k.humidity)) meters.push(tskMeter("Humidity", Math.round(k.humidity), "%", k.humidity >= 85 ? "Very humid" : k.humidity >= 60 ? "Humid" : k.humidity >= 30 ? "Comfortable" : "Dry", k.humidity / 100));
  const aq = B.air?.now;
  if (Number.isFinite(aq) && aq >= 0) { const [w, tone] = TSK_AIR[aqiCat(aq)[2]] || ["", ""]; meters.push(tskMeter("Air", Math.round(aq), "", w, aq / 300, tone, "US AQI, this hour")); }
  // UV by day (from Open-Meteo's hour; a reading below zero is not a reading); at night the meter is not drawn
  const fresh = Math.abs(now - tskP(k.time)) < 90 * 6e4; // the reading's own hour, not one held from the night
  if (!night && fresh && Number.isFinite(k.uv) && k.uv >= 0 && k.uv < 20) { const [w, tone] = TSK_UV(k.uv); meters.splice(1, 0, tskMeter("UV", Math.round(k.uv), "", w, k.uv / 11, tone, "UV index, this hour")); }
  // the rain is in the parts below; without them, today's chance here
  if (!parts.length && Number.isFinite(today?.rain_prob)) meters.push(tskMeter("Rain", Math.round(today.rain_prob), "%", "Today", today.rain_prob / 100, "tsk-wet"));
  const arc = tskArc(B, today, now);
  if (arc || meters.length) h += `<div class="tsk-side">${arc}${meters.length ? `<div class="tsk-meters">${meters.join("")}</div>` : ""}</div>`;
  h += `</div>`;
  if (parts.length) h += `<h3 class="tsk-h">The rest of the day<span>chance of rain</span></h3><div class="tsk-parts" data-n="${parts.length}">${parts.map(p => tskPart(p, now)).join("")}</div>`;
  // Ranchi and Prayagraj: one row each
  const fam = W.filter(c => c.family && Number.isFinite(c.current?.temp));
  if (fam.length) h += `<h3 class="tsk-h">${esc(fam.map(c => c.name).join(" and "))}<span>today</span></h3><div class="tsk-fam">${fam.map(c => {
    const t = c.daily?.find(d => d.date === td), r = tskP(t?.sunrise), s = tskP(t?.sunset), n = Number.isFinite(r) && Number.isFinite(s) ? !(now >= r && now < s) : c.current.is_day === 0, w = tskWord(c.current.code, n);
    return `<div class="tsk-row"><p class="tsk-rn">${esc(c.name)}</p><p class="tsk-rt">${tskIcon(c.current.code, n, 26)}<b class="tnum">${tskDeg(c.current.temp)}</b>${w ? `<span>${esc(w)}</span>` : ""}</p>${t ? tskBar(t.min, t.max, c.current.temp, true) : ""}${Number.isFinite(t?.rain_prob) ? `<p class="tsk-rr"><small>Rain</small><b class="tnum">${Math.round(t.rain_prob)}%</b></p>` : ""}</div>`;
  }).join("")}</div>`;
  const stale = LIVE.weather?.stale ? staleNote("weather") : "";
  return `<div class="tsky">${trialSafe("sky alerts", tskAlerts)}${h}${stale}</div>`;
}
TRIAL_BLOCKS.sky = () => { const r = trialSafe("sky report", tskReport); const rest = skyBlock(); return r ? r + (rest ? `<div class="tsk-rest">${rest}</div>` : "") : rest; };

// ---------- (8) The Search Bar: what India and the world are typing into Google, and posting on X ----------
// Parth picked the Daily Index's Grapevine: its Search Bar and Trending, India and the world. Ours, calmer: one India /
// World switch for both columns. On Google: a ranked list, each search with a thin bar for its volume, the volume, how
// long ago it took off, and the headline that explains it with its outlet (or, with no headline about it, what else
// people searched with it); "In today's paper" when the paper carries it. World rows name the countries it trends in
// (one row when it trends in more than one). On X: the names, posts and hours on the list, as many as fit beside.
// Data: LIVE.look_search (lib/look-sky.js: Google's trending page, its RSS and Google News; trends24 for X), else the
// paper's own LIVE.trends, else the edition's list. India keeps searches in English or Hindi (the paper cannot translate
// the rest), World the Latin alphabet. A row with nothing to explain it is left out; a failed X list drops its column.
const TSB = { tab: "IN", more: false };
TRIAL_KEYS.push(["look_search", ""]);
// the paper's own feed, the backup (the paper fetches it only when the edition has no list of its own)
TRIAL_KEYS.push(["trends", ""]);
const tsbLatin = t => /^[\x20-\x7E -ɏ‐-›₹]+$/.test(t || "");
const tsbHindi = t => /^[\x20-\x7E -ÿऀ-ॿ‐-›₹]+$/.test(t || "") && /[ऀ-ॿ]/.test(t || "");
const tsbHost = u => { try { return new URL(u).hostname.replace(/^(www|m|amp)\./, ""); } catch { return ""; } };
const tsbVol = t => String(t || "").replace(/\d+(\.\d+)?/, n => (n >= 1e6 ? +(n / 1e6).toFixed(1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(1) + "K" : n));
const tsbAgo = ms => { const m = Math.round((Date.now() - ms) / 6e4); if (!(m >= 0) || m > 72 * 60) return ""; return m < 60 ? `${Math.max(1, m)}m` : m < 48 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const tsbN = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
// Google hands searches over as typed, mostly in lower case: shown as a title would be ("Man Utd vs Brentford"); a
// search with a capital in it is left as it is. X's shouted names of two words or more ("SCOUT IS ABSOLUTELY RIGHT")
// are shown in title case too, so the column does not shout; one word ("BCCI") stays.
const TSB_SMALL = new Set(["vs", "v", "of", "and", "the", "in", "on", "at", "for", "to", "a", "de", "la", "el", "y"]);
const tsbTitle = t => String(t).split(" ").map((w, i) => (i > 0 && TSB_SMALL.has(w) ? w : /^([a-z]\.)+$/.test(w) ? w.toUpperCase() : w.replace(/(^|-)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase()))).join(" ");
const tsbCase = t => (t === t.toLowerCase() ? tsbTitle(t) : t);
const tsbShout = t => (/\p{Lu}/u.test(t) && t === t.toUpperCase() && t.split(/\s+/).length >= 2 ? tsbTitle(t.toLowerCase()) : t);
// the edition's headlines as word lists, once per edition, for "In today's paper"
let TSB_HEADS = null, TSB_HEADS_FOR = null;
const tsbWords = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^\p{L}\p{M}\p{N}]+/u).filter(w => w.length > 1 && !TSB_SMALL.has(w));
function tsbInPaper(term) {
  if (TSB_HEADS_FOR !== E) {
    TSB_HEADS_FOR = E; TSB_HEADS = [];
    const add = x => { if (x?.headline) TSB_HEADS.push(tsbWords(x.headline)); };
    add(E?.front?.lead); (E?.front?.seconds || []).forEach(add);
    for (const S of Object.values(E?.sections || {})) { (S.stories || []).forEach(add); (S.briefs || []).forEach(add); }
  }
  const w = tsbWords(term).filter(x => x.length >= 3);
  // every word of the search in one headline (a one-word search: a name of five letters or more)
  return w.length && (w.length > 1 || w[0].length >= 5) && TSB_HEADS.some(h => w.every(x => h.includes(x)));
}
function tsbLists() {
  const V = LIVE.look_search?.value, cfg = CFG.trends || {}, inG = cfg.india_geo || "IN";
  if (V?.geos && (V.geos[inG]?.length || V.world?.length)) {
    const row = r => ({ term: r.term, traffic: r.traffic, vol: r.volume, ago: r.active === false ? "" : tsbAgo(Date.parse(r.started)), head: r.news?.title || "", url: r.news?.url || "", source: r.news?.source || (r.news ? tsbHost(r.news.url) : ""), related: r.related || [], geos: r.geos || null });
    return { IN: (V.geos[inG] || []).map(row), WORLD: (V.world || []).map(row), live: "look", x: V.x || {} };
  }
  // the paper's own feed: a row needs a headline
  const G = LIVE.trends?.value?.geos;
  if (G && Object.values(G).some(l => l?.length)) {
    const row = (t, ok, geo) => {
      if (!t?.term || !ok(t.term)) return null;
      const n = (t.news || []).find(x => x?.title && ok(x.title)); if (!n) return null;
      return { term: t.term, traffic: t.traffic, vol: volumeOf(t.traffic), head: n.title, url: n.url, source: n.source || tsbHost(n.url), ago: tsbAgo(Date.parse(t.published || t.started)), related: [], geos: geo ? [geo] : null };
    };
    const seen = new Set(), uniq = r => r && !seen.has(r.term.toLowerCase()) && seen.add(r.term.toLowerCase());
    const byVol = l => l.map((r, i) => ({ r, i })).sort((a, b) => b.r.vol - a.r.vol || a.i - b.i).map(x => x.r).slice(0, 10);
    const india = byVol((G[inG] || []).map(t => row(t, x => tsbLatin(x) || tsbHindi(x))).filter(uniq));
    const geos = (cfg.world_geos || ["US"]).filter(g => G[g]?.length), mixed = [];
    for (let i = 0; i < 20; i++) for (const g of geos) if (G[g][i]) mixed.push(row(G[g][i], tsbLatin, g));
    return { IN: india, WORLD: byVol(mixed.filter(uniq)), live: "trends", x: {} };
  }
  const T = E?.trends; if (!T) return null;
  const ed = (l, world) => (l || []).filter(t => t?.term && t.what).map(t => ({ term: t.term, traffic: t.traffic, vol: volumeOf(t.traffic), head: t.what, url: t.url, source: tsbHost(t.url), ago: "", related: [], geos: world && t.geo ? [t.geo] : null })).sort((a, b) => b.vol - a.vol).slice(0, 10);
  return { IN: ed(T.india), WORLD: ed(T.world, true), live: "", x: {} };
}
const tsbFeed = L => (L.live === "look" ? LIVE.look_search : L.live === "trends" ? LIVE.trends : null);
function tsbRow(r, i, w) {
  const name = esc(tsbCase(r.term)), paper = tsbInPaper(r.term);
  const meta = [r.traffic ? esc(tsbVol(r.traffic)) : "", r.ago ? esc(r.ago) : ""].filter(Boolean).join(", ");
  const ctx = r.head
    ? `<p class="tsb-h">${paper ? `<span class="tsb-paper">In today's paper</span>` : ""}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.head)}</a>` : esc(r.head)}${r.source ? ` <span class="tsb-s">${esc(r.source)}</span>` : ""}</p>`
    : r.related.length ? `<p class="tsb-h tsb-rel">${paper ? `<span class="tsb-paper">In today's paper</span>` : ""}<span>Also searched</span> ${r.related.map(q => esc(tsbCase(q))).join(", ")}</p>` : "";
  return `<li class="tsb-r${i >= 7 ? " x" : ""}"><span class="tsb-n tnum">${String(i + 1).padStart(2, "0")}</span><div class="tsb-b"><p class="tsb-t"><a class="tsb-q" href="https://www.google.com/search?q=${encodeURIComponent(r.term)}" target="_blank" rel="noopener">${name}</a>${r.geos?.length ? `<span class="tsb-gs">${r.geos.map(g => `<span class="tsb-g">${esc(countryName(g))}</span>`).join("")}</span>` : ""}${meta ? `<span class="tsb-v tnum" title="Roughly how many searched, and how long ago it took off">${meta}</span>` : ""}</p>${r.vol > 0 ? `<i class="tsb-bar" aria-hidden="true"><i style="width:${w(r.vol).toFixed(1)}%"></i></i>` : ""}${ctx}</div></li>`;
}
function tsbX(list) {
  if (!list?.length) return "";
  const rows = list.slice(0, 15).map((t, i) => `<li class="tsx-r"><span class="tsb-n tnum">${String(i + 1).padStart(2, "0")}</span><a class="tsx-q" href="${esc(t.url)}" target="_blank" rel="noopener">${esc(tsbShout(t.name))}</a><span class="tsb-v tnum">${[t.count ? `${tsbN(t.count)} posts` : "", t.hours ? (t.hours >= 24 ? "all day" : `${t.hours}h`) : ""].filter(Boolean).join(", ")}</span></li>`).join("");
  return `<section class="tsx" aria-label="On X"><h3 class="tsb-ch">On X<span>posts, and hours on the list today</span></h3><ol class="tsx-list">${rows}</ol></section>`;
}
function tsbBlock() {
  const L = tsbLists(); if (!L || (!L.IN.length && !L.WORLD.length)) return "";
  const tabs = [["IN", "India"], ["WORLD", "World"]].filter(([k]) => L[k].length);
  const tab = tabs.some(([k]) => k === TSB.tab) ? TSB.tab : tabs[0][0], list = L[tab];
  const vols = list.map(r => r.vol).filter(v => v > 0), lo = 2, hi = Math.log10(Math.max(1000, ...vols));
  const w = v => (v > 0 ? Math.max(6, Math.min(100, ((Math.log10(Math.max(v, 100)) - lo) / (hi - lo)) * 100)) : 0);
  const F = tsbFeed(L), fresh = F && !F.stale;
  const more = list.length > 7 ? `<button type="button" class="tsb-more" aria-expanded="${TSB.more}">${TSB.more ? "Show the top 7" : `Show the top ${list.length}`}</button>` : "";
  const when = F?.as_of ? (fresh ? `<span class="tsb-live"><i></i>Live, ${esc(istTime(F.as_of))} IST</span>` : `<span class="tsb-asof">${esc(agoIST(F.as_of))}</span>`) : "";
  const x = tsbX(L.x?.[tab === "IN" ? "india" : "world"]);
  const about = L.live === "look"
    ? "Google Trends' trending now, the last 24 hours: searches still climbing first, by volume; the bar is the search volume. Each search's headline is Google Trends' own or the day's first Google News story about it. India shows searches in English and Hindi; World joins the US, UK and Spain. On X: trends24's hourly copies of X's trending list."
    : L.live ? "Google Trends, the last 24 hours, with a headline for each search; the bar is the search volume. India shows the searches in English and Hindi; World mixes the US, UK and Spain." : "Searches from Google Trends, as the edition printed them; the bar is the search volume.";
  return `<div class="tsb${TSB.more ? " open" : ""}${x ? " has-x" : ""}"><div class="tsb-top"><div class="tsb-tabs" role="tablist" aria-label="Searches from">${tabs.map(([k, n]) => `<button type="button" role="tab" class="tsb-tab" data-tab="${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${n}</button>`).join("")}</div>${when}</div>
<div class="tsb-cols"><section class="tsg" aria-label="On Google">${x ? `<h3 class="tsb-ch">On Google<span>searches, and how long ago each took off</span></h3>` : ""}<ol class="tsb-list">${list.map((r, i) => tsbRow(r, i, w)).join("")}</ol>${more}</section>${x}</div>${aboutFig(about)}</div>`;
}
TRIAL_BLOCKS.talk = () => trialSafe("search bar", tsbBlock) || (typeof talkBlock === "function" ? talkBlock() : "");

function tsbRepaint(btn, sel) {
  const el = btn.closest('[data-live="talk"]'); if (!el) return;
  const html = tsbBlock(); el.innerHTML = html; el.dataset.html = html;
  el.querySelector(sel)?.focus();
  tsbFit();
}
// Side by side, X's list shows as many whole rows as fit beside the searches (five at least); stacked, the first five
function tsbFit() {
  const box = document.querySelector('#talk .tsb.has-x'); if (!box) return;
  const g = box.querySelector(".tsg"), rows = [...box.querySelectorAll(".tsx-r")]; if (!g || !rows.length) return;
  // again whenever the searches' column changes height (the fonts arriving, a wider window, the top 10 opened)
  if (!g.dataset.fit && typeof ResizeObserver === "function") { g.dataset.fit = "1"; new ResizeObserver(() => tsbFit()).observe(g); }
  rows.forEach(r => (r.hidden = false));
  const beside = getComputedStyle(box.querySelector(".tsb-cols")).display === "grid" && box.querySelector(".tsx").offsetTop === g.offsetTop;
  if (!beside) { rows.forEach((r, i) => (r.hidden = i >= 5)); return; }
  // the searches' own bottom (the grid stretches their column to the row, so measure what is in it)
  const limit = Math.max(...[...g.children].map(c => c.getBoundingClientRect().bottom));
  rows.forEach((r, i) => { r.hidden = i >= 5 && r.getBoundingClientRect().bottom > limit + 2; });
}
function trialSearchBar() {
  const s = document.getElementById("talk"); if (!s) return;
  const h = s.querySelector(".sechead h2"); if (h && h.textContent !== "The Search Bar") h.textContent = "The Search Bar";
  const sub = s.querySelector(".sechead h2 + span"); const want = "What India and the world are searching for and posting about";
  if (sub && sub.textContent !== want) sub.textContent = want;
  tsbFit();
  if (document.documentElement.dataset.tsb) return;
  document.documentElement.dataset.tsb = "1";
  addEventListener("resize", () => { if (trialOn()) tsbFit(); }, { passive: true });
  document.addEventListener("click", e => {
    const t = e.target.closest?.(".tsb-tab, .tsb-more"); if (!t || !trialOn()) return;
    if (t.classList.contains("tsb-tab")) { TSB.tab = t.dataset.tab; TSB.more = false; tsbRepaint(t, `.tsb-tab[data-tab="${TSB.tab}"]`); }
    else { TSB.more = !TSB.more; tsbRepaint(t, ".tsb-more"); }
  });
  // arrow keys move between the two tabs
  document.addEventListener("keydown", e => {
    const t = e.target.closest?.(".tsb-tab"); if (!t || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const all = [...t.parentNode.querySelectorAll(".tsb-tab")], i = all.indexOf(t), n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
    if (n && n !== t) { e.preventDefault(); n.click(); }
  });
}
TRIAL_PAINT.push(trialSearchBar);
