# Security policy

The full review is in [docs/SECURITY.md](docs/SECURITY.md).

## Reporting

This is a local-first app: there is no backend, account system, or data
collection to report against. If you find a vulnerability in the code before
publication, open an issue in the repository (or contact the maintainer
directly if a private channel exists). Do not include secrets or personal
data in reports.

## Supported versions

- The `master` branch and the latest tagged release.

## Scope

- `src/`, `public/`, `electron/`, `scripts/`, build configuration.
- Out of scope: third-party dependency vulnerabilities (report upstream),
  physical QR-code legibility, and native installer signing.
