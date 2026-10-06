"""Renders the two dot-matrix pictures used on the intro (slide 4) and briefing (slide 10) decks.
One dot per client; gold dots are the multi-service accounts. Run: python3 make-dots.py   (needs Pillow)"""
from PIL import Image, ImageDraw
S = 3  # supersample

def dots(path, w, h, n, cols, rows, lit, base, litcol, r):
    im = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sx, sy, k = w / cols, h / rows, 0
    for ry in range(rows):
        for cx in range(cols):
            if k >= n: break
            x, y = (cx + .5) * sx * S, (ry + .5) * sy * S
            if k in lit:
                rr = lit[k] * S
                d.ellipse((x - rr * 1.9, y - rr * 1.9, x + rr * 1.9, y + rr * 1.9), fill=litcol + (60,))
                d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=litcol + (255,))
            else:
                d.ellipse((x - r * S, y - r * S, x + r * S, y + r * S), fill=base)
            k += 1
    im.resize((w * 2, h * 2), Image.LANCZOS).save(path)

GREY, GOLD = (148, 163, 184, 150), (255, 193, 14)
dots('intro-dots.png', 1124, 230, 1366, 106, 13, {7 * 106 + 72: 4.0}, GREY, GOLD, 2.0)
dots('brief-dots.png', 560, 330, 1531, 51, 30, {212: 3.2, 640: 3.2, 1103: 3.2, 905: 5.0}, GREY, GOLD, 2.0)
