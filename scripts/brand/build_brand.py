"""
StudyOS brand build — the single source of truth for the logo.

    pip install -r scripts/brand/requirements.txt
    python3 scripts/brand/build_brand.py          # run from the project root

THE MARK
    A solid circle (the "O") with two pill-shaped slots cut in from opposite sides. What is left
    snakes through the circle as an "S" — the S exists only as negative space, and the silhouette
    stays a perfect circle: one symbol spells "OS". The slots are tilted 10° upward (progress).

CONSTRUCTION (1024-unit canvas, centre 512,512)
    disc radius R = 310            slot thickness = 64 (2 x 32)       slot offset from centre = ±114
    S strips (top / spine / bottom) are all ~164 thick; the two connectors are 150 thick.
    The mark is emitted as ONE closed outline (no masks, no holes), so it is genuinely
    transparent in the slots — it works as a favicon, a notification badge, or in monochrome.

OUTPUTS
    public/            icon-192/512.png (any)  icon-maskable-192/512.png  apple-touch-icon.png
                       favicon.ico  favicon-16/32.png  icon.svg  badge-96.png
    public/brand/      mark.svg  mark-black.svg  mark-white.svg  wordmark.svg  logo.svg
                       app-icon.svg  app-icon-1024.png
    src/components/brand/paths.ts   (generated — consumed by <Logo />)
"""
import math
import os
import struct
from io import BytesIO

import resvg_py
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUBLIC = os.path.join(ROOT, "public")
BRAND_DIR = os.path.join(PUBLIC, "brand")
TS_OUT = os.path.join(ROOT, "src", "components", "brand", "paths.ts")
FONT = os.path.join(HERE, "fonts", "inter-latin-600-normal.woff")

# ----------------------------------------------------------------------------- palette
BLUE_TOP = "#2E6CFF"      # StudyOS Blue (brightest point of the tile)
BLUE_MID = "#1B3FB4"
MIDNIGHT = "#0A1236"      # deepest point of the tile
ICE_TOP = "#FFFFFF"       # disc gradient
ICE_BOTTOM = "#CCDEFF"
SHADOW = "#020A33"

CX = CY = 512


# ----------------------------------------------------------------------------- the mark
def mark_path(R=310, off=114, th=32, strip=150, tilt=-10.0, cx=CX, cy=CY) -> str:
    """The S-in-O outline as a single closed path (rotation baked into the coordinates)."""
    X = lambda y: math.sqrt(R * R - (y - cy) ** 2)  # half-chord of the disc at height y
    y1, y2 = cy - off - th, cy - off + th            # top slot   (enters from the right)
    y3, y4 = cy + off - th, cy + off + th            # bottom slot (enters from the left)
    xl = cx - X(cy - off) + strip + th               # inner end (centre of the round tip), top slot
    xr = cx + X(cy + off) - strip - th               # inner end, bottom slot
    a = math.radians(tilt)
    ca, sa = math.cos(a), math.sin(a)

    def rot(x, y):
        dx, dy = x - cx, y - cy
        return (cx + dx * ca - dy * sa, cy + dx * sa + dy * ca)

    f = lambda p: f"{p[0]:.2f} {p[1]:.2f}"
    P1, P2 = rot(cx + X(y1), y1), rot(cx + X(y2), y2)
    Q3, Q4 = rot(cx - X(y3), y3), rot(cx - X(y4), y4)
    return (
        f"M{f(P1)}A{R} {R} 0 0 0 {f(Q3)}"                      # over the top, down the left side
        f"L{f(rot(xr, y3))}A{th} {th} 0 0 1 {f(rot(xr, y4))}"  # bottom slot: in, round tip, out
        f"L{f(Q4)}A{R} {R} 0 0 0 {f(P2)}"                      # round the bottom, up the right side
        f"L{f(rot(xl, y2))}A{th} {th} 0 0 1 {f(rot(xl, y1))}Z"  # top slot: in, round tip, out
    )


def squircle_path(n=5.0, steps=360, c=512, h=512) -> str:
    """Superellipse approximating the iOS continuous-corner icon shape."""
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        co, si = math.cos(t), math.sin(t)
        pts.append((c + h * math.copysign(abs(co) ** (2 / n), co), c + h * math.copysign(abs(si) ** (2 / n), si)))
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


MARK = mark_path()
MARK_MINI = mark_path(R=372, off=138, th=44, strip=172)   # optically enlarged/heavier for 16-48px
SQUIRCLE = squircle_path()
MARK_VIEWBOX = "202 202 620 620"


# ----------------------------------------------------------------------------- tile (app icon)
def tile_svg(kind: str) -> str:
    """kind: 'any' (squircle, transparent corners) | 'full' (opaque full bleed) | 'mini' (favicon)."""
    mini = kind == "mini"
    glyph = MARK_MINI if mini else MARK
    shape = (f'<path d="{SQUIRCLE}"' if kind != "full" else '<rect width="1024" height="1024"') + ' fill="url(#bg)"/>'
    glow = shape.replace('fill="url(#bg)"', 'fill="url(#gl)"')
    shadow = "" if mini else (
        f'<path d="{glyph}" transform="translate(0 24)" fill="{SHADOW}" opacity=".55" filter="url(#sh)"/>'
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
<linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="{BLUE_TOP}"/><stop offset="0.55" stop-color="{BLUE_MID}"/><stop offset="1" stop-color="{MIDNIGHT}"/></linearGradient>
<radialGradient id="gl" cx="0.22" cy="0.04" r="0.8"><stop offset="0" stop-color="#9CC0FF" stop-opacity="0.38"/><stop offset="1" stop-color="#9CC0FF" stop-opacity="0"/></radialGradient>
<linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ICE_TOP}"/><stop offset="1" stop-color="{ICE_BOTTOM}"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="20"/></filter>
</defs>
{shape}
{glow}
{shadow}
<path d="{glyph}" fill="url(#dg)"/>
</svg>
'''


def glyph_svg(fill: str, pad=0, box=MARK_VIEWBOX) -> str:
    x, y, w, h = [float(v) for v in box.split()]
    vb = f"{x - pad} {y - pad} {w + 2 * pad} {h + 2 * pad}"
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><path d="{MARK}" fill="{fill}"/></svg>\n'


# ----------------------------------------------------------------------------- wordmark
def build_wordmark(text="StudyOS", tracking=-0.012):
    """Kerned (HarfBuzz) outlines of the wordmark. Returns (path, bbox, capHeight, upem)."""
    tt = TTFont(FONT)
    tt.flavor = None
    buf = BytesIO()
    tt.save(buf)
    data = buf.getvalue()
    face = hb.Face(data)
    font = hb.Font(face)
    hbuf = hb.Buffer()
    hbuf.add_str(text)
    hbuf.guess_segment_properties()
    hb.shape(font, hbuf, {"kern": True, "liga": False})
    tt = TTFont(BytesIO(data))
    gs, order = tt.getGlyphSet(), tt.getGlyphOrder()
    upem, cap = tt["head"].unitsPerEm, tt["OS/2"].sCapHeight
    ntos = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
    x, parts = 0.0, []
    bp = BoundsPen(gs)
    for info, pos in zip(hbuf.glyph_infos, hbuf.glyph_positions):
        g = gs[order[info.codepoint]]
        t = (1, 0, 0, -1, x + pos.x_offset, 0)  # flip y; baseline at y=0, cap-top at y=-cap
        pen = SVGPathPen(gs, ntos=ntos)
        g.draw(TransformPen(pen, t))
        g.draw(TransformPen(bp, t))
        parts.append(pen.getCommands())
        x += pos.x_advance + tracking * upem
    return "".join(parts), bp.bounds, cap, upem


# ----------------------------------------------------------------------------- raster helpers
def png(svg: str, size: int) -> bytes:
    return bytes(resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size))


def opaque(data: bytes) -> bytes:
    """Flatten to RGB: iOS renders any transparency in the touch icon as black."""
    from PIL import Image
    out = BytesIO()
    Image.open(BytesIO(data)).convert("RGB").save(out, "PNG", optimize=True)
    return out.getvalue()


def write(path: str, data, mode="wb"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode) as fh:
        fh.write(data)


def ico(entries: dict) -> bytes:
    """Write a PNG-in-ICO from natively rendered PNGs {size: png_bytes} (no resampling blur)."""
    sizes = sorted(entries)
    out = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    body = b""
    for s in sizes:
        d = entries[s]
        out += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(d), offset + len(body))
        body += d
    return out + body


# ----------------------------------------------------------------------------- main
def main():
    any_svg, full_svg, mini_svg = tile_svg("any"), tile_svg("full"), tile_svg("mini")

    # PWA / app icons (each rendered natively at its size — never downscaled from a bigger raster)
    for s in (192, 512):
        write(f"{PUBLIC}/icon-{s}.png", png(any_svg, s))
        write(f"{PUBLIC}/icon-maskable-{s}.png", opaque(png(full_svg, s)))  # mark sits inside the 80% safe circle
    write(f"{PUBLIC}/apple-touch-icon.png", opaque(png(full_svg, 180)))  # iOS applies its own mask
    write(f"{BRAND_DIR}/app-icon-1024.png", png(any_svg, 1024))

    # favicons — size-optimised mark (bigger, heavier slots)
    fav = {s: png(mini_svg, s) for s in (16, 32, 48)}
    write(f"{PUBLIC}/favicon-16.png", fav[16])
    write(f"{PUBLIC}/favicon-32.png", fav[32])
    write(f"{PUBLIC}/favicon.ico", ico(fav))
    write(f"{PUBLIC}/icon.svg", mini_svg, "w")

    # Android notification badge: white glyph, truly transparent slots
    write(f"{PUBLIC}/badge-96.png", png(glyph_svg("#ffffff", pad=24), 96))

    # SVG logo set
    write(f"{BRAND_DIR}/app-icon.svg", any_svg, "w")
    write(f"{BRAND_DIR}/mark.svg", glyph_svg("currentColor"), "w")
    write(f"{BRAND_DIR}/mark-black.svg", glyph_svg("#0A1236"), "w")
    write(f"{BRAND_DIR}/mark-white.svg", glyph_svg("#FFFFFF"), "w")

    wm_path, (bx0, by0, bx1, by1), cap, upem = build_wordmark()
    pad = 0.0
    wm_vb = f"{bx0:.1f} {by0:.1f} {bx1 - bx0:.1f} {by1 - by0:.1f}"
    write(f"{BRAND_DIR}/wordmark.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{wm_vb}"><path d="{wm_path}" fill="currentColor"/></svg>\n', "w")

    # Horizontal lockup: mark diameter = 1.55 x cap height, gap = 0.55 x cap height, vertically centred on the caps.
    D = cap * 1.55
    k = D / 620.0
    gap = cap * 0.55
    mx, my = D / 2 - 512 * k, -cap / 2 - 512 * k  # disc centre (512,512) -> (D/2, -cap/2): centred on the capitals
    word_x = D + gap
    total_w = word_x + (bx1 - 0)
    top = min(by0, -cap / 2 - D / 2)
    bot = max(by1, -cap / 2 + D / 2)
    write(f"{BRAND_DIR}/logo.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top:.1f} {total_w:.1f} {bot - top:.1f}">'
          f'<path transform="translate({mx:.2f} {my:.2f}) scale({k:.5f})" d="{MARK}" fill="currentColor"/>'
          f'<path transform="translate({word_x:.1f} 0)" d="{wm_path}" fill="currentColor"/></svg>\n', "w")

    # Generated module for the in-app <Logo /> component
    ts = f'''// GENERATED by scripts/brand/build_brand.py — do not edit by hand.
export const MARK_PATH = "{MARK}";
export const MARK_VIEWBOX = "{MARK_VIEWBOX}";
export const WORDMARK_PATH = "{wm_path}";
export const WORDMARK_VIEWBOX = "{wm_vb}";
export const WORDMARK_ASPECT = {(bx1 - bx0) / (by1 - by0):.4f}; // width / height of the full wordmark box
// Box that spans exactly cap-top -> baseline (descenders/ascenders overhang), so it centres on the capitals.
export const WORDMARK_CAP_VIEWBOX = "{bx0:.1f} {-cap:.1f} {bx1 - bx0:.1f} {cap:.1f}";
export const WORDMARK_CAP_ASPECT = {(bx1 - bx0) / cap:.4f};
'''
    write(TS_OUT, ts, "w")
    print("brand assets written")


if __name__ == "__main__":
    main()
