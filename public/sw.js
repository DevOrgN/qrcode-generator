/* Production worker. The build helper replaces the precache marker with URLs
   derived from the finished build so first-visit installation is complete. */
const CACHE_PREFIX = `custom-qrcode-generator-${new URL(self.registration.scope).pathname}-static-`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PRECACHE_URLS = self.__PRECACHE_URLS__ || [];

function localUrl(path) {
  const url = new URL(path, self.registration.scope);
  return url.origin === self.location.origin ? url.href : null;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = [...new Set([localUrl('./'), ...PRECACHE_URLS.map(localUrl)].filter(Boolean))];
    await Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
      if (!response.ok || new URL(response.url).origin !== self.location.origin) {
        throw new Error('Offline resources could not be installed completely.');
      }
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin ||
      !requestUrl.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && new URL(response.url).origin === self.location.origin) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (request.mode === 'navigate') {
        const fallback = await cache.match(localUrl('./'));
        if (fallback) return fallback;
      }
      return new Response('Offline and this resource is not available locally.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
