// Illustrations for the front page (Parth, 28 Sep 2026). The paper publishes as before; an outside illustrator
// (ChatGPT or Codex) reads /art/brief.json, draws for the slots it lists, and pushes the files and a manifest to
// public/art/YYYY-MM-DD/. The build checks every image against the edition and serves only the ones that pass;
// the page shows an image only for a story that has one, in that slot's fixed shape, so nothing else moves.

// The slots: the lead and up to four second stories on the front page, in that order.
export const SHAPES = {
  lead: { ratio: 16 / 9, label: "16:9", size: "1600x900", min_width: 960 },
  second: { ratio: 4 / 3, label: "4:3", size: "1200x900", min_width: 720 },
};
export const MAX_BYTES = 400 * 1024;
export const FORMATS = ["webp", "png", "jpg", "jpeg"];

// No illustration for death, disaster or violence: a cartoon of a tragedy misleads or offends.
export const SENSITIVE = /\b(dead|deaths?|died|dies|dying|kill(s|ed|ing)?|toll|murder(ed|s)?|rape[ds]?|crash(es|ed)?|attack(s|ed)?|blasts?|bomb(s|ed|ing)?|shoot(ing|ings)?|shot|gunm[ae]n|war|missiles?|air ?strikes?|floods?|flooding|earthquakes?|cyclones?|landslides?|stampede|suicide|terror(ism|ist|ists)?|hostages?|victims?|injured|wounded|funeral|obituary|abuse)\b/i;

export const RULES = [
  "Editorial cartoon or illustration style. Never photo-realistic.",
  "No realistic likeness of a real person. Symbolic or generic figures only.",
  "No text inside the image except a word or two that is part of the drawing.",
  "Match the story's facts: draw what the story says happened, nothing more.",
  "One image per slot, in the slot's exact shape (see each slot's size). WebP preferred; PNG or JPEG accepted; animated WebP allowed.",
  `Each file at most ${MAX_BYTES / 1024} KB.`,
  "Only draw for the slots listed here. Stories left out (death, disaster, violence) get no image.",
];

export function artSlots(E) {
  const F = E?.front; if (!F?.lead) return { slots: [], skipped: [] };
  const list = [["lead", F.lead], ...(F.seconds || []).slice(0, 4).map(s => ["second", s])];
  const slots = [], skipped = [];
  for (const [slot, st] of list) {
    const text = `${st.headline} ${st.deck || ""} ${st.short || ""}`;
    if (SENSITIVE.test(text)) { skipped.push({ story_id: st.id, headline: st.headline, reason: "death, disaster or violence: no illustration" }); continue; }
    const shape = SHAPES[slot];
    slots.push({ story_id: st.id, slot, shape: shape.label, size: shape.size, file: `${st.id}.webp`, section: st.section, kicker: st.kicker, headline: st.headline, deck: st.deck || null, short: st.short });
  }
  return { slots, skipped };
}

export function brief(E) {
  const { slots, skipped } = artSlots(E);
  return {
    date: E.date, edition_no: E.edition_no,
    folder: `public/art/${E.date}/`,
    manifest: { file: `public/art/${E.date}/manifest.json`, format: { date: E.date, made_by: "ChatGPT or Codex", items: [{ story_id: "<story_id from a slot>", file: "<file name in the folder>", alt: "<one sentence describing the drawing>" }] } },
    rules: RULES,
    slots, skipped,
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
export function checkArt(E, manifest, read) {
  const { slots } = artSlots(E), bySlot = new Map(slots.map(s => [s.story_id, s]));
  const items = [], rejected = [], used = new Set();
  if (!manifest || !Array.isArray(manifest.items)) return { items, rejected: [{ reason: "manifest.json missing or has no items list" }] };
  if (manifest.date && manifest.date !== E.date) return { items, rejected: [{ reason: `manifest is for ${manifest.date}, the edition is ${E.date}` }] };
  for (const it of manifest.items) {
    const no = reason => rejected.push({ story_id: it?.story_id ?? null, file: it?.file ?? null, reason });
    const slot = bySlot.get(it?.story_id);
    if (!slot) { no("not one of today's slots"); continue; }
    if (used.has(it.story_id)) { no("a second image for the same story"); continue; }
    const file = String(it.file || "");
    if (!/^[\w.-]+$/.test(file) || file.startsWith(".")) { no("file name must be a plain name inside the day's folder"); continue; }
    const ext = file.split(".").pop().toLowerCase();
    if (!FORMATS.includes(ext)) { no(`format .${ext} not accepted (${FORMATS.join(", ")})`); continue; }
    const bytes = read(file);
    if (!bytes) { no("file not found in the folder"); continue; }
    if (bytes.length > MAX_BYTES) { no(`file is ${Math.round(bytes.length / 1024)} KB, the limit is ${MAX_BYTES / 1024} KB`); continue; }
    const dim = imageSize(bytes);
    if (!dim?.w || !dim?.h) { no("not a readable PNG, JPEG or WebP image"); continue; }
    const shape = SHAPES[slot.slot];
    if (Math.abs(dim.w / dim.h - shape.ratio) / shape.ratio > 0.03) { no(`shape ${dim.w}x${dim.h} is not ${shape.label}`); continue; }
    if (dim.w < shape.min_width) { no(`${dim.w} px wide, at least ${shape.min_width} needed`); continue; }
    const alt = String(it.alt || "").trim();
    if (!alt || alt.length > 240 || /—/.test(alt)) { no("alt text missing, too long, or has an em dash"); continue; }
    used.add(it.story_id);
    items.push({ story_id: it.story_id, slot: slot.slot, src: `/art/${E.date}/${file}`, w: dim.w, h: dim.h, alt, credit: String(it.credit || "Illustration").slice(0, 60), animated: !!dim.animated });
  }
  return { items, rejected };
}
