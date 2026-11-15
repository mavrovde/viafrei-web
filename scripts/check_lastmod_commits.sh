#!/usr/bin/env bash
# check_lastmod_commits.sh — `packages/web/src/generated/lastmod.json` is a
# RELEASE ARTEFACT (#934): it is regenerated once, at the cut, and no feature
# commit touches it.
#
# The map dates each page by the day its content hash last moved. Until #934 a
# test failed whenever it was stale, so every commit that changed a page's
# words regenerated it: 213 of the 327 commits under packages/web from
# 2026-10-12 to 2.3.15 carried it, 68–98 lines each, and every merge between
# two branches regenerated on different days conflicted on the same lines.
# The rule this lint keeps, over the commits a push carries:
#
#   1. a commit that changes the map is a RELEASE commit — it moves the root
#      `package.json` "version", or its subject starts `chore: release ` (the
#      release pull request's own commit) or `chore(release)` (the map
#      regenerated on the release pull request's branch) — or it is the one
#      commit that converts the map's format (the parent's map is not
#      version 2: the history written before this rule, and #934's own
#      conversion). Anything else is refused, by sha and subject, with the
#      release step named;
#   2. when the range moves the root version — here only the release pull
#      request does, and CI judges it over origin/main..HEAD, so every later
#      commit on that branch is judged with the bump inside the range — the map
#      must be CURRENT at HEAD: `lastmod.ts --check-fresh` runs, and a stale
#      map is refused. (viafrei, which cut releases locally, also ran it for an
#      untagged version and a `release/*` branch; release-please moves the
#      version in exactly one place, so those arms have nothing to add here.)
#
# Merges are not judged (`--no-merges`): a merge carries the release commit's
# map from the line it merges, and the commits inside it are walked anyway.
#
#   bash scripts/check_lastmod_commits.sh                 # range: @{push}..HEAD, else origin/main..HEAD
#   bash scripts/check_lastmod_commits.sh --range A..B
#
# Exit 0 clean, 1 a feature commit that changed the map or a stale map at the
# cut, 2 could not check: not a git checkout, no base to diff against (a push
# with nothing to compare must not read as clean), an unreadable range, or no
# freshness command when a version bump asked for one. The success line says
# how many commits it read and whether the freshness gate ran.
#
# LASTMOD_LINT_ROOT overrides the root and LASTMOD_FRESH_CMD the freshness
# command; nothing but the self-test sets either (never an ambient
# project directory).
#
# Moved from viafrei (viafrei-web#2), where the push hook ran it; here CI runs it
# on the release pull request (the Site gates job), over origin/main..HEAD.
set -uo pipefail

ROOT="${LASTMOD_LINT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
MAP="packages/web/src/generated/lastmod.json"
G() { git -C "$ROOT" -c color.ui=false "$@"; }

RANGE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --range) RANGE="${2:-}"; shift 2 || { echo "✗ --range needs A..B" >&2; exit 2; } ;;
    *) echo "✗ check_lastmod_commits.sh: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

G rev-parse --git-dir > /dev/null 2>&1 || { echo "✗ lastmod commits: $ROOT is not a git checkout — nothing could be checked" >&2; exit 2; }

if [ -z "$RANGE" ]; then
  if base="$(G rev-parse --verify -q '@{push}' 2>/dev/null)"; then :;
  elif base="$(G rev-parse --verify -q origin/main 2>/dev/null)"; then :;
  else
    echo "✗ lastmod commits: no push base (@{push}) and no origin/main — there is no range to judge, and that is not a clean one" >&2
    exit 2
  fi
  RANGE="$base..HEAD"
fi
case "$RANGE" in *..*) ;; *) echo "✗ lastmod commits: '$RANGE' is not A..B" >&2; exit 2 ;; esac
FROM="${RANGE%%..*}"; TO="${RANGE##*..}"; [ -n "$TO" ] || TO=HEAD

commits="$(G rev-list --no-merges "$FROM..$TO" 2>/dev/null)" || { echo "✗ lastmod commits: git could not list $RANGE" >&2; exit 2; }

# The root manifest's version at a revision ("" when it has none).
version_at() { G show "$1:package.json" 2>/dev/null | sed -nE 's/^  "version": "([^"]+)".*/\1/p' | head -n 1; }
# The map's format version at a revision ("" when it has none).
mapver_at() { G show "$1:$MAP" 2>/dev/null | sed -nE 's/^  "version": ([0-9]+).*/\1/p' | head -n 1; }

read_n=0; touched=0; release=0; converted=0; bad=""
while IFS= read -r c; do
  [ -n "$c" ] || continue
  read_n=$((read_n + 1))
  G diff-tree --no-commit-id --name-only -r "$c" -- "$MAP" | grep -qxF "$MAP" || continue
  touched=$((touched + 1))
  subject="$(G log -1 --format=%s "$c")"
  if [ "$(version_at "$c^")" != "$(version_at "$c")" ]; then release=$((release + 1)); continue; fi
  case "$subject" in "chore(release)"*|"chore: release "*) release=$((release + 1)); continue ;; esac
  if [ "$(mapver_at "$c^")" != 2 ]; then converted=$((converted + 1)); continue; fi
  bad="$bad$(printf '%s %s' "$(printf '%s' "$c" | cut -c1-9)" "$subject")"$'\n'
done <<EOF
$commits
EOF

if [ -n "$bad" ]; then
  echo "✗ lastmod commits: a commit that is not a release commit changed $MAP:"
  printf '%s' "$bad" | sed 's/^/    /'
  echo "  The map is regenerated ONCE, at the release cut, in the release commit"
  echo "  (docs/RELEASING.md: npx tsx packages/web/scripts/lastmod.ts on the release pull request's branch,"
  echo "  committed as chore(release): lastmod)."
  echo "  Take the map out of these commits — git checkout <base> -- $MAP — and leave it to the cut."
  exit 1
fi

# Is HEAD a release? The version moved in the range.
TO_VER="$(version_at "$TO")"
FROM_VER="$(version_at "$FROM")"
why=""
if [ -n "$FROM_VER" ] && [ "$FROM_VER" != "$TO_VER" ]; then why="the range moves the version"; fi

fresh="not run (HEAD carries no release: freshness is the cut's question)"
# The bootstrap: a base with no root package.json is the repository before its first manifest,
# not a release (0.0.0 is never tagged); the first release pull request asks the question.
[ -z "$FROM_VER" ] && fresh="not run (the bootstrap: the base has no package.json; the first release cut asks it)"
if [ -n "$why" ]; then
  if [ -n "${LASTMOD_FRESH_CMD:-}" ]; then
    out="$(cd "$ROOT" && bash -c "$LASTMOD_FRESH_CMD" 2>&1)"; rc=$?
  elif [ -x "$ROOT/node_modules/.bin/tsx" ]; then
    out="$(cd "$ROOT" && ./node_modules/.bin/tsx packages/web/scripts/lastmod.ts --check-fresh 2>&1)"; rc=$?
  else
    echo "✗ lastmod commits: $why ($(version_at "$FROM") → $TO_VER) but there is no tsx to run the freshness gate" >&2
    exit 2
  fi
  if [ "$rc" -ne 0 ]; then
    printf '%s\n' "$out" | tail -n 20
    echo "✗ lastmod commits: HEAD carries a release ($why: $(version_at "$FROM") → $TO_VER) and the map is not current at it"
    echo "  Regenerate it on the release pull request's branch (docs/RELEASING.md):"
    echo "  npx tsx packages/web/scripts/lastmod.ts, committed as chore(release): lastmod"
    exit 1
  fi
  fresh="ran: current at the cut ($why: $(version_at "$FROM") → $TO_VER)"
fi

echo "✓ lastmod commits: $read_n commit(s) read in $RANGE, $touched changed the map ($release release, $converted from before the rule: the parent map is not version 2); freshness gate $fresh"
exit 0
