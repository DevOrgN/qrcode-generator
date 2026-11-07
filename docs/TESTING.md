# Testing

Node release target: **20+** (see `.nvmrc` and `package.json` engines).

## Unit tests (no browser)

```sh
npm test
```

`node --test tests/*.test.js` — 28 tests covering:

- `tests/qr.test.js` — text validation/Unicode/UTF-8 capacity, contrast ratio,
  PNG/JPEG logo metadata + signature checks, QR generation (PNG/SVG, quiet zone),
  export-helper errors, native share capability/cancellation, palette exactness
  and brand-color retention.
- `tests/logo-vector.test.js` — mocked canvas tests for SVG logo transform,
  transparent-padding cropping, and the solid white backing shared by PNG/SVG.
- `tests/offline.test.js` — service worker in a VM: precache atomicity,
  subdirectory scope, cross-origin/write bypass, offline navigation fallback.
- `tests/security.test.js` — malformed/script-bearing payloads rejected by
  download/share/generation, logo validation edges, palette near-white exclusion.

## Production check

```sh
npm run check   # npm test + npm run build (Vite + offline precache)
node --check electron/main.cjs && node --check scripts/*.cjs
```

## UI + offline smoke (requires an already-installed Electron runtime)

No browser is downloaded. On headless Linux prefix with `xvfb-run`:

```sh
xvfb-run -a npm run test:ui        # preview, 1024px PNG, clearing, Unicode, logo upload/palette, desktop/mobile overflow
xvfb-run -a npm run test:offline   # precache, worker activation, server shutdown, offline reload + generation
```

Add `--screenshots` to write screenshots to `/tmp`. Historical walkthrough
evidence lives in `evidence/`; see `docs/VALIDATION.md` and `docs/WALKTHROUGH.md`.

## Not covered / known limits

- Native share delivery to a real phone (WhatsApp etc.) cannot be verified
  headlessly — it needs a device with `navigator.share` + file support.
- Physical camera/print scanning of exported codes.
- Native installer/APK builds (need platform toolchains + signing).
- No coverage instrumentation (`node --experimental-test-coverage` is available
  in Node 20+ but is not gated in CI yet).

## CI

`.github/workflows/ci.yml` runs `npm ci`, `npm test`, and `npm run build` on
Node 20. Electron smoke tests are not in CI (they need a display runtime).
