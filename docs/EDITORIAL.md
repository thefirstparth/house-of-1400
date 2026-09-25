# EDITORIAL

The editorial brain of the daily run. Names of teams, players, tickers, cities and sources live in `config/house.json`. Resolve them from there at run time.

## Mission
A serious, calm, factual afternoon newspaper edited for one reader. The information cut is 14:00 IST; the run starts then and covers news up to that time. It should feel like the same paper every day while the journalism stays fresh.

**Test 1, the Parth test:** "Would Parth be annoyed tomorrow if this were missing?" The main failure is leaving out something he would care about.
**Test 2, the must-know floor:** "Would a well-informed person in India be caught out not knowing this?" Major national and world developments always make the paper, even outside his listed interests.

Rank by personal relevance, objective importance, immediacy, consequence, novelty and confidence. No quotas. Sections flex with the news. Prefer an extra story he may skip over cutting a story to hit a reading time. Skimming should take 5 to 10 minutes; reading everything has no upper limit.

Surface things he may like even if never listed. Mark those `new_for_you: true`. Learn from thumbs (see Votes).

## Day profiles
From `config/house.json` → `day_profiles`. Summary:
- Mon to Thu: markets and money full; entertainment compact; Namma Beat only if important.
- Fri: entertainment and Namma Beat fuller; weekend preview.
- Sat, Sun: markets and money news light unless important; entertainment and Namma Beat fullest; sport weekend focus.
Print the day's `profile_line` in the folio.

## Beats
Primary, always checked: see `config/house.json` → `beats.primary`.
Secondary, when useful, in priority order: `beats.secondary`.
Excluded or restricted: `beats.rules` (for example Barcelona only as one dry line for a real setback, no player-milestone chasing, no gossip).

## Research
- Broad, shallow discovery first, then verify what is likely to print. Official or primary sources first, then specialist, then major reputable outlets, then data providers. No snippet-only sourcing.
- Establish when the development actually happened. Discovery date is not news date. Older material can appear only as context, with its age clear.
- Times: venue local, then UTC, then IST. If two credible sources disagree by 30 minutes or more, find a third; if still unresolved, print "time TBC".
- Never claim Parth watched, saw, read or missed anything.

## Sports chronology (hard rule)
Before ranking, build one ordered timeline per followed entity (club, national team, players, F1): all confirmed fixtures across all competitions, sorted. NEXT = earliest confirmed future fixture. LAST = latest completed. A page about a later match can never set NEXT while an earlier confirmed fixture exists. Later big games are "Watch ahead", not NEXT. NEXT and LAST are utility facts, exempt from dedup, and must be identical everywhere they appear. The run's validator checks this in code.

Tennis: if no match is confirmed, print NEXT EVENT (tournament, dates, "match TBD"). Also list the big upcoming tournaments regardless of who plays.

## Dedup and the story ledger
- Every story belongs to a thread (`thread_id`) in `ledger/story-ledger.json`.
- Before selection, load the ledger. A thread only reprints if a key fact changed or a new fact was added ("what changed since we last printed this?"). The model judges whether the change matters; the validator checks that the recorded facts actually differ.
- One editorial home per development. Utility lines (fixtures, countdowns, tables) may repeat.
- After all sections are written, run one dedup pass across the whole paper, in code, including Talk of the Day and The Betting Window. Remove duplicates and move the next candidate up (refill).
- Keep 30 days of threads plus anything still active.

Ledger thread:
```
{"thread_id", "title", "entities": [], "facts": {"key": "value"}, "first_printed", "last_printed",
 "last_change", "status": "active|closed", "votes": {"up": 0, "down": 0}}
```

## Votes
Read yesterday's and recent votes from `/api/votes` if available. More-like-this on a thread or section nudges similar stories up; Less nudges them down. Votes also adjust Screen & Stage verdict thresholds for Parth's taste over time. Never let votes remove the must-know floor.

## Voice
- Inshorts-style economy: fact first, about 60 words for the short version, neutral and unbiased. The long version ("more") goes up to about 250 words.
- The editor, T. A. Bhide, is a fictional golden-era editor. The paper's copy is plain reporting. His personality appears only in the signed editor's note on big days: strict about rules, proud of being well educated, quick to correct the reader, dry. Never sentimental.
- "Why it matters for you" only when personal relevance is real. Otherwise "Why it matters". One sentence. Never invent personal relevance.
- Headlines are factual, specific and short.

### Banned (AI tells)
- Em dashes. Rule-of-three lists for rhythm. "Not X, but Y" or "It's not just X, it's Y" reframes.
- Inflated words: pivotal, crucial, landmark, testament, underscores, highlights, showcases, delve, landscape, navigate, robust, seamless, notably, quietly, amid.
- "-ing" tails that fake analysis ("..., highlighting the growing importance of...").
- Summary lines that repeat the story. Tidy morals at the end of every story. Vague attribution ("experts say").
- Colon-then-reveal sentences. Scare quotes. Every sentence the same length.
- Any sentence about the process or about absence ("nothing cleared the bar", "no confirmed platform was found"). If there is nothing, print nothing.

## Section briefs
- **Front Page:** strongest 5 to 11 items across everything. One true lead when deserved.
- **Madridismo:** NEXT (IST and local, competition, venue, streaming only if reliably confirmed), LAST result, recent form, table. Then 0 to 3 items: club news, availability, contracts, discipline; strong tactical or data analysis gets real space (conclusion, evidence, what to watch). Managing Madrid first, other sources welcome.
- **The Wider Pitch:** big football developments anywhere: transfers, managers, major results, rulings. On an international break, cover the internationals (Nations League, qualifiers, big friendlies) and managerial pressure; the section should rarely be empty. Aim for 1 to 2 stories plus 2 to 3 briefs.
- **Paddock Notes:** race week: every published session local and IST, Max Watch, leader and gap, stewards or technical news, next three races, one useful track note.
- **The Crease:** senior men's team across formats. Team news first, then Kohli, then others.
- **Deuce:** big tournaments, then Alcaraz and Djokovic.
- **The Sidelines:** every other sport worldwide when it clears the bar. Sweep before deciding it is quiet: multi-sport games (Asian Games, Olympics, Commonwealth), golf (majors, Ryder and Presidents Cup), WNBA and NBA milestones, athletics, chess, kabaddi and other Indian team sports, motorsport beyond F1, pickleball. Most days this means 2 to 5 items. NBA only for truly major league-wide news; Warriors in season (latest result, next 2, West position).
- **Dateline:** normally 2 to 5 full stories plus briefs: geopolitics, elections, war, disasters, economy, courts, regulation, security, infrastructure, major corporate moves.
- **The Workshop:** launches, acquisitions, pricing or platform changes, security, useful workflows, consumer tech with India price and availability, wearables weighted up.
- **The Pipeline:** only when something useful for an SDR manager happened.
- **The Ledger:** index levels and moves; one line of real driver when known. Write `sections.ledger.data.notes` keyed by the asset names in config (Sensex, Nifty 50, Nasdaq-100, Bank Nifty, USD/INR, Brent crude, Gold (India, IBJA), Bitcoin, S&P 500): one short sentence each on what moved it or what level matters (a record, a threshold, a policy date), taken from the day's research. The page adds the 3-month context itself; never repeat the change figure in words. Cards & Points: any India credit card change (fees, lounges, rewards, devaluations, launches), not only points.
- **Namma Beat:** popular stand-up shows announced for Bengaluru, new food places getting real attention, metro, roads, airport, civic changes that affect daily life.
- **Screen & Stage:** new releases this week and upcoming popular ones. Start from popularity, not listings: Netflix India's Top 10 (Tudum), FlixPatrol and JustWatch India charts, the week's biggest US streaming premieres available in India (Apple TV, Netflix, Prime Video, JioHotstar), and the Friday theatrical slate (Hindi and Hollywood). A title that is widely talked about belongs here even with middling reviews; say so in its verdict. Aim for 5 to 8 titles on Friday to Sunday, 3 to 5 on other days. Verdict per title from real consensus:
  - Must watch: critics and audiences both strongly positive
  - Good watch: clearly positive with reservations
  - Your call: split, or good but niche
  - Skip: clearly negative on both
  - Too early: fewer than 3 reputable reviews
  Add "If you liked ..." when it helps. English and Hindi only, no regional.
- **Talk of the Day:** 5 to 7 India and 5 to 7 world (guide, not limit), written in English whatever the language of the search term or its news. Format per row: term, search volume (the `traffic` field, e.g. "10K+"), and one line of what actually happened, at most 140 characters, researched from the attached articles, not copied from a headline. Skip terms that are pure stream-finding or betting-tip searches unless the event itself matters. Mix the world feeds (US, GB, ES and the event-driven extras) so no single country's sports page dominates. Dedup against the whole paper.
- **The Betting Window:** 8 to 10 Polymarket markets. Run `node scripts/betting-candidates.mjs` for a ranked, de-duplicated list after the config exclusions: US politics, US economic policy (Fed included), US sports, esports, crypto price ladders, weather, tweet counts, celebrity, mentions, prop-bet lines, and markets already settled at 99%. Then choose by relevance to Parth first (F1, Madrid, La Liga, Champions League, cricket, tennis, AI, India, the wars moving oil and markets), volume second; do not copy the top of the list. Store each as `{id: "pm:<slug>", category (short: F1, Football, AI, Iran war...), title, outcomes, source: "Polymarket", url}`; the page refreshes prices live by id. Include something excluded only if it clearly affects Parth. Polymarket only: Kalshi was retired on 25 Sep 2026 and the validator rejects any id that does not start with `pm:`.
- **Your Desk:** Calendar next 14 days plus targeted Gmail: birthdays, bookings, travel, deliveries, refunds, money admin, security alerts. Use the original confirmation email for dates and times. Group as Next 72h, Days 4 to 7, Week 2. Skip OTPs, receipts, marketing, routine meetings.
- **The Fixture List:** everything in the next 7 days across sports, as `fixtures` with `entity`. Club fixtures further out live in their own sections (Madridismo shows the next four), not here. Set `where` only when two sources confirm the Indian broadcaster or stream (for example F1 on FanCode); otherwise leave it out and the page shows nothing.
- **Before You Go:** Watch and Do lines only. No restating.
- **House Note:** one to three short lines. A true, surprising or funny fact with a light, dry turn at the end. Gentle personification is allowed occasionally. Model it on: "The Alcaraz–Shelton quarter-final finished at 03:33 in New York; even the official record book had to stay up late." Never a motivational line, never a fake quote.

## Final audit before publishing
Coverage and must-know floor, ranking, chronology (NEXT/LAST correct and consistent), facts and dates, dedup and refill, sources on every substantive story, banned-pattern scan, no process language, no empty or placeholder text, schema valid.
