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

// Seven days back and seven ahead, so the page can say what has changed. Past days come back in `past`.
async function openMeteo(lat, lon, hourly = false) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,precipitation,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,relative_humidity_2m_mean,apparent_temperature_max,sunrise,sunset` +
    (hourly ? `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=36` : "") +
    `&timezone=Asia%2FKolkata&forecast_days=7&past_days=7`;
  const j = await getJSON(u);
  const c = j.current, d = j.daily;
  if (!c || !d?.time?.length || typeof c.temperature_2m !== "number") throw new Error("open-meteo shape");
  if (c.temperature_2m < -60 || c.temperature_2m > 60) throw new Error("open-meteo range");
  const today = /^\d{4}-\d\d-\d\d/.test(c.time || "") ? c.time.slice(0, 10) : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days = d.time.map((t, i) => ({
    date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
    rain_prob: d.precipitation_probability_max?.[i] ?? null, rain_mm: d.precipitation_sum?.[i] ?? null,
    humidity: d.relative_humidity_2m_mean?.[i] ?? null, feels_max: d.apparent_temperature_max?.[i] ?? null,
    // Local times (IST for the paper's cities), for the masthead's sky arc.
    sunrise: d.sunrise?.[i] ?? null, sunset: d.sunset?.[i] ?? null,
  }));
  return {
    current: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, humidity: c.relative_humidity_2m, time: c.time },
    daily: days.filter(x => x.date >= today),
    past: days.filter(x => x.date < today),
    utc_offset_seconds: j.utc_offset_seconds ?? null,
    // Local IST times like "2026-09-25T17:00".
    hourly: j.hourly?.time ? j.hourly.time.map((t, i) => ({ time: t, temp: j.hourly.temperature_2m[i], rain_prob: j.hourly.precipitation_probability?.[i] ?? null, code: j.hourly.weather_code?.[i] ?? null })) : undefined,
  };
}

// Air quality from Open-Meteo (CAMS model), on the US AQI scale: now, the last seven days and about five ahead.
// A day's figure is the highest hourly AQI that day, as the reader would meet it.
async function airQuality(cities) {
  const j = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${cities.map(c => c.lat).join(",")}&longitude=${cities.map(c => c.lon).join(",")}` +
    `&current=us_aqi,pm2_5&hourly=us_aqi&past_days=7&forecast_days=6&timezone=Asia%2FKolkata`);
  return [].concat(j).map(a => {
    const today = (a.current?.time || "").slice(0, 10);
    const byDay = {};
    (a.hourly?.time || []).forEach((t, i) => { const v = a.hourly.us_aqi[i]; if (v != null) (byDay[t.slice(0, 10)] ||= []).push(v); });
    const days = Object.entries(byDay).filter(([, v]) => v.length >= 12).map(([date, v]) => ({ date, aqi: Math.max(...v) }));
    const now = a.current?.us_aqi;
    if (!(now >= 0 && now < 1000)) return null;
    return { now, pm2_5: a.current.pm2_5 ?? null, scale: "US AQI", daily: days.filter(x => x.date >= today), past: days.filter(x => x.date < today) };
  });
}

export async function weather(params) {
  const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  if (params.has("lat")) {
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return fail("bad coordinates");
    return chain(async () => ok({ cities: [{ name: "Your location", ...(await openMeteo(lat.toFixed(2), lon.toFixed(2), true)) }] }, "Open-Meteo"));
  }
  // Home first, then the family cities (config weather.family), every day.
  const cfg = config().weather;
  const list = [...cfg.always, ...(cfg.family || cfg.when_notable || []).map(c => ({ ...c, family: true }))];
  return chain(async () => {
    const [wx, air] = await Promise.all([
      // One retry each: Open-Meteo occasionally stalls on a single request.
      Promise.allSettled(list.map((c, i) => openMeteo(c.lat, c.lon, i === 0).catch(() => openMeteo(c.lat, c.lon, i === 0)))),
      airQuality(list).catch(() => []),
    ]);
    if (wx[0].status !== "fulfilled") throw wx[0].reason;
    const cities = list.map((c, i) => wx[i].status === "fulfilled" ? { name: c.name, ...(c.family ? { family: true } : {}), ...wx[i].value, air: air[i] || null } : null).filter(Boolean);
    return ok({ cities }, "Open-Meteo");
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
    return ok({ race: races[idx], upcoming: races.slice(idx + 1, idx + 5).map(r => ({ round: r.round, name: r.name, country: r.country, flag: r.flag, date: r.sessions.at(-1).start })) }, "Jolpica");
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
    opponent_id: opp.team?.id ?? opp.id ?? null,
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
        wins: s.wins ?? null, draws: s.ties ?? null, losses: s.losses ?? null, pct: sd.winPercent ?? null, gb: sd.gamesBehind ?? null };
    }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  }));
}

export async function laliga_table() {
  return chain(async () => {
    const j = await getJSON("https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings");
    const g = espnStandings(j)[0];
    if (!g?.rows?.length) throw new Error("espn table empty");
    return ok({ rows: g.rows.map(r => ({ rank: r.rank, team: r.team, short: r.short, id: r.id, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, points: r.points, gd: r.gd })) }, "ESPN");
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
  // 7-day and 1-month moves: today's price against the last close on or before the same calendar date 7 and 30 days
  // earlier (the exchange's own dates). A 30-day line for the board.
  const back = n => { const t = new Date(Date.parse(sessionDate + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10); return [...series].reverse().find(b => b.d <= t); };
  const b7 = back(7), b30 = back(30);
  const pctFrom = b => (b?.c ? Math.round(((price - b.c) / b.c) * 10000) / 100 : null);
  const cut30 = new Date(Date.parse(sessionDate + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
  const period = r.meta.currentTradingPeriod?.regular;
  const nowS = Date.now() / 1000;
  const live = !!period && nowS >= period.start && nowS <= period.end && nowS - r.meta.regularMarketTime < 20 * 60;
  return {
    symbol, price, prev, change_pct: prev ? ((price - prev) / prev) * 100 : null,
    session_date: sessionDate, market_time: new Date(r.meta.regularMarketTime * 1000).toISOString(),
    currency: r.meta.currency, live, instrument: r.meta.instrumentType || null, note,
    lo3m: bars.length ? Math.min(...bars.map(b => b.c), price) : null, hi3m: bars.length ? Math.max(...bars.map(b => b.c), price) : null,
    spark: series.map(b => Math.round(b.c * 100) / 100), spark_from: series[0]?.d, spark_to: series.at(-1)?.d,
    chg_7d: pctFrom(b7), from_7d: b7?.d || null, chg_1m: pctFrom(b30), from_1m: b30?.d || null,
    spark30: series.filter(b => b.d >= cut30).map(b => Math.round(b.c * 100) / 100),
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

const RANGES = { "^BSESN": [40000, 150000], "^NSEI": [12000, 45000], "^NDX": [10000, 60000], "^NSEBANK": [25000, 120000], "INR=X": [70, 130], "BZ=F": [20, 250], "BTC-USD": [5000, 500000], "^GSPC": [2500, 15000], "^CNXIT": [10000, 90000], "^DJI": [20000, 100000], "^INDIAVIX": [5, 100], "^VIX": [5, 100] };
const inRange = q => { const r = RANGES[q.symbol]; return !r || (q.price >= r[0] && q.price <= r[1]); };

// Market mood as its publishers print it (config markets.mood): Tickertape's Market Mood Index for India and CNN's
// Fear & Greed Index for the US. Never our own calculation (Parth, 28 Sep). Each source is tried twice with
// different request identities; if both fail, this server's last good reading is served with its own time and
// marked stale, and the page falls back to the edition snapshot after that. A missing reading is never replaced
// by a different measure.
export const moodWordFor = (bands, score) => [...(bands || [])].sort((a, b) => b.from - a.from).find(b => score >= b.from)?.word || null;
const MOOD_LAST = {};
const round1 = v => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const MOOD_SOURCES = {
  async tickertape() {
    const j = await getJSON("https://api.tickertape.in/mmi/now", { timeout: 6000, headers: { "user-agent": BROWSER, origin: "https://www.tickertape.in", referer: "https://www.tickertape.in/" } });
    const d = j?.data;
    if (!j?.success || !Number.isFinite(d?.indicator)) throw new Error("tickertape: no reading");
    return { score: d.indicator, as_of: d.date || null, prev_day: d.lastDay?.indicator, prev_week: d.lastWeek?.indicator, prev_month: d.lastMonth?.indicator, prev_year: d.lastYear?.indicator };
  },
  async cnn() {
    const j = await getJSON("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", { timeout: 6000, headers: {
      "user-agent": BROWSER, accept: "application/json, text/plain, */*", "accept-language": "en-US,en;q=0.9",
      origin: "https://edition.cnn.com", referer: "https://edition.cnn.com/", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" } });
    const f = j?.fear_and_greed;
    if (!Number.isFinite(f?.score)) throw new Error("cnn: no reading");
    const hist = (j.fear_and_greed_historical?.data || []).slice(-30).map(p => Math.round(p.y));
    return { score: f.score, rating: f.rating || null, as_of: f.timestamp || null, prev_day: f.previous_close, prev_week: f.previous_1_week, prev_month: f.previous_1_month, prev_year: f.previous_1_year, spark30: hist.length > 5 ? hist : null };
  },
};
export async function marketMood(cfg = config().markets.mood || {}) {
  const out = {};
  await Promise.all(Object.entries(cfg).filter(([, m]) => m?.source && MOOD_SOURCES[m.source]).map(async ([k, m]) => {
    let r = null;
    for (let i = 0; i < 2 && !r; i++) { try { r = await MOOD_SOURCES[m.source](); } catch {} }
    if (r && r.score >= 0 && r.score <= 100) {
      const word = r.rating ? r.rating.replace(/^\w/, c => c.toUpperCase()) : moodWordFor(m.bands, r.score);
      out[k] = MOOD_LAST[k] = { score: Math.round(r.score), exact: round1(r.score), word, region: m.label, name: m.name, url: m.url, source: m.source, bands: m.bands,
        as_of: r.as_of, prev_day: round1(r.prev_day), prev_week: round1(r.prev_week), prev_month: round1(r.prev_month), prev_year: round1(r.prev_year), ...(r.spark30 ? { spark30: r.spark30 } : {}) };
    } else if (MOOD_LAST[k]) out[k] = { ...MOOD_LAST[k], stale: true };
  }));
  return out;
}

// 7-day and 1-month changes as a publisher prints them. Moneycontrol's price feed carries them for Indian
// indices (with the comparison dates; they agree with NSE's own figures) and for some global ones.
// Accepted only when the publisher's level agrees with ours, so a stale record never mixes with a fresh price.
export async function publishedReturns(key, price) {
  const kind = key.startsWith("in;") ? "inidicesindia" : "indicesglobal";
  const j = await getJSON(`https://priceapi.moneycontrol.com/pricefeed/notapplicable/${kind}/${encodeURIComponent(key)}`, { timeout: 8000, headers: { "user-agent": "Mozilla/5.0" } });
  const d = j?.data; if (!d) throw new Error(`moneycontrol ${key}: ${j?.message || "no data"}`);
  const level = Number(String(d.pricecurrent ?? "").replace(/,/g, ""));
  if (!(level > 0) || Math.abs(level - price) / price > 0.003) throw new Error(`moneycontrol ${key}: level ${level} vs ${price}`);
  const num = v => v == null || v === "" ? null : Number(v);
  const w = num(d.cl1wPerChange ?? d["1wk"]), m = num(d.cl1mPerChange ?? d["1mth"]);
  if (![w, m].every(v => v != null && Number.isFinite(v) && Math.abs(v) < 60)) throw new Error(`moneycontrol ${key}: range`);
  return { chg_7d: w, from_7d: d.cl1wDt || null, chg_1m: m, from_1m: d.cl1mDt || null, returns_source: "Moneycontrol" };
}
// Published figures first; our own sum from daily closes only when no publisher has them.
async function withReturns(q, key) {
  if (key) { try { const r = await publishedReturns(key, q.price); return { ...q, ...r, returns_calc: false }; } catch {} }
  return { ...q, returns_source: q.chg_7d != null ? "calculated from daily closes" : null, returns_calc: q.chg_7d != null };
}

export async function markets() {
  const cfg = config().markets;
  const moodP = marketMood(cfg.mood).catch(() => ({})); // in parallel with the prices
  const idx = await Promise.allSettled(cfg.indices.map(async i => {
    const q = await yahooChart(i.yahoo);
    if (!inRange(q)) throw new Error(`range ${i.yahoo}`);
    return withReturns({ name: i.name, ...q }, i.published);
  }));
  const indices = idx.filter(r => r.status === "fulfilled").map(r => r.value);
  // The other assets and the two volatility indices, fetched together.
  const crossOut = await Promise.all(cfg.cross.filter(c => c.yahoo).map(async c => {
    try {
      let q;
      if (c.yahoo === "INR=X") q = (await fx()).value;
      else if (c.yahoo === "BTC-USD") q = (await cryptoPrice()).value;
      else { q = await withReturns(await yahooChart(c.yahoo), c.published); if (!inRange(q)) throw new Error("range"); delete q.spark; }
      return q ? { name: c.name, symbol: c.yahoo, price: q.price, prev: q.prev ?? null, change_pct: q.change_pct ?? null, session_date: q.session_date ?? null, note: q.note ?? null, lo3m: q.lo3m ?? null, hi3m: q.hi3m ?? null, spark30: q.spark30 ?? null, chg_7d: q.chg_7d ?? null, from_7d: q.from_7d ?? null, chg_1m: q.chg_1m ?? null, from_1m: q.from_1m ?? null, returns_source: q.returns_source ?? (q.chg_7d != null ? "calculated from daily closes" : null), returns_calc: q.returns_calc ?? q.chg_7d != null, source: q.source || "Yahoo Finance" } : null;
    } catch { return null; }
  }));
  const cross = crossOut.filter(Boolean);
  const mood = await moodP;
  if (!indices.length && !cross.length) return fail("no market data");
  return ok({ indices, cross, mood }, "Yahoo Finance");
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
  const out = { per_gram_24k: g24, per_gram_22k: g22, per_10g_24k: Math.round(g24 * 10), per_10g_22k: Math.round(g22 * 10), rate_date: date };
  return { ...out, ...goldHistory(html, out.per_10g_24k, date) };
}

// IBJA's page carries its chart data (about 4 months of daily 999 rates per 10 g) in a hidden input.
// From it: the change on the previous rate, the change over a week and about a month, and the high and low of the period.
export function goldHistory(html, now, rateDate) {
  const m = html.match(/id="HdnGold"[^>]*value="([^"]*)"/) || html.match(/value="([^"]*)"[^>]*id="HdnGold"/);
  if (!m) return {};
  let j;
  try { j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); } catch { return {}; }
  const ymd = l => { const [d, mo, y] = String(l).split(/[\/-]/); return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; };
  const hist = (j.labels || []).map((l, i) => ({ d: ymd(l), c: Number(j.purity999?.[i]) })).filter(x => x.c > 50000 && x.c < 400000);
  if (hist.length < 10) return {};
  const today = rateDate ? ymd(rateDate) : hist.at(-1).d;
  const before = hist.filter(x => x.d < today);
  const prev = before.at(-1);
  const monthAgo = new Date(Date.parse(today + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10);
  const m1 = [...hist].reverse().find(x => x.d <= monthAgo);
  const weekAgo = new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
  const w1 = [...hist].reverse().find(x => x.d <= weekAgo);
  const all = [...hist.filter(x => x.d !== today), { d: today, c: now }];
  const hi = all.reduce((a, x) => (x.c >= a.c ? x : a)), lo = all.reduce((a, x) => (x.c <= a.c ? x : a));
  const chg = (a, b) => (b ? Math.round((a / b - 1) * 10000) / 100 : null);
  return {
    change_pct: chg(now, prev?.c), prev_10g: prev?.c ?? null, prev_date: prev?.d || null,
    change_1m_pct: chg(now, m1?.c), month_from: m1?.d || null,
    change_7d_pct: chg(now, w1?.c), week_from: w1?.d || null,
    hi: hi.c, hi_date: hi.d, lo: lo.c, lo_date: lo.d, range_from: hist[0].d,
    spark: all.slice(-66).map(x => x.c),
  };
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

// Market signals for the sections: what Polymarket says about the next race or match the paper follows (the F1
// race winner, Real Madrid's next match, India's next cricket match, the followed tennis players' next match).
// Everything is found from the live fixtures and the config's follows; nothing is named here.
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
async function taggedEvents(tags) {
  const lists = await Promise.all(tags.map(t => getJSON(`https://gamma-api.polymarket.com/events?tag_slug=${encodeURIComponent(t)}&active=true&closed=false&limit=300&order=volume24hr&ascending=false`, { timeout: 10000 }).catch(() => [])));
  const seen = new Set(), out = [];
  for (const e of lists.flat()) if (e?.slug && !seen.has(e.slug) && !e.closed) { seen.add(e.slug); out.push(e); }
  return out;
}
const signalOf = (e, extra = {}) => {
  const m = shapePolymarket(e);
  const outcomes = m.outcomes.map(o => ({ name: o.name.replace(/^Draw \(.*\)$/, "Draw"), prob: o.prob }));
  return { title: e.title, url: m.url, volume: Math.round(Number(e.volume) || 0), end: e.endDate || null, outcomes, ...extra };
};
export async function signals() {
  const C = config(), S = C.betting?.signals || {}, T = S.tags || {}, minVol = S.min_volume ?? 1000;
  return chain(async () => {
    const [f1, fb, f1ev, fbev, crev, tnev] = await Promise.all([
      f1_next().catch(() => null), football().catch(() => null),
      taggedEvents(T.f1 || ["f1"]), taggedEvents(T.football || ["soccer"]), taggedEvents(T.cricket || ["cricket"]), taggedEvents(T.tennis || ["tennis"]),
    ]);
    const out = {}, big = e => Number(e.volume || 0) >= minVol;
    // F1: the next race's winner market.
    const race = f1?.value?.race;
    if (race) {
      const name = norm(race.name);
      const e = f1ev.find(e => norm(e.title).includes(name) && /winner/i.test(e.title) && !/constructor|pole|podium|sprint|fastest/i.test(e.title) && big(e));
      if (e) out.paddock = signalOf(e, { label: `${race.name}: race winner` });
    }
    // Football: the club's next match (win, draw, win).
    const club = C.follows?.football_club?.name, nx = fb?.value?.next?.[0];
    if (club && nx?.opponent) {
      const a = norm(club), b = norm(nx.opponent).split(" ").filter(w => w.length > 3)[0] || norm(nx.opponent);
      const e = fbev.find(e => { const t = norm(e.title); return t.includes(a) && t.includes(b) && / vs /.test(t) && !/more markets/.test(norm(e.slug)) && big(e); });
      if (e) out.madrid = signalOf(e, { label: `${club} ${nx.home ? "v" : "at"} ${nx.opponent}` });
    }
    // Cricket: India's next match.
    const team = norm((C.follows?.cricket_team?.name || "India").split(" ")[0]);
    const cr = crev.filter(e => new RegExp(`(^| )${team} vs | vs ${team}( |$)`).test(norm(e.title).split(" : ").pop() || norm(e.title)) && Date.parse(e.endDate) > Date.now())
      .sort((x, y) => (x.slug.match(/\d{4}-\d\d-\d\d$/)?.[0] || x.endDate).localeCompare(y.slug.match(/\d{4}-\d\d-\d\d$/)?.[0] || y.endDate))
      .find(big);
    if (cr) out.crease = signalOf(cr, { label: cr.title.split(": ").pop() });
    // Tennis: the followed players' next match.
    for (const p of C.follows?.tennis_players || []) {
      const sur = norm(p).split(" ").pop();
      const e = tnev.filter(e => norm(e.title).includes(sur) && / vs /.test(norm(e.title)) && big(e)).sort((x, y) => String(x.endDate).localeCompare(String(y.endDate)))[0];
      if (e) { out.deuce = signalOf(e, { label: e.title }); break; }
    }
    return ok(out, "Polymarket");
  });
}

// The next market in the same line as `title` (e.g. next month's edition of a monthly question): open, ending more
// than 24 hours out, not already decided, soonest first. `similar` decides what counts as the same question.
export async function successor(title, similar, now = Date.now()) {
  const q = title.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{4}\b|\.\.\.|\?/gi, " ").replace(/\s+/g, " ").trim();
  const j = await getJSON(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}&limit_per_type=20&events_status=active`);
  const evs = (j.events || []).filter(e => similar(e.title || "", title) && !e.closed && (!e.endDate || Date.parse(e.endDate) > now + 864e5))
    .sort((a, b) => (Date.parse(a.endDate) || Infinity) - (Date.parse(b.endDate) || Infinity)).slice(0, 3);
  for (const ev of evs) {
    const m = shapePolymarket((await getJSON(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(ev.slug)}`))[0] || ev);
    if (m.outcomes.length && m.outcomes[0].prob < 99) return m;
  }
  return null;
}

export async function betting(params) {
  // ids: "pm:<polymarket slug>" (bare slugs are Polymarket, for older editions). Polymarket only: Kalshi was retired
  // on 25 Sep 2026, and any older "ks:" ids are ignored so those rows keep their press-time prices.
  const ids = (params.get("ids") || params.get("slugs") || "").split(",").map(s => (s.includes(":") ? s : `pm:${s}`))
    .filter(s => /^pm:[a-z0-9-]{3,200}$/.test(s)).slice(0, 14);
  return chain(async () => {
    if (ids.length) {
      const got = await Promise.all(ids.map(id =>
        getJSON(`https://gamma-api.polymarket.com/events?slug=${id.slice(3)}`).then(a => a[0] && { ...shapePolymarket(a[0]), id }).catch(() => null)));
      return ok({ markets: got.filter(Boolean) }, "Polymarket");
    }
    const j = await getJSON("https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=150");
    const kept = filterBetting(j).map(shapePolymarket).filter(m => m.outcomes.length).slice(0, 25);
    if (!kept.length) throw new Error("polymarket empty");
    return ok({ markets: kept }, "Polymarket");
  });
}

// ---------------------------------------------------------------- movers (India, Nifty 500)
// The daily run reads it to find the stocks and industries that moved hard in the last sessions, then researches why.
// The page prints only its breadth (The Ledger, from 30 Sep 2026). Nothing here names a company: the universe is NSE's own Nifty 500 list.
let N500 = null, N100 = null;
export function parseNifty500(csv) {
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head.split(",").map(x => x.trim().toLowerCase());
  const iN = cols.indexOf("company name"), iI = cols.indexOf("industry"), iS = cols.indexOf("symbol");
  if (iN < 0 || iS < 0) throw new Error("nifty500 columns");
  return rows.map(r => r.split(",")).filter(r => r[iS]).map(r => ({ name: r[iN].trim(), industry: (r[iI] || "").trim(), symbol: r[iS].trim() }));
}
// closes: { "SYM.NS": [{ d: "YYYY-MM-DD", c }] }. Sessions are aligned by date across the universe, so a stock
// with a missing day is not compared against the wrong session.
export function moverStats(list, closes, cfg, large = null) {
  const n = cfg.sessions || 2, count = {};
  for (const a of Object.values(closes)) for (const x of a) count[x.d] = (count[x.d] || 0) + 1;
  const days = Object.keys(count).filter(d => count[d] >= Object.keys(closes).length / 2).sort().reverse().slice(0, n);
  const out = [];
  for (const x of list) {
    const a = (closes[`${x.symbol}.NS`] || []).filter(p => Number.isFinite(p.c)).sort((p, q) => p.d.localeCompare(q.d));
    if (a.length < 2) continue;
    const sessions = days.map(d => {
      const i = a.findIndex(p => p.d === d);
      return i > 0 ? Math.round((a[i].c / a[i - 1].c - 1) * 10000) / 100 : null;
    });
    out.push({ ...x, price: a.at(-1).c, sessions });
  }
  const big = x => Math.max(...x.sessions.map(v => Math.abs(v ?? 0)));
  const stocks = out.filter(x => big(x) >= cfg.stock_pct).sort((a, b) => big(b) - big(a)).slice(0, 25);
  const by = {};
  for (const x of out) (by[x.industry] ||= []).push(x);
  const med = a => { const s = [...a].sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const industries = Object.entries(by).filter(([, a]) => a.length >= cfg.industry_min_stocks).map(([industry, a]) => ({
    industry, stocks: a.length, sessions: days.map((_, i) => Math.round(med(a.map(x => x.sessions[i]).filter(v => v != null)) * 100) / 100),
  })).filter(x => x.sessions.some(v => Math.abs(v) >= cfg.industry_pct));
  // Clusters: three or more stocks in one industry moving the same way by at least half the stock threshold in the
  // same session (a sector story hiding inside a flat industry average).
  const clusters = [];
  for (const [industry, a] of Object.entries(by)) for (let i = 0; i < days.length; i++) for (const sign of [1, -1]) {
    const hit = a.filter(x => sign * (x.sessions[i] ?? 0) >= cfg.stock_pct / 2).sort((p, q) => sign * (q.sessions[i] - p.sessions[i]));
    if (hit.length >= 3) clusters.push({ industry, session: days[i], direction: sign > 0 ? "up" : "down", stocks: hit.slice(0, 8).map(x => ({ name: x.name, symbol: x.symbol, pct: x.sessions[i] })) });
  }
  // Breadth for The Ledger (Parth, 30 Sep): the latest session only. How many of the Nifty 500 rose and fell; the five
  // biggest gainers and losers among the large companies (the Nifty 100, which holds the Nifty 50, when its list is
  // known); and the five strongest and weakest industries by their median move.
  const d0 = out.filter(x => Number.isFinite(x.sessions[0])), largeCos = large?.size ? d0.filter(x => large.has(x.symbol)) : d0;
  const byPct = [...largeCos].sort((a, b) => b.sessions[0] - a.sessions[0]), pick = x => ({ name: x.name, symbol: x.symbol, pct: x.sessions[0] });
  const inds = Object.entries(by).map(([industry, a]) => ({ industry, stocks: a.length, pct: Math.round(med(a.map(x => x.sessions[0]).filter(Number.isFinite)) * 100) / 100 }))
    .filter(x => x.stocks >= cfg.industry_min_stocks && Number.isFinite(x.pct)).sort((a, b) => b.pct - a.pct);
  const breadth = d0.length ? { day: days[0], up: d0.filter(x => x.sessions[0] > 0).length, down: d0.filter(x => x.sessions[0] < 0).length, flat: d0.filter(x => x.sessions[0] === 0).length,
    movers_from: large?.size ? "Nifty 100" : "Nifty 500", gainers: byPct.filter(x => x.sessions[0] >= 0.05).slice(0, 5).map(pick), losers: byPct.filter(x => x.sessions[0] <= -0.05).slice(-5).reverse().map(pick), best: inds.filter(x => x.pct >= 0.05).slice(0, 5), worst: inds.filter(x => x.pct <= -0.05).slice(-5).reverse() } : null;
  return { days, stocks, industries, clusters, universe: out.length, breadth };
}
export async function movers() {
  const cfg = config().markets.movers;
  return chain(async () => {
    // NSE's live list first; the copy in config/ (refresh with scripts/nifty500.mjs) if NSE refuses the request.
    if (!N500) {
      try { N500 = parseNifty500(await getText("https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv", { timeout: 10000, headers: { "user-agent": "Mozilla/5.0" } })); }
      catch { N500 = parseNifty500(readFileSync(join(process.cwd(), "config", "nifty500.csv"), "utf8")); }
    }
    // The Nifty 100 (the Nifty 50 and the next 50): breadth names its biggest movers from these large companies.
    if (!N100) {
      try { N100 = new Set(parseNifty500(await getText("https://nsearchives.nseindia.com/content/indices/ind_nifty100list.csv", { timeout: 8000, headers: { "user-agent": "Mozilla/5.0" } })).map(x => x.symbol)); }
      catch { try { N100 = new Set(parseNifty500(readFileSync(join(process.cwd(), "config", "nifty100.csv"), "utf8")).map(x => x.symbol)); } catch { N100 = new Set(); } }
    }
    const closes = {};
    const syms = N500.map(x => `${x.symbol}.NS`);
    const batches = []; for (let i = 0; i < syms.length; i += 20) batches.push(syms.slice(i, i + 20));
    await Promise.all(batches.map(async b => {
      try {
        const j = await getJSON(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${b.map(encodeURIComponent).join(",")}&range=5d&interval=1d`, { headers: { "user-agent": "Mozilla/5.0" }, timeout: 12000 });
        for (const r of j.spark?.result || []) {
          const q = r.response?.[0], ts = q?.timestamp || [], c = [...(q?.indicators?.quote?.[0]?.close || [])];
          // Yahoo's daily series often leaves the latest session's close empty for a third of the list; its own
          // last price (regularMarketPrice at regularMarketTime) is that session's close, or the live price while
          // the market is open. Without this, breadth and the movers check miss those stocks on the latest day.
          const m = q?.meta, day = t => new Date((t + 19800) * 1000).toISOString().slice(0, 10), last = ts.length - 1;
          if (last >= 0 && !Number.isFinite(c[last]) && Number.isFinite(m?.regularMarketPrice) && m?.regularMarketTime && day(m.regularMarketTime) === day(ts[last])) c[last] = m.regularMarketPrice;
          closes[r.symbol] = ts.map((t, i) => ({ d: day(t), c: c[i] }));
        }
      } catch {}
    }));
    const st = moverStats(N500, closes, cfg, N100);
    if (st.universe < 300) throw new Error(`movers: only ${st.universe} of ${N500.length} priced`);
    return ok({ ...st, thresholds: { stock_pct: cfg.stock_pct, industry_pct: cfg.industry_pct }, note: "sessions[i] is the % change on days[i] (IST); days[0] is the latest, live while the market is open" }, "NSE list, Yahoo Finance");
  });
}

// ---------------------------------------------------------------- registry
export const LIVE = { weather, f1_next, f1_standings, f1_last, football, laliga_table, nba, tennis, markets, fx, gold_in, trends, betting, crypto: cryptoPrice, movers, signals };

// Cache seconds per key: [s-maxage, stale-while-revalidate]
export const CACHE = {
  weather: [900, 3600], f1_next: [3600, 21600], f1_standings: [3600, 21600], f1_last: [3600, 21600], football: [1800, 7200],
  laliga_table: [3600, 21600], nba: [3600, 21600], tennis: [3600, 21600], markets: [300, 1800], fx: [900, 3600],
  crypto: [300, 1800], gold_in: [3600, 21600], trends: [1800, 7200], betting: [1800, 7200], movers: [1800, 7200], signals: [1800, 7200],
};
