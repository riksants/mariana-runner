# Guarda-Roupa (Wardrobe / Skins) System — Design Spec

Date: 2026-09-05
Status: Approved by user, pending spec review sign-off

## Goal

Add a cosmetic skin-unlock economy to Mariana Runner: the player collects
coins during gameplay, spends them in a new "Guarda-Roupa" screen to
unlock and equip skins for Mariana, and the equipped skin appears during
gameplay. Skins are purely cosmetic (no gameplay effect). All existing
functionality (controls, scoring, high score, obstacles, power-ups,
day/night cycle, menus, PWA install) must keep working unchanged.

A second, unrelated, small change rides along in the same release: the
day/dusk/night lighting cycle reverts from real-time-based back to
score-based, completing one full cycle every 3000 points (it was changed
to real-time in a previous session; the user found that version too slow
and wants it tied to score again, at a slower cadence than the original
900-point cycle).

## Constraint that shapes this design: no new illustrated art yet

The project's character art (`assets/sprites/girl_*.png`, `cat_*.png`) is
hand-illustrated PNG artwork the user supplied; there is no image-generation
tool available in this environment that can produce new frames in the same
exact style for 5 new skin outfits. The user chose (explicitly, when asked)
to have the full system built now with the visual art left as a "pending"
placeholder, to be supplied later either by the user or an artist. This
spec is written around that choice — see "Asset strategy" below.

## Data model & persistence

New `js/skins.js` module (loaded before `game.js`, alongside the existing
`particles.js` / `sprites.js` / `audio.js` script tags):

```js
const SKIN_DEFS = [
  { id: 'normal',   name: 'Mariana',          price: 0,    icon: 'normal' },
  { id: 'princesa', name: 'Mariana Princesa', price: 500,  icon: 'crown' },
  { id: 'volei',    name: 'Mariana Vôlei',    price: 1000, icon: 'volleyball' },
  { id: 'pijama',   name: 'Mariana Pijama',   price: 1500, icon: 'moon' },
  { id: 'gold',     name: 'Mariana Gold',     price: 3000, icon: 'gem' },
  { id: 'noiva',    name: 'Mariana Noiva',    price: 5000, icon: 'ring', special: true },
];
```

`icon` names a small flat glyph (same ink-outline vocabulary already used
for power-up icons) drawn on the skin's wardrobe card as a category marker
— it is UI chrome, not a stand-in for the skin's real look.

Persistence (localStorage, matching the existing `marianaRunner*` key
naming already used for high score / seen-hint):

| Key | Type | Default | Meaning |
|---|---|---|---|
| `marianaRunnerCoins` | number (string-encoded) | `0` | total coin balance |
| `marianaRunnerUnlockedSkins` | JSON array of skin ids | `["normal"]` | owned skins |
| `marianaRunnerEquippedSkin` | skin id string | `"normal"` | currently equipped skin |

A small `SkinStore` object in `skins.js` wraps all reads/writes to these
three keys (get/set coins, isUnlocked, unlock, getEquipped, setEquipped) so
`game.js` never touches `localStorage` directly for this feature — mirrors
how `Particles`/`AudioMgr`/`ScreenShake` are already separate globals that
`game.js` calls into.

## Coin economy

**Collection.** Coins spawn along the track on their own independent timer
(same architectural pattern as the existing power-up spawner: a
`distanceSinceLastCoinCluster` accumulator compared against a randomized
`nextCoinClusterGap`, driven by `speed * dt` exactly like obstacles/decor/
power-ups already are). Each spawn places a small cluster of 3 coins in a
short arc, at jump height, reusing the visual language of the flat-icon
power-up badges (a small circular ink-outlined coin glyph) — collected by
overlap with the player, exactly like power-ups.

**Balance.** Distance traveled and score are proportional in this game
(`score` accrues at `speed/6.5` per second and distance accrues at `speed`
per second, so `distance ≈ 6.5 × score` at all times). Assuming a casual
run averages roughly score 500 (≈3250 distance units) before game over,
hitting the user's chosen "casual: 500 coins in 5–8 runs" target requires
≈77 coins/run, i.e. one coin every ≈42 distance units. With 3-coin
clusters that means a cluster every ≈125 distance units on average —
implemented as `nextCoinClusterGap = 90 + Math.random() * 70`. This is a
single tunable constant; if actual playtesting feels off, only that line
changes.

At this rate the most expensive skin (Noiva, 5000 coins) takes roughly 65
average runs — deliberately a long-term goal, matching "a mais especial e
difícil de conseguir."

**HUD.** A small coin readout is added next to the existing score/hi-score
HUD block during gameplay (approved by the user), plus on the main menu
and inside the wardrobe, both already required by the user's spec.

## Wardrobe screen

New DOM overlay `#overlay-wardrobe` (same `.overlay` pattern as
start/pause/game-over), reached via:
- a new "GUARDA-ROUPA" button on the main menu, next to "COMEÇAR"
- a new "GUARDA-ROUPA" shortcut on the game-over screen (approved by the
  user — the moment the player just earned coins)

Layout: title bar ("GUARDA-ROUPA" + coin balance + a "back" button), then
a vertically scrollable grid of 6 skin cards (the overlay's existing
centered-flex-column pattern doesn't scroll, so the wardrobe's inner list
gets its own `overflow-y: auto` region — everything else about the
overlay chrome stays consistent with the existing paper/ink visual
language).

Each card shows: preview square (current Mariana idle art + the skin's
small category glyph badge in a corner, since real per-skin art isn't
available yet), name, price, and one status control:
- **BLOQUEADA** (locked, insufficient coins) — disabled, greyed
- **COMPRAR** (locked, enough coins) — active button; tapping deducts
  coins immediately, unlocks the skin, button becomes EQUIPAR
- **EQUIPAR** (owned, not equipped) — active button; tapping sets it as
  the equipped skin (previously-equipped card reverts to EQUIPAR)
- **EQUIPADA** (owned, currently equipped) — disabled/highlighted state

Only one skin is ever equipped; switching is instant, no confirmation
dialog (matches "moedas devem ser descontadas imediatamente" — the whole
flow is meant to feel immediate). The wardrobe's back button always
returns to whichever screen opened it (main menu or game-over), not
unconditionally to the main menu.

## Gameplay integration

`drawPlayer()` / `drawCat()` in `game.js` currently always draw
`GIRL_*_FRAMES` / `CAT_*_FRAMES`. This becomes: look up the equipped
skin's frame set; if real art has been supplied for that skin (see Asset
strategy), use it; otherwise fall back to the normal Mariana frames. The
cat is never re-skinned (skins are Mariana outfits only, per spec).

### Asset strategy (art-pending skins)

Convention for future real art, so it drops in with no code changes:

```
assets/sprites/skins/<skinId>/girl_run_01.png … girl_run_12.png
assets/sprites/skins/<skinId>/girl_jump_01.png … girl_jump_04.png
assets/sprites/skins/<skinId>/girl_idle_01.png … girl_idle_02.png
```

`sprites.js` gets a non-fatal loader for these: it attempts to load each
skin's files, and any missing file is caught and recorded as "this skin
has no art yet" rather than rejecting the whole load chain (unlike the
existing core-asset loader, which is allowed to be strict since those
files are guaranteed to exist). `game.js` asks "does the equipped skin
have real frames?" each render and falls back to normal Mariana frames
when it doesn't. Nothing about this fallback is visible as an error to
the player — a not-yet-illustrated skin simply plays like normal Mariana,
distinguished only by its particle effect (below) and by its card in the
wardrobe.

## Cosmetic effects (ship now, independent of character art)

Using the existing `Particles` module, tied to the equipped skin:
- **Princesa** — small sparkles drifting off the character periodically
- **Vôlei** — discrete small particle bursts (subtle, sport-themed motion)
- **Pijama** — a small "Zzz" glyph drawn above the character while idle
  (start screen / standing still)
- **Gold** — a continuous soft golden shimmer/glow
- **Noiva** — small hearts + light sparkles
- **Normal** — no effect (baseline)

All effects are purely decorative, layered the same way the existing
shield halo / dust particles are (drawn after the character, never
altering hitboxes, physics, or timing), and capped in density so they
cannot obscure obstacles or the player's silhouette on small phone
screens.

## Day/night cycle change (bounded, unrelated fix)

`PHASE_CYCLE_SECONDS` (real-time based, added in a previous session) is
replaced with a score-based `PHASE_CYCLE_SCORE = 3000`, and
`cyclePosition()` goes back to reading `score` instead of `elapsed`. The
sun/moon arc and lighting tint logic are otherwise untouched — they
already consume `cyclePosition()`/`currentDarkness()` as opaque 0–1
values, so no other code changes. This exactly reverses the score→time
change made earlier this session, at a new cadence (3000 instead of the
original 900) per the user's explicit request.

## Files touched

- `js/skins.js` — new: skin definitions, `SkinStore` (localStorage
  wrapper), coin-cluster spawn/collect logic support functions
- `js/sprites.js` — extend: non-fatal per-skin sprite loader
- `js/game.js` — extend: coin spawn/update/draw/collect, skin-aware
  `drawPlayer`, wardrobe screen state + interactions, HUD coin readout,
  day/night cycle reverted to score-based
- `js/particles.js` — extend (or a small new `js/skin-effects.js`) with
  the 5 per-skin cosmetic effect emitters
- `index.html` — new wardrobe overlay markup, coin HUD element, new
  buttons (menu + game-over)
- `css/style.css` — wardrobe screen styles (card grid, scroll region,
  status-button variants), coin HUD styles
- `PRODUCT.md` / `DESIGN.md` — document the new system once shipped,
  same as every other feature added this session

## Non-goals

- No new illustrated sprite art in this iteration (explicit user choice)
- No gameplay effect from any skin (explicit user requirement)
- No skin for the cat
- No server/account sync — coins and skins are local to the device,
  consistent with the rest of the game's no-backend model

## Testing plan

- Unit-style manual checks via Node (`node --check`) on every touched
  JS file after edits
- Headless-browser screenshot pass (the same Edge + CDP technique used
  earlier this session) covering: main menu with coin balance, wardrobe
  screen in locked/affordable/equipped states, an equipped skin's effect
  visible in gameplay, game-over screen with the new shortcut, and a
  mobile-viewport pass (the wardrobe grid must scroll and stay usable in
  a short landscape phone frame)
- Manual localStorage inspection (via the same headless session) to
  confirm coins/unlocks/equipped-skin persist across a simulated reload
- Regression check: confirm the existing power-up, obstacle, scoring,
  pause, and day/night behavior are all unchanged by spot-checking each
  after the change
