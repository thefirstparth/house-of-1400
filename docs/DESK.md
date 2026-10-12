# DESK: the daily run's brief (from the 13 Oct 2026 edition)

This page is all a daily run needs to read about the news. Code has already done the gathering. `node scripts/prep.mjs` prints the day's **pool**: about 50 stories, shortlisted and ranked by code from the whole reading list (about 160 feeds), with each story's own article text, plus 30 more headlines. Your job is to **choose and write**. Do not hunt for news on the web. Use a web search or fetch only to confirm a fact, or to find a time or result the pool and snapshot lack, and no more than about eight in the whole run.

`docs/EDITORIAL.md` stays the reference for each section's detailed format. Open it only at the section the validator names when it refuses something; never read it end to end.

## Choosing
Three tests, in order:
- **Parth would be annoyed to miss it.** Follows are in config: Real Madrid, Max Verstappen and F1, India men's cricket, Alcaraz and Djokovic, the Warriors, AI and tech, Indian markets and money, Bengaluru.
- **A well-informed person in India would be caught out not knowing it.** Major national and world news, and India's institutions (courts, the Election Commission, Parliament, the RBI) when they lead the news. Write these neutral and factual.
- **It changes what people in India pay, earn, save, borrow, invest or insure,** or it moved an Indian stock or sector hard.

Also print what he may not follow but would find interesting. The pool's TOP stories are the day's biggest whatever their desk. Mark these `new_for_you: true`.

Every pool story marked **TOP** is printed (a story, a brief or an Also in line) or answered in `checks.pool` as `{id, skip: "why"}`. Each answer covers one id, with its own reason.

## The fixed numbers (config `pool.edition`; the validator refuses anything outside them)
- **18 to 24 items**, counting stories and briefs on the front page and in sections. Also in lines and Back Home do not count.
- **At least 8 full stories.** These are the front page's lead and seconds plus section stories.
- **Desks**, counting every item whose `section` is that desk, front page included:

  | Desk | Items |
  |---|---|
  | AI (`ai`) | 1 to 3 |
  | Tech (`tech`) | 1 to 3 |
  | Desh (`desh`) | 2 to 4 |
  | Videsh (`videsh`) | 2 to 4 |
  | The Ledger (`ledger`) | 1 to 3 |
  | The Wider Pitch (`pitch`) | 2 to 5 |
  | The Sidelines (`sidelines`) | 2 to 4 |

  Madrid, Paddock, Crease, Deuce, Namma, Sales and Screen flex with the news.
- **Back Home** (`back`, Ranchi and Prayagraj) has no floor and no cap. Zero is fine.
- A desk over its cap moves its weakest items to that section's **Also in** lines (`sections.<id>.lines`, up to six). Use Also in lines freely for good stories that did not make the cut.

## Writing
- **Every item carries `section`,** its desk, even on the front page.
- **`short`:** fact first, about 60 words, neutral.
- **`more` (every full story):** 150 to 250 words in 2 to 4 paragraphs, written from the pool's article text. Cover the background, the figures, who said what on the record, and what happens next. Never repeat the short version.
- **A brief:** a headline plus two sentences, at least 22 words.
- **Why it matters:** one sentence, and "for you" only when it is really personal. `tone` is good, bad or mixed only when that is clear.
- **Sources:** the publisher's own link (the pool's `Source:` line), never a Google News link, never a paywalled outlet only.
- **A follow-up to a thread printed this week** (prep lists them) leads with what changed and carries `update: {since, new}`. One home per thread: no story appears twice anywhere in the paper.
- **Banned:** em dashes; rule-of-three rhythm; "not X, but Y"; the words pivotal, crucial, landmark, testament, underscores, highlights, showcases, delve, landscape, navigate, robust, seamless, notably, quietly and amid; "-ing" tails that fake analysis; tidy morals; "experts say"; colon-then-reveal; telling the reader how to feel; any sentence about the process or about something being absent. If there is nothing, print nothing.

## The rest of the edition (one line each; the validator's message says exactly what is missing)
- **`glance`** (The day in a minute): 7 to 11 ranked lines, 8 to 10 on most days, the lead first. Each is a plain headline of 14 words or fewer that names who and what, readable on its own ("India beat West Indies in Indore to lead the T20 series 2–1", never "India 2–1 up after Indore"). Add `subject`: the words naming who or what it is about, copied exactly from the line ("India"); the page prints them bold.
- **`editor_note`:** only on a big day, with `big_day` set. At most two sentences and 35 words.
- **`house_note`:** always.
- **`chronology`:** NEXT and LAST for each followed team and driver, from the snapshot.
- **`fixtures`:** only India knockouts in other sports. The page builds the rest.
- **`tennis`:** each followed player's `next_match` at ESPN's time (in the snapshot), plus the events table: every big event on now or within four weeks, and any event a player's line names.
- **`screen`:** verdicts on the films in `snapshot.cinema`, with the critics you read.
- **`trends`:** Talk of the Day, 5 to 7 India and 5 to 7 world rows. Each row has `traffic` and a one-line fact, and every world row has `geo`.
- **`betting`:** 8 to 10 markets from `node scripts/betting-candidates.mjs`. Keep every carried market, with `since`.
- **`sections.ledger.data.notes`:** one driver sentence per index, keyed as config names them.
- **`sections.paddock.data`:** in race week, the preview and `max_note`.
- **`sections.crease.data.rows`:** the series rows, including "After this".
- **`art_scores` (Bunty draws from these; without them there is no art):** every printed story and brief as `{story_id, importance 0-3, relevance 0-2, drawable 0-3}`. Importance is its rank in today's paper, relevance is how much it matters to Parth, drawable is whether there is one clear idea for a satirical cartoon. Drawable 0 for death, disaster, violence or anything in poor taste. Code picks the orders from the scores when you publish.
- **`letters`:** when a letter deserves a public answer, `{letter_id, quote, reply}`: a short quote and two or three sentences in Bhide's voice (dry, exact, courteous). Most days there is none.
- **`checks`:**
  - `movers`: every market mover in the snapshot, with why it moved.
  - `letters`: what you did with each letter.
  - `lessons` and `changes`: when the validator asks.
  - `pool`.
- **Mondays:** `week_ahead` (6 to 12 dated items across at least 3 areas) and `sections.ledger.data.monday`.

## Keeping the run cheap
- **Read only what you need.** This page, CLAUDE.md, the RUNBOOK, and the prep output. Not DECISIONS, SPEC, DATA or EDITORIAL in full, and not `config/house.json` in full: the prep output and the validator name what you need from it.
- **Write in one go.** Build the edition file once, then run the validator and fix only what it reports. Do not print the whole edition back to yourself.
- **Stop when you are stuck.** If the same error survives three fixes, stop cleanly and say so. The retry picks it up.
