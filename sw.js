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
// first visit ever reached their already-installed copy. v3, 2026-09-05:
// removed js/skin-effects.js — it no longer exists, and cache.addAll()
// fails its entire install if even one precached URL 404s. v4, 2026-09-05:
// added js/achievements.js. v5, 2026-09-11: favicon.svg replaced with
// favicon.png (new logo). v6, 2026-09-11: icon/favicon URLs versioned
// with ?v=2 so Android/Chrome/desktop installs pick up new artwork right
// away instead of waiting on HTTP cache to expire — iOS ignores this
// (see index.html note) and still needs a manual remove/re-add. v7,
// 2026-09-11: re-cropped the icon art to remove a baked-in black
// border/margin around the logo; bumped to ?v=3. v8, 2026-09-12: biome
// system rebuilt from scratch (new selva/neve/vulcao art + obstacles at
// the same filenames as the old ones) — bumped so a browser that already
// cached the old biome images under those URLs fetches the new ones. v9,
// 2026-09-12: fixed opaque-white backgrounds on biome obstacles/clouds
// (real transparency) and full-width biome backdrops (no more visible
// box seam) — same filenames again, bumped again. v10, 2026-09-12:
// re-cropped biome_vulcao_bg.png to exclude a leftover dark corner
// fragment from the reference sheet border. v11, 2026-09-12: biome
// system replaced again — new selva/neve/vulcao art (fresh source
// sheets, real alpha) at new filenames (biome_*_cloud2.png,
// biome_decor_*_1/2.png added; old biome_obstacle_*.png etc. replaced
// in place), old sweep-transition code removed in favor of a portal
// checkpoint every 7000 points + a loading-screen cutover; index.html
// gained #overlay-transition. v12, 2026-09-12: illustrated portal art
// replaces the canvas-drawn placeholder, and selva/neve/vulcao were
// rebuilt from new reference sheets — every biome_* filename is reused,
// so an installed copy would otherwise keep serving the old art. v13,
// 2026-09-12: portal sheets downscaled to 900px tall — the largest size
// the game ever draws them, so nothing upscales — and re-encoded as
// WebP, taking the boot payload from ~8.2MB to ~3.6MB. The .png copies
// are gone, so an installed client holding them must fetch the new
// .webp URLs. v14, 2026-09-12: added js/cloud-save.js + js/account-ui.js
// to the shell so the account screen works offline too. The Supabase
// calls themselves are cross-origin and POST, so the fetch handler below
// already ignores them — no change to caching strategy was needed.)
const CACHE_NAME = 'mariana-runner-v14';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/cloud-save.js',
  './js/account-ui.js',
  './js/particles.js',
  './js/skins.js',
  './js/achievements.js',
  './js/sprites.js',
  './js/audio.js',
  './js/game.js',
  './assets/favicon.png?v=3',
  './assets/icons/icon-120.png?v=3',
  './assets/icons/icon-152.png?v=3',
  './assets/icons/icon-167.png?v=3',
  './assets/icons/icon-180.png?v=3',
  './assets/icons/icon-192.png?v=3',
  './assets/icons/icon-512.png?v=3',
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
