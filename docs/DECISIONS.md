# DECISIONS

Settled with Parth between 24 and 25 Sep 2026. Change only with his say-so, and log the change here.

## Product
- Name: The House of 1400. Editor: fictional Tukaram Atmaram Bhide, "T. A. Bhide, Editor" (a twist on the Taarak Mehta Ka Ooltah Chashmah character).
- Replaces the old ChatGPT and Claude scheduled newspapers. Fresh repo; the old repo stays as an archive.
- Only for Parth; Srishti may read sometimes, so Your Desk is folded by default.
- Delivered on Vercel behind a static password. No email. Telegram ping (lead headline + link) only after the edition is verified live. No other notifications.
- Archive: yes.

## Live vs static
- Static: the news, written daily, info cut around 13:55 IST.
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
- Daily runs at 13:15, 13:44, 14:13, 14:42 IST. Each exits if today's edition is already live.
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
