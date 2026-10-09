# The new design (v2), the default

Live on the real site since 1 Oct 2026; **the default for everyone since 4 Oct 2026** (Parth: "can we now push it to main now?"). The old design (v1) stays one tap away for a while.

- **Open it:** plain `/` opens v2. **The old design:** `/?v1`, or "The old design" in any v2 footer; the device remembers it until `/?v2`. Poster links (`/?poster=...`, the 16:00 poster run) stay in v1, so the posters do not change.
- **Where it applies:** the edition pages only (`/`, `/today`, `/e/<date>`). Archive, the editor's page and posters stay in v1. Desks are addressed `#d-news`, `#d-sport` and so on.
- **v1 is untouched.** `public/app.js` and `public/styles.css` are not changed by v2. The build (`scripts/build.mjs`) assembles `/v2.js` and `/v2.css` from them (`v2/assemble.mjs`), and `index.html` writes either v1's own tags, unchanged, or v2's (tests/v2.test.mjs). If a v2 patch no longer finds its anchor in `app.js` (after a change to the renderer), the build warns and ships v1 alone: the paper never fails to build because of v2.
- **Same paper, same data:** every section is drawn by the paper's own renderer from the same edition and the same live functions, with the same fallbacks and "as of" lines. Nothing the daily run writes changes.

## Files
- `layer.js` also draws the Fixture List (`fixturesV2`, from 10 Oct: design/fixtures-v3, 3b).
- `layer.js`: the page around the sections: Page One, the desks (config `desks_v2`), the masthead, tabs, footers, the lead in its section, The market expects (config `betting.page_one`), Money's 1D and open/closed line, the Fixture List's sport groups.
- `wordmark.js`: the halftone "1400" with the day in dots (design/page-one/README.md, FINAL).
- `v2.css`: over the live stylesheet, from the desk mocks (design/desks) and the reviewed sample (design/sample).
- `head.html`: the run line, the masthead and the tabs.
- `fonts/`: Newsreader, Source Serif 4, Libre Franklin, Playfair Display, UnifrakturMaguntia, Titillium Web (Fontsource woff2, OFL; licences beside them). Self-hosted: v2 never loads Google Fonts.
- `assemble.mjs`: the patch list and the switch. `shot.mjs`: QA (see below).

## Parth's notes on the sample (1 Oct, 24 notes) and what changed
| Note | Change |
|---|---|
| The day in a minute: "Just 4 stories? Didn't we discuss 5-10?" | Never fewer than five lines under the lead; Page One scales down a little further (to 0.75) on a big day to keep them. |
| The editor's note "read too AI" (kept, voice fixed) | EDITORIAL.md and the validator: one point, two sentences, 35 words at most, from 2 Oct. |
| Money: "Is the % a 1-day change? What on weekends?" | Headed 1D; a dot and a line ("Live · till 15:30", "Closed · opens Mon 09:15") per market, and the session's day ("Wed") beside a closed market's move. |
| The market expects: "How is Brazil important?" | Ranked by relevance to his follows (config `betting.page_one`), then volume. |
| The lead: place the drawing by its shape | The lead prints at the top of its own section, the 16:9 drawing across the column, and that section opens the desk. |
| Videsh: "Nothing here?" | The world lead now prints inside Videsh. |
| Fixture List: separate the sports cleanly | Each day in sport groups (Cricket, Football, F1, Tennis, then the rest) under a small label. |
| Close to Home: Ranchi and Prayagraj | Back Home (`back`), a new section from 2 Oct (DECISIONS.md). |
| Madridismo: club logos | ESPN's crests load in production (the sample could not reach ESPN). |

## Parth's notes on v2 (2 Oct)
| Note | Change |
|---|---|
| "I don't need to open the news by hovering over the logo" | The wordmark carries no stories, links or caption any more. |
| "Keeps flowing, like the Daily Index; slightly bigger" | Always moving: a slow current sways the dots and swells them thick and thin, a stronger swell sweeps across every 7 seconds, loose ink drifts around it, the pointer parts the dots with a swirl, a click scatters them and they settle back. 96px (84px on a phone), was 78px. Still with reduced motion; it stops drawing off screen or in a hidden tab. Our own code (halftone dots on a screen), not the Daily Index's. |
| "Too much white space left and right on my Mac and my BenQ" | The page width is the screen's on every laptop and monitor (`--pw`, set with the zoom by `fitOne` and `fitDesk`): Page One scales to fill the height at full width; desk pages grow their type with the screen (zoom 1 to 1.8) at full width, up to 1920px of layout. |
| "The original day in a minute had 7 lines, what happened to ours?" | Every one of the editor's lines prints. In a wide column they run in two columns, so all of them fit one screen with the type still large (zoom 0.94 at 1470x830). |

| "We figured we add colours based on the length of each section; why is it not there?" (2 Oct) | I had read "without colours" in the note above literally and removed them; the colours are back, always on: the figure is shared among the desks in the tabs' order, left to right, each as wide as its share of the day's words, in its own colour (1 Oct: News 26%, Sport 44%, Money 18%, Off Duty 7%, Tech & AI 3%, Close to Home 2%). Its accessible name lists the shares. |

## Parth's picks from the design review (2 Oct; the full system is docs/DESIGN.md)
| Pick | What it is now |
|---|---|
| Night, chosen before the page appears, newspaper-like | Follows the sun in Bengaluru (v2/sun.js) before the first paint; Night or Day by hand is kept until "Auto". Night is warm charcoal newsprint with cream ink, never black. |
| Colour fixes | Off Duty's gold darker (4.9:1); Money is claret pink, so no desk is green or red. The wordmark reads the same tokens and changed with them. |
| Small wordmark in the pinned tabs | Once the masthead scrolls away, Page One's tab shows the day in dots. |
| A live figure flashes once | In ink, when a live figure changes; countdowns never flash. |
| Forecasts boxed apart | The market's view, the Betting Window, Page One's "The market expects" and a market's sheet sit in a dashed box marked Forecast. All refresh every 5 minutes (Page One's now uses live prices too). |
| Charts and bars draw in once | 300ms, the first time they are seen on a desk; never again on a live repaint. |
| Read time in the run line | "15 min read · 1 to skim" (the skim figure is hidden on a phone). |
| The wordmark rests, then swells | Still between swells (no drawing at all), one swell every 7 seconds. |
| A tap re-forms the wordmark | 1400, the temperature, the sky in a word, the time, "Bhatia" (config desks_v2.wordmark), back to 1400 after 6 seconds. Letters from v2/glyphs.json (v2/glyphset.py). |
| Archive calendar | /archive in v2: month calendars, a tile per printed day with the lead, items, the Sensex close and the day's desk strip (dist/archive-days.json, built from the editions). |
| A story as a picture, with its drawing | The Share button opens a sheet with the paper's own card (nameplate in dots, desk rule, the drawing when there is one, headline, text, why it matters, sources); share, copy or download it; send the original story's link to WhatsApp, X, LinkedIn or Telegram. |
| Bottom sheet on phones | sheet.js: from the bottom on a phone, in the middle on a laptop; used by sharing and by a market's detail (tap a slip or a line of "The market expects"). |
| The Week Ahead in seven columns | Monday to Sunday; an empty day is a short rule. |
| docs/DESIGN.md | Google's DESIGN.md format; `npm run design:lint` (0 errors). |
| "So much white space, and what happened to the font size?" (MacBook Air, 2 Oct) | The page scaled until its tallest column fitted, and Weather with the six rows of Sport this week made the middle column tallest: zoom 0.81, small type, the other columns half empty. Now `balanceOne` measures each block once in each column and works out every arrangement (Weather, Sport, Money, The market expects and the evening pick, in that order within a column; the news column at three widths, its lines in one column or two), and the layout with the shortest tallest column wins. Page One still never scrolls on a laptop (Parth, same day): the House Note and the foot share a row, and the Since strip is a block in the shortest column on laptops. At 1470x830: zoom 0.95 day and evening (was 0.81). |
| Sky & Streets' chart, "what has happened to the charts here?" (2 Oct) | `skyChart` in layer.js replaces the old one in v2 (assemble renames it): flat bars with warm and cool ticks, the 30-year average as a pale band, this week as a tinted column, air as a figure and a colour square, the legend on its own line when it does not fit. |
| Fixture List "in ascending order" (2 Oct) | `sportGroups` keeps each day in time order and labels a row when the sport changes. |
| Weather in the ink, the stamp, where I am, near-black night, Stop press (2 Oct) | `v2/ink.js` (bundled before wordmark.js) moves the wordmark by `inkState` of the live weather; `mountWordmark(..., { weather, press })` draws it and the once-per-visit stamp; `hereHead`/`locate`/`awayCity` in layer.js for "Where I am" (`/api/live/weather?lat=&lon=`); night tokens from v1; `.after14` in a column is a Stop press box. |
| "Since 14:00" strip | Built (2 Oct; Parth: "only as long as it does not impact the next day's 2 pm run"). On Page One, only when something changed after print: a market's close, a result not in at press time (checked against the edition's press-time snapshot), sunset or sunrise at home, a forecast that moved 5 points or more. Page-only, from live figures the page already reads: no change to the run, the edition, the validator or the live functions; each edition starts it again from its own print time. No news after press (it would need a new live source). |
| Page One's weather "too cluttered" (2 Oct) | Same readings, three calm parts: the temperature with the outlook and "Feels · High · Low"; a flatter sun arc holding the time left, with sunrise and sunset at its ends; then rain (or the moon at night), air and humidity as label-over-figure cells, and the family's cities as a matching row. |

## QA
**Phones (Parth reads half the time on a phone: Nothing Phone 2, iPhone 17, 16 Pro and other iPhones):** `PHONES=nothing2,iphone17,iphone16pro,iphone16,iphone17promax,iphone16plus,iphone13,iphonemini,iphonese,iphone17land,nothing2land node v2/shot.mjs <tag> v2` shoots every desk on each at its own width and pixel density, with the height left by the browser's bars, light and dark. Phone checks measure against the screen's own width (a phone browser widens the page silently to fit anything that overflows), type under 11px, and links or buttons under 32px tall. 2 Oct: 154 pages, no errors, nothing wider than the screen, no clipped tables, no overlapping text; every small link has a hit area of about 40px (the masthead's two rows 30px, so they never overlap). Chromium only: Safari itself is not in this sandbox, which is one reason the wordmark no longer depends on font loading.

`npm run build`, then `node v2/shot.mjs <tag> v2` (every desk) or `node v2/shot.mjs <tag> v1`, optionally with a path (`/e/2026-09-25`) and `SIZES=1440x900-light,390x844-dark`. It serves `dist/`, answers the live calls from the edition's press-time snapshot and holds the clock at 15:00 IST; it reports page errors, sideways scroll, overlapping text, tables wider than their column and whether Page One fits one screen. On 1 Oct: v1 before and after these changes identical except the pulsing live dots; v2 clean on all desks at 390, 1280, 1440 and 1920, light and dark. On 2 Oct also at 1470x830 (a MacBook Air's window), 2560x1440 and 3440x1440: Page One one screen with all seven lines at each.

## Switching over
Done on 4 Oct 2026: v2 is the default in `withV2`, v1 behind `?v1`. Still to do, later: retire v1: fold the layer into `app.js`, `v2.css` into `styles.css`, drop the old section colours and the patch list. Log it in DECISIONS.md and SPEC.md.
