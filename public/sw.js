// Service worker: lets the app OPEN with no signal.
// It saves the app's own files (page, scripts, fonts) on the phone/laptop and serves them
// when the network is not available. It never touches Firestore, exchange rates or Maps:
// those are different websites, so the app handles them itself.
//
// If you ever change this file, change VERSION too so everyone gets the new one.

const VERSION = 'v1';
const CACHE = 'travel-app-' + VERSION;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith('travel-app-') && k !== CACHE).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// The page tells us which files it loaded, so the very first visit is saved too
// (files loaded before the worker started would otherwise be missed).
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        data.urls.map(async url => {
          try {
            const res = await fetch(url);
            if (res && res.ok) await cache.put(url === self.location.origin + '/' ? '/' : url, res);
          } catch (e) {
            // skip anything that cannot be fetched right now
          }
        })
      );
    })()
  );
});

const slow = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), ms));

// Try the network first (so updates arrive), but use the saved copy when offline or very slow
async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => {
    if (res && res.ok && res.status === 200) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  net.catch(() => {});
  try {
    return await Promise.race([net, slow(4000)]);
  } catch (e) {
    const hit = await cache.match(key);
    return hit || net;
  }
}

// Files with a fingerprint in their name never change, so the saved copy is used first
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firestore, rates, Maps, etc.

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, '/'));
  } else if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req, req));
  }
});
