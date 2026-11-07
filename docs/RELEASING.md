# Releasing & pushing

Current state: **no remote is configured** (`git remote` is empty) and no tag
has been cut. The project is therefore local-only until a remote is supplied.

To publish:

1. Choose an organization/repository identifier and add it as the remote
   (the URL is intentionally not stored in this document).
2. `git push -u origin master` (or rename the default branch first).
3. Tag the release and update `CHANGELOG.md`; consider GitHub Releases with
   the `dist/` artifacts or a static-host deployment.

Do not push until the remote identifier is explicitly provided. CI
(`.github/workflows/ci.yml`) runs tests + build on every push.
