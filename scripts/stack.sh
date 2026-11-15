#!/usr/bin/env bash
# scripts/stack.sh — the site's local stack (docker-compose.yml) from the pins of images.pin (viafrei-web#2).
#
#   bash scripts/stack.sh up       build the shell here, migrate a throwaway database with the pinned
#                                  viafrei-database, start the pinned viafrei-app's digest, then the shell
#   bash scripts/stack.sh status   compose ps
#   bash scripts/stack.sh logs     the last 80 lines of every service
#   bash scripts/stack.sh down     remove this project's containers, networks and its built image
#
# The pins have ONE home: the references are read through scripts/pins.sh and exported as
# VF_DIGEST_IMAGE / VF_DATABASE_IMAGE, which the compose file refuses to run without.
# STACK_DOCKER overrides the docker binary (the self-test's stub).
# exit: 0 ok · 1 compose failed · 2 could not run · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
DOCKER="${STACK_DOCKER:-docker}"
case "${1:-}" in up|status|logs|down) [ $# -eq 1 ] || { echo "usage: stack.sh up | status | logs | down" >&2; exit 64; } ;; *) echo "usage: stack.sh up | status | logs | down" >&2; exit 64 ;; esac
VF_DIGEST_IMAGE="$(PINS_ROOT="$ROOT" bash "$HERE/pins.sh" ref digest)" || exit 2
VF_DATABASE_IMAGE="$(PINS_ROOT="$ROOT" bash "$HERE/pins.sh" ref database)" || exit 2
export VF_DIGEST_IMAGE VF_DATABASE_IMAGE
compose() { "$DOCKER" compose -f "$ROOT/docker-compose.yml" --project-directory "$ROOT" "$@"; }
case "$1" in
  up) compose up -d --build --wait || { echo "✗ stack: compose up failed (bash scripts/stack.sh status)" >&2; exit 1; }
      echo "✓ stack up: shell http://127.0.0.1:${VF_STACK_WEB_PORT:-18792}, digest ${VF_DIGEST_IMAGE%@*}, database ${VF_DATABASE_IMAGE%@*}" ;;
  status) compose ps ;;
  logs) compose logs --tail 80 ;;
  down) compose down --remove-orphans --rmi local || exit 1; echo "✓ stack down" ;;
esac
