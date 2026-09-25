# RUNBOOK: the daily edition

## Schedule
Four scheduled runs a day, 29 minutes apart, from 14:00 IST. Each one first checks whether today's edition is already live and exits at once if it is, so only one does the work.

| Run | IST | UTC cron |
|---|---|---|
| Main | 14:00 | `30 8 * * *` |
| Retry 1 | 14:29 | `59 8 * * *` |
| Retry 2 | 14:58 | `28 9 * * *` |
| Retry 3 | 15:27 | `57 9 * * *` |

The information cut is 14:00 IST: the paper covers news up to 14:00 and prints "Information cut 14:00 IST". Research starts at the cut, so the paper is usually live by about 14:45; until then the site shows the previous edition.

Prompt for each scheduled task:
> Open the house-of-1400 repo. Follow docs/RUNBOOK.md exactly as a daily run. Obey the daily-run rules in CLAUDE.md.

The live scheduled runs use a slightly longer version of this prompt that also attaches and clones the repo (see docs/STATUS.md).

## Commands (run from the repo root)
A daily run only needs to reach GitHub and our Vercel domain. It never calls the third-party data APIs directly: the live snapshot and the live test both go through our own `/api/live/*`, authorised with the `RUN_KEY` header (the environment variable `RUN_KEY` must match the one in Vercel; `SITE_URL` defaults to https://house-of-1400.vercel.app).
- `npm ci` once per session.
- `npm test` checks every live source through `<SITE_URL>/api/live/*` (shape, freshness, ranges). Failures go in the snapshot, not the paper.
- `node scripts/snapshot.mjs content/editions/YYYY-MM-DD.json` fetches every `<SITE_URL>/api/live/<key>` and writes the `snapshot` block. When a key fails it keeps the last-known-good value with its own time.
- `npm run validate -- content/editions/YYYY-MM-DD.json` runs every check in step 8.
- `npm run publish-edition -- content/editions/YYYY-MM-DD.json` validates again, then writes `content/latest.json`, `content/archive.json` and `ledger/story-ledger.json`. It refuses to publish a failing edition.
- Build sessions only: `npm run test:local` and `node scripts/snapshot.mjs --local` call the third-party APIs from this machine; `node --test tests/*.test.mjs` runs the offline tests. In Claude Code cloud sessions the scripts relaunch themselves with `NODE_USE_ENV_PROXY=1` so Node uses the egress proxy; for ad hoc `node -e` calls set `NODE_USE_ENV_PROXY=1 HTTP_PROXY=$HTTPS_PROXY` yourself.

If `RUN_KEY` is missing or `/api/live` answers 401, record that, skip the snapshot (the page still fetches live data itself) and carry on with the edition.

## Steps
1. **Already done?** Fetch `https://<site>/api/health` (or read `content/latest.json` on `main`). If `edition` equals today's IST date, stop.
2. **Load context:** `config/house.json`, `ledger/story-ledger.json`, the last 3 editions, recent votes from `/api/votes` (with `RUN_KEY`, skip if unavailable). Work out the weekday profile.
3. **Live snapshot:** `node scripts/snapshot.mjs content/editions/YYYY-MM-DD.json` calls every `/api/live/*` function on our Vercel site (with `RUN_KEY`) and stores the results under `snapshot` (fallback values with `as_of`). Never call the third-party APIs directly in a daily run.
4. **Chronology:** build the ordered fixture timelines (EDITORIAL.md, Sports chronology). Save them in memory for every section.
5. **Research:** broad discovery across every beat and the must-know floor, then verify likely items. Google Trends terms come from `/api/live/trends` (in the snapshot); research what actually happened for each and write the line in English. Betting candidates come from `node scripts/betting-candidates.mjs` (Polymarket, a few seconds).
6. **Select and rank** with the Parth test, the must-know floor, the day profile, votes and the ledger ("what changed?").
7. **Write** every section to the schema: short version, long version where useful, why it matters, sources. Editor's note only on big days. House Note always.
8. **Validate in code** (`npm run validate`): JSON schema; every substantive story has a source URL; NEXT/LAST consistent everywhere and no earlier confirmed fixture exists; no duplicate thread across sections (including trends and betting), with refill; banned-pattern scan (em dash, banned words, process phrases); no empty strings or placeholders. Fix and re-validate. Never publish a failing edition.
9. **Publish:** write `content/editions/YYYY-MM-DD.json`, copy to `content/latest.json`, update `content/archive.json` and `ledger/story-ledger.json`. One commit, message `Edition YYYY-MM-DD`, push to `main`.
10. **Verify:** poll `/api/health` until it reports today's date (up to 10 minutes).
11. **Notify:** only after step 10 passes, call `/api/notify` with `RUN_KEY`. The function sends Telegram: lead headline plus the link. Skip if Telegram is not configured.

## Failure handling
- Any step fails: fix what can be fixed within the run and continue. If the run cannot publish, stop cleanly. The next retry picks it up.
- If research is partial, publish with fewer stories rather than nothing, as long as validation passes.
- A live function failing never blocks the edition; the snapshot records it.
- If all four runs fail, the site keeps yesterday's edition and shows a small "Today's paper is late" line automatically after 16:30 IST. This is the last resort.

## Your Desk
Only if Gmail and Google Calendar tools are available in the run. If they are not, omit the section. Never write personal data anywhere except the edition JSON in this private repo.
