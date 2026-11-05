# Validation

Verified locally with Node 26.12.1 and the existing system Electron 42.11.18.
Dependencies were reused from a local installation. No prototype application
source or visual assets were copied.

## Automated checks

- `npm test`: 12 tests covering UTF-8 capacity, logo metadata/content bounds,
  contrast, PNG/SVG generation, SVG logo coordinate scaling at every export size,
  export errors, share cancellation, subdirectory precaching, failed installation,
  cache scope isolation, and offline navigation fallback.
- `npm run build`: production bundle and content-versioned service worker precache.
- `npm run test:ui`: production renderer smoke covering text and Unicode,
  invalidation of stale exports, a real PNG logo upload, actual SVG download,
  matching PNG/SVG center logo rendering, and desktop/mobile overflow checks.
- `npm run test:offline`: first production visit at `/qr/`, worker activation,
  complete server shutdown, offline reload, and generation of a new QR code.
- Chromium browser scenarios on the production preview: URL and Arabic/emoji text,
  byte capacity errors, real PNG logo upload and palette extraction, high-correction
  logo mode, exact 512/1024/2048 PNG dimensions, reset/invalidation, real PNG and SVG
  downloads, and image clipboard copy.
- Responsive browser check at 430 CSS pixels: generated QR, input, actions and
  settings render without horizontal overflow.
- Local mobile Lighthouse run: performance 95, accessibility 100, best practices
  100 and SEO 100. Lab scores vary with the machine; Lighthouse does not replace
  real scanner or print testing.
- Node syntax checks for the Electron shell and verification scripts.
- Desktop and mobile screenshot review of the finished workspace.

Headless UI commands use an existing Xvfb installation:

```sh
xvfb-run -a -s '-screen 0 1600x1200x24' npm run test:ui
xvfb-run -a -s '-screen 0 1600x1200x24' npm run test:offline
```

Run these sequentially: simultaneous `xvfb-run -a` invocations can race while
choosing a free display. The system runtime emits a GLib teardown diagnostic
after successful checks; assertions and process exit status determine results.

## Release limits

No native installer or APK was built, signed or verified. Clipboard and file
sharing availability varies by host browser/device and permission; unsupported
actions provide download guidance. Physical scanner/print tests remain release
checks for the final chosen colors, logo and print size. No QR decoder was
downloaded for the local test suite.

The local dependency symlink is ignored by Git. A fresh checkout needs the pinned
dependencies installed explicitly. The launcher uses existing binaries without
calling an npm Electron module that could download a runtime on import.
