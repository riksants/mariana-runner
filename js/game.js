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
  const achievementToastDesc = document.getElementById('achievement-toast-desc');
  const hudHiscore = document.getElementById('hud-hiscore');
  const statusBadges = {
    shield: document.getElementById('status-shield'),
    star: document.getElementById('status-star'),
    jump: document.getElementById('status-jump'),
    coins: document.getElementById('status-coins'),
  };
  const statusStarTime = document.getElementById('status-star-time');
  const statusJumpTime = document.getElementById('status-jump-time');
  const statusCoinsTime = document.getElementById('status-coins-time');

  const overlays = {
    loading: document.getElementById('overlay-loading'),
    start: document.getElementById('overlay-start'),
    pause: document.getElementById('overlay-pause'),
    gameover: document.getElementById('overlay-gameover'),
    transition: document.getElementById('overlay-transition'),
    weddingEnd: document.getElementById('overlay-wedding-end'),
  };
  const overlayWardrobe = document.getElementById('overlay-wardrobe');
  const wardrobeStage = document.getElementById('wardrobe-stage');
  const wardrobeTrack = document.getElementById('wardrobe-track');
  const wardrobeTabs = document.getElementById('wardrobe-tabs');
  const wardrobeCoinsDelta = document.getElementById('wardrobe-coins-delta');
  const btnWrPrev = document.getElementById('btn-wr-prev');
  const btnWrNext = document.getElementById('btn-wr-next');
  const btnWrAction = document.getElementById('btn-wr-action');
  const wrIndexEl = document.getElementById('wr-index');
  const wrTotalEl = document.getElementById('wr-total');
  const wrSwapEl = document.getElementById('wr-swap');
  const wrNameEl = document.getElementById('wr-name');
  const wrPriceEl = document.getElementById('wr-price');
  const wrTagEl = document.getElementById('wr-tag');
  const wrMsgEl = document.getElementById('wr-msg');
  const characterSelect = document.getElementById('character-select');
  const wardrobeCoinsValue = document.getElementById('wardrobe-coins-value');
  const menuCoinsValue = document.getElementById('menu-coins-value');
  const menuRecordValue = document.getElementById('menu-record-value');
  const btnWardrobe = document.getElementById('btn-wardrobe');
  const btnWardrobeGameover = document.getElementById('btn-wardrobe-gameover');
  const btnWardrobeBack = document.getElementById('btn-wardrobe-back');
  const btnCharMariana = document.getElementById('btn-char-mariana');
  const btnCharAlberto = document.getElementById('btn-char-alberto');
  const btnWardrobeTabMariana = document.getElementById('btn-wardrobe-tab-mariana');
  const btnWardrobeTabAlberto = document.getElementById('btn-wardrobe-tab-alberto');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnWeddingRestart = document.getElementById('btn-wedding-restart');
  const btnResume = document.getElementById('btn-resume');
  const btnPause = document.getElementById('btn-pause');
  const btnMute = document.getElementById('btn-mute');
  const finalScoreEl = document.getElementById('final-score');
  const finalRecordEl = document.getElementById('final-record');
  const finalCoinsEl = document.getElementById('final-coins');
  const weddingEndScoreEl = document.getElementById('wedding-end-score');
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
  // Alberto-as-main-runner only (playableCharacter === 'alberto') plays
  // about 40% smaller than the standard size, visually and in hitbox —
  // a pure render/collision-box scale, same mechanism as SKIN_SCALE.mini
  // above, touching nothing about GRAVITY/JUMP_VELOCITY/speed. Does NOT
  // apply to Alberto following Mariana as her companion: drawCat() always
  // draws at the fixed CAT_H below, never through currentGirlScale().
  // Ground alignment and hitbox position need no separate adjustment for
  // this: drawPlayer() -> drawSpriteRB() always anchors the sprite's
  // BOTTOM edge at player.y (never at a fixed height), and the collision
  // hitbox's Y is computed as `player.y - currentGirlH() + hitbox.topInset`
  // (see update()'s "--- collision ---" block) -- both already move
  // together with whatever this constant is, automatically.
  const ALBERTO_SOLO_SCALE = 0.6;
  function currentGirlScale() {
    // Guarded to Mariana's own turn as the main runner: Mariana's equipped
    // skin (and its scale) is independent of Alberto's now, so without
    // this check, playing as Alberto while Mariana happens to have "mini"
    // equipped would shrink Alberto's height/hitbox for the wrong reason —
    // nothing to do with which character is actually on screen.
    if (playableCharacter === 'alberto') return ALBERTO_SOLO_SCALE;
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
    // Cifrão para o 2x moedas: o traço em S mais a barra vertical, no
    // mesmo espaço 24x24 dos ícones acima. Desenhado só com traço, como
    // o escudo — a moeda dourada que ficava aqui antes confundia o
    // power-up com as moedas comuns do chão.
    coins: new Path2D('M16.5 8.5C16.5 6.7 14.5 5.6 12 5.6C9.5 5.6 7.5 6.7 7.5 8.5C7.5 10.3 9.5 11.1 12 12C14.5 12.9 16.5 13.7 16.5 15.5C16.5 17.3 14.5 18.4 12 18.4C9.5 18.4 7.5 17.3 7.5 15.5M12 2.5L12 21.5'),
  };
  const POWERUP_TYPES = ['shield', 'star', 'jump'];

  // 2x moedas. Fica FORA de POWERUP_TYPES de propósito: os três acima
  // continuam sendo sorteados entre si exatamente como antes, e este tem
  // agenda própria — por tempo, não por distância como a dos outros.
  const COIN_BONUS_DURATION = 10;      // segundos de efeito
  const COIN_POWERUP_MIN_GAP = 15;     // segundos entre aparições
  const COIN_POWERUP_MAX_GAP = 20;

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

  // Which character runs in the main position: 'mariana' (default, today's
  // only behavior — Alberto keeps following as the companion) or 'alberto'
  // (he becomes the solo runner, Mariana isn't drawn at all). Persisted so
  // it survives reload/restart; picking a skin for either character is a
  // separate, independent choice (SkinStore / AlbertoSkinStore below).
  const PLAYABLE_CHARACTER_KEY = 'marianaRunnerPlayableCharacter';
  let playableCharacter = localStorage.getItem(PLAYABLE_CHARACTER_KEY) === 'alberto' ? 'alberto' : 'mariana';
  // Which character's skins the wardrobe grid is currently showing —
  // purely a UI toggle, not persisted (always opens on Mariana's tab).
  let wardrobeTab = 'mariana';
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
  // Moedas pegas nesta partida — só para o cartão de Game Over. É um
  // espelho de exibição: o saldo de verdade continua em SkinStore.
  let runCoins = 0;

  let shieldActive = false;
  let doubleJumpActive = false;
  let doubleJumpTimer = 0;
  let airJumpsUsed = 0;
  let scoreMultiplier = 1;
  let multiplierTimer = 0;
  // Multiplicador SÓ das moedas — separado de scoreMultiplier, que é só
  // da pontuação. Por isso os dois podem estar ativos ao mesmo tempo sem
  // um interferir no outro.
  let coinMultiplier = 1;
  let coinBonusTimer = 0;
  let nextCoinPowerupIn = 0;
  let lastShownStarSeconds = null;
  let lastShownJumpSeconds = null;
  let lastShownCoinSeconds = null;

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
  let WEDDING_DECEL_FRAMES, WEDDING_WALK_FRAMES, WEDDING_STOP_FRAMES, WEDDING_KISS_IDLE_FRAMES;
  let WEDDING_GROOM_IDLE_FRAMES, WEDDING_KISS_LEFT_FRAMES, WEDDING_KISS_RIGHT_FRAMES;
  let WEDDING_KISS_FOREHEAD_FRAMES, WEDDING_KISS_LIPS_FRAMES, WEDDING_FINAL_FRAMES;

  function resetPlayerY() { player.y = GROUND_Y; }

  function initBackground() {
    clouds = [
      { role: 'cloud', x: 80, y: 40, scale: 0.55 },
      { role: 'cloud2', x: 340, y: 70, scale: 0.55 },
      { role: 'cloud', x: 560, y: 30, scale: 0.4 },
      { role: 'cloud2', x: 700, y: 90, scale: 0.65 },
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

  // Biome swap: index-driven, not score-driven. biomeIndex only ever
  // changes at the instant a portal transition completes (see
  // completeBiomeTransition below) — it deliberately never reads score
  // directly, so there is exactly one advance per portal, however long
  // the player lingers before or after touching it. Cycles endlessly
  // through the list. A new run always starts back in the desert
  // (biomeIndex reset to 0 in startGame()).
  const BIOME_SCORE_STEP = 7000;
  const BIOME_ORDER = ['desert', 'selva', 'neve', 'vulcao'];
  let biomeIndex = 0;
  function activeBiome() {
    return BIOME_ORDER[biomeIndex % BIOME_ORDER.length];
  }

  // Portal + loading-screen state. A portal appears once per checkpoint
  // (every BIOME_SCORE_STEP points) and, when touched, opens a short
  // "next biome loading" state before the run resumes seamlessly — see
  // maybeSpawnPortal/beginBiomeTransition/completeBiomeTransition below.
  // One illustrated portal per biome the portal appears IN — the scene
  // framed inside each arch previews the biome it leads to. Each sheet
  // surrounds its artwork with a wide margin of near-transparent glow,
  // embers and drifting leaves, so every measurement below is taken from
  // the artwork's own bounds (left/top/right/bottom as fractions of the
  // full image) rather than the padded canvas: that way the portal's
  // visible height is what gets matched to Mariana and its base is what
  // lands on the ground line, while the image itself is still drawn
  // whole and unmodified, faint glow included.
  const PORTAL_ART = {
    desert: { key: 'portalDesert', left: 0.2072, top: 0.0424, right: 0.8364, bottom: 0.9584 },
    selva: { key: 'portalSelva', left: 0.2339, top: 0.0371, right: 0.9371, bottom: 0.9385 },
    neve: { key: 'portalNeve', left: 0.2210, top: 0.0181, right: 0.9089, bottom: 0.9685 },
    vulcao: { key: 'portalVulcao', left: 0.1032, top: 0.0268, right: 0.9258, bottom: 0.9771 },
  };
  // Portal height as a multiple of Mariana's own rendered height. The
  // arch takes up roughly half of each sheet's height, so this is sized
  // by the opening rather than the frame: at 2x she clears the doorway
  // with room to spare, which is what makes her read as running into the
  // portal instead of past a roadside marker. Measured against
  // GIRL_H_BASE rather than currentGirlH() so the portal is a fixed part
  // of the world — the "mini" skin shrinks Mariana, not the scenery she
  // runs through.
  const PORTAL_HEIGHT_RATIO = 2.0;
  // Horizontal slice of the artwork treated as the doorway for the
  // checkpoint touch — the arch's stonework sits off to the right in
  // every sheet, so the opening is a little left of centre.
  const PORTAL_DOORWAY_START = 0.25;
  const PORTAL_DOORWAY_END = 0.65;
  const PORTAL_LOADING_DURATION = 2.5; // seconds, real time
  // { x, w, h, art, drawW, drawH, t, triggered } while pending/active on
  // screen, else null. x/w/h describe the artwork (x is its left edge, as
  // with an obstacle); drawW/drawH are the full image's drawn size.
  let portal = null;
  // Count of checkpoints already turned into a portal this run. Spawning
  // is gated on `score >= portalsSpawned+1 checkpoints` AND `!portal`,
  // and portalsSpawned increments the instant a portal spawns — so this
  // is an index/state check, never a bare `score >= 7000` comparison
  // that could re-trigger while score keeps climbing.
  let portalsSpawned = 0;
  let pendingBiomeIndex = 0;
  let transitionTimer = 0;

  // Wedding ending — reuses the same short "transition" loading state as
  // a biome portal (see beginWeddingTransition/updatePortalTransition
  // below), but lands on the dedicated 'wedding' state instead of
  // resuming 'playing' in the next biome. pendingWedding just tells
  // updatePortalTransition() which of the two completions to run once
  // transitionTimer runs out.
  const WEDDING_SCORE_THRESHOLD = 42000;
  const WEDDING_SKIN_ID = 'noiva';
  // groundFrac is the official art's own floor line (measured where the
  // paved terrace meets the soil cross-section below it, independently
  // at several x columns of the source PNG: consistently y≈744 of 941),
  // as a fraction of the image's full height. drawWeddingScene() uses it
  // to line up that floor with GROUND_Y — the same line every other
  // biome's ground sits on — so characters added in a later step stand
  // on the terrace instead of floating or sinking into it.
  const WEDDING_ART = { key: 'weddingBg', groundFrac: 744 / 941 };
  // Same fractional-bounds convention as PORTAL_ART above (measured from
  // the artwork's own opaque bounds, not the padded canvas — this sheet
  // carries the same kind of soft glow/petals margin around the arch) —
  // reused by maybeSpawnPortal()/drawPortal() exactly like any other
  // portal entry, just swapped in only at the WEDDING_SCORE_THRESHOLD
  // checkpoint when Mariana Noiva is equipped.
  const WEDDING_PORTAL_ART = { key: 'portalWedding', left: 0.1823, top: 0.0158, right: 0.9476, bottom: 0.9472 };
  let pendingWedding = false;

  // Mariana's walk-to-the-altar sequence, played once the wedding scenery
  // has loaded (state 'wedding'), continuing straight on into the groom
  // + four kisses + final pose added in this step. Always in this exact
  // order, each phase advancing on its own timer — never on score or
  // input:
  //   decelerate (in place) -> walk (moves left to right) -> stop (in
  //   place) -> idle (brief pause) -> kissLeft -> kissRight ->
  //   kissForehead -> kissLips -> finalTogether (holds, then hands off
  //   to state 'weddingEnd' — see completeWeddingScene()).
  // The first four are solo Mariana frames positioned by weddingCharX;
  // the kiss/final frames are each a single pre-composed two-character
  // image (see WEDDING_SOLO_PHASES below) positioned off the groom's
  // fixed spot instead. Frame counts match
  // scripts/extract_wedding_walk_frames.py / extract_wedding_kiss_frames.py's
  // output.
  const WEDDING_WALK_PHASES = [
    'decelerate', 'walk', 'stop', 'idle',
    'kissLeft', 'kissRight', 'kissForehead', 'kissLips', 'finalTogether',
  ];
  const WEDDING_SOLO_PHASES = new Set(['decelerate', 'walk', 'stop', 'idle']);
  const WEDDING_KISS_PHASES = new Set(['kissLeft', 'kissRight', 'kissForehead', 'kissLips']);
  const WEDDING_PHASE_FRAME_COUNT = {
    decelerate: 8, walk: 8, stop: 6, idle: 3,
    kissLeft: 4, kissRight: 4, kissForehead: 4, kissLips: 4, finalTogether: 4,
  };
  const WEDDING_PHASE_FRAME_DURATION = {
    decelerate: 0.07, walk: 0.09, stop: 0.08, idle: 0.45,
    kissLeft: 0.15, kissRight: 0.15, kissForehead: 0.15, kissLips: 0.15, finalTogether: 0.15,
  };
  // Walk phase is time-based, not speed-based: a fixed duration means the
  // pace reads the same "calm, deliberate" way regardless of how far she
  // actually has to travel on a given aspect ratio (a wide desktop window
  // crops the wedding art less, so the altar landmark below sits farther
  // in world-X than on a narrow phone — same walk TIME, different speed,
  // rather than the reverse). Eased (see updateWeddingScene) so the stop
  // reads as arriving, not stopping dead.
  const WEDDING_WALK_DURATION = 2.4;
  // idle is a brief held beat (not the old "wait forever for a later
  // step" — that later step is this one), long enough to read as a
  // breath before the first kiss, never a hard cut from walking.
  const WEDDING_IDLE_HOLD_DURATION = 1.5;
  // finalTogether plays its 4 frames once, then holds on the last one
  // for a bit longer before handing off to state 'weddingEnd' — "mantenha
  // o último estado/pose por um pequeno momento antes da próxima tela."
  const WEDDING_FINAL_HOLD_EXTRA = 1.4;
  // Fraction of the wedding artwork's own width where she comes to a
  // stop — just before the red-carpet steps (which start ~0.71 of the
  // image width, measured directly on wedding_bg.png), leaving the
  // carpet and archway (up to ~0.90) clear for the groom. Converted to
  // world-X via weddingSceneTransform() every frame, so it stays
  // visually anchored to that landmark across resizes.
  const WEDDING_STOP_X_FRAC = 0.66;
  // Groom's fixed spot — between the carpet and the archway, i.e.
  // further right than where Mariana stops, so there's a visible gap
  // between them to close. Same live conversion as WEDDING_STOP_X_FRAC.
  const WEDDING_GROOM_X_FRAC = 0.80;
  const GROOM_IDLE_FRAME_DURATION = 0.5;
  let weddingPhase = null;
  let weddingPhaseIndex = 0;
  let weddingPhaseTimer = 0;
  let weddingAnimFrame = 0;
  let weddingAnimTimer = 0;
  let weddingCharX = PLAYER_RIGHT_X;
  let weddingWalkFromX = PLAYER_RIGHT_X;
  let groomAnimFrame = 0;
  let groomAnimTimer = 0;

  function maybeSpawnPortal() {
    if (portal) return;
    const nextCheckpoint = portalsSpawned + 1;
    if (score < nextCheckpoint * BIOME_SCORE_STEP) return;
    portalsSpawned = nextCheckpoint;
    // Clear the field so nothing already on screen can block the path to
    // the portal that's about to appear.
    obstacles = [];
    // The one checkpoint whose threshold equals WEDDING_SCORE_THRESHOLD
    // (42000 = 6 * BIOME_SCORE_STEP) spawns the wedding portal instead of
    // the normal next-biome one, but only when playing as Mariana with
    // Mariana Noiva equipped — any other skin, or playing as Alberto
    // (where Mariana's equipped skin is irrelevant since she isn't on
    // screen at all), gets the ordinary portal and the biome cycle
    // continues exactly as before. Neither equipped skin nor playable
    // character can change mid-run (both are only reachable from the
    // start/game-over screens), so this check is stable for the rest of
    // this run.
    const isWeddingCheckpoint = nextCheckpoint * BIOME_SCORE_STEP === WEDDING_SCORE_THRESHOLD
      && playableCharacter === 'mariana'
      && SkinStore.getEquipped() === WEDDING_SKIN_ID;
    const art = isWeddingCheckpoint ? WEDDING_PORTAL_ART : PORTAL_ART[activeBiome()];
    const img = SPRITES[art.key];
    const h = GIRL_H_BASE * PORTAL_HEIGHT_RATIO;
    const drawH = h / (art.bottom - art.top);
    const drawW = drawH * (img.naturalWidth / img.naturalHeight);
    portal = {
      x: W + 240,
      w: (art.right - art.left) * drawW,
      h,
      art,
      drawW,
      drawH,
      t: 0,
      triggered: false,
      wedding: isWeddingCheckpoint,
    };
  }

  function beginBiomeTransition() {
    pendingBiomeIndex = (biomeIndex + 1) % BIOME_ORDER.length;
    transitionTimer = 0;
    obstacles = [];
    decor = [];
    powerups = [];
    coins = [];
    portal = null;
    setState('transition');
  }

  // Ends the normal race the instant the wedding condition is met (score
  // + Mariana Noiva equipped, checked in update()). Clears the run's
  // obstacles/decor/powerups/coins/portal exactly like a biome swap, but
  // pendingWedding routes the transition to completeWeddingTransition()
  // instead of the next biome — nothing here re-enables scoring/spawns.
  function beginWeddingTransition() {
    pendingWedding = true;
    transitionTimer = 0;
    obstacles = [];
    decor = [];
    powerups = [];
    coins = [];
    portal = null;
    setState('transition');
  }

  function updatePortalTransition(dt) {
    transitionTimer += dt;
    if (transitionTimer < PORTAL_LOADING_DURATION) return;
    if (pendingWedding) completeWeddingTransition();
    else completeBiomeTransition();
  }

  // Score, coins, equipped skin and every save/localStorage value are
  // untouched here — this only swaps which biome's art/obstacles are
  // active and resumes play, exactly like a normal in-run state change,
  // never a restart.
  function completeBiomeTransition() {
    biomeIndex = pendingBiomeIndex;
    scheduleNextSpawn();
    scheduleNextDecor();
    schedulePowerupSpawn();
    scheduleNextCoinCluster();
    setState('playing');
  }

  // Lands on the dedicated 'wedding' state instead of resuming 'playing'
  // — update() no-ops for any state other than 'playing' (its very first
  // check), so this is the clean stop the run: no more scoring, spawns,
  // player physics or collisions. No player/groom/pose yet — see
  // render()'s 'wedding' branch, which for now only draws the official
  // scenery via drawWeddingScene().
  function completeWeddingTransition() {
    pendingWedding = false;
    // Score stays visibly pinned at the threshold through the whole
    // special scene (it was already >= 42000 the instant the portal
    // spawned, but kept climbing for the second or two it took to walk
    // into it) — nothing reads `score` again until endGame()/a future
    // run, so this is purely the "stays at 42000" contract from the spec.
    score = WEDDING_SCORE_THRESHOLD;
    weddingPhase = WEDDING_WALK_PHASES[0];
    weddingPhaseIndex = 0;
    weddingPhaseTimer = 0;
    weddingAnimFrame = 0;
    weddingAnimTimer = 0;
    weddingWalkFromX = PLAYER_RIGHT_X;
    weddingCharX = PLAYER_RIGHT_X;
    groomAnimFrame = 0;
    groomAnimTimer = 0;
    setState('wedding');
  }

  // Ends the special scene the instant finalTogether's hold elapses —
  // called exactly once, from updateWeddingScene(), never re-entered
  // because state stops being 'wedding' the moment this runs (loop()
  // only calls updateWeddingScene while state === 'wedding').
  function completeWeddingScene() {
    weddingEndScoreEl.textContent = String(WEDDING_SCORE_THRESHOLD);
    setState('weddingEnd');
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  // Drives the decelerate -> walk -> stop -> idle sequence while
  // state === 'wedding' (see loop() below) — entirely its own timer- and
  // phase-driven state, never touching score/spawns/physics/input, which
  // is what keeps this cinematic beat from being nudged by anything the
  // normal endless-runner update() does (that function already no-ops
  // for any state other than 'playing', so it's not even running).
  // One small, discreet heart per kiss (never more) — the exact same
  // sparkle primitive/shape already used elsewhere in the game
  // (Particles.sparkle with shape:'heart'), just placed once, at the
  // instant a kiss phase begins, above the couple's heads.
  function spawnKissHeart() {
    const hx = weddingGroomWorldX() - currentGirlH() * 0.35;
    const hy = GROUND_Y - currentGirlH() * 0.95;
    Particles.sparkle(hx, hy, { color: '#c0392f', shape: 'heart', size: 13, spread: 6 });
  }

  function updateWeddingScene(dt) {
    if (!weddingPhase) return;
    weddingPhaseTimer += dt;
    weddingAnimTimer += dt;

    const frameCount = WEDDING_PHASE_FRAME_COUNT[weddingPhase];
    const frameDuration = WEDDING_PHASE_FRAME_DURATION[weddingPhase];
    if (weddingAnimTimer >= frameDuration) {
      weddingAnimTimer -= frameDuration;
      weddingAnimFrame = weddingPhase === 'idle'
        ? (weddingAnimFrame + 1) % frameCount
        // Every other phase — including each kiss and the final pose —
        // plays its frames once and holds on the last one: a kiss is a
        // single beat (approach -> contact -> hold -> release), never a
        // loop, and the same is true of decelerate/walk/stop already.
        : Math.min(frameCount - 1, weddingAnimFrame + 1);
    }

    if (weddingPhase === 'walk') {
      const t = weddingSceneTransform();
      const targetX = t.x + WEDDING_STOP_X_FRAC * t.drawW;
      const progress = Math.min(1, weddingPhaseTimer / WEDDING_WALK_DURATION);
      weddingCharX = weddingWalkFromX + (targetX - weddingWalkFromX) * easeOutQuad(progress);
    }

    if (WEDDING_SOLO_PHASES.has(weddingPhase)) {
      groomAnimTimer += dt;
      if (groomAnimTimer >= GROOM_IDLE_FRAME_DURATION) {
        groomAnimTimer -= GROOM_IDLE_FRAME_DURATION;
        groomAnimFrame = (groomAnimFrame + 1) % WEDDING_GROOM_IDLE_FRAMES.length;
      }
    }

    const phaseDuration = weddingPhase === 'idle' ? WEDDING_IDLE_HOLD_DURATION
      : weddingPhase === 'walk' ? WEDDING_WALK_DURATION
      : weddingPhase === 'finalTogether' ? frameCount * frameDuration + WEDDING_FINAL_HOLD_EXTRA
      : frameCount * frameDuration;
    if (weddingPhaseTimer < phaseDuration) return;

    const isLastPhase = weddingPhaseIndex >= WEDDING_WALK_PHASES.length - 1;
    if (isLastPhase) {
      // finalTogether's hold just ran out — the whole special scene
      // ends here, once, since loop() stops calling this function the
      // instant state stops being 'wedding'.
      completeWeddingScene();
      return;
    }

    weddingPhaseIndex += 1;
    weddingPhase = WEDDING_WALK_PHASES[weddingPhaseIndex];
    weddingPhaseTimer = 0;
    weddingAnimFrame = 0;
    weddingAnimTimer = 0;
    if (weddingPhase === 'stop') {
      // Snap exactly onto the mark in case of any float drift from the
      // eased walk above, so PARANDO always starts from the same spot
      // stop-frame 1 was drawn at, never a sub-pixel short/long of it.
      const t = weddingSceneTransform();
      weddingCharX = t.x + WEDDING_STOP_X_FRAC * t.drawW;
    }
    if (WEDDING_KISS_PHASES.has(weddingPhase)) spawnKissHeart();
  }

  // Scenery art per biome. Desert keeps its original tiling-silhouette
  // treatment (mountains.png scrolling + flat fill) exactly as before —
  // every other biome uses one static illustrated backdrop + its own
  // ground tile, cloud and obstacle set. "sprite"/"ground"/"cloud" absent
  // on desert signals drawBiomeSkyAndBackdrop/drawBiomeGround/cloud
  // lookup to fall back to the original desert-specific code path.
  const BIOME_ART = {
    desert: { cloud: 'cloudBig', cloud2: 'cloudSmall1' },
    selva: { mountains: 'selvaBg', sky: '#eff4f1', ground: 'selvaGround', cloud: 'selvaCloud', cloud2: 'selvaCloud2' },
    neve: { mountains: 'neveBg', sky: '#f4f6fa', ground: 'neveGround', cloud: 'neveCloud', cloud2: 'neveCloud2' },
    vulcao: { mountains: 'vulcaoBg', sky: '#dcd0cf', ground: 'vulcaoGround', cloud: 'vulcaoCloud', cloud2: 'vulcaoCloud2' },
  };

  // Ground-obstacle sprites are per biome — desert's cactus/rock set must
  // never appear once a biome swap has happened, and vice versa. Each
  // biome keeps the same 4 roles (unlockedTypes/CACTUS_*_H/ROCK_*_H below
  // are untouched) so difficulty and hitboxes stay identical; only the
  // artwork per role changes. A newly spawned obstacle always uses
  // activeBiome() — a hard cutover the instant score crosses a threshold
  // — while anything already on screen keeps the sprite it spawned with.
  const BIOME_OBSTACLE_SPRITES = {
    desert: { cactusSmall: 'cactusSmall', cactusBig: 'cactusBig', rock: 'rock', rockSmall: 'rockSmall' },
    selva: { cactusSmall: 'selvaObstacleSmall', cactusBig: 'selvaObstacleBig', rock: 'selvaObstacleRock', rockSmall: 'selvaObstacleRockSmall' },
    neve: { cactusSmall: 'neveObstacleSmall', cactusBig: 'neveObstacleBig', rock: 'neveObstacleRock', rockSmall: 'neveObstacleRockSmall' },
    // "block" é um quinto tipo opcional: só entra no sorteio nos biomas
    // que declaram arte para ele (ver unlockedTypes), então os demais
    // seguem com os mesmos quatro de sempre.
    vulcao: { cactusSmall: 'vulcaoObstacleSmall', cactusBig: 'vulcaoObstacleBig', rock: 'vulcaoObstacleRock', rockSmall: 'vulcaoObstacleRockSmall', block: 'vulcaoObstacleBlock' },
  };

  function reactionTimeFloor() {
    const t = 1.05 - score * 0.0009;
    return Math.max(0.55, t);
  }

  // ---------------------------------------------------------
  // Progressão de dificuldade por bioma
  // ---------------------------------------------------------
  // Regra desta seção: a dificuldade sobe SÓ pela geração de obstáculos —
  // frequência de combinações, variedade dos tipos e encurtamento dos
  // trechos vazios. Nada aqui toca velocidade, aceleração, física, salto
  // ou hitbox: currentSpeed(), GRAVITY, JUMP_VELOCITY e
  // reactionTimeFloor() continuam exatamente como estavam.
  //
  // O espaçamento MÍNIMO entre grupos nunca encolhe. O que diminui com a
  // dificuldade é a cauda longa dos intervalos (os trechos completamente
  // vazios), então o pior caso de reação de qualquer bioma continua sendo
  // o mesmo pior caso que o Deserto já tinha.
  //
  // Em dificuldade 1.00 todo knob abaixo devolve exatamente o valor que o
  // jogo usava antes desta seção existir — por isso o primeiro Deserto de
  // cada partida se comporta como sempre se comportou.
  const BIOME_DIFFICULTY = { desert: 1.00, selva: 1.12, neve: 1.22, vulcao: 1.32 };
  const DIFFICULTY_PER_CYCLE = 1.05; // +5% a cada volta completa pelos 4 biomas
  const DIFFICULTY_MAX = 1.60;       // teto: acima disto a partida vira sorte, não perícia
  function currentDifficulty() {
    // portalsSpawned conta checkpoints atravessados; biomeIndex volta a 0
    // a cada ciclo, então é ele que diz em qual volta estamos.
    const cycle = Math.floor(portalsSpawned / BIOME_ORDER.length);
    const base = BIOME_DIFFICULTY[activeBiome()] || 1;
    return Math.min(DIFFICULTY_MAX, base * Math.pow(DIFFICULTY_PER_CYCLE, cycle));
  }

  function difficultyKnobs() {
    const over = currentDifficulty() - 1;
    return {
      // Teto do sorteio do intervalo entre grupos. O piso (0.5) é
      // intencionalmente constante: encurtar a cauda tira trecho vazio
      // sem nunca apertar o espaçamento mínimo.
      gapSpreadMax: Math.max(0.85, 1.5 - over * 1.6),
      clusterCap: Math.min(0.80, 0.6 + over * 0.45),
      tripleChance: Math.min(0.70, 0.45 + over * 0.40),
      // Chance de o grupo sortear livremente entre os tipos já liberados
      // do bioma, em vez do par cacto-pequeno/cacto-grande de sempre.
      varietyChance: Math.min(0.80, over * 2.5),
    };
  }

  // Distância horizontal durante a qual o hitbox da Mariana fica ACIMA de
  // um obstáculo de altura h, já descontadas a largura dela e uma margem
  // de segurança — nenhum grupo pode ocupar mais do que isso.
  //   0.88h  = topo do hitbox do obstáculo (ver colisão: h - 0.12h)
  //   7      = folga entre os pés e a base do hitbox da Mariana, no pior
  //            caso (skin "mini", que encolhe a folga de 10 para 7.2)
  // A conta usa a altura do obstáculo MAIS ALTO do grupo para o grupo
  // inteiro, o que é mais rígido do que a física exige — é de propósito.
  const CLUSTER_SAFETY_MARGIN = 18; // unidades ~ 0.026 s a 700 u/s, além do salto no limite
  function clusterSpanLimit(h, speed) {
    const lift = Math.max(0, 0.88 * h - 7);
    const inner = JUMP_VELOCITY * JUMP_VELOCITY - 2 * GRAVITY * lift;
    if (inner <= 0) return 0;
    const airborneAbove = (2 * Math.sqrt(inner)) / GRAVITY;
    return speed * airborneAbove - PLAYER_HITBOX.width - CLUSTER_SAFETY_MARGIN;
  }

  // Extensão realmente colidível de um grupo: da borda esquerda do hitbox
  // do primeiro à borda direita do hitbox do último (ver colisão: cada
  // obstáculo só colide entre 18% e 82% da própria largura).
  function clusterSpan(planned, gapBetween) {
    if (!planned.length) return 0;
    const drawn = planned.reduce((sum, p) => sum + p.dims.w, 0) + (planned.length - 1) * gapBetween;
    return drawn - 0.18 * planned[0].dims.w - 0.18 * planned[planned.length - 1].dims.w;
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
    // Tipo extra por bioma: entra apenas onde BIOME_OBSTACLE_SPRITES
    // declara arte para ele. Os quatro acima e seus limiares seguem
    // intocados, e um bioma sem "block" sorteia exatamente como antes.
    const sprites = BIOME_OBSTACLE_SPRITES[activeBiome()];
    if (sprites && sprites.block && score >= 1500) types.push('block');
    return types;
  }

  function clusterChance() {
    if (score < 130) return 0;
    return Math.min(difficultyKnobs().clusterCap, (score - 130) / 900);
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
      // Mesma altura do monte de rochas de propósito: o tempo de salto
      // para limpá-lo é o que a jogadora já conhece, então o obstáculo
      // novo não muda a dificuldade, só o repertório visual.
      case 'block': return { img: SPRITES[sprites.block], h: ROCK_H };
    }
  }

  function obstacleDims(type, biome) {
    const spec = obstacleSpec(type, biome);
    return { w: spriteWidthForHeight(spec.img, spec.h), h: spec.h };
  }

  function spawnObstacleGroup() {
    const speed = currentSpeed();
    const types = unlockedTypes();
    const spawnBiome = activeBiome();
    const startX = W + 10;
    let groupEndX = startX;

    if (Math.random() < clusterChance()) {
      const knobs = difficultyKnobs();
      const gapBetween = 18 + Math.random() * 14;
      const count = Math.random() < knobs.tripleChance ? 3 : 2;
      // Grupo "variado" sorteia entre todos os tipos já liberados do
      // bioma; o grupo normal segue sendo o par cacto-pequeno com um
      // cacto-grande ocasional na frente, como sempre foi.
      const varied = Math.random() < knobs.varietyChance;
      let cursor = startX;
      const planned = [];
      let tallest = 0;
      for (let i = 0; i < count; i++) {
        const type = varied
          ? pickObstacleType(types)
          : (i === 0 && types.includes('cactusBig') && Math.random() < 0.3 ? 'cactusBig' : 'cactusSmall');
        const dims = obstacleDims(type, spawnBiome);
        const tallestNext = Math.max(tallest, dims.h);
        const spanNext = clusterSpan(planned.concat([{ dims }]), gapBetween);
        // Corta o grupo assim que ele passaria do que o salto atual limpa
        // com folga. Nunca cria a sequência impossível: prefere um grupo
        // menor a um grupo largo demais.
        if (spanNext > clusterSpanLimit(tallestNext, speed) && planned.length > 0) break;
        planned.push({ type, dims });
        tallest = tallestNext;
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
    // Largura ocupada de fato (borda direita do último obstáculo), para
    // scheduleNextSpawn poder garantir o trecho livre depois do grupo.
    const last = obstacles[obstacles.length - 1];
    return last ? (last.x + last.w) - startX : 0;
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

  // Trecho livre mínimo (unidades de mundo) entre a borda direita de um
  // grupo e a borda esquerda do próximo. É o pior caso que o jogo já
  // tinha antes desta mudança (intervalo mínimo de 1.5x menos o grupo
  // mais largo possível), promovido a piso explícito: nenhum aumento de
  // dificuldade pode espremer mais do que isto, em bioma nenhum, em ciclo
  // nenhum. A física exige ~171 unidades para pousar e saltar de novo no
  // limite do quadro; o resto é margem humana.
  const SAFE_CLEAR_GAP = 260;
  function scheduleNextSpawn(groupWidth = 0) {
    const speed = currentSpeed();
    const minGap = speed * reactionTimeFloor();
    const spreadMax = difficultyKnobs().gapSpreadMax;
    const variability = minGap * (0.5 + Math.random() * (spreadMax - 0.5));
    nextSpawnGap = Math.max(minGap + variability, groupWidth + SAFE_CLEAR_GAP);
    distanceSinceLastSpawn = 0;
  }

  function scheduleNextDecor() {
    nextDecorGap = 280 + Math.random() * 440;
    distanceSinceLastDecor = 0;
  }

  // Decorative (non-collidable) scenery is per biome, same reasoning as
  // BIOME_OBSTACLE_SPRITES above — a spawn always reads the biome fresh
  // via activeBiome(), so desert's bush/sign/fence never appears once a
  // biome swap has happened, and vice versa.
  // Selva roda sem decoração de chão: a cerca de estacas e a moita
  // redonda ficavam na mesma linha dos obstáculos e eram confundidas com
  // eles — em especial a cerca, feita da mesma madeira com cipó da
  // estaca alta, que essa sim faz perder. Lista vazia é o desligamento;
  // os obstáculos da Selva seguem intactos.
  const DECOR_TYPES = {
    desert: ['bush', 'sign', 'fence'],
    selva: [],
    neve: ['neveDecor1', 'neveDecor2'],
    // Vulcão também roda sem decoração de chão: o arco de pedra parecia
    // um portão sólido mas se atravessava, e o bloco virou obstáculo de
    // verdade (ver BIOME_OBSTACLE_SPRITES).
    vulcao: [],
  };
  function spawnDecor() {
    const types = DECOR_TYPES[activeBiome()] || DECOR_TYPES.desert;
    if (!types.length) return;
    const key = types[Math.floor(Math.random() * types.length)];
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

  // Agenda do 2x moedas: sorteia um intervalo novo a cada aparição, então
  // nunca cai num ritmo fixo. Em segundos, não em distância percorrida —
  // a distância encurta em tempo conforme o jogo acelera, e o pedido era
  // 15 a 20 segundos de verdade.
  function scheduleCoinPowerup() {
    nextCoinPowerupIn = COIN_POWERUP_MIN_GAP +
      Math.random() * (COIN_POWERUP_MAX_GAP - COIN_POWERUP_MIN_GAP);
  }

  // Entra no mesmo array dos outros power-ups, então herda movimento,
  // caixa de coleta, desenho e limpeza sem duplicar nada disso.
  function spawnCoinPowerup() {
    const baseY = GROUND_Y - 95 - Math.random() * 20;
    powerups.push({ x: W + 10, w: POWERUP_SIZE, h: POWERUP_SIZE, type: 'coins', baseY, bobPhase: Math.random() * Math.PI * 2 });
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
    // Único ponto onde o 2x moedas age: o valor da moeda coletada.
    // Nada muda na quantidade, posição ou frequência das moedas.
    coinBalance = SkinStore.addCoins(coinMultiplier);
    runCoins += coinMultiplier;
    updateCoinsHud();
    bump(hudCoinsValue);
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
    bump(hudHiscore);
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
  function showAchievementToast(def) {
    achievementToastQueue.push(def);
    if (!achievementToastShowing) advanceAchievementToastQueue();
  }
  function advanceAchievementToastQueue() {
    const def = achievementToastQueue.shift();
    if (def === undefined) { achievementToastShowing = false; return; }
    achievementToastShowing = true;
    achievementToastName.textContent = def.name.toUpperCase();
    achievementToastDesc.textContent = def.desc || '';
    achievementToast.hidden = false;
    // Two frames: the first lays out the now-displayed toast at its
    // hidden pose, the second flips to .is-visible so the transition
    // (and the staggered icon/title/name/desc entrance) actually plays.
    requestAnimationFrame(() => requestAnimationFrame(() => achievementToast.classList.add('is-visible')));
    clearTimeout(achievementToastTimer);
    achievementToastTimer = setTimeout(() => {
      achievementToast.classList.remove('is-visible');
      setTimeout(() => {
        achievementToast.hidden = true;
        advanceAchievementToastQueue();
      }, 320);
    }, 2600);
  }

  function unlockAchievement(id) {
    if (!AchievementStore.unlock(id)) return;
    const def = achievementById(id);
    if (!def) return;
    showAchievementToast(def);
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
    statusBadges.coins.hidden = coinBonusTimer <= 0;
    if (multiplierTimer <= 0) lastShownStarSeconds = null;
    if (!doubleJumpActive) lastShownJumpSeconds = null;
    if (coinBonusTimer <= 0) lastShownCoinSeconds = null;
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
    if (coinBonusTimer > 0) {
      const secs = Math.ceil(coinBonusTimer);
      if (secs !== lastShownCoinSeconds) {
        lastShownCoinSeconds = secs;
        statusCoinsTime.textContent = secs + 's';
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
    } else if (type === 'coins') {
      coinMultiplier = 2;
      coinBonusTimer = COIN_BONUS_DURATION;
    }
    updateStatusBadges();
  }

  // ---------------------------------------------------------
  // State machine / UI sync
  // ---------------------------------------------------------
  function setState(next) {
    // First reveal of the start screen: lets the scenery settle in from
    // the loading screen's plain paper (CSS #game-frame.is-booted). Only
    // ever added, never removed — it's a one-time boot entrance.
    if (next === 'start' && state === 'loading') frame.classList.add('is-booted');
    state = next;
    overlays.loading.hidden = next !== 'loading';
    overlays.start.hidden = next !== 'start';
    overlays.pause.hidden = next !== 'paused';
    overlays.gameover.hidden = next !== 'gameover';
    overlays.transition.hidden = next !== 'transition';
    overlays.weddingEnd.hidden = next !== 'weddingEnd';
    btnPause.hidden = !(next === 'playing' || next === 'paused');
    btnPause.setAttribute('aria-label', next === 'paused' ? 'Continuar' : 'Pausar');
    btnPause.querySelector('.icon-pause').hidden = next === 'paused';
    btnPause.querySelector('.icon-play').hidden = next !== 'paused';
    hud.hidden = !(next === 'playing' || next === 'paused' || next === 'gameover' || next === 'transition');

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

  // Restarts a one-shot CSS class animation (remove -> reflow -> add).
  // Used for every short "reaction" in the UI: coin counter bump, button
  // pop/shake, info swap. The class is left on afterwards — harmless,
  // since the animation only plays again on the next restart.
  function restartAnim(el, cls) {
    el.classList.remove(cls);
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // The HUD coin/record "bump" (1 -> 1.08 -> 1). Runs mid-gameplay, so it
  // uses the Web Animations API instead of restartAnim(): no forced
  // reflow per collected coin, and a new bump simply replaces the last.
  const BUMP_FRAMES = [
    { transform: 'scale(1)' },
    { transform: 'translateY(-1px) scale(1.08)', offset: 0.4 },
    { transform: 'scale(1)' },
  ];
  function bump(el) {
    if (REDUCE_MOTION) return;
    if (!el.animate) { restartAnim(el, 'is-bump'); return; }
    if (el._bump) el._bump.cancel();
    el._bump = el.animate(BUMP_FRAMES, { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }

  // Short one-shot fade/slide-out before a panel is actually hidden, so
  // closing never "blinks". Resolves the hide synchronously when motion
  // is reduced.
  function hideWithExit(el, onHidden) {
    if (REDUCE_MOTION) { el.hidden = true; if (onHidden) onHidden(); return; }
    el.classList.add('is-leaving');
    setTimeout(() => {
      // Reopened during the exit (the opener strips .is-leaving): keep it.
      if (!el.classList.contains('is-leaving')) return;
      el.classList.remove('is-leaving');
      el.hidden = true;
      if (onHidden) onHidden();
    }, 160);
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
    if (state === 'start' || state === 'gameover' || state === 'weddingEnd') {
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
  wireOverlayAction(overlays.weddingEnd, () => startGame());
  wireOverlayAction(overlays.pause, () => { if (state === 'paused') togglePause(); });

  [btnStart, btnRestart, btnWeddingRestart, btnResume].forEach((btn) => {
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
    biomeIndex = 0;
    pendingBiomeIndex = 0;
    portalsSpawned = 0;
    portal = null;
    transitionTimer = 0;
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
    coinMultiplier = 1;
    coinBonusTimer = 0;
    obstacleStreak = 0;
    runCoins = 0;
    cancelScoreCountUp();
    recordBrokenThisRun = false;
    pendingWedding = false;
    weddingPhase = null;
    jumpBufferTimer = 0;
    updateStatusBadges();
    scheduleNextSpawn();
    scheduleNextDecor();
    schedulePowerupSpawn();
    scheduleCoinPowerup();
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
    coinMultiplier = 1;
    coinBonusTimer = 0;
    updateStatusBadges();
    setState('gameover');
    AudioMgr.hit();
    setTimeout(() => AudioMgr.gameOver(), 120);

    countUpScore(finalScore);
    finalRecordEl.textContent = highScore.toLocaleString('pt-BR');
    finalCoinsEl.textContent = '+' + runCoins;
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

  // Game Over score counts up from 0 in ~0.6s alongside the card's
  // entrance — purely a readout of the already-final number (endGame
  // computed and saved it first). Restarting never waits on it: the
  // overlay click / Space call startGame() immediately, which cancels it.
  let scoreCountRaf = 0;
  function cancelScoreCountUp() {
    if (scoreCountRaf) cancelAnimationFrame(scoreCountRaf);
    scoreCountRaf = 0;
  }
  function countUpScore(target) {
    cancelScoreCountUp();
    const format = (n) => n.toLocaleString('pt-BR');
    if (REDUCE_MOTION || target <= 0) { finalScoreEl.textContent = format(target); return; }
    const t0 = performance.now();
    const DURATION = 620;
    finalScoreEl.textContent = '0';
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      finalScoreEl.textContent = format(Math.round(target * eased));
      scoreCountRaf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    scoreCountRaf = requestAnimationFrame(step);
  }

  function updateHud() {
    hudScoreValue.textContent = String(Math.floor(score)).padStart(5, '0');
    hudHiscoreValue.textContent = String(highScore).padStart(5, '0');
    // Same stored best, just grouped for the menu instead of zero-padded.
    menuRecordValue.textContent = highScore.toLocaleString('pt-BR');
  }

  function updateCoinsHud() {
    hudCoinsValue.textContent = String(coinBalance);
    menuCoinsValue.textContent = String(coinBalance);
    wardrobeCoinsValue.textContent = String(coinBalance);
  }

  // buildWardrobe() fills the carousel — defined further down (Guarda-
  // Roupa section). Declared with `function` there so it's hoisted and
  // callable from here regardless of file order, exactly like every
  // other forward reference already in this file (e.g. AudioMgr).
  function openWardrobe() {
    overlayWardrobe.classList.remove('is-leaving');
    overlayWardrobe.hidden = false;
    // Built AFTER un-hiding: the carousel's sizes come from the stage's
    // real box (container query units), which only exists once shown.
    buildWardrobe(true);
  }

  function closeWardrobe() {
    if (overlayWardrobe.hidden || overlayWardrobe.classList.contains('is-leaving')) return;
    hideWithExit(overlayWardrobe);
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

  // ---------- Personagem jogável (Mariana | Alberto) ----------
  function updateCharacterSelectUI() {
    btnCharMariana.classList.toggle('is-active', playableCharacter === 'mariana');
    btnCharAlberto.classList.toggle('is-active', playableCharacter === 'alberto');
    characterSelect.dataset.active = playableCharacter;
  }

  function setPlayableCharacter(id) {
    playableCharacter = id === 'alberto' ? 'alberto' : 'mariana';
    localStorage.setItem(PLAYABLE_CHARACTER_KEY, playableCharacter);
    updateCharacterSelectUI();
  }

  btnCharMariana.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    setPlayableCharacter('mariana');
  });
  btnCharAlberto.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    setPlayableCharacter('alberto');
  });

  // ---------- Aba do Guarda-Roupa (Mariana | Alberto) ----------
  function setWardrobeTab(tab) {
    wardrobeTab = tab === 'alberto' ? 'alberto' : 'mariana';
    btnWardrobeTabMariana.classList.toggle('is-active', wardrobeTab === 'mariana');
    btnWardrobeTabAlberto.classList.toggle('is-active', wardrobeTab === 'alberto');
    btnWardrobeTabMariana.setAttribute('aria-selected', String(wardrobeTab === 'mariana'));
    btnWardrobeTabAlberto.setAttribute('aria-selected', String(wardrobeTab === 'alberto'));
    buildWardrobe(true);
    restartAnim(wardrobeTrack, 'is-refresh');
  }

  btnWardrobeTabMariana.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    setWardrobeTab('mariana');
  });
  btnWardrobeTabAlberto.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioMgr.uiClick();
    setWardrobeTab('alberto');
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
    hairlock: '<svg viewBox="0 0 24 24"><path d="M9 3c3 2 3 5 1 7 3 0 5 2 5 5 0 3-2 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    chameleon: '<svg viewBox="0 0 24 24"><path d="M3 14c2-3 5-4 8-3s5 1 7-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18 10c1.5-1 2.5.5 1 2s-3 .5-2-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11" r="1.1" fill="currentColor"/></svg>',
  };

  function skinCardStatus(id) {
    if (id === SkinStore.getEquipped()) return 'equipped';
    if (SkinStore.isUnlocked(id)) return 'owned';
    return coinBalance >= skinById(id).price ? 'buyable' : 'locked';
  }

  function albertoSkinCardStatus(id) {
    if (id === AlbertoSkinStore.getEquipped()) return 'equipped';
    if (AlbertoSkinStore.isUnlocked(id)) return 'owned';
    return coinBalance >= albertoSkinById(id).price ? 'buyable' : 'locked';
  }

  // ---------------------------------------------------------
  // Guarda-Roupa: carrossel
  // ---------------------------------------------------------
  // Same data and the same store calls as the old card grid (purchase /
  // setEquipped / loadFrames / all_skins achievement) — only the
  // presentation changed. Each skin is one item; the active one sits in
  // the center and every other item gets a ROLE from its circular
  // distance to it (is-prev / is-next / is-far-* / is-off-*). Changing
  // the active index just reassigns roles, and CSS animates every item's
  // transform/opacity/filter at once (650ms, cubic-bezier(0.4,0,0.2,1)).
  // A lock (wrAnimating) swallows new navigation until the swap finishes,
  // so rapid taps can never stack transitions or desync the index.
  const WR_SWAP_MS = 650;
  const WR_ROLES = ['is-center', 'is-prev', 'is-next', 'is-far-prev', 'is-far-next', 'is-off-prev', 'is-off-next'];
  const WR_LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
  const WR_CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/></svg>';
  const WR_COIN_SVG = '<svg class="stat-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#f0c04a" stroke="#2b2b2b" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="16" stroke="#c99a2e" stroke-width="2" stroke-linecap="round"/></svg>';

  let wrActive = 0;
  let wrAnimating = false;
  let wrLockTimer = null;
  let wrMsgTimer = null;
  let wrItems = [];
  let wrStamp = null;

  function wardrobeDefs() {
    return wardrobeTab === 'alberto' ? ALBERTO_SKIN_DEFS_BY_PRICE : SKIN_DEFS_BY_PRICE;
  }

  function wardrobeStatus(id) {
    return wardrobeTab === 'alberto' ? albertoSkinCardStatus(id) : skinCardStatus(id);
  }

  function wardrobePreviewSrc(skin) {
    const isAlberto = wardrobeTab === 'alberto';
    const ready = isAlberto ? ALBERTO_SKIN_PREVIEW_READY : SKIN_PREVIEW_READY;
    if (!ready[skin.id]) return isAlberto ? 'assets/sprites/cat_idle_01.png' : 'assets/sprites/girl_idle_01.png';
    return isAlberto
      ? `assets/sprites/skins/alberto/${skin.id}/cat_idle_01.png`
      : `assets/sprites/skins/${skin.id}/girl_idle_01.png`;
  }

  // Signed shortest distance from the active index on a ring of n.
  function wardrobeOffset(i, n) {
    let d = i - wrActive;
    if (d > n / 2) d -= n;
    if (d <= -n / 2) d += n;
    return d;
  }

  function roleFor(d) {
    if (d === 0) return 'is-center';
    if (d === -1) return 'is-prev';
    if (d === 1) return 'is-next';
    if (d === -2) return 'is-far-prev';
    if (d === 2) return 'is-far-next';
    return d < 0 ? 'is-off-prev' : 'is-off-next';
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  function buildWardrobe(focusEquipped) {
    const defs = wardrobeDefs();
    if (focusEquipped) {
      const store = wardrobeTab === 'alberto' ? AlbertoSkinStore : SkinStore;
      wrActive = Math.max(0, defs.findIndex((skin) => skin.id === store.getEquipped()));
    }
    wrActive = Math.min(wrActive, defs.length - 1);
    wardrobeStage.classList.toggle('is-alberto', wardrobeTab === 'alberto');
    wardrobeTabs.dataset.active = wardrobeTab;
    wardrobeCoinsValue.textContent = String(coinBalance);
    wardrobeTrack.innerHTML = defs.map((skin, i) => `
      <button type="button" class="wr-item" data-index="${i}" tabindex="-1" aria-label="${skin.name}">
        <span class="wr-shadow"></span>
        <img src="${wardrobePreviewSrc(skin)}" alt="" draggable="false" decoding="async">
        <span class="wr-badge" aria-hidden="true"></span>
      </button>`).join('');
    wrItems = Array.from(wardrobeTrack.children);
    wrItems.forEach((el) => { el.dataset.d = ''; });
    wrStamp = document.createElement('span');
    wrStamp.className = 'wr-stamp';
    wrStamp.setAttribute('aria-hidden', 'true');
    wrStamp.textContent = 'DESBLOQUEADA!';
    wardrobeTrack.appendChild(wrStamp);
    wrTotalEl.textContent = pad2(defs.length);
    clearTimeout(wrLockTimer);
    wrAnimating = false;
    hideWardrobeMsg(true);
    applyWardrobeRoles(true);
    updateWardrobeItemBadges();
    updateWardrobeInfo(false);
    preloadWardrobeNeighbors();
  }

  // snapAll: first layout after (re)building — items take their places
  // with no transition. Otherwise any item whose ring distance jumped by
  // more than one step (a wrap-around on a short list, or a far jump)
  // snaps instead of sliding across the stage behind the others.
  function applyWardrobeRoles(snapAll) {
    const n = wrItems.length;
    const snapped = [];
    wrItems.forEach((el, i) => {
      const d = wardrobeOffset(i, n);
      const prev = el.dataset.d === '' ? null : Number(el.dataset.d);
      const offstage = (x) => Math.abs(x) > 2;
      const jump = prev === null || (Math.abs(d - prev) > 2 && !(offstage(prev) && offstage(d) && Math.sign(prev) === Math.sign(d)));
      if (snapAll || jump) { el.classList.add('is-snap'); snapped.push(el); }
      el.dataset.d = String(d);
      WR_ROLES.forEach((r) => el.classList.remove(r));
      el.classList.add(roleFor(d));
      el.setAttribute('aria-hidden', String(d !== 0));
    });
    if (snapped.length) {
      // eslint-disable-next-line no-unused-expressions
      void wardrobeTrack.offsetWidth;
      snapped.forEach((el) => el.classList.remove('is-snap'));
    }
  }

  function updateWardrobeItemBadges() {
    const defs = wardrobeDefs();
    wrItems.forEach((el, i) => {
      const status = wardrobeStatus(defs[i].id);
      const locked = status === 'buyable' || status === 'locked';
      el.classList.toggle('is-locked', locked);
      el.classList.toggle('is-equipped', status === 'equipped');
      el.querySelector('.wr-badge').innerHTML = status === 'equipped' ? WR_CHECK_SVG : locked ? WR_LOCK_SVG : '';
    });
  }

  function updateWardrobeInfo(animate) {
    const skin = wardrobeDefs()[wrActive];
    if (!skin) return;
    const status = wardrobeStatus(skin.id);
    wrIndexEl.textContent = pad2(wrActive + 1);
    // Same per-skin glyph the old cards carried in their corner badge.
    wrNameEl.innerHTML = `<span class="wr-icon" aria-hidden="true">${SKIN_ICON_SVG[skin.icon] || ''}</span><span>${skin.name.toUpperCase()}</span>`;
    const owned = status === 'equipped' || status === 'owned';
    wrPriceEl.classList.toggle('is-owned', owned);
    if (owned) wrPriceEl.textContent = skin.price > 0 ? 'NO SEU GUARDA-ROUPA' : 'GRÁTIS';
    else wrPriceEl.innerHTML = `${WR_COIN_SVG}<span>${skin.price.toLocaleString('pt-BR')}</span>`;
    wrTagEl.hidden = status !== 'equipped';
    wrTagEl.textContent = 'EQUIPADA';

    const label = { equipped: 'EQUIPADA', owned: 'EQUIPAR', buyable: 'COMPRAR', locked: 'COMPRAR' }[status];
    btnWrAction.textContent = label;
    btnWrAction.dataset.action = status;
    btnWrAction.classList.toggle('is-equipped', status === 'equipped');
    btnWrAction.classList.toggle('is-buyable', status === 'buyable');
    btnWrAction.classList.toggle('is-locked', status === 'locked');
    // aria-disabled (not the disabled attribute): the locked state still
    // has to answer a tap with the "faltam N moedas" message.
    const inert = status === 'equipped' || status === 'locked';
    btnWrAction.setAttribute('aria-disabled', String(inert));
    btnWrAction.setAttribute('aria-label', status === 'locked'
      ? `Comprar ${skin.name}: faltam ${skin.price - coinBalance} moedas`
      : `${label} ${skin.name}`);

    if (animate) restartAnim(wrSwapEl, 'is-swapping');
  }

  // Decodes the images that are about to become visible (the active one
  // and two on each side) ahead of time, so a swap never shows a blank
  // frame. The preview files themselves were already fetched at boot by
  // loadSkinPreviews(); decode() just makes sure they're ready to paint.
  function preloadWardrobeNeighbors() {
    const n = wrItems.length;
    for (let d = -3; d <= 3; d++) {
      const el = wrItems[(wrActive + d + n * 4) % n];
      const img = el && el.querySelector('img');
      if (img && img.decode) img.decode().catch(() => {});
    }
  }

  function lockWardrobe() {
    wrAnimating = true;
    clearTimeout(wrLockTimer);
    wrLockTimer = setTimeout(() => { wrAnimating = false; }, REDUCE_MOTION ? 120 : WR_SWAP_MS);
  }

  function goToWardrobe(index) {
    const n = wrItems.length;
    if (wrAnimating || n < 2) return;
    const next = ((index % n) + n) % n;
    if (next === wrActive) return;
    lockWardrobe();
    wrActive = next;
    hideWardrobeMsg();
    applyWardrobeRoles(false);
    updateWardrobeInfo(true);
    preloadWardrobeNeighbors();
    AudioMgr.uiHover();
  }

  function moveWardrobe(dir) { goToWardrobe(wrActive + dir); }

  function showWardrobeMsg(text) {
    clearTimeout(wrMsgTimer);
    wrMsgEl.textContent = text;
    wrMsgEl.classList.add('is-visible');
    wrMsgTimer = setTimeout(() => hideWardrobeMsg(), 2200);
  }

  function hideWardrobeMsg(immediate) {
    clearTimeout(wrMsgTimer);
    wrMsgEl.classList.remove('is-visible');
    if (immediate) wrMsgEl.textContent = '';
  }

  function celebrateWardrobeItem(withStamp) {
    const el = wrItems[wrActive];
    if (el) restartAnim(el, 'is-celebrate');
    if (withStamp && wrStamp) restartAnim(wrStamp, 'is-live');
  }

  function showCoinDelta(amount) {
    wardrobeCoinsDelta.textContent = `-${amount.toLocaleString('pt-BR')}`;
    restartAnim(wardrobeCoinsDelta, 'is-live');
    bump(wardrobeCoinsValue);
  }

  btnWrPrev.addEventListener('click', (e) => { e.stopPropagation(); moveWardrobe(-1); });
  btnWrNext.addEventListener('click', (e) => { e.stopPropagation(); moveWardrobe(1); });

  // Tapping a side item brings it to the center.
  wardrobeTrack.addEventListener('click', (e) => {
    const item = e.target.closest('.wr-item');
    if (!item || item.classList.contains('is-center')) return;
    goToWardrobe(Number(item.dataset.index));
  });

  // Swipe on the stage (touch or mouse drag): one step per gesture.
  let wrSwipeX = null;
  wardrobeStage.addEventListener('pointerdown', (e) => { wrSwipeX = e.clientX; }, { passive: true });
  wardrobeStage.addEventListener('pointerup', (e) => {
    if (wrSwipeX === null) return;
    const dx = e.clientX - wrSwipeX;
    wrSwipeX = null;
    if (Math.abs(dx) > 40) moveWardrobe(dx < 0 ? 1 : -1);
  }, { passive: true });
  wardrobeStage.addEventListener('pointercancel', () => { wrSwipeX = null; }, { passive: true });

  // Same purchase/equip rules as before, byte for byte: purchase() only
  // unlocks (never auto-equips), equipping kicks off the lazy full-frame
  // load, and the all_skins achievement check is unchanged.
  btnWrAction.addEventListener('click', (e) => {
    e.stopPropagation();
    const skin = wardrobeDefs()[wrActive];
    if (!skin) return;
    const isAlberto = wardrobeTab === 'alberto';
    const store = isAlberto ? AlbertoSkinStore : SkinStore;
    const loadFrames = isAlberto ? loadAlbertoSkinFullFrames : loadSkinFullFrames;
    const action = wardrobeStatus(skin.id);
    if (action === 'buyable') {
      const res = store.purchase(skin.id);
      if (res.ok) {
        coinBalance = SkinStore.getCoins(); // shared coin balance regardless of which wardrobe spent it
        AudioMgr.powerup();
        updateCoinsHud();
        showCoinDelta(skin.price);
        if (!isAlberto && SkinStore.getUnlocked().length === SKIN_DEFS.length) unlockAchievement('all_skins');
        updateWardrobeItemBadges();
        updateWardrobeInfo(false);
        restartAnim(btnWrAction, 'is-pop');
        celebrateWardrobeItem(true);
        announce(`${skin.name} desbloqueada.`);
      }
    } else if (action === 'owned') {
      store.setEquipped(skin.id);
      loadFrames(skin.id); // fire-and-forget: lazy full-cycle load, see sprites.js
      AudioMgr.uiClick();
      updateWardrobeItemBadges();
      updateWardrobeInfo(false);
      restartAnim(btnWrAction, 'is-pop');
      celebrateWardrobeItem(false);
      announce(`${skin.name} equipada.`);
    } else if (action === 'locked') {
      const missing = skin.price - coinBalance;
      restartAnim(btnWrAction, 'is-shake');
      showWardrobeMsg(`Faltam ${missing.toLocaleString('pt-BR')} moedas`);
      AudioMgr.land();
    }
  });

  // While the wardrobe is open its keys are its own: arrows browse,
  // Escape closes, and Space/ArrowUp no longer start a run underneath
  // the panel. Capture phase on window, same pattern account-ui.js uses.
  window.addEventListener('keydown', (e) => {
    if (overlayWardrobe.hidden) return;
    if (e.code === 'ArrowLeft') { e.preventDefault(); moveWardrobe(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); moveWardrobe(1); }
    else if (e.code === 'Escape') { e.preventDefault(); AudioMgr.uiClick(); closeWardrobe(); }
    else if (e.code === 'Space' || e.code === 'ArrowUp') {
      // Let Space still press a focused button (native activation).
      if (!(document.activeElement && document.activeElement.tagName === 'BUTTON')) e.preventDefault();
    } else return;
    e.stopPropagation();
  }, true);

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

    // The wedding ending is entered through its own portal, spawned by
    // maybeSpawnPortal() at the WEDDING_SCORE_THRESHOLD checkpoint and
    // touched exactly like any other portal (see the touch-check below,
    // `if (portal.wedding) beginWeddingTransition()`) — no separate
    // score-threshold trigger here.
    maybeSpawnPortal();

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
    if (coinBonusTimer > 0) {
      coinBonusTimer -= dt;
      if (coinBonusTimer <= 0) { coinBonusTimer = 0; coinMultiplier = 1; updateStatusBadges(); }
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

    // --- portal ---
    // Spawning (and all other spawn timers below) is suppressed for as
    // long as a portal is pending/on screen, guaranteeing the stretch
    // between here and the portal — and the portal itself — is never
    // blocked by an obstacle.
    if (portal) {
      portal.x -= speed * dt;
      portal.t += dt;
    }

    // --- obstacles ---
    if (!portal) {
      distanceSinceLastSpawn += speed * dt;
      if (distanceSinceLastSpawn >= nextSpawnGap) {
        scheduleNextSpawn(spawnObstacleGroup());
      }
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
    if (!portal) {
      distanceSinceLastDecor += speed * dt;
      if (distanceSinceLastDecor >= nextDecorGap) {
        spawnDecor();
        scheduleNextDecor();
      }
    }
    for (const d of decor) d.x -= speed * dt;
    decor = decor.filter(d => d.x + d.w > -10);

    // --- power-ups ---
    if (!portal) {
      distanceSinceLastPowerup += speed * dt;
      if (distanceSinceLastPowerup >= nextPowerupGap) {
        if (score >= POWERUP_MIN_SCORE) spawnPowerup();
        schedulePowerupSpawn();
      }
      // 2x moedas: relógio próprio, sem relação com o cronômetro acima.
      nextCoinPowerupIn -= dt;
      if (nextCoinPowerupIn <= 0) {
        if (score >= POWERUP_MIN_SCORE) spawnCoinPowerup();
        scheduleCoinPowerup();
      }
    }
    for (const p of powerups) p.x -= speed * dt;
    powerups = powerups.filter(p => p.x + p.w > -10);

    // --- coins ---
    if (!portal) {
      distanceSinceLastCoinCluster += speed * dt;
      if (distanceSinceLastCoinCluster >= nextCoinGap) {
        spawnCoinCluster();
        scheduleNextCoinCluster();
      }
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

    // Portal touch is a checkpoint, never a hazard — a generous, forgiving
    // box (same spirit as the power-up pickup box above) so grazing the
    // portal always counts as reaching it, and it can never itself end
    // the run.
    if (portal && !portal.triggered) {
      const doorX = portal.x + portal.w * PORTAL_DOORWAY_START;
      const doorW = portal.w * (PORTAL_DOORWAY_END - PORTAL_DOORWAY_START);
      const doorY = GROUND_Y - portal.h;
      if (px < doorX + doorW && px + pw > doorX && hitboxY < doorY + portal.h && hitboxY + hitboxH > doorY) {
        portal.triggered = true;
        if (portal.wedding) beginWeddingTransition();
        else beginBiomeTransition();
      }
    }

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
      else if (p.type === 'coins') drawIconGlyph(ICON_PATHS.coins, cx, cy, iconSize, { stroke: '#2b2b2b', lineWidth: 2.6 });
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

  // Sky + backdrop (mountains or the static biome scene) for one biome.
  function drawBiomeSkyAndBackdrop(biomeName, gY) {
    const art = BIOME_ART[biomeName];
    if (art.sprite) {
      ctx.fillStyle = art.sky;
      ctx.fillRect(0, 0, W, H);
      const bgImg = SPRITES[art.sprite];
      // Scaled to the full canvas width (not a small centered box) so it
      // spans edge-to-edge like the desert's mountain silhouette does —
      // a small centered image left a visible rectangular seam against
      // the flat sky fill around it. Anchored to the ground line; any
      // leftover sky above (when the image's own height at this width
      // is shorter than the available space) is just more flat sky,
      // which reads naturally instead of as a floating box.
      const bgH = Math.min(gY, W / (bgImg.naturalWidth / bgImg.naturalHeight));
      ctx.drawImage(bgImg, 0, gY - bgH, W, bgH);
    } else {
      // Tiled low-horizon range over a flat sky: lots of open sky, a
      // range that repeats across the full width with no edge to run
      // out of, and the character left as the focus. Desert defines
      // this look and falls through with no keys of its own; a biome
      // opting in just names its own sky colour and range sprite.
      ctx.fillStyle = art.sky || '#f3ead9';
      ctx.fillRect(0, 0, W, H);

      const mImg = SPRITES[art.mountains || 'mountains'];
      const mH = 96;
      const mW = spriteWidthForHeight(mImg, mH);
      const mY = GROUND_Y - mH + 30;
      let mx = (mountainScrollX % mW) - mW;
      while (mx < W) {
        ctx.drawImage(mImg, mx, mY, mW, mH);
        mx += mW;
      }
    }
  }

  // Ground tile for one biome.
  function drawBiomeGround(biomeName, gY) {
    const art = BIOME_ART[biomeName];
    const gImg = art.ground ? SPRITES[art.ground] : SPRITES.groundTile;
    const gW = spriteWidthForHeight(gImg, GROUND_TILE_H);
    let gx = (groundScrollX % gW) - gW;
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
    if (!art.ground) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#f3ead9';
      ctx.fillRect(0, gY, W, GROUND_TILE_H);
      ctx.restore();
    }
  }

  function drawClouds(biomeName) {
    const art = BIOME_ART[biomeName];
    for (const c of clouds) {
      const img = SPRITES[art[c.role] || art.cloud];
      const h = 70 * c.scale;
      const w = spriteWidthForHeight(img, h);
      ctx.drawImage(img, c.x, c.y, w, h);
    }
  }

  // Draws exactly one biome — the active one during normal play, or an
  // explicit override for the "next biome" atmospheric preview shown
  // behind the portal loading screen. There is never a second biome
  // drawn underneath/behind this one, so a clean cutover is guaranteed:
  // the instant the loading overlay hides, only the new biome exists.
  function drawBackground(biomeName) {
    const gY = H - GROUND_TILE_H;
    const biome = biomeName || activeBiome();
    drawBiomeSkyAndBackdrop(biome, gY);
    drawClouds(biome);
    drawBiomeGround(biome, gY);
  }

  // Cover-fit + ground-aligned transform for the wedding background,
  // recomputed live off the current W/H/GROUND_Y (never cached) so it
  // stays correct across a resize/orientation change. Shared by
  // drawWeddingScene() below and by updateWeddingScene()'s walk-target
  // math (js weddingCharX target), which needs the exact same drawW/
  // offsetX to convert a fraction of the artwork (e.g. "near the altar
  // steps") into the matching world-X — a position picked any other way
  // would drift off the actual altar art the moment the aspect ratio
  // changes what's cropped.
  function weddingSceneTransform() {
    const img = SPRITES[WEDDING_ART.key];
    const groundFrac = WEDDING_ART.groundFrac;
    const scaleForWidth = W / img.naturalWidth;
    const scaleForTop = GROUND_Y / (groundFrac * img.naturalHeight);
    const scale = Math.max(scaleForWidth, scaleForTop);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (W - drawW) / 2;
    const y = GROUND_Y - groundFrac * drawH;
    return { img, x, y, drawW, drawH };
  }

  // Groom's fixed world-X, converted from WEDDING_GROOM_X_FRAC the same
  // live way as Mariana's WEDDING_STOP_X_FRAC target — recomputed every
  // call (never cached) so it stays correct across a resize.
  function weddingGroomWorldX() {
    const t = weddingSceneTransform();
    return t.x + WEDDING_GROOM_X_FRAC * t.drawW;
  }

  // Wedding ending scenery — a single full illustration (not a tiling
  // biome strip), drawn to cover the whole W×H world with its own floor
  // (WEDDING_ART.groundFrac) lined up on GROUND_Y, the same line every
  // other biome's ground sits on. Scaled uniformly (never stretched):
  // first to the width needed to span the world edge-to-edge, then, if
  // that leaves the image's top short of y=0, scaled up further until it
  // does — centering crops the sides instead of ever distorting the art.
  function drawWeddingScene() {
    const t = weddingSceneTransform();
    ctx.drawImage(t.img, t.x, t.y, t.drawW, t.drawH);
  }

  const WEDDING_PHASE_FRAMES = {
    get decelerate() { return WEDDING_DECEL_FRAMES; },
    get walk() { return WEDDING_WALK_FRAMES; },
    get stop() { return WEDDING_STOP_FRAMES; },
    get idle() { return WEDDING_KISS_IDLE_FRAMES; },
    get kissLeft() { return WEDDING_KISS_LEFT_FRAMES; },
    get kissRight() { return WEDDING_KISS_RIGHT_FRAMES; },
    get kissForehead() { return WEDDING_KISS_FOREHEAD_FRAMES; },
    get kissLips() { return WEDDING_KISS_LIPS_FRAMES; },
    get finalTogether() { return WEDDING_FINAL_FRAMES; },
  };

  // Same bottom-right anchor convention as drawPlayer() (drawSpriteRB,
  // weddingCharX standing in for PLAYER_RIGHT_X) and the same GROUND_Y
  // ground line as everything else in the game — she can only ever look
  // planted on the terrace or floating above it, never something in
  // between, by construction. Solo phases only (WEDDING_SOLO_PHASES) —
  // the kiss/final phases draw a single pre-composed couple frame
  // instead (see drawWeddingCouple()).
  function drawWeddingCharacter() {
    if (!weddingPhase) return;
    const img = WEDDING_PHASE_FRAMES[weddingPhase][weddingAnimFrame];
    drawSpriteRB(ctx, img, weddingCharX, GROUND_Y, currentGirlH());
  }

  // Groom waiting at his fixed spot, idling in place — visible through
  // decelerate/walk/stop/idle, i.e. WEDDING_SOLO_PHASES (see
  // updateWeddingScene, which only advances groomAnimFrame then). Once
  // a kiss phase starts he's part of the composed frame drawn by
  // drawWeddingCouple() instead, never drawn separately again.
  function drawGroomIdle() {
    const img = WEDDING_GROOM_IDLE_FRAMES[groomAnimFrame];
    drawSpriteRB(ctx, img, weddingGroomWorldX(), GROUND_Y, currentGirlH());
  }

  // Each kiss/final frame already has both Mariana and the groom drawn
  // together by the artist — positioned as one sprite, anchored off the
  // groom's fixed spot (he doesn't move for the rest of the scene; she
  // already walked up to him, so his anchor is the stable one to keep).
  function drawWeddingCouple() {
    const img = WEDDING_PHASE_FRAMES[weddingPhase][weddingAnimFrame];
    drawSpriteRB(ctx, img, weddingGroomWorldX(), GROUND_Y, currentGirlH());
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

  // Alberto's own equipped-skin frames, same fallback contract as
  // currentGirlFrames() above — used both by drawCat() (companion, always
  // CAT_H) and by drawPlayer() when he's the main runner (playableCharacter
  // === 'alberto'), so his skin choice renders the same way in either role.
  function currentCatSkinFrames() {
    const skinFrames = ALBERTO_SKIN_SPRITE_FRAMES[AlbertoSkinStore.getEquipped()];
    if (skinFrames) return skinFrames;
    return { run: CAT_RUN_FRAMES, jump: CAT_JUMP_FRAMES, idle: CAT_IDLE_FRAMES };
  }

  function drawPlayer() {
    const isAlberto = playableCharacter === 'alberto';
    const frames = isAlberto ? currentCatSkinFrames() : currentGirlFrames();
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
    const frames = currentCatSkinFrames();
    let img;
    if (state === 'start') {
      img = frames.idle[idleFrame];
    } else if (player.jumping) {
      img = frames.jump[jumpFrameIndex()];
    } else {
      img = frames.run[player.frame];
    }
    drawSpriteRB(ctx, img, catRightX, catBottomY, CAT_H);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const spec = obstacleSpec(o.type, o.biome);
      ctx.drawImage(spec.img, o.x, GROUND_Y - o.h, o.w, o.h);
    }
  }

  // The whole sheet is drawn untouched; portal.x/h track the artwork
  // inside it, so the transparent glow margin hangs outside the box
  // without shifting where the portal stands (see PORTAL_ART above).
  function drawPortal() {
    if (!portal) return;
    const img = SPRITES[portal.art.key];
    const x = portal.x - portal.art.left * portal.drawW;
    const y = GROUND_Y - portal.art.bottom * portal.drawH;
    ctx.drawImage(img, x, y, portal.drawW, portal.drawH);
  }

  // ---------- Tela inicial: profundidade pelo ponteiro ----------
  // Desktop only (fine pointer + hover) and never with reduced motion.
  // A few game units of offset on the far layers — mountains more than
  // clouds, the same depth order the gameplay parallax already uses
  // (clouds scroll at 0.12x, mountains at 0.28x) — while the ground and
  // the characters stay put. The DOM title/sign get the same smoothed
  // value through --mpx/--mpy. With the pointer at rest everything is
  // exactly the plain drawBackground() picture.
  const menuParallax = { x: 0, y: 0, tx: 0, ty: 0, wx: 0, wy: 0 };
  const finePointerQuery = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  window.addEventListener('pointermove', (e) => {
    if (state !== 'start' || REDUCE_MOTION || !finePointerQuery || !finePointerQuery.matches) return;
    menuParallax.tx = e.clientX / window.innerWidth - 0.5;
    menuParallax.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { menuParallax.tx = 0; menuParallax.ty = 0; });

  function updateMenuParallax(dt) {
    const k = Math.min(1, dt * 5);
    menuParallax.x += (menuParallax.tx - menuParallax.x) * k;
    menuParallax.y += (menuParallax.ty - menuParallax.y) * k;
    if (Math.abs(menuParallax.x - menuParallax.wx) > 0.001 || Math.abs(menuParallax.y - menuParallax.wy) > 0.001) {
      menuParallax.wx = menuParallax.x;
      menuParallax.wy = menuParallax.y;
      overlays.start.style.setProperty('--mpx', menuParallax.x.toFixed(4));
      overlays.start.style.setProperty('--mpy', menuParallax.y.toFixed(4));
    }
  }

  function drawStartBackground() {
    const gY = H - GROUND_TILE_H;
    const biome = activeBiome();
    const savedMountainX = mountainScrollX;
    mountainScrollX = savedMountainX - menuParallax.x * 7;
    drawBiomeSkyAndBackdrop(biome, gY);
    mountainScrollX = savedMountainX;
    ctx.save();
    ctx.translate(-menuParallax.x * 4, -menuParallax.y * 3);
    drawClouds(biome);
    ctx.restore();
    drawBiomeGround(biome, gY);
  }

  // ---------- Encontro no altar: enquadramento ----------
  // A camera over the UNCHANGED scene: same sprites, same phase order and
  // timers, same four hearts (spawnKissHeart). Everything below is a pure
  // function of the existing weddingPhaseIndex/weddingPhaseTimer, so it
  // has no state of its own, freezes together with the tableau on
  // 'weddingEnd', and is exactly identity (scale 1, no bars, no
  // vignette) on the first 'wedding' frame — the cutover from the portal
  // loading screen (drawWeddingScene() with no camera) stays seamless.
  // Mirrors the per-phase durations updateWeddingScene() already uses.
  function weddingPhaseLength(phase) {
    const frames = WEDDING_PHASE_FRAME_COUNT[phase] * WEDDING_PHASE_FRAME_DURATION[phase];
    if (phase === 'idle') return WEDDING_IDLE_HOLD_DURATION;
    if (phase === 'walk') return WEDDING_WALK_DURATION;
    if (phase === 'finalTogether') return frames + WEDDING_FINAL_HOLD_EXTRA;
    return frames;
  }

  function weddingSceneSeconds(uptoIndex) {
    let t = 0;
    for (let i = 0; i < uptoIndex; i++) t += weddingPhaseLength(WEDDING_WALK_PHASES[i]);
    return t;
  }

  const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

  function weddingCamera() {
    const focusX = weddingGroomWorldX() - currentGirlH() * 0.3;
    const focusY = GROUND_Y - currentGirlH() * 0.55;
    if (!weddingPhase) return { s: 1, fx: focusX, fy: focusY, bars: 0, vignette: 0 };
    const t = weddingSceneSeconds(weddingPhaseIndex)
      + Math.min(weddingPhaseTimer, weddingPhaseLength(weddingPhase));
    const arrive = weddingSceneSeconds(WEDDING_WALK_PHASES.indexOf('stop'));
    const lastKiss = weddingSceneSeconds(WEDDING_WALK_PHASES.indexOf('finalTogether'));
    if (REDUCE_MOTION) return { s: 1, fx: focusX, fy: focusY, bars: 1, vignette: 0.12 };
    // 1 -> 1.035 while she walks up, then -> 1.075 across the pause and
    // the four kisses; holds from the final pose on.
    const s = t <= arrive
      ? 1 + 0.035 * easeInOutSine(t / arrive)
      : 1.035 + 0.04 * easeInOutSine((t - arrive) / (lastKiss - arrive));
    return {
      s,
      fx: focusX,
      fy: focusY,
      bars: easeInOutSine(t / 1.1),
      vignette: 0.14 * easeInOutSine((t - arrive) / (lastKiss - arrive)),
    };
  }

  // Screen-space framing drawn on top of the camera: thin ink letterbox
  // bars and a soft warm edge falloff that deepens as the kisses play —
  // the background "leans in" without a single pixel of the art or the
  // sprites being recolored.
  function drawWeddingFraming(cam) {
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (cam.vignette > 0.001) {
      const r = Math.hypot(cw, ch) / 2;
      const g = ctx.createRadialGradient(cw / 2, ch * 0.55, r * 0.45, cw / 2, ch * 0.55, r);
      g.addColorStop(0, 'rgba(60,36,24,0)');
      g.addColorStop(1, `rgba(60,36,24,${cam.vignette.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (cam.bars > 0.001) {
      const barH = Math.round(ch * 0.055 * cam.bars);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(0, 0, cw, barH);
      ctx.fillRect(0, ch - barH, cw, barH);
    }
    ctx.restore();
  }

  function render() {
    const shake = ScreenShake.offset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    let particlesDrawn = false;

    if (state === 'start') {
      drawStartBackground();
      drawDecor();
      // Alberto-as-main renders solo — drawPlayer() already switches to
      // his own frames below; skipping drawCat() here is what keeps him
      // from also appearing as his own companion.
      if (playableCharacter === 'mariana') drawCat();
      drawPlayer();
    } else if (state === 'transition') {
      // Atmospheric preview behind the loading overlay: the wedding
      // scenery when this transition is heading there (pendingWedding),
      // otherwise the next biome as before — no player, cat, obstacles
      // or decor from the old biome linger, and nothing of the
      // destination's own obstacles/decor exists yet either (both were
      // cleared in beginWeddingTransition/beginBiomeTransition).
      if (pendingWedding) drawWeddingScene();
      else drawBackground(BIOME_ORDER[pendingBiomeIndex]);
    } else if (state === 'wedding' || state === 'weddingEnd') {
      // Mariana's decelerate/walk/stop/idle/kisses/final sequence — see
      // updateWeddingScene(). 'weddingEnd' keeps rendering this same
      // frozen tableau behind the completion card (update() stopped
      // being called the moment state left 'wedding', so weddingPhase
      // stays on finalTogether's last frame — nothing to redraw
      // differently here).
      const cam = weddingCamera();
      ctx.save();
      ctx.translate(cam.fx, cam.fy);
      ctx.scale(cam.s, cam.s);
      ctx.translate(-cam.fx, -cam.fy);
      drawWeddingScene();
      if (WEDDING_SOLO_PHASES.has(weddingPhase)) {
        drawGroomIdle();
        drawWeddingCharacter();
      } else if (weddingPhase) {
        drawWeddingCouple();
      }
      // Hearts live in the same camera space as the couple they rise from.
      Particles.draw(ctx);
      particlesDrawn = true;
      ctx.restore();
      drawWeddingFraming(cam);
    } else {
      drawBackground();
      drawDecor();
      drawObstacles();
      drawPowerups();
      drawCoins();
      if (portal) drawPortal();
      if (playableCharacter === 'mariana') drawCat();
      drawPlayer();
      if (shieldActive) drawShieldHalo();
      const darkness = currentDarkness();
      drawPhaseTint(darkness);
      drawStars(darkness);
    }
    if (!particlesDrawn) Particles.draw(ctx);
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

    if (state === 'start') { updateIdleAnimation(dt); updateMenuParallax(dt); }
    if (state === 'transition') updatePortalTransition(dt);
    if (state === 'wedding') updateWeddingScene(dt);
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
  updateCharacterSelectUI();
  Promise.all([loadAllSprites(), loadSkinSprites()]).then(() => {
    clearInterval(loadingTimer);
    GIRL_RUN_FRAMES = framesFromPrefix('girlRun', RUN_FRAME_COUNT);
    GIRL_JUMP_FRAMES = framesFromPrefix('girlJump', JUMP_FRAME_COUNT);
    GIRL_IDLE_FRAMES = framesFromPrefix('girlIdle', 2);
    CAT_RUN_FRAMES = framesFromPrefix('catRun', RUN_FRAME_COUNT);
    CAT_JUMP_FRAMES = framesFromPrefix('catJump', JUMP_FRAME_COUNT);
    CAT_IDLE_FRAMES = framesFromPrefix('catIdle', 2);
    WEDDING_DECEL_FRAMES = framesFromPrefix('weddingDecel', 8);
    WEDDING_WALK_FRAMES = framesFromPrefix('weddingWalk', 8);
    WEDDING_STOP_FRAMES = framesFromPrefix('weddingStop', 6);
    WEDDING_KISS_IDLE_FRAMES = framesFromPrefix('weddingKissIdle', 3);
    WEDDING_GROOM_IDLE_FRAMES = framesFromPrefix('weddingGroomIdle', 4);
    WEDDING_KISS_LEFT_FRAMES = framesFromPrefix('weddingKissLeft', 4);
    WEDDING_KISS_RIGHT_FRAMES = framesFromPrefix('weddingKissRight', 4);
    WEDDING_KISS_FOREHEAD_FRAMES = framesFromPrefix('weddingKissForehead', 4);
    WEDDING_KISS_LIPS_FRAMES = framesFromPrefix('weddingKissLips', 4);
    WEDDING_FINAL_FRAMES = framesFromPrefix('weddingFinal', 4);

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
