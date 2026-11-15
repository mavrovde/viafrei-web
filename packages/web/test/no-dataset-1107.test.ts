/**
 * #1107: Search Console reported the exit pages' nested `Dataset` invalid (no description). The root cause is the
 * type, not the missing field: a junction's or a station's page is not the canonical page of the LCL or of StaDa, so
 * the credit is a `CreativeWork` (what `isBasedOn` expects) and NO builder emits a `Dataset` on any page, in any
 * language. The credit's content (creditText, licence, creator, url) is unchanged — it must still match the visible line.
 */
import { describe, expect, it } from "vitest";
import { LCL_CREDIT } from "../src/site/lcl-credit.js";
import { motorwayExitPath } from "../src/site/motorways.js";
import { LIVE_LANGS, PAGE_IDS } from "../src/site/pages.js";
import { STADA_CREDIT, ZHV_CREDIT } from "../src/site/stada-credit.js";
import { exitJsonLd, motorwayJsonLd, pageJsonLd, placeJsonLd, sourceCredit, stationJsonLd, type StationJsonLdFacts } from "../src/site/structured-data.js";

/** Every `@type` anywhere in a graph, nested ones included. */
function typesOf(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) typesOf(v, out);
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === "@type") out.push(...(Array.isArray(v) ? (v as string[]) : [String(v)]));
      else typesOf(v, out);
    }
  }
  return out;
}

const FACTS = { street: "Trankgasse 11", zip: "50667", city: "Köln", land: "NW", lat: 50.94, lon: 6.95, amenities: ["WLAN"], source: "db_stada" } as unknown as StationJsonLdFacts;

describe("#1107: no page's graph declares a Dataset", () => {
  it("every builder, every language: exit, station (StaDa and zHV), place, motorway and each site page", () => {
    for (const lang of LIVE_LANGS) {
      const graphs = [
        exitJsonLd(lang, "A24", { title: "A24 Hagenow", description: "x" }, { name: "Hagenow", path: motorwayExitPath(lang, "A24", "exit-11-hagenow"), lat: 53.4, lon: 11.1 }),
        stationJsonLd(lang, "Köln Hbf", `/${lang}/station/koeln-hbf`, FACTS),
        stationJsonLd(lang, "Alsdorf", `/${lang}/station/alsdorf`, { ...FACTS, source: "delfi_zhv" }),
        stationJsonLd(lang, "Köln Hbf", `/${lang}/station/koeln-hbf`, null),
        placeJsonLd(lang, "Köln", `/${lang}/place/koeln`),
        motorwayJsonLd(lang, "A7", `/${lang}/autobahn/a7`),
        ...PAGE_IDS.map((p) => pageJsonLd(p, lang, "2.5.2")).filter((x): x is string => x !== null),
      ];
      expect(graphs.length).toBeGreaterThan(6);
      for (const g of graphs) expect(typesOf(JSON.parse(g)), lang).not.toContain("Dataset");
    }
  });

  it("the exit and the station credit are CreativeWorks carrying the register's line, licence, url and creator", () => {
    const exit = JSON.parse(exitJsonLd("de", "A24", { title: "A24 Hagenow", description: "x" }, { name: "Hagenow", path: motorwayExitPath("de", "A24", "exit-11-hagenow"), lat: null, lon: null })) as { "@graph": Record<string, unknown>[] };
    expect(exit["@graph"].find((n) => n["@type"] === "WebPage")!["isBasedOn"]).toEqual(sourceCredit("TMC Location Code List (LCL)", LCL_CREDIT));
    for (const [source, credit] of [["db_stada", STADA_CREDIT], ["delfi_zhv", ZHV_CREDIT]] as const) {
      const st = JSON.parse(stationJsonLd("de", "X", "/de/station/x", { ...FACTS, source })) as { "@graph": Record<string, unknown>[] };
      const based = st["@graph"].find((n) => n["@type"] === "TrainStation")!["isBasedOn"] as Record<string, unknown>;
      expect(based).toMatchObject({ "@type": "CreativeWork", creditText: credit.text, license: credit.licence, url: credit.url, creator: { "@type": "Organization", name: credit.creator.name } });
    }
  });
});
