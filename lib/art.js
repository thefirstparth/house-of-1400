// Illustrations (Parth, 28 Sep 2026). The paper publishes as before. While writing the edition, Bhide lists in
// `art_orders` the stories that get a drawing (from 2 Oct 2026, Parth: the lead always, then 0 to 2 per desk by the
// day's news, 2 to MAX_ORDERS in all) (EDITORIAL.md, Art orders). The orders are never shown to readers. The paper's illustrator, Bunty Brushwala (drawn by Codex), reads
// /art/brief.json, which gives each ordered story in full with its original sources and the paper's look as
// inspiration, decides the idea and the style itself, and pushes the files and a manifest to public/art/YYYY-MM-DD/.
// The only fixed things are about the page, not the drawing: each image's shape (so it fits its story without
// moving anything) and its file size (the paper is read on a phone). The build serves only images that fit.

import { createHash } from "node:crypto";

export const SHAPES = {
  wide: { ratio: 16 / 9, label: "16:9", size: "1600x900", min_width: 960 },
  standard: { ratio: 4 / 3, label: "4:3", size: "1200x900", min_width: 720 },
};
export const MAX_BYTES = 600 * 1024;
export const MAX_ORDERS = 12; // a hard ceiling for the brief; the daily range is config art.selection
export const FORMATS = ["webp", "png", "jpg", "jpeg", "gif"];

// Every printed story, with where it sits: the front-page lead is wide, every other story standard.
function printedStories(E) {
  const out = [];
  if (E?.front?.lead) out.push({ st: E.front.lead, shape: "wide", place: "Front Page lead" });
  for (const x of E?.front?.seconds || []) out.push({ st: x, shape: "standard", place: "Front Page" });
  for (const [id, S] of Object.entries(E?.sections || {})) for (const x of S.stories || []) out.push({ st: x, shape: "standard", place: id });
  return out;
}
// Every printed brief (Parth, 4 Oct: "go with option 1"): a brief gets a small 4:3 drawing beside it, but only to fill
// a thin day (pickArt). One-line items (`lines`) never do.
function printedBriefs(E) {
  const out = [];
  for (const x of E?.front?.briefs || []) out.push({ st: x, shape: "standard", place: "Front Page brief", brief: true });
  for (const [id, S] of Object.entries(E?.sections || {})) for (const x of S.briefs || []) out.push({ st: x, shape: "standard", place: `${id} brief`, brief: true });
  return out;
}
// Stories and briefs, each once (a front brief can repeat in its section)
const printedAll = E => [...new Map([...printedStories(E), ...printedBriefs(E)].map(x => [x.st.id, x])).values()];

// Picking the orders (Parth, 1 Oct 2026, "option 2"): Bhide scores every printed story (art_scores: importance 0-3,
// relevance to Parth 0-2, drawable 0-3, where 0 means poor taste or nothing to draw); the code picks. Candidates are the
// stories at or above sel.candidate_drawable; the lead gets the 16:9 drawing unless it scored 0; every group of desks
// with a candidate gets one; no group takes more than sel.max_group_share and, within a group of several desks, no desk more than sel.max_per_desk while
// there is another candidate; most important first, so a partial run of the illustrator has drawn the best. Fewer
// than sel.min on a thin day, never more than sel.max. On a thin day (fewer than sel.min picked; Parth, 4 Oct: "go with
// option 1") the strongest briefs fill up to sel.min: those scored drawable sel.brief_drawable (3) or more, most important
// first, after the stories; a thin day is still never padded with weak drawings. Bhide's overrides (art_overrides) then add or remove, with a reason.
export function pickArt(E, cfg = {}) {
  const sel = cfg.art?.selection || {}, W = sel.weights || {}, desks = (cfg.desks || []).filter(d => d.id !== "front");
  const deskOf = sec => desks.find(d => d.sections.includes(sec))?.id || null;
  const groupOf = d => Object.entries(sel.groups || {}).find(([, ds]) => ds.includes(d))?.[0] || null;
  const scores = new Map((E?.art_scores || []).map(x => [x.story_id, x]));
  const lead = E?.front?.lead, never = new Set(sel.never_sections || []);
  const all = printedStories(E).filter(x => !never.has(x.st.section)).map((x, i) => {
    const s = scores.get(x.st.id), desk = deskOf(x.st.section);
    return { id: x.st.id, i, desk, group: groupOf(desk), s, total: s ? (W.importance ?? 1) * s.importance + (W.relevance ?? 1) * s.relevance + (W.drawable ?? 1) * s.drawable : -1 };
  }).filter(x => x.s);
  const byScore = (a, b) => b.total - a.total || b.s.drawable - a.s.drawable || a.i - b.i;
  const cand = all.filter(x => x.s.drawable >= (sel.candidate_drawable ?? 2)).sort(byScore);
  const leadHit = lead && all.find(x => x.id === lead.id && x.s.drawable >= 1);
  const pool = [...new Map([...(leadHit ? [leadHit] : []), ...cand].map(x => [x.id, x])).values()];
  const N = Math.min(sel.max ?? 9, pool.length), picked = [];
  const perDesk = {}, perGroup = {}, take = x => { picked.push(x); perDesk[x.desk] = (perDesk[x.desk] || 0) + 1; perGroup[x.group] = (perGroup[x.group] || 0) + 1; };
  if (leadHit) take(leadHit);
  // one for every group that has a candidate, its best, groups in order of their best story
  const groups = [...new Set(cand.map(x => x.group))].filter(Boolean);
  for (const g of groups) if (picked.length < N && !perGroup[g]) { const x = cand.find(c => c.group === g && !picked.includes(c)); if (x) take(x); }
  // then by score, within the caps; if the caps leave slots empty, fill them anyway (drawings over spread)
  const capG = Math.max(1, Math.floor(N * (sel.max_group_share ?? 0.5))), capD = sel.max_per_desk ?? 2;
  for (const strict of [true, false]) for (const x of cand) {
    if (picked.length >= N) break;
    if (picked.includes(x)) continue;
    // the per-desk cap spreads a group of several desks (News, Money, Tech & AI); a group of one desk (Sport) has only the group cap
    const multi = ((sel.groups || {})[x.group] || []).length > 1;
    if (strict && ((multi && (perDesk[x.desk] || 0) >= capD) || (perGroup[x.group] || 0) >= capG)) continue;
    take(x);
  }
  // the lead first, then most important first
  const order = [...picked].sort((a, b) => (b.id === lead?.id) - (a.id === lead?.id) || byScore(a, b)).map(x => x.id);
  // a thin day: the strongest briefs, up to sel.min
  const min = Math.min(sel.min ?? 5, sel.max ?? 9);
  if (order.length < min) {
    const briefs = printedBriefs(E).filter(x => !never.has(x.st.section) && !order.includes(x.st.id)).map((x, i) => {
      const s = scores.get(x.st.id);
      return { id: x.st.id, i: 1000 + i, s, total: s ? (W.importance ?? 1) * s.importance + (W.relevance ?? 1) * s.relevance + (W.drawable ?? 1) * s.drawable : -1 };
    }).filter(x => x.s && x.s.drawable >= (sel.brief_drawable ?? 3)).sort(byScore);
    for (const x of briefs) { if (order.length >= min) break; if (!order.includes(x.id)) order.push(x.id); }
  }
  for (const o of E?.art_overrides || []) {
    const k = order.indexOf(o.story_id);
    if (o.action === "remove" && k >= 0) order.splice(k, 1);
    if (o.action === "add" && k < 0 && printedAll(E).some(x => x.st.id === o.story_id)) order.push(o.story_id);
  }
  return order;
}

export function artSlots(E, cfg = {}) {
  const all = printedAll(E), slots = [], skipped = [], seen = new Set();
  const paletteOf = id => cfg.sections?.find(x => x.id === id)?.palette;
  for (const o of (E?.art_orders || []).slice(0, MAX_ORDERS)) {
    const hit = all.find(x => x.st.id === o.story_id);
    if (!hit) { skipped.push({ story_id: o.story_id, reason: "not a printed story or brief in this edition" }); continue; }
    if (seen.has(o.story_id)) continue;
    seen.add(o.story_id);
    const st = hit.st, shape = SHAPES[hit.shape], pal = paletteOf(st.section);
    slots.push({ story_id: st.id, shape: shape.label, size: shape.size, file: `${st.id}.webp`, where: hit.place,
      section: cfg.sections?.find(x => x.id === st.section)?.name || st.section, section_colour: pal ? cfg.art?.section_colours?.[pal] || null : null,
      kicker: st.kicker || null, headline: st.headline, deck: st.deck || null, short: st.short || st.text || null, more: st.more || [],
      sources: (st.sources || []).map(x => ({ label: x.label, url: x.url })), kind: hit.shape, ...(hit.brief ? { brief: true } : {}) });
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
      shapes: "Each order gives its shape and size: 16:9 (1600x900) for the front-page lead, 4:3 (1200x900) for every other story. An order marked brief is a short news item: its drawing is shown small beside it, so keep it simple and readable at about 200 px wide.",
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
    items.push({ story_id: it.story_id, slot: slot.kind, ...(slot.brief ? { brief: true } : {}), src: `/art/${E.date}/${file}?v=${createHash("sha1").update(bytes).digest("hex").slice(0, 8)}`, w: dim.w, h: dim.h, alt, credit, animated: !!dim.animated });
  }
  return { items, rejected };
}
