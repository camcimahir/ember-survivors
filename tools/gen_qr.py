#!/usr/bin/env python3
"""
Makes a scannable QR code pointing at the dev server on this machine's LAN
address, so a phone can open the game without typing an IP.

    python tools/gen_qr.py            # dev server, port 5173
    python tools/gen_qr.py 4173       # production preview
    python tools/gen_qr.py 5173 10.0.0.37   # force a specific host

The scheme is always written explicitly as http:// — a QR that carries the
scheme is far less likely to be upgraded to HTTPS by the phone's browser, which
is the usual cause of "this site can't provide a secure connection" on a plain
LAN dev server.

Requires: segno, Pillow.
"""

from __future__ import annotations

import os
import socket
import sys

import segno
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "store", "dev-qr.png")

BG = (255, 255, 255)
INK = (18, 20, 34)
ACCENT = (214, 122, 34)


def lan_ip() -> str:
    """
    Best-effort LAN address. Opening a UDP socket to a public address makes the
    OS pick the interface it would actually route through — more reliable than
    gethostbyname, which often returns 127.0.0.1.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def load_font(size: int):
    for name in ("segoeuib.ttf", "arialbd.ttf", "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    port = sys.argv[1] if len(sys.argv) > 1 else "5173"
    host = sys.argv[2] if len(sys.argv) > 2 else lan_ip()
    url = f"http://{host}:{port}"

    # High error correction so it still scans off a glossy screen at an angle.
    qr = segno.make(url, error="h")
    scale = 12
    border = 3
    qr_path = os.path.join(ROOT, "store", "_qr_tmp.png")
    os.makedirs(os.path.dirname(qr_path), exist_ok=True)
    qr.save(qr_path, scale=scale, border=border, dark="#121422", light="#ffffff")

    qr_img = Image.open(qr_path).convert("RGB")
    w = qr_img.width
    label_h = 132
    card = Image.new("RGB", (w, qr_img.height + label_h), BG)
    card.paste(qr_img, (0, 0))

    d = ImageDraw.Draw(card)
    title_font = load_font(34)
    url_font = load_font(40)
    hint_font = load_font(22)

    y = qr_img.height - 8

    def centered(text, font, yy, fill):
        bbox = d.textbbox((0, 0), text, font=font)
        d.text(((w - (bbox[2] - bbox[0])) / 2, yy), text, font=font, fill=fill)
        return bbox[3] - bbox[1]

    h = centered("EMBER SURVIVORS", title_font, y, INK)
    y += h + 16
    h = centered(url, url_font, y, ACCENT)
    y += h + 14
    centered("same Wi-Fi  ·  note the http://", hint_font, y, (120, 128, 148))

    card.save(OUT)
    os.remove(qr_path)

    print(f"URL : {url}")
    print(f"QR  : {os.path.relpath(OUT, ROOT)}  ({card.width}x{card.height})")


if __name__ == "__main__":
    main()
