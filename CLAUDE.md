# The House of 1400

A private, password-protected afternoon newspaper for one reader (Parth), hosted on Vercel.
Half static, half live, like the Daily Prophet: the news is written once a day at 14:00 IST. Live widgets (markets, weather, fixtures, countdowns, tables, trends, betting odds) refresh in the browser.

## Read these first, in this order
1. `docs/SPEC.md`: what the site is, sections, layout, features, content schema
2. `docs/EDITORIAL.md`: how the daily edition is chosen and written (the editorial brain)
3. `docs/DATA.md`: live data sources, fallbacks, tested endpoints
4. `docs/RUNBOOK.md`: the exact daily 14:00 run
5. `docs/DECISIONS.md`: why things are the way they are. Do not re-open these without Parth.
6. `design/reference.html`: the approved visual design. Match it. It is a static proof, not production code.
7. `config/house.json`: every changeable fact (teams, players, tickers, cities, sources, exclusions, day profiles). Never hardcode these anywhere else.

## Two kinds of session, two sets of rules

**Build session** (you are building or changing the site):
- You may change code, styles, functions, config and docs.
- Keep the design faithful to `design/reference.html`.
- Log any decision that changes behaviour in `docs/DECISIONS.md`.

**Poster run** (16:00 IST, `docs/RUNBOOK.md` → Posters): only writes `public/posters/latest/`.

**Daily run** (a scheduled edition run, following `docs/RUNBOOK.md`):
- Only write `content/editions/YYYY-MM-DD.json`, `content/latest.json`, `content/archive.json`, `ledger/story-ledger.json` and `ledger/betting-carry.json`.
- Never touch code, styles, config or docs during a daily run.
- If validation fails, do not publish a broken edition. Retry per the runbook. Yesterday's paper staying up is the very last resort.

## Hard rules
- Never show a wrong or empty live field. Primary source, backup source, then last-known-good with its "as of" time. Otherwise hide the field.
- Never calculate moving averages. Only print published 50/200 DMA figures when two sources agree; otherwise skip the line.
- No em-dashes anywhere in the paper's copy. No AI-writing tells (see EDITORIAL.md).
- No filler about absence. If a section has nothing worth printing, leave it out or leave the space empty. Never write sentences like "nothing cleared the bar today".
- Workflow and research process never appear in the paper.
- The site has no password (Parth's call on 25 Sep) and is `noindex`; Parth keeps the link to himself. Your Desk is shown (folded) at his explicit request. Put Gmail and Calendar content only in the edition JSON in this private repo, never anywhere else, and keep it to what Your Desk needs. The repo must stay private.
- Secrets live in Vercel env vars or the Claude Code environment. Never in the repo.

## Priority for the first build (get to a live paper by 14:00 IST)
1. Static site from the reference design, reading `content/latest.json`
2. (Password gate: removed 25 Sep at Parth's request)
3. Live functions for weather, F1, football, markets, gold, FX, crypto, trends, Polymarket
4. Archive page
5. Publish today's first edition by running the RUNBOOK once at the end of the build session
6. Set up the scheduled daily runs (see RUNBOOK)
7. Nice-to-haves: poster mode, clip-as-image, thumbs storage, Telegram ping, OMDb/TMDB
