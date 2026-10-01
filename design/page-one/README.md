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
