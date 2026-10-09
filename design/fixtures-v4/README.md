# The Fixture List, from scratch (mock, 10 Oct 2026). Nothing here is on the site.

Parth, 10 Oct, after three rounds in design/fixtures-v3: "do this properly, 3 variants. from scratch."

Three ways, each from a different idea, with the list as it stood at 00:32 IST on Sat 10 Oct (`data.js`). Every field
kept. Crests and flags are ESPN's (the logo service the site already uses for Madrid's crests), drivers' photos and team
colours OpenF1's. Times, scores and prices are set in one scoreboard face, Barlow Condensed (OFL, `fonts/`). Each way
also shows made-up rows, marked as such, for a live match, one called off and one with no time yet.

1 · Broadsheet: a quality paper's listings, led by type; one typeset line for the market or the result; F1 results
as a small timing screen. 2 · Scoreboard: two sides facing each other, crest over name, time or score large between
them, the market as one bar under the pair; F1 drivers as photos in team-colour rings. 3 · Front page: overnight
results as scoreboard tiles (F1 as a podium), the next fixture as the lead, the rest of the week as one table.

`node design/fixtures-v4/build.mjs` bakes `index.html` (images load from ESPN and F1, as on the site).
