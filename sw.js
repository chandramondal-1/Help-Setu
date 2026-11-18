/* HelpSetu service worker — offline-first app shell and verified directory. */
'use strict';

const VERSION = 'helpsetu-v1.2.3';
const CORE = [
  './',
  'index.html',
  'styles.css?v=1.2.3',
  'data.js?v=1.2.3',
  'i18n.js?v=1.2.3',
  'i18n-extra.js?v=1.2.3',
  'data-i18n.js?v=1.2.3',
  'core.js?v=1.2.3',
  'views.js?v=1.2.3',
  'views2.js?v=1.2.3',
  'manifest.webmanifest?v=1.2.3',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || !response.ok) throw new Error('Network response was not ok');
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
