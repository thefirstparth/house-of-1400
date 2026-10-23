# Vercel usage check (brief for a new session)

Parth asked for this on 23 Oct 2026. You are a build session with a `VERCEL_TOKEN` in the environment. Your job is
to **read** Vercel's usage for The House of 1400 (house14.vercel.app) and write one report Parth can forward. Read
only: change nothing in Vercel, delete nothing, push nothing to `main`. Never print the token.

## What happened
- The project was on Vercel's free plan (Hobby). Over 14-23 Oct 2026 it kept running into Hobby's limits.
- **20 Oct, morning** (Parth's usage page, last 30 days): Deployment Storage 7.83 of 10 GB, Blob Simple Operations
  7.1K of 10K, Blob Advanced Operations 1.3K of 2K, Fluid Active CPU 2h 35m of 4h.
- **20 Oct, night:** Deployment Storage 8.55 of 10 GB.
- **23 Oct, morning:** Blob Simple Operations 9.1K of 10K, Blob Advanced Operations 1.4K of 2K, Fluid Active CPU
  2h 49m of 4h, Fast Origin Transfer 1.85 of 10 GB. **The Blob stores were suspended at 02:23 IST on 23 Oct**
  (podcast feed, episodes, thumbs votes and alert state all down), although the page showed reads under 10K. A
  review that day found Vercel's usage API reporting about 14,300 Blob reads for October, so the page and the
  limit were probably counting different periods. Which line actually triggered the suspension is **not known**.
- Parth upgraded to **Pro on 23 Oct** to unblock the stores. The podcast was back the same day.
- The plan: watch 2-3 days on Pro, then go back to Hobby if the daily numbers fit. If they don't, move the podcast
  audio off Vercel Blob (to a small public GitHub Pages repo, with /listen/<file>.mp3 redirecting to it).

## What was changed (all on `main`; DECISIONS.md has the detail)
| When | Commit | Change | Meter it should lower |
|---|---|---|---|
| 20 Oct | 51c3db6 | TV feed's alert state kept in memory, read by path (no list), written only on change; podcast feed held 5 min at the CDN; branch pushes no longer deploy | Blob simple + advanced ops, Deployment Storage |
| 20 Oct | e0bd916 | The skip step wired in (`vercel.json` `ignoreCommand`): docs, tests and podcast-script pushes no longer deploy; only 14 days of art per deployment (42 MB to 28 MB) | Deployment Storage |
| 23 Oct | 23c0b1e | Podcast feed and transcripts held at the CDN until 13:30 IST (5 min only 13:30-16:30 IST); TV state and gold history re-read every 6 h, not hourly | Blob simple ops |
| 23 Oct | 22ae542 | Episode audio read whole and held at the CDN for a year (byte ranges answered from the CDN copy); a missing file costs one read, not two | Blob simple ops, Blob data transfer, Fluid Active CPU |

Seen from outside on 23 Oct evening: the feed was a CDN HIT 82 minutes old; audio was a CDN HIT once cached, but
the CDN dropped an episode cached in the morning by the evening and keeps a copy per region (US for Apple and
Spotify, Mumbai for Parth). So each episode is still read from Blob a few times a day per region.

## What to expect
- **Blob simple operations** (reads): Hobby allows 10K a month, about **330 a day**. Remaining readers: the podcast
  job (about 14 episode records per run, two runs a day), audio CDN misses (a few per episode per region per day),
  feed CDN misses (about 40 a day), the daily run's votes and letters (one read per vote or letter), the 16:00
  notify cron, the TV state and gold history (every 6 h per server).
- **Blob advanced operations** (writes and lists): Hobby 2K a month, about 66 a day. Writers: the podcast job (MP3,
  transcript, record, feed), votes, gold history, TV state on change, notify markers; lists in the podcast job,
  notify, votes, letters and the podcast address lookup (once per server).
- **Deployment Storage:** about 28 MB per deployment; a push of docs only makes none. Falls as old, larger
  deployments age out of the 30 days.
- **Fluid Active CPU:** lower than before, since the audio no longer streams through the function on every listen.

## What to do
1. With `VERCEL_TOKEN`, find the team and the project (house-of-1400 / house14) through Vercel's REST API
   (https://api.vercel.com) or `npx vercel` with `--token`. Find the endpoints from Vercel's own documentation; do
   not guess numbers.
2. Read, for the last 30 days and **per day since 23 Oct**: Blob simple operations, Blob advanced operations, Blob
   data transfer, Blob storage, Fluid Active CPU, function invocations (by route if available), Fast Origin
   Transfer, Deployment Storage and the number of deployments. If Pro's Blob observability (reads by file path) is
   reachable, list the top paths.
3. Check the project's Deployment Retention setting.
4. If something can't be read with the token, say so plainly and say where in the dashboard Parth can see it.

## The report (keep it short; Parth forwards it)
1. A table: metric | Hobby limit | last 30 days | average per day since 23 Oct | projected 30 days at that rate | fits Hobby? (yes / tight / no).
2. The top Blob paths by reads (if available), with the share of all reads.
3. Which line most likely triggered the 23 Oct suspension, if the data shows it.
4. Verdict: **safe to go back to Hobby now: yes / no / not yet**, with the reason in one or two lines. If no, the one
   change that would fix it (for example, moving the podcast audio to GitHub Pages) and its expected effect.
5. Anything you could not read.
