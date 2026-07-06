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
let selDur = 25;
let selMode = 'single'; // 'single' | 'cycle'
let selBreak = 5;
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
  const name = sk ? sk.name : 'your plant';

  if ((t.phase || 'work') === 'break') {
    // break over → next round starts by itself
    const round = (t.round || 1) + 1;
    store.state.timer = {
      skillId: t.skillId, durationSec: t.workSec, workSec: t.workSec, breakSec: t.breakSec,
      mode: 'cycle', phase: 'work', round,
      startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
    };
    sfx.start();
    notifyBG(`Round ${round} — back to ${name}`, 'Break’s over. You’ve got this.');
    toast(`Round ${round} — back to ${name}`, '🌱');
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
    notifyBG('Session complete', `+${minutes}m to ${name} — ${Math.round(t.breakSec / 60)} minute break now 🍃`);
  } else {
    store.state.timer = null;
    document.title = 'Bloom';
    notifyBG('Session complete', `+${minutes}m to ${name} — lovely work.`);
  }
  sfx.chime();
  rain();
  logSession({ skillId, minutes, source: 'timer' }); // saves + notifies + level-up celebration
}

export function setFocusSkill(id) { selSkillId = id; }

function startTimer(skillId, minutes) {
  const workSec = Math.round(minutes * 60);
  store.state.timer = {
    skillId, durationSec: workSec, workSec, breakSec: selBreak * 60,
    mode: selMode, phase: 'work', round: 1,
    startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
  };
  sfx.start();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
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
    toast('Cycle ended — well grown', '🌿');
    return;
  }
  const elapsedMin = Math.floor(timerElapsedSec() / 60);
  if (discardable) {
    const msg = elapsedMin >= 1
      ? `End this session early? Your ${fmtMin(elapsedMin)} still gets logged — no minute wasted 💚`
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
  if (!t) { toast('Start a focus session first', '⏳'); return; }
  const sk = skillById(t.skillId) || { name: 'focus', color: '#8FA35E', id: 'zen' };

  const R = 168, C = 2 * Math.PI * R;
  const svgWrap = el('div', { class: 'zen-ring-wrap' });
  svgWrap.innerHTML = `<svg viewBox="0 0 360 360" class="zen-ring" width="100%" height="100%">
    <circle class="track" cx="180" cy="180" r="${R}"/>
    <circle class="prog" cx="180" cy="180" r="${R}" stroke-dasharray="${C}"/>
  </svg>`;
  const prog = svgWrap.querySelector('.prog');

  const plantWrap = el('div', { class: 'zen-plant' });
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
    const tt = store.state.timer;
    if (!tt) { closeZen(); return; }
    const phase = tt.phase || 'work';
    const rem = timerRemaining();
    const progress = tt.durationSec > 0 ? 1 - rem / tt.durationSec : 1;
    prog.setAttribute('stroke-dashoffset', String(C * (1 - progress)));
    prog.style.stroke = phase === 'break' ? '#7FA98F' : sk.color;
    timeEl.textContent = fmtClock(rem);
    labelEl.textContent = phase === 'break'
      ? `little break · round ${tt.round || 1}`
      : (tt.mode === 'cycle' ? `${sk.name} · round ${tt.round || 1}` : sk.name);
    pauseBtn.replaceChildren(ic(tt.pausedAt ? 'play' : 'pause', { size: 13 }), tt.pausedAt ? 'Resume' : 'Pause');

    // the plant grows live: elapsed work minutes count as XP-in-progress
    const bonus = phase === 'work' ? Math.floor(timerElapsedSec() / 60) : 0;
    const live = levelForXp(xpOf(tt.skillId) + bonus).level;
    if (live !== zenLevel) {
      const grew = live > zenLevel && zenLevel !== 0;
      zenLevel = live;
      plantWrap.innerHTML = plantSVG(sk, live, 118);
      if (grew) { sfx.level(); burst(innerWidth / 2, innerHeight / 2, { count: 20 }); }
    }
    const scale = 0.92 + progress * 0.1;
    plantWrap.style.transform = `scale(${scale.toFixed(3)})`;
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

// ---------- view ----------
const RING_R = 100;
const RING_C = 2 * Math.PI * RING_R;

function runningCard() {
  const t = store.state.timer;
  const sk = skillById(t.skillId) || { name: '?', emoji: '', color: '#8FA35E', id: 'x' };
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
      : el('h2', {}, 'Growing ', el('em', {}, sk.name), ' ', el('span', { class: 'pulse-drop' }, ic('drop', { size: 16, cls: 'title-ic' })));
  const subText = onBreak
    ? `round ${t.round || 1} done · back to ${sk.name} after this`
    : t.mode === 'cycle'
      ? `round ${t.round || 1} · ${fmtMin(Math.round(t.workSec / 60))} work + ${fmtMin(Math.round(t.breakSec / 60))} break, repeating`
      : `${fmtMin(Math.round(t.durationSec / 60))} session · every minute = 1 XP`;

  return el('div', { class: 'card focus-hero' },
    heading,
    el('p', { class: 'muted small', style: { marginTop: '4px' } }, subText),
    el('div', { class: 'timer-ring-wrap' }, svg,
      el('div', { class: 'timer-center' }, timeEl, el('div', { class: 'timer-skill' }, onBreak ? 'breathe' : `${sk.emoji} ${sk.name}`)),
    ),
    el('div', { class: 'row gap', style: { justifyContent: 'center', flexWrap: 'wrap' } },
      el('button', { class: 'btn', id: 'timer-pause-btn', onClick: togglePause },
        ic(paused ? 'play' : 'pause', { size: 13 }), paused ? 'Resume' : 'Pause'),
      onBreak
        ? el('button', { class: 'btn btn-green', id: 'timer-skip-btn', onClick: skipBreak }, ic('play', { size: 13 }), 'Skip break')
        : el('button', { class: 'btn btn-green', id: 'timer-finish-btn', onClick: () => endEarly({ discardable: false }) }, ic('check', { size: 13 }), 'Finish & log'),
      el('button', { class: 'btn', id: 'timer-zen-btn', title: 'Zen fullscreen (z)', onClick: toggleZen }, ic('expand', { size: 13 }), 'Zen'),
      el('button', { class: 'btn btn-danger', id: 'timer-end-btn', onClick: () => endEarly({ discardable: true }) }, onBreak ? 'End cycle' : 'End'),
    ),
  );
}

function setupCard() {
  const s = store.state;
  if (selSkillId && !skillById(selSkillId)) selSkillId = null;
  if (!selSkillId && s.skills.length) selSkillId = s.skills[s.skills.length - 1].id;

  const chips = s.skills.map((sk) => el('button', {
    class: 'skill-chip' + (sk.id === selSkillId ? ' sel' : ''),
    style: sk.id === selSkillId ? { background: sk.color } : {},
    dataset: { skill: sk.name },
    onClick: () => { selSkillId = sk.id; sfx.click(); store.notify(); },
  }, `${sk.emoji} ${sk.name}`));
  chips.push(el('button', {
    class: 'skill-chip', onClick: async () => {
      const sk = await openSkillEditor();
      if (sk) { selSkillId = sk.id; store.notify(); }
    },
  }, '＋ new'));

  const durs = [15, 25, 45, 60];
  const customIn = el('input', {
    class: 'input dur-custom', type: 'number', min: '1', max: '240', id: 'dur-custom-in',
    placeholder: '…', value: durs.includes(selDur) ? '' : selDur,
    onInput: (e) => { const v = parseInt(e.target.value, 10); if (v > 0) { selDur = Math.min(v, 240); refreshDur(); } },
  });
  const durChips = durs.map((d) => el('button', {
    class: 'dur-chip' + (d === selDur ? ' sel' : ''), dataset: { min: d },
    onClick: () => { selDur = d; customIn.value = ''; sfx.click(); refreshDur(); },
  }, `${d}m`));

  // single session vs pomodoro cycles
  const breakChips = [5, 10].map((b) => el('button', {
    class: 'dur-chip' + (b === selBreak ? ' sel' : ''), dataset: { brk: b },
    onClick: () => { selBreak = b; sfx.click(); breakChips.forEach((c) => c.classList.toggle('sel', parseInt(c.dataset.brk, 10) === selBreak)); },
  }, `${b}m break`));
  const breakRow = el('div', { class: 'dur-chips', style: { display: selMode === 'cycle' ? '' : 'none', margin: '4px 0 0' } }, ...breakChips);
  const modeChips = [['single', 'Single session'], ['cycle', 'Cycles']].map(([m, label]) => el('button', {
    class: 'dur-chip' + (selMode === m ? ' sel' : ''), dataset: { mode: m },
    onClick: () => {
      selMode = m;
      sfx.click();
      modeChips.forEach((c) => c.classList.toggle('sel', c.dataset.mode === selMode));
      breakRow.style.display = selMode === 'cycle' ? '' : 'none';
      refreshDur();
    },
  }, m === 'cycle' ? el('span', { class: 'row', style: { gap: '5px' } }, ic('repeat', { size: 12 }), label) : label));

  function refreshDur() {
    durChips.forEach((c) => c.classList.toggle('sel', parseInt(c.dataset.min, 10) === selDur));
    startBtn.textContent = selMode === 'cycle' ? `Start ${selDur}m rounds` : `Start ${selDur}m of focus`;
  }

  const startBtn = el('button', {
    class: 'btn btn-primary btn-big', id: 'timer-start-btn',
    onClick: () => {
      if (!selSkillId) { sfx.uhoh(); toast('Pick a plant to water first 🌱', '🪴'); return; }
      startTimer(selSkillId, selDur);
    },
  }, selMode === 'cycle' ? `Start ${selDur}m rounds` : `Start ${selDur}m of focus`);

  return el('div', { class: 'card focus-hero' },
    el('h2', {}, 'Grow some ', el('em', { class: 'squiggle' }, 'focus')),
    el('p', { class: 'muted', style: { marginTop: '10px' } }, 'Pick a plant, pick a time. Every focused minute becomes XP.'),
    s.skills.length
      ? el('div', { class: 'skill-pick' }, ...chips)
      : el('div', { style: { margin: '16px 0' } },
          el('button', { class: 'btn btn-primary btn-big', onClick: async () => { const sk = await openSkillEditor(); if (sk) { selSkillId = sk.id; store.notify(); } } }, ic('pot', { size: 15 }), 'Plant your first skill'),
        ),
    el('div', { class: 'dur-chips', style: { marginBottom: '2px' } }, ...modeChips),
    el('div', { class: 'dur-chips' }, ...durChips, customIn),
    breakRow,
    el('div', { style: { marginTop: '14px' } }, startBtn),
  );
}

function manualCard() {
  const minutesIn = el('input', { class: 'input', type: 'number', min: '1', max: '1440', placeholder: 'min', id: 'manual-min-in', style: { width: '90px' } });
  const dateIn = el('input', { class: 'input', type: 'date', value: todayYmd(), id: 'manual-date-in' });
  let skillId = selSkillId || '';
  const sel = skillSelect({ value: skillId, allowNone: false, noneLabel: 'pick a plant', id: 'manual-skill-in', onChange: (id) => { skillId = id; } });
  if (!store.state.skills.length) sel.value = '';

  function submit() {
    const min = parseInt(minutesIn.value, 10);
    if (!skillId || !skillById(skillId)) { sfx.uhoh(); toast('Pick a plant first 🌱', '🪴'); return; }
    if (!min || min < 1) { minutesIn.focus(); return; }
    logSession({ skillId, minutes: min, date: dateIn.value || todayYmd(), source: 'manual' });
  }

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Log time ', el('em', {}, 'yourself')), ic('pencil', { size: 15, cls: 'title-ic' })),
    quickLogBox(),
    el('div', { class: 'row gap wrap', style: { marginTop: '14px', paddingTop: '14px', borderTop: '1.5px dashed var(--line-strong)' } },
      sel, minutesIn, dateIn,
      el('button', { class: 'btn', id: 'manual-add-btn', onClick: submit }, 'Add'),
    ),
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
            el('span', {}, sk ? `${sk.emoji} ${sk.name}` : '(removed)'),
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
      : el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('hourglass', { size: 26 })), 'No sessions yet — start the timer or quick-log above.'),
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
