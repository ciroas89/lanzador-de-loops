// Guarda el afinador completo en el dispositivo para que funcione sin internet.
const CACHE = 'afinador-80208acf56';
const FILES = [
  './',
  'index.html',
  'analisis.js',
  'manifest.webmanifest',
  'fonts/Archivo-latin-ext.woff2',
  'fonts/Archivo-latin.woff2',
  'fonts/Figtree-latin-ext.woff2',
  'fonts/Figtree-latin.woff2',
  'fonts/JetBrainsMono-latin-ext.woff2',
  'fonts/JetBrainsMono-latin.woff2',
  'fonts/fonts.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('afinador-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
