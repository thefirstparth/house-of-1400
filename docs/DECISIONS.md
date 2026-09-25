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
