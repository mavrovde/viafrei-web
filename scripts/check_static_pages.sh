#!/usr/bin/env bash
# scripts/check_static_pages.sh — the two pages the edge serves without the shell (viafrei-web#2).
#
#   packages/web/static/fallback/index.html   the nginx error_page fallback: served, at 200, when the
#                                             shell is down, restarting or mid-deploy (#405)
#   packages/web/static/preview/index.html    the owner preview's page
#
# Both ship in the image at /srv/site-static/{fallback,preview}/index.html (Dockerfile), verbatim:
# viafrei-infra mounts them from there. Each is judged as served bytes, comments dropped, by the rules
# viafrei-infra's tests/landing-conf.test.sh §3c holds the fallback to (ported here, unchanged):
# something in its <main>, exactly one sentence, no figure (a number on a page served when nothing can
# be read could only be a stale one), both legal links, no script, no external asset, nothing left to
# substitute, at most 4096 bytes.
#
#   bash scripts/check_static_pages.sh           judge both pages
#
# That viafrei-infra serves these bytes (and no older copy of its own) is viafrei-infra's check to hold:
# it reads them out of the released image (viafrei-web#2).
#
# STATIC_PAGES_ROOT overrides the tree (the self-test's planted copies).
# exit: 0 ok · 1 a rule failed · 2 could not run · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="${STATIC_PAGES_ROOT:-$(cd "$HERE/.." && pwd -P)}"
[ $# -eq 0 ] || { echo "usage: check_static_pages.sh" >&2; exit 64; }

refuse() { echo "✗ static pages: $1" >&2; exit 2; }
fails=0; checks=0
check() { checks=$((checks + 1)); if [ "$2" -eq 0 ]; then echo "  ✓ $1"; else echo "  ✗ $1" >&2; fails=$((fails + 1)); fi; }

PAGES="fallback preview"
for p in $PAGES; do
  f="$ROOT/packages/web/static/$p/index.html"
  [ -s "$f" ] || refuse "$f is missing or empty"
  # every comment dropped, each on its own: infra's greedy `<!--.*-->` over the joined page would
  # swallow the preview's <main>, which sits between its two comments (the fallback has one)
  FB="$(perl -0pe 's/<!--.*?-->//gs' "$f" | tr '\n' ' ')"
  FBTEXT="$(printf '%s' "$FB" | sed -n 's#.*<main>\(.*\)</main>.*#\1#p' | sed -e 's#<footer>.*</footer>##' -e 's#<[^>]*>##g')"
  [ -n "$(printf '%s' "$FBTEXT" | tr -d '[:space:]')" ]; check "$p: the page says something in its <main>" $?
  n_sent="$(printf '%s' "$FBTEXT" | grep -o '[.!?]' | wc -l | tr -d ' ')"
  [ "$n_sent" -eq 1 ]; check "$p: …exactly one sentence (counted $n_sent)" $?
  ! printf '%s' "$FBTEXT" | grep -c '[0-9]' > /dev/null; check "$p: …and no figure in it" $?
  grep -q '<a href="/impressum">Impressum</a>' <<< "$FB"; check "$p: links the Impressum" $?
  grep -q '<a href="/datenschutz">Datenschutz</a>' <<< "$FB"; check "$p: links the Datenschutzerklärung" $?
  ! printf '%s' "$FB" | grep -ci '<script' > /dev/null; check "$p: carries no script" $?
  ! printf '%s' "$FB" | grep -ciE '(src|href)="(https?:)?//|url\(|@import|<link[^>]+rel="(stylesheet|preload|icon)' > /dev/null
  check "$p: loads no external asset (no remote src/href, no url(), no @import, no linked stylesheet)" $?
  ! printf '%s' "$FB" | grep -cE '\{\{|<!--(IF|INCLUDE)' > /dev/null; check "$p: nothing is left to substitute: it is shipped verbatim" $?
  bytes="$(wc -c < "$f" | tr -d ' ')"
  [ "$bytes" -le 4096 ]; check "$p: is small ($bytes bytes, at most 4096)" $?
done

[ "$checks" -gt 0 ] || refuse "no rule ran"
if [ "$fails" -gt 0 ]; then echo "✗ static pages: $fails of $checks check(s) failed" >&2; exit 1; fi
echo "✓ static pages: $checks check(s) over $(echo $PAGES | wc -w | tr -d ' ') page(s)"
