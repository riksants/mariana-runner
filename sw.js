// Mariana Runner — offline app-shell cache for the installed PWA.
// Cache-first for same-origin app assets so the game launches instantly
// and keeps working without a connection once installed.
const CACHE_NAME = 'mariana-runner-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/particles.js',
  './js/sprites.js',
  './js/audio.js',
  './js/game.js',
  './assets/favicon.svg',
  './assets/icons/icon-120.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-167.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sprites/bush.png',
  './assets/sprites/cactus_round.png',
  './assets/sprites/cactus_tall.png',
  './assets/sprites/cat_idle_01.png',
  './assets/sprites/cat_idle_02.png',
  './assets/sprites/cat_jump_01.png',
  './assets/sprites/cat_jump_02.png',
  './assets/sprites/cat_jump_03.png',
  './assets/sprites/cat_jump_04.png',
  './assets/sprites/cat_run_01.png',
  './assets/sprites/cat_run_02.png',
  './assets/sprites/cat_run_03.png',
  './assets/sprites/cat_run_04.png',
  './assets/sprites/cat_run_05.png',
  './assets/sprites/cat_run_06.png',
  './assets/sprites/cat_run_07.png',
  './assets/sprites/cat_run_08.png',
  './assets/sprites/cat_run_09.png',
  './assets/sprites/cat_run_10.png',
  './assets/sprites/cat_run_11.png',
  './assets/sprites/cat_run_12.png',
  './assets/sprites/cloud_big.png',
  './assets/sprites/cloud_small1.png',
  './assets/sprites/fence.png',
  './assets/sprites/girl_idle_01.png',
  './assets/sprites/girl_idle_02.png',
  './assets/sprites/girl_jump_01.png',
  './assets/sprites/girl_jump_02.png',
  './assets/sprites/girl_jump_03.png',
  './assets/sprites/girl_jump_04.png',
  './assets/sprites/girl_run_01.png',
  './assets/sprites/girl_run_02.png',
  './assets/sprites/girl_run_03.png',
  './assets/sprites/girl_run_04.png',
  './assets/sprites/girl_run_05.png',
  './assets/sprites/girl_run_06.png',
  './assets/sprites/girl_run_07.png',
  './assets/sprites/girl_run_08.png',
  './assets/sprites/girl_run_09.png',
  './assets/sprites/girl_run_10.png',
  './assets/sprites/girl_run_11.png',
  './assets/sprites/girl_run_12.png',
  './assets/sprites/ground_tile.png',
  './assets/sprites/mountains.png',
  './assets/sprites/rock_big.png',
  './assets/sprites/rock_small.png',
  './assets/sprites/sign.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
