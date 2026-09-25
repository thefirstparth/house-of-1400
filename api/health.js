import { blobConfigured } from "../lib/blob.js";
import { readLatest } from "../lib/edition-file.js";

export function GET() {
  const latest = readLatest();
  // votes_store says only whether a Blob store is connected; no names, ids or secrets.
  return Response.json({ edition: latest?.date ?? null, votes_store: blobConfigured() }, { headers: { "cache-control": "no-store" } });
}
