# Custom QR Code Generator

A private QR code studio that runs entirely on your device. Enter text or a
URL, optionally add a logo, pick a color, and download a high-resolution PNG
or share it natively. No accounts, analytics, remote fonts, or QR-generation
API — nothing is uploaded.

## Features

- Text/URL QR codes with Unicode and byte-aware capacity validation.
- Live preview; exports are locked until the latest render matches your input.
- Optional PNG/JPG center logo (drag & drop), transparent padding auto-cropped,
  compact white backing so QR modules never hide fine artwork.
- Dominant logo color auto-selected; extra palette swatches (white/near-white
  excluded, brand colors like gold retained); native picker + hex field for
  custom colors.
- Defaults that just work: 1024 px PNG, error correction M (H with a logo),
  4-module quiet zone.
- Download PNG and native Share (opens your phone's app chooser where
  supported). Light/dark themes, mobile layout, full offline use after the
  first production visit, PWA-installable.

## Quick start

```sh
npm ci
npm run dev      # http://127.0.0.1:5173
npm test         # 28 unit tests
npm run check    # tests + production build
npm run preview  # preview dist/ locally
```

Deploy the built `dist/` to any static HTTPS host (subdirectories work).
Headers, Electron, and Android instructions: [docs/PLATFORMS.md](docs/PLATFORMS.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — how the app works and the rendering rules.
- [Testing](docs/TESTING.md) — unit tests, UI/offline smoke, coverage, CI.
- [Security](docs/SECURITY.md) — threat review, mitigations, host headers.
- [Validation evidence](docs/VALIDATION.md) · [User walkthrough](docs/WALKTHROUGH.md) · [Platforms](docs/PLATFORMS.md)

## Project files

- `src/App.jsx` — the minimal UI. `src/lib/qr.js` — all QR logic and tests' target.
- `docs/IMPLEMENTATION_PLAN.md` — original build plan (historical).
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (MIT).

## Status

Production-ready as a static app: tests and build pass, security reviewed.
Native share delivery on a physical phone, camera/print scanning, and
installer/APK builds still need real-device/toolchain verification. There is
no tagged release yet and no remote repository configured — see
[docs/RELEASING.md](docs/RELEASING.md) if you want to publish it.
