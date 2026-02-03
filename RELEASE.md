# Release Checklist
## Pre-Release Verification
  
  - Ensure you're on the master branch
  - Pull latest changes: git pull origin master
  - Bump version in package.json

## Local Testing
  
  - bun install
  - bun lint
  - bun run build
  - Start Redis
  - bun test
  - bun run test:node
  - Verify built output exists in dist/

## Documentation Review

  - README.md reflects all API changes
  - Breaking changes are clearly documented

## Git & GitHub

  - All changes committed
  - Create and push tag:
  git tag vX.X.X
  git push --tags
  - Publish: npm publish
  - Update Github Release Page

## Post-Release Verification

  - Verify GitHub Actions Publish release to npmjs workflow succeeds
  - Confirm package published: npm view secure-store-redis version shows new version
  - Run verification package: ./scripts/verify-published-package.sh
