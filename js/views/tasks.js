// views/tasks.js — to-do list. Completing a linked task feeds its plant (+10 XP).
import { el, relDue, todayYmd, dayDiff, fmtDate, nextOccurrence } from '../util.js';
import { store, uid } from '../store.js';
import { toast, confirmDialog } from '../ui.js';
import { sfx } from '../audio.js';
import { burst } from '../confetti.js';
import { skillById, levelOf, celebrateIfLeveled } from '../progress.js';
import { skillSelect } from '../skillEditor.js';
import { ic } from '../icons.js';

const draft = { title: '', due: '', skillId: '', priority: 0 };
let filterSkill = 'all';
let doneOpen = false;

export function toggleTask(t, ev) {
  const before = t.skillId ? levelOf(t.skillId).level : null;

  // recurring: completing banks the XP and rolls the due date forward
  if (t.repeat && !t.done) {
    t.doneAt = new Date().toISOString();
    t.completions = (t.completions || 0) + 1;
    t.due = nextOccurrence(t.due || todayYmd(), t.repeat);
    store.save();
    sfx.pop();
    burst(ev?.clientX || innerWidth / 2, ev?.clientY || 200, { count: 16 });
    if (t.skillId && before != null && celebrateIfLeveled(t.skillId, before)) return;
    toast(`Done — comes back ${relDue(t.due)}`, '🌱');
    return;
  }

  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  store.save();
  if (t.done) {
    sfx.pop();
    burst(ev?.clientX || innerWidth / 2, ev?.clientY || 200, { count: 16 });
    if (t.skillId && before != null && !celebrateIfLeveled(t.skillId, before)) {
      const sk = skillById(t.skillId);
      if (sk) toast(`+10 XP → ${sk.name}`, sk.emoji);
    }
  }
}

function deleteTask(t) {
  store.state.tasks = store.state.tasks.filter((x) => x.id !== t.id);
  store.save();
}

export function taskRow(t, { showDue = true } = {}) {
  const sk = t.skillId ? skillById(t.skillId) : null;
  const titleSpan = el('span', { class: 'task-title' }, t.title);

  function startEdit() {
    const input = el('input', { class: 'input', value: t.title, style: { padding: '4px 10px' } });
    const commit = () => {
      const v = input.value.trim();
      if (v && v !== t.title) { t.title = v; store.save(); }
      else input.replaceWith(titleSpan);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') input.replaceWith(titleSpan); });
    input.addEventListener('blur', commit);
    titleSpan.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  const chips = [];
  if (showDue && t.due && !t.done) {
    const diff = dayDiff(todayYmd(), t.due);
    chips.push(el('span', { class: 'chip ' + (diff < 0 ? 'overdue' : diff === 0 ? 'due-today' : '') }, ic('calendar', { size: 11 }), relDue(t.due)));
  }
  if (t.repeat) chips.push(el('span', { class: 'chip lilac' }, ic('repeat', { size: 10 }), t.repeat));
  if (sk) chips.push(el('span', { class: 'chip', style: { background: sk.color + '30' } }, `${sk.emoji} ${sk.name}`));
  if (t.priority === 2 && !t.done) chips.push(el('span', { class: 'chip coral' }, '‼ high'));
  if (t.priority === 1 && !t.done) chips.push(el('span', { class: 'chip sun' }, '! medium'));

  return el('div', { class: 'task-row' + (t.done ? ' done' : ''), dataset: { id: t.id } },
    el('button', {
      class: 'check' + (t.done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!t.done),
      'aria-label': (t.done ? 'Uncheck ' : 'Complete ') + t.title,
      onClick: (e) => toggleTask(t, e),
    }, el('span', { class: 'checkmark' }, '✓')),
    el('div', { class: 'task-main' }, titleSpan, ...chips),
    el('div', { class: 'task-actions' },
      el('button', { class: 'icon-btn', 'aria-label': 'Edit task', onClick: startEdit }, ic('pencil', { size: 14 })),
      el('button', { class: 'icon-btn', 'aria-label': 'Delete task', onClick: () => deleteTask(t) }, ic('trash', { size: 14 })),
    ),
  );
}

const bySort = (a, b) => (b.priority - a.priority) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt);

function addForm() {
  const titleIn = el('input', {
    class: 'input grow', id: 'task-title-in', placeholder: 'Add a task… (e.g. Finish physics worksheet)',
    value: draft.title,
    onInput: (e) => { draft.title = e.target.value; },
    onKeydown: (e) => { if (e.key === 'Enter') submit(); },
  });
  const dueIn = el('input', { class: 'input', type: 'date', id: 'task-due-in', value: draft.due, onInput: (e) => { draft.due = e.target.value; } });
  const skillSel = skillSelect({
    value: draft.skillId, allowNone: true, noneLabel: 'no plant', id: 'task-skill-in',
    onChange: (id) => { draft.skillId = id || ''; },
  });
  skillSel.style.width = 'auto';
  const prioLabels = ['⚑ none', '! medium', '‼ high'];
  const prioBtn = el('button', {
    class: 'btn', id: 'task-prio-in', type: 'button',
    onClick: () => { draft.priority = (draft.priority + 1) % 3; prioBtn.textContent = prioLabels[draft.priority]; sfx.click(); },
  }, prioLabels[draft.priority]);
  const repeatSel = el('select', { class: 'input', id: 'task-repeat-in', style: { width: 'auto' }, onChange: (e) => { draft.repeat = e.target.value; } },
    el('option', { value: '' }, 'no repeat'),
    el('option', { value: 'daily' }, 'daily'),
    el('option', { value: 'weekly' }, 'weekly'),
    el('option', { value: 'monthly' }, 'monthly'),
  );
  repeatSel.value = draft.repeat || '';

  function submit() {
    const title = titleIn.value.trim();
    if (!title) { titleIn.focus(); return; }
    store.state.tasks.push({
      id: uid(), title, done: false, doneAt: null,
      due: draft.due || (draft.repeat ? todayYmd() : null), // repeating tasks need a first date
      skillId: draft.skillId || null, priority: draft.priority,
      repeat: draft.repeat || null, completions: 0,
      createdAt: new Date().toISOString(),
    });
    Object.assign(draft, { title: '', due: '', skillId: '', priority: 0, repeat: '' });
    sfx.click();
    store.save();
  }

  return el('div', { class: 'add-task-form' },
    titleIn, dueIn, repeatSel, skillSel, prioBtn,
    el('button', { class: 'btn btn-primary', id: 'task-add-btn', onClick: submit }, '＋ Add'),
  );
}

export function render(root) {
  const s = store.state;
  const today = todayYmd();
  let open = s.tasks.filter((t) => !t.done);
  const doneTasks = s.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  if (filterSkill !== 'all') open = open.filter((t) => t.skillId === filterSkill);

  const overdue = open.filter((t) => t.due && t.due < today).sort(bySort);
  const dueToday = open.filter((t) => t.due === today).sort(bySort);
  const upcoming = open.filter((t) => t.due && t.due > today).sort(bySort);
  const someday = open.filter((t) => !t.due).sort(bySort);

  const upcomingByDate = new Map();
  for (const t of upcoming) {
    if (!upcomingByDate.has(t.due)) upcomingByDate.set(t.due, []);
    upcomingByDate.get(t.due).push(t);
  }

  const filterRow = s.skills.length
    ? el('div', { class: 'row gap wrap', style: { margin: '14px 0 2px' } },
        el('button', { class: 'chip chip-btn' + (filterSkill === 'all' ? ' sel' : ''), onClick: () => { filterSkill = 'all'; store.notify(); } }, 'All'),
        ...s.skills.map((sk) => el('button', {
          class: 'chip chip-btn' + (filterSkill === sk.id ? ' sel' : ''),
          onClick: () => { filterSkill = filterSkill === sk.id ? 'all' : sk.id; store.notify(); },
        }, `${sk.emoji} ${sk.name}`)),
      )
    : null;

  const sections = [];
  const section = (label, chipClass, tasks) => {
    if (!tasks.length) return;
    sections.push(el('div', { class: 'group-label' }, el('span', { class: 'chip ' + chipClass }, label), `${tasks.length}`));
    sections.push(...tasks.map((t) => taskRow(t)));
  };
  section('Overdue', 'overdue', overdue);
  section('Today', 'due-today', dueToday);
  for (const [date, ts] of upcomingByDate) section('📅 ' + relDue(date), 'lilac', ts);
  section('Someday', '', someday);

  if (!sections.length) {
    sections.push(el('div', { class: 'empty', style: { marginTop: '14px' } },
      el('span', { class: 'big' }, ic('leaf', { size: 26 })),
      filterSkill === 'all' ? 'Nothing to do — add your first task above!' : 'No open tasks for this plant.',
    ));
  }

  const doneSection = doneTasks.length
    ? el('details', { class: 'done-details', open: doneOpen, onToggle: (e) => { doneOpen = e.target.open; } },
        el('summary', {}, `Done · ${doneTasks.length} `,
          el('button', {
            class: 'link-btn', onClick: async (e) => {
              e.preventDefault(); e.stopPropagation();
              if (await confirmDialog(`Clear ${doneTasks.length} completed ${doneTasks.length === 1 ? 'task' : 'tasks'}? Their XP stays in your garden.`, { yes: 'Clear' })) {
                store.state.tasks = store.state.tasks.filter((t) => !t.done);
                store.save();
              }
            },
          }, 'clear'),
        ),
        ...doneTasks.slice(0, 30).map((t) => taskRow(t)),
      )
    : null;

  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Your ', el('em', { class: 'squiggle' }, 'tasks'), ' ', ic('check-square', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, 'Link a task to a plant — finishing it feeds the plant +10 XP.'),
      ),
    ),
    el('div', { class: 'card', style: { marginTop: '20px' } }, addForm(), filterRow),
    el('div', { class: 'card' }, ...sections, doneSection ? el('div', { style: { marginTop: '14px' } }, doneSection) : null),
  );
}
