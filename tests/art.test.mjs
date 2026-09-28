// Offline tests for front-page illustrations (lib/art.js).
import { test } from "node:test";
import assert from "node:assert/strict";

import { artSlots, brief, checkArt, imageSize } from "../lib/art.js";

const png = (w, h) => { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const webpX = (w, h, animated = false) => { const b = Buffer.alloc(40); b.write("RIFF", 0); b.write("WEBP", 8); b.write("VP8X", 12); b[20] = animated ? 2 : 0; b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);

const E = { date: "2026-09-29", edition_no: 5, front: {
  lead: { id: "lead-1", headline: "RBI holds the repo rate", short: "The central bank kept rates unchanged.", section: "ledger" },
  seconds: [
    { id: "s-1", headline: "Madrid beat Villarreal 2-0", short: "Two second-half goals.", section: "madrid" },
    { id: "s-2", headline: "Floods kill 18 across north India", short: "Rivers rose after heavy rain.", section: "dateline" },
    { id: "s-3", headline: "Apple launches a new watch", short: "India price announced.", section: "workshop" },
    { id: "s-4", headline: "Verstappen fastest in practice", short: "Red Bull quickest.", section: "paddock" },
    { id: "s-5", headline: "A sixth second story", short: "Not a slot.", section: "pitch" },
  ] } };

test("slots: the lead and up to four seconds, tragedy skipped", () => {
  const { slots, skipped } = artSlots(E);
  assert.deepEqual(slots.map(s => `${s.slot}:${s.story_id}`), ["lead:lead-1", "second:s-1", "second:s-3", "second:s-4"]);
  assert.deepEqual(skipped.map(s => s.story_id), ["s-2"]);
  assert.equal(brief(E).folder, "public/art/2026-09-29/");
});

test("image sizes read from the file", () => {
  assert.deepEqual(imageSize(png(1600, 900)), { type: "png", w: 1600, h: 900 });
  assert.deepEqual(imageSize(webpX(1200, 900, true)), { type: "webp", w: 1200, h: 900, animated: true });
  assert.deepEqual(imageSize(jpeg(1600, 900)), { type: "jpeg", w: 1600, h: 900 });
  assert.equal(imageSize(Buffer.from("not an image at all, just text")), null);
});

test("check: only images that fit their slot are shown, with reasons for the rest", () => {
  const files = { "lead.webp": webpX(1600, 900), "s1.png": png(1200, 900), "square.png": png(900, 900), "tiny.png": png(400, 300), "big.jpg": Buffer.concat([jpeg(1200, 900), Buffer.alloc(500 * 1024)]) };
  const manifest = { date: "2026-09-29", items: [
    { story_id: "lead-1", file: "lead.webp", alt: "A vault door held shut." },
    { story_id: "s-1", file: "s1.png", alt: "A white shirt raising two fingers." },
    { story_id: "s-1", file: "s1.png", alt: "Again." },
    { story_id: "s-2", file: "s1.png", alt: "Skipped story." },
    { story_id: "s-3", file: "square.png", alt: "Wrong shape." },
    { story_id: "s-4", file: "tiny.png", alt: "Too small." },
    { story_id: "s-5", file: "s1.png", alt: "Not a slot." },
    { story_id: "s-4", file: "../../content/latest.json", alt: "Escape." },
    { story_id: "s-4", file: "big.jpg", alt: "Too heavy." },
    { story_id: "s-4", file: "missing.webp", alt: "Missing." },
  ] };
  const { items, rejected } = checkArt(E, manifest, f => files[f] || null);
  assert.deepEqual(items.map(i => `${i.slot}:${i.story_id}:${i.src}`), ["lead:lead-1:/art/2026-09-29/lead.webp", "second:s-1:/art/2026-09-29/s1.png"]);
  assert.equal(rejected.length, 8);
  assert.ok(rejected.some(r => /not 4:3/.test(r.reason)));
  assert.ok(rejected.some(r => /plain name/.test(r.reason)));
  assert.ok(rejected.some(r => /limit is 400 KB/.test(r.reason)));
  assert.equal(checkArt(E, { date: "2026-09-28", items: [] }, () => null).items.length, 0);
});
