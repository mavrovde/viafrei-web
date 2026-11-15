#!/usr/bin/env node
// scripts/licences.mjs — every package of package-lock.json carries a licence on the allow-list
// (viafrei-web#2; the npm form of viafrei-api's "Dependency licences" job, SSC-003).
//
//   node scripts/licences.mjs            judge, and print the count per licence
//
// An SPDX `A OR B` passes when one side is allowed, `A AND B` when both are. The exceptions are named
// by package with the reason: sharp's libvips and its Windows/wasm builds (LGPL-3.0-or-later) are
// optional DEV dependencies of Astro's image service, used at build time on the builder's own
// platform; the image ships no native module (scripts/image-smoke.sh runs the built image, and the
// runtime stage copies dist/ only). The workspace packages themselves carry no licence field.
// exit: 0 ok · 1 a licence not allowed · 2 could not read the lockfile
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ALLOWED = new Set(["0BSD", "Apache-2.0", "BlueOak-1.0.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "ISC", "MIT", "MPL-2.0"]);
const EXCEPT = /^@img\/sharp-(libvips-[a-z0-9-]+|wasm32|win32-[a-z0-9]+)$/u;
const ROOT = process.argv[2] ?? join(import.meta.dirname, "..");

/** Is an SPDX expression (no parentheses nesting beyond one level) satisfied by the allow-list? */
export function allowed(expr) {
  const e = expr.replace(/^\((.*)\)$/u, "$1").trim();
  if (/ OR /u.test(e)) return e.split(/ OR /u).some((p) => allowed(p));
  if (/ AND /u.test(e)) return e.split(/ AND /u).every((p) => allowed(p));
  return ALLOWED.has(e);
}

let lock;
try { lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")); }
catch (e) { console.error(`✗ licences: package-lock.json could not be read (${String(e)})`); process.exit(2); }
const pkgs = Object.entries(lock.packages ?? {});
if (pkgs.length < 100) { console.error(`✗ licences: the lockfile lists ${String(pkgs.length)} packages — not a lockfile this repository wrote`); process.exit(2); }

const count = new Map(); const bad = []; let excepted = 0; let judged = 0;
for (const [path, p] of pkgs) {
  if (path === "" || p.link === true || !path.includes("node_modules/")) continue;
  const name = path.replace(/^.*node_modules\//u, "");
  const lic = typeof p.license === "string" ? p.license : "(none)";
  judged++;
  count.set(lic, (count.get(lic) ?? 0) + 1);
  if (allowed(lic)) continue;
  if (EXCEPT.test(name) && p.dev === true && p.optional === true) { excepted++; continue; }
  bad.push(`${name}: ${lic}`);
}
for (const [l, n] of [...count].sort()) console.log(`  ${String(n).padStart(4)}  ${l}`);
if (bad.length > 0) { console.error(`✗ licences: ${String(bad.length)} package(s) outside the allow-list:\n  ${bad.join("\n  ")}`); process.exit(1); }
console.log(`✓ licences: ${String(judged)} package(s), each on the allow-list (${String(excepted)} named build-only exception(s))`);
