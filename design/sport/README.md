# The Sport desk page (mock, 1 Oct 2026)

The first desk page in the redesign (docs/HANDOVER.md 7.3, step 1), in Page One B's style. It is waiting for Parth's approval. It is a mock, not production: the live paper is unchanged.

- `sport-desk.html`: the mock, one self-contained file that works offline. It shows the edition of 1 Oct with the live figures as printed at press time and the clock held at 15:00 IST. The tabs, Show all, Drivers/Constructors, Full story and the jump list all work. Your Desk is left out.
- `shots/v1/`: phone (390), laptop (1300) and monitor (1920), light and dark, plus `report.json` (no page errors, no sideways scroll, no overlapping text, all seven sections drawn). `src/shot.mjs` also writes each section on its own to `shots/v1/sections/`, which is not kept in git.
- `src/make.mjs` builds the file from the paper's own renderer (`public/app.js`) with the mock layer patched in (`src/proto.js`, `src/proto.css`). Every section is drawn by the real section functions from the real edition and snapshot, so nothing in it is retyped by hand. Run `node scripts/build.mjs`, then `node design/sport/src/make.mjs`, then `node design/sport/src/shot.mjs`.
- In this sandbox ESPN's crests and F1's circuit map cannot load. The screenshots use plain shapes of the same size in their place; the file keeps the real addresses.

## The page, top to bottom
1. **Run line:** the date, the edition number and "Printed 14:14 IST", with the tagline on the right (the tagline is hidden on a phone).
2. **One-line masthead:** a small nameplate (blackletter "The", spaced "HOUSE OF", Playfair "1400") that links to Page One, then Bengaluru now and the Sensex.
3. **Desk tabs:** one row, pinned while you scroll, each tab a rule in its desk's colour; the current desk is shaded. On a phone the row scrolls sideways and the current desk is centred.
4. **The desk's name** (Newsreader, in the desk colour), then the jump list: only the sections printed today, in page order.
5. **The sections, one after another:** The Fixture List, Madridismo, Paddock Notes, The Crease, Deuce, The Wider Pitch, The Sidelines. Each opens with a 2px rule in the desk colour, its name and its usual line in grey italic. There are no filled bands and no seals.
6. **"Next: Tech & AI →"**, then the foot line (Your Desk, Letters, The editor, Archive).

## What changed from today's paper, and why
- **One colour for the whole desk.** Burnt orange (#b8460e, dark mode #f29a62) is used for every highlight, followed-team pill, "The market's view" and table tint. That replaces seven section colours (Madrid purple, F1 red, India blue, tennis green and so on). Team colours in Paddock come from F1's data and stay.
- **Front-page stories in their own section.** Page One carries only headlines, so the 1 Oct front stories now print at the top of their section in the front's order: The Crease gets the Asian Games final story (with its drawing) and Gill's 223, and Madridismo gets the Asencio brief. The "On the Front Page ↑" pointers are gone. When a section has only front stories, its data runs full width with the stories under it in pairs, a drawing beside its text (the same rule as `balanceStories`). This is presentation only: the edition is unchanged.
- **Type:** Newsreader headlines (600, with optical sizes), Source Serif 4 text, Libre Franklin labels and figures. All are self-hosted, embedded here from the Fontsource packages, so the nameplate never falls back. Paddock keeps Titillium Web (its F1 look, approved 1 Oct).
- **Radii come down to 4px** (pills 3px), from 18 to 26px today.
- **"The market's view"** is a ruled line, not a tinted card.
- **Phone fixes found on the way** (also wrong on today's paper): Madrid's next-matches table ran 47px past the edge at 390px and was clipped. It now fits, with the date wrapping under the day. Deuce's tournament table no longer scrolls sideways, and The Crease's "QF 1" labels no longer break.

## For Parth to decide
1. **The Fixture List first** in Sport (my call: it is the week at a glance before the club and driver sections). The brief only said "within Sport".
2. **Newsreader at these sizes:** story headlines at 26px (23px on a phone) and section names at 32px. You found it hard to read on 25 Sep at the sizes used then. If it still is, the swap is one line.
3. **One orange for the desk**, including Madrid's highlight row and Max's pill, in place of each subject's own colour.
