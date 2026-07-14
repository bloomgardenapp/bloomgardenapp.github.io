// tour.js — interactive walkthrough. Dims the app and spotlights the real sections,
// one at a time, with a little bubble explaining each. Gentle: 5 stops, skippable.
import { el } from './util.js';
import { sfx } from './audio.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STEPS = [
  {
    route: '#/today', side: 'right',
    target: () => document.querySelector('#sidebar'),
    title: 'Getting around',
    text: 'Five little rooms — Today, Calendar, Notes, Focus and Garden. Click any of them, any time.',
  },
  {
    route: '#/today',
    target: () => [...document.querySelectorAll('#view .card')].find((c) => c.textContent.includes('plan')),
    title: 'Today’s plan',
    text: 'Your day at a glance — tasks due today and any events. Type in the box to add a task.',
  },
  {
    route: '#/today',
    target: () => document.querySelector('#quicklog')?.closest('.card'),
    title: 'Add time',
    text: 'Already did something? Type it in plain words — like “30m piano” — and it still counts.',
  },
  {
    route: '#/focus',
    target: () => document.querySelector('#view .focus-hero'),
    title: 'The focus timer',
    text: 'Pick a plant, press start, do the thing. Every minute you focus makes that plant grow.',
  },
  {
    route: '#/garden',
    target: () => document.querySelector('.garden-banner') || document.querySelector('#view .card'),
    title: 'Your garden',
    text: 'Everything you grow lives here. Click a plant for details — and open the Plant book to see what they can become.',
  },
];

let root = null;
let offRefresh = null;

export function endTour() {
  delete document.documentElement.dataset.tour;
  offRefresh?.();
  offRefresh = null;
  root?.remove();
  root = null;
}

export function startTour() {
  endTour();
  document.documentElement.dataset.tour = '1'; // router skips the entrance animation while touring
  const hole = el('div', { class: 'tour-hole' });
  const tip = el('div', { class: 'tour-tip' });
  root = el('div', { class: 'tour' }, hole, tip);
  document.body.append(root);

  let seq = 0; // stale-step guard: only the latest show() may touch the overlay
  let current = null; // step currently on screen — resize/scroll keep its spotlight glued

  const placeHole = (r, snap) => {
    const pad = 8;
    if (snap) hole.style.transition = 'none';
    Object.assign(hole.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
    if (snap) { void hole.offsetWidth; hole.style.transition = ''; }
  };

  const placeTip = (r, side, snap) => {
    // beside tall targets, else below (or above when cramped) — always clamped on-screen
    const vw = innerWidth, vh = innerHeight, m = 12;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left, top;
    if (side === 'right' && r.right + m + tw < vw) {
      left = r.right + m;
      top = Math.min(Math.max(r.top + r.height / 2 - th / 2, m), vh - th - m);
    } else {
      left = Math.min(Math.max(r.left + r.width / 2 - tw / 2, m), vw - tw - m);
      top = r.bottom + m + th < vh ? r.bottom + m : Math.max(r.top - th - m, m);
    }
    if (snap) tip.style.transition = 'none';
    Object.assign(tip.style, { left: `${left}px`, top: `${top}px` });
    if (snap) { void tip.offsetWidth; tip.style.transition = ''; }
  };

  // window resized or scrolled mid-tour → re-fit the spotlight to wherever the target is now
  let raf = 0;
  const refresh = () => {
    if (!root || !current) return;
    const t = current.target();
    if (!t) return;
    const r = t.getBoundingClientRect();
    placeHole(r, true);
    placeTip(r, current.side, true);
  };
  const queueRefresh = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(refresh); };
  addEventListener('resize', queueRefresh);
  addEventListener('scroll', queueRefresh, { passive: true, capture: true });
  offRefresh = () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', queueRefresh);
    removeEventListener('scroll', queueRefresh, { capture: true });
  };

  async function show(idx) {
    const my = ++seq;
    const st = STEPS[idx];
    if (!root) return;
    current = null; // hands off while we travel
    tip.classList.remove('show'); // fade out instead of blinking away
    if (location.hash !== st.route) {
      // fully dim while the page swaps, so the old spotlight never frames the wrong thing
      placeHole({ left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }, false);
      location.hash = st.route;
      await sleep(430); // let the router render the page
      if (!root || my !== seq) return;
    }
    const target = st.target();
    if (!target) { advance(idx); return; } // section missing? just move on
    // glide the page to the target instead of jumping — the spotlight travels with it
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(80);
    if (!root || my !== seq) return;
    placeHole(target.getBoundingClientRect(), false);

    const last = idx === STEPS.length - 1;
    tip.replaceChildren(
      el('div', { class: 'tour-kicker' }, `${idx + 1} of ${STEPS.length}`),
      el('h3', {}, st.title),
      el('p', {}, st.text),
      el('div', { class: 'tour-foot' },
        el('button', { class: 'link-btn', id: 'tour-skip', onClick: () => { sfx.click(); endTour(); } }, 'skip tour'),
        el('span', { class: 'spacer' }),
        el('button', {
          class: 'btn btn-primary', id: 'tour-next',
          onClick: () => { sfx.click(); advance(idx); },
        }, last ? 'Start growing' : 'Next'),
      ),
    );
    placeTip(target.getBoundingClientRect(), st.side, !tip.classList.contains('shown-once'));
    tip.classList.add('show', 'shown-once');

    // settle: smooth scroll + late layout can shift things — re-measure until quiet,
    // then hand the step to the resize/scroll refresher to keep it glued.
    for (const wait of [260, 520]) {
      sleep(wait).then(() => {
        if (!root || my !== seq) return;
        const fresh = st.target();
        if (!fresh) return;
        const r = fresh.getBoundingClientRect();
        const h = hole.getBoundingClientRect();
        if (Math.abs(h.left + 8 - r.left) > 2 || Math.abs(h.top + 8 - r.top) > 2 || Math.abs(h.width - 16 - r.width) > 2) {
          placeHole(r, false); // animate the correction — no snapping flash
          placeTip(r, st.side, false);
        }
        current = st;
      });
    }
  }

  function advance(idx) {
    if (idx + 1 >= STEPS.length) { endTour(); return; }
    show(idx + 1);
  }

  show(0);
}
