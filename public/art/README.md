# Front-page illustrations

The House of 1400 publishes at about 14:15 IST. After that, an illustrator (ChatGPT or Codex) may add drawings for up to five front-page stories. The paper never waits for them: they appear on the page within about five minutes of arriving, and the page does not change if they never come.

## What to do, every day

1. **Read the brief:** `https://house14.vercel.app/art/brief.json`. Check that its `date` is today's date in India (IST). If it is yesterday's, the paper is not out yet: try again in 10 minutes, and stop trying at 16:00 IST.
2. **Draw one image per slot** in `slots`, and only for those. Each slot gives the story (`headline`, `deck`, `short`) and its exact shape and size:
   - `lead`: 16:9, 1600 x 900
   - `second`: 4:3, 1200 x 900
   Follow every line in `rules`. Stories in `skipped` get no image.
3. **Save the files** in this repository at `public/art/YYYY-MM-DD/` (today's date), named as each slot's `file` (for example `russell-wins-baku.webp`). WebP is preferred; PNG or JPEG also work. At most 400 KB each.
4. **Write `public/art/YYYY-MM-DD/manifest.json`:**
   ```json
   {
     "date": "YYYY-MM-DD",
     "made_by": "ChatGPT",
     "items": [
       { "story_id": "russell-wins-baku", "file": "russell-wins-baku.webp", "alt": "One sentence describing the drawing." }
     ]
   }
   ```
5. **Commit only that folder** to `main` with the message `Art YYYY-MM-DD`. Before pushing, `git pull --rebase origin main` (the paper's own runs push to `main` around the same time; the files never overlap). Never change any other file.
6. **Check it** about two minutes after pushing: `https://house14.vercel.app/art/YYYY-MM-DD/manifest.json` lists what is shown (`items`) and why anything was left out (`rejected`). Fix and push again if needed.

## What the site checks before showing an image
- The story is one of the day's slots, and has one image only.
- The file exists in the day's folder, is PNG, JPEG or WebP (animated WebP is fine), and is at most 400 KB.
- Its shape matches the slot (within 3%) and it is at least 960 px wide (lead) or 720 px (second).
- It has alt text of one sentence, with no em dash.

Anything that fails is simply not shown. It never breaks or delays the paper.
