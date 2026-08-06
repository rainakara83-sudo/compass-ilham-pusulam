"""Generate 8 niche cover images (512x512 PNG) with rich themed illustration."""
import json
import math
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path("/Users/selmakara/ilk-proje/content-coach")
NICHES_JSON = ROOT / "data" / "niches.json"
OUT_DIR = ROOT / "assets" / "niches"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZE = 512


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def lighten(rgb: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(c + (255 - c) * t) for c in rgb)


def darken(rgb: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(c * (1 - t)) for c in rgb)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def gradient(w: int, h: int, top: tuple, bottom: tuple) -> Image.Image:
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def radial_gradient(w: int, h: int, center: tuple, inner: tuple, outer: tuple) -> Image.Image:
    cx, cy = center
    max_d = math.hypot(max(cx, w - cx), max(cy, h - cy))
    img = Image.new("RGB", (w, h), outer)
    px = img.load()
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx, y - cy) / max_d
            r = int(inner[0] + (outer[0] - inner[0]) * d)
            g = int(inner[1] + (outer[1] - inner[1]) * d)
            b = int(inner[2] + (outer[2] - inner[2]) * d)
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def rounded_rect(d: ImageDraw.ImageDraw, xy, radius, fill):
    d.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_illustration(img: Image.Image, niche_id: str, base_rgb, accent_rgb) -> None:
    """Draw themed illustration overlays for each niche."""
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(niche_id)

    if niche_id == "fitness":
        for cx, cy, r in [(110, 130, 36), (180, 105, 28), (260, 130, 32), (340, 110, 30), (400, 150, 36)]:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*darken(base_rgb, 0.3), 255))
        for x in range(60, 452, 60):
            for y in range(220, 360, 60):
                d.ellipse((x, y, x + 14, y + 14), fill=(*lighten(base_rgb, 0.2), 220))
        d.rectangle((0, 380, SIZE, SIZE), fill=(*darken(base_rgb, 0.4), 255))
        d.rounded_rectangle((160, 200, 352, 320), radius=30, fill=(*accent_rgb, 255))
        d.rounded_rectangle((190, 230, 322, 290), radius=8, fill=(255, 255, 255, 255))
        for i, y in enumerate([240, 260, 280]):
            d.text((200, y), "01 02 03"[i], font=font(28, True), fill=(*darken(base_rgb, 0.5), 255))

    elif niche_id == "food":
        d.ellipse((120, 130, 392, 402), fill=(*lighten(base_rgb, 0.15), 255), outline=(*darken(base_rgb, 0.3), 255), width=8)
        for i in range(1, 4):
            r = 130 - i * 32
            d.ellipse((256 - r, 266 - r, 256 + r, 266 + r), outline=(*darken(base_rgb, 0.2), 200), width=3)
        d.ellipse((150, 160, 362, 372), fill=(255, 255, 255, 80))
        for cx, cy in [(200, 200), (256, 180), (310, 220), (220, 270), (290, 290)]:
            d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=(*accent_rgb, 255))
        for x in range(70, 460, 30):
            d.ellipse((x, 420, x + 16, 436), fill=(*darken(base_rgb, 0.3), 200))

    elif niche_id == "tech":
        # Vibrant tech code on screen
        d.rounded_rectangle((80, 110, 432, 350), radius=14, fill=(20, 28, 48, 255), outline=(*lighten(base_rgb, 0.4), 255), width=4)
        # Glow effect
        d.rounded_rectangle((60, 90, 452, 370), radius=20, outline=(*accent_rgb, 180), width=2)
        for y in range(140, 340, 30):
            d.line([(100, y), (412, y)], fill=(60, 80, 140, 200), width=1)
        # Bright code symbols
        for i, (x, y, ch) in enumerate([
            (110, 140, "<"), (140, 140, "/"), (170, 140, ">"),
            (110, 200, "{"), (140, 200, "}"), (170, 200, ";"),
            (110, 260, "="), (140, 260, ">"), (170, 260, "("),
        ]):
            d.text((x, y), ch, font=font(22, True), fill=(*lighten(base_rgb, 0.3), 255))
        # Color-coded keywords
        d.text((200, 140), "function", font=font(16, True), fill=(255, 100, 200, 255))
        d.text((200, 200), "const", font=font(16, True), fill=(150, 255, 150, 255))
        d.text((200, 260), "import", font=font(16, True), fill=(255, 200, 80, 255))
        # Bright circles
        for cx, cy, r in [(120, 380, 14), (170, 410, 16), (230, 390, 18), (300, 415, 14), (370, 385, 16)]:
            d.ellipse((cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=(*accent_rgb, 120))
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*accent_rgb, 255))
        d.rounded_rectangle((60, 380, 452, 460), radius=12, fill=(20, 28, 48, 255))
        for cx in [110, 175, 240, 305, 370, 415]:
            d.rounded_rectangle((cx - 22, 410, cx + 22, 442), radius=6, fill=(*lighten(base_rgb, 0.3), 200))

    elif niche_id == "fashion":
        for cx in [110, 256, 400]:
            d.polygon([(cx, 110), (cx - 70, 220), (cx + 70, 220)], fill=(*darken(base_rgb, 0.3), 255))
            d.rectangle((cx - 25, 220, cx + 25, 360), fill=(*darken(base_rgb, 0.2), 255))
            d.polygon([(cx - 70, 360), (cx + 70, 360), (cx + 50, 410), (cx - 50, 410)], fill=(*darken(base_rgb, 0.4), 255))
        for cx in [110, 256, 400]:
            d.polygon([(cx - 25, 220), (cx + 25, 220), (cx + 35, 280), (cx - 35, 280)], fill=(*accent_rgb, 255))
        d.line([(0, 410), (SIZE, 410)], fill=(*darken(base_rgb, 0.5), 255), width=6)
        for i, txt in enumerate(["01", "02", "03"]):
            d.text((cx_i := 256, 440 + i * 0), txt, font=font(20, True), fill=(255, 255, 255, 255))

    elif niche_id == "travel":
        d.polygon([(60, 350), (140, 230), (200, 290), (290, 180), (380, 260), (450, 200), (450, 410), (60, 410)], fill=(*darken(base_rgb, 0.4), 255))
        d.polygon([(60, 410), (180, 320), (260, 360), (360, 300), (450, 340), (450, 410)], fill=(*darken(base_rgb, 0.55), 255))
        for h in range(0, 360, 4):
            r = int(255 * (0.5 + 0.5 * math.sin(math.radians(h))))
            g = int(180 + 70 * math.sin(math.radians(h * 1.3)))
            b = int(200 - 100 * math.sin(math.radians(h * 0.7)))
            d.ellipse((245, 90, 280, 125), fill=None, outline=(r, g, b, 60), width=2)
        d.ellipse((230, 80, 295, 145), fill=(*accent_rgb, 255))
        d.polygon([(256, 75), (290, 105), (256, 135), (222, 105)], fill=(255, 220, 100, 255))
        d.line([(50, 380), (462, 380)], fill=(255, 255, 255, 200), width=2)

    elif niche_id == "gaming":
        # Vibrant neon gaming controller
        d.rounded_rectangle((80, 130, 432, 360), radius=24, fill=(15, 20, 35, 255), outline=(*lighten(base_rgb, 0.2), 255), width=5)
        # Glow effect behind
        d.rounded_rectangle((60, 110, 452, 380), radius=30, outline=(*accent_rgb, 180), width=2)
        for cx, cy, r in [(180, 245, 18), (335, 245, 18)]:
            d.ellipse((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4), fill=(*accent_rgb, 100))
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*accent_rgb, 255))
            d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(15, 20, 35, 255))
        d.rounded_rectangle((220, 175, 295, 220), radius=10, fill=(15, 20, 35, 255), outline=(*accent_rgb, 255), width=3)
        d.rounded_rectangle((220, 270, 295, 315), radius=10, fill=(*accent_rgb, 255))
        # Glowing D-pad
        for x, y in [(95, 145), (95, 175), (115, 145), (115, 175), (95, 340), (115, 340), (95, 310)]:
            d.rounded_rectangle((x, y, x + 18, y + 18), radius=4, fill=(*lighten(base_rgb, 0.3), 255))
        # Bright accent strips
        d.rectangle((100, 140, 412, 142), fill=(*accent_rgb, 220))
        d.rectangle((100, 348, 412, 350), fill=(*accent_rgb, 220))
        d.text((380, 320), "🎮", font=font(40, True), fill=(*accent_rgb, 255))
        # Speed lines
        for i, (x, y) in enumerate([(70, 90), (380, 100), (240, 70)]):
            d.line([(x, y), (x + 40, y - 10)], fill=(*accent_rgb, 200), width=3)

    elif niche_id == "personal_dev":
        for i, x in enumerate(range(80, 460, 60)):
            d.rectangle((x, 380, x + 40, 410), fill=(*darken(base_rgb, 0.4), 255))
        d.rounded_rectangle((150, 200, 362, 360), radius=8, fill=(255, 250, 240, 255), outline=(*darken(base_rgb, 0.4), 255), width=3)
        for i, (txt, y) in enumerate([
            ("TODAY'S GOAL", 215), ("•", 240), ("Read 30 min", 270), ("•", 295), ("Walk 5K steps", 320),
        ]):
            d.text((165, y), txt, font=font(16 if i > 0 else 14, True), fill=(*darken(base_rgb, 0.5), 255))
        d.polygon([(140, 195), (175, 175), (175, 215)], fill=(*accent_rgb, 255))
        for cx in [80, 160, 220, 320, 400]:
            d.line([(cx, 100), (cx, 140)], fill=(*darken(base_rgb, 0.4), 255), width=2)

    elif niche_id == "beauty":
        d.ellipse((140, 100, 380, 340), fill=(255, 240, 230, 255), outline=(*darken(base_rgb, 0.3), 255), width=3)
        d.ellipse((190, 200, 230, 220), fill=(*darken(base_rgb, 0.2), 255))
        d.ellipse((290, 200, 330, 220), fill=(*darken(base_rgb, 0.2), 255))
        d.arc((220, 230, 300, 270), 0, 180, fill=(*accent_rgb, 255), width=4)
        d.ellipse((80, 350, 200, 470), fill=(*accent_rgb, 200))
        d.ellipse((320, 360, 440, 480), fill=(*darken(base_rgb, 0.2), 200))
        d.rounded_rectangle((220, 360, 292, 410), radius=8, fill=(*accent_rgb, 255))
        d.rounded_rectangle((232, 365, 280, 405), radius=4, fill=(255, 255, 255, 255))

    elif niche_id == "astrology":
        # Cosmic purple background with stars
        for _ in range(80):
            sx = rnd.randint(0, SIZE)
            sy = rnd.randint(0, 400)
            sr = rnd.randint(1, 3)
            d.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=(255, 255, 255, rnd.randint(120, 255)))
        # Big crescent moon
        d.ellipse((140, 80, 380, 320), fill=(*lighten(base_rgb, 0.5), 255), outline=(*lighten(base_rgb, 0.7), 255), width=4)
        d.ellipse((180, 80, 380, 320), fill=(*darken(base_rgb, 0.2), 255))
        # Zodiac wheel
        d.ellipse((130, 195, 382, 447), outline=(*accent_rgb, 255), width=4)
        d.ellipse((170, 235, 342, 407), outline=(*lighten(base_rgb, 0.4), 255), width=2)
        # 12 zodiac tick marks
        for i in range(12):
            ang = math.radians(i * 30 - 90)
            cx, cy = 256, 321
            x1 = cx + 116 * math.cos(ang)
            y1 = cy + 116 * math.sin(ang)
            x2 = cx + 126 * math.cos(ang)
            y2 = cy + 126 * math.sin(ang)
            d.line([(x1, y1), (x2, y2)], fill=(*accent_rgb, 255), width=3)
        # Center stars
        d.text((220, 290), "✦", font=font(40, True), fill=(*accent_rgb, 255))
        d.text((280, 290), "✧", font=font(28, True), fill=(*lighten(base_rgb, 0.6), 255))
        # Magic stars in corners
        d.text((70, 120), "✨", font=font(40, True), fill=(255, 240, 100, 255))
        d.text((400, 160), "✨", font=font(40, True), fill=(255, 240, 100, 255))


def render(card: dict) -> Path:
    base_rgb = hex_to_rgb(card["color"])
    label_tr = card["label_tr"]

    bg_top = lighten(base_rgb, 0.92)
    bg_bot = lighten(base_rgb, 0.65)

    img = gradient(SIZE, SIZE, bg_top, bg_bot)
    draw_illustration(img, card["id"], base_rgb, base_rgb)

    mask = rounded_mask(SIZE, 32)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    out.putalpha(mask)

    out_path = OUT_DIR / f"{card['id']}.png"
    out.save(out_path, "PNG", optimize=True)
    return out_path


LABELS_TR = {
    "fitness": "Fitness",
    "food": "Yemek",
    "tech": "Teknoloji",
    "fashion": "Moda",
    "travel": "Seyahat",
    "gaming": "Oyun",
    "personal_dev": "Kişisel Gelişim",
    "beauty": "Güzellik",
    "astrology": "Astroloji",
}


def main() -> None:
    raw = json.loads(NICHES_JSON.read_text())
    cards = [
        {"id": row["id"], "color": row["color"], "label_tr": LABELS_TR.get(row["id"], row["id"])}
        for row in raw
    ]

    out_paths = []
    for c in cards:
        p = render(c)
        out_paths.append((c["id"], p))
        print(f"wrote {p}")

    raw2 = json.loads(NICHES_JSON.read_text())
    by_id = {p[0]: f"/assets/niches/{p[0]}.png" for p in out_paths}
    for row in raw2:
        if row["id"] in by_id:
            row["image"] = by_id[row["id"]]
    NICHES_JSON.write_text(json.dumps(raw2, indent=2, ensure_ascii=False) + "\n")
    print(f"\nupdated {NICHES_JSON} with 'image' field for {len(by_id)} niches")


if __name__ == "__main__":
    main()