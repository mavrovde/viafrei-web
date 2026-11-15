/**
 * #799 C14: the city car parks are the parking moment's second tile, after the
 * lorry tile, and both are embedded with a title in every language. The
 * browser half (both tiles on the built home from the real digest) is
 * `e2e/tiles.e2e.ts`.
 */
import { describe, expect, it } from "vitest";
import { EMBEDDED_TILES } from "../src/lib/tiles.js";
import { MOMENTS } from "../src/site/examples.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";

describe("the parking moment carries two tiles (#799)", () => {
  it("is the lorry tile first and the city car-park tile second", () => {
    const parking = MOMENTS.find((m) => m.key === "parking");
    expect(parking?.tile).toBe("lorry");
    expect(parking?.extra).toBe("carparks");
  });

  it("is the only moment that carries the car-park tile, and the shell fetches it", () => {
    expect(MOMENTS.filter((m) => m.tile === "carparks" || m.extra === "carparks").map((m) => m.key)).toEqual(["parking"]);
    expect(EMBEDDED_TILES).toContain("carparks");
  });

  it("titles both tiles in every language, and never with the same words", () => {
    for (const lang of LIVE_LANGS) {
      const lorry = t(lang, "tiles.lorry");
      const cars = t(lang, "tiles.carparks");
      expect(cars, lang).not.toBe("");
      expect(cars, lang).not.toBe("tiles.carparks");
      expect(cars, lang).not.toBe(lorry);
    }
  });
});
