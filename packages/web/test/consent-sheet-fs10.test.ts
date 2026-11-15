/**
 * Data-steward ruling FS-2026-11-06, addendum FS10: the consent sheet. (i) of FS10g — `sheet` is false with Clarity
 * configured and when the dialog says the current state (FS10f) — and the stylesheet's "more text" cue (FS10a), which
 * is a shape (a dashed cut line) and not a colour alone. The e2e half is `e2e/consent-sheet-fs10.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isConsentSheet } from "../src/analytics/consent-store.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (p: string): string => readFileSync(join(SRC, p), "utf8");

describe("FS10f: the sheet is the Google-only bar opened by itself, nothing else", () => {
  it("is the sheet with neither Clarity nor a state sentence", () => {
    expect(isConsentSheet({ clarity: undefined, stateText: undefined })).toBe(true);
  });
  it("is not the sheet when Clarity is configured", () => {
    expect(isConsentSheet({ clarity: "abc123", stateText: undefined })).toBe(false);
  });
  it("is not the sheet when the dialog says the current state", () => {
    expect(isConsentSheet({ clarity: undefined, stateText: "Sie haben am 1. 11. 2026 abgelehnt." })).toBe(false);
    expect(isConsentSheet({ clarity: "abc123", stateText: "x" })).toBe(false);
  });
  it("the bar decides by that predicate, and the settings dialog never asks for the sheet", () => {
    expect(read("components/Consent.svelte")).toContain("sheet={isConsentSheet({ clarity, stateText })}");
    expect(read("components/ConsentSettings.svelte")).not.toMatch(/\ssheet[=\s{]/u);
  });
});

describe("FS10a: the cue is in the stylesheet, a shape and not a colour alone", () => {
  const css = read("styles/site.css");
  it("a sticky end of the box with a dashed cut line, inside the phone rule", () => {
    const phone = css.slice(css.indexOf(".consent.consent--sheet {"));
    const rule = /\.consent--sheet \.consent__text::after \{([^}]*)\}/u.exec(phone)?.[1] ?? "";
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("bottom: 0");
    expect(rule).toMatch(/border-bottom: 1px dashed /u);
    expect(rule).toContain("linear-gradient");
  });
});
