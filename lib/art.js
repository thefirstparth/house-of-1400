// Illustrations (Parth, 28 Sep 2026). The paper publishes as before. While writing the edition, Bhide lists in
// `art_orders` the stories (0 to 4, any section) that deserve a drawing; which stories, and why, is his judgment
// alone (EDITORIAL.md, Art orders). The orders are never shown to readers. The paper's illustrator, Bunty Brushwala (drawn by Codex), reads
// /art/brief.json, which gives each ordered story in full with its original sources and the paper's look as
// inspiration, decides the idea and the style itself, and pushes the files and a manifest to public/art/YYYY-MM-DD/.
// The only fixed things are about the page, not the drawing: each image's shape (so it fits its story without
// moving anything) and its file size (the paper is read on a phone). The build serves only images that fit.

export const SHAPES = {
  wide: { ratio: 16 / 9, label: "16:9", size: "1600x900", min_width: 960 },
  standard: { ratio: 4 / 3, label: "4:3", size: "1200x900", min_width: 720 },
};
export const MAX_BYTES = 600 * 1024;
export const FORMATS = ["webp", "png", "jpg", "jpeg", "gif"];

// Every printed story (not briefs), with where it sits: the front-page lead is wide, every other story standard.
function printedStories(E) {
  const out = [];
  if (E?.front?.lead) out.push({ st: E.front.lead, shape: "wide", place: "Front Page lead" });
  for (const x of E?.front?.seconds || []) out.push({ st: x, shape: "standard", place: "Front Page" });
  for (const [id, S] of Object.entries(E?.sections || {})) for (const x of S.stories || []) out.push({ st: x, shape: "standard", place: id });
  return out;
}

export function artSlots(E, cfg = {}) {
  const all = printedStories(E), slots = [], skipped = [], seen = new Set();
  const paletteOf = id => cfg.sections?.find(x => x.id === id)?.palette;
  for (const o of (E?.art_orders || []).slice(0, 4)) {
    const hit = all.find(x => x.st.id === o.story_id);
    if (!hit) { skipped.push({ story_id: o.story_id, reason: "not a printed story in this edition" }); continue; }
    if (seen.has(o.story_id)) continue;
    seen.add(o.story_id);
    const st = hit.st, shape = SHAPES[hit.shape], pal = paletteOf(st.section);
    slots.push({ story_id: st.id, shape: shape.label, size: shape.size, file: `${st.id}.webp`, where: hit.place,
      section: cfg.sections?.find(x => x.id === st.section)?.name || st.section, section_colour: pal ? cfg.art?.section_colours?.[pal] || null : null,
      kicker: st.kicker || null, headline: st.headline, deck: st.deck || null, short: st.short, more: st.more || [],
      sources: (st.sources || []).map(x => ({ label: x.label, url: x.url })), kind: hit.shape });
  }
  return { slots, skipped };
}

export function brief(E, cfg = {}) {
  const { slots, skipped } = artSlots(E, cfg);
  const A = cfg.art || {};
  return {
    date: E.date, edition_no: E.edition_no,
    illustrator: A.illustrator?.name || null,
    note: slots.length ? `Bhide has ordered art for these stories${A.illustrator?.name ? `, ${A.illustrator.name}` : ""}. Read each story and its sources, then decide the idea and the style yourself.` : "No art ordered today.",
    orders: slots,
    theme: { about: A.paper || null, paper_colours: A.paper_colours || null, styles_the_editor_likes: A.styles_the_editor_likes || [], note: "Inspiration, not rules. Surprise us." },
    page: { why: "These are about the page, not the drawing: the image must fit its story's space exactly, and the paper is read on a phone.",
      shapes: "Each order gives its shape and size: 16:9 (1600x900) for the front-page lead, 4:3 (1200x900) for every other story.",
      formats: FORMATS, max_kb: MAX_BYTES / 1024 },
    folder: `public/art/${E.date}/`,
    manifest: { file: `public/art/${E.date}/manifest.json`, format: { date: E.date, made_by: A.illustrator?.name || "the illustrator", items: [{ story_id: "<story_id from an order>", file: "<file name in the folder>", alt: "<one sentence describing the image, for screen readers>" }] } },
    skipped,
  };
}

// Width and height from the file itself (PNG, JPEG, WebP including animated), without a library.
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: "jpeg", h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 10 && b.toString("ascii", 0, 4) === "GIF8") return { type: "gif", w: b.readUInt16LE(6), h: b.readUInt16LE(8), animated: true };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { type: "webp", w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), animated: !!(b[20] & 2) };
    if (chunk === "VP8 ") return { type: "webp", w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") { const n = b.readUInt32LE(21); return { type: "webp", w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

// manifest: the illustrator's manifest.json; read(file) returns the file's bytes or null.
// Returns the items the page may show and the reasons for everything else.
export function checkArt(E, manifest, read, credit = "Illustration") {
  const { slots } = artSlots(E), bySlot = new Map(slots.map(s => [s.story_id, s]));
  const items = [], rejected = [], used = new Set();
  if (!manifest || !Array.isArray(manifest.items)) return { items, rejected: [{ reason: "manifest.json missing or has no items list" }] };
  if (manifest.date && manifest.date !== E.date) return { items, rejected: [{ reason: `manifest is for ${manifest.date}, the edition is ${E.date}` }] };
  for (const it of manifest.items) {
    const no = reason => rejected.push({ story_id: it?.story_id ?? null, file: it?.file ?? null, reason });
    const slot = bySlot.get(it?.story_id);
    if (!slot) { no("not one of today's art orders"); continue; }
    if (used.has(it.story_id)) { no("a second image for the same story"); continue; }
    const file = String(it.file || "");
    if (!/^[\w.-]+$/.test(file) || file.startsWith(".")) { no("file name must be a plain name inside the day's folder"); continue; }
    const ext = file.split(".").pop().toLowerCase();
    if (!FORMATS.includes(ext)) { no(`format .${ext} not accepted (${FORMATS.join(", ")})`); continue; }
    const bytes = read(file);
    if (!bytes) { no("file not found in the folder"); continue; }
    if (bytes.length > MAX_BYTES) { no(`file is ${Math.round(bytes.length / 1024)} KB, the limit is ${MAX_BYTES / 1024} KB`); continue; }
    const dim = imageSize(bytes);
    if (!dim?.w || !dim?.h) { no("not a readable PNG, JPEG, WebP or GIF image"); continue; }
    const shape = SHAPES[slot.kind];
    if (Math.abs(dim.w / dim.h - shape.ratio) / shape.ratio > 0.03) { no(`shape ${dim.w}x${dim.h} is not ${shape.label}`); continue; }
    if (dim.w < shape.min_width) { no(`${dim.w} px wide, at least ${shape.min_width} needed`); continue; }
    const alt = String(it.alt || "").trim();
    if (!alt || alt.length > 240) { no("alt text missing or over 240 characters"); continue; }
    used.add(it.story_id);
    items.push({ story_id: it.story_id, slot: slot.kind, src: `/art/${E.date}/${file}`, w: dim.w, h: dim.h, alt, credit, animated: !!dim.animated });
  }
  return { items, rejected };
}
