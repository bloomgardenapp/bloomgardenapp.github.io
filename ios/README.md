# bloom for iPhone 🌼

The native iOS version of Bloom — same garden, same plants, same math, written in SwiftUI. Signs into the **same account** as the web app, so your plants follow you between your browser and your phone.

## What's in v1 (the core loop)

- **Today** — greeting, daily quote, streak & focus stats, today's plan (tasks + your calendar events, read-only), weekly checklist, quick log, garden peek, focus chart
- **Tasks** — due dates, priorities, plant links, daily/weekly/monthly repeats, done-today drawer
- **Focus** — sessions and breaks with the ring timer, zen fullscreen with your plant growing live, manual "1h math" logging, session history
- **Garden** — the meadow scene, tier ladder (Seed → Forest), plant cards, plant details, the plant book, the keepsake shelf
- **Settings** — account sign-in (email code), name, day/night garden, sounds & music, 12/24h, ringer, daily reminder, reset

**Calendar and Notes come in a later pass.** Their data still syncs through untouched — nothing is ever dropped (the iOS data layer round-trips every field, even ones it doesn't know about yet).

iOS-native extras the web can't do:

- **Live Activity** — the focus countdown lives in the Dynamic Island and on the Lock Screen
- **Home Screen widget** — streak, today's minutes, and your top plant (small + medium)
- **Real notifications** — the session-end ringer and the daily reminder fire even with Bloom closed
- **Haptics** — little taps on completions and level-ups
- **Background lofi** — the generative study loop keeps playing with the screen off

## Run it

Open `ios/Bloom.xcodeproj` in Xcode, pick a simulator, press **Run**. No packages, no build steps — plain SwiftUI, zero dependencies, just like the web app.

### Install on your iPhone (free Apple ID)

1. Plug in your iPhone (or connect over Wi-Fi).
2. In Xcode: select the **Bloom** target → *Signing & Capabilities* → set **Team** to your personal team (add your Apple ID under Xcode → Settings → Accounts if it's not there). Do the same for the **BloomWidgets** target.
3. If Xcode complains the bundle id is taken, change `com.jasmine.bloom` (and `com.jasmine.bloom.widgets`, and the `group.com.jasmine.bloom` App Group in both `.entitlements` files) to any unique string.
4. Select your iPhone as the destination and press Run.
5. On the phone: *Settings → General → VPN & Device Management* → trust your developer certificate.

With a free Apple ID the install expires after **7 days** — just press Run again to re-sign. A paid developer account extends that to a year and unlocks TestFlight.

### One Supabase note

iOS signs in by **typing the 6-digit code** from the sign-in email (no link-clicking needed). That code appears in the email only if the Supabase *Magic Link* email template includes `{{ .Token }}` — the web app's code-entry path already relies on this, so it's probably configured. If the email arrives with a link but no code: Supabase dashboard → Authentication → Email Templates → Magic Link → add a line like `Your code: {{ .Token }}`.

## Map of the code

```
ios/
  Bloom.xcodeproj          hand-rolled, folder-synchronized (Xcode 16+) — new .swift files are picked up automatically
  Config/                  Info.plists + entitlements (App Group: group.com.jasmine.bloom)
  Shared/                  compiled into BOTH the app and the widget extension
    PlantArt.swift         the five species, ported stroke-for-stroke from plant.js (same seeded PRNG — identical plants)
    FocusActivityAttributes.swift   the Live Activity contract
    GardenSnapshot.swift   the light summary the widget reads from the App Group
    Fonts/                 Fraunces + Quicksand (OFL, from Google Fonts)
  Bloom/                   the app
    Models.swift           bloom.v1 mirrored — every type keeps unknown JSON keys in `extra` so sync can never drop web data
    Store.swift            store.js + progress.js + the focus.js timer engine
    Dates.swift            util.js date helpers (local-timezone ymd, JS-format ISO timestamps)
    QuickLog.swift         the "1h math" parser + guessIcon
    Levels.swift           levelForXp (90·level, cap 1200), tiers, keepsakes
    Cloud.swift            cloud.js: email-code auth, gardens upsert, newest-edit-wins, substance rules
    Synth.swift / Music.swift   audio.js: the kalimba toks, four ringers, and the 74bpm lofi loop
    …Views + Theme + Components
  BloomWidgets/            widget extension: garden widget + focus Live Activity
```

Testing hooks (`DEBUG` builds only, like the web's `window.__bloom`): launch with `-bloomTab garden`, `-bloomSheet settings`, or `-bloomZen 1`.

## Where the truth lives

The web app's `bloom.v1` JSON is the contract. The iOS model layer was **cross-validated against the actual web code**: fixtures round-trip byte-semantically (unknown keys preserved), and the level/date/parser functions were diffed against `util.js` running in node. If you change the web schema, mirror it in `Models.swift` — the `extra` bags will carry anything you forget, but known fields deserve real types.

Made with 💚 (and Claude) for Jasmine.
