// Guarda la app completa en el dispositivo para que funcione sin internet.
const CACHE = 'lanzador-95d0761662';
const FILES = [
  './',
  'index.html',
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
    .then(keys => Promise.all(keys.filter(k => k.startsWith('lanzador-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  // Android: "Compartir → Lanzador de Loops" desde WhatsApp u otra app manda el set aquí.
  if (e.request.method === 'POST' && new URL(e.request.url).searchParams.has('compartido')) {
    e.respondWith((async () => {
      const fd = await e.request.formData(), c = await caches.open('compartido-lanzador');
      for (const k of await c.keys()) await c.delete(k);
      let n = 0;
      for (const f of fd.getAll('set')) if (f && f.size) await c.put(`compartido/${n++}?name=${encodeURIComponent(f.name || 'set.lanzador')}`, new Response(f));
      return Response.redirect('./?abrir-compartido', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
