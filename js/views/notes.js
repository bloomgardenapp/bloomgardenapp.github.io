// views/notes.js — notes with autosave, search, pin, colors, and skill links.
import { el, debounce, relTime } from '../util.js';
import { store, uid, PALETTE } from '../store.js';
import { confirmDialog } from '../ui.js';
import { sfx } from '../audio.js';
import { skillById } from '../progress.js';
import { skillSelect } from '../skillEditor.js';
import { ic } from '../icons.js';

let selectedId = null;
let query = '';

export function selectNote(id) { selectedId = id; }

function sortedNotes() {
  const q = query.trim().toLowerCase();
  let list = [...store.state.notes];
  if (q) list = list.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(q));
  return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function snippet(n) {
  const s = n.body.replace(/\s+/g, ' ').trim();
  return s.length > 64 ? s.slice(0, 64) + '…' : (s || 'empty note');
}

function noteCard(n, rr) {
  const sk = n.skillId ? skillById(n.skillId) : null;
  return el('button', {
    class: 'note-card' + (n.id === selectedId ? ' sel' : ''),
    style: { '--note-color': n.color || '#D89B8A' },
    dataset: { id: n.id },
    onClick: () => { selectedId = n.id; sfx.click(); rr(); },
  },
    el('div', { class: 'note-card-title' }, n.pinned ? ic('pin', { size: 12 }) : null, el('span', { class: 'note-title-text' }, n.title || 'Untitled')),
    el('div', { class: 'note-card-snippet' }, snippet(n)),
    el('div', { class: 'note-card-meta' },
      sk ? el('span', { class: 'chip', style: { background: sk.color + '30' } }, `${sk.emoji} ${sk.name}`) : null,
      el('span', {}, relTime(n.updatedAt || n.createdAt)),
    ),
  );
}

function editor(n, rr, listEl) {
  const flash = el('span', { class: 'saved-flash' }, 'Saved ✓');
  let flashT;
  const savedFlash = () => {
    flash.classList.add('show');
    clearTimeout(flashT);
    flashT = setTimeout(() => flash.classList.remove('show'), 1200);
  };
  const patchCard = () => {
    const card = listEl.querySelector(`[data-id="${n.id}"]`);
    if (!card) return;
    const titleText = card.querySelector('.note-title-text');
    if (titleText) titleText.textContent = n.title || 'Untitled';
    card.querySelector('.note-card-snippet').textContent = snippet(n);
  };
  const persist = debounce(() => {
    n.updatedAt = new Date().toISOString();
    store.save(true); // silent — don't blow away the caret while typing
    savedFlash();
    patchCard();
  }, 350);

  const titleIn = el('input', {
    class: 'title-in', id: 'note-title-in', placeholder: 'Untitled',
    value: n.title,
    onInput: (e) => { n.title = e.target.value; persist(); },
  });
  const bodyIn = el('textarea', {
    id: 'note-body-in', placeholder: 'Start writing…',
    onInput: (e) => { n.body = e.target.value; persist(); },
  });
  bodyIn.value = n.body;

  const swatches = el('div', { class: 'swatches' },
    ...PALETTE.slice(0, 7).map((c) => el('button', {
      class: 'swatch' + (n.color === c ? ' sel' : ''), 'aria-label': 'note color',
      style: { background: c, width: '20px', height: '20px' },
      onClick: (e) => {
        n.color = c;
        n.updatedAt = new Date().toISOString();
        store.save();
        sfx.click();
      },
    })),
  );

  return el('div', { class: 'card note-editor' },
    titleIn,
    el('div', { class: 'editor-meta' },
      skillSelect({
        value: n.skillId || '', noneLabel: 'no plant', id: 'note-skill-in',
        onChange: (id) => { n.skillId = id; n.updatedAt = new Date().toISOString(); store.save(true); savedFlash(); },
      }),
      swatches,
      el('button', {
        class: 'icon-btn', 'aria-label': n.pinned ? 'Unpin' : 'Pin', title: 'Pin',
        style: n.pinned ? { background: 'var(--olive-soft)', color: 'var(--olive-2)' } : {},
        onClick: () => { n.pinned = !n.pinned; store.save(); sfx.click(); },
      }, ic('pin', { size: 14 })),
      el('span', { class: 'spacer' }),
      flash,
      el('button', {
        class: 'icon-btn', 'aria-label': 'Delete note',
        onClick: async () => {
          if (await confirmDialog(`Delete “${n.title || 'Untitled'}”?`)) {
            store.state.notes = store.state.notes.filter((x) => x.id !== n.id);
            if (selectedId === n.id) selectedId = null;
            store.save();
          }
        },
      }, ic('trash', { size: 14 })),
    ),
    bodyIn,
  );
}

export function render(root) {
  const rr = () => { root.innerHTML = ''; render(root); };
  const notes = sortedNotes();
  if (selectedId && !store.state.notes.some((n) => n.id === selectedId)) selectedId = null;
  if (!selectedId && notes.length) selectedId = notes[0].id;
  const sel = store.state.notes.find((n) => n.id === selectedId);

  function newNote() {
    const n = {
      id: uid(), title: '', body: '', skillId: null,
      color: PALETTE[(store.state.notes.length * 3) % 7], pinned: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    store.state.notes.push(n);
    selectedId = n.id;
    query = '';
    sfx.pop();
    store.save();
    setTimeout(() => document.getElementById('note-title-in')?.focus(), 50);
  }

  const listEl = el('div', {},
    el('div', { class: 'row gap', style: { marginBottom: '10px' } },
      el('input', {
        class: 'input', id: 'note-search', placeholder: 'Search notes…', value: query,
        onInput: (e) => { query = e.target.value; rr(); },
      }),
      el('button', { class: 'btn btn-primary', id: 'note-new-btn', onClick: newNote }, '＋ New'),
    ),
    notes.length
      ? el('div', {}, ...notes.map((n) => noteCard(n, rr)))
      : el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('note', { size: 26 })), query ? 'No notes match.' : 'No notes yet.'),
  );

  root.append(
    el('div', { class: 'view-head' },
      el('div', {},
        el('h1', {}, 'Little ', el('em', { class: 'squiggle' }, 'notes'), ' ', ic('note', { size: 22, cls: 'h1-ic' })),
        el('p', { class: 'sub' }, 'Thoughts, plans, lists — link them to a plant to keep them close.'),
      ),
    ),
    el('div', { class: 'notes-wrap', style: { marginTop: '20px' } },
      listEl,
      sel ? editor(sel, rr, listEl) : el('div', { class: 'card' }, el('div', { class: 'empty' }, el('span', { class: 'big' }, ic('daisy', { size: 26 })), 'Pick a note, or write a new one.')),
    ),
  );
}
