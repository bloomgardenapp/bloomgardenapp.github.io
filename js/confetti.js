// confetti.js — hand-rolled canvas confetti. burst(x, y) for small wins, rain() for level-ups.

let canvas, ctx, parts = [], raf = null;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }

const COLORS = ['#F58F7C', '#F5C542', '#6FBF73', '#53C6B2', '#64A8E8', '#9B7DF2', '#F27EA9'];

export function burst(x = innerWidth / 2, y = innerHeight / 3, { count = 18, colors = COLORS } = {}) {
  ensure();
  const deadline = performance.now() + 2600; // wall-clock cap: throttled tabs can't hoard confetti
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2.5 + Math.random() * 5.5;
    parts.push({
      x, y, deadline,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3.2,
      g: 0.18, life: 55 + Math.random() * 30, age: 0,
      size: 4 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.32,
      circle: Math.random() < 0.35,
    });
  }
  if (!raf) loop();
}

export function rain({ colors = COLORS } = {}) {
  ensure();
  const deadline = performance.now() + 3600;
  for (let i = 0; i < 60; i++) {
    parts.push({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 1.6, vy: 2.4 + Math.random() * 3,
      g: 0.05, life: 130 + Math.random() * 60, age: 0, deadline,
      size: 5 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.24,
      circle: Math.random() < 0.35,
    });
  }
  if (!raf) loop();
}

function loop() {
  raf = requestAnimationFrame(loop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();
  parts = parts.filter((p) => p.age < p.life && now < p.deadline && p.y < canvas.height + 40);
  if (!parts.length) { cancelAnimationFrame(raf); raf = null; return; }
  for (const p of parts) {
    p.age++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); }
    else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
    ctx.restore();
  }
}
