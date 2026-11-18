#!/usr/bin/env bash
# scripts/pins.sh — read images.pin, the one file naming the released images this
# repository depends on (viafrei-web#2; the shape of viafrei-ingestor's database.pin).
#
#   bash scripts/pins.sh lint          every line parses, every key is known and named once (carry: each
#                                      reference once, the key repeatable),
#                                      every reference names a version tag AND a sha256 digest
#   bash scripts/pins.sh ref <key>     print the reference of <key> (digest | database | api | carry:
#                                      every carry reference, space-separated)
#   bash scripts/pins.sh check         lint, then ask the registry that each version tag still
#                                      names the pinned digest (read-only; needs docker buildx)
#
# PINS_ROOT overrides the tree and PINS_DOCKER the docker binary (the self-test's fixture and stub).
# exit: 0 ok · 1 refused on a fact (a tag that moved) · 2 could not run / malformed pin · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="${PINS_ROOT:-$(cd "$HERE/.." && pwd -P)}"
DOCKER="${PINS_DOCKER:-docker}"
KEYS="digest database api carry"
REF_RE='^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+:([0-9]+\.[0-9]+\.[0-9]+)@(sha256:[0-9a-f]{64})$'

usage() { echo "usage: pins.sh lint | ref <key> | check" >&2; exit 64; }
refuse() { echo "✗ pins: $1" >&2; exit 2; }

CMD="${1:-}"
case "$CMD" in
  lint|check) [ $# -eq 1 ] || usage ;;
  ref) [ $# -eq 2 ] || usage ;;
  *) usage ;;
esac

FILE="$ROOT/images.pin"
[ -r "$FILE" ] || refuse "no images.pin in $ROOT"
pin_digest=""; pin_database=""; pin_api=""; pin_carry=""
n=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  n=$((n + 1))
  key=""; ref=""; extra=""
  read -r key ref extra <<<"$line"
  [ -z "$extra" ] || refuse "the line '$line' carries more than <key> <reference>"
  [[ "$ref" =~ $REF_RE ]] || refuse "the pin '$key' is not <image>:<X.Y.Z>@sha256:<digest>: '$ref'"
  case "$key" in
    digest) [ -z "$pin_digest" ] || refuse "the key 'digest' is pinned twice"; pin_digest="$ref" ;;
    database) [ -z "$pin_database" ] || refuse "the key 'database' is pinned twice"; pin_database="$ref" ;;
    # api: the viafrei-api release whose contract (api/openapi.json at its tag) the site's API client is generated from
    api) [ -z "$pin_api" ] || refuse "the key 'api' is pinned twice"; pin_api="$ref" ;;
    # carry: an earlier image whose /_a/ files the release build carries (viafrei-web#36); repeatable, optional
    carry) case " $pin_carry " in *" $ref "*) refuse "the carry '$ref' is named twice" ;; esac; pin_carry="${pin_carry:+$pin_carry }$ref" ;;
    *) refuse "unknown pin key '$key' (known: $KEYS)" ;;
  esac
done < "$FILE"
[ "$n" -gt 0 ] || refuse "images.pin holds no pin"
[ -n "$pin_digest" ] || refuse "images.pin has no 'digest' pin"
[ -n "$pin_database" ] || refuse "images.pin has no 'database' pin"
[ -n "$pin_api" ] || refuse "images.pin has no 'api' pin"

ref_of() { case "$1" in digest) printf '%s' "$pin_digest" ;; database) printf '%s' "$pin_database" ;; api) printf '%s' "$pin_api" ;; carry) printf '%s' "$pin_carry" ;; *) return 1 ;; esac; }

case "$CMD" in
  lint) echo "✓ images.pin: $n pin(s) ($KEYS), each <image>:<X.Y.Z>@sha256:<digest>" ;;
  ref)
    r="$(ref_of "$2")" || refuse "no pin named '$2' (known: $KEYS)"
    printf '%s\n' "$r" ;;
  check)
    bad=0
    for kr in "digest:$pin_digest" "database:$pin_database" "api:$pin_api" $(for c in $pin_carry; do printf 'carry:%s ' "$c"; done); do
      k="${kr%%:*}"; ref="${kr#*:}"; [[ "$ref" =~ $REF_RE ]]; want="${BASH_REMATCH[3]}"
      tagged="${ref%@*}"
      got="$("$DOCKER" buildx imagetools inspect "$tagged" --format '{{json .Manifest}}' 2>/dev/null | tr -d ' \n\r\t' | grep -oE '"digest":"sha256:[0-9a-f]{64}"' | head -1 | sed 's/^"digest":"//; s/"$//')"
      # the FIRST digest is the manifest's (or the index's) own; an index lists its platforms after it
      [ -n "$got" ] || refuse "the registry did not answer for $tagged"
      if [ "$got" = "$want" ]; then echo "  ✓ $k: $tagged is $want"; else echo "  ✗ $k: $tagged now names $got, the pin says $want" >&2; bad=1; fi
    done
    [ "$bad" = 0 ] || exit 1
    echo "✓ images.pin: every version tag still names its pinned digest" ;;
esac
