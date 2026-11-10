# Platforms and deployment

The web app is static with **no backend, database, or server-side runtime** —
any static HTTPS host works, including a subdirectory (all asset URLs and the
service-worker scope are relative; `vite` `base: './'`). Both of your options
work; for this app GitHub Pages is the simpler, free choice. Railway is the
better fit if you want one platform for the site plus future dynamic services.

| Host | Fit | Notes |
| --- | --- | --- |
| **GitHub Pages (recommended)** | Perfect | Free, zero config beyond enabling it on the `master` branch (or a `gh-pages` branch / Pages-ready `dist`). No headers control, but the app does not require them — the CSP suggestions in `docs/SECURITY.md` are optional hardening. |
| **Railway** | Works | Deploy the `dist/` folder as a static build (nginx/serve image or Railway's static target). More setup for a purely static app; useful if you also need a backend later. |

Both serve over HTTPS, so the service worker (offline support) works on each.

The web app is static. No remote runtime, fonts, analytics, or content are needed.

## Production web build and offline support

Use the existing local dependencies. From the repository root, run:

```sh
npm run build
```

The build fills `dist/sw.js` with the finished build's local asset list.
The application registers it on production web visits. Deploy the complete `dist` directory, preserving
its relative paths. Serve it over HTTPS (or localhost); browsers do not enable
service workers on ordinary HTTP hosts. The worker precaches the complete
first production visit, serves same-origin cached resources offline, and lets a
new worker replace the previous cache after a successful install. It does not
cache cross-origin responses. QR contents and uploaded logos are not stored by
the service worker.

For a static host mounted below the domain root, serve `dist` at that path and
preserve relative URLs. The manifest and worker use a relative scope so the
deployment can live below `/`.

## Electron desktop

Electron opens only the built `dist/index.html`. The renderer has context
isolation, no Node integration, sandboxing, denied permissions, blocked popup
windows, blocked navigation away from the local app, and blocked non-file
requests. Build the web assets first, then run one of:

```sh
npm run build
npm run desktop
```

To package, use a locally installed Electron Builder and the target platform's
toolchain:

```sh
npm run build
npx electron-builder --linux
# or: npx electron-builder --win
```

No installer is produced by these instructions here. Platform packaging tools
and signing credentials may be required for a distributable installer; this
project has not verified native installer builds.

## Android with Capacitor

`capacitor.config.json` points Capacitor at the `dist` web assets. Prerequisites
must already be installed and configured locally; these steps do not download
them:

- Node.js and this repository's installed dependencies, including Capacitor CLI
  and `@capacitor/android`.
- Android Studio, Android SDK Platform Tools, and an SDK platform/build-tools
  version supported by the installed Capacitor Android version.
- A configured `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) and Java/JDK version
  supported by that Capacitor release.

If the Android platform has not already been added to the project, `npm run
android:add` creates it. This command can invoke package/tool downloads if the
local prerequisites are missing; do not run it without checking that they are
already available. With all prerequisites installed, build and synchronize:

```sh
npm run build
npm run android:sync
npm run android:open
```

Then use Android Studio's local Build/Run actions. Native Android builds have
not been run or verified for this project.
