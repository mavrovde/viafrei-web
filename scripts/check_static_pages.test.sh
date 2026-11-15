#!/usr/bin/env bash
# scripts/check_static_pages.test.sh — the gate can say NO (viafrei-web#2): each rule's violation is
# planted in a copy of the two pages and must exit 1; the unplanted copy must pass first; a missing
# page is exit 2. The plants are viafrei-infra's tests/landing-conf.test.sh fallback mutants, plus a
# second sentence and an oversized page. Hermetic: no network (the drift mode is not run here).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
GATE="$HERE/check_static_pages.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
ok() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "  ✗ $1" >&2; fail=$((fail + 1)); fi; }

copy() { local d="$T/$1"; mkdir -p "$d/packages/web/static"; cp -R "$ROOT/packages/web/static/." "$d/packages/web/static/"; printf '%s' "$d"; }
run() { STATIC_PAGES_ROOT="$1" bash "$GATE" > /dev/null 2>&1; echo $?; }

d="$(copy clean)"; [ "$(run "$d")" = 0 ]; ok "the unplanted pages pass" $?

plant() { # plant <name> <page> <sed>
  local d; d="$(copy "$1")"
  sed -i.bak "$3" "$d/packages/web/static/$2/index.html"; rm -f "$d/packages/web/static/$2/index.html.bak"
  cmp -s "$d/packages/web/static/$2/index.html" "$ROOT/packages/web/static/$2/index.html" && { ok "$1: the plant changed nothing" 1; return; }
  [ "$(run "$d")" = 1 ]; ok "$1 is refused (exit 1)" $?
}
for p in fallback preview; do
  plant "$p-script" "$p" 's#</body>#<script>1</script></body>#'
  plant "$p-asset" "$p" 's#</head>#<link rel="stylesheet" href="https://cdn.example.invalid/x.css"></head>#'
  plant "$p-nolegal" "$p" 's#<a href="/datenschutz">Datenschutz</a>##'
  plant "$p-noimpressum" "$p" 's#<a href="/impressum">Impressum</a>##'
  plant "$p-rendered" "$p" 's#<title>\([^<]*\)</title>#<title>{{IMPRESSUM_NAME}}</title>#'
  plant "$p-url" "$p" 's#</style>#body{background:url(x.png)}</style>#'
done
plant fallback-figure fallback 's#gerade nicht erreichbar#seit 12 Minuten nicht erreichbar#'
plant fallback-two fallback 's#noch einmal\.#noch einmal. Danke.#'
plant preview-figure preview 's#im Aufbau#seit 3 Tagen im Aufbau#'
plant preview-two preview 's#im Aufbau\.#im Aufbau. Bald.#'
d="$(copy big)"; head -c 5000 /dev/zero | tr '\0' ' ' >> "$d/packages/web/static/fallback/index.html"
[ "$(run "$d")" = 1 ]; ok "a page above 4096 bytes is refused" $?
d="$(copy missing)"; rm "$d/packages/web/static/preview/index.html"
[ "$(run "$d")" = 2 ]; ok "a missing page is exit 2, never a pass" $?
STATIC_PAGES_ROOT="$d" bash "$GATE" judge extra > /dev/null 2>&1; [ $? = 64 ]; ok "an extra argument is a usage error" $?

echo "check_static_pages self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
