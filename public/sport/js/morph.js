// Patch a live element to match new markup, keeping every node that is the same element in the same place, so a
// redraw never throws the page away: a pill or thumb whose position changed glides (its CSS transition runs), a crest
// or photo already decoded stays painted, an open "more" list stays open, a sheet already up does not slide up again,
// and a score that has just rolled in finishes its roll. Nodes are matched by tag and key (id, data-match, data-k),
// else by tag in order.
const KEEP_ATTR = new Set(["open"]); // state the reader set (an opened list) survives a redraw
const KEEP_CLASS = ["bump"]; // an animation under way finishes
const key = n => (n.nodeType === 1 ? n.id || n.getAttribute("data-match") || n.getAttribute("data-k") || null : null);
const alike = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);

export function morph(el, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  kids(el, tpl.content);
}

function kids(from, to) {
  let cur = from.firstChild;
  for (const nn of [...to.childNodes]) {
    let m = null;
    if (key(nn)) { for (let c = cur; c; c = c.nextSibling) if (alike(c, nn)) { m = c; break; } }
    else if (cur && alike(cur, nn)) m = cur;
    if (m) {
      if (m === cur) cur = cur.nextSibling; else from.insertBefore(m, cur);
      patch(m, nn);
    } else from.insertBefore(nn, cur);
  }
  while (cur) { const n = cur.nextSibling; from.removeChild(cur); cur = n; }
}

function patch(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  for (const { name, value } of [...b.attributes]) {
    if (name === "class") {
      const keep = KEEP_CLASS.filter(c => a.classList.contains(c) && a.getAttribute("data-v") === b.getAttribute("data-v"));
      const v = [value, ...keep].join(" ").trim();
      if (a.getAttribute("class") !== v) a.setAttribute("class", v);
    } else if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name) && !KEEP_ATTR.has(name) && !(name === "class" && a.classList.contains("bump"))) a.removeAttribute(name);
  // an image that failed and was swapped for initials: leave the swap alone
  kids(a, b);
}
