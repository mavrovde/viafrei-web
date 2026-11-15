/**
 * Layout rules every language needs (#380): no `text-transform` (German nouns,
 * Turkish dotted i), `hyphens: auto` on running text, and no fixed `height:` on
 * a text container — a longer translation must be able to grow. Read from the
 * stylesheets the bundle is built from; a stylesheet that is empty or missing
 * is a refusal, not a pass.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "styles");
// The tokens live in the shared design package since #560 §1 (the status
// console reads the same file); the site's own stylesheet stays here.
const TOKENS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "design", "tokens.css");
const css = [TOKENS, join(STYLES, "site.css")].map((f) => readFileSync(f, "utf8")).join("\n");
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));

describe("layout rules (#380)", () => {
  it("read a real stylesheet", () => {
    expect(rules.length).toBeGreaterThan(100);
  });
  it("no text-transform anywhere", () => {
    expect(css).not.toMatch(/text-transform\s*:/);
  });
  it("running text hyphenates", () => {
    expect(rules.some((r) => /(^|,)\s*(body|html)\b/.test(r.sel) && /hyphens:\s*auto/.test(r.body))).toBe(true);
  });
  it("no fixed height on a text container (headings, paragraphs, list items, cards, asks, legal)", () => {
    const text = /(^|[\s,>])(h[1-6]|p|li|\.card|\.ask|\.lead|\.legal|\.client)(\b|$)/;
    // a ::before/::after badge (the step number) is a box, not text that can grow
    const bad = rules.filter((r) => !/::(before|after)/.test(r.sel) && text.test(r.sel) && /(^|;)\s*height\s*:/.test(r.body)).map((r) => r.sel);
    expect(bad).toEqual([]);
  });
});
