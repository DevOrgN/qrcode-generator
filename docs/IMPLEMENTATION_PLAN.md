# Implementation plan

Build fresh source from the prototype's documented feature inventory. Do not copy prototype application code or assets. Reuse installed third-party packages only. Work locally; no push or deployment.

## Assignments

- Luna high: `src/lib/qr.js`, `tests/qr.test.js`. QR payload validation, byte-aware capacity, color/contrast, logo decoding/palette, PNG and SVG rendering, download/copy/share helpers.
- Luna high: `src/App.jsx`, `src/components/*`, `src/styles.css`, `src/main.jsx`, `index.html`, `public/favicon.svg`. Responsive accessible QR generator, content/logo/customization controls, debounced race-safe rendering, export actions and errors.
- Luna medium: `electron/main.cjs`, `capacitor.config.json`, `public/sw.js`, `public/manifest.webmanifest`, `scripts/*`, `docs/PLATFORMS.md`. Hardened local wrappers, offline static build support, platform setup guidance without downloads.
- Coordinator: configuration, integration, dependency reuse, independent verification, documentation and local commits.

## Shared API contract

`src/lib/qr.js` exports:

- `DEFAULT_OPTIONS = { foreground: '#173f35', background: '#ffffff', size: 1024, errorCorrectionLevel: 'H', margin: 4 }`
- `byteLength(text)`; `validateText(text, level = 'H')` returns `{valid, error, bytes, maxBytes}`. Reject empty/whitespace; preserve actual text.
- `validateLogo(file)` returns error string or null (PNG/JPEG <= 2 MiB).
- `loadLogo(file)` resolves `{dataUrl, width, height, colors: string[]}`. Validate content and dimensions; bounded decoding.
- `contrastRatio(foreground, background)` returns number.
- `generateQR(text, options)` resolves `{dataUrl, svg, size, bytes, modules}`. options extends defaults with `logo` (data URL or null). High correction when logo present; keep four-module quiet zone. All raster/vector output must embed logo consistently.
- `downloadQR(result, format = 'png')`; `copyQR(result)`; `shareQR(result)` asynchronous actions. Surface actionable unsupported errors; sharing cancellation is silent.

UI uses only these documented exports. No persistence of QR text/logos. Generation is debounced 350 ms and invalidates stale export results immediately. Disable exports until latest render succeeds. Clear/reset must clear file selection and async results. Inform about low contrast and actual capacity. Share only on explicit click.

## Acceptance

Text/URL with Unicode, PNG/JPEG logo upload + remove, palette extraction, colors + contrast warning, 512/1024/2048 exports, PNG/SVG, clipboard/share feature detection, real-time preview, loading/empty/error/success states, keyboard and mobile layout, offline after first production visit, no external fonts/analytics/runtime requests, secured desktop shell and documented Android prerequisites. Core tests + production build + browser-level smoke where available. Native installer artifacts require platform tooling and are reported separately.

## Download accounting

Initial dependencies: existing local node_modules symlink, zero network bytes. Do not install/update/download without coordinator instruction. Total external downloads must remain below 100 MB. Keep personal instructions and identity data out of commits.
