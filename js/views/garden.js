// views/garden.js — the progression garden: one plant per skill, XP, levels, heatmap.
import { el, fmtMin, fmtDateShort, todayYmd, addDays } from '../util.js';
import { store } from '../store.js';
import { openModal, confirmDialog, toast } from '../ui.js';
import { sfx } from '../audio.js';
import { plantSVG, SPECIES } from '../plant.js';
import { xpOf, levelOf, minutesTotal, weekMinutes, lastNDays, streak, skillById, gardenTier, stageName, KEEPSAKES } from '../progress.js';
import { gardenBannerSVG, gardenSceneSVG } from '../banner.js';
import { barChartSVG, dayLabels7 } from '../charts.js';
import { openSkillEditor } from '../skillEditor.js';
import { setFocusSkill } from './focus.js';
import { taskRow } from './tasks.js';
import { selectNote } from './notes.js';
import { ic } from '../icons.js';

// Seed → Sprout → … ladder for ONE plant, driven by that skill's own hours
function tierStripEl(tier, capLabel, plantName) {
  return el('div', { class: 'tier-strip' },
    el('div', { class: 'tier-bar' }, el('div', { class: 'tier-fill', style: { width: `${Math.max(2, Math.round(tier.progress * 100))}%` } })),
    el('div', { class: 'tier-row' },
      el('div', { class: 'tier-side' },
        el('div', { class: 'tier-num' }, `[0${tier.index + 1}]`),
        el('div', { class: 'tier-name' }, ic(tier.cur.icon, { size: 15 }), ` ${tier.cur.name}`),
        el('div', { class: 'tier-cap muted' }, capLabel),
      ),
      el('div', { class: 'tier-center' }, tier.next
        ? `grow ${plantName} ${fmtMin(tier.minutesToNext)} more to reach ${tier.next.name}`
        : `${plantName} is a whole forest`),
      tier.next
        ? el('div', { class: 'tier-side right' },
            el('div', { class: 'tier-num' }, `[0${tier.index + 2}]`),
            el('div', { class: 'tier-name' }, ic(tier.next.icon, { size: 15 }), ` ${tier.next.name}`),
            el('div', { class: 'tier-cap muted' }, `at ${tier.next.hours}h`),
          )
        : null,
    ),
  );
}

// bar chart with an instant hover tooltip showing that day's focused time
function barsWithTip(values, labels, titles) {
  const wrap = el('div', { class: 'chart-tip-wrap', html: barChartSVG(values, labels, { h: 56, titles }) });
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

function openSkillDetails(sk) {
  const lv = levelOf(sk.id);
  const sessions = store.state.sessions.filter((s) => s.skillId === sk.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const openTasks = store.state.tasks.filter((t) => !t.done && t.skillId === sk.id);
  const notes = store.state.notes.filter((n) => n.skillId === sk.id);

  const labels14 = [], titles14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(todayYmd(), -i);
    labels14.push(i % 3 === 0 ? fmtDateShort(d).split(' ')[1] : '·');
    titles14.push(i === 0 ? 'Today' : fmtDateShort(d)); // hover shows the real date
  }

  const content = el('div', {},
    el('div', { style: { textAlign: 'center' } },
      el('div', { html: plantSVG(sk, lv.level, 120) }),
      el('h2', { class: 'row', style: { justifyContent: 'center', gap: '8px' } }, ic((sk.icon || 'sprout'), { size: 17, cls: 'title-ic' }), sk.name),
      el('div', { class: 'row gap', style: { justifyContent: 'center', marginTop: '8px' } },
        el('span', { class: 'chip lilac' }, `lv ${lv.level} · ${stageName(lv.level)}`),
        el('span', { class: 'chip green' }, `${xpOf(sk.id)} XP`),
        el('span', { class: 'chip' }, `${fmtMin(minutesTotal(sk.id))} total`),
      ),
      el('div', { class: 'xp-bar', title: `${lv.into}/${lv.need} XP to level ${lv.level + 1}` },
        el('div', { class: 'xp-fill', style: { width: `${Math.round((lv.into / lv.need) * 100)}%` } })),
      el('div', { class: 'muted small' }, `${lv.need - lv.into} XP to level ${lv.level + 1} — that's ~${fmtMin(lv.need - lv.into)} of focus`),
    ),
    tierStripEl(gardenTier(sk.id), `${sk.name} now`, sk.name),
    el('div', { class: 'field-label' }, 'Last 14 days'),
    barsWithTip(lastNDays(14, sk.id), labels14, titles14),
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
          toast(`${sk.name} uprooted`, 'x-circle');
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

function plantCard(sk, rr, selected = false) {
  const lv = levelOf(sk.id);
  const week = weekMinutes(sk.id);
  return el('div', { class: 'card plant-card' + (selected ? ' selected' : ''), dataset: { skill: sk.name } },
    el('span', { class: 'chip lilac lvl-badge' }, `lv ${lv.level} · ${stageName(lv.level)}`),
    el('div', {
      class: 'plant-wrap', html: plantSVG(sk, lv.level, 104), style: { cursor: 'pointer' },
      title: 'Show this plant on the growth bar',
      onClick: () => { sfx.click(); stripSkillId = sk.id; rr(); },
    }),
    el('div', { class: 'plant-name' }, ic((sk.icon || 'sprout'), { size: 14, cls: 'title-ic' }), sk.name),
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

let stripSkillId = null; // which plant the growth ladder follows (click a plant to switch)

export function render(root) {
  const s = store.state;
  const rr = () => { root.replaceChildren(); render(root); };
  const skills = [...s.skills].sort((a, b) => weekMinutes(b.id) - weekMinutes(a.id) || xpOf(b.id) - xpOf(a.id));
  const st = streak();
  const total = minutesTotal();
  const topSk = (stripSkillId && skills.find((k) => k.id === stripSkillId)) || skills[0] || null;
  const tier = gardenTier(topSk?.id ?? null);

  // ---- the garden itself: your real plants in the meadow (hills only while empty) ----
  const grown = total > 0;
  const scene = skills.length
    ? gardenSceneSVG(skills.map((sk) => ({ sk, level: levelOf(sk.id).level })))
    : gardenBannerSVG({ seed: 'bloom-hills-0', trees: 10, flowers: 4 });
  const sceneTip = el('div', { class: 'scene-tip' });
  const banner = el('div', {
    class: 'garden-banner' + (skills.length ? ' scene' : ''),
    onClick: (e) => {
      const g = e.target.closest('.scene-plant');
      const sk = g && skillById(g.dataset.skillId);
      if (sk) { sfx.click(); stripSkillId = sk.id; rr(); }
    },
    onMousemove: (e) => {
      const g = e.target.closest('.scene-plant');
      if (!g) { sceneTip.classList.remove('show'); return; }
      sceneTip.textContent = `${g.dataset.name} · lv ${g.dataset.level}`;
      const r = banner.getBoundingClientRect();
      const gr = g.getBoundingClientRect();
      // an svg <g>'s client rect IS the drawn plant's on-screen box — no viewBox math,
      // no letterboxing surprises. Tag floats above it with room for the 6px hover lift.
      const art = g.querySelector('.scene-lift') || g;
      const topY = art.getBoundingClientRect().top;
      sceneTip.style.left = `${gr.left - r.left + gr.width / 2}px`;
      sceneTip.style.top = `${topY - r.top - 18}px`;
      sceneTip.classList.add('show');
    },
    onMouseleave: () => sceneTip.classList.remove('show'),
  },
    el('div', { html: scene }),
    sceneTip,
  );
  if (topSk) banner.querySelector(`.scene-plant[data-skill-id="${topSk.id}"]`)?.classList.add('sel');
  banner.append(
    el('div', { class: 'banner-overlay' },
      el('div', { class: 'banner-line1' }, grown ? `You've grown ${fmtMin(total)}`.toUpperCase() : 'YOUR GARDEN AWAITS'),
      el('div', { class: 'banner-line2' }, grown
        ? `${s.skills.length} ${s.skills.length === 1 ? 'plant' : 'plants'} in your garden · ${st} day streak`
        : 'log a first session to start growing'),
    ),
  );

  // ---- GOBE-style tier strip (per plant — the top plant's own hours) ----
  const tierStrip = topSk ? tierStripEl(tier, `${topSk.name} now`, topSk.name) : ''; // '' not null — append(null) prints "null"

  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Your ', el('em', { class: 'squiggle' }, 'garden'), ' ', ic('sprout', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, s.skills.length
          ? 'Look what your focus grew.'
          : 'Every skill you practice becomes a plant. Time makes it grow.'),
      ),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn btn-big', id: 'garden-plant-book', onClick: () => { sfx.click(); openPlantBook(); } }, ic('book', { size: 15 }), 'Plant book'),
      el('button', { class: 'btn btn-primary btn-big', id: 'garden-new-skill', onClick: () => openSkillEditor() }, ic('pot', { size: 15 }), 'Plant a skill'),
    ),
    banner,
    tierStrip,
    skills.length
      ? el('div', { class: 'garden-grid' },
          ...skills.map((sk) => plantCard(sk, rr, sk.id === topSk?.id)),
          el('button', { class: 'new-plant-card', onClick: () => openSkillEditor() },
            el('span', { class: 'plus' }, ic('pot', { size: 30 })), 'Plant a new skill'),
        )
      : el('div', { class: 'card', style: { marginTop: '16px' } },
          el('div', { class: 'empty', style: { border: 'none' } },
            el('span', { class: 'big' }, ic('pot', { size: 26 })),
            'Your garden is empty! Type something like “30m math” above, or plant a skill.',
          )),
    keepsakeShelf(),
  );
}

// ---------- plant book: every species × growth stage; unreached stages stay a mystery ----------
const BOOK_STAGES = [
  { name: 'sprout', lv: 1, need: 1 },
  { name: 'bud', lv: 4, need: 3 },
  { name: 'bloom', lv: 8, need: 7 },
  { name: 'radiant', lv: 12, need: 10 },
];
const BOOK_COLORS = { bloom: '#C97F5F', sunflower: '#E0B54F', cactus: '#8FA35E', fern: '#7FA98F', bonsai: '#A9906E' };

function openPlantBook() {
  const s = store.state;
  const maxBySpecies = {};
  for (const sk of s.skills) {
    const key = sk.species || 'bloom';
    maxBySpecies[key] = Math.max(maxBySpecies[key] || 0, levelOf(sk.id).level);
  }
  let found = 0, total = 0;
  const rows = Object.entries(SPECIES).map(([key, sp]) => {
    const maxLv = maxBySpecies[key] || 0;
    return el('div', { class: 'book-row' },
      el('div', { class: 'book-name' },
        el('div', {}, sp.label),
        maxLv ? el('span', { class: 'chip lilac' }, `lv ${maxLv}`) : el('span', { class: 'muted small' }, 'not planted'),
      ),
      el('div', { class: 'book-stages' },
        ...BOOK_STAGES.map((st) => {
          total++;
          const unlocked = st.need <= 1 || maxLv >= st.need;
          if (unlocked) found++;
          return el('div', {
            class: 'book-stage', title: unlocked ? st.name : `Grow a ${sp.label.toLowerCase()} to level ${st.need} to reveal`,
          },
            el('div', { class: unlocked ? 'book-art' : 'book-art book-silhouette', html: plantSVG({ id: `bk-${key}-${st.lv}`, color: BOOK_COLORS[key] || '#C97F5F', species: key }, st.lv, 52) }),
            el('div', { class: 'book-stage-label muted small' }, unlocked ? st.name : '?'),
          );
        }),
      ),
    );
  });
  openModal(el('div', { class: 'plant-book' },
    el('h2', {}, 'Plant ', el('em', {}, 'book')),
    el('p', { class: 'muted small', style: { margin: '4px 0 8px' } }, 'Every plant grows through four stages. Keep watering to reveal them all.'),
    el('div', { style: { marginBottom: '6px' } }, el('span', { class: 'chip green' }, `${found} of ${total} discovered`)),
    ...rows,
  ));
}

function keepsakeShelf() {
  const s = store.state;
  const earned = KEEPSAKES.filter((k) => k.test(s)).length;
  return el('div', { class: 'card', style: { marginTop: '16px' } },
    el('div', { class: 'card-title' },
      el('h2', {}, 'Keepsake ', el('em', {}, 'shelf')),
      ic('star', { size: 15, cls: 'title-ic' }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'chip lilac' }, `${earned} of ${KEEPSAKES.length}`),
    ),
    el('div', { class: 'shelf-grid' }, ...KEEPSAKES.map((k) => {
      const got = k.test(s);
      return el('div', { class: 'keepsake' + (got ? ' got' : ''), title: got ? k.name : `To earn: ${k.how}` },
        el('div', { class: 'keepsake-ic' }, ic(k.icon, { size: 18 })),
        el('div', { class: 'keepsake-name' }, k.name),
        el('div', { class: 'muted small' }, got ? 'earned' : k.how),
      );
    })),
  );
}
