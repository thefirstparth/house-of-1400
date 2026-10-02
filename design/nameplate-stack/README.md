# The nameplate on two lines (mock, 3 Oct 2026). Nothing here is on the site.

Parth: "How about we do it like this? The house in two lines and the animated text on the right. Think well so that we do not have to make this change every time."

A: the stack set right; B: the stack with a column rule; C: all in blackletter. The two lines are set to the box of 1400 (the top of its figures and its baseline), and every tapped shape starts where 1400 starts on that baseline inside that box (v2/wordmark.js textDots), so the words never depend on the shape. `node design/nameplate-stack/build.mjs` bakes `index.html`.
