// charts.js — hand-rolled SVG bar chart + activity heatmap (strings, injected via html:).
import { fmtMin, fmtDateShort, addDays, todayYmd, fromYmd } from './util.js';

export function barChartSVG(values, labels, { h = 72, color = null, maxW = null } = {}) {
  const max = Math.max(...values, 30);
  const bw = 20, gap = 10;
  const W = values.length * (bw + gap) - gap;
  let bars = '';
  values.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 5 : 2.5, (v / max) * h);
    const x = i * (bw + gap);
    const y = h - bh;
    const fill = v > 0 ? (color || 'url(#barGrad)') : 'var(--track)';
    bars += `<g><title>${labels[i]} — ${fmtMin(v)}</title>
      <rect x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="6" fill="${fill}"/>
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
export function heatmapSVG(getMin, weeks = 14) {
  const cs = 13, gap = 3.5;
  const today = todayYmd();
  let start = addDays(today, -(weeks * 7 - 1));
  while (fromYmd(start).getDay() !== 1) start = addDays(start, -1);
  let cells = '';
  let i = 0, d = start;
  while (d <= today) {
    const col = Math.floor(i / 7), row = i % 7;
    const m = getMin(d);
    const lvl = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
    cells += `<rect x="${col * (cs + gap)}" y="${row * (cs + gap)}" width="${cs}" height="${cs}" class="h${lvl}"><title>${fmtDateShort(d)} — ${m ? fmtMin(m) : 'rest day'}</title></rect>`;
    i++;
    d = addDays(d, 1);
  }
  const cols = Math.ceil(i / 7);
  const W = cols * (cs + gap) - gap, H = 7 * (cs + gap) - gap;
  return `<svg viewBox="0 0 ${W} ${H}" class="hm" width="100%" style="max-width:${W * 1.6}px" role="img" aria-label="focus heatmap">${cells}</svg>`;
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
