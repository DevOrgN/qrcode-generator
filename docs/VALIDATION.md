# Validation

## Current UI refinement — 2026-11-07

- `npm run check`: 17 tests passed and production build succeeded.
- Updated Electron UI smoke passed, including exact logo swatches, selecting the current color, reselection reset, and responsive overflow.
- Browser checks covered transparent, RGB, indexed, grayscale, wide (5000px), larger-than-2-MiB PNGs, and an orientation-tagged JPEG. Invalid replacements preserved the existing logo.
- Direct hex editing and same-file reselection passed. Missing/generic PNG MIME metadata and exact source palette colors have regression coverage. Images are normalized locally to at most 512px for embedding.
- Screenshots were inspected at desktop, tablet, and 430/375/320px widths in light/dark modes. QR image and square stage centers matched; no horizontal overflow. Final 320px dark screenshot was reviewed again.
- The new downloaded logo/custom-color PNG was 1024 × 1024; ZBar decoded `https://example.com/refined`.
- Actual Copy PNG completed. This browser has no `navigator.share`; native delivery to another app could not be tested. Native capability tests cover PNG file support.
- Current evidence: `evidence/refinement-walkthrough.mp4`, with two numbered scenario divider cards, plus desktop/mobile screenshots. Captured only isolated browser tabs. Actions retain recorded speed; text is pasted.

The exact PNGs that failed on the user’s machine were not supplied. Physical camera/print scanning and native share delivery remain unverified. The earlier results below describe the previous baseline, not a rerun in this refinement.

## Earlier baseline


Verified locally on 2026-11-06 using installed Node, Electron, Xvfb, FFmpeg,
and ZBar tools. Existing dependencies were reused; nothing was downloaded.

## Checks completed

- `npm run check`: all 12 unit tests passed and the production build succeeded.
- `npm run test:ui` under Xvfb: 1024-pixel PNG generation, clearing stale exports,
  Unicode text, actual logo upload/rendering, and desktop/mobile overflow checks passed.
- `npm run test:offline` under Xvfb: initial precache, worker activation, server
  shutdown, offline reload, and generation of a new QR code passed.
- Production browser walkthroughs: optional logo upload, automatic contrasting
  logo color selection, palette swatches, custom hex color, dark/light mode,
  persisted theme after reload, invalid image handling, empty-input export
  disabling, Unicode, and a 390-pixel mobile layout passed.
- Six actual browser PNG downloads were checked for PNG format and exact
  1024 × 1024 dimensions. The installed `zbarimg` decoder recovered the expected
  URL from all six, including the uploaded-logo/custom-color version.
- Source whitespace checks passed. The current project files and rebuilt output
  contain no previous brand-name variants. Git history and dependency caches
  were excluded from the source branding scan.

Electron's runtime emits a GLib teardown diagnostic after successful smoke
checks; both assertion results and process exit status were successful.

## Walkthrough evidence

See [the scenario report](WALKTHROUGH.md). The five-part video has numbered
2-second divider cards, chapter metadata, a visible pointer, click highlights,
and paced mouse movement. Browser actions run at their recorded speed; text
is pasted quickly. Only scaling, encoding, and divider insertion were applied.
The recording captures an isolated background browser tab, not the desktop.

The file chooser itself is outside the tab capture. Files were actually loaded
through the browser file input; logo rendering and downloads were not mocked.

## Limits

Native file sharing is unavailable in this test browser. The actual unsupported
sharing message and PNG-download guidance were verified and recorded; delivery
to another app was not claimed. Unit tests also cover share cancellation.
Physical camera/print tests and native installer/APK builds were not performed.
