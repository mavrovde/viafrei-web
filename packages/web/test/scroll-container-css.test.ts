/**
 * 2.5.8: a horizontal scroll container must be positioned. A `.visually-hidden` span (position: absolute) inside an
 * `overflow-x: auto` box that is not positioned escapes its clipping and widens the whole page — the station page at
 * 390 px was 477 px wide because the departures table's hidden labels reached past `.stpage__scroll`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STYLES = join(import.meta.dirname, "..", "src", "styles");
// A <dialog> is in the top layer and is its own containing block; it needs no position of its own.
const EXEMPT = new Set([".sheet"]);

function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1]!.trim(), body: m[2]! });
  return out;
}

describe("every horizontal scroll container in the shell's stylesheets is positioned", () => {
  const found = readdirSync(STYLES)
    .filter((f) => f.endsWith(".css"))
    .flatMap((f) => rules(readFileSync(join(STYLES, f), "utf8")).map((r) => ({ file: f, ...r })))
    .filter((r) => /(^|;|\s)overflow(-x)?\s*:\s*(auto|scroll)/.test(r.body) && !EXEMPT.has(r.selector));

  it("reads at least the four known containers", () => {
    expect(found.map((r) => r.selector)).toEqual(expect.arrayContaining([".stpage__scroll", ".fuelst__wrap", ".client pre", ".endpoint pre"]));
  });

  it("each sets position: relative (or another containing position)", () => {
    const bare = found.filter((r) => !/(^|;|\s)position\s*:\s*(relative|absolute|fixed|sticky)/.test(r.body)).map((r) => `${r.file}: ${r.selector}`);
    expect(bare).toEqual([]);
  });
});

describe("the status block holds a sideways row (#1176)", () => {
  it("its one grid column may shrink, or the jump row's width becomes the page's", () => {
    expect(readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8")).toMatch(/\.pagefirst \{[^}]*grid-template-columns: minmax\(0, 1fr\)/u);
  });
});
