# The Fixture List, three ways (mock, 10 Oct 2026). Nothing here is on the site.

Parth, 10 Oct: "rethink a v2 or v3 design for this (The Fixture List) - to make it look cleaner, easier to read,
slightly more fun. Newspaper, yes, but slightly modern."

The list as it stood at 00:32 IST on 10 Oct (`data.js`), every field kept: time, sport, the fixture, round and place,
where to watch, the market with its source and time, the result. Three ways: 1 · listings, tidied (the desk's one
colour, each row in three steps, the market as one bar); 2 · ticket stubs (the sport's colour on the stub, the
favourite as a filled pill, a FINAL stamp); 3 · the day's line (a rail per day, big dates, a NOW marker, a dot per
sport, ticked once over). Laptop or phone width, day or night page.

`node design/fixtures-v3/build.mjs` bakes `index.html`.

Round 2, same day. Parth: "i hate 2, like 1, 3 looks okay but slightly complicated. Try building more around 1? Give 3
more variants." So 2 and 3 are gone and the page shows 1 beside three variations on it: 1a · quieter (the market as one
line of names and prices, no bar); 1b · sport colours and big dates (the two light touches from 3, without its rail);
1c · today up front (1a with today on a lighter panel with a NOW line, and finished fixtures cut to one line each).

Round 3, same day. Parth: "better visuals but not overboard. redo. (eg. f1 sprint qualifying results looks bland)".
Results are drawn the way each sport prints one: F1's top three with team colours, codes and gaps (OpenF1's timing),
a cricket scorecard with the winner marked, a tennis set board. Each market is a small ranked chart (name, bar,
price, the favourite in colour). The next fixture is counted down ("Next up · in 14 h"), finished ones carry a Final
tag, and the channel is a small tag. 3a · the desk's one colour; 3b · sport colours and big dates; 3c · 3b with today
on a lighter panel.
