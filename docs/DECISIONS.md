# DECISIONS

Settled with Parth between 24 and 25 Sep 2026. Change only with his say-so, and log the change here.

## Product
- Name: The House of 1400. Editor: fictional Tukaram Atmaram Bhide, "T. A. Bhide, Editor" (a twist on the Taarak Mehta Ka Ooltah Chashmah character).
- Replaces the old ChatGPT and Claude scheduled newspapers. Fresh repo; the old repo stays as an archive.
- Only for Parth; Srishti may read sometimes, so Your Desk is folded by default.
- Delivered on Vercel behind a static password. No email. Telegram ping (lead headline + link) only after the edition is verified live. No other notifications.
- Archive: yes.

## Live vs static
- Static: the news, written daily, information cut at 14:00 IST.
- Live: markets, weather, fixtures and countdowns, tables, trends, betting odds. Fetched on open, refreshed every 5 minutes, countdowns tick, subtle motion only.
- Never live scores. During a match or session: "On now, go watch" and a refresh button for that block.
- Free APIs, tested before the build. Never a wrong or empty field: primary, backup, snapshot, hide.
- DMAs: never calculated. Published figures from 2 agreeing sources, or skip. Low priority.
- Cricket: no API for now; researched at 2 PM with chronology enforced.
- Tennis: player next match researched; NEXT EVENT when no match is confirmed; big tournaments listed regardless of who plays.
- Weather: Bengaluru always; Ranchi and Prayagraj only when notable; reader's location if allowed.
- Markets: Sensex, Nifty 50, Nasdaq-100, Bank Nifty, USD/INR, Brent, India gold (IBJA 24K and 22K per 10g), Bitcoin, S&P 500. When only two fit: Sensex and Nasdaq-100.

## Content
- Ronaldo milestones and Curry-specific coverage out. Tech, wearables and AI up.
- Secondary beats in order: India credit cards (any change), car launches, travel, startups/SaaS/GTM. Surface guessed interests with a "New for you" label.
- Must-know floor: major India and world news always prints.
- Barcelona: one dry line for real setbacks.
- In 60 Seconds removed; replaced by the floating At a Glance button. Night Desk cut. On This Day only when very relevant or very interesting.
- Google Trends India and world, deduplicated across the whole paper.
- Prediction markets: world trends only, US politics and US economic policy (Fed included) excluded, plus the usual noise categories.
- Namma Beat: Bengaluru city news; weekdays only if important; fuller Fri to Sun.
- Day-of-week profiles change section weight (weekends light on markets, heavy on entertainment and city).
- Screen & Stage: English and Hindi, theatre and OTT, verdicts Must watch / Good watch / Your call / Skip / Too early, plus "If you liked...". Coming soon list.
- Managing Madrid anchors Madrid analysis; other sources welcome.
- Story length at the Sep 10 level. Short version Inshorts-style (about 60 words, fact first, neutral); Read more expands in place.
- No reading-time cap. Skimmable in 5 to 10 minutes.
- "Why it matters (for you)" kept, labelled, one sentence.
- House Note: slightly fun, fact first, light dry turn; the Sep 9 note is the model.
- Editor's signed note only on big days.
- No filler about absence. Leave it blank.

## Design
- Fresh design; approved direction is A (broadsheet) 69% with C (modern) 31%. B rejected.
- Legibility first (v3): Source Serif 4 body at 18px, Instrument Sans for labels and tables, no monospace, bigger labels, roomier tables.
- Masthead: past meets future. Blackletter "The", tracked sans "HOUSE OF", Bodoni "1400".
- Section names: The Fixture List, Madridismo, The Wider Pitch, Paddock Notes, The Crease (cricket), Deuce (tennis), The Sidelines (other sports), The Tables, Dateline, The Workshop, The Pipeline, The Ledger, Sky & Streets, Namma Beat, Screen & Stage, Talk of the Day, The Betting Window, Before You Go, Your Desk, House Note.
- Jump between sections anywhere: sticky index on laptop, chips on phone.
- Drawings (like circuit maps) only when checked against the official map. Parth found the first Baku outline inaccurate.
- Clip and share as an image card (links would hit the password).
- Thumbs up/down per story, visible feedback, stored and used by later editions and by Screen & Stage verdict thresholds.
- Poster mode: 5 variants including a one-screen phone view (`/today`) and a Mac screensaver-style masthead.
- Night mode optional, still paper-like.

## Operations
- Daily runs at 14:00, 14:29, 14:58 and 15:27 IST (changed 25 Sep; were 13:15 to 14:42). Information cut 14:00. Each exits if today's edition is already live. The "late" line shows after 16:30.
- Yesterday's paper stays up only as the last resort, with a "late" line.
- Budget: lean, but never at the cost of missing something.

## Data findings
- Yahoo daily bars can be null (22 and 24 Sep 2026) while the quote is right. Never chart or average nulls.
- Polymarket and Kalshi raw volume is dominated by US sports, esports, weather and crypto ladders. India-specific volume is tiny.
- ESPNcricinfo's API blocks access. Stooq returned empty.

## Build decisions (25 Sep 2026, first build session)
Made without Parth, per the build prompt. Change any of them freely.
- **One live function.** Every `/api/live/<key>` goes through `api/live/[key].js`. Vercel Hobby allows 12 functions per deployment; this keeps the total at 6.
- **Static output.** `npm run build` copies `public/`, `content/` and `config/house.json` into `dist/`. The middleware gates all of it, including `content/` and `config/`.
- **Cookie.** The session cookie is an HMAC of `SITE_PASSWORD`, valid 30 days. Changing the password logs every device out, which is also how to revoke access.
- **Chronology in the schema.** Editions carry a `chronology` object (`next` and `last` per followed entity). The validator checks it against `fixtures` in code. Fixtures carry `entity`, optional `minutes`, `until_utc` and `time_tbc`.
- **Paddock local times** print only when the edition sets `sections.paddock.data.local_tz` (an IANA zone). Jolpica gives UTC only.
- **Talk of the Day and The Betting Window** print the edition's curated lists when present. If an edition carries none, the page shows the live feeds instead: Google Trends with the top linked headline as the "what happened" line, deduplicated against the paper's headlines, and Polymarket by 24-hour volume after the config exclusions. Past editions never show live feeds.
- **Kalshi backup not built in v1.** Polymarket only; the section hides if it fails.
- **DMA lines** print only when the edition supplies them in `sections.ledger.data.dma`. Nothing is computed.
- **Weekends fold markets.** On Saturday and Sunday the Ledger's live panels sit inside a tap-to-open fold unless the edition has a Ledger story.
- **Clip** draws the card on a canvas (no library): Share sheet on the phone, download on the laptop.
- **Votes** go to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, otherwise they stay in the browser only.
- **Config additions.** Each section has `short` (index label) and `accent` (colour token). 
- **No absence copy.** The reference proof's "50/200 DMA: skipped today" and "Filtered out: ..." lines are not printed; both break the no-filler rule.
- **Edition No. 1** was published at 06:40 IST on 25 Sep, not 14:00, because the build finished early. Its research used web search only (this environment blocked direct fetches), and it printed "Information cut 06:40 IST" honestly. From 26 Sep the scheduled runs produce the 14:00 paper.

## 25 Sep 2026, after network access opened
- **Daily runs read the live layer through our site** (Parth's call). `/api/live/*` accepts the `RUN_KEY` header in place of the cookie, and `scripts/snapshot.mjs` and `npm test` use it by default. `--local` keeps the direct path for build sessions.
- **Yahoo user-agent.** Yahoo answers 429 to a full browser user-agent without cookies, so Yahoo calls send a plain `Mozilla/5.0`.
- **Futures previous close.** Brent's daily bars lag a day because futures roll at 18:00 New York time, so for futures the change is measured against the 1-day chart's `previousClose` (the last settlement). For indices that field is wrong (it gave 74,529 for the Sensex against a true 74,828), so indices keep the bar method.
- **Market "live" label** comes from Yahoo's current trading period, because the chart API does not send `marketState`.
- **Betting exclusions use Polymarket's real tag slugs** (`us-presidential-election`, `midterms`, `hit-price`, `crypto`, `tweets-markets`, the US leagues, and more). `trump` alone is not excluded, because Iran and ceasefire markets carry it. Markets from the same series ("... by Sep 30", "... by Dec 31") collapse to one, and date ladders show the nearest deadlines in date order.
- **No football backup API.** TheSportsDB's free tier (the planned backup) gave Madrid's LAST as Rayo 4–1 on 12 Sep when it was Atlético 1–2 on 20 Sep, and it lists home games only. A wrong NEXT or LAST is worse than a hidden one, so the fallback after ESPN is the edition snapshot. `sportsdb_id` removed from config.
- **User-agent fallback.** ESPN answers Vercel's servers with 403 for a browser user-agent. Every source now retries on 403 or 429 with a plain user-agent, then none.

## 25 Sep 2026, Parth's first review (12 points)
- **Layout.** Front page: lead plus briefs on the left, second stories on the right; on wide screens trailing second stories move under the lead until the columns even out. Sections with both data and stories put them side by side (data left, stories right). A lone story reads in two columns.
- **Story tools renamed.** "Full story ↓", "Source ↗", "Share" (was Clip), and 👍 / 👎 in place of "More like this" / "Less" (labels kept as tooltips and for screen readers).
- **No triple Madrid.** The Fixture List covers only the next 7 days, grouped by day. Madridismo owns Madrid's fixtures. The rail no longer carries "Madrid next" or "India next"; it keeps weather, the race-week countdown and the two index widgets. (This changes the rail listed in SPEC.)
- **Readability over antique.** Story headlines, decks' numbers and widget figures move to Source Serif 4 (bold, tabular numbers). Libre Caslon stays for section names and UnifrakturMaguntia and Bodoni for the masthead only. Body 17.5px/1.6, "Why it matters" as a tinted box, quieter text-style story tools, more space between sections.
- **Sparklines** carry no in-chart text: dates under the chart, "3-month high · low" as a line of text, rail sparklines bare.
- **Ledger notes.** Every asset gets a real note: the editor's driver (`sections.ledger.data.notes`) plus a computed position in its own 3-month history ("Lowest close in 3 months", "Rupee at its weakest since 12 Aug", or the 3-month range). Cross assets now fetch 3 months for this.
- **Sky & Streets** is a plain-English sentence for the week, the three hours that matter to Parth's shift (config `weather.key_times`: 16:00, 21:00, 02:00), a slim 7-day strip, and one line per other city only when it is notable.
- **Talk of the Day** is English only, in the "term · volume – what happened" format. The live fallback keeps English terms with English headlines.
- **The Betting Window** shows 8 to 10 markets from Polymarket and Kalshi in a compact two-column list. Kalshi has no volume sort (12,000+ open events, rate-limited), so the daily run crawls it with `scripts/betting-candidates.mjs` and the page refreshes the chosen ids live (`/api/live/betting?ids=pm:...,ks:...`). Threshold ladders and 99%-settled markets are dropped.
- **Fixture "Where"** prints only when confirmed, inline after the fixture; there is no empty column.
- **Editorial rules tightened** in EDITORIAL.md for Wider Pitch, Sidelines, Screen & Stage (start from popularity charts), Talk of the Day and The Betting Window.

## 25 Sep 2026, later
- **Polymarket only for The Betting Window** (Parth). Kalshi needed a 3-minute rate-limited crawl each run for little extra; `scripts/betting-candidates.mjs --kalshi` keeps it available, and the page still refreshes any `ks:` ids an edition carries.
- **Schedule** 14:00, 14:29, 14:58, 15:27 IST with the information cut at 14:00 (Parth). The "late" line moves from 15:15 to 16:30.
- **The validator enforces the review's minimums** so a daily run cannot repeat them by accident: Wider Pitch and Sidelines at least 2 items, Screen & Stage at least 3 titles (5 on Friday to Sunday), Talk of the Day at least 5 plus 5 in English with search volume, The Betting Window 8 to 10, Ledger driver notes, cut 14:00. A run may waive one only with a written reason in `coverage_waivers` (never printed).

## 25 Sep 2026, Parth's second review
- **Masthead numerals** now use DM Serif Display. Bodoni Moda's hairline 4 was unreadable on a phone; DM Serif keeps the display feel with a solid 4. Used for "1400" everywhere (masthead, login, posters, favicon); widget figures stay in Source Serif 4.
- **Story tools** sit on one baseline at one height; the thumbs are drawn icons (consistent on every phone) that fill with the section colour when pressed.
- **The Tables section is retired.** Its content moved to the sections that own it: F1 drivers' standings (top 8 plus Verstappen, with points gap and a thin bar) and a race calendar (current round plus the next four: round, flag, Grand Prix, race date) in Paddock Notes; a compact La Liga table (top 5 plus Madrid) in Madridismo; NBA West (top 8) in The Sidelines once the season starts. The `tables` entry stays in config so old editions still resolve.
- **The Betting Window** keeps 8 to 10 markets but gives each room: category and source on a small line, the title on its own line, one row per outcome with its own bar; date ladders read "By 30 Sep".

## 25 Sep 2026, Parth's third review
- **No password** (Parth, explicitly). The middleware, login function and login page are gone; the site is public but `noindex`. Because Your Desk is built from Gmail and Calendar (bookings, venues, birthdays, a security alert), the build now strips `desk` from every edition it serves; it stays only in the private repo's JSON. Bringing it back would need a separate private route. The `SITE_PASSWORD` variable in Vercel is no longer used and can be deleted. `/api/votes` and `/api/notify` still require `RUN_KEY`.
- **Design system v4** (Parth: "a 2026-27 newspaper inspired by the golden age, not the other way round"). Informed by iOS 27 (Liquid Glass pulled back toward legibility: less transparency, more contrast, glass as a finish on controls), the edge-to-edge direction expected with iOS 28, Material 3 Expressive (Google's 46 studies: heavier, larger headlines and tonal containment help people find key elements up to 4x faster; rounded shapes), and 2026 editorial practice (one modern serif plus one sans, modular blocks). What changed:
  - Full-bleed paper; no framed sheet or grey side bands.
  - Two families: Newsreader (headlines, body, the "1400") and Instrument Sans (labels, data, controls). UnifrakturMaguntia survives only as the masthead's "The". Libre Caslon, Source Serif and DM Serif are gone.
  - Live data moves from the left rail into a strip of tonal rounded cards under the masthead (weather, next up, race-week countdown, the two indices); on a phone it is a swipeable row like home-screen widgets. The masthead ears are gone; the nameplate stands alone.
  - Frosted-glass sticky section bar with pill chips; glass floating dock and At a Glance button. Glass never sits behind body text.
  - Tonal containers (no borders) for "Why it matters", widgets, market panels, weather, editor's note; hairline rules kept where a newspaper prints them (between stories, under table heads); a 2px rule opens each section and a double rule frames the masthead and House Note.
  - Emoji replaced: drawn line icons for weather (night-aware), drawn thumbs, no ✦ or 📍. Country flags stay in the F1 calendar, where they carry information.
  - Palette: lighter, cleaner newsprint (#f5f2eb), crisper accents, M3-style tonal surfaces; a warm near-black night edition.
- **Poster "Today, one screen"** is a dashboard on desktop: live clock and date, the front page (six headlines), Bengaluru now with the three shift hours, next up with the three after it, markets (three indices with sparklines plus USD/INR, Brent, IBJA gold, Bitcoin), "your sport" (F1 countdown, Max, Madrid next and table, India next, Alcaraz) and the top five betting markets. On a phone it keeps the headlines, weather, next up and markets.
- **Poster "Headlines, rotating" is replaced by "The edition, framed"**: the masthead large, the lead headline, At a Glance, the editor's note and the House Note, composed as one page. `?poster=heads` now opens it.
- **Your Desk restored** (Parth, explicitly: he keeps the link private and wants the section). No password; the build no longer strips `desk`. Runs keep Desk entries minimal: no message bodies, email addresses, codes or account details.
- **Posters to Google Drive, daily at 16:00 IST.** The Drive connector cannot practically carry images (each would pass through the model as base64), and routines here cannot hold connectors anyway. So: a 16:00 routine runs `scripts/posters.mjs` (Playwright, waits for today's edition, 5 views × desktop and phone, JPEG) and commits them to `public/posters/latest/`; a Google Apps Script in Parth's account (`docs/drive-sync.gs`, hourly, de-duplicated by date) saves each new set into Drive under "The House of 1400 · Posters/YYYY-MM-DD". About 1.6 MB a day goes into git history; prune later if it matters.

## 25 Sep 2026, Parth's fourth review
- **Kalshi removed from the code** (Parth: "strip it out for future variants"). The crawl, its helpers and the `ks:` refresh are gone; `/api/live/betting` refreshes Polymarket ids only. Today's two Kalshi rows keep their press-time prices. From 26 Sep the validator rejects any betting id that does not start with `pm:`.
- **Gold gets context.** IBJA's own page carries about 4 months of daily 999 rates (a hidden chart input), so `gold_in` now returns the change on the previous rate, the change over about a month, and the period's high and low. The Ledger row shows the day's change and a line such as "Down 6.7% in a month, 6.8% below the 4-month high of ₹1,62,154 on 24 Aug"; the dashboard shows the month's move. IBJA does not publish 52 weeks there, so the paper says "4-month" rather than inventing a 52-week figure.
- **Posters fit one screen.** "Today" and "The edition" never scroll: the sheet is laid out tighter (five headlines, no footer hint, a close button instead) and, if it still overflows, app.js shrinks it with CSS zoom to the exact window height, again on resize and when live data arrives (the poster now refreshes with the live layer). Phones get a compact edition of the dashboard that keeps every card (four headlines, weather and next up side by side, markets without sparklines, four sport lines, three markets).
- **About the editor** at `/editor`: who T. A. Bhide is, what he does each day, the six rules that set the paper apart, his latest signed note, and a plain statement that he is a character and the paper is written by an AI model to a rulebook and checked by a validator. Linked from the byline under the masthead, the folio ("The editor"), the signature on the editor's note and the foot of the paper; never on the front page itself.
- **Load time.** Measured on a phone profile: first paint of the front 1.9 s, everything settled 4.7 s, because requests ran in a chain (config, then the edition, then nine live calls, then betting, which alone started at 3.9 s). Now: an inline script in `<head>` starts config, the edition and all nine live calls at once, before app.js has downloaded; betting and trends start the moment the edition arrives; each live block paints as soon as its own data lands. Fonts no longer block the first paint, and the blackletter face is cut to the three letters of "The". app.js and styles.css are versioned by content hash and cached for a year. Functions stay in `iad1` (Washington): most upstreams (Yahoo, ESPN, Polymarket, Jolpica) are in the US, and a Mumbai function would pay the ocean crossing several times per request instead of once; the CDN caches responses near the reader either way.
- **Fixed:** at 390px (iPhone width) the front page was 22px wider than the screen (a 12-column grid's gaps with nothing in them); a change that rounds to zero now prints 0.00% rather than −0.00%.

## 25 Sep 2026, Parth's fifth review
- **Point moves beside percentages.** Every market move shows its size in the instrument's own units and the percentage together: "+4.93 (+0.01%) today, live" on the index panels; in the Ledger table the percentage leads and the raw move sits under it (−₹882 on gold, −$0.79 on Brent, +₹0.06 on the rupee). Computed from the previous close; where a source gives only a percentage (CoinGecko) it is backed out of it. The phone dashboard keeps percentages only, for width.
- **Standing markets in The Betting Window.** The window had no cross-day dedup in code (the story ledger only covers stories; betting rows carry their own `bet-` threads), but the daily run was free to rotate important long-running markets out. Now `betting.standing` in the config lists five that print every day while open: best AI model, Ballon d'Or, La Liga champion, Champions League winner, F1 drivers' champion. `betting-candidates.mjs` resolves each by title to the open Polymarket event ending soonest (not within 24 hours, not already 99% decided, so "best AI model end of September" hands over to October), lists them first and keeps their near-twins out of the rest. The validator fails an edition missing one unless `coverage_waivers.standing` explains. They show "Every day" in place of the source. Today's edition was updated: the two Kalshi rows gave way to the Polymarket best-AI market and the F1 drivers' championship.

## 25 Sep 2026, Parth's sixth review: money news and trending markets
- **Why the IRDAI story was missed.** ET published it at 16:14 IST on 24 Sep, well inside this edition's window: the regulator's consultation paper to bring back insurance commission caps, and PB Fintech −33% the same day. The paper had no beat for Indian money rules (only index levels and credit cards), no step that asked why individual stocks crashed, and a Ledger note ("financial stocks did most of the damage") that described the fall without its cause. UPI MDR (0.4% on merchant payments above ₹2,000 from 15 October) was announced on 16–17 Sep, before the first edition, and nothing looked ahead to changes about to take effect.
- **What changed (no story, company or regulator's news is named anywhere):**
  - A third selection test, the money test: does it change what people in India pay, earn, save, borrow, invest or insure, or did it move an Indian stock or sector hard? A new primary beat, "India money".
  - The news window is everything since the previous edition's cut.
  - India money sweep every run: the rule-setting bodies' releases and consultation papers plus two national business outlets' personal-finance and markets pages; the pages read go in `checks.money_sweep` (at least 3 sites, validated).
  - Money calendar: any rule or charge taking effect in the next 30 days that the ledger has not printed gets at least a brief.
  - Market movers: new `/api/live/movers` prices the whole Nifty 500 (NSE's own list; a copy in `config/nifty500.csv` if NSE refuses, refresh with `scripts/nifty500.mjs`) over the last two sessions and flags stocks moving 8%+, industries whose median moved 2.5%+, and clusters of 3+ stocks in one industry moving 4%+ the same way on the same day. On 24 Sep it flags PB Fintech −36% and a Financial Services cluster (PB Fintech, L&T Finance, HDFC Life, Bajaj Finance, New India Assurance...). Every flag must be answered in `checks.movers` (why, and the story that covers it or why it is not news); the validator fails the edition otherwise.
  - Today's edition now carries the IRDAI story in The Ledger (with an At a Glance line) and the UPI fee as a Ledger brief.
- **Standing markets withdrawn.** The five named markets were a hardcoded list, which Parth did not want. Replaced by carry-over: a market from the previous edition stays while it is open, undecided and still trending (top 20 by 24-hour volume after exclusions, or its favourite moved 5+ points since printed); one that ends or is decided hands over to the next market in the same line; at most 6 carry, busiest first. `betting-candidates.mjs` writes `ledger/betting-carry.json` and the validator checks the edition keeps them (or explains in `coverage_waivers.betting_carry`). Carried markets show "Trending since <date>". A dry run against today's picks keeps Brazil's election, the Champions League, the Iran blockade and ceasefire markets, the Ballon d'Or and La Liga; best AI model and the F1 drivers' title drop out on low volume, the rest on the cap.

## 25 Sep 2026, Parth's seventh review
- **Domain is now house14.vercel.app** (Parth renamed it in Vercel; the old address no longer resolves). `scripts/remote.mjs` (daily and poster runs), `docs/drive-sync.gs`, the docs and all five routine prompts point at the new address. Parth updates the `SITE` line in the Apps Script in his Google account.
- **Market movers are a 14:00-run tool, not page data** (Parth: "does not need to be dynamic"). `/api/live/movers` is called only by the run's snapshot; the page never requests it, and the build strips `snapshot.movers` and the run's `checks` from the served editions (latest.json served minified: 172 KB on disk, 111 KB served).
- **India's institutions and the national front-page sweep.** The Election Commission row (two of three commissioners recorded 14 objections to voter-roll decisions, reported 22–23 Sep; the Commission says its decisions were unanimous) led the national press inside this edition's window and was missed, because nothing told the run that "does not follow politics" still includes how the institutions that run the country behave. Now: the must-know floor says so explicitly (institutional news, neutral, no party horse-race), Dateline is its home ("India · Institutions"), and every run reads the front pages of at least three national outlets of different leanings; any India story on two or more must be in the paper or explained in `checks.national` (at least five entries), with the pages in `checks.national_sweep`. The validator enforces both. No institution, story or outlet is named in the rules. Today's edition now carries the story in Dateline with an At a Glance line.
- **The editor's portrait.** The "TAB" monogram is replaced by a drawn portrait (`public/bhide.svg`): side-parted oiled hair going grey at the temples, round spectacles, one eyebrow raised, the moustache the page says he denies having, a red editor's pencil behind his ear, shirt, tie and vest. It also sits, small, beside his signature on the editor's note. The page says the portrait is a drawing.
- **Thumbs storage connected (25 Sep).** Parth connected a Blob store. Vercel now connects stores with `BLOB_STORE_ID` plus the function's OIDC token instead of `BLOB_READ_WRITE_TOKEN`, so the vote functions checked the wrong variable and would have kept saying `stored: false`. `lib/blob.js` accepts either style, writes votes private (falling back to public if the store is public) and reads them back through the SDK. `/api/health` reports `votes_store: true/false` (no ids or secrets). The daily runs read votes through `/api/votes`, which needs `RUN_KEY` in the cloud environment's variables (the same value as in Vercel); without it they skip votes, as before.
- **Vote totals are public; raw votes need the run key.** Parth asked not to have to add the run key to the cloud environment by hand. The run only needs totals (ups and downs per thread and per section), which reveal nothing beyond which stories were liked on a private, unindexed site, so `/api/votes` returns those to anyone; the individual timestamped records still need `RUN_KEY`. `scripts/votes.mjs` reads the totals.
- **About the editor, redesigned as a newspaper profile (25 Sep).** The pencil behind the ear read as piercing the head, so the portrait has no pencil; the red pencil moved onto the page as its accent and as his proof marks. The page is now a golden-age profile in a modern layout: a framed, slightly tilted portrait with a photo caption ("The editor declined to sit for a photograph"), a stat strip (circulation 1, deadline 14:00, 15 words he will not print, 0 em dashes printed), the story with a drop cap and pull quote beside a sidebar of "Things he has opinions about", "A day at the desk" as a 14:00 to 14:45 timeline, "The red pencil" (typed sentences on ruled paper with his handwritten corrections and margin notes), the house rules numbered in red Roman numerals, and his latest note as a typed memorandum with a paperclip and his initials. Courier Prime and Caveat load on this page only. Works in dark mode and at phone width.
- **Poster links (25 Sep).** Each poster has its own address, `/poster/today`, `/poster/edition`, `/poster/masthead`, `/poster/night`, `/poster/clock` (the old `?poster=` and `/today` still work). A poster opened this way behaves like a screensaver: live data keeps refreshing every five minutes, the page reloads itself when the next day's edition goes live (checked every ten minutes), and the cursor and close button fade out after three seconds without movement.
- **Scheduled runs moved into two standing sessions (25 Sep).** Routines that start a fresh session had no repository attached and no way to attach one, so the 14:00 run could not clone the repo. The five routines were recreated to fire into two sessions created with the repository as their source: an Opus session for the 14:00 edition and a Sonnet session for the three retries and the 16:00 posters (the model is set per session). Both sessions verified fetch access and the Sonnet one a push dry run. Each run resets its checkout to origin/main first and is told to ignore earlier days' messages.
