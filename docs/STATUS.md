# STATUS · 25 Sep 2026

## Live now
- Site on Vercel (project `house-of-1400`), password gate, Edition No. 1 (25 Sep) published.
- Every page from SPEC: `/`, `/archive`, `/e/YYYY-MM-DD`, `/today`, `?poster=<id>`.
- Live layer: weather, F1 (next, standings, last), Madrid fixtures and results, La Liga table, NBA/Warriors, ATP events, markets with sparklines, FX, Bitcoin, IBJA gold, Google Trends, Polymarket. Each returns `{ok, value, source, as_of, stale}` with primary, backup, edition snapshot, then hide.
- Features: Full story in place, Source ↗, Share as image, 👍/👎 with toast, New for you label, At a Glance, sticky index and chips, night edition, poster mode (5 variants plus Wake Lock and full screen), "Today's paper is late" line after 16:30 IST, Your Desk folded.
- Tooling: `npm test` (live checks), offline tests, `validate`, `snapshot`, `publish-edition`, local `scripts/dev.mjs`.
- Four scheduled daily runs (14:00, 14:29, 14:58, 15:27 IST; information cut 14:00) as claude.ai routines. Each starts a fresh cloud session in this environment, attaches the repo, and exits at once if today's edition is already on `main`. Today's runs will exit, because Edition No. 1 is already out; 26 Sep is the first scheduled edition.
- Production URL: https://house14.vercel.app

## Verified against the real APIs (25 Sep, 06:30 IST)
- All 14 live sources pass both `npm run test:local` (direct) and `npm test` (through production `/api/live` with RUN_KEY, as a daily run does). Backups checked by forcing each primary to fail: OpenF1, ExchangeRate-API and CoinGecko are correct; TheSportsDB was wrong and is gone.
- All 14 pass on their primary source, and the values were checked by hand: Sensex 73,580.54 (−1.67%), Nifty 23,063.10, Nasdaq-100 30,479, Brent 105.92 against a 106.60 settle, USD/INR 95.95, IBJA 24K ₹1,50,790 / 22K ₹1,38,120, F1 standings and Baku session times, Madrid fixtures and the 1–2 at Atlético, the La Liga table.
- Fixed on the way: Yahoo throttling (429), Brent's daily change, the market "live" label, betting exclusions, competition names, and the 🇲🇾 flag for the relocated Bahrain GP.

## What you need to do
1. **Network access:** done. Daily runs now need only GitHub and `house14.vercel.app` (plus whatever news sites research reaches).
2. **RUN_KEY in the Claude environment (needed now).** Add `RUN_KEY` (same value as in Vercel) to this environment's variables. Daily runs use it for the live snapshot and `npm test` (through `/api/live`), votes and the Telegram ping. Without it they still publish, but with no snapshot.
3. **Optional:** create a Vercel Blob store (Storage → Blob, connect to the project) so thumbs are stored and learned from. Telegram: `TELEGRAM_BOT_TOKEN` in Vercel, then send the bot one message (`TELEGRAM_CHAT_ID` optional). Better data later: `OMDB_KEY`, `TMDB_KEY`, `CRICKETDATA_KEY`, `TWELVEDATA_KEY`.
4. **Your Desk in the daily runs.** Routines created from a session cannot carry connectors in this org, so the scheduled runs have no Gmail, Calendar or Vercel tools and will leave Your Desk out. To get it back, open each "House of 1400 · daily edition" routine at claude.ai (Routines) and add the Gmail and Google Calendar connectors, or recreate them from the routines UI.
5. **Optional:** set `SITE_URL` in Vercel to the production URL so the Telegram link is exact.

## Pending / next
- Sensex DMA sources (config says to skip until two exist).
- Screen & Stage verdict thresholds from votes (needs Blob first).
- NBA West table appears automatically once the regular season starts.
