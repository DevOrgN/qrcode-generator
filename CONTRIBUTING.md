# Contributing

## Setup

```sh
npm ci            # standalone checkout; installs the pinned lockfile
npm run dev       # http://127.0.0.1:5173
```

Node 20+ (see `.nvmrc`). Reuse local installs where possible; do not install
or update packages without reason — the dependency surface is intentionally
small (`react`, `react-dom`, `qrcode`).

## Tests & checks

```sh
npm run check     # unit tests + production build
xvfb-run -a npm run test:ui
xvfb-run -a npm run test:offline
```

See [docs/TESTING.md](docs/TESTING.md) for coverage and known limits.

## Rules

- Keep the UI minimal: no export-size / error-correction controls. Defaults
  live in `src/lib/qr.js` (`DEFAULT_OPTIONS`, M without a logo, H with one).
- Keep all content local: no network calls, analytics, remote fonts, or
  persistence of QR text/logos. Theme preference only.
- Logo handling must stay signature-verified (PNG/JPEG magic numbers) and
  palette colors must come from original pixels (no invented colors).
- Document behavior changes in `CHANGELOG.md` and in `docs/` where relevant.
- Never commit secrets, personal data, or `dist/` (it is git-ignored).
- Review security impact with [docs/SECURITY.md](docs/SECURITY.md) before
  changing upload, rendering, worker, or shell code.
