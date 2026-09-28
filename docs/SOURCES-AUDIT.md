# Sources audit · 28 Sep 2026

Step 1 of the overhaul: make the daily run cheaper and more reliable without losing accuracy. Nothing here is built yet; this is the evidence and the proposal. Every feed below was fetched live from a Claude Code cloud container on 28 Sep 2026 (status, item count, items under 30 hours old). Vercel's servers can get different answers (ESPN did on 25 Sep), so each feed must be re-tested from Vercel before it goes into code.

## 1. What we use today

The paper has two supply lines.

### A. The live layer (code, `lib/live.js` and `scripts/`)
16 live keys, 13 third-party hosts, all free, no keys. This part is already efficient: one `snapshot.mjs` call reads all of it through our own `/api/live/*` in about 1.5 seconds (snapshot times on 26 and 27 Sep).

| Section | Live keys | Hosts (primary → backup) |
|---|---|---|
| Masthead ears, Sky & Streets | weather | Open-Meteo forecast + Open-Meteo air quality |
| Paddock Notes | f1_next, f1_standings, f1_last | Jolpica → OpenF1 |
| Madridismo, Wider Pitch | football, laliga_table | ESPN (no backup by design) |
| Deuce | tennis | ESPN (tournaments only) |
| Sidelines | nba | ESPN |
| The Ledger | markets, fx, crypto, gold_in, movers | Yahoo, Moneycontrol price feed (7D/1M), ExchangeRate-API, CoinGecko, IBJA, NSE Nifty 500 list |
| Talk of the Day | trends | Google Trends RSS (IN, US, GB, ES) |
| Betting Window + "market's view" lines | betting, signals | Polymarket Gamma |
| The Crease | (script) cricket-times | Cricbuzz team schedule page |

### B. The research layer (the model, web search and fetch)
This is where the run's time and tokens go. Measured from the three editions so far (25 to 27 Sep):

- **224 cited links from 102 different websites.** About 75 links per edition.
- **Fixed sweeps:** 11 to 12 pages every run (`checks.money_sweep`, `checks.national_sweep`). Most are RSS feeds, read one at a time with a page fetch.
- **Everything else is found by open web search**, then fetched page by page.

Distinct websites cited per section (3 editions, stories and briefs):

| Section | Websites | Main ones |
|---|---|---|
| Front Page | 40 | Business Standard, Sky Sports, Laver Cup, CNBC, realmadrid.com |
| Dateline | 23 | Hindustan Times, Indian Express, Business Standard, Tribune |
| Talk of the Day | 23 | 23 different sites for ~30 rows, many cited once |
| The Ledger (incl. Money in India, Cards) | 19 | Business Standard, Business Today, ET |
| The Sidelines | 11 | olympics.com, Yahoo Sports |
| The Workshop | 10 | CNBC, The Verge |
| The Wider Pitch | 10 | ESPN, BBC, Al Jazeera |
| Screen & Stage | 10 | Rotten Tomatoes, Hollywood Reporter, Free Press Journal |
| Madridismo | 6 | realmadrid.com, Managing Madrid |
| Namma Beat | 6 | Deccan Herald, The Hindu |
| Deuce | 5 | lavercup.com, ATP |
| Paddock Notes | 5 | formula1.com, Sky Sports |
| The Crease | 4 | Tribune, Wisden |
| Betting Window | 1 | Polymarket (by rule) |

### The inefficiencies, worst first
1. **Discovery by open search.** Search is slow, returns a different mix every day, and pulls in weak sites. Cited once each in three days: latestly.com, bollywoodshaadis.com, fitnessvolt.com, savesage.club, inkl.com (a paywall reseller), jamaicaobserver.com (for a Madrid story), sakshipost.com, india.com, twincities.com. None was wrong that we know of, but each is a second-hand copy of a better source and a risk for the "two reliable sources" standard.
2. **Sweeps read one feed per fetch.** The national and money sweeps fetch 11 to 12 RSS feeds one by one. Each fetch goes through a summariser that can drop items, and "is this India story on two or more front pages?" is judged by eye across separate reads. This is how a must-know story gets missed (see the Election Commission entry in DECISIONS, 25 Sep).
3. **Talk of the Day is researched from scratch.** The Google Trends feed already carries two or three news articles per term (we store them in the snapshot), but the run searches again, which is where most of the one-off sites above come from.
4. **Screen & Stage verdicts** need Rotten Tomatoes, Metacritic and IMDb per title: 5 to 8 titles × 2 to 3 page fetches. One free OMDb call per title returns all three.
5. **Tennis NEXT is researched by hand, but ESPN already has it.** DATA.md says ESPN has "no player-level next match". Wrong today: ESPN's ATP scoreboard lists every draw's matches with players and times (28 Sep: "Michelsen v Alcaraz, 30 Sep 04:00 UTC, Scheduled"). Our `tennis()` function only reads the tournament names.
6. **Cricket news relies on search.** DATA.md says ESPNcricinfo "refused access". Its API did, but its RSS feeds work (100 items, 10 to 25 under 30 hours old).
7. **DATA.md is out of date.** It omits movers, signals, Moneycontrol 7D/1M, air quality and Cricbuzz, and carries the two wrong claims above. A run that trusts it does extra work.
8. **Weak feeds in today's sweep list:** Business Standard personal finance (1 item under 30 h), ET economy (2), SEBI's HTML listing page (SEBI has an RSS feed), IRDAI (no feed; stays a page read).

What does not need changing: the live layer's sources and fallbacks, Yahoo plus Moneycontrol for markets, IBJA for gold, Polymarket, Cricbuzz for India's match times, and every two-source rule.

## 2. Friend's repo: kyloprat/kylo-news ("Morning Paper")
Private repo; audited from the zip Parth supplied (28 Sep). This is the most engineered of the three, and the most useful evidence, because **it measured itself against this paper.**

### How it works
A Vercel job gathers everything into a stored "pool": 197 registered feeds plus about 30 data sources. It dedupes and clusters stories, ranks them, and fetches article text for the top ones. A claude.ai routine (Opus, 09:30 IST) then reads a compressed pool (under 150 KB) through their own connector and publishes through the same connector. **The routine does no web research at all: the pool is its only source of facts.** Its sandbox cannot reach the web.

### Their sources (197 feeds, by lane)
| Lane | Feeds | Highlights |
|---|---|---|
| India | 24 | The Hindu, IE (India, Explained, Political Pulse), HT, TOI, ET, Mint, BS, NDTV, ThePrint, Tribune, Deccan Herald; **Google News India Top and Nation**; PIB via Google News; Bengaluru civic (BBMP, BDA, BWSSB, BESCOM, BMRCL) via Google News |
| Markets and money | 33 | ET, Mint (markets, money, **insurance**), BS (markets, economy, PF), ET Wealth, BusinessLine, **RBI press, notifications, speeches**, SEBI via Google News, TRAI, CNBC, Bloomberg Markets, FT, NYT, Reuters Business via Google News, Moneycontrol PF via Google News; Google News searches for **credit cards, income tax (CBDT), GST**; Tickertape Market Mood and CNN Fear and Greed |
| World | 32 | BBC, Guardian, NYT, FT, Al Jazeera, DW, NPR, UN News, Reuters and AP via Google News, **Google News World/US Top/US World**; science and climate feeds |
| Tech | 54 | Verge, TechCrunch, Ars, Wired, Engadget, Guardian and NYT Tech, MIT Tech Review AI, **OpenAI, DeepMind, Google AI, Hugging Face blogs**, AI labs via Google News, security (CISA, CERT-In, Krebs), 9to5Mac/Google, MacRumors, Android Police, many engineering blogs |
| Sport | 45 | BBC (sport, football, cricket, tennis, golf), Guardian, **ESPNcricinfo**, formula1.com, Motorsport, Autosport, RaceFans, The Race, The Athletic, **Google News India Sports**, international football, ATP/WTA, golf and Indian sport via Google News |
| Culture | 5 | Variety, Deadline, Guardian TV, streaming via Google News |
| Trends | 3 | Google Trends IN, US, GB |

Data sources beyond feeds: Yahoo (indices, ~40 instruments), IBJA, **NSE's official MCP servers** (keyless: breadth, top movers, corporate actions, stock history), NSE website APIs (FII/DII, IPO calendar, holidays, corporate announcements), NSDL FPI flows, FRED, bank FD rate pages, InvestorGain IPO GMP, Polymarket, Kalshi, Manifold, The Odds API (key), football-data.org (key), FotMob, ESPN (scoreboards for Nations League and friendlies, NBA, cricket header), Jolpica, OpenF1, **WhereIsCricket** (India TV and streaming per match), a hand-kept broadcast-rights table with as-of dates, **JustWatch India streaming chart** (keyless GraphQL), **TMDB** (key), StreamRank Prime Video India, **Sacnilk** India box office, Netflix Top 10, **Sachet** (NDMA/IMD severe-weather alerts), Open-Meteo, Wikipedia, the Fed's FOMC calendar, Google's Indian holidays calendar, GDELT (rate-limited, unwired).

### What they measured (their spec `gather-quality-design.md`, 26 Sep)
- **Feeds alone miss much of what this paper prints.** Their benchmark included house14's 25 Sep stories. Their pipeline found 1 of 11 (9%) before their quality work and 27% after it, even with 197 feeds. Missed: the US 10-year yield at its highest since 2007 (no feed carried it), the AI labs' safety body (no feed), premium cards cutting lounge access (only in points blogs), the Election Commission row and the OECD forecast (older than the feeds keep items). **Our research layer is what makes the paper an 8/10; feeds must feed it, not replace it.**
- **Headline-overlap matching does not group stories.** Two outlets' headlines on one event rarely share enough words: one story from 9 feeds became 14 separate "stories". A looser headline-overlap dedupe they tried wrongly merged different stories 32% of the time, and was rejected.
- **Google News Top and topic feeds are the best free ranking signal.** Each item carries its position (what leads today) and a list of up to five other outlets that ran the same story. Using those lists to group stories raised recall on their curated list from 31% to 75%.
- **Feeds forget fast.** Indian top-story feeds hold 10 to 24 hours; Al Jazeera 9. A 24-hour news window needs the gather at the cut, not earlier, and research for anything older.
- **Google News links need decoding.** Items link to news.google.com; 0 of 489 resolved without a separate decode step. They keep the publisher's name from the feed instead.
- **Rejected on probe:** Moneycontrol and WSJ feeds (stale for years), ThePrint, Tribune, WION and Deccan Herald (XML their parser rejects), PIB direct (Hindi and undated), SEBI direct (undated), ATP RSS (403), FotMob's API (robots.txt disallows it).

## 3. Friend's repo: RishabhRaj7/the-daily-index
Next.js app that builds the paper on request: it reads RSS feeds in code, then Gemini picks and writes. Its sources:

| Area | Sources |
|---|---|
| World / India | BBC World, Guardian World, Al Jazeera, SCMP, Japan Times, The Hindu (national, business, sci-tech); Google News search RSS as fallback for any place |
| Markets | ET Markets, Mint Markets, Business Standard Markets, ET Economy, BusinessLine Markets, CNBC, MarketWatch, FT Markets; Yahoo spark for indices |
| F1 | formula1.com, Motorsport.com, The Race, RaceFans, Sky F1, BBC F1; Jolpica + OpenF1 for data |
| Football | BBC, Sky, Guardian; ESPN standings and **leaders** (top scorers) |
| Tennis | BBC, Sky, Tennis Majors, Guardian; ESPN **rankings** |
| Tech | The Verge, TechCrunch, Ars Technica, Wired, Engadget, Guardian Tech |
| Cities | The Hindu Bengaluru, TOI Bengaluru, HT Bengaluru, The Hindu Karnataka; TOI Ranchi + Google News for Jharkhand |
| Extras | Open-Meteo (+ geocoding, air quality), Wikipedia On This Day, Merriam-Webster word of the day, Reddit (OAuth) |

**What is worth copying is how it reads news, not its standards.** It has no two-source rule, writes from RSS snippets, and has no market-data checks, so its sources are no more accurate than ours. The method is the good part:
- **Collect the news in code first.** One registry of feeds (`feeds.ts`), each with notes on why it was kept or dropped after a live audit, a per-feed age window and flags (undated feeds, a party-politics pre-filter).
- **Dedupe across outlets** by headline word overlap before any model reads anything.
- **Pick first, read in full second.** The model chooses from headlines and snippets; only the shortlisted articles are fetched in full ("a few dozen instead of ~130").
- **Google News search RSS** as a gap-filler for any named place or subject.

## 4. Feed test results (28 Sep, from the cloud container)

Working and fresh (items under 30 h in brackets):
- **National:** The Hindu national (60), Indian Express India (42), HT India (100), NDTV top (20), TOI top (45), Google News India top (35), PIB English (20 items; dates not parsed)
- **Regulators:** RBI press releases (10 items, full text in feed), RBI notifications, SEBI RSS (30 items)
- **Money / markets:** ET Wealth (20), Mint Money (35), ET Markets (50), Mint Markets (33), BS Markets (33), BusinessLine Markets (21), NDTV Profit (20), MarketWatch (10)
- **World:** BBC World (20), Guardian World (45, long snippets), Al Jazeera (25), Google News `site:reuters.com` and `site:apnews.com` (100 each)
- **Madrid / football:** Managing Madrid (6 of 10), Google News "Real Madrid" (100), BBC Football (30), Guardian Football (28), ESPN FC (19), ESPN LaLiga news JSON
- **F1:** Motorsport (12), The Race (5), RaceFans (5), BBC F1, FIA press releases (full text), formula1.com (undated), ESPN F1 news JSON
- **Cricket:** ESPNcricinfo all (25), ESPNcricinfo India (10), BBC Cricket (13), Wisden (5)
- **Tennis:** ESPN ATP scoreboard (player-level matches), Tennis Majors (6), BBC Tennis (3)
- **Sidelines:** BBC Sport all (36), Sportstar (100)
- **Tech:** Techmeme (16, the best single tech index), The Verge (12), TechCrunch (8), GSMArena (7), Gadgets360, Hacker News (Algolia API)
- **Cars:** Autocar India (10)
- **Namma Beat:** The Hindu Bengaluru (12), TOI Bengaluru (20), HT Bengaluru (5), The Hindu Karnataka (32)
- **Screen:** Deadline (12), Variety (10), Indian Express Entertainment (29), Bollywood Hungama (11)

Refused or stale from here (re-test from Vercel before ruling out): CNBC RSS 403, TechnoFino 403, 91mobiles 403, ATP RSS 403, Olympics.com 403, ThePrint and Scroll 403, Deccan Herald Bengaluru RSS 404, Bangalore Mirror 404, Moneycontrol RSS (last item 2024), CardExpert (last item 38 days ago), Sky tennis and football (no dated items), Netflix Top 10 TSV (works but 31 MB), Wikipedia (429 from this proxy).

## 5. Recommendations

Ordered by gain. Each says what protects accuracy.

### R1. The Wire: one call for the day's news (biggest win)
A run-only `/api/live/wire` (like `movers`: called by the snapshot, never by the page) that reads about 45 vetted feeds from section 4 in parallel on Vercel and returns compact JSON: for each item the title, outlet, publisher URL, time and a snippet of 300 characters or less. Only items inside the news window (since the previous edition's cut). The feed list goes in `config/house.json` under `sources.feeds`, grouped by section, so it can change without code.

Lessons from kylo-news, built in from the start:
- **Group stories by Google News coverage lists, not headline overlap.** Add Google News India Top, India Nation, India Business, India Sports, World, and US Top/Business/Technology as "signal" feeds. Their position ranks the day's leads, and their related-coverage lists say which outlets ran the same story. Headline-overlap matching failed in kylo's measurements (above).
- **The Wire is a floor and a checklist, never the only source.** Kylo's feed-only paper found 27% of our stories at best. The run keeps researching, and the Wire tells it what the major outlets lead with so nothing obvious is missed.
- **Gather at the cut.** Feeds keep 9 to 24 hours; call the Wire at 14:00, not earlier.
- **Cite the publisher, never a Google link.** Resolve Google News links to the outlet's own URL, or find the article on the outlet's site before citing.
- Replaces the 11 to 12 sweep fetches and most discovery searches with one request.
- The national rule becomes mechanical: every India cluster carried by two or more national outlets is listed, and the validator checks each one appears in `checks.national`. That is stricter than today.
- Accuracy guard: the Wire is for discovery only. A story is still verified by reading the article itself, and the two-source rules stay. Web search stays for verification and for anything the feeds do not cover.
- Record the Wire's per-feed counts in the snapshot, so a feed that goes quiet shows up in the run and not in the paper.

### R2. Source tiers
`sources.tiers` in the config: tier 1 official and primary (RBI, SEBI, PIB, club and league sites, formula1.com, FIA, ATP, BCCI), tier 2 reputable outlets (the feeds above plus Reuters, AP, BBC, Guardian, ESPNcricinfo), everything else tier 3. The validator **warns** (does not fail) when a substantive story rests only on tier-3 links, and the run then adds a better source. This removes the latestly-type citations without banning anything useful.

### R3. Talk of the Day from the attached articles
Write each row from the two or three articles the Trends feed already attaches, choosing the highest-tier outlet. Search only when the attachments are thin or disagree. Cuts about 10 searches a day and raises source quality.

### R4. Tennis NEXT from ESPN
Extend `tennis()` to return each followed player's next scheduled match and last result from the ATP scoreboard's draws. The run's research becomes the check, not the source. For the first week, the run records both, and the validator flags any disagreement.

### R5. Cricket news in the Wire
Add the ESPNcricinfo India and all-stories feeds (and BBC Cricket). Keep Cricbuzz for India's match times.

### R6. Screen & Stage from OMDb and TMDB (you create two free keys)
OMDb (free, 1,000 calls a day) returns IMDb, Rotten Tomatoes and Metacritic in one call; TMDB (free) gives India release dates and which Indian platform has a title. One call per title instead of two or three page reads, and the scores are exact. The rule of at least 3 reviews for a verdict stays. Needs `OMDB_KEY` and `TMDB_KEY` in Vercel.

### R7. Regulators by RSS
RBI press releases, RBI notifications, SEBI and PIB in the Wire (all tested). IRDAI and NPCI have no feeds and stay as page reads in the money sweep.

### R8. Google News search as the gap-filler
One Google News RSS query per followed subject (Real Madrid, Verstappen, Alcaraz, Djokovic, India cricket, Kohli), limited to the news window. It returns 100 fresh items for Madrid alone. Caveat: its links are Google redirect URLs, so the Wire must resolve each to the publisher's URL before a story can cite it. Discovery only, never a source line.

### R9. Fix DATA.md
Bring it in line with the code (movers, signals, Moneycontrol, air quality, Cricbuzz, ESPN tennis, ESPNcricinfo RSS) so runs stop working around claims that are no longer true.

### R10. Data sources borrowed from kylo-news (probed 28 Sep from the cloud container)
| Source | Probe | For | Guard |
|---|---|---|---|
| **NSE official MCP** (`mcp.nseindia.in`, keyless): market breadth, top movers, corporate actions, stock history, 52-week highs and lows, moving averages | 200, 26 tools across two servers | The Ledger: a second source for movers (today Yahoo only), corporate actions to help answer "why did it move", and NSE-published moving averages | NSE's figures are published, not calculated by us, so they can be one of the two agreeing DMA sources; the two-source rule stays |
| **Sachet** (NDMA and IMD severe-weather alerts, keyless JSON) | 200, 40 active alerts | Sky & Streets: a line only when Bengaluru, Ranchi or Prayagraj has a WATCH or WARNING | Official; show only watch and warning levels |
| **WhereIsCricket** (India TV and streaming per match) | 200, 108 listings | The Fixture List "where" for India cricket | One of the two confirmations the rule already asks for |
| **ESPN soccer scoreboards** (Nations League, friendlies, qualifiers) | 200, 8 Nations League events | The Wider Pitch and The Fixture List on international breaks | Same host we already use |
| **JustWatch India streaming chart** (keyless GraphQL) | reachable; kylo's verified query needed | Screen & Stage: the popularity starting point, in place of searching FlixPatrol and JustWatch | Chart rank only; verdicts still from reviews |
| **Sacnilk** India box office | kylo verified 27 Sep | Screen & Stage: Hindi theatrical performance | Label as Sacnilk's figure |
| **Google News searches for money topics** (credit card changes, CBDT, GST Council, SEBI and PIB site searches), **Mint Insurance**, **RBI speeches** | kylo registry | The Ledger, Money in India, Cards & Points | Discovery only; cite the regulator or outlet |
| **Calendars**: Fed FOMC page, Google's Indian holidays calendar, NSE trading holidays and IPO calendar | kylo registry | The Week Ahead and the Monday Ledger "watch" list | Dates from the official page |

NSE's website APIs (FII/DII flows, corporate announcements) answered 403 from this machine; kylo reads them from its own machines. Test from Vercel before relying on them.

### Not recommended
- Netflix Top 10 TSV (31 MB for a weekly list; research does this fine).
- Reddit (needs OAuth; weak signal for this paper).
- Anything that writes from snippets (the-daily-index does this; our paper verifies against the article).
- Removing web search. It stays for verification and for what no feed covers.
- Kylo's model: a routine with no web access that writes only from the pool. It is the cheapest per run, but on kylo's own measurements it would have missed most of what this paper printed on 25 Sep.
- The Odds API, football-data.org and FotMob: need keys or break robots.txt, and ESPN plus Polymarket already cover what the paper prints.

## 6. What changes for the run
Today: snapshot, then about 12 sweep fetches, then open-ended search across every section. Proposed: snapshot plus the Wire (one call), OMDb/TMDB for Screen, ESPN for tennis, then targeted reads of the shortlisted articles and search only for gaps and second sources. The run already publishes in 13 to 19 minutes (08:30 UTC start; commits at 08:43 on 27 Sep and 08:49 on 26 Sep), so the main gains are fewer calls and tokens, a steadier set of sources, and national and money coverage checked in code. Run transcripts were not available to this audit, so tool-call counts before and after should be measured on the first week of Wire runs.

## 7. Suggested build order
1. R9 (DATA.md) and R4 (tennis): small, no new sources.
2. R1 Wire (with the Google News signal feeds) + R7 regulators + R5 cricket, with the national-cluster validator check. Test every feed from Vercel first. Run one edition with both the old sweeps and the Wire, and compare. Measure recall like kylo did: of the stories the edition printed, how many the Wire had.
3. R10's NSE MCP (movers cross-check, corporate actions), Sachet alerts, WhereIsCricket, ESPN internationals.
4. R3 Trends from attachments, R2 tiers (warn only).
5. R6 (OMDb and TMDB, once the keys exist) with JustWatch and Sacnilk. R8 last.
Then the design overhaul.
