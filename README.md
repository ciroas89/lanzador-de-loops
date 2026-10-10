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
- `docs/`: lo que publica GitHub Pages.

Después de cambiar `fuente/index.html`:

```
cd fuente
python3 build.py ../docs
```
