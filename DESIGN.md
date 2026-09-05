---
name: Mariana Runner
description: A hand-illustrated Chrome-Dino-style desert runner, executed at Subway-Surfers-tier production polish.
colors:
  ink: "#2b2b2b"
  paper: "#f3ead9"
  paper-dim: "#ece3d2"
  muted: "#6b6459"
  accent: "#a83f1f"
  phase-tint-dusk: "rgba(255,140,60,0.16)"
  phase-tint-night: "rgba(20,28,60,0.55)"
typography:
  display:
    fontFamily: "'Press Start 2P', 'Courier New', monospace"
    fontSize: "clamp(18px, 5.4vmin, 34px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "1px"
  title-small:
    fontFamily: "'Press Start 2P', 'Courier New', monospace"
    fontSize: "clamp(16px, 4.4vmin, 26px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "1px"
  label:
    fontFamily: "'Press Start 2P', 'Courier New', monospace"
    fontSize: "clamp(11px, 2.8vmin, 16px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "'VT323', 'Consolas', monospace"
    fontSize: "clamp(14px, 3vmin, 20px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.5px"
rounded:
  none: "0px"
  icon: "4px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "clamp(10px, 2vmin, 14px) clamp(18px, 4vmin, 28px)"
  button-primary-hover:
    backgroundColor: "#171717"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "clamp(10px, 2vmin, 14px) clamp(18px, 4vmin, 28px)"
  button-secondary-hover:
    backgroundColor: "#e8ddc4"
  icon-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.icon}"
    size: "clamp(28px, 6vmin, 36px)"
  icon-button-hover:
    backgroundColor: "#e8ddc4"
  status-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.icon}"
    padding: "2px 5px"
---

# Design System: Mariana Runner

## Overview

**Creative North Star: "The Sun-Bleached Cartridge"**

Mariana Runner is a paper-and-ink desert arcade cabinet: a warm, sun-faded cream world bordered in thick black ink, built to look like it could have shipped on a handheld cartridge in the same generation as the offline dino runner it descends from. This is a confirmed standing choice, not an inherited default — a genuine alternative direction (a school-notebook world) was offered during a redesign round and explicitly declined in favor of keeping this identity and pushing it to full production craft instead. The visual language stays deliberately minimal and retro (flat paper tones, hard black outlines, two pixel-arcade webfonts); the craft bar applied on top of it is not minimal — rich 12-frame run cycles for both characters, synthesized audio with real sound design, and polished overlay/menu transitions are all in scope and already shipped.

The illustrated cast — Mariana and her cat, both fully animated with run/jump/idle cycles — is the system's one warm, organic element against an otherwise geometric, high-contrast UI shell. The UI never competes with the art: it is flat cream panels, hard-edged buttons, and two typefaces doing all the talking, so the hand-illustrated characters stay the visual center of every screen. A newer layer of transient game-world feedback — collectible power-ups and their HUD status badges — extends this same flat-chrome/ink language into the game world itself without touching the illustrated characters or introducing a third visual register. A separate, silent day/dusk/night lighting cycle (a slow color wash over the existing art plus a fading star field, timed to real elapsed seconds rather than score, completing one full cycle every 600 seconds so it never shifts abruptly within a single run) communicates the passage of time through light and sky alone, with no on-screen label of any kind and no drawn sun or moon — a sky arc with both was tried and then removed at the user's request, so the tint and star field alone carry the whole effect.

**Key Characteristics:**
- Cream/tan paper palette with a single thick black ink border and no soft neutrals in between
- Two-font system: a pixel-arcade display face for anything declarative (titles, scores, buttons), a chunkier mono-serif for anything explanatory (instructions, hints)
- Flat, hard-edged surfaces — zero border-radius on primary UI chrome, offset "print" shadows instead of blur
- One warm accent (a darkened rust/red) reserved for momentary positive-feedback flashes only, never a persistent fill
- Hand-illustrated character animation carries all the visual richness; the chrome stays flat and quiet
- Transient game-world feedback (power-ups, status badges, phase transitions) borrows the same flat ink-on-paper icon-chrome as the HUD, not the illustrated-art register

## Colors

The palette is a four-color desert-paper system: two cream neutrals, one ink, one accent — no secondary or tertiary hue family exists in the shipped build. A day/dusk/night lighting cycle adds two low-opacity atmospheric tint colors that wash over the whole scene rather than acting as surface or text colors.

### Primary
- **Ink Black** (#2b2b2b): the system's only "color" used as a structural element — canvas border, all button borders, all primary text, offset print-shadows, and (as a stroke/fill) every power-up and status-badge glyph. Functions as both the primary content color and the primary structural line.

### Secondary
- **Cartridge Rust** (#a83f1f): the sole accent. Used only for momentary positive-feedback and emphasis moments: the "NOVO RECORDE!" badge, the focus-visible outline ring, the HUD score's milestone `.pulse` flash, and the power-up-collect dust/sparkle burst. Was deliberately darkened during the build specifically to clear 4.5:1 contrast against the paper background — treat this value as the normative, final accent, not a candidate for further adjustment.

### Neutral
- **Desert Paper** (#f3ead9): the primary surface — canvas background, overlay panels, buttons, icon buttons, and status badges.
- **Paper Dim** (#ece3d2): the surface behind the game frame (page background, `theme-color`), one step duller than Desert Paper so the framed cartridge reads as sitting on a table.
- **Muted Sand** (#6b6459): secondary/instructional text (hint copy, hi-score line, rotate-hint). Also deliberately darkened during the build to clear 4.5:1 contrast against Desert Paper — treat this as final, not a defect to soften.

### Atmosphere (day/dusk/night tints)
- **Dusk Wash** (`rgba(255,140,60,0.16)`): a warm, low-opacity `multiply` overlay across the whole canvas during the "ENTARDECER" phase.
- **Night Wash** (`rgba(20,28,60,0.55)`): a cool, higher-opacity `multiply` overlay during the "NOITE" phase, dark enough to require the procedural star field to keep the sky legible on top of it.
These are atmosphere, not palette: they never appear as a surface, text, or border color, only as a full-scene composite wash cycling every 300 score points.

### Named Rules
**The Two-Neutral Rule.** The background is never a single flat tone: the page (`paper-dim`) is always one step duller than the game frame (`paper`), so the cartridge silhouette reads as an object sitting on a surface, not a flood-fill.

**The Accent Scarcity Rule.** Cartridge Rust is reserved for momentary positive-feedback and emphasis moments only — the record badge, the focus ring, the score's milestone pulse, and the power-up-collect sparkle — and is never used as a persistent fill, a button, a background, or a decorative surface color. Every instance of the accent in the shipped build is transient (an animation, a state, a one-frame flash); if a future use of the accent sits still on screen, it has broken this rule.

## Typography

**Display Font:** 'Press Start 2P' (with 'Courier New', monospace fallback)
**Body Font:** 'VT323' (with 'Consolas', monospace fallback)

**Character:** A deliberate pixel-arcade pairing, self-hosted from Google Fonts specifically to replace a prior system-monospace (Courier New) fallback. Press Start 2P is used for every piece of declarative, "systemic" text — titles, scores, buttons, labels, status-badge countdowns, phase-banner names — giving it a blocky 8-bit cadence; VT323 is used for anything explanatory or transient — instructions, hints — giving those lines a taller, more casual terminal feel so they read as secondary without changing color alone.

### Hierarchy
- **Display** (400, `clamp(18px, 5.4vmin, 34px)`, 1.4 line-height, 1px letter-spacing): the main title, `MARIANA RUNNER`.
- **Title (small)** (400, `clamp(16px, 4.4vmin, 26px)`, 1.4): secondary overlay headings — `GAME OVER`, `PAUSADO`.
- **Label** (400, `clamp(11px, 2.8vmin, 16px)`): all button text, HUD score, loading label — always uppercase in practice (PT-BR copy is authored in caps, not text-transformed).
- **Body** (400, `clamp(14px, 3vmin, 20px)`, 0.5px letter-spacing): instruction lines beneath buttons, tap-hint, rotate-hint.
- **HUD score** (Display face, `clamp(11px, 2.4vmin, 16px)`): live score, ink-colored, right-aligned, 1px letter-spacing.
- **HUD hi-score** (Display face, `clamp(8px, 1.7vmin, 11px)`): muted-colored, sits directly under the live score at smaller size — same face, not a font-family shift, so the two read as one score cluster at different volumes.
- **Status-badge countdown** (Display face, 9px, fixed not fluid): the small "8s"/"10s" timer inside a power-up status badge — the smallest fixed-size text in the system, legible only because it sits beside its own icon inside a bordered chip.

### Named Rules
**The Declarative/Explanatory Split Rule.** Press Start 2P is reserved for anything the system is stating (titles, scores, button labels, status countdowns, phase names); VT323 is reserved for anything the system is explaining (instructions, hints). Never mix the two roles within a single line of text.

## Layout

The game renders inside a single fixed-aspect canvas (`800×300` logical units) framed by `#game-frame` and centered in the viewport via `#game-wrap`. The frame scales responsively to fit the viewport while preserving its aspect ratio; safe-area insets are respected on all four edges via `env()` padding so the frame never sits under a notch or home-indicator. Overlays (`start`, `pause`, `game-over`, `loading`) are absolutely positioned, full-bleed over the canvas, stacked as flex columns with `clamp(10px, 2.4vmin, 18px)` gaps between title/score/button/instruction — one consistent vertical rhythm for every overlay screen. HUD and corner buttons sit at fixed `10–14px` offsets from the frame's top corners; the active-effect status badges stack in a row directly beneath the HUD score, right-aligned to match it. The phase-transition banner is centered at 14% from the top of the frame, independent of the HUD column, so it never collides with score or status badges. Below 720px width the tap-hint becomes visible (touch affordance replaces the ESPAÇO instruction); below 480px in portrait, a rotate-device suggestion appears beneath the frame, because the world itself is landscape-shaped like the classic dino runner and letterboxes hard in portrait.

## Elevation & Depth

The system is flat with one deliberate exception: a hard, non-blurred "print" offset shadow used structurally, never as ambient elevation. There is no blur-based elevation anywhere in the build — depth is conveyed by a solid-color offset shadow that reads as a printed drop-shadow (a screen-print registration mismatch), consistent with the paper/ink world. The day/dusk/night atmosphere layer works the same way depth-adjacently: it never adds a shadow, it composites a flat `multiply` color wash over the whole scene, so the "print" vocabulary stays the only source of depth in the system.

### Shadow Vocabulary
- **Frame shadow** (`box-shadow: 0 6px 0 rgba(0,0,0,0.15)`): sits under the whole game frame, grounding the cartridge against the page.
- **Button print-shadow** (`box-shadow: 0 4px 0 var(--ink)`): under every `.pixel-btn`; collapses to `0 0 0` on `:active` while the button translates down 4px, simulating a physical press into the paper.

### Named Rules
**The Hard-Shadow-Only Rule.** Every shadow in this system is a solid offset, never a blurred glow. A blurred `box-shadow` would break the flat-paper illustration language; if depth is needed, offset it, don't blur it.

**The Wash-Over-Art Rule.** The phase-tint atmosphere layer always composites on top of the illustrated scene but underneath any element meant to read as emitting its own light (the procedural night star field). Painting light-emitting elements under the tint crushes them to invisible — this was fixed as a bug during the day/dusk/night build and the draw order (world → tint → stars) is now load-bearing, not incidental.

## Shapes

The form language is hard-edged everywhere except the small interactive/informational controls that need a touch of tactility. Primary UI chrome (`.overlay` panels, `.pixel-btn`, the canvas frame) uses zero border-radius — square corners throughout, reinforcing the printed-cartridge, ink-outline feel. The one radius in the system is `4px`, used consistently on `.icon-btn` (mute/pause) and reused on `.status-badge` (active power-up chips) — both small, thumb-or-glance-scaled utility chrome, distinguished from primary game-flow buttons and panels. Borders are consistently thick and solid black ink (`3px` on primary buttons and the game frame, `2px` on icon buttons and status badges, dropping to `2px` on the frame itself in short-landscape viewports) — never a lighter or colored border. In-world power-up pickups are drawn as circular flat badges (paper fill, ~2.5px ink stroke) — the one circular silhouette in a system otherwise built from rectangles, reserved for objects the player collects rather than UI chrome.

## Components

### Buttons
- **Shape:** square corners (`border-radius: 0`), `3px` solid ink border, `0 4px 0 ink` print-shadow.
- **Primary** (`.pixel-btn--primary`): ink-filled background, paper-colored text — used for the single dominant action per screen (COMEÇAR, JOGAR NOVAMENTE, CONTINUAR). Padding `clamp(10px,2vmin,14px) clamp(18px,4vmin,28px)`.
- **Secondary** (`.pixel-btn` base): paper background, ink text and border — not currently used standalone in the shipped screens (every overlay's single button is primary), but is the defined ghost/secondary variant for future secondary actions.
- **Hover / Focus:** hover darkens the fill slightly (`#e8ddc4` on paper buttons, `#171717` on ink-filled primary); active press translates the button down 4px and collapses the print-shadow to 0, simulating a physical push. Focus-visible gets a `3px` rust outline offset `3px` from the button — one of the accent's momentary-emphasis uses.

### Icon Buttons
- **Style:** `clamp(28px,6vmin,36px)` square, paper background, `2px` ink border, `4px` radius — the system's original rounded chrome.
- **State:** hover darkens to `#e8ddc4`; active scales to 0.96 and nudges down 2px. Mute/sound and pause/play each swap between two inline SVG glyph states rather than animating a single icon.

### Status Badges
- **Style:** small paper chip, `2px` ink border, `4px` radius — same shape and material language as `.icon-btn`, sized down (`2px 5px` padding, 12px icon). Holds one bold ink SVG glyph plus, for time-limited effects, a 9px Display-face countdown.
- **State:** hidden by default, shown only while its effect is active; Shield's badge never carries a countdown because it expires on the next hit, not on a timer. The three badges stack right-to-left beneath the HUD score.
- **Character:** deliberately flat icon-chrome, not illustrated art — see the not-canonized note in Do's and Don'ts.

### Power-up World Icons (Signature Component)
Three collectible types — Shield (outline glyph), Star (filled glyph, 2x score), Double Jump (filled up-chevron glyph) — rendered in-world as circular paper badges (~34 game units, paper fill, ~2.5px ink stroke) that bob on a gentle sine wave at jump height. The same `Path2D` glyph data draws both the in-world canvas icon and the DOM status-badge icon, so the two contexts stay pixel-consistent. Collecting one triggers a rust-colored dust/sparkle burst (`Particles.dust`) and a synthesized pickup chime; a Shield hit destroys the incoming obstacle and plays a distinct "shield break" tone plus an ink screen-shake instead of ending the run, and a dashed ink halo circles Mariana for as long as Shield is active.

### Overlays / Panels
- **Corner Style:** none — overlays are full-bleed, not cards; they have no visible edge of their own, only the canvas frame's border.
- **Background:** semi-transparent paper (`rgba(243,234,217,0.72)`) laid over the still game canvas, so the last frame of gameplay stays legibly visible underneath the pause/game-over text — a deliberate scrim, not a solid panel.
- **Internal layout:** flex column, centered, `clamp(10px,2.4vmin,18px)` gap between title/score/button/instruction, `16px` outer padding.

### HUD
- **Style:** real DOM text (not canvas-drawn) positioned absolutely over the canvas for crisp rendering at any scale/DPI — score in Display face/ink, hi-score in Display face/muted directly beneath it at a smaller size, a coin-balance row (circular coin glyph + count) beneath that, active-effect status badges beneath that. A `.pulse` class briefly scales the score number and flashes it rust-colored on point gain, respecting `prefers-reduced-motion`.

### Guarda-Roupa (Wardrobe) Screen
- **Style:** full-bleed paper overlay layered above every other screen (`z-index: 3`, higher than the HUD) rather than a centered card like the other overlays — it needs room for a scrolling grid. Pinned header (title + coin balance) that never scrolls, with a `2px` ink-bordered skin-card grid on a `--paper-dim` background beneath it, same Display/Body two-font system as the rest of the UI.
- **Cards:** each shows that skin's own illustrated idle artwork (real per-skin art since 2026-09-05 — see `assets/sprites/skins/`) with a small circular category-glyph badge in the corner (crown, volleyball, moon, gem, ring), name, price, and a single status button (BLOQUEADA / COMPRAR / EQUIPAR / EQUIPADA) using the same ink-bordered `.pixel-btn`-family chrome as the rest of the game — `--accent` reserved for the actionable COMPRAR state, inverted ink/paper for EQUIPADA, dimmed/disabled for BLOQUEADA.
- **Entry points:** a secondary (non-primary) `.pixel-btn` on both the main menu and the game-over screen, both wired with `stopPropagation()` since those overlays already treat any click as "start/restart the run" — a real bug caught and fixed during this feature's build.
- **Art fallback (still live code, no longer the common case):** a skin with no art under `assets/sprites/skins/<id>/` falls back to the normal Mariana preview plus its category badge instead of breaking. This is how all 5 non-default skins looked before their art was supplied; a future 7th skin without art yet would look the same way.

### Signature Component: Character Duo
Mariana and her cat run and jump in sync as a single illustrated unit (12-frame run cycles, 4-frame jump, 2-frame idle, for each character) — the system's one piece of organic, full-color illustration against the flat ink/paper chrome. Only Mariana carries a collision hitbox; the cat is a visual companion. Any new character or obstacle art must match this hand-illustrated cycle style, not introduce pixel-art or flat-vector rendering; power-ups and their HUD chrome are a documented, tooling-constrained exception to this rule (see Do's and Don'ts), not a second art system to build on.

## Do's and Don'ts

### Do:
- **Do** keep border-radius at `0` on all primary game-flow UI (overlays, primary/secondary buttons, frame); reserve the `4px` radius for small utility chrome (icon buttons, status badges).
- **Do** use offset, non-blurred shadows (`0 Npx 0 ink`) for every depth cue in this system.
- **Do** reserve Cartridge Rust (#a83f1f) for momentary positive-feedback/emphasis moments (record badge, focus ring, milestone pulse, power-up-collect sparkle) — never as a persistent fill, button, or background.
- **Do** keep declarative text (titles, scores, labels, status countdowns, phase names) in Press Start 2P and explanatory text (hints, instructions) in VT323; don't cross the two.
- **Do** treat the darkened muted-text (#6b6459) and accent (#a83f1f) values as final, contrast-verified tokens — not candidates for further darkening or lightening.
- **Do** match new character/obstacle art to the existing hand-illustrated, multi-frame animation style (per PRODUCT.md), not pixel-art or flat-vector rendering.
- **Do** composite any future atmosphere/lighting layer above the illustrated scene but below anything meant to read as self-lit (stars, glow), per the Wash-Over-Art Rule.

### Don't:
- **Don't** introduce a blurred `box-shadow` anywhere; it breaks the flat paper-and-ink illustration language this world depends on.
- **Don't** add a second accent hue or a secondary/tertiary color family — this is a deliberate four-color system, not an underspecified one.
- **Don't** round the corners of primary buttons, overlays, or the game frame; square-cornered chrome is load-bearing for the retro-cartridge read.
- **Don't** replace the pixel-arcade/mono-serif font pairing with a system-default or generic sans-serif; both fonts were deliberately self-hosted to replace a prior Courier New fallback.
- **Don't** extend the flat icon-chrome register (power-up badges, status badges) to any future illustrated content — it exists only because no image-generation tool was available to make illustrated pickup sprites when power-ups shipped (documented in PRODUCT.md). It is not canonized as this system's way of drawing collectibles; new collectible/pickup art should still target the hand-illustrated cycle style used by the characters and obstacles.
