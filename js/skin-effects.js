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

  const SPARKLE_RECIPES = {
    princesa: { color: '#e6a6c7', interval: 0.55, shape: 'star', size: 11 },
    volei: { color: '#e8b23d', interval: 0.7, shape: 'star', size: 9, spread: 20 },
    noiva: { color: '#f6d3de', interval: 0.5, shape: 'heart', size: 12 },
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
  }

  return { update, draw, reset };
})();
