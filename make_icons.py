# Нишонаи барномаро месозад ва ба papkahoi Android менависад.
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/res'
BLUE = (43, 68, 214, 255)
YEL = (255, 183, 3, 255)
WHITE = (255, 255, 255, 255)

def draw_logo(size, bg, scale, circle=False):
    S = 1024
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        d.rectangle([0, 0, S, S], fill=BLUE)
    k = S * scale / 48.0
    ox = (S - 48 * k) / 2
    oy = (S - 48 * k) / 2 + 1.5 * k
    P = lambda pts: [(ox + x * k, oy + y * k) for x, y in pts]
    d.polygon(P([(24, 9), (41, 17), (24, 25), (7, 17)]), fill=YEL)
    d.polygon(P([(14, 23), (14, 31), (17, 34.5), (24, 37), (31, 34.5), (34, 31), (34, 23), (24, 28)]), fill=WHITE)
    d.rectangle([ox + 39 * k, oy + 17 * k, ox + 41.5 * k, oy + 30 * k], fill=YEL)
    if circle:
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).ellipse([0, 0, S, S], fill=255)
        im.putalpha(m)
    return im.resize((size, size), Image.LANCZOS)

dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, px in dens.items():
    d = os.path.join(res, 'mipmap-' + name)
    os.makedirs(d, exist_ok=True)
    draw_logo(px, True, 0.80).save(os.path.join(d, 'ic_launcher.png'))
    draw_logo(px, True, 0.80, circle=True).save(os.path.join(d, 'ic_launcher_round.png'))
    fg = int(px * 108 / 48)
    draw_logo(fg, False, 0.56).save(os.path.join(d, 'ic_launcher_foreground.png'))

vals = os.path.join(res, 'values')
os.makedirs(vals, exist_ok=True)
with open(os.path.join(vals, 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2B44D6</color>\n</resources>\n')
print('icons ok')
