# Page One and the desks (mock, 1 Oct 2026)

Agreed with Parth on 1 Oct: a one-screen home page, **Page One**, then six desks in reading order, with the new type
(Newsreader headlines, Source Serif 4 text, Libre Franklin labels and figures) and one colour per desk.

| Desk | Sections | Colour |
|---|---|---|
| Page One | the day in a minute, sport this week, money, weather, the market expects, worth your evening | ink |
| News | Desh (India), Videsh (World), Talk of the Day, The Betting Window | navy #1f3f73 |
| Close to Home | Namma Beat (Bengaluru), Back Home (Ranchi, Prayagraj; new), Sky & Streets | sky #0a72a8 |
| Sport | Madridismo, Paddock Notes, The Crease, Deuce, The Wider Pitch, The Sidelines | burnt orange #b8460e |
| Tech & AI | The Lab (AI), The Stack (technology), The Funnel (sales, go-to-market, SaaS) | violet #6a3fb5 |
| Money | The Ledger | green #0b7a43 |
| Off Duty | Screen & Stage, Before You Go | gold #a87a00 |

Colours tested with the dataviz validator: every pair distinct to normal vision (ΔE 15 or more); the closest pairs
for colour-blind readers sit at 6.9 to 7.8, legal because every colour always appears with its desk's name.

- `page-one.html`: the mock, one self-contained file, from the edition of 30 Sep with live figures from 1 Oct, 11:15 IST.
  The tabs work: each desk shows its opener and section index (the full desk pages are the next mock).
- `src.html`, `data-2026-09-30.json`, `collect.mjs` (freezes the data), `build.mjs` (bakes it), `shot.mjs` (screenshots).

Navigation: one row of tabs under the masthead, pinned while scrolling; on desk pages the masthead shrinks to one line
(the name, Bengaluru now, the Sensex); each desk ends with "Next: <desk> →". No second row of section chips.
Page One fits one screen on a laptop (1280 x 760 and up); on a phone it stacks in the same order.

## Round 2: three ways (1 Oct)
`page-one-variants.html?v=A|B|C` (built from `src2.html` by `build.mjs`; screenshots `vA-*`, `vB-*`, `vC-*`, shot by `shot2.mjs`).
- **A · Broadsheet:** weather and money are the nameplate's ears; three columns below.
- **B · Front page:** the day's news big on the left; weather + sport, then money + what the market expects, as two rails.
- **C · Calm grid:** the day's news across the top in three columns; four equal panels below.

All three use the specimen nameplate with the desk strip as navigation and the cleaner sun arc. The lead has no deck. The page prints as many day-in-a-minute lines as fit one laptop screen, at least six (on a phone, the top eight). Fill lines prefer desks that have no panel of their own on Page One.

## Round 3 (1 Oct): Parth picked B
- The day in a minute is the editor's own glance (5 to 10 lines with the lead), never lines cut from other headlines.
- **Fill the screen, any screen** (`fit()` in `src2.html`): print as many of the editor's lines as fit (never fewer than five with the lead), then scale the whole page (CSS `zoom`) until it fills the height, limited by the width (0.85 to 2). A 1280×720 laptop shrinks slightly instead of scrolling; a 1920×1080 or 2560×1440 monitor scales up 1.45 to 1.94 times instead of leaving half the screen empty. Phones are untouched (normal scroll).
- B's columns are top-aligned and the evening pick goes to the shortest column.
- Screenshots `big-B-<w>x<h>.png` from `shot3.mjs`.

## FINAL: Page One is B (approved by Parth, 1 Oct). Parked for implementation.
Mock: `page-one-variants.html?v=B` (add `&note=1` for a big-day editor's note, `&at=21:30` for the night arc). A and C stay for reference only.

**Layout, top to bottom**
1. Run line: date, edition number, "Printed HH:MM IST"; tagline right.
2. Nameplate: blackletter "The", spaced "HOUSE OF", Playfair "1400".
3. Desk strip = navigation: Page One, News, Close to Home, Sport, Tech & AI, Money, Off Duty, each a rule in its desk colour.
4. Three columns:
   - **The day in a minute:** the lead headline (no deck), the editor's note under it on big days only, then the editor's glance lines (5 to 10 with the lead, each tagged, each a link to its desk). The evening pick ("Must watch" from Screen & Stage) when there is one.
   - **Weather** (Bengaluru: temperature, the month headline, feels like and high/low, the sun arc by day or the moon arc in its phase by night, rain or moon lit, air, humidity, one family line) then **Sport this week** (cricket, Madrid, F1, tennis; where to watch on each).
   - **Money** (Sensex big; S&P 500, Brent, Gold 24K with 1D; India and US mood) then **The market expects** (top 3 by the likeliest outcome).
5. House Note (every day): its own line across the page under a double rule, label left, one sentence.
6. Foot line: Your Desk, Letters, The editor, Archive; "Start reading: News".

**Behaviour**
- One screen, any screen: as many glance lines as fit (never fewer than five with the lead), then the whole page scales (0.85 to 2) to fill the height within the width. Phones scroll normally.
- The evening pick goes to the shortest column.
- No illustrations on Page One.
- Self-host the fonts (Newsreader, Source Serif 4, Libre Franklin, Playfair Display, UnifrakturMaguntia) so the nameplate never falls back to a plain serif if Google Fonts is slow or blocked.

**When implementing, carry over the live paper's rules:** every live figure keeps primary, backup, last-known-good with its "as of", else it is hidden; a panel with nothing to say is left out and the columns rebalance (no filler); market-closed and stale states show their time; the arc and figures refresh in the browser as today.
