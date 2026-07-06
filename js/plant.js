// plant.js — chunky kawaii potted plant, parametric by level. Deterministic per skill id.
import { shade } from './util.js';

function srand(seed) {
  let s = 7;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 1e9;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const R = (n) => Number(n.toFixed(1));

// plump teardrop leaf with a vein, growing outward from (x,y)
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

function flower(x, y, r, c) {
  let petals = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const px = x + Math.cos(a) * r * 0.95, py = y + Math.sin(a) * r * 0.95;
    petals += `<circle cx="${R(px)}" cy="${R(py)}" r="${R(r * 0.62)}" fill="${c}" stroke="${shade(c, -14)}" stroke-width="1"/>`;
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

// level 1 = sprout … 12 = full bloom
export function plantSVG(skill, level, size = 96) {
  const c = skill.color || '#9B7DF2';
  const rnd = srand(skill.id || skill.name || 'seed');
  const L = Math.max(1, Math.min(level, 12));
  const cx = 60, soilY = 102;
  const lean = (rnd() - 0.5) * 5;
  const stemCol = '#5F8B50';
  const gid = 'pg' + (skill.id || 'x').replace(/[^a-z0-9]/gi, '');

  let g = `<g class="sway">`;

  // --- stem ---
  const h = L === 1 ? 9 : Math.min(14 + L * 5.2, 76);
  const topX = cx + lean, topY = soilY - h;
  if (L >= 2) {
    g += `<path d="M${cx} ${soilY} C ${cx} ${R(soilY - h * 0.45)}, ${R(topX)} ${R(soilY - h * 0.6)}, ${R(topX)} ${R(topY)}" fill="none" stroke="${stemCol}" stroke-width="${L >= 7 ? 6 : 5}" stroke-linecap="round"/>`;
  }

  // --- side stems with mini flowers (high levels) ---
  if (L >= 9) {
    const sy = soilY - h * 0.52;
    g += `<path d="M${R(cx - 1)} ${R(sy)} Q ${R(cx - 13)} ${R(sy - 6)} ${R(cx - 19)} ${R(sy - 13)}" fill="none" stroke="${stemCol}" stroke-width="4" stroke-linecap="round"/>`;
    g += flower(cx - 19, sy - 15, 6.4, c);
  }
  if (L >= 10) {
    const sy = soilY - h * 0.34;
    g += `<path d="M${R(cx + 1)} ${R(sy)} Q ${R(cx + 13)} ${R(sy - 4)} ${R(cx + 19)} ${R(sy - 10)}" fill="none" stroke="${stemCol}" stroke-width="4" stroke-linecap="round"/>`;
    g += flower(cx + 19, sy - 12, 5.6, c);
  }

  // --- leaves: symmetric plump pairs along the stem ---
  if (L === 1) {
    // sprout: two chunky baby leaves + tiny stem
    g += `<path d="M${cx} ${soilY} L${cx} ${soilY - 9}" stroke="${stemCol}" stroke-width="4.5" stroke-linecap="round"/>`;
    g += leaf(cx, soilY - 8, 13, -142, 103, 44);
    g += leaf(cx, soilY - 8, 13, -38, 112, 40);
  } else {
    const pairs = Math.min(1 + Math.floor(L / 2.6), 4);
    for (let i = 0; i < pairs; i++) {
      const t = 0.78 - i * 0.2;
      const y = soilY - h * t;
      const x = cx + lean * (1 - t) * 0.6;
      const len = Math.min(12 + L * 1.15, 24) * (1 - i * 0.12);
      const hueL = 98 + rnd() * 18, hueR = 98 + rnd() * 18;
      const upL = 22 + rnd() * 10, upR = 22 + rnd() * 10;
      g += leaf(x, y, len, 180 + upL, hueL, 40 + rnd() * 7);   // left, tilted up
      g += leaf(x, y, len, -upR, hueR, 40 + rnd() * 7);        // right, tilted up
    }
  }

  // --- crown: bud → flower ---
  if (L >= 3 && L < 7) g += bud(topX, topY - 2, 4.2 + (L - 3) * 1.1, c);
  if (L >= 7) g += flower(topX, topY - 3, 8 + (L - 7) * 0.9, c);
  if (L >= 12) {
    g += sparkle(topX - 21, topY + 2, 3.4);
    g += sparkle(topX + 19, topY - 6, 2.8);
    g += sparkle(topX + 3, topY - 18, 3.8);
  }
  g += `</g>`;

  // --- pot: rounded, glossy, with a little face ---
  const potTop = soilY + 2, potBot = 140;
  const pot = `
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(c, 12)}"/>
        <stop offset="1" stop-color="${shade(c, -16)}"/>
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="${soilY}" rx="17" ry="4" fill="#7A5A40"/>
    <circle cx="54" cy="${soilY + 1}" r="1.1" fill="#5E4430"/>
    <circle cx="66" cy="${soilY}" r="1" fill="#5E4430"/>
    <path d="M42 ${potTop + 7} L45 ${potBot - 4} Q45 ${potBot} 51 ${potBot} L69 ${potBot} Q75 ${potBot} 75 ${potBot - 4} L78 ${potTop + 7} Z" fill="url(#${gid})"/>
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
    <ellipse cx="60" cy="143" rx="26" ry="4" fill="rgba(46,67,105,0.10)"/>
    ${g}
    ${pot}
  </svg>`;
}
