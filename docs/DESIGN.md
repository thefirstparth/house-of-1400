---
version: alpha
name: The House of 1400
description: A private afternoon newspaper for one reader in Bengaluru, printed once a day at 14:00 IST, with live figures between the lines. This is the new design (v2, v2/), behind ?v2 until Parth switches.
colors:
  primary: "#15140f"
  paper: "#f3f1ea"
  sheet: "#fbfaf6"
  ink: "#15140f"
  ink-2: "#3a3830"
  muted: "#625d52"
  rule: "#d5d0c3"
  rule-2: "#e4e0d5"
  good: "#0b7a43"
  bad: "#c0261d"
  desk-one: "#15140f"
  desk-news: "#1f3f73"
  desk-home: "#0a72a8"
  desk-sport: "#b8460e"
  desk-tech: "#6a3fb5"
  desk-money: "#9b2f6e"
  desk-off: "#876200"
  night-paper: "#131210"
  night-sheet: "#1b1a17"
  night-ink: "#efe8d8"
  night-ink-2: "#d4ccba"
  night-muted: "#aca390"
  night-rule: "#3a3730"
  night-good: "#6fd49a"
  night-bad: "#ff9585"
  night-desk-news: "#a9c2ee"
  night-desk-home: "#86cff3"
  night-desk-sport: "#f4a06a"
  night-desk-tech: "#c0aaf4"
  night-desk-money: "#f0a3c9"
  night-desk-off: "#e9c766"
typography:
  wordmark-figure:
    fontFamily: Playfair Display
    fontSize: 96px
    fontWeight: 900
    fontFeature: '"lnum"'
  wordmark-the:
    fontFamily: UnifrakturMaguntia
    fontSize: 33px
    fontWeight: 400
  desk-name:
    fontFamily: Newsreader
    fontSize: 58px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.015em
  section-name:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.08
  lead-headline:
    fontFamily: Newsreader
    fontSize: 50px
    fontWeight: 600
    lineHeight: 1.06
  story-headline:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: Source Serif 4
    fontSize: 17.5px
    fontWeight: 400
    lineHeight: 1.55
  label-caps:
    fontFamily: Libre Franklin
    fontSize: 11.5px
    fontWeight: 700
    letterSpacing: 0.09em
  figure:
    fontFamily: Libre Franklin
    fontSize: 15px
    fontWeight: 600
    fontFeature: '"tnum", "lnum"'
  f1:
    fontFamily: Titillium Web
    fontSize: 15px
    fontWeight: 600
rounded:
  none: 0px
  sm: 3px
  md: 4px
spacing:
  gutter: 16px
  gutter-wide: 40px
  stack: 12px
  section: 46px
components:
  desk-tab:
    textColor: "{colors.desk-news}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.none}"
  section-head:
    textColor: "{colors.desk-sport}"
    typography: "{typography.section-name}"
  forecast-box:
    textColor: "{colors.ink}"
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  button-primary:
    textColor: "{colors.paper}"
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px
  button-plain:
    textColor: "{colors.ink}"
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

A Bengaluru afternoon broadsheet, edited by a strict, well-read editor of the 1950s, delivered to one reader's phone and laptop. It is printed once a day at 14:00 IST and is half live, like the Daily Prophet: the news is written once, the figures between the lines (markets, scores, weather, odds) keep moving. The page is a printed object first: warm paper, black ink, rules, a nameplate. The screen is the substrate; the design is the page.

It is read half the time on a phone (a Nothing Phone 2, iPhone 17 and 16 Pro), half on a MacBook Air and monitors from 1280 to 3440 pixels wide. Every decision has to hold on all of them.

The structure is Page One, then six desks behind one row of tabs: News, Close to Home, Sport, Tech & AI, Money, Off Duty. Page One fits one screen on a laptop or monitor; desks scroll.

## Colors

One ink, one paper, and one colour per desk. Colour marks structure, never decoration.

- **Paper** {colors.paper} is the canvas, warm newsprint, never pure white. **Sheet** {colors.sheet} is the lighter stock for cards and sheets.
- **Ink** {colors.ink} (the primary, {colors.primary}) carries all type, all rules and every figure. **Ink 2** {colors.ink-2} and **muted** {colors.muted} are for secondary lines and metadata.
- **The desk colours** (News {colors.desk-news}, Close to Home {colors.desk-home}, Sport {colors.desk-sport}, Tech & AI {colors.desk-tech}, Money {colors.desk-money}, Off Duty {colors.desk-off}) mark a desk's structure only: its name, its tab, section rules and names, kickers, in-section tabs, market bars, the followed team's tint, and the wordmark's dots. Times, figures, "Show more", sources and other small links stay ink.
- **Good** {colors.good} and **bad** {colors.bad} are data colours: up and down, wins and losses. No desk may use a green or a red, so a desk is never read as a result. Money is a claret pink (a financial paper's pink) for this reason.
- Data keeps its own colours where the world has them: F1 team colours, club crests.
- **Night** is a warm near-black, the old design's (Parth, 2 Oct): {colors.night-paper} paper, {colors.night-ink} cream ink, warm rules. Never a cold pure black. Night follows the sun in Bengaluru (sunset to sunrise) unless the reader has chosen Day or Night by hand.
- Every pair of text and paper passes WCAG AA (4.5:1) in both modes; Off Duty's gold is the closest at 4.9:1 by day.

## Typography

Four faces, each with one job, all self-hosted (v2/fonts), never loaded from Google.

- **Newsreader** for every headline and name: desk names, section names, story headlines, the lead. Weight 600; large sizes pull tracking slightly negative.
- **Source Serif 4** for reading: story text, decks, why it matters, the editor's note in italic. 17.5px, line height 1.55.
- **Libre Franklin** for labels and figures: kickers, tabs, metadata, tables, prices. Capitals labels are tracked +0.08 to +0.1em; figures always use tabular, lining numerals ({typography.figure}), so columns of numbers line up.
- **Playfair Display Black** only for the wordmark's "1400", with lining figures, and **UnifrakturMaguntia** only for its "The".
- Paddock Notes keeps **Titillium Web**, Formula 1's own face.
- Two registers: a whisper (small tracked capitals) and a shout (the wordmark, desk names, the lead headline). Nothing in between shouts.
- No type below 10px on a phone, and none below 11px for anything that is read rather than glanced at.

## Layout

- **Width follows the screen.** On laptops and monitors the masthead, the tabs and the page scale together and take the screen's full width (layout up to 1920px on desk pages, 2600px on Page One), so there are no empty margins on a wide screen. Phones and small tablets keep the plain layout with a 16px gutter.
- **Page One is one screen** on every laptop and monitor, and never scrolls there. Every line of the day in a minute prints. The blocks find the columns that leave the tallest one shortest: the day in a minute keeps the first; the evening pick and the Since strip go last in whichever they join. The fixed parts are compact (the House Note and the foot share one row). Then the page scales to fill the height at full width, from 0.62 to 2.2. On a phone the Since strip runs across the top.
- **Desks**: the desk's name, the jump list, then the sections, each opening with a 2px rule in the desk colour and its name. The day's lead prints at the top of its own section, and that section opens its desk.
- **A drawing is never taller than about 60% of the screen.** On a landscape screen the lead's 16:9 drawing sits beside its story (headline across, drawing left, text right); on a phone it runs across the column.
- **Tables never push past their column** and nothing is ever wider than a phone's screen.

## Elevation & Depth

Flat. Depth comes from rules and paper, not shadows: hairline rules between stories and rows, a strong rule above a section, a double rule above the foot. The only shadow is under a sheet that floats above the page. No gradients, no glass, no glows.

## Shapes

Corners are 4px at most ({rounded.md}); small marks 3px. Pills, round cards and soft blobs do not belong in a newspaper. Dots belong to the wordmark and to status (live, open, closed).

## Components

- **The nameplate** on Page One is one line: "The" in blackletter, "HOUSE OF" in spaced capitals, and 1400 beside them, about 128px on a laptop. HOUSE OF's capitals sit on the centre line of whatever the dots form (1400, a temperature, a word), with the same gap after "OF" every time.
- **The nameplate** on Page One: "The" over "HOUSE OF", flush right against the figure and set to its box (top of the figures, baseline), then **the wordmark**: "1400" as a newsprint halftone, its dots shared among the desks, left to right in the tabs' order, each as wide as its share of the day's words, in the desk's colour. At rest it is still; every 4 seconds it beats: two beats in three re-ink one desk's plate (a ring of fresh ink spreading through its dots), every third a swell sweeps across the whole figure; a dot pushed fast slips out of register, showing the next plate as a fringe; the pointer parts the dots; a tap re-forms them into the temperature, the sky in a word, the time and a name (config desks_v2.wordmark), and it returns to 1400. The desk pages' masthead and the pinned tab bar carry the same day in dots, still. Once per visit the figure is printed by a stamp: the forme's shadow falls, the ink lands unevenly and soaks in, the paper keeps a faint impression, specks fly, the shadow lifts (about two seconds). All day the live weather moves its ink (v2/ink.js): rain streaks with rings where drops meet dots and drips, lightning in a storm, a soft shadow away from the real sun on a clear day and a mirage above 33°, drifting cloud shadows, fog, snow settling on its top edges, wind leaning it, a dimmer figure with twinkling ink at night.
- **Desk tabs**: one row, pinned; a 4px rule in each desk's colour, the name in capitals; the current tab is tinted. On a phone the row scrolls, starts at a whole tab and fades an edge only where a tab is cut.
- **Forecasts** (the market's view, the Betting Window, Page One's "The market expects", a market's sheet) sit in a dashed box marked "Forecast", so a price is never read as a result.
- **Live figures** show their age when stale ("as of"), and flash once in ink when they change. Charts and bars draw themselves in once, the first time they are seen.
- **The sheet** rises from the bottom on a phone and opens in the middle on a laptop: sharing a story (the paper's own card, with its drawing), a market's detail.
- **Since we printed**: on Page One, what changed after print (a market close, a result not in at press time, sunset, a forecast still undecided that moved), only when something did. Every row is one grid: the time in ink, a label in small grey capitals (Money, Result, Weather, Forecast) and the line; a forecast's label carries a light dashed outline. A finished match prints its score; a market at 99% or 1% is decided and never prints as a forecast. On a laptop it is a box framed in ink in the shortest column, "Since we printed 14:15" reversed out of ink, a red ring pulsing twice when the page opens; on a phone a strip across the top.
- **Where I am**: a quiet switch in Page One's Weather head. Only on a tap does the browser ask for the reader's location; away from Bengaluru the block, the wordmark's ink and its tap cycle show the weather there, with Bengaluru and the family's cities in a row below.
- **The archive** is a calendar: each printed day a tile with its lead, its item count, the Sensex's close as a dot, and the day's paper by desk as a strip of desk colours.

## Motion

Quick and quiet. Feedback 120ms; content (a sheet, a draw-in) 200 to 300ms, on cubic-bezier(.2, 0, 0, 1). Nothing bounces. The only longer movements are the wordmark's swell and a live figure's single flash. With reduced motion everything is still: the wordmark is a printed figure, sheets appear without sliding, nothing draws in.

## Do's and Don'ts

- **Do** treat each desk colour as the desk's ink for structure, and keep figures, times and small links in ink.
- **Do** box every price that is a forecast, and say "Forecast".
- **Do** let a quiet section stay short or leave it out. Never fill space with words about nothing happening.
- **Do** check every change on a phone (390 to 440 wide, light and dark) and on a 3440px monitor before shipping (v2/shot.mjs).
- **Don't** use green or red for anything that is not good or bad news, up or down.
- **Don't** use a cold pure black for night, pure white for day, shadows on cards, gradients, or corners rounder than 4px.
- **Don't** load fonts from a third party, or set type below 10px on a phone.
- **Don't** let a picture fill the screen, or anything run wider than it.
- **Don't** link the wordmark to stories or show headlines on hover; it is the day's paper in dots, not a menu.
- **Don't** use em dashes anywhere in the paper's copy.
