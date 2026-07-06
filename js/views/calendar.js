// views/calendar.js — month grid where events, task due-dates and focus sessions all meet.
import { el, ymd, fromYmd, todayYmd, fmtMonth, fmtDate, fmtMin, addDays, dayDiff, eventOccursOn } from '../util.js';
import { store, uid } from '../store.js';
import { confirmDialog, toast } from '../ui.js';
import { sfx } from '../audio.js';
import { skillById, minutesOn } from '../progress.js';
import { skillSelect } from '../skillEditor.js';
import { taskRow } from './tasks.js';
import { ic } from '../icons.js';

const now = new Date();
let viewY = now.getFullYear();
let viewM = now.getMonth();
let selected = todayYmd();
let editingId = null;
const eventDraft = { title: '', time: '', skillId: '' };

function eventsOn(date) {
  return store.state.events.filter((e) => eventOccursOn(e, date)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}
function tasksDue(date) {
  return store.state.tasks.filter((t) => t.due === date).sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority);
}

function monthGrid(rr) {
  const first = new Date(viewY, viewM, 1);
  const startIdx = (first.getDay() + 6) % 7; // Monday-first
  const cells = [];
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => el('div', { class: 'cal-dow' }, d));
  const today = todayYmd();
  for (let i = 0; i < 42; i++) {
    const d = new Date(viewY, viewM, 1 - startIdx + i, 12);
    const dY = ymd(d);
    const other = d.getMonth() !== viewM;
    const evs = eventsOn(dY);
    const due = tasksDue(dY);
    const openDue = due.filter((t) => !t.done);
    const focusMin = store.state.sessions.reduce((a, s) => a + (s.date === dY ? s.minutes : 0), 0);

    // uniform cells: day number + tiny markers, click for the full day
    const dots = [];
    for (const ev of evs.slice(0, 3)) dots.push(el('span', { class: 'cal-dot', style: { background: ev.color } }));
    if (openDue.length) dots.push(el('span', { class: 'cal-dot task', title: `${openDue.length} due` }));
    if (focusMin > 0) dots.push(el('span', { class: 'cal-dot focus' }));

    const bits = [];
    if (evs.length) bits.push(`${evs.length} event${evs.length > 1 ? 's' : ''}`);
    if (due.length) bits.push(`${due.length} task${due.length > 1 ? 's' : ''} due`);
    if (focusMin) bits.push(`${fmtMin(focusMin)} focus`);

    cells.push(el('button', {
      class: 'cal-cell' + (other ? ' other' : '') + (dY === today ? ' today' : '') + (dY === selected ? ' selected' : ''),
      dataset: { date: dY },
      'aria-label': fmtDate(dY) + (bits.length ? ' — ' + bits.join(', ') : ''),
      title: bits.join(' · '),
      onClick: () => {
        selected = dY;
        editingId = null;
        if (other) { viewY = d.getFullYear(); viewM = d.getMonth(); }
        sfx.click();
        rr();
        if (innerWidth <= 1060) setTimeout(() => document.querySelector('.day-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      },
    },
      el('span', { class: 'cal-num' }, d.getDate()),
      dots.length ? el('div', { class: 'cal-dots' }, ...dots) : null,
    ));
  }
  return el('div', {},
    el('div', { class: 'cal-head' },
      el('button', { class: 'icon-btn', 'aria-label': 'Previous month', onClick: () => { viewM--; if (viewM < 0) { viewM = 11; viewY--; } sfx.click(); rr(); } }, '‹'),
      el('span', { class: 'cal-title' }, fmtMonth(viewY, viewM)),
      el('button', { class: 'icon-btn', 'aria-label': 'Next month', onClick: () => { viewM++; if (viewM > 11) { viewM = 0; viewY++; } sfx.click(); rr(); } }, '›'),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn', onClick: () => { const n = new Date(); viewY = n.getFullYear(); viewM = n.getMonth(); selected = todayYmd(); sfx.click(); rr(); } }, 'Today'),
    ),
    el('div', { class: 'cal-grid', style: { marginBottom: '6px' } }, ...dows),
    el('div', { class: 'cal-grid' }, ...cells),
  );
}

function dayPanel(rr) {
  const evs = eventsOn(selected);
  const due = tasksDue(selected);
  const sessions = store.state.sessions.filter((s) => s.date === selected);
  const editing = editingId ? store.state.events.find((e) => e.id === editingId) : null;

  const diff = dayDiff(todayYmd(), selected);
  const label = diff === 0 ? 'Today · ' : diff === 1 ? 'Tomorrow · ' : diff === -1 ? 'Yesterday · ' : '';

  // ---- add / edit event form ----
  const titleIn = el('input', {
    class: 'input', id: 'event-title-in', placeholder: editing ? 'Event title' : '＋ Add an event…',
    value: editing ? editing.title : eventDraft.title,
    onInput: (e) => { if (!editing) eventDraft.title = e.target.value; },
    onKeydown: (e) => { if (e.key === 'Enter') submit(); },
  });
  const timeIn = el('input', {
    class: 'input', type: 'time', id: 'event-time-in',
    value: editing ? (editing.time || '') : eventDraft.time,
    onInput: (e) => { if (!editing) eventDraft.time = e.target.value; },
  });
  const skillSel = skillSelect({
    value: editing ? (editing.skillId || '') : eventDraft.skillId,
    noneLabel: 'no plant', id: 'event-skill-in',
    onChange: (id) => { if (!editing) eventDraft.skillId = id || ''; else { editing.skillId = id; } },
  });
  const repeatSel = el('select', { class: 'input', id: 'event-repeat-in', style: { width: 'auto' }, onChange: (e) => { if (!editing) eventDraft.repeat = e.target.value; } },
    el('option', { value: '' }, 'once'),
    el('option', { value: 'daily' }, 'daily'),
    el('option', { value: 'weekly' }, 'weekly'),
    el('option', { value: 'monthly' }, 'monthly'),
  );
  repeatSel.value = editing ? (editing.repeat || '') : (eventDraft.repeat || '');

  function submit() {
    const title = titleIn.value.trim();
    if (!title) { titleIn.focus(); return; }
    const skillId = editing ? editing.skillId : (eventDraft.skillId || null);
    const sk = skillId ? skillById(skillId) : null;
    const color = sk ? sk.color : '#D89B8A';
    if (editing) {
      Object.assign(editing, { title, time: timeIn.value || null, skillId, color, repeat: repeatSel.value || null });
      editingId = null;
    } else {
      store.state.events.push({ id: uid(), title, date: selected, time: timeIn.value || null, skillId, color, repeat: repeatSel.value || null, except: [], createdAt: new Date().toISOString() });
      Object.assign(eventDraft, { title: '', time: '', skillId: '', repeat: '' });
    }
    sfx.click();
    store.save();
  }

  const quickTask = el('input', {
    class: 'input', id: 'day-quick-task', placeholder: '＋ Add a task due this day…',
    onKeydown: (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        store.state.tasks.push({ id: uid(), title: e.target.value.trim(), done: false, doneAt: null, due: selected, skillId: null, priority: 0, createdAt: new Date().toISOString() });
        sfx.click();
        store.save();
      }
    },
  });

  const focusBySkill = new Map();
  for (const s of sessions) focusBySkill.set(s.skillId, (focusBySkill.get(s.skillId) || 0) + s.minutes);

  return el('div', { class: 'card day-panel' },
    el('h3', {}, label + fmtDate(selected)),
    el('div', { class: 'field-label' }, 'Events'),
    evs.length
      ? el('div', {}, ...evs.map((ev) => el('div', { class: 'event-row' },
          el('div', { class: 'event-bar', style: { background: ev.color } }),
          el('span', { class: 'event-time' }, ev.time || 'all day'),
          el('span', { class: 'event-title' }, ev.title, ev.repeat ? el('span', { class: 'chip lilac', style: { marginLeft: '7px' } }, ic('repeat', { size: 10 }), ev.repeat) : null),
          el('div', { class: 'task-actions' },
            ev.repeat ? el('button', {
              class: 'icon-btn', 'aria-label': 'Skip this day', title: 'Skip just this day',
              onClick: () => {
                ev.except = ev.except || [];
                ev.except.push(selected);
                store.save();
                toast(`Skipped for ${fmtDate(selected)}`, '🌿');
              },
            }, ic('x-circle', { size: 14 })) : null,
            el('button', { class: 'icon-btn', 'aria-label': 'Edit event', onClick: () => { editingId = ev.id; rr(); } }, ic('pencil', { size: 14 })),
            el('button', {
              class: 'icon-btn', 'aria-label': 'Delete event',
              onClick: async () => {
                const msg = ev.repeat ? `“${ev.title}” repeats ${ev.repeat} — delete the whole series?` : `Delete “${ev.title}”?`;
                if (await confirmDialog(msg, { yes: ev.repeat ? 'Delete series' : 'Delete' })) {
                  store.state.events = store.state.events.filter((x) => x.id !== ev.id);
                  store.save();
                }
              },
            }, ic('trash', { size: 14 })),
          ),
        )))
      : el('p', { class: 'muted small', style: { padding: '2px 4px 6px' } }, 'Nothing scheduled.'),
    el('div', { class: 'col', style: { gap: '8px', marginTop: '6px' } },
      titleIn,
      el('div', { class: 'row gap wrap' }, timeIn, repeatSel, skillSel),
      el('div', { class: 'row gap' },
        el('button', { class: 'btn btn-primary', id: 'event-add-btn', onClick: submit }, editing ? 'Save event' : '＋ Add event'),
        editing ? el('button', { class: 'link-btn', onClick: () => { editingId = null; rr(); } }, 'cancel') : null,
      ),
    ),
    el('div', { class: 'field-label' }, 'Tasks due'),
    due.length ? el('div', {}, ...due.map((t) => taskRow(t, { showDue: false }))) : el('p', { class: 'muted small', style: { padding: '2px 4px 6px' } }, 'No tasks due.'),
    el('div', { style: { marginTop: '8px' } }, quickTask),
    el('div', { class: 'field-label' }, 'Focus that day'),
    sessions.length
      ? el('div', {},
          ...[...focusBySkill].map(([skid, min]) => {
            const sk = skillById(skid);
            return el('div', { class: 'session-row' },
              el('span', {}, sk ? `${sk.emoji} ${sk.name}` : 'unknown'),
              el('span', { class: 'spacer' }),
              el('span', { class: 'chip green' }, fmtMin(min)));
          }),
          el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '6px' } },
            el('span', { class: 'chip lilac' }, `total ${fmtMin(minutesOn(selected))}`)),
        )
      : el('p', { class: 'muted small', style: { padding: '2px 4px' } }, diff > 0 ? 'The future is unwritten.' : 'No focus logged.'),
  );
}

export function render(root) {
  const rr = () => { root.innerHTML = ''; render(root); };
  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Your ', el('em', { class: 'squiggle' }, 'month'), ' ', ic('calendar', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, 'Events, due tasks and focus dots — your month at a glance.'),
      ),
    ),
    el('div', { class: 'cal-wrap', style: { marginTop: '20px' } },
      el('div', { class: 'card' }, monthGrid(rr)),
      dayPanel(rr),
    ),
  );
}
