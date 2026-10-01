# Nameplate samples (1 Oct 2026)

Working samples of five ways the nameplate's "1400" could come alive, plus a recommended combination. Inspired by the
idea behind The Daily Index's masthead (the name reacts to you and can show information) without copying its
look: ours are in print language, not a dot-matrix screen. Nothing here is in the paper yet; Parth picks first.

- `nameplate-samples.html`: one self-contained file that works offline, with the fonts embedded and figures from the
  1 Oct edition. The black bar switches between the options, the size (Large, or Page One B's 52px), Motion off (what a
  reader who turns motion off sees) and Night. `?v=1` to `?v=5`, or `?v=12` for the combination, opens one directly.
- `src/samples.src.html` (the page), `src/build.mjs` (bakes in the data and fonts; run `design/desks/src/make.mjs`
  once first, which caches the fonts), `src/shot.mjs` (drives every option in a browser at rest, under the pointer,
  mid-tap and after, laptop and phone, light and dark). Checked: no page errors, no sideways scroll, 60 frames a second.

## The options
1. **Halftone:** the figures printed as a 45° newsprint screen. The pointer raises a soft tone around itself; a tap sends a ring of ink across, in a desk colour.
2. **Re-set the type:** a tap lifts the figures out like sorts and sets today's facts in their place (No. 7, Printed 14:14, 29°), with a line saying what each is; it goes back by itself.
3. **Off-register:** three desk inks under the black slip out of register with the pointer, the scroll or a tap, then settle. At rest it is today's plain nameplate.
4. **The day in dots:** 1400 in one dot field shared among today's stories, each in its desk colour; point or tap to read that story. This is the most informative option, but the closest to The Daily Index's look, and Playfair's hairlines are lost in the dots.
5. **The 14:00 clock:** split flaps, invisible at rest, roll to the time in India on arrival and back; a tap shows when the paper was printed.
- **1 + 2 (recommended):** the halftone, and a tap's ring of ink carries the next fact across the figures.

## What any of them needs before it ships
- Page One only; desk pages keep the one-line masthead.
- Options 1, 4 and 1 + 2 need the nameplate larger than B's 52px to read (try "Page One size"). That costs Page One some height, which its one-screen fit will have to absorb.
- The canvas draws the text through an SVG image, because Playfair's default figures are oldstyle and a canvas cannot switch to lining figures. This works in every browser.
