const CACHE_NAME = 'lexipulse-v1';
const STATIC_ASSETS = [
  '/LexiPulse/',
  '/LexiPulse/index.html',
  '/LexiPulse/manifest.json',
  '/LexiPulse/icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // GAS API 請求：直接走網路，不快取
  if (e.request.url.includes('script.google.com')) return;
  // CDN 資源：網路優先，失敗用快取
  if (e.request.url.includes('cdn.tailwindcss.com') || e.request.url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // App shell：快取優先，背景更新
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
