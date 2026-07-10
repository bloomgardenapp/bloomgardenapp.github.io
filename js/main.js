// main.js — boot, sidebar, router, theme, settings, onboarding, global timer tick.
import { el, fmtClock, todayYmd, levelForXp, parseQuickLog, guessIcon } from './util.js';
import { store, uid, nextColor } from './store.js';
import { toast, openModal, confirmDialog } from './ui.js';
import { sfx, RINGERS, playRinger, syncMusic, musicPlaying } from './audio.js';
import { streak, logSession, checkKeepsakes } from './progress.js';
import { ic, svgStr } from './icons.js';
import { startTour } from './tour.js';
import { plantSVG, SPECIES } from './plant.js';
import * as cloud from './cloud.js';
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
let timerChip, streakEl, themeBtn, musicBtn;
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
  toast(store.state.settings.theme === 'dark' ? 'Night garden' : 'Day garden', store.state.settings.theme === 'dark' ? 'moon' : 'sun');
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
      syncMusic();
      sfx.pop();
    },
  }, ic(s.sound ? 'bell' : 'bell-off', { size: 12 }), soundLabel());

  const hourRow = el('div', { class: 'row gap' });
  const hourChips = [[false, '12-hour · 3:00 pm'], [true, '24-hour · 15:00']].map(([v, label]) => el('button', {
    class: 'chip chip-btn' + (!!s.hour24 === v ? ' sel' : ''),
    dataset: { h24: String(v) },
    onClick: () => {
      s.hour24 = v;
      store.save(); // not silent — every visible time flips format instantly
      hourChips.forEach((c) => c.classList.toggle('sel', c.dataset.h24 === String(v)));
    },
  }, label));
  hourRow.append(...hourChips);

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

  // ---- account: email → code → synced garden (hidden until cloud is configured) ----
  const accountBox = el('div', {});
  let unsubStatus = null;
  const renderAccount = () => {
    if (!cloud.cloudConfigured()) {
      accountBox.replaceChildren(
        el('p', { class: 'muted small' }, 'Everything lives in this browser for now.'),
      );
      return;
    }
    if (cloud.signedIn()) {
      const label = (s) => ({ syncing: 'syncing…', synced: 'synced', error: 'sync hiccup — retrying', idle: 'signed in' }[s] || s);
      const statusChip = el('span', { class: 'chip green', id: 'sync-status' }, label(cloud.syncStatus()));
      unsubStatus?.();
      unsubStatus = cloud.onSyncStatus((s) => { statusChip.textContent = label(s); });
      accountBox.replaceChildren(
        el('p', { class: 'muted small', style: { marginBottom: '8px' } },
          'Signed in as ', el('b', {}, cloud.userEmail()), ' — your garden saves to your account on every change.'),
        el('div', { class: 'row gap wrap', style: { alignItems: 'center' } },
          statusChip,
          el('button', { class: 'btn', id: 'account-signout', onClick: () => { cloud.signOut(); renderAccount(); } }, 'Sign out'),
        ),
      );
      return;
    }
    // signed out: ask for email, then the code
    const emailIn = el('input', { class: 'input', type: 'email', id: 'account-email', placeholder: 'you@example.com', autocomplete: 'email' });
    const msg = el('p', { class: 'muted small', style: { marginTop: '6px' } }, 'Sign in to keep your garden safe and use it on any device.');
    const sendBtn = el('button', {
      class: 'btn btn-primary', id: 'account-send',
      onClick: async () => {
        const email = emailIn.value.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) { sfx.uhoh(); emailIn.focus(); return; }
        sendBtn.disabled = true;
        msg.textContent = 'Sending your code…';
        try {
          await cloud.requestCode(email);
          const codeIn = el('input', { class: 'input', id: 'account-code', placeholder: '6-digit code', inputmode: 'numeric', autocomplete: 'one-time-code', style: { width: '130px' } });
          const verifyBtn = el('button', {
            class: 'btn btn-primary', id: 'account-verify',
            onClick: async () => {
              verifyBtn.disabled = true;
              msg.textContent = 'Checking…';
              try {
                await cloud.verifyCode(email, codeIn.value.trim());
                sfx.chime();
                renderAccount();
                store.notify(); // the greeting/name may have just arrived from the cloud
              } catch (err) {
                msg.textContent = String(err.message || 'That code didn’t work — try again.');
                verifyBtn.disabled = false;
              }
            },
          }, 'Sign in');
          codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyBtn.click(); });
          accountBox.replaceChildren(
            el('p', { class: 'muted small', style: { marginBottom: '8px' } }, `We emailed a code to ${email} — type it here.`),
            el('div', { class: 'row gap wrap' }, codeIn, verifyBtn,
              el('button', { class: 'link-btn', onClick: () => renderAccount() }, 'different email')),
            msg,
          );
          msg.textContent = '';
          setTimeout(() => codeIn.focus(), 60);
        } catch (err) {
          msg.textContent = String(err.message || 'Could not send the code — try again.');
          sendBtn.disabled = false;
        }
      },
    }, 'Send code');
    emailIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendBtn.click(); });
    accountBox.replaceChildren(
      el('div', { class: 'row gap wrap' }, emailIn, sendBtn),
      msg,
    );
  };
  renderAccount();

  const close = openModal(el('div', {},
    el('h2', {}, 'Settings'),
    el('div', { class: 'field-label' }, 'Account'),
    accountBox,
    el('div', { class: 'field-label' }, 'Your name'),
    nameIn,
    el('div', { class: 'field-label' }, 'Theme'),
    themeRow,
    el('div', { class: 'field-label' }, 'Sounds'),
    soundChip,
    el('div', { class: 'field-label' }, 'Time format'),
    hourRow,
    el('div', { class: 'field-label' }, 'Timer ringer'),
    ringerRow,
    el('p', { class: 'muted small', style: { marginTop: '6px' } }, 'Tap one to hear it — it plays when a focus session finishes.'),
    el('div', { class: 'field-label' }, 'Start over'),
    el('div', { class: 'row gap wrap' },
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
  ), { onClose: () => unsubStatus?.() });
}

// ---------- onboarding: say hi → name → plant the first skill ----------
function maybeOnboard() {
  if (store.state.settings.onboarded) return;

  const wrap = el('div', { class: 'onboard' });
  const close = openModal(wrap, {
    onClose: () => { if (!store.state.settings.onboarded) { store.state.settings.onboarded = true; store.save(true); } },
  });

  const finish = (skillName, species = 'bloom') => {
    store.state.settings.onboarded = true;
    if (skillName) {
      const pretty = skillName.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
      store.state.skills.push({ id: uid(), name: pretty, icon: guessIcon(pretty), color: nextColor(), species, createdAt: new Date().toISOString() });
      toast(`${pretty} planted! Focus on it to make it grow`, 'pot');
    } else {
      toast(`Welcome, ${store.state.settings.name}!`, 'flower');
    }
    store.save();
    close();
    setTimeout(startTour, 450);
  };

  const step1 = () => {
    const nameIn = el('input', { class: 'input', placeholder: 'What should we call you?', maxlength: 24, id: 'onboard-name', autocomplete: 'off' });
    const next = () => {
      store.state.settings.name = nameIn.value.trim() || 'friend';
      store.save(true);
      step2();
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
    wrap.replaceChildren(
      el('span', { class: 'flower', html: plantSVG({ id: 'onboard-plant', color: '#C97F5F' }, 8, 74) }),
      el('h2', {}, 'Welcome to ', el('em', {}, 'Bloom')),
      el('p', {}, 'Tasks, calendar, notes and a focus timer — all feeding one little garden. Do the work, and watch your skills grow, level by level.'),
      nameIn,
      el('button', { class: 'btn btn-primary btn-big', id: 'onboard-start', onClick: next }, 'Next'),
    );
    setTimeout(() => nameIn.focus(), 80);
  };

  const step2 = () => {
    const color = nextColor();
    let species = 'bloom';
    const preview = el('span', { class: 'flower', html: plantSVG({ id: 'onboard-first', color, species }, 1, 74) });
    const skillIn = el('input', { class: 'input', placeholder: 'e.g. Piano, Math, Spanish…', maxlength: 24, id: 'onboard-skill', autocomplete: 'off' });
    const sync = () => { preview.innerHTML = plantSVG({ id: 'onboard-first', color, species }, skillIn.value.trim() ? 2 : 1, 74); };
    skillIn.addEventListener('input', sync);
    skillIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && skillIn.value.trim()) finish(skillIn.value.trim(), species); });
    const speciesRow = el('div', { class: 'species-row', style: { justifyContent: 'center', margin: '12px 0 0' } });
    const renderSpecies = () => {
      speciesRow.replaceChildren(...Object.entries(SPECIES).map(([key, sp]) => el('button', {
        class: 'species-cell' + (key === species ? ' sel' : ''), type: 'button', title: sp.label, dataset: { sp: key },
        onClick: () => { species = key; renderSpecies(); sync(); sfx.click(); },
      },
        el('div', { html: plantSVG({ id: 'ob-' + key, color, species: key }, 6, 34) }),
        el('span', { class: 'species-name' }, sp.label),
      )));
    };
    renderSpecies();
    const SUGGEST = ['Math', 'Reading', 'Piano', 'Spanish', 'Gym', 'Art', 'Coding'];
    wrap.replaceChildren(
      preview,
      el('h2', {}, 'Plant your first ', el('em', {}, 'plant')),
      el('p', {}, `What do you want to spend more time on, ${store.state.settings.name}? Every minute you give it makes this little plant grow.`),
      el('div', { class: 'row gap wrap', style: { justifyContent: 'center', marginTop: '14px' } },
        ...SUGGEST.map((s) => el('button', { class: 'chip chip-btn', onClick: () => { skillIn.value = s; sync(); skillIn.focus(); sfx.click(); } }, s)),
      ),
      skillIn,
      speciesRow,
      el('button', {
        class: 'btn btn-primary btn-big', id: 'onboard-plant-btn', style: { marginTop: '14px' },
        onClick: () => { const v = skillIn.value.trim(); if (!v) { sfx.uhoh(); skillIn.focus(); return; } finish(v, species); },
      }, ic('pot', { size: 15 }), 'Plant it'),
      el('div', { style: { marginTop: '10px' } },
        el('button', { class: 'link-btn', id: 'onboard-skip', onClick: () => finish(null) }, 'skip for now')),
    );
    setTimeout(() => skillIn.focus(), 80);
  };

  step1();
}

// ---------- music ----------
function updateMusicBtn() {
  if (!musicBtn) return;
  const on = store.state.settings.music !== false;
  musicBtn.innerHTML = svgStr(on ? 'music' : 'music-off', 16);
  musicBtn.style.color = on ? '' : 'var(--line-strong)';
}
function toggleMusic() {
  store.state.settings.music = store.state.settings.music === false;
  store.save(true);
  syncMusic();
  updateMusicBtn();
  sfx.click();
  toast(store.state.settings.music ? 'Music on' : 'Music off', store.state.settings.music ? 'music' : 'music-off');
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
  musicBtn = el('button', { class: 'icon-btn', 'aria-label': 'Toggle music', id: 'music-btn', title: 'Background music (m)', onClick: toggleMusic });
  updateMusicBtn();
  aside.append(el('div', { class: 'sidebar-foot' },
    streakEl,
    el('span', { class: 'spacer' }),
    musicBtn,
    el('button', { class: 'icon-btn', 'aria-label': 'Guide', id: 'guide-btn', title: 'Show me around', onClick: () => { sfx.click(); startTour(); } }, ic('help', { size: 16 })),
    themeBtn,
    el('button', { class: 'icon-btn', 'aria-label': 'Settings', id: 'settings-btn', onClick: openSettings }, ic('gear', { size: 16 })),
  ));
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === currentView));
}
function updateSidebarBits() {
  const st = streak();
  if (streakEl) {
    streakEl.replaceChildren(ic(st > 0 ? 'flame' : 'sprout', { size: 12 }), ` ${st}`);
    streakEl.title = `${st} day streak`;
  }
}

// ---------- router / render ----------
// Entrance animation plays only when you navigate somewhere new. Data updates
// (adding a task, pausing the timer…) redraw in place: no replay, no scroll jump.
let animTimeout = null;
function renderView(animate = false) {
  if (document.documentElement.dataset.tour) animate = false; // tour needs stable positions to spotlight
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
  queueMicrotask(() => { renderQueued = false; renderView(false); checkKeepsakes(); });
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
  else if (k === 'm') toggleMusic();
  else if (e.key === '?') startTour();
});

// ---------- boot ----------
window.addEventListener('bloom:open-settings', openSettings);
buildSidebar();
applyTheme();
route();
maybeOnboard();
cloud.initCloud(); // account + sync, if configured
syncMusic(); // gentle garden music, on by default (starts after first click per browser rules)
setTimeout(checkKeepsakes, 800);

// Console/testing hooks (local only)
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.__bloom = {
    store,
    cloud,
    logSession,
    parseQuickLog: (t) => parseQuickLog(t, store.state.skills),
    levelForXp,
    timeTravel(sec) { const t = store.state.timer; if (t) { t.startedAt -= sec * 1000; store.save(true); } },
    finishNow() { const t = store.state.timer; if (t) { t.startedAt -= t.durationSec * 1000; checkTimer(); } },
    reset() { store.reset(); location.hash = '#/today'; },
  };
}
