// One fixture as a calendar file, for the Sport app's "Add to calendar" (iPhone Safari opens a text/calendar
// response in its own add-event sheet; a blob download from a home-screen app does not).
// GET /api/ics?t=<title>&s=<start ISO>&m=<minutes>&l=<location>&d=<note>&u=<id>. Nothing is stored.
const clean = (v, n = 200) => String(v || "").replace(/[\r\n]+/g, " ").slice(0, n).replace(/([\\;,])/g, "\\$1");
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

export function GET(request) {
  const q = new URL(request.url).searchParams, start = Date.parse(q.get("s") || "");
  const minutes = Math.min(Math.max(Number(q.get("m")) || 120, 15), 600);
  if (!Number.isFinite(start) || !q.get("t")) return new Response("missing title or start", { status: 400 });
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The House of 1400//Sport//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${clean(q.get("u") || start, 80).replace(/[^\w.-]/g, "")}@house14`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + minutes * 6e4)}`, `SUMMARY:${clean(q.get("t"))}`,
    q.get("l") ? `LOCATION:${clean(q.get("l"))}` : null, q.get("d") ? `DESCRIPTION:${clean(q.get("d"), 300)}` : null,
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${clean(q.get("t"))}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const name = String(q.get("t")).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fixture";
  return new Response(lines.join("\r\n") + "\r\n", { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="${name}.ics"`, "cache-control": "public, max-age=3600", "x-robots-tag": "noindex" } });
}
