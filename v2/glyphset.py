# python v2/glyphset.py <dir with pf900.ttf from glyphs.py>: write the outline and advance of every digit, letter, "°" and
# ":" of Playfair Display Black (lining figures), in ems, to stdout; saved as v2/glyphs.json for the wordmark's shapes.
import sys, json, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
inst = TTFont(sys.argv[1] + "/pf900.ttf")
blob = hb.Blob.from_file_path(sys.argv[1] + "/pf900.ttf"); face = hb.Face(blob); font = hb.Font(face)
upm = inst["head"].unitsPerEm; gs = inst.getGlyphSet(); order = inst.getGlyphOrder()
out = {}
for ch in "0123456789°:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
    buf = hb.Buffer(); buf.add_str(ch); buf.guess_segment_properties(); hb.shape(font, buf, {"lnum": True})
    info, pos = buf.glyph_infos[0], buf.glyph_positions[0]
    pen = SVGPathPen(gs, ntos=lambda v: str(round(v, 2)).rstrip("0").rstrip(".") if "." in str(round(v,2)) else str(round(v,2)))
    gs[order[info.codepoint]].draw(TransformPen(pen, (1 / upm, 0, 0, -1 / upm, 0, 0)))
    out[ch] = [round(pos.x_advance / upm, 4), pen.getCommands()]
print(json.dumps(out, separators=(",", ":")))
