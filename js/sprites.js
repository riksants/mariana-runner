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
