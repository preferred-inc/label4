const CACHE_NAME = 'label4-v2';
const PRECACHE_URLS = [
  '/label4/',
  '/label4/index.html',
  '/label4/style.css',
  '/label4/script.js',
  '/label4/dialog.js',
  '/label4/fonts.css',
  '/label4/print.css',
  '/label4/build/pdf.js',
  '/label4/build/pdf.worker.js',
  '/label4/manifest.json',
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Strip dialog.js auto-load event listener (existing behavior)
  if (request.url.includes('/label4/dialog.js')) {
    event.respondWith(
      fetch(request).then(async (response) => {
        const body = await response.text();
        const toIndex = body.indexOf('window.addEventListener');
        return new Response(
          toIndex === -1 ? body : body.substring(0, toIndex),
          { headers: response.headers }
        );
      }).catch(() => caches.match(request))
    );
    return;
  }

  // HTML: network first, fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
