# python v2/glyphs.py <dir>: print the outline of Playfair Display Black's lining "1400" (ems, baseline 0) for
# v2/wordmark.js (PATH, ADV). Needs fonttools, brotli and uharfbuzz (pip). Run once; the outline is pasted in.
import sys, json, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
src = "/home/user/house-of-1400/v2/fonts/playfair-display-latin-wght-normal.woff2"
f = TTFont(src); f.flavor = None
inst = instancer.instantiateVariableFont(f, {"wght": 900})
inst.save(sys.argv[1] + "/pf900.ttf")
blob = hb.Blob.from_file_path(sys.argv[1] + "/pf900.ttf"); face = hb.Face(blob); font = hb.Font(face)
buf = hb.Buffer(); buf.add_str("1400"); buf.guess_segment_properties()
hb.shape(font, buf, {"lnum": True, "kern": True})
upm = inst["head"].unitsPerEm; gs = inst.getGlyphSet(); order = inst.getGlyphOrder()
pen = SVGPathPen(gs, ntos=lambda v: ("%.4f" % v).rstrip("0").rstrip("."))
x = 0; names = []
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]; names.append(name)
    gs[name].draw(TransformPen(pen, (1 / upm, 0, 0, -1 / upm, (x + pos.x_offset) / upm, -pos.y_offset / upm)))
    x += pos.x_advance
print(json.dumps({"glyphs": names, "advance": round(x / upm, 4), "path": pen.getCommands()}))
