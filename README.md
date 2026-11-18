# HelpSetu

**Find the right help. Fast.**

HelpSetu is a free, independent, offline-first directory of essential Indian public services and emergency helplines. It is built to be simple enough for a 70-year-old and a 5-year-old: one clear action per screen, big touch targets, plain language, and no ads or tracking.

> In an emergency, call **112** — police, fire and ambulance, anywhere in India.

## What it does

- **One-tap calling** through standard `tel:` links. HelpSetu never places a call by itself.
- **Problem search** — “train toilet dirty”, “gas leak”, “UPI fraud”, “bike broken” — with a short “what to do now” guide before the number.
- **25 Indian languages**: English, हिंदी, বাংলা and 22 more regional languages (Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, Nepali, Sanskrit, Maithili, Santali, Konkani, Dogri, Manipuri, Sindhi, Bhojpuri, Awadhi, Marwari and Tulu). Machine-translated packs are marked **Auto**; numbers and official links never change.
- **Mobile-only layout**, constrained to a phone-width column, with big touch targets and light / dark themes.
- **Always updatable**: a PWA update bar on the web, and an installable signed APK that can be replaced with a newer build.
- **Developer support on WhatsApp: +91 83719 98257** (<https://wa.me/918371998257>) — from Settings → Developer support, and from About.
- **Verified national and state services**: emergency, railways, highways, LPG, cybercrime, consumer, women and child, health, government, banking, utilities and travel.
- **Official source and checked date** shown on every service. State services are never presented as all-India numbers.
- **Saved services and recent history** stored only on the device.
- **Works offline** after the first visit, including the complete directory and the dialler links.
- **Installable PWA** with home-screen shortcuts for 112, railway help 139 and saved services.
- **Light, dark and system themes**, plus Normal / Large / Extra-large text.
- **No account, no location permission, no ads, no third-party analytics.**

## Run it locally

Any static file server works. From this folder:

```sh
python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

Do not open `index.html` directly with `file://` if you want the service worker and install prompt; browsers require HTTP or HTTPS for those.

### Releasing an update

Browsers keep the app shell in the service-worker cache. When you change `styles.css`, `data.js`, `i18n.js`, `core.js`, `views.js` or `views2.js`, update the release version in **both** places:

1. `VERSION` in `sw.js` (for example `helpsetu-v1.1.0`);
2. the `?v=` query on every cached asset in `index.html` and in the `CORE` list in `sw.js`.

The service worker then installs the new files and deletes the old cache. Users see a **“A new version is ready”** bar with **Update now**; Settings → **Check for updates** also checks immediately. In the APK, the same action explains how to install the latest build and offers the developer's WhatsApp.

### Language assets

Curated strings live in `i18n.js`. To add or refresh translated languages:

```sh
node tools/extract-translations.mjs
python3 tools/translate.py           # cached machine translation builder
node tools/build-language-assets.mjs # writes i18n-extra.js + data-i18n.js
node tools/validate.mjs
```

`i18n-extra.js` defines `window.HELPSETU_LANGS` and the UI packs; `data-i18n.js` overlays translated names, intents and service text onto `HELPSETU_DATA`. Both are generated and included in the APK.

## Install on a phone

### Android APK (offline, no Play Store needed)

A signed, installable `HelpSetu-1.1.0.apk` is included in the repository root. Copy it to an Android phone (Android 5.0 / API 21 or newer), open it, and tap **Install**. You may need to allow “Install unknown apps” once in your browser or file manager. The APK bundles the whole app, so it works offline immediately — no login, no data connection needed.

The APK opens directly to the home screen. Calls use the phone's dialer through standard `tel:` links (the number is filled in; the app never calls on its own). External official links and the developer WhatsApp open in their respective apps.

To rebuild the APK from source (requires the Android command-line tools and a JDK):

```sh
bash android/build.sh
```

This produces `HelpSetu-1.1.0.apk` and verifies its signature with `apksigner`. The release keystore is created under `android/keystore/` on first build and is git-ignored — keep it safe so future updates keep the same signing identity. `android/update.json` describes the latest release for future in-app update checks.

- **As a PWA on Android / Chrome, iPhone / Safari:** use the browser menu → **Add to Home screen** (or HelpSetu's **Install app** button). Desktop browsers show the app in a phone-width column; the experience is designed for mobile.

## Project layout

```
index.html              App shell
styles.css              Design system: light/dark, large text, responsive
data.js                 Generated merged directory (do not edit by hand)
i18n.js                 Curated UI strings: English, हिंदी, বাংলা
i18n-extra.js           Generated UI packs for the other 22 languages
data-i18n.js            Generated translation overlay for the service catalogue
core.js                 State, routing, search, theme, language, sheets, updates, offline
views.js                Home, search, category and service-detail views
views2.js               Saved, settings, state picker, about, privacy, emergency
sw.js                   Offline app-shell cache (v1.1.0)
manifest.webmanifest    PWA metadata and shortcuts
icons/                  SVG and generated PNG icons
data/                   Curated source catalogue and cached translations
android/                WebView wrapper, launcher icons, build.sh, update.json and web-bundle.zip
HelpSetu-1.1.0.apk      Signed, installable APK
tools/build-data.mjs    Merges curated data with verified source records → data.js
tools/validate.mjs      Checks ids, numbers, sources, dates, links and translations
```

## Data and verification

`data.js` is generated from:

1. `data/*.json` — the curated HelpSetu catalogue, problem guides, Bengali state names and overrides.
2. `../india-helpline-main/data/records/` and `../india-helpline-main/data/states.json` — the existing verified India Helpline record set.

Each published service carries:

- `sourceName` and `sourceUrl` — the official government or provider page;
- `verifiedDate` — the date the number was matched against that page;
- `scope` (`national` / `state`) and, for state services, the state code;
- a `purpose`, `when` guidance and, for the main services, numbered steps.

Rebuild and validate after changing any source data:

```sh
node tools/build-data.mjs
node tools/validate.mjs
```

The validator fails on unknown ids, bad state/category codes, implausible numbers, missing sources or dates, broken intent links, missing UI translation keys, and known corrupted text. State records that have no Bengali name fall back to the official English or Hindi name by design; the validator reports the curated Bengali coverage.

## A note on numbers

HelpSetu is **not** a government app and is not affiliated with the Government of India or any department. Numbers change. Every listing links to its official source; always confirm urgent details there. For anything that threatens life or safety, call **112** immediately.

## Updates and support

- **Web / PWA:** the app checks for a new service-worker version when it opens and when you return to it. An update bar offers **Update now**, and Settings → **Check for updates** forces a check.
- **APK — silent content updates:** on every launch the app resolves the latest GitHub commit through the API and reads `android/update.json` from that immutable, SHA-pinned URL (branch URLs can be CDN-cached). If `web.version` is newer, it downloads `android/web-bundle.zip`, verifies its SHA-256, swaps it in and reloads — **no reinstall needed**. All fixes to the interface, catalogue, languages and guidance are delivered this way. Offline or a failed check simply keeps the current copy; the bundled copy in the APK is the fallback. Settings → **Check for updates** triggers the same check immediately.
- **APK binary:** Android does not allow a normal app to replace its own APK silently. Changes to the native WebView wrapper itself (permissions, calling behaviour, updater code) still require installing a new APK. The Play Store's In-App Update API can do this only if the app is published there. `android/update.json` also records the APK download URL and the developer's WhatsApp.
- **Developer support:** **+91 83719 98257** — <https://wa.me/918371998257>. Use it for installation help, corrections and translation feedback (the language sheet has a direct report link).

There is **no login**: both the PWA and the APK open straight to the home screen. Preferences (language, theme, text size, saved services) stay on the device.

## Licence and attribution

The app code and curated catalogue were created for HelpSetu. Verified record data comes from the India Helpline dataset in this workspace. Official names, numbers and links remain the property of their respective departments and providers.
# Help-Setu
