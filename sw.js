// Mariana Runner — offline app-shell cache for the installed PWA.
//
// Strategy: network-first for the app's own code (HTML/CSS/JS), so a
// phone that already installed this PWA always gets the latest game
// logic/markup when it has any connectivity, falling back to the cached
// copy only when offline. Cache-first for static assets (sprites, icons,
// fonts, manifest) that rarely change, for fast/offline loading.
//
// CACHE_NAME must be bumped whenever this file's bytes need to reach
// already-installed clients sooner — bumping it changes this script's
// content, which is what makes the browser notice an update is
// available. (v2, 2026-09-05: added js/skins.js + js/skin-effects.js to
// the precache list, and switched code files to network-first — v1's
// cache-first-forever strategy meant nothing published after a user's
// first visit ever reached their already-installed copy.)
const CACHE_NAME = 'mariana-runner-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/particles.js',
  './js/skins.js',
  './js/sprites.js',
  './js/skin-effects.js',
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

// Requests whose content changes as the game is developed — always prefer
// a fresh network copy for these. Everything else (sprites, icons, fonts,
// manifest) is served cache-first since it rarely changes and benefits
// more from instant/offline loading than from always-fresh delivery.
function isAppCode(url) {
  return url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');
}

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
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isAppCode(url)) {
    // Network-first: always try to get the latest game code when online;
    // only fall back to whatever's cached when the network fetch fails.
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

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
