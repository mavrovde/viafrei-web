#!/usr/bin/env bash
# scripts/ci-gate.sh <sha> — fetch what scripts/ci-gate.ts judges, and judge it (viafrei-web#2).
#
# The runs on the commit, then the jobs of each required workflow's newest run: a run of skipped
# jobs concludes `success`, so the run alone is not evidence (ci-gate.ts). Read-only `gh api`;
# GH_REPO (owner/repo) and GH_TOKEN come from the workflow.
#
# exit: 0 may be released · 1 refused (the reason on stderr) · 2 could not judge
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
[ $# -eq 1 ] || { echo "usage: GH_REPO=owner/repo ci-gate.sh <sha>" >&2; exit 2; }
sha="$1"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "✗ ci-gate: '$sha' is not a 40-hex commit" >&2; exit 2; }
[[ "${GH_REPO:-}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "✗ ci-gate: GH_REPO is not owner/repo" >&2; exit 2; }
command -v gh > /dev/null || { echo "✗ ci-gate: no gh on PATH" >&2; exit 2; }

dir="$(mktemp -d)"; trap 'rm -rf "$dir"' EXIT
gh api --paginate --slurp "repos/$GH_REPO/actions/runs?head_sha=$sha&per_page=100" > "$dir/runs.json" \
  || { echo "✗ ci-gate: the runs on $sha could not be read" >&2; exit 2; }
ids="$(node "$HERE/ci-gate.ts" newest "$sha" "$GH_REPO" < "$dir/runs.json")" || exit 2
for id in $ids; do
  [[ "$id" =~ ^[0-9]+$ ]] || { echo "✗ ci-gate: '$id' is not a run id" >&2; exit 2; }
  gh api --paginate --slurp "repos/$GH_REPO/actions/runs/$id/jobs?per_page=100" > "$dir/jobs-$id.json" \
    || { echo "✗ ci-gate: the jobs of run $id could not be read" >&2; exit 2; }
done
rc=0
node "$HERE/ci-gate.ts" "$sha" "$GH_REPO" "$dir" < "$dir/runs.json" || rc=$?
exit "$rc"
