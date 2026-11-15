/**
 * Review N2 (2.3.23): the lamp dot beside a row's state word (`mw-lamp--<lamp>`) appears on the road page's crossings
 * card AND on the place page's Autobahn and Nachbarorte cards — so its rules live in the stylesheet every page loads
 * (`site.css`, through `Base.astro`), never only in the road page's inline rules.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STYLES = join(import.meta.dirname, "..", "src", "styles");
const site = readFileSync(join(STYLES, "site.css"), "utf8");
const road = readFileSync(join(STYLES, "motorway-page.css"), "utf8");
const base = readFileSync(join(import.meta.dirname, "..", "src", "layouts", "Base.astro"), "utf8");

describe("review N2: the lamp dot is styled on every page that shows it", () => {
  it("site.css (loaded by Base on every page) holds the dot and each colour; the road page's own rules hold none", () => {
    expect(base).toMatch(/import "\.\.\/styles\/site\.css";/);
    for (const sel of [".mw-lamp {", ".mw-lamp__dot {", ".mw-lamp--red .mw-lamp__dot", ".mw-lamp--yellow .mw-lamp__dot", ".mw-lamp--green .mw-lamp__dot"]) {
      expect(site, sel).toContain(sel);
    }
    expect(site).toMatch(/\.mw-lamp__dot \{[^}]*display: inline-block[^}]*background: var\(--lamp-off\)/);
    expect(road).not.toContain(".mw-lamp");
  });
});
