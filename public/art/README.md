# Illustrations for The House of 1400

The paper publishes at about 14:15 IST. While writing it, the editor (Bhide) orders art for 0 to 4 stories. You, the illustrator, read those stories and their original sources and decide the idea and the style yourself: a cartoon, a caricature, a spot illustration, animated or still, whatever serves the story best. The paper never waits for you: your images appear on the page within about five minutes of arriving, and nothing changes if they never come.

## Every day

1. **Read the brief:** `https://house14.vercel.app/art/brief.json`. Check that its `date` is today's date in India (IST). If it is yesterday's, the paper is not out yet: try again in 10 minutes, and stop at 16:00 IST. If `orders` is empty, there is no art today.
2. **For each order,** read the story (`headline`, `deck`, `short`, `more`) and open its `sources` for the full story. Then design the image. Stay inside the `limits`:
   - The drawing must be true to what happened.
   - Never photo-realistic images of real people; cartoon and caricature are fine.
   - No art for death, disaster or violence (those orders never reach you).
3. **Make each image in its order's `shape` and `size`:** `16:9` (1600 x 900) for the front-page lead, `4:3` (1200 x 900) for every other story. WebP preferred (animated WebP is fine), PNG or JPEG also work, at most 400 KB each.
4. **Save the files** in this repository at `public/art/YYYY-MM-DD/`, named as each order's `file` (for example `russell-wins-baku.webp`).
5. **Write `public/art/YYYY-MM-DD/manifest.json`:**
   ```json
   {
     "date": "YYYY-MM-DD",
     "made_by": "Codex",
     "items": [
       { "story_id": "russell-wins-baku", "file": "russell-wins-baku.webp", "alt": "One sentence describing the drawing." }
     ]
   }
   ```
6. **Commit only that folder** to `main` with the message `Art YYYY-MM-DD`. Before pushing, `git pull --rebase origin main` (the paper's own runs push to `main` around the same time; the files never overlap). Never change any other file.
7. **Check it** about two minutes after pushing: `https://house14.vercel.app/art/YYYY-MM-DD/manifest.json` lists what is shown (`items`) and why anything was left out (`rejected`). Fix and push again if needed.

## What the site checks before showing an image
- It is for a story Bhide ordered today, one image per story.
- The file is in the day's folder, PNG, JPEG or WebP, at most 400 KB.
- Its shape matches the order (within 3%), at least 960 px wide for 16:9 and 720 px for 4:3.
- It has alt text of one sentence, with no em dash.

Anything that fails is simply not shown. It never breaks or delays the paper.
