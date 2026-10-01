# The new design (v2), behind a switch

Live on the real site since 1 Oct 2026, beside the old design (v1), until Parth switches over.

- **Open it:** add `?v2` to the paper's address once (`/?v2`). The phone or browser remembers it; plain `/` then opens v2 there. **Go back:** `/?v1`, or "The old design" in any v2 footer. Each device chooses for itself.
- **Where it applies:** the edition pages only (`/`, `/today`, `/e/<date>`). Archive, the editor's page and posters stay in v1. Desks are addressed `#d-news`, `#d-sport` and so on.
- **v1 is untouched.** `public/app.js` and `public/styles.css` are not changed by v2. The build (`scripts/build.mjs`) assembles `/v2.js` and `/v2.css` from them (`v2/assemble.mjs`), and `index.html` writes either v1's own tags, unchanged, or v2's (tests/v2.test.mjs). If a v2 patch no longer finds its anchor in `app.js` (after a change to the renderer), the build warns and ships v1 alone: the paper never fails to build because of v2.
- **Same paper, same data:** every section is drawn by the paper's own renderer from the same edition and the same live functions, with the same fallbacks and "as of" lines. Nothing the daily run writes changes.

## Files
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
| "I don't need to open the news by hovering over the logo" | The wordmark carries no stories, links, colours or caption any more. |
| "Keeps flowing, like the Daily Index; slightly bigger; no section colours" | Ink only and always moving: a slow current sways the dots and swells them thick and thin, a stronger swell sweeps across every 7 seconds, loose ink drifts around it, the pointer parts the dots with a swirl, a click scatters them and they settle back. 96px (84px on a phone), was 78px. Still with reduced motion; it stops drawing off screen or in a hidden tab. Our own code (halftone dots on a screen), not the Daily Index's. |
| "Too much white space left and right on my Mac and my BenQ" | The page width is the screen's on every laptop and monitor (`--pw`, set with the zoom by `fitOne` and `fitDesk`): Page One scales to fill the height at full width; desk pages grow their type with the screen (zoom 1 to 1.8) at full width, up to 1920px of layout. |
| "The original day in a minute had 7 lines, what happened to ours?" | Every one of the editor's lines prints. In a wide column they run in two columns, so all of them fit one screen with the type still large (zoom 0.94 at 1470x830). |

## QA
**Phones (Parth reads half the time on a phone: Nothing Phone 2, iPhone 17, 16 Pro and other iPhones):** `PHONES=nothing2,iphone17,iphone16pro,iphone16,iphone17promax,iphone16plus,iphone13,iphonemini,iphonese,iphone17land,nothing2land node v2/shot.mjs <tag> v2` shoots every desk on each at its own width and pixel density, with the height left by the browser's bars, light and dark. Phone checks measure against the screen's own width (a phone browser widens the page silently to fit anything that overflows), type under 11px, and links or buttons under 32px tall. 2 Oct: 154 pages, no errors, nothing wider than the screen, no clipped tables, no overlapping text; every small link has a hit area of about 40px (the masthead's two rows 30px, so they never overlap). Chromium only: Safari itself is not in this sandbox, which is one reason the wordmark no longer depends on font loading.

`npm run build`, then `node v2/shot.mjs <tag> v2` (every desk) or `node v2/shot.mjs <tag> v1`, optionally with a path (`/e/2026-09-25`) and `SIZES=1440x900-light,390x844-dark`. It serves `dist/`, answers the live calls from the edition's press-time snapshot and holds the clock at 15:00 IST; it reports page errors, sideways scroll, overlapping text, tables wider than their column and whether Page One fits one screen. On 1 Oct: v1 before and after these changes identical except the pulsing live dots; v2 clean on all desks at 390, 1280, 1440 and 1920, light and dark. On 2 Oct also at 1470x830 (a MacBook Air's window), 2560x1440 and 3440x1440: Page One one screen with all seven lines at each.

## Switching over (when Parth says so)
Make v2 the default in `withV2` (v1 behind `?v1` for a while), then retire v1: fold the layer into `app.js`, `v2.css` into `styles.css`, drop the old section colours and the patch list. Log it in DECISIONS.md and SPEC.md.
