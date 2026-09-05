# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML/CSS/JS + Canvas 2D (no build step, no framework). User's explicit choice.

## Users

Mobile-web players: people opening Mariana Runner in a phone browser for short, casual sessions (score-chasing, quick replay loops). Desktop/keyboard play is also supported but mobile is the primary target.

## Product Purpose

A Chrome-Dino-style endless runner starring two illustrated characters, Mariana (a girl) and her cat, who run together across a desert scene. The player jumps to clear obstacles for as long as possible; success is measured by score and a persisted high score.

## Positioning

Same core mechanism as the classic offline-dino runner (single-button jump, ramping speed, procedural obstacles), but distinguished by hand-illustrated original character art (a named protagonist plus a companion cat, each with full run/jump/idle animation cycles) in place of a generic pixel-art dinosaur.

## Operating Context

Played directly in a mobile or desktop browser, or installed as a PWA (added 2026-09-04: `manifest.json` + `sw.js`, no account, no backend) — installable to the home screen on both iPhone (Add to Home Screen, opens fullscreen/standalone with its own icon) and Android/Chrome (native install prompt), with an offline app-shell cache so it launches without a network connection once installed. The installed app requests landscape orientation (Android honors the manifest lock; iOS has no such API, so it keeps the existing rotate hint). Portrait and landscape phone viewports are both supported in-browser (canvas resolution adapts on narrow landscape phones to reduce letterboxing). Input is tap on touch devices, Space/ArrowUp on desktop. The interface text is Portuguese (Brazil) — e.g. "Toque para pular" (tap to jump), "COMEÇAR" (start), "GAME OVER", "JOGAR NOVAMENTE" (play again) — so PT-BR is the established UI language, not a placeholder.

## Capabilities and Constraints

- Rendering: single `<canvas>`, 2D context, fixed 800-logical-unit-wide world scaled responsively to fit the viewport.
- Physics-based jump (gravity/velocity), frame-rate-independent update loop.
- Procedural difficulty ramp: obstacle speed and obstacle variety/clustering increase with score, with a guaranteed minimum reaction-time floor so it stays fair.
- Obstacle set: cactus (small/big) and rocks (big/small), unlocked progressively by score; non-colliding background decor (bush, sign, fence).
- Both characters (Mariana and the cat) run in sync and share the same jump; only Mariana has a collision hitbox in the current build.
- Power-ups (added 2026-09-04): Shield (absorbs one collision, destroying the obstacle instead of ending the run), Star (2x score for 8s), Double Jump (one extra mid-air jump for 10s). Rendered as flat ink-on-paper circular badges — the same visual register as the mute/pause icon buttons, not the illustrated character/obstacle art — floating at jump height, spawned independently once score ≥ 40. Active effects show as small status badges next to the HUD.
- Day/dusk/night lighting cycle (added 2026-09-04, tuned several times, settled on real-time-based 2026-09-05): a purely cosmetic color-multiply tint over the existing art (plus a procedural star field and the sun/moon sky arc), completing one full morning→night→morning cycle every 600 real seconds (10 minutes) of elapsed play time — not score. Score-based cycling was tried twice (900 and 3000 points per cycle) and rejected both times: score accrues faster as the run speeds up, so the exact same "N points per cycle" quietly sped up over the course of a run and read as the sun/moon jumping abruptly. Real time has one constant, slow, natural pace regardless of how well the run is going — a typical 90-second match only sees a small, gentle shift in light, never an abrupt one. There is no on-screen text or banner naming the phase; the player perceives the change only through lighting and sky. No new scenery assets — this is atmosphere, not new levels/biomes.
- Sun/moon sky arc (added 2026-09-05, redesigned 2026-09-05): a flat ink-outlined sun (8 rays + a soft inner highlight) or a graceful crescent moon (with two tiny companion stars) arcs across the sky, synced to the same cycle as the lighting tint — sun at the zenith exactly at the brightest point, moon at the zenith exactly at the darkest point, handing off to each other at the horizon at dawn/dusk. Makes the passage of time visible as a moving light source, not just a color wash. The crescent is built once on an offscreen canvas using proper geometric subtraction (fill circle, then erase the overlap with `destination-out`) rather than an evenodd path fill — the initial version used evenodd, which computes an XOR of the two circles instead of a subtraction and left a second stray lobe visible, reading as "two overlapping rings" rather than a crescent.
- Guarda-Roupa skin system (added 2026-09-05, illustrated art added 2026-09-05): a persistent coin economy (coins collected during gameplay in small clusters, `localStorage`-backed, never lost between sessions) and a wardrobe screen where the player unlocks and equips cosmetic skins for Mariana — Normal (free), Princesa (500 coins), Vôlei (1000), Pijama (1500), Gold (3000), and Noiva (5000, the rarest/most special). Reached from the main menu and from the game-over screen, both of which also show the coin balance; the live balance is shown during gameplay too, next to the score. Skins are purely cosmetic: identical hitbox, speed, and scoring regardless of which is equipped. Each non-default skin has a small particle/glow effect (star or heart sparkles, a continuous gold shimmer, a pajama "Zzz" while idle), layered on top of its own illustrated art. All 5 non-default skins now have full hand-illustrated run/jump/idle cycles (`assets/sprites/skins/<id>/`), sliced from user-supplied reference sheets (`assets/skins/mariana_*.png`, kept as the original source) and background-removed programmatically; the wardrobe previews and in-game rendering both use this real art automatically — the code still falls back to normal Mariana for any future skin added without art (see that folder's README), with zero code changes required either way.
- High score persists via `localStorage` (key `marianaRunnerHighScore`); no backend, no accounts.
- Sound effects are synthesized at runtime via the Web Audio API (oscillator tones + noise bursts) — no external audio files and no network dependency.
- All character/scenery art is the user's own illustrated sprite set (PNG), not placeholder art; future obstacle/character additions should match this hand-illustrated style rather than introducing pixel-art or vector-flat styles. Power-ups and status/HUD chrome are the deliberate exception: they intentionally use the existing flat icon-button vocabulary, not illustrated art, since no image-generation tool was available to produce new illustrated pickup sprites when they were added. The 5 wardrobe skins' art is a second, separate art source the user supplied afterward (reference sheets in `assets/skins/`, sliced into game-ready frames), matching the original character's proportions and style rather than replacing it.

## Brand Commitments

- Protagonist is named "Mariana," accompanied by an unnamed pet cat; both are established, illustrated characters, not placeholders.
- Product name "Mariana Runner" is fixed.
- UI copy is in Portuguese (Brazil); keep new copy in the same language unless the user says otherwise.
- Visual identity is a confirmed standing choice, not just an inherited default: the classic Chrome-Dino-style desert world (cream/tan palette, black ink outlines, monospace UI type) stays as-is. Offered a genuine alternative visual world (school-notebook direction) plus other options during a 2026-09-04 redesign round, the user explicitly chose to keep the current aesthetic and execute it at full craft instead of replacing it.
- Craft/quality bar for this desert-runner world: Subway Surfers-tier production polish (rich character animation, well-produced sound, polished menus/transitions) — not a bare-bones clone, even though the visual language itself stays minimal/retro.

## Product Principles

1. Preserve the classic-runner feel (single input, fair and readable obstacle timing) even as content is added.
2. Keep Mariana and the cat as a visually paired duo — new animation states should cover both characters, not just the player hitbox owner.
3. Stay asset-light and dependency-free: no build step, no external audio files, no backend; new features should fit this static, offline-capable model unless the user decides otherwise.
4. New art must match the existing hand-illustrated style and PT-BR voice already shipped, not introduce a different visual or language register.
5. Execute the confirmed desert/Chrome-Dino world at a high production bar (Subway Surfers-level animation, audio, and menu polish) rather than settling for the category's usual bare-bones finish.

## Evidence on Hand

- Full working implementation (`index.html`, `css/style.css`, `js/game.js`, `js/sprites.js`, `js/audio.js`) and complete sprite set (`assets/sprites/`: 12-frame run, 4-frame jump, and 2-frame idle cycles for both Mariana and the cat; cactus/rock obstacles; bush/sign/fence decor; cloud, mountain, and ground-tile background art) — originally supplied in a separate folder and copied into this project root as part of this init.
- PWA install assets (`manifest.json`, `sw.js`, `assets/icons/icon-*.png`): a purpose-built app icon composed from the game's own Mariana/cat idle art over a desert sky (not a generic placeholder), sized for both iOS home-screen icons (120/152/167/180) and Android/Chrome manifest icons (192/512).
- Skin economy (`js/skins.js`, `js/skin-effects.js`) with a lightweight, dependency-free Node test script (`scripts/test-skins.js`) exercising the persistence/purchase/equip logic directly — this project has no test framework, so this is a plain `node` script, not a suite.
- Full illustrated art for all 5 wardrobe skins (`assets/sprites/skins/<id>/`, 12 run + 4 jump + 2 idle frames each, background-removed and auto-trimmed from the user-supplied reference sheets kept in `assets/skins/`). Re-extracted once, 2026-09-05: the first pass silently deleted a real leg/foot on several frames — a "keep only the single largest connected shape" cleanup step (meant to catch a stray frame-number label bleeding into a crop) was also discarding legitimate limbs that render as their own disconnected blob when a flowing skirt/dress visually separates them from the torso. Fixed by only discarding components below a small pixel-count floor (true noise, never a limb) and by widening the crop margins so a leg at full stride has room. The original Mariana sprite set was never touched by either pass.
- No sound/music asset files exist or are needed (SFX is fully synthesized in `js/audio.js`).
- No design doc beyond the code itself; visual language should be treated as already established by the shipped build (retro monospace UI font, cream/tan desert palette, black-bordered canvas) rather than invented fresh.

## Accessibility & Inclusion

No accessibility requirement has been established yet beyond touch/keyboard dual input, already implemented.
