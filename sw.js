// Service worker mínimo: cachea solo el "shell" estático de la app (HTML/CSS/JS/iconos)
// para que cargue al instante y funcione sin conexión en visitas repetidas. opencv.js (CDN
// de terceros, ~10MB) nunca se cachea aquí a propósito: es cross-origin y una respuesta
// opaca no deja distinguir un fetch fallido de uno correcto, así que cachearla mal podría
// dejar la app atascada sirviendo un WASM roto sin forma de detectarlo — se apoya en la
// propia caché HTTP del navegador (cache-control: max-age=86400 en el CDN) en su lugar.
//
// Sube CACHE_NAME (y el número de versión en CHANGELOG.md/README) en cada despliegue con
// cambios visibles en index.html/css/js — es lo único que hace que el navegador note una
// versión nueva del service worker y dispare el aviso de "Recargar" (ver main.js).
const CACHE_NAME = 'zscanner-v0.12.1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/dom.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/camera.js',
  '/js/detection.js',
  '/js/adjust.js',
  '/js/perspective.js',
  '/js/main.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!SHELL_FILES.includes(url.pathname)) return;

  // Stale-while-revalidate: sirve la copia cacheada al instante (rápido, funciona offline)
  // pero siempre pide también una fresca en segundo plano y actualiza la caché para la
  // próxima vez.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request.url, { cache: 'reload' })
          .then(async (response) => {
            // Solo se cachea una respuesta buena: sin esto, un 500/404 pasajero justo en
            // esta revalidación de fondo se guardaría como si fuera contenido válido.
            if (response.ok) await cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        event.waitUntil(network);
        return cached || network;
      })
    )
  );
});
