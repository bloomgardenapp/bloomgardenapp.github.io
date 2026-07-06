// main.js — boot, sidebar, router, theme, settings, onboarding, global timer tick.
import { el, fmtClock, todayYmd, levelForXp, parseQuickLog } from './util.js';
import { store } from './store.js';
import { toast, openModal, confirmDialog } from './ui.js';
import { sfx, RINGERS, playRinger } from './audio.js';
import { streak, logSession } from './progress.js';
import { ic, svgStr } from './icons.js';
import { openGuide } from './guide.js';
import { plantSVG } from './plant.js';
import * as today from './views/today.js';
import * as tasks from './views/tasks.js';
import * as calendar from './views/calendar.js';
import * as notes from './views/notes.js';
import * as focus from './views/focus.js';
import * as garden from './views/garden.js';
import { checkTimer, timerRemaining, toggleZen } from './views/focus.js';

const VIEWS = { today, tasks, calendar, notes, focus, garden };
const NAV = [
  ['today', 'sun', 'Today'],
  ['tasks', 'check-square', 'Tasks'],
  ['calendar', 'calendar', 'Calendar'],
  ['notes', 'note', 'Notes'],
  ['focus', 'hourglass', 'Focus'],
  ['garden', 'sprout', 'Garden'],
];

let currentView = null;
let timerChip, streakEl, themeBtn;
const viewEl = document.getElementById('view');

// ---------- theme (cream by default; night forest is opt-in) ----------
function applyTheme() {
  const dark = store.state.settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (themeBtn) themeBtn.innerHTML = svgStr(dark ? 'moon' : 'sun', 16);
}

function cycleTheme() {
  store.state.settings.theme = store.state.settings.theme === 'dark' ? 'light' : 'dark';
  store.save(true);
  applyTheme();
  sfx.click();
  toast(store.state.settings.theme === 'dark' ? 'Night garden' : 'Day garden', store.state.settings.theme === 'dark' ? '🌙' : '☀️');
}

// ---------- settings ----------
function openSettings() {
  const s = store.state.settings;
  const nameIn = el('input', { class: 'input', value: s.name, placeholder: 'Your name', maxlength: 24, onInput: (e) => { s.name = e.target.value.trim(); store.save(true); } });

  const themeRow = el('div', { class: 'row gap' });
  const themeChips = ['light', 'dark'].map((m) => el('button', {
    class: 'chip chip-btn' + (s.theme === m ? ' sel' : ''),
    onClick: () => { s.theme = m; store.save(true); applyTheme(); themeChips.forEach((c) => c.classList.toggle('sel', c.textContent.includes(m))); },
  }, ic(m === 'light' ? 'sun' : 'moon', { size: 12 }), ' ' + m));
  themeRow.append(...themeChips);

  const soundLabel = () => (s.sound ? ' sound on' : ' sound off');
  const soundChip = el('button', {
    class: 'chip chip-btn' + (s.sound ? ' sel' : ''),
    onClick: () => {
      s.sound = !s.sound;
      store.save(true);
      soundChip.classList.toggle('sel', s.sound);
      soundChip.replaceChildren(ic(s.sound ? 'bell' : 'bell-off', { size: 12 }), soundLabel());
      sfx.pop();
    },
  }, ic(s.sound ? 'bell' : 'bell-off', { size: 12 }), soundLabel());

  const ringerRow = el('div', { class: 'row gap wrap' });
  const ringerChips = Object.entries(RINGERS).map(([key, r]) => el('button', {
    class: 'chip chip-btn' + (s.ringer === key ? ' sel' : ''),
    dataset: { key },
    onClick: () => {
      s.ringer = key;
      store.save(true);
      ringerChips.forEach((c) => c.classList.toggle('sel', c.dataset.key === key));
      playRinger(key); // instant preview
    },
  }, r.label));
  ringerRow.append(...ringerChips);

  function exportData() {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `bloom-backup-${todayYmd()}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded', '💾');
  }

  const fileIn = el('input', {
    type: 'file', accept: '.json,application/json', style: { display: 'none' },
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.version !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.skills)) throw new Error('not a bloom backup');
        if (await confirmDialog('Replace everything with this backup? Current data is overwritten.', { yes: 'Import', danger: false })) {
          store.replace(data);
          close();
          toast('Backup restored 🌸', '💾');
        }
      } catch {
        toast('That file isn’t a Bloom backup', '😕');
      }
    },
  });

  const close = openModal(el('div', {},
    el('h2', {}, 'Settings'),
    el('div', { class: 'field-label' }, 'Your name'),
    nameIn,
    el('div', { class: 'field-label' }, 'Theme'),
    themeRow,
    el('div', { class: 'field-label' }, 'Sounds'),
    soundChip,
    el('div', { class: 'field-label' }, 'Timer ringer'),
    ringerRow,
    el('p', { class: 'muted small', style: { marginTop: '6px' } }, 'Tap one to hear it — it plays when a focus session finishes.'),
    el('div', { class: 'field-label' }, 'Your data'),
    el('p', { class: 'muted small', style: { marginBottom: '8px' } }, 'Everything lives in this browser. Export a backup any time.'),
    el('div', { class: 'row gap wrap' },
      el('button', { class: 'btn', onClick: exportData }, ic('download', { size: 14 }), 'Export'),
      el('button', { class: 'btn', onClick: () => fileIn.click() }, ic('folder', { size: 14 }), 'Import'),
      fileIn,
      el('button', {
        class: 'btn btn-danger', onClick: async () => {
          if (await confirmDialog('Start completely fresh? Tasks, notes, garden — everything is wiped.', { yes: 'Wipe it all' })) {
            store.reset();
            close();
            location.hash = '#/today';
          }
        },
      }, ic('reset', { size: 14 }), 'Reset'),
    ),
    el('p', { class: 'muted small', style: { marginTop: '18px', textAlign: 'center' } }, 'made with ', ic('heart', { size: 12, cls: 'heart-ic' }), ' for Jasmine'),
  ));
}

// ---------- onboarding ----------
function maybeOnboard() {
  if (store.state.settings.onboarded) return;
  const nameIn = el('input', { class: 'input', value: 'Jasmine', maxlength: 24, id: 'onboard-name' });
  const start = () => {
    store.state.settings.name = nameIn.value.trim() || 'friend';
    store.state.settings.onboarded = true;
    store.save();
    close();
    toast(`Welcome, ${store.state.settings.name}!`, '🌸');
    setTimeout(openGuide, 350);
  };
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  const close = openModal(
    el('div', { class: 'onboard' },
      el('span', { class: 'flower', html: plantSVG({ id: 'onboard-plant', color: '#C97F5F' }, 8, 74) }),
      el('h2', {}, 'Welcome to ', el('em', {}, 'Bloom')),
      el('p', {}, 'Tasks, calendar, notes and a focus timer — all feeding one little garden. Do the work, and watch your skills grow, level by level.'),
      nameIn,
      el('button', { class: 'btn btn-primary btn-big', id: 'onboard-start', onClick: start }, 'Let’s grow'),
    ),
    { onClose: () => { if (!store.state.settings.onboarded) { store.state.settings.onboarded = true; store.save(true); } } },
  );
}

// ---------- sidebar ----------
function buildSidebar() {
  const aside = document.getElementById('sidebar');
  aside.innerHTML = '';
  const logoFlower = el('span', { class: 'logo-flower' });
  logoFlower.append(ic('daisy', { size: 22 }));
  aside.append(el('div', { class: 'logo' }, logoFlower, el('em', {}, 'bloom')));
  for (const [key, icon, label] of NAV) {
    aside.append(el('button', {
      class: 'nav-item', dataset: { view: key }, 'aria-label': label,
      onClick: () => { sfx.click(); location.hash = '#/' + key; },
    }, ic(icon, { size: 17, cls: 'nav-emoji' }), el('span', {}, label)));
  }
  timerChip = el('button', { class: 'nav-timer-chip', style: { display: 'none' }, onClick: () => { location.hash = '#/focus'; } });
  aside.append(timerChip);
  streakEl = el('span', { class: 'streak-mini' });
  themeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Toggle theme', onClick: cycleTheme });
  aside.append(el('div', { class: 'sidebar-foot' },
    streakEl,
    el('span', { class: 'spacer' }),
    el('button', { class: 'icon-btn', 'aria-label': 'Guide', id: 'guide-btn', title: 'How Bloom works', onClick: () => { sfx.click(); openGuide(); } }, ic('help', { size: 16 })),
    themeBtn,
    el('button', { class: 'icon-btn', 'aria-label': 'Settings', id: 'settings-btn', onClick: openSettings }, ic('gear', { size: 16 })),
  ));
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === currentView));
}
function updateSidebarBits() {
  const st = streak();
  if (streakEl) streakEl.replaceChildren(ic(st > 0 ? 'flame' : 'sprout', { size: 12 }), ` ${st > 0 ? `${st} days` : 'no streak'}`);
}

// ---------- router / render ----------
// Entrance animation plays only when you navigate somewhere new. Data updates
// (adding a task, pausing the timer…) redraw in place: no replay, no scroll jump.
let animTimeout = null;
function renderView(animate = false) {
  const scrollY = window.scrollY;
  clearTimeout(animTimeout);
  viewEl.className = animate ? 'view-anim' : '';
  if (animate) animTimeout = setTimeout(() => { viewEl.className = ''; }, 750);
  viewEl.innerHTML = '';
  VIEWS[currentView].render(viewEl);
  updateSidebarBits();
  if (!animate) window.scrollTo(0, scrollY);
}
function route() {
  const name = (location.hash || '#/today').replace(/^#\//, '') || 'today';
  const next = VIEWS[name] ? name : 'today';
  const changed = currentView !== next;
  if (currentView && changed) VIEWS[currentView].unmount?.();
  currentView = next;
  renderView(changed);
  if (changed) window.scrollTo(0, 0);
  updateNav();
}
addEventListener('hashchange', route);

let renderQueued = false;
store.subscribe(() => {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; renderView(false); });
});

// ---------- global tick: timer completion + chip + tab title ----------
setInterval(() => {
  checkTimer();
  const t = store.state.timer;
  if (t) {
    const rem = fmtClock(timerRemaining());
    timerChip.style.display = '';
    const icName = t.pausedAt ? 'pause' : (t.phase === 'break' ? 'leaf' : 'hourglass');
    timerChip.innerHTML = `<span class="ic">${svgStr(icName, 12)}</span> ${rem}`;
    timerChip.classList.toggle('paused', !!t.pausedAt);
    const wanted = `${rem} · Bloom`;
    if (document.title !== wanted) document.title = wanted;
  } else {
    timerChip.style.display = 'none';
    if (document.title !== 'Bloom') document.title = 'Bloom';
  }
}, 500);

// ---------- keyboard shortcuts ----------
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('.modal-overlay')) return;
  const k = e.key.toLowerCase();
  const order = ['today', 'tasks', 'calendar', 'notes', 'focus', 'garden'];
  if (/^[1-6]$/.test(e.key)) { location.hash = '#/' + order[+e.key - 1]; return; }
  if (k === 'h') location.hash = '#/today';
  else if (k === 'c') location.hash = '#/calendar';
  else if (k === 'n') location.hash = '#/notes';
  else if (k === 'f') location.hash = '#/focus';
  else if (k === 'g') location.hash = '#/garden';
  else if (k === 't') {
    e.preventDefault();
    location.hash = '#/tasks';
    setTimeout(() => document.getElementById('task-title-in')?.focus(), 90);
  } else if (k === 'l') {
    e.preventDefault();
    const q = document.getElementById('quicklog');
    if (q) q.focus();
    else { location.hash = '#/today'; setTimeout(() => document.getElementById('quicklog')?.focus(), 90); }
  } else if (k === 'z') toggleZen();
  else if (e.key === '?') openGuide();
});

// ---------- boot ----------
window.addEventListener('bloom:open-settings', openSettings);
buildSidebar();
applyTheme();
route();
maybeOnboard();

// Console/testing hooks (local only)
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.__bloom = {
    store,
    logSession,
    parseQuickLog: (t) => parseQuickLog(t, store.state.skills),
    levelForXp,
    timeTravel(sec) { const t = store.state.timer; if (t) { t.startedAt -= sec * 1000; store.save(true); } },
    finishNow() { const t = store.state.timer; if (t) { t.startedAt -= t.durationSec * 1000; checkTimer(); } },
    reset() { store.reset(); location.hash = '#/today'; },
  };
}
