// audio.js — tiny WebAudio synth for UI sounds + selectable timer ringers.
import { store } from './store.js';

let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { t = 0, dur = 0.15, type = 'sine', vol = 0.16, glide = 0 } = {}) {
  if (!store.state.settings.sound) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    const start = c.currentTime + t;
    o.frequency.setValueAtTime(freq, start);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, start + dur * 0.7);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  } catch { /* audio blocked — fine */ }
}

// ---- timer ringers (pick yours in Settings) ----
export const RINGERS = {
  chime: {
    label: 'Chime',
    play: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, { t: i * 0.13, dur: 0.4, vol: 0.14 })),
  },
  bell: {
    label: 'Bell',
    play: () => {
      tone(880, { dur: 1.2, vol: 0.13 }); tone(1760, { dur: 0.7, vol: 0.04 });
      tone(659, { t: 0.55, dur: 1.4, vol: 0.13 }); tone(1318, { t: 0.55, dur: 0.8, vol: 0.04 });
    },
  },
  birdsong: {
    label: 'Birdsong',
    play: () => {
      [[2300, 0], [2700, 0.1], [2450, 0.22], [3000, 0.36], [2600, 0.52], [3150, 0.64]]
        .forEach(([f, t]) => tone(f, { t, dur: 0.1, vol: 0.07, glide: 1.25 }));
    },
  },
  marimba: {
    label: 'Marimba',
    play: () => [1047, 784, 659, 523, 659, 784].forEach((f, i) => tone(f, { t: i * 0.11, dur: 0.28, type: 'triangle', vol: 0.15 })),
  },
  silent: { label: 'Silent', play: () => {} },
};

export function playRinger(name) {
  const key = name || store.state.settings.ringer || 'chime';
  (RINGERS[key] || RINGERS.chime).play();
}

export const sfx = {
  click: () => tone(660, { dur: 0.07, vol: 0.07, type: 'triangle' }),
  pop: () => { tone(520, { dur: 0.09, type: 'triangle' }); tone(784, { t: 0.07, dur: 0.13, type: 'triangle' }); },
  start: () => { tone(440, { dur: 0.1, type: 'sine' }); tone(660, { t: 0.1, dur: 0.16, type: 'sine' }); },
  chime: () => playRinger(),
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { t: i * 0.09, dur: 0.32, type: 'triangle' })),
  uhoh: () => { tone(330, { dur: 0.12, type: 'triangle' }); tone(262, { t: 0.11, dur: 0.18, type: 'triangle' }); },
};
