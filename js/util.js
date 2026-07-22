// util.js — dates, formatting, DOM helper, quick-log parser. Pure, no app state.

export const pad2 = (n) => String(n).padStart(2, '0');

// Local dates only — never toISOString() (UTC shifts the day).
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayYmd = () => ymd(new Date());
export const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const dayDiff = (a, b) => Math.round((fromYmd(b) - fromYmd(a)) / 86400000);
export const weekStart = (s = todayYmd()) => addDays(s, -((fromYmd(s).getDay() + 6) % 7)); // Monday of that week

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
export const fmtTime = (hhmm, h24 = false) => {
  if (!hhmm) return '';
  if (h24) return hhmm;
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${pad2(m)} ${ap}`;
};
// "7pm" / "7:30 pm" / "19:30" → "HH:MM". null = blank (all-day), undefined = can't parse.
export function parseTimeInput(str) {
  const t = (str || '').trim().toLowerCase();
  if (!t) return null;
  // separator optional: "1030" and "930pm" are still times — blur rewrites them prettily
  const m = t.match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm|a|p)?\.?$/);
  if (!m) return undefined;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = m[3];
  if (min > 59) return undefined;
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    if (ap.startsWith('p') && h !== 12) h += 12;
    if (ap.startsWith('a') && h === 12) h = 0;
  } else if (h > 23) return undefined;
  return `${pad2(h)}:${pad2(min)}`;
}
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
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) node.style.setProperty(sk, sv); // custom props need setProperty
        else node.style[sk] = sv;
      }
    }
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
  // 1.5h to level 2, then +1.5h per level (3h, 4.5h, …) capped at 20h a level
  let level = 1, into = Math.max(0, Math.round(xp)), need = 90;
  while (into >= need && level < 99) { into -= need; level++; need = Math.min(90 * level, 1200); }
  return { level, into, need };
}

// "1h math", "45m spanish yesterday", "1h 30m piano 2026-07-01" → {minutes, date, name, skill}
// opts.skill: a chosen plant to log against — then the name in the text is optional.
const FILLERS = new Set(['of', 'on', 'for', 'doing', 'i', 'did', 'me', 'my', 'a', 'an', 'the', 'spent', 'practicing', 'practiced', 'studying', 'studied', 'was', 'been', 'just']);
export function parseQuickLog(text, skills, opts = {}) {
  const forced = opts.skill || null;
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
  if (forced) return { minutes, date, name: forced.name, skill: forced };
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
  if (ev.until && date > ev.until) return false; // series ended ("this and following" removals)
  if (ev.repeat === 'daily') return true;
  if (ev.repeat === 'weekly') return fromYmd(date).getDay() === fromYmd(ev.date).getDay();
  if (ev.repeat === 'monthly') return date.slice(8) === ev.date.slice(8);
  if (ev.repeat === 'days') return Array.isArray(ev.days) && ev.days.includes(fromYmd(date).getDay());
  return false;
}

// human-readable recurrence: 'daily' / 'weekly' / 'monthly' / 'Tue, Thu' / 'weekdays'
export function repeatLabel(ev) {
  if (ev.repeat !== 'days') return ev.repeat || '';
  const d = [...(ev.days || [])].sort((a, b) => a - b);
  if (d.length === 7) return 'daily';
  if (d.length === 5 && d.every((x) => x >= 1 && x <= 5)) return 'weekdays';
  if (d.length === 2 && d.includes(0) && d.includes(6)) return 'weekends';
  return d.map((x) => DAYS[x]).join(', ');
}

export function guessIcon(name) {
  const n = name.toLowerCase();
  const map = [
    [/math|calc|algebra|geometr|trig|physic/, 'calc'],
    [/read|book|novel|liter/, 'book'],
    [/code|coding|program|dev|python|javascript|swift/, 'code'],
    [/spanish|french|language|english|japanese|korean|chinese|german|italian/, 'globe'],
    [/piano|keyboard|guitar|ukulele|music|sing|voice|violin|drum/, 'music'],
    [/gym|workout|lift|fitness|exercise/, 'dumbbell'],
    [/run|jog|cardio|swim|soccer|basket|tennis|sport/, 'ball'],
    [/yoga|stretch|meditat|journal.*grat|selfcare|self-care/, 'heart'],
    [/art|draw|paint|sketch|design/, 'palette'],
    [/write|writing|journal|essay|blog/, 'pencil'],
    [/science|chem|bio|lab/, 'flask'],
    [/study|school|exam|homework|class|course/, 'cap'],
    [/cook|bake|recipe/, 'pan'],
    [/game|unity|phaser|godot/, 'gamepad'],
    [/business|shop|store|dropship|marketing/, 'briefcase'],
    [/video|edit|youtube|film|short/, 'film'],
    [/dance|ballet|perform/, 'star'],
    [/chess|strateg|aim|goal/, 'target'],
    [/photo|camera/, 'camera'],
    [/talk|speech|debate/, 'chat'],
  ];
  for (const [re, icon] of map) if (re.test(n)) return icon;
  return 'sprout';
}
