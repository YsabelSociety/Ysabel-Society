"""Render the approved social card from original artwork, never an upscaled card.

Requires Pillow, NumPy and a Georgia font path supplied with --serif-font.
The public logo's original alpha preserves every emblem and wordmark shape.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, SCALE = 2400, 2400, 1
GREEN = "#1d3428"
CHARCOAL = "#2d2c2c"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serif-font", type=Path, required=True)
    args = parser.parse_args()

    # A smooth, untextured pearl gradient compresses cleanly in link previews.
    y, x = np.mgrid[0 : HEIGHT * SCALE, 0 : WIDTH * SCALE].astype(np.float32)
    x /= WIDTH * SCALE
    y /= HEIGHT * SCALE
    shade = (
        0.40 * x
        + 0.23 * y
        + 0.30 * np.exp(-((x - 0.90) ** 2 / 0.13 + (y - 0.27) ** 2 / 0.20))
        - 0.27 * np.exp(-((x - 0.55) ** 2 / 0.15 + (y - 0.92) ** 2 / 0.10))
    )
    shade = np.clip(shade, 0, 1)
    pearl = np.array([228, 235, 230], dtype=np.float32)
    pixels = np.round(255 - shade[..., None] * (255 - pearl)).astype(np.uint8)
    canvas = Image.fromarray(pixels).convert("RGBA")

    source = Image.open(ROOT / "public/ysabel-society-logo.png").convert("RGBA")
    brand = Image.new("RGBA", source.size, CHARCOAL)
    ImageDraw.Draw(brand).rectangle((0, 0, source.width, 2000), fill=GREEN)
    brand.putalpha(source.getchannel("A"))
    brand = brand.crop(source.getbbox())
    logo_width = 1000 * SCALE
    brand = brand.resize(
        (logo_width, round(brand.height * logo_width / brand.width)),
        Image.Resampling.LANCZOS,
    )
    canvas.alpha_composite(brand, ((WIDTH * SCALE - brand.width) // 2, 210 * SCALE))

    draw = ImageDraw.Draw(canvas)

    def font(path, size):
        return ImageFont.truetype(str(path), round(size * SCALE))

    sans = ROOT / "public/fonts/NotoSans-Regular.ttf"
    draw.text((1200 * SCALE, 1120 * SCALE), "Marketing Data", font=font(args.serif_font, 108), fill=CHARCOAL, anchor="mt")
    draw.text((1200 * SCALE, 1280 * SCALE), "All platforms. One private workspace.", font=font(sans, 41), fill=CHARCOAL, anchor="mt")
    draw.text((1200 * SCALE, 2220 * SCALE), "ysabelsociety.com/marketingdata", font=font(sans, 30), fill=GREEN, anchor="mt")

    # Decorative graphs carry no private metrics or invented numerical labels.
    points = [(360, 1970), (590, 1850), (830, 1640), (1080, 1760), (1360, 1700), (1650, 1550), (2040, 1450)]
    draw.line([(x * SCALE, y * SCALE) for x, y in points], fill=GREEN, width=7, joint="curve")
    radius = 7.5 * SCALE
    for x, y in points[1:]:
        x, y = x * SCALE, y * SCALE
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=GREEN)

    for x, top, color in [(1270, 1940, "#a6b9a8"), (1440, 1870, "#95ad98"), (1610, 1900, "#a5b8a7"), (1780, 1790, "#bac8bb"), (1950, 1710, "#799782")]:
        draw.rectangle((x * SCALE, top * SCALE, (x + 84) * SCALE, 2070 * SCALE), fill=color)

    final = canvas.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    output = ROOT / "public/og.png"
    final.save(output, format="PNG", optimize=True)
    (ROOT / "public/og-square-v76.png").write_bytes(output.read_bytes())
    print(f"Rendered {WIDTH}x{HEIGHT} PNG: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
