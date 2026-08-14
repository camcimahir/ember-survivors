#!/usr/bin/env python3
"""
Generates every launcher icon, adaptive-icon layer, splash screen and Play
Store graphic the app needs.

Like the in-game art, none of this is hand-drawn: the icon is described in code
so it can be regenerated at any resolution and restyled in one place. Run with:

    python tools/gen_icons.py

Requires Pillow.  Outputs into android/app/src/main/res/... and store/.
"""

from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
STORE = os.path.join(ROOT, "store")

# Palette shared with src/art/style.ts
BG_DARK = (11, 15, 26)
BG_MID = (26, 35, 56)
FIRE_DARK = (163, 42, 18)
FIRE_BASE = (255, 107, 44)
FIRE_LIGHT = (255, 196, 107)
FIRE_CORE = (255, 251, 232)
STORM = (124, 196, 255)
FROST = (124, 232, 255)
GOLD = (255, 204, 85)
OUTLINE = (20, 21, 39)

# Launcher icon densities (px) for the standard mipmap buckets.
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

SS = 4  # supersampling factor; everything is drawn big then downsampled


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_bg(size, inner, outer):
    """Radial gradient background, drawn row-wise for speed."""
    img = Image.new("RGB", (size, size), outer)
    d = ImageDraw.Draw(img)
    steps = 64
    for i in range(steps, 0, -1):
        t = i / steps
        r = size * 0.78 * t
        d.ellipse(
            [size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r],
            fill=lerp(inner, outer, t),
        )
    return img


def _quad(p0, p1, p2, n):
    """Samples a quadratic bezier into n+1 points."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(
            (
                u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
            )
        )
    return out


def flame_polygon(cx, cy, w, h, points=28):
    """
    Teardrop flame pointing up: a round bulb at the bottom tapering to a point,
    the same silhouette as flamePath() in src/art/draw.ts.
    """
    r = w * 0.5
    by = cy + h * 0.5 - r  # bulb centre
    apex = (cx, cy - h * 0.5)

    pts = []
    # Right flank: apex down to the bulb's right edge.
    pts += _quad(apex, (cx + r * 1.15, cy - h * 0.10), (cx + r, by), points // 2)
    # Around the bottom of the bulb, right to left.
    arc_steps = points
    for i in range(arc_steps + 1):
        a = (i / arc_steps) * math.pi  # 0 -> pi sweeps through the bottom
        pts.append((cx + math.cos(a) * r, by + math.sin(a) * r))
    # Left flank: bulb's left edge back up to the apex.
    pts += _quad((cx - r, by), (cx - r * 1.15, cy - h * 0.10), apex, points // 2)
    return pts


def bolt_polygon(cx, cy, w, h):
    """Lightning bolt glyph."""
    return [
        (cx + w * 0.18, cy - h * 0.50),
        (cx - w * 0.30, cy + h * 0.06),
        (cx - w * 0.02, cy + h * 0.06),
        (cx - w * 0.20, cy + h * 0.50),
        (cx + w * 0.32, cy - h * 0.10),
        (cx + w * 0.02, cy - h * 0.10),
    ]


def shard_polygon(cx, cy, w, h):
    """Ice shard glyph."""
    return [
        (cx, cy - h * 0.5),
        (cx + w * 0.5, cy - h * 0.1),
        (cx + w * 0.3, cy + h * 0.5),
        (cx - w * 0.3, cy + h * 0.5),
        (cx - w * 0.5, cy - h * 0.1),
    ]


def draw_glow(img, poly, color, blur, alpha=200):
    """Soft additive-looking glow behind a shape."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon(poly, fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def build_foreground(size, margin=0.30):
    """
    The icon's subject: a fused ember flanked by a storm bolt and a frost shard,
    which is the game's whole premise in one mark.

    `margin` keeps the art inside the adaptive-icon safe zone (the outer ~33%
    of an adaptive icon can be masked away by the launcher).
    """
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx = cy = S / 2
    safe = S * (1 - margin)

    # --- flanking element glyphs -------------------------------------------
    # Pushed well clear of the flame so all three marks stay legible at 48px.
    side_w = safe * 0.24
    side_h = safe * 0.38
    off = safe * 0.37

    # The bolt glyph's own outline is narrower than its bounding box, so it is
    # widened to sit at the same visual weight as the shard opposite it.
    bolt = bolt_polygon(cx - off, cy + safe * 0.06, side_w * 1.6, side_h * 1.05)
    draw_glow(img, bolt, STORM, S * 0.03)
    d.polygon(bolt, fill=STORM + (255,), outline=OUTLINE + (255,), width=int(S * 0.008))

    shard = shard_polygon(cx + off, cy + safe * 0.06, side_w * 0.86, side_h)
    draw_glow(img, shard, FROST, S * 0.03)
    d.polygon(shard, fill=FROST + (255,), outline=OUTLINE + (255,), width=int(S * 0.008))

    # --- central flame ------------------------------------------------------
    fw = safe * 0.46
    fh = safe * 0.84
    outer = flame_polygon(cx, cy, fw, fh)
    draw_glow(img, outer, FIRE_BASE, S * 0.05, alpha=170)

    # Nested flames, each sitting lower and smaller — the same three-stop
    # shading rule the in-game sprites use.
    d.polygon(outer, fill=FIRE_DARK + (255,), outline=OUTLINE + (255,), width=int(S * 0.012))
    d.polygon(flame_polygon(cx, cy + fh * 0.07, fw * 0.72, fh * 0.78), fill=FIRE_BASE + (255,))
    d.polygon(flame_polygon(cx, cy + fh * 0.16, fw * 0.44, fh * 0.54), fill=FIRE_LIGHT + (255,))
    d.polygon(flame_polygon(cx, cy + fh * 0.24, fw * 0.21, fh * 0.30), fill=FIRE_CORE + (255,))

    return img.resize((size, size), Image.LANCZOS)


def build_background(size):
    """Adaptive-icon background layer: the game's dark arena blue."""
    img = radial_bg(size * SS, BG_MID, BG_DARK).convert("RGBA")
    # A faint ring echoes the nova effects in game.
    d = ImageDraw.Draw(img)
    S = size * SS
    r = S * 0.34
    d.ellipse(
        [S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r],
        outline=(255, 204, 85, 40),
        width=int(S * 0.012),
    )
    return img.resize((size, size), Image.LANCZOS)


def rounded_mask(size, radius_frac=0.22):
    m = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1],
        radius=int(size * SS * radius_frac),
        fill=255,
    )
    return m.resize((size, size), Image.LANCZOS)


def build_legacy_icon(size, round_icon=False):
    """Pre-adaptive launcher icon: background and foreground pre-composited."""
    bg = build_background(size)
    fg = build_foreground(size, margin=0.16)
    bg.alpha_composite(fg)
    if round_icon:
        mask = Image.new("L", (size * SS, size * SS), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size * SS - 1, size * SS - 1], fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
    else:
        mask = rounded_mask(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out


def build_splash(w, h):
    """Splash / launch screen: logo mark centred on the arena background."""
    img = radial_bg(max(w, h), BG_MID, BG_DARK).convert("RGBA")
    img = img.resize((w, h), Image.LANCZOS)
    mark = build_foreground(int(min(w, h) * 0.42), margin=0.10)
    img.alpha_composite(mark, ((w - mark.width) // 2, (h - mark.height) // 2))
    return img.convert("RGB")


def build_feature_graphic():
    """Play Store feature graphic (1024x500)."""
    w, h = 1024, 500
    img = radial_bg(1024, BG_MID, BG_DARK).convert("RGBA").resize((w, h), Image.LANCZOS)
    mark = build_foreground(360, margin=0.10)
    img.alpha_composite(mark, (86, (h - mark.height) // 2))

    d = ImageDraw.Draw(img)
    # Title block. A default bitmap font would look poor at this size, so the
    # title is drawn as simple geometric bars suggesting the wordmark instead of
    # relying on a font that may not exist on the build machine.
    x0, y0 = 470, 190
    for i, wdt in enumerate((300, 240)):
        d.rounded_rectangle(
            [x0, y0 + i * 66, x0 + wdt, y0 + i * 66 + 44], radius=10, fill=GOLD + (255,)
        )
    d.rounded_rectangle([x0, y0 + 150, x0 + 180, y0 + 168], radius=8, fill=(159, 176, 204, 255))
    return img.convert("RGB")


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("  wrote", os.path.relpath(path, ROOT))


def main():
    print("Generating launcher icons...")
    for folder, px in DENSITIES.items():
        save(build_legacy_icon(px), os.path.join(RES, folder, "ic_launcher.png"))
        save(build_legacy_icon(px, round_icon=True), os.path.join(RES, folder, "ic_launcher_round.png"))
        # Adaptive-icon layers are 108dp; the inner 72dp is the safe zone.
        adaptive = int(px * 108 / 48)
        save(build_foreground(adaptive), os.path.join(RES, folder, "ic_launcher_foreground.png"))
        save(build_background(adaptive), os.path.join(RES, folder, "ic_launcher_background.png"))

    print("Generating splash screens...")
    for folder, (w, h) in {
        "drawable": (480, 800),
        "drawable-land-hdpi": (800, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-port-xxhdpi": (960, 1600),
    }.items():
        save(build_splash(w, h), os.path.join(RES, folder, "splash.png"))

    print("Generating Play Store assets...")
    save(build_legacy_icon(512), os.path.join(STORE, "play-store-icon-512.png"))
    save(build_feature_graphic(), os.path.join(STORE, "feature-graphic-1024x500.png"))
    save(build_legacy_icon(1024), os.path.join(STORE, "icon-1024.png"))

    print("Done.")


if __name__ == "__main__":
    main()
