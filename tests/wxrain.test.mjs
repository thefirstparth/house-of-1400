// The weather app's measured rain (lib/wxrain.js): Weather Union on the app's own key, a fixed budget forever (Parth,
// 24 Oct 2026). A pretend store and a pretend Weather Union prove the caps under constant rain, a year of it, and two
// servers asking at once; and the gauge over the forecast only when switched on.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.house_KV_REST_API_URL = "https://store.test"; process.env.house_KV_REST_API_TOKEN = "t"; process.env.WU_KEY = "k";
const { wuReadings, applyRain, summary, parse, due, rainSoon } = await import("../lib/wxrain.js");
const { WORD, chipFor } = await import("../lib/wxapp.js");

// the store: INCR, DECR, EXPIRE, SET (NX, EX), MGET over a map with expiries
let S = new Map(), T = 0, wuCalls = 0, wuRain = 0.2;
const get = k => { const v = S.get(k); if (!v) return null; if (v.exp && v.exp <= T) { S.delete(k); return null; } return v.v; };
const run = ([cmd, ...a]) => {
  if (cmd === "INCR" || cmd === "DECR") { const n = Number(get(a[0]) || 0) + (cmd === "INCR" ? 1 : -1); S.set(a[0], { v: String(n), exp: S.get(a[0])?.exp }); return n; }
  if (cmd === "EXPIRE") { const v = S.get(a[0]); if (v) v.exp = T + Number(a[1]) * 1000; return 1; }
  if (cmd === "MGET") return a.map(get);
  if (cmd === "SET") { const nx = a.includes("NX"), ex = a.indexOf("EX"); if (nx && get(a[0]) != null) return null; S.set(a[0], { v: a[1], exp: ex > 0 ? T + Number(a[ex + 1]) * 1000 : null }); return "OK"; }
  throw new Error("cmd " + cmd);
};
globalThis.fetch = async (url, o = {}) => {
  if (String(url).startsWith("https://store.test")) return { ok: true, json: async () => JSON.parse(o.body).map(c => ({ result: run(c) })) };
  wuCalls++;
  return { ok: true, json: async () => ({ status: "200", message: "", device_type: 2, locality_weather_data: { rain_intensity: wuRain, rain_accumulation: 3.4 } }) };
};
const city = (id, wet = false) => ({ id, name: id, now: { k: wet ? "rain" : "cloudy", day: true }, hours: [{ t: "x", p: wet ? 80 : 10, k: wet ? "rain" : "cloudy" }], nowcast: null });
const CITIES = () => [city("blr"), city("pyj"), city("rnc"), city("ggn")];
const IST0 = Date.parse("2026-10-24T18:30:00Z"); // midnight IST, 25 Oct

test("parse: a reading, an outage (HTTP 200, 'temporarily unavailable'), a bad id", () => {
  assert.deepEqual(parse({ status: "200", message: "", device_type: 2, locality_weather_data: { rain_intensity: 0.2, rain_accumulation: 1.4, temperature: null } }), { ok: true, type: 2, intensity: 0.2, today: 1.4, temp: null });
  assert.equal(parse({ status: "200", message: "temporarily unavailable", device_type: 1, locality_weather_data: { rain_intensity: null } }).ok, false);
  assert.equal(parse({ status: "400", message: "check the locality id from the api doc" }).ok, false);
});

test("due: hourly, every 15 minutes in rain, a minute's slack", () => {
  const at = new Date(IST0).toISOString();
  assert.equal(due(null, IST0, false), true);
  assert.equal(due({ at }, IST0 + 58 * 6e4, false), false);
  assert.equal(due({ at }, IST0 + 59 * 6e4, false), true);
  assert.equal(due({ at }, IST0 + 14 * 6e4, true), true);
  assert.equal(rainSoon(city("x", true)), true); assert.equal(rainSoon(city("x")), false);
});

test("a day of rain everywhere, the feed asking every 5 minutes: at most 150 calls, at most 54 of them boosted, each station read every hour", async () => {
  S = new Map(); wuCalls = 0; wuRain = 0.2;
  const reads = {};
  for (T = IST0; T < IST0 + 86400e3; T += 5 * 6e4) {
    const out = await wuReadings(CITIES(), T);
    for (const [cid, rs] of Object.entries(out)) for (const r of rs) if (r.at === new Date(T).toISOString()) (reads[r.id] ||= []).push(T);
  }
  assert.ok(wuCalls <= 150, `calls ${wuCalls}`);
  assert.equal(Number(get("wxwu:b:2026-10-25")), 54); // the whole boost is spent, then hourly
  for (const [id, ts] of Object.entries(reads)) { const gaps = ts.slice(1).map((t, i) => (t - ts[i]) / 6e4); assert.ok(Math.max(...gaps) <= 60, `${id} longest gap ${Math.max(...gaps)}`); }
});

test("a dry day: every station hourly, 96 calls, no boost", async () => {
  S = new Map(); wuCalls = 0; wuRain = 0;
  for (T = IST0 + 86400e3; T < IST0 + 2 * 86400e3; T += 5 * 6e4) await wuReadings(CITIES(), T);
  assert.equal(wuCalls, 96);
  assert.equal(get("wxwu:b:2026-10-26"), null);
});

test("a whole financial year of rain, 2027-28 (a leap year): never over 150 a day or 54,900 a year", async () => {
  S = new Map(); wuCalls = 0; wuRain = 0.2;
  const y0 = Date.parse("2027-03-31T18:30:00Z"); let maxDay = 0, prev = 0;
  for (T = y0; T < y0 + 366 * 86400e3; T += 15 * 6e4) {
    await wuReadings(CITIES(), T);
    if ((T - y0) % 86400e3 === 86400e3 - 15 * 6e4) { maxDay = Math.max(maxDay, wuCalls - prev); prev = wuCalls; }
  }
  assert.ok(maxDay <= 150, `max a day ${maxDay}`);
  assert.ok(wuCalls <= 54900, `year ${wuCalls}`);
  assert.equal(Number(get("wxwu:fy:2027-28")), wuCalls);
});

test("two servers at the same moment read a station once", async () => {
  S = new Map(); wuCalls = 0; wuRain = 0;
  T = IST0 + 3 * 86400e3;
  await Promise.all([wuReadings(CITIES(), T), wuReadings(CITIES(), T)]);
  assert.equal(wuCalls, 4);
});

test("no store, no calls", async () => {
  const u = process.env.house_KV_REST_API_URL; delete process.env.house_KV_REST_API_URL; wuCalls = 0;
  assert.deepEqual(await wuReadings(CITIES(), IST0), {}); assert.equal(wuCalls, 0);
  process.env.house_KV_REST_API_URL = u;
});

test("the gauge over the forecast: only when switched on; rain at home makes it rain now, a dry gauge takes 'rain now' away; work adds its own", () => {
  const now = IST0, at = new Date(now - 10 * 6e4).toISOString();
  const wet = [{ role: "home", name: "Brookefields", ok: true, intensity: 0.1, today: 2.3, at }, { role: "work", name: "Koramangala", ok: true, intensity: 0, today: 0.4, at }];
  const off = applyRain(city("blr"), wet, WORD, chipFor, now, { fresh_min: 75, apply: false });
  assert.equal(off.now.k, "cloudy"); assert.equal(off.rain_now.station, "Brookefields"); assert.equal(off.rain_now.raining, true); assert.equal(off.rain_now.rate_mm_h, 6); assert.equal(off.rain_now.heavy, false); assert.equal(off.rain_now.work.raining, false);
  const on = applyRain(city("blr"), wet, WORD, chipFor, now, { fresh_min: 75, apply: true });
  assert.equal(on.now.k, "rain"); assert.equal(on.now.word, "Rain"); assert.deepEqual(on.chip, { kind: "rain", text: "Rain now" });
  const dry = applyRain(city("blr", true), [{ ...wet[0], intensity: 0 }], WORD, chipFor, now, { fresh_min: 75, apply: true });
  assert.equal(dry.now.k, "cloudy"); assert.notEqual(dry.chip?.text, "Rain now");
  const old = applyRain(city("blr"), [{ ...wet[0], at: new Date(now - 90 * 6e4).toISOString() }], WORD, chipFor, now, { fresh_min: 75, apply: true });
  assert.equal(old.rain_now, undefined); assert.equal(old.now.k, "cloudy");
  // only the work gauge raining still makes Bengaluru rain; a dry home gauge alone doesn't overrule a wet work gauge
  const workOnly = applyRain(city("blr", true), [{ ...wet[0], intensity: 0 }, { ...wet[1], intensity: 0.4 }], WORD, chipFor, now, { fresh_min: 75, apply: true });
  assert.equal(workOnly.now.k, "rain"); assert.equal(workOnly.hours[0].p, 100); assert.equal(workOnly.rain_now.raining, false); assert.equal(workOnly.rain_now.work.raining, true);
  const both = applyRain(city("blr"), [{ ...wet[0], intensity: 0.2 }, { ...wet[1], intensity: 0.8 }], WORD, chipFor, now, { fresh_min: 75, apply: true });
  assert.equal(both.now.k, "heavyrain");
  assert.equal(summary({ ok: false, at }, now), null);
});
