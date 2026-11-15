import { describe, expect, it } from "vitest";
import { negotiate } from "../src/i18n/negotiate.js";
import { LOCALES, assertRegistryMatchesPages, reviewedLocales } from "../src/i18n/locales.js";

// The #380 table — pasted into the PR as written here.
const TABLE: readonly [string | undefined, "de" | "en" | "ru" | "bg" | "uk" | "ro" | "tr"][] = [
  ["de", "de"],
  ["en-GB,en;q=0.9", "en"],
  ["ja", "de"], // not a site language (French was the example until #753 made it one)
  ["tr", "tr"], // reviewed since 2026-10-03 (#235)
  ["ru-RU,ru;q=0.9,en;q=0.5", "ru"],
  ["uk,ru;q=0.8", "uk"],
  ["bg-BG", "bg"],
  ["ro-MD,ro;q=0.9", "ro"],
  ["ar", "de"], // not a site language at all
  [undefined, "de"],
  ["*", "de"],
  ["en;q=0.1,de;q=0.9", "de"],
  ["ja-JP,en-US;q=0.8,de;q=0.5", "en"],
  ["de-AT", "de"],
  ["en;q=0", "de"], // q=0 means "not acceptable"
  ["!!garbage", "de"],
];

// #753: the fifteen, judged against the registry with every one of them
// reviewed, so the table holds in every commit of the release. A region or a
// script subtag matches its base: a Brazilian browser gets European
// Portuguese and a Latin-script Serbian browser the Cyrillic pages — the
// owner's choice of variant (2026-10-15), and the only Portuguese/Serbian the
// site has.
const ALL_REVIEWED = LOCALES.map((l) => ({ ...l, reviewed: true }));
const TABLE_753: readonly [string, string][] = [
  ["fr-FR,fr;q=0.9", "fr"], ["fr-BE", "fr"], ["fr-CH,de;q=0.8", "fr"],
  ["es-ES", "es"], ["es-419", "es"], ["nl-BE", "nl"], ["nl", "nl"],
  ["pl-PL,pl;q=0.9,en;q=0.5", "pl"], ["it-CH", "it"], ["lt", "lt"],
  ["cs-CZ", "cs"], ["hu-HU", "hu"], ["sk", "sk"], ["da-DK,en;q=0.7", "da"],
  ["pt-PT", "pt"], ["pt-BR,pt;q=0.9,en;q=0.5", "pt"], ["pt", "pt"],
  ["hr-HR", "hr"], ["sr", "sr"], ["sr-Cyrl-RS", "sr"], ["sr-Latn-RS,sr-Latn;q=0.9", "sr"], ["sr-ME", "sr"],
  ["el-GR", "el"], ["el-CY", "el"], ["lv-LV", "lv"],
  ["ja,fr;q=0.4", "fr"], ["fr;q=0,es", "es"],
];

describe("Accept-Language negotiation at / (#380)", () => {
  for (const [header, want] of TABLE_753) {
    it(`#753 ${JSON.stringify(header)} → ${want}`, () => {
      expect(negotiate(header, ALL_REVIEWED)).toBe(want);
    });
  }

  for (const [header, want] of TABLE) {
    it(`${JSON.stringify(header)} → ${want}`, () => {
      expect(negotiate(header)).toBe(want);
    });
  }

  it("never selects a locale that is registered but unreviewed", () => {
    // a fixture registry in which Turkish is still unreviewed
    const withTr = LOCALES.map((l) => (l.code === "tr" ? { ...l, reviewed: false } : l));
    expect(negotiate("tr", withTr)).toBe("de");
    expect(reviewedLocales(withTr).map((l) => l.code)).not.toContain("tr");
  });

  it("the registry's reviewed locales are exactly the page map's live languages", () => {
    expect(() => assertRegistryMatchesPages()).not.toThrow();
    expect(() => assertRegistryMatchesPages([LOCALES[0]!])).toThrow(/LIVE_LANGS/);
  });
});
