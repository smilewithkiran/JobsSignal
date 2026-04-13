// ============================================================
// JobsSignal Service Worker — PWA
// Version: 1.0
// ============================================================

const CACHE_NAME     = 'jobssignal-v1';
const OFFLINE_URL    = '/';

// Files to cache for offline/fast loading
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── INSTALL: Cache core assets ────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(CACHE_ASSETS).catch(err => {
          // Partial cache failure is OK — just log it
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: Clean old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: Network first, cache fallback ─────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET, cross-origin, and API requests
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.includes('countapi') ||
    event.request.url.includes('razorpay') ||
    event.request.url.includes('fonts.googleapis') ||
    event.request.url.includes('fonts.gstatic')
  ) {
    return; // Let browser handle it normally
  }

  event.respondWith(
    // Try network first (always get fresh content)
    fetch(event.request)
      .then(networkResponse => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If nothing in cache — serve the main app (index.html)
          return caches.match('/index.html');
        });
      })
  );
});

// ── PUSH NOTIFICATIONS (Android) ──────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || '📡 JobsSignal';
  const options = {
    body:    data.body    || 'New recruiter signals available in your city!',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
    actions: [
      { action: 'search', title: '📡 Search Now' },
      { action: 'dismiss', title: 'Later' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'search' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

console.log('[SW] JobsSignal service worker loaded ✅');
