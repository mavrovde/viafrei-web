#!/usr/bin/env bash
# Image smoke: build the image (unless IMAGE is given), then prove the claims the image makes
# (viafrei-web#2; the shape of viafrei-database's scripts/image-smoke.sh):
#
#   * it runs as a non-root uid, with a read-only root file system, no capabilities and no new
#     privileges, and ships no npm and no npx;
#   * /srv/site-static carries the fallback page, the preview page and site-pages.txt, each
#     byte-identical to this tree's copy (packages/web/static/, scripts/site-pages.txt);
#   * /app/scripts/geoip-build.mjs builds a VFGEO1 file from the test fixture with no network;
#   * the shell answers /healthz, renders /de with no digest behind it (every tile in its error
#     state, never a missing page), sends a Content-Security-Policy, and answers 404 for a page
#     that is not in the map.
#
# Every container is removed on every exit path. No database and no digest are started: the shell
# reads none, and a dead digest is the state it must survive.
# Usage: scripts/image-smoke.sh            (builds viafrei-web:smoke)
#        IMAGE=ref scripts/image-smoke.sh  (uses an image that exists)
# exit: 0 pass · 1 a check failed · 2 could not run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="smoke-$$"
IMAGE="${IMAGE:-}"
fails=0
ok() { printf '  ✓ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; fails=$((fails + 1)); }

cleanup() { docker rm -f "vfweb-app-$TAG" >/dev/null 2>&1 || true; }
trap cleanup EXIT

command -v docker >/dev/null || { echo "✗ docker is not on PATH — the smoke cannot run" >&2; exit 2; }
if [ -z "$IMAGE" ]; then
  IMAGE="viafrei-web:smoke"
  docker build -q -t "$IMAGE" "$ROOT" >/dev/null
fi
HARDEN=(--read-only --tmpfs /tmp:rw,size=64m --cap-drop ALL --security-opt no-new-privileges)
run() { docker run --rm "${HARDEN[@]}" --network none "$@"; }
sha() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi; }

uid="$(run --entrypoint id "$IMAGE" -u)"
[ "$uid" != "0" ] && ok "runs as uid $uid, not root" || bad "runs as root"
pm="$(run --entrypoint sh "$IMAGE" -c 'command -v npm; command -v npx; echo __checked__' || true)"
if [ "$pm" = "__checked__" ]; then ok "ships no npm or npx"
else bad "ships npm or npx, which the shell never runs (or the check did not run): $(printf '%s' "$pm" | tr '\n' ' ')"; fi

for pair in "fallback/index.html:packages/web/static/fallback/index.html" "preview/index.html:packages/web/static/preview/index.html" "site-pages.txt:scripts/site-pages.txt"; do
  in="${pair%%:*}"; src="${pair#*:}"
  want="$(sha < "$ROOT/$src" | cut -c1-64)"
  got="$(run --entrypoint sh "$IMAGE" -c "sha256sum < /srv/site-static/$in" 2>/dev/null | cut -c1-64 || true)"
  if [ -n "$got" ] && [ "$got" = "$want" ]; then ok "/srv/site-static/$in is $src, byte for byte"
  else bad "/srv/site-static/$in is not $src (got '${got:-nothing}')"; fi
done

# The fixture is far below the builder's German-range floor, so the floor is lowered for it alone.
geo="$(docker run --rm -i "${HARDEN[@]}" --network none --entrypoint sh "$IMAGE" -c \
  'node /app/scripts/geoip-build.mjs --release 2026-10 --out /tmp/g.vfgeo --min-de-ranges 1 >/dev/null && head -c 6 /tmp/g.vfgeo' \
  < "$ROOT/packages/web/test/fixtures/geoip-fixture.csv" || true)"
[ "$geo" = "VFGEO1" ] && ok "geoip-build.mjs builds a VFGEO1 file from the fixture with no network" || bad "geoip-build.mjs did not build a VFGEO1 file (got '$geo')"

docker run -d --name "vfweb-app-$TAG" "${HARDEN[@]}" -e DIGEST_URL=http://127.0.0.1:9 "$IMAGE" >/dev/null
# status, whether a CSP header came, and the body's length; 000 when nothing answered
fetch() {
  docker exec "vfweb-app-$TAG" node -e '
    fetch("http://127.0.0.1:8792" + process.argv[1], { redirect: "manual" }).then(async (r) => {
      const b = await r.text();
      process.stdout.write(r.status + " " + (r.headers.get("content-security-policy") ? "csp" : "nocsp") + " " + b.length + "\n");
    }, () => process.stdout.write("000 nocsp 0\n"));' "$1"
}
health=""
for _ in $(seq 1 60); do
  health="$(fetch /healthz 2>/dev/null || true)"
  case "$health" in 200*) break ;; esac
  docker ps -q --filter "name=^vfweb-app-$TAG$" | grep -q . || { bad "the shell exited: $(docker logs --tail 20 "vfweb-app-$TAG" 2>&1)"; break; }
  sleep 1
done
case "$health" in 200*) ok "/healthz 200" ;; *) bad "/healthz answered '$health'" ;; esac
read -r code csp len <<<"$(fetch /de)"
if [ "$code" = 200 ] && [ "$len" -gt 10000 ]; then ok "/de renders ($len bytes) with no digest behind it"; else bad "/de answered $code, $len bytes"; fi
[ "$csp" = csp ] && ok "/de carries a Content-Security-Policy" || bad "/de carries no Content-Security-Policy"
read -r code _ _ <<<"$(fetch /de/no-such-page-smoke)"
[ "$code" = 404 ] && ok "a page that is not in the map is a 404" || bad "a page that is not in the map answered $code"

[ "$fails" -eq 0 ] && { echo "✓ image smoke: all checks passed ($IMAGE)"; exit 0; }
echo "✗ image smoke: $fails check(s) failed"; docker logs --tail 40 "vfweb-app-$TAG" 2>&1 | tail -40; exit 1
