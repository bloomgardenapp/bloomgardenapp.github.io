// plant.js — chunky kawaii potted plants, five species, parametric by level.
// Every species shares the smiling pot; the green part grows from soil (60, 102).
import { shade } from './util.js';

function srand(seed) {
  let s = 7;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 1e9;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const R = (n) => Number(n.toFixed(1));
const CX = 60, SOIL = 102;

// ---- shared bits ----
function leaf(x, y, len, ang, hue, light) {
  const w = len * 0.58;
  const fill = `hsl(${hue}, 52%, ${light}%)`;
  const vein = `hsl(${hue}, 45%, ${light + 16}%)`;
  return `<g transform="rotate(${R(ang)} ${R(x)} ${R(y)})">
    <path d="M${R(x)} ${R(y)}
      C ${R(x + len * 0.18)} ${R(y - w * 0.75)}, ${R(x + len * 0.8)} ${R(y - w * 0.48)}, ${R(x + len)} ${R(y)}
      C ${R(x + len * 0.8)} ${R(y + w * 0.48)}, ${R(x + len * 0.18)} ${R(y + w * 0.75)}, ${R(x)} ${R(y)} Z" fill="${fill}"/>
    <path d="M${R(x + len * 0.15)} ${R(y)} L${R(x + len * 0.72)} ${R(y)}" stroke="${vein}" stroke-width="1.6" stroke-linecap="round"/>
  </g>`;
}

function flower(x, y, r, color) {
  let petals = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const px = x + Math.cos(a) * r * 0.95, py = y + Math.sin(a) * r * 0.95;
    petals += `<circle cx="${R(px)}" cy="${R(py)}" r="${R(r * 0.62)}" fill="${color}" stroke="${shade(color, -14)}" stroke-width="1"/>`;
  }
  return `<g>${petals}
    <circle cx="${R(x)}" cy="${R(y)}" r="${R(r * 0.52)}" fill="#FFD45E" stroke="#E3A93C" stroke-width="1.2"/>
    <circle cx="${R(x - r * 0.16)}" cy="${R(y - r * 0.18)}" r="${R(r * 0.14)}" fill="#FFF3CE"/>
  </g>`;
}

function bud(x, y, r, c) {
  return `<g>
    <circle cx="${R(x)}" cy="${R(y)}" r="${R(r)}" fill="${c}" stroke="${shade(c, -18)}" stroke-width="1.4"/>
    <circle cx="${R(x - r * 0.3)}" cy="${R(y - r * 0.32)}" r="${R(r * 0.26)}" fill="rgba(255,255,255,0.55)"/>
  </g>`;
}

function sparkle(x, y, r) {
  return `<path d="M${R(x)} ${R(y - r)} Q${R(x + r * 0.18)} ${R(y - r * 0.18)} ${R(x + r)} ${R(y)} Q${R(x + r * 0.18)} ${R(y + r * 0.18)} ${R(x)} ${R(y + r)} Q${R(x - r * 0.18)} ${R(y + r * 0.18)} ${R(x - r)} ${R(y)} Q${R(x - r * 0.18)} ${R(y - r * 0.18)} ${R(x)} ${R(y - r)} Z" fill="#FFD45E"/>`;
}

function sparkles(topX, topY, L) {
  if (L < 12) return '';
  return sparkle(topX - 21, topY + 2, 3.4) + sparkle(topX + 19, topY - 6, 2.8) + sparkle(topX + 3, topY - 18, 3.8);
}

// ---- species: classic bloom (leafy stem → flower) ----
function drawBloom(L, c, rnd) {
  let g = '';
  const h = L === 1 ? 9 : Math.min(14 + L * 5.2, 76);
  const lean = (rnd() - 0.5) * 5;
  const topX = CX + lean, topY = SOIL - h;
  const stemCol = '#4AA365';

  if (L >= 2) {
    g += `<path d="M${CX} ${SOIL} C ${CX} ${R(SOIL - h * 0.45)}, ${R(topX)} ${R(SOIL - h * 0.6)}, ${R(topX)} ${R(topY)}" fill="none" stroke="${stemCol}" stroke-width="${L >= 7 ? 6 : 5}" stroke-linecap="round"/>`;
  }
  if (L >= 9) {
    const sy = SOIL - h * 0.52;
    g += `<path d="M${R(CX - 1)} ${R(sy)} Q ${R(CX - 13)} ${R(sy - 6)} ${R(CX - 19)} ${R(sy - 13)}" fill="none" stroke="${stemCol}" stroke-width="4" stroke-linecap="round"/>`;
    g += flower(CX - 19, sy - 15, 6.4, c);
  }
  if (L >= 10) {
    const sy = SOIL - h * 0.34;
    g += `<path d="M${R(CX + 1)} ${R(sy)} Q ${R(CX + 13)} ${R(sy - 4)} ${R(CX + 19)} ${R(sy - 10)}" fill="none" stroke="${stemCol}" stroke-width="4" stroke-linecap="round"/>`;
    g += flower(CX + 19, sy - 12, 5.6, c);
  }
  if (L === 1) {
    g += `<path d="M${CX} ${SOIL} L${CX} ${SOIL - 9}" stroke="${stemCol}" stroke-width="4.5" stroke-linecap="round"/>`;
    g += leaf(CX, SOIL - 8, 13, -142, 103, 44);
    g += leaf(CX, SOIL - 8, 13, -38, 112, 40);
  } else {
    const pairs = Math.min(1 + Math.floor(L / 2.6), 4);
    for (let i = 0; i < pairs; i++) {
      const t = 0.78 - i * 0.2;
      const y = SOIL - h * t;
      const x = CX + lean * (1 - t) * 0.6;
      const len = Math.min(12 + L * 1.15, 24) * (1 - i * 0.12);
      g += leaf(x, y, len, 180 + 22 + rnd() * 10, 100 + rnd() * 18, 42 + rnd() * 6);
      g += leaf(x, y, len, -(22 + rnd() * 10), 100 + rnd() * 18, 42 + rnd() * 6);
    }
  }
  if (L >= 3 && L < 7) g += bud(topX, topY - 2, 4.2 + (L - 3) * 1.1, c);
  if (L >= 7) g += flower(topX, topY - 3, 8 + (L - 7) * 0.9, c);
  g += sparkles(topX, topY, L);
  return g;
}

// ---- species: cactus (chubby column, arms, desert flower) ----
function drawCactus(L, c, rnd) {
  let g = '';
  const green = '#74A876', dark = '#5F9161';
  const h = Math.min(12 + L * 5, 66);
  const w = 15 + Math.min(L * 0.9, 7);
  const top = SOIL - h;

  if (L === 1) {
    g += `<ellipse cx="${CX}" cy="${SOIL - 6}" rx="8.5" ry="8" fill="${green}"/>`;
    g += `<path d="M${CX - 3} ${SOIL - 9} v3M${CX + 3} ${SOIL - 10} v3" stroke="${dark}" stroke-width="1.4" stroke-linecap="round"/>`;
    return g;
  }
  // body
  g += `<rect x="${R(CX - w / 2)}" y="${R(top)}" width="${R(w)}" height="${R(h + 4)}" rx="${R(w / 2)}" fill="${green}"/>`;
  g += `<path d="M${CX} ${R(top + 5)} V${SOIL}M${R(CX - w / 4)} ${R(top + 8)} V${SOIL}M${R(CX + w / 4)} ${R(top + 8)} V${SOIL}" stroke="${dark}" stroke-width="1.5" stroke-linecap="round"/>`;
  // freckle spines
  for (let i = 0; i < Math.min(L * 2, 14); i++) {
    const sx = CX - w / 2 + 3 + rnd() * (w - 6);
    const sy = top + 6 + rnd() * (h - 8);
    g += `<circle cx="${R(sx)}" cy="${R(sy)}" r="0.9" fill="#EAF2DC"/>`;
  }
  // arms
  if (L >= 4) {
    const ay = top + h * 0.42;
    g += `<path d="M${R(CX - w / 2)} ${R(ay + 4)} h-8 a5 5 0 0 1 -5 -5 v-9" fill="none" stroke="${green}" stroke-width="9" stroke-linecap="round"/>`;
  }
  if (L >= 7) {
    const ay = top + h * 0.24;
    g += `<path d="M${R(CX + w / 2)} ${R(ay + 4)} h7 a5 5 0 0 0 5 -5 v-11" fill="none" stroke="${green}" stroke-width="9" stroke-linecap="round"/>`;
  }
  if (L >= 5 && L < 8) g += bud(CX, top - 2, 3.6 + (L - 5), c);
  if (L >= 8) g += flower(CX, top - 4, 6.5 + (L - 8) * 0.8, c);
  g += sparkles(CX, top, L);
  return g;
}

// ---- species: fern (arching fronds with leaflets) ----
function frond(x0, y0, ang, len, hue, light) {
  // arching stem with leaflets either side
  const rad = (ang * Math.PI) / 180;
  const tipX = x0 + Math.cos(rad) * len;
  const tipY = y0 - Math.sin(rad) * len;
  const ctrlX = x0 + Math.cos(rad) * len * 0.5 - Math.sin(rad) * len * 0.22;
  const ctrlY = y0 - Math.sin(rad) * len * 0.5 - Math.cos(rad) * len * 0.22;
  const col = `hsl(${hue}, 46%, ${light}%)`;
  let g = `<path d="M${R(x0)} ${R(y0)} Q ${R(ctrlX)} ${R(ctrlY)} ${R(tipX)} ${R(tipY)}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
  for (let t = 0.2; t < 0.95; t += 0.14) {
    // point on the quadratic
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * ctrlX + t * t * tipX;
    const py = mt * mt * y0 + 2 * mt * t * ctrlY + t * t * tipY;
    const ll = 6.5 * (1 - t * 0.72);
    g += `<path d="M${R(px)} ${R(py)} l${R(-ll * 0.8)} ${R(-ll * 0.6)}M${R(px)} ${R(py)} l${R(ll * 0.8)} ${R(-ll * 0.5)}" stroke="${col}" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  return g;
}
function drawFern(L, c, rnd) {
  let g = '';
  const n = Math.min(2 + L, 11);
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 90 : 38 + (i / (n - 1)) * 104; // 38°..142°
    const len = Math.min(16 + L * 4.2, 62) * (0.62 + rnd() * 0.38);
    g += frond(CX, SOIL, spread, len, 100 + rnd() * 24, 34 + rnd() * 10);
  }
  if (L >= 9) {
    // a young curled fiddlehead
    g += `<path d="M${R(CX + 4)} ${SOIL} q2 -14 8 -18 a5 5 0 1 1 4 6" fill="none" stroke="#7FB268" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  if (L >= 11) g += bud(CX - 14, SOIL - Math.min(16 + L * 4.2, 62) * 0.72, 3.4, c);
  g += sparkles(CX, SOIL - Math.min(16 + L * 4.2, 62), L);
  return g;
}

// ---- species: bonsai (S-curve trunk, foliage clouds, blossoms) ----
function drawBonsai(L, c, rnd) {
  let g = '';
  const h = Math.min(12 + L * 4.2, 58);
  const trunk = '#8A6844';
  const top = SOIL - h;
  g += `<path d="M${CX} ${SOIL} C ${R(CX - 9)} ${R(SOIL - h * 0.35)}, ${R(CX + 11)} ${R(SOIL - h * 0.55)}, ${R(CX + 2)} ${R(top + 6)}" fill="none" stroke="${trunk}" stroke-width="${5 + Math.min(L * 0.3, 2.4)}" stroke-linecap="round"/>`;
  if (L >= 5) g += `<path d="M${R(CX + 2)} ${R(SOIL - h * 0.55)} q-12 -3 -18 -9" fill="none" stroke="${trunk}" stroke-width="4" stroke-linecap="round"/>`;
  const cloud = (x, y, r, tone) => {
    let out = '';
    out += `<ellipse cx="${R(x)}" cy="${R(y)}" rx="${R(r)}" ry="${R(r * 0.62)}" fill="${tone}"/>`;
    out += `<ellipse cx="${R(x - r * 0.55)}" cy="${R(y + r * 0.18)}" rx="${R(r * 0.6)}" ry="${R(r * 0.42)}" fill="${tone}"/>`;
    out += `<ellipse cx="${R(x + r * 0.55)}" cy="${R(y + r * 0.2)}" rx="${R(r * 0.62)}" ry="${R(r * 0.44)}" fill="${tone}"/>`;
    out += `<ellipse cx="${R(x - r * 0.2)}" cy="${R(y - r * 0.28)}" rx="${R(r * 0.5)}" ry="${R(r * 0.36)}" fill="#5E8C54"/>`;
    return out;
  };
  const clouds = Math.min(1 + Math.floor(L / 3), 4);
  const spots = [
    [CX + 2, top + 2, 13 + Math.min(L, 6)],
    [CX - 17, SOIL - h * 0.62, 9 + Math.min(L * 0.6, 4)],
    [CX + 17, SOIL - h * 0.78, 8.5 + Math.min(L * 0.5, 4)],
    [CX - 8, top + 10, 7.5],
  ];
  for (let i = 0; i < clouds; i++) g += cloud(spots[i][0], spots[i][1], spots[i][2], '#4E7A46');
  if (L >= 8) {
    for (let i = 0; i < Math.min(3 + L - 8, 7); i++) {
      const sp = spots[i % clouds];
      g += `<circle cx="${R(sp[0] - sp[2] * 0.7 + rnd() * sp[2] * 1.4)}" cy="${R(sp[1] - 2 + rnd() * 5)}" r="1.7" fill="${shade(c, 26)}" stroke="${shade(c, -6)}" stroke-width="0.6"/>`;
    }
  }
  g += sparkles(CX + 2, top, L);
  return g;
}

// ---- species: sunflower (tall stem, giant golden head) ----
function drawSunflower(L, c, rnd) {
  let g = '';
  const h = Math.min(16 + L * 5.8, 82);
  const lean = (rnd() - 0.5) * 4;
  const topX = CX + lean, topY = SOIL - h;
  const stemCol = '#4E9159';
  g += `<path d="M${CX} ${SOIL} C ${CX} ${R(SOIL - h * 0.5)}, ${R(topX)} ${R(SOIL - h * 0.65)}, ${R(topX)} ${R(topY + 4)}" fill="none" stroke="${stemCol}" stroke-width="${L >= 6 ? 5.5 : 4.5}" stroke-linecap="round"/>`;
  const pairs = Math.min(1 + Math.floor(L / 3.5), 3);
  for (let i = 0; i < pairs; i++) {
    const t = 0.62 - i * 0.22;
    const y = SOIL - h * t;
    const len = Math.min(13 + L * 1.2, 25) * (1 - i * 0.15);
    g += leaf(CX, y, len, 180 + 26, 105, 40);
    g += leaf(CX, y, len, -26, 112, 43);
  }
  if (L < 4) {
    g += bud(topX, topY, 4 + L, '#7FB268');
  } else {
    const r = L < 7 ? 5 + L : Math.min(10 + (L - 7) * 1.5, 17);
    const petals = L < 7 ? 8 : 12;
    let ring = '';
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const px = topX + Math.cos(a) * r, py = topY + Math.sin(a) * r;
      ring += `<ellipse cx="${R(px)}" cy="${R(py)}" rx="${R(r * 0.52)}" ry="${R(r * 0.26)}" fill="#EDB93E" stroke="#D69E2B" stroke-width="0.8" transform="rotate(${R((a * 180) / Math.PI)} ${R(px)} ${R(py)})"/>`;
    }
    g += ring;
    g += `<circle cx="${R(topX)}" cy="${R(topY)}" r="${R(r * 0.62)}" fill="#7A5238" stroke="#5E3E2A" stroke-width="1.2"/>`;
    for (let i = 0; i < Math.min(L, 9); i++) {
      g += `<circle cx="${R(topX - r * 0.34 + rnd() * r * 0.68)}" cy="${R(topY - r * 0.3 + rnd() * r * 0.6)}" r="1" fill="#5E3E2A"/>`;
    }
  }
  if (L >= 11) g += flower(CX - 18, SOIL - h * 0.4, 5, c);
  g += sparkles(topX, topY, L);
  return g;
}

export const SPECIES = {
  bloom: { label: 'Bloom', draw: drawBloom },
  sunflower: { label: 'Sunflower', draw: drawSunflower },
  cactus: { label: 'Cactus', draw: drawCactus },
  fern: { label: 'Fern', draw: drawFern },
  bonsai: { label: 'Bonsai', draw: drawBonsai },
};

// level 1 = sprout … level 12+ = full glory
export function plantSVG(skill, level, size = 96) {
  const c = skill.color || '#9B7DF2';
  const rnd = srand((skill.id || skill.name || 'seed') + (skill.species || ''));
  const L = Math.max(1, Math.min(level, 12));
  const draw = (SPECIES[skill.species] || SPECIES.bloom).draw;

  const green = `<g class="sway">${draw(L, c, rnd)}</g>`;

  const potTop = SOIL + 4;
  // svg ids are document-global — bake the colour in so a recoloured preview never
  // resolves to a stale same-id gradient rendered elsewhere on the page
  const gid = 'pg' + ((skill.id || 'x') + c).replace(/[^a-z0-9]/gi, '');
  const pot = `
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(c, 12)}"/>
        <stop offset="1" stop-color="${shade(c, -16)}"/>
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="${SOIL + 1}" rx="17" ry="4" fill="#7A5A40"/>
    <circle cx="54" cy="${SOIL + 2}" r="1.1" fill="#5E4430"/>
    <circle cx="66" cy="${SOIL + 1}" r="1" fill="#5E4430"/>
    <path d="M42 ${potTop + 7} L45 ${potTop + 30} Q45 ${potTop + 34} 51 ${potTop + 34} L69 ${potTop + 34} Q75 ${potTop + 34} 75 ${potTop + 30} L78 ${potTop + 7} Z" fill="url(#${gid})"/>
    <ellipse cx="51" cy="${potTop + 14}" rx="4" ry="7" fill="rgba(255,255,255,0.28)" transform="rotate(-8 51 ${potTop + 14})"/>
    <rect x="38" y="${potTop - 3}" width="44" height="11" rx="5.5" fill="${shade(c, -8)}"/>
    <rect x="38" y="${potTop - 3}" width="44" height="5" rx="2.5" fill="${shade(c, 18)}" opacity="0.55"/>
    <circle cx="53.5" cy="${potTop + 18}" r="2" fill="rgba(58,66,44,0.66)"/>
    <circle cx="66.5" cy="${potTop + 18}" r="2" fill="rgba(58,66,44,0.66)"/>
    <path d="M56 ${potTop + 23} Q60 ${potTop + 26.5} 64 ${potTop + 23}" fill="none" stroke="rgba(58,66,44,0.66)" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="48.5" cy="${potTop + 21}" r="2.4" fill="rgba(217,146,120,0.45)"/>
    <circle cx="71.5" cy="${potTop + 21}" r="2.4" fill="rgba(217,146,120,0.45)"/>
  `;

  return `<svg viewBox="0 0 120 150" width="${size}" height="${Math.round(size * 1.25)}" class="plant" aria-hidden="true">
    <ellipse cx="60" cy="145" rx="26" ry="4" fill="rgba(46,67,105,0.10)"/>
    ${green}
    ${pot}
  </svg>`;
}
