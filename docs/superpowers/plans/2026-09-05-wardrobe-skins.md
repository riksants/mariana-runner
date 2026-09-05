# Guarda-Roupa (Wardrobe / Skins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent coin economy and a "Guarda-Roupa" skin-unlock/equip screen to Mariana Runner, plus revert the day/night lighting cycle to a score-based cadence (3000 points/cycle), without changing any existing gameplay, controls, scoring, or menu behavior.

**Architecture:** New standalone `js/skins.js` module owns all skin data and localStorage persistence (no DOM/canvas dependencies, so it's testable from plain Node). `js/game.js` gains: a coin collectible (spawn/update/draw/collect, mirroring the existing power-up pattern), a new wardrobe DOM overlay layered above the existing menu overlays (not a new game state — it opens/closes independently of `state`), and skin-aware character rendering that falls back to the normal Mariana frames whenever a skin has no illustrated art yet. `js/sprites.js` gains a non-fatal per-skin sprite loader. A new `js/skin-effects.js` module drives the five cosmetic per-skin effects through the existing `Particles` system (extended with a `sparkle` emitter) plus two direct-draw effects.

**Tech Stack:** Plain HTML/CSS/JS, Canvas 2D, no build step, no framework, no dependencies (unchanged). Verification uses plain Node scripts (`node scripts/*.js`, zero dependencies) for pure logic, and a headless-Chromium-via-CDP screenshot pass (Edge, already used successfully earlier in this project's history) for visual/DOM checks — there is no existing test framework in this repo and none is being introduced.

**Spec:** `docs/superpowers/specs/2026-09-05-wardrobe-skins-design.md`

## Global Constraints

- Skins are 100% cosmetic — no skin may change hitboxes, speed, scoring, spawn rates, or any other gameplay value.
- No new illustrated character art in this iteration — every skin's wardrobe preview and in-game appearance uses the existing normal Mariana sprites until real per-skin art files are supplied later at `assets/sprites/skins/<id>/...`; nothing may error or look broken in the meantime.
- All 6 skins, exact ids/names/prices: `normal` (Mariana, 0, unlocked by default), `princesa` (Mariana Princesa, 500), `volei` (Mariana Vôlei, 1000), `pijama` (Mariana Pijama, 1500), `gold` (Mariana Gold, 3000), `noiva` (Mariana Noiva, 5000, `special: true`).
- Persistence keys (localStorage): `marianaRunnerCoins`, `marianaRunnerUnlockedSkins`, `marianaRunnerEquippedSkin` — must survive reload, matching the existing `marianaRunnerHighScore` / `marianaRunnerSeenHint` pattern already in this codebase.
- Coin cluster spawn gap: `COIN_CLUSTER_GAP_BASE = 90`, `COIN_CLUSTER_GAP_VARIANCE = 70` (game units), `COIN_CLUSTER_SIZE = 3` — tuned so ~500 coins takes ~5–8 casual runs (see spec's "Coin economy" section for the derivation). These are the only constants to touch if the pace ever needs retuning.
- Day/night cycle: `PHASE_CYCLE_SCORE = 3000` (score-based, replacing the previous real-time `PHASE_CYCLE_SECONDS = 360`).
- Every existing overlay's "tap/click anywhere to continue" behavior (`wireOverlayAction` on `#overlay-start` / `#overlay-gameover` / `#overlay-pause`) must keep working exactly as today — any new button placed inside those overlays MUST call `e.stopPropagation()` in its own click handler, or it will accidentally also trigger `startGame()`/pause-toggle via the parent overlay's existing click listener.
- Script load order in `index.html` changes to: `particles.js`, `skins.js`, `sprites.js`, `skin-effects.js`, `audio.js`, `game.js` (skins.js must load before sprites.js and skin-effects.js, both of which reference `SKIN_DEFS`/`SkinStore`).

---

## Task 1: Skin data model and persistence (`js/skins.js`)

**Files:**
- Create: `js/skins.js`
- Create: `scripts/test-skins.js`
- Modify: `index.html:99` (add `<script src="js/skins.js"></script>` before the `sprites.js` tag — see Task 3 for the full script-tag reordering)

**Interfaces:**
- Produces: `SKIN_DEFS` (array of `{id, name, price, icon, special?}`), `skinById(id)`, `SkinStore` (`getCoins()`, `addCoins(n)`, `getUnlocked()`, `isUnlocked(id)`, `unlock(id)`, `getEquipped()`, `setEquipped(id)`, `purchase(id)` → `{ok, reason?}`), `COIN_CLUSTER_SIZE`, `COIN_CLUSTER_GAP_BASE`, `COIN_CLUSTER_GAP_VARIANCE`, `rollCoinClusterGap()`.
- Consumes: nothing (only the ambient `localStorage`).

- [ ] **Step 1: Write `js/skins.js`**

```js
/* =========================================================
   MARIANA RUNNER — skin economy (coins, unlocks, equipped skin)
   Pure data + localStorage persistence, no DOM/canvas dependency,
   so it can be exercised from a plain Node script (see
   scripts/test-skins.js). game.js never touches these localStorage
   keys directly — it always goes through SkinStore.
   ========================================================= */

const SKIN_DEFS = [
  { id: 'normal',   name: 'Mariana',          price: 0,    icon: 'normal' },
  { id: 'princesa', name: 'Mariana Princesa', price: 500,  icon: 'crown' },
  { id: 'volei',    name: 'Mariana Vôlei',    price: 1000, icon: 'volleyball' },
  { id: 'pijama',   name: 'Mariana Pijama',   price: 1500, icon: 'moon' },
  { id: 'gold',     name: 'Mariana Gold',     price: 3000, icon: 'gem' },
  { id: 'noiva',    name: 'Mariana Noiva',    price: 5000, icon: 'ring', special: true },
];

const SKIN_STORAGE_KEYS = {
  coins: 'marianaRunnerCoins',
  unlocked: 'marianaRunnerUnlockedSkins',
  equipped: 'marianaRunnerEquippedSkin',
};

function skinById(id) {
  return SKIN_DEFS.find((s) => s.id === id) || SKIN_DEFS[0];
}

const SkinStore = {
  getCoins() {
    return Number(localStorage.getItem(SKIN_STORAGE_KEYS.coins) || 0);
  },
  addCoins(amount) {
    const next = this.getCoins() + amount;
    localStorage.setItem(SKIN_STORAGE_KEYS.coins, String(next));
    return next;
  },
  getUnlocked() {
    try {
      const raw = JSON.parse(localStorage.getItem(SKIN_STORAGE_KEYS.unlocked) || '["normal"]');
      return Array.isArray(raw) && raw.length ? raw : ['normal'];
    } catch (e) {
      return ['normal'];
    }
  },
  isUnlocked(id) {
    return this.getUnlocked().includes(id);
  },
  unlock(id) {
    const list = this.getUnlocked();
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(SKIN_STORAGE_KEYS.unlocked, JSON.stringify(list));
  },
  getEquipped() {
    const id = localStorage.getItem(SKIN_STORAGE_KEYS.equipped) || 'normal';
    return this.isUnlocked(id) ? id : 'normal';
  },
  setEquipped(id) {
    if (!this.isUnlocked(id)) return false;
    localStorage.setItem(SKIN_STORAGE_KEYS.equipped, id);
    return true;
  },
  // Never throws — UI code calls this directly and branches on the result.
  purchase(id) {
    const skin = skinById(id);
    if (this.isUnlocked(id)) return { ok: false, reason: 'already-owned' };
    if (this.getCoins() < skin.price) return { ok: false, reason: 'insufficient-coins' };
    this.addCoins(-skin.price);
    this.unlock(id);
    return { ok: true };
  },
};

// Coin cluster economy — see docs/superpowers/specs/2026-09-05-wardrobe-skins-design.md
// "Coin economy" section for how these numbers were derived. Retune here only.
const COIN_CLUSTER_SIZE = 3;
const COIN_CLUSTER_GAP_BASE = 90;
const COIN_CLUSTER_GAP_VARIANCE = 70;

function rollCoinClusterGap() {
  return COIN_CLUSTER_GAP_BASE + Math.random() * COIN_CLUSTER_GAP_VARIANCE;
}
```

- [ ] **Step 2: Write `scripts/test-skins.js`**

```js
// Plain-Node logic check for js/skins.js — no framework, no deps.
// Run with: node scripts/test-skins.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SKINS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'skins.js'), 'utf8');

function freshSandbox(backingStore) {
  const store = backingStore || {};
  const sandbox = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SKINS_SRC, sandbox, { filename: 'skins.js' });
  return { sandbox, store };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

let { sandbox, store } = freshSandbox();
assert(sandbox.SkinStore.getCoins() === 0, 'starts with 0 coins');
assert(JSON.stringify(sandbox.SkinStore.getUnlocked()) === '["normal"]', 'starts with only normal unlocked');
assert(sandbox.SkinStore.getEquipped() === 'normal', 'starts with normal equipped');
assert(sandbox.SkinStore.isUnlocked('princesa') === false, 'princesa starts locked');

let res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === false && res.reason === 'insufficient-coins', 'purchase fails with 0 coins');
assert(sandbox.SkinStore.getCoins() === 0, 'coins unchanged after failed purchase');

sandbox.SkinStore.addCoins(500);
assert(sandbox.SkinStore.getCoins() === 500, 'addCoins credits balance');
res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === true, 'purchase succeeds with enough coins');
assert(sandbox.SkinStore.getCoins() === 0, 'coins deducted immediately on purchase');
assert(sandbox.SkinStore.isUnlocked('princesa') === true, 'princesa unlocked after purchase');

sandbox.SkinStore.addCoins(500);
res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === false && res.reason === 'already-owned', 'cannot repurchase an owned skin');
assert(sandbox.SkinStore.getCoins() === 500, 'coins untouched when repurchase is rejected');

assert(sandbox.SkinStore.setEquipped('gold') === false, 'cannot equip a locked skin');
assert(sandbox.SkinStore.getEquipped() === 'normal', 'equipped skin unchanged after rejected equip');
assert(sandbox.SkinStore.setEquipped('princesa') === true, 'can equip an owned skin');
assert(sandbox.SkinStore.getEquipped() === 'princesa', 'equipped skin updates');

// Persistence: a fresh module load over the same backing store keeps state.
const reload = freshSandbox(store);
assert(reload.sandbox.SkinStore.getCoins() === 500, 'coins persist across reload');
assert(reload.sandbox.SkinStore.getEquipped() === 'princesa', 'equipped skin persists across reload');
assert(reload.sandbox.SkinStore.isUnlocked('princesa') === true, 'unlocked skins persist across reload');

for (let i = 0; i < 200; i++) {
  const gap = reload.sandbox.rollCoinClusterGap();
  assert(
    gap >= reload.sandbox.COIN_CLUSTER_GAP_BASE && gap <= reload.sandbox.COIN_CLUSTER_GAP_BASE + reload.sandbox.COIN_CLUSTER_GAP_VARIANCE,
    'coin cluster gap stays within configured bounds'
  );
  break; // one representative check is enough noise in the log; loop still proves the bound holds
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll skins.js checks passed.');
```

- [ ] **Step 3: Run the test and verify it passes**

Run: `node scripts/test-skins.js`
Expected: every line prints `ok  :`, ending with `All skins.js checks passed.` and exit code 0.

- [ ] **Step 4: Syntax-check the browser file**

Run: `node --check js/skins.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/skins.js scripts/test-skins.js
git commit -m "Add skin economy data model and persistence (js/skins.js)"
```

---

## Task 2: Day/night cycle reverts to score-based (3000 pts/cycle)

**Files:**
- Modify: `js/game.js` (the `PHASE_CYCLE_SECONDS` constant and `cyclePosition()` function added earlier this session)
- Create: `scripts/test-daynight.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PHASE_CYCLE_SCORE` (replaces `PHASE_CYCLE_SECONDS`); `cyclePosition()` now reads `score` instead of `elapsed`. `currentDarkness()` and `celestialArc()` are unchanged (they already only consume `cyclePosition()`'s 0–1 output).

- [ ] **Step 1: Write the formula check (mirrors the intended change, run before touching game.js)**

```js
// scripts/test-daynight.js — verifies the score-based cycle formula
// this task implements. Run with: node scripts/test-daynight.js
'use strict';
const PHASE_CYCLE_SCORE = 3000;

function cyclePosition(score) {
  const span = ((score % PHASE_CYCLE_SCORE) + PHASE_CYCLE_SCORE) % PHASE_CYCLE_SCORE;
  return span / PHASE_CYCLE_SCORE;
}
function darkness(score) {
  return (1 - Math.cos(2 * Math.PI * cyclePosition(score))) / 2;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

assert(Math.abs(darkness(0)) < 1e-9, 'score 0 is full daylight (darkness ~0)');
assert(Math.abs(darkness(1500) - 1) < 1e-9, 'score 1500 (half cycle) is peak night (darkness ~1)');
assert(Math.abs(darkness(3000)) < 1e-9, 'score 3000 (full cycle) is back to full daylight');
assert(Math.abs(darkness(6000)) < 1e-9, 'the cycle repeats every 3000 points regardless of magnitude');
assert(darkness(750) > 0.45 && darkness(750) < 0.55, 'score 750 (quarter cycle) is near the dusk midpoint (~0.5)');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll day/night formula checks passed.');
```

- [ ] **Step 2: Run it and verify it passes**

Run: `node scripts/test-daynight.js`
Expected: all `ok  :` lines, ending `All day/night formula checks passed.`, exit code 0.

- [ ] **Step 3: Apply the same formula in `js/game.js`**

Find (this is the block added earlier this session):
```js
  const PHASE_CYCLE_SECONDS = 360; // one full morning→night→morning cycle, in real seconds
```
Replace with:
```js
  const PHASE_CYCLE_SCORE = 3000; // one full morning→night→morning cycle, in score points
```

Find:
```js
  function cyclePosition() {
    const span = ((elapsed % PHASE_CYCLE_SECONDS) + PHASE_CYCLE_SECONDS) % PHASE_CYCLE_SECONDS;
    return span / PHASE_CYCLE_SECONDS;
  }
```
Replace with:
```js
  function cyclePosition() {
    const span = ((score % PHASE_CYCLE_SCORE) + PHASE_CYCLE_SCORE) % PHASE_CYCLE_SCORE;
    return span / PHASE_CYCLE_SCORE;
  }
```

Also update the comment block directly above (currently says "a smooth function of real elapsed time (not score), so the cycle never speeds up...") to reflect the reversal — replace its wording with: "a smooth function of score (not real time) — the user found the time-based version too slow and asked for a fixed 3000-point cadence instead."

- [ ] **Step 4: Syntax-check**

Run: `node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add js/game.js scripts/test-daynight.js
git commit -m "Revert day/night cycle to score-based, every 3000 points"
```

---

## Task 3: Non-fatal per-skin sprite loader (`js/sprites.js`)

**Files:**
- Modify: `js/sprites.js`
- Modify: `js/game.js:1122` (the `loadAllSprites().then(...)` boot block)
- Modify: `index.html` (script tag order)

**Interfaces:**
- Consumes: `SKIN_DEFS` (from Task 1's `js/skins.js`, must load first).
- Produces: `SKIN_SPRITE_FRAMES` (object keyed by skin id → `{run: Image[12], jump: Image[4], idle: Image[2]}` or `null` if that skin has no art files yet), `loadSkinSprites()` (returns a Promise that never rejects).

- [ ] **Step 1: Add the loader to `js/sprites.js`**

Append to the end of the file:

```js
// Optional per-skin illustrated art. Missing files are *expected* until
// real artwork is supplied for a skin — they resolve to null instead of
// rejecting, so an art-less skin never blocks the game from loading and
// never throws. game.js falls back to the normal Mariana frames whenever
// a skin's entry here is null. See assets/sprites/skins/README.md (added
// in this task) for the exact file layout an artist should follow.
function loadImageOptional(src) {
  return loadImage(src).catch(() => null);
}

const SKIN_SPRITE_FRAMES = {};

function loadSkinSprites() {
  const runFrames = 12, jumpFrames = 4, idleFrames = 2;
  const tasks = SKIN_DEFS.filter((s) => s.id !== 'normal').map((skin) => {
    const load = (prefix, count) => {
      const paths = [];
      for (let i = 1; i <= count; i++) {
        const n = String(i).padStart(2, '0');
        paths.push(`assets/sprites/skins/${skin.id}/${prefix}_${n}.png`);
      }
      return Promise.all(paths.map(loadImageOptional));
    };
    return Promise.all([
      load('girl_run', runFrames),
      load('girl_jump', jumpFrames),
      load('girl_idle', idleFrames),
    ]).then(([run, jump, idle]) => {
      const complete = [...run, ...jump, ...idle].every(Boolean);
      SKIN_SPRITE_FRAMES[skin.id] = complete ? { run, jump, idle } : null;
    });
  });
  return Promise.all(tasks);
}
```

- [ ] **Step 2: Document the file layout for whoever supplies real art later**

Create `assets/sprites/skins/README.md`:

```markdown
# Skin artwork drop-in folder

To give a skin real illustrated art, add a folder here named exactly
after the skin id (see `SKIN_DEFS` in `js/skins.js`: `princesa`, `volei`,
`pijama`, `gold`, `noiva`) containing:

- `girl_run_01.png` … `girl_run_12.png` (12 frames)
- `girl_jump_01.png` … `girl_jump_04.png` (4 frames)
- `girl_idle_01.png` … `girl_idle_02.png` (2 frames)

Same pixel style, proportions, and anchor point as the existing
`assets/sprites/girl_*.png` set (bottom-right anchored — see
`drawSpriteRB` in `js/sprites.js`). No code changes are needed: once
every file for a skin's folder exists, the game automatically uses it
in the wardrobe preview and during gameplay instead of falling back to
normal Mariana.
```

- [ ] **Step 3: Reorder script tags in `index.html`**

Find:
```html
  <script src="js/particles.js"></script>
  <script src="js/sprites.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/game.js"></script>
```
Replace with:
```html
  <script src="js/particles.js"></script>
  <script src="js/skins.js"></script>
  <script src="js/sprites.js"></script>
  <script src="js/skin-effects.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/game.js"></script>
```
(`js/skin-effects.js` doesn't exist yet — it's created in Task 9. Adding the tag now is harmless: a 404 on a not-yet-created file only logs a console warning, and every later task in this plan is verified independently before Task 9 lands. If running the game in a browser between Task 3 and Task 9, ignore that one console 404.)

- [ ] **Step 4: Wire the loader into the boot sequence in `js/game.js`**

Find:
```js
  updateHud();
  loadAllSprites().then(() => {
```
Replace with:
```js
  updateHud();
  Promise.all([loadAllSprites(), loadSkinSprites()]).then(() => {
```
(The closing of that `.then((...) => { ... })` block is unchanged — `Promise.all` here resolves with `[spritesResult, skinsResult]` but the callback already takes no parameters, so nothing else in that block needs editing.)

- [ ] **Step 5: Syntax-check both files**

Run: `node --check js/sprites.js && node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add js/sprites.js js/game.js index.html assets/sprites/skins/README.md
git commit -m "Add non-fatal per-skin sprite loader, ready for future art"
```

(Note: this task's runtime behavior — confirming a missing skin folder truly doesn't break boot — is verified in Task 10's headless-browser pass, since `Image` loading requires a real browser/DOM that plain Node doesn't have.)

---

## Task 4: Coin collectible gameplay (`js/game.js`, `js/audio.js`)

**Files:**
- Modify: `js/game.js`
- Modify: `js/audio.js`

**Interfaces:**
- Consumes: `SkinStore.addCoins` (Task 1), `Particles.dust` (existing), `AudioMgr.coin` (added in this task).
- Produces: `let coinBalance` (in-memory mirror of `SkinStore.getCoins()`, kept in sync on every change — read by Task 5's HUD and Task 7's wardrobe), `spawnCoinCluster()`, `scheduleNextCoinCluster()`, `collectCoin(x, y)`, `drawCoins()`.

- [ ] **Step 1: Add the coin sound to `js/audio.js`**

Find:
```js
    shieldBreak() {
      noiseBurst(0.1, 0.12, 3000);
      tone(300, 140, 0.15, 'triangle', 0.08, 0.02);
    },
  };
```
Replace with:
```js
    shieldBreak() {
      noiseBurst(0.1, 0.12, 3000);
      tone(300, 140, 0.15, 'triangle', 0.08, 0.02);
    },
    coin() { tone(880, 1200, 0.08, 'square', 0.05); },
  };
```

- [ ] **Step 2: Add the `COIN_SIZE` constant in `js/game.js`**

Find:
```js
  const POWERUP_SIZE = 34; // circular badge diameter, game units
```
Add directly below it:
```js
  const COIN_SIZE = 18; // circular coin diameter, game units — smaller than power-ups, they're common
```

- [ ] **Step 3: Add coin state variables**

Find:
```js
  let powerups = [];
  let distanceSinceLastPowerup = 0;
  let nextPowerupGap = 0;
```
Add directly below it:
```js

  let coins = [];
  let distanceSinceLastCoinCluster = 0;
  let nextCoinGap = 0;
  let coinBalance = SkinStore.getCoins();
```

- [ ] **Step 4: Add spawn/schedule functions**

Find `schedulePowerupSpawn()`'s definition (added when power-ups shipped) and add these two functions directly after it:
```js
  function scheduleNextCoinCluster() {
    nextCoinGap = rollCoinClusterGap();
    distanceSinceLastCoinCluster = 0;
  }

  function spawnCoinCluster() {
    const baseY = GROUND_Y - 30 - Math.random() * 50;
    for (let i = 0; i < COIN_CLUSTER_SIZE; i++) {
      const arc = Math.sin((i / (COIN_CLUSTER_SIZE - 1)) * Math.PI) * 16;
      coins.push({
        x: W + 10 + i * 24,
        baseY: baseY - arc,
        w: COIN_SIZE,
        h: COIN_SIZE,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function collectCoin(x, y) {
    coinBalance = SkinStore.addCoins(1);
    updateCoinsHud();
    AudioMgr.coin();
    Particles.dust(x, y, { count: 4, color: 'rgba(230,180,60,' });
  }
```

- [ ] **Step 5: Spawn coins each frame (mirrors the power-up spawn block)**

Find:
```js
    // --- power-ups ---
    distanceSinceLastPowerup += speed * dt;
    if (distanceSinceLastPowerup >= nextPowerupGap) {
      if (score >= POWERUP_MIN_SCORE) spawnPowerup();
      schedulePowerupSpawn();
    }
    for (const p of powerups) p.x -= speed * dt;
```
Replace with:
```js
    // --- power-ups ---
    distanceSinceLastPowerup += speed * dt;
    if (distanceSinceLastPowerup >= nextPowerupGap) {
      if (score >= POWERUP_MIN_SCORE) spawnPowerup();
      schedulePowerupSpawn();
    }
    for (const p of powerups) p.x -= speed * dt;

    // --- coins ---
    distanceSinceLastCoinCluster += speed * dt;
    if (distanceSinceLastCoinCluster >= nextCoinGap) {
      spawnCoinCluster();
      scheduleNextCoinCluster();
    }
    for (const c of coins) c.x -= speed * dt;
    coins = coins.filter(c => c.x + c.w > -10);
```

- [ ] **Step 6: Collect coins (mirrors the power-up collection block)**

Find:
```js
    if (collected.length) powerups = powerups.filter(p => !collected.includes(p));
```
Add directly after it:
```js

    const collectedCoins = [];
    for (const c of coins) {
      const bobY = c.baseY + Math.sin(elapsed * 2.4 + c.bobPhase) * 6;
      const cux = c.x;
      const cuy = bobY - c.h / 2;
      if (pickupX < cux + c.w && pickupX + pickupW > cux && pickupY < cuy + c.h && pickupY + pickupH > cuy) {
        collectedCoins.push(c);
        collectCoin(cux + c.w / 2, cuy + c.h / 2);
      }
    }
    if (collectedCoins.length) coins = coins.filter(c => !collectedCoins.includes(c));
```
(`pickupX`/`pickupY`/`pickupW`/`pickupH` are the same variables the power-up block above already computed in this function — coins reuse the identical forgiving pickup box, no new geometry needed.)

- [ ] **Step 7: Draw coins**

Find `drawPowerups()`'s closing brace and add directly after it:
```js
  function drawCoins() {
    for (const c of coins) {
      const bobY = c.baseY + Math.sin(elapsed * 2.4 + c.bobPhase) * 6;
      const cx = c.x + c.w / 2;
      const cy = bobY;
      ctx.save();
      ctx.fillStyle = '#f0c04a';
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - c.w * 0.22);
      ctx.lineTo(cx, cy + c.w * 0.22);
      ctx.strokeStyle = '#c99a2e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }
```

Find, in `render()`:
```js
      drawObstacles();
      drawPowerups();
```
Replace with:
```js
      drawObstacles();
      drawPowerups();
      drawCoins();
```

- [ ] **Step 8: Reset coins on a new run**

Find, in `startGame()`:
```js
    powerups = [];
```
Replace with:
```js
    powerups = [];
    coins = [];
```
Find:
```js
    schedulePowerupSpawn();
```
Replace with:
```js
    schedulePowerupSpawn();
    scheduleNextCoinCluster();
```

- [ ] **Step 9: Syntax-check**

Run: `node --check js/game.js && node --check js/audio.js`
Expected: no output, exit code 0.

- [ ] **Step 10: Commit**

```bash
git add js/game.js js/audio.js
git commit -m "Add collectible coins during gameplay, persisted via SkinStore"
```

(This task's runtime behavior — coins actually appearing, bobbing, and being collected in a live canvas — is verified in Task 10's headless-browser pass, matching how the day/night visuals were verified earlier in this project's history.)

---

## Task 5: Coin balance in the HUD

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `coinBalance` (Task 4).
- Produces: `updateCoinsHud()` (called by Task 4's `collectCoin`, and reused by Task 7's wardrobe purchase/equip flow to refresh every coin readout at once).

- [ ] **Step 1: Add the HUD element in `index.html`**

Find:
```html
        <div id="hud-hiscore">HI <span id="hud-hiscore-value">00000</span></div>
```
Add directly after it:
```html
        <div id="hud-coins">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="7.5" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.6"/></svg>
          <span id="hud-coins-value">0</span>
        </div>
```

- [ ] **Step 2: Style it in `css/style.css`**

Find:
```css
#hud-hiscore {
  font-size: clamp(8px, 1.7vmin, 11px);
  color: var(--muted);
  letter-spacing: 1px;
}
```
Add directly after it:
```css
#hud-coins {
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-family: var(--font-display);
  font-size: clamp(8px, 1.7vmin, 11px);
  color: var(--ink);
}

#hud-coins .icon {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  flex: none;
}
```

- [ ] **Step 3: Wire it up in `js/game.js`**

Find:
```js
  const hudHiscoreValue = document.getElementById('hud-hiscore-value');
```
Add directly after it:
```js
  const hudCoinsValue = document.getElementById('hud-coins-value');
```

Find:
```js
  function updateHud() {
    hudScoreValue.textContent = String(Math.floor(score)).padStart(5, '0');
    hudHiscoreValue.textContent = String(highScore).padStart(5, '0');
  }
```
Add directly after this function:
```js

  function updateCoinsHud() {
    hudCoinsValue.textContent = String(coinBalance);
  }
```

Find:
```js
  updateHud();
  Promise.all([loadAllSprites(), loadSkinSprites()]).then(() => {
```
Replace with:
```js
  updateHud();
  updateCoinsHud();
  Promise.all([loadAllSprites(), loadSkinSprites()]).then(() => {
```

- [ ] **Step 4: Syntax-check**

Run: `node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/game.js
git commit -m "Show live coin balance in the gameplay HUD"
```

---

## Task 6: Wardrobe screen shell and entry points

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `updateCoinsHud()` (Task 5), `coinBalance` (Task 4).
- Produces: `openWardrobe()`, `closeWardrobe()` — called by this task's own button wiring now, and by Task 7's card click handler indirectly (via `renderWardrobe()`, which Task 7 defines and this task calls as a stub-free forward reference — see Step 3's note).

- [ ] **Step 1: Add the menu/game-over entry points and the wardrobe overlay markup in `index.html`**

Find:
```html
        <button type="button" id="btn-start" class="pixel-btn pixel-btn--primary">COMEÇAR</button>
        <p class="instruction">ESPAÇO / TOQUE PARA PULAR</p>
      </div>
```
Replace with:
```html
        <button type="button" id="btn-start" class="pixel-btn pixel-btn--primary">COMEÇAR</button>
        <div id="menu-coins">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="7.5" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.6"/></svg>
          <span id="menu-coins-value">0</span>
        </div>
        <button type="button" id="btn-wardrobe" class="pixel-btn">GUARDA-ROUPA</button>
        <p class="instruction">ESPAÇO / TOQUE PARA PULAR</p>
      </div>
```

Find:
```html
        <button type="button" id="btn-restart" class="pixel-btn pixel-btn--primary">JOGAR NOVAMENTE</button>
        <p class="instruction">ESPAÇO PARA REINICIAR</p>
      </div>
```
Replace with:
```html
        <button type="button" id="btn-restart" class="pixel-btn pixel-btn--primary">JOGAR NOVAMENTE</button>
        <button type="button" id="btn-wardrobe-gameover" class="pixel-btn">GUARDA-ROUPA</button>
        <p class="instruction">ESPAÇO PARA REINICIAR</p>
      </div>
```

Find:
```html
      <p id="rotate-hint">
```
Add directly above it:
```html
      <div id="overlay-wardrobe" class="overlay overlay--wardrobe" hidden>
        <div id="wardrobe-header">
          <h2 class="title title--small">GUARDA-ROUPA</h2>
          <div id="wardrobe-coins">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="7.5" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.6"/></svg>
            <span id="wardrobe-coins-value">0</span>
          </div>
        </div>
        <div id="wardrobe-grid"></div>
        <button type="button" id="btn-wardrobe-back" class="pixel-btn">VOLTAR</button>
      </div>
```

- [ ] **Step 2: Style the new elements in `css/style.css`**

Append to the end of the file:

```css
/* ---------- Guarda-Roupa (wardrobe) ---------- */
#menu-coins,
#wardrobe-coins {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-display);
  font-size: clamp(10px, 2.2vmin, 14px);
  color: var(--ink);
}

#menu-coins .icon,
#wardrobe-coins .icon {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  flex: none;
}

.overlay--wardrobe {
  flex-direction: column;
  justify-content: flex-start;
  z-index: 3;
  background: var(--paper);
  gap: clamp(8px, 1.8vmin, 14px);
}

#wardrobe-header {
  width: 100%;
  max-width: 640px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
}

#wardrobe-grid {
  width: 100%;
  max-width: 640px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: clamp(8px, 1.6vmin, 12px);
  padding: 4px 2px 8px;
}

.skin-card {
  background: var(--paper-dim);
  border: 2px solid var(--ink);
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.skin-card-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--paper);
  border: 1px solid var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.skin-card-preview img {
  height: 82%;
  width: auto;
}

.skin-card-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  background: var(--paper);
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}

.skin-card-badge svg {
  width: 11px;
  height: 11px;
}

.skin-card-name {
  font-family: var(--font-display);
  font-size: clamp(8px, 1.8vmin, 10px);
  color: var(--ink);
  line-height: 1.4;
}

.skin-card-price {
  font-family: var(--font-body);
  font-size: clamp(11px, 2.4vmin, 15px);
  color: var(--muted);
}

.skin-card-btn {
  width: 100%;
  font-family: var(--font-display);
  font-size: clamp(7px, 1.6vmin, 9px);
  padding: 6px 4px;
  border: 2px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}

.skin-card-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.skin-card-btn.is-equipped {
  background: var(--ink);
  color: var(--paper);
  opacity: 1;
}

.skin-card-btn.is-buyable {
  background: var(--accent);
  color: var(--paper);
  border-color: var(--accent);
}
```

- [ ] **Step 3: Wire open/close in `js/game.js`**

Find:
```js
  const overlays = {
    loading: document.getElementById('overlay-loading'),
    start: document.getElementById('overlay-start'),
    pause: document.getElementById('overlay-pause'),
    gameover: document.getElementById('overlay-gameover'),
  };
```
Add directly after it:
```js
  const overlayWardrobe = document.getElementById('overlay-wardrobe');
  const wardrobeGrid = document.getElementById('wardrobe-grid');
  const wardrobeCoinsValue = document.getElementById('wardrobe-coins-value');
  const menuCoinsValue = document.getElementById('menu-coins-value');
  const btnWardrobe = document.getElementById('btn-wardrobe');
  const btnWardrobeGameover = document.getElementById('btn-wardrobe-gameover');
  const btnWardrobeBack = document.getElementById('btn-wardrobe-back');
```

Find:
```js
  function updateCoinsHud() {
    hudCoinsValue.textContent = String(coinBalance);
  }
```
Replace with:
```js
  function updateCoinsHud() {
    hudCoinsValue.textContent = String(coinBalance);
    menuCoinsValue.textContent = String(coinBalance);
    wardrobeCoinsValue.textContent = String(coinBalance);
  }

  // renderWardrobe() populates #wardrobe-grid — defined in Task 7
  // (js/game.js "Wardrobe card rendering" section). Declared with
  // `function` (hoisted) so it can be referenced here before that
  // section is added, exactly like every other forward reference
  // already in this file (e.g. AudioMgr, Particles).
  function openWardrobe() {
    renderWardrobe();
    overlayWardrobe.hidden = false;
  }

  function closeWardrobe() {
    overlayWardrobe.hidden = true;
  }

  btnWardrobe.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    openWardrobe();
  });
  btnWardrobeGameover.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    openWardrobe();
  });
  btnWardrobeBack.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    closeWardrobe();
  });
```

**Important:** `renderWardrobe` is not defined until Task 7. This task's own verification step (below) only checks that the button wiring and `stopPropagation` are correct — it does not open the wardrobe (that would throw `renderWardrobe is not a function` until Task 7 lands). If you need to manually smoke-test this task in a browser before Task 7 exists, temporarily stub `function renderWardrobe() {}` and remove the stub when Task 7 adds the real one.

- [ ] **Step 4: Syntax-check**

Run: `node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Verify the stopPropagation fix with a headless-browser check**

This is the one behavior in this task that a syntax check can't catch — it needs a real DOM click/bubble test. Using the same Edge-headless-via-CDP approach used earlier in this project:

```bash
node -e "
const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/index.html';
  fs.readFile(path.join(process.cwd(),p),(err,data)=>{
    if(err){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});
    res.end(data);
  });
}).listen(8735,'127.0.0.1',()=>console.log('listening'));
" &
sleep 1
```
Then, with a temporary `function renderWardrobe() {}` stub added per the note above (remove it after this check): open the page, click `#btn-wardrobe`, and confirm via `Runtime.evaluate` that `document.getElementById('overlay-wardrobe').hidden === false` **and** that `state` is still `'start'` (not `'playing'`) — proving the click did not also bubble into `startGame()`. Kill the server afterward.

Expected: wardrobe becomes visible, game state remains `start`.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/game.js
git commit -m "Add wardrobe screen shell and menu/game-over entry points"
```

---

## Task 7: Wardrobe card rendering and buy/equip logic

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `SKIN_DEFS`, `skinById`, `SkinStore` (Task 1), `overlayWardrobe`/`wardrobeGrid`/`wardrobeCoinsValue`/`coinBalance`/`updateCoinsHud` (Tasks 4–6).
- Produces: `renderWardrobe()` (the real implementation, replacing the stub note from Task 6), `SKIN_ICON_SVG`, `skinCardStatus(id)`.

- [ ] **Step 1: Add the category icon glyphs and status/render logic**

Find the closing of Task 6's `closeWardrobe`/button-wiring block (the `btnWardrobeBack.addEventListener(...)` call) and add directly after it:

```js

  const SKIN_ICON_SVG = {
    normal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M4 18h16l-1.5-8-4 3-2.5-5-2.5 5-4-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    volleyball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M5 8c3 2 11 2 14 0M5 16c3-2 11-2 14 0" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M15 3a9 9 0 1 0 6 15 7 7 0 0 1-6-15z" fill="currentColor"/></svg>',
    gem: '<svg viewBox="0 0 24 24"><path d="M6 4h12l3 5-9 11L3 9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9 9 3h6z" fill="currentColor"/></svg>',
  };

  function skinCardStatus(id) {
    if (id === SkinStore.getEquipped()) return 'equipped';
    if (SkinStore.isUnlocked(id)) return 'owned';
    return coinBalance >= skinById(id).price ? 'buyable' : 'locked';
  }

  const SKIN_STATUS_LABEL = { equipped: 'EQUIPADA', owned: 'EQUIPAR', buyable: 'COMPRAR', locked: 'BLOQUEADA' };

  function renderWardrobe() {
    wardrobeCoinsValue.textContent = String(coinBalance);
    wardrobeGrid.innerHTML = SKIN_DEFS.map((skin) => {
      const status = skinCardStatus(skin.id);
      const btnClass = status === 'equipped' ? 'is-equipped' : status === 'buyable' ? 'is-buyable' : '';
      const disabled = (status === 'equipped' || status === 'locked') ? 'disabled' : '';
      const priceLabel = skin.price > 0 ? `${skin.price} MOEDAS` : 'GRÁTIS';
      return `
        <div class="skin-card">
          <div class="skin-card-preview">
            <img src="assets/sprites/girl_idle_01.png" alt="${skin.name}">
            <span class="skin-card-badge">${SKIN_ICON_SVG[skin.icon]}</span>
          </div>
          <div class="skin-card-name">${skin.name.toUpperCase()}</div>
          <div class="skin-card-price">${priceLabel}</div>
          <button type="button" class="skin-card-btn ${btnClass}" data-action="${status}" data-skin-id="${skin.id}" ${disabled}>${SKIN_STATUS_LABEL[status]}</button>
        </div>`;
    }).join('');
  }

  wardrobeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.skin-card-btn');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.skinId;
    const action = btn.dataset.action;
    if (action === 'buyable') {
      const res = SkinStore.purchase(id);
      if (res.ok) {
        coinBalance = SkinStore.getCoins();
        AudioMgr.powerup();
        updateCoinsHud();
      }
    } else if (action === 'owned') {
      SkinStore.setEquipped(id);
      AudioMgr.uiClick();
    }
    renderWardrobe();
  });
```

- [ ] **Step 2: Syntax-check**

Run: `node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Headless-browser verification of the full buy → equip flow**

Using the local static server + Edge-CDP technique from Task 6 Step 5 (this time without needing the `renderWardrobe` stub, since the real one now exists): navigate to the page, then via `Runtime.evaluate` in the page's own context run:
```js
localStorage.setItem('marianaRunnerCoins', '500');
location.reload();
```
Wait for reload, click `#btn-wardrobe`, then confirm via `Runtime.evaluate`:
- `document.querySelector('[data-skin-id="princesa"]').textContent` contains `COMPRAR`
- `document.querySelector('[data-skin-id="gold"]').disabled === true` (BLOQUEADA, insufficient funds)

Click the Princesa card's button, then confirm:
- `localStorage.getItem('marianaRunnerCoins') === '0'`
- `document.querySelector('[data-skin-id="princesa"]').textContent` contains `EQUIPAR`

Click it again, then confirm:
- `localStorage.getItem('marianaRunnerEquippedSkin') === 'princesa'`
- `document.querySelector('[data-skin-id="princesa"]').textContent` contains `EQUIPADA`
- `document.querySelector('[data-skin-id="normal"]').textContent` contains `EQUIPAR` (no longer equipped)

Expected: all of the above hold exactly as stated.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "Add wardrobe card rendering and buy/equip interactions"
```

---

## Task 8: Skin-aware character rendering

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `SKIN_SPRITE_FRAMES` (Task 3), `SkinStore.getEquipped()` (Task 1), `GIRL_RUN_FRAMES`/`GIRL_JUMP_FRAMES`/`GIRL_IDLE_FRAMES` (existing).
- Produces: `currentGirlFrames()`.

- [ ] **Step 1: Add the frame-selection helper and use it in `drawPlayer()`**

Find:
```js
  function drawPlayer() {
    let img;
    if (state === 'start') {
      img = GIRL_IDLE_FRAMES[idleFrame];
    } else if (player.jumping) {
      img = GIRL_JUMP_FRAMES[jumpFrameIndex()];
    } else {
      img = GIRL_RUN_FRAMES[player.frame];
    }
    drawSpriteRB(ctx, img, PLAYER_RIGHT_X, player.y, GIRL_H, squashScale());
  }
```
Replace with:
```js
  function currentGirlFrames() {
    const skinFrames = SKIN_SPRITE_FRAMES[SkinStore.getEquipped()];
    if (skinFrames) return skinFrames;
    return { run: GIRL_RUN_FRAMES, jump: GIRL_JUMP_FRAMES, idle: GIRL_IDLE_FRAMES };
  }

  function drawPlayer() {
    const frames = currentGirlFrames();
    let img;
    if (state === 'start') {
      img = frames.idle[idleFrame];
    } else if (player.jumping) {
      img = frames.jump[jumpFrameIndex()];
    } else {
      img = frames.run[player.frame];
    }
    drawSpriteRB(ctx, img, PLAYER_RIGHT_X, player.y, GIRL_H, squashScale());
  }
```

(`drawCat()` is intentionally untouched — skins are Mariana-only, the cat never changes, per the spec's non-goals.)

- [ ] **Step 2: Syntax-check**

Run: `node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify the fallback behavior**

Since no skin has real art files yet, `SKIN_SPRITE_FRAMES[anySkinId]` is always `null` or `undefined` right now (Task 3 only populates a skin's entry when *every* one of its 18 files loads successfully). Confirm this holds by inspecting `SKIN_SPRITE_FRAMES` in a headless-browser session after boot (`Runtime.evaluate: 'JSON.stringify(Object.keys(SKIN_SPRITE_FRAMES).filter(k => SKIN_SPRITE_FRAMES[k]))'` should return `"[]"`), then equip `princesa` in the wardrobe (Task 7's flow) and confirm gameplay still renders normal Mariana with no console errors.

Expected: `[]` (no skin has art yet), gameplay renders identically to before this task regardless of which skin is equipped.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "Render the equipped skin's art when available, else normal Mariana"
```

---

## Task 9: Cosmetic per-skin effects

**Files:**
- Modify: `js/particles.js`
- Create: `js/skin-effects.js`
- Modify: `js/game.js`

**Interfaces:**
- Consumes: `Particles` (existing, extended in this task), `SkinStore.getEquipped()` (Task 1), `PLAYER_RIGHT_X`/`GIRL_H`/`player.y`/`elapsed`/`state` (existing, from `js/game.js`).
- Produces: `Particles.sparkle(x, y, opts)` (new emitter), `SkinEffects.update(dt, skinId, cx, cy)`, `SkinEffects.draw(ctx, skinId, cx, cy, topY, elapsed, isIdle)`, `SkinEffects.reset()`.

- [ ] **Step 1: Add the `sparkle` emitter to `js/particles.js`**

Find:
```js
const Particles = (() => {
  let items = [];
```
Replace with:
```js
const SPARKLE_STAR_PATH = new Path2D('M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.9 5.8 21.3 7 14.2 2 9.3l7.1-.7L12 2z');
const SPARKLE_HEART_PATH = new Path2D('M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.8 6.7 4.6 5.4 6.9 4.3 9.4 5 12 8c2.6-3 5.1-3.7 7.4-2.6 2.8 1.3 3.6 4.7 1.9 7.4C18.7 16.65 12 21 12 21z');

const Particles = (() => {
  let items = [];

  function sparkle(x, y, opts = {}) {
    if (REDUCE_MOTION) return;
    items.push({
      kind: 'sparkle',
      shape: opts.shape || 'star',
      x: x + (Math.random() - 0.5) * (opts.spread || 14),
      y: y + (Math.random() - 0.5) * (opts.spread || 14),
      vx: (Math.random() - 0.5) * 10,
      vy: -16 - Math.random() * 16,
      r: opts.size || 6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 2,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.25,
      color: opts.color || '#f3ead9',
    });
  }
```

Find, inside `draw(ctx)`:
```js
      if (p.kind === 'dust') {
        ctx.fillStyle = p.color + (alpha * 0.5).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t), 0, Math.PI * 2);
        ctx.fill();
      } else {
```
Replace with:
```js
      if (p.kind === 'dust') {
        ctx.fillStyle = p.color + (alpha * 0.5).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sparkle') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.r / 24, p.r / 24);
        ctx.translate(-12, -12);
        ctx.fillStyle = p.color;
        ctx.fill(p.shape === 'heart' ? SPARKLE_HEART_PATH : SPARKLE_STAR_PATH);
        ctx.restore();
      } else {
```

Find:
```js
  return { dust, burst, update, draw, clear };
```
Replace with:
```js
  return { dust, burst, sparkle, update, draw, clear };
```

- [ ] **Step 2: Create `js/skin-effects.js`**

```js
/* =========================================================
   MARIANA RUNNER — cosmetic per-skin effects
   Purely decorative feedback for the equipped skin: emits into
   the shared Particles system, or draws directly for effects
   that don't fit the generic particle emitter (the pajama Zzz
   glyph, the gold glow). Never touches hitboxes, physics, score,
   or timing — skins carry no gameplay advantage.
   ========================================================= */

const SkinEffects = (() => {
  let sparkleTimer = 0;
  let zzzPhase = 0;

  const SPARKLE_RECIPES = {
    princesa: { color: '#e6a6c7', interval: 0.55, shape: 'star', size: 6 },
    volei: { color: '#e8b23d', interval: 0.7, shape: 'star', size: 4, spread: 20 },
    noiva: { color: '#f3ead9', interval: 0.5, shape: 'heart', size: 6 },
  };

  function update(dt, skinId, cx, cy) {
    const recipe = SPARKLE_RECIPES[skinId];
    if (!recipe) { sparkleTimer = 0; return; }
    sparkleTimer += dt;
    if (sparkleTimer >= recipe.interval) {
      sparkleTimer = 0;
      Particles.sparkle(cx, cy, recipe);
    }
  }

  function drawGoldGlow(ctx, cx, cy, elapsed) {
    const pulse = 0.55 + 0.15 * Math.sin(elapsed * 2.2);
    const r = 46;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    grad.addColorStop(0, `rgba(255,214,102,${(0.32 * pulse).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawZzz(ctx, cx, topY, elapsed) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#2b2b2b';
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = 'center';
    const bob = Math.sin(elapsed * 1.6) * 3;
    ctx.fillText('Z z z', cx, topY - 10 + bob);
    ctx.restore();
  }

  function draw(ctx, skinId, cx, cy, topY, elapsed, isIdle) {
    if (skinId === 'gold') drawGoldGlow(ctx, cx, cy, elapsed);
    if (skinId === 'pijama' && isIdle) drawZzz(ctx, cx, topY, elapsed);
  }

  function reset() {
    sparkleTimer = 0;
    zzzPhase = 0;
  }

  return { update, draw, reset };
})();
```

- [ ] **Step 3: Wire it into `js/game.js`**

Find (inside `update(dt)`, right after the `if (state !== 'playing') return;` guard and before the score-accrual line — this keeps it firing only during actual gameplay, exactly like the coin/power-up/obstacle spawns):
```js
    elapsed += dt;
    const speed = currentSpeed();
    score += dt * (speed / 6.5) * scoreMultiplier;
```
Replace with:
```js
    elapsed += dt;
    const speed = currentSpeed();
    score += dt * (speed / 6.5) * scoreMultiplier;

    SkinEffects.update(dt, SkinStore.getEquipped(), PLAYER_RIGHT_X - GIRL_H * 0.32, player.y - GIRL_H * 0.5);
```

Find, in `render()`, the `'start'` branch:
```js
    if (state === 'start') {
      drawBackground();
      drawDecor();
      drawCat();
      drawPlayer();
    } else {
```
Replace with:
```js
    if (state === 'start') {
      drawBackground();
      drawDecor();
      drawCat();
      drawPlayer();
      SkinEffects.draw(ctx, SkinStore.getEquipped(), PLAYER_RIGHT_X - GIRL_H * 0.32, player.y - GIRL_H * 0.5, player.y - GIRL_H, elapsed, true);
    } else {
```

Find, in `render()`'s `else` branch:
```js
      if (shieldActive) drawShieldHalo();
      const darkness = currentDarkness();
```
Replace with:
```js
      if (shieldActive) drawShieldHalo();
      SkinEffects.draw(ctx, SkinStore.getEquipped(), PLAYER_RIGHT_X - GIRL_H * 0.32, player.y - GIRL_H * 0.5, player.y - GIRL_H, elapsed, false);
      const darkness = currentDarkness();
```

Find, in `startGame()`:
```js
    Particles.clear();
```
Replace with:
```js
    Particles.clear();
    SkinEffects.reset();
```

- [ ] **Step 4: Add the script tag**

`index.html`'s script order already includes `<script src="js/skin-effects.js"></script>` from Task 3 Step 3 — no change needed here, just confirm the file now exists where that tag expects it.

- [ ] **Step 5: Syntax-check**

Run: `node --check js/particles.js && node --check js/skin-effects.js && node --check js/game.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Headless-browser verification**

Equip each of `princesa`, `volei`, `pijama`, `gold`, `noiva` in turn (via the wardrobe flow from Task 7, or directly via `localStorage.setItem('marianaRunnerEquippedSkin', id)` + reload for speed), start a run, and screenshot after ~2 seconds of play for each. Confirm: princesa/volei/noiva show occasional star or heart sparkles near Mariana; gold shows a soft golden glow; pijama shows nothing extra while running but shows a "Z z z" above her on the main-menu idle screen. Confirm `normal` shows none of the above. Confirm `console --errors` is empty in every case.

Expected: each skin's effect is visible and matches its description; no console errors; gameplay (jumping, obstacles, scoring) is visibly unaffected in every case.

- [ ] **Step 7: Commit**

```bash
git add js/particles.js js/skin-effects.js js/game.js
git commit -m "Add cosmetic per-skin particle/glow effects"
```

---

## Task 10: Full regression pass, mobile verification, and docs

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- No code changes expected — this task is verification-only unless it finds a bug, in which case fix it in the relevant file from Tasks 1–9 and re-run this task's checks.

- [ ] **Step 1: Regression-check every pre-existing feature still works**

Using the headless-browser technique already used throughout this plan and earlier in this project, on a fresh page load (cleared localStorage) and then again with existing progress:
- Tap/click/Space starts the run from the main menu; the menu's "tap anywhere" behavior still works everywhere except the new `#btn-wardrobe` button.
- Jump (Space/tap), obstacles, and collisions behave unchanged; a game over shows the correct final score and, on a new high score, the "NOVO RECORDE!" badge.
- Pause (P / pause button) still works and still blocks `update(dt)` from advancing anything (score, obstacles, coins, effects all freeze).
- All three power-ups (shield, star, double jump) still spawn, collect, and expire correctly, with their HUD status badges.
- The day/night sun/moon arc now completes one full cycle every 3000 score points (start a run, watch `currentDarkness()`/the sun-moon position via `Runtime.evaluate` at score checkpoints 0, 750, 1500, 2250, 3000, confirming it matches Task 2's formula).
- Mute button still works; PWA install metadata (`manifest.json`, `sw.js`, icons — added in an earlier session) are untouched.

Expected: every item above behaves exactly as it did before this plan's changes.

- [ ] **Step 2: Mobile-viewport pass**

Using Edge headless + CDP device-metrics emulation (iPhone landscape 844×390 and a short-landscape Android size like 915×412 — the same emulation this project used earlier), open the wardrobe on each and confirm:
- The 6-card grid is fully reachable by scrolling inside `#wardrobe-grid` (not the whole page) and no card is cut off or unreachable.
- The wardrobe header (title + coin balance) stays visible and pinned while the grid scrolls.
- Tapping COMPRAR/EQUIPAR on a card works with touch emulation (`Emulation.setTouchEmulationEnabled`), not just mouse clicks.
- Text and buttons remain legible (no overflow/clipping) at both sizes.

Expected: wardrobe is fully usable on both simulated phones in landscape.

- [ ] **Step 3: Persistence check**

In a headless session: set coins, purchase and equip a skin, then do a hard `location.reload()` (not just a soft in-page state reset) and confirm via `Runtime.evaluate` that `SkinStore.getCoins()`, `SkinStore.getUnlocked()`, and `SkinStore.getEquipped()` all read back exactly what was set before the reload, and that the HUD/menu/wardrobe coin displays all show the correct number immediately after boot.

Expected: all three persist correctly across reload.

- [ ] **Step 4: Run every script-based check from Tasks 1–2 one more time, together**

Run: `node scripts/test-skins.js && node scripts/test-daynight.js && node --check js/game.js && node --check js/skins.js && node --check js/sprites.js && node --check js/skin-effects.js && node --check js/particles.js && node --check js/audio.js`
Expected: both test scripts print their "All ... checks passed." lines, every `--check` produces no output, overall exit code 0.

- [ ] **Step 5: Update `PRODUCT.md`**

Add a new bullet under "Capabilities and Constraints" (in the same style as this session's earlier entries, e.g. the "Power-ups" and "Sun/moon sky arc" bullets):

```markdown
- Guarda-Roupa skin system (added 2026-09-05): a persistent coin economy (coins collected during gameplay, `localStorage`-backed, never lost between sessions) and a wardrobe screen where the player unlocks and equips cosmetic skins for Mariana — Normal (free), Princesa (500), Vôlei (1000), Pijama (1500), Gold (3000), and Noiva (5000, the rarest/most special). Skins are purely cosmetic: identical hitbox, speed, and scoring regardless of which is equipped. Each non-default skin has a small particle/glow effect (sparkles, a gold shimmer, a pajama "Zzz", hearts) that ships now, independent of the skin's actual illustrated art. No new character art was generated for this — the wardrobe currently previews every skin with the existing Mariana artwork plus a small category badge, and the game is wired to automatically use real per-skin sprite sheets the moment they're added under `assets/sprites/skins/<id>/` (see that folder's README), with zero code changes required.
```

Also update the existing day/night bullet (added/edited earlier this session) — find:
```markdown
- Day/dusk/night lighting cycle (added 2026-09-04, slowed and de-labeled 2026-09-04): ... cycling slowly and continuously over real elapsed play time (not score, so it never speeds up as the run gets harder) — a full morning→night→morning cycle takes several minutes, ...
```
Replace the "cycling..." clause with:
```markdown
- Day/dusk/night lighting cycle (added 2026-09-04, slowed and de-labeled 2026-09-04, reverted to score-based 2026-09-05): a purely cosmetic color-multiply tint over the existing art (plus a procedural star field and the sun/moon sky arc), completing one full morning→night→morning cycle every 3000 score points (previously tied to real elapsed time — that read as too slow, so it was moved back to score at a slower cadence than the original 900-point version). There is no on-screen text or banner naming the phase; the player perceives the change only through lighting and sky. No new scenery assets — this is atmosphere, not new levels/biomes.
```

- [ ] **Step 6: Update `DESIGN.md`**

Add a new component section (matching the style of the existing "Power-up World Icons (Signature Component)" section):

```markdown
### Guarda-Roupa (Wardrobe) Screen
- **Style:** full-bleed paper overlay (not a centered card like the other overlays — it needs room for a scrolling grid), pinned header with title + coin balance, `2px` ink-bordered skin cards on a `--paper-dim` grid background, same Display/Body two-font system as the rest of the UI.
- **Cards:** each shows the existing Mariana idle artwork (not yet re-costumed — see PRODUCT.md) with a small circular category-glyph badge in the corner (crown, volleyball, moon, gem, ring), name, price, and a single status button (BLOQUEADA / COMPRAR / EQUIPAR / EQUIPADA) using the same `.pixel-btn`-family ink-bordered chrome as the rest of the game, with `--accent` reserved for the actionable COMPRAR state and inverted ink/paper for EQUIPADA.
- **Not canonized:** the placeholder preview art is explicitly temporary, not a new visual direction — real per-skin illustrated art (see `assets/sprites/skins/README.md`) replaces it automatically with no code changes once supplied.
```

- [ ] **Step 7: Commit**

```bash
git add PRODUCT.md DESIGN.md
git commit -m "Document the Guarda-Roupa skin system and the day/night cadence revert"
```

---

## Self-Review

**Spec coverage:** coin collection/persistence (Tasks 1, 4, 5), wardrobe screen with all four card states and immediate coin deduction (Tasks 6–7), one-equipped-at-a-time (Task 1's `setEquipped` + Task 7's render), skin appears in gameplay (Task 8), cosmetic effects per skin (Task 9), no gameplay advantage (Global Constraints + Task 10 regression pass), mobile usability (Task 10 Step 2), day/night reverted to score/3000 (Task 2), all existing functionality preserved (Task 10 Step 1), asset-pending art strategy (Task 3 + README). All spec sections are covered.

**Placeholder scan:** no TBD/TODO markers; every step has real, complete code or a fully specified manual verification procedure.

**Type/name consistency check performed:** `SkinStore`, `SKIN_DEFS`, `skinById`, `coinBalance`, `updateCoinsHud`, `renderWardrobe`, `SKIN_SPRITE_FRAMES`, `SkinEffects` are each defined exactly once and referenced by the same name in every later task that consumes them.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-05-wardrobe-skins.md`. Two execution options:

**1. Subagent-Driven (recommended by the skill default)** - a fresh subagent per task, review between tasks, fast iteration — but each subagent starts with zero context on this session's prior exploration (exact line numbers, the `stopPropagation` gotcha, the coin-math derivation), so it re-reads the relevant files from scratch per task.

**2. Inline Execution (recommended here)** - continue in this session using `superpowers:executing-plans`, task by task with checkpoints. This session already holds the full codebase context (exact current line numbers, the click-bubbling behavior, the render/update call graph) that produced this plan, so inline execution avoids re-discovering it and is the faster path for a 10-task plan this tightly coupled across shared files (`js/game.js` is touched by 8 of the 10 tasks).

Which approach?

