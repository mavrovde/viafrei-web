#!/usr/bin/env bash
# Self-test for scripts/check_lastmod_commits.sh (#934 D1, D2).
#
# The lint's claim is "no commit but a release commit changes the lastmod map,
# and a pushed release carries a current map". Each case builds a throwaway
# git repository (pointed at by LASTMOD_LINT_ROOT, which nothing else sets)
# with a root package.json and a map, plants one history, and asserts the
# verdict. The freshness gate is a stub (LASTMOD_FRESH_CMD) that records that
# it ran and answers what the case says, so no tsx and no real tree is read.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LINT="$ROOT/scripts/check_lastmod_commits.sh"
fails=0
n=0

check() {
  n=$((n + 1))
  local label="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then
    printf '  ok   %s\n' "$label"
  else
    printf '  FAIL %s\n       want %s\n       got  %s\n' "$label" "$want" "$got"
    fails=$((fails + 1))
  fi
}
contains() {
  n=$((n + 1))
  local label="$1" needle="$2" hay="$3"
  case "$hay" in
    *"$needle"*) printf '  ok   %s\n' "$label" ;;
    *) printf '  FAIL %s\n       no «%s» in:\n%s\n' "$label" "$needle" "$hay"; fails=$((fails + 1)) ;;
  esac
}

work=$(mktemp -d -t vf-lastmod-commits-test.XXXXXX)
trap 'rm -rf "$work"' EXIT
REPO="$work/repo"
MAP="packages/web/src/generated/lastmod.json"

G() { git -C "$REPO" -c user.email=t@example.org -c user.name=t -c commit.gpgsign=false "$@"; }
manifest() { printf '{\n  "name": "viafrei",\n  "version": "%s"\n}\n' "$1" > "$REPO/package.json"; }
map_v1() { printf '{\n  "version": 1,\n  "pages": {\n    "a:de": {\n      "hash": "%s",\n      "date": "2026-10-01"\n    }\n  }\n}\n' "$1" > "$REPO/$MAP"; }
map_v2() { printf '{\n  "version": 2,\n  "pages": {\n    "a:de": ["%s", "%s"]\n  }\n}\n' "$1" "${2:-2026-10-01}" > "$REPO/$MAP"; }
commit() { G add -A && G commit -qm "$1"; }
page() { printf '%s\n' "$1" > "$REPO/page.txt"; }

# A repository whose base commit holds a version-2 map at 2.3.18: the state after #934.
fresh_repo() {
  rm -rf "$REPO"; mkdir -p "$REPO/packages/web/src/generated"
  G init -q -b main
  manifest 2.3.18; map_v2 aaaa; page one; commit "base"
  G tag base; G tag v2.3.18  # 2.3.18 is shipped: a branch at it carries no release
}

run() { # run [env…] — the lint over base..HEAD; sets OUT and RC
  OUT="$(env LASTMOD_LINT_ROOT="$REPO" "$@" bash "$LINT" --range base..HEAD 2>&1)"; RC=$?
}
STUB_OK='echo fresh-ran >> "'"$work"'/ran"; echo "✓ stub current"'
STUB_STALE='echo fresh-ran >> "'"$work"'/ran"; echo "  ✗ a:de: its content changed since the map was written"; exit 1'
ran_count() { [ -f "$work/ran" ] && wc -l < "$work/ran" | tr -d ' ' || echo 0; }

echo "== a feature commit leaves the map alone =="
fresh_repo; page two; commit "feat(web): a page's words"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_OK"
check "a feature commit that does not touch the map passes" 0 "$RC"
contains "…and says how many commits it read" "1 commit(s) read" "$OUT"
contains "…and that freshness is the cut's question" "freshness gate not run" "$OUT"
check "…and the freshness gate did not run (no version moved)" 0 "$(ran_count)"

echo "== a feature commit that changes the map is refused (D1) =="
fresh_repo; page two; map_v2 bbbb; commit "feat(web): a page's words and the map"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a non-release commit changing the map exits 1" 1 "$RC"
contains "…naming the commit's subject" "feat(web): a page's words and the map" "$OUT"
contains "…and the release step" "regenerated ONCE, at the release cut" "$OUT"
contains "…and the command" "npx tsx packages/web/scripts/lastmod.ts" "$OUT"

fresh_repo; map_v2 bcbc; commit "chore(web): regenerate the lastmod map"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a chore commit that is not chore(release) is refused too" 1 "$RC"

echo "== the refusal finds it among other commits =="
fresh_repo; page two; commit "feat: one"; map_v2 cccc; commit "fix: two touches the map"; page three; commit "feat: three"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "one offending commit among three exits 1" 1 "$RC"
contains "…named" "fix: two touches the map" "$OUT"
case "$OUT" in *"feat: one"*|*"feat: three"*) check "…and only it is named" clean named ;; *) check "…and only it is named" clean clean ;; esac

echo "== the release commit may change it, and then the map must be current (D2) =="
fresh_repo; page two; commit "feat: words"; manifest 2.3.19; map_v2 dddd 2026-10-23; commit "chore(release): 2.3.19"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_OK"
check "a version bump that regenerates the map passes" 0 "$RC"
check "…and ran the freshness gate once" 1 "$(ran_count)"
contains "…and says so with the versions" "ran: current at the cut (the range moves the version: 2.3.18 → 2.3.19)" "$OUT"
contains "…counting the release commit" "1 release" "$OUT"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_STALE"
check "a version bump with a STALE map exits 1" 1 "$RC"
contains "…naming the stale row" "a:de: its content changed" "$OUT"
contains "…and the release pull request as the place to fix it" "Regenerate it on the release pull request's branch" "$OUT"

echo "== a version bump carried by a commit that is not the map's =="
fresh_repo; manifest 2.3.19; commit "chore(release): 2.3.19 bump"; page late; commit "fix: a late fix after the cut"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_STALE"
check "a late fix after the cut makes the release stale: exit 1" 1 "$RC"
check "…the freshness gate ran" 1 "$(ran_count)"

echo "== a later commit on the release pull request: judged from main, the bump is still inside the range =="
fresh_repo; G checkout -q -b release-please--branches--main
manifest 2.3.19; map_v2 eeee 2026-10-23; commit "chore: release 2.3.19"
page late; commit "fix: a late content fix on the release branch"
rm -f "$work/ran"; OUT="$(env LASTMOD_LINT_ROOT="$REPO" LASTMOD_FRESH_CMD="$STUB_STALE" bash "$LINT" --range base..HEAD 2>&1)"; RC=$?
check "a late content fix on the release pull request with a stale map exits 1" 1 "$RC"
check "…the freshness gate ran" 1 "$(ran_count)"

echo "== before the first release: an untagged version on a feature branch runs no gate =="
fresh_repo; G tag -d v2.3.18 > /dev/null; page two; commit "feat: words"
rm -f "$work/ran"; OUT="$(env LASTMOD_LINT_ROOT="$REPO" LASTMOD_FRESH_CMD="$STUB_STALE" bash "$LINT" --range base..HEAD 2>&1)"; RC=$?
check "a feature commit at an untagged version passes" 0 "$RC"
check "…without running the freshness gate" 0 "$(ran_count)"

echo "== a feature branch at a shipped version runs no gate, however far main lags =="
# main is pushed when a milestone closes, so origin/main is often versions behind
fresh_repo; G checkout -q -b oldmain; manifest 2.2.14; commit "main, two minors behind"; G update-ref refs/remotes/origin/main oldmain
G checkout -q -b feat/x base; page two; commit "feat: words"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_STALE"
check "a feature branch at a tagged version passes" 0 "$RC"
check "…without running the freshness gate" 0 "$(ran_count)"

echo "== the re-cut after a late fix: a chore(release) commit regenerates =="
fresh_repo; manifest 2.3.19; map_v2 eeee 2026-10-23; commit "chore(release): 2.3.19"; page late; commit "fix: late"; map_v2 ffff 2026-10-24; commit "chore(release): 2.3.19 — regenerate lastmod after the late fix"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a chore(release) re-cut may change the map" 0 "$RC"
contains "…counted as release" "2 release" "$OUT"

echo "== the release pull request's own commit (release-please's subject) =="
fresh_repo; manifest 2.3.19; commit "chore: release 2.3.19"; map_v2 abcd 2026-10-24; commit "chore: release 2.3.19 (the map)"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a chore: release commit may change the map" 0 "$RC"
contains "…counted as release" "1 release" "$OUT"
fresh_repo; page two; map_v2 abce 2026-10-24; commit "chore: released nothing"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a subject that only starts like it is refused" 1 "$RC"

echo "== the history before the rule: a parent map of version 1 =="
rm -rf "$REPO"; mkdir -p "$REPO/packages/web/src/generated"; G init -q -b main
manifest 2.3.18; map_v1 aaaa; page one; commit "base"; G tag base; G tag v2.3.18
page two; map_v1 bbbb; commit "feat(web): the old way, regenerating the map"
map_v2 bbbb; commit "refactor(web): the map in its one-line form (#934)"
page three; map_v2 cccc; commit "feat(web): the new way broken"
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a v2-parented feature commit is refused even after old-style history" 1 "$RC"
contains "…naming only it" "feat(web): the new way broken" "$OUT"
case "$OUT" in *"the old way"*|*"one-line form"*) check "…the pre-rule and conversion commits are not named" clean named ;; *) check "…the pre-rule and conversion commits are not named" clean clean ;; esac
G reset -q --hard HEAD~1
run LASTMOD_FRESH_CMD="$STUB_OK"
check "pre-rule commits and the conversion pass" 0 "$RC"
contains "…counted apart" "2 from before the rule" "$OUT"

echo "== merges are not judged, their commits are =="
fresh_repo; G checkout -q -b side; page side; map_v2 abab; commit "feat: side touches the map"; G checkout -q main; echo m > "$REPO/other.txt"; commit "feat: main"
G merge -q --no-ff side -m "merge side" > /dev/null
run LASTMOD_FRESH_CMD="$STUB_OK"
check "a commit inside a merged branch is still judged" 1 "$RC"
contains "…by name" "feat: side touches the map" "$OUT"

echo "== the refusals: could not check is exit 2, never a pass =="
OUT="$(LASTMOD_LINT_ROOT="$work/nowhere" bash "$LINT" --range a..b 2>&1)"; RC=$?
check "not a git checkout: exit 2" 2 "$RC"
fresh_repo
OUT="$(LASTMOD_LINT_ROOT="$REPO" bash "$LINT" 2>&1)"; RC=$?
check "no @{push} and no origin/main: exit 2" 2 "$RC"
contains "…saying there is no range" "no range to judge" "$OUT"
OUT="$(LASTMOD_LINT_ROOT="$REPO" bash "$LINT" --range nosuch..HEAD 2>&1)"; RC=$?
check "an unreadable range: exit 2" 2 "$RC"
OUT="$(LASTMOD_LINT_ROOT="$REPO" bash "$LINT" --range justone 2>&1)"; RC=$?
check "a range that is not A..B: exit 2" 2 "$RC"
OUT="$(LASTMOD_LINT_ROOT="$REPO" bash "$LINT" --bogus 2>&1)"; RC=$?
check "an unknown argument: exit 2" 2 "$RC"
manifest 2.3.19; commit "chore(release): 2.3.19"
OUT="$(LASTMOD_LINT_ROOT="$REPO" bash "$LINT" --range base..HEAD 2>&1)"; RC=$?
check "a version bump with no tsx and no stub: exit 2, not a skipped gate" 2 "$RC"
contains "…naming why" "no tsx to run the freshness gate" "$OUT"

echo "== the bootstrap: a base with no package.json is not a release =="
rm -rf "$REPO"; mkdir -p "$REPO/packages/web/src/generated"; G init -q -b main
echo r > "$REPO/README.md"; commit "base"; G tag base
manifest 0.0.0; map_v2 aaaa; page one; commit "feat: the repository's first manifest"
rm -f "$work/ran"; run LASTMOD_FRESH_CMD="$STUB_STALE"
check "the first manifest over a base without one passes" 0 "$RC"
contains "…and says it is the bootstrap" "the bootstrap" "$OUT"
check "…and the freshness gate did not run" 0 "$(ran_count)"

echo "== the real tree, on its own history (the gate can say yes) =="
OUT="$(bash "$LINT" --range HEAD~1..HEAD 2>&1)"; RC=$?
contains "the real checkout's last commit is judged and the line says how many it read" "commit(s) read in HEAD~1..HEAD" "$OUT"

echo
if [ "$fails" -eq 0 ]; then echo "check_lastmod_commits.test.sh: $n passed, 0 failed"; exit 0; fi
echo "check_lastmod_commits.test.sh: $((n - fails)) passed, $fails failed"; exit 1
