/**
 * #707 — the terms of use: German at `/terms` (binding), `/<lang>/terms` in every other live language, section 2
 * at `#sid`, linked from every footer. Pinned:
 *  - the page map, the footer, the meta description of every language;
 *  - every language carries the whole clause (sections 1–3, items a–f), its own binding sentence linked to the
 *    German, the operator's name and the imprint as slots, Toll Collect's terms as the link, and item c's source
 *    line verbatim in German;
 *  - the German text is § A.1's in its operative words, with "keine Gewähr" (never "keine Haftung" as the notice);
 *  - the effective day is ONE constant, an ISO date, marked to be set at the cut.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { pageMeta } from "../src/site/meta.js";
import { LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { SID_SOURCE_LINE, TERMS, TERMS_EFFECTIVE, TOLL_COLLECT_SID_TERMS, termsDate } from "../src/site/terms.js";

const src = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("#707: the terms page", () => {
  it("is a legal page of the map: /terms in German, /<lang>/terms elsewhere", () => {
    expect(PAGES.find((p) => p.id === "terms")).toMatchObject({ slug: "/terms", legal: true, nav: null });
    expect(pathFor("terms", "de")).toBe("/terms");
    expect(pathFor("terms", "en")).toBe("/en/terms");
    expect(pathFor("terms", "uk")).toBe("/uk/terms");
  });

  it("every footer links it beside the imprint and the privacy page; every language has its title and description", () => {
    // the rendered footer link in every language is pinned by structure in e2e/terms.e2e.ts (#922 B2)
    expect(src("src/components/Footer.astro")).toContain('href={pathFor("terms", lang)}');
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "footer.terms"), lang).not.toBe("");
      expect(pageMeta("terms", lang).description.length, lang).toBeGreaterThanOrEqual(70);
    }
  });

  it("every language carries the whole clause, its slots and its binding sentence", () => {
    for (const lang of LIVE_LANGS) {
      const x = TERMS[lang];
      expect(x.items, lang).toHaveLength(6);
      expect(x.s1, lang).toContain("{name}");
      expect(x.s1, lang).toContain("{imprint}");
      expect(x.s1, lang).toContain("mcp.viafrei.de");
      expect(x.s2link, lang).toContain("{link}");
      expect(x.items[2]?.[1], lang).toContain("{source}");
      expect(x.s2a, lang).toContain("Stellplatz-Informationsdienst (SID)");
      expect(x.asOf, lang).toContain("{date}");
      if (lang === "de") expect(x.binding).toBeNull();
      else {
        expect(x.binding, lang).toContain("{link}");
        expect(x.bindingLink, lang).not.toBe("");
      }
      for (const s of [x.title, x.s1, x.s2a, x.s2b, x.s3, ...x.items.flat()]) expect(s, lang).not.toMatch(/\{(?!name\}|imprint\}|source\})\w+\}/);
    }
  });

  it("the German text is § A.1 in its operative words", () => {
    const de = TERMS.de;
    expect(de.s1).toContain("durch Klick auf die dafür vorgesehene Schaltfläche abrufen oder die Zustimmung in Ihrem KI-Assistenten bestätigen");
    expect(de.items[4]?.[1]).toContain("übernimmt Ihnen gegenüber keine Gewähr");
    expect(de.items[4]?.[1]).not.toMatch(/keine Haftung/);
    expect(de.items[3]?.[1]).toContain("Sie verpflichten die Dritten vertraglich");
    expect(de.items[5]?.[1]).toContain("bestätigen uns die Löschung in Textform");
    expect(de.s3).toContain("Es gilt deutsches Recht.");
    expect(SID_SOURCE_LINE).toBe("Lkw-Stellplätze: Toll Collect GmbH, Stellplatz-Informationsdienst (SID) via Mobilithek");
    expect(TOLL_COLLECT_SID_TERMS).toBe("https://company.toll-collect.de/static/media/dokumente/sid/agb-sid.pdf");
  });

  it("section 2 is #sid, the source line verbatim and German on every page, the binding link to the German page", () => {
    const c = src("src/components/LegalTerms.astro");
    // #sid and the German source line as rendered, in every language: e2e/terms.e2e.ts (#922 B2)
    expect(c).toContain("{SID_SOURCE_LINE}");
    expect(c).toContain('href={pathFor("terms", "de")} hreflang="de"');
  });

  it("the effective day is one ISO constant, the 2.4.3 deploy day, no longer awaiting the cut", () => {
    expect(TERMS_EFFECTIVE).toBe("2026-10-27");
    expect(src("src/site/terms.ts")).not.toMatch(/TODO-AT-CUT/);
    expect(termsDate("de")).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(termsDate("en")).toBe(TERMS_EFFECTIVE);
  });
});
