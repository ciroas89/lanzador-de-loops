# Lanzador de Loops

App web para lanzar loops de percusión en vivo: merengue, salsa, bachata, cumbia, gospel y worship. Funciona como un controlador de 16 pads, se instala en el celular o la computadora y funciona sin internet.

**Abrir la app:** https://ciroas89.github.io/lanzador-de-loops/

## Qué hace

- 16 pads: 12 loops incluidos y 4 libres para tus propios loops en WAV.
- Cambio de loop a tiempo, al terminar el ciclo.
- BPM con barra, botones y tap tempo.
- Pad ambiental en el tono que elijas, que se enciende solo con los loops worship.
- Modo escenario para quien lanza en vivo: solo pads, BPM y pad ambiental.
- Exportar a Ableton: un .zip con cada loop en WAV (con el BPM en el nombre) y su MIDI.
- Se instala desde el navegador ("Agregar a pantalla de inicio" o "Instalar app") y funciona sin internet.

## Estructura

- `fuente/index.html`: la app completa en un solo archivo (HTML, CSS y JavaScript con Web Audio).
- `fuente/build.py`: genera la versión publicada en `docs/` (manifiesto, service worker, fuentes e íconos locales).
- `docs/`: la versión lista para publicar. GitHub Pages publica una copia de esta carpeta desde la rama `gh-pages`.

Después de cambiar `fuente/index.html`:

```
cd fuente
python3 build.py ../docs
```

Luego copia el contenido de `docs/` a la rama `gh-pages` para publicarlo.

## Afinador de parches

App aparte para afinar parches de batería con el micrófono del celular: iguala los tensores (golpe cerca de cada tensor) y mide la nota de cada tambor (golpe en el centro). También se instala y funciona sin internet.

**Abrir el afinador:** https://ciroas89.github.io/lanzador-de-loops/afinador/

- `afinador/index.html`: la interfaz.
- `afinador/analisis.js`: el motor (detección de golpes y medición de frecuencia).
- `afinador/prueba.js`: prueba de precisión con golpes simulados (`node afinador/prueba.js`).
- `afinador/build.py`: genera la versión publicada en `docs/afinador/`.

Después de cambiar el afinador:

```
cd afinador
python3 build.py
```

Luego copia `docs/afinador/` a la rama `gh-pages` (dentro de la carpeta `afinador/`) para publicarlo.
