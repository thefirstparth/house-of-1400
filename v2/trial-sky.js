// ================================================================ (5) THE SKY REPORT and (8) THE SEARCH BAR (trial)
// The trial's sky module (v2/trial.js explains the registry). Both draw only while the trial is on (TRIAL_BLOCKS are
// used only then) and only from good data: a missing figure drops its line or its card, never shows a blank.

// ---------- (5) the Sky Report: Sky & Streets opens with Bengaluru right now ----------
// Parth picked the Daily Index's Sky Report ("very clean and very easy to understand, though it feels a bit
// cluttered"), so it is trimmed: no moonlight, no chatty lines. The big temperature and its sky, feels like, today's
// low to high with where it is now, the sun's arc (or the night's) with where we are in it, three meters (humidity, air,
// rain), the rest of the day in four parts with the chance of rain, then one row each for Ranchi and Prayagraj. The
// paper's own week-and-month chart and its words follow, unchanged (skyBlock in public/app.js).
// Data: LIVE.weather (the paper's feed: now, today, sunrise and sunset, air) and LIVE.look_sky (lib/look-sky.js: the
// parts of the day from Open-Meteo's hours, MET Norway as backup, which has no chance of rain).
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
  const stars = day ? "" : [[70, 46], [112, 26], [196, 34], [236, 70], [150, 62], [92, 92]].map(([sx, sy]) => `<circle cx="${sx}" cy="${sy}" r="1.3" fill="#7d86a3" opacity=".45"/>`).join("");
  const svg = `<svg viewBox="0 0 300 146" role="img" aria-label="${day ? `The sun is up: sunrise ${tskT(a)}, sunset ${tskT(b)}` : `Night: sunset ${tskT(a)}, sunrise ${tskT(b)}`}">${stars}
<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="var(--rule)" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>
${f > 0.004 ? `<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${day ? "#d99a1e" : "#7d86a3"}" stroke-width="3" stroke-linecap="round"/>` : ""}
<line x1="14" y1="${cy}" x2="286" y2="${cy}" stroke="var(--rule)" stroke-width="1.5"/>
<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="${day ? "#f2c14e" : "#c5cadb"}" opacity=".28"/>
<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${day ? "#f2c14e" : "#e3e6ef"}" stroke="${day ? "#d99a1e" : "#7d86a3"}" stroke-width="1.5"/></svg>`;
  const left = day ? "Sunrise" : "Sunset", right = day ? "Sunset" : "Sunrise", mid = day ? `${tskDur(b - now)} of daylight left` : `${tskDur(b - now)} to sunrise`;
  return `<figure class="tsk-arc">${svg}<figcaption><span><small>${left}</small>${esc(tskT(a))}</span><b>${esc(mid)}</b><span class="r"><small>${right}</small>${esc(tskT(b))}</span></figcaption></figure>`;
}

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
  else if (peak && withRain.length >= 3) bits.push(`Dry until ${tskWhen(parts[parts.length - 1], td)}.`);
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
  if (peak) meters.push(tskMeter("Rain", peak.rain, "%", peak.rain >= 15 ? `Peak, ${tskWhen(peak, td).replace(/^this /, "")}` : "Dry ahead", peak.rain / 100, "tsk-wet"));
  else if (Number.isFinite(today?.rain_prob)) meters.push(tskMeter("Rain", Math.round(today.rain_prob), "%", "Today", today.rain_prob / 100, "tsk-wet"));
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
  return `<div class="tsky">${h}${stale}</div>`;
}
TRIAL_BLOCKS.sky = () => { const r = trialSafe("sky report", tskReport); const rest = skyBlock(); return r ? r + (rest ? `<div class="tsk-rest">${rest}</div>` : "") : rest; };

// ---------- (8) The Search Bar: what India and the world are typing into Google ----------
// Parth picked the Daily Index's Search Bar: a ranked list, each with a thin bar for its search volume, the volume, how
// long ago it took off, and the headline that explains it with its outlet. India and World tabs (World: the paper's
// own world list, the US, UK and Spain feeds mixed, each row named by its country). Top 7, "Show the top 10".
// Data: LIVE.trends (Google Trends), else the edition's own list (E.trends, no times). A row without a headline is left
// out. India keeps the rows in English or Hindi (most of India's list is in its own languages, which the paper cannot
// translate); World keeps the rows in the Latin alphabet, as the paper's Talk of the Day does.
const TSB = { tab: "IN", more: false };
// the paper fetches Google Trends only when the edition has no list of its own; The Search Bar always wants it live
TRIAL_KEYS.push(["trends", ""]);
const tsbLatin = t => /^[\x20-\x7E -ɏ‐-›₹]+$/.test(t || "");
const tsbHindi = t => /^[\x20-\x7E -ÿऀ-ॿ‐-›₹]+$/.test(t || "") && /[ऀ-ॿ]/.test(t || "");
const tsbHost = u => { try { return new URL(u).hostname.replace(/^(www|m|amp)\./, ""); } catch { return ""; } };
const tsbVol = t => String(t || "").replace(/\d+/, n => (n >= 1e6 ? +(n / 1e6).toFixed(1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(1) + "K" : n));
const tsbAgo = ms => { const m = Math.round((Date.now() - ms) / 6e4); if (!(m >= 0) || m > 72 * 60) return ""; return m < 60 ? `${Math.max(1, m)}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
function tsbLists() {
  const G = LIVE.trends?.value?.geos;
  const cfg = CFG.trends || {}, inG = cfg.india_geo || "IN";
  if (G && Object.values(G).some(l => l?.length)) {
    const row = (t, ok, geo) => {
      if (!t?.term || !ok(t.term)) return null;
      const n = (t.news || []).find(x => x?.title && ok(x.title)); if (!n) return null;
      return { term: t.term, traffic: t.traffic, vol: volumeOf(t.traffic), head: n.title, url: n.url, source: n.source || tsbHost(n.url), ago: tsbAgo(Date.parse(t.published)), geo };
    };
    const seen = new Set(), uniq = r => r && !seen.has(r.term.toLowerCase()) && seen.add(r.term.toLowerCase());
    const byVol = l => l.map((r, i) => ({ r, i })).sort((a, b) => b.r.vol - a.r.vol || a.i - b.i).map(x => x.r).slice(0, 10);
    const india = byVol((G[inG] || []).map(t => row(t, x => tsbLatin(x) || tsbHindi(x))).filter(uniq));
    const geos = (cfg.world_geos || ["US"]).filter(g => G[g]?.length), mixed = [];
    for (let i = 0; i < 20; i++) for (const g of geos) if (G[g][i]) mixed.push(row(G[g][i], tsbLatin, g));
    return { IN: india, WORLD: byVol(mixed.filter(uniq)), live: true };
  }
  const T = E?.trends; if (!T) return null;
  const ed = (l, world) => (l || []).filter(t => t?.term && t.what).map(t => ({ term: t.term, traffic: t.traffic, vol: volumeOf(t.traffic), head: t.what, url: t.url, source: tsbHost(t.url), ago: "", geo: world ? t.geo : null })).sort((a, b) => b.vol - a.vol).slice(0, 10);
  return { IN: ed(T.india), WORLD: ed(T.world, true), live: false };
}
function tsbBlock() {
  const L = tsbLists(); if (!L || (!L.IN.length && !L.WORLD.length)) return "";
  const tabs = [["IN", "India"], ["WORLD", "World"]].filter(([k]) => L[k].length);
  const tab = tabs.some(([k]) => k === TSB.tab) ? TSB.tab : tabs[0][0], list = L[tab];
  const vols = list.map(r => r.vol).filter(v => v > 0), lo = 2, hi = Math.log10(Math.max(1000, ...vols));
  const w = v => (v > 0 ? Math.max(6, Math.min(100, ((Math.log10(Math.max(v, 100)) - lo) / (hi - lo)) * 100)) : 0);
  const fresh = L.live && !LIVE.trends?.stale;
  const rows = list.map((r, i) => `<li class="tsb-r${i >= 7 ? " x" : ""}"><span class="tsb-n tnum">${String(i + 1).padStart(2, "0")}</span><div class="tsb-b"><p class="tsb-t"><b>${esc(r.term === r.term.toLowerCase() ? r.term[0].toUpperCase() + r.term.slice(1) : r.term)}</b>${r.geo ? `<span class="tsb-g">${esc(countryName(r.geo))}</span>` : ""}<span class="tsb-v tnum">${[r.traffic ? esc(tsbVol(r.traffic)) : "", r.ago ? esc(r.ago) : ""].filter(Boolean).join(", ")}</span></p>${r.vol > 0 ? `<i class="tsb-bar" aria-hidden="true"><i style="width:${w(r.vol).toFixed(1)}%"></i></i>` : ""}<p class="tsb-h">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.head)}</a>` : esc(r.head)}${r.source ? ` <span class="tsb-s">${esc(r.source)}</span>` : ""}</p></div></li>`).join("");
  const more = list.length > 7 ? `<button type="button" class="tsb-more" aria-expanded="${TSB.more}">${TSB.more ? "Show the top 7" : `Show the top ${list.length}`}</button>` : "";
  const when = L.live && LIVE.trends?.as_of ? (fresh ? `<span class="tsb-live"><i></i>Live</span>` : `<span class="tsb-asof">${esc(agoIST(LIVE.trends.as_of))}</span>`) : "";
  return `<div class="tsb${TSB.more ? " open" : ""}"><div class="tsb-top"><div class="tsb-tabs" role="tablist" aria-label="Searches from">${tabs.map(([k, n]) => `<button type="button" role="tab" class="tsb-tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join("")}</div>${when}</div>
<ol class="tsb-list">${rows}</ol>${more}${aboutFig(L.live ? "Google Trends, the last 24 hours, with a headline for each search; the bar is the search volume. India shows the searches in English and Hindi; World mixes the US, UK and Spain." : "Searches from Google Trends, as the edition printed them; the bar is the search volume.")}</div>`;
}
TRIAL_BLOCKS.talk = () => trialSafe("search bar", tsbBlock) || (typeof talkBlock === "function" ? talkBlock() : "");

function tsbRepaint(btn, sel) {
  const el = btn.closest('[data-live="talk"]'); if (!el) return;
  const html = tsbBlock(); el.innerHTML = html; el.dataset.html = html;
  el.querySelector(sel)?.focus();
}
function trialSearchBar() {
  const s = document.getElementById("talk"); if (!s) return;
  const h = s.querySelector(".sechead h2"); if (h && h.textContent !== "The Search Bar") h.textContent = "The Search Bar";
  const sub = s.querySelector(".sechead h2 + span"); const want = "What India and the world are typing into Google";
  if (sub && sub.textContent !== want) sub.textContent = want;
  if (document.documentElement.dataset.tsb) return;
  document.documentElement.dataset.tsb = "1";
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
