/**
 * ============================================================
 *  СКЛАД MONE — Service Worker
 * ============================================================
 *
 *  СТРАТЕГИЯ КЕШИРОВАНИЯ:
 *  ─────────────────────
 *  • Статика (HTML, CSS, JS, шрифты) — cache-first, обновление в фоне.
 *    Это позволяет приложению открываться мгновенно даже без сети.
 *  • Firebase (firebasedatabase.app, googleapis.com) — НЕ кешируем.
 *    Firebase SDK сам поддерживает офлайн-режим через IndexedDB.
 *  • POST/PUT/DELETE запросы — никогда не трогаем.
 *
 *  ОБНОВЛЕНИЕ ВЕРСИИ:
 *  При изменении CACHE_VERSION старый кеш удаляется при активации.
 *  Это происходит автоматически при выпуске новой версии приложения.
 */

const CACHE_VERSION = 'mone-v1.0.0';
const CACHE_NAME    = `mone-cache-${CACHE_VERSION}`;

/** Файлы которые предзагружаются при установке (минимальный shell) */
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
];

/** Установка — предзагружаем shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[SW] Precache failed:', err))
      .then(() => self.skipWaiting()) // активируемся сразу
  );
});

/** Активация — чистим старые кеши */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('mone-cache-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/** Перехват запросов */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Пропускаем не-GET запросы
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase и Google APIs — всегда сеть, без кеша.
  // У Firebase SDK свой офлайн-механизм через IndexedDB.
  if (
    url.hostname.includes('firebasedatabase.app')   ||
    url.hostname.includes('firebaseio.com')          ||
    url.hostname.includes('googleapis.com')          ||
    url.hostname.includes('gstatic.com')             ||
    url.hostname.includes('google-analytics.com')
  ) {
    return;
  }

  // Стратегия для остальных запросов: cache-first с фоновым обновлением
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(networkRes => {
        // Кешируем только успешные ответы
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const cloned = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, cloned));
        }
        return networkRes;
      }).catch(() => cached); // нет сети — возвращаем кеш

      // Cache-first: сразу отдаём кеш если есть, иначе ждём сеть
      return cached || fetchPromise;
    })
  );
});

/** Слушаем сообщения от приложения */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
