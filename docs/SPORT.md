# Sport (/sport)

The House of 1400's sports app: an installable web app for everything Parth follows (Real Madrid and the national
sides, F1 and Verstappen, India, Alcaraz and Djokovic, the Warriors). Built 10 Oct 2026; see docs/DECISIONS.md.

- `public/sport/index.html`, `app.css`, `app.js`: the app. Vanilla JS, no build step, no LLM. Routes are hashes: `#home`,
  `#football`, `#f1`, `#cricket`, `#tennis`, `#nba`, with a section after a slash (`#f1/standings`).
- Data: the paper's `/api/live/<key>` feeds plus `madrid_hub`, `f1_hub`, `intl_hub`, `tennis_hub` (lib/sportapp.js).
  Each feed's last copy is kept on the phone and shown, marked with its time, until a fresh one arrives.
- `/sport-sw.js`: the service worker (scope `/sport`): the app's files network-first, crests cache-first.
- Install: open house14.vercel.app/sport in Safari, Share, Add to Home Screen (Chrome on Android: Install app).
- Fonts: Barlow Condensed for figures (OFL, `fonts/`), the system font for text.
