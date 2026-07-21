// views/today.js — dashboard: greeting, stats, today's plan, quick log, up next, garden peek.
import { el, todayYmd, fmtMin, fmtLongDate, fmtTime, fmtDateShort, fromYmd, ymd, addDays, relDue, weekStart, eventOccursOn, pad2 } from '../util.js';
import { ic } from '../icons.js';
import { store, uid } from '../store.js';
import { sfx } from '../audio.js';
import { streak, minutesOn, weekMinutes, lastNDays, levelOf, xpOf, tasksDoneOn } from '../progress.js';
import { barChartSVG, dayLabels7 } from '../charts.js';
import { plantSVG } from '../plant.js';
import { taskRow } from './tasks.js';
import { quickLogBox } from '../quicklog.js';
import { cloudConfigured, signedIn } from '../cloud.js';

let chartRange = 'week'; // week | month | year — survives re-renders

// focus chart with a range switcher and the range's total
function focusChartCard(s) {
  const today = todayYmd();
  let values, labels, titles = null;
  if (chartRange === 'week') {
    values = lastNDays(7);
    labels = dayLabels7();
    const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    titles = [];
    for (let i = 6; i >= 0; i--) {
      const ds = addDays(today, -i);
      titles.push(i === 0 ? 'Today' : `${WD[fromYmd(ds).getDay()]}, ${fmtDateShort(ds)}`);
    }
  } else if (chartRange === 'month') {
    values = lastNDays(30);
    labels = []; titles = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      titles.push(fmtDateShort(d));
      labels.push(i % 5 === 0 ? d.slice(8).replace(/^0/, '') : '');
    }
  } else {
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const byMonth = new Map();
    labels = []; titles = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      byMonth.set(key, 0);
      labels.push(MO[d.getMonth()][0]);
      titles.push(`${MO[d.getMonth()]} ${d.getFullYear()}`);
    }
    for (const sess of s.sessions) {
      const key = sess.date.slice(0, 7);
      if (byMonth.has(key)) byMonth.set(key, byMonth.get(key) + sess.minutes);
    }
    values = [...byMonth.values()];
  }
  const total = values.reduce((a, b) => a + b, 0);
  const rangeChip = (key, label) => el('button', {
    class: 'chip chip-btn' + (chartRange === key ? ' sel' : ''),
    onClick: () => { chartRange = key; sfx.click(); store.notify(); },
  }, label);
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Your ', el('em', {}, 'focus')), ic('bars', { size: 15, cls: 'title-ic' }),
      el('span', { class: 'spacer' }),
      rangeChip('week', 'week'), rangeChip('month', 'month'), rangeChip('year', 'year'),
    ),
    focusChartWithTip(values, labels, titles),
    el('p', { class: 'muted small', style: { marginTop: '8px' } },
      total ? `${fmtMin(total)} focused this ${chartRange}` : `nothing this ${chartRange} yet — the bars are waiting`),
  );
}

// bar chart wrapped with a styled tooltip that follows the hovered column
function focusChartWithTip(values, labels, titles) {
  const wrap = el('div', { class: 'chart-tip-wrap', html: barChartSVG(values, labels, { maxW: chartRange === 'week' ? 340 : 420, titles }) });
  const tip = el('div', { class: 'chart-tip' });
  wrap.append(tip);
  wrap.addEventListener('mousemove', (e) => {
    const col = e.target.closest('.bar-col');
    if (!col) { tip.classList.remove('show'); return; }
    const min = +col.dataset.min;
    tip.textContent = `${col.dataset.tip} · ${min ? `${fmtMin(min)} focused` : 'no focus'}`;
    const wb = wrap.getBoundingClientRect();
    const b = col.querySelector('.bar-rect').getBoundingClientRect();
    // clamp inside the card so edge bars don't get their bubble cut off
    const half = tip.offsetWidth / 2 + 4;
    tip.style.left = `${Math.min(Math.max(b.x - wb.x + b.width / 2, half), wb.width - half)}px`;
    tip.style.top = `${Math.min(b.y - wb.y, wrap.clientHeight * 0.5) - 7}px`;
    tip.classList.add('show');
  });
  wrap.addEventListener('mouseleave', () => tip.classList.remove('show'));
  return wrap;
}

// a simple weekly checklist — add things for the week, they stay all week, check them off
function weekTasksCard(s) {
  const wk = weekStart();
  const tasks = s.weeklyTasks.filter((t) => t.week === wk)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
  const done = tasks.filter((t) => t.done).length;

  const addIn = el('input', {
    class: 'input', id: 'week-task-in', placeholder: '＋ Add something for this week…', autocomplete: 'off',
    onKeydown: (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        s.weeklyTasks.push({ id: uid(), title: e.target.value.trim(), done: false, doneAt: null, week: wk, createdAt: new Date().toISOString() });
        sfx.click();
        store.save();
      }
    },
  });

  const row = (t) => el('div', { class: 'task-row' + (t.done ? ' done' : ''), dataset: { id: t.id } },
    el('button', {
      class: 'check' + (t.done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!t.done),
      'aria-label': (t.done ? 'Uncheck ' : 'Done ') + t.title,
      onClick: () => { t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; t.done ? sfx.pop() : sfx.click(); store.save(); },
    }, el('span', { class: 'checkmark' }, '✓')),
    el('div', { class: 'task-main' }, el('span', { class: 'task-title' }, t.title)),
    el('div', { class: 'task-actions' },
      el('button', {
        class: 'icon-btn', 'aria-label': 'Delete',
        onClick: () => { s.weeklyTasks = s.weeklyTasks.filter((x) => x.id !== t.id); store.save(); },
      }, ic('trash', { size: 14 }))),
  );

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'This ', el('em', {}, 'week')), ic('check-square', { size: 15, cls: 'title-ic' }),
      el('span', { class: 'spacer' }),
      tasks.length ? el('span', { class: 'chip lilac' }, `${done}/${tasks.length}`) : null),
    tasks.length
      ? el('div', {}, ...tasks.map(row))
      : el('p', { class: 'muted small', style: { padding: '2px 4px 8px' } }, 'What do you want to get done this week?'),
    el('div', { style: { marginTop: '8px' } }, addIn),
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ['Night owl mode', 'moon'];
  if (h < 12) return ['Good morning', 'sun'];
  if (h < 18) return ['Good afternoon', 'sun'];
  return ['Good evening', 'moon'];
}

// one quote per day — rotates on the day of the year so it never feels stuck
const QUOTES = [
  ['Little by little, a little becomes a lot.', 'Tanzanian proverb'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb'],
  ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
  ['Small steps, every day — that’s how gardens grow.', null],
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Great things are done by a series of small things brought together.', 'Vincent van Gogh'],
  ['We are what we repeatedly do.', 'Will Durant'],
  ['No rain, no flowers.', null],
  ['Well begun is half done.', 'Aristotle'],
  ['Your plants are rooting for you.', null],
  ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['Where flowers bloom, so does hope.', 'Lady Bird Johnson'],
  ['One focused hour beats a busy day.', null],
  ['A year from now you may wish you had started today.', 'Karen Lamb'],
  ['How we spend our days is how we spend our lives.', 'Annie Dillard'],
  ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Every flower must grow through dirt.', null],
  ['You don’t have to be great to start, but you have to start to be great.', 'Zig Ziglar'],
  ['Water something today — future you says thanks.', null],
  ['A river cuts through rock not because of its power, but its persistence.', 'Jim Watkins'],
  ['Motivation gets you going; habit gets you there.', 'Zig Ziglar'],
  ['What are you growing today?', null],
  ['Diligence is the mother of good luck.', 'Benjamin Franklin'],
];
function dailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

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
  const [quote, quoteBy] = dailyQuote();

  const doneToday = tasksDoneOn(today);

  // -------- today's plan: strictly today (overdue lives in Tasks) --------
  const planTasks = s.tasks.filter((t) => !t.done && t.due === today)
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
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
            el('span', { class: 'event-time' }, ev.time ? fmtTime(ev.time, s.settings.hour24) : 'all day'),
            el('span', { class: 'event-title' }, ev.title),
          )))
      : null,
    planTasks.length
      ? el('div', {}, ...planTasks.map((t) => taskRow(t, { showDue: false })))
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
      ? el('div', { class: 'row', style: { justifyContent: 'center', gap: '44px', alignItems: 'flex-end' } },
          ...topSkills.map((sk) => {
            const lv = levelOf(sk.id);
            return el('a', { href: '#/garden', style: { textAlign: 'center', color: 'inherit' } },
              el('div', { class: 'peek-pot', html: plantSVG(sk, lv.level, 74) }),
              el('div', { class: 'row', style: { fontWeight: '800', fontSize: '12.5px', justifyContent: 'center', gap: '5px', marginTop: '4px' } }, ic((sk.icon || 'sprout'), { size: 12, cls: 'title-ic' }), sk.name),
              el('div', { class: 'muted small' }, `Lv ${lv.level} · ${fmtMin(weekMinutes(sk.id))} this wk`),
            );
          }))
      : el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('pot', { size: 26 })), 'No plants yet — add some time below or visit the garden.'),
  );
  // the plant art carries empty sky above it — crop it off so labels hug the pot (zen's fitPlant trick).
  // getBBox needs the SVG painted, so try shortly after render and once more as a safety net.
  const cropPots = () => {
    for (const svg of peek.querySelectorAll('.peek-pot svg')) {
      if (svg.style.marginTop) continue; // already cropped
      let top = Infinity;
      for (const k of svg.children) {
        try { const b = k.getBBox(); if (b.width || b.height) top = Math.min(top, b.y); } catch { /* not rendered */ }
      }
      if (!isFinite(top) || top <= 4) continue;
      const scaleF = (svg.getBoundingClientRect().height || 92) / 150;
      svg.style.marginTop = `${(-(top - 4) * scaleF).toFixed(1)}px`;
    }
  };
  setTimeout(cropPots, 60);
  setTimeout(cropPots, 400);

  // -------- up next (7 days of events incl. repeats — tasks live in the week card) --------
  const nextItems = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    for (const e of s.events) if (eventOccursOn(e, d)) nextItems.push({ date: d, time: e.time, title: e.title, color: e.color });
  }
  nextItems.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  nextItems.length = Math.min(nextItems.length, 5);

  const upNext = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, el('h2', {}, 'Up ', el('em', {}, 'next')), ic('arrow', { size: 15, cls: 'title-ic' })),
    nextItems.length
      ? el('div', {}, ...nextItems.map((it) => el('div', { class: 'event-row' },
          el('div', { class: 'event-bar', style: { background: it.color || 'var(--track)' } }),
          el('span', { class: 'event-time' }, relDue(it.date)),
          el('span', { class: 'event-title' }, it.title),
          it.time ? el('span', { class: 'chip' }, fmtTime(it.time, s.settings.hour24)) : null,
        )))
      : el('p', { class: 'muted small', style: { padding: '2px 4px' } }, 'A clear week ahead.'),
  );

  // gentle nudge: your garden is only in this browser until you sign in
  const signinBanner = (cloudConfigured() && !signedIn())
    ? el('div', { class: 'signin-banner' },
        ic('flower', { size: 15 }),
        el('span', {}, 'Sign in once and your plants, tasks, calendar and name follow you to any device.'),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn-primary', onClick: () => window.dispatchEvent(new Event('bloom:open-settings')) }, 'Sign up / Sign in'),
      )
    : null;

  root.append(
    ...(signinBanner ? [signinBanner] : []),
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, `${greet}, `, el('em', {
          class: 'squiggle', role: 'button', tabindex: '0',
          style: { cursor: 'pointer' }, title: 'Click to change your name',
          onClick: () => window.dispatchEvent(new Event('bloom:open-settings')),
        }, name), ' ', ic(gEmoji, { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, fmtLongDate(today)),
        el('p', { class: 'daily-quote' }, `“${quote}”`, quoteBy ? el('span', { class: 'quote-by' }, ` — ${quoteBy}`) : null),
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
      el('div', { class: 'col' }, planCard, weekTasksCard(s), peek),
      el('div', { class: 'col' },
        el('div', { class: 'card' },
          el('div', { class: 'card-title' }, el('h2', {}, 'Add ', el('em', {}, 'time')), ic('bolt', { size: 15, cls: 'title-ic' })),
          quickLogBox(),
        ),
        focusChartCard(s),
        upNext,
      ),
    ),
  );
}
