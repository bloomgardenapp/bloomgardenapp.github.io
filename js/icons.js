// icons.js — hand-drawn-style line icons (GOBE vibe). Stroke follows currentColor.
const P = {
  sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5"/>',
  moon: '<path d="M19.5 14.3A8 8 0 1 1 9.7 4.5a6.6 6.6 0 0 0 9.8 9.8z"/>',
  'check-square': '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.5 12.3l2.4 2.4 4.7-5.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  calendar: '<rect x="3.6" y="5" width="16.8" height="15.3" rx="4"/><path d="M8 3.4V7M16 3.4V7M3.6 10.2h16.8"/>',
  note: '<rect x="4.6" y="3.6" width="14.8" height="16.8" rx="3.6"/><path d="M8.5 8.6h7M8.5 12.1h7M8.5 15.6h4.2"/>',
  hourglass: '<path d="M7 3.6h10M7 20.4h10M8.2 3.6c0 3.9 2.6 5.3 3.8 8.4 1.2-3.1 3.8-4.5 3.8-8.4M8.2 20.4c0-3.9 2.6-5.3 3.8-8.4 1.2 3.1 3.8 4.5 3.8 8.4"/>',
  sprout: '<path d="M12 20.5v-7"/><path d="M12 13.5c.2-3.7-2.3-6.2-6.2-6.2.2 3.9 2.7 6.2 6.2 6.2z"/><path d="M12 11.7c-.1-2.9 2-4.9 5.4-4.9-.1 3.2-2.3 5-5.4 4.9z"/>',
  leaf: '<path d="M5.6 18.4C5.6 10.2 10 5.6 18.9 5.6c0 8.9-4.6 13.3-12.8 12.8z"/><path d="M6.8 17.2c2.4-3.4 5.5-6.4 9.4-8.9"/>',
  flower: '<circle cx="12" cy="12" r="2.3"/><ellipse cx="12" cy="6.7" rx="2" ry="3"/><ellipse cx="17.3" cy="12" rx="3" ry="2"/><ellipse cx="12" cy="17.3" rx="2" ry="3"/><ellipse cx="6.7" cy="12" rx="3" ry="2"/>',
  daisy: '<circle cx="12" cy="12" r="2.1"/><ellipse cx="12" cy="6.9" rx="1.8" ry="2.7"/><ellipse cx="17.1" cy="12" rx="2.7" ry="1.8"/><ellipse cx="12" cy="17.1" rx="1.8" ry="2.7"/><ellipse cx="6.9" cy="12" rx="2.7" ry="1.8"/><ellipse cx="15.6" cy="8.4" rx="1.8" ry="2.7" transform="rotate(45 15.6 8.4)"/><ellipse cx="15.6" cy="15.6" rx="2.7" ry="1.8" transform="rotate(45 15.6 15.6)"/><ellipse cx="8.4" cy="15.6" rx="1.8" ry="2.7" transform="rotate(45 8.4 15.6)"/><ellipse cx="8.4" cy="8.4" rx="2.7" ry="1.8" transform="rotate(45 8.4 8.4)"/>',
  pine: '<path d="M12 3.6L16.6 10h-2.8l4.2 6.4h-4.6v4h-2.8v-4H6L10.2 10H7.4z"/>',
  seed: '<ellipse cx="12" cy="13" rx="5" ry="6.6" transform="rotate(16 12 13)"/><path d="M11 8.6c1.7 1.4 2.4 3.1 2.2 5.4"/>',
  flame: '<path d="M12 3.6c1 2.5 3.9 4.4 3.9 7.8a3.9 3.9 0 0 1-7.8 0c0-1.5.5-2.8 1.4-3.9.3.9.9 1.6 1.8 2.1-.3-2.2.4-4.3.7-6z"/><path d="M12 20.4a5.4 5.4 0 0 1-5.4-5.4c0-1 .2-1.9.7-2.8"/>',
  stopwatch: '<circle cx="12" cy="13.4" r="7"/><path d="M12 10.3v3.4l2.4 1.5M10 3.6h4M12 3.6v2.8"/>',
  bars: '<path d="M5.5 20v-6.6M12 20V7.6M18.5 20v-9.2"/>',
  bolt: '<path d="M13.2 3.6L6.6 13.4h4.3l-.9 7 6.7-9.8h-4.4z"/>',
  clipboard: '<rect x="5" y="5" width="14" height="15.4" rx="3.4"/><path d="M9.4 5a2.6 2.6 0 0 1 5.2 0M9 11h6M9 15h4.2"/>',
  gear: '<path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15"/><circle cx="9.5" cy="7.5" r="1.9" fill="var(--card, #fff)"/><circle cx="15" cy="12" r="1.9" fill="var(--card, #fff)"/><circle cx="8" cy="16.5" r="1.9" fill="var(--card, #fff)"/>',
  pin: '<path d="M14.6 3.8l5.6 5.6-2.4.8c-.7.3-1.5.2-2.2-.2l-3.6 3.6c.5 1.4.2 3-.9 4.1l-6.8-6.8c1.1-1.1 2.7-1.4 4.1-.9l3.6-3.6c-.4-.7-.5-1.5-.2-2.2z"/><path d="M7.4 16.6l-3 3"/>',
  trash: '<path d="M5 7h14M9.6 7V5.5A1.5 1.5 0 0 1 11.1 4h1.8a1.5 1.5 0 0 1 1.5 1.5V7M7 7l.8 11.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L17 7M10.3 10.8v4.8M13.7 10.8v4.8"/>',
  pencil: '<path d="M14.4 5.6l4 4L8.3 19.7l-4.6.6.6-4.6zM12.6 7.4l4 4"/>',
  pause: '<path d="M9 6.5v11M15 6.5v11"/>',
  play: '<path d="M8.2 5.8l10.4 6.2-10.4 6.2z"/>',
  drop: '<path d="M12 3.8c2.9 3.8 5.7 6.7 5.7 10a5.7 5.7 0 0 1-11.4 0c0-3.3 2.8-6.2 5.7-10z"/>',
  pot: '<path d="M5.4 12.6h13.2M6.2 12.6l1 6.3a2 2 0 0 0 2 1.7h5.6a2 2 0 0 0 2-1.7l1-6.3M12 12.2V9.4"/><path d="M12 9.4c.2-2.7-1.7-4.5-4.6-4.5.1 2.9 2 4.6 4.6 4.5zM12 9.4c-.1-2.2 1.5-3.8 4.1-3.8-.1 2.5-1.8 3.9-4.1 3.8z"/>',
  clock: '<circle cx="12" cy="12" r="7.6"/><path d="M12 7.8v4.4l2.8 1.7"/>',
  arrow: '<path d="M5 12h13M13.6 6.6L19 12l-5.4 5.4"/>',
  heart: '<path d="M12 19.6s-7.3-4.6-7.3-9.7A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.3 2.6c0 5.1-7.3 9.7-7.3 9.7z"/>',
  bell: '<path d="M6.2 16.4h11.6c-1.2-1.2-1.7-2.2-1.7-3.9v-2.4a4.1 4.1 0 0 0-8.2 0v2.4c0 1.7-.5 2.7-1.7 3.9z"/><path d="M10.5 18.9a1.6 1.6 0 0 0 3 0"/>',
  'bell-off': '<path d="M6.2 16.4h11.6c-1.2-1.2-1.7-2.2-1.7-3.9v-2.4a4.1 4.1 0 0 0-8.2 0v2.4c0 1.7-.5 2.7-1.7 3.9z"/><path d="M10.5 18.9a1.6 1.6 0 0 0 3 0M5 4.5l14 15"/>',
  download: '<path d="M12 4.2v9.6M8.2 10.4l3.8 3.8 3.8-3.8M5 19.4h14"/>',
  folder: '<path d="M4 7.4A2.4 2.4 0 0 1 6.4 5h3.1l2 2.4h6.1A2.4 2.4 0 0 1 20 9.8v6.8a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 16.6z"/>',
  reset: '<path d="M4.6 12a7.4 7.4 0 1 1 2.1 5.2M4.6 17.4v-4h4"/>',
  help: '<circle cx="12" cy="12" r="8.4"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.7c-.8.4-1.1 1-1.1 1.9M12 17.2h.01"/>',
  repeat: '<path d="M17.6 4.6l2.8 2.8-2.8 2.8"/><path d="M4.4 11V9.9a2.5 2.5 0 0 1 2.5-2.5h13.3"/><path d="M6.4 19.4l-2.8-2.8 2.8-2.8"/><path d="M19.6 13v1.1a2.5 2.5 0 0 1-2.5 2.5H3.8"/>',
  expand: '<path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15"/>',
  'x-circle': '<circle cx="12" cy="12" r="8.4"/><path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4"/>',
};

export function svgStr(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function ic(name, { size = 18, cls = '' } = {}) {
  const span = document.createElement('span');
  span.className = ('ic ' + cls).trim();
  span.innerHTML = svgStr(name, size);
  return span;
}
