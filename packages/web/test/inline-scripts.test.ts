/**
 * #1064: the page's inline scripts ship minified (`scripts/inline-min.ts` →
 * `src/generated/inline-scripts.json`). This is the drift test: the committed
 * file must be exactly what the minifier prints from today's sources, so a
 * source edited without regenerating is red here, never a page running the old
 * script. `VF_INLINE_WRITE=1` (`npm run web:inline`) writes the file instead.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { inlineFile, inlineSources, minifyInline } from "../scripts/inline-min.js";
import { INLINE_SCRIPTS, INLINE_SCRIPT_NAMES } from "../src/lib/inline-scripts.js";
import { islandScript } from "../src/location/island.js";
import { freshAgesScript, motorwayFilterScript } from "../src/lib/motorway-filter.js";

const FILE = new URL("../src/generated/inline-scripts.json", import.meta.url);

describe("#1064: the inline scripts ship minified, and the file is today's sources", () => {
  it("the generated file equals the minifier's output over the sources (npm run web:inline)", () => {
    const want = inlineFile();
    if (process.env["VF_INLINE_WRITE"] === "1") writeFileSync(FILE, want);
    expect(readFileSync(FILE, "utf8")).toBe(want);
  });

  it("every script is there, is one function expression that parses, and is smaller than its source", () => {
    const src = inlineSources();
    expect(Object.keys(INLINE_SCRIPTS).sort()).toEqual([...INLINE_SCRIPT_NAMES].sort());
    for (const k of INLINE_SCRIPT_NAMES) {
      const min = INLINE_SCRIPTS[k];
      expect(min, k).toMatch(/^\(?(?:async\s+)?function\b/);
      expect(() => new Script(`(${min})`), k).not.toThrow();
      expect(min.length, k).toBeLessThan(src[k].length * 0.8);
      // nothing the minifier could have introduced that the sources never used, nor a helper the page lacks
      expect(min, k).not.toMatch(/\|\|=|&&=|\?\?=|(^|[^\w$])__name\(|\bimport\b|\brequire\(|<\/script/);
    }
  });

  it("the minifier keeps every string the scripts carry — storage keys, events, selectors", () => {
    const keep: Readonly<Record<string, readonly string[]>> = {
      island: ["viafrei.place", "vf:pos", "/fragment/motorway-around"],
      filter: [".mwf__save", "vf:main", "#mw-cards > .mwk, #mw-quiet > .mwk, #mw-ref > .mwk", "localStorage"],
      ages: [".fresh__t", "vf:loaded"],
      pager: ["data-more", ".pcard__morebody", "vf-pager-live", "aria-live", "data-refreshed", "data-loaded"],
      // #1188: the slot's id arrives as `C.slot` (`topicsScript`), so only its property is the script's
      topics: ["tpf", ".slot", "tpf-alerts", "tpf-nothing", "popstate", "pushState", "pcard--attention", "localStorage"],
    };
    for (const [k, xs] of Object.entries(keep)) for (const x of xs) expect(INLINE_SCRIPTS[k as keyof typeof INLINE_SCRIPTS], `${k}: ${x}`).toContain(x);
  });

  it("the page's three printers call the minified text with their configuration", () => {
    expect(islandScript({ lang: "de", server: { source: "none", at: null, label: null }, labels: {} as never, cell: { lat: 0, lon: 0 } }).startsWith(`(${INLINE_SCRIPTS.island})(window, {`)).toBe(true);
    expect(motorwayFilterScript("de").startsWith(`(${INLINE_SCRIPTS.filter})({"lang":"de-DE"`)).toBe(true);
    expect(freshAgesScript("en").startsWith(`(${INLINE_SCRIPTS.ages})({"lang":"en`)).toBe(true);
    expect(freshAgesScript("en").endsWith('"});')).toBe(true);
  });

  it("a source that changed is a different file (the drift test can say no)", () => {
    const src = inlineSources();
    expect(minifyInline(src.ages.replace("30000", "31000"))).not.toBe(INLINE_SCRIPTS.ages);
  });
});
