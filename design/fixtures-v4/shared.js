// Helpers every way shares: names, days, the countdown, pictures, markets.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ico = k => `<i class="ico">${ICON[k]}</i>`;
const pic = (src, cls, alt = "") => `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
const at = f => Date.parse(`${f.d}T${f.t || "12:00"}:00+05:30`);
const today = NOW.slice(0, 10), DAYMS = 864e5;
const dayOf = d => { const n = Math.round((Date.parse(d) - Date.parse(today)) / DAYMS); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }); };
const dateOf = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
const numOf = d => Number(d.slice(8)), monOf = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const until = f => { const m = Math.round((at(f) - Date.parse(NOW)) / 6e4); return m < 60 ? `in ${m} min` : m < 36 * 60 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} days`; };
const next = FIX.find(f => f.state === "next");
const byDay = list => { const m = new Map(); for (const f of list) { if (!m.has(f.d)) m.set(f.d, []); m.get(f.d).push(f); } return [...m]; };
const where = f => [f.sp === "f1" ? f.ev.place : f.round, f.court].filter(Boolean).join(" · ");
const comp = f => f.sp === "f1" ? f.ev.short : f.comp;
const title = f => f.sp === "f1" ? f.session : `${f.a.short} v ${f.b.short}`;
// A market's sides in the fixture's order: home, the draw if there is one, away; the favourite marked
const sides = f => { const m = f.mkt; if (!m || m.field) return null; const fav = m.a >= m.b ? "a" : "b"; return { a: m.a, b: m.b, draw: m.draw ?? null, fav }; };
const tv = f => f.tv ? `<span class="tv">${ICON.tv}${esc(f.tv)}</span>` : "";
const src = m => `<span class="src">${esc(m.src)} ${ASOF}</span>`;
const drvPic = (code, cls = "ph") => `<span class="${cls}" style="--tc:${DRV[code].col}">${pic(DRV[code].img, "", DRV[code].name)}</span>`;
