import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RENDERED_STATES, TILE_STATES, stateClass } from "@viafrei/design";
import { agoWords, figure, freshness, price } from "../src/components/tile-contract.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|astro|svelte|css)$/.test(name)) out.push(p);
  }
  return out;
}

describe("the tile contract (src/components/tile-contract.ts)", () => {
  it("defines five states and renders four — loading is never emitted in 1.6", () => {
    expect([...TILE_STATES]).toEqual(["ok", "stale", "empty", "error", "loading"]);
    expect([...RENDERED_STATES]).toEqual(["ok", "stale", "empty", "error"]);
    for (const s of RENDERED_STATES) expect(stateClass(s)).toBe(`is-${s}`);
    // @ts-expect-error — loading is not a rendered state, and the runtime agrees
    expect(() => stateClass("loading")).toThrow(/not a rendered state/);
  });

  it("writes `is-loading` only where the placeholder is printed (lib/fill.ts) and styled (site.css) — #564", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(10);
    const writers = files.filter((f) => /is-loading/.test(readFileSync(f, "utf8")) && !f.endsWith("tile-contract.ts")).map((f) => f.slice(SRC.length + 1));
    expect(writers.sort()).toEqual(["lib/fill.ts", "styles/site.css"]);
    for (const f of files) {
      if (f.endsWith("tile-contract.ts") || f.endsWith("fill.ts") || f.endsWith("site.css")) continue; // the definition, the placeholder and its style
      expect(readFileSync(f, "utf8"), f).not.toMatch(/is-loading/);
    }
  });

  it("keeps the figure on a stale tile: ok within 3 cadences, stale after, empty when never seen", () => {
    expect(freshness(100, 60)).toBe("ok");
    expect(freshness(180, 60)).toBe("ok");
    expect(freshness(181, 60)).toBe("stale");
    expect(freshness(null, 60)).toBe("empty");
  });

  it("says an age the way a person does, in both languages", () => {
    expect(agoWords(20, "de")).toBe("gerade eben");
    expect(agoWords(20, "en")).toBe("just now");
    expect(agoWords(95, "de")).toBe("2 min");
    expect(agoWords(7800, "en")).toBe("2 h 10 min");
    expect(agoWords(3600, "de")).toBe("1 h");
    expect(agoWords(86400 * 3, "de")).toBe("3 Tagen");
    expect(agoWords(86400, "en")).toBe("1 day");
  });

  it("formats a figure with the language's thousands separator and never rounds to a cap", () => {
    expect(figure(61804, "de")).toBe("61.804");
    expect(figure(61804, "en")).toBe("61,804");
    expect(figure(5001, "de")).toBe("5.001");
  });

  it("formats a price with three decimals, the MTS-K's own precision", () => {
    expect(price(1.589, "de")).toBe("1,589");
    expect(price(1.6, "en")).toBe("1.600");
  });
});
