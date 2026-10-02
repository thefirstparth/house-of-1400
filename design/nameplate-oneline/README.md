# The nameplate on one line (mock, 2 Oct 2026)

Parth, 2 Oct: "To make the header bigger and less white spacey, can you not write it like this? The House of 1400, the
way it is on the New York Times website. We'll be able to increase the font size for everything, especially 1400."

`index.html` (self-contained; rebuild with `node design/nameplate-oneline/build.mjs`) shows today's header and four
variants, each as the real header at a laptop's width (1440, scaled to fit) and a phone's (390), with today's dots:

- **A · Blackletter and dots**: "The House of" in blackletter, 1400 in dots, one line; 1400 about 130px on a laptop.
- **B · All blackletter, the NYT way**: the whole name in blackletter, the figures in blackletter printed in dots.
- **C · Small capitals and big dots**: "The", spaced "HOUSE OF", and 1400 at about 150px.
- **D · One line with ears**: A, with the run line folded into ears (date and edition left, weather and Sensex right).

Header heights (laptop / phone): today 232 / 222; A 233 / 145; B 279 / 158; C 242 / 164; D 212 / 130.
