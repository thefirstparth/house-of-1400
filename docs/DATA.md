# DATA

Every live value goes through `/api/live/<key>`. Each returns `{ok, value, source, as_of, stale}`.
Rule: primary, then backup, then the edition snapshot (with its time), otherwise hide the field. Never zero, never blank, never a guess.

All endpoints below were tested on 25 Sep 2026 unless marked otherwise.

| Key | Primary | Backup | Cache | Notes |
|---|---|---|---|---|
| weather | Open-Meteo forecast API (no key) | none needed | 15 min | `current`, `daily` max/min/precip probability, WMO weather code to emoji. Reader location via browser geolocation, fallback IP city, Bengaluru always shown |
| f1_next | Jolpica `api.jolpi.ca/ergast/f1/current/next.json` | OpenF1 `api.openf1.org/v1/sessions?year=&country_name=` | 1 h | Both agreed on every Baku session time |
| f1_standings | Jolpica `current/driverStandings.json`, `constructorStandings.json` | ESPN racing | 1 h | |
| f1_last | Jolpica `current/last/results.json` | | 1 h | |
| football | ESPN `site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{id}/schedule?fixture=true` and without `fixture` for results | TheSportsDB free key `3` | 30 min | Matched LaLiga.com and realmadrid.com exactly. Team IDs in config |
| laliga_table | ESPN `apis/v2/sports/soccer/esp.1/standings` | | 1 h | |
| nba | ESPN `basketball/nba/teams/{abbr}/schedule` | | 1 h | Only in season |
| tennis | ESPN `tennis/atp/scoreboard` (tournament level) | | 1 h | No player-level next match. Player NEXT comes from the daily run |
| markets | Yahoo `query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3mo&interval=1d` and `v7/finance/spark?symbols=` | Twelve Data or Alpha Vantage free key (optional) | 5 min in market hours | Unofficial. Server-side only (CORS). **Daily bars can be null** (seen 22 and 24 Sep): take the day's close from `meta.regularMarketPrice` after close, never chart or average a null. Symbols in config |
| dma | Published figures only (see config `markets.dma_sources`) | | daily | Never computed. Print only if 2 sources agree within 0.25%. Else skip the line |
| gold_in | IBJA `ibjarates.com` (HTML) | none | 1 h | 24K 999 and 22K 916 per gram, print per 10g. Scraper must validate range; on failure use snapshot |
| fx | Yahoo `INR=X` | `open.er-api.com/v6/latest/USD` | 15 min | |
| crypto | Yahoo `BTC-USD` | CoinGecko simple price | 5 min | Agreed within $10 |
| trends | Google Trends RSS `trends.google.com/trending/rss?geo=IN` (and world geos in config) | | 30 min | Items include linked news articles. Server-side only |
| betting | Polymarket Gamma `gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false` | Kalshi `api.elections.kalshi.com/trade-api/v2/events?with_nested_markets=true` (fields end in `_fp`) | 30 min | Apply config exclusions. India volume is tiny; world only |

## Not live (daily run researches these)
- India men's cricket: ESPNcricinfo API refused access. Next match and series come from research, two reliable sources, chronology checked. Optional later: CricketData.org free key.
- Tennis player next match and next event.
- Screen & Stage verdicts. Optional keys later: OMDb (IMDb, Rotten Tomatoes, Metacritic in one call) and TMDB (India watch providers, upcoming releases). Without keys, research reviews on the web.

## Optional env vars
`TWELVEDATA_KEY`, `OMDB_KEY`, `TMDB_KEY`, `CRICKETDATA_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RUN_KEY`, `BLOB_READ_WRITE_TOKEN`. Everything must work without them.

## Tests
`npm test` hits every live function and asserts shape, freshness and sane ranges (for example Sensex between 40,000 and 150,000; Bengaluru temperature between 5 and 45). The daily run executes it before publishing and records failures in the edition snapshot, not in the paper.
