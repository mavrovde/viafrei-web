/**
 * #922 D2: a `class="…"` literal in the runtime code of the digest, the
 * status page or the site shell names either a member of the shared
 * vocabulary — `C`, `HOOK`, a tile state's class — or a class on
 * `class-vocabulary.allow.txt`. The list is the vocabulary as measured when
 * the lint was introduced (2.3.19): 669 names the three packages write for
 * their own pages, against 21 in `C`, so it is a BASELINE and not yet the
 * "one-off layout classes" the issue imagines — moving a family into `C` (and
 * so under `css-coverage.test.ts`) shortens it. As a ratchet it is an error in
 * both directions: a new class outside `C` fails until it is added to `C` or
 * listed, and a listed class no runtime file writes any more fails as stale.
 *
 * What it reads, said rather than implied: the double-quoted `class="…"`
 * literals of tracked and untracked `.ts`, `.astro` and `.svelte` files
 * under each package's `src/`, tests and goldens excluded; a token holding
 * an interpolation (`${…}`, `{…}`) is not a name and is skipped. A class
 * built in code (`C.tile`, `stateClass(s)`, Astro's `class:list`) is not a
 * literal and is not read — the first two are the vocabulary by
 * construction.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { C, HOOK, TILE_STATES } from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
// viafrei-web#2: the site is the one consumer here; the digest and the status console are swept in viafrei
const SCOPES = ["packages/web/src"] as const;
const RUNTIME = /\.(ts|astro|svelte)$/;
const NOT_RUNTIME = /\.test\.ts$|\/__golden__\//;
const CLASS_ATTR = /class="([^"]*)"/g;
const NAME = /^-?[A-Za-z_][\w-]*$/;

/** The shared vocabulary: what `@viafrei/design` names. */
export const SHARED: ReadonlySet<string> = new Set([...Object.values(C), ...Object.values(HOOK), ...TILE_STATES.map((s) => `is-${s}`)]);

/** The class names written as literals in `text`, interpolations skipped. */
export function classLiterals(text: string): readonly string[] {
  // a regex source or a ternary inside an interpolation leaves fragments (`(?:tile--`, `===`): only a class name's shape counts
  return [...text.matchAll(CLASS_ATTR)].flatMap((m) => (m[1] ?? "").split(/\s+/)).filter((t) => NAME.test(t));
}

function runtimeFiles(): readonly string[] {
  const out = execFileSync("git", ["-c", "color.ui=false", "ls-files", "-co", "--exclude-standard", "--", ...SCOPES], { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter((f) => RUNTIME.test(f) && !NOT_RUNTIME.test(f));
}

/** Every class written outside the shared vocabulary, with the first file that writes it. */
function outside(): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  for (const f of runtimeFiles()) for (const c of classLiterals(readFileSync(join(ROOT, f), "utf8"))) if (!SHARED.has(c) && !m.has(c)) m.set(c, f);
  return m;
}

const allowed = (): ReadonlySet<string> =>
  new Set(
    readFileSync(join(HERE, "class-vocabulary.allow.txt"), "utf8")
      .split("\n")
      .filter((l) => l !== "" && !l.startsWith("#")),
  );

describe("#922 D2: runtime class literals are the shared vocabulary or listed", () => {
  it("reads the three packages' runtime files (a sweep over nothing reports clean)", () => {
    const files = runtimeFiles();
    for (const scope of SCOPES) expect(files.filter((f) => f.startsWith(scope)).length, scope).toBeGreaterThan(5);
  });

  it("every class outside C is listed, and every listed class is still written", () => {
    const found = outside();
    const list = allowed();
    const unlisted = [...found].filter(([c]) => !list.has(c)).map(([c, f]) => `${c}  (${f})`);
    const stale = [...list].filter((c) => !found.has(c));
    const shared = [...list].filter((c) => SHARED.has(c));
    expect({ unlisted, stale, shared }).toEqual({ unlisted: [], stale: [], shared: [] });
  });

  it("reads a literal as names, and skips what is not one (an interpolation, a regex source, a fragment of a ternary)", () => {
    expect(classLiterals('<p class="tile__note">x</p><span class="a  b">')).toEqual(["tile__note", "a", "b"]);
    expect(classLiterals('`<li class="pcard pcard--${v}">` <div class={x}>')).toEqual(["pcard"]);
    expect(classLiterals('/class="(?:tile--[a-z]+ )?is-(ok|stale)"/ `<b class="${on === 1 ? "x" : "y"}">`')).toEqual([]);
    expect(SHARED.has("tile__note") && SHARED.has("age__state") && SHARED.has("is-loading")).toBe(true);
  });
});
