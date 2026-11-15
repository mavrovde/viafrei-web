/**
 * #748 (owner 2026-10-14/15): the modern road-sign layer may not change a corner radius or drop the identity. The
 * radius tokens and the sign's own 12 px are pinned here at the values they had before #748, and the layer itself
 * may set no radius but through those tokens; its colours are existing tokens (the contrast gate,
 * scripts/web-contrast.mjs, judges every pair, the two the bubbles rely on included).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(join(WEB, "..", "design", "tokens.css"), "utf8");
const css = readFileSync(join(WEB, "src", "styles", "site.css"), "utf8");
const layer = css.slice(css.lastIndexOf("/*", css.indexOf("#748 (owner 2026-10-14/15): the modern road-sign layer")));

describe("the modern road-sign layer (#748)", () => {
  it("keeps every corner radius exactly as it was", () => {
    expect(tokens).toMatch(/--r-sm: 6px;/);
    expect(tokens).toMatch(/--r: 14px;/);
    expect(tokens).toMatch(/--r-pill: 999px;/);
    // the Wegweiser's own plate and the shields
    expect(css).toMatch(/\.sign__panel \{[^}]*border-radius: 12px;/);
    expect(css).toMatch(/\.shield \{[^}]*border-radius: 6px;/);
  });

  it("sets no radius but through the radius tokens, and no colour literal", () => {
    expect(layer.length).toBeGreaterThan(2000);
    for (const m of layer.matchAll(/border-radius:\s*([^;]+);/g)) expect(m[1], m[0]).toMatch(/^var\(--r(-sm|-pill)?\)$/);
    expect(layer.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("sets no colour function outside a var( and no named colour — every colour of the layer is a token", () => {
    const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "");
    /** An rgb()/rgba()/hsl()/hsla() call that is not the fallback inside a var(--token, …). */
    const FN = /(?<!var\(--[\w-]+,\s*)\b(?:rgba?|hsla?)\(/i;
    /** A named colour as a declaration value (a property name such as white-space is before the colon, not after it). */
    const NAMED = /:[^;{}]*\b(?:white|black|red|blue|green|yellow|orange|gray|grey|silver|navy|maroon|purple|teal|aqua|fuchsia|lime|olive|pink|brown)\b/i;
    expect(code(layer)).not.toMatch(FN);
    expect(code(layer)).not.toMatch(NAMED);
    // the checks can say no (mutants, run inline), and a token's own fallback or a property name is not a finding
    for (const bad of [".x { color: rgba(0, 0, 0, 0.5); }", ".x { box-shadow: 0 1px 2px hsl(210 20% 10%); }", ".x { border-color: white; }", ".x { background: 0 0 / cover navy; }"])
      expect(code(bad), bad).toMatch(new RegExp(`${FN.source}|${NAMED.source}`, "i"));
    for (const ok of [".x { white-space: nowrap; }", ".x { color: var(--fg, rgb(0 0 0)); }", "/* the sign blue */ .x { color: var(--sign-bg); }"]) {
      expect(code(ok), ok).not.toMatch(FN);
      expect(code(ok), ok).not.toMatch(NAMED);
    }
  });

  it("declares the two contrast pairs the bubbles rely on, and the elevation in the one shadow colour", () => {
    expect(tokens).toContain("/* @contrast --fg-muted on --accent-soft */");
    expect(tokens).toContain("/* @contrast --accent on --accent-soft */");
    expect(tokens).toMatch(/--elev-1: [^;]*var\(--shadow\)/);
    expect(tokens).toMatch(/--elev-2: [^;]*var\(--shadow\)/);
  });

  it("keeps the quotation marks of a <q>: no tail is drawn on a q's own pseudo-elements", () => {
    expect(layer).not.toMatch(/pcard__q::(before|after)/);
  });

  it("draws no tail and no lift in print or forced colours", () => {
    expect(layer).toMatch(/@media print \{[\s\S]*box-shadow: none !important;/);
    expect(layer).toMatch(/@media \(forced-colors: active\) \{[\s\S]*display: none;/);
  });
});
