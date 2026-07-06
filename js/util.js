// util.js — dates, formatting, DOM helper, quick-log parser. Pure, no app state.

export const pad2 = (n) => String(n).padStart(2, '0');

// Local dates only — never toISOString() (UTC shifts the day).
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayYmd = () => ymd(new Date());
export const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const dayDiff = (a, b) => Math.round((fromYmd(b) - fromYmd(a)) / 86400000);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fmtDate = (s) => { const d = fromYmd(s); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
export const fmtDateShort = (s) => { const d = fromYmd(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
export const fmtLongDate = (s) => {
  const d = fromYmd(s);
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${names[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
export const fmtMonth = (y, m) => `${MONTHS[m]} ${y}`;

export const fmtMin = (min) => {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
export const fmtClock = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
};
export const relDue = (s) => {
  const diff = dayDiff(todayYmd(), s);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return '1 day late';
  if (diff < 0) return `${-diff} days late`;
  if (diff < 7) return fmtDate(s).split(', ')[0]; // weekday name
  return fmtDateShort(s);
};
export const relTime = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDateShort(ymd(new Date(iso)));
};

// DOM builder: el('div', {class: 'card', onClick: fn}, child1, child2…)
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// XP → level. Each level costs min(60·level, 900) XP; 1 focused minute = 1 XP.
export function levelForXp(xp) {
  let level = 1, into = Math.max(0, Math.round(xp)), need = 60;
  while (into >= need && level < 99) { into -= need; level++; need = Math.min(60 * level, 900); }
  return { level, into, need };
}

// "1h math", "45m spanish yesterday", "1h 30m piano 2026-07-01" → {minutes, date, name, skill}
const FILLERS = new Set(['of', 'on', 'for', 'doing', 'i', 'did', 'me', 'my', 'a', 'an', 'the', 'spent', 'practicing', 'practiced', 'studying', 'studied', 'was', 'been', 'just']);
export function parseQuickLog(text, skills) {
  let t = ' ' + (text || '').trim().toLowerCase() + ' ';
  if (!t.trim()) return null;
  let date = todayYmd();
  if (/\byesterday\b/.test(t)) { date = addDays(date, -1); t = t.replace(/\byesterday\b/g, ' '); }
  t = t.replace(/\btoday\b/g, ' ');
  const dm = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dm) { date = dm[1]; t = t.replace(dm[1], ' '); }
  let minutes = 0;
  t = t.replace(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/g, (_, n) => { minutes += Math.round(parseFloat(n) * 60); return ' '; });
  t = t.replace(/(\d+)\s*m(?:in(?:ute)?s?)?\b/g, (_, n) => { minutes += parseInt(n, 10); return ' '; });
  if (!minutes || minutes > 24 * 60) return null;
  const name = t.split(/\s+/).filter((w) => w && !FILLERS.has(w)).join(' ').trim();
  if (!name) return null;
  const pretty = name.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const lower = name.toLowerCase();
  const skill =
    skills.find((s) => s.name.toLowerCase() === lower) ||
    skills.find((s) => s.name.toLowerCase().startsWith(lower) || lower.startsWith(s.name.toLowerCase()));
  return { minutes, date, name: pretty, skill };
}

// ---- recurrence ----
export function nextOccurrence(date, repeat) {
  if (repeat === 'daily') return addDays(date, 1);
  if (repeat === 'weekly') return addDays(date, 7);
  if (repeat === 'monthly') {
    const d = fromYmd(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== day) d.setDate(0); // clamp to end of shorter month
    return ymd(d);
  }
  return date;
}

export function eventOccursOn(ev, date) {
  if (ev.except && ev.except.includes(date)) return false;
  if (!ev.repeat) return ev.date === date;
  if (date < ev.date) return false;
  if (ev.repeat === 'daily') return true;
  if (ev.repeat === 'weekly') return fromYmd(date).getDay() === fromYmd(ev.date).getDay();
  if (ev.repeat === 'monthly') return date.slice(8) === ev.date.slice(8);
  return false;
}

export function guessEmoji(name) {
  const n = name.toLowerCase();
  const map = [
    [/math|calc|algebra|geometr|trig/, '📐'],
    [/read|book|novel/, '📚'],
    [/code|coding|program|dev|python|javascript|swift/, '💻'],
    [/spanish|french|language|english|japanese|korean|chinese|german|italian/, '🗣️'],
    [/piano|keyboard/, '🎹'],
    [/guitar|ukulele/, '🎸'],
    [/music|sing|voice|violin|drum/, '🎵'],
    [/gym|workout|lift|fitness|exercise/, '💪'],
    [/run|jog|cardio/, '🏃‍♀️'],
    [/yoga|stretch|meditat/, '🧘‍♀️'],
    [/art|draw|paint|sketch|design/, '🎨'],
    [/write|writing|journal|essay|blog/, '✍️'],
    [/science|physics|chem|bio|lab/, '🔬'],
    [/study|school|exam|homework|class|course/, '🎓'],
    [/cook|bake|recipe/, '🍳'],
    [/game|unity|phaser|godot/, '🎮'],
    [/business|shop|store|dropship|marketing/, '💼'],
    [/video|edit|youtube|film|short/, '🎬'],
    [/dance|ballet/, '💃'],
    [/swim/, '🏊‍♀️'],
    [/chess/, '♟️'],
    [/photo/, '📷'],
  ];
  for (const [re, e] of map) if (re.test(n)) return e;
  return '🌿';
}
