/* =========================================================
   MARIANA RUNNER — particles & screen shake
   Small procedural juice: no art assets, just drawn shapes.
   Dust puffs sell footfalls and landings; the celebration
   burst marks a new high score; shake sells an impact.
   Every emitter is skipped/shortened when the OS-level
   reduced-motion preference is set.
   ========================================================= */

const REDUCE_MOTION = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      r: opts.size || 10,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 2,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.25,
      color: opts.color || '#e8b23d',
    });
  }

  function dust(x, y, opts = {}) {
    if (REDUCE_MOTION) return;
    const count = opts.count || 3;
    for (let i = 0; i < count; i++) {
      items.push({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 10,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.5) * 40 - (opts.driftX || 0),
        vy: -20 - Math.random() * 40,
        r: 3 + Math.random() * 3,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        color: opts.color || 'rgba(196,178,143,',
      });
    }
  }

  const BURST_COLORS = ['#a83f1f', '#2b2b2b', '#e8b23d', '#5c8a5c'];
  function burst(x, y, opts = {}) {
    const count = REDUCE_MOTION ? 6 : (opts.count || 22);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 90 + Math.random() * 160;
      items.push({
        kind: 'confetti',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: 3 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 10,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        color: BURST_COLORS[i % BURST_COLORS.length],
      });
    }
  }

  function update(dt, gravity) {
    for (const p of items) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'confetti' ? gravity * 0.35 : gravity * 0.12) * dt;
      if (p.rot !== undefined) p.rot += p.vrot * dt;
    }
    items = items.filter((p) => p.life < p.maxLife);
  }

  function draw(ctx) {
    for (const p of items) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t;
      if (p.kind === 'dust') {
        ctx.fillStyle = p.color + (alpha * 0.5).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sparkle') {
        const path = p.shape === 'heart' ? SPARKLE_HEART_PATH : SPARKLE_STAR_PATH;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.r / 24, p.r / 24);
        ctx.translate(-12, -12);
        ctx.fillStyle = p.color;
        ctx.fill(path);
        // Ink outline on every sparkle, matching the flat-ink-on-paper
        // border already used on coins, power-ups, and the sun/moon —
        // also keeps pale colors (like the bridal white/cream) visible
        // against a similarly pale sky.
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 2.2;
        ctx.stroke(path);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
    }
  }

  function clear() { items = []; }

  return { dust, burst, sparkle, update, draw, clear };
})();

const ScreenShake = (() => {
  let trauma = 0;
  let x = 0, y = 0;

  function hit(amount = 1) {
    if (REDUCE_MOTION) return;
    trauma = Math.min(1, trauma + amount);
  }

  function update(dt) {
    if (trauma <= 0) { x = 0; y = 0; return; }
    trauma = Math.max(0, trauma - dt * 2.2);
    const power = trauma * trauma;
    const angle = Math.random() * Math.PI * 2;
    x = Math.cos(angle) * 8 * power;
    y = Math.sin(angle) * 8 * power;
  }

  function offset() { return { x, y }; }

  return { hit, update, offset };
})();
