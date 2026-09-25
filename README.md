# The House of 1400

Private afternoon newspaper for Parth. Static news written daily, live widgets refreshed in the browser. Built and run by Claude Code, hosted on Vercel.

Start with `CLAUDE.md`.

## Setup (about 10 minutes, once)

1. **GitHub.** Create a new **private** repo called `house-of-1400`. Leave it empty (no README). On the empty repo page, click "uploading an existing file", drag in everything from this folder (the files and the `config`, `content`, `design`, `docs`, `ledger` folders), and commit.
2. **Vercel.** Add New → Project → import `house-of-1400` → Deploy with the defaults. It will show a near-empty page for now. Copy the production URL.
3. **Vercel env vars.** Project → Settings → Environment Variables:
   - `SITE_PASSWORD`: the password you'll type to open the paper
   - `RUN_KEY`: any long random string (used by the daily runs)
4. **Claude Code.** Open claude.ai/code, start a session on `house-of-1400`, and add `RUN_KEY` (same value) to the session's environment variables if the settings allow it. Paste the build prompt below, with your Vercel URL filled in.

## Build prompt

```
Read CLAUDE.md, then every file it lists, in order. Build The House of 1400 as specified, matching design/reference.html. The Vercel project is already linked to this repo; the production URL is <PASTE URL>. SITE_PASSWORD and RUN_KEY are set in Vercel.

Work in the priority order in CLAUDE.md and push to main as you go so Vercel deploys. Test every live endpoint and fix what fails. When the site works, run docs/RUNBOOK.md once as a daily run to publish today's edition. Then create the four scheduled daily runs listed in the RUNBOOK.

I'm asleep until the afternoon. Don't wait for me: make reasonable calls, log them in docs/DECISIONS.md, and leave a short summary of what's done, what's pending and anything I need to do in docs/STATUS.md.
```

## Day to day
- Paper: your Vercel URL. Archive at `/archive`, a one-screen phone view at `/today`.
- Poster mode: the Poster button, or `/?poster=today|mast|night|heads|clock`.
- Mac screensaver: install [WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver) and point it at `<URL>/?poster=mast` (or `?poster=clock`). Log in once in Safari first so the cookie exists.
- Build status and what is pending: `docs/STATUS.md`.

## For developers
```
npm ci
node --test tests/*.test.mjs        # offline tests with recorded API payloads
npm test                            # hits every live source for real
npm run build && SITE_PASSWORD=x RUN_KEY=y DEV_MOCK=1 node scripts/dev.mjs 3000
```

## Later (optional)
- Telegram ping: create a bot with @BotFather, then add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Vercel.
- Better data: `OMDB_KEY`, `TMDB_KEY` (Screen & Stage), `CRICKETDATA_KEY`, `TWELVEDATA_KEY`.
- Mac screensaver: install WebViewScreenSaver (open source) and point it at `<URL>/?poster=mast`.
