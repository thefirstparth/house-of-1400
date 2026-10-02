# Sport, round 3 (mock, 3 Oct 2026). Nothing here is on the site.

Parth, 3 Oct, of rounds 1 and 2: "all three variants are not good ... the next circuit for the race, both the La Liga
tables and the Champions League tables, top scorers, assisters and player ratings, all of this is gone now ... I don't
want any data gone. I just want it to be less scrolling ... the images by the illustrator should still appear, the
logos of the teams should still exist ... some things can be collapsed and still easy to navigate."

So this round redraws nothing. `build.mjs` renders the real v2 Sport desk (the 2 Oct paper with its press-time live
figures), and `variants.js` moves the page's own nodes into each layout: every story and illustration, crest, table,
leader board, result, market bar and source note is the same element the page made. `index.html` is the baked
preview (fonts and illustrations inside it; crests load from ESPN as on the site).

- **A · The paper, then the scoreboard**: stories, Next up (the week and each team's next match), Tables and results
  (folded, each with a one-line gist; "Open every table").
- **B · Team rooms**: the lead with the week beside it, then a room per team: stories left, next match right, the rest
  in a drawer under it.
- **C · Two panes**: stories left; a pinned panel right with every figure, a tab per team, following the story in view;
  on a phone the panel is a sheet opened from each team's stories.

Height of the whole desk (MacBook Air window 1470x830 / phone 402x874): today 10.2 / 15.6 screens; A 6.4 / 11.0;
B 6.2 / 10.9; C 5.6 / 7.1. Folded tables count closed.

`npm run build && node design/sport-r3/build.mjs` rebuilds it.
