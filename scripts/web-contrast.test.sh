#!/usr/bin/env bash
# web-contrast.test.sh — the contrast gate's self-test (#376).
#
# The gate is only worth having if it can say NO, so every case here is a
# planted defect or a planted precondition, run against a copy of the real
# tokens file with ONE thing changed:
#
#   · the real file passes (exit 0) and prints the pair count it judged;
#   · a token darkened/lightened past its floor is exit 1 and NAMES the pair;
#   · a body pair that clears 4.5:1 but not 7:1 is exit 1 (the body floor is real);
#   · an `icon` pair is judged at 3:1 (#987): between 3 and 4.5 passes, the same
#     colour as a text pair fails, below 3 fails; an unknown flag is exit 2;
#   · an empty file is exit 2, never 0;
#   · a file with tokens but no @contrast line is exit 2;
#   · a pair naming an undefined token, a non-hex token, a colour in no pair
#     without a reason, a stale @unpaired, a missing dark block — each exit 2.
#
# Hermetic: no network, no browser, node + the gate only.
set -u
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
GATE="$HERE/web-contrast.mjs"
REAL="$ROOT/packages/design/tokens.css"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT INT TERM

pass=0; fail=0

# plant_first <literal> <replacement> <in> <out> — replace the FIRST occurrence
# only (the light theme declares every token before the dark block does).
# awk, because `sed '0,/re/s//…/'` is GNU-only and this runs on BSD sed too.
plant_first() {
  awk -v lit="$1" -v rep="$2" 'BEGIN { done = 0 }
    { if (!done) { i = index($0, lit); if (i > 0) { $0 = substr($0, 1, i - 1) rep substr($0, i + length(lit)); done = 1 } } print }' "$3" > "$4"
  grep -qF -- "$2" "$4"
}
# gate <tokens.css> — the gate takes no path, so each case runs a COPY of it in
# a fixture tree whose packages/design/tokens.css is the case's file
# (a missing file stays missing).
n=0
gate() {
  n=$((n + 1)); local d="$T/tree$n"
  mkdir -p "$d/scripts" "$d/packages/design"
  cp "$GATE" "$d/scripts/web-contrast.mjs"
  [ -f "$1" ] && cp "$1" "$d/packages/design/tokens.css"
  node "$d/scripts/web-contrast.mjs"
}
check() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ✗ %s\n' "$1"; fi; }

[ -f "$REAL" ]
check "the real tokens file exists at $REAL" $?

# --- a path argument is refused: the gate judges its own tree only ------------
node "$GATE" "$REAL" > /dev/null 2>&1; rc=$?
check "a path argument is a usage refusal, exit 2 (rc=$rc)" "$([ "$rc" -eq 2 ] && echo 0 || echo 1)"
node "$GATE" > /dev/null 2>&1; rc=$?
check "with no argument the real tree passes (rc=$rc)" "$([ "$rc" -eq 0 ] && echo 0 || echo 1)"

# --- the real file passes and reports what it judged ---------------------------
OUT="$(gate "$REAL" 2>&1)"; rc=$?
[ "$rc" -eq 0 ]
check "the real tokens.css passes (exit $rc)" $?
printf '%s\n' "$OUT" | grep -qE '✓ web-contrast: [0-9]+ pair·theme\(s\) \(([0-9]+) pairs × 2 themes\)'
check "the success line prints the pair count it judged" $?
N_PAIRS="$(printf '%s\n' "$OUT" | sed -n 's/.*(\([0-9]*\) pairs × 2 themes).*/\1/p')"
[ "${N_PAIRS:-0}" -ge 15 ]
check "at least 15 pairs are declared (found ${N_PAIRS:-0}) — a small list is a list with holes" $?
printf '%s\n' "$OUT" | grep -q -- '--fg on --bg'
check "the body pair --fg on --bg is among the judged" $?

# --- a planted failing token goes red and is named ------------------------------
# Light theme only: the first `--ok:` is the light one. #8fcfa5 on white is ~1.7:1.
plant_first '--ok: #1a6f3c;' '--ok: #8fcfa5;' "$REAL" "$T/fail.css"
check "the mutant was planted (the light --ok was replaced)" $?
OUT="$(gate "$T/fail.css" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]
check "a text colour below 4.5:1 is exit 1 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q -- '✗ light --ok on --surface'
check "the failing pair is named with its theme" $?

# --- the body floor is 7:1, not 4.5:1 ------------------------------------------
# #5a6470 on #ffffff is about 5.7:1 — fine for a label, not for body text.
plant_first '--fg: #131a24;' '--fg: #5a6470;' "$REAL" "$T/body.css"
check "the body mutant was planted" $?
OUT="$(gate "$T/body.css" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]
check "a body colour between 4.5 and 7:1 is exit 1 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q 'floor 7:1, body'
check "the body floor is printed on the failing line" $?

# --- the icon floor is 3:1 (#987, WCAG 1.4.11), and only for an `icon` pair ---
# #8a8a8a on #ffffff is about 3.4:1 — enough for a graphic, not for text. The planted
# token rides on every `--ok:` line, so it is defined in both themes like a real one.
{ sed 's/--ok: #/--icx: #8a8a8a; --ok: #/' "$REAL"; printf '/* @contrast --icx on --surface icon */\n'; } > "$T/icon-ok.css"
OUT="$(gate "$T/icon-ok.css" 2>&1)"; rc=$?
[ "$rc" -eq 0 ]
check "an icon pair between 3 and 4.5:1 passes at the icon floor (got $rc)" $?
printf '%s\n' "$OUT" | grep -q 'icx on --surface .*floor 3:1, icon'
check "…and is judged at 'floor 3:1, icon'" $?
{ sed 's/--ok: #/--icx: #8a8a8a; --ok: #/' "$REAL"; printf '/* @contrast --icx on --surface */\n'; } > "$T/icon-as-text.css"
gate "$T/icon-as-text.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ]
check "the same colour as a TEXT pair is exit 1 — the flag is what lowers the floor (got $rc)" $?
{ sed 's/--ok: #/--icx: #a0a0a0; --ok: #/' "$REAL"; printf '/* @contrast --icx on --surface icon */\n'; } > "$T/icon-low.css"
OUT="$(gate "$T/icon-low.css" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]
check "an icon pair below 3:1 is exit 1 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q -- '--icx'
check "…and the failing icon pair is named" $?
{ command cat "$REAL"; printf '/* @contrast --fg on --bg glyph */\n'; } > "$T/flag.css"
gate "$T/flag.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "an unknown flag is exit 2 (got $rc)" $?
{ command cat "$REAL"; printf '/* @contrast --fg on --bg body icon */\n'; } > "$T/both.css"
gate "$T/both.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "'body' and 'icon' on one pair is exit 2 (got $rc)" $?

# --- preconditions: each is exit 2 and never 0 ---------------------------------
: > "$T/empty.css"
gate "$T/empty.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "an empty tokens.css is exit 2 (got $rc)" $?

gate "$T/does-not-exist.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "a missing file is exit 2 (got $rc)" $?

grep -v '@contrast' "$REAL" > "$T/nopairs.css"
gate "$T/nopairs.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "tokens with no @contrast declaration is exit 2 (got $rc)" $?

{ command cat "$REAL"; printf '/* @contrast --ghost on --bg */\n'; } > "$T/undef.css"
OUT="$(gate "$T/undef.css" 2>&1)"; rc=$?
[ "$rc" -eq 2 ]
check "a pair naming an undefined token is exit 2 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q -- '--ghost'
check "…and the undefined token is named" $?

plant_first '--accent: #0b57a5;' '--accent: rgb(11, 87, 165);' "$REAL" "$T/rgb.css"
check "the non-hex mutant was planted" $?
gate "$T/rgb.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "a pair token that is not a hex colour is exit 2, not a silent skip (got $rc)" $?

{ command cat "$REAL"; printf ':root { --orphan: #123456; }\n'; } > "$T/orphan.css"
OUT="$(gate "$T/orphan.css" 2>&1)"; rc=$?
[ "$rc" -eq 2 ]
check "a colour token in no pair and with no @unpaired reason is exit 2 (got $rc)" $?
printf '%s\n' "$OUT" | grep -q -- '--orphan'
check "…and the orphan is named" $?

{ command cat "$REAL"; printf '/* @unpaired --fg: a stale excuse for a token that is paired */\n'; } > "$T/stale.css"
gate "$T/stale.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "an @unpaired reason for a token that IS in a pair is exit 2 (got $rc)" $?

sed 's/prefers-color-scheme: dark/prefers-color-scheme: light/' "$REAL" > "$T/nodark.css"
gate "$T/nodark.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ]
check "no dark block is exit 2 — both themes or no verdict (got $rc)" $?

# --- an alias resolves, so var(--x) is judged through to its colour -----------
plant_first '--on-sign: #ffffff;' '--on-sign: var(--surface);' "$REAL" "$T/alias.css"
check "the alias mutant was planted" $?
gate "$T/alias.css" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ]
check "a var(--other) alias is resolved and judged (got $rc)" $?

printf 'web-contrast self-test: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
