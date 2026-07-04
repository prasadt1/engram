/* Minimal PWA shell — offline navigation fallback + runtime font cache. */
const CACHE = 'iris-shell-v3';

function isSameOriginFont(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.json', '/favicon.svg', '/favicon.png']),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isSameOriginFont(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          void cache.put(event.request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/')),
      ),
    );
  }
});
