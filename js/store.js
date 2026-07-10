// store.js — single source of truth, persisted to localStorage.

const KEY = 'bloom.v1';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const PALETTE = ['#C97F5F', '#8FA35E', '#E0B54F', '#7FA98F', '#8FA9C9', '#B08FB6', '#D89B8A', '#6E8FA6', '#A9906E', '#7C8B4F'];

function welcomeNote() {
  return {
    id: uid(),
    title: 'Welcome to Bloom',
    body: `Hi! I'm Bloom — your day, all in one place.

Here's how everything connects:

Tasks — plan your day. Link a task to a skill and finishing it feeds that plant (+10 XP).
Calendar — events, task due-dates and your focus sessions all show up here.
Focus — pick a skill, start the timer, and every minute becomes XP for your garden.
Garden — one plant per skill. Water them with focused time and watch them grow, level by level.
Notes — like this one! Link notes to a skill to find them from its plant.

Quick tips:
• Type "1h math" (or "30m spanish yesterday") into any Add time box — Bloom understands it.
• Keep a daily streak going by finishing any task or focus session each day.
• Sign in from Settings (just your email — no password) to keep your garden safe on any device.

Now go plant something!`,
    skillId: null,
    color: '#9B7DF2',
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function defaultState() {
  return {
    version: 1,
    settings: { name: '', theme: 'light', sound: true, music: true, ringer: 'chime', hour24: false, onboarded: false },
    skills: [],   // {id, name, emoji, color, createdAt}
    tasks: [],    // {id, title, done, doneAt, due, skillId, priority, createdAt}
    weeklyTasks: [], // {id, title, done, doneAt, week, createdAt} — simple checklist for the current week
    events: [],   // {id, title, date, time, color, skillId, createdAt}
    notes: [welcomeNote()], // {id, title, body, skillId, color, pinned, createdAt, updatedAt}
    sessions: [], // {id, skillId, minutes, date, source, at}
    keepsakes: [], // earned keepsake ids (for one-time celebrations)
    timer: null,  // {skillId, durationSec, startedAt, pausedAt, pausedTotal}
    editedAt: null, // last local edit — cloud sync compares this (newest wins)
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return defaultState();
    const base = defaultState();
    const merged = { ...base, ...s, settings: { ...base.settings, ...s.settings } };
    // cream garden is the default face of Bloom — dark is opt-in, never OS-forced
    if (merged.settings.theme === 'auto') merged.settings.theme = 'light';
    // emoji era → line-icon era: give every skill an icon
    const E2I = { '📐': 'calc', '📚': 'book', '💻': 'code', '🗣️': 'globe', '🎹': 'music', '🎸': 'music', '🎵': 'music', '💪': 'dumbbell', '🏃‍♀️': 'ball', '🧘‍♀️': 'heart', '🎨': 'palette', '✍️': 'pencil', '🔬': 'flask', '🎓': 'cap', '🍳': 'pan', '🎮': 'gamepad', '💼': 'briefcase', '🎬': 'film', '💃': 'star', '🏊‍♀️': 'ball', '♟️': 'target', '📷': 'camera', '🧠': 'star', '🌿': 'sprout' };
    for (const sk of merged.skills) if (!sk.icon) sk.icon = E2I[sk.emoji] || 'sprout';
    // retint leftovers from the old violet palette
    for (const ev of merged.events) if (ev.color === '#9B7DF2') ev.color = '#D89B8A';
    for (const n of merged.notes) if (n.color === '#9B7DF2') n.color = '#D89B8A';
    return merged;
  } catch (e) {
    console.error('Bloom: could not load saved data', e);
    return defaultState();
  }
}

const listeners = new Set();
let onSaveCb = null; // cloud sync hooks in here — fires on every save, silent or not

export const store = {
  state: load(),
  setOnSave(fn) { onSaveCb = fn; },
  save(silent = false) {
    store.state.editedAt = new Date().toISOString(); // newest-edit-wins for cloud sync
    try { localStorage.setItem(KEY, JSON.stringify(store.state)); }
    catch (e) { console.error('Bloom: save failed', e); }
    onSaveCb?.();
    if (!silent) store.notify();
  },
  notify() { for (const fn of [...listeners]) fn(); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { store.state = defaultState(); store.save(); },
  replace(next) {
    const base = defaultState();
    store.state = { ...base, ...next, settings: { ...base.settings, ...(next.settings || {}) } };
    store.save();
  },
};

export function nextColor() {
  const used = new Set(store.state.skills.map((s) => s.color));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[store.state.skills.length % PALETTE.length];
}
