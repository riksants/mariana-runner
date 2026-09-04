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

const Particles = (() => {
  let items = [];

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

  return { dust, burst, update, draw, clear };
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
