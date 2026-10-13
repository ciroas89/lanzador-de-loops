#!/usr/bin/env python3
"""Dibuja los íconos del afinador: un parche visto desde arriba con sus tensores."""
import math, os
from PIL import Image, ImageDraw

def dibujar(tam, margen):
    S = 4  # se dibuja grande y se reduce para suavizar bordes
    n = tam * S
    im = Image.new('RGBA', (n, n), '#0f1012')
    d = ImageDraw.Draw(im)
    c = n / 2
    r = (n / 2) * (1 - margen)
    aro = r * 0.80
    d.ellipse([c - aro - r * .07, c - aro - r * .07, c + aro + r * .07, c + aro + r * .07], fill='#34383f')
    d.ellipse([c - aro, c - aro, c + aro, c + aro], fill='#e9e4d8')
    # Ondas del golpe
    for k, a in ((0.55, '#ff6a1f'), (0.33, '#ff6a1f')):
        rr = aro * k
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=a, width=int(r * .055))
    d.ellipse([c - aro * .1, c - aro * .1, c + aro * .1, c + aro * .1], fill='#ff6a1f')
    # Tensores
    for i in range(6):
        ang = -math.pi / 2 + i * math.pi / 3
        x, y, lr = c + r * .93 * math.cos(ang), c + r * .93 * math.sin(ang), r * .085
        d.ellipse([x - lr, y - lr, x + lr, y + lr], fill='#ffc61a')
    return im.resize((tam, tam), Image.LANCZOS)

def generar(carpeta):
    os.makedirs(carpeta, exist_ok=True)
    dibujar(192, .04).save(os.path.join(carpeta, 'icon-192.png'))
    dibujar(512, .04).save(os.path.join(carpeta, 'icon-512.png'))
    dibujar(512, .22).save(os.path.join(carpeta, 'maskable-512.png'))
    dibujar(180, .06).convert('RGB').save(os.path.join(carpeta, 'apple-touch-icon.png'))

if __name__ == '__main__':
    import sys
    generar(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'afinador', 'icons'))
