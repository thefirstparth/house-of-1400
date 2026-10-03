// IMD's own forecasts beyond the city reading (Parth, 3 Oct: "IMD nowcast feed, we should use it"; "IMD air quality
// forecast, we should use it"). Both keyless; both found behind IMD's own pages, so a change on IMD's side hides them.
// - nowcast: the station nowcast mausam.imd.gov.in draws on its map (GeoServer WFS, layer NowcastWarningStation):
//   for each station, what IMD expects in the next three hours, issued every few hours with a "valid till".
// - air_forecast: the SILAM air-quality forecast (IMD with the Finnish Meteorological Institute): India's AQI category
//   for 85 cities, four days, from the data inside nwp.imd.gov.in/silam/India_AQI_Forecast_Map_cities.html (updated
//   once a day, in the evening).
import { config, getJSON, getText } from "./live.js";

const ok = (value, source) => ({ ok: true, value, source, as_of: new Date().toISOString(), stale: false });
const fail = e => ({ ok: false, value: null, source: null, as_of: null, stale: false, error: String(e?.message || e) });

// IMD's nowcast categories (the legend on its nowcast page), in words for the paper, and how strong each is
export const NOWCAST = {
  cat2: ["light rain", 1], cat3: ["light snow", 1], cat4: ["a light thunderstorm", 2], cat5: ["a slight dust storm", 2],
  cat6: ["lightning, a low chance", 1], cat7: ["moderate rain", 2], cat8: ["moderate snow", 2], cat9: ["a moderate thunderstorm, gusts to 61 km/h", 3],
  cat10: ["a moderate dust storm", 3], cat11: ["lightning, a moderate chance", 2], cat12: ["heavy rain", 3], cat13: ["heavy snow", 3],
  cat14: ["a severe thunderstorm, gusts to 87 km/h", 4], cat15: ["a very severe thunderstorm, gusts over 87 km/h", 4], cat17: ["a thunderstorm with hail", 4],
  cat18: ["a severe dust storm", 4], cat19: ["lightning, a high chance", 3],
};
// "0530" on "2026-10-03" (IST) -> ISO
const at = (date, hhmm) => (/^\d{4}-\d\d-\d\d$/.test(date || "") && /^\d{4}$/.test(hhmm || "") ? new Date(Date.parse(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00+05:30`)).toISOString() : null);
// One station's warning: what is expected (strongest first), from when, until when. Null when there is nothing.
export function stationWarning(p, now = Date.now()) {
  const what = Object.entries(NOWCAST).filter(([k]) => Number(p[k]) > 0).map(([, v]) => v).sort((a, b) => b[1] - a[1]);
  const from = at(p.Date, p.toi); let until = at(p.Date, p.vupto);
  if (from && until && until < from) until = new Date(Date.parse(until) + 864e5).toISOString(); // valid past midnight
  if (!what.length || !until || Date.parse(until) < now) return null;
  return { station: String(p.Station).trim(), what: what.map(w => w[0]), level: Math.max(...what.map(w => w[1])), from, until };
}
export async function nowcast() {
  try {
    const C = config().weather?.imd || {}, places = C.nowcast_stations || {};
    const names = [...new Set(Object.values(places).flat())];
    const q = encodeURIComponent(`Station IN (${names.map(n => `'${n.replace(/'/g, "''")}'`).join(",")})`);
    const j = await getJSON(`https://reactjs.imd.gov.in/geoserver/imd/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:NowcastWarningStation&outputFormat=application/json&CQL_FILTER=${q}`, { timeout: 12000 });
    const rows = (j?.features || []).map(f => f.properties);
    if (!rows.length) throw new Error("nowcast: no stations");
    const now = Date.now();
    const cities = Object.entries(places).map(([city, st]) => {
      const mine = rows.filter(r => st.includes(String(r.Station).trim()));
      const issued = mine.map(r => at(r.Date, r.toi)).filter(Boolean).sort().pop() || null;
      // the city's warning: its stations' strongest, the latest-running
      const w = mine.map(r => stationWarning(r, now)).filter(Boolean).sort((a, b) => b.level - a.level || b.until.localeCompare(a.until))[0] || null;
      return { city, issued, warning: w };
    });
    return ok({ cities }, "IMD nowcast");
  } catch (e) { return fail(e); }
}

// ---- SILAM: India's AQI category, four days, for the paper's cities
export function parseSilam(html) {
  const i = html.indexOf('{"dates"'); if (i < 0) throw new Error("silam: no data");
  let depth = 0, end = -1, inStr = false;
  for (let k = i; k < html.length; k++) {
    const ch = html[k];
    if (inStr) { if (ch === "\\") k++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === "{" || ch === "[") depth++; else if (ch === "}" || ch === "]") { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) throw new Error("silam: unterminated");
  return JSON.parse(html.slice(i, end));
}
const ymd = d => { const [dd, mm, yy] = String(d).split("."); return `${yy}-${mm}-${dd}`; };
export async function air_forecast() {
  try {
    const want = config().weather?.imd?.silam_cities || {};
    const D = parseSilam(await getText("https://nwp.imd.gov.in/silam/India_AQI_Forecast_Map_cities.html", { timeout: 20000 }));
    const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
    const cities = Object.entries(want).map(([city, name]) => {
      const c = (D.cities || []).find(x => x.city === name); if (!c) return null;
      const days = Object.entries(c.aqi || {}).map(([d, cat]) => ({ date: ymd(d), category: cat })).filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      return days.length ? { city, days } : null;
    }).filter(Boolean);
    if (!cities.length) throw new Error("silam: no days ahead for the paper's cities");
    return ok({ cities, issued_for: (D.dates || []).map(ymd) }, "IMD SILAM");
  } catch (e) { return fail(e); }
}

export const IMD = { nowcast, air_forecast };
export const IMD_CACHE = { nowcast: [900, 1800], air_forecast: [10800, 21600] };
