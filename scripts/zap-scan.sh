#!/usr/bin/env bash
# DAST: OWASP ZAP's baseline scan against the BUILT image of the site shell, on a private docker
# network (viafrei-web#2; viafrei-database's scripts/zap-scan.sh, pointed at the shell). No digest
# and no database are started: the pages render their error states, which is the shape the
# headers, the CSP and the cookies must hold in as well. Nothing here reaches a public host.
#
# Findings go to zap-report/ (HTML, JSON, SARIF). The verdict (scripts/zap-verdict.ts): every alert
# ZAP raises, at any risk level, fails the run unless scripts/zap-rules.tsv marks its rule IGNORE
# with a reason; ZAP's own FAIL (exit 1) or error (exit 3) fails it too.
# Exit 0 pass, 1 an alert, 2 the scan could not run (no /healthz, no report).
# Usage: IMAGE=viafrei-web:ci scripts/zap-scan.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE:?IMAGE must name a built image}"
ZAP_IMAGE="zaproxy/zap-stable:20261016@sha256:5ccfff9a411743ab2615136a2edd7416bec9ce41572fa94e935df38c14adb2b6"
NET="vfweb-zap-$$"
OUT="$ROOT/zap-report"
mkdir -p "$OUT"

cleanup() {
  docker rm -f vfweb-zap-app vfweb-zap >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NET" >/dev/null
docker run -d --name vfweb-zap-app --network "$NET" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -e DIGEST_URL=http://127.0.0.1:9 \
  -e IMPRESSUM_NAME="ZAP Scan" -e IMPRESSUM_STREET="Scanstraße 1" -e IMPRESSUM_CITY="10115 Berlin" \
  -e IMPRESSUM_EMAIL="zap@example.invalid" -e CONTACT_EMAIL="zap@example.invalid" \
  "$IMAGE" >/dev/null
ready=false
for _ in $(seq 1 120); do
  if docker exec vfweb-zap-app node -e 'fetch("http://127.0.0.1:8792/healthz").then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))'; then ready=true; break; fi
  sleep 1
done
[ "$ready" = true ] || { echo "✗ the shell never answered /healthz within 120 s — the scan did not run" >&2; docker logs --tail 20 vfweb-zap-app >&2 || true; exit 2; }

set +e
docker run --name vfweb-zap --network "$NET" --entrypoint sh "$ZAP_IMAGE" -c \
  'mkdir -p /zap/wrk && cat >/zap/wrk/rules.tsv && exec zap-baseline.py -t http://vfweb-zap-app:8792/de -c rules.tsv -r zap.html -J zap.json -I' \
  <"$ROOT/scripts/zap-rules.tsv"
status=$?
set -e
docker cp vfweb-zap:/zap/wrk/zap.html "$OUT/" 2>/dev/null || true
docker cp vfweb-zap:/zap/wrk/zap.json "$OUT/" 2>/dev/null || true
[ -s "$OUT/zap.json" ] || { echo "✗ ZAP produced no report — the scan did not run" >&2; exit 2; }
node "$ROOT/scripts/zap-sarif.mjs" "$OUT/zap.json" >"$OUT/zap.sarif"
# -I only stops ZAP failing on WARN; the verdict on every alert is ours.
verdict=0
node "$ROOT/scripts/zap-verdict.ts" "$OUT/zap.json" "$ROOT/scripts/zap-rules.tsv" || verdict=$?
if [ "$verdict" -eq 2 ]; then exit 2; fi
case "$status" in
  0) ;;
  1) echo "✗ ZAP exited 1: a FAIL-level alert" >&2; exit 1 ;;
  *) echo "✗ ZAP exited $status: the scan did not complete" >&2; exit 2 ;;
esac
exit "$verdict"
