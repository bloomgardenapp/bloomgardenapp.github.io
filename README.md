# bloom 🌼

A personal productivity garden — tasks, calendar, notes and a focus timer, all feeding one little garden. Every skill you practice is a plant: focused minutes become XP, XP grows the plant from sprout to bloom, and your whole garden climbs tiers (Seed → Sprout → Bud → Bloom → Meadow → Forest).

Zero dependencies. No build step. Plain HTML/CSS/JS, everything stored in your browser.

## Run it

```
node server.mjs
```

then open **http://localhost:5190** — or just double-click `Start Bloom.command` (macOS).

## What's inside

- **Today** — greeting, streak & focus stats, today's plan, quick log, what's up next
- **Tasks** — due dates, priorities, plant links (+10 XP on completion), daily/weekly/monthly repeats
- **Calendar** — uniform month grid with event/task/focus dots; click a day for everything; repeating events with per-day skips
- **Notes** — autosaving, searchable, pinnable, linkable to plants
- **Focus** — single sessions or pomodoro cycles with breaks, five ringer sounds, background notifications, and a zen fullscreen where your plant grows live
- **Garden** — one kawaii pot per skill, levels & stage names, an illustrated hills banner that grows with your data, a 14-week consistency heatmap, garden-wide tiers

**Quick log** understands plain words: `1h math`, `30m spanish yesterday`, `45m piano 2026-07-01`.

**Keyboard:** `1–6` switch pages · `T` new task · `L` quick log · `F` focus · `Z` zen · `?` guide.

Levels cost `min(60 × level, 900)` XP each — your first hour levels you up fast, mastery takes real time.

## iPhone

There's a native iOS app in [`ios/`](ios/README.md) — SwiftUI, zero dependencies, same garden via the same account. The core loop (Today, Tasks, Focus, Garden) plus a Live Activity timer, a Home Screen widget, real notifications, and the lofi loop in your pocket.

## Data

Everything lives in `localStorage` in your browser (key `bloom.v1`). Use **⚙️ Settings → Export / Import** for backups. No accounts, no servers, no tracking.

## Stack & design

Vanilla ES modules + hand-rolled SVG (plants, hills, charts, confetti, line icons) + WebAudio sounds. Cream + olive "garden storybook" design: Fraunces serif italics, Quicksand body, thin pill buttons; light *day garden* by default with an opt-in *night garden* dark mode. `window.__bloom` exposes testing hooks on localhost.

Made with 💚 (and Claude) for Jasmine.
