# Release Checklist

## Automated Release

Run the release script from the master branch:

```sh
./scripts/release.sh <patch|minor|major>
```

This will:
  - Verify you're on master with a clean tree
  - Pull latest changes
  - Run lint, build, and tests (Bun + Node)
  - Bump version in package.json
  - Commit and tag
  - Push to origin

## After the Script

  - Create a GitHub Release to trigger npm publish:
    `gh release create vX.X.X --generate-notes`
  - The Publish workflow (`.github/workflows/publish.yml`) runs automatically
    when a GitHub Release is published. It re-runs lint, build, and tests,
    then publishes to npm using the `NPM_TOKEN` repo secret.
  - Confirm published version: `npm view secure-store-redis version`
  - Run verification: `./scripts/verify-published-package.sh`

## Prerequisites

  - The `NPM_TOKEN` secret must be set in the repo's GitHub Settings → Secrets.
    Use a granular npm access token scoped to the `secure-store-redis` package
    with publish permission.

## Documentation Review

  - README.md reflects all API changes
  - Breaking changes are clearly documented
