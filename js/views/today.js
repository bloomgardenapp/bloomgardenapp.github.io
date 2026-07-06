// views/today.js — dashboard: greeting, stats, today's plan, quick log, up next, garden peek.
import { el, todayYmd, fmtMin, fmtLongDate, ymd, addDays, relDue, eventOccursOn } from '../util.js';
import { ic } from '../icons.js';
import { store, uid } from '../store.js';
import { sfx } from '../audio.js';
import { streak, minutesOn, weekMinutes, lastNDays, levelOf, xpOf, tasksDoneOn } from '../progress.js';
import { barChartSVG, dayLabels7 } from '../charts.js';
import { plantSVG } from '../plant.js';
import { taskRow } from './tasks.js';
import { quickLogBox } from '../quicklog.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ['Night owl mode', 'moon'];
  if (h < 12) return ['Good morning', 'sun'];
  if (h < 18) return ['Good afternoon', 'sun'];
  return ['Good evening', 'moon'];
}

const SUBS = [
  'Small steps, every day — that’s how gardens grow.',
  'What are you growing today?',
  'One focused hour beats a busy day.',
  'Your plants are rooting for you 🌱',
  'Water something today — future you says thanks.',
];

function stat(icon, tile, num, label) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-tile', style: { background: `var(--${tile})` } }, ic(icon, { size: 19 })),
    el('div', {},
      el('div', { class: 'stat-num' }, num),
      el('div', { class: 'stat-label' }, label),
    ),
  );
}

export function render(root) {
  const s = store.state;
  const today = todayYmd();
  const [greet, gEmoji] = greeting();
  const name = s.settings.name || 'friend';
  const sub = SUBS[new Date().getDate() % SUBS.length];

  const doneToday = tasksDoneOn(today);

  // -------- today's plan (overdue + due today + today's events, incl. repeating) --------
  const planTasks = s.tasks.filter((t) => !t.done && t.due && t.due <= today)
    .sort((a, b) => (a.due || '').localeCompare(b.due || '') || b.priority - a.priority);
  const eventsToday = s.events.filter((e) => eventOccursOn(e, today)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const quickAdd = el('input', {
    class: 'input', id: 'today-quick-task', placeholder: '＋ Add a task for today…',
    onKeydown: (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        store.state.tasks.push({ id: uid(), title: e.target.value.trim(), done: false, doneAt: null, due: today, skillId: null, priority: 0, createdAt: new Date().toISOString() });
        sfx.click();
        store.save();
      }
    },
  });

  const planCard = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, "Today's ", el('em', {}, 'plan')), ic('clipboard', { size: 15, cls: 'title-ic' }), el('span', { class: 'spacer' }),
      el('a', { class: 'link-btn', href: '#/calendar' }, 'calendar →')),
    eventsToday.length
      ? el('div', { style: { marginBottom: '10px' } },
          ...eventsToday.map((ev) => el('div', { class: 'event-row' },
            el('div', { class: 'event-bar', style: { background: ev.color } }),
            el('span', { class: 'event-time' }, ev.time || 'all day'),
            el('span', { class: 'event-title' }, ev.title),
          )))
      : null,
    planTasks.length
      ? el('div', {}, ...planTasks.map((t) => taskRow(t)))
      : el('div', { class: 'empty', style: { margin: '4px 0 10px' } }, el('span', { class: 'big' }, ic('leaf', { size: 26 })), 'Nothing due today — a fresh page.'),
    el('div', { style: { marginTop: '10px' } }, quickAdd),
  );

  // -------- garden peek --------
  const topSkills = [...s.skills]
    .sort((a, b) => weekMinutes(b.id) - weekMinutes(a.id) || xpOf(b.id) - xpOf(a.id))
    .slice(0, 3);
  const peek = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Garden ', el('em', {}, 'peek')), ic('sprout', { size: 15, cls: 'title-ic' }), el('span', { class: 'spacer' }),
      el('a', { class: 'link-btn', href: '#/garden' }, 'garden →')),
    topSkills.length
      ? el('div', { class: 'row gap', style: { justifyContent: 'space-around', alignItems: 'flex-end' } },
          ...topSkills.map((sk) => {
            const lv = levelOf(sk.id);
            return el('a', { href: '#/garden', style: { textAlign: 'center', color: 'inherit' } },
              el('div', { html: plantSVG(sk, lv.level, 74) }),
              el('div', { style: { fontWeight: '800', fontSize: '12.5px' } }, `${sk.emoji} ${sk.name}`),
              el('div', { class: 'muted small' }, `Lv ${lv.level} · ${fmtMin(weekMinutes(sk.id))} this wk`),
            );
          }))
      : el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('pot', { size: 26 })), 'No plants yet — log some time below or visit the garden.'),
  );

  // -------- up next (7 days of events incl. repeats + due tasks) --------
  const nextItems = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    for (const e of s.events) if (eventOccursOn(e, d)) nextItems.push({ date: d, time: e.time, title: e.title, color: e.color, kind: 'event' });
    for (const t of s.tasks) if (!t.done && t.due === d) nextItems.push({ date: d, time: null, title: t.title, color: null, kind: 'task' });
  }
  nextItems.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  nextItems.length = Math.min(nextItems.length, 5);

  const upNext = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Up ', el('em', {}, 'next')), ic('arrow', { size: 15, cls: 'title-ic' })),
    nextItems.length
      ? el('div', {}, ...nextItems.map((it) => el('div', { class: 'event-row' },
          el('div', { class: 'event-bar', style: { background: it.color || 'var(--track)' } }),
          el('span', { class: 'event-time' }, relDue(it.date)),
          el('span', { class: 'event-title' }, (it.kind === 'task' ? '☐ ' : '') + it.title),
          it.time ? el('span', { class: 'chip' }, it.time) : null,
        )))
      : el('p', { class: 'muted small', style: { padding: '2px 4px' } }, 'A clear week ahead.'),
  );

  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, `${greet}, `, el('em', {
          class: 'squiggle', role: 'button', tabindex: '0',
          style: { cursor: 'pointer' }, title: 'Click to change your name',
          onClick: () => window.dispatchEvent(new Event('bloom:open-settings')),
        }, name), ' ', ic(gEmoji, { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, `${fmtLongDate(today)} · ${sub}`),
      ),
      el('span', { class: 'spacer' }),
      el('a', { class: 'btn btn-primary btn-big', href: '#/focus' }, ic('hourglass', { size: 15 }), 'Start a focus'),
    ),
    el('div', { class: 'stats-row' },
      stat('flame', 'peach-soft', String(streak()), 'day streak'),
      stat('stopwatch', 'mint-soft', fmtMin(minutesOn(today)), 'focused today'),
      stat('check', 'green-soft', String(doneToday), 'tasks done today'),
      stat('sprout', 'sun-soft', fmtMin(weekMinutes()), 'grown this week'),
    ),
    el('div', { class: 'grid-2' },
      el('div', { class: 'col' }, planCard, peek),
      el('div', { class: 'col' },
        el('div', { class: 'card' },
          el('div', { class: 'card-title' }, el('h2', {}, 'Quick ', el('em', {}, 'log')), ic('bolt', { size: 15, cls: 'title-ic' })),
          quickLogBox(),
        ),
        el('div', { class: 'card' },
          el('div', { class: 'card-title' }, el('h2', {}, 'This ', el('em', {}, 'week')), ic('bars', { size: 15, cls: 'title-ic' }), el('span', { class: 'spacer' }),
            el('span', { class: 'chip green' }, fmtMin(weekMinutes()))),
          el('div', { html: barChartSVG(lastNDays(7), dayLabels7(), { maxW: 340 }) }),
        ),
        upNext,
      ),
    ),
  );
}
