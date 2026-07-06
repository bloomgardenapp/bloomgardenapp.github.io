// views/garden.js — the progression garden: one plant per skill, XP, levels, heatmap.
import { el, fmtMin, fmtDateShort, todayYmd, addDays } from '../util.js';
import { store } from '../store.js';
import { openModal, confirmDialog, toast } from '../ui.js';
import { sfx } from '../audio.js';
import { plantSVG } from '../plant.js';
import { xpOf, levelOf, minutesTotal, weekMinutes, minutesOn, lastNDays, streak, skillById, gardenTier, stageName } from '../progress.js';
import { gardenBannerSVG } from '../banner.js';
import { barChartSVG, dayLabels7, heatmapSVG, heatmapLegend } from '../charts.js';
import { openSkillEditor } from '../skillEditor.js';
import { quickLogBox } from '../quicklog.js';
import { setFocusSkill } from './focus.js';
import { taskRow } from './tasks.js';
import { selectNote } from './notes.js';
import { ic } from '../icons.js';

function openSkillDetails(sk) {
  const lv = levelOf(sk.id);
  const sessions = store.state.sessions.filter((s) => s.skillId === sk.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const openTasks = store.state.tasks.filter((t) => !t.done && t.skillId === sk.id);
  const notes = store.state.notes.filter((n) => n.skillId === sk.id);

  const labels14 = [];
  for (let i = 13; i >= 0; i--) labels14.push(i % 3 === 0 ? fmtDateShort(addDays(todayYmd(), -i)).split(' ')[1] : '·');

  const content = el('div', {},
    el('div', { style: { textAlign: 'center' } },
      el('div', { html: plantSVG(sk, lv.level, 120) }),
      el('h2', {}, `${sk.emoji} ${sk.name}`),
      el('div', { class: 'row gap', style: { justifyContent: 'center', marginTop: '8px' } },
        el('span', { class: 'chip lilac' }, `lv ${lv.level} · ${stageName(lv.level)}`),
        el('span', { class: 'chip green' }, `${xpOf(sk.id)} XP`),
        el('span', { class: 'chip' }, `${fmtMin(minutesTotal(sk.id))} total`),
      ),
      el('div', { class: 'xp-bar', title: `${lv.into}/${lv.need} XP to level ${lv.level + 1}` },
        el('div', { class: 'xp-fill', style: { width: `${Math.round((lv.into / lv.need) * 100)}%` } })),
      el('div', { class: 'muted small' }, `${lv.need - lv.into} XP to level ${lv.level + 1} — that's ~${fmtMin(lv.need - lv.into)} of focus`),
    ),
    el('div', { class: 'field-label' }, 'Last 14 days'),
    el('div', { html: barChartSVG(lastNDays(14, sk.id), labels14, { h: 56 }) }),
    el('div', { class: 'field-label' }, `Sessions · ${sessions.length}`),
    sessions.length
      ? el('div', {}, ...sessions.slice(0, 8).map((sess) =>
          el('div', { class: 'session-row' },
            el('span', { class: 'chip green' }, fmtMin(sess.minutes)),
            el('span', { class: 'muted small' }, `${fmtDateShort(sess.date)} · ${sess.source === 'timer' ? 'timer' : 'logged'}`),
            el('span', { class: 'spacer' }),
            el('button', {
              class: 'icon-btn del', 'aria-label': 'Delete session',
              onClick: async () => {
                if (await confirmDialog(`Remove this ${fmtMin(sess.minutes)} session?`, { yes: 'Remove' })) {
                  store.state.sessions = store.state.sessions.filter((x) => x.id !== sess.id);
                  store.save();
                  close();
                }
              },
            }, ic('trash', { size: 14 })),
          )))
      : el('p', { class: 'muted small' }, 'No time logged yet.'),
    openTasks.length ? el('div', { class: 'field-label' }, `Open tasks · ${openTasks.length}`) : null,
    openTasks.length ? el('div', {}, ...openTasks.slice(0, 5).map((t) => taskRow(t))) : null,
    notes.length ? el('div', { class: 'field-label' }, `Linked notes · ${notes.length}`) : null,
    notes.length
      ? el('div', { class: 'row gap wrap' }, ...notes.slice(0, 6).map((n) =>
          el('button', { class: 'chip chip-btn', onClick: () => { selectNote(n.id); close(); location.hash = '#/notes'; } }, ic('note', { size: 11 }), ` ${n.title || 'Untitled'}`)))
      : null,
    el('div', { class: 'row gap', style: { marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
      el('button', {
        class: 'btn btn-danger', onClick: async () => {
          const ok = await confirmDialog(
            `Uproot ${sk.name}? Its ${sessions.length} sessions and XP disappear. Linked tasks & notes stay (unlinked).`,
            { yes: 'Uproot' },
          );
          if (!ok) return;
          store.state.skills = store.state.skills.filter((x) => x.id !== sk.id);
          store.state.sessions = store.state.sessions.filter((x) => x.skillId !== sk.id);
          for (const t of store.state.tasks) if (t.skillId === sk.id) t.skillId = null;
          for (const n of store.state.notes) if (n.skillId === sk.id) n.skillId = null;
          store.save();
          close();
          toast(`${sk.name} uprooted`, '🥀');
        },
      }, 'Uproot'),
      el('button', { class: 'btn', onClick: async () => { close(); await openSkillEditor(sk); } }, ic('pencil', { size: 13 }), 'Edit'),
      el('button', {
        class: 'btn btn-primary', onClick: () => { setFocusSkill(sk.id); close(); location.hash = '#/focus'; },
      }, ic('hourglass', { size: 13 }), 'Focus on this'),
    ),
  );
  const close = openModal(content);
}

function plantCard(sk) {
  const lv = levelOf(sk.id);
  const week = weekMinutes(sk.id);
  return el('div', { class: 'card plant-card', dataset: { skill: sk.name } },
    el('span', { class: 'chip lilac lvl-badge' }, `lv ${lv.level} · ${stageName(lv.level)}`),
    el('div', { class: 'plant-wrap', html: plantSVG(sk, lv.level, 104), onClick: () => openSkillDetails(sk), style: { cursor: 'pointer' } }),
    el('div', { class: 'plant-name' }, `${sk.emoji} ${sk.name}`),
    el('div', { class: 'xp-bar', title: `${lv.into}/${lv.need} XP to next level` },
      el('div', { class: 'xp-fill', style: { width: `${Math.max(3, Math.round((lv.into / lv.need) * 100))}%` } })),
    el('div', { class: 'plant-stats' }, `${fmtMin(minutesTotal(sk.id))} total · ${fmtMin(week)} this week`),
    el('div', { html: barChartSVG(lastNDays(7, sk.id), dayLabels7(), { h: 30 }), class: 'mini-bars' }),
    el('div', { class: 'row gap' },
      el('button', { class: 'btn', onClick: () => { setFocusSkill(sk.id); location.hash = '#/focus'; } }, ic('hourglass', { size: 13 }), 'Focus'),
      el('button', { class: 'btn', onClick: () => openSkillDetails(sk) }, 'Details'),
    ),
  );
}

export function render(root) {
  const s = store.state;
  const skills = [...s.skills].sort((a, b) => weekMinutes(b.id) - weekMinutes(a.id) || xpOf(b.id) - xpOf(a.id));
  const st = streak();
  const total = minutesTotal();
  const tier = gardenTier();

  // ---- hills banner: a tree for every plant, a flower for recent sessions ----
  const grown = total > 0;
  const banner = el('div', { class: 'garden-banner' },
    el('div', { html: gardenBannerSVG({ seed: 'bloom-hills-' + s.skills.length, trees: Math.min(8 + s.skills.length * 2, 16), flowers: Math.min(s.sessions.length, 8) }) }),
    el('div', { class: 'banner-overlay' },
      el('div', { class: 'banner-line1' }, grown ? `You've grown ${fmtMin(total)}`.toUpperCase() : 'YOUR GARDEN AWAITS'),
      el('div', { class: 'banner-line2' }, grown
        ? `${s.skills.length} ${s.skills.length === 1 ? 'plant' : 'plants'} in your garden · ${st} day streak`
        : 'log a first session to start growing'),
    ),
  );

  // ---- GOBE-style tier strip ----
  const tierStrip = el('div', { class: 'tier-strip' },
    el('div', { class: 'tier-bar' }, el('div', { class: 'tier-fill', style: { width: `${Math.max(2, Math.round(tier.progress * 100))}%` } })),
    el('div', { class: 'tier-row' },
      el('div', { class: 'tier-side' },
        el('div', { class: 'tier-num' }, `[0${tier.index + 1}]`),
        el('div', { class: 'tier-name' }, ic(tier.cur.icon, { size: 15 }), ` ${tier.cur.name}`),
        el('div', { class: 'tier-cap muted' }, 'your garden now'),
      ),
      el('div', { class: 'tier-center' }, tier.next
        ? `grow ${fmtMin(tier.minutesToNext)} more to reach ${tier.next.name}`
        : 'your garden is a whole forest'),
      tier.next
        ? el('div', { class: 'tier-side right' },
            el('div', { class: 'tier-num' }, `[0${tier.index + 2}]`),
            el('div', { class: 'tier-name' }, ic(tier.next.icon, { size: 15 }), ` ${tier.next.name}`),
            el('div', { class: 'tier-cap muted' }, `at ${tier.next.hours}h`),
          )
        : null,
    ),
  );

  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Your ', el('em', { class: 'squiggle' }, 'garden'), ' ', ic('sprout', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, s.skills.length
          ? 'a little water every day'
          : 'Every skill you practice becomes a plant. Time makes it grow.'),
      ),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn btn-primary btn-big', id: 'garden-new-skill', onClick: () => openSkillEditor() }, ic('pot', { size: 15 }), 'Plant a skill'),
    ),
    banner,
    tierStrip,
    el('div', { class: 'card', style: { marginTop: '20px' } },
      el('div', { class: 'garden-top' },
        el('div', { class: 'gt-left' },
          el('div', { class: 'card-title', style: { marginBottom: '10px' } }, el('h2', {}, 'Quick ', el('em', {}, 'log')), ic('bolt', { size: 15, cls: 'title-ic' })),
          quickLogBox(),
          el('div', { class: 'row gap wrap', style: { marginTop: '14px' } },
            el('span', { class: 'chip green' }, ic('stopwatch', { size: 11 }), ` ${fmtMin(weekMinutes())} this week`),
            el('span', { class: 'chip sun' }, ic('flame', { size: 11 }), ` ${st} day streak`),
          ),
        ),
        el('div', { class: 'gt-right' },
          el('div', { class: 'card-title', style: { marginBottom: '10px' } }, el('h2', {}, 'Consistency'), ic('calendar', { size: 15, cls: 'title-ic' }),
            el('span', { class: 'spacer' }), el('span', { html: heatmapLegend() })),
          el('div', { html: heatmapSVG((d) => minutesOn(d)) }),
          el('p', { class: 'muted small', style: { marginTop: '8px' } }, `Last 14 weeks · today ${fmtMin(minutesOn(todayYmd()))}`),
        ),
      ),
    ),
    skills.length
      ? el('div', { class: 'garden-grid' },
          ...skills.map(plantCard),
          el('button', { class: 'new-plant-card', onClick: () => openSkillEditor() },
            el('span', { class: 'plus' }, ic('pot', { size: 30 })), 'Plant a new skill'),
        )
      : el('div', { class: 'card', style: { marginTop: '16px' } },
          el('div', { class: 'empty', style: { border: 'none' } },
            el('span', { class: 'big' }, '🌵'),
            'Your garden is empty! Type something like “30m math” above, or plant a skill.',
          )),
  );
}
