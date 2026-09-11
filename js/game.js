/* =========================================================
   MARIANA RUNNER
   Endless runner (Chrome-Dino style) starring Mariana and her
   cat, built on the user's own illustrated artwork. The visual
   world (desert palette, monospace-pixel UI) is a deliberate
   standing choice — this rewrite raises production polish
   (animation feel, audio, menus, accessibility) without
   changing that identity.
   ========================================================= */

(function () {
  'use strict';

  // ---------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------
  const wrap = document.getElementById('game-wrap');
  const frame = document.getElementById('game-frame');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';

  const hud = document.getElementById('hud');
  const hudScoreValue = document.getElementById('hud-score-value');
  const hudHiscoreValue = document.getElementById('hud-hiscore-value');
  const hudCoinsValue = document.getElementById('hud-coins-value');
  const tapHint = document.getElementById('tap-hint');
  const srAnnouncer = document.getElementById('sr-announcer');
  const achievementToast = document.getElementById('achievement-toast');
  const achievementToastName = document.getElementById('achievement-toast-name');
  const statusBadges = {
    shield: document.getElementById('status-shield'),
    star: document.getElementById('status-star'),
    jump: document.getElementById('status-jump'),
  };
  const statusStarTime = document.getElementById('status-star-time');
  const statusJumpTime = document.getElementById('status-jump-time');

  const overlays = {
    loading: document.getElementById('overlay-loading'),
    start: document.getElementById('overlay-start'),
    pause: document.getElementById('overlay-pause'),
    gameover: document.getElementById('overlay-gameover'),
  };
  const overlayWardrobe = document.getElementById('overlay-wardrobe');
  const wardrobeGrid = document.getElementById('wardrobe-grid');
  const wardrobeCoinsValue = document.getElementById('wardrobe-coins-value');
  const menuCoinsValue = document.getElementById('menu-coins-value');
  const btnWardrobe = document.getElementById('btn-wardrobe');
  const btnWardrobeGameover = document.getElementById('btn-wardrobe-gameover');
  const btnWardrobeBack = document.getElementById('btn-wardrobe-back');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnResume = document.getElementById('btn-resume');
  const btnPause = document.getElementById('btn-pause');
  const btnMute = document.getElementById('btn-mute');
  const finalScoreEl = document.getElementById('final-score');
  const recordBadge = document.getElementById('record-badge');
  const loadingDots = document.getElementById('loading-dots');

  // ---------------------------------------------------------
  // Logical world size. Every gameplay constant below is
  // defined in this fixed coordinate space; only the transform
  // set in applyResolution() changes to map it onto whatever
  // real pixel resolution the device gives us.
  // ---------------------------------------------------------
  const W = 800;
  const BASE_H = 300;
  const BASE_ASPECT = W / BASE_H;
  const MIN_H = BASE_H;
  const MAX_H = 600;
  const MAX_DPR = 3; // guards against absurd backing-store sizes on some devices
  let H = BASE_H;

  const GROUND_TILE_H = 56;
  const GROUND_SURFACE_OFFSET = 6;
  let GROUND_Y = H - GROUND_TILE_H + GROUND_SURFACE_OFFSET;

  // availAspect must be the aspect ratio of the space actually left for
  // the frame AFTER the wrap's own padding is subtracted, not the raw
  // window aspect ratio — padding removes the same fixed number of CSS
  // pixels from width and height, which shifts the aspect ratio just
  // enough (especially on smaller phones) that a logical height tuned to
  // the raw viewport aspect never quite fits the padded box, leaving a
  // strip of unused width down each side even though the whole point of
  // this function is to avoid exactly that letterboxing.
  //
  // Applies on ANY device, not just narrow/mobile widths — a tablet or a
  // regular 16:9 desktop window is still narrower than BASE_ASPECT
  // (800:300 is unusually wide), so without this a tablet/desktop was
  // stuck at H=300 and letterboxed hard. Growing H only adds more sky
  // above the fixed GROUND_Y line — every sprite keeps its own fixed
  // game-unit size, so nothing stretches or resizes, the camera just
  // shows more vertical space. The upper bound on availAspect (portrait
  // phones) is intentional: below it the world stays at its normal
  // proportions and the rotate-device hint (CSS) takes over instead.
  function computeLogicalHeight(availW, availH) {
    const availAspect = availW / availH;
    let newH = BASE_H;
    if (availAspect < BASE_ASPECT && availAspect > 0.9) {
      newH = Math.round(W / availAspect);
      newH = Math.max(MIN_H, Math.min(MAX_H, newH));
    }
    return newH;
  }

  // Fills the viewport completely (CSS pixels) — the frame is always
  // exactly the available box, on every device, so there is never an
  // empty bar down the side or across the bottom. computeLogicalHeight
  // still picks the best-fitting logical H first to keep cropping to a
  // minimum, but whatever mismatch remains between the logical WxH
  // world and the real device aspect is handled by a uniform "cover"
  // scale (same factor on X and Y, so nothing stretches) plus a
  // centered offset — content beyond whichever axis overflows simply
  // falls outside the canvas and is never drawn, a plain center-crop of
  // the scenery's extremities, not a resize of anything in it. Also
  // backs the canvas with devicePixelRatio-scaled resolution so every
  // sprite and every HUD line stays crisp.
  function applyResolution() {
    // #game-wrap is sized by CSS (100vw/100dvh) as a first-paint default,
    // but on real iOS Safari in landscape that can still diverge from the
    // true visible area — a position:fixed element's box doesn't always
    // track the dynamic toolbar the way the dvh unit is supposed to,
    // leaving a solid band of the wrap's own background showing outside
    // the frame (confirmed on-device: the gap was exactly --paper-dim,
    // the wrap's CSS background, not a canvas rendering issue). The
    // visualViewport API reports the real, currently-visible box
    // directly, so pin the wrap to it in JS whenever it's available —
    // this is strictly a viewport-sizing correction, nothing gameplay
    // related changes below.
    const vv = window.visualViewport;
    if (vv) {
      wrap.style.width = vv.width + 'px';
      wrap.style.height = vv.height + 'px';
      wrap.style.left = vv.offsetLeft + 'px';
      wrap.style.top = vv.offsetTop + 'px';
    }

    const wrapStyle = getComputedStyle(wrap);
    const padX = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight);
    const padY = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
    const availW = wrap.clientWidth - padX;
    const availH = wrap.clientHeight - padY;

    const newH = computeLogicalHeight(availW, availH);
    const heightChanged = newH !== H;
    if (heightChanged) {
      H = newH;
      GROUND_Y = H - GROUND_TILE_H + GROUND_SURFACE_OFFSET;
    }

    const cssW = Math.max(1, Math.floor(availW));
    const cssH = Math.max(1, Math.floor(availH));
    frame.style.width = cssW + 'px';
    frame.style.height = cssH + 'px';

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const backingW = Math.round(cssW * dpr);
    const backingH = Math.round(cssH * dpr);
    if (canvas.width !== backingW || canvas.height !== backingH) {
      canvas.width = backingW;
      canvas.height = backingH;
    }
    const scale = Math.max(backingW / W, backingH / H);
    const offsetX = (backingW - W * scale) / 2;
    const offsetY = (backingH - H * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    if (heightChanged) {
      if (state === 'playing' && !player.jumping) player.y = GROUND_Y;
      initBackground();
    }
  }
  window.addEventListener('resize', applyResolution);
  window.addEventListener('orientationchange', applyResolution);
  // visualViewport fires its own resize/scroll independently of window's
  // on iOS Safari (e.g. the toolbar showing/hiding in landscape) — the
  // wrap-pinning above only helps if applyResolution actually re-runs
  // when that happens.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyResolution);
    window.visualViewport.addEventListener('scroll', applyResolution);
  }

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // ---------------------------------------------------------
  // Sprite target sizes (game units)
  // ---------------------------------------------------------
  const GIRL_H_BASE = 82;
  const CAT_H = 48;
  // Per-skin visual scale, applied on top of GIRL_H_BASE. Only "mini"
  // uses this today — the whole point of the skin is that Mariana plays
  // noticeably smaller, hitbox included (a real, if small, gameplay perk
  // rather than a purely cosmetic re-skin like every other one).
  const SKIN_SCALE = { mini: 0.72 };
  function currentGirlScale() {
    return SKIN_SCALE[SkinStore.getEquipped()] || 1;
  }
  function currentGirlH() {
    return GIRL_H_BASE * currentGirlScale();
  }
  function currentHitbox() {
    const s = currentGirlScale();
    return {
      rightInset: PLAYER_HITBOX.rightInset * s,
      width: PLAYER_HITBOX.width * s,
      topInset: PLAYER_HITBOX.topInset * s,
      height: PLAYER_HITBOX.height * s,
    };
  }
  const CAT_JUMP_BOOST = 1.15; // cat leaps a little higher/springier than Mariana — pure charm
  const CACTUS_BIG_H = 92;
  const CACTUS_SMALL_H = 58;
  const ROCK_H = 50;
  const ROCK_SMALL_H = 36;
  const DECOR_H = 60;

  const PLAYER_RIGHT_X = 190;
  const CAT_OFFSET_X = 78;

  const PLAYER_HITBOX = { rightInset: 34, width: 30, topInset: 14, height: 58 };

  // ---------------------------------------------------------
  // Physics & pacing — carried over unchanged from the tuned
  // prototype; this is validated game-design data, not code to
  // rewrite for its own sake.
  // ---------------------------------------------------------
  const GRAVITY = 2700;
  const JUMP_VELOCITY = -840;
  const AIR_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;

  const BASE_SPEED = 300;
  const MAX_SPEED = 700;
  const SPEED_PER_POINT = 0.55;

  const RUN_FRAME_COUNT = 12;
  const JUMP_FRAME_COUNT = 4;
  const RUN_CYCLE_SECONDS_BASE = 0.46;
  const RUN_CYCLE_SECONDS_MIN = 0.22;
  const FOOTSTRIKE_FRAMES = new Set([2, 8]);

  // Jump input buffer: a press that lands slightly before touchdown (easy
  // to do on a touchscreen, or just anticipating the landing) used to be
  // silently dropped. Buffered presses fire the instant the player lands
  // instead, within this window. No coyote-time companion — the ground
  // here is one continuous line with no ledges to walk off, so there's
  // no "just left the ground" moment for coyote-time to cover.
  const JUMP_BUFFER_WINDOW = 0.12;

  // ---------------------------------------------------------
  // Power-ups — drawn as flat ink-on-paper badges (the same visual
  // register as the mute/pause icon buttons), never as illustrated
  // character/obstacle art, so they stay consistent with DESIGN.md's
  // established icon-chrome vocabulary instead of imitating painted art.
  // ---------------------------------------------------------
  const POWERUP_SIZE = 34; // circular badge diameter, game units
  const COIN_SIZE = 18; // circular coin diameter, game units — smaller than power-ups, they're common
  const POWERUP_MIN_SCORE = 40; // don't spawn before the player has found their feet
  const DOUBLE_JUMP_DURATION = 10; // seconds
  const MULTIPLIER_DURATION = 8; // seconds
  const ICON_PATHS = {
    shield: new Path2D('M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z'),
    star: new Path2D('M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.9 5.8 21.3 7 14.2 2 9.3l7.1-.7L12 2z'),
    jump: new Path2D('M12 5l7 7h-4v7h-6v-7H5l7-7z'),
  };
  const POWERUP_TYPES = ['shield', 'star', 'jump'];

  // ---------------------------------------------------------
  // Day/dusk/night lighting cycle — a continuous color-multiply wash
  // over the existing art (plus a fading procedural star field), so
  // "new phases" don't require any new illustrated scenery. Darkness
  // is a smooth function of real elapsed time, not score: score-based
  // cycling was tried, but score accrues faster as the run speeds up
  // (speed ramps from 300 to 700 game-units/sec while score = speed/6.5
  // per second), so the exact same "3000 points" cycle took ~65s early
  // in a run and sped up to under 30s once the run reached max speed —
  // that acceleration is what read as the sun/moon "jumping" abruptly.
  // Real time doesn't accelerate with the run, so the cycle now has one
  // constant, slow, natural pace regardless of how well the run is
  // going, and a short match only ever sees a small, gentle slice of it.
  // There is no on-screen label for any of it — only the lighting and
  // sky are meant to communicate the change.
  // ---------------------------------------------------------
  const PHASE_CYCLE_SECONDS = 600; // one full morning→night→morning cycle, in real seconds (10 minutes)
  const TINT_STOPS = [
    { r: 255, g: 140, b: 60, a: 0 },     // darkness 0.0 — broad daylight, no wash
    { r: 255, g: 140, b: 60, a: 0.16 },  // darkness 0.5 — dusk/dawn amber
    { r: 20, g: 28, b: 60, a: 0.55 },    // darkness 1.0 — full night
  ];
  const STAR_FIELD = Array.from({ length: 18 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.7,
    r: 1 + Math.random() * 1.4,
    seed: Math.random() * Math.PI * 2,
  }));

  function cyclePosition() {
    const span = ((elapsed % PHASE_CYCLE_SECONDS) + PHASE_CYCLE_SECONDS) % PHASE_CYCLE_SECONDS;
    return span / PHASE_CYCLE_SECONDS;
  }

  // Smooth 0→1→0 breathing curve across one full cycle: 0 at sunrise/
  // sunset boundary, 1 at the darkest point of night. Continuous and
  // symmetric, so there is never a jump cut in either direction.
  function currentDarkness() {
    return (1 - Math.cos(2 * Math.PI * cyclePosition())) / 2;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tintForDarkness(darkness) {
    const [day, dusk, night] = TINT_STOPS;
    const [from, to, t] = darkness <= 0.5
      ? [day, dusk, darkness / 0.5]
      : [dusk, night, (darkness - 0.5) / 0.5];
    const r = Math.round(lerp(from.r, to.r, t));
    const g = Math.round(lerp(from.g, to.g, t));
    const b = Math.round(lerp(from.b, to.b, t));
    const a = lerp(from.a, to.a, t);
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  // ---------------------------------------------------------
  // Game state
  // ---------------------------------------------------------
  let state = 'loading'; // loading | start | playing | paused | gameover
  let lastTime = null;
  let score = 0;
  let highScore = Number(localStorage.getItem('marianaRunnerHighScore') || 0);
  let seenHint = localStorage.getItem('marianaRunnerSeenHint') === '1';
  let milestoneFloor = 0;
  // Throttles the milestone pulse/chime by real time, not just score —
  // score climbs faster as the run speeds up, so at max speed a plain
  // "every 100 points" check was firing the flash/sound almost once a
  // second for the rest of any long run. milestoneFloor itself still
  // advances by 100 every time (untouched — no change to scoring or
  // difficulty), this only rate-limits the cosmetic celebration.
  let lastMilestoneTime = -Infinity;
  const MIN_MILESTONE_INTERVAL = 1.2;

  let player = {
    y: 0,
    vy: 0,
    jumping: false,
    wasJumping: false,
    frame: 0,
    frameTimer: 0,
    airTimer: 0,
    squashT: 0, // seconds since last squash/stretch trigger (landing/takeoff)
    squashKind: null, // 'takeoff' | 'land'
  };

  let jumpBufferTimer = 0;

  // Halves the footstrike dust rate (2 puffs/cycle -> 1 puff/cycle on
  // average) without favoring one foot over the other: toggled once per
  // full run cycle, so a "silent" cycle skips both footstrike puffs
  // rather than always dropping the same foot's dust. At max speed the
  // cycle is only 0.22s, so 2 triggers/cycle was ~9 puffs/second right
  // at the character's feet — a flicker rate flagged in a visual-fatigue
  // review. Purely cosmetic; run-cycle timing/speed is untouched.
  let footstrikeCyclePuffsOn = true;

  let idleFrame = 0;
  let idleTimer = 0;

  let obstacles = [];
  let decor = [];
  let distanceSinceLastSpawn = 0;
  let nextSpawnGap = 0;
  let distanceSinceLastDecor = 0;
  let nextDecorGap = 0;

  let clouds = [];
  let mountainScrollX = 0;
  let groundScrollX = 0;
  let elapsed = 0; // running game clock, used for power-up bob / star twinkle

  let powerups = [];
  let distanceSinceLastPowerup = 0;
  let nextPowerupGap = 0;

  let coins = [];
  let distanceSinceLastCoinCluster = 0;
  let nextCoinGap = 0;
  let coinBalance = SkinStore.getCoins();

  let shieldActive = false;
  let doubleJumpActive = false;
  let doubleJumpTimer = 0;
  let airJumpsUsed = 0;
  let scoreMultiplier = 1;
  let multiplierTimer = 0;
  let lastShownStarSeconds = null;
  let lastShownJumpSeconds = null;

  // Obstacle-clear streak: a quiet, no-HUD flourish that celebrates
  // skilled play specifically (as opposed to lucky powerup pickups),
  // distinct from the score milestone pulse.
  let obstacleStreak = 0;
  const STREAK_MILESTONE = 10;

  // Fires once per run, the instant the live score first overtakes the
  // previous best — a mid-run payoff instead of only at game over.
  let recordBrokenThisRun = false;

  let GIRL_RUN_FRAMES, GIRL_JUMP_FRAMES, GIRL_IDLE_FRAMES;
  let CAT_RUN_FRAMES, CAT_JUMP_FRAMES, CAT_IDLE_FRAMES;

  function resetPlayerY() { player.y = GROUND_Y; }

  function initBackground() {
    clouds = [
      { img: 'cloudBig', x: 80, y: 40, scale: 0.55 },
      { img: 'cloudSmall1', x: 340, y: 70, scale: 0.55 },
      { img: 'cloudBig', x: 560, y: 30, scale: 0.4 },
      { img: 'cloudSmall1', x: 700, y: 90, scale: 0.65 },
    ];
    mountainScrollX = 0;
    groundScrollX = 0;
  }

  // ---------------------------------------------------------
  // Difficulty / obstacle generation (unchanged tuning)
  // ---------------------------------------------------------
  function currentSpeed() {
    return Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_PER_POINT);
  }

  // Biome swap: purely score-driven (like unlockedTypes below), so a new
  // run always starts back in the desert without any extra reset code.
  // Cycles endlessly through the list, BIOME_SCORE_STEP points per stage.
  const BIOME_SCORE_STEP = 4000;
  const BIOME_ORDER = ['desert', 'selva', 'neve', 'vulcao'];
  // The last BIOME_TRANSITION_WINDOW points of every stage crossfade into
  // the next biome instead of cutting over instantly.
  const BIOME_TRANSITION_WINDOW = 500;
  // { from, to, t } — t is 0 for almost all of a stage, then eases from 0
  // to 1 across the transition window right before the next boundary.
  // `from`/`to` are always adjacent biomes in BIOME_ORDER (cyclic), so at
  // t=0 rendering/spawning only `from` is indistinguishable from the old
  // hard-cutover behavior.
  function biomeInfoForScore(s) {
    const idx = Math.floor(s / BIOME_SCORE_STEP);
    const from = BIOME_ORDER[idx % BIOME_ORDER.length];
    const to = BIOME_ORDER[(idx + 1) % BIOME_ORDER.length];
    const nextBoundary = (idx + 1) * BIOME_SCORE_STEP;
    const windowStart = nextBoundary - BIOME_TRANSITION_WINDOW;
    const t = s >= windowStart ? Math.min(1, (s - windowStart) / BIOME_TRANSITION_WINDOW) : 0;
    return { from, to, t };
  }

  // Static backdrop art for each non-desert biome (the source art is one
  // illustrated scene per biome, not a tileable strip like mountains.png,
  // so it doesn't scroll — see drawBackground).
  const BIOME_BACKDROPS = {
    selva: { sprite: 'selvaBg', sky: '#42646b', ground: 'selvaGround' },
    neve: { sprite: 'neveBg', sky: '#406eb0', ground: 'neveGround' },
    vulcao: { sprite: 'vulcaoBg', sky: '#3f3c56', ground: 'vulcaoGround' },
  };

  // Ground-obstacle sprites are per biome — desert's cactus/rock set must
  // never appear once a biome swap has happened, and vice versa. Each
  // biome keeps the same 4 roles (unlockedTypes/CACTUS_*_H/ROCK_*_H below
  // are untouched) so difficulty and hitboxes stay identical; only the
  // artwork per role changes.
  const BIOME_OBSTACLE_SPRITES = {
    desert: { cactusSmall: 'cactusSmall', cactusBig: 'cactusBig', rock: 'rock', rockSmall: 'rockSmall' },
    selva: { cactusSmall: 'selvaObstacleSmall', cactusBig: 'selvaObstacleBig', rock: 'selvaObstacleRock', rockSmall: 'selvaObstacleRockSmall' },
    neve: { cactusSmall: 'neveObstacleSmall', cactusBig: 'neveObstacleBig', rock: 'neveObstacleRock', rockSmall: 'neveObstacleRockSmall' },
    vulcao: { cactusSmall: 'vulcaoObstacleSmall', cactusBig: 'vulcaoObstacleBig', rock: 'vulcaoObstacleRock', rockSmall: 'vulcaoObstacleRockSmall' },
  };
  // Chooses which biome's obstacle art a *newly spawned* group uses.
  // During a transition window this probabilistically mixes old/new-biome
  // obstacles, shifting from 100% old to 100% new as t goes 0→1 — already
  // on-screen obstacles keep whatever they spawned with (see spawnBiome
  // stored per obstacle) so nothing changes appearance mid-flight.
  function pickSpawnBiome() {
    const { from, to, t } = biomeInfoForScore(score);
    return Math.random() < t ? to : from;
  }

  function reactionTimeFloor() {
    const t = 1.05 - score * 0.0009;
    return Math.max(0.55, t);
  }

  function maxClusterWidth(speed) {
    return speed * AIR_TIME * 0.72;
  }

  // Thresholds retuned 2026-09-05: at the original 70/150/260, every
  // obstacle type was already unlocked within the first ~5 seconds of any
  // run (score climbs fast — see SPEED_PER_POINT above), so there was
  // nothing new to react to for the rest of a long run. Spaced out so
  // variety keeps revealing itself over the first ~35-40s instead —
  // SPEED_PER_POINT and the reaction-time floor are untouched.
  function unlockedTypes() {
    const types = ['cactusSmall'];
    if (score >= 500) types.push('cactusBig');
    if (score >= 1500) types.push('rock');
    if (score >= 3500) types.push('rockSmall');
    return types;
  }

  function clusterChance() {
    if (score < 130) return 0;
    return Math.min(0.6, (score - 130) / 900);
  }

  function pickObstacleType(types) {
    return types[Math.floor(Math.random() * types.length)];
  }

  function obstacleSpec(type, biome) {
    const sprites = BIOME_OBSTACLE_SPRITES[biome] || BIOME_OBSTACLE_SPRITES.desert;
    switch (type) {
      case 'cactusSmall': return { img: SPRITES[sprites.cactusSmall], h: CACTUS_SMALL_H };
      case 'cactusBig': return { img: SPRITES[sprites.cactusBig], h: CACTUS_BIG_H };
      case 'rock': return { img: SPRITES[sprites.rock], h: ROCK_H };
      case 'rockSmall': return { img: SPRITES[sprites.rockSmall], h: ROCK_SMALL_H };
    }
  }

  function obstacleDims(type, biome) {
    const spec = obstacleSpec(type, biome);
    return { w: spriteWidthForHeight(spec.img, spec.h), h: spec.h };
  }

  function spawnObstacleGroup() {
    const speed = currentSpeed();
    const types = unlockedTypes();
    const spawnBiome = pickSpawnBiome();
    const startX = W + 10;
    let groupEndX = startX;

    if (Math.random() < clusterChance()) {
      const maxW = maxClusterWidth(speed);
      const gapBetween = 18 + Math.random() * 14;
      const count = Math.random() < 0.55 ? 2 : 3;
      let cursor = startX;
      let totalW = 0;
      const planned = [];
      for (let i = 0; i < count; i++) {
        const type = i === 0 && types.includes('cactusBig') && Math.random() < 0.3
          ? 'cactusBig' : 'cactusSmall';
        const dims = obstacleDims(type, spawnBiome);
        const addW = (planned.length ? gapBetween : 0) + dims.w;
        if (totalW + addW > maxW && planned.length > 0) break;
        planned.push({ type, dims });
        totalW += addW;
      }
      planned.forEach((p) => {
        obstacles.push({ x: cursor, w: p.dims.w, h: p.dims.h, type: p.type, biome: spawnBiome });
        cursor += p.dims.w + gapBetween;
      });
      groupEndX = cursor;
    } else {
      const type = pickObstacleType(types);
      const dims = obstacleDims(type, spawnBiome);
      obstacles.push({ x: startX, w: dims.w, h: dims.h, type, biome: spawnBiome });
      groupEndX = startX + dims.w;
    }
    maybeSpawnRewardCoins(groupEndX);
  }

  // Reward coins: sit just behind an obstacle group, inside the arc a
  // clearing jump already makes, so a well-timed dodge sometimes doubles
  // as a coin grab instead of coins living on a totally unrelated
  // schedule from the obstacles themselves. Purely additive — the
  // ambient coin-cluster timer (scheduleNextCoinCluster) is unchanged.
  const REWARD_COIN_CHANCE = 0.45;
  const REWARD_COIN_GAP = 46;
  function maybeSpawnRewardCoins(afterX) {
    if (Math.random() >= REWARD_COIN_CHANCE) return;
    const baseY = GROUND_Y - 45 - Math.random() * 25; // inside most clearing jumps' arc, not just the apex
    for (let i = 0; i < COIN_CLUSTER_SIZE; i++) {
      const arc = Math.sin((i / (COIN_CLUSTER_SIZE - 1)) * Math.PI) * 14;
      coins.push({
        x: afterX + REWARD_COIN_GAP + i * 22,
        baseY: baseY - arc,
        w: COIN_SIZE,
        h: COIN_SIZE,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function scheduleNextSpawn() {
    const speed = currentSpeed();
    const minGap = speed * reactionTimeFloor();
    const variability = minGap * (0.5 + Math.random() * 1.0);
    nextSpawnGap = minGap + variability;
    distanceSinceLastSpawn = 0;
  }

  function scheduleNextDecor() {
    nextDecorGap = 280 + Math.random() * 440;
    distanceSinceLastDecor = 0;
  }

  const DECOR_TYPES = ['bush', 'sign', 'fence'];
  function spawnDecor() {
    const key = DECOR_TYPES[Math.floor(Math.random() * DECOR_TYPES.length)];
    const img = SPRITES[key];
    const w = spriteWidthForHeight(img, DECOR_H);
    decor.push({ x: W + 10, w, h: DECOR_H, key });
  }

  // ---------------------------------------------------------
  // Power-ups: spawn, effects, HUD sync
  // ---------------------------------------------------------
  function schedulePowerupSpawn() {
    nextPowerupGap = 480 + Math.random() * 420;
    distanceSinceLastPowerup = 0;
  }

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
    const lifetimeCoins = AchievementStore.addLifetimeCoins(1);
    if (lifetimeCoins >= 100) unlockAchievement('coins_100');
    if (lifetimeCoins >= 1000) unlockAchievement('coins_1000');
  }

  // Called once per obstacle successfully cleared (see the obstacle
  // cleanup step in update()). Crossing a multiple of STREAK_MILESTONE
  // fires a small celebration distinct from the score-milestone pulse —
  // this one rewards dodging skill specifically, not just time played.
  function registerObstaclesCleared(count) {
    const prevMilestone = Math.floor(obstacleStreak / STREAK_MILESTONE);
    obstacleStreak += count;
    const newMilestone = Math.floor(obstacleStreak / STREAK_MILESTONE);
    if (newMilestone > prevMilestone) celebrateStreak();
    if (obstacleStreak >= 10) unlockAchievement('streak_10');
    if (obstacleStreak >= 50) unlockAchievement('streak_50');
  }

  function celebrateStreak() {
    const cx = PLAYER_RIGHT_X - currentGirlH() * 0.32;
    const cy = player.y - currentGirlH() * 0.75;
    Particles.sparkle(cx, cy, { color: '#e8b23d', shape: 'star', size: 11, spread: 10 });
    Particles.sparkle(cx - 16, cy - 8, { color: '#a83f1f', shape: 'star', size: 8, spread: 10 });
    Particles.sparkle(cx + 14, cy - 4, { color: '#e8b23d', shape: 'star', size: 8, spread: 10 });
    AudioMgr.streak();
  }

  function celebrateNewRecordMidRun(flooredScore) {
    highScore = flooredScore;
    localStorage.setItem('marianaRunnerHighScore', String(highScore));
    updateHud();
    const px = PLAYER_RIGHT_X - currentHitbox().width / 2;
    Particles.burst(px, player.y - currentGirlH() * 0.6);
    AudioMgr.record();
    announce(`Novo recorde: ${flooredScore} pontos!`);
    unlockAchievement('new_record');
  }

  // Permanent one-time unlocks (AchievementStore, in js/achievements.js).
  // unlockAchievement() is safe to call every time its condition is true —
  // AchievementStore.unlock() itself no-ops (returns false) once an id is
  // already unlocked, so call sites never need their own "only once" guard.
  //
  // Two achievements can legitimately unlock in the same frame (e.g.
  // crossing 5000 points in the same tick a new personal record is set),
  // so the toast is a small FIFO queue rather than a single slot — without
  // it, a second unlockAchievement() call mid-transition would overwrite
  // the first toast's text while its fade-in animation was still playing,
  // producing garbled overlapping text instead of two clean toasts in a row.
  let achievementToastQueue = [];
  let achievementToastShowing = false;
  let achievementToastTimer = null;
  function showAchievementToast(name) {
    achievementToastQueue.push(name);
    if (!achievementToastShowing) advanceAchievementToastQueue();
  }
  function advanceAchievementToastQueue() {
    const name = achievementToastQueue.shift();
    if (name === undefined) { achievementToastShowing = false; return; }
    achievementToastShowing = true;
    achievementToastName.textContent = name.toUpperCase();
    achievementToast.hidden = false;
    requestAnimationFrame(() => achievementToast.classList.add('is-visible'));
    clearTimeout(achievementToastTimer);
    achievementToastTimer = setTimeout(() => {
      achievementToast.classList.remove('is-visible');
      setTimeout(() => {
        achievementToast.hidden = true;
        advanceAchievementToastQueue();
      }, 260);
    }, 2200);
  }

  function unlockAchievement(id) {
    if (!AchievementStore.unlock(id)) return;
    const def = achievementById(id);
    if (!def) return;
    showAchievementToast(def.name);
    AudioMgr.achievement();
    announce(`Conquista desbloqueada: ${def.name}.`);
  }

  function spawnPowerup() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const baseY = GROUND_Y - 95 - Math.random() * 20;
    powerups.push({ x: W + 10, w: POWERUP_SIZE, h: POWERUP_SIZE, type, baseY, bobPhase: Math.random() * Math.PI * 2 });
  }

  function updateStatusBadges() {
    statusBadges.shield.hidden = !shieldActive;
    statusBadges.star.hidden = multiplierTimer <= 0;
    statusBadges.jump.hidden = !doubleJumpActive;
    if (multiplierTimer <= 0) lastShownStarSeconds = null;
    if (!doubleJumpActive) lastShownJumpSeconds = null;
  }

  function updateStatusTimers() {
    if (multiplierTimer > 0) {
      const secs = Math.ceil(multiplierTimer);
      if (secs !== lastShownStarSeconds) {
        lastShownStarSeconds = secs;
        statusStarTime.textContent = secs + 's';
      }
    }
    if (doubleJumpTimer > 0) {
      const secs = Math.ceil(doubleJumpTimer);
      if (secs !== lastShownJumpSeconds) {
        lastShownJumpSeconds = secs;
        statusJumpTime.textContent = secs + 's';
      }
    }
  }

  function collectPowerup(type, x, y) {
    AudioMgr.powerup();
    Particles.dust(x, y, { count: 10, color: 'rgba(168,63,31,' });
    pulseScore();
    if (type === 'shield') {
      shieldActive = true;
    } else if (type === 'star') {
      scoreMultiplier = 2;
      multiplierTimer = MULTIPLIER_DURATION;
    } else if (type === 'jump') {
      doubleJumpActive = true;
      doubleJumpTimer = DOUBLE_JUMP_DURATION;
      airJumpsUsed = 0;
    }
    updateStatusBadges();
  }

  // ---------------------------------------------------------
  // State machine / UI sync
  // ---------------------------------------------------------
  function setState(next) {
    state = next;
    overlays.loading.hidden = next !== 'loading';
    overlays.start.hidden = next !== 'start';
    overlays.pause.hidden = next !== 'paused';
    overlays.gameover.hidden = next !== 'gameover';
    btnPause.hidden = !(next === 'playing' || next === 'paused');
    btnPause.setAttribute('aria-label', next === 'paused' ? 'Continuar' : 'Pausar');
    btnPause.querySelector('.icon-pause').hidden = next === 'paused';
    btnPause.querySelector('.icon-play').hidden = next !== 'paused';
    hud.hidden = !(next === 'playing' || next === 'paused' || next === 'gameover');

    if (next === 'start' && !seenHint) {
      tapHint.classList.add('is-visible');
    } else {
      tapHint.classList.remove('is-visible');
    }

    if (next === 'playing') {
      AudioMgr.startAmbient();
    } else {
      AudioMgr.stopAmbient();
    }
  }

  function announce(text) { srAnnouncer.textContent = text; }

  function pulseScore() {
    hudScoreValue.classList.remove('pulse');
    // eslint-disable-next-line no-unused-expressions
    void hudScoreValue.offsetWidth; // restart CSS animation
    hudScoreValue.classList.add('pulse');
  }

  // ---------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------
  function performGroundJump() {
    player.jumping = true;
    player.vy = JUMP_VELOCITY;
    player.airTimer = 0;
    player.squashT = 0;
    player.squashKind = 'takeoff';
    AudioMgr.jump();
  }

  function tryJump() {
    if (state === 'start' || state === 'gameover') {
      startGame();
      return;
    }
    if (state !== 'playing') return;
    if (!player.jumping) {
      performGroundJump();
    } else if (doubleJumpActive && airJumpsUsed < 1) {
      player.vy = JUMP_VELOCITY * 0.82;
      player.airTimer = 0;
      airJumpsUsed += 1;
      player.squashT = 0;
      player.squashKind = 'takeoff';
      AudioMgr.jump();
      Particles.dust(PLAYER_RIGHT_X - 60, player.y - 20, { count: 6 });
    } else {
      // Pressed a little early — honor it the instant Mariana lands.
      jumpBufferTimer = JUMP_BUFFER_WINDOW;
    }
  }

  function togglePause() {
    if (state === 'playing') {
      setState('paused');
      announce('Jogo pausado.');
    } else if (state === 'paused') {
      lastTime = null; // avoid a giant dt jump on resume
      setState('playing');
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      AudioMgr.unlock();
      tryJump();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing' || state === 'paused') {
        e.preventDefault();
        togglePause();
      }
    } else if (e.code === 'KeyM') {
      setMuted(AudioMgr.toggleMuted());
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    AudioMgr.unlock();
    if (state === 'playing') tryJump();
  });
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  function setMuted(muted) {
    btnMute.setAttribute('aria-pressed', String(muted));
    btnMute.querySelector('.icon-sound-on').hidden = muted;
    btnMute.querySelector('.icon-sound-off').hidden = !muted;
  }
  setMuted(AudioMgr.isMuted());

  btnMute.addEventListener('click', () => {
    const muted = AudioMgr.toggleMuted();
    setMuted(muted);
    if (!muted) AudioMgr.uiClick();
  });
  btnPause.addEventListener('click', () => { AudioMgr.uiClick(); togglePause(); });

  function wireOverlayAction(overlayEl, handler) {
    overlayEl.addEventListener('click', (e) => {
      AudioMgr.unlock();
      handler(e);
    });
  }
  wireOverlayAction(overlays.start, () => startGame());
  wireOverlayAction(overlays.gameover, () => startGame());
  wireOverlayAction(overlays.pause, () => { if (state === 'paused') togglePause(); });

  [btnStart, btnRestart, btnResume].forEach((btn) => {
    btn.addEventListener('mouseenter', () => AudioMgr.uiHover());
  });

  // ---------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------
  function startGame() {
    if (!seenHint) {
      seenHint = true;
      localStorage.setItem('marianaRunnerSeenHint', '1');
    }
    score = 0;
    milestoneFloor = 0;
    lastMilestoneTime = -Infinity;
    elapsed = 0;
    obstacles = [];
    decor = [];
    powerups = [];
    coins = [];
    Particles.clear();
    resetPlayerY();
    player.vy = 0;
    player.jumping = false;
    player.wasJumping = false;
    player.frame = 0;
    player.frameTimer = 0;
    player.airTimer = 0;
    footstrikeCyclePuffsOn = true;
    shieldActive = false;
    doubleJumpActive = false;
    doubleJumpTimer = 0;
    airJumpsUsed = 0;
    scoreMultiplier = 1;
    multiplierTimer = 0;
    obstacleStreak = 0;
    recordBrokenThisRun = false;
    jumpBufferTimer = 0;
    updateStatusBadges();
    scheduleNextSpawn();
    scheduleNextDecor();
    schedulePowerupSpawn();
    scheduleNextCoinCluster();
    lastTime = null;
    setState('playing');
    AudioMgr.start();
    updateHud();
  }

  function endGame() {
    const finalScore = Math.floor(score);
    unlockAchievement('first_run');
    const isRecord = finalScore > highScore && finalScore > 0;
    if (isRecord) {
      highScore = finalScore;
      localStorage.setItem('marianaRunnerHighScore', String(highScore));
    }
    shieldActive = false;
    doubleJumpActive = false;
    doubleJumpTimer = 0;
    scoreMultiplier = 1;
    multiplierTimer = 0;
    updateStatusBadges();
    setState('gameover');
    AudioMgr.hit();
    setTimeout(() => AudioMgr.gameOver(), 120);

    finalScoreEl.textContent = String(finalScore);
    recordBadge.hidden = !isRecord;
    updateHud();

    if (isRecord) {
      const px = PLAYER_RIGHT_X - currentHitbox().width / 2;
      Particles.burst(px, player.y - currentGirlH() * 0.6);
      setTimeout(() => AudioMgr.record(), 260);
      announce(`Fim de jogo. Novo recorde: ${finalScore} pontos.`);
    } else {
      announce(`Fim de jogo. Pontuação: ${finalScore}.`);
    }
  }

  function updateHud() {
    hudScoreValue.textContent = String(Math.floor(score)).padStart(5, '0');
    hudHiscoreValue.textContent = String(highScore).padStart(5, '0');
  }

  function updateCoinsHud() {
    hudCoinsValue.textContent = String(coinBalance);
    menuCoinsValue.textContent = String(coinBalance);
    wardrobeCoinsValue.textContent = String(coinBalance);
  }

  // renderWardrobe() populates #wardrobe-grid — defined further down
  // (Wardrobe card rendering section). Declared with `function` there
  // so it's hoisted and callable from here regardless of file order,
  // exactly like every other forward reference already in this file
  // (e.g. AudioMgr, Particles).
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

  const SKIN_ICON_SVG = {
    normal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M4 18h16l-1.5-8-4 3-2.5-5-2.5 5-4-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    volleyball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M5 8c3 2 11 2 14 0M5 16c3-2 11-2 14 0" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M15 3a9 9 0 1 0 6 15 7 7 0 0 1-6-15z" fill="currentColor"/></svg>',
    monkey: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="5.5" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18.5" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9.3" cy="13" r="0.9" fill="currentColor"/><circle cx="14.7" cy="13" r="0.9" fill="currentColor"/><path d="M9.5 17.5c1-1 4-1 5 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    pixel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6" fill="currentColor"/><rect x="15" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="15" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="15" y="15" width="6" height="6" fill="currentColor"/></svg>',
    sheriffstar: '<svg viewBox="0 0 24 24"><path d="M12 3l2.1 4.4 4.9.6-3.6 3.4.9 4.9-4.3-2.4-4.3 2.4.9-4.9L5 8l4.9-.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    gem: '<svg viewBox="0 0 24 24"><path d="M6 4h12l3 5-9 11L3 9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    bunny: '<svg viewBox="0 0 24 24"><path d="M9 10c-1-3 0-6 1.5-6S12 7 12 10M15 10c1-3 0-6-1.5-6S12 7 12 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    devilhorns: '<svg viewBox="0 0 24 24"><path d="M7 9c-2-2-2-5 0-6 1 1 2 3 2 5M17 9c2-2 2-5 0-6-1 1-2 3-2 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 20l-3-6h6z" fill="currentColor"/></svg>',
    shuriken: '<svg viewBox="0 0 24 24"><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    skull: '<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-7 7c0 3 2 5 3 6v3h2v-2h1v2h2v-2h1v2h2v-3c1-1 3-3 3-6a7 7 0 0 0-7-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9.5" cy="10" r="1.4" fill="currentColor"/><circle cx="14.5" cy="10" r="1.4" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    blossom: '<svg viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="7" r="2.6"/><circle cx="17" cy="10.5" r="2.6"/><circle cx="15" cy="16" r="2.6"/><circle cx="9" cy="16" r="2.6"/><circle cx="7" cy="10.5" r="2.6"/></g></svg>',
    fang: '<svg viewBox="0 0 24 24"><path d="M7 4c1 4 1 7 0 10l3-2 2 4 2-4 3 2c-1-3-1-6 0-10-2 2-3 3-5 3s-3-1-5-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    doll: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 20l1-8h6l1 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    tinystar: '<svg viewBox="0 0 24 24"><path d="M12 5l1.6 3.6L17 10l-3.4 1.4L12 15l-1.6-3.6L7 10l3.4-1.4z" fill="currentColor"/></svg>',
    ribbon: '<svg viewBox="0 0 24 24"><path d="M12 12 4 7v10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12 20 7v10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
    chefhat: '<svg viewBox="0 0 24 24"><path d="M7 11a4 4 0 0 1 3-6 3 3 0 0 1 4 0 4 4 0 0 1 3 6v3H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="7" y="15" width="10" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    heartarrow: '<svg viewBox="0 0 24 24"><path d="M12 19s-7-4.4-7-9.3A4 4 0 0 1 12 7a4 4 0 0 1 7 2.7C19 14.6 12 19 12 19z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 5l5 5M8 5H3v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wand: '<svg viewBox="0 0 24 24"><path d="M5 19 17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 3l1.2 2.8L21 7l-2.8 1.2L17 11l-1.2-2.8L13 7l2.8-1.2z" fill="currentColor"/></svg>',
    bat: '<svg viewBox="0 0 24 24"><path d="M12 8c-2-3-6-4-9-2 2 0 3 1 4 2-2 0-3 1-4 3 2-1 4-1 5 0-1 1-1 2 0 3 1-2 2-3 4-3s3 1 4 3c1-1 1-2 0-3 1-1 3-1 5 0-1-2-2-3-4-3 1-1 2-2 4-2-3-2-7-1-9 2z" fill="currentColor"/></svg>',
    lamp: '<svg viewBox="0 0 24 24"><path d="M4 17c0-2 2-3 4-3h5l3-3h3l-2 3c2 .3 3 1.6 3 3 0 2-2 3-8 3s-8-1-8-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    pawprint: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15" r="4" fill="currentColor"/><circle cx="7" cy="9" r="2" fill="currentColor"/><circle cx="12" cy="6.5" r="2" fill="currentColor"/><circle cx="17" cy="9" r="2" fill="currentColor"/></svg>',
    witchhat: '<svg viewBox="0 0 24 24"><path d="M12 3l5 12H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="4" y="15" width="16" height="2.4" rx="1" fill="currentColor"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 2c2 4-2 5-2 9a4 4 0 1 0 8 0c0-2-1-4-2-5 1 2 0 4-1 4a2 2 0 0 1-2-2c0-3 2-4-1-6z" fill="currentColor"/></svg>',
    halo: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="6" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 10c0 5 3 9 6 9s6-4 6-9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
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
      const previewSrc = SKIN_PREVIEW_READY[skin.id]
        ? `assets/sprites/skins/${skin.id}/girl_idle_01.png`
        : 'assets/sprites/girl_idle_01.png';
      return `
        <div class="skin-card">
          <div class="skin-card-preview">
            <img src="${previewSrc}" alt="${skin.name}">
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
        if (SkinStore.getUnlocked().length === SKIN_DEFS.length) unlockAchievement('all_skins');
      }
    } else if (action === 'owned') {
      SkinStore.setEquipped(id);
      loadSkinFullFrames(id); // fire-and-forget: lazy full-cycle load, see sprites.js
      AudioMgr.uiClick();
    }
    renderWardrobe();
  });

  // ---------------------------------------------------------
  // Update
  // ---------------------------------------------------------
  function update(dt) {
    ScreenShake.update(dt);
    Particles.update(dt, GRAVITY);

    if (state !== 'playing') return;

    elapsed += dt;
    const speed = currentSpeed();
    score += dt * (speed / 6.5) * scoreMultiplier;

    const flooredScore = Math.floor(score);
    if (flooredScore >= milestoneFloor + 100) {
      milestoneFloor = Math.floor(flooredScore / 100) * 100;
      if (elapsed - lastMilestoneTime >= MIN_MILESTONE_INTERVAL) {
        lastMilestoneTime = elapsed;
        AudioMgr.milestone();
        pulseScore();
      }
    }

    if (!recordBrokenThisRun && highScore > 0 && flooredScore > highScore) {
      recordBrokenThisRun = true;
      celebrateNewRecordMidRun(flooredScore);
    }

    if (flooredScore >= 5000) unlockAchievement('score_5000');

    if (multiplierTimer > 0) {
      multiplierTimer -= dt;
      if (multiplierTimer <= 0) { multiplierTimer = 0; scoreMultiplier = 1; updateStatusBadges(); }
    }
    if (doubleJumpTimer > 0) {
      doubleJumpTimer -= dt;
      if (doubleJumpTimer <= 0) { doubleJumpTimer = 0; doubleJumpActive = false; updateStatusBadges(); }
    }
    if (jumpBufferTimer > 0) jumpBufferTimer -= dt;
    updateStatusTimers();

    // --- player physics ---
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.jumping) player.airTimer += dt;
    if (player.y >= GROUND_Y) {
      const wasAirborne = player.jumping;
      player.y = GROUND_Y;
      player.vy = 0;
      player.jumping = false;
      player.airTimer = 0;
      airJumpsUsed = 0;
      if (wasAirborne) {
        player.squashT = 0;
        player.squashKind = 'land';
        AudioMgr.land();
        const hb = currentHitbox();
        const px = PLAYER_RIGHT_X - hb.width - hb.rightInset + hb.width / 2;
        Particles.dust(px, GROUND_Y, { count: 5 });
      }
      if (jumpBufferTimer > 0) {
        jumpBufferTimer = 0;
        performGroundJump();
      }
    }
    if (player.squashKind) {
      player.squashT += dt;
      if (player.squashT > 0.16) player.squashKind = null;
    }

    // --- run animation ---
    if (!player.jumping) {
      player.frameTimer += dt;
      const cycleSeconds = Math.max(
        RUN_CYCLE_SECONDS_MIN,
        RUN_CYCLE_SECONDS_BASE - score / 2600
      );
      const frameDuration = cycleSeconds / RUN_FRAME_COUNT;
      if (player.frameTimer >= frameDuration) {
        player.frameTimer = 0;
        const next = (player.frame + 1) % RUN_FRAME_COUNT;
        if (next === 0) footstrikeCyclePuffsOn = !footstrikeCyclePuffsOn;
        if (FOOTSTRIKE_FRAMES.has(next) && footstrikeCyclePuffsOn) {
          const px = PLAYER_RIGHT_X - currentHitbox().rightInset;
          Particles.dust(px, GROUND_Y, { count: 1, driftX: speed * 0.15 });
        }
        player.frame = next;
      }
    }

    // --- obstacles ---
    distanceSinceLastSpawn += speed * dt;
    if (distanceSinceLastSpawn >= nextSpawnGap) {
      spawnObstacleGroup();
      scheduleNextSpawn();
    }
    for (const o of obstacles) o.x -= speed * dt;
    // An obstacle only ever reaches this off-screen threshold by having
    // scrolled all the way past the player without colliding — a hit
    // ends the run (see below) and freezes further movement, so every
    // removal here is a genuinely cleared obstacle.
    const clearedCount = obstacles.reduce((n, o) => n + (o.x + o.w <= -10 ? 1 : 0), 0);
    if (clearedCount > 0) registerObstaclesCleared(clearedCount);
    obstacles = obstacles.filter(o => o.x + o.w > -10);

    // --- decor ---
    distanceSinceLastDecor += speed * dt;
    if (distanceSinceLastDecor >= nextDecorGap) {
      spawnDecor();
      scheduleNextDecor();
    }
    for (const d of decor) d.x -= speed * dt;
    decor = decor.filter(d => d.x + d.w > -10);

    // --- power-ups ---
    distanceSinceLastPowerup += speed * dt;
    if (distanceSinceLastPowerup >= nextPowerupGap) {
      if (score >= POWERUP_MIN_SCORE) spawnPowerup();
      schedulePowerupSpawn();
    }
    for (const p of powerups) p.x -= speed * dt;
    powerups = powerups.filter(p => p.x + p.w > -10);

    // --- coins ---
    distanceSinceLastCoinCluster += speed * dt;
    if (distanceSinceLastCoinCluster >= nextCoinGap) {
      spawnCoinCluster();
      scheduleNextCoinCluster();
    }
    for (const c of coins) c.x -= speed * dt;
    coins = coins.filter(c => c.x + c.w > -10);

    // --- collision ---
    const hitbox = currentHitbox();
    const px = PLAYER_RIGHT_X - hitbox.rightInset - hitbox.width;
    const pw = hitbox.width;
    const spriteTop = player.y - currentGirlH();
    const hitboxY = spriteTop + hitbox.topInset;
    const hitboxH = hitbox.height;

    // Power-up pickups use a generous, forgiving box around the same
    // anchor — collecting a buff should feel easy, unlike dodging.
    const pickupX = px - 14;
    const pickupW = pw + 28;
    const pickupY = hitboxY - 20;
    const pickupH = hitboxH + 40;
    const collected = [];
    for (const p of powerups) {
      const bobY = p.baseY + Math.sin(elapsed * 2.4 + p.bobPhase) * 8;
      const pux = p.x;
      const puy = bobY - p.h / 2;
      if (pickupX < pux + p.w && pickupX + pickupW > pux && pickupY < puy + p.h && pickupY + pickupH > puy) {
        collected.push(p);
        collectPowerup(p.type, pux + p.w / 2, puy + p.h / 2);
      }
    }
    if (collected.length) powerups = powerups.filter(p => !collected.includes(p));

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

    for (const o of obstacles) {
      const ox = o.x + o.w * 0.18;
      const oy = GROUND_Y - o.h + o.h * 0.12;
      const ow = o.w * 0.64;
      const oh = o.h * 0.85;
      if (px < ox + ow && px + pw > ox && hitboxY < oy + oh && hitboxY + hitboxH > oy) {
        if (shieldActive) {
          shieldActive = false;
          obstacleStreak = 0;
          updateStatusBadges();
          AudioMgr.shieldBreak();
          ScreenShake.hit(0.5);
          Particles.dust(ox + ow / 2, oy + oh / 2, { count: 10, color: 'rgba(43,43,43,' });
          obstacles = obstacles.filter(other => other !== o);
          unlockAchievement('shield_save');
          break;
        }
        obstacleStreak = 0;
        ScreenShake.hit(1);
        Particles.dust(px + pw / 2, hitboxY + hitboxH / 2, { count: 8, color: 'rgba(90,80,68,' });
        endGame();
        break;
      }
    }

    // --- background parallax ---
    for (const c of clouds) {
      c.x -= speed * 0.12 * dt;
      if (c.x < -140) c.x = W + Math.random() * 80;
    }
    mountainScrollX -= speed * 0.28 * dt;
    groundScrollX -= speed * dt;

    updateHud();
  }

  function updateIdleAnimation(dt) {
    idleTimer += dt;
    if (idleTimer >= 0.6) {
      idleTimer = 0;
      idleFrame = idleFrame === 0 ? 1 : 0;
    }
  }

  // ---------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------
  function drawStars(darkness) {
    // Stars fade in/out smoothly with the darkest sliver of the cycle —
    // never a hard on/off switch, matching the continuous lighting curve.
    const visibility = Math.max(0, (darkness - 0.55) / 0.45);
    if (visibility <= 0) return;
    ctx.save();
    for (const s of STAR_FIELD) {
      const twinkle = 0.35 + 0.35 * Math.sin(elapsed * 1.5 + s.seed);
      const alpha = Math.max(0, twinkle) * visibility;
      ctx.fillStyle = `rgba(243,234,217,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * GROUND_Y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPhaseTint(darkness) {
    if (darkness <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tintForDarkness(darkness);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawIconGlyph(path, cx, cy, size, style) {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.lineJoin = 'round';
    if (style.fill) {
      ctx.fillStyle = style.fill;
      ctx.fill(path);
    }
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.lineWidth || 2;
      ctx.stroke(path);
    }
    ctx.restore();
  }

  function drawPowerups() {
    for (const p of powerups) {
      const bobY = p.baseY + Math.sin(elapsed * 2.4 + p.bobPhase) * 8;
      const cx = p.x + p.w / 2;
      const cy = bobY;
      ctx.save();
      ctx.fillStyle = '#f3ead9';
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const iconSize = p.w * 0.55;
      if (p.type === 'shield') drawIconGlyph(ICON_PATHS.shield, cx, cy, iconSize, { stroke: '#2b2b2b', lineWidth: 2.2 });
      else if (p.type === 'star') drawIconGlyph(ICON_PATHS.star, cx, cy, iconSize, { fill: '#2b2b2b' });
      else if (p.type === 'jump') drawIconGlyph(ICON_PATHS.jump, cx, cy, iconSize, { fill: '#2b2b2b' });
    }
  }

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

  // Sky + backdrop (mountains or the static biome scene) for one biome,
  // drawn at the given opacity. Used twice per frame during a transition
  // window (outgoing biome at alpha 1, incoming biome layered on top at
  // alpha t) so the swap dissolves gradually instead of cutting instantly.
  function drawBiomeSkyAndBackdrop(biomeName, alpha, gY) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const backdrop = BIOME_BACKDROPS[biomeName];
    if (backdrop) {
      ctx.fillStyle = backdrop.sky;
      ctx.fillRect(0, 0, W, H);
      const bgImg = SPRITES[backdrop.sprite];
      const bgH = Math.min(200, gY * 0.78);
      const bgW = spriteWidthForHeight(bgImg, bgH);
      ctx.drawImage(bgImg, (W - bgW) / 2, gY - bgH, bgW, bgH);
    } else {
      ctx.fillStyle = '#f3ead9';
      ctx.fillRect(0, 0, W, H);

      const mImg = SPRITES.mountains;
      const mH = 96;
      const mW = spriteWidthForHeight(mImg, mH);
      const mY = GROUND_Y - mH + 30;
      let mx = (mountainScrollX % mW) - mW;
      while (mx < W) {
        ctx.drawImage(mImg, mx, mY, mW, mH);
        mx += mW;
      }
    }
    ctx.restore();
  }

  // Ground tile for one biome, drawn at the given opacity — same
  // crossfade pairing as drawBiomeSkyAndBackdrop above.
  function drawBiomeGround(biomeName, alpha, gY) {
    const backdrop = BIOME_BACKDROPS[biomeName];
    const gImg = backdrop ? SPRITES[backdrop.ground] : SPRITES.groundTile;
    const gW = spriteWidthForHeight(gImg, GROUND_TILE_H);
    let gx = (groundScrollX % gW) - gW;
    ctx.save();
    ctx.globalAlpha = alpha;
    while (gx < W) {
      ctx.drawImage(gImg, gx, gY, gW, GROUND_TILE_H);
      gx += gW;
    }
    // A thin, mostly-transparent wash over the ground band — softens the
    // desert tile's naturally busy repeating diamond pattern (a
    // fast-scrolling, high-contrast texture sitting exactly where the
    // player fixates to time jumps) without touching the art asset itself
    // or its scroll speed. Same technique as the day/night tint, just very
    // faint and constant regardless of time of day. Desert-specific — the
    // other biomes' ground crops don't share that pattern.
    if (!backdrop) {
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = '#f3ead9';
      ctx.fillRect(0, gY, W, GROUND_TILE_H);
    }
    ctx.restore();
  }

  function drawBackground() {
    const gY = H - GROUND_TILE_H;
    const { from, to, t } = biomeInfoForScore(score);

    drawBiomeSkyAndBackdrop(from, 1, gY);
    if (t > 0) drawBiomeSkyAndBackdrop(to, t, gY);

    for (const c of clouds) {
      const img = SPRITES[c.img];
      const h = 70 * c.scale;
      const w = spriteWidthForHeight(img, h);
      ctx.drawImage(img, c.x, c.y, w, h);
    }

    drawBiomeGround(from, 1, gY);
    if (t > 0) drawBiomeGround(to, t, gY);
  }

  function drawDecor() {
    for (const d of decor) {
      const img = SPRITES[d.key];
      ctx.drawImage(img, d.x, GROUND_Y - d.h, d.w, d.h);
    }
  }

  function jumpFrameIndex() {
    const t = Math.min(1, player.airTimer / AIR_TIME);
    return Math.min(JUMP_FRAME_COUNT - 1, Math.floor(t * JUMP_FRAME_COUNT));
  }

  function squashScale() {
    if (!player.squashKind) return { scaleX: 1, scaleY: 1 };
    const t = Math.min(1, player.squashT / 0.16);
    const eased = Math.sin(t * Math.PI); // 0 -> 1 -> 0
    if (player.squashKind === 'takeoff') {
      return { scaleX: 1 - eased * 0.08, scaleY: 1 + eased * 0.1 };
    }
    return { scaleX: 1 + eased * 0.12, scaleY: 1 - eased * 0.14 };
  }

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
    drawSpriteRB(ctx, img, PLAYER_RIGHT_X, player.y, currentGirlH(), squashScale());
  }

  function drawCat() {
    const airborneLift = (GROUND_Y - player.y) * CAT_JUMP_BOOST;
    const catBottomY = GROUND_Y - airborneLift;
    const catRightX = PLAYER_RIGHT_X - CAT_OFFSET_X;
    let img;
    if (state === 'start') {
      img = CAT_IDLE_FRAMES[idleFrame];
    } else if (player.jumping) {
      img = CAT_JUMP_FRAMES[jumpFrameIndex()];
    } else {
      img = CAT_RUN_FRAMES[player.frame];
    }
    drawSpriteRB(ctx, img, catRightX, catBottomY, CAT_H);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const spec = obstacleSpec(o.type, o.biome);
      ctx.drawImage(spec.img, o.x, GROUND_Y - o.h, o.w, o.h);
    }
  }

  function render() {
    const shake = ScreenShake.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    if (state === 'start') {
      drawBackground();
      drawDecor();
      drawCat();
      drawPlayer();
    } else {
      drawBackground();
      drawDecor();
      drawObstacles();
      drawPowerups();
      drawCoins();
      drawCat();
      drawPlayer();
      if (shieldActive) drawShieldHalo();
      const darkness = currentDarkness();
      drawPhaseTint(darkness);
      drawStars(darkness);
    }
    Particles.draw(ctx);
    ctx.restore();
  }

  function drawShieldHalo() {
    const cx = PLAYER_RIGHT_X - currentGirlH() * 0.32;
    const cy = player.y - currentGirlH() * 0.5;
    ctx.save();
    ctx.strokeStyle = '#2b2b2b';
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(elapsed * 6);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, currentGirlH() * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------
  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    lastTime = timestamp;

    if (state === 'start') updateIdleAnimation(dt);
    if (state !== 'paused') update(dt);
    else { ScreenShake.update(0); }
    render();

    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------
  // Boot
  // ---------------------------------------------------------
  applyResolution();
  let dotCount = 0;
  const loadingTimer = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    loadingDots.textContent = '.'.repeat(dotCount || 3);
  }, 350);

  updateHud();
  updateCoinsHud();
  Promise.all([loadAllSprites(), loadSkinSprites()]).then(() => {
    clearInterval(loadingTimer);
    GIRL_RUN_FRAMES = framesFromPrefix('girlRun', RUN_FRAME_COUNT);
    GIRL_JUMP_FRAMES = framesFromPrefix('girlJump', JUMP_FRAME_COUNT);
    GIRL_IDLE_FRAMES = framesFromPrefix('girlIdle', 2);
    CAT_RUN_FRAMES = framesFromPrefix('catRun', RUN_FRAME_COUNT);
    CAT_JUMP_FRAMES = framesFromPrefix('catJump', JUMP_FRAME_COUNT);
    CAT_IDLE_FRAMES = framesFromPrefix('catIdle', 2);

    initBackground();
    resetPlayerY();
    setState('start');
    requestAnimationFrame(loop);
  }).catch((err) => {
    clearInterval(loadingTimer);
    console.error(err);
    loadingDots.textContent = '';
    document.querySelector('#overlay-loading .loading-label').textContent = 'Erro ao carregar imagens do jogo.';
  });
})();
