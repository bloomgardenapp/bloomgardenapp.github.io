# Bloom — handover notes

Written 2026-10-26. Covers the state of the app, the domain move and the Pinterest ads,
so a fresh session can pick any of it up without re-deriving it.

---

## 1. App fixes shipped this session

All committed and pushed to `main`, all live on GitHub Pages.

| commit | what |
|---|---|
| `f185107` | Focus timer ringer fires on time in a background tab |
| `502e5ea` | Day planner stops lurching when you add to it |
| `19cf70d` | iOS: today's tasks Home Screen widget |
| `08e6a0d` | Share `.claude/launch.json`, ignore `settings.local.json` |
| `0de46b4` | Add-event form points at a field instead of yanking the page |
| `9c97f56` | Half-hour events show their name, not just a clock |
| `63b317e` | Modals pin the page instead of letting it drift behind them |
| `202708d` | Plant book fits the phone instead of running off it |
| `d0d8947` | Phone calendar day boxes are square, not tall bars |
| `510149f` | iOS: phone day boxes match the web's square cells |

### How the ringer fix works (the non-obvious one)

The ring used to happen only inside the 500 ms tick in `js/main.js`. A background tab
throttles that to ~once a minute and sleep stops it dead, so a finished pomodoro stayed
silent until you looked. Now the ring is queued on the **WebAudio clock** the moment a
phase starts (`scheduleRinger` in `js/audio.js`), because audio nodes fire on the audio
thread regardless of JS throttling. `syncAlarm()` in `js/views/focus.js` keeps that queued
ring matching the live session; `completeTimer` only makes noise if the queued ring has
not already gone off.

---

## 2. Domain move — IN PROGRESS, needs finishing

Moving from `bloomgardenapp.github.io` to **`bloomgarden.study`** (registered at Porkbun,
expires 2027-10-25).

### Done
- Root `A` record → `185.199.108.153` (one of GitHub's four Pages IPs)
- `CNAME` file added to the repo root containing `bloomgarden.study`
- All four ad templates and `PIN-COPY.md` updated to the new domain
- The five "quiet" ads re-rendered with the new URL printed on them

### Still to do — in Porkbun DNS for `bloomgarden.study`

**Add the other three A records on the root** (host left blank). Only one of four is in,
so the site works but has no failover:

```
A  (blank)  185.199.109.153
A  (blank)  185.199.110.153
A  (blank)  185.199.111.153
```

**Fix `www`.** It still points at Porkbun's parking page. It needs to be:

```
CNAME  www  bloomgardenapp.github.io
```

> Two gotchas hit while doing this by browser automation:
> 1. Porkbun's delete button raises a **native `confirm()` dialog**, which freezes the
>    page's renderer and locks the Chrome extension out entirely. Reloading the tab
>    clears it. Work around it by **editing** existing records rather than deleting them.
> 2. Porkbun's CSRF token expires if the page sits open. Symptom is
>    `Error: Security Error. Refresh and try again.` — just reload before editing.

**Then, after DNS is complete:** check GitHub → Settings → Pages shows the custom domain
with a valid certificate, and tick **Enforce HTTPS**. GitHub issues the cert automatically
once DNS resolves; it can take a few minutes to an hour.

---

## 3. Known problem — Vercel is serving a stale build

`bloomgardenapp.vercel.app` is a **second deployment of this same site** and it is behind.
It is missing every fix from this session plus the pop-out timer, and its `style.css`
matches no commit in history, so it was built from a state that was never pushed.

**This matters:** the Pinterest pin with 19.2k views points at the Vercel URL, so that
traffic lands on the stale build. Pinterest does not allow editing a published pin's
destination URL.

Two options:
- **Reconnect** the Vercel project to the GitHub repo (Vercel → `bloomgarden` project →
  Settings → Git) so it redeploys on push. Keeps the old pin working.
- **Delete** the Vercel project so there is one source of truth. The old pin then 404s.

The Vercel CLI is installed and logged in as `tojasmineewang-1117`, so `vercel --prod`
from the repo root would deploy current code immediately as a stopgap.

---

## 4. Pinterest ads

Everything lives in `tmp/ads/`. Rendered PNGs are in `tmp/ads/out/`.

### The templates

Each is a standalone HTML page that embeds the **real app in an iframe** and seeds its own
demo garden into `localStorage` first, so screenshots are current and reproducible on any
machine. Add a new entry to the `PINS` / `CARDS` object to make a new variant.

| file | style | size |
|---|---|---|
| `pin.html` | direct product ad — big serif headline, flower bullets, sparkles | 1000×1500 |
| `card.html` | app-recommendation post — handwritten title, paragraph copy, textured bg | 1000×1250 |
| `site.html` | site-level — browser window, laptop+phone, three-phone tour | 1000×1250 |
| `quiet.html` | minimal — one line of copy, flat background, lots of air | 1000×1250 |

### Rendering

The local server must be running (`node server.mjs`, port 5190). Then:

```bash
cd tmp/ads
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
perl -e 'alarm 90; exec @ARGV' "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --no-first-run --no-default-browser-check --disable-extensions \
  --user-data-dir="/tmp/bloom-render" \
  --window-size=1000,1250 --virtual-time-budget=4500 \
  --screenshot="out/NAME.png" "http://localhost:5190/tmp/ads/quiet.html?v=free"
```

Notes:
- The `perl alarm` wrapper is **required**. The app has infinite `setInterval` loops, so
  `--virtual-time-budget` can hang forever without a watchdog.
- Use `--window-size=1000,1500` for `pin.html`.
- The browser pane caps screenshots at 800px wide, which is why rendering goes through
  headless Chrome rather than the preview tools.

### Copy

`tmp/ads/PIN-COPY.md` has a title, description, alt text and board suggestion for each of
the five quiet ads, plus keywords and posting notes.

### Still to do
- The ten older ads (`bloom-*.png`, `site-*.png`) still have `bloomgardenapp.github.io`
  burned into them. Re-render them once the domain is confirmed working.

---

## 5. Gotcha worth remembering

`const top = ...` at the top level of a classic script **silently kills the whole script** —
it collides with the read-only `window.top` global. This cost a debugging round when
`site.html` rendered as a blank page with only the static HTML showing.
