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
  if (q) list = list.filter((n) => (n.title + ' ' + plainText(n.body)).toLowerCase().includes(q));
  return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

const plainText = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent || '';
};

function snippet(n) {
  const s = plainText(n.body).replace(/\s+/g, ' ').trim();
  return s.length > 64 ? s.slice(0, 64) + '…' : (s || 'empty note');
}

function noteCard(n, rr) {
  const sk = n.skillId ? skillById(n.skillId) : null;
  return el('button', {
    class: 'note-card' + (n.id === selectedId ? ' sel' : ''),
    style: { '--note-color': n.color || '#D89B8A', background: `color-mix(in srgb, ${n.color || '#D89B8A'} 10%, var(--card))` },
    dataset: { id: n.id },
    onClick: () => { selectedId = n.id; sfx.click(); rr(); },
  },
    el('div', { class: 'note-card-title' }, n.pinned ? ic('pin', { size: 12 }) : null, el('span', { class: 'note-title-text' }, n.title || 'Untitled')),
    el('div', { class: 'note-card-snippet' }, snippet(n)),
    el('div', { class: 'note-card-meta' },
      sk ? el('span', { class: 'chip', style: { background: sk.color + '30' } }, ic((sk.icon || 'sprout'), { size: 10 }), ` ${sk.name}`) : null,
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
  const bodyIn = el('div', {
    id: 'note-body-in', class: 'note-body', contenteditable: 'true',
    'data-placeholder': 'Start writing…',
    onInput: () => { n.body = bodyIn.innerHTML; persist(); },
  });
  const escapeHtml = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  bodyIn.innerHTML = /<[a-z][\s\S]*>/i.test(n.body) ? n.body : escapeHtml(n.body).replace(/\n/g, '<br>');

  // tap a checklist box to tick it
  bodyIn.addEventListener('click', (e) => {
    const li = e.target.closest('ul.checks li');
    if (li && e.offsetX < 24 && bodyIn.contains(li)) {
      li.classList.toggle('done');
      n.body = bodyIn.innerHTML;
      persist();
    }
  });

  // ---- jotting toolbar (mousedown+preventDefault keeps the text selection) ----
  const cmd = (fn) => (e) => { e.preventDefault(); bodyIn.focus(); fn(); n.body = bodyIn.innerHTML; persist(); };
  const fmtBtn = (label, title, fn, cls = '') =>
    el('button', { class: 'icon-btn fmt-btn ' + cls, title, type: 'button', onMousedown: cmd(fn) }, label);

  const unwrap = (m) => { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); m.remove(); };
  const cleanMarks = () => {
    // no nesting, no empty leftovers, and same-colour neighbours fuse into one smooth mark
    [...bodyIn.querySelectorAll('mark mark')].forEach(unwrap);
    [...bodyIn.querySelectorAll('mark')].forEach((m) => { if (!m.textContent) m.remove(); });
    [...bodyIn.querySelectorAll('mark')].forEach((m) => {
      let next = m.nextSibling;
      while (next && next.nodeName === 'MARK' && next.className === m.className) {
        const dead = next;
        next = dead.nextSibling;
        while (dead.firstChild) m.append(dead.firstChild);
        dead.remove();
      }
    });
    bodyIn.normalize();
  };
  const applyHighlight = (klass) => {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!bodyIn.contains(range.commonAncestorContainer)) return;
    const tmp = document.createElement('div');
    tmp.append(range.extractContents());
    [...tmp.querySelectorAll('mark')].forEach(unwrap); // recolour, never nest
    const mark = document.createElement('mark');
    mark.className = klass;
    while (tmp.firstChild) mark.append(tmp.firstChild);
    range.insertNode(mark);
    cleanMarks();
    sel.removeAllRanges();
  };
  const clearHighlight = () => {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    [...bodyIn.querySelectorAll('mark')].forEach((m) => {
      if (range.intersectsNode(m)) unwrap(m);
    });
    cleanMarks();
  };
  const toggleChecklist = () => {
    // already in a list? just flip it between bullets and checkboxes
    let node = getSelection().anchorNode;
    while (node && node !== bodyIn) {
      if (node.nodeName === 'UL') { node.classList.toggle('checks'); return; }
      node = node.parentNode;
    }
    document.execCommand('insertUnorderedList');
    node = getSelection().anchorNode;
    while (node && node !== bodyIn) {
      if (node.nodeName === 'UL') { node.classList.add('checks'); break; }
      node = node.parentNode;
    }
  };

  const toolbar = el('div', { class: 'note-toolbar' },
    fmtBtn('B', 'Bold (⌘B)', () => document.execCommand('bold'), 'fmt-b'),
    fmtBtn(ic('bars', { size: 14 }), 'Bullet list', () => document.execCommand('insertUnorderedList')),
    fmtBtn('1.', 'Numbered list', () => document.execCommand('insertOrderedList'), 'fmt-b'),
    fmtBtn(ic('check-square', { size: 14 }), 'Checklist — tap boxes to tick', toggleChecklist),
    el('span', { class: 'fmt-sep' }),
    fmtBtn('', 'Highlight yellow', () => applyHighlight('hl-sun'), 'hl-btn hl-sun'),
    fmtBtn('', 'Highlight green', () => applyHighlight('hl-mint'), 'hl-btn hl-mint'),
    fmtBtn('', 'Highlight pink', () => applyHighlight('hl-rose'), 'hl-btn hl-rose'),
    fmtBtn('', 'Highlight blue', () => applyHighlight('hl-sky'), 'hl-btn hl-sky'),
    fmtBtn(ic('x-circle', { size: 13 }), 'Remove highlight', clearHighlight),
  );

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

  return el('div', {
    class: 'card note-editor',
    style: {
      background: `color-mix(in srgb, ${n.color || '#D89B8A'} 9%, var(--card))`,
      borderColor: `color-mix(in srgb, ${n.color || '#D89B8A'} 45%, var(--line))`,
    },
  },
    titleIn,
    el('div', { class: 'editor-meta' },
      skillSelect({
        value: n.skillId || '', noneLabel: 'none', id: 'note-skill-in',
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
    toolbar,
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
