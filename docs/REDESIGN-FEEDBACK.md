# Redesign feedback (read with docs/HANDOVER.md, section 7)

## 1 Oct 2026: Sport desk mock (`sport-desk.html`, made by another session)

Reviewed at 1440 x 900, 390 x 844 (phone), dark mode, 1920 x 1080 and 2560 x 1440. No page errors, no sideways
scroll. **Verdict: in line with what was agreed. Keep it as the base for the other desks.** Fix the points below
before showing Parth the next desk.

### What matches the brief (keep)
- One row of desk tabs in the six desk colours plus Page One, pinned while scrolling; on the desk page the masthead
  shrinks to one line (nameplate, Bengaluru now, the Sensex); "Next: Tech & AI →" at the foot.
- The desk opener: "Sport" in the desk colour, then the section names as a jump list; every section follows in
  order, so nothing has to be clicked to be read.
- Type: Newsreader headlines, Source Serif 4 text, Libre Franklin labels; UnifrakturMaguntia "The" and Playfair
  "1400". Fonts embedded (self-hosting, as agreed).
- Section colours retired: inside Sport everything carries the Sport colour (burnt orange), as agreed (seven desk
  colours instead of fourteen section colours). Data colours stay: wins and losses, F1 team colours, club crests.
- The 1 Oct fixes are carried over: Fixture List as one row of day columns; Paddock with sessions beside the map and
  the race ahead across the section; drawn stories with the drawing beside the text (Ocon, Ronaldo); Madrid tables.
- Paddock Notes keeps F1's own look (Titillium, team colours), which Parth approved on 1 Oct.

### Fix
1. **Tabs and content are different widths on big monitors.** At 2560 px the tab strip is about 1,120 px wide while
   the content is about 1,500 px, so the tabs sit inset from the columns below. One container width for the masthead,
   the tabs and the content at every screen size.
2. **Broken circuit map.** When the F1 map image fails to load (a slow or blocked image host), a cream box with alt
   text shows in its column. Hide the figure on error and let the sessions take the full width (or sit beside Max
   Watch, as the live paper does when there is no map). Parth hates unexplained white space.
3. **Phone tabs:** the strip scrolls sideways with the first tab cut off ("S" of News). Fine to scroll, but fade the
   edges so it reads as scrollable, and keep the active desk scrolled into view (it is, for Sport).
4. **Colour weight (Parth asked "are we removing colours completely?").** Not removing: each desk has one colour.
   On the Sport page orange is used for the desk title, section rules and names, kickers, every time in the Fixture
   List, every "Show more" link and source links. Keep the desk colour for structure (title, section rules and names,
   kickers, active tab, market bars) and use ink for times and the small links, so the colour marks the desk instead
   of dusting the page. Show Parth both if unsure; he decides.

### Confirm with Parth (do not decide alone)
- **The Fixture List first in Sport.** The agreed order lists Madridismo first; the Fixture List is the whole sports
  week, so first is defensible. Ask.
- **A desk lede.** The first Page One mock had a one-line Bhide lede under each desk title. It needs a new edition
  field (editorial change), so it is out of scope unless Parth asks for it.

### Page One
The final Page One is variant B, specified in `design/page-one/README.md` (section FINAL) and HANDOVER section 7.1:
one screen on any laptop or monitor (lines first, then the page scales to the height within the width), the House Note
on its own line, the editor's note under the lead on big days only, no illustrations on Page One. Use the
`design/page-one/page-one-variants.html?v=B` file as the reference for spacing and the sun and moon arc.

### Check before every hand-back
`scripts/qa/freeze.mjs`, then `scripts/qa/shoot.mjs <tag>` (laptop and phone, light and dark, page errors, sideways
scroll, overlapping text), plus 1920 and 2560 wide for layout changes. Look at the images, not only the report.

## 1 Oct 2026: Illustrations change (news logic, not design)
From the 2 Oct edition the code picks 5 to 9 drawings a day spread across news, sport and the rest (EDITORIAL.md, Art
orders), up from 2 to 3. The lead's 16:9 drawing is skipped when the lead is in poor taste. Every desk page must look
right with a drawing on any story or on none, and with no lead drawing; use `balanceStories` behaviour (a drawn story
takes the whole row with the drawing beside the text).
