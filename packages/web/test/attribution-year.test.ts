/**
 * #804: the site's copy of the year rule is the register's rule — held equal
 * to `@viafrei/ingest`'s `datedAttribution` on both sides of the Berlin New
 * Year — and the credits the site prints say the reader's year.
 */
import { RETRIEVAL_YEAR as INGEST_TOKEN, datedAttribution } from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { creditHtml } from "../src/lib/answer-html.js";
import register from "../src/generated/register.json" with { type: "json" };
import { RETRIEVAL_YEAR, datedCredit, shownCredits } from "../src/site/attribution-year.js";

const GEONUTZV = ["mobilithek_roadworks_ald_th", "mobilithek_traffic_ruesselsheim", "mobilithek_roadworks_bayern", "mobilithek_roadworks_mv", "mobilithek_los_nrw", "mobilithek_truckpark_static_geonutzv"] as const;
const EDGES = ["2026-12-31T22:59:59Z", "2026-12-31T23:00:00Z", "2026-12-31T23:30:00Z", "2027-06-30T22:30:00Z", "2027-12-31T23:00:00Z"].map((s) => new Date(s));

describe("the year of retrieval on the site (#804)", () => {
  it("is the same rule as the register's, token and year, at every edge", () => {
    expect(RETRIEVAL_YEAR).toBe(INGEST_TOKEN);
    for (const c of catalogue.credits) for (const now of EDGES) expect(datedCredit(c.text, now), `${c.id} ${now.toISOString()}`).toBe(datedAttribution(c.text, now));
  });

  it("the three Aachen credits carry the token in the catalogue and print the Berlin year", () => {
    const aachen = catalogue.credits.filter((c) => c.id.startsWith("aachen_"));
    expect(aachen.map((c) => c.id).sort()).toEqual(["aachen_baustellen", "aachen_fussgaengerzonen", "aachen_umweltzone"]);
    for (const c of aachen) {
      expect(c.text).toContain(`Stadt Aachen (${RETRIEVAL_YEAR})`);
      expect(creditHtml(c, "de", false, new Date("2026-12-31T22:59:00Z"))).toContain("Stadt Aachen (2026)");
      expect(creditHtml(c, "en", false, new Date("2026-12-31T23:00:00Z"))).toContain("Stadt Aachen (2027)");
      expect(creditHtml(c, "tr", false, new Date("2026-12-31T23:30:00Z"))).toContain("Stadt Aachen (2027)");
      expect(creditHtml(c, "de", false, new Date("2026-12-31T23:30:00Z"))).not.toContain("{Jahr}");
    }
  });

  it("2.2.6: the six GeoNutzV credits carry the token and print the Berlin year", () => {
    for (const id of GEONUTZV) {
      const c = catalogue.credits.find((x) => x.id === id);
      expect(c, id).toBeDefined();
      expect(c!.text, id).toContain(`${RETRIEVAL_YEAR} — GeoNutzV`);
      expect(creditHtml(c!, "de", false, new Date("2026-12-31T22:59:00Z")), id).toMatch(/ 2026 — GeoNutzV/u);
      expect(creditHtml(c!, "en", false, new Date("2026-12-31T23:00:00Z")), id).toMatch(/ 2027 — GeoNutzV/u);
      expect(creditHtml(c!, "en", false, new Date("2026-12-31T23:00:00Z")), id).not.toContain(RETRIEVAL_YEAR);
    }
  });

  it("2.2.6: the sources block finds a dated line on the tiles and prints it dated — never the token, never dropped", () => {
    const truck = register.sources.mobilithek_truckpark_static_geonutzv;
    expect(truck.attribution).toContain(RETRIEVAL_YEAR);
    const now = new Date("2026-12-31T23:00:00Z");
    const tileHtml = `<p class="credit">${datedCredit(truck.attribution, now)}</p>`;
    const lines = shownCredits(Object.values(register.sources), tileHtml, now);
    expect(lines.map((l) => l.attribution)).toEqual([truck.attribution.replace(RETRIEVAL_YEAR, "2027")]);
    expect(shownCredits(Object.values(register.sources), "<p>nothing</p>", now)).toEqual([]);
  });
});
