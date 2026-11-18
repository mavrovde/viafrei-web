#!/usr/bin/env bash
# web-i18n-mutation.sh — the proof that the catalogue parity sweep can say NO
# (#380 AC 2), for EVERY catalogue but the German reference (#753: the
# fifteen languages of 2.3.12 each get their own mutants). Each mutant is
# applied to a COPY of packages/web/src/i18n (never the real files), and
# test/i18n-parity.test.ts must go red on each:
#   1. one key deleted from the catalogue      4. the catalogue removed
#   2. one key added to the catalogue          5. one value left in German
#   3. one value emptied                          (the untranslated-value sweep)
# The unmutated copy must pass first, or a red result would prove nothing, and
# the catalogue count is printed, so a run over fewer files than exist is seen.
# `WEB_I18N_MUTATION_LANGS="fr pl"` narrows the run (a language's own commit);
# with nothing set every catalogue in the directory is mutated.
#
#   bash scripts/web-i18n-mutation.sh                   every mutant
#   bash scripts/web-i18n-mutation.sh --shard 2/4       shard 2 of 4: the mutants at the positions p
#                                                       (0-based) of the list below with p mod 4 = 1;
#                                                       ci.yml runs the four shards as a matrix
#   bash scripts/web-i18n-mutation.sh --list [--shard k/n]   print the selected mutants, run nothing
#
# The list is every catalogue but de.json in C-locale order, times the five
# mutants in the order below, so a mutant's shard is fixed by its place alone;
# the n shards are disjoint and together the whole list (test/i18n-mutation.test.ts
# proves it, and holds ci.yml's matrix to the count). Each shard makes its own
# unmutated control run first.
# Exit 0 = every selected mutant killed. Exit 1 = a mutant survived. Exit 2 =
# could not run: a --shard that is not k/n with 1 <= k <= n, a shard that
# selects no mutant, an unknown argument, or the preconditions above.
set -uo pipefail
LIST=0; SHARD=""; HAS_SHARD=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --list) LIST=1; shift ;;
    --shard) [ "$#" -ge 2 ] && [ "$HAS_SHARD" = 0 ] || { echo "✗ web-i18n-mutation: usage: web-i18n-mutation.sh [--list] [--shard <k>/<n>]"; exit 2; }; SHARD="$2"; HAS_SHARD=1; shift 2 ;;
    *) echo "✗ web-i18n-mutation: usage: web-i18n-mutation.sh [--list] [--shard <k>/<n>]"; exit 2 ;;
  esac
done
INDEX=1; COUNT=1
if [ "$HAS_SHARD" = 1 ]; then
  [[ "$SHARD" =~ ^([1-9][0-9]*)/([1-9][0-9]*)$ ]] && [ "${BASH_REMATCH[1]}" -le "${BASH_REMATCH[2]}" ] \
    || { echo "✗ web-i18n-mutation: refused: --shard takes <k>/<n> with 1 <= k <= n, not '$SHARD'"; exit 2; }
  INDEX="${BASH_REMATCH[1]}"; COUNT="${BASH_REMATCH[2]}"
fi
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
SRC="$ROOT/packages/web/src/i18n"
[ -f "$SRC/de.json" ] || { echo "✗ web-i18n-mutation: could not run — $SRC/de.json is missing"; exit 2; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
run() { (cd "$ROOT" && WEB_I18N_DIR="$1" node_modules/.bin/vitest run packages/web/test/i18n-parity.test.ts > "$T/out.log" 2>&1); }
fresh() { rm -rf "$T/i18n"; cp -R "$SRC" "$T/i18n"; }
mutate() { # mutate <python expression over d (the parsed catalogue) and de (the German one)> <file>
  python3 -c "import json,sys; p='$T/i18n/$2'; d=json.load(open(p)); de=json.load(open('$T/i18n/de.json')); $1; open(p,'w').write(json.dumps(d,ensure_ascii=False,indent=2))"
}

# The list is sorted with LC_ALL=C whichever way it was given, so a shard is the same set of mutants
# for the same languages in any order or locale.
LANGS="${WEB_I18N_MUTATION_LANGS:-}"
if [ -z "$LANGS" ]; then
  LANGS="$(cd "$SRC" && for f in *.json; do [ "$f" = "de.json" ] || printf '%s\n' "${f%.json}"; done)"
fi
LANGS="$(for l in $LANGS; do printf '%s\n' "$l"; done | LC_ALL=C sort | tr '\n' ' ')"
N=0; for l in $LANGS; do [ -f "$SRC/$l.json" ] || { echo "✗ web-i18n-mutation: could not run — no $l.json"; exit 2; }; N=$((N + 1)); done
[ "$N" -ge 1 ] || { echo "✗ web-i18n-mutation: could not run — no catalogue to mutate"; exit 2; }

# The list: <lang> <kind> per mutant, in one order; the shard is cut from it.
KINDS="deleted added emptied removed german"
all=(); for l in $LANGS; do for k in $KINDS; do all+=("$l $k"); done; done
sel=(); for p in "${!all[@]}"; do [ $((p % COUNT)) -eq $((INDEX - 1)) ] && sel+=("${all[$p]}"); done
if [ "$HAS_SHARD" = 1 ]; then
  echo "web-i18n-mutation: shard $INDEX/$COUNT: ${#sel[@]} of ${#all[@]} mutant(s)"
  [ "${#sel[@]}" -gt 0 ] || { echo "✗ web-i18n-mutation: refused: this shard selects no mutant"; exit 2; }
fi
if [ "$LIST" = 1 ]; then printf '%s\n' "${sel[@]}"; exit 0; fi

fresh; run "$T/i18n" || { echo "✗ web-i18n-mutation: could not run — the UNMUTATED copy already fails the sweep:"; tail -20 "$T/out.log"; exit 2; }
killed=0; survived=0
judge() { if run "$T/i18n"; then echo "  ✗ $1 SURVIVED"; survived=$((survived + 1)); else echo "  ✓ $1 killed"; killed=$((killed + 1)); fi; }

for m in "${sel[@]}"; do
  l="${m% *}"
  case "${m#* }" in
    deleted) fresh; mutate "del d['footer']['imprint']" "$l.json";                judge "a key deleted from $l.json" ;;
    added)   fresh; mutate "d['footer']['extra']='x'" "$l.json";                 judge "a key added to $l.json" ;;
    emptied) fresh; mutate "d['meta']['tagline']=''" "$l.json";                  judge "a value emptied in $l.json" ;;
    removed) fresh; rm "$T/i18n/$l.json";                                        judge "$l.json removed" ;;
    german)  fresh; mutate "d['meta']['tagline']=de['meta']['tagline']" "$l.json"; judge "a value left in German in $l.json" ;;
  esac
done

want="${#sel[@]}"
echo "web-i18n-mutation: $N catalogue(s), $want mutant(s) selected, $killed killed, $survived survived"
[ "$survived" -eq 0 ] && [ "$killed" -eq "$want" ]
