#!/usr/bin/env bash
# scripts/changes.test.sh — changes.sh can say both answers, and errs toward running (viafrei-web#2).
# Hermetic: a throwaway git repository.
set -u
HERE="$(cd "$(dirname "$0")" && pwd -P)"
GATE="$HERE/changes.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT INT TERM
pass=0; fail=0
is() { if [ "$2" = "$3" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ✗ %s (want %s, got %s)\n' "$1" "$2" "$3"; fi; }
G() { git -C "$T/r" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false "$@"; }
ans() { CHANGES_ROOT="$T/r" bash "$GATE" "$@" 2> /dev/null; }

mkdir -p "$T/r"; G init -q -b main
mkdir -p "$T/r/docs" "$T/r/src" "$T/r/.github/ISSUE_TEMPLATE" "$T/r/packages/web"
echo a > "$T/r/README.md"; echo a > "$T/r/src/a.ts"; G add -A; G commit -qm base; BASE="$(G rev-parse HEAD)"

at() { G add -A; G commit -qm "$1"; G rev-parse HEAD; }
echo b >> "$T/r/README.md"; echo b > "$T/r/docs/guide.md"; echo b > "$T/r/LICENSE"
echo b > "$T/r/.github/CODEOWNERS"; echo b > "$T/r/.github/ISSUE_TEMPLATE/bug.yml"; echo b > "$T/r/.github/PULL_REQUEST_TEMPLATE.md"
echo b > "$T/r/docs/notes.txt"; echo b > "$T/r/packages/web/NOTES.md"
P="$(at prose)"
is "every prose kind at once is prose" false "$(ans "$BASE" "$P")"
echo c >> "$T/r/src/a.ts"; C="$(at code)"
is "one code file among them is code" true "$(ans "$BASE" "$C")"
is "…and alone" true "$(ans "$P" "$C")"
G checkout -q -b t "$BASE"; mkdir -p "$T/r/docs"; echo d > "$T/r/docs/RELEASING.md"; R="$(at released)"
is "docs/RELEASING.md is prose a test reads: code" true "$(ans "$BASE" "$R")"
G checkout -q -b u "$BASE"; mkdir -p "$T/r/packages/web"; echo d > "$T/r/packages/web/PRIVACY-overload.md"; O="$(at overload)"
is "packages/web/PRIVACY-overload.md is prose a test reads: code" true "$(ans "$BASE" "$O")"
G checkout -q -b v "$BASE"; echo y > "$T/r/src/y.yml"; Y="$(at yml)"
is "a .yml outside the issue templates is code" true "$(ans "$BASE" "$Y")"
# a branch behind main: the diff is from the merge base, so main's own code changes do not count
G checkout -q -b w "$BASE"; echo w >> "$T/r/README.md"; W="$(at "prose on an old base")"
is "a prose branch behind a code change on main is prose (three-dot diff)" false "$(ans "$C" "$W")"

# the errors run every job
is "no base (a new branch's all-zero before) runs everything" true "$(ans 0000000000000000000000000000000000000000 "$P")"
is "an empty base runs everything" true "$(ans "" "$P")"
is "a base not in the checkout runs everything" true "$(ans deadbeefdeadbeefdeadbeefdeadbeefdeadbeef "$P")"
is "a head not in the checkout runs everything" true "$(ans "$BASE" deadbeefdeadbeefdeadbeefdeadbeefdeadbeef)"
is "an empty diff runs everything" true "$(ans "$P" "$P")"
CHANGES_ROOT="$T/r" bash "$GATE" "$BASE" > /dev/null 2>&1; is "one argument is a usage error" 64 "$?"
warn="$(CHANGES_ROOT="$T/r" bash "$GATE" "" "$P" 2>&1 > /dev/null)"
case "$warn" in *"::warning::"*) is "an error is announced as a warning" yes yes ;; *) is "an error is announced as a warning" yes no ;; esac

# every prose file it names as tested exists in this repository
for f in $(sed -n 's/^TESTED_PROSE="\(.*\)"$/\1/p' "$GATE"); do
  [ -f "$HERE/../$f" ]; is "TESTED_PROSE names a file that exists: $f" 0 "$?"
done

printf 'changes self-test: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
