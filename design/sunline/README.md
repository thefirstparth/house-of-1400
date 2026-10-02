# The day line, three ways (mock, 2 Oct 2026)

Parth: "I liked the earlier full arc, but space is limited, so make it more beautiful and attention-grabbing. Mockups
first." Three ways to draw the day in Page One's Weather block, each inside the block as it stands:

- **A · The window**: a strip of the day's own sky (rose at dawn, amber at the golden hour, pale at noon) with the
  sun's real path over it; by night, night sky with stars and the moon's path while it is up.
- **B · The ribbon**: midnight to midnight as one band in the sky's colours, a needle for now, the moon's hours as a
  fine line above.
- **C · The halftone**: the sun's path in the nameplate's own dots, growing as it climbs; the sun a swelling disc of
  dots; by night the moon in its phase, in dots.

The sun and the moon are computed for Bengaluru (the moon from the low-precision lunar theory SunCalc uses), so the
moon is drawn only while it is up, and the line says when it rises. The readings are the 2 Oct paper's.

`node design/sunline/build.mjs` bakes `index.html` (self-contained). Nothing here is production code.
