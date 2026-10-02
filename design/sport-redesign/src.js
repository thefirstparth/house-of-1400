// Sport, redesigned (mock, 2 Oct 2026). Three concepts over the same real data (DATA, from build.mjs).
const D = DATA, NOW = Date.parse(D.clock), IST = { timeZone: "Asia/Kolkata" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tm = at => new Date(at).toLocaleTimeString("en-GB", { ...IST, hour: "2-digit", minute: "2-digit", hour12: false });
const dk = at => new Date(at).toLocaleDateString("en-CA", IST);
const dname = at => { const k = dk(at); return k === dk(NOW) ? "Today" : k === dk(NOW + 864e5) ? "Tomorrow" : new Date(at).toLocaleDateString("en-GB", { ...IST, weekday: "short", day: "numeric", month: "short" }); };
const when = at => `${dname(at)}, ${tm(at)}`;
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const TEAMC = { Mercedes: "#27F4D2", "Red Bull": "#3671C6", Ferrari: "#E8002D", McLaren: "#FF8000", "Aston Martin": "#229971", Alpine: "#0093CC", Williams: "#64C4FF", "RB F1 Team": "#6692FF", "Racing Bulls": "#6692FF", Haas: "#B6BABD", "Haas F1 Team": "#B6BABD", Sauber: "#52E252", Audi: "#52E252", Cadillac: "#C8A2C8" };
const sw = team => `<i class="sw" style="background:${TEAMC[team] || "var(--muted)"}"></i>`;
const fc = m => (m ? `<div class="fc"><span class="k">Forecast</span>${m.outs.map((o, i) => `<span class="o">${i ? "" : "<b>"}${esc(o[0])} ${Math.round(o[1])}%${i ? "" : "</b>"}</span>`).join("")}</div>` : "");
const formDots = f => `<span class="form">${(f || []).map(x => `<i class="${x}">${x}</i>`).join("")}</span>`;
const M = D.madrid, F1 = D.f1, CR = D.cricket;
const us = M?.table?.find(r => r.us), topR = M?.table?.[0];
const nextSession = F1?.race.sessions.find(s => Date.parse(s.at) > NOW);
const playerIn = text => D.tennis.find(p => text && text.includes(p.name.split(" ").pop()));

// ---------------------------------------------------------------- the context each story carries (the dilemma: news
// about Madrid is read knowing their next match and where they stand)
function ctx(s) {
  const t = s.team, txt = `${s.headline} ${s.short || ""}`;
  if (t === "madrid" && M) { const n = M.next[0]; return `<div class="ctx"><span><span class="dot"></span><b>${ord(us.rank)}</b> in La Liga, ${us.pts} pts${topR && !topR.us ? `, ${topR.pts - us.pts} behind ${esc(topR.team)}` : ""}</span><span>Form ${formDots(M.form)}</span>${n ? `<span>Next: <b>${n.home ? "v" : "at"} ${esc(n.opp)}</b> · ${esc(when(n.at))}${n.where ? ` · ${esc(n.where)}` : ""}</span>` : ""}</div>`; }
  if (t === "f1" && F1) return `<div class="ctx"><span><span class="dot"></span>Verstappen <b>P${F1.max.pos}</b>, ${F1.max.pts} pts, ${F1.max.behind} behind</span>${nextSession ? `<span>Next: <b>${esc(nextSession.name)}</b> · ${esc(when(nextSession.at))} · FanCode</span>` : ""}</div>`;
  if (t === "cricket" && CR?.next) return `<div class="ctx"><span><span class="dot"></span>Next: <b>India v ${esc(CR.next.opp)}</b> · ${esc(CR.next.desc)} · ${esc(when(CR.next.at))}</span>${(D.creaseRows || []).filter(r => !r.on).slice(0, 1).map(r => `<span>${esc(r.label)}: ${esc(r.text)}</span>`).join("")}</div>`;
  if (t === "tennis") { const p = playerIn(txt) || D.tennis[0]; return p?.next ? `<div class="ctx"><span><span class="dot"></span>${esc(p.name.split(" ").pop())} next: <b>v ${esc(p.next.opp)}</b> · ${esc(p.next.event)}, ${esc(p.next.round)} · ${esc(when(p.next.at))}</span></div>` : ""; }
  if (t === "football") { const n = D.intl.find(m => m.state === "pre" && txt.includes(m.home) || m.state === "pre" && txt.includes(m.away)); return n ? `<div class="ctx"><span><span class="dot"></span>Next: <b>${esc(n.home)} v ${esc(n.away)}</b> · ${esc(when(n.at))}</span></div>` : ""; }
  if (t === "other") { const f = D.fixtures.find(f => f.entity === "india_other" && Date.parse(f.at) > NOW - 3 * 36e5); return f ? `<div class="ctx"><span><span class="dot"></span>Next: <b>${esc(f.label.replace(/^Asian Games /, ""))}</b> · ${esc(when(f.at))}</span></div>` : ""; }
  return "";
}
function storyHTML(s, { lead = false, withCtx = true, art = true } = {}) {
  const k = `<span class="lab">${esc(s.kicker || "")}${s.update ? " · Update" : ""}</span>`, why = s.why ? `<p class="whyb"><b>Why it matters</b>${esc(s.why)}</p>` : "", src = s.sources ? `<span class="src">${esc(s.sources)}</span>` : "";
  if (lead && s.art) return `<article class="story lead">${k}<h4>${esc(s.headline)}</h4>${withCtx ? ctx(s) : ""}<div class="art"><figure style="margin:0"><img src="${s.art}" alt=""><p class="cap">Illustration by Bunty Brushwala</p></figure><div><p>${esc(s.short)}</p>${why}${src}</div></div></article>`;
  if (art && s.art && s.kind === "story") return `<article class="story withart"><img src="${s.art}" alt=""><div>${k}<h4>${esc(s.headline)}</h4>${withCtx ? ctx(s) : ""}<p>${esc(s.short)}</p>${why}${src}</div></article>`;
  return `<article class="story ${s.kind}">${k}<h4>${esc(s.headline)}</h4>${withCtx && s.kind !== "line" ? ctx(s) : ""}${s.short && s.kind !== "line" ? `<p>${esc(s.short)}</p>` : ""}${s.kind === "story" ? why : ""}${src}</article>`;
}
// the paper's reading order for Sport news: the lead, the stories by section order, then briefs and lines
const ORDER = ["sidelines", "madrid", "paddock", "crease", "deuce", "pitch"];
const news = [...D.stories].sort((a, b) => (b.lead - a.lead) || ({ story: 0, brief: 1, line: 2 }[a.kind] - { story: 0, brief: 1, line: 2 }[b.kind]) || ORDER.indexOf(a.section) - ORDER.indexOf(b.section));

// ---------------------------------------------------------------- what's on next: the week, one chip per event
const SPORTOF = f => /cricket/.test(f.entity) ? "Cricket" : /f1/.test(f.entity) ? "F1" : /tennis/.test(f.entity) ? "Tennis" : /madrid|football/.test(f.entity) ? "Football" : "India";
function week({ max = 9 } = {}) {
  const ev = D.fixtures.filter(f => Date.parse(f.at) > NOW - 2 * 36e5).sort((a, b) => a.at.localeCompare(b.at)).slice(0, max);
  return `<div class="week" role="list">${ev.map(f => { const live = Date.parse(f.at) <= NOW; return `<div class="ev${live ? " now" : ""}" role="listitem"><span class="when tn">${live ? "On now" : esc(when(f.at))}<span>${SPORTOF(f)}</span></span><span class="what">${esc(f.label.replace(/^Asian Games /, "").replace(/ · Kinoshita Group Japan Open Tennis Championships/, " · Japan Open"))}</span>${f.where ? `<span class="on">on ${esc(f.where)}</span>` : ""}</div>`; }).join("")}</div>`;
}

// ---------------------------------------------------------------- team cards (compact: next, last, standing)
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v, s]) => `<dt>${k}</dt><dd>${v}${s ? `<small>${s}</small>` : ""}</dd>`).join("")}</dl>`;
const CARDS = {
  madrid: () => M && `<div class="tcard"><div class="hd"><h5>Real Madrid</h5><button data-open="madrid">Tables and fixtures</button></div>${kv([
    ["Next", `<b>${M.next[0].home ? "v" : "at"} ${esc(M.next[0].opp)}</b> · ${esc(M.next[0].comp)}`, `${esc(when(M.next[0].at))}${M.next[0].where ? ` · ${esc(M.next[0].where)}` : ""}`],
    M.last && ["Last", `<b>${M.last.res} ${M.last.us}–${M.last.them}</b> ${M.last.home ? "v" : "at"} ${esc(M.last.opp)}`, `${esc(M.last.comp)} · ${formDots(M.form)}`],
    ["Table", `<span class="pos">${ord(us.rank)}</span> in La Liga`, `${us.pts} pts${topR.us ? "" : `, ${topR.pts - us.pts} behind ${esc(topR.team)}`}`],
  ])}${fc(M.market)}</div>`,
  f1: () => F1 && `<div class="tcard f1c"><div class="hd"><h5>Formula 1</h5><button data-open="f1">Standings and results</button></div>${kv([
    ["Next", `<b>${esc(F1.race.flag)} ${esc(F1.race.name.replace(" Grand Prix", " GP"))}</b>${nextSession ? ` · ${esc(nextSession.name)}` : ""}`, nextSession ? `${esc(when(nextSession.at))} · race ${esc(when(F1.race.sessions.at(-1).at))}` : ""],
    F1.last && ["Last", `<b>${esc(F1.last.flag)} ${esc(F1.last.name)}</b>: ${F1.last.results.slice(0, 3).map(r => esc(r.code)).join(", ")}`, `Verstappen ${ord(F1.last.results.find(r => r.code === "VER")?.pos || 0)}`],
    ["Max", `<span class="pos">P${F1.max.pos}</span> ${F1.max.pts} pts`, `${F1.max.behind} behind ${esc(F1.max.leader.split(" ").pop())}`],
  ])}${fc(F1.market)}</div>`,
  cricket: () => CR && `<div class="tcard"><div class="hd"><h5>India cricket</h5><button data-open="cricket">Series and results</button></div>${kv([
    CR.next && ["Next", `<b>v ${esc(CR.next.opp)}</b> · ${esc(CR.next.desc)}`, `${esc(when(CR.next.at))} · ${esc(CR.next.ground)}`],
    ...(D.creaseRows || []).filter(r => !r.on).slice(0, 2).map((r, i) => [/after/i.test(r.label) ? "After" : "Series", `<b>${esc(/after/i.test(r.label) ? "" : r.label + " · ")}</b>${esc(r.text)}`]),
  ])}${fc(CR.market)}</div>`,
  tennis: () => D.tennis.length && `<div class="tcard"><div class="hd"><h5>Tennis</h5><button data-open="tennis">Draws and results</button></div>${kv(D.tennis.map(p => [esc(p.name.split(" ").pop().slice(0, 7)), p.next ? `<b>v ${esc(p.next.opp)}</b> · ${esc(p.next.round)}` : "No match set", p.next ? `${esc(when(p.next.at))} · ${esc(p.next.event.replace("Kinoshita Group Japan Open Tennis Championships", "Japan Open"))}${p.last ? ` · last: ${p.last.won ? "won" : "lost"} v ${esc(p.last.opp)}` : ""}` : ""]))}${fc(D.tennisMarket)}</div>`,
  football: () => D.intl.length && `<div class="tcard"><div class="hd"><h5>Internationals</h5><button data-open="football">All results</button></div>${kv(D.intl.slice(0, 4).map(m => [m.state === "post" ? "Result" : "Next", m.state === "post" ? `<b>${esc(m.home)} ${esc(m.score)} ${esc(m.away)}</b>` : `<b>${esc(m.home)} v ${esc(m.away)}</b>`, m.state === "post" ? "" : esc(when(m.at))]))}</div>`,
  nba: () => D.nba && `<div class="tcard"><div class="hd"><h5>Warriors</h5></div>${kv(D.nba.next.slice(0, 1).map(g => ["Next", `<b>${g.home ? "v" : "at"} ${esc(g.opp)}</b>${D.nba.preseason ? " · preseason" : ""}`, esc(when(g.at))]))}</div>`,
};

// ---------------------------------------------------------------- the full data, per team (on demand)
const FULL = {
  madrid: () => M && `<div class="panel"><h4>Real Madrid</h4><h6>Next four</h6><table class="tbl"><tbody>${M.next.map(n => `<tr><td>${n.home ? "v" : "at"} <b>${esc(n.opp)}</b></td><td class="muted">${esc(n.comp)}</td><td class="r">${esc(when(n.at))}</td><td class="muted">${esc(n.where || "")}</td></tr>`).join("")}</tbody></table>
<h6>La Liga</h6><table class="tbl"><thead><tr><th>#</th><th>Club</th><th class="r">P</th><th class="r">W</th><th class="r">D</th><th class="r">L</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${M.table.slice(0, 7).map(r => `<tr class="${r.us ? "us" : ""}"><td>${r.rank}</td><td>${esc(r.team)}</td><td class="r">${r.p}</td><td class="r">${r.w}</td><td class="r">${r.d}</td><td class="r">${r.l}</td><td class="r">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="r"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table>${fc(M.market)}</div>`,
  f1: () => F1 && `<div class="panel f1"><h4>${esc(F1.race.flag)} ${esc(F1.race.name)}</h4><p class="muted" style="margin:0 0 6px;font:500 13px var(--sans)">Round ${F1.race.round} · ${esc(F1.race.circuit)} · ${esc(F1.race.place)} · FanCode</p>
<div class="sess">${F1.race.sessions.map(s => { const done = Date.parse(s.at) + 3600e3 < NOW, nx = s === nextSession; return `<span class="${done ? "done" : nx ? "nx" : ""}">${esc(s.name)}</span><span class="tn ${done ? "done" : nx ? "nx" : ""}">${esc(when(s.at))}</span>`; }).join("")}</div>
<h6>Drivers</h6><table class="tbl"><tbody>${F1.drivers.map(d => `<tr class="${d.code === "VER" ? "us" : ""}"><td class="r" style="width:24px">${d.pos}</td><td>${sw(d.team)}${esc(d.name)}</td><td class="muted">${esc(d.team)}</td><td class="r"><b>${d.pts}</b></td></tr>`).join("")}</tbody></table>
${F1.last ? `<h6>Last race · ${esc(F1.last.flag)} ${esc(F1.last.name)}</h6><table class="tbl"><tbody>${F1.last.results.map(r => `<tr class="${r.code === "VER" ? "us" : ""}"><td class="r" style="width:24px">${r.pos}</td><td>${sw(r.team)}${esc(r.name)}</td><td class="r muted">${esc(r.time)}</td></tr>`).join("")}</tbody></table>` : ""}
<h6>Constructors</h6><table class="tbl"><tbody>${F1.constructors.map(c => `<tr><td class="r" style="width:24px">${c.pos}</td><td>${sw(c.name)}${esc(c.name)}</td><td class="r"><b>${c.pts}</b></td></tr>`).join("")}</tbody></table>
<h6>Next races</h6><div class="chips">${F1.upcoming.map(u => `<span class="chip"><b>${esc(u.flag)} ${esc(u.name)}</b>R${u.round} · ${esc(dname(u.at))}</span>`).join("")}</div>${fc(F1.market)}</div>`,
  cricket: () => CR && `<div class="panel"><h4>India cricket</h4>${CR.next ? `<p style="margin:0 0 8px;font:500 14px var(--sans)"><b>Next: India v ${esc(CR.next.opp)}</b> · ${esc(CR.next.desc)} · ${esc(when(CR.next.at))} · ${esc(CR.next.ground)}</p>` : ""}
${CR.series.map(s => `<h6>${esc(s.name)}</h6>${s.formats.map(f => `<div class="chips" style="margin-bottom:6px">${f.matches.map(m => `<span class="chip${m.state === "next" ? " on" : ""}"><b>${esc(m.desc || f.label)}</b>${esc(m.status || (m.at ? when(m.at) : ""))}</span>`).join("")}</div>`).join("")}`).join("")}
${CR.knockouts.length ? `<h6>Knockouts</h6><table class="tbl"><tbody>${CR.knockouts.map(k => `<tr class="${k.india ? "us" : ""}"><td class="muted">${esc(k.stage)}</td><td>${esc(k.teams.join(" v "))}</td><td class="r">${esc(k.status || "")}</td></tr>`).join("")}</tbody></table>` : ""}
${CR.after ? `<p class="muted" style="font:500 13px var(--sans);margin:8px 0 0">After this: ${esc(CR.after.name)}</p>` : ""}${fc(CR.market)}</div>`,
  tennis: () => `<div class="panel"><h4>Tennis</h4>${D.tennis.map(p => `<h6>${esc(p.name)}</h6><p style="margin:0;font:500 14px/1.45 var(--sans)">${p.next ? `<b>Next: v ${esc(p.next.opp)}</b> · ${esc(p.next.event)}, ${esc(p.next.round)} · ${esc(when(p.next.at))}${p.next.court ? ` · ${esc(p.next.court)}` : ""}` : ""}<br><span class="muted">${p.last ? esc(p.last.note || `${p.last.won ? "Won" : "Lost"} v ${p.last.opp}`) : ""}</span></p>`).join("")}${fc(D.tennisMarket)}</div>`,
  football: () => `<div class="panel"><h4>Internationals</h4><table class="tbl"><tbody>${D.intl.map(m => `<tr><td class="muted">${esc(dname(m.at))}</td><td>${esc(m.home)}</td><td class="r"><b>${m.state === "post" ? esc(m.score) : "v"}</b></td><td>${esc(m.away)}</td><td class="muted">${esc(m.league.replace("uefa.nations", "Nations League").replace("fifa.friendly", "Friendly"))}</td></tr>`).join("")}</tbody></table></div>`,
  nba: () => D.nba && `<div class="panel"><h4>Golden State Warriors</h4><table class="tbl"><tbody>${D.nba.next.map(g => `<tr><td>${g.home ? "v" : "at"} <b>${esc(g.opp)}</b></td><td class="r">${esc(when(g.at))}</td><td class="muted">${D.nba.preseason ? "preseason" : ""}</td></tr>`).join("")}</tbody></table></div>`,
};
const NAMES = { madrid: "Real Madrid", f1: "Formula 1", cricket: "India cricket", tennis: "Tennis", football: "Internationals", nba: "Warriors" };

// ---------------------------------------------------------------- the chrome around every concept
const chrome = body => `<div class="pad"><div class="mh"><span><span class="np">The House of<b>1400</b></span></span><span>Friday 2 October · No. ${D.edition} · Printed 14:15 IST</span></div>
<nav class="tabs">${[["one", "Page One"], ["news", "News"], ["home", "Close to Home"], ["sport", "Sport"], ["tech", "Tech & AI"], ["money", "Money"], ["off", "Off Duty"]].map(([id, n]) => `<a style="--c:var(--d-${id})" class="${id === "sport" ? "on" : ""}">${n}</a>`).join("")}</nav>${body}</div>`;
const counts = `${D.stories.filter(s => s.kind === "story").length} stories · ${D.stories.filter(s => s.kind !== "story").length} briefs · ${D.fixtures.length} fixtures this week`;

// ---------------------------------------------------------------- A · The back page: the stories, with your teams beside
const A = {
  name: "A · The back page",
  why: `<b>The news reads first, the data rides alongside.</b> One stream of stories across every sport, best first, the way a back page runs. Each story carries a one-line context bar: where the team stands and what is next. Beside it, a rail of small cards, one per team you follow: next, last, standing, the forecast. The full tables and results open from each card in a drawer, so they are a tap away and never in the way. The week runs across the top. Phone: the week, then the cards side by side to swipe, then the stories.`,
  html: () => chrome(`<div class="deskhd"><h2>Sport</h2><span class="sub">${counts}</span></div>${week()}
<div class="ca"><div class="main">${news.map((s, i) => storyHTML(s, { lead: i === 0 })).join("")}</div>
<aside class="rail"><div class="railhd"><b>Your teams</b><span>live · tap for the full data</span></div><div class="cards">${["madrid", "f1", "cricket", "tennis", "football", "nba"].map(k => CARDS[k]()).filter(Boolean).join("")}</div></aside></div>`),
};

// ---------------------------------------------------------------- B · Stories | Scoreboard: two views of one desk
const UP = () => `<div class="upnext">${[
  M && ["Real Madrid", `${M.next[0].home ? "v" : "at"} ${M.next[0].opp}`, `${when(M.next[0].at)} · ${ord(us.rank)} in La Liga`],
  F1 && nextSession && ["F1", `${nextSession.name}, ${F1.race.name.replace(" Grand Prix", "")}`, `${when(nextSession.at)} · Max P${F1.max.pos}`],
  CR?.next && ["India", `v ${CR.next.opp}, ${CR.next.desc}`, when(CR.next.at)],
  ...D.tennis.filter(p => p.next).slice(0, 2).map(p => [p.name.split(" ").pop(), `v ${p.next.opp}`, `${when(p.next.at)} · ${p.next.round}`]),
].filter(Boolean).slice(0, 5).map(([t, w, s]) => `<div class="u"><span class="t">${esc(t)}</span><span class="w">${esc(w)}</span><span class="s">${esc(s)}</span></div>`).join("")}</div>`;
const B = {
  name: "B · Stories and Scoreboard",
  why: `<b>Two views of one desk, your call each time.</b> <i>Stories</i> is the news alone, set like a newspaper page, with a strip of what is next for each team across the top and the same context bar on every story, so a Madrid story never reads blind. <i>Scoreboard</i> is the data alone, as an almanac: every team in one panel of the same shape (next, last, table, results), all on one screen on a laptop. Page One's "Sport this week" opens the Scoreboard; a story's context bar links to its team's panel.`,
  tab: "stories",
  html() { return chrome(`<div class="deskhd"><h2>Sport</h2><span class="sub">${counts}</span></div><div class="subtabs" role="tablist"><button role="tab" data-tab="stories" aria-selected="${this.tab === "stories"}">Stories</button><button role="tab" data-tab="board" aria-selected="${this.tab === "board"}">Scoreboard</button><span class="hint">${this.tab === "stories" ? "The news. Scores, tables and fixtures are on the Scoreboard." : "The data. The news is under Stories."}</span></div>
${this.tab === "stories" ? `${UP()}<div class="cb-stories"><div class="colA">${storyHTML(news[0], { lead: true })}</div><div>${news.slice(1).filter((_, i) => i % 2 === 0).map(s => storyHTML(s, { art: true })).join("")}</div><div>${news.slice(1).filter((_, i) => i % 2 === 1).map(s => storyHTML(s, { art: true })).join("")}</div></div>`
  : `${week({ max: 12 })}<div class="board">${FULL.madrid()}${FULL.f1()}${FULL.cricket()}${FULL.tennis()}${FULL.football()}${FULL.nba() || ""}</div>`}`); },
};

// ---------------------------------------------------------------- C · Team rooms: each team its own room, news inside
const tiles = k => {
  if (k === "madrid" && M) return [["Next", `${M.next[0].home ? "v" : "at"} ${M.next[0].opp}`, `${when(M.next[0].at)}${M.next[0].where ? ` · ${M.next[0].where}` : ""}`], M.last && ["Last", `${M.last.res} ${M.last.us}–${M.last.them} ${M.last.home ? "v" : "at"} ${M.last.opp}`, M.last.comp], ["La Liga", `${ord(us.rank)} · ${us.pts} pts`, topR.us ? "top" : `${topR.pts - us.pts} behind ${topR.team}`], M.market && ["Forecast", `${M.market.outs[0][0]} ${Math.round(M.market.outs[0][1])}%`, `v ${M.next[0].opp}`]];
  if (k === "f1" && F1) return [["Next", nextSession ? nextSession.name : "Race", nextSession ? when(nextSession.at) : ""], ["Race", F1.race.name.replace(" Grand Prix", " GP"), when(F1.race.sessions.at(-1).at)], ["Max", `P${F1.max.pos} · ${F1.max.pts} pts`, `${F1.max.behind} behind`], F1.last && ["Last race", `${F1.last.name}`, F1.last.results.slice(0, 3).map(r => r.code).join(" · ")]];
  if (k === "cricket" && CR) return [CR.next && ["Next", `v ${CR.next.opp}`, `${CR.next.desc} · ${when(CR.next.at)}`], ...(D.creaseRows || []).filter(r => !r.on).slice(0, 2).map(r => [r.label, r.text.split(" · ").slice(0, 2).join(" · "), r.text.split(" · ").slice(2).join(" · ")]), CR.market && ["Forecast", `${CR.market.outs[1]?.[0] || ""} ${Math.round(CR.market.outs[1]?.[1] || 0)}%`, "v " + CR.next?.opp]];
  if (k === "tennis") return [...D.tennis.map(p => [p.name.split(" ").pop(), p.next ? `v ${p.next.opp}` : "no match", p.next ? `${when(p.next.at)} · ${p.next.round}` : ""]), D.tennisMarket && ["Forecast", `${D.tennisMarket.outs[0][0]} ${Math.round(D.tennisMarket.outs[0][1])}%`, D.tennisMarket.title.split(":")[0]]];
  if (k === "football") return D.intl.slice(0, 3).map(m => [m.state === "post" ? "Result" : "Next", m.state === "post" ? `${m.home} ${m.score} ${m.away}` : `${m.home} v ${m.away}`, m.state === "post" ? "" : when(m.at)]);
  return [];
};
const SOON = k => ({ madrid: M?.next[0]?.at, f1: nextSession?.at, cricket: CR?.next?.at, tennis: D.tennis.map(p => p.next?.at).filter(Boolean).sort()[0], football: D.intl.find(m => m.state === "pre")?.at })[k] || "9999";
const ROOMSUB = { madrid: "La Liga · Champions League", f1: "Verstappen and the championship", cricket: "India men, senior team", tennis: "Alcaraz and Djokovic", football: "Portugal, Brazil, Spain, England" };
const C = {
  name: "C · Team rooms",
  why: `<b>Everything about a team in one place, with the data on a strict diet.</b> After the week strip, each team you follow gets a room, ordered by whose next match is soonest. A room opens with a row of four tiles (next, last, standing, forecast), then that team's stories. The tables, full results and schedules sit in the room's own tabs, closed until you open them. A team with no news today shrinks to its tiles, one line, so a quiet day is short. Everything else (the Asian Games, the NBA) runs last.`,
  open: {},
  html() {
    const keys = ["madrid", "f1", "cricket", "tennis", "football"].sort((a, b) => SOON(a).localeCompare(SOON(b)));
    const lead = news[0];
    const room = k => {
      const st = news.filter(s => s.team === k && s !== lead), t = tiles(k).filter(Boolean), open = this.open[k];
      const tabsFor = { madrid: [["table", "La Liga table"], ["fix", "Fixtures"]], f1: [["drivers", "Standings"], ["last", "Last race"], ["week", "This weekend"]], cricket: [["series", "Series"]], tennis: [["draws", "Draws"]], football: [["res", "All results"]] }[k] || [];
      return `<section class="room${st.length ? "" : " quiet"}"><div class="rh"><h3>${NAMES[k]}<small>${ROOMSUB[k]}</small></h3><div class="tiles">${t.map(([a, b, c]) => `<div class="tile"><span class="k">${esc(a)}</span><span class="v">${esc(b)}</span><span class="s">${esc(c || "")}</span></div>`).join("")}</div></div>
${st.length ? `<div class="rb"><div>${st.map(s => storyHTML(s, { withCtx: false })).join("")}</div><div>${k === "f1" && D.f1Preview ? `<p class="lab ink" style="margin:12px 0 4px">The race ahead</p><p style="margin:0;font:15px/1.5 var(--serif)">${esc(D.f1Preview)}</p>` : ""}</div></div>` : ""}
<div class="dtabs" role="tablist">${tabsFor.map(([id, n]) => `<button role="tab" data-room="${k}" data-pane="${id}" aria-selected="${open === id}">${n}</button>`).join("")}</div>${open ? `<div class="dpane">${this.pane(k, open)}</div>` : ""}</section>`;
    };
    const rest = news.filter(s => s.team === "other" && s !== lead);
    return chrome(`<div class="deskhd"><h2>Sport</h2><span class="sub">${counts}</span></div>${week()}${storyHTML(lead, { lead: true })}${keys.map(room).join("")}
<section class="room"><div class="rh"><h3>Everything else<small>Other sport, when it matters</small></h3><div class="tiles">${D.nba ? `<div class="tile"><span class="k">Warriors</span><span class="v">${D.nba.next[0].home ? "v" : "at"} ${esc(D.nba.next[0].opp)}</span><span class="s">${esc(when(D.nba.next[0].at))} · preseason</span></div>` : ""}</div></div>${rest.length ? `<div>${rest.map(s => storyHTML(s)).join("")}</div>` : ""}</section>`);
  },
  pane(k, id) {
    const div = document.createElement("div");
    if (k === "madrid") { div.innerHTML = FULL.madrid(); const t = div.querySelectorAll("table"); return id === "table" ? t[1].outerHTML : t[0].outerHTML; }
    if (k === "f1") { div.innerHTML = FULL.f1(); const p = div.querySelector(".panel"), t = p.querySelectorAll("table"); return id === "drivers" ? t[0].outerHTML + "<h6 class='lab ink' style='margin:10px 0 4px'>Constructors</h6>" + t[2].outerHTML : id === "last" ? t[1].outerHTML : p.querySelector(".sess").outerHTML + `<div class="chips" style="margin-top:8px">${p.querySelector(".chips").innerHTML}</div>`; }
    div.innerHTML = FULL[k](); const p = div.querySelector(".panel"); p.querySelector("h4")?.remove(); return p.innerHTML;
  },
};

// ---------------------------------------------------------------- the stage: concept, screen, theme, and the numbers
const CONCEPTS = { A, B, C };
let cur = location.hash.match(/[ABC]/)?.[0] || "A", dev = /phone/.test(location.hash) ? "phone" : "laptop";
function render() {
  const c = CONCEPTS[cur], st = document.getElementById("stage");
  st.innerHTML = `<div class="wrap"><div class="frame ${dev}">${c.html()}<div class="drawer" id="drawer"><button class="x" aria-label="Close">×</button><div class="dc"></div></div></div></div>`;
  const f = st.querySelector(".frame");
  if (dev === "laptop") { const z = Math.min(1, st.clientWidth / 1440); f.style.zoom = z; }
  document.querySelectorAll("#concepts button").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === cur));
  document.querySelectorAll("#devices button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === dev));
  // how tall the page is on this screen, and how much of it is news
  requestAnimationFrame(() => {
    const z = parseFloat(f.style.zoom) || 1, h = e => e.getBoundingClientRect().height / z, screen = dev === "laptop" ? 830 : 760;
    const total = h(f), newsH = [...f.querySelectorAll(".story")].reduce((a, e) => a + h(e), 0), dataH = [...f.querySelectorAll(".week,.tcard,.panel,.upnext,.tiles,.ctx,.dpane")].filter(e => !e.parentElement.closest(".tcard,.panel,.dpane")).reduce((a, e) => a + h(e), 0);
    const firstStory = f.querySelector(".story")?.getBoundingClientRect().top - f.getBoundingClientRect().top;
    document.getElementById("why").innerHTML = `${c.why}<br><span class="stat">Page: <b>${(total / screen).toFixed(1)}</b> screens tall on ${dev === "laptop" ? "a MacBook Air" : "an iPhone"}</span><span class="stat">News <b>${Math.round(100 * newsH / (newsH + dataH))}%</b> · data <b>${Math.round(100 * dataH / (newsH + dataH))}%</b> of what shows</span><span class="stat">First story <b>${Math.round(firstStory / z)}px</b> from the top</span><span class="stat">Today's Sport desk: 8.6 screens, news 26%</span>`;
  });
}
document.getElementById("concepts").innerHTML = Object.entries(CONCEPTS).map(([k, c]) => `<button type="button" data-c="${k}">${c.name}</button>`).join("");
document.getElementById("devices").innerHTML = `<button type="button" data-d="laptop">Laptop</button><button type="button" data-d="phone">Phone</button>`;
document.addEventListener("click", e => {
  const c = e.target.closest("[data-c]"), d = e.target.closest("[data-d]"), o = e.target.closest("[data-open]"), x = e.target.closest(".drawer .x"), tb = e.target.closest("[data-tab]"), rp = e.target.closest("[data-pane]");
  if (c) { cur = c.dataset.c; render(); } if (d) { dev = d.dataset.d; render(); }
  if (o) { const dr = document.getElementById("drawer"); dr.querySelector(".dc").innerHTML = FULL[o.dataset.open](); dr.classList.add("on"); }
  if (x) document.getElementById("drawer").classList.remove("on");
  if (tb) { B.tab = tb.dataset.tab; render(); }
  if (rp) { const k = rp.dataset.room, id = rp.dataset.pane; C.open[k] = C.open[k] === id ? null : id; render(); }
});
document.getElementById("theme").addEventListener("click", () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"; document.getElementById("theme").textContent = r.dataset.theme === "dark" ? "Day" : "Night"; });
addEventListener("resize", render);
document.fonts.ready.then(render);
