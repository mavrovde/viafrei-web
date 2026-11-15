/**
 * The search material of #715 (2.1.13): titles and descriptions written for
 * search in seven languages, the JSON-LD of the dynamic pages, and the 2.1
 * llms files.
 */
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { CONNECT_PROMPTS } from "../src/site/connect-prompts.js";
import { MOTORWAY_PAGE_HOLDS, llmsFullTxt, llmsTxt } from "../src/site/discovery.js";
import { MOTORWAY_REGISTER } from "../src/site/motorways.js";
import { motorwaysLangXml } from "../src/site/sitemaps.js";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, fitTitle, motorwayMeta, pageMeta, placeMeta } from "../src/site/meta.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { motorwayJsonLd, placeJsonLd, structuredData } from "../src/site/structured-data.js";

describe("titles and descriptions (#715)", () => {
  for (const lang of LIVE_LANGS) {
    // #935 (owner 2026-10-22): the home alone is brand-led — "ViaFrei – <tagline>" — and judged in test/brand.test.ts
    it(`${lang}: the connect, place, motorway and index titles lead with search terms, about 60/155`, () => {
      const metas = { connect: pageMeta("connect", lang), motorways: pageMeta("motorways", lang), place: placeMeta("Köln", lang), motorway: motorwayMeta("A7", lang) };
      for (const [id, m] of Object.entries(metas)) {
        expect(m.title.length, `${id}: ${m.title}`).toBeLessThanOrEqual(TITLE_MAX);
        expect(m.description.length, `${id}: ${m.description}`).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(m.description.length, `${id}: ${m.description}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(m.title.startsWith("ViaFrei"), id).toBe(false);
        expect(m.title).not.toMatch(/\{|\}/);
      }
      // the deck writes the brand last; #1020's fit drops it first from a title over 60 characters (`fitTitle`)
      const raw = { connect: t(lang, "seo.connectTitle"), motorways: t(lang, "seo.motorwaysTitle"), place: t(lang, "place.pageTitle", { place: "Köln" }), motorway: t(lang, "seo.motorwayTitle", { road: "A7" }) };
      for (const [id, r] of Object.entries(raw)) {
        expect(r.endsWith("ViaFrei"), id).toBe(true);
        expect(metas[id as keyof typeof metas].title, id).toBe(fitTitle(r));
      }
      expect(metas.place.title.startsWith("Köln")).toBe(true);
      expect(metas.motorway.title).toContain("A7");
      // no figure in a title or a description: they are not live
      for (const m of Object.values(metas)) expect(`${m.title} ${m.description}`.replace(/A7|ChatGPT|MCP/g, "")).not.toMatch(/\d/);
    });
  }
  it("the owner's example is the German place title verbatim", () => {
    // #1020 round 2 (the Search Console baseline: "straßensperrung friesoythe", "sperrung l249 nideggen"): the place, then the state words searchers type
    expect(placeMeta("Köln", "de").title).toBe("Köln: Sperrungen, Baustellen, Verkehr aktuell – ViaFrei");
    // 2.1.17: the catalogue's motorway title is the fallback for a fragment carrying none (`test/motorway-head.test.ts`); the search phrase first
    expect(motorwayMeta("A7", "de").title.startsWith("A7 Stau aktuell: Baustellen, Sperrungen")).toBe(true);
  });
});

type Node = Record<string, unknown> & { "@type": string };
const graph = (s: string): Node[] => (JSON.parse(s) as { "@graph": Node[] })["@graph"];
const of = (g: Node[], type: string): Node | undefined => g.find((n) => n["@type"] === type);

describe("JSON-LD of the dynamic pages (#715)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: a place page is a WebPage with breadcrumbs and a Place that says only its name and Germany`, () => {
      const g = graph(placeJsonLd(lang, "Köln", `/${lang}/x`));
      expect(g.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList", "Place"]);
      expect(of(g, "WebPage")).toMatchObject({ name: placeMeta("Köln", lang).title, inLanguage: lang, url: `https://viafrei.de/${lang}/x` });
      const crumbs = of(g, "BreadcrumbList")!["itemListElement"] as { name: string; position: number; item: string }[];
      expect(crumbs.map((c) => [c.position, c.name])).toEqual([[1, t(lang, "seo.crumbHome")], [2, "Köln"]]);
      expect(crumbs[0]!.item).toBe(`https://viafrei.de${pathFor("start", lang)}`);
      expect(of(g, "Place")).toEqual({ "@type": "Place", "@id": `https://viafrei.de/${lang}/x#place`, name: "Köln", address: { "@type": "PostalAddress", addressCountry: "DE" } });
    });
    it(`${lang}: a motorway page and the index carry WebPage and the three-step breadcrumbs, no Place`, () => {
      const g = graph(motorwayJsonLd(lang, "A7", `/${lang}/m/a7`));
      // #1077: and the road itself, a Thing with its additionalType
      expect(g.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList", "Thing"]);
      const crumbs = of(g, "BreadcrumbList")!["itemListElement"] as { name: string; item: string }[];
      expect(crumbs.map((c) => c.name)).toEqual([t(lang, "seo.crumbHome"), t(lang, "seo.crumbMotorways"), "A7"]);
      expect(crumbs[1]!.item).toBe(`https://viafrei.de${pathFor("motorways", lang)}`);
      const idx = structuredData("motorways", lang, undefined)["@graph"] as Node[];
      expect(idx.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList"]);
    });
  }
  it("no price, no offer, no figure of a card in any of them", () => {
    for (const lang of LIVE_LANGS) {
      for (const s of [placeJsonLd(lang, "Köln", "/de/place/koeln"), motorwayJsonLd(lang, "A7", "/de/autobahn/a7"), JSON.stringify(structuredData("motorways", lang, undefined))]) {
        expect(s).not.toMatch(/"price|"offers|€|"geo"/);
      }
    }
  });
});

describe("llms.txt and llms-full.txt for 2.1 (#715)", () => {
  it("both say how to ask, name the live page patterns and the sitemap index, and the full one every tool", () => {
    for (const txt of [llmsTxt(), llmsFullTxt()]) {
      for (const q of CONNECT_PROMPTS) expect(txt).toContain(`"${t("en", q.key)}" (\`${q.tool}\`)`);
      // #892: `autobahn` and `place` in every language, the place by its slug — no internal id in any address
      expect(txt).toContain("https://viafrei.de/en/autobahn/a7");
      expect(txt).toContain("https://viafrei.de/de/autobahn/a7");
      expect(txt).toContain("https://viafrei.de/en/autobahn ");
      expect(txt).toContain("https://viafrei.de/en/place/koeln");
      expect(txt).not.toMatch(/\/motorway\/|\/ort\/|https:\/\/viafrei\.de\/\S*\d{5}/);
      expect(txt).toContain("https://viafrei.de/sitemap-index.xml");
      expect(txt).toContain(`## Tools (${catalogue.tools.length}`);
    }
    // #1044 added describe_station: 24.
    expect(catalogue.tools).toHaveLength(24);
  });
});

describe("the motorway pages in llms.txt and llms-full.txt (#716, 2.1.17)", () => {
  const locs = (lang: "de" | "en"): string[] => [...motorwaysLangXml(lang, MOTORWAY_REGISTER).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  it("both describe what a motorway page holds now — map, strip, filters, parking, chargers, planned closures, lorry ban and rules, weather, cameras, the assistant examples — and fuel loading only in a reader's browser, not crawlable, never a click (MF3)", () => {
    for (const txt of [llmsTxt(), llmsFullTxt()]) {
      expect(txt).toContain(MOTORWAY_PAGE_HOLDS);
      for (const w of ["schematic map", "junction strip", "filters by direction, stretch and layer", "lorry parks", "truck stops", "charging sites", "planned full closures", "lorry driving ban", "rules", "weather", "traffic cameras", "example questions for an AI assistant", "load only in a reader's browser", "not crawlable", "search box", "crossings card", "cities along the route", "neighbouring towns", "Kreis borders"]) expect(txt, w).toContain(w);
      expect(txt).toContain(`lists all ${String(MOTORWAY_REGISTER.length)} motorways of the register`);
      expect(txt, "MF3: nothing public says the prices load on a click").not.toMatch(/\bclick/i);
    }
  });
  it("llms-full lists every register motorway page, English and German — exactly the motorway sitemaps' addresses, in their order, so the two cannot drift", () => {
    const full = llmsFullTxt();
    const lines = full.split("\n").filter((l) => /^- A\d+: https:\/\/viafrei\.de\/en\/autobahn\//.test(l));
    expect(lines).toHaveLength(MOTORWAY_REGISTER.length);
    const en = lines.map((l) => /^- A\d+: (\S+) — Deutsch: (\S+)$/.exec(l)?.[1]);
    const de = lines.map((l) => /^- A\d+: (\S+) — Deutsch: (\S+)$/.exec(l)?.[2]);
    expect(en).toEqual(locs("en"));
    expect(de).toEqual(locs("de"));
    expect(full).toContain(`## Motorway pages (${String(MOTORWAY_REGISTER.length)},`);
    // the short file stays short: it names the pattern, not the list
    expect(llmsTxt().split("\n").filter((l) => /^- A\d+: /.test(l))).toEqual([]);
  });
  it("no figure and no row in either (steward M27): the motorway lines carry addresses only", () => {
    for (const l of llmsFullTxt().split("\n").filter((x) => /^- A\d+: /.test(x))) expect(l.replace(/https:\S+/g, "").replace(/^- A\d+: /, "")).toBe(" — Deutsch: ");
    expect(MOTORWAY_PAGE_HOLDS).not.toMatch(/\d+ (km|closures|jams|stations)|€|Tankerk/i);
  });
});
