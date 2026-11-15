/**
 * #716 F4a (2.1.16): the junction marker on a motorway map is a core INSIDE
 * the line, in the sign's text colour — 2.1.15 painted a page-coloured dot
 * wider than the line at every junction, so every motorway read as dashed.
 * The width half is pinned in the digest (`JUNCTION_W_U < LINE_W_U`); this is
 * the colour half, read from the stylesheet the site ships.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8");
const rule = (sel: string): string => new RegExp(`^\\${sel} \\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";

describe("the motorway map's line markers (F4a)", () => {
  it("a junction core is never the page's colour; the chain ends are capped in the line's", () => {
    expect(rule(".mw-junctions")).toContain("stroke: var(--on-sign)");
    expect(rule(".mw-junctions")).not.toMatch(/var\(--surface/);
    expect(rule(".mw-line")).toContain("stroke: var(--sign-bg)");
    expect(rule(".mw-ends")).toContain("stroke: var(--sign-bg)");
  });
});
