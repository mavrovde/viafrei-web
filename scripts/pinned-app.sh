#!/usr/bin/env bash
# scripts/pinned-app.sh — the released digest, ingest and mcp packages the tests read, taken out of
# the pinned viafrei-app image and nothing else (viafrei-web#2: "depends only on other RELEASED images").
#
# The site's runtime imports none of them (scripts/check_web_boundary.sh). Its TESTS do: the browser
# harness (packages/web/e2e/real-digest.ts) renders the fragments with the digest's own createApp and
# buildDigest, and the agreement tests hold the shell's copies equal to the register, the slugs and the
# attribution lines those packages own. In viafrei they were workspace links to the sources; here they
# are the compiled packages of the image `images.pin` names as `digest`.
#
#   bash scripts/pinned-app.sh install   extract /app/packages/{design,digest,ingest,mcp,status} and
#                                        /app/node_modules of the pinned image into .pinned/app/, point
#                                        each package's exports at its dist (the image selects them with
#                                        --conditions=viafrei-dist; a test process cannot, because the
#                                        site's own @viafrei/design resolves to its sources), and link
#                                        node_modules/@viafrei/{digest,ingest,mcp,status} to them
#   bash scripts/pinned-app.sh status    print the reference .pinned/app was taken from, or exit 1
#
# Run it after every `npm ci` (npm ci empties node_modules). It is idempotent: a tree already taken
# from the pinned reference is kept, only the links are made again.
# exit: 0 ok · 1 not installed / installed from another reference · 2 could not run · 64 usage
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$HERE/.." && pwd -P)"
OUT="$ROOT/.pinned/app"
LINKED="digest ingest mcp status"

refuse() { echo "✗ pinned-app: $1" >&2; exit 2; }
CMD="${1:-}"; [ $# -eq 1 ] || { echo "usage: pinned-app.sh install | status" >&2; exit 64; }

REF="$(bash "$HERE/pins.sh" ref digest)" || exit 2

case "$CMD" in
  status)
    if [ -f "$OUT/.ref" ] && [ "$(cat "$OUT/.ref")" = "$REF" ]; then echo "✓ .pinned/app is $REF"; exit 0; fi
    echo "✗ .pinned/app is not taken from $REF (run: bash scripts/pinned-app.sh install)" >&2; exit 1 ;;
  install) ;;
  *) echo "usage: pinned-app.sh install | status" >&2; exit 64 ;;
esac

command -v docker > /dev/null || refuse "no docker on PATH"
command -v node > /dev/null || refuse "no node on PATH"

if [ -f "$OUT/.ref" ] && [ "$(cat "$OUT/.ref")" = "$REF" ]; then
  echo "  .pinned/app already holds $REF"
else
  rm -rf "$OUT"; mkdir -p "$OUT"
  docker image inspect "$REF" > /dev/null 2>&1 || docker pull -q --platform linux/amd64 "$REF" > /dev/null || refuse "could not pull $REF"
  cid="$(docker create --platform linux/amd64 "$REF" true)" || refuse "could not create a container from $REF"
  trap 'docker rm -f "$cid" > /dev/null 2>&1' EXIT
  docker cp "$cid:/app/packages" "$OUT/packages" > /dev/null || refuse "could not copy /app/packages out of $REF"
  docker cp "$cid:/app/node_modules" "$OUT/node_modules" > /dev/null || refuse "could not copy /app/node_modules out of $REF"
  docker cp "$cid:/app/package.json" "$OUT/package.json" > /dev/null || refuse "could not copy /app/package.json out of $REF"
  # The site is this repository's own; the image's copy of it must not be importable by accident.
  rm -rf "$OUT/packages/web" "$OUT/node_modules/@viafrei/web"
  for p in design digest ingest mcp status; do [ -f "$OUT/packages/$p/package.json" ] || refuse "$REF carries no packages/$p"; done
  # The image strips its sourcemaps but not the comments naming them; a test run would report every
  # missing map as an error. The comment goes, the code is untouched.
  find "$OUT/packages" -name '*.js' -exec perl -i -ne 'print unless m{^//# sourceMappingURL=}' {} + || refuse "could not strip the sourcemap comments"
  # exports: the viafrei-dist target of every entry becomes the entry (the image's own condition).
  node -e '
    const fs = require("node:fs");
    for (const p of process.argv.slice(1)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      let n = 0;
      for (const [k, v] of Object.entries(j.exports ?? {})) {
        if (v && typeof v === "object" && typeof v["viafrei-dist"] === "string") { j.exports[k] = v["viafrei-dist"]; n++; }
      }
      if (n === 0) { console.error("no viafrei-dist export in " + p); process.exit(2); }
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
    }' "$OUT"/packages/{design,digest,ingest,mcp,status}/package.json || refuse "could not rewrite the exports"
  # Declarations: the image ships compiled JavaScript only (its build deletes every .d.ts), so the
  # test code that imports it is type-checked against declarations inferred from that JavaScript.
  # They are weaker than the sources' own types; viafrei shipping its .d.ts would close that gap.
  # `strict` is spelled out because TypeScript 6 turned it on by default: inferred from JavaScript
  # under strictNullChecks, an empty array literal (`cities: []`) is declared `never[]` rather than
  # `any[]`, and a union with the filled branch then types nothing the tests can map over.
  cat > "$OUT/tsconfig.decl.json" << 'JSON'
{ "compilerOptions": { "allowJs": true, "checkJs": false, "declaration": true, "emitDeclarationOnly": true, "module": "NodeNext",
    "moduleResolution": "NodeNext", "target": "ES2022", "strict": false, "skipLibCheck": true, "types": [], "noEmitOnError": false },
  "include": ["packages/*/dist/**/*.js"] }
JSON
  "$ROOT/node_modules/.bin/tsc" -p "$OUT/tsconfig.decl.json" > "$OUT/.decl.log" 2>&1 || true
  [ "$(find "$OUT/packages" -name '*.d.ts' | wc -l)" -gt 100 ] || { tail -5 "$OUT/.decl.log" >&2; refuse "no declarations could be inferred from $REF"; }
  node "$HERE/pinned-types.mjs" "$ROOT" || refuse "could not stub the type-only names"
  printf '%s' "$REF" > "$OUT/.ref"
fi

# The database release's migrations (images.pin `database`), as its own `export-migrations` writes them: the
# privacy notice's error-telemetry paragraph is held against the constraints the schema really carries.
DBREF="$(bash "$HERE/pins.sh" ref database)" || exit 2
DBOUT="$ROOT/.pinned/database"
if [ ! -f "$DBOUT/.ref" ] || [ "$(cat "$DBOUT/.ref")" != "$DBREF" ]; then
  rm -rf "$DBOUT"; mkdir -p "$DBOUT"
  docker run --rm --network none "$DBREF" export-migrations | tar -x -C "$DBOUT" || refuse "could not export the migrations of $DBREF"
  [ -n "$(find "$DBOUT/db/baseline" -name '*_baseline.sql' 2> /dev/null)" ] || refuse "$DBREF exported no baseline"
  printf '%s' "$DBREF" > "$DBOUT/.ref"
fi

mkdir -p "$ROOT/node_modules/@viafrei"
for p in $LINKED; do
  ln -sfn "../../.pinned/app/packages/$p" "$ROOT/node_modules/@viafrei/$p" || refuse "could not link node_modules/@viafrei/$p"
done
for p in $LINKED; do
  node --input-type=module -e "await import('@viafrei/$p')" 2> "$OUT/.import.err" > /dev/null \
    || { sed 's/^/    /' "$OUT/.import.err" | head -5 >&2; refuse "@viafrei/$p from $REF does not load"; }
done
rm -f "$OUT/.import.err"
echo "✓ pinned-app: @viafrei/{${LINKED// /,}} are the compiled packages of $REF; .pinned/database holds the migrations of $DBREF"
