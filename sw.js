// sw.js — Bloom's service worker: makes it installable + work offline.
// Strategy: NETWORK-FIRST for same-origin GETs — always serve the freshest code
// when online (so updates land immediately), fall back to cache only when offline.
// The app shell is precached so a fully-offline first paint still works.
// Cross-origin requests (Google Fonts, Supabase auth/sync) are left untouched.
const CACHE = 'bloom-v2';
const CORE = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Timer notifications are posted through this worker so they persist in the OS
// notification centre — tapping one brings Bloom back rather than opening a new tab.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow ? self.clients.openWindow('./') : undefined;
    }),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // fonts + Supabase go straight to network

  e.respondWith(
    fetch(request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
      }
      return res;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match('index.html'))),
  );
});
