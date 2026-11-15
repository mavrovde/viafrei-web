import { readFileSync } from "node:fs";
import { LICENCE_CATALOGUE } from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import { REGISTER_COPY_PATH, TILE_SOURCE_IDS, buildRegister } from "../scripts/generate-register.js";

/**
 * `src/generated/register.json` is a CACHE of the register and never a second
 * register (#377 D4 rule 10). This test is what makes that sentence true: the
 * committed file must equal, byte for byte after parsing, what the generator
 * produces from `LICENCE_CATALOGUE` today.
 */
describe("the generated register copy", () => {
  const onDisk: unknown = JSON.parse(readFileSync(REGISTER_COPY_PATH, "utf8"));
  const fresh = buildRegister();

  it("equals what the generator produces from the register right now", () => {
    expect(onDisk).toEqual(fresh);
  });

  it("carries one linked, verbatim line per tile source and the MTS-K note", () => {
    expect(Object.keys(fresh.sources).sort()).toEqual([...TILE_SOURCE_IDS].sort());
    for (const id of TILE_SOURCE_IDS) {
      const facts = LICENCE_CATALOGUE[id];
      expect(fresh.sources[id]?.attribution).toBe(facts?.attribution);
      expect(fresh.sources[id]?.url).toBe(facts?.url);
      expect(fresh.sources[id]?.url).toMatch(/^https:\/\//);
    }
    expect(fresh.mtskNote).toMatch(/^Hinweis zu den Kraftstoffpreisdaten \(MTS-K\)/);
  });

  it("includes no source whose register row has no approved line", () => {
    for (const [id, facts] of Object.entries(LICENCE_CATALOGUE)) {
      if (facts.attribution === null) expect(fresh.sources[id], id).toBeUndefined();
    }
  });
});
