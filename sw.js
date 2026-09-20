// Офлайн-режим: страницу сайта берём из сети, а без интернета отдаём сохранённую копию.
// Запросы к облаку (вход, база данных) не трогаем, ими управляет Firebase.
const CACHE = 'domashka-v2';
const ASSETS = ['./', './index.html', './firebase-config.js', './manifest.webmanifest', './favicon.svg',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy));
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Библиотеки Firebase и шрифты версионированы и не меняются: берём из кэша, если уже скачаны.
  const immutable = (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) ||
    url.hostname === 'fonts.gstatic.com';
  const fontsCss = url.hostname === 'fonts.googleapis.com';
  if (!sameOrigin && !immutable && !fontsCss) return;

  if (immutable) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => (res.ok || res.type === 'opaque') ? put(req, res) : res)));
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => (res.ok || res.type === 'opaque') ? put(req, res) : res)
      .catch(() => caches.match(req).then((hit) => hit || (sameOrigin ? caches.match('./index.html') : Response.error())))
  );
});
