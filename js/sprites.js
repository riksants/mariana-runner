/* =========================================================
   MARIANA RUNNER — asset loading
   Every character, obstacle and scenery graphic is the user's
   own illustrated artwork (assets/sprites/*.png). This module
   only loads images and offers a couple of draw helpers that
   keep every sprite's animation frames aligned on one anchor
   point, so trailing hair/limbs can vary width frame to frame
   without the character appearing to slide.
   ========================================================= */

const SPRITE_PATHS = {
  cactusSmall: 'assets/sprites/cactus_round.png',
  cactusBig: 'assets/sprites/cactus_tall.png',
  rock: 'assets/sprites/rock_big.png',
  rockSmall: 'assets/sprites/rock_small.png',

  bush: 'assets/sprites/bush.png',
  sign: 'assets/sprites/sign.png',
  fence: 'assets/sprites/fence.png',

  groundTile: 'assets/sprites/ground_tile.png',
  cloudBig: 'assets/sprites/cloud_big.png',
  cloudSmall1: 'assets/sprites/cloud_small1.png',
  mountains: 'assets/sprites/mountains.png',

  selvaBg: 'assets/sprites/biome_selva_bg.png',
  selvaGround: 'assets/sprites/biome_selva_ground.png',
  selvaCloud: 'assets/sprites/biome_selva_cloud.png',
  selvaCloud2: 'assets/sprites/biome_selva_cloud2.png',
  selvaObstacleSmall: 'assets/sprites/biome_obstacle_selva_small.png',
  selvaObstacleBig: 'assets/sprites/biome_obstacle_selva_big.png',
  selvaObstacleRock: 'assets/sprites/biome_obstacle_selva_rock.png',
  selvaObstacleRockSmall: 'assets/sprites/biome_obstacle_selva_rockSmall.png',
  selvaDecor1: 'assets/sprites/biome_decor_selva_1.png',
  selvaDecor2: 'assets/sprites/biome_decor_selva_2.png',

  neveBg: 'assets/sprites/biome_neve_bg.png',
  neveGround: 'assets/sprites/biome_neve_ground.png',
  neveCloud: 'assets/sprites/biome_neve_cloud.png',
  neveCloud2: 'assets/sprites/biome_neve_cloud2.png',
  neveObstacleSmall: 'assets/sprites/biome_obstacle_neve_small.png',
  neveObstacleBig: 'assets/sprites/biome_obstacle_neve_big.png',
  neveObstacleRock: 'assets/sprites/biome_obstacle_neve_rock.png',
  neveObstacleRockSmall: 'assets/sprites/biome_obstacle_neve_rockSmall.png',
  neveDecor1: 'assets/sprites/biome_decor_neve_1.png',
  neveDecor2: 'assets/sprites/biome_decor_neve_2.png',

  vulcaoBg: 'assets/sprites/biome_vulcao_bg.png',
  vulcaoGround: 'assets/sprites/biome_vulcao_ground.png',
  vulcaoCloud: 'assets/sprites/biome_vulcao_cloud.png',
  vulcaoCloud2: 'assets/sprites/biome_vulcao_cloud2.png',
  vulcaoObstacleSmall: 'assets/sprites/biome_obstacle_vulcao_small.png',
  vulcaoObstacleBig: 'assets/sprites/biome_obstacle_vulcao_big.png',
  vulcaoObstacleRock: 'assets/sprites/biome_obstacle_vulcao_rock.png',
  vulcaoObstacleRockSmall: 'assets/sprites/biome_obstacle_vulcao_rockSmall.png',
  vulcaoDecor1: 'assets/sprites/biome_decor_vulcao_1.png',
  vulcaoDecor2: 'assets/sprites/biome_decor_vulcao_2.png',

  // Checkpoint portals, named after the biome they appear IN — the scene
  // framed inside each arch previews the biome it leads to.
  portalDesert: 'assets/sprites/portal_desert.png',
  portalSelva: 'assets/sprites/portal_selva.png',
  portalNeve: 'assets/sprites/portal_neve.png',
  portalVulcao: 'assets/sprites/portal_vulcao.png',
};

(function buildFrameManifest() {
  const runFrames = 12;
  const jumpFrames = 4;
  const idleFrames = 2;
  for (let i = 1; i <= runFrames; i++) {
    const n = String(i).padStart(2, '0');
    SPRITE_PATHS['girlRun' + i] = `assets/sprites/girl_run_${n}.png`;
    SPRITE_PATHS['catRun' + i] = `assets/sprites/cat_run_${n}.png`;
  }
  for (let i = 1; i <= jumpFrames; i++) {
    const n = String(i).padStart(2, '0');
    SPRITE_PATHS['girlJump' + i] = `assets/sprites/girl_jump_${n}.png`;
    SPRITE_PATHS['catJump' + i] = `assets/sprites/cat_jump_${n}.png`;
  }
  for (let i = 1; i <= idleFrames; i++) {
    const n = String(i).padStart(2, '0');
    SPRITE_PATHS['girlIdle' + i] = `assets/sprites/girl_idle_${n}.png`;
    SPRITE_PATHS['catIdle' + i] = `assets/sprites/cat_idle_${n}.png`;
  }
})();

const SPRITES = {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar ' + src));
    img.src = src;
  });
}

// Resolves once every sprite has decoded. The game shows a loading
// frame until this settles, then builds its animation-frame arrays.
function loadAllSprites(onProgress) {
  const keys = Object.keys(SPRITE_PATHS);
  let loaded = 0;
  const tasks = keys.map((k) =>
    loadImage(SPRITE_PATHS[k]).then((img) => {
      loaded += 1;
      if (onProgress) onProgress(loaded, keys.length);
      return img;
    })
  );
  return Promise.all(tasks).then((images) => {
    keys.forEach((k, i) => { SPRITES[k] = images[i]; });
    return SPRITES;
  });
}

// e.g. framesFromPrefix('girlRun', 12) -> [SPRITES.girlRun1, ..., SPRITES.girlRun12]
function framesFromPrefix(prefix, count) {
  const arr = [];
  for (let i = 1; i <= count; i++) arr.push(SPRITES[prefix + i]);
  return arr;
}

// Draws an image scaled to a target height, anchored so the RIGHT
// edge sits at `rightX` and the BOTTOM sits at `bottomY`.
function drawSpriteRB(ctx, img, rightX, bottomY, targetH, extra) {
  const scale = targetH / img.naturalHeight;
  const w = img.naturalWidth * scale;
  const h = targetH;
  const x = rightX - w;
  const y = bottomY - h;
  if (extra && (extra.scaleX !== undefined || extra.scaleY !== undefined)) {
    const sx = extra.scaleX !== undefined ? extra.scaleX : 1;
    const sy = extra.scaleY !== undefined ? extra.scaleY : 1;
    const pivotX = x + w; // squash/stretch from the anchored (right/bottom) corner
    const pivotY = y + h;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -w, -h, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  return { x, y, w, h };
}

function spriteWidthForHeight(img, targetH) {
  return img.naturalWidth * (targetH / img.naturalHeight);
}

// Optional per-skin illustrated art. Missing files are *expected* until
// real artwork is supplied for a skin — they resolve to null instead of
// rejecting, so an art-less skin never blocks the game from loading and
// never throws. game.js falls back to the normal Mariana frames whenever
// a skin's entry here is null. See assets/sprites/skins/README.md for
// the exact file layout an artist should follow.
function loadImageOptional(src) {
  return loadImage(src).catch(() => null);
}

const SKIN_SPRITE_FRAMES = {};
// True once a skin's own girl_idle_01.png has been checked (whether or
// not it turned out to exist) -- cheap enough to check for every skin
// up front, used only to pick the wardrobe card's preview <img> source.
// Kept separate from SKIN_SPRITE_FRAMES, which only fills in once a
// skin's full 18-frame run/jump/idle cycle has loaded (see
// loadSkinFullFrames below) -- conflating the two would make the
// wardrobe grid fall back to plain Mariana previews for every skin
// that hasn't been equipped yet, once full-cycle loading became lazy.
const SKIN_PREVIEW_READY = {};
const skinFullFrameLoads = {};

function loadSkinFullFrames(skinId) {
  if (skinId === 'normal') return Promise.resolve();
  if (skinFullFrameLoads[skinId]) return skinFullFrameLoads[skinId];
  const runFrames = 12, jumpFrames = 4, idleFrames = 2;
  const load = (prefix, count) => {
    const paths = [];
    for (let i = 1; i <= count; i++) {
      const n = String(i).padStart(2, '0');
      paths.push(`assets/sprites/skins/${skinId}/${prefix}_${n}.png`);
    }
    return Promise.all(paths.map(loadImageOptional));
  };
  const promise = Promise.all([
    load('girl_run', runFrames),
    load('girl_jump', jumpFrames),
    load('girl_idle', idleFrames),
  ]).then(([run, jump, idle]) => {
    const complete = [...run, ...jump, ...idle].every(Boolean);
    SKIN_SPRITE_FRAMES[skinId] = complete ? { run, jump, idle } : null;
  });
  skinFullFrameLoads[skinId] = promise;
  return promise;
}

function loadSkinPreviews() {
  const tasks = SKIN_DEFS.filter((s) => s.id !== 'normal').map((skin) =>
    loadImageOptional(`assets/sprites/skins/${skin.id}/girl_idle_01.png`).then((img) => {
      SKIN_PREVIEW_READY[skin.id] = !!img;
    })
  );
  return Promise.all(tasks);
}

// Boot-time loading only fetches the currently-equipped skin's full
// run/jump/idle cycle (needed to actually play) plus one small preview
// frame per skin (needed for the wardrobe grid) -- not every skin's
// full 18-frame set. With 30 skins that would be 540 images blocking
// the start screen behind a single load gate; a player only ever wears
// one at a time. Equipping a different skin from the wardrobe kicks off
// that skin's full-cycle load in the background (see the wardrobe click
// handler in game.js) -- until it resolves, currentGirlFrames() already
// falls back to normal Mariana, the same graceful-degradation path this
// file has always used for a skin with no art at all.
function loadSkinSprites() {
  return Promise.all([loadSkinFullFrames(SkinStore.getEquipped()), loadSkinPreviews()]);
}
