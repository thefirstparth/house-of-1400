# Sport, redesigned (mock, 2 Oct 2026). Nothing here is on the site.

Parth, 2 Oct: "in an ideal world, sports news versus sports data should be two separate sections. How would it make
sense if I'm looking at sports news about Madrid without knowing what their next match is and where they are in the
table?" He reads Sport for what's on next and the stories; he looks at the last race's full result and Sidelines;
the constructors' table and full league tables can fold away; anything may change.

**Today's desk, measured** (2 Oct edition, MacBook Air window 1470x830): 7,100px tall, 8.6 screens; news (stories,
briefs, lines) 26% of the height, data 74%. On a phone (402x760): 15.7 screens, news 23%. Every section opens with its
data (schedules, tables, bars) and the stories sit between them. Over the last eight editions Sport carried 4 to 8
stories and 2 to 5 briefs a day against some 15 standing data blocks.

`index.html` (self-contained; `node design/sport-redesign/build.mjs`) draws three concepts from the real 2 Oct paper and
its press-time live figures, at a laptop's width and a phone's, light and night:

- **A · The back page** (3.1 screens on the Air, news 58% of what shows): one stream of stories across every sport,
  best first; each story carries a context bar (where the team stands, what is next); a rail of team cards (next,
  last, standing, forecast) beside it, each opening the full data in a drawer; the week across the top.
- **B · Stories and Scoreboard** (2.6 screens, news 88%; Scoreboard 2.1 screens): two views of one desk. Stories is
  the news alone with an "up next" strip and the same context bars; Scoreboard is every team's data in panels of one
  shape, as an almanac.
- **C · Team rooms** (3.9 screens, news 79%): after the week strip and the lead, a room per team ordered by whose
  next match is soonest: four tiles (next, last, standing, forecast), then its stories; tables and results in the
  room's own tabs, closed until opened; a team with no news is just its tiles.

## Round 2: B, cleaner (Parth, 2 Oct: "pick B, but make the scoreboard look cleaner ... why are tennis, internationals
## and the Warriors under India cricket? ... Madridismo news was scattered all across the page")

The mock opens on B. **Stories**: the lead across the page, then the news team by team (all of Madrid's together),
each team's standing and next match said once in its group's head rather than under every story; the groups flow in two
columns on a laptop, one on a phone. **Scoreboard**: one card per team in a grid (three across on a laptop, two on a
narrower screen, one on a phone), every card the same shape: the team and its standing in one line, then Next, the
table or standings, Last; long lists (all drivers and the constructors, the full race result, every knockout) folded
inside their own card. Laptop: Stories 2.6 screens, news 90%; Scoreboard 1.6 screens.
