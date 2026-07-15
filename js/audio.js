// audio.js — tiny WebAudio synth for UI sounds + selectable timer ringers.
import { store } from './store.js';

let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { t = 0, dur = 0.15, type = 'sine', vol = 0.16, glide = 0, lp = 0 } = {}) {
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
    let head = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); head = f; }
    head.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  } catch { /* audio blocked — fine */ }
}

// the tiny contact noise that makes a synth tone read as a physical "tok"
function tap({ t = 0, dur = 0.015, vol = 0.02, freq = 2000 } = {}) {
  if (!store.state.settings.sound) return;
  try {
    const c = ac();
    const len = Math.max(1, (c.sampleRate * dur) | 0);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start(c.currentTime + t);
  } catch { /* audio blocked — fine */ }
}

// ---- timer ringers (pick yours in Settings) ----
export const RINGERS = {
  chime: {
    label: 'Chime', span: 1.1,
    play: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, { t: i * 0.13, dur: 0.55, vol: 0.26 })),
  },
  bell: {
    label: 'Bell', span: 2.1,
    play: () => {
      tone(880, { dur: 1.2, vol: 0.24 }); tone(1760, { dur: 0.7, vol: 0.08 });
      tone(659, { t: 0.55, dur: 1.4, vol: 0.24 }); tone(1318, { t: 0.55, dur: 0.8, vol: 0.08 });
    },
  },
  birdsong: {
    label: 'Birdsong', span: 0.95,
    play: () => {
      [[2300, 0], [2700, 0.1], [2450, 0.22], [3000, 0.36], [2600, 0.52], [3150, 0.64]]
        .forEach(([f, t]) => tone(f, { t, dur: 0.1, vol: 0.13, glide: 1.25 }));
    },
  },
  marimba: {
    label: 'Marimba', span: 1.0,
    play: () => [1047, 784, 659, 523, 659, 784].forEach((f, i) => tone(f, { t: i * 0.11, dur: 0.28, type: 'triangle', vol: 0.28 })),
  },
  silent: { label: 'Silent', span: 0, play: () => {} },
};

// repeats > 1 turns the ringer into a real alarm — the pattern plays back-to-back
export function playRinger(name, repeats = 1) {
  const key = name || store.state.settings.ringer || 'chime';
  const r = RINGERS[key] || RINGERS.chime;
  for (let i = 0; i < repeats; i++) {
    if (i === 0) r.play();
    else setTimeout(() => r.play(), i * (r.span || 1) * 1000);
  }
}

function noiseSource(c, color = 'white') {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
    else d[i] = white;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

// ---- background music: a soft generative lofi study loop, on by default ----
let musicNodes = null;
let musicTimer = null;

export function musicPlaying() { return !!musicNodes; }

export function startMusic() {
  if (musicNodes) return;
  if (!store.state.settings.sound || store.state.settings.music === false) return;
  try {
    const c = ac();
    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
    // gentle glue so the fuller mix stays smooth, never spiky
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 4;
    master.connect(comp).connect(c.destination);

    // dusty vinyl bed under everything
    const air = noiseSource(c, 'brown');
    const airF = c.createBiquadFilter();
    airF.type = 'lowpass';
    airF.frequency.value = 240;
    const airG = c.createGain();
    airG.gain.value = 0.008;
    air.connect(airF).connect(airG).connect(master);
    air.start();

    musicNodes = [master, air, airF, airG, comp];

    // one shared noise buffer; every hat/snare/crackle is a cheap slice of it
    const noiseBuf = (() => {
      const len = c.sampleRate | 0;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    })();
    const noiseHit = (t, { dur = 0.05, vol = 0.02, type = 'highpass', freq = 6000, q = 1 } = {}) => {
      const s = c.createBufferSource();
      s.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random() * 0.5, dur + 0.05);
    };

    // Rhodes-ish electric piano: soft attack, bell overtone, muffled top
    const ep = (f, t, dur = 2.4, vol = 0.042) => {
      for (const [mult, v] of [[1, vol], [2.004, vol * 0.28]]) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const filt = c.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 1800;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(filt).connect(g).connect(master);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    };
    const bass = (f, t, dur) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.065, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.1);
    };
    const kick = (t, vol = 0.12) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(105, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.3);
    };
    const snare = (t) => noiseHit(t, { dur: 0.16, vol: 0.042, type: 'bandpass', freq: 1900, q: 0.8 });
    const hat = (t, vol) => noiseHit(t, { dur: 0.04, vol, type: 'highpass', freq: 6500 });

    // ~74bpm lofi study loop with swing: Fmaj7 → Em7 → Dm7 → Cmaj7
    const CHORDS = [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63],
      [130.81, 164.81, 196.0, 246.94],
    ];
    const PENTA = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46];
    const BEAT = 60 / 74;
    const BAR = BEAT * 4;
    const SWING = BEAT * 0.14; // off-eighths land late — that lazy lofi feel
    let bar = 0;
    let nextBar = c.currentTime + 0.15;
    const scheduleBar = () => {
      const t0 = nextBar;
      const chord = CHORDS[bar % CHORDS.length];
      // chord stab on 1, softer echo stab on the and-of-2 most bars
      chord.forEach((f, i) => ep(f, t0 + i * 0.03));
      if (Math.random() < 0.7) chord.forEach((f, i) => ep(f, t0 + BEAT * 1.5 + SWING + i * 0.03, 1.2, 0.022));
      // bass: root on 1, root or fifth on 3
      bass(chord[0] / 2, t0, BEAT * 1.6);
      bass((Math.random() < 0.4 ? chord[2] : chord[0]) / 2, t0 + BEAT * 2, BEAT * 1.4);
      // drums: kicks on 1 & 3 (ghost before 4 sometimes), snares on 2 & 4, swung hats
      kick(t0);
      kick(t0 + BEAT * 2, 0.09);
      if (Math.random() < 0.3) kick(t0 + BEAT * 2.75, 0.06);
      snare(t0 + BEAT);
      snare(t0 + BEAT * 3);
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.12) continue; // dropped hats keep it human
        hat(t0 + BEAT * (i / 2) + (i % 2 ? SWING : 0), 0.011 + Math.random() * 0.008);
      }
      // vinyl crackle pops
      for (let i = 0, n = 2 + ((Math.random() * 4) | 0); i < n; i++) {
        noiseHit(t0 + Math.random() * BAR, { dur: 0.02, vol: 0.004 + Math.random() * 0.007, type: 'highpass', freq: 2500 });
      }
      // a lazy pentatonic sprinkle now and then
      if (Math.random() < 0.6) {
        const f = PENTA[(Math.random() * PENTA.length) | 0] / (Math.random() < 0.3 ? 2 : 1);
        ep(f, t0 + BEAT * (1 + ((Math.random() * 5) | 0) * 0.5) + SWING, 1.4, 0.026);
      }
      bar++;
      nextBar += BAR;
    };
    scheduleBar();
    scheduleBar();
    musicTimer = setInterval(() => {
      if (!musicNodes) return;
      while (nextBar < c.currentTime + BAR * 1.5) scheduleBar();
    }, 800);

    document.addEventListener('pointerdown', () => { if (c.state === 'suspended') c.resume(); }, { once: true });
  } catch { /* audio unavailable — fine */ }
}

export function stopMusic(fade = true) {
  clearInterval(musicTimer);
  musicTimer = null;
  if (!musicNodes) return;
  const nodes = musicNodes;
  musicNodes = null;
  try {
    const master = nodes[0];
    const c = master.context;
    if (fade) {
      master.gain.cancelScheduledValues(c.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), c.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1);
    }
    setTimeout(() => {
      for (const n of nodes) { try { n.stop?.(); } catch { } try { n.disconnect?.(); } catch { } }
    }, fade ? 1100 : 0);
  } catch { /* already torn down */ }
}

export function syncMusic() {
  if (store.state.settings.sound && store.state.settings.music !== false) startMusic();
  else stopMusic();
}

// UI sounds: warm wood taps — a kalimba "tok" for every touch
const tok = (f, { t = 0, vol = 0.055, dur = 0.09 } = {}) => {
  tone(f, { t, dur, vol, type: 'triangle', lp: 1600 });
  tap({ t, dur: 0.015, vol: vol * 0.3, freq: 2000 });
};
export const sfx = {
  // click/pop are the incidental "tapping" feedback — silenced by the taps toggle
  click: () => { if (store.state.settings.taps === false) return; tok(620); },
  pop: () => { if (store.state.settings.taps === false) return; tok(523); tok(784, { t: 0.09, dur: 0.12 }); },
  start: () => { tok(440, { dur: 0.11 }); tok(587, { t: 0.11, dur: 0.14 }); },
  chime: () => playRinger(),
  alarm: () => playRinger(null, 3), // timer's done — the ringer repeats so you actually hear it
  level: () => [523, 659, 784, 1047].forEach((f, i) => tok(f, { t: i * 0.09, dur: 0.22, vol: 0.07 })),
  uhoh: () => { tok(494, { dur: 0.11 }); tok(370, { t: 0.11, dur: 0.16 }); },
};
