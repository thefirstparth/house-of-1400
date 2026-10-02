// ================================================================ the sheet, sharing a story, a market's detail (v2)
// Parth, 2 Oct: a bottom sheet on phones for detail; a story shared as a picture, with its drawing when it has one.
// One sheet for all of it: it rises from the bottom on a phone and opens in the middle on a laptop; Escape, the close
// button or a tap outside closes it, and focus stays inside while it is open.
const Sheet = (() => {
  let root = null, back = null;
  function open(html, label) {
    close(true);
    back = document.activeElement;
    root = document.createElement("div"); root.className = "vsheet";
    root.innerHTML = `<div class="vs-back" data-close></div><div class="vs-panel" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="vs-x" data-close aria-label="Close">×</button>${html}</div>`;
    document.body.append(root); document.documentElement.classList.add("vs-open");
    requestAnimationFrame(() => root?.classList.add("in")); root.querySelector(".vs-x").focus({ preventScroll: true });
    return root.querySelector(".vs-panel");
  }
  function close(now) {
    if (!root) return; const r = root; root = null; document.documentElement.classList.remove("vs-open");
    r.classList.remove("in"); setTimeout(() => r.remove(), now || stillPage() ? 0 : 220); back?.focus?.({ preventScroll: true });
  }
  document.addEventListener("click", e => { if (root && e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", e => {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...root.querySelectorAll("button,a[href],[tabindex]")].filter(x => !x.disabled && x.offsetParent); if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  });
  return { open, close, get open_() { return !!root; } };
})();

// ---------------------------------------------------------------- a story as a picture
// The paper's own card: the nameplate with the day in dots, the date, a rule in the story's desk colour, the drawing
// when the story has one, the kicker, the headline, the short version, why it matters, and the sources. It takes the
// page's own colours (day or night) and faces. Apps are sent the link to the original story, never this paper's.
const wrapText = (x, text, w) => { const out = []; let line = ""; for (const word of String(text || "").split(/\s+/)) { const t = line ? `${line} ${word}` : word; if (x.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; };
async function storyCard(st) {
  const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
  const desk = deskOf(st.section)?.id || "news", dc = col(`--d-${desk}`) || col("--ink");
  await Promise.all(["600 66px Newsreader", "400 34px 'Source Serif 4'", "italic 400 30px 'Source Serif 4'", "700 22px 'Libre Franklin'", "400 44px UnifrakturMaguntia"].map(f => document.fonts?.load(f).catch(() => null)));
  const W = 1080, P = 80, CW = W - 2 * P, m = document.createElement("canvas").getContext("2d");
  const set = (x, f) => { x.font = f; };
  // lay out first, to know the height
  set(m, "600 66px Newsreader"); const hl = wrapText(m, st.headline, CW);
  set(m, "400 34px 'Source Serif 4'"); const bl = wrapText(m, st.short || st.text || "", CW).slice(0, 9);
  set(m, "italic 400 30px 'Source Serif 4'"); const wl = st.why?.text ? wrapText(m, st.why.text, CW - 28).slice(0, 4) : [];
  const a = ART[st.id]; let img = null;
  if (a?.src) { img = new Image(); img.src = a.src; try { await img.decode(); } catch { img = null; } }
  const ih = img ? Math.round(CW * (img.naturalHeight / img.naturalWidth)) : 0;
  const H = P + 70 + 34 + (img ? ih + 64 : 0) + 44 + hl.length * 74 + 20 + bl.length * 50 + (wl.length ? 40 + wl.length * 44 + 20 : 0) + 50 + 50 + P;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = col("--paper") || "#f3f1ea"; x.fillRect(0, 0, W, H); x.textBaseline = "alphabetic";
  let y = P + 40;
  // the nameplate: "The House of" and the day in dots
  x.fillStyle = col("--ink"); set(x, "400 44px UnifrakturMaguntia"); x.fillText("The", P, y);
  let at = P + x.measureText("The").width + 16; set(x, "600 15px 'Libre Franklin'");
  for (const ch of "HOUSE OF") { x.fillText(ch, at, y - 6); at += x.measureText(ch).width + 6; }
  const sz = 50, scr = await screenFor(sz, Math.max(1.5, sz / 15)), S = dayShares(), bands = bandsOf(scr.dots, S), ox = at + 6 - Math.round(sz * 0.22), oy = y - sz * 0.87;
  bands.forEach((list, i) => { x.fillStyle = (S[i] && col(`--d-${S[i].desk}`)) || col("--ink"); x.beginPath(); for (const d of list) { const rr = Math.min(d.base, 1.1) * scr.g * 0.62; if (rr < 0.2) continue; x.moveTo(ox + d.x + rr, oy + d.y); x.arc(ox + d.x, oy + d.y, rr, 0, Math.PI * 2); } x.fill(); });
  x.fillStyle = col("--muted"); set(x, "500 20px 'Libre Franklin'"); const dt = longDate(E.date); x.fillText(dt, W - P - x.measureText(dt).width, y - 6);
  y += 30; x.fillStyle = dc; x.fillRect(P, y, CW, 4); y += 34;
  if (img) { x.drawImage(img, P, y, CW, ih); y += ih + 30; x.fillStyle = col("--muted"); set(x, "600 15px 'Libre Franklin'"); x.fillText(String(a.credit || "Illustration").toUpperCase(), P, y); y += 34; }
  x.fillStyle = dc; set(x, "700 22px 'Libre Franklin'"); x.fillText(String(st.kicker || sec(st.section)?.name || "").toUpperCase(), P, y + 22); y += 44;
  x.fillStyle = col("--ink"); set(x, "600 66px Newsreader"); for (const l of hl) { y += 74; x.fillText(l, P, y - 14); }
  y += 20; x.fillStyle = col("--ink2"); set(x, "400 34px 'Source Serif 4'"); for (const l of bl) { y += 50; x.fillText(l, P, y - 12); }
  if (wl.length) { y += 40; x.fillStyle = dc; x.fillRect(P, y - 8, 4, wl.length * 44 + 8); x.fillStyle = col("--ink"); set(x, "italic 400 30px 'Source Serif 4'"); for (const l of wl) { y += 44; x.fillText(l, P + 28, y - 12); } y += 20; }
  y += 30; x.fillStyle = col("--rule"); x.fillRect(P, y, CW, 1.5); y += 50;
  x.fillStyle = col("--muted"); set(x, "600 18px 'Libre Franklin'");
  const src = (st.sources || []).map(s => s.label).filter(Boolean).slice(0, 3).join(", ");
  if (src) x.fillText(`SOURCE · ${src.toUpperCase()}`, P, y);
  const ed = `No. ${E.edition_no} · edited by ${CFG.paper.editor.signature.replace(", Editor", "")}`; x.fillText(ed, W - P - x.measureText(ed).width, y);
  return c;
}
async function shareStory(id) {
  const st = findStory(id); if (!st) return;
  const link = st.sources?.[0]?.url || "";
  const panel = Sheet.open(`<h2 class="vs-h">Share</h2><div class="vs-share"><div class="vs-prev"><p class="vs-wait">Setting the card…</p></div><div class="vs-acts">
<button type="button" class="vs-pri" data-act="share" hidden>Share image…</button><button type="button" data-act="copyimg" hidden>Copy image</button><button type="button" data-act="save">Download image</button>
${link ? `<h3>Send the link</h3><div class="vs-two"><a data-act="wa" target="_blank" rel="noopener">WhatsApp</a><a data-act="x" target="_blank" rel="noopener">X</a><a data-act="li" target="_blank" rel="noopener">LinkedIn</a><a data-act="tg" target="_blank" rel="noopener">Telegram</a></div><button type="button" data-act="copylink">Copy link</button>
<p class="vs-note">Apps get the link to the original story (${esc(st.sources[0].label || "the source")}). To send the card itself, share, copy or download the image.</p>` : ""}</div></div>`, "Share this story");
  const q = k => panel.querySelector(`[data-act="${k}"]`), t = encodeURIComponent(st.headline), u = encodeURIComponent(link);
  if (link) { q("wa").href = `https://wa.me/?text=${t}%20${u}`; q("x").href = `https://x.com/intent/post?text=${t}&url=${u}`; q("li").href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`; q("tg").href = `https://t.me/share/url?url=${u}&text=${t}`; }
  const c = await storyCard(st), blob = await new Promise(r => c.toBlob(r, "image/png")), file = new File([blob], `house-of-1400-${E.date}-${id}.png`, { type: "image/png" }), url = URL.createObjectURL(blob);
  const prev = panel.querySelector(".vs-prev"); if (!prev) return;
  prev.innerHTML = `<img src="${url}" alt="${esc(`${st.headline}: the story as a card`)}">`;
  if (navigator.canShare?.({ files: [file] })) { q("share").hidden = false; q("share").onclick = () => navigator.share({ files: [file], title: st.headline }).catch(() => {}); }
  if (window.ClipboardItem && navigator.clipboard?.write) { q("copyimg").hidden = false; q("copyimg").onclick = () => navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => toast("Card copied"), () => toast("The card could not be copied here; download it instead")); }
  q("save").onclick = () => { const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); };
  if (link) q("copylink").onclick = () => navigator.clipboard?.writeText(link).then(() => toast("Link copied"), () => toast(link));
}

// ---------------------------------------------------------------- a market, in detail
// Every outcome with its price now and at press time, what has been traded, and the market itself; boxed and marked
// as a forecast, like every price in the paper.
function betSheet(id) {
  const b = (E.betting || []).find(x => x.id === id); if (!b) return;
  const liveM = !LIVE.betting?.stale && LIVE.betting?.value?.markets || [], L = liveM.find(m => m.id === (b.id.includes(":") ? b.id : `pm:${b.id}`));
  const outs = [...((L?.outcomes?.length ? L.outcomes : b.outcomes) || [])].sort((p, q) => q.prob - p.prob);
  const was = n => b.outcomes?.find(o => o.name === n)?.prob, vol = v => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v || 0)}`);
  Sheet.open(`<p class="vs-k">${esc(b.category || "Market")} <span class="vs-fc">Forecast</span></p><h2 class="vs-h vs-t">${esc(vsV(b.title))}</h2>
<ol class="vs-outs">${outs.map(o => { const p = was(o.name), d = p != null && L ? o.prob - p : 0; return `<li><span class="n">${esc(outcomeLabel(o.name))}</span><b class="tnum">${Math.round(o.prob)}%</b><span class="bar"><i style="width:${Math.max(0, Math.min(100, o.prob)).toFixed(1)}%"></i></span>${Math.abs(d) >= 1 ? `<small class="tnum ${d > 0 ? "up" : "dn"}">${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d))} since press (${Math.round(p)}%)</small>` : ""}</li>`; }).join("")}</ol>
<p class="vs-meta">${b.volume24h ? `${vol(b.volume24h)} traded in a day · ` : ""}${b.since ? `in the paper since ${esc(sparkLabel(b.since))} · ` : ""}${L ? `prices ${LIVE.betting?.as_of ? `at ${esc(istTime(LIVE.betting.as_of))} IST` : "live"}` : "prices at press time"}</p>
<p class="vs-note">A price is what traders pay for a yes, read as the chance they give it. It is a forecast, not a result.</p>
${b.url ? `<a class="vs-pri vs-btn" href="${esc(b.url)}" target="_blank" rel="noopener">Open on ${esc(b.source || "Polymarket")} ↗</a>` : ""}`, b.title);
}
document.addEventListener("click", e => {
  const clip = e.target.closest("[data-clip]");
  if (clip) { e.preventDefault(); e.stopPropagation(); shareStory(clip.dataset.clip); return; }
  const bet = e.target.closest("[data-bet]");
  if (bet && !e.target.closest("a")) { e.preventDefault(); e.stopPropagation(); betSheet(bet.dataset.bet); }
}, true);
document.addEventListener("keydown", e => { const bet = e.target.closest?.("[data-bet]"); if (bet && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); betSheet(bet.dataset.bet); } });
