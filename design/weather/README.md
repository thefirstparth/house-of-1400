# Sky & Streets, redesigned from scratch (mock, 1 Oct 2026)

Parth, 1 Oct: "too much data, too little visualisation". What matters: how the weather is trending over the weeks and
the month ahead, anything worth knowing, the chance of rain today and this week; for Ranchi and Prayagraj, insights
(feels like, rain, trend) rather than tables.

`variants.html` shows three ways to do it, all built from the same real forecasts of Thu 1 Oct, 02:15 IST
(`data-2026-10-01.json`). Every sentence in it is written by rules from the numbers (`src.html`), not by hand.

- **A · The forecast story:** a headline ("Two dry days, then a wet week"), one chart of the fortnight (chance of a
  rainy day as bars, the daytime high above), today by the hour, October against a usual October. Family: a headline,
  a line, a mini fortnight and three figures each.
- **B · The calendar:** five weeks on a wall calendar shaded by rain; the next two weeks day by day, weeks 3 to 5 as
  striped rows that only say which way they lean; notes in the margin. Family: a two-week strip and a line each.
- **C · Three horizons:** Today, This week, The month side by side, one answer and one chart each. Family: one row each.

Data behind them (all free, no key):
- Today and the week: the forecast the paper already reads (Open-Meteo), hourly for today.
- Next 13 days: ECMWF's 51-run ensemble (Open-Meteo ensemble API); "chance of a rainy day" is the share of runs with
  2.5 mm or more, IMD's definition of a rainy day.
- Weeks 3 to 5: NOAA's GFS ensemble (35 days), weekly totals; low skill, shown as a lean only.
- The month: ECMWF's seasonal forecast (SEAS5, 51 runs) against 30-year averages. The mock uses NASA POWER's monthly
  rainfall normals because Open-Meteo's archive was rate-limited from the build machine that day; production would
  compute 1991 to 2020 normals once from ERA5 (Open-Meteo archive) and keep them in a data file.

Rebuild: `node design/weather/build.mjs` (bakes the data file into `variants.html`).
