// scripts/pinned-types.mjs — the type names the tests import from the pinned viafrei-app that its
// INFERRED declarations do not carry (viafrei-web#2).
//
// The image ships compiled JavaScript only; scripts/pinned-app.sh infers declarations from it, and
// inference has no TYPE to give for a name that was only ever a type (`export type Snapshot = …`).
// For each such name a test or the e2e harness imports, this appends `export type Name = any;` to
// the declaration file the import resolves to — inside .pinned/, generated, never committed — and
// prints how many it wrote, so the gap is counted rather than silent. The real fix is outside this
// repository: viafrei-app shipping its own .d.ts. Called by pinned-app.sh; reads, besides .pinned/,
// only packages/web.
import { readdirSync, readFileSync, appendFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(process.argv[2] ?? ".");
const PINNED = join(ROOT, ".pinned/app/packages");
const PKG = /^@viafrei\/(digest|ingest|mcp|status)(\/.+)?$/u;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "dist" || e === "build" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/u.test(e)) out.push(p);
  }
  return out;
}

/** The pinned declaration file a specifier names, or null when it is not the pinned app's. */
function target(spec, from) {
  const m = PKG.exec(spec);
  let js;
  if (m) {
    const dir = join(PINNED, m[1]);
    const exp = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).exports ?? {};
    const entry = exp[`.${m[2] ?? ""}`];
    if (typeof entry !== "string") return null;
    js = join(dir, entry);
  } else if (spec.startsWith(".") && spec.includes(".pinned/app/")) {
    js = resolve(dirname(from), spec);
  } else return null;
  return js.replace(/\.js$/u, ".d.ts");
}

const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/gu;
const wanted = new Map(); // d.ts -> Set(names)
for (const f of walk(join(ROOT, "packages/web"))) {
  for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
    const dts = target(m[3], f);
    if (dts === null) continue;
    for (const raw of m[2].split(",")) {
      const part = raw.trim();
      if (part === "") continue;
      const isType = m[1] !== undefined || part.startsWith("type ");
      if (!isType) continue;
      const name = part.replace(/^type\s+/u, "").split(/\s+as\s+/u)[0].trim();
      if (!wanted.has(dts)) wanted.set(dts, new Set());
      wanted.get(dts).add(name);
    }
  }
}

// The values whose INFERRED type is wrong rather than weak, each with what it is in viafrei's source.
// Inference reads an object of object literals as the union of their shapes, so a field only some
// rows carry (`conditionNote`) is "not on the type"; a function whose JSDoc names no parameter type
// gets the narrowest type of its one call site. Each is re-declared as what its source declares,
// as loosely as the consumers need, and the count is printed. A name that is not found refuses.
const OVERRIDES = {
  "mcp/dist/src/presentation/attribution.d.ts": { ATTRIBUTION: "Record<string, any>" /* Record<string, AttributionRow> */ },
  "ingest/dist/analysis/motorway-ampel.d.ts": { boundedReasons: "(...args: any[]) => any" },
  "digest/dist/src/presentation/place-first-html.d.ts": { placeFirstHtml: "(...args: any[]) => any" },
};
/** The end (exclusive) of the declaration starting at `i`: a namespace's block, else the `;` at bracket depth 0. */
function declEnd(text, i) {
  const isNs = /^export (declare )?namespace /u.test(text.slice(i, i + 40));
  let depth = 0;
  for (let k = i; k < text.length; k++) {
    const c = text[k];
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") { depth--; if (isNs && depth === 0 && c === "}") return k + 1; }
    else if (c === ";" && depth === 0 && !isNs) return k + 1;
  }
  return -1;
}
let overridden = 0;
for (const [rel, names] of Object.entries(OVERRIDES)) {
  const f = join(PINNED, rel);
  let text = readFileSync(f, "utf8");
  for (const [name, type] of Object.entries(names)) {
    const re = new RegExp(`^export (declare )?(const|function|namespace) ${name}\\b`, "gmu");
    const starts = [...text.matchAll(re)].map((m) => m.index);
    if (starts.length === 0) { console.error(`✗ pinned-types: ${rel} declares no ${name} (the override is stale)`); process.exit(2); }
    for (const i of starts.reverse()) {
      const end = declEnd(text, i);
      if (end < 0) { console.error(`✗ pinned-types: the declaration of ${name} in ${rel} does not end`); process.exit(2); }
      text = text.slice(0, i) + (i === starts[0] ? `export declare const ${name}: ${type}; // pinned-types.mjs (viafrei-web#2)` : "") + text.slice(end);
    }
    overridden++;
  }
  writeFileSync(f, text);
}
console.log(`  pinned-types: ${String(overridden)} inferred declaration(s) re-declared as their source declares them`);

const files = [...wanted.keys()];
const program = ts.createProgram(files, { allowJs: false, noEmit: true, skipLibCheck: true, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022 });
const checker = program.getTypeChecker();
let stubbed = 0;
for (const [dts, names] of wanted) {
  const sf = program.getSourceFile(dts);
  if (sf === undefined) { console.error(`✗ pinned-types: ${dts} does not exist`); process.exit(2); }
  const sym = checker.getSymbolAtLocation(sf);
  const have = new Set(sym === undefined ? [] : checker.getExportsOfModule(sym).map((s) => s.getName()));
  const missing = [...names].filter((n) => !have.has(n)).sort();
  if (missing.length === 0) continue;
  // Each of these is an `any` until viafrei-app ships its own .d.ts
  // (docs/moved-from-viafrei.md): a type-only export the image's JavaScript cannot carry.
  appendFileSync(dts, `\n// pinned-types.mjs (viafrei-web#2): a type-only export the image's JavaScript cannot carry\n${missing.map((n) => `export type ${n} = any;`).join("\n")}\n`);
  stubbed += missing.length;
}
console.log(`  pinned-types: ${String(stubbed)} type-only name(s) stubbed as any across ${String(files.length)} declaration file(s) imported`);
