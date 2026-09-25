# SPEC

## Stack
- Plain static site (HTML, CSS, vanilla JS modules) in `public/`, plus Vercel serverless functions in `api/`. No framework unless a real need appears.
- Vercel Hobby plan. Deploys on every push to `main`.
- Password gate: root `middleware.js` (Vercel Routing Middleware) checks a cookie; if missing, serves a small login page that posts the password to `/api/login`, which sets an HttpOnly cookie (30 days). Password is the `SITE_PASSWORD` env var. Vercel's own password protection is a paid feature, so do it in middleware.
- `content/` is served to the page only through the gate.
- Only two routes skip the gate: `/api/login`, and `/api/health`, which returns just `{"edition": "YYYY-MM-DD"}` so scheduled runs can verify a deploy. `/api/notify` and `/api/votes` require the `RUN_KEY` header instead of the cookie.

## Pages
- `/` today's paper (renders `content/latest.json`)
- `/archive` list of past editions by date; `/e/YYYY-MM-DD` renders that edition
- `/today` one-screen view for the phone (see Poster mode)
- Every page responsive: phone first (70% of reading is on a Nothing Phone 3 in Chrome), laptop properly designed (MacBook), not a stretched phone.

## Design
Match `design/reference.html` (approved: "Design A with C").
- Paper: warm newsprint `#ebe6da`, ink `#191816`, muted `#4f4a41`, rules `#b3aa98`. One light accent colour per section (see reference tokens).
- Type: masthead mixes blackletter "The" (UnifrakturMaguntia), tracked sans "HOUSE OF" (Instrument Sans), big Bodoni Moda "1400". Headlines Libre Caslon Display. Body Source Serif 4 at 18px / 1.62. Labels, tables and data in Instrument Sans with tabular numbers. No monospace text.
- Legibility beats antique feel. Minimum 14px for any label, 16px for table text, generous row padding, solid hairline rules, not dotted.
- Laptop: sticky section index across the top, sticky live rail on the left (weather, next session countdown, Sensex, Nasdaq-100, Madrid next, India next), 12-column front page.
- Phone: masthead, live widgets as a 2-column grid, sticky rounded section chips, single column.
- Night edition toggle. Dark palette still feels like paper.
- Charts: sparklines for indices (last ~3 months), bars for standings. Only where a chart beats a number.
- Flags as emoji for F1 races and countries. Weather emoji from weather codes.
- Drawings (like F1 circuit maps) only if checked against the official map and orientation. Otherwise omit. Not in v1.

## Sections, in order
IDs are stable. Names come from `config/house.json`.
1. Masthead with ears (weather left, next-up countdown right), folio with day profile line
2. Front Page: 1 lead, up to 4 second stories, 3 briefs. Lead chosen by ranking, never by section.
3. The Fixture List: everything coming up, IST, sorted by time. "Where" only when reliably confirmed.
4. Madridismo: next 3 to 4 fixtures, last result, table position, then 0 to 3 stories (Managing Madrid first, other sources welcome)
5. The Wider Pitch: football beyond Madrid, big developments not only matches
6. Paddock Notes: current weekend sessions (local + IST), Max Watch, championship leader and gap, last race, next three
7. The Crease: India men senior team, next match and series (researched at 2 PM, chronology checked), team news
8. Deuce: big upcoming tournaments first (Slams, Masters 1000, ATP Finals, Laver Cup, Davis Cup), then Alcaraz and Djokovic. NEXT MATCH when confirmed, otherwise NEXT EVENT with dates and "match TBD".
9. The Sidelines: every other sport worldwide when it matters, including NBA/Warriors in season
10. The Tables: F1 drivers, La Liga, NBA West in season. Live.
11. Dateline: world and India. Must-know floor applies.
12. The Workshop: tech, AI, wearables, phones. Try / Wait / Ignore when supported.
13. The Pipeline: SDR, outbound, GTM, SaaS. Only when useful.
14. The Ledger: Sensex, Nifty 50, Nasdaq-100 panels with sparklines; cross-asset table; Cards & Points (India credit cards, top secondary beat)
15. Sky & Streets: Bengaluru 7-day weather, reader's location if allowed, other cities only when notable
16. Namma Beat: Bengaluru city (stand-up shows, food, metro, roads, airport). Weekdays only when important; fuller Fri to Sun.
17. Screen & Stage: new releases this week (English and Hindi, theatre and OTT, no regional) with verdicts; coming soon
18. Talk of the Day: Google Trends India and world, each with a one-line "what happened", deduplicated against the whole paper
19. The Betting Window: world trends from prediction markets, filtered (see EDITORIAL)
20. Before You Go: Watch and Do lines only
21. Your Desk: folded by default. Birthdays, upcoming bookings, travel, important alerts. Only if Gmail/Calendar are available to the run.
22. Editor's note (signed "T. A. Bhide, Editor") on big days only
23. House Note, then footer

Empty sections are omitted, never padded.

## Story features
- Headline tap and "Read more" expand the long version in place.
- "Original ↗" link to the main source. Every substantive story has at least one real source link.
- Clip: renders the story as a clean image card (html-to-image or canvas) and uses the Web Share API on phone, download on laptop.
- Thumbs: "More like this" / "Less". Visible state plus a short toast. POST `/api/vote` stores `{date, story_id, thread_id, section, vote}` (Vercel Blob or KV if configured; otherwise localStorage only). The daily run reads votes via `/api/votes` with `RUN_KEY`.
- "New for you" label on stories picked for guessed interests.
- At a Glance: floating button, opens the day's top lines, tap to jump.

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
4. Headlines, rotating: one headline at a time, fades every 9 s
5. Clock and live strip: IST clock plus weather, Sensex, Nasdaq-100, next countdown
Full screen via the Fullscreen API and a screen wake lock where allowed. For a real macOS screensaver, document WebViewScreenSaver (open source) pointed at `/?poster=mast` in the README. Support `?poster=<id>` URLs.

## Content schema (`content/editions/YYYY-MM-DD.json`)
```
{
  "date": "YYYY-MM-DD", "edition_no": 1, "weekday": "fri", "cut_ist": "13:55",
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
