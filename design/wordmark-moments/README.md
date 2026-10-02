# Wordmark moments (mock, 2 Oct 2026)

Parth, 2 Oct, on what could make the 1400 more interesting: "Big moments, the weather in the ink, a printing press on
first load: show all three separately and together, in multiple variants."

`index.html` is one self-contained page (open it in a browser): the paper's own halftone (v2/wordmark.js) with the
2 Oct edition's real split by desk, and each idea in variants. Rebuild with `node design/wordmark-moments/build.mjs`
(the effects are in `src.js`). Nothing here is on the site.

- **A printing press on first load** (once per visit, about 1.5 s): colour plates; the roller; four process colours;
  the stamp.
- **The weather in the ink** (all day, from the live Bengaluru weather): light rain; heavy rain; heat; wind; cloud and
  haze; clear; night.
- **Big moments** (once, the first time the page opens after the result, from the live results): Madrid win, the gold
  wave; India gold, the tricolour; Verstappen wins, the burst; any win, the stadium wave. Optional line under it.
- **Together**: five days, each a press, a weather and (most days none) a moment.

All of it would be page-only: nothing for the 14:00 run to write.
