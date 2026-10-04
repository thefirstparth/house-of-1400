# Handover: The House of 1400 (written 1 Oct 2026)

For a new Claude session or account picking this project up cold. Read this file first, then the files it points to.
It covers the project, how Parth works, how the paper runs every day, the state as of 1 Oct 2026, and the
**redesign brief** (section 7), which is the next piece of work.

---

## 1. What this is

A private afternoon newspaper for one reader, Parth, at https://house14.vercel.app (no password, `noindex`, the repo is
private). The news is written once a day at 14:00 IST by a scheduled Claude run acting as the editor, the fictional
**T. A. Bhide**. Live widgets (markets, weather, fixtures, F1, cricket, tables, betting odds) refresh in the browser.
Illustrations are drawn by "Bunty Brushwala", which is Codex, running outside this repo's sessions.

Parth reads mostly on a Nothing Phone 3 in Chrome, sometimes on a MacBook, sometimes on a large external monitor.

## 2. How Parth works (read this twice)

- **Standards:** nothing breaks; careful QA (before and after, phone and laptop, light and dark); no hard-coding
  (config- or data-driven); professional newspaper look; evidence-based decisions; "always clean, neat and
  professional"; no cramped or cluttered layouts and no unexplained white space.
- **He finds misses himself and is angry when he does.** The paper exists so he does not have to check the news
  elsewhere. A missed big story is the worst failure. Every miss becomes a lesson in `ledger/lessons.json` and a
  systemic fix, never a one-off patch alone.
- **QA before you say done.** Look at your own screenshots properly. On 1 Oct a story was shipped jammed against the
  Next Races boxes although the screenshot showed it. Use `scripts/qa/shoot.mjs` (section 6), which also reports
  overlapping text.
- **Decisions:** recommend one option with the reason; do not hand him an open survey. Ask only when it is genuinely
  his call. Log every behaviour change in `docs/DECISIONS.md` (dated, with his words where useful). Do not reopen a
  logged decision without him.
- **Answers:** short, plain, specific, no em dashes, no jargon. He reads replies on his phone.

## 3. Read these, in this order

1. `CLAUDE.md`: the two kinds of session (build vs daily run) and the hard rules.
2. `docs/SPEC.md`: what the site is, sections, features, the edition schema in brief.
3. `docs/EDITORIAL.md`: how the editor chooses and writes (sweeps, the wire check, the desk check, art orders, the
   editor's note, the day in a minute, each section's brief).
4. `docs/DATA.md`: live sources, fallbacks.
5. `docs/RUNBOOK.md`: the exact daily 14:00 run.
6. `docs/DECISIONS.md`: why things are the way they are (long; search it).
7. `docs/ROADMAP.md`: agreed-for-later items.
8. `design/page-one/README.md`: the approved Page One (FINAL section).
9. `config/house.json`: every changeable fact (teams, players, tickers, cities, sources, desks, big days).

## 4. How it is built

| Path | What |
|---|---|
| `public/app.js` | The whole page renderer (one file, ~2,200 lines). Reads `content/latest.json` (via the build) and `/api/live/*`. Section functions: `storiesBlock`, `storyHTML`, `paddockBlock`, `madridBlock`, `skyBlock`, `ledgerBlock`, `fixturesBlock`, `creaseLive`, `bettingBlock` and so on. `LIVE_KEYS` lists the live feeds. `balanceFront` and `balanceStories` keep columns even. |
| `public/styles.css` | All styles (~1,200 lines). Dark mode via `prefers-color-scheme` plus `[data-theme]`. |
| `scripts/build.mjs` | Builds `dist/` (copies public, the edition, config minus private keys, art manifests, editor stats). |
| `api/live/[key].js` | One Vercel function serving every live getter (`lib/live.js`, `lib/football.js`, `lib/cricket.js`, `lib/crease-live.js`, `lib/money.js`, `lib/trial.js`), each returning `{ok, value, source, as_of, stale}`. |
| `content/editions/YYYY-MM-DD.json`, `content/latest.json` | The editions. Schema `content/schema.json` (strict, `additionalProperties: false`). |
| `scripts/validate.mjs` | The publish gate: schema, sources, chronology, banned words, sweeps, wire and desk checks, fixtures, art orders. |
| `scripts/publish.mjs` | Validates, stamps `printed_at`, writes latest and archive, updates the story ledger. |
| `scripts/prep.mjs` | The run's morning prep in one step (week in brief, letters, cricket times, betting candidates, snapshot). |
| `scripts/wire-check.mjs` | Lists widely covered stories, followed-name stories, desk stories, paywalled leads, and every outlet's top five (the desk check). |
| `lib/art.js`, `public/art/` | Illustration orders and the checked manifest. `public/art/` belongs to the illustrator: never write there. |
| `ledger/` | Story ledger, lessons, money calendar, letters, editor log, wire check output. |
| `design/` | Mock-ups only, never production: `reference.html` (original), `system/specimen.html` (type and colour), `weather/`, `page-one/` (the approved Page One). |
| `tests/` | `node --test tests/*.test.mjs` (64 passing on 1 Oct). Fixtures include the full 1 Oct reading list. |

Dev: `node scripts/build.mjs`, then `PORT=3000 node scripts/dev.mjs`. Deploy: push to `main` (Vercel). Build sessions
work on their own branch and push both the branch and `main` (`git fetch origin main && git merge origin/main`
first; the daily run and the illustrator also push to `main`).

## 5. How the paper runs every day

- **Routines** (claude.ai routines, IST): 14:00 main run (Opus) into the standing session
  "House of 1400 · scheduled desk (Opus: 14:00 edition)"; retries at 14:29, 14:58 and 15:27 and the 16:00 poster run
  (Sonnet) into "House of 1400 · scheduled desk (Sonnet: retries and posters)". Do not archive those sessions.
  Each run follows `docs/RUNBOOK.md`; a run that finds today's edition already live stops at once.
- **Daily runs write only** `content/editions/`, `content/latest.json`, `content/archive.json` and `ledger/`. They never
  touch code, styles, config or docs. Build sessions (like the redesign) may change code, styles, config and docs.
- **The editor's checks** (all enforced by the validator): national front-page sweep; money sweep; market movers;
  lessons owed; the wire check (widely covered stories; stories naming anyone Parth follows; a sports desk's own story;
  paywalled leads with an open outlet); **the desk check** (from 2 Oct: every outlet's top five, read and answered by
  event, `checks.top`); fixtures (every India cricket, Real Madrid and F1 qualifying/race match in the next seven
  days); art orders (lead always; 0 to 2 per desk; 2 to 8 in all); the editor's note only on a big day
  (`config paper.editor.big_days`); the day in a minute 5 to 10 lines.
- **Illustrations:** Bhide orders in `art_orders`; `/art/brief.json` is what Bunty (Codex) reads; Codex pushes images
  and a manifest to `public/art/YYYY-MM-DD/`; the page shows them lazily, 16:9 for the lead and 4:3 elsewhere.
- **Source trial:** stopped on 1 Oct. Do not run `scripts/trial.mjs`.

## 6. QA protocol (use it for every visible change)

```
node scripts/qa/freeze.mjs              # freeze today's live data from production into qa-data/
node scripts/build.mjs && PORT=3000 node scripts/dev.mjs &
node scripts/qa/shoot.mjs before        # before your change
# ... change ...
node scripts/build.mjs && node scripts/qa/shoot.mjs after
```
`qa-shots/<tag>/` holds every section at 1300 and 390 px, light and dark, plus `report.json` (page errors, sideways
scroll, sections drawn, overlapping text). Look at the images, not only the report. Also check a big monitor
(1920x1080 and 2560x1440) for layout changes, and after deploy check production. The local 390 px view may show a
31 px sideways overflow from font loading that production does not have.

## 7. The redesign brief (next piece of work)

**Scope: presentation only.** Change how the paper looks and is navigated: `public/app.js` rendering, `public/styles.css`,
fonts, colours, navigation, layout, and `scripts/build.mjs` only if a new page route needs it. **Do not change** the
edition schema, the validator, the live API and getters, the daily-run scripts, the routines, the editorial rules or
the illustrator brief, unless Parth explicitly agrees to a specific change. The daily run must keep producing exactly
the same edition JSON; the redesign renders it differently.

### 7.1 Agreed (1 Oct, with Parth)

- **Rated today's design 6 to 7 out of 10. Start the visual design from scratch, but keep what works** (the
  masthead's blackletter "The" and Playfair "1400", the warm paper, Source Serif for reading, double rules).
  Must last through 2026, 2027 and beyond. Not copied from kylo-news.vercel.app; simpler navigation than Kylo's.
- **Type:** Newsreader for headlines, Source Serif 4 for body text, Libre Franklin for labels and figures; keep
  UnifrakturMaguntia "The" and Playfair Display "1400" in the nameplate. Self-host the fonts so the nameplate can
  never fall back to a plain serif. Caution: on 25 Sep Parth found Newsreader hard to read at the sizes then used
  (`DECISIONS.md`); he agreed to it on 1 Oct from the specimen (`design/system/specimen.html`). Show him real pages
  early and be ready to swap the headline face.
- **Colour:** six desk colours instead of fourteen section colours, carried by a rule and the section name, never by
  filled rounded bands. Radii from 26 px to 4 px. Tokens (light / dark):
  Page One ink `#15140f` / `#eeeae0`; News navy `#1f3f73` / `#a5bfeb`; Close to Home sky `#0a72a8` / `#7ccbf2`;
  Sport burnt orange `#b8460e` / `#f29a62`; Tech & AI violet `#6a3fb5` / `#bba4f2`; Money green `#0b7a43` / `#5fd9a0`;
  Off Duty gold `#a87a00` / `#e7c35a`. Validated for colour-blind readers when always paired with the desk name.
- **Desks and order** (from the Page One mock; Parth did not object, confirm names once more before building):
  Page One · News (Desh = India, Videsh = the world, Talk of the Day, The Betting Window) · Close to Home (Namma Beat =
  Bengaluru, Back Home = Ranchi and Prayagraj, Sky & Streets) · Sport (Madridismo, Paddock Notes, The Crease, Deuce,
  The Wider Pitch, The Sidelines; the Fixture List first, Parth 1 Oct) · Tech & AI (AI, Tech, Sales & SaaS: Parth's
  names, 1 Oct, in place of The Lab, The Stack, The Funnel) · Money (The Ledger, one section) · Off Duty (Screen & Stage; Before You Go retired 3 Oct; from 4 Oct: In Cinemas, Streaming Top 10, Coming Up, Bengaluru Stage, lib/offduty.js).
  Your Desk, Letters, the editor's page, Archive and the House Note move to the footer area.
- **Page One is variant B** (`design/page-one/page-one-variants.html?v=B`; spec in `design/page-one/README.md`, FINAL):
  run line; nameplate with the desk strip as navigation; three columns: the day in a minute (lead headline, no deck,
  the editor's note under it on big days only, then the editor's glance lines, the evening "Must watch" pick when
  there is one) | weather (sun arc by day, moon arc in its phase by night) then Sport this week (with where to watch)
  | Money (Sensex, S&P 500, Brent, Gold 24K with 1D; India and US fear readings) then The market expects (top 3); the
  House Note on its own line; a foot line of links. **One screen on any laptop or monitor:** show as many glance lines
  as fit (never fewer than five with the lead), then scale the page to fill the height within the width (0.85 to 2).
  Phones scroll normally. No illustrations on Page One. No duplicated money block.
- **Navigation:** one row of desk tabs under the masthead, pinned while scrolling; on desk pages the masthead shrinks
  to one line; each desk ends with "Next: <desk> →"; no second row of section chips. On a desk page all its sections
  follow one after another (the section index is only a jump list); no clicking into each section.
- **Illustrations stay as they are** (two shapes, Bunty's process unchanged). With desk pages each page loads only its
  own images. No art on Page One; the lead's 16:9 drawing moves to the top of the News desk (or wherever the lead's
  desk is).
- **Already agreed in passing:** the weather section (Sky & Streets) design approved on 1 Oct and live; the
  F1 Paddock layout, the Crease, the Madrid tables and the fixture list all fixed on 1 Oct: keep their structure.

### 7.2 Things that are not purely presentation (ask Parth before doing them)

- **Back Home (Ranchi and Prayagraj news)** needs new content: a new section in the schema, sources (Prabhat Khabar,
  Dainik Jagran, Amar Ujala, TOI city pages) and an editorial brief. Build the slot so it hides when empty; get his
  go-ahead for the content change separately.
- **Done (1 Oct, live from the 2 Oct edition):** Bhide files Desh and Videsh in place of Dateline, and AI, Tech and
  Sales & SaaS in place of The Workshop and The Pipeline (schema, validator, config, the live page, EDITORIAL.md;
  DECISIONS.md). The old sections stay valid and readable for editions up to 1 Oct.
- **Talk of the Day and The Betting Window move from Life to News**; **Before You Go and Screen & Stage become Off
  Duty**: these are presentation only (re-grouping), fine to do.
- `config.desks` holds today's grouping; the redesign changes its membership and names (config change, allowed in a
  build session, log it).

### 7.2a Feedback on work so far

Read `docs/REDESIGN-FEEDBACK.md` before continuing: Parth's reviews of each mock, newest first.

### 7.3 Suggested order of work

1. Done (1 Oct): Sport and News desk mocks, then the full sample (design/sample) with Parth's 24 notes.
2. Done (1 Oct): built behind `?v2` on the live site, v1 unchanged (v2/README.md). Next: Parth reads v2 for a few
   days and says when to switch.
3. Implement: fonts (self-hosted) and tokens; nameplate and tabs; Page One B; desk pages; footer; then retire the old
   section colours. Keep every live widget's behaviour (stale "as of" times, fallbacks, refresh intervals).
4. QA (section 6) on phone, laptop and big monitor, light and dark, before and after; check the illustrations land
   cleanly in every slot (a drawn story takes the whole row with the drawing beside the text, see `balanceStories`).
5. Switch over, verify production, log in `DECISIONS.md`, update `SPEC.md`.

## 8. State on 1 Oct 2026 (end of the build session)

- Fixed today: weather headline leads with the current month; the day in a minute 5 to 10 editor lines; flows "so
  far" wording; Fixture List one row of day columns; art layout (solo stories, even rows); Paddock layout; editor's
  note big-day rule; the wire check (different wording; followed names; desk stories; leads); the desk check; the
  fixtures completeness check; illustrations rule (lead + 0 to 2 per desk).
- Added to the 1 Oct paper by hand: Ronaldo leaving Portugal's camp, Ocon leaving Haas (with art orders), India's 3rd
  ODI in the Fixture List.
- Owed: the Ronaldo follow-up (until 3 Oct, `ledger/lessons.json`).
- Open: whether the 3rd ODI fixture should show a streaming partner (JioHotstar) once two sources confirm it; Bunty
  needs a pass to draw the Ronaldo and Ocon orders; Parth declined resetting the standing run sessions (keep them).
- Not to do without asking: HANDOVER-style docs for others, routine model changes, an SBN contracts tracker, Srishti's
  view (ROADMAP).
