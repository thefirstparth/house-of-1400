export function loginPage({ next = "/", error = false } = {}) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>The House of 1400</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Instrument+Sans:wght@500;600;700&family=Bodoni+Moda:opsz,wght@6..96,500&family=Source+Serif+4:ital@1&display=swap">
<style>
:root{--paper:#ebe6da;--ink:#191816;--muted:#4f4a41;--rule:#b3aa98;--bad:#9b2a22;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--paper:#1c1a17;--ink:#ece6d8;--muted:#a79f8f;--rule:#4a453c;--bad:#e8867c;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--paper);color:var(--ink);padding:16px;font-family:"Instrument Sans",Arial,sans-serif}
main{width:min(360px,100%);text-align:center}
h1{margin:0 0 18px;display:grid;justify-items:center;gap:2px;line-height:1;border-bottom:5px double var(--ink);padding-bottom:14px}
.the{font:400 30px/1 "UnifrakturMaguntia",serif}.hof{font:600 13px/1 "Instrument Sans",sans-serif;letter-spacing:.62em;text-transform:uppercase;margin-right:-.62em}
.yr{font:500 88px/.9 "Bodoni Moda",Didot,serif}
p{font:italic 15px "Source Serif 4",Georgia,serif;color:var(--muted);margin:0 0 16px}
input{width:100%;font:500 17px "Instrument Sans",sans-serif;padding:12px 14px;border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:0}
button{margin-top:10px;width:100%;padding:12px;border:0;background:var(--ink);color:var(--paper);font:700 12px "Instrument Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
.err{color:var(--bad);font:600 14px "Instrument Sans",sans-serif;margin-top:10px}
</style></head><body><main>
<h1 aria-label="The House of 1400"><span class="the">The</span><span class="hof">House of</span><span class="yr">1400</span></h1>
<p>An afternoon newspaper for one reader</p>
<form method="post" action="/api/login"><input type="hidden" name="next" value="${esc(next)}">
<label for="pw" style="position:absolute;left:-9999px">Password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" placeholder="Password" required autofocus>
<button type="submit">Open the paper</button></form>
${error ? `<div class="err" role="alert">That is not the password.</div>` : ""}
</main></body></html>`;
}
