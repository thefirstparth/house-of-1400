# RUNBOOK: the daily edition

## Schedule
Four scheduled runs a day, 29 minutes apart. Each one first checks whether today's edition is already live and exits at once if it is, so only one does the work.

| Run | IST | UTC cron |
|---|---|---|
| Main | 13:15 | `45 7 * * *` |
| Retry 1 | 13:44 | `14 8 * * *` |
| Retry 2 | 14:13 | `43 8 * * *` |
| Retry 3 | 14:42 | `12 9 * * *` |

The main run starts at 13:15 so the paper is live by about 14:00. The printed "Information cut" is the time research actually ended.

Prompt for each scheduled task:
> Open the house-of-1400 repo. Follow docs/RUNBOOK.md exactly as a daily run. Obey the daily-run rules in CLAUDE.md.

The live scheduled runs use a slightly longer version of this prompt that also attaches and clones the repo (see docs/STATUS.md).

## Commands (run from the repo root)
- `npm ci` once per session.
- `npm test` checks every live source (shape, freshness, ranges). Failures go in the snapshot, not the paper.
- `node scripts/snapshot.mjs content/editions/YYYY-MM-DD.json` runs every live getter locally and writes the `snapshot` block (keeps last-known-good values with their own time when a source fails).
- `npm run validate -- content/editions/YYYY-MM-DD.json` runs every check in step 8.
- `npm run publish-edition -- content/editions/YYYY-MM-DD.json` validates again, then writes `content/latest.json`, `content/archive.json` and `ledger/story-ledger.json`. It refuses to publish a failing edition.
- `node --test tests/*.test.mjs` for the offline tests (build sessions only).

If this environment cannot reach `*.vercel.app`, check the deploy with the Vercel connector instead: `list_deployments` for project `house-of-1400`, and confirm the newest production deployment for the edition commit is `READY`. Git `main` plus a READY deployment is equivalent to `/api/health` reporting today's date.

## Steps
1. **Already done?** Fetch `https://<site>/api/health` (or read `content/latest.json` on `main`). If `edition` equals today's IST date, stop.
2. **Load context:** `config/house.json`, `ledger/story-ledger.json`, the last 3 editions, recent votes from `/api/votes` (with `RUN_KEY`, skip if unavailable). Work out the weekday profile.
3. **Live snapshot:** call every `/api/live/*` function and store the results under `snapshot` (fallback values with `as_of`).
4. **Chronology:** build the ordered fixture timelines (EDITORIAL.md, Sports chronology). Save them in memory for every section.
5. **Research:** broad discovery across every beat and the must-know floor, then verify likely items. Google Trends and Polymarket candidates come from the live functions; research what actually happened for each trend.
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
- If all four runs fail, the site keeps yesterday's edition and shows a small "Today's paper is late" line automatically after 15:15 IST. This is the last resort.

## Your Desk
Only if Gmail and Google Calendar tools are available in the run. If they are not, omit the section. Never write personal data anywhere except the edition JSON in this private repo.
