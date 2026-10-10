# Sport V3: the design brief (10 Oct 2026)

Why a V3: V2 fixed the data (live state from live sources, crests whole, both sides on every row) but Parth found
the layout loose: ragged dividers (a status column sized to its content), too much white space, squashed photos.
V3 rebuilds the visual system on the V2 data core, from research into what wins now.

## What the research says (scratchpad research, 10 Oct)
- Apple Design Awards 2024 to 2026 (2026 weighted most): winners make one subject physical and complete (Tide Guide:
  the tide is the screen; Moonlitt: drag time, haptic ticks), use glass only on controls, carry one personality, keep
  a calm honest tone, treat accessibility as the design, show only what matters now. Polish without a signature idea
  stays a finalist.
- iOS 27 (Sept 2026): calmer Liquid Glass, a user slider from clear to tinted, a darkened glass edge, a solid bar at
  the top when content scrolls under, corners less round, HIG: "Stay out of the way", "Simplicity isn't minimalism",
  "Don't mistake delight for decoration". Glass only on floating controls, never on content.
- Material 3 Expressive to Android 17: spring motion (fast 0.6/800, default 0.8/380), shape morphing, emphasized type,
  short 64dp bottom bar, blur without refraction. No "Material 4"; the shared direction is solid content, small floating
  navigation, springs, adjustable intensity, less spectacle.
- Sports apps: density wins (F1 2019, FotMob); columns must align on every row (Apple Sports box scores); status in a
  fixed left column; tabular condensed numerals; live said once (dot + minute); win probability in the hero, never as
  the headline on every row; no dead leagues or filler.

## Principles for V3
1. One subject: what Parth follows, now. Today is a timeline you scrub by day; live and next lead.
2. The data is the interface: numerals are the hero type (Board, tabular); names second.
3. A fixed grid: every match row is `status | mark | name | score` with fixed status and score tracks per sport, so
   every divider and every time lines up. Rows 56px, no wasted padding.
4. Content flat and opaque; glass only on floating chrome (top bar on scroll, tab bar, segmented controls, sheet
   header), at 70%+ fill with a darkened edge; reduced transparency and increased contrast fall back to solid.
5. Motion only to explain a change: the selected day and tab pill glide (spring), a new score rolls in, a sheet
   springs up, tabs cross-fade with view transitions. Reduced motion turns all of it into short fades or nothing.
6. Live is said once: a red dot, LIVE and the clock. A saved copy says so. A stoppage is named.
7. Probabilities only in heroes and sheets, as one split bar with a named source.
8. Personality: the paper's calm broadsheet voice. A signature: "Since you last looked", a short list of what changed
   since this phone last opened the app (results in, sessions finished, a goal), worked out on the phone from the
   feeds it saw. No AI.
9. Accessibility as design: every row reads as a sentence to a screen reader; Dynamic Type to 21px reflows the row
   (status above the names) instead of cutting names; 44px targets; 4.5:1 contrast.
10. Light by default, dark on the switch; Android (Chrome on Nothing Phone) and iPhone both first-class.

## Tokens
- Type: display 32/800, title 20/700, body 15/500, meta 13/400, caption 12/500; numerals: hero 44, clock 52, row 18
  (Board, tabular).
- Radii: cards 20, rows inside lists 0, controls full. Spacing on a 4px grid; gutters 16.
- Colour: neutral greys; sport colour only on small marks of identity (tag, bar, chance); live red; win green and loss
  red only as small tints.
- Motion: --spring-default (sheets, pills), --spring-fast (presses), --spring-effects (opacity, colour).
