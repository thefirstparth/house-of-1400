import { readLatest } from "../lib/edition-file.js";

export function GET() {
  const latest = readLatest();
  return Response.json({ edition: latest?.date ?? null }, { headers: { "cache-control": "no-store" } });
}
