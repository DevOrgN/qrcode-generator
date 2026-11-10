# Releasing & pushing

Current state: **no remote is configured** (`git remote` is empty) and no tag
has been cut. The project is therefore local-only until a remote is supplied.

To publish:

1. Choose an organization/repository identifier and add it as the remote
   (the URL is intentionally not stored in this document).
2. `git push -u origin master` (or rename the default branch first).
3. Deploy the static `dist/` build:
   - **GitHub Pages (recommended):** enable Pages locally in org repo settings
     — deploy from a branch/branch, or add a Pages workflow that uploads
     `dist/`. No backend exists, so no configuration beyond the folder.
   - **Railway:** create a project pointing at the repo, serve `dist/` static.
   - Or any HTTPS static host.
4. Tag the release and update `CHANGELOG.md`; consider GitHub Releases with
   the `dist/` artifacts.

CI (`.github/workflows/ci.yml`) runs tests + build on every push. See
`docs/PLATFORMS.md` for the GitHub-Pages vs Railway comparison.
