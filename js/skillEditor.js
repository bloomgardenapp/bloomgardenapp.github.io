// skillEditor.js — modal to plant a new skill or edit an existing one. Resolves to the skill or null.
import { el } from './util.js';
import { store, uid, PALETTE, nextColor } from './store.js';
import { openModal, toast } from './ui.js';
import { plantSVG } from './plant.js';
import { levelOf } from './progress.js';
import { sfx } from './audio.js';

const EMOJI = ['🌿', '📐', '📚', '💻', '🗣️', '🎹', '🎸', '🎵', '💪', '🏃‍♀️', '🧘‍♀️', '🎨', '✍️', '🔬', '🎓', '🍳', '🎮', '💼', '🎬', '💃', '🏊‍♀️', '♟️', '📷', '🧠'];

export function openSkillEditor(skill = null, { quiet = false } = {}) {
  return new Promise((resolve) => {
    let emoji = skill?.emoji || '🌿';
    let color = skill?.color || nextColor();
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const preview = el('div', { style: { textAlign: 'center' } });
    const renderPreview = () => {
      preview.innerHTML = plantSVG({ id: skill?.id || 'preview', color }, skill ? levelOf(skill.id).level : 2, 92);
    };
    renderPreview();

    const nameIn = el('input', {
      class: 'input', id: 'skill-name-in', value: skill?.name || '',
      placeholder: 'e.g. Math, Piano, Spanish…', maxlength: 28,
      onKeydown: (e) => { if (e.key === 'Enter') save(); },
    });

    const emojiGrid = el('div', { class: 'emoji-grid' });
    const emojiCells = EMOJI.map((e) =>
      el('button', {
        class: 'emoji-cell' + (e === emoji ? ' sel' : ''), type: 'button',
        onClick: () => {
          emoji = e;
          emojiCells.forEach((c) => c.classList.toggle('sel', c.textContent === e));
          sfx.click();
        },
      }, e));
    emojiGrid.append(...emojiCells);

    const swatches = el('div', { class: 'swatches' });
    const swatchEls = PALETTE.map((c) =>
      el('button', {
        class: 'swatch' + (c === color ? ' sel' : ''), type: 'button', 'aria-label': 'color ' + c,
        style: { background: c },
        onClick: () => {
          color = c;
          swatchEls.forEach((s) => s.classList.toggle('sel', s.style.background && s.dataset.c === c));
          renderPreview();
          sfx.click();
        },
        dataset: { c },
      }));
    swatches.append(...swatchEls);

    function save() {
      const name = nameIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      if (skill) {
        Object.assign(skill, { name, emoji, color });
        store.save();
        finish(skill);
      } else {
        const sk = { id: uid(), name, emoji, color, createdAt: new Date().toISOString() };
        store.state.skills.push(sk);
        store.save(quiet);
        if (!quiet) toast(`${emoji} ${name} planted!`, '🪴');
        finish(sk);
      }
      close();
    }

    const close = openModal(
      el('div', {},
        el('h2', { style: { marginBottom: '4px' } }, ...(skill ? ['Edit ', el('em', {}, 'plant')] : ['Plant a new ', el('em', {}, 'skill')])),
        el('p', { class: 'muted small', style: { marginBottom: '10px' } }, skill ? '' : 'Anything you want to get better at — it becomes a plant in your garden.'),
        preview,
        el('div', { class: 'field-label' }, 'Name'),
        nameIn,
        el('div', { class: 'field-label' }, 'Emoji'),
        emojiGrid,
        el('div', { class: 'field-label' }, 'Pot color'),
        swatches,
        el('div', { class: 'row gap', style: { marginTop: '20px', justifyContent: 'flex-end' } },
          el('button', { class: 'btn btn-primary btn-big', onClick: save }, skill ? 'Save' : 'Plant it'),
        ),
      ),
      { onClose: () => finish(null) },
    );
    setTimeout(() => nameIn.focus(), 60);
  });
}

// Shared <select> of skills with a "plant new" option. Creates quietly (no global
// re-render) so surrounding form drafts survive; caller gets the new id via onChange.
export function skillSelect({ value = '', allowNone = true, noneLabel = 'no plant', onChange, id } = {}) {
  let current = value || '';
  const sel = el('select', { class: 'input' });
  if (id) sel.id = id;
  const rebuild = () => {
    sel.innerHTML = '';
    if (allowNone) sel.append(el('option', { value: '' }, `— ${noneLabel} —`));
    for (const sk of store.state.skills) sel.append(el('option', { value: sk.id }, `${sk.emoji} ${sk.name}`));
    sel.append(el('option', { value: '__new' }, '＋ Plant new skill…'));
    sel.value = current;
  };
  rebuild();
  sel.addEventListener('change', async () => {
    if (sel.value === '__new') {
      const sk = await openSkillEditor(null, { quiet: true });
      if (sk) {
        current = sk.id;
        toast(`${sk.emoji} ${sk.name} planted!`, '🪴');
        onChange?.(sk.id);
      }
      rebuild();
    } else {
      current = sel.value;
      onChange?.(sel.value || null);
    }
  });
  return sel;
}
