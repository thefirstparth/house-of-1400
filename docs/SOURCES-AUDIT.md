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

## 2. Friend's repo: kyloprat/kylo-news
Not reachable. GitHub answers 404 to the page, the git clone and the API, and a web search finds nothing, so it is private or the name is different. To audit it: have kyloprat make it public or add you as a collaborator (then this session can attach it), or send the correct link.

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
A run-only `/api/live/wire` (like `movers`: called by the snapshot, never by the page) that reads about 45 vetted feeds from section 4 in parallel on Vercel and returns compact JSON: for each item the title, outlet, publisher URL, time and a snippet of 300 characters or less. Only items inside the news window (since the previous edition's cut). It dedupes, then **clusters the same story across outlets**. The feed list goes in `config/house.json` under `sources.feeds`, grouped by section, so it can change without code.
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

### Not recommended
- Netflix Top 10 TSV (31 MB for a weekly list; research does this fine).
- Reddit (needs OAuth; weak signal for this paper).
- Anything that writes from snippets (the-daily-index does this; our paper verifies against the article).
- Removing web search. It stays for verification and for what no feed covers.

## 6. What changes for the run
Today: snapshot, then about 12 sweep fetches, then open-ended search across every section. Proposed: snapshot plus the Wire (one call), OMDb/TMDB for Screen, ESPN for tennis, then targeted reads of the shortlisted articles and search only for gaps and second sources. The run already publishes in 13 to 19 minutes (08:30 UTC start; commits at 08:43 on 27 Sep and 08:49 on 26 Sep), so the main gains are fewer calls and tokens, a steadier set of sources, and national and money coverage checked in code. Run transcripts were not available to this audit, so tool-call counts before and after should be measured on the first week of Wire runs.

## 7. Suggested build order
1. R9 (DATA.md) and R4 (tennis): small, no new sources.
2. R1 Wire + R7 regulators + R5 cricket, with the national-cluster validator check. Test every feed from Vercel first. Run one edition with both the old sweeps and the Wire, and compare.
3. R3 Trends from attachments, R2 tiers (warn only).
4. R6 once the keys exist. R8 last.
Then the design overhaul.
