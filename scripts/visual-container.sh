#!/usr/bin/env bash
# scripts/visual-container.sh [--update] — the visual comparison on a laptop, in the Playwright container.
#
# The baselines (packages/web/e2e/__screenshots__/linux/) are Linux renders of the amd64 Playwright image,
# the image release.yml's Web job runs, so they are compared, and re-recorded with --update, in that image and
# nowhere else: never install a browser on the laptop. The container gets its own node_modules in a named
# volume, so the laptop's are not replaced by Linux builds, and the pinned packages are linked into it the
# way `npm run pinned` links them on the host.
#
#   npm run pinned                        # on the host first: extracts .pinned/ (needs the registry login)
#   bash scripts/visual-container.sh      # compare
#   bash scripts/visual-container.sh --update
#
# VISUAL_PLATFORM overrides linux/amd64 (an arm64 render is NOT what the baselines are; use it to look,
# never to record).
# exit: the visual runner's · 2 could not run · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
IMAGE="mcr.microsoft.com/playwright:v$(node -p 'require("./package-lock.json").packages["node_modules/playwright"].version' 2> /dev/null || echo missing)-noble"
PLATFORM="${VISUAL_PLATFORM:-linux/amd64}"
ARGS=""
case "${1:-}" in "") ;; --update) ARGS="-- --update" ;; *) echo "usage: visual-container.sh [--update]" >&2; exit 64 ;; esac
[ $# -le 1 ] || { echo "usage: visual-container.sh [--update]" >&2; exit 64; }
cd "$ROOT" || exit 2
case "$IMAGE" in *missing*) echo "✗ visual-container: no playwright version in package-lock.json" >&2; exit 2 ;; esac
command -v docker > /dev/null || { echo "✗ visual-container: no docker on PATH" >&2; exit 2; }
[ -d .pinned/app/packages/digest ] || { echo "✗ visual-container: no .pinned/app — run npm run pinned first" >&2; exit 2; }

docker run --rm --ipc=host --platform "$PLATFORM" \
  -v "$ROOT:/repo" -v viafrei-web-linux-node-modules:/repo/node_modules -w /repo "$IMAGE" \
  bash -c "set -e
    fc-list | grep -qi dejavu || { apt-get update -qq && apt-get install -y -qq fonts-dejavu-core fonts-dejavu-extra > /dev/null; }
    npm ci --ignore-scripts --no-audit --no-fund
    mkdir -p node_modules/@viafrei
    for p in digest ingest mcp status; do ln -sfn ../../.pinned/app/packages/\$p node_modules/@viafrei/\$p; done
    npm run web:build
    npm run web:visual $ARGS"
