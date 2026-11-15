/**
 * viafrei-web#2: the agreement tests that read another package's SOURCE in
 * viafrei (`packages/digest/src/…/x.ts`) read the same module of the released
 * viafrei-app this repository pins (`images.pin` `digest`, extracted by
 * `scripts/pinned-app.sh`): its compiled JavaScript, which keeps the strings,
 * the constants and the comments those tests look for. A path of any other
 * package — the shell's own, the design's, a snapshot — is returned unchanged.
 *
 * ingest compiles `src/` to `dist/`; digest, mcp and status compile it to
 * `dist/src/`.
 */
const SOURCE = /^(?:\.\.\/)*packages\/(digest|ingest|mcp|status)\/src\/(.+)\.ts$/u;

export function pinnedPath(rel: string): string {
  const m = SOURCE.exec(rel);
  if (m === null) return rel;
  const [, pkg = "", rest = ""] = m;
  const up = rel.slice(0, rel.indexOf("packages/"));
  return `${up}.pinned/app/packages/${pkg}/dist/${pkg === "ingest" ? "" : "src/"}${rest}.js`;
}
