/**
 * #922 D1: every class a building block emits (`C`) is a contract with the
 * site's stylesheet, so each has at least one rule in
 * `packages/web/src/styles/site.css`, read here as the file the shell ships.
 * Removing a rule turns this red, naming the class. Every `HOOK` is held
 * unstyled, so a hook that gains a rule moves to `C` rather than staying
 * under a name that says nobody styles it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { C, HOOK } from "../src/classes.js";

const SITE_CSS = join(dirname(fileURLToPath(import.meta.url)), "../../web/src/styles/site.css");

/** Every class a stylesheet's selectors name (comments and strings skipped; a declaration's value names none). */
export function styledClasses(css: string): ReadonlySet<string> {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"|'[^']*'/g, '""');
  const out = new Set<string>();
  // a selector is what precedes a `{`; declarations sit between `{` and `}`
  for (const m of code.matchAll(/([^{}]+)\{/g)) for (const c of m[1]!.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(c[1]!);
  return out;
}

/** The classes of `want` with no rule in `css`. */
export const unstyled = (css: string, want: readonly string[]): readonly string[] => {
  const have = styledClasses(css);
  return want.filter((c) => !have.has(c));
};

describe("#922 D1: every building-block class has a rule in site.css", () => {
  const css = readFileSync(SITE_CSS, "utf8");

  it("reads the stylesheet the shell ships (a sweep over nothing would pass)", () => {
    expect(styledClasses(css).size).toBeGreaterThan(300);
  });

  it("every value of C is styled", () => {
    expect(unstyled(css, Object.values(C))).toEqual([]);
  });

  it("every HOOK is unstyled, as its name says", () => {
    const have = styledClasses(css);
    expect(Object.values(HOOK).filter((h) => have.has(h))).toEqual([]);
  });

  it("removing a rule turns it red, naming the class", () => {
    const without = css.replace(/(^|\n)[^{}\n]*\.tile__note[^{}]*\{[^}]*\}/g, "\n");
    expect(unstyled(without, Object.values(C))).toEqual(["tile__note"]);
    // and a class only inside a comment or a declaration value is no rule
    expect(unstyled("/* .age { } */ .x { content: '.age'; }", ["age"])).toEqual(["age"]);
  });
});
