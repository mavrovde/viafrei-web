#!/usr/bin/env bash
# check_web_boundary.sh — `packages/web` reads no database (#375 A2; #378 PR-04 item 6).
#
# Two rules, each a planted-failure case in `check_web_boundary.test.sh`:
#
#   1. No runtime file under packages/web/src imports a database client or a
#      workspace that holds one: `pg`, `pg-*`, `postgres*`, `@viafrei/ingest`,
#      `@viafrei/mcp`, `@viafrei/status`, `@viafrei/digest`; and no runtime
#      file names `DATABASE_URL`. Tests, scripts and e2e are NOT runtime and
#      may read the register (`legal-strings.test.ts` must).
#   2. The `web` service in this repository's compose file carries no
#      `DATABASE_URL`, no `POSTGRES_*`, no `DIGEST_DATABASE_URL` and no `*pg`
#      merge — and exists.
#
# The production side of the boundary (the production compose file, the edge
# routing no /internal, the fragment cache publishing no port, the web pod's
# Secret and the Ingress) is viafrei-infra's configuration and is held there
# (viafrei-web#2, docs/moved-from-viafrei.md).
#
# Exit 0 = every rule holds; 1 = a rule is broken, named; 2 = could not check
# (no runtime files found, a compose file without a `web` service) — "could not check" is never "passed" (PLAYBOOK §5b).
#
#   bash scripts/check_web_boundary.sh
#
# WEB_BOUNDARY_ROOT overrides the repo root; nothing but the self-test sets it.
set -u
ROOT="${WEB_BOUNDARY_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
problems=0
fail() { problems=$((problems + 1)); printf '  ✗ %s\n' "$1"; }
refuse() { printf '✗ web boundary: could not check — %s\n' "$1"; exit 2; }

SRC="$ROOT/packages/web/src"
[ -d "$SRC" ] || refuse "no $SRC"
FILES="$(find "$SRC" -type f \( -name '*.ts' -o -name '*.astro' -o -name '*.svelte' -o -name '*.mjs' -o -name '*.js' \) | sort)"
N_FILES="$(printf '%s\n' "$FILES" | grep -c . || true)"
[ "${N_FILES:-0}" -ge 5 ] || refuse "found only ${N_FILES:-0} runtime file(s) under packages/web/src — a sweep over nothing would pass"

# --- 1. imports ----------------------------------------------------------------
IMPORT_RE='(from|import|require\()[[:space:]]*\(?[[:space:]]*["'"'"'](pg|pg-[a-z0-9-]+|postgres[a-z0-9-]*|@viafrei/(ingest|mcp|status|digest))(/[^"'"'"']*)?["'"'"']'
hits="$(printf '%s\n' "$FILES" | xargs grep -nE "$IMPORT_RE" 2>/dev/null || true)"
[ -z "$hits" ] || { fail "a runtime file imports a database client or a database-holding workspace:"; printf '%s\n' "$hits" | sed 's/^/      /'; }
dburl="$(printf '%s\n' "$FILES" | xargs grep -nE 'DATABASE_URL' 2>/dev/null || true)"
# the env reader is allowed to SAY it has no key for one, in a comment; a line that reads the variable is not
dburl_real="$(printf '%s\n' "$dburl" | grep -vE ':[0-9]+:\s*(//|\*|/\*)' | grep -vE 'never|no key|carries none|no database URL' || true)"
[ -z "$dburl_real" ] || { fail "a runtime file names DATABASE_URL outside a comment:"; printf '%s\n' "$dburl_real" | sed 's/^/      /'; }

# --- 2. the compose web service --------------------------------------------------
svc_block() { awk -v s="  $2:" '$0 == s {f=1; next} f && (/^  [a-z]/ || /^[a-z]/) {f=0} f' "$1"; }
c="$ROOT/docker-compose.yml"
[ -f "$c" ] || refuse "no $c"
blk="$(svc_block "$c" web)"
[ -n "$blk" ] || refuse "$c has no 'web' service — nothing to judge"
bad="$(printf '%s\n' "$blk" | grep -nE '^\s*(DATABASE_URL|DIGEST_DATABASE_URL|STATUS_DATABASE_URL|POSTGRES_[A-Z_]+)\s*:' || true)"
[ -z "$bad" ] || { fail "$c: the web service carries a database variable:"; printf '%s\n' "$bad" | sed 's/^/      /'; }
printf '%s\n' "$blk" | grep -qE '^\s*<<:.*\*pg\b' && fail "$c: the web service merges the *pg anchor (pool tunables for a process with no pool)"
printf '%s\n' "$blk" | grep -qE 'postgresql://' && fail "$c: the web service carries a postgresql:// URL"

if [ "$problems" -eq 0 ]; then
  printf '✓ web boundary — %d runtime file(s) under packages/web/src import no database client, and the web service in docker-compose.yml carries no database variable\n' "$N_FILES"
  exit 0
fi
printf '✗ web boundary: %d problem(s)\n' "$problems"
exit 1
