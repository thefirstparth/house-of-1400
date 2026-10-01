# SPEC

## Stack
- Plain static site (HTML, CSS, vanilla JS modules) in `public/`, plus Vercel serverless functions in `api/`. No framework unless a real need appears.
- Vercel Hobby plan. Deploys on every push to `main`.
- No password (removed 25 Sep at Parth's request). The site is `noindex` and the link stays private with Parth. Your Desk is shown, folded, at his request.
- `/api/health` returns just `{"edition": "YYYY-MM-DD"}` so scheduled runs can verify a deploy. `/api/notify` and `/api/votes` require the `RUN_KEY` header.

## Pages
- `/` today's paper (renders `content/latest.json`)
- `/archive` list of past editions by date; `/e/YYYY-MM-DD` renders that edition
- `/editor` About the editor: who T. A. Bhide is, what he does, the rules; linked from the byline, folio, editor's note and foot, never on the front page
- `/poster/today`, `/poster/edition`, `/poster/masthead`, `/poster/night`, `/poster/clock` open that poster directly (for a screensaver or a spare screen); an open poster reloads itself when the next edition goes live and hides the cursor when the mouse is still
- `/today` one-screen view for the phone (see Poster mode)
- Every page responsive: phone first (70% of reading is on a Nothing Phone 3 in Chrome), laptop properly designed (MacBook), not a stretched phone.

## Design
Match `design/reference.html` (approved: "Design A with C").
- Paper: warm newsprint `#ebe6da`, ink `#191816`, muted `#4f4a41`, rules `#b3aa98`. One light accent colour per section (see reference tokens).
- Type: masthead mixes blackletter "The" (UnifrakturMaguntia), tracked sans "HOUSE OF" (Instrument Sans), big Bodoni Moda "1400". Headlines Libre Caslon Display. Body Source Serif 4 at 18px / 1.62. Labels, tables and data in Instrument Sans with tabular numbers. No monospace text.
- Legibility beats antique feel. Minimum 14px for any label, 16px for table text, generous row padding, solid hairline rules, not dotted.
- Laptop: sticky glass section bar across the top, a live strip of tonal cards under the masthead (weather, next up, race-week countdown, the two indices), 12-column front page. (Design system v4, 25 Sep; see DECISIONS.)
- Phone: masthead, the live strip as a swipeable row, sticky section chips, single column.
- Night edition toggle. Dark palette still feels like paper.
- Charts: sparklines for indices (last ~3 months), bars for standings. Only where a chart beats a number.
- Flags as emoji for F1 races and countries. Weather emoji from weather codes.
- Drawings (like F1 circuit maps) only if checked against the official map and orientation. Otherwise omit. Not in v1.

## Sections, in order
IDs are stable. Names come from `config/house.json`.

**Desks (from 30 Sep 2026):** on the page the sections below are grouped under six desks, in the order and membership of config `desks`: Front Page (the front, The Week Ahead; no heading), News (Dateline, Namma Beat), Money (The Ledger), Sport (The Fixture List, Madridismo, The Wider Pitch, Paddock Notes, The Crease, Deuce, The Sidelines), Tech & AI (The Workshop, The Pipeline), Life (Screen & Stage, Sky & Streets, Talk of the Day, The Betting Window, Before You Go). Your Desk, Letters and the House Note follow, as before. A desk's heading shows only while one of its sections does; the section index lists sections in page order under each desk's name. Grouping is presentation only: ids, data, rules and checks are unchanged. The list below describes each section; its order is the pre-desk order.
1. Masthead with ears (left: the sky over the home city, with feels like, a sunrise-to-sunset or sunset-to-sunrise arc with the sun or the moon in its phase, humidity with a word, air quality and moonlight or rain; right: Sensex, S&P 500, Brent and gold), folio with day profile line
2. Front Page: 1 lead, up to 4 second stories, 3 briefs. Lead chosen by ranking, never by section.
3. The Fixture List: everything coming up, IST, sorted by time. "Where" only when reliably confirmed.
4. Madridismo: next 3 to 4 fixtures, last result, table position, then 0 to 3 stories (Managing Madrid first, other sources welcome)
5. The Wider Pitch: football beyond Madrid, big developments not only matches
6. Paddock Notes: current weekend sessions (local + IST), Max Watch, last race, drivers' standings (top 8 plus Max, points gap), calendar (current round plus next four)
7. The Crease: India men senior team, next match and series (researched at 2 PM, chronology checked), team news
8. Deuce: big upcoming tournaments first (Slams, Masters 1000, ATP Finals, Laver Cup, Davis Cup), then Alcaraz and Djokovic. NEXT MATCH when confirmed, otherwise NEXT EVENT with dates and "match TBD".
9. The Sidelines: every other sport worldwide when it matters, including NBA/Warriors in season
10. (Retired 25 Sep: standings now live inside Paddock Notes, Madridismo and The Sidelines.)
11. Dateline: world and India. Must-know floor applies.
12. The Workshop: tech, AI, wearables, phones. Try / Wait / Ignore when supported.
13. The Pipeline: SDR, outbound, GTM, SaaS. Only when useful.
14. The Ledger: Sensex, Nifty 50, Nasdaq-100 panels with sparklines; cross-asset table; then, live (from 30 Sep 2026): Who bought and sold (NSE and NSDL institutional flows) and Breadth (Nifty 500 up and down; the Nifty 100's five biggest risers and fallers; the five strongest and weakest industries); Cards & Points (India credit cards, top secondary beat)
15. Sky & Streets: Bengaluru 7-day weather with humidity and air quality and what changed since last week; Ranchi and Prayagraj every day (config `weather.family`); reader's location if allowed
16. Namma Beat: Bengaluru city (stand-up shows, food, metro, roads, airport). Weekdays only when important; fuller Fri to Sun.
17. Screen & Stage: new releases this week (English and Hindi, theatre and OTT, no regional) with verdicts; coming soon
18. Talk of the Day: Google Trends India and world, each with a one-line "what happened", deduplicated against the whole paper
19. The Betting Window: world trends from prediction markets, filtered (see EDITORIAL)
20. Before You Go: Watch and Do lines only
21. Your Desk: folded by default. Birthdays, upcoming bookings, travel, important alerts. Only if Gmail/Calendar are available to the run.
22. Editor's note (signed "T. A. Bhide, Editor") on big days only, as defined in config `paper.editor.big_days` and named in the edition's hidden `big_day`
23. House Note, then footer

Empty sections are omitted, never padded.

## Story features
- Headline tap and "Read more" expand the long version in place.
- "Original ↗" link to the main source. Every substantive story has at least one real source link.
- Clip: renders the story as a clean image card (html-to-image or canvas) and uses the Web Share API on phone, download on laptop.
- Thumbs: "More like this" / "Less". Visible state plus a short toast. POST `/api/vote` stores `{date, story_id, thread_id, section, vote}` (Vercel Blob or KV if configured; otherwise localStorage only). The daily run reads votes via `/api/votes` with `RUN_KEY`.
- "New for you" label on stories picked for guessed interests.
- Illustrations (optional, added after the paper is out): Bhide lists in the edition's hidden `art_orders` the lead, the top story of every desk that printed one, and one or two more on a big day, at most eight (EDITORIAL.md, Art orders); the paper's illustrator, Bunty Brushwala (drawn by Codex), reads them in full with their sources and the paper's look (config `art`, as inspiration) from `/art/brief.json`, decides the idea and the style, and pushes the images to `public/art/YYYY-MM-DD/`. Parth gives the illustrator any design rules directly. The build checks only what the page needs (an ordered story, one image each, the shape, a readable PNG, JPEG, WebP or GIF, at most 600 KB, alt text) and serves those that pass; the page shows each image inside its story (16:9 for the front-page lead, 4:3 elsewhere), credited "Illustration by Bunty Brushwala", without review, and checks every five minutes until 17:00 IST, adding, replacing or removing images to match the manifest (a redrawn file gets a new address, so no browser keeps the old one).
- At a Glance ("the day in a minute"): five to ten ranked lines, lead first; floating button, opens the day's top lines, tap to jump.

## Live layer
- All live data comes from `/api/live/*` functions, never directly from third parties in the browser (CORS, keys, caching).
- Each function returns `{ok, value, source, as_of, stale}`. Cache with `s-maxage` suited to the data plus `stale-while-revalidate`.
- The browser refreshes live blocks every 5 minutes while the page is open. Countdowns tick every second.
- Fallback chain: primary, backup, the snapshot inside today's edition JSON (with its time), otherwise hide.
- "On now": during a session or match window, the block says "On now, go watch" plus a refresh button for that block only. Never live scores.
- Day profile can reorder the live strip (weekends: fixtures first, markets folded).

## Poster mode
Button in the dock with 5 options, all rendered client-side from today's JSON (no extra tokens):
1. Today, one screen: fits a phone screen without scrolling: masthead, weather, next up, Sensex, Nasdaq-100, top 5 headlines. Also served at `/today`.
2. Masthead, ink: full-screen typographic masthead on paper
3. Masthead, night: same on near-black
4. The edition, framed: masthead, lead headline, At a Glance, editor's note and House Note on one page
5. Clock and live strip: IST clock plus weather, Sensex, Nasdaq-100, next countdown
Full screen via the Fullscreen API and a screen wake lock where allowed. For a real macOS screensaver, document WebViewScreenSaver (open source) pointed at `/?poster=mast` in the README. Support `?poster=<id>` URLs.

## Content schema (`content/editions/YYYY-MM-DD.json`)
```
{
  "date": "YYYY-MM-DD", "edition_no": 1, "weekday": "fri", "cut_ist": "14:00",
  "profile_line": "Friday edition · Screen & Stage and Namma Beat run longer today",
  "editor_note": null | "text",
  "house_note": "text",
  "glance": [{"section": "World", "line": "...", "target": "story-id"}],
  "front": {"lead": Story, "seconds": [Story], "briefs": [Brief]},
  "sections": {"<section_id>": {"stories": [Story], "briefs": [Brief], "data": {...}}},
  "fixtures": [{"when_utc": "...", "label": "...", "where": null | "...", "source": "..."}],
  "tennis": {"events": [...], "players": [{"name": "...", "next_match": null | {...}, "next_event": null | {...}}]},
  "screen": [{"title", "type", "language", "where", "release", "verdict": "must|good|call|skip|early", "reason", "if_you_liked"}],
  "trends": {"india": [{"term", "what", "url"}], "world": [...]},
  "betting": [{"title", "category", "outcomes": [{"name", "prob"}], "source", "url"}],
  "desk": null | [{"when", "kind": "action|watch|fyi", "text"}],
  "before_you_go": {"watch": ["..."], "do": ["..."]},
  "snapshot": {"<live_key>": {"value", "as_of", "source"}}
}
Story = {"id", "thread_id", "section", "kicker", "headline", "deck"?, "short", "more"?, 
         "why": {"text", "personal": true|false}, "sources": [{"label", "url"}], "new_for_you": bool}
Brief = {"id", "thread_id", "section", "headline", "text", "sources"?, "new_for_you"?}
```
Ship `content/schema.json` (JSON Schema) and validate every edition against it before publishing.
