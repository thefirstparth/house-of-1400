// Offline tests for front-page illustrations (lib/art.js).
import { test } from "node:test";
import assert from "node:assert/strict";

import { artSlots, brief, checkArt, imageSize } from "../lib/art.js";

const png = (w, h) => { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const webpX = (w, h, animated = false) => { const b = Buffer.alloc(40); b.write("RIFF", 0); b.write("WEBP", 8); b.write("VP8X", 12); b[20] = animated ? 2 : 0; b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);

const E = { date: "2026-09-29", edition_no: 5,
  front: {
    lead: { id: "lead-1", headline: "Russell beats Verstappen by 0.196s", short: "A photo finish in Baku.", section: "paddock", sources: [{ label: "Formula 1", url: "https://formula1.com/a" }] },
    seconds: [
      { id: "s-1", headline: "Madrid beat Villarreal 2-0", short: "Two second-half goals.", section: "madrid" },
      { id: "s-2", headline: "Floods kill 18 across north India", short: "Rivers rose after heavy rain.", section: "dateline" },
    ],
    briefs: [{ id: "b-1", headline: "A brief", text: "Short." }] },
  sections: { sidelines: { stories: [{ id: "trophy", headline: "India win the kabaddi gold", short: "Ninth title.", section: "sidelines" }] } },
  art_orders: [{ story_id: "lead-1" }, { story_id: "trophy" }, { story_id: "s-2" }, { story_id: "b-1" }] };

test("orders: Bhide's picks from any section, with the full story, sources and section colour; a brief is served small (4 Oct)", () => {
  const cfg = { sections: [{ id: "paddock", name: "Paddock Notes", palette: "f1" }], art: { section_colours: { f1: "#d0021b" }, styles_the_editor_likes: ["Pen and ink"] } };
  const { slots, skipped } = artSlots(E, cfg);
  assert.deepEqual(slots.map(s => `${s.kind}:${s.story_id}`), ["wide:lead-1", "standard:trophy", "standard:s-2", "standard:b-1"]);
  assert.equal(slots[3].brief, true);
  assert.equal(slots[0].section, "Paddock Notes"); assert.equal(slots[0].section_colour, "#d0021b");
  assert.deepEqual(brief(E, cfg).theme.styles_the_editor_likes, ["Pen and ink"]);
  assert.deepEqual(slots[0].sources, [{ label: "Formula 1", url: "https://formula1.com/a" }]);
  assert.deepEqual(skipped.map(s => s.story_id), []);
  assert.deepEqual(artSlots({ ...E, art_orders: [{ story_id: "nope" }] }).skipped.map(s => s.story_id), ["nope"]);
  assert.equal(brief(E).folder, "public/art/2026-09-29/");
  assert.equal(brief({ ...E, art_orders: undefined }).orders.length, 0);
});

test("image sizes read from the file", () => {
  assert.deepEqual(imageSize(png(1600, 900)), { type: "png", w: 1600, h: 900 });
  assert.deepEqual(imageSize(webpX(1200, 900, true)), { type: "webp", w: 1200, h: 900, animated: true });
  assert.deepEqual(imageSize(jpeg(1600, 900)), { type: "jpeg", w: 1600, h: 900 });
  const gif = Buffer.alloc(13); gif.write("GIF89a", 0); gif.writeUInt16LE(1200, 6); gif.writeUInt16LE(900, 8);
  assert.deepEqual(imageSize(gif), { type: "gif", w: 1200, h: 900, animated: true });
  assert.equal(imageSize(Buffer.from("not an image at all, just text")), null);
});

test("check: only images that fit their order are shown, with reasons for the rest", () => {
  const files = { "lead.webp": webpX(1600, 900), "t.png": png(1200, 900), "square.png": png(900, 900), "tiny.png": png(400, 300), "big.jpg": Buffer.concat([jpeg(1200, 900), Buffer.alloc(700 * 1024)]) };
  const manifest = { date: "2026-09-29", items: [
    { story_id: "lead-1", file: "lead.webp", alt: "Two cars at a photo finish." },
    { story_id: "trophy", file: "t.png", alt: "A kabaddi team lifting a trophy." },
    { story_id: "trophy", file: "t.png", alt: "Again." },
    { story_id: "s-1", file: "t.png", alt: "Not ordered." },
    { story_id: "lead-1", file: "square.png", alt: "Second for the lead." },
  ] };
  const { items, rejected } = checkArt(E, manifest, f => files[f] || null);
  assert.deepEqual(items.map(i => `${i.slot}:${i.story_id}:${i.src.split("?")[0]}`), ["wide:lead-1:/art/2026-09-29/lead.webp", "standard:trophy:/art/2026-09-29/t.png"]);
  assert.match(items[0].src, /\?v=[0-9a-f]{8}$/, "a redrawn image under the same name gets a new address, so no browser keeps the old one");
  assert.equal(rejected.length, 3);
  const one = (id, file) => checkArt({ ...E }, { date: "2026-09-29", items: [{ story_id: id, file, alt: "A drawing." }] }, f => files[f] || null).rejected[0]?.reason;
  assert.match(one("trophy", "square.png"), /not 4:3/);
  assert.match(one("trophy", "tiny.png"), /not 4:3|wide/);
  assert.match(one("trophy", "big.jpg"), /limit is 600 KB/);
  assert.match(one("trophy", "../../content/latest.json"), /plain name/);
  assert.match(one("trophy", "missing.webp"), /not found/);
  assert.equal(checkArt(E, { date: "2026-09-28", items: [] }, () => null).items.length, 0);
  assert.equal(checkArt(E, { items: [manifest.items[0]] }, f => files[f] || null, "Illustration by Bunty Brushwala").items[0].credit, "Illustration by Bunty Brushwala");
  assert.equal(brief(E, { art: { illustrator: { name: "Bunty Brushwala" } } }).manifest.format.made_by, "Bunty Brushwala");
});

// 1 Oct: Bhide scores, the code picks (lib/art.js pickArt).
import { pickArt } from "../lib/art.js";
test("pickArt: lead first unless in poor taste, every group, caps, thin days, overrides", () => {
  const cfg = { desks: [{ id: "front", sections: ["week"] }, { id: "news", sections: ["dateline", "namma"] }, { id: "money", sections: ["ledger"] }, { id: "sport", sections: ["madrid", "pitch", "paddock", "crease", "sidelines"] }, { id: "tech", sections: ["workshop"] }, { id: "life", sections: ["screen", "sky"] }],
    art: { selection: { min: 5, max: 9, candidate_drawable: 2, groups: { news: ["news", "money", "tech"], sport: ["sport"], other: ["life"] }, never_sections: ["sky"], max_group_share: 0.5, max_per_desk: 2 } } };
  const st = (id, section) => ({ id, section, headline: id, short: "x" });
  const E = { front: { lead: st("lead", "dateline"), seconds: [st("s1", "crease"), st("s2", "ledger")] },
    sections: { pitch: { stories: [st("p1", "pitch")] }, paddock: { stories: [st("f1", "paddock")] }, madrid: { stories: [st("m1", "madrid")] }, workshop: { stories: [st("w1", "workshop")] }, screen: { stories: [st("sc1", "screen")] }, dateline: { stories: [st("d1", "dateline")] } } };
  const sc = (id, i, r, d) => ({ story_id: id, importance: i, relevance: r, drawable: d });
  E.art_scores = [sc("lead", 3, 1, 3), sc("s1", 3, 2, 3), sc("s2", 2, 1, 1), sc("p1", 2, 2, 3), sc("f1", 2, 1, 3), sc("m1", 1, 2, 2), sc("w1", 2, 2, 2), sc("sc1", 1, 1, 2), sc("d1", 1, 0, 2)];
  let o = pickArt(E, cfg);
  assert.equal(o[0], "lead");
  assert.ok(o.length >= 5 && o.length <= 9);
  assert.ok(o.includes("sc1"), "the Off Duty group gets one");
  assert.ok(!o.includes("s2"), "drawable 1 is not a candidate");
  assert.ok(["s1", "p1", "f1", "m1"].filter(x => o.includes(x)).length <= 4);
  E.art_scores[0] = sc("lead", 3, 1, 0);                      // the lead in poor taste: no 16:9
  o = pickArt(E, cfg); assert.ok(!o.includes("lead"));
  E.art_scores = [sc("lead", 3, 0, 0), sc("s1", 2, 2, 3)];   // a thin day: one drawing, not padded
  assert.deepEqual(pickArt(E, cfg), ["s1"]);
  E.art_overrides = [{ story_id: "s1", action: "remove", why: "testing a removal" }, { story_id: "d1", action: "add", why: "testing an addition" }];
  assert.deepEqual(pickArt(E, cfg), ["d1"]);
});

// 4 Oct (Parth: "go with option 1"): on a thin day the strongest briefs fill up to min, drawn small beside the brief.
test("pickArt: briefs scored drawable 3 fill a thin day up to min, after the stories; the brief and the check carry them", () => {
  const cfg = { desks: [{ id: "news", sections: ["dateline", "desh"] }, { id: "sport", sections: ["pitch"] }, { id: "life", sections: ["sky"] }],
    art: { selection: { min: 5, max: 9, candidate_drawable: 2, brief_drawable: 3, groups: { news: ["news"], sport: ["sport"], other: ["life"] }, never_sections: ["sky"] } } };
  const st = (id, section) => ({ id, section, headline: id, short: "x" }), br = (id, section) => ({ id, section, headline: id, text: "a brief" });
  const sc = (id, i, r, d) => ({ story_id: id, importance: i, relevance: r, drawable: d });
  const E = { date: "2026-10-05", front: { lead: st("lead", "dateline"), seconds: [st("s1", "pitch")], briefs: [br("fb1", "desh")] },
    sections: { desh: { briefs: [br("b1", "desh"), br("b2", "desh"), br("b3", "desh")] }, sky: { briefs: [br("skyb", "sky")] } },
    art_scores: [sc("lead", 3, 1, 3), sc("s1", 2, 2, 2), sc("fb1", 3, 1, 3), sc("b1", 1, 1, 3), sc("b2", 3, 2, 2), sc("b3", 2, 2, 3), sc("skyb", 3, 2, 3)] };
  const o = pickArt(E, cfg);
  assert.deepEqual(o.slice(0, 2), ["lead", "s1"], "stories first");
  assert.deepEqual(o.slice(2), ["fb1", "b3", "b1"], "then briefs at drawable 3, most important first; drawable 2 and never-sections left out");
  // a full day: no briefs
  E.art_scores.push(sc("x", 0, 0, 0));
  const full = { ...E, sections: { ...E.sections, pitch: { stories: ["p1", "p2", "p3"].map(id => st(id, "pitch")) } }, art_scores: [...E.art_scores, sc("p1", 2, 2, 3), sc("p2", 2, 1, 3), sc("p3", 1, 1, 3)] };
  assert.ok(!pickArt(full, cfg).some(id => id.startsWith("b") || id === "fb1"));
  // the brief for the illustrator marks them, with the brief's text as its short version
  E.art_orders = o.map(story_id => ({ story_id }));
  const { slots } = artSlots(E);
  const b = slots.find(s => s.story_id === "fb1");
  assert.equal(b.brief, true); assert.equal(b.shape, "4:3"); assert.equal(b.short, "a brief");
  assert.equal(slots.find(s => s.story_id === "s1").brief, undefined);
});
