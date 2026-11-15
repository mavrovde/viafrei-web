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
# Exit 0 = every mutant killed. Exit 1 = a mutant survived. Exit 2 = could not run.
set -uo pipefail
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

LANGS="${WEB_I18N_MUTATION_LANGS:-}"
if [ -z "$LANGS" ]; then
  LANGS="$(cd "$SRC" && for f in *.json; do [ "$f" = "de.json" ] || printf '%s ' "${f%.json}"; done)"
fi
N=0; for l in $LANGS; do [ -f "$SRC/$l.json" ] || { echo "✗ web-i18n-mutation: could not run — no $l.json"; exit 2; }; N=$((N + 1)); done
[ "$N" -ge 1 ] || { echo "✗ web-i18n-mutation: could not run — no catalogue to mutate"; exit 2; }

fresh; run "$T/i18n" || { echo "✗ web-i18n-mutation: could not run — the UNMUTATED copy already fails the sweep:"; tail -20 "$T/out.log"; exit 2; }
killed=0; survived=0
judge() { if run "$T/i18n"; then echo "  ✗ $1 SURVIVED"; survived=$((survived + 1)); else echo "  ✓ $1 killed"; killed=$((killed + 1)); fi; }

for l in $LANGS; do
  fresh; mutate "del d['footer']['imprint']" "$l.json";                judge "a key deleted from $l.json"
  fresh; mutate "d['footer']['extra']='x'" "$l.json";                 judge "a key added to $l.json"
  fresh; mutate "d['meta']['tagline']=''" "$l.json";                  judge "a value emptied in $l.json"
  fresh; rm "$T/i18n/$l.json";                                        judge "$l.json removed"
  fresh; mutate "d['meta']['tagline']=de['meta']['tagline']" "$l.json"; judge "a value left in German in $l.json"
done

want=$((N * 5))
echo "web-i18n-mutation: $N catalogue(s), $killed killed, $survived survived"
[ "$survived" -eq 0 ] && [ "$killed" -eq "$want" ]
