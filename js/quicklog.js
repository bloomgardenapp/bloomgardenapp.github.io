// quicklog.js — "1h math" → parsed, previewed, logged. Creates the skill if it's new.
import { el, parseQuickLog, fmtMin, fmtDate, todayYmd, guessEmoji } from './util.js';
import { store, uid, nextColor } from './store.js';
import { logSession } from './progress.js';
import { toast } from './ui.js';
import { sfx } from './audio.js';

const HINT = 'Log time in plain words — it waters your garden.';

export function quickLogBox({ placeholder = 'Try “1h math” or “30m spanish”…' } = {}) {
  const input = el('input', { class: 'input', id: 'quicklog', placeholder, autocomplete: 'off' });
  const preview = el('div', { class: 'quicklog-preview muted' }, HINT);

  function reparse() {
    const p = parseQuickLog(input.value, store.state.skills);
    preview.classList.remove('ok');
    if (!input.value.trim()) { preview.textContent = HINT; return p; }
    if (!p) { preview.textContent = 'Add a duration like “45m” or “1h” and what it was for'; return p; }
    const target = p.skill ? `${p.skill.emoji} ${p.skill.name}` : `a new plant “${p.name}”`;
    const when = p.date !== todayYmd() ? ` · ${fmtDate(p.date)}` : '';
    preview.textContent = `↵ Log ${fmtMin(p.minutes)} → ${target}${when}`;
    preview.classList.add('ok');
    return p;
  }

  function commit() {
    const p = reparse();
    if (!p) { sfx.uhoh(); return; }
    let sk = p.skill;
    if (!sk) {
      sk = { id: uid(), name: p.name, emoji: guessEmoji(p.name), color: nextColor(), createdAt: new Date().toISOString() };
      store.state.skills.push(sk);
      toast(`New plant: ${sk.emoji} ${sk.name}`, '🪴');
    }
    logSession({ skillId: sk.id, minutes: p.minutes, date: p.date, source: 'manual' });
    input.value = '';
  }

  input.addEventListener('input', reparse);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });

  return el('div', { class: 'quicklog' },
    el('div', { class: 'row gap' },
      input,
      el('button', { class: 'btn btn-green', id: 'quicklog-btn', onClick: commit }, 'Log'),
    ),
    preview,
  );
}
