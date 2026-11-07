# custom-qrcode-generator

A private QR generator built with React, Vite and `qrcode`. All QR content and
logo processing stays on the device. No accounts, analytics, remote fonts or
QR-generation API are used.

## Run locally

```sh
npm run dev
```

This checkout reuses an existing local dependency installation through an
ignored `node_modules` symlink. No third-party downloads were required to build
the web application. For a standalone checkout, `npm ci --ignore-scripts`
installs the pinned lockfile without running automatic binary installers;
that operation requires a separate download budget. Desktop/Android tooling is
listed as optional. Avoid omitting all optional dependencies when building:
Vite also uses a platform-specific optional binding.

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`. Deploy its contents to any static HTTPS host,
including a subdirectory. Offline support becomes available after the first
successful production visit and service worker installation. The development
server does not install a service worker.

With an installed Electron runtime, `npm run test:ui` checks the production
interface, PNG generation and logo handling; `npm run test:offline` checks first-visit caching
and generation after its local test server shuts down. On headless Linux, prefix
these with `xvfb-run -a -s '-screen 0 1600x1200x24'`. These tests never install a
browser. The desktop launcher checks for an existing binary without importing
the npm Electron launcher, which can trigger a binary download in some versions.

## Features

- Text and URL QR codes with Unicode and byte-aware capacity validation.
- Live preview; stale renders cannot be exported after editing.
- Optional PNG/JPEG center logos up to 20 MiB, bounded image dimensions, and colors sampled from original pixels.
- Direct hex editing and a native color picker, with a contrast reminder and logo color swatches.
- Minimal monochrome controls with a persistent light/dark theme toggle.
- 1024-pixel PNG downloads and native file sharing when supported by the browser.
- Responsive keyboard-accessible controls; content remains in memory for the session.
- Offline web use, hardened Electron shell and Capacitor Android configuration.

QR capacity depends on encoding and correction level, rather than a universal
character count. The app uses medium correction by default and high correction
when a logo is added. Byte-mode capacity ranges from 1,273 bytes at H to 2,953 at
L; the encoder can fit more numeric/alphanumeric characters. A four-module quiet
zone is retained. Test the final exported code on the devices and print size
where it will be used, especially with logos or custom colors.

File sharing depends on browser/device support. When native PNG sharing is unavailable, Copy PNG uses the image clipboard;
Download PNG remains available. Clipboard access also depends on browser permissions. No content history is stored.

See [user scenarios and verification](docs/WALKTHROUGH.md) for the recorded flows.

## Platforms and release

See [platform instructions](docs/PLATFORMS.md) for Electron and Android.
Native installers and APKs require their respective local toolchains; they are
separate from the verified static web build. No publishing or remote push is part
of this repository's local workflow.

Recommended static host headers: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, and a Content Security Policy restricted to
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src 'self'; worker-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'none'`.
Serve `sw.js` and `index.html` with revalidation; hashed assets may be cached
immutably. Keep the complete build together during deployment.

The prototype was used only as a feature reference. Application source and
visual design were implemented anew; only third-party installed dependencies
were reused.
