#!/usr/bin/env bash
# scripts/carry-previous.sh — the earlier images' site files a release build carries (viafrei-web#36).
#
#   bash scripts/carry-previous.sh <out dir>
#
# For every `carry` reference of images.pin, copies that image's /app/packages/web/dist into
# <out dir>/<64-hex digest>/, without running the image (docker create, docker cp, docker rm), and
# prints the WEB_ASSETS_PREVIOUS value: the references, space-separated. release.yml passes both to
# the build, as the build context `web-assets-previous` and the build argument of that name, and
# packages/web/scripts/carry-assets.ts refuses the build when they disagree. No carry pin prints
# nothing and leaves <out dir> empty: the build then uses the Dockerfile's own stage.
# exit: 0 ok · 2 could not run (an image that does not pull, a dist that is not there) · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
DOCKER="${CARRY_DOCKER:-docker}"
refuse() { echo "✗ carry-previous: $1" >&2; exit 2; }
[[ $# -eq 1 ]] || { echo "usage: carry-previous.sh <out dir>" >&2; exit 64; }
OUT="$1"
mkdir -p "$OUT" || refuse "cannot create $OUT"
[[ -z "$(find "$OUT" -mindepth 1 -maxdepth 1 2> /dev/null)" ]] || refuse "$OUT is not empty"
REFS="$(bash "$HERE/pins.sh" ref carry)" || exit 2
for ref in $REFS; do
  hex="${ref##*@sha256:}"
  [[ "$hex" =~ ^[0-9a-f]{64}$ ]] || refuse "$ref is not pinned by digest"
  "$DOCKER" pull --quiet "$ref" > /dev/null || refuse "$ref does not pull"
  cid="$("$DOCKER" create "$ref")" || refuse "cannot create a container of $ref"
  "$DOCKER" cp "$cid:/app/packages/web/dist" "$OUT/$hex"; rc=$?
  "$DOCKER" rm "$cid" > /dev/null || refuse "cannot remove the container of $ref"
  [[ "$rc" = 0 ]] || refuse "$ref has no /app/packages/web/dist"
  [[ -d "$OUT/$hex/client/_a" ]] || refuse "$ref has no packages/web/dist/client/_a"
done
printf '%s\n' "$REFS"
