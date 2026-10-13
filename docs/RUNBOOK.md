# RUNBOOK: the daily edition

## Schedule
Four scheduled runs a day, 29 minutes apart, from 14:00 IST. Each one first checks whether today's edition is already live and exits at once if it is, so only one does the work. The 14:00 main run uses Opus (`claude-opus-5-5`) for the editorial work; the three retries and the 16:00 poster run use Sonnet (`claude-sonnet-5`), so a failed main run is redone on the cheaper model. Set on each routine. The server may start a run a few minutes after its slot; the information cut stays 14:00 IST whatever the start time. Scheduled runs fire into two standing Claude Code sessions that were created with this repository attached (routines that start a fresh session get no repository and cannot clone it): "House of 1400 · scheduled desk (Opus: 14:00 edition)" receives the 14:00 run, and "House of 1400 · scheduled desk (Sonnet: retries and posters)" receives the 14:29, 14:58 and 15:27 retries and the 16:00 poster run. Each run starts by resetting its checkout to origin/main and ignores earlier days' messages. Do not archive these two sessions; if one is lost, create a new session with this repository as its source and the right model, and point the routines at it.

| Run | IST | UTC cron |
|---|---|---|
| Main | 14:00 | `30 8 * * *` |
| Retry 1 | 14:29 | `59 8 * * *` |
| Retry 2 | 14:58 | `28 9 * * *` |
| Retry 3 | 15:27 | `57 9 * * *` (paused by Parth, 12 Oct 2026) |

The information cut is 14:00 IST: the paper covers news up to 14:00 and prints "Information cut 14:00 IST". Research starts at the cut, so the paper is usually live by about 14:45; until then the site shows the previous edition.

Prompt for each scheduled task:
> Open the house-of-1400 repo. Follow docs/RUNBOOK.md exactly as a daily run. Obey the daily-run rules in CLAUDE.md.

The live scheduled runs use a slightly longer version of this prompt that also attaches and clones the repo (see docs/STATUS.md).

## Commands (run from the repo root)
A daily run only needs to reach GitHub and our Vercel domain. It never calls the third-party data APIs directly: the live snapshot and the live test both go through our own `/api/live/*` (`SITE_URL` defaults to https://house14.vercel.app).
- `npm ci` once per session.
- `npm test` checks every live source through `<SITE_URL>/api/live/*` (shape, freshness, ranges). Failures go in the snapshot, not the paper.
- `node scripts/snapshot.mjs content/editions/YYYY-MM-DD.json` fetches every `<SITE_URL>/api/live/<key>` and writes the `snapshot` block. When a key fails it keeps the last-known-good value with its own time.
- `npm run validate -- content/editions/YYYY-MM-DD.json` runs every check in step 8.
- `npm run publish-edition -- content/editions/YYYY-MM-DD.json` validates again, then writes `content/latest.json`, `content/archive.json` and `ledger/story-ledger.json`. It refuses to publish a failing edition.
- Build sessions only: `npm run test:local` and `node scripts/snapshot.mjs --local` call the third-party APIs from this machine; `node --test tests/*.test.mjs` runs the offline tests. In Claude Code cloud sessions the scripts relaunch themselves with `NODE_USE_ENV_PROXY=1` so Node uses the egress proxy; for ad hoc `node -e` calls set `NODE_USE_ENV_PROXY=1 HTTP_PROXY=$HTTPS_PROXY` yourself.

If `RUN_KEY` is missing or `/api/live` answers 401, record that, skip the snapshot (the page still fetches live data itself) and carry on with the edition.

## Steps (from the 13 Oct 2026 edition: the pool; docs/DESK.md is the brief)
1. **Already done?** Read `content/latest.json` on `main`. If `edition` equals today's IST date, stop at once, before anything else.
2. **Prep, one command:** `node scripts/prep.mjs`. It prints:
   - the last seven editions in brief (every item with its thread, for follow-ups and one home per thread);
   - the letters to the editor (answer each in `checks.letters`);
   - India's cricket times;
   - the Betting Window candidates;
   - **the day's pool:** about 50 stories ranked by code from the whole reading list, each with its own article text, and 30 more headlines (written to `ledger/pool.json`).

   It also stores the live snapshot in today's edition file. Write the edition into that file and keep its `snapshot`. If one part fails it says so; run that script on its own (`node scripts/pool.mjs` for the pool).
3. **Read `docs/DESK.md`** and nothing else of the rules. It holds the tests, the fixed numbers, how to write, and one line for every block of the edition. Open `docs/EDITORIAL.md` only at the section the validator names. Read `ledger/lessons.json` and `ledger/changes.json` only if the validator asks.
4. **Choose and write from the pool** (DESK.md):
   - 18 to 24 items, at least 8 full stories, within each desk's floor and ceiling;
   - a long version of 150 to 250 words for every full story, from the pool's text;
   - every TOP pool story printed or answered in `checks.pool`.

   No web sweeps: the pool has replaced them. Search or fetch only to confirm a fact or fill a time the snapshot lacks, about eight at most. Then write the rest of the edition (DESK.md's list) and `art_scores`.
5. **Validate:** `npm run validate -- content/editions/YYYY-MM-DD.json`. Fix only what it reports, and re-run. If the same error survives three fixes, stop cleanly without pushing and say what failed; the retry picks it up. Never publish a failing edition.
6. **Publish:** `npm run publish-edition -- content/editions/YYYY-MM-DD.json` (it stamps `printed_at` and writes `content/latest.json`, `content/archive.json` and `ledger/story-ledger.json`).
   - Add today's desk diary to `ledger/editor-log.json` (below).
   - Commit the edition, latest, archive and the ledger files the scripts wrote. One commit, message `Edition YYYY-MM-DD`, pushed to `main`.
   - If the push is rejected because `main` moved: `git pull --rebase origin main` and push again; the files never overlap.

   **Desk diary:** one entry `{date, kind: "daily", title, text}`: a title of up to eight words and up to 80 words in Bhide's voice on what led and why. On a Monday also `{kind: "weekly"}`, up to 200 words on the week.

Editions before 13 Oct 2026 were made by the old flow: hand research sweeps, the wire check and the desk check (EDITORIAL.md, Research; `scripts/wire-check.mjs`). It is kept only as a fallback. If `node scripts/pool.mjs` fails twice, research by hand as EDITORIAL.md describes and record why in `checks.pool_error`; the numbers and depth still apply.

7. **Verify:** poll `/api/health` until it reports today's date (up to 10 minutes).
8. **Notify:** only after step 7 passes, `curl -s -X POST "https://house14.vercel.app/api/notify?run=<main|retry1|retry2|retry3>"` (no key needed; it sends at most once per edition). Telegram gets the lead, At a Glance, the editor's note and a one-line run status. A Vercel cron at 16:00 IST sends the summary if a run forgot, or one "no paper today" message if nothing went live. If Telegram is not configured it answers `sent: false`; carry on.
9. **Source trial: stopped on 1 Oct 2026 (Parth).** Do not run `scripts/trial.mjs`. The parts already switched on stay on: `/api/live/screen` stays for looking up a title by hand, the wire check reads `/api/live/wire`, tennis next matches come from ESPN.

## Podcast (code only, not part of the daily run)
After each edition is pushed, GitHub Actions makes the day's two-host episode (`scripts/podcast/make.mjs`, `.github/workflows/podcast.yml`) and publishes it to the private Apple Podcasts feed. Daily runs do nothing for it and never touch its files. Backups run at 14:40 and 15:25 IST; the episode is out before 15:45 IST. If an episode is missing, run the workflow by hand from GitHub (Actions, podcast, Run workflow); "dry" makes a test episode without publishing it, "feed_only" rebuilds the feed. DECISIONS.md, 13 Oct 2026.
