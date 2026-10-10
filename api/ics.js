// One fixture as a calendar file, for the Sport app's "Add to calendar" (iPhone Safari opens a text/calendar
// response in its own add-event sheet; a blob download from a home-screen app does not).
// GET /api/ics?t=<title>&s=<start ISO>&m=<minutes>&l=<location>&d=<note>&u=<id>. Nothing is stored.
const clean = (v, n = 200) => String(v || "").replace(/[\r\n]+/g, " ").slice(0, n).replace(/([\\;,])/g, "\\$1");
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

// Several events in one file (a race weekend): repeat t, s and m (and u) in order, up to eight.
export function GET(request) {
  const q = new URL(request.url).searchParams, ts = q.getAll("t").slice(0, 8), ss = q.getAll("s"), ms = q.getAll("m"), us = q.getAll("u");
  const evs = ts.map((t, i) => ({ t, start: Date.parse(ss[i] || ""), minutes: Math.min(Math.max(Number(ms[i]) || 120, 15), 600), u: us[i] || us[0] || "" }));
  if (!evs.length || evs.some(e => !Number.isFinite(e.start) || !e.t)) return new Response("missing title or start", { status: 400 });
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The House of 1400//Sport//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...evs.flatMap((e, i) => [
      "BEGIN:VEVENT", `UID:${clean(e.u || e.start, 80).replace(/[^\w.-]/g, "")}${evs.length > 1 ? `-${i}` : ""}@house14`, `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.start + e.minutes * 6e4)}`, `SUMMARY:${clean(e.t)}`,
      q.get("l") ? `LOCATION:${clean(q.get("l"))}` : null, q.get("d") ? `DESCRIPTION:${clean(q.get("d"), 300)}` : null,
      "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${clean(e.t)}`, "END:VALARM", "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].filter(Boolean);
  const name = String(q.get("t")).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fixture";
  // lines longer than 75 octets are folded: a CRLF and a space, as RFC 5545 asks
  const fold = l => { const out = []; let cur = "", n = 0; for (const ch of l) { const b = new TextEncoder().encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; } cur += ch; n += b; } out.push(cur); return out.join("\r\n "); };
  return new Response(lines.map(fold).join("\r\n") + "\r\n", { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="${name}.ics"`, "cache-control": "public, max-age=3600", "x-robots-tag": "noindex" } });
}
