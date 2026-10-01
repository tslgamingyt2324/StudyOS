"""
Generates every StudyOS icon asset (run from the project root: python3 scripts/make_icons.py).

Mark: a bold geometric "S" drawn as ONE continuous ribbon (two tangent circular arcs) on a
deep blue -> indigo field, with a mint tip on the upper terminal (progress / checkpoint).

Outputs (public/):
  icon-192.png, icon-512.png                    purpose "any"  - squircle, transparent corners
  icon-maskable-192.png, icon-maskable-512.png  purpose "maskable" - full bleed, mark inside safe zone
  apple-touch-icon.png (180)                    full bleed, opaque (iOS applies its own mask)
  favicon-32.png, favicon.ico (16/32/48)        squircle, larger mark for legibility
  badge-96.png                                  monochrome white glyph (Android status-bar badge)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

SS = 4  # supersampling factor for crisp anti-aliased edges

TOP = (52, 120, 255)       # blue
BOTTOM = (92, 58, 226)     # indigo
MINT = (94, 242, 196)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient(size):
    """Diagonal blue -> indigo gradient with a soft highlight in the upper-left."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y * 0.65) / size
            px[x, y] = lerp(TOP, BOTTOM, min(1.0, t))
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse([-size * 0.2, -size * 0.35, size * 0.85, size * 0.6], fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    return Image.composite(Image.new("RGB", (size, size), WHITE), img, glow)


def squircle_mask(size, n=5.0):
    """Superellipse (iOS-style) mask."""
    pts = []
    steps = 720
    half = size / 2
    for i in range(steps):
        a = 2 * math.pi * i / steps
        c, s = math.cos(a), math.sin(a)
        x = half + half * math.copysign(abs(c) ** (2 / n), c)
        y = half + half * math.copysign(abs(s) ** (2 / n), s)
        pts.append((x, y))
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def s_path(size, height_frac):
    """Dense (x, y, in_accent) points along the S centre-line, plus the stroke width."""
    r = size * height_frac / 5.0          # height = 4r + w with w = r
    w = r
    cx, cy = size / 2, size / 2
    pts = []
    n = 400
    # Upper arc: centre (cx, cy - r), angle -30deg -> -270deg (counter-clockwise on screen)
    for i in range(n + 1):
        a = math.radians(-30 - 240 * i / n)
        pts.append((cx + r * math.cos(a), cy - r + r * math.sin(a), i / n < 0.17))
    # Lower arc: centre (cx, cy + r), angle -90deg -> 150deg (clockwise)
    for i in range(n + 1):
        a = math.radians(-90 + 240 * i / n)
        pts.append((cx + r * math.cos(a), cy + r + r * math.sin(a), False))
    return pts, w


def draw_mark(size, height_frac, accent=True, mono=False):
    """RGBA layer (size x size) containing the S (with a soft shadow unless mono)."""
    big = size * SS
    pts, w = s_path(big, height_frac)
    body = Image.new("L", (big, big), 0)
    tip = Image.new("L", (big, big), 0)
    bd, td = ImageDraw.Draw(body), ImageDraw.Draw(tip)
    rad = w / 2
    for x, y, is_tip in pts:
        box = [x - rad, y - rad, x + rad, y + rad]
        bd.ellipse(box, fill=255)
        if is_tip:
            td.ellipse(box, fill=255)
    body = body.resize((size, size), Image.LANCZOS)
    tip = tip.resize((size, size), Image.LANCZOS)

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if mono:
        layer.paste(Image.new("RGBA", (size, size), WHITE + (255,)), (0, 0), body)
        return layer
    shadow = body.filter(ImageFilter.GaussianBlur(size * 0.012)).point(lambda v: int(v * 0.28))
    shadow_layer = Image.new("RGBA", (size, size), (20, 10, 90, 0))
    shadow_layer.putalpha(shadow)
    layer.alpha_composite(shadow_layer, (0, int(size * 0.012)))
    layer.paste(Image.new("RGBA", (size, size), WHITE + (255,)), (0, 0), body)
    if accent:
        layer.paste(Image.new("RGBA", (size, size), MINT + (255,)), (0, 0), tip)
    return layer


def render(size, *, shape, height_frac):
    """shape: 'squircle' (transparent corners) or 'full' (opaque full bleed)."""
    base = gradient(size).convert("RGBA")
    base.alpha_composite(draw_mark(size, height_frac))
    if shape == "squircle":
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mask = squircle_mask(size * SS).resize((size, size), Image.LANCZOS)
        out.paste(base, (0, 0), mask)
        return out
    return base.convert("RGB")


def main():
    os.makedirs("public", exist_ok=True)
    for s in (192, 512):  # purpose "any"
        render(s, shape="squircle", height_frac=0.52).save(f"public/icon-{s}.png")
    for s in (192, 512):  # purpose "maskable": mark stays well inside the 80% safe-zone circle
        render(s, shape="full", height_frac=0.50).save(f"public/icon-maskable-{s}.png")
    render(180, shape="full", height_frac=0.52).save("public/apple-touch-icon.png")
    fav = {s: render(s, shape="squircle", height_frac=0.68) for s in (16, 32, 48)}
    fav[32].save("public/favicon-32.png")
    fav[48].save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    badge = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    badge.alpha_composite(draw_mark(96, 0.78, mono=True))
    badge.save("public/badge-96.png")
    print("icons written")


if __name__ == "__main__":
    main()
