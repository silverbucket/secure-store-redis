#!/bin/bash
set -e

VERSION_TYPE="${1:-}"

if [ -z "$VERSION_TYPE" ]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major|x.y.z>"
  exit 1
fi

# Ensure we're on master
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "master" ]; then
  echo "Error: must be on master branch (currently on $BRANCH)"
  exit 1
fi

# Ensure working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean"
  git status --short
  exit 1
fi

git pull origin master

echo "Running tests..."
bun install
bun run lint
bun run build
bun test
bun run test:node

echo ""
echo "All checks passed. Bumping version..."

# npm version creates the commit and tag
npm version "$VERSION_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")

git add package.json
git commit -m "v${NEW_VERSION}"
git tag "v${NEW_VERSION}"

echo ""
echo "Pushing tag v${NEW_VERSION}..."
git push origin master
git push origin "v${NEW_VERSION}"

echo ""
echo "=============================================="
echo "Tag v${NEW_VERSION} pushed."
echo ""
echo "Next step: create a GitHub Release for v${NEW_VERSION}"
echo "  gh release create v${NEW_VERSION} --generate-notes"
echo ""
echo "This will trigger the publish workflow to npm."
echo "After publishing, verify with:"
echo "  ./scripts/verify-published-package.sh ${NEW_VERSION}"
echo "=============================================="
