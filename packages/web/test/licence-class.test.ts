/**
 * #992: the licence class of every credited source — what the business page's licence table counts. The class is
 * computed from the register row's own licence and flags (`packages/mcp/src/presentation/attribution.ts`), never typed
 * per source, so these cases pin the ruling's precedence and that a licence nobody has read cannot reach the table.
 */
import { describe, expect, it } from "vitest";
import contract from "../src/generated/contract.json" with { type: "json" };
import { ATTRIBUTION, holdsNoData } from "../../mcp/src/presentation/attribution.js";
import { LICENCE_CLASSES, licenceClassOf } from "../src/site/licence-classes.js";

const credited = Object.entries(ATTRIBUTION).filter(([, row]) => !holdsNoData(row));

describe("licence classes (#992)", () => {
  it("every credited register row falls in exactly one class of the ruling", () => {
    expect(credited.length).toBeGreaterThan(20);
    for (const [id, row] of credited) expect(LICENCE_CLASSES, id).toContain(licenceClassOf(row));
  });

  it("contract.json's classes are today's register, classified now (no drift, no typed list)", () => {
    expect(contract.licenceClasses).toEqual(Object.fromEntries(credited.map(([id, row]) => [id, licenceClassOf(row)])));
  });

  it("Tankerkönig's MTS-K prices are consumer-only although CC BY 4.0: the purpose outranks the licence", () => {
    expect(licenceClassOf(ATTRIBUTION.tankerkoenig)).toBe("consumerOnly");
    expect((contract.licenceClasses as Record<string, string>)["tankerkoenig"]).toBe("consumerOnly");
  });

  it("precedence: own > consumer-only > share-alike > terms > attribution > open", () => {
    expect(licenceClassOf({ license: "CC BY 4.0", ownContent: true, purpose: "consumer-information-only" })).toBe("own");
    expect(licenceClassOf({ license: "CC BY-SA 4.0", noRedistribution: true })).toBe("consumerOnly");
    expect(licenceClassOf({ license: "CC BY 4.0", shareAlike: true })).toBe("shareAlike");
    expect(licenceClassOf({ license: "dl-de/by-2-0", shareAlikeDatabase: true })).toBe("shareAlike");
    expect(licenceClassOf({ license: "ODbL 1.0" })).toBe("shareAlike");
    expect(licenceClassOf({ license: "Nutzungsbedingungen Toll Collect SID 1.0" })).toBe("terms");
    expect(licenceClassOf({ license: "CC BY 4.0" })).toBe("attribution");
    expect(licenceClassOf({ license: "dl-de/by-2-0" })).toBe("attribution");
    expect(licenceClassOf({ license: "CC0 1.0" })).toBe("open");
    expect(licenceClassOf({ license: "dl-de/zero-2-0" })).toBe("open");
  });

  it("the class is the register's SELL verdict: no licence to rest a sale on, or a consumer-answers ruling, is consumer-only (data-steward 2026-11-04)", () => {
    for (const license of ["LICENSE_FREE_USE_OPEN_DATA", "LICENSE_RESTRICTED_USE_FREE_OF_CHARGE", "lizenzfrei (conditionForUse)", "AFIR Art. 20, keine Lizenz angegeben"]) {
      expect(licenceClassOf({ license }), license).toBe("consumerOnly");
    }
    expect(licenceClassOf({ license: "dl-de/zero-2-0", consumerAnswersOnly: true })).toBe("consumerOnly");
    expect(licenceClassOf({ license: "open data (Autobahn GmbH)" })).toBe("terms");
    const classes = contract.licenceClasses as Record<string, string>;
    // the register says no sale and no B2B for each of these (data-sources skill, Sell column)
    for (const id of [
      "mobilithek_traffic_bw", "mobilithek_traffic_sh", "mobilithek_traffic_hannover", "mobilithek_traffic_hamburg", "polizei_hamburg_lms",
      "mobilithek_routing_bab", "mobilithek_ald_14d", "mobilithek_roadworks_akd", "mobilithek_afir_eliso_stat", "mobilithek_afir_eliso_dyn",
      "mobilithek_afir_edri_dyn", "mobilithek_afir_enerando_dyn", "mobilithek_afir_gridco_stat", "mobilithek_afir_gridco_dyn",
      "mobilithek_afir_monta_stat", "mobilithek_afir_road_stat", "mobilithek_afir_road_dyn", "mobilithek_afir_elu_stat", "mobilithek_afir_elu_dyn",
      "mobilithek_afir_chargepool", "lorry_hb_durchfahrtshoehen", "lorry_hb_fuehrungshoehen",
    ]) {
      expect(classes[id], id).toBe("consumerOnly");
    }
    expect(classes["autobahn"]).toBe("terms");
  });

  it("a licence in no class throws, naming it, so a new source cannot reach the table unclassed", () => {
    expect(() => licenceClassOf({ license: "CC BY-NC 4.0" })).toThrow(/CC BY-NC 4\.0/u);
    expect(() => licenceClassOf({ license: "" })).toThrow(/in no class/u);
  });
});
