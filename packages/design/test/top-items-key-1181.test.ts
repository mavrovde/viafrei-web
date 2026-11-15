/**
 * #1181 feature 3: a first-block row carries its identity across visits and its length, for the "since your last
 * visit" marks of a starred page; a row given neither carries no attribute, so every other page's bytes are unchanged.
 */
import { describe, expect, it } from "vitest";
import { raw } from "../src/html.js";
import { topItems } from "../src/page-head.js";
import { all } from "../src/testing/index.js";

describe("topItems: data-vf-key and data-vf-len (#1181 feature 3)", () => {
  it("writes the key escaped and the length rounded; none without a key", () => {
    const html = String(
      topItems(
        [
          { severity: "jam", what: raw("Stau"), where: raw("Köln"), key: 'jam|A3 | "Köln"|N', length: 12.4 },
          { severity: "closure", what: raw("Sperrung"), where: raw("Kamen"), key: "closure|B|S", length: null },
          { severity: "roadworks", what: raw("Baustelle"), where: raw("Hilden") },
        ],
        raw("Lage"),
      ),
    );
    const row = (sev: string) => all(html, `li.topitems__row--${sev}`).map((r) => [r.attrs["data-vf-key"], r.attrs["data-vf-len"]])[0];
    expect(["jam", "closure", "roadworks"].map(row)).toEqual([
      ['jam|A3 | "Köln"|N', "12"],
      ["closure|B|S", undefined],
      [undefined, undefined],
    ]);
    expect(html).not.toContain('"Köln"|N"');
  });
});
