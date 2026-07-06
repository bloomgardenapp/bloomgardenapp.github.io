// guide.js — paged "how Bloom works" tour. Opened from the ? button, and once after onboarding.
import { el } from './util.js';
import { openModal } from './ui.js';
import { plantSVG } from './plant.js';
import { TIERS } from './progress.js';
import { ic } from './icons.js';

const demoSkill = { id: 'guide-demo', name: 'Math', color: '#C97F5F' };

function iconLine(name, title, body) {
  return el('div', { class: 'guide-line' },
    el('span', { class: 'guide-line-ic' }, ic(name, { size: 17 })),
    el('div', {},
      el('div', { class: 'guide-line-title' }, title),
      el('div', { class: 'muted small' }, body),
    ),
  );
}

function pages() {
  return [
    {
      title: ['How your garden ', el('em', {}, 'grows')],
      body: el('div', {},
        el('div', { class: 'guide-plants' },
          ...[[1, 'sprout'], [4, 'bud'], [8, 'bloom'], [12, 'radiant']].map(([lv, label]) =>
            el('div', { class: 'guide-plant' },
              el('div', { html: plantSVG(demoSkill, lv, 62) }),
              el('div', { class: 'guide-plant-label' }, label),
            )),
        ),
        el('p', { class: 'guide-p' }, 'Every skill you practice is a plant. ', el('b', {}, '1 focused minute = 1 XP'), ', and finishing a task linked to a skill adds ', el('b', {}, '+10 XP'), '. XP raises the plant’s level, and the plant visibly grows — sprout, bud, bloom, radiant.'),
      ),
    },
    {
      title: ['Three ways to ', el('em', {}, 'water')],
      body: el('div', {},
        iconLine('hourglass', 'Focus timer', 'Pick a plant, pick 15–60 minutes, press start. When the ring completes, the minutes are logged for you.'),
        iconLine('bolt', 'Quick log', 'Type it like you’d say it — Bloom understands.'),
        el('div', { class: 'row gap wrap', style: { margin: '2px 0 12px 40px' } },
          el('span', { class: 'chip green' }, '“1h math”'),
          el('span', { class: 'chip green' }, '“30m spanish yesterday”'),
          el('span', { class: 'chip green' }, '“45m piano 2026-07-01”'),
        ),
        iconLine('pencil', 'Log it yourself', 'On the Focus page: choose plant, minutes and date — for time you forgot to track.'),
        iconLine('repeat', 'Cycles & zen', 'Pick “Cycles” for pomodoro rounds with little breaks in between. Press Zen (or Z) for a fullscreen timer where your plant grows live.'),
      ),
    },
    {
      title: ['Everything ', el('em', {}, 'connects')],
      body: el('div', {},
        iconLine('check-square', 'Tasks', 'Give a task a due date and a plant. Finishing it feeds that plant and counts toward your streak.'),
        iconLine('calendar', 'Calendar', 'Events, task due-dates and green focus dots all land on the month view. Click any day to plan it.'),
        iconLine('note', 'Notes', 'Autosaving notes you can link to a plant — find them again from the plant’s details.'),
        iconLine('sun', 'Today', 'Your morning page: today’s plan, quick log, this week’s chart and what’s up next.'),
        el('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Shortcuts: 1–6 switch pages · T new task · L quick log · F focus · Z zen · ? this guide. Tasks and events can repeat daily, weekly or monthly.'),
      ),
    },
    {
      title: ['Tiers & ', el('em', {}, 'streaks')],
      body: el('div', {},
        el('p', { class: 'guide-p' }, 'All your focused hours together grow the whole garden through tiers:'),
        el('div', { class: 'guide-tiers' },
          ...TIERS.map((t, i) => el('div', { class: 'guide-tier' },
            el('span', { class: 'tier-num' }, `[0${i + 1}]`),
            ic(t.icon, { size: 15 }),
            el('span', { class: 'guide-tier-name' }, t.name),
            el('span', { class: 'muted small' }, t.hours ? `${t.hours}h` : 'start'),
          )),
        ),
        el('p', { class: 'guide-p' },
          el('span', { class: 'guide-inline-ic' }, ic('flame', { size: 14 })),
          ' Do anything — one session or one finished task — each day to keep your streak alive. Your data stays in this browser; back it up from Settings.'),
      ),
    },
  ];
}

export function openGuide() {
  let idx = 0;
  const wrap = el('div', { class: 'guide' });
  const close = openModal(wrap);

  function renderPage() {
    const pg = pages()[idx];
    const last = idx === pages().length - 1;
    wrap.replaceChildren(
      el('div', { class: 'guide-head' },
        el('span', { class: 'guide-kicker' }, 'HOW BLOOM WORKS'),
        el('h2', {}, ...pg.title),
      ),
      pg.body,
      el('div', { class: 'guide-foot' },
        el('div', { class: 'guide-dots' },
          ...pages().map((_, i) => el('span', { class: 'guide-dot' + (i === idx ? ' on' : ''), onClick: () => { idx = i; renderPage(); } })),
        ),
        el('span', { class: 'spacer' }),
        idx > 0 ? el('button', { class: 'btn', onClick: () => { idx--; renderPage(); } }, 'Back') : null,
        el('button', {
          class: 'btn btn-primary', id: 'guide-next',
          onClick: () => { if (last) close(); else { idx++; renderPage(); } },
        }, last ? 'Start growing' : 'Next'),
      ),
    );
  }
  renderPage();
}
