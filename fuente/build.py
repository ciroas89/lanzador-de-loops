#!/usr/bin/env python3
"""Genera la versión instalable y sin internet a partir de index.html.
Uso: python3 build.py [carpeta_de_salida]   (por defecto: app)"""
import hashlib, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
# Fuentes locales en lugar de Google Fonts
src = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">', '<link rel="stylesheet" href="fonts/fonts.css">', src)
head = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f1012">
<meta name="description" content="Lanza loops de percusión en vivo: merengue, salsa, bachata, cumbia, gospel y worship.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Loops">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
"""
# <title>, fuentes y <style> van al head; el resto al body
cut = src.index('</style>') + len('</style>')
sw = """<script>
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
</script>
"""
page = head + src[:cut] + '\n</head>\n<body>\n' + src[cut:].lstrip() + sw + '</body>\n</html>\n'
app = os.path.abspath(os.path.join(here, sys.argv[1] if len(sys.argv) > 1 else 'app'))
open(os.path.join(app, 'index.html'), 'w', encoding='utf-8').write(page)
# Lista de archivos a guardar sin internet + versión por contenido
files = ['./', 'index.html', 'manifest.webmanifest']
for d in ('fonts', 'icons'):
    files += [f'{d}/{f}' for f in sorted(os.listdir(os.path.join(app, d)))]
h = hashlib.sha1()
for f in files[1:]:
    h.update(open(os.path.join(app, f), 'rb').read())
sw_js = open(os.path.join(here, 'sw.template.js'), encoding='utf-8').read()
sw_js = sw_js.replace('__VERSION__', h.hexdigest()[:10]).replace('__FILES__', ',\n  '.join(f"'{f}'" for f in files))
open(os.path.join(app, 'sw.js'), 'w', encoding='utf-8').write(sw_js)
print(app, 'listo, versión', h.hexdigest()[:10], '·', len(files), 'archivos')
