#!/usr/bin/env bash
# scripts/stack-smoke.sh — the shell against the released images it depends on (viafrei-web#2).
#
# Brings the stack up (scripts/stack.sh: a throwaway database migrated by the pinned
# viafrei-database, the pinned viafrei-app's digest on it, the shell built here), then asks the
# home in two languages and a motorway page, and requires that the shell used EVERY digest fragment
# it asked for: a `fragment_upstream` line in the shell's log is a fragment it could not use. The
# stack is left up for the caller's logs; `bash scripts/stack.sh down` removes it.
# exit: 0 ok · 1 a check failed · 2 the stack did not come up
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
PORT="${VF_STACK_WEB_PORT:-18792}"
fails=0
ok() { printf '  ✓ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; fails=$((fails + 1)); }

bash "$HERE/stack.sh" up || exit 2
# the compose file refuses to read without the pins, so this side exports them the way stack.sh does
VF_DIGEST_IMAGE="$(bash "$HERE/pins.sh" ref digest)" && VF_DATABASE_IMAGE="$(bash "$HERE/pins.sh" ref database)" || exit 2
export VF_DIGEST_IMAGE VF_DATABASE_IMAGE
migrated="$(docker compose -f "$ROOT/docker-compose.yml" --project-directory "$ROOT" logs --no-log-prefix migrate 2>/dev/null | grep -E '^✓ [0-9]+ migration\(s\) applied; head = [0-9]+$' | head -1 || true)"
[ -n "$migrated" ] && ok "the pinned database release migrated from empty: ${migrated#✓ }" || bad "the migrate service printed no head"
for route in /de /en /de/autobahn; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "http://127.0.0.1:$PORT$route")"
  [ "$code" = 200 ] && ok "$route 200" || bad "$route answered $code"
done
web="$(docker compose -f "$ROOT/docker-compose.yml" --project-directory "$ROOT" ps -q web)"
[ -n "$web" ] || { echo "✗ stack smoke: no web container" >&2; exit 2; }
n="$(docker logs "$web" 2>&1 | grep -c '"kind":"fragment_upstream"' || true)"
[ "$n" = 0 ] && ok "every digest fragment the pages asked for was used" || bad "$n fragment(s) could not be used (the shell's log, kind fragment_upstream)"
[ "$fails" -eq 0 ] && { echo "✓ stack smoke: the shell renders from the pinned releases"; exit 0; }
echo "✗ stack smoke: $fails check(s) failed"; exit 1
