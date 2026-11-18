#!/usr/bin/env bash
# scripts/pins.test.sh — scripts/pins.sh can say NO (viafrei-web#2). Hermetic: every case runs on a
# planted images.pin (PINS_ROOT) and `check` against a docker stub (PINS_DOCKER) that answers as the
# registry would; nothing is pulled and no network is used.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
ok() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "  ✗ $1" >&2; fail=$((fail + 1)); fi; }

D1="sha256:$(printf 'a%.0s' $(seq 1 64))"; D2="sha256:$(printf 'b%.0s' $(seq 1 64))"; D3="sha256:$(printf 'c%.0s' $(seq 1 64))"
GOOD="digest ghcr.io/mavrovde/viafrei-app:2.6.17@$D1
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2
api ghcr.io/mavrovde/viafrei-api:0.3.0@$D3"
plant() { local d="$T/$1"; mkdir -p "$d"; printf '%s\n' "$2" > "$d/images.pin"; printf '%s' "$d"; }
code() { PINS_ROOT="$1" PINS_DOCKER="${3:-false}" bash "$HERE/pins.sh" $2 > "$T/out" 2>&1; echo $?; }

# a stub docker: `buildx imagetools inspect <ref> --format …` answers {"digest":"<what the file says for ref>"}
stub() {
  local s="$T/docker-$1"; printf '%s\n' "$2" > "$T/registry-$1"
  cat > "$s" <<EOF
#!/usr/bin/env bash
[ "\$1 \$2 \$3" = "buildx imagetools inspect" ] || exit 9
d=\$(awk -v r="\$4" '\$1 == r { print \$2 }' "$T/registry-$1")
[ -n "\$d" ] || { echo "ERROR: not found" >&2; exit 1; }
printf '{"mediaType":"application/vnd.oci.image.index.v1+json","digest":"%s","manifests":[{"digest":"$D3"}]}\n' "\$d"
EOF
  chmod +x "$s"; printf '%s' "$s"
}

d="$(plant real "$(cat "$ROOT/images.pin")")"; [ "$(code "$d" lint)" = 0 ]; ok "the shipped images.pin lints" $?
d="$(plant good "$GOOD")"; [ "$(code "$d" lint)" = 0 ]; ok "a well-formed pin file lints" $?
[ "$(code "$d" "ref digest")" = 0 ] && grep -qx "ghcr.io/mavrovde/viafrei-app:2.6.17@$D1" "$T/out"; ok "ref digest prints exactly its reference" $?
[ "$(code "$d" "ref database")" = 0 ] && grep -qx "ghcr.io/mavrovde/viafrei-database:0.1.1@$D2" "$T/out"; ok "ref database prints exactly its reference" $?
[ "$(code "$d" "ref api")" = 0 ] && grep -qx "ghcr.io/mavrovde/viafrei-api:0.3.0@$D3" "$T/out"; ok "ref api prints exactly its reference" $?
[ "$(code "$d" "ref other")" = 2 ]; ok "ref of an unknown key is exit 2" $?

d="$(plant notag "digest ghcr.io/mavrovde/viafrei-app@$D1
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2")"; [ "$(code "$d" lint)" = 2 ]; ok "a pin without a version tag is refused" $?
d="$(plant nodigest "digest ghcr.io/mavrovde/viafrei-app:2.6.17
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2")"; [ "$(code "$d" lint)" = 2 ]; ok "a pin without a digest is refused" $?
d="$(plant edge "digest ghcr.io/mavrovde/viafrei-app:edge@$D1
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2")"; [ "$(code "$d" lint)" = 2 ]; ok "a moving tag (edge) is refused" $?
d="$(plant twice "$GOOD
digest ghcr.io/mavrovde/viafrei-app:2.6.18@$D1")"; [ "$(code "$d" lint)" = 2 ]; ok "a key pinned twice is refused" $?
d="$(plant unknown "$GOOD
bogus ghcr.io/mavrovde/viafrei-api:0.1.0@$D1")"; [ "$(code "$d" lint)" = 2 ]; ok "an unknown key is refused" $?
d="$(plant noapi "digest ghcr.io/mavrovde/viafrei-app:2.6.17@$D1
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2")"; [ "$(code "$d" lint)" = 2 ]; ok "a missing api pin is refused" $?
d="$(plant missing "digest ghcr.io/mavrovde/viafrei-app:2.6.17@$D1")"; [ "$(code "$d" lint)" = 2 ]; ok "a missing key is refused" $?
d="$(plant extra "digest ghcr.io/mavrovde/viafrei-app:2.6.17@$D1 trailing
database ghcr.io/mavrovde/viafrei-database:0.1.1@$D2")"; [ "$(code "$d" lint)" = 2 ]; ok "a trailing word is refused" $?
d="$(plant empty "# only a comment")"; [ "$(code "$d" lint)" = 2 ]; ok "a file with no pin is refused" $?
mkdir -p "$T/none"; [ "$(code "$T/none" lint)" = 2 ]; ok "no images.pin is exit 2" $?
[ "$(code "$T/none" "")" = 64 ]; ok "no command is a usage error" $?
d="$(plant good2 "$GOOD")"; [ "$(code "$d" "lint extra")" = 64 ]; ok "an extra argument is a usage error" $?

s="$(stub same "ghcr.io/mavrovde/viafrei-app:2.6.17 $D1
ghcr.io/mavrovde/viafrei-database:0.1.1 $D2
ghcr.io/mavrovde/viafrei-api:0.3.0 $D3")"
[ "$(code "$d" check "$s")" = 0 ]; ok "check passes when every tag still names its digest" $?
s="$(stub moved "ghcr.io/mavrovde/viafrei-app:2.6.17 $D3
ghcr.io/mavrovde/viafrei-database:0.1.1 $D2
ghcr.io/mavrovde/viafrei-api:0.3.0 $D3")"
[ "$(code "$d" check "$s")" = 1 ] && grep -q "now names $D3" "$T/out"; ok "a tag that moved is exit 1, naming the digest it names now" $?
s="$(stub gone "ghcr.io/mavrovde/viafrei-database:0.1.1 $D2")"
[ "$(code "$d" check "$s")" = 2 ]; ok "a registry that does not answer is exit 2, never a pass" $?

echo "pins self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
