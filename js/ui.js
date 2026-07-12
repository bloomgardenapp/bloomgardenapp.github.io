// ui.js — toasts, modals, confirm dialog. No app-state imports.
import { el } from './util.js';
import { ic, hasIcon } from './icons.js';

export function toast(msg, icon = 'sprout') {
  const root = document.getElementById('toasts');
  if (!root) return;
  const badge = hasIcon(icon)
    ? ic(icon, { size: 15, cls: 'toast-emoji' })
    : el('span', { class: 'toast-emoji' }, icon); // legacy fallback
  const t = el('div', { class: 'toast' }, badge, el('span', {}, msg));
  root.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 320); }, 3600);
  while (root.children.length > 4) root.firstChild.remove();
}

export function openModal(content, { onClose, closable = true } = {}) {
  let closed = false;
  const modal = el('div', { class: 'modal card' });
  if (closable) modal.append(el('button', { class: 'modal-x icon-btn', 'aria-label': 'Close', onClick: () => close() }, '✕'));
  modal.append(content);
  const overlay = el('div', {
    class: 'modal-overlay',
    onClick: (e) => { if (e.target === overlay && closable) close(); },
  }, modal);
  function esc(e) { if (e.key === 'Escape' && closable) close(); }
  function close() {
    if (closed) return;
    closed = true;
    overlay.classList.remove('in');
    document.removeEventListener('keydown', esc);
    setTimeout(() => overlay.remove(), 210);
    onClose?.();
  }
  document.addEventListener('keydown', esc);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));
  return close;
}

export function confirmDialog(message, { yes = 'Delete', no = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val, close) => { if (!done) { done = true; resolve(val); } close?.(); };
    const content = el('div', {},
      el('p', { class: 'confirm-msg' }, message),
      el('div', { class: 'row gap', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'btn', onClick: () => finish(false, close) }, no),
        el('button', { class: danger ? 'btn btn-danger' : 'btn btn-primary', onClick: () => finish(true, close) }, yes),
      ),
    );
    const close = openModal(content, { onClose: () => finish(false) });
  });
}

// Google-Calendar-style chooser for repeating things: resolves the picked
// choice's value, or null on cancel. choices: [{ label, value, danger? }]
export function choiceDialog(message, choices) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val, close) => { if (!done) { done = true; resolve(val); } close?.(); };
    const content = el('div', {},
      el('p', { class: 'confirm-msg' }, message),
      el('div', { class: 'col', style: { gap: '8px' } },
        ...choices.map((c) => el('button', {
          class: c.danger ? 'btn btn-danger' : 'btn',
          style: { justifyContent: 'center' },
          onClick: () => finish(c.value, close),
        }, c.label)),
        el('button', { class: 'link-btn', style: { alignSelf: 'center', marginTop: '2px' }, onClick: () => finish(null, close) }, 'cancel'),
      ),
    );
    const close = openModal(content, { onClose: () => finish(null) });
  });
}
