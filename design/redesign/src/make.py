# Build the redesign prototype (scratch only): rd/app.js, rd/styles.css, rd/house.json from the live sources.
import json, re
R = "/tmp/claude-0/qa/rd/"
H = "/home/user/house-of-1400/"

# ---------------------------------------------------------------- config
C = json.load(open(H + "config/house.json"))
DESKS = [
  ("front", "Front Page", "ink", ["week"], False),
  ("news", "News", "dispatch", ["india", "world", "namma"], True),
  ("money", "Money", "money", ["ticker", "wallet", "floor"], True),
  ("sport", "Sport", "track", ["fixtures", "madrid", "paddock", "crease", "deuce", "pitch", "sidelines"], True),
  ("tech", "Tech & AI", "tech", ["lab", "workshop", "pipeline"], True),
  ("life", "Life", "screen", ["screen", "sky", "talk", "betting", "bye"], True),
]
NEW = {
  "india": ("Desh", "Desh"), "world": ("Dateline", "Dateline"), "lab": ("The Lab", "The Lab"),
  "ticker": ("The Ticker", "The Ticker"), "wallet": ("The Wallet", "The Wallet"), "floor": ("The Floor", "The Floor"),
}
secs = [s for s in C["sections"] if s["id"] not in ("dateline", "ledger")]
for i, s in enumerate(C["sections"]):
    pass
for sid, (name, short) in NEW.items():
    secs.append({"id": sid, "name": name, "short": short, "accent": "--ink", "palette": "ink"})
deskpal = {}
for did, dname, pal, ids, head in DESKS:
    for x in ids: deskpal[x] = pal
deskpal["tables"] = "track"
for s in secs:
    if s["id"] in deskpal: s["palette"] = deskpal[s["id"]]; s["accent"] = "--" + deskpal[s["id"]]
C["sections"] = secs
SHORT = {"front": "Front", "tech": "Tech"}
C["desks"] = [{"id": d, "name": n, "short": SHORT.get(d, n), "palette": p, "sections": ids, **({} if h else {"heading": False})} for d, n, p, ids, h in DESKS]
json.dump(C, open(R + "house.json", "w"), ensure_ascii=False)

# ---------------------------------------------------------------- app.js
js = open(H + "public/app.js").read()
def rep(a, b, count=1):
    global js
    assert a in js, "missing: " + a[:90]
    js = js.replace(a, b, count)

PROTO = open(R + "proto.js").read()
rep("function render() {", PROTO + "\nfunction render() {")
rep("  try { E = await ed; }", "  try { E = remapEdition(await ed); }")
# section builders: the split sections replace Dateline and The Ledger
rep('  S.dateline = secWrap("dateline", storiesBlock("dateline"), "World & India");\n', PROTO_BUILD := '''  S.india = secWrap("india", storiesBlock("india"), "India · politics, the economy, the country");
  S.world = secWrap("world", storiesBlock("world"), "The world, as it touches India");
  S.lab = secWrap("lab", storiesBlock("lab"), "AI · the models, the labs and the money");
''')
rep('  S.workshop = secWrap("workshop", storiesBlock("workshop"), "Tech · AI · wearables");', '  S.workshop = secWrap("workshop", storiesBlock("workshop"), "Tech · gadgets, software, the business");')
rep('''  S.ledger = secWrap("ledger", `<div data-live="ledger">${ledgerBlock()}</div><div data-live="ledgerx">${ledgerExtras()}</div>` + storiesBlock("ledger"), "Markets · money · cards");''',
'''  S.ticker = secWrap("ticker", `<div data-live="ticker">${tickerBlock()}</div>` + storiesBlock("ticker"), "Markets · India, the US and Asia");
  S.wallet = secWrap("wallet", `<div data-live="wallet">${walletBlock()}</div>` + storiesBlock("wallet"), "Your money · gold, the rupee, oil, crypto, rules");
  S.floor = secWrap("floor", `<div data-live="floor">${ledgerExtras()}</div>` + storiesBlock("floor"), "Who bought, who sold, what moved");''')
rep("ledgerx: ledgerExtras,", "floor: ledgerExtras, ticker: tickerBlock, wallet: walletBlock,")
rep("paddock: paddockBlock, ledger: ledgerBlock,", "paddock: paddockBlock,")
# desks: an opener in place of the plain heading
rep('''    h += `<div class="dgroup" id="dg-${esc(d.id)}" data-desk="${esc(d.name)}">${d.heading === false ? "" : `<h2 class="deskhead"><span>${esc(d.name)}</span></h2>`}${inner}</div>`;''',
'''    h += `<div class="dgroup" id="dg-${esc(d.id)}" data-desk="${esc(d.name)}" data-fam="${esc(d.palette || "ink")}">${d.heading === false ? "" : deskFront(d, S)}${inner}</div>`;''')
# the index becomes the desk bar
rep('''    let lastDesk = null;
    $("#idx div").innerHTML = present.map(x => {''', '''    $("#idx").innerHTML = deskBar(present); observeDesks();
    let lastDesk = null;
    if (0) $("#idx div").innerHTML = present.map(x => {''')
rep("    observeIndex(present);", "    ")
rep("  paintSignals();\n  if (!$(\"#poster\")", "  paintDeskFronts();\n  paintSignals();\n  if (!$(\"#poster\")")
open(R + "app.js", "w").write(js)

css = open(H + "public/styles.css").read() + "\n" + open(R + "proto.css").read()
open(R + "styles.css", "w").write(css)
print("ok", len(js), len(css))
