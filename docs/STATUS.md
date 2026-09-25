# STATUS · 25 Sep 2026

## Live now
- Site on Vercel (project `house-of-1400`), password gate, Edition No. 1 (25 Sep) published.
- Every page from SPEC: `/`, `/archive`, `/e/YYYY-MM-DD`, `/today`, `?poster=<id>`.
- Live layer: weather, F1 (next, standings, last), Madrid fixtures and results, La Liga table, NBA/Warriors, ATP events, markets with sparklines, FX, Bitcoin, IBJA gold, Google Trends, Polymarket. Each returns `{ok, value, source, as_of, stale}` with primary, backup, edition snapshot, then hide.
- Features: Read more in place, Original ↗, Clip as image, thumbs with toast, New for you label, At a Glance, sticky index and chips, night edition, poster mode (5 variants plus Wake Lock and full screen), "Today's paper is late" line after 15:15 IST, Your Desk folded.
- Tooling: `npm test` (live checks), offline tests, `validate`, `snapshot`, `publish-edition`, local `scripts/dev.mjs`.
- Four scheduled daily runs created (13:15, 13:44, 14:13, 14:42 IST). Each starts a fresh cloud session.

## Not verified yet (needs a fix from you, below)
- The live functions were tested only against recorded API shapes, not the real APIs. This build environment's network policy blocked every data host (Open-Meteo, Jolpica, ESPN, Yahoo, Google Trends, Polymarket, IBJA) and `*.vercel.app`. Open the site once and check each live block. Anything that fails simply hides.
- IBJA's page layout is a guess (the parser looks for 999 and 916 rates and checks the ratio). If gold never appears, the parser needs one look at the real HTML.

## What you need to do
1. **Network access for the daily runs.** In claude.ai/code, open this environment's settings (cloud environment menu → Edit → Network access) and choose Full, or add these hosts: `api.open-meteo.com`, `api.jolpi.ca`, `api.openf1.org`, `site.api.espn.com`, `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, `open.er-api.com`, `api.coingecko.com`, `ibjarates.com`, `trends.google.com`, `gamma-api.polymarket.com`, `www.thesportsdb.com`, and your `*.vercel.app` URL. Without this, runs can still research with web search and publish, but the snapshot and `npm test` fail and web fetches of sources are blocked.
2. **RUN_KEY in the Claude environment.** Add `RUN_KEY` (same value as in Vercel) to the environment's variables so runs can read votes and send the Telegram ping.
3. **Optional:** create a Vercel Blob store (Storage → Blob, connect to the project) so thumbs are stored and learned from. Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Better data later: `OMDB_KEY`, `TMDB_KEY`, `CRICKETDATA_KEY`, `TWELVEDATA_KEY`.
4. **Optional:** set `SITE_URL` in Vercel to the production URL so the Telegram link is exact.

## Pending / next
- Kalshi backup for The Betting Window.
- Sensex DMA sources (config says to skip until two exist).
- Screen & Stage verdict thresholds from votes (needs Blob first).
- NBA West table appears automatically once the regular season starts.
