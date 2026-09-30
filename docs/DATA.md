# DATA

Every live value goes through `/api/live/<key>`. Each returns `{ok, value, source, as_of, stale}`.
Rule: primary, then backup, then the edition snapshot (with its time), otherwise hide the field. Never zero, never blank, never a guess.

All endpoints below were tested on 25 Sep 2026 unless marked otherwise.

| Key | Primary | Backup | Cache | Notes |
|---|---|---|---|---|
| weather | Open-Meteo forecast API (no key), plus Open-Meteo air quality (CAMS, US AQI) | none needed | 15 min | `current`, `daily` max/min/precip probability, seven days back and seven ahead, WMO weather code to emoji. Air quality: a day's figure is its highest hour. Reader location via browser geolocation, fallback IP city, Bengaluru and the family cities always shown |
| f1_next | Jolpica `api.jolpi.ca/ergast/f1/current/next.json` | OpenF1 `api.openf1.org/v1/sessions?year=&country_name=` | 1 h | Both agreed on every Baku session time |
| f1_standings | Jolpica `current/driverStandings.json`, `constructorStandings.json` | ESPN racing | 1 h | |
| f1_last | Jolpica `current/last/results.json` | | 1 h | |
| football | ESPN `site.api.espn.com/apis/site/v2/sports/soccer/all/teams/{id}/schedule?fixture=true` and without `fixture` for results | none (snapshot) | 30 min | Matched LaLiga.com and realmadrid.com exactly. Team IDs in config. TheSportsDB free key dropped 25 Sep: stale and incomplete |
| laliga_table | ESPN `apis/v2/sports/soccer/esp.1/standings` | | 1 h | |
| nba | ESPN `basketball/nba/teams/{abbr}/schedule` | | 1 h | Only in season |
| tennis | ESPN `tennis/atp/scoreboard` | | 1 h | The page uses the tournament list. The same feed also lists every draw's matches with players and times (checked 28 Sep: Michelsen v Alcaraz, 30 Sep 04:00 UTC), but not team events (Laver Cup, Davis Cup). Player NEXT still comes from the daily run; the source trial compares it with ESPN (`tennis_players`) |
| markets | Yahoo `query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3mo&interval=1d` and `v7/finance/spark?symbols=` | Twelve Data or Alpha Vantage free key (optional) | 5 min in market hours | Unofficial. Server-side only (CORS). 7D and 1M from Moneycontrol's price feed (`priceapi.moneycontrol.com`) where its level agrees with ours to 0.3%; otherwise calculated from closes and marked. **Daily bars can be null** (seen 22 and 24 Sep): take the day's close from `meta.regularMarketPrice` after close, never chart or average a null. Symbols in config |
| dma | Published figures only (see config `markets.dma_sources`) | | daily | Never computed. Print only if 2 sources agree within 0.25%. Else skip the line |
| gold_in | IBJA `ibjarates.com` (HTML) | none | 1 h | 24K 999 and 22K 916 per gram, print per 10g. Scraper must validate range; on failure use snapshot. The page's hidden `HdnGold` input holds about 4 months of daily 999 rates per 10g: the change on the previous rate, the change over about a month and the period high and low come from it |
| fx | Yahoo `INR=X` | `open.er-api.com/v6/latest/USD` | 15 min | |
| crypto | Yahoo `BTC-USD` | CoinGecko simple price | 5 min | Agreed within $10 |
| trends | Google Trends RSS `trends.google.com/trending/rss?geo=IN` (and world geos in config) | | 30 min | Items include linked news articles. Server-side only |
| mood (inside markets) | Tickertape Market Mood Index `api.tickertape.in/mmi/now` (India); CNN Fear & Greed `production.dataviz.cnn.io/index/fearandgreed/graphdata` (US) | each tried twice; then this server's last good reading, marked stale; then the edition snapshot | as markets | Published readings only, never calculated (28 Sep). Publishers' own bands and words, their week and month comparisons. CNN answers only a request that looks like its own page (origin and referer edition.cnn.com); a plain one gets 418 |
| movers | NSE's Nifty 500 list (`nsearchives.nseindia.com`, copy in `config/nifty500.csv`) priced with Yahoo `v7/finance/spark` | the config copy of the list | 30 min | Run-only (the page never asks). Flags 8% stock moves, 2.5% industry medians and same-day clusters over two sessions. Also `breadth` for the latest session (up, down, three biggest gainers and losers, three strongest and weakest industries by median), shown in The Ledger |
| signals | Polymarket Gamma tagged events | | 30 min | The "market's view" line in Paddock Notes, Madridismo, The Crease and Deuce |
| betting | Polymarket Gamma `gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false` | none (Kalshi retired 25 Sep 2026) | 30 min | Apply config exclusions. India volume is tiny; world only |
| traders | Polymarket Gamma (`/events?tag_slug=…`), one event per topic in config `markets.traders.topics` (tag + title pattern; soonest to resolve that has traded enough and is at least `min_days` away); Kalshi public API (`api.elections.kalshi.com/trade-api/v2`, no key) for the Fed as a second opinion | Kalshi missing: Polymarket alone; nothing found: block hidden | 10 min | Decisions: outcomes ≥1% with the day's move. Levels: the three least certain open levels, one on each side. Checked 30 Sep: Polymarket and Kalshi both 56% hold, 44% hike for October |
| flows | NSE provisional FII/DII cash-market figures (`nseindia.com/api/fiidiiTradeReact`, all exchanges; `fiidiiTradeNse`, NSE only, as backup) and NSDL's daily FPI report (`fpi.nsdl.co.in/web/Reports/Monthly.aspx`, equity sub-totals summed for the month) | either source alone; both missing: block hidden | 30 min | Two measures, labelled: NSE is the day's provisional trading, NSDL custodian-confirmed investment. Checked 30 Sep: NSE all exchanges FII −₹9,980 cr on 29 Sep |

## Not live (daily run researches these)
- India men's cricket: next match and series come from research, two reliable sources, chronology checked. Exact IST start times come from Cricbuzz's India schedule page (`node scripts/cricket-times.mjs`, `ledger/cricket-times.json`, validated). ESPNcricinfo's API refuses access, but its RSS feeds work (checked 28 Sep: `espncricinfo.com/rss/content/story/feeds/0.xml`, and `6.xml` for India).
- Tennis player next match and next event (see the tennis row: ESPN has most matches, not team events).
- Screen & Stage verdicts: since 29 Sep the run reads `/api/live/screen` in research, with OMDb (IMDb, Rotten Tomatoes, Metacritic in one call) and TMDB (India watch providers, the Coming soon candidates). If either key fails, research reviews on the web. A changed key in Vercel takes effect only after the next deploy.

## Source trial (29 Sep to 8 Oct 2026)
Run-only keys in `lib/trial.js`, called by `scripts/trial.mjs` after the edition is live and never by the page, the snapshot or `npm test` (docs/SOURCES-AUDIT.md, DECISIONS 28 Sep).

| Key | Source | Notes |
|---|---|---|
| wire | 71 feeds in config `sources.feeds`: Google News top and topic pages, outlets, regulators (RBI, SEBI, PIB), Google News searches | Items inside the news window, grouped into stories by Google News coverage lists; per-feed health |
| tennis_players | ESPN ATP scoreboard | Each followed player's next and last match |
| screen | OMDb (`OMDB_KEY`), TMDB (`TMDB_KEY`), JustWatch India chart (keyless GraphQL), Sacnilk box office page | Keys never appear in responses or errors |
| nse | NSE's official MCP server `mcp.nseindia.in/bhavcopy/cm/mcp` (keyless) | Breadth, top movers, corporate actions. On 28 Sep its data was two sessions old; the live-market server had no data during trading hours |
| alerts | Sachet (NDMA and IMD) `sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails` | Alerts naming or within 60 km of the paper's cities |
| cricket_where | WhereIsCricket `whereiscricket.com` | India's matches with TV and streaming in India |
| intl_football | ESPN soccer scoreboards (config `trial.intl_football`) | National-team matches, a day back to a week ahead |
| calendar | Federal Reserve FOMC calendar page, Google's Indian holidays calendar | Dates in the next 30 days |

## Optional env vars
`TWELVEDATA_KEY`, `OMDB_KEY`, `TMDB_KEY`, `CRICKETDATA_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RUN_KEY`, and a connected Vercel Blob store (`BLOB_STORE_ID` with OIDC, or the older `BLOB_READ_WRITE_TOKEN`). Everything must work without them.

## Tests
`npm test` hits every live function and asserts shape, freshness and sane ranges (for example Sensex between 40,000 and 150,000; Bengaluru temperature between 5 and 45). The daily run executes it before publishing and records failures in the edition snapshot, not in the paper.
