# ROADMAP

Future plans Parth has asked for, and the "later" items agreed along the way. Nothing here is built yet. When one is built, move it to `docs/DECISIONS.md` and delete it here. Daily runs ignore this file.

## Parth's next plans (28 Sep 2026)

1. **A view for Srishti.** A button that switches the paper to a view made for Parth's wife. To decide with Parth first: what she reads (which sections, and in what order), whether Your Desk is hidden in it, whether it has its own address she can open directly (for example `/for/srishti`), and whether it is lighter or shorter than Parth's paper. It should reuse the day's edition, never a second run.
2. **A better Telegram message.** Rework the daily message `/api/notify` sends (today: date and number, the lead, up to six At a Glance lines, the editor's note, a one-line run status, then the link). To decide with Parth: what it should lead with, how long it is, whether it carries the day's illustrations or the market moods, and the tone (plain, or in Bhide's voice).
3. **Overhaul the whole website structure.** The design overhaul planned after the sources work: the page structure, the order and grouping of sections, navigation, and the look, phone first. Start from what Parth likes and dislikes about today's paper, then mock-ups for approval before any code. Known issue to fold in: on a phone the live strip at the top makes the page slightly wider than the screen (about 15 px of sideways scroll, seen 28 Sep).

## Agreed for later

- **Source trial results (8 Oct 2026).** The ten-edition trial ends with the 8 Oct edition. Then a section-by-section recommendation from the scorecards (`ledger/trial/`, `/trial`): switch on, keep trialling, or drop. Nothing changes in the paper until Parth decides.
- **Section floors that follow the news (after the trial, from 9 Oct 2026).** Part 3 of the section-size middle ground (Parth, 28 Sep): the reading list counts how many widely covered stories each section had that day; on a heavy day the floor rises, on a quiet day it falls. Fixed floors stay until then; they are never raised by hand (that forces filler on quiet days).
- **Bhide in the cartoons (about late October 2026).** A small recurring Bhide with his red pencil in one cartoon a day, like R.K. Laxman's Common Man. Parth: not now, maybe in a month.
- **NSE's official data.** On 28 Sep its daily data was two sessions old and its live-market server was empty during trading hours. Revisit if the trial shows it has caught up; it could then be a second source for movers and one of the two published sources the DMA rule needs.
- **Sensex DMA sources** (config says to skip until two exist).
- **Screen & Stage verdict thresholds from votes** (needs Blob first).
