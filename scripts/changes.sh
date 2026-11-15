#!/usr/bin/env bash
# scripts/changes.sh <base> <head> — does this change touch more than prose? (viafrei-web#2)
#
# The CI and Security workflows run on every pull request and every push to main; their first job
# (`changes`) calls this and the heavy jobs run only when it prints `true`. A workflow-level
# `paths-ignore` would skip the WHOLE workflow on a prose-only pull request, so its required checks
# would never report and the pull request could only be merged past the ruleset. A job skipped by
# its `if:` reports as skipped, which a required check accepts.
#
# Prints `false` only when the diff base...head was read, is not empty, and every file in it is
# prose: `*.md` anywhere, `docs/**`, LICENSE, .github/CODEOWNERS, .github/ISSUE_TEMPLATE/**,
# .github/PULL_REQUEST_TEMPLATE.md — except the prose files a test reads (TESTED_PROSE), which are
# code. Anything it cannot read prints `true` with a warning: the safe way to be wrong is to run
# the jobs, never to skip them.
#
# exit: 0 (an answer on stdout) · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="${CHANGES_ROOT:-$(cd "$HERE/.." && pwd -P)}"

# The prose the suites read: a change to one of these is a change to what a test asserts.
TESTED_PROSE="docs/RELEASING.md docs/moved-from-viafrei.md packages/web/PRIVACY-overload.md"

[ $# -eq 2 ] || { echo "usage: changes.sh <base> <head>" >&2; exit 64; }
base="$1"; head="$2"
code() { [ -z "${1:-}" ] || echo "::warning::changes: $1 — running every job" >&2; echo true; exit 0; }

case "$base" in ""|0000000000000000000000000000000000000000) code "no base to diff against (a new branch or a dispatch)" ;; esac
[ -n "$head" ] || code "no head to diff"
git -C "$ROOT" rev-parse --verify -q "$base^{commit}" > /dev/null || code "the base $base is not in this checkout (fetch-depth 0?)"
git -C "$ROOT" rev-parse --verify -q "$head^{commit}" > /dev/null || code "the head $head is not in this checkout"
files="$(git -C "$ROOT" -c core.quotepath=false diff --name-only "$base...$head" 2> /dev/null)" || code "git could not diff $base...$head"
[ -n "$files" ] || code "the diff is empty, so nothing shows it is prose"

while IFS= read -r f; do
  for t in $TESTED_PROSE; do [ "$f" = "$t" ] && { echo "changes: $f is prose a test reads" >&2; echo true; exit 0; }; done
  case "$f" in
    *.md|docs/*|LICENSE|.github/CODEOWNERS|.github/ISSUE_TEMPLATE/*|.github/PULL_REQUEST_TEMPLATE.md) ;;
    *) echo "changes: $f is code" >&2; echo true; exit 0 ;;
  esac
done <<EOF
$files
EOF
echo "changes: $(printf '%s\n' "$files" | grep -c .) file(s), all prose" >&2
echo false
