// Live data sources. Every getter returns {ok, value, source, as_of, stale}.
// Primary, then backup. The browser falls back to the edition snapshot, then hides the field.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let CONFIG;
export function config() {
  if (!CONFIG) CONFIG = JSON.parse(readFileSync(join(process.cwd(), "config", "house.json"), "utf8"));
  return CONFIG;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

// Some hosts refuse a browser user-agent from cloud IPs (ESPN answers Vercel with 403), others refuse
// anything else. On 403 or 429, retry with the other identities before giving up.
const ALT_UAS = ["Mozilla/5.0", "house-of-1400/1.0 (+private newspaper)", null];

export async function getJSON(url, { timeout = 8000, headers = {} } = {}) {
  const tried = [];
  for (const ua of [headers["user-agent"] || UA, ...ALT_UAS.filter(u => u !== headers["user-agent"])]) {
    const h = { accept: "application/json", ...headers };
    if (ua) h["user-agent"] = ua; else delete h["user-agent"];
    const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(timeout) });
    if (r.ok) return r.json();
    tried.push(`${r.status}${ua ? "" : "(no ua)"}`);
    if (r.status !== 403 && r.status !== 429) break;
  }
  throw new Error(`${tried.join(",")} ${url}`);
}

export async function getText(url, { timeout = 8000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const ok = (value, source, as_of = new Date().toISOString()) => ({ ok: true, value, source, as_of, stale: false });
const fail = (error) => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(error?.message || error) });

async function chain(...attempts) {
  const errors = [];
  for (const a of attempts) {
    try { return await a(); } catch (e) { errors.push(String(e?.message || e)); }
  }
  return fail(errors.join(" | "));
}

// ---------------------------------------------------------------- weather
export const WMO = {
  0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"], 51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"], 61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"], 71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"],
  77: ["🌨️", "Snow grains"], 80: ["🌦️", "Showers"], 81: ["🌧️", "Heavy showers"], 82: ["⛈️", "Violent showers"],
  85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"], 95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm, hail"], 99: ["⛈️", "Thunderstorm, hail"],
};

async function openMeteo(lat, lon, hourly = false) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,precipitation,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum` +
    (hourly ? `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=36` : "") +
    `&timezone=Asia%2FKolkata&forecast_days=7`;
  const j = await getJSON(u);
  const c = j.current, d = j.daily;
  if (!c || !d?.time?.length || typeof c.temperature_2m !== "number") throw new Error("open-meteo shape");
  if (c.temperature_2m < -60 || c.temperature_2m > 60) throw new Error("open-meteo range");
  return {
    current: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, humidity: c.relative_humidity_2m, time: c.time },
    daily: d.time.map((t, i) => ({
      date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
      rain_prob: d.precipitation_probability_max?.[i] ?? null, rain_mm: d.precipitation_sum?.[i] ?? null,
    })),
    // Local IST times like "2026-09-25T17:00".
    hourly: j.hourly?.time ? j.hourly.time.map((t, i) => ({ time: t, temp: j.hourly.temperature_2m[i], rain_prob: j.hourly.precipitation_probability?.[i] ?? null, code: j.hourly.weather_code?.[i] ?? null })) : undefined,
  };
}

function notable(w) {
  return w.daily.slice(0, 3).some(d => (d.rain_prob ?? 0) >= 85 && (d.rain_mm ?? 0) >= 20 || d.max >= 42 || d.min <= 6 || [95, 96, 99, 65, 82].includes(d.code));
}

export async function weather(params) {
  const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  if (params.has("lat")) {
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return fail("bad coordinates");
    return chain(async () => ok({ cities: [{ name: "Your location", ...(await openMeteo(lat.toFixed(2), lon.toFixed(2), true)) }] }, "Open-Meteo"));
  }
  const cfg = config().weather;
  return chain(async () => {
    const always = await Promise.all(cfg.always.map(async (c, i) => ({ name: c.name, ...(await openMeteo(c.lat, c.lon, i === 0)) })));
    const extra = (await Promise.allSettled(cfg.when_notable.map(async c => ({ name: c.name, ...(await openMeteo(c.lat, c.lon)) }))))
      .filter(r => r.status === "fulfilled" && notable(r.value)).map(r => ({ ...r.value, notable: true }));
    return ok({ cities: [...always, ...extra] }, "Open-Meteo");
  });
}

// ---------------------------------------------------------------- F1
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const SESSION_KEYS = [["FirstPractice", "Practice 1", 60], ["SecondPractice", "Practice 2", 60], ["ThirdPractice", "Practice 3", 60],
  ["SprintQualifying", "Sprint Qualifying", 45], ["SprintShootout", "Sprint Shootout", 45], ["Sprint", "Sprint", 60], ["Qualifying", "Qualifying", 60]];
const COUNTRY_FLAG = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", USA: "🇺🇸", "United States": "🇺🇸", Italy: "🇮🇹", Monaco: "🇲🇨",
  Spain: "🇪🇸", Canada: "🇨🇦", Austria: "🇦🇹", UK: "🇬🇧", "United Kingdom": "🇬🇧", Hungary: "🇭🇺", Belgium: "🇧🇪", Netherlands: "🇳🇱",
  Azerbaijan: "🇦🇿", Malaysia: "🇲🇾", Korea: "🇰🇷", "South Korea": "🇰🇷", Turkey: "🇹🇷", "Türkiye": "🇹🇷", Vietnam: "🇻🇳", Russia: "🇷🇺", Singapore: "🇸🇬", Mexico: "🇲🇽", Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", "Abu Dhabi": "🇦🇪",
  "Las Vegas": "🇺🇸", Miami: "🇺🇸", Portugal: "🇵🇹", France: "🇫🇷", Germany: "🇩🇪", Argentina: "🇦🇷", India: "🇮🇳", Thailand: "🇹🇭",
};
export const flag = c => COUNTRY_FLAG[c] || "🏁";
const iso = (date, time) => (date ? `${date}T${time || "00:00:00Z"}`.replace(/Z?$/, "Z") : null);

function jolpicaRace(r) {
  const sessions = [];
  for (const [k, name, dur] of SESSION_KEYS) if (r[k]?.date) sessions.push({ name, start: iso(r[k].date, r[k].time), minutes: dur, time_confirmed: !!r[k].time });
  sessions.push({ name: "Race", start: iso(r.date, r.time), minutes: 120, time_confirmed: !!r.time });
  sessions.sort((a, b) => a.start.localeCompare(b.start));
  const country = r.Circuit?.Location?.country;
  return { season: r.season, round: Number(r.round), name: r.raceName, circuit: r.Circuit?.circuitName, locality: r.Circuit?.Location?.locality, country, flag: flag(country), sessions };
}

export async function f1_next() {
  const now = Date.now();
  return chain(async () => {
    const j = await getJSON(`${JOLPICA}/current.json?limit=40`);
    const races = (j.MRData?.RaceTable?.Races || []).map(jolpicaRace);
    if (!races.length) throw new Error("jolpica empty");
    // Current weekend stays "current" until 3h after lights out.
    const idx = races.findIndex(r => Date.parse(r.sessions.at(-1).start) + 3 * 36e5 > now);
    if (idx < 0) return ok({ race: null, upcoming: [], season_over: true }, "Jolpica");
    return ok({ race: races[idx], upcoming: races.slice(idx + 1, idx + 4).map(r => ({ round: r.round, name: r.name, country: r.country, flag: r.flag, date: r.sessions.at(-1).start })) }, "Jolpica");
  }, async () => {
    const year = new Date().getUTCFullYear();
    const s = await getJSON(`https://api.openf1.org/v1/sessions?year=${year}`);
    const future = s.filter(x => Date.parse(x.date_end) + 3 * 36e5 > now).sort((a, b) => a.date_start.localeCompare(b.date_start));
    if (!future.length) throw new Error("openf1 empty");
    const mk = future[0].meeting_key;
    const sessions = s.filter(x => x.meeting_key === mk).sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map(x => ({ name: x.session_name, start: new Date(x.date_start).toISOString(), minutes: Math.round((Date.parse(x.date_end) - Date.parse(x.date_start)) / 6e4), time_confirmed: true }));
    const f = future[0];
    const meetings = [...new Map(future.map(x => [x.meeting_key, x])).values()].slice(1, 4);
    return ok({ race: { season: String(year), round: null, name: `${f.country_name} Grand Prix`, circuit: f.circuit_short_name, locality: f.location, country: f.country_name, flag: flag(f.country_name), sessions },
      upcoming: meetings.map(m => ({ round: null, name: `${m.country_name} Grand Prix`, country: m.country_name, flag: flag(m.country_name), date: m.date_start })) }, "OpenF1");
  });
}

export async function f1_standings() {
  return chain(async () => {
    const [d, c] = await Promise.all([getJSON(`${JOLPICA}/current/driverStandings.json`), getJSON(`${JOLPICA}/current/constructorStandings.json`)]);
    const dl = d.MRData?.StandingsTable?.StandingsLists?.[0], cl = c.MRData?.StandingsTable?.StandingsLists?.[0];
    if (!dl?.DriverStandings?.length) throw new Error("jolpica standings empty");
    return ok({
      round: Number(dl.round),
      drivers: dl.DriverStandings.map(x => ({ pos: Number(x.position), name: `${x.Driver.givenName} ${x.Driver.familyName}`, code: x.Driver.code, team: x.Constructors?.[0]?.name, points: Number(x.points), wins: Number(x.wins) })),
      constructors: (cl?.ConstructorStandings || []).map(x => ({ pos: Number(x.position), name: x.Constructor.name, points: Number(x.points) })),
    }, "Jolpica");
  });
}

export async function f1_last() {
  return chain(async () => {
    const j = await getJSON(`${JOLPICA}/current/last/results.json`);
    const r = j.MRData?.RaceTable?.Races?.[0];
    if (!r) throw new Error("jolpica last empty");
    return ok({ round: Number(r.round), name: r.raceName, country: r.Circuit?.Location?.country, flag: flag(r.Circuit?.Location?.country), date: iso(r.date, r.time),
      results: r.Results.slice(0, 20).map(x => ({ pos: Number(x.position), name: `${x.Driver.givenName} ${x.Driver.familyName}`, team: x.Constructor?.name, status: x.status, points: Number(x.points) })) }, "Jolpica");
  });
}

// ---------------------------------------------------------------- football (ESPN)
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const score = s => (s == null ? null : typeof s === "object" ? (s.displayValue ?? s.value ?? null) : s);

const COMPS = { "spanish laliga": "La Liga", "laliga": "La Liga", "uefa champions league": "Champions League", "spanish copa del rey": "Copa del Rey", "spanish supercopa": "Supercopa", "fifa club world cup": "Club World Cup" };
export const tidyComp = n => (n ? COMPS[n.toLowerCase()] || n.replace(/^Spanish /, "") : null);

function espnEvent(ev, teamId) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const me = cs.find(c => String(c.team?.id ?? c.id) === String(teamId)) || cs[0];
  const opp = cs.find(c => c !== me) || {};
  const st = comp.status?.type || ev.status?.type || {};
  const league = tidyComp(ev.league?.name || comp.league?.name || ev.seasonType?.name || ev.season?.displayName || null);
  return {
    id: ev.id, date: ev.date, name: ev.name,
    competition: league,
    home: me?.homeAway === "home",
    opponent: opp.team?.displayName || opp.team?.shortDisplayName || null,
    venue: comp.venue?.fullName || null,
    state: st.state || null, completed: !!st.completed, detail: st.shortDetail || st.detail || null,
    time_confirmed: !(comp.timeValid === false || ev.timeValid === false),
    score: me && opp ? { us: score(me.score), them: score(opp.score) } : null,
    winner: me?.winner === true ? "us" : opp?.winner === true ? "them" : null,
  };
}

async function espnTeam(league, teamId) {
  const [fx, rs] = await Promise.all([
    getJSON(`${ESPN}/soccer/${league}/teams/${teamId}/schedule?fixture=true`),
    getJSON(`${ESPN}/soccer/${league}/teams/${teamId}/schedule`),
  ]);
  const now = Date.now();
  const next = (fx.events || []).map(e => espnEvent(e, teamId)).filter(e => !e.completed && Date.parse(e.date) > now - 3 * 36e5).sort((a, b) => a.date.localeCompare(b.date));
  const done = (rs.events || []).map(e => espnEvent(e, teamId)).filter(e => e.completed).sort((a, b) => b.date.localeCompare(a.date));
  if (!next.length && !done.length) throw new Error("espn empty");
  return { next: next.slice(0, 5), last: done[0] || null, form: done.slice(0, 5).map(e => (e.winner === "us" ? "W" : e.winner === "them" ? "L" : "D")) };
}

export async function football() {
  const club = config().follows.football_club;
  // No second API: TheSportsDB's free tier returned an incomplete schedule (a stale LAST, home games only),
  // which would break the NEXT/LAST rule. Fallback is the edition snapshot, then hide.
  return chain(async () => ok({ club: club.name, ...(await espnTeam("all", club.espn_id)) }, "ESPN"));
}

function espnStandings(j) {
  const groups = j.children?.length ? j.children : [j];
  return groups.map(g => ({
    name: g.name || g.abbreviation || null,
    rows: (g.standings?.entries || []).map(e => {
      const s = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.value ?? Number(x.displayValue)]));
      const sd = Object.fromEntries((e.stats || []).map(x => [x.name || x.type, x.displayValue]));
      return { team: e.team?.displayName, short: e.team?.shortDisplayName, id: e.team?.id, abbr: e.team?.abbreviation,
        rank: s.rank ?? s.playoffSeed ?? null, played: s.gamesPlayed ?? null, points: s.points ?? null, gd: s.pointDifferential ?? null,
        wins: s.wins ?? null, losses: s.losses ?? null, pct: sd.winPercent ?? null, gb: sd.gamesBehind ?? null };
    }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  }));
}

export async function laliga_table() {
  return chain(async () => {
    const j = await getJSON("https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings");
    const g = espnStandings(j)[0];
    if (!g?.rows?.length) throw new Error("espn table empty");
    return ok({ rows: g.rows.map(r => ({ rank: r.rank, team: r.team, short: r.short, id: r.id, played: r.played, points: r.points, gd: r.gd })) }, "ESPN");
  });
}

export async function nba() {
  const t = config().follows.nba_team;
  return chain(async () => {
    const s = await getJSON(`${ESPN}/basketball/nba/teams/${t.espn_abbr}/schedule`);
    const pre = await getJSON(`${ESPN}/basketball/nba/teams/${t.espn_abbr}/schedule?seasontype=1`).catch(() => ({ events: [] }));
    const now = Date.now();
    const evs = [...(pre.events || []), ...(s.events || [])];
    const byId = new Map(evs.map(e => [e.id, e]));
    const all = [...byId.values()].map(e => {
      const comp = e.competitions?.[0] || {}, cs = comp.competitors || [];
      const me = cs.find(c => c.team?.abbreviation?.toLowerCase() === t.espn_abbr || c.team?.abbreviation === "GS" || c.team?.abbreviation === "GSW") || cs[0];
      const opp = cs.find(c => c !== me) || {};
      const st = comp.status?.type || {};
      return { date: e.date, opponent: opp.team?.displayName, home: me?.homeAway === "home", completed: !!st.completed, preseason: e.seasonType?.type === 1,
        score: st.completed ? { us: score(me?.score), them: score(opp.score) } : null, winner: me?.winner ? "us" : opp.winner ? "them" : null };
    }).sort((a, b) => a.date.localeCompare(b.date));
    const regularPlayed = all.some(e => !e.preseason && e.completed);
    const next = all.filter(e => !e.completed && Date.parse(e.date) > now - 3 * 36e5).slice(0, 2);
    const last = all.filter(e => e.completed).at(-1) || null;
    let west = null;
    if (regularPlayed) {
      const st = await getJSON("https://site.api.espn.com/apis/v2/sports/basketball/nba/standings").catch(() => null);
      const g = st && espnStandings(st).find(x => /west/i.test(x.name || ""));
      if (g) west = g.rows.slice(0, 15).map(r => ({ rank: r.rank, team: r.team, abbr: r.abbr, wins: r.wins, losses: r.losses, gb: r.gb }))
        .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses)).map((r, i) => ({ ...r, rank: r.rank ?? i + 1 }));
    }
    return ok({ team: t.name, in_season: regularPlayed, next, last, west }, "ESPN");
  });
}

export async function tennis() {
  return chain(async () => {
    const j = await getJSON(`${ESPN}/tennis/atp/scoreboard`);
    const events = (j.events || []).map(e => ({ name: e.name || e.shortName, start: e.date, end: e.endDate || null, venue: e.venue?.displayName || e.venue?.fullName || null, major: !!e.major }));
    if (!events.length) throw new Error("espn tennis empty");
    return ok({ events }, "ESPN");
  });
}

// ---------------------------------------------------------------- markets (Yahoo, server side only)
const tzDate = (sec, tz) => new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: tz || "UTC" });

export async function yahooChart(symbol, range = "3mo") {
  const hosts = ["query1", "query2"];
  let j, err;
  for (const h of hosts) {
    // Yahoo answers 429 to a full browser user-agent that carries no cookies; a plain one gets through.
    try { j = await getJSON(`https://${h}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`, { headers: { "user-agent": "Mozilla/5.0" } }); break; }
    catch (e) { err = e; }
  }
  if (!j) throw err;
  const r = j.chart?.result?.[0];
  if (!r?.meta || typeof r.meta.regularMarketPrice !== "number") throw new Error(`yahoo shape ${symbol}`);
  const tz = r.meta.exchangeTimezoneName;
  const closes = r.indicators?.quote?.[0]?.close || [];
  // Daily bars can be null. Never chart or average a null; drop them.
  const bars = (r.timestamp || []).map((t, i) => ({ d: tzDate(t, tz), c: closes[i] })).filter(b => typeof b.c === "number" && isFinite(b.c));
  const sessionDate = tzDate(r.meta.regularMarketTime, tz);
  const prevBar = [...bars].reverse().find(b => b.d < sessionDate);
  const price = r.meta.regularMarketPrice;
  const series = bars.filter(b => b.d < sessionDate).concat([{ d: sessionDate, c: price }]);
  let prev = prevBar?.c ?? null;
  // Futures roll to a new session at 18:00 New York time, so their daily bars lag a day.
  // For futures only, the 1-day chart's previousClose is the true last settlement.
  // (For indices that same field is unreliable, so the bar method above stays.)
  if (r.meta.instrumentType === "FUTURE") {
    try {
      const d = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1h`, { headers: { "user-agent": "Mozilla/5.0" } });
      const pc = d.chart?.result?.[0]?.meta?.previousClose;
      if (typeof pc === "number" && pc > 0) prev = pc;
    } catch {}
  }
  const note = rangeNote(bars.filter(b => b.d < sessionDate).concat([{ d: sessionDate, c: price }]), symbol);
  const period = r.meta.currentTradingPeriod?.regular;
  const nowS = Date.now() / 1000;
  const live = !!period && nowS >= period.start && nowS <= period.end && nowS - r.meta.regularMarketTime < 20 * 60;
  return {
    symbol, price, prev, change_pct: prev ? ((price - prev) / prev) * 100 : null,
    session_date: sessionDate, market_time: new Date(r.meta.regularMarketTime * 1000).toISOString(),
    currency: r.meta.currency, live, instrument: r.meta.instrumentType || null, note,
    lo3m: bars.length ? Math.min(...bars.map(b => b.c), price) : null, hi3m: bars.length ? Math.max(...bars.map(b => b.c), price) : null,
    spark: series.map(b => Math.round(b.c * 100) / 100), spark_from: series[0]?.d, spark_to: series.at(-1)?.d,
  };
}

// "Lowest close since 24 Jun", "a 3-month high" and so on, from the closes themselves. Nothing is averaged.
const dayLabel = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep");
export function rangeNote(series, symbol) {
  if (series.length < 15) return null;
  const n = series.length - 1, cur = series[n].c;
  const inverse = symbol === "INR=X"; // a higher USD/INR is a weaker rupee
  const word = hi => (inverse ? (hi ? "Rupee at its weakest" : "Rupee at its strongest") : (hi ? "Highest close" : "Lowest close"));
  for (const hi of [true, false]) {
    let j = n - 1;
    while (j >= 0 && (hi ? series[j].c < cur : series[j].c > cur)) j--;
    if (j < 0) return inverse ? `${word(hi)} in 3 months` : `${hi ? "Highest" : "Lowest"} close in 3 months`;
    if (n - j >= 10) return `${word(hi)} since ${dayLabel(series[j].d)}`;
  }
  const max = Math.max(...series.map(b => b.c)), min = Math.min(...series.map(b => b.c));
  if (!inverse && cur >= max * 0.99) return "Within 1% of its 3-month high";
  if (!inverse && cur <= min * 1.01) return "Within 1% of its 3-month low";
  return null;
}

const RANGES = { "^BSESN": [40000, 150000], "^NSEI": [12000, 45000], "^NDX": [10000, 60000], "^NSEBANK": [25000, 120000], "INR=X": [70, 130], "BZ=F": [20, 250], "BTC-USD": [5000, 500000], "^GSPC": [2500, 15000] };
const inRange = q => { const r = RANGES[q.symbol]; return !r || (q.price >= r[0] && q.price <= r[1]); };

export async function markets() {
  const cfg = config().markets;
  const idx = await Promise.allSettled(cfg.indices.map(async i => {
    const q = await yahooChart(i.yahoo);
    if (!inRange(q)) throw new Error(`range ${i.yahoo}`);
    return { name: i.name, ...q };
  }));
  const indices = idx.filter(r => r.status === "fulfilled").map(r => r.value);
  const cross = [];
  for (const c of cfg.cross) {
    if (!c.yahoo) continue;
    try {
      let q;
      if (c.yahoo === "INR=X") q = (await fx()).value;
      else if (c.yahoo === "BTC-USD") q = (await cryptoPrice()).value;
      else { q = await yahooChart(c.yahoo); if (!inRange(q)) throw new Error("range"); delete q.spark; }
      if (q) cross.push({ name: c.name, symbol: c.yahoo, price: q.price, change_pct: q.change_pct ?? null, session_date: q.session_date ?? null, note: q.note ?? null, lo3m: q.lo3m ?? null, hi3m: q.hi3m ?? null, source: q.source || "Yahoo Finance" });
    } catch {}
  }
  if (!indices.length && !cross.length) return fail("no market data");
  return ok({ indices, cross }, "Yahoo Finance");
}

export async function fx() {
  return chain(async () => {
    const q = await yahooChart("INR=X");
    if (!inRange(q)) throw new Error("fx range");
    delete q.spark;
    return ok({ ...q, source: "Yahoo Finance" }, "Yahoo Finance");
  }, async () => {
    const j = await getJSON("https://open.er-api.com/v6/latest/USD");
    const v = j.rates?.INR;
    if (!(v > 70 && v < 130)) throw new Error("er-api range");
    return ok({ symbol: "INR=X", price: v, change_pct: null, source: "ExchangeRate-API" }, "ExchangeRate-API", new Date(j.time_last_update_unix * 1000).toISOString());
  });
}

export async function cryptoPrice() {
  return chain(async () => {
    const q = await yahooChart("BTC-USD");
    if (!inRange(q)) throw new Error("btc range");
    delete q.spark;
    return ok({ ...q, source: "Yahoo Finance" }, "Yahoo Finance");
  }, async () => {
    const j = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
    const v = j.bitcoin?.usd;
    if (!(v > 5000)) throw new Error("coingecko range");
    return ok({ symbol: "BTC-USD", price: v, change_pct: j.bitcoin.usd_24h_change ?? null, source: "CoinGecko" }, "CoinGecko");
  });
}

// ---------------------------------------------------------------- gold (IBJA, scraped)
export function parseIbja(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const pick = purity => {
    const re = new RegExp(`\\b${purity}\\b[^0-9₹]{0,60}(?:₹\\s*)?([0-9][0-9,]{3,8}(?:\\.[0-9]+)?)`, "g");
    for (const m of text.matchAll(re)) {
      let v = Number(m[1].replace(/,/g, ""));
      if (v > 50000 && v < 400000) v = v / 10; // per 10 g printed, normalise to per gram
      if (v > 5000 && v < 40000) return v;
    }
    return null;
  };
  const g24 = pick("999"), g22 = pick("916");
  if (!g24 || !g22) throw new Error("ibja parse");
  const ratio = g22 / g24;
  if (ratio < 0.88 || ratio > 0.95) throw new Error("ibja ratio");
  const date = (text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/) || [])[1] || null;
  return { per_gram_24k: g24, per_gram_22k: g22, per_10g_24k: Math.round(g24 * 10), per_10g_22k: Math.round(g22 * 10), rate_date: date };
}

export async function gold_in() {
  return chain(async () => ok(parseIbja(await getText("https://ibjarates.com/")), "IBJA"));
}

// ---------------------------------------------------------------- trends (Google Trends RSS)
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : null; };

export function parseTrendsRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
    term: tag(it, "title"), traffic: tag(it, "ht:approx_traffic"), published: tag(it, "pubDate"),
    news: [...it.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].map(([, n]) => ({ title: tag(n, "ht:news_item_title"), url: tag(n, "ht:news_item_url"), source: tag(n, "ht:news_item_source") })),
  })).filter(x => x.term);
}

export async function trends(params) {
  const cfg = config().trends;
  const geos = [cfg.india_geo, ...cfg.world_geos, ...(params.get("geos") || "").split(",").filter(g => /^[A-Z]{2}$/.test(g))];
  const res = await Promise.allSettled(geos.map(async g => [g, parseTrendsRss(await getText(`https://trends.google.com/trending/rss?geo=${g}`))]));
  const by = Object.fromEntries(res.filter(r => r.status === "fulfilled" && r.value[1].length).map(r => r.value));
  if (!Object.keys(by).length) return fail("trends unavailable");
  return ok({ geos: by }, "Google Trends");
}

// ---------------------------------------------------------------- betting (Polymarket)
// Tag slugs as Polymarket actually uses them (checked 25 Sep 2026). "trump" is not excluded on its own:
// Iran and ceasefire markets carry it, and those are world news.
const EXCLUDE_TAGS = new Set([
  "us-politics", "us-presidential-election", "midterms", "senate-midterms", "senate-elections", "congress", "primaries", "us-election", "elections-us",
  "fed", "fed-rates", "fomc", "economic-policy",
  "nfl", "nba", "mlb", "nhl", "ncaa", "ncaab", "cfb", "wnba", "mls", "ufc", "super-bowl", "baseball",
  "esports", "counter-strike-2", "counter-strike", "league-of-legends", "dota-2", "valorant",
  "crypto", "crypto-prices", "hit-price", "multi-strikes", "pre-market", "fdv", "finance-updown",
  "weather", "climate-weather", "tweets-markets", "tweets", "mentions", "pop-culture", "celebrities", "music",
]);
const EXCLUDE_WORDS = /\b(biden|harris|vance|newsom|desantis|ocasio-cortez|senate|congress|house of representatives|governor|midterms?|democrat(ic|s)?|republican(s)?|gop|fed |fomc|federal reserve|powell|warsh|rate cuts?|rate hike|cpi|tariffs?|nfl|nba|mlb|nhl|ncaa|wnba|super bowl|world series|esports?|bitcoin|ethereum|solana|xrp|up or down|price of|temperature|highest temp|tweets?|# of posts|taylor swift|kardashian|kanye|engaged|pregnant|album)\b/i;
const seriesKey = t => String(t || "").toLowerCase().replace(/\s+(by|through|before|on|in)\b.*$/, "").replace(/[^a-z0-9 ]/g, "").trim();

export function filterBetting(events) {
  const seen = new Set();
  return events.filter(e => {
    const tags = (e.tags || []).map(t => (t.slug || "").toLowerCase());
    if (tags.some(t => EXCLUDE_TAGS.has(t))) return false;
    if (tags.includes("united-states") && tags.includes("politics")) return false;
    if (EXCLUDE_WORDS.test(e.title || "") || /more markets|o\/u|over\/under|visual aid/i.test(e.title || "")) return false;
    const k = seriesKey(e.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const parseArr = v => { try { return Array.isArray(v) ? v : JSON.parse(v || "[]"); } catch { return []; } };

export function shapePolymarket(e) {
  const mkts = (e.markets || []).filter(m => m.active !== false && m.closed !== true);
  let outcomes;
  const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(, \d{4})?$/i;
  if (mkts.length > 1 && mkts.every(m => MONTH.test(m.groupItemTitle || "") && m.endDate)) {
    // Date ladder ("... by March 31?"): show the nearest deadlines in date order.
    outcomes = mkts.filter(m => Date.parse(m.endDate) > Date.now()).sort((a, b) => a.endDate.localeCompare(b.endDate))
      .map(m => ({ name: `${/\bthrough\b/i.test(e.title) ? "Through" : "By"} ${m.groupItemTitle}`, prob: Number(parseArr(m.outcomePrices)[0]) * 100 })).filter(o => isFinite(o.prob)).slice(0, 3);
  } else if (mkts.length > 1) {
    outcomes = mkts.map(m => ({ name: m.groupItemTitle || m.question, prob: Number(parseArr(m.outcomePrices)[0]) * 100 }))
      .filter(o => isFinite(o.prob)).sort((a, b) => b.prob - a.prob).slice(0, 3);
  } else if (mkts.length === 1) {
    const names = parseArr(mkts[0].outcomes), prices = parseArr(mkts[0].outcomePrices).map(Number);
    outcomes = names.map((n, i) => ({ name: n, prob: prices[i] * 100 })).filter(o => isFinite(o.prob));
    if (names[0] === "Yes") outcomes = outcomes.slice(0, 1);
  } else outcomes = [];
  return { id: `pm:${e.slug}`, title: e.title, category: (e.tags || []).find(t => !["all", "featured"].includes(t.slug))?.label || null,
    volume24h: Math.round(Number(e.volume24hr) || 0), end: e.endDate || null,
    outcomes: outcomes.map(o => ({ name: o.name, prob: Math.round(o.prob * 10) / 10 })), source: "Polymarket", url: `https://polymarket.com/event/${e.slug}` };
}

// Kalshi: no volume ordering in the API, so the daily run crawls it (scripts/betting-candidates.mjs)
// and the page refreshes only the events the edition chose.
const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const LADDER = /^(above|below|over|under)\b|\bor (above|below)$|^\$?[\d.,]+\s*(or more|\+)?$/i;

export function shapeKalshi(e) {
  const mkts = (e.markets || []).filter(m => m.status === "active" || m.status === "open" || !m.status);
  const price = m => Number(m.last_price_dollars ?? (m.last_price != null ? m.last_price / 100 : NaN));
  let outcomes;
  if (mkts.length === 1) outcomes = [{ name: "Yes", prob: price(mkts[0]) * 100 }];
  else outcomes = mkts.map(m => ({ name: m.yes_sub_title || m.title, prob: price(m) * 100 })).filter(o => isFinite(o.prob)).sort((a, b) => b.prob - a.prob).slice(0, 3);
  const vol = mkts.reduce((a, m) => a + Number(m.volume_24h_fp ?? m.volume_24h ?? 0) * (price(m) || 0), 0);
  return { id: `ks:${e.event_ticker}`, title: e.title, category: e.category || null, volume24h: Math.round(vol), end: null,
    outcomes: outcomes.filter(o => isFinite(o.prob)).map(o => ({ name: o.name, prob: Math.round(o.prob * 10) / 10 })),
    source: "Kalshi", url: `https://kalshi.com/markets/${String(e.series_ticker || e.event_ticker).toLowerCase()}`, ladder: mkts.length > 1 && mkts.every(m => LADDER.test((m.yes_sub_title || "").trim())) };
}

const KALSHI_EXCLUDE_CATS = new Set(["Mentions", "Crypto", "Climate and Weather", "Entertainment"]);
const KALSHI_EXCLUDE_SERIES = /^(KXNFL|KXNCAA|KXMLB|KXNBA|KXWNBA|KXNHL|KXSB|KXHEISMAN|KXMVP|KXRECORD|KXNEXTTEAM|SENATE|HOUSE|CONTROL|KXPRES|KXGOV|KXBALANCE|KXFED|KXCPI|KXBTC|KXETH|KXTRUMP|KXRT|KXMAYOR|KXAAA|KXDIESEL|KXGAS|KXTXERCOT|KXUFC|KXNASCAR)/;
export function filterKalshi(events) {
  return events.filter(e => !KALSHI_EXCLUDE_CATS.has(e.category) && !KALSHI_EXCLUDE_SERIES.test(e.series_ticker || "") && !EXCLUDE_WORDS.test(e.title || ""))
    .map(shapeKalshi).filter(m => m.outcomes.length && !m.ladder);
}

export async function kalshiEvent(ticker) {
  const j = await getJSON(`${KALSHI}/events/${encodeURIComponent(ticker)}?with_nested_markets=true`);
  return shapeKalshi({ ...j.event, markets: j.event?.markets || j.markets || [] });
}

export async function betting(params) {
  // ids: "pm:<polymarket slug>" or "ks:<kalshi event ticker>" (bare slugs are Polymarket, for older editions)
  const ids = (params.get("ids") || params.get("slugs") || "").split(",").map(s => (s.includes(":") ? s : `pm:${s}`))
    .filter(s => /^(pm:[a-z0-9-]{3,200}|ks:[A-Za-z0-9._-]{3,80})$/.test(s)).slice(0, 14);
  return chain(async () => {
    if (ids.length) {
      const got = await Promise.all(ids.map(id => id.startsWith("ks:")
        ? kalshiEvent(id.slice(3)).catch(() => null)
        : getJSON(`https://gamma-api.polymarket.com/events?slug=${id.slice(3)}`).then(a => a[0] && { ...shapePolymarket(a[0]), id }).catch(() => null)));
      return ok({ markets: got.filter(Boolean) }, "Polymarket, Kalshi");
    }
    const j = await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=150");
    const kept = filterBetting(j).map(shapePolymarket).filter(m => m.outcomes.length).slice(0, 25);
    if (!kept.length) throw new Error("polymarket empty");
    return ok({ markets: kept }, "Polymarket");
  });
}

// ---------------------------------------------------------------- registry
export const LIVE = { weather, f1_next, f1_standings, f1_last, football, laliga_table, nba, tennis, markets, fx, gold_in, trends, betting, crypto: cryptoPrice };

// Cache seconds per key: [s-maxage, stale-while-revalidate]
export const CACHE = {
  weather: [900, 3600], f1_next: [3600, 21600], f1_standings: [3600, 21600], f1_last: [3600, 21600], football: [1800, 7200],
  laliga_table: [3600, 21600], nba: [3600, 21600], tennis: [3600, 21600], markets: [300, 1800], fx: [900, 3600],
  crypto: [300, 1800], gold_in: [3600, 21600], trends: [1800, 7200], betting: [1800, 7200],
};
