#!/usr/bin/env bash
# check_web_boundary.test.sh — the boundary gate's self-test (#378).
#
# Each of the two rules is shown FAILING by a planted violation in a copy of
# the real tree, and each precondition is shown to be exit 2 rather than 0.
# Hermetic: files only.
set -u
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
GATE="$HERE/check_web_boundary.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT INT TERM
pass=0; fail=0
check() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ✗ %s\n' "$1"; fi; }

# a copy of exactly what the gate reads
copy() { # copy <dest>
  mkdir -p "$1/packages/web"
  cp -R "$ROOT/packages/web/src" "$1/packages/web/src"
  cp "$ROOT/docker-compose.yml" "$1/docker-compose.yml"
}

OUT="$(bash "$GATE" 2>&1)"; rc=$?
[ "$rc" -eq 0 ]; check "the real tree passes (exit $rc)" $?
printf '%s\n' "$OUT" | grep -qE '✓ web boundary — [0-9]+ runtime file'
check "the success line prints the file count it read" $?

# --- rule 1: a planted pg import -------------------------------------------------
copy "$T/r1"; printf 'import { Pool } from "pg";\nexport const p = new Pool();\n' > "$T/r1/packages/web/src/lib/db.ts"
OUT="$(WEB_BOUNDARY_ROOT="$T/r1" bash "$GATE" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]; check "a runtime file importing pg is exit 1 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q 'lib/db.ts'; check "…and the file is named" $?
copy "$T/r1b"; printf 'import { LICENCE_CATALOGUE } from "@viafrei/ingest";\nexport const x = LICENCE_CATALOGUE;\n' > "$T/r1b/packages/web/src/lib/reg.ts"
WEB_BOUNDARY_ROOT="$T/r1b" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ]; check "a runtime import of @viafrei/ingest is exit 1 (got $rc)" $?
copy "$T/r1c"; printf 'export const u = process.env["DATABASE_URL"];\n' > "$T/r1c/packages/web/src/lib/url.ts"
WEB_BOUNDARY_ROOT="$T/r1c" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ]; check "a runtime read of DATABASE_URL is exit 1 (got $rc)" $?
# a TEST may read the register: that is not a runtime file
copy "$T/r1d"; mkdir -p "$T/r1d/packages/web/test"; printf 'import { ATTRIBUTION } from "@viafrei/mcp";\n' > "$T/r1d/packages/web/test/x.test.ts"
WEB_BOUNDARY_ROOT="$T/r1d" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ]; check "a test importing the register is not a violation (got $rc)" $?

# --- rule 2: a database variable on the web service ------------------------------
copy "$T/r2"
awk '/^  web:/ {print; print "    environment:"; print "      DATABASE_URL: postgresql://x:y@db/viafrei"; next} {print}' "$ROOT/docker-compose.yml" > "$T/r2/docker-compose.yml"
OUT="$(WEB_BOUNDARY_ROOT="$T/r2" bash "$GATE" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]; check "a DATABASE_URL on the web service is exit 1 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q 'database variable'; check "…and the rule is named" $?
copy "$T/r2b"
awk '/^  web:/ {print; print "    environment:"; print "      POSTGRES_PASSWORD: x"; next} {print}' "$ROOT/docker-compose.yml" > "$T/r2b/docker-compose.yml"
WEB_BOUNDARY_ROOT="$T/r2b" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ]; check "a POSTGRES_* on the web service is exit 1 (got $rc)" $?
copy "$T/r2c"
awk '/^  web:/ {print; print "    environment:"; print "      <<: [*pg, *app-build]"; next} {print}' "$ROOT/docker-compose.yml" > "$T/r2c/docker-compose.yml"
WEB_BOUNDARY_ROOT="$T/r2c" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ]; check "the *pg anchor merged into the web service is exit 1 (got $rc)" $?

# --- preconditions: exit 2, never 0 ----------------------------------------------
copy "$T/p1"; rm -rf "$T/p1/packages/web/src"; mkdir -p "$T/p1/packages/web/src"
WEB_BOUNDARY_ROOT="$T/p1" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]; check "no runtime file at all is exit 2 (got $rc)" $?
copy "$T/p2"; sed -i.bak 's/^  web:$/  webb:/' "$T/p2/docker-compose.yml"; rm -f "$T/p2/docker-compose.yml.bak"
WEB_BOUNDARY_ROOT="$T/p2" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]; check "a compose file without a web service is exit 2 (got $rc)" $?
copy "$T/p3"; rm "$T/p3/docker-compose.yml"
WEB_BOUNDARY_ROOT="$T/p3" bash "$GATE" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]; check "no compose file is exit 2 (got $rc)" $?

printf 'web boundary self-test: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
