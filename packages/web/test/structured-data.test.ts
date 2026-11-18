/**
 * The JSON-LD of every page (#531), parsed back from the exact text the
 * <head> carries, for every page of the map in every live language:
 * Organization and WebSite everywhere, SoftwareApplication on the home and
 * the connect page, FAQPage on the connect page only — each with its
 * required fields, in the page's own language, and every fact from a source
 * that is already true on prod.
 */
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { MCP_ENDPOINT, SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS, PAGE_IDS, pathFor } from "../src/site/pages.js";
import { APP_PAGES, FAQ_PAGES, MCP_REGISTRY_ENTRY, NO_JSON_LD, PUBLIC_REPOS, SAME_AS, deployedVersion, jsonLdText, pageJsonLd, structuredData, energyJsonLd, exitJsonLd, motorwayJsonLd, placeJsonLd, roadJsonLd, stateJsonLd, stationJsonLd } from "../src/site/structured-data.js";

type Node = Record<string, unknown> & { "@type": string };
const graphOf = (page: (typeof PAGE_IDS)[number], lang: (typeof LIVE_LANGS)[number], version?: string): Node[] => {
  const parsed = JSON.parse(jsonLdText(structuredData(page, lang, version))) as { "@context": string; "@graph": Node[] };
  expect(parsed["@context"]).toBe("https://schema.org");
  return parsed["@graph"];
};
const ofType = (g: Node[], type: string): Node | undefined => g.find((n) => n["@type"] === type);

describe("JSON-LD on every page, every language (#531)", () => {
  it("covers all eight pages in all seven languages — not a sample", () => {
    expect(PAGE_IDS.length * LIVE_LANGS.length).toBeGreaterThanOrEqual(56);
  });
  for (const page of PAGE_IDS) {
    for (const lang of LIVE_LANGS) {
      it(`${page}/${lang}: parses, Organization + WebSite with their required fields, the app and FAQ only where they belong`, () => {
        const g = graphOf(page, lang);
        const org = ofType(g, "Organization");
        expect(org).toMatchObject({ name: "ViaFrei", url: SITE_ORIGIN, logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/favicon.svg` } });
        expect(org?.["sameAs"]).toEqual(SAME_AS);
        const site = ofType(g, "WebSite");
        expect(site).toMatchObject({ name: "ViaFrei", url: SITE_ORIGIN, inLanguage: lang, description: t(lang, "meta.description") });
        expect((site?.["publisher"] as { "@id": string })["@id"]).toBe(org?.["@id"]);

        const app = ofType(g, "SoftwareApplication");
        expect(app !== undefined, `${page}: SoftwareApplication`).toBe(APP_PAGES.includes(page));
        if (app !== undefined) {
          expect(app).toMatchObject({
            name: "ViaFrei",
            url: MCP_ENDPOINT,
            installUrl: MCP_ENDPOINT,
            applicationCategory: "TravelApplication",
            operatingSystem: "Any (MCP client)",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
            inLanguage: lang,
            mainEntityOfPage: `${SITE_ORIGIN}${pathFor(page, lang)}`,
          });
          expect(app["softwareVersion"], "no version without APP_VERSION").toBeUndefined();
          // nothing the site cannot back: no rating, no review
          expect(app["aggregateRating"]).toBeUndefined();
          expect(app["review"]).toBeUndefined();
        }

        // no FAQPage anywhere (data-steward fallback, #531): an answer lifted out on its own loses its credit and the DWD source line
        expect(ofType(g, "FAQPage"), `${page}: FAQPage`).toBeUndefined();
      });
    }
  }
  it("the fuel board's page carries no JSON-LD at all (data-steward rulings 2026-10-05/06: nothing machine-readable), every other page does", () => {
    expect([...NO_JSON_LD]).toEqual(["fuel"]);
    for (const lang of LIVE_LANGS) {
      expect(pageJsonLd("fuel", lang, "1.0.0"), lang).toBeNull();
      for (const page of PAGE_IDS.filter((p) => p !== "fuel")) expect(pageJsonLd(page, lang, "1.0.0"), `${page}/${lang}`).toBe(jsonLdText(structuredData(page, lang, "1.0.0")));
    }
  });
  it("no page carries FAQPage; home, connect, business and developers are the ones with the app (#992)", () => {
    expect([...FAQ_PAGES]).toEqual([]);
    expect([...APP_PAGES]).toEqual(["start", "connect", "business", "developers"]);
  });
  it("carries the host's version when it has one, and none when it has none or a malformed one", () => {
    expect(ofType(graphOf("start", "en", "1.8.30"), "SoftwareApplication")?.["softwareVersion"]).toBe("1.8.30");
    expect(deployedVersion({ APP_VERSION: "v1.8.30" })).toBe("1.8.30");
    expect(deployedVersion({ APP_VERSION: " 1.8.30 " })).toBe("1.8.30");
    expect(deployedVersion({})).toBeUndefined();
    expect(deployedVersion({ APP_VERSION: "" })).toBeUndefined();
    expect(deployedVersion({ APP_VERSION: "latest" })).toBeUndefined();
  });
  it("can never close its own <script> element: <, > and & are escaped and the JSON is unchanged", () => {
    const data = { "@context": "https://schema.org" as const, "@graph": [{ "@type": "Thing", name: "</script><!-- & -->" }] };
    const text = jsonLdText(data);
    expect(text).not.toMatch(/[<>&]/);
    expect(JSON.parse(text)).toEqual(data);
    for (const page of PAGE_IDS) for (const lang of LIVE_LANGS) expect(jsonLdText(structuredData(page, lang, "1.0.0")), `${page}/${lang}`).not.toMatch(/<\/script/i);
  });
  it("every sameAs is an https address, and no GitHub address is a private repository (#1310 E1)", () => {
    for (const u of SAME_AS) {
      expect(u).toMatch(/^https:\/\//);
      if (u.includes("github.com")) expect(PUBLIC_REPOS, u).toContain(u);
    }
    for (const priv of ["viafrei", "viafrei-infra", "viafrei-ingestor"]) expect(SAME_AS, priv).not.toContain(`https://github.com/mavrovde/${priv}`);
    expect(new Set(SAME_AS).size).toBe(SAME_AS.length);
    for (const r of PUBLIC_REPOS) expect(SAME_AS).toContain(r);
    expect(SAME_AS).toContain("https://github.com/mavrovde/viafrei-mcp");
    expect(SAME_AS).toContain("https://github.com/mavrovde/viafrei-api");
    expect(SAME_AS).toContain("https://github.com/mavrovde/viafrei-database");
    expect(SAME_AS).toContain("https://github.com/mavrovde/viafrei-web");
    expect(SAME_AS).toContain(MCP_REGISTRY_ENTRY);
    expect(MCP_REGISTRY_ENTRY).toMatch(/^https:\/\/registry\.modelcontextprotocol\.io\/.*de\.viafrei%2Fmcp/u);
    expect(SAME_AS).toContain("https://www.npmjs.com/package/viafrei");
    expect(SAME_AS).toContain("https://smithery.ai/servers/viafrei/viafrei");
    expect(SAME_AS).toContain("https://glama.ai/mcp/servers/mavrovde/viafrei-mcp");
  });
});

describe("#1310 E1: the Organization is site-wide — every dynamic page's graph carries the one node with name, url, logo and sameAs", () => {
  for (const lang of LIVE_LANGS) {
    it(lang, () => {
      const org = graphOf("start", lang).find((n) => n["@type"] === "Organization");
      expect(org).toMatchObject({ name: "ViaFrei", url: SITE_ORIGIN, logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/favicon.svg` }, sameAs: SAME_AS });
      const head = { title: "A7 Probe", description: "Probe" };
      const graphs: Record<string, string> = {
        place: placeJsonLd(lang, "Hamburg", "/de/ort/hamburg", "Hamburg"),
        state: stateJsonLd(lang, "Bayern", "DE-BY", "Bayern", "Probe", "/de/land/bayern"),
        charging: energyJsonLd("charging", lang, "Probe", "Probe", "Probe", "/de/laden/probe", { street: null, postcode: null, city: null }),
        station: stationJsonLd(lang, "Aachen Hbf", "/de/bahnhof/aachen-hbf"),
        motorway: motorwayJsonLd(lang, "A7", "/de/autobahn/a7"),
        exit: exitJsonLd(lang, "A7", head, { name: "Hamburg-Volkspark", path: "/de/autobahn/a7/hamburg-volkspark", lat: null, lon: null }),
        road: roadJsonLd(lang, "B96", "B96", "/de/strasse/b96"),
      };
      for (const [kind, text] of Object.entries(graphs)) {
        const g = (JSON.parse(text) as { "@graph": Node[] })["@graph"];
        expect(g.filter((n) => n["@type"] === "Organization"), kind).toEqual([org]);
      }
    });
  }
});
