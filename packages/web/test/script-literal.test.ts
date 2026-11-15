/**
 * viafrei-web PR #15 (CodeQL js/bad-code-sanitization): a string written into an inline script goes through
 * `scriptLiteral`, which cannot close the script element around it and parses back to the same string — and which
 * is byte for byte `JSON.stringify` for a string without `<`, `>`, U+2028 or U+2029, so no script the shell writes
 * today changes.
 */
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { scriptLiteral } from "../src/lib/script-literal.js";

describe("PR #15: scriptLiteral", () => {
  it("is JSON.stringify for a string without the four characters", () => {
    for (const s of ["", "/sw.js", "vf-star", "/fragment/commute", "de", 'a"b\\c\n\t', "Köln — ü"]) expect(scriptLiteral(s)).toBe(JSON.stringify(s));
  });
  it("cannot end or comment out the script element, nor break a line", () => {
    const s = "</script><!--<script>\u2028\u2029";
    const lit = scriptLiteral(s);
    expect(lit).not.toMatch(/[<>\u2028\u2029]/u);
    expect(JSON.parse(lit)).toBe(s);
    expect(runInNewContext(lit)).toBe(s);
  });
});
