// banner.js — GOBE-style layered garden hills. Trees and flowers scale with your data.
// Colors come from CSS vars so the banner re-themes in dark mode for free.
import { plantSVG } from './plant.js';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pine(x, y, h, f) {
  const w = h * 0.42;
  return `<polygon points="${x},${(y - h).toFixed(1)} ${(x + w).toFixed(1)},${(y - h * 0.35).toFixed(1)} ${(x - w).toFixed(1)},${(y - h * 0.35).toFixed(1)}" fill="${f}"/>
  <polygon points="${x},${(y - h * 0.72).toFixed(1)} ${(x + w * 1.25).toFixed(1)},${y} ${(x - w * 1.25).toFixed(1)},${y}" fill="${f}"/>`;
}

function frond(x, y, h, f) {
  let out = `<line x1="${x}" y1="${y}" x2="${x}" y2="${(y - h).toFixed(1)}" stroke="${f}" stroke-width="2.2" stroke-linecap="round"/>`;
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const yy = y - h * t - h * 0.06;
    const len = h * 0.32 * (1 - t * 0.4);
    out += `<path d="M${x} ${yy.toFixed(1)} Q ${(x - len * 0.7).toFixed(1)} ${(yy - len * 0.3).toFixed(1)} ${(x - len).toFixed(1)} ${(yy + len * 0.12).toFixed(1)}" stroke="${f}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    out += `<path d="M${x} ${yy.toFixed(1)} Q ${(x + len * 0.7).toFixed(1)} ${(yy - len * 0.3).toFixed(1)} ${(x + len).toFixed(1)} ${(yy + len * 0.12).toFixed(1)}" stroke="${f}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
  return out + `<circle cx="${x}" cy="${(y - h).toFixed(1)}" r="2.4" fill="${f}"/>`;
}

function bush(x, y, r, f) {
  return `<ellipse cx="${x}" cy="${(y - r * 0.5).toFixed(1)}" rx="${r}" ry="${(r * 0.72).toFixed(1)}" fill="${f}"/>`;
}

export function gardenBannerSVG({ seed = 'bloom-garden', trees = 10, flowers = 5 } = {}) {
  let s = 7;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 1e9;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const W = 1000, H = 240;

  const layers = [
    { hill: `M0 ${H} L0 148 Q 120 116 260 136 T 520 126 T 780 140 T 1000 124 L1000 ${H} Z`, fill: 'var(--hill1)', tree: 'var(--htree1)', ridge: 136, hMin: 22, hMax: 36 },
    { hill: `M0 ${H} L0 180 Q 150 150 330 168 T 660 158 T 1000 170 L1000 ${H} Z`, fill: 'var(--hill2)', tree: 'var(--htree2)', ridge: 168, hMin: 20, hMax: 32 },
    { hill: `M0 ${H} L0 206 Q 200 184 430 198 T 1000 192 L1000 ${H} Z`, fill: 'var(--hill3)', tree: 'var(--htree3)', ridge: 200, hMin: 16, hMax: 28 },
  ];

  let out = `<rect width="${W}" height="${H}" fill="url(#bloomsky)"/>`;
  out += `<circle cx="872" cy="46" r="26" fill="var(--hsun)"/>`;
  out += `<circle cx="180" cy="38" r="12" fill="var(--hsun)" opacity="0.5"/>`;

  const perLayer = [Math.ceil(trees * 0.4), Math.ceil(trees * 0.33), Math.floor(trees * 0.27)];
  layers.forEach((L, li) => {
    out += `<path d="${L.hill}" fill="${L.fill}"/>`;
    for (let i = 0; i < perLayer[li]; i++) {
      const x = Math.round(24 + rnd() * (W - 48));
      const y = L.ridge + 12 + rnd() * 12;
      const h = L.hMin + rnd() * (L.hMax - L.hMin);
      const kind = rnd();
      if (kind < 0.46) out += pine(x, y, h, L.tree);
      else if (kind < 0.92) out += frond(x, y, h, L.tree);
      else out += bush(x, y, h * 0.32, L.tree);
    }
  });

  for (let i = 0; i < flowers; i++) {
    const x = Math.round(30 + rnd() * (W - 60));
    const y = 216 + rnd() * 16;
    out += `<circle cx="${x}" cy="${y.toFixed(1)}" r="2.6" fill="var(--hflower)"/><circle cx="${x}" cy="${y.toFixed(1)}" r="1" fill="var(--hsun)"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="your garden hills">
    <defs><linearGradient id="bloomsky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--hsky1)"/><stop offset="1" style="stop-color: var(--hsky2)"/>
    </linearGradient></defs>${out}</svg>`;
}

// Your real garden: every plant standing in the meadow, sized by its level.
// plants = [{ sk, level }]; each is clickable via .scene-plant[data-skill-id].
export function gardenSceneSVG(plants) {
  let s = 7;
  for (const p of plants) for (const ch of p.sk.id) s = (s * 31 + ch.charCodeAt(0)) % 1e9;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const W = 1000, H = 260;

  let out = `<rect width="${W}" height="${H}" fill="url(#bloomsky2)"/>`;
  out += `<circle cx="872" cy="46" r="26" fill="var(--hsun)"/>`;
  out += `<circle cx="180" cy="38" r="12" fill="var(--hsun)" opacity="0.5"/>`;

  // two back hill layers with a few trees for depth
  const back = [
    { hill: `M0 ${H} L0 150 Q 120 118 260 138 T 520 128 T 780 142 T 1000 126 L1000 ${H} Z`, fill: 'var(--hill1)', tree: 'var(--htree1)', ridge: 138 },
    { hill: `M0 ${H} L0 184 Q 150 154 330 172 T 660 162 T 1000 174 L1000 ${H} Z`, fill: 'var(--hill2)', tree: 'var(--htree2)', ridge: 172 },
  ];
  for (const L of back) {
    out += `<path d="${L.hill}" fill="${L.fill}"/>`;
    for (let i = 0; i < 4; i++) {
      const x = Math.round(24 + rnd() * (W - 48));
      const y = L.ridge + 10 + rnd() * 10;
      const h = 18 + rnd() * 14;
      out += pine(x, y, h, L.tree);
    }
  }
  // front meadow the plants stand on
  out += `<path d="M0 ${H} L0 218 Q 250 204 500 212 T 1000 208 L1000 ${H} Z" fill="var(--hill3)"/>`;

  // plants: tallest in the middle, fanned outward
  const sorted = [...plants].sort((a, b) => b.level - a.level);
  const order = [];
  sorted.forEach((p, i) => { if (i % 2 === 0) order.push(p); else order.unshift(p); });
  // huddle around the middle: cozy fixed spacing, only stretching when the row gets crowded
  const n = order.length;
  const gap = n > 1 ? Math.min(130, (W - 180) / (n - 1)) : 0;
  const startX = W / 2 - (gap * (n - 1)) / 2;
  let plantsOut = '';
  const footprints = []; // x-ranges the plants occupy, so flowers can steer clear
  order.forEach((p, i) => {
    const w = 58 + Math.min(p.level, 12) * 4;
    const h = w * 1.25;
    const x = startX + gap * i;
    const y = 240 + (rnd() * 10 - 5);
    footprints.push([x - w / 2 - 10, x + w / 2 + 10]);
    const inner = plantSVG(p.sk, p.level, w);
    plantsOut += `<g class="scene-plant" data-skill-id="${p.sk.id}" data-name="${esc(p.sk.name)}" data-level="${p.level}" transform="translate(${(x - w / 2).toFixed(1)},${(y - h).toFixed(1)})">
      <rect class="scene-hit" x="0" y="-8" width="${w}" height="${(h + 8).toFixed(1)}" fill="transparent"/>
      <g class="scene-lift">${inner}</g>
    </g>`;
  });

  // meadow flowers — placed BEFORE the plants (so plants sit on top) and kept out of plant footprints
  const clearOfPlants = (x) => footprints.every(([lo, hi]) => x < lo || x > hi);
  for (let i = 0, placed = 0, tries = 0; placed < Math.min(4 + n * 2, 14) && tries < 60; tries++) {
    const x = Math.round(30 + rnd() * (W - 60));
    if (!clearOfPlants(x)) continue;
    const y = 226 + rnd() * 24;
    out += `<circle cx="${x}" cy="${y.toFixed(1)}" r="2.6" fill="var(--hflower)"/><circle cx="${x}" cy="${y.toFixed(1)}" r="1" fill="var(--hsun)"/>`;
    placed++;
  }
  out += plantsOut;

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="your garden">
    <defs><linearGradient id="bloomsky2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--hsky1)"/><stop offset="1" style="stop-color: var(--hsky2)"/>
    </linearGradient></defs>${out}</svg>`;
}
