// The day's pool (13 Oct 2026; lib/pool.js): code shortlists the day's stories with a floor for every desk, reads
// their articles, and the validator holds the edition to fixed numbers and depth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPool, compactPool, articleText, parseBatchexecute, deskOf } from "../lib/pool.js";

const feeds = [
  { id: "gn-in-top", kind: "signal", desk: "desh", section: "front" },
  { id: "hindu", kind: "news", desk: "desh", section: "dateline" },
  { id: "bbc", kind: "news", desk: "videsh", section: "dateline" },
  { id: "verge", kind: "news", desk: "tech", section: "workshop" },
  { id: "ranchi", kind: "search", desk: "back", section: "back" },
];
const story = (title, sig, n, extra = {}) => ({ title, url: `https://example.com/${encodeURIComponent(title)}`, outlets: Array.from({ length: n }, (_, i) => `Outlet ${i}`), signals: sig, date: new Date().toISOString(), members: [], ...extra });

test("a desk's floor reaches past the global top: a small tech story makes the pool", () => {
  const wire = { items: [], stories: [
    ...Array.from({ length: 6 }, (_, i) => story(`Parliament row number ${i} over the Election Commission in Delhi`, [`gn-in-top#${i + 1}`, "hindu#1"], 9)),
    story("Apple ships an iPhone update that fixes battery drain", ["verge#3"], 2),
    story("Ranchi civic body plans new flyover", ["ranchi#1"], 1),
  ] };
  const cfg = { sources: { feeds }, pool: { clusters: 4, top: 3, headlines: 5, desk_min: { tech: 1, back: 1 } } };
  const P = buildPool(wire, cfg);
  assert.ok(P.clusters.length >= 4, "floors are kept even past the total");
  assert.ok(P.clusters.some(c => c.desk === "tech"), "the tech floor took the iPhone story");
  assert.ok(P.clusters.some(c => c.desk === "back"), "the Back Home floor took the Ranchi story");
  assert.equal(P.clusters.filter(c => c.top).length, 3);
  assert.ok(P.headlines.length >= 1);
});

test("a desk's ceiling stops one desk filling the pool", () => {
  const wire = { items: [], stories: Array.from({ length: 10 }, (_, i) => story(`Delhi court case ${i} on the Election Commission in India`, [`gn-in-top#${i + 1}`, "hindu#1"], 8)) };
  const P = buildPool(wire, { sources: { feeds }, pool: { clusters: 10, top: 10, desk_max: { desh: 4 } } });
  assert.equal(P.clusters.filter(c => c.desk === "desh").length, 4);
});

test("noise never reaches the pool, and a story about an AI lab is AI wherever it was carried", () => {
  const wire = { items: [], stories: [story("Wordle hints and answers for today", ["hindu#1"], 9), story("OpenAI releases a new model for agents", ["bbc#2"], 6)] };
  const P = buildPool(wire, { sources: { feeds }, pool: { clusters: 5, top: 5 } });
  assert.equal(P.clusters.length, 1);
  assert.equal(P.clusters[0].desk, "ai");
});

test("desks: an India story on a general feed is Desh, a world one Videsh", () => {
  const F = Object.fromEntries(feeds.map(f => [f.id, f]));
  assert.equal(deskOf(story("Supreme Court of India stays the order", ["gn-in-top#2"], 5), F), "desh");
  assert.equal(deskOf(story("North Korea fires missiles towards the sea", ["gn-in-top#4"], 5), F), "videsh");
});

test("a site's subscription banner inside the article body is dropped", () => {
  const body = "Subscribed with another email? Logout and Login with that one. The Hindu On Books Books of the week, reviews, excerpts, new titles and features. " + "The Supreme Court on Monday heard the petition on the electoral rolls. ".repeat(6);
  const html = `<script type="application/ld+json">${JSON.stringify({ articleBody: body })}</script>`;
  assert.ok(articleText(html).startsWith("The Supreme Court on Monday"));
});

test("desks: a gadget launch on a tech feed stays Tech, India price and all", () => {
  const F = Object.fromEntries(feeds.map(f => [f.id, f]));
  assert.equal(deskOf(story("Dell XPS 13 with Intel Core Ultra 7 Series 3 processor launched in India", ["verge#1"], 1), F), "tech");
  assert.equal(deskOf(story("POCO X8 Power 5G Review: A 10,000mAh Battery Powerhouse", ["verge#2"], 1), F), "tech");
});

test("a paywalled-only story is never shortlisted; the open outlet is read first", () => {
  const wire = { items: [], stories: [
    story("Only on the paywall", ["bbc#1"], 3, { url: "https://www.nytimes.com/x" }),
    story("Open and Google", ["bbc#2"], 3, { url: "https://news.google.com/rss/articles/ABC", members: [{ title: "Open and Google", outlet: "BBC", url: "https://www.bbc.co.uk/news/1" }] }),
  ] };
  const P = buildPool(wire, { sources: { feeds, paywalled: { hosts: ["nytimes.com"] } }, pool: { clusters: 5, top: 5 } });
  assert.equal(P.clusters.length, 1);
  assert.equal(P.clusters[0].read[0], "https://www.bbc.co.uk/news/1");
});

test("article text: JSON-LD body first, else the article's paragraphs without the furniture", () => {
  const body = "The council approved the plan on Monday after a long debate. ".repeat(8);
  assert.ok(articleText(`<script type="application/ld+json">${JSON.stringify({ "@type": "NewsArticle", articleBody: body })}</script>`).startsWith("The council approved"));
  const html = `<article><p>${"Ministers met in Delhi to discuss the new rules for payment apps and fees. ".repeat(2)}</p><p>Subscribe to our newsletter for more news every day of the week.</p></article>`;
  const t = articleText(html);
  assert.ok(t.includes("Ministers met") && !/newsletter/.test(t));
});

test("Google's batchexecute answer gives the publisher address", () => {
  const inner = JSON.stringify(["garturlres", "https://www.thehindu.com/news/national/x.ece", 1]);
  const text = `)]}'\n\n[["wrb.fr","Fbv4je",${JSON.stringify(inner)},null,null,null,"generic"]]`;
  assert.equal(parseBatchexecute(text), "https://www.thehindu.com/news/national/x.ece");
});

test("the compact pool stays within its size for a full day", () => {
  const clusters = Array.from({ length: 45 }, (_, i) => ({ id: `p-${i}`, rank: i + 1, top: i < 12, desk: "desh", title: `Story ${i}`, outlets: ["A", "B"], n: 2, date: new Date().toISOString(), read: ["https://x.com"], also: [], text: "x".repeat(2400), text_url: "https://x.com" }));
  const out = compactPool({ date: "2026-10-13", counts: { desh: 45 }, clusters, headlines: Array.from({ length: 30 }, (_, i) => ({ id: `h-${i}`, desk: "desh", title: `H ${i}`, outlets: ["A"], n: 1, url: "https://x.com" })), window: {} }, { text_chars: { top: 1600, rest: 800 } });
  assert.ok(out.length < 60000, `${out.length} characters`);
});

test("each city and Managing Madrid get places of their own, local stories first, never listings (Parth, 13 Oct)", () => {
  const cfg = { pool: { clusters: 6, top: 2, desk_min: {}, quotas: [{ feed: "gn-prayagraj", label: "Prayagraj", desk: "back", min: 2, max: 3 }, { feed: "managing-madrid", label: "Managing Madrid", desk: "madrid", min: 1, max: 2 }] },
    sources: { feeds: [{ id: "gn-prayagraj", desk: "back", kind: "search" }, { id: "managing-madrid", desk: "madrid", kind: "news" }, { id: "big", desk: "desh", kind: "news" }] } };
  const d = new Date().toISOString(), st = (title, signals, outlets) => ({ title, url: `https://x.com/${encodeURIComponent(title)}`, outlets, signals, date: d, members: [] });
  const stories = [
    ...Array.from({ length: 6 }, (_, i) => st(`Big national story number ${i} about the economy`, ["big#1"], ["A", "B", "C", "D", "E"])),
    st("Hero bike Price in Prayagraj", ["gn-prayagraj#1"], ["BikeWale"]),
    st("Township planned along Prayagraj-Rewa highway", ["gn-prayagraj#3"], ["TOI"]),
    st("Railway special trains for Diwali across the country", ["gn-prayagraj#30"], ["LatestLY"]),
    st("UPSRTC adds Navratri buses in Prayagraj", ["gn-prayagraj#11"], ["TOI"]),
    st("Daily Thread: 12 October", ["managing-madrid#1"], ["Managing Madrid"]),
    st("Scouting Roma: a tough game awaits Real Madrid", ["managing-madrid#2"], ["Managing Madrid"]),
  ];
  const p = buildPool({ stories }, cfg), q = p.clusters.filter(c => c.quota);
  assert.deepEqual(q.filter(c => c.quota === "Prayagraj").map(c => c.title).sort(), ["Township planned along Prayagraj-Rewa highway", "UPSRTC adds Navratri buses in Prayagraj"]);
  assert.deepEqual(q.filter(c => c.quota === "Managing Madrid").map(c => c.title), ["Scouting Roma: a tough game awaits Real Madrid"]);
  assert.ok(!p.clusters.some(c => /Price in|Daily Thread/.test(c.title)));
});
