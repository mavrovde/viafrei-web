/**
 * #1175 AC 6: a station's title and description in every state and language: the lamp's claim from the block's own markup,
 * within the limits, and a quiet station keeps its search phrase. #1310 B2: the description is evergreen in every state.
 */
import { describe, expect, it } from "vitest";
import { stationNowOf } from "../src/lib/place-head.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { DESCRIPTION_MAX, TITLE_FIT, stationMeta } from "../src/site/meta.js";
import { DESCRIPTION_MIN } from "@viafrei/design";

/** The status block as the digest writes it: the classes the head reads. */
const block = (lamp: "green" | "amber" | "unknown", sentence: string): string => `<div id="page-first"><p class="statusline statusline--${lamp}" id="station-status">${sentence}</p></div>`;

describe("the head of a station page (#1175 AC 6)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: quiet and reported, within the limits`, () => {
      const plain = stationMeta("Köln Hbf", lang, "Köln");
      const quiet = stationMeta("Köln Hbf", lang, "Köln", stationNowOf(block("green", "Derzeit nichts gemeldet")));
      const out = stationMeta("Köln Hbf", lang, "Köln", stationNowOf(block("amber", "Aufzüge außer Betrieb: 2")));
      expect(quiet.title).toBe(plain.title);
      expect(out.title).not.toBe(plain.title);
      expect(out.description).not.toContain("Aufzüge außer Betrieb");
      expect(out.description).toBe(plain.description);
      expect(quiet.description).toBe(plain.description);
      for (const m of [plain, quiet, out]) {
        expect(m.title.length, m.title).toBeLessThanOrEqual(TITLE_FIT);
        expect(m.description.length, m.description).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(m.description.length, m.description).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      }
    });
  }
  it("a read that failed claims nothing", () => {
    expect(stationNowOf(block("unknown", "Nicht abrufbar"))).toBeNull();
    expect(stationNowOf(null)).toBeNull();
  });
});
