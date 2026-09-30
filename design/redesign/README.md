# Redesign mock (paused 30 Sep 2026, work in progress)

Agreed with Parth (30 Sep): split Dateline into India (Desh) and World (Dateline), The Ledger into The Ticker, The Wallet and The Floor, and AI out of The Workshop into The Lab; desk colours (Front ink, News navy, Money green, Sport burnt orange, Tech & AI teal, Life magenta); desk openers (Bhide's lede plus one live line per section); a static mock before any production change.

- `redesign-draft.html`: the draft mock, one self-contained file (29 Sep edition, live figures from 30 Sep). Your Desk is left out on purpose.
- `src/`: the prototype. `make.py` patches a copy of `public/app.js` and `public/styles.css` with `proto.js` and `proto.css` (scratch paths under /tmp/claude-0/qa/rd/); `shot.mjs` serves it to Playwright over the dev server; `freeze.mjs` writes the static file; `check.mjs` tests it.

Still to do before showing it: the phone view scrolls sideways by 31px because of The Ticker's board (the same latent issue exists on the live site on wide market days; `.board-wrap>*{min-width:0}` alone did not fix it); a News desk render from 26 Sep (it has World stories); final screenshots.
