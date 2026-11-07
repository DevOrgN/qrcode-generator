# Security review

Review date: 2026-11-08. Scope: `src/`, `public/sw.js`, `electron/main.cjs`,
build scripts, `package.json` dependencies. This is a local code review, not a
penetration test and not an audit of third-party packages beyond lockfile
inspection.

## Data & privacy

- **Local only.** QR text and logos stay in memory; nothing is uploaded, stored
  in history, or sent to analytics. Only the UI theme (`qr-theme`) is persisted.
- No remote fonts, libraries, or telemetry. The app works offline after its
  first production visit.
- Error messages never echo user content back into logs beyond generic UI text.

## Threats reviewed & mitigations

| Threat | Mitigation | Where |
| --- | --- | --- |
| SVG/script logo injection | Logo bytes sniffed by magic number (PNG/JPEG only); signature is authoritative, MIME/extension are hints. SVG/GIF rejected even with a spoofed MIME type. | `src/lib/qr.js` |
| Export payload injection | `dataUrlBlob` validates `data:image/png;base64,…` strictly before creating a Blob; SVG downloads must start with `<svg`. Malformed payloads throw before any browser API is used. | `src/lib/qr.js` |
| Decoded-image DoS | 20 MiB file cap, 16384 px/edge, 64 MP cap; logos normalized to ≤ 512 px before embedding. | `src/lib/qr.js` |
| Path traversal in offline smoke server | Resolved path must stay under `dist/` or the request is 403. | `scripts/offline-smoke.cjs` |
| Service-worker cache poisoning | Same-origin GET only, scope-restricted, precache is atomic (a failed asset aborts activation), content-hash cache generation retires old assets only after a successful install. | `public/sw.js`, `scripts/prepare-offline.mjs` |
| Electron renderer escape | `contextIsolation`, `nodeIntegration: false`, `sandbox`, `webSecurity`, `allowRunningInsecureContent: false`; window-open denied; navigation/redirect restricted to the local entry file; all permissions denied; renderer network requests restricted to `file:`/`data:`/`blob:`. | `electron/main.cjs` |
| XSS via QR text | Text is only passed to the QR encoder; the app never injects user text into HTML. Logo data URLs in SVG are base64-validated and attribute-escaped. | `src/lib/qr.js`, `src/App.jsx` |
| Credential/identity leakage | No tokens, no remote URLs, no secrets in the repo. Pushes must use an explicitly supplied organization/repository identifier. | repo policy |

## Recommended host headers (static deployment)

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

Serve `sw.js`/`index.html` with revalidation; hashed assets may be cached
immutably. The Electron shell enforces its own equivalent without relying on
host headers.

## Remaining risks

- Dependency vulnerabilities: not scanned in this pass (no network). Run
  `npm audit` in CI/outside this review; pinned versions: react 19, vite 8,
  qrcode 1.5.4.
- Theme preference in `localStorage` is same-origin readable by any script in
  the origin; acceptable for a static app — do not add secrets there.
- Physical scanning/print legibility is a product risk, not a security one.
