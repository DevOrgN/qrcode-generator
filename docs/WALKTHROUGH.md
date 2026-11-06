# User walkthrough scenarios

All five scenarios were exercised on the production build before the final
recording, then performed again in the recorded walkthrough.

| Part | User goal and actions | Verified outcome |
| --- | --- | --- |
| 1 · 00:00 | Start empty, paste a URL, click Download PNG. | Empty actions disabled; preview generated; real 1024 × 1024 PNG downloaded and decoded to the expected URL. |
| 2 · 00:12 | Upload the local sample logo, choose a logo swatch, open the color picker, enter a custom hex color, apply, and download. | Logo appears in the QR; a contrasting sampled logo color is selected automatically; palette and custom color update the QR; branded PNG decodes correctly. |
| 3 · 00:40 | Switch to dark mode, remove the logo, restore the monochrome QR color, and download. | Theme changes without losing content; logo/palette disappear; QR retains its white scanning background; PNG decodes correctly. Theme persistence after reload was separately verified. |
| 4 · 01:06 | Choose a corrupted PNG, clear the text, paste Arabic/English text, and click Share. | Invalid logo rejected; cleared input removes stale QR and disables export; Unicode generates; real native-share fallback appears because this browser cannot share files. |
| 5 · 01:30 | Use a phone-width layout, switch to light mode, paste a contact URL, scroll, and download. | Controls fit without horizontal overflow; generated QR and actions remain usable; real PNG decodes to the expected URL. |

## Evidence interpretation

- Video length: approximately 1 minute 46 seconds, with a numbered divider
  before every scenario and chapters in the MP4.
- Mouse movement, clicks, state changes, uploads, generation, and downloads are
  real browser actions. Pointer and click highlights are supplied by the browser
  recorder. Text entry is fast; interaction footage was not sped up.
- The local sample logo and corrupted PNG are synthetic test fixtures. The native
  file chooser is outside the recorded tab; its resulting file-input behavior
  is real.
- Native share delivery is not simulated. The unsupported-browser fallback is
  demonstrated; delivery to another app requires a browser/device with file sharing.
- Additional checks: 12 unit tests, production build, desktop UI smoke, offline
  smoke, persisted theme on reload, PNG dimensions, six ZBar decodes, and screenshot review.
- No packages, browsers, media, or other dependencies were downloaded.
