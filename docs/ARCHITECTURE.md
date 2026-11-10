# Architecture

A private, offline QR code studio. All generation and image processing runs
locally in the browser; there is no backend, account, analytics, remote font,
or QR-generation API.

## Layout

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Minimal UI: text field, logo dropzone, color picker + palette, QR preview, Download PNG, Share. Debounced (250 ms), race-safe rendering via generation tickets. No content persistence (only the theme preference is stored). |
| `src/lib/qr.js` | Single source of truth for QR logic: validation, capacity, logo decoding/palette, PNG/SVG rendering, download/copy/share helpers. Pure logic is unit-tested in Node; canvas paths run in the browser. |
| `src/main.jsx` | React entry point, error boundary, production service-worker registration. |
| `src/styles.css` | Responsive monochrome design (light/dark via `data-theme`), keyboard-visible focus, reduced-motion support. |
| `public/sw.js` | Offline worker: precaches the build on first production visit, cache-first same-origin, navigation fallback. The build helper injects the precache list and a content-hash cache generation. |
| `public/manifest.webmanifest` | Installable PWA metadata, relative scope so the app can live under a subdirectory. |
| `electron/main.cjs` | Hardened desktop shell (see `docs/SECURITY.md`). |
| `capacitor.config.json` | Android web-asset pointer for Capacitor. |
| `scripts/` | Offline precache builder, Electron-safe launcher, UI/offline smoke tests. |

## Rendering rules

- No logo: error-correction level **M**. With a logo: **H** (logo covers modules).
- Export size **1024 px**, 4-module quiet zone, white background, `#18181b` foreground by default.
- Logo: PNG/JPEG only, ≤ 20 MiB, ≤ 16384 px/edge, ≤ 64 MP. Decoded locally, transparent padding cropped, normalized to ≤ 512 px, composited on a compact solid white backing (aspect-ratio aware, max 22 % of the QR edge) so QR modules never show through fine artwork.
- Colors: dominant logo colors are sampled from original pixels; white/near-white are excluded; the dominant remaining color is auto-selected; an additional palette (up to 5) plus a native picker and hex field let the user override. Gold/yellow brand colors are retained.
- Exports are disabled only when input is invalid or still uploading; exports during the typing debounce wait for the pending render, so buttons never flash while typing.
- Download and Share take a customizable base file name (default `qr-code`; sanitized for all platforms).
- Share uses `navigator.share` with a PNG file when available; it never silently copies. Download produces a real PNG via a temporary object URL. A clipboard copy helper exists in `qr.js` but is not wired to a button.

## Testing

See `docs/TESTING.md`. Unit tests (`tests/`, Node `node:test`) run without a
browser; Electron smoke tests exercise the production build headlessly.

## Security

See `docs/SECURITY.md` and `SECURITY.md`.
