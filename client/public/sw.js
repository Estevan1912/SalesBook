// Offline support, same approach as the commission tracker: network-first so a fresh deploy is never
// masked by a stale cache, falling back to the cache when offline. Bump CACHE to force a clean slate.
var CACHE = 'sb-cache-v1';
var SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Also cache the hashed JS/CSS that index.html points at, so the app opens offline
      // even if the first visit happened before this worker took over.
      return fetch('/index.html', { cache: 'no-store' })
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var assets = (html.match(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g) || [])
            .map(function (m) { return '/' + m.replace(/^(?:src|href)="\.?\/?/, '').slice(0, -1); });
          return c.addAll(SHELL.concat(assets));
        });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
        return cached || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error());
      });
    })
  );
});
