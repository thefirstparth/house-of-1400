# Desk pages (mocks, 1 Oct 2026)

The desk pages of the redesign (docs/HANDOVER.md 7.3, step 1) in Page One B's style. Sport (round 2, after the feedback in docs/REDESIGN-FEEDBACK.md and from Parth) and News (round 1). They are mocks, not production: the live paper is unchanged.

- `sport-desk.html`, `news-desk.html`: each is one self-contained file that works offline. They show the edition of 1 Oct with the live figures as printed at press time and the clock held at 15:00 IST. Tabs, Show all, Full story and the jump list work. Your Desk is left out.
- `shots/<desk>-<round>/`: phone (390), laptop (1300) and monitors (1920, 2560), light and dark. `report.json` records page errors, sideways scroll, overlapping text, any table wider than its column, any broken image, and the left and right edges of the masthead, the tabs and the content, which must be equal. `sport-v2/*-blocked*` shows the page with the crests and the F1 map failing to load. Each section is also shot on its own into `sections/`, which is not kept in git.
- Build: `node scripts/build.mjs`, then `node design/desks/src/make.mjs <sport|news>`, then `node design/desks/src/shot.mjs <desk> <round>` (add `BLOCK=1` to fail the images). Every section is drawn by the paper's own renderer (`public/app.js`) from the real edition, with the mock layer (`src/proto.js`, `src/proto.css`) patched in. Nothing is retyped by hand.
- In this sandbox ESPN's crests and F1's circuit map cannot load. The normal shots use plain shapes of the same size in their place; the files keep the real addresses.

## Every desk page
1. Run line, then a one-line masthead (small nameplate to Page One, Bengaluru now, the Sensex).
2. Desk tabs: one row, pinned, each a rule in its desk colour. On a phone the row scrolls, its edges fade where there is more, and the current desk is brought into view.
3. The desk's name in its colour, then a jump list of the sections printed today.
4. The day's lead, when it belongs to this desk: headline across, its 16:9 drawing beside the text. Page One has no art.
5. The sections in order, each opening with a 2px rule in the desk colour and its name. The front page's stories print at the top of their own section; the "On the Front Page ↑" pointers are gone.
6. "Next: <desk> →", then the foot line (Your Desk, Letters, The editor, Archive).

**Colour (agreed 1 Oct):** one colour per desk, seven in all, in place of fourteen section colours. On a desk page the colour marks structure: the desk name, section rules and names, kickers, the current tab, in-section tabs, market bars and the followed team's tint. Times, figures, "Show more", Source and the other small links are ink. Data keeps its own colours: wins and losses, good and bad news, F1 team colours, club crests.

**Type:** Newsreader headlines, Source Serif 4 text, Libre Franklin labels and figures, UnifrakturMaguntia "The" and Playfair "1400", all self-hosted (embedded from the Fontsource packages). Paddock keeps Titillium Web. Radii are 4px.

## Sport, round 2 (fixes)
- **The market's view:** every price is one size on one baseline; only the likeliest is bolder.
- **The Crease's next tour** runs across the section and breaks only between its parts ("from Thu 22 Oct" never splits).
- **Big monitors:** the masthead, the tabs and the content share one width at every size (measured: 69 to 1231 at 1300, 240 to 1680 at 1920, 320 to 2240 at 2560).
- **A circuit map that fails to load** leaves no box: the map goes and Max Watch and the notes take its column. A crest that fails just goes.
- **Phone tabs** fade at the edges where the row has more.
- **Colour weight** as above: Fixture List times, "Show more" and the story links are now ink.

## News, round 1
- **Desh and Videsh:** today's Dateline split by each story's own kicker ("India · Courts" goes to Desh, "World · Aviation" to Videsh). In production the editor would file each story to Desh or Videsh, which is a schema and editorial change for Parth to agree. The kicker split is the presentation-only stand-in and is less reliable.
- **The lead** (the Flydubai captain, World · Aviation) runs at the top of News with Bunty's 16:9 drawing beside it.
- **Talk of the Day** and **The Betting Window** moved here from Life, unchanged inside, in the News navy.
- Today Videsh has only one "Also in" line, because the day's world stories are the lead and nothing else. That is the news, not the layout.

## Open, for Parth
1. The Fixture List first in Sport (the agreed list started with Madridismo).
2. Desh and Videsh: file by section (schema change, recommended) or split by kicker.
3. A one-line desk lede from Bhide under each desk name: it needs a new edition field, so only if Parth asks.
