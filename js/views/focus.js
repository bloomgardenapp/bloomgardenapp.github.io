// views/focus.js — focus timer (single or pomodoro cycles), zen fullscreen, manual logging.
import { el, fmtClock, fmtMin, fmtDateShort, todayYmd, levelForXp } from '../util.js';
import { store } from '../store.js';
import { toast, confirmDialog } from '../ui.js';
import { sfx } from '../audio.js';
import { rain, burst } from '../confetti.js';
import { skillById, logSession, minutesTotal, xpOf } from '../progress.js';
import { openSkillEditor, skillSelect } from '../skillEditor.js';
import { plantSVG } from '../plant.js';
import { quickLogBox } from '../quicklog.js';
import { ic } from '../icons.js';

let selSkillId = null;
const FREE = 'free'; // sentinel for "just focus" — a timer with no plant attached
let selDur = 25;
let selTab = 'focus'; // 'focus' | 'short' | 'long' — Pomofocus-style tabs; breaks run standalone
let selShort = 5;
let selLong = 15;
let uiInterval = null;

// ---------- engine (used globally via main.js tick) ----------
export function timerRemaining() {
  const t = store.state.timer;
  if (!t) return 0;
  const now = t.pausedAt || Date.now();
  return Math.max(0, t.durationSec - (now - t.startedAt - t.pausedTotal) / 1000);
}
export function timerElapsedSec() {
  const t = store.state.timer;
  return t ? t.durationSec - timerRemaining() : 0;
}
export function timerPhase() {
  const t = store.state.timer;
  return t ? (t.phase || 'work') : null;
}
export function checkTimer() {
  const t = store.state.timer;
  if (t && !t.pausedAt && timerRemaining() <= 0) completeTimer();
}

function notifyBG(title, body) {
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, silent: true, tag: 'bloom-timer' });
    }
  } catch { /* notifications unavailable — fine */ }
}

export function completeTimer() {
  const t = store.state.timer;
  if (!t) return;
  const sk = skillById(t.skillId);
  const name = sk ? sk.name : 'focus';

  if ((t.phase || 'work') === 'break') {
    if (t.mode !== 'cycle') {
      // standalone break (the Break tab) — just ends, nothing to log
      store.state.timer = null;
      document.title = 'Bloom';
      sfx.alarm();
      notifyBG('Break over', 'Fresh and ready to grow.');
      toast('Break over — fresh and ready', 'leaf');
      store.save();
      return;
    }
    // break over → next round starts by itself (round 0 = break-first warmup → round 1)
    const round = (t.round ?? 1) + 1;
    store.state.timer = {
      skillId: t.skillId, durationSec: t.workSec, workSec: t.workSec, breakSec: t.breakSec,
      mode: 'cycle', phase: 'work', round,
      startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
    };
    sfx.start();
    notifyBG(`Round ${round} — back to ${name}`, 'Break’s over. You’ve got this.');
    toast(`Round ${round} — back to ${name}`, 'sprout');
    store.save();
    return;
  }

  // work session done
  const minutes = Math.max(1, Math.round(t.durationSec / 60));
  const skillId = t.skillId;
  if (t.mode === 'cycle') {
    store.state.timer = {
      skillId: t.skillId, durationSec: t.breakSec, workSec: t.workSec, breakSec: t.breakSec,
      mode: 'cycle', phase: 'break', round: t.round || 1,
      startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
    };
    notifyBG('Session complete', `${sk ? `+${minutes}m to ${name}` : `${minutes}m of focus done`} — ${Math.round(t.breakSec / 60)} minute break now`);
  } else {
    store.state.timer = null;
    document.title = 'Bloom';
    notifyBG('Session complete', sk ? `+${minutes}m to ${name} — lovely work.` : 'Lovely work.');
  }
  sfx.alarm();
  rain();
  if (sk) logSession({ skillId, minutes, source: 'timer' }); // saves + notifies + level-up celebration
  else { toast('Timer done — lovely work', 'hourglass'); store.save(); }
}

export function setFocusSkill(id) { selSkillId = id; }

function startTimer(skillId, minutes) {
  const workSec = Math.round(minutes * 60);
  store.state.timer = {
    skillId, durationSec: workSec, workSec, breakSec: 5 * 60,
    mode: 'single', phase: 'work', round: 1,
    startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
  };
  sfx.start();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  store.save();
}

// Tabs live on both the setup card and the running timer. Switching away from a
// running focus logs the elapsed minutes first — no minute wasted.
function switchTab(target) {
  const t = store.state.timer;
  selTab = target;
  if (!t) { store.notify(); return; }
  const mins = (t.phase || 'work') === 'work' ? Math.floor(timerElapsedSec() / 60) : 0;
  const skillId = t.skillId;
  store.state.timer = null;
  document.title = 'Bloom';
  if (mins >= 1) { sfx.chime(); logSession({ skillId, minutes: mins, source: 'timer' }); }
  else store.save();
}

function makeTabs(active) {
  return el('div', { class: 'focus-tabs' },
    ...[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([v, label]) => el('button', {
      class: 'focus-tab' + (active === v ? ' sel' : ''), dataset: { tab: v },
      onClick: () => { if (v !== active) { sfx.click(); switchTab(v); } },
    }, label)),
  );
}

function startBreak(minutes) {
  const sec = Math.round(minutes * 60);
  store.state.timer = {
    skillId: null, durationSec: sec, workSec: 0, breakSec: sec,
    mode: 'single', phase: 'break', round: 1,
    startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
  };
  sfx.start();
  store.save();
}

function togglePause() {
  const t = store.state.timer;
  if (!t) return;
  if (t.pausedAt) { t.pausedTotal += Date.now() - t.pausedAt; t.pausedAt = null; }
  else t.pausedAt = Date.now();
  sfx.click();
  store.save();
}

function skipBreak() {
  const t = store.state.timer;
  if (!t || t.phase !== 'break') return;
  t.durationSec = 0; // next tick completes the break → next round
  t.startedAt = Date.now();
  store.save();
}

async function endEarly({ discardable } = {}) {
  const t = store.state.timer;
  if (!t) return;
  if ((t.phase || 'work') === 'break') {
    store.state.timer = null;
    document.title = 'Bloom';
    store.save();
    toast(t.mode === 'cycle' ? 'Cycle ended — well grown' : 'Break ended', 'leaf');
    return;
  }
  const elapsedMin = Math.floor(timerElapsedSec() / 60);
  if (discardable) {
    const msg = !skillById(t.skillId)
      ? 'End this timer? No plant selected, so nothing gets logged.'
      : elapsedMin >= 1
        ? `End this session early? Your ${fmtMin(elapsedMin)} still gets logged — no minute wasted.`
        : 'End this session? Nothing to log yet (under a minute).';
    if (!(await confirmDialog(msg, { yes: 'End session', no: 'Keep going' }))) return;
  }
  const skillId = t.skillId;
  store.state.timer = null;
  document.title = 'Bloom';
  if (elapsedMin >= 1) { sfx.chime(); logSession({ skillId, minutes: elapsedMin, source: 'timer' }); }
  else store.save();
}


// ---------- zen fullscreen ----------
let zenEl = null;
let zenInterval = null;
let zenLevel = 0;

export function toggleZen() {
  if (zenEl) closeZen();
  else openZen();
}

function zenEsc(e) { if (e.key === 'Escape') closeZen(); }

function openZen() {
  const t = store.state.timer;
  if (!t) { toast('Start a focus session first', 'hourglass'); return; }
  const sk = skillById(t.skillId) || { name: 'focus', icon: 'sprout', color: '#8FA35E', id: 'zen' };

  const R = 168, C = 2 * Math.PI * R;
  const svgWrap = el('div', { class: 'zen-ring-wrap' });
  svgWrap.innerHTML = `<svg viewBox="0 0 360 360" class="zen-ring" width="100%" height="100%">
    <circle class="track" cx="180" cy="180" r="${R}"/>
    <circle class="prog" cx="180" cy="180" r="${R}" stroke-dasharray="${C}"/>
  </svg>`;
  const prog = svgWrap.querySelector('.prog');

  const plantWrap = el('div', { class: 'zen-plant' });
  // crop the empty sky above the drawn plant so the plant+time+label group truly centers
  const fitPlant = () => {
    const svg = plantWrap.querySelector('svg');
    if (!svg) return;
    let top = Infinity;
    for (const k of svg.children) {
      try { const b = k.getBBox(); if (b.width || b.height) top = Math.min(top, b.y); } catch { /* not measurable */ }
    }
    if (!isFinite(top)) top = 0;
    const scaleF = (svg.getBoundingClientRect().height || 144) / 150;
    plantWrap.style.marginTop = `${(-(Math.max(0, top - 4)) * scaleF).toFixed(1)}px`;
  };
  const timeEl = el('div', { class: 'zen-time' }, fmtClock(timerRemaining()));
  const labelEl = el('div', { class: 'zen-label' });
  const pauseBtn = el('button', { class: 'btn', onClick: () => { togglePause(); } }, ic('pause', { size: 13 }), 'Pause');

  zenEl = el('div', { class: 'zen' },
    el('div', { class: 'zen-stage' }, svgWrap,
      el('div', { class: 'zen-center' }, plantWrap, timeEl, labelEl),
    ),
    el('div', { class: 'zen-controls' },
      pauseBtn,
      el('button', { class: 'btn', onClick: () => closeZen() }, ic('expand', { size: 13 }), 'Leave zen'),
    ),
  );
  document.body.append(zenEl);
  document.documentElement.requestFullscreen?.().catch(() => {});
  document.addEventListener('keydown', zenEsc);
  zenLevel = 0;

  const tick = () => {
    checkTimer(); // self-drive completion so zen doesn't stall if the tab is throttled
    const tt = store.state.timer;
    if (!tt) { closeZen(); return; }
    const phase = tt.phase || 'work';
    const rem = timerRemaining();
    const progress = tt.durationSec > 0 ? 1 - rem / tt.durationSec : 1;
    prog.setAttribute('stroke-dashoffset', String(C * (1 - progress)));
    prog.style.stroke = phase === 'break' ? '#7FA98F' : sk.color;
    timeEl.textContent = fmtClock(rem);
    labelEl.textContent = phase === 'break'
      ? (tt.round === 0 ? 'warm-up break' : `little break · round ${tt.round || 1}`)
      : (tt.mode === 'cycle' ? `${sk.name} · round ${tt.round || 1}` : sk.name);
    pauseBtn.replaceChildren(ic(tt.pausedAt ? 'play' : 'pause', { size: 13 }), tt.pausedAt ? 'Resume' : 'Pause');

    // the plant grows live: elapsed work minutes count as XP-in-progress
    const bonus = phase === 'work' ? Math.floor(timerElapsedSec() / 60) : 0;
    const live = skillById(tt.skillId) ? levelForXp(xpOf(tt.skillId) + bonus).level : 1;
    if (live !== zenLevel) {
      const grew = live > zenLevel && zenLevel !== 0;
      zenLevel = live;
      plantWrap.innerHTML = plantSVG(sk, live, 118);
      fitPlant();
      if (grew) { sfx.level(); burst(innerWidth / 2, innerHeight / 2, { count: 20 }); }
    }
    const scale = 0.92 + progress * 0.1;
    plantWrap.style.setProperty('--zs', scale.toFixed(3)); // CSS owns the centering transform
  };
  tick();
  zenInterval = setInterval(tick, 500);
}

function closeZen() {
  if (!zenEl) return;
  clearInterval(zenInterval);
  zenInterval = null;
  zenEl.remove();
  zenEl = null;
  document.removeEventListener('keydown', zenEsc);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

// ---------- pop-out timer (Document Picture-in-Picture) ----------
// A tiny always-on-top window that keeps the countdown visible while you're in other apps.
let pipWin = null;
let pipInterval = null;
let pipOpening = false; // synchronous in-flight guard across the async requestWindow gap
let pipOnHide = null;

export function pipSupported() { return 'documentPictureInPicture' in window; }

const PIP_CSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { font-family: 'Quicksand', system-ui, sans-serif; background: #F4F0E2; color: #4A5238;
    display: flex; flex-direction: column; overflow: hidden; }
  /* zen-style: one centered column — nothing can nudge anything else sideways */
  .pip-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 12px; text-align: center; }
  .pip-plant { width: 64px; height: 64px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
  .pip-plant svg { width: 56px; height: 70px; display: block; }
  .pip-time { font-family: 'Fraunces', Georgia, serif; font-size: 36px; font-weight: 600; line-height: 1.05; color: #3A422C; font-variant-numeric: tabular-nums; }
  .pip-label { font-size: 11.5px; font-weight: 600; color: #8F937D; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pip-btn { font-family: inherit; font-size: 12px; font-weight: 700; border: 1.5px solid rgba(96,108,62,0.32);
    background: transparent; color: #4A5238; border-radius: 999px; padding: 5px 18px; cursor: pointer; margin-top: 2px; }
  .pip-btn:hover { background: rgba(124,139,79,0.14); }
  .pip-bar { height: 5px; width: 100%; background: rgba(96,108,62,0.16); }
  .pip-bar-fill { height: 100%; width: 0%; background: #7C8B4F; transition: width 0.25s linear; }
  body.pip-dark { background: #161513; color: #EAE6DD; }
  body.pip-dark .pip-time { color: #FAF7F0; }
  body.pip-dark .pip-label { color: #A8A296; }
  body.pip-dark .pip-btn { color: #EAE6DD; border-color: rgba(234,230,221,0.32); }
  body.pip-dark .pip-bar { background: rgba(234,230,221,0.14); }
`;

export async function openPip() {
  if (!store.state.timer) { toast('Start a focus session first', 'hourglass'); return; }
  if (!pipSupported()) { toast('Pop-out works in Chrome or Edge', 'hourglass'); return; }
  if (pipWin || pipOpening) { pipWin?.focus(); return; } // covers the async gap so two fast clicks can't double-open
  pipOpening = true;
  let win;
  try {
    win = await documentPictureInPicture.requestWindow({ width: 232, height: 236 });
  } catch {
    toast('Could not open the pop-out', 'hourglass');
    return;
  } finally {
    pipOpening = false;
  }
  pipWin = win;

  const doc = win.document;
  // carry over Bloom's fonts (a PiP document starts with no styles of its own)
  for (const link of document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')) {
    if (/fonts\./.test(link.href)) doc.head.append(link.cloneNode(true));
  }
  const style = doc.createElement('style');
  style.textContent = PIP_CSS;
  doc.head.append(style);

  const plantWrap = el('div', { class: 'pip-plant' });
  const timeEl = el('div', { class: 'pip-time' }, fmtClock(timerRemaining()));
  const labelEl = el('div', { class: 'pip-label' });
  const pauseBtn = el('button', { class: 'pip-btn', onClick: () => togglePause() }, 'Pause');
  const barFill = el('div', { class: 'pip-bar-fill' });
  doc.body.append(
    el('div', { class: 'pip-wrap' }, plantWrap, timeEl, labelEl, pauseBtn),
    el('div', { class: 'pip-bar' }, barFill),
  );

  let lastPhase = null, pipLevel = 0;
  const tick = () => {
    checkTimer(); // self-drive completion — the main-tab loop is throttled while you're in another app
    const tt = store.state.timer;
    if (!tt) { closePip(); return; } // single session finished → close the pop-out
    const phase = tt.phase || 'work';
    const rem = timerRemaining();
    const progress = tt.durationSec > 0 ? 1 - rem / tt.durationSec : 1;
    const sk = skillById(tt.skillId) || (phase === 'break'
      ? { name: 'break', icon: 'leaf', color: '#7FA98F', id: 'break', species: 'fern' }
      : { name: 'focus', icon: 'hourglass', color: '#8FA35E', id: 'free', species: 'fern' });
    doc.body.classList.toggle('pip-dark', (document.documentElement.dataset.theme || 'light') === 'dark'); // follow live theme
    // the plant grows live: elapsed work minutes count as XP toward the next level
    if (sk) {
      const bonus = phase === 'work' ? Math.floor(timerElapsedSec() / 60) : 0;
      const live = levelForXp(xpOf(sk.id) + bonus).level;
      if (live !== pipLevel) { pipLevel = live; plantWrap.innerHTML = plantSVG(sk, live, 62); }
    }
    timeEl.textContent = fmtClock(rem);
    labelEl.textContent = phase === 'break'
      ? (tt.round === 0 ? 'warm-up break' : `break · round ${tt.round || 1}`)
      : (tt.mode === 'cycle' ? `${sk ? sk.name : 'focus'} · round ${tt.round || 1}` : (sk ? sk.name : 'focus'));
    if (phase !== lastPhase) barFill.style.transition = 'none'; // don't slide the bar backwards on a phase change
    barFill.style.width = `${Math.round(progress * 100)}%`;
    barFill.style.background = phase === 'break' ? '#7FA98F' : (sk ? sk.color : '#7C8B4F');
    if (phase !== lastPhase) { void barFill.offsetWidth; barFill.style.transition = ''; lastPhase = phase; }
    pauseBtn.textContent = tt.pausedAt ? 'Resume' : 'Pause';
  };
  tick();
  pipInterval = setInterval(tick, 250);
  // user closed the pop-out window themselves — identity-guarded so a stale close can't clobber a reopened window
  pipOnHide = () => { if (pipWin !== win) return; clearInterval(pipInterval); pipInterval = null; pipWin = null; };
  win.addEventListener('pagehide', pipOnHide);
}

function closePip() {
  clearInterval(pipInterval);
  pipInterval = null;
  const w = pipWin;
  pipWin = null;
  if (w) {
    if (pipOnHide) { try { w.removeEventListener('pagehide', pipOnHide); } catch { /* gone */ } }
    try { w.close(); } catch { /* already gone */ }
  }
  pipOnHide = null;
}

// ---------- view ----------
const RING_R = 100;
const RING_C = 2 * Math.PI * RING_R;

function runningCard() {
  const t = store.state.timer;
  const free = !skillById(t.skillId);
  const sk = skillById(t.skillId) || { name: 'focus', icon: 'hourglass', color: '#8FA35E', id: 'x' };
  const phase = t.phase || 'work';
  const onBreak = phase === 'break';

  const timeEl = el('div', { class: 'timer-time', id: 'timer-remaining' }, fmtClock(timerRemaining()));
  const prog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  prog.setAttribute('class', 'prog');
  prog.setAttribute('cx', '110'); prog.setAttribute('cy', '110'); prog.setAttribute('r', String(RING_R));
  prog.style.stroke = onBreak ? '#7FA98F' : sk.color;
  prog.setAttribute('stroke-dasharray', String(RING_C));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 220');
  svg.setAttribute('class', 'timer-ring');
  svg.setAttribute('width', '100%');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'track');
  track.setAttribute('cx', '110'); track.setAttribute('cy', '110'); track.setAttribute('r', String(RING_R));
  svg.append(track, prog);

  const updateRing = () => {
    const tt = store.state.timer;
    if (!tt) return;
    const rem = timerRemaining();
    const progress = tt.durationSec > 0 ? 1 - rem / tt.durationSec : 1;
    prog.setAttribute('stroke-dashoffset', String(RING_C * (1 - progress)));
    timeEl.textContent = fmtClock(rem);
  };
  updateRing();
  clearInterval(uiInterval);
  uiInterval = setInterval(updateRing, 250);

  const paused = !!t.pausedAt;
  const heading = paused
    ? el('h2', {}, 'Paused')
    : onBreak
      ? el('h2', {}, 'Little ', el('em', {}, 'break'), ' ', ic('leaf', { size: 16, cls: 'title-ic' }))
      : free
        ? el('h2', {}, 'Just ', el('em', {}, 'focusing'), ' ', ic('hourglass', { size: 16, cls: 'title-ic' }))
        : el('h2', {}, 'Growing ', el('em', {}, sk.name), ' ', el('span', { class: 'pulse-drop' }, ic('drop', { size: 16, cls: 'title-ic' })));
  const subText = onBreak
    ? (t.mode !== 'cycle' ? 'just a breather — nothing gets logged'
      : t.round === 0 ? `warm-up break · ${sk.name} starts after this`
      : `round ${t.round || 1} done · back to ${sk.name} after this`)
    : t.mode === 'cycle'
      ? `round ${t.round || 1} · ${fmtMin(Math.round(t.workSec / 60))} work + ${fmtMin(Math.round(t.breakSec / 60))} break, repeating`
      : free
        ? `${fmtMin(Math.round(t.durationSec / 60))} timer · no plant — nothing gets logged`
        : `${fmtMin(Math.round(t.durationSec / 60))} session · every minute = 1 XP`;

  return el('div', { class: 'card focus-hero' },
    makeTabs(onBreak ? (selTab === 'long' ? 'long' : 'short') : 'focus'),
    heading,
    el('p', { class: 'muted small', style: { marginTop: '4px' } }, subText),
    el('div', { class: 'timer-ring-wrap' }, svg,
      el('div', { class: 'timer-center' }, timeEl, el('div', { class: 'timer-skill' }, onBreak ? 'breathe' : sk.name)),
    ),
    el('div', { class: 'row gap', style: { justifyContent: 'center', flexWrap: 'wrap' } },
      el('button', { class: 'btn', id: 'timer-pause-btn', onClick: togglePause },
        ic(paused ? 'play' : 'pause', { size: 13 }), paused ? 'Resume' : 'Pause'),
      onBreak
        ? el('button', { class: 'btn btn-green', id: 'timer-skip-btn', onClick: skipBreak }, ic('play', { size: 13 }), 'Skip break')
        : el('button', { class: 'btn btn-green', id: 'timer-finish-btn', onClick: () => endEarly({ discardable: false }) }, ic('check', { size: 13 }), free ? 'Finish' : 'Finish & log'),
      el('button', { class: 'btn', id: 'timer-zen-btn', title: 'Zen fullscreen (z)', onClick: toggleZen }, ic('expand', { size: 13 }), 'Zen'),
      pipSupported()
        ? el('button', { class: 'btn', id: 'timer-pip-btn', title: 'Pop out a floating timer — stays on top while you work in other apps', onClick: openPip }, ic('pip', { size: 13 }), 'Pop out')
        : null,
      el('button', { class: 'btn btn-danger', id: 'timer-end-btn', onClick: () => endEarly({ discardable: true }) }, onBreak ? (t.mode === 'cycle' ? 'End cycle' : 'End break') : 'End'),
    ),
  );
}

function setupCard() {
  const s = store.state;
  if (selSkillId && selSkillId !== FREE && !skillById(selSkillId)) selSkillId = null;
  if (!selSkillId) selSkillId = s.skills.length ? s.skills[s.skills.length - 1].id : FREE;

  const chips = s.skills.map((sk) => el('button', {
    class: 'skill-chip' + (sk.id === selSkillId ? ' sel' : ''),
    style: sk.id === selSkillId ? { background: sk.color } : {},
    dataset: { skill: sk.name },
    title: sk.id === selSkillId ? 'Tap again to focus without a plant' : undefined,
    onClick: () => { selSkillId = sk.id === selSkillId ? FREE : sk.id; sfx.click(); store.notify(); },
  }, ic((sk.icon || 'sprout'), { size: 12 }), ` ${sk.name}`));
  chips.push(el('button', {
    class: 'skill-chip', onClick: async () => {
      const sk = await openSkillEditor();
      if (sk) { selSkillId = sk.id; store.notify(); }
    },
  }, '＋ new'));

  const durs = [15, 25, 45, 60];
  const customIn = el('input', {
    class: 'input dur-custom', type: 'number', min: '1', max: '240', id: 'dur-custom-in',
    placeholder: '---', 'aria-label': 'custom study minutes', title: 'Type any number of minutes',
    value: durs.includes(selDur) ? '' : selDur,
    onInput: (e) => { const v = parseInt(e.target.value, 10); if (v > 0) { selDur = Math.min(v, 240); refreshDur(); } },
  });
  const durChips = durs.map((d) => el('button', {
    class: 'dur-chip' + (d === selDur ? ' sel' : ''), dataset: { min: d },
    onClick: () => { selDur = d; customIn.value = ''; sfx.click(); refreshDur(); },
  }, `${d}m`));

  function refreshDur() {
    durChips.forEach((c) => c.classList.toggle('sel', parseInt(c.dataset.min, 10) === selDur));
    startBtn.textContent = `Start ${selDur}m of focus`;
  }

  const startBtn = el('button', {
    class: 'btn btn-primary btn-big', id: 'timer-start-btn',
    onClick: () => startTimer(selSkillId === FREE ? null : selSkillId, selDur),
  }, '');
  refreshDur();

  // Pomofocus-style tabs: Focus grows a plant; the break tabs run a simple standalone timer
  const tabRow = makeTabs(selTab);

  if (selTab !== 'focus') {
    const isShort = selTab === 'short';
    const presets = isShort ? [5, 10] : [15, 20, 30];
    const getSel = () => (isShort ? selShort : selLong);
    const setSel = (v) => { if (isShort) selShort = v; else selLong = v; };
    const bCustom = el('input', {
      class: 'input dur-custom', type: 'number', min: '1', max: '120', 'aria-label': 'custom break minutes',
      placeholder: '---', value: presets.includes(getSel()) ? '' : getSel(),
      onInput: (e) => { const v = parseInt(e.target.value, 10); if (v > 0) { setSel(Math.min(v, 120)); syncB(); } },
    });
    const bChips = presets.map((b) => el('button', {
      class: 'dur-chip' + (b === getSel() ? ' sel' : ''), dataset: { brk: b },
      onClick: () => { setSel(b); bCustom.value = ''; sfx.click(); syncB(); },
    }, `${b}m`));
    const bStart = el('button', { class: 'btn btn-primary btn-big', id: 'break-start-btn', onClick: () => startBreak(getSel()) }, '');
    const syncB = () => {
      bChips.forEach((c) => c.classList.toggle('sel', parseInt(c.dataset.brk, 10) === getSel()));
      bStart.textContent = `Start ${getSel()}m break`;
    };
    syncB();
    return el('div', { class: 'card focus-hero' },
      tabRow,
      el('h2', {}, 'Take a ', el('em', { class: 'squiggle' }, 'break'), ' ', ic('leaf', { size: 16, cls: 'title-ic' })),
      el('p', { class: 'muted', style: { marginTop: '10px' } }, 'Rest is part of growing. Nothing gets logged — just breathe.'),
      el('div', { class: 'dur-chips' }, ...bChips, bCustom),
      el('div', { style: { marginTop: '14px' } }, bStart),
    );
  }

  return el('div', { class: 'card focus-hero' },
    tabRow,
    el('h2', {}, 'Grow some ', el('em', { class: 'squiggle' }, 'focus')),
    el('p', { class: 'muted', style: { marginTop: '10px' } }, 'Pick a plant, pick a time. Every focused minute becomes XP.'),
    s.skills.length
      ? el('div', { class: 'skill-pick' }, ...chips)
      : el('div', { style: { margin: '16px 0' } },
          el('button', { class: 'btn btn-primary btn-big', onClick: async () => { const sk = await openSkillEditor(); if (sk) { selSkillId = sk.id; store.notify(); } } }, ic('pot', { size: 15 }), 'Plant your first skill'),
        ),
    el('div', { class: 'dur-chips' }, ...durChips, customIn),
    el('div', { style: { marginTop: '14px' } }, startBtn),
  );
}

function manualCard() {
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Add ', el('em', {}, 'time')), ic('pencil', { size: 15, cls: 'title-ic' })),
    quickLogBox(),
    el('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Works for the past too — “30m piano yesterday” or “1h math 2026-07-01”.'),
  );
}

function historyCard() {
  const sessions = [...store.state.sessions].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 10);
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Recent ', el('em', {}, 'sessions')), ic('clock', { size: 15, cls: 'title-ic' }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'chip green' }, `${fmtMin(minutesTotal())} all-time`)),
    sessions.length
      ? el('div', {}, ...sessions.map((sess) => {
          const sk = skillById(sess.skillId);
          return el('div', { class: 'session-row' },
            sk ? el('span', { class: 'row', style: { gap: '6px' } }, ic((sk.icon || 'sprout'), { size: 13 }), sk.name)
               : sess.skillId ? el('span', {}, '(removed)')
               : el('span', { class: 'row', style: { gap: '6px' } }, ic('hourglass', { size: 13 }), 'just focus'),
            el('span', { class: 'chip green' }, fmtMin(sess.minutes)),
            el('span', { class: 'muted small session-meta' }, `${fmtDateShort(sess.date)} · `, ic(sess.source === 'timer' ? 'hourglass' : 'pencil', { size: 11 }), sess.source === 'timer' ? ' timer' : ' logged'),
            el('span', { class: 'spacer' }),
            el('button', {
              class: 'icon-btn del', 'aria-label': 'Delete session',
              onClick: async () => {
                if (await confirmDialog(`Remove ${fmtMin(sess.minutes)} of ${sk ? sk.name : 'this'}? Its XP disappears too.`, { yes: 'Remove' })) {
                  store.state.sessions = store.state.sessions.filter((x) => x.id !== sess.id);
                  store.save();
                }
              },
            }, ic('trash', { size: 14 })),
          );
        }))
      : el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('hourglass', { size: 26 })), 'No sessions yet — start the timer or add time above.'),
  );
}

export function render(root) {
  clearInterval(uiInterval);
  const running = !!store.state.timer;
  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Time to ', el('em', { class: 'squiggle' }, 'focus'), ' ', ic('hourglass', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, 'Deep work, one session at a time.'),
      ),
    ),
    el('div', { style: { marginTop: '20px' } }, running ? runningCard() : setupCard()),
    el('div', { class: 'grid-2', style: { marginTop: '16px' } }, manualCard(), historyCard()),
  );
}

export function unmount() {
  clearInterval(uiInterval);
  uiInterval = null;
}
