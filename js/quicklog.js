// quicklog.js — "1h math" → parsed, previewed, logged. Creates the skill if it's new.
// A plant picker lets you choose the plant explicitly; then you just type the duration.
import { el, parseQuickLog, fmtMin, fmtDate, todayYmd, guessIcon } from './util.js';
import { store, uid, nextColor } from './store.js';
import { logSession, skillById } from './progress.js';
import { skillSelect } from './skillEditor.js';
import { toast } from './ui.js';
import { sfx } from './audio.js';

const HINT = 'Practiced something without the timer? Type it here — it still counts.';

export function quickLogBox({ placeholder = 'What did you do? — “1h math”, “30m spanish yesterday”' } = {}) {
  const input = el('input', { class: 'input', id: 'quicklog', placeholder, autocomplete: 'off' });
  const preview = el('div', { class: 'quicklog-preview muted' }, HINT);
  let picked = null; // chosen plant object, or null = detect the plant from the text

  const plantSel = skillSelect({
    value: '', allowNone: true, noneLabel: '---',
    onChange: (id) => { picked = id ? skillById(id) : null; syncPlaceholder(); reparse(); input.focus(); },
  });
  plantSel.classList.add('quicklog-plant');

  function syncPlaceholder() {
    input.placeholder = picked ? 'How long? — “45m”, “1h yesterday”' : placeholder;
  }

  function reparse() {
    const p = parseQuickLog(input.value, store.state.skills, picked ? { skill: picked } : {});
    preview.classList.remove('ok');
    if (!input.value.trim()) {
      preview.textContent = picked ? `Type how long you practiced ${picked.name} — like “45m” or “1h”` : HINT;
      return p;
    }
    if (!p) {
      preview.textContent = picked ? 'Add a duration like “45m” or “1h”' : 'Add a duration like “45m” or “1h” and what it was for';
      return p;
    }
    const target = p.skill ? p.skill.name : `a new plant “${p.name}”`;
    const when = p.date !== todayYmd() ? ` · ${fmtDate(p.date)}` : '';
    preview.textContent = `↵ Add ${fmtMin(p.minutes)} to ${target}${when}`;
    preview.classList.add('ok');
    return p;
  }

  function commit() {
    const p = reparse();
    if (!p) { sfx.uhoh(); return; }
    let sk = p.skill;
    if (!sk) {
      sk = { id: uid(), name: p.name, icon: guessIcon(p.name), color: nextColor(), createdAt: new Date().toISOString() };
      store.state.skills.push(sk);
      toast(`New plant: ${sk.name}`, 'pot');
    }
    logSession({ skillId: sk.id, minutes: p.minutes, date: p.date, source: 'manual' });
    input.value = '';
  }

  input.addEventListener('input', reparse);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });

  return el('div', { class: 'quicklog' },
    el('div', { class: 'row gap quicklog-row' },
      input,
      el('button', { class: 'btn btn-green', id: 'quicklog-btn', onClick: commit }, 'Add'),
    ),
    el('div', { class: 'row gap quicklog-plant-row' },
      el('span', { class: 'muted small' }, 'for'),
      plantSel,
    ),
    preview,
  );
}
