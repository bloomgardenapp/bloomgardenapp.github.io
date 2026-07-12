// progress.js — XP, levels, sessions, streaks. The connective tissue of Bloom.
import { store, uid } from './store.js';
import { levelForXp, todayYmd, addDays, ymd, fmtMin } from './util.js';
import { toast } from './ui.js';
import { sfx } from './audio.js';
import { rain } from './confetti.js';

export const skillById = (id) => store.state.skills.find((s) => s.id === id);

// XP = focused minutes + 10 per completed linked task (recurring tasks bank +10 per completion)
export function xpOf(skillId) {
  const s = store.state;
  const mins = s.sessions.reduce((a, x) => a + (x.skillId === skillId ? x.minutes : 0), 0);
  let taskXp = 0;
  for (const t of s.tasks) {
    if (t.skillId !== skillId) continue;
    if (t.done) taskXp += 10;
    taskXp += (t.completions || 0) * 10;
  }
  return mins + taskXp;
}
export const levelOf = (skillId) => levelForXp(xpOf(skillId));

export function celebrateIfLeveled(skillId, before) {
  const sk = skillById(skillId);
  if (!sk) return false;
  const after = levelOf(skillId).level;
  if (after > before) {
    sfx.level();
    rain();
    toast(`${sk.name} grew to Level ${after}!`, 'star');
    return true;
  }
  return false;
}

export function logSession({ skillId, minutes, date = todayYmd(), source = 'manual', quiet = false }) {
  const sk = skillById(skillId);
  if (!sk || !minutes) return;
  const before = levelOf(skillId).level;
  store.state.sessions.push({ id: uid(), skillId, minutes: Math.round(minutes), date, source, at: new Date().toISOString() });
  store.save();
  if (!quiet) {
    const leveled = celebrateIfLeveled(skillId, before);
    if (!leveled) toast(`+${fmtMin(minutes)} → ${sk.name} · ${fmtMin(minutesTotal(skillId))} total`, (sk.icon || 'sprout'));
  }
}

export const minutesOn = (date, skillId = null) =>
  store.state.sessions.reduce((a, s) => a + (s.date === date && (!skillId || s.skillId === skillId) ? s.minutes : 0), 0);

export const minutesTotal = (skillId = null) =>
  store.state.sessions.reduce((a, s) => a + (!skillId || s.skillId === skillId ? s.minutes : 0), 0);

export function lastNDays(n, skillId = null) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(minutesOn(addDays(todayYmd(), -i), skillId));
  return out;
}
export const weekMinutes = (skillId = null) => lastNDays(7, skillId).reduce((a, b) => a + b, 0);

export function tasksDoneOn(date) {
  // doneAt is the last completion — recurring tasks keep done=false but still count for the day
  return store.state.tasks.filter((t) => t.doneAt && (t.done || t.repeat) && ymd(new Date(t.doneAt)) === date).length;
}
export const activeOn = (date) => minutesOn(date) > 0 || tasksDoneOn(date) > 0;

export function streak() {
  let d = todayYmd(), n = 0;
  if (!activeOn(d)) d = addDays(d, -1); // today doesn't break it until midnight
  while (activeOn(d) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}

// ---- garden-wide tiers (GOBE-style), based on total focused hours ----
export const TIERS = [
  { name: 'Seed', icon: 'seed', hours: 0 },
  { name: 'Sprout', icon: 'sprout', hours: 5 },
  { name: 'Bud', icon: 'leaf', hours: 15 },
  { name: 'Bloom', icon: 'flower', hours: 40 },
  { name: 'Meadow', icon: 'daisy', hours: 100 },
  { name: 'Forest', icon: 'pine', hours: 250 },
];
export function gardenTier(skillId = null) {
  const h = minutesTotal(skillId) / 60; // per-plant when a skill is given
  let i = 0;
  while (i + 1 < TIERS.length && h >= TIERS[i + 1].hours) i++;
  const cur = TIERS[i], next = TIERS[i + 1] || null;
  const progress = next ? Math.min(1, (h - cur.hours) / (next.hours - cur.hours)) : 1;
  return { index: i, cur, next, progress, minutesToNext: next ? Math.ceil((next.hours - h) * 60) : 0 };
}

// ---- keepsakes: milestone badges for the garden shelf ----
export const KEEPSAKES = [
  { id: 'first-drop', icon: 'drop', name: 'First watering', how: 'log your first session', test: (s) => s.sessions.length >= 1 },
  { id: 'real-garden', icon: 'sprout', name: 'A real garden', how: 'grow three plants at once', test: (s) => s.skills.length >= 3 },
  { id: 'week-streak', icon: 'flame', name: 'A full week', how: 'keep a 7-day streak', test: () => streak() >= 7 },
  { id: 'month-streak', icon: 'star', name: 'A whole month', how: 'keep a 30-day streak', test: () => streak() >= 30 },
  { id: 'ten-hours', icon: 'clock', name: 'Ten hours grown', how: 'reach 10 focused hours', test: () => minutesTotal() >= 600 },
  { id: 'deep-roots', icon: 'pine', name: 'Deep roots', how: 'reach 50 focused hours', test: () => minutesTotal() >= 3000 },
  { id: 'first-bloom', icon: 'flower', name: 'First bloom', how: 'grow a plant to level 7', test: (s) => s.skills.some((k) => levelOf(k.id).level >= 7) },
  { id: 'radiant', icon: 'daisy', name: 'Radiant', how: 'grow a plant to level 10', test: (s) => s.skills.some((k) => levelOf(k.id).level >= 10) },
  { id: 'task-tamer', icon: 'check-square', name: 'Task tamer', how: 'finish 25 tasks', test: (s) => s.tasks.filter((t) => t.done).length + s.tasks.reduce((a, t) => a + (t.completions || 0), 0) >= 25 },
];

export function checkKeepsakes() {
  const s = store.state;
  if (!s.keepsakes) s.keepsakes = [];
  const fresh = KEEPSAKES.filter((k) => !s.keepsakes.includes(k.id) && k.test(s));
  if (!fresh.length) return;
  for (const k of fresh) s.keepsakes.push(k.id);
  store.save(true);
  sfx.level();
  rain();
  if (fresh.length === 1) toast(`Keepsake earned: ${fresh[0].name}!`, fresh[0].icon);
  else toast(`${fresh.length} keepsakes earned — see your garden shelf`, 'star');
}

// per-plant stage name, matched to what the plant visually shows at that level
export function stageName(level) {
  if (level <= 2) return 'sprout';
  if (level <= 6) return 'bud';
  if (level <= 9) return 'bloom';
  return 'radiant';
}
