// charts.js — hand-rolled SVG bar chart + activity heatmap (strings, injected via html:).
import { fmtMin, fmtDateShort, addDays, todayYmd, fromYmd } from './util.js';

export function barChartSVG(values, labels, { h = 72, color = null, maxW = null, titles = null } = {}) {
  const max = Math.max(...values, 30);
  const bw = 20, gap = 10;
  const W = values.length * (bw + gap) - gap;
  let bars = '';
  values.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 5 : 2.5, (v / max) * h);
    const x = i * (bw + gap);
    const y = h - bh;
    const fill = v > 0 ? (color || 'url(#barGrad)') : 'var(--track)';
    const tip = (titles && titles[i]) || labels[i];
    // full-height transparent hit rect so the whole column is hoverable, even empty days
    bars += `<g class="bar-col" data-tip="${tip}" data-min="${Math.round(v)}">
      <rect class="bar-hit" x="${x - gap / 2}" y="0" width="${bw + gap}" height="${h}" fill="transparent"/>
      <rect class="bar-rect" x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="6" fill="${fill}"/>
      <text x="${x + bw / 2}" y="${h + 13}" class="bar-label" text-anchor="middle">${labels[i]}</text></g>`;
  });
  // natural size capped — never stretches into giant blobs on wide cards
  const cap = maxW || Math.round(W * 1.35);
  return `<svg viewBox="0 0 ${W} ${h + 18}" class="bars" width="100%" style="max-width:${cap}px;margin:0 auto" role="img" aria-label="activity chart">
    <defs><linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#7C8B4F"/><stop offset="1" stop-color="#A3BC6E"/>
    </linearGradient></defs>${bars}</svg>`;
}

export function dayLabels7() {
  const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = fromYmd(addDays(todayYmd(), -i));
    out.push(i === 0 ? '★' : names[d.getDay()]);
  }
  return out;
}

// getMin(ymd) → minutes. Weeks × 7 grid, Monday-first, ends today.
// Month names along the top, M/W/F down the side, today ringed.
export function heatmapSVG(getMin, weeks = 14) {
  const cs = 13, gap = 3.5;
  const LEFT = 26, TOP = 15;
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = todayYmd();
  let start = addDays(today, -(weeks * 7 - 1));
  while (fromYmd(start).getDay() !== 1) start = addDays(start, -1);
  let cells = '', labels = '';
  const months = [{ x: LEFT, mo: fromYmd(start).getMonth() }];
  let i = 0, d = start, lastMonth = months[0].mo;
  while (d <= today) {
    const col = Math.floor(i / 7), row = i % 7;
    const x = LEFT + col * (cs + gap), y = TOP + row * (cs + gap);
    if (row === 0 && col > 0) {
      const mo = fromYmd(d).getMonth();
      if (mo !== lastMonth) { months.push({ x, mo }); lastMonth = mo; }
    }
    const m = getMin(d);
    const lvl = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
    cells += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" class="h${lvl}${d === today ? ' hm-today' : ''}" data-date="${d}" data-min="${m}"/>`;
    i++;
    d = addDays(d, 1);
  }
  if (months.length > 1 && months[1].x - months[0].x < 42) months.shift(); // avoid colliding labels at the left edge
  for (const m of months) labels += `<text x="${m.x}" y="${TOP - 5}" class="hm-lab">${MO[m.mo]}</text>`;
  for (const [row, name] of [[0, 'M'], [2, 'W'], [4, 'F']]) {
    labels += `<text x="${LEFT - 8}" y="${TOP + row * (cs + gap) + cs - 3}" class="hm-lab" text-anchor="middle">${name}</text>`;
  }
  const cols = Math.ceil(i / 7);
  // +2 so the today-ring stroke on the last column isn't clipped at the edge
  const W = LEFT + cols * (cs + gap) - gap + 2, H = TOP + 7 * (cs + gap) - gap + 2;
  return `<svg viewBox="0 0 ${W} ${H}" class="hm" width="100%" style="max-width:${W * 1.6}px" role="img" aria-label="focus heatmap">${labels}${cells}</svg>`;
}

export function heatmapLegend() {
  return `<div class="hm-legend">less
    <svg width="11" height="11" class="hm"><rect width="11" height="11" class="h0"/></svg>
    <svg width="11" height="11" class="hm"><rect width="11" height="11" class="h1"/></svg>
    <svg width="11" height="11" class="hm"><rect width="11" height="11" class="h2"/></svg>
    <svg width="11" height="11" class="hm"><rect width="11" height="11" class="h3"/></svg>
    <svg width="11" height="11" class="hm"><rect width="11" height="11" class="h4"/></svg>
  more</div>`;
}
