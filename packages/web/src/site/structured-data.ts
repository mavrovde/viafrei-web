/**
 * The JSON-LD every page but the fuel board's carries in its <head> (#531): what
 * a search engine or an AI search tool reads instead of guessing from the markup.
 *
 * One `@graph` per page, in the page's own language:
 *   - Organization and WebSite on every page that carries a graph;
 *   - SoftwareApplication on the home and the connect page — the service as a
 *     free MCP server, its endpoint, and the version the HOST reports
 *     (`APP_VERSION`, set by the deploy; omitted when unset, never guessed);
 *   - FAQPage on NO page (`FAQ_PAGES` is empty, data-steward fallback): an
 *     FAQ answer is shown on its own, without the credit lines that stand
 *     under it on `/connect`. The builder is kept for the day a ruling
 *     allows it; it would take the connect questions and their dated answers.
 *
 * NOT ON THE FUEL PAGE: `/{lang}/fuel` is the station board and nothing else,
 * and the board's page carries nothing machine-readable (data-steward rulings
 * of 2026-10-05, Verdict 1 condition 2, and 2026-10-06, pinned by
 * `e2e/tiles.e2e.ts`), so it is the one page without a graph (`NO_JSON_LD`).
 *
 * NO FUEL DATA, EVER (data-steward ruling of 2026-10-05, Verdict 1 condition 2
 * and Verdict 2 condition 6, `data-sources` skill): the station board and the
 * dated fuel examples may not be machine-readable, so nothing of them goes in
 * here. The graph is built from the deck, the endpoints, the listings and the
 * connect questions only; this file imports no live example, no board and no
 * register data, and a connect question whose
 * answer rests on the Tankerkönig credit is left out of the FAQ by
 * construction (`faqPrompts`). `test/live-examples.test.ts` (6) and
 * `test/structured-data.test.ts` hold every page and language to that.
 *
 * Every string comes from a source that is already true on prod: the copy
 * deck (the page's own title and description, `meta.ts`), the public
 * addresses (`endpoints.ts`) and the listings the developer page links. No
 * rating, no review, no claim the pages do not make.
 *
 * Pure: a function of its arguments, so `test/structured-data.test.ts` parses
 * what every page and language would print.
 */
import { searchPath } from "./search.js";
import { t } from "../i18n/index.js";
import { CONNECT_PROMPTS, BRIDGE_REPO, NPM_PACKAGE, SMITHERY_LISTING, answerFor, type ConnectPrompt } from "./connect-prompts.js";
import { MCP_ENDPOINT, SITE_ORIGIN } from "./endpoints.js";
import type { MomentAnswer } from "./examples.js";
import { OG_IMAGE, motorwayMeta, pageMeta, placeMeta, stationMeta, type PageMeta } from "./meta.js";
import { pathFor, type Lang, type PageId } from "./pages.js";
import { motorwayPath } from "./motorways.js";
import { placePath } from "./places.js";
import { LCL_CREDIT } from "./lcl-credit.js";
import { STADA_CREDIT, ZHV_CREDIT, type DatasetCredit } from "./stada-credit.js";

/**
 * A source's credit as the graph carries it (#1107): a `CreativeWork` — what schema.org's `isBasedOn` expects — and
 * NEVER a `Dataset`. A page about a junction or a station is not the canonical page of the LCL or of StaDa, and a
 * nested `Dataset` there asked Google to treat every such page as a Dataset Search candidate (and was reported
 * invalid for want of a 50-character description). The credit itself is unchanged: name, source url, creator,
 * the register's line as `creditText` and the licence, matching the visible attribution line.
 */
export function sourceCredit(name: string, credit: DatasetCredit): Record<string, unknown> {
  return { "@type": "CreativeWork", name, url: credit.url, creator: { "@type": "Organization", name: credit.creator.name, url: credit.creator.url }, creditText: credit.text, license: credit.licence };
}

/**
 * Glama's listing at the repository's current name. `GLAMA_LISTING` in
 * connect-prompts.ts still carries the pre-rename address, which Glama
 * answers with a 301 to this one (measured 2026-10-08); `sameAs` names the
 * canonical address so a crawler does not have to follow the hop.
 */
export const GLAMA_CANONICAL = "https://glama.ai/mcp/servers/mavrovde/viafrei-mcp";

/** Where else ViaFrei is, the same identity — every one a page that names this service. */
export const SAME_AS: readonly string[] = [BRIDGE_REPO, NPM_PACKAGE, SMITHERY_LISTING, GLAMA_CANONICAL];

/** The pages that carry no JSON-LD at all: the fuel board's page, which may hold nothing machine-readable. */
export const NO_JSON_LD: readonly PageId[] = ["fuel"];
/** The pages that describe the service itself, and so carry SoftwareApplication (#992: the business and developer pages too). */
export const APP_PAGES: readonly PageId[] = ["start", "connect", "business", "developers"];
/**
 * The pages that carry FAQPage: none (data-steward fallback, #531 review). An
 * FAQ answer is lifted out of the page on its own, and so would lose the
 * CC BY credit lines and the DWD's "Quelle: Deutscher Wetterdienst" (§ 7
 * DWD-Gesetz) that stand under it on `/connect`. The builder stays so the
 * decision is one line, and the tests pin that no page emits it.
 */
export const FAQ_PAGES: readonly PageId[] = [];

/** The register id of the fuel-price credit: an answer carrying it is MTS-K data, which no JSON-LD may hold. */
const FUEL_CREDIT = "tankerkoenig";
const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;
const APP_ID = `${SITE_ORIGIN}/#mcp-server`;

/** The version the host reports, without a leading `v`; undefined when the host reports none. */
export function deployedVersion(env: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
  const v = (env["APP_VERSION"] ?? "").trim().replace(/^v/, "");
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v) ? v : undefined;
}

/**
 * The words the connect page prints under one question (`Answer.astro`): the
 * deck's sentence with the answer's figures and names filled in, then its
 * date in the page's words. Kept beside the template's own logic by
 * `test/structured-data.test.ts`, which compares it with the rendered page.
 */
export function answerText(lang: Lang, msg: Parameters<typeof t>[1], answer: MomentAnswer): string {
  const text = t(lang, msg, { ...answer.values, ...answer.names });
  const fuel = answer.credits.includes(FUEL_CREDIT);
  const when = fuel ? t(lang, "connectPage.live.fuelExample", answer.values) : t(lang, "day.answer.asOf", answer.values);
  return `${text} (${when})`;
}

/** The connect page's questions that may be FAQ entries: none whose answer carries the fuel credit (Verdict 2 condition 6). */
export const faqPrompts = (lang: Lang): readonly ConnectPrompt[] => CONNECT_PROMPTS.filter((p) => !answerFor(p, lang).credits.includes(FUEL_CREDIT));

export type JsonLd = { readonly "@context": "https://schema.org"; readonly "@graph": readonly Record<string, unknown>[] };

/** The graph a page carries in its <head>, or null for a page of `NO_JSON_LD`. */
export function pageJsonLd(page: PageId, lang: Lang, version: string | undefined): string | null {
  return NO_JSON_LD.includes(page) ? null : jsonLdText(structuredData(page, lang, version));
}

export function structuredData(page: PageId, lang: Lang, version: string | undefined): JsonLd {
  const meta = pageMeta(page, lang);
  const siteName = t(lang, "meta.siteName");
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: siteName,
      url: SITE_ORIGIN,
      // #1077: the brand line (owner 2026-10-22), in the page's language
      description: t(lang, "meta.tagline"),
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/favicon.svg` },
      image: OG_IMAGE.url,
      sameAs: SAME_AS,
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: siteName,
      url: SITE_ORIGIN,
      description: t(lang, "meta.description"),
      inLanguage: lang,
      publisher: { "@id": ORG_ID },
      // #1111: the site search's results page (every kind of thing we hold; #1077 pointed it at the motorway index's search)
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_ORIGIN}${searchPath(lang)}?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];
  if (APP_PAGES.includes(page)) {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": APP_ID,
      name: siteName,
      description: t(lang, "meta.description"),
      url: MCP_ENDPOINT,
      installUrl: MCP_ENDPOINT,
      applicationCategory: "TravelApplication",
      operatingSystem: "Any (MCP client)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      inLanguage: lang,
      ...(version !== undefined ? { softwareVersion: version } : {}),
      sameAs: SAME_AS,
      publisher: { "@id": ORG_ID },
      mainEntityOfPage: `${SITE_ORIGIN}${pathFor(page, lang)}`,
    });
  }
  // #715: the motorway index is the parent of every motorway page, so it says where it sits.
  if (page === "motorways") graph.push(...pageNodes(lang, meta, pathFor(page, lang), [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(t(lang, "seo.crumbMotorways"), pathFor(page, lang))]));
  // #1041: the station catalogue is the parent of every station page.
  if (page === "stations") graph.push(...pageNodes(lang, meta, pathFor(page, lang), stationsCrumbs(lang)));
  // #1074: the index of the Länder is the parent of every Land page.
  if (page === "states") graph.push(...pageNodes(lang, meta, pathFor(page, lang), statesCrumbs(lang)));
  if (FAQ_PAGES.includes(page)) {
    graph.push({
      "@type": "FAQPage",
      name: meta.title,
      url: `${SITE_ORIGIN}${pathFor(page, lang)}`,
      inLanguage: lang,
      mainEntity: faqPrompts(lang).map((p) => ({
        "@type": "Question",
        name: t(lang, p.key),
        acceptedAnswer: { "@type": "Answer", text: answerText(lang, p.answerKey, answerFor(p, lang)) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export type Crumb = { readonly name: string; readonly path: `/${string}` };
const crumb = (name: string, path: `/${string}`): Crumb => ({ name, path });

/** A page's WebPage and its BreadcrumbList (#715), the page the last crumb. */
function pageNodes(lang: Lang, meta: PageMeta, path: `/${string}`, crumbs: readonly Crumb[], about?: string): Record<string, unknown>[] {
  const url = `${SITE_ORIGIN}${path}`;
  return [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: meta.title,
      description: meta.description,
      inLanguage: lang,
      isPartOf: { "@id": SITE_ID },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      ...(about !== undefined ? { about: { "@id": about } } : {}),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_ORIGIN}${c.path}` })),
    },
  ];
}

/** The two nodes every graph begins with (Organization, WebSite), for a page of the map or a dynamic one. */
const siteNodes = (lang: Lang): Record<string, unknown>[] => structuredData("connect", lang, undefined)["@graph"].slice(0, 2);

/**
 * A place page's graph (#715, 2.1.13): WebPage, BreadcrumbList (home → the
 * place) and a Place carrying exactly what the page states — its German name
 * and that it is in Germany. NO FUEL DATA and no figure of any card: the graph
 * is built from the name and the deck alone, never from the cards' HTML.
 */
export function placeJsonLd(lang: Lang, name: string, path: `/${string}`): string {
  const placeId = `${SITE_ORIGIN}${path}#place`;
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, placeMeta(name, lang), path, placeCrumbs(lang, name, path), placeId),
      { "@type": "Place", "@id": placeId, name, address: { "@type": "PostalAddress", addressCountry: "DE" } },
    ],
  });
}

/**
 * THE BREADCRUMBS (#1026 § 4), one list per page type, read by BOTH the visible trail (`components/Crumbs.astro`)
 * and the JSON-LD BreadcrumbList — so the two can never name different steps. Every step but the last is a link to
 * a page of the map or a motorway page, built by the router's own path functions.
 */
export function motorwayCrumbs(lang: Lang, road: string, exit?: { readonly name: string; readonly path: `/${string}` }): readonly Crumb[] {
  const base = [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(t(lang, "seo.crumbMotorways"), pathFor("motorways", lang)), crumb(road, motorwayPath(lang, road))];
  return exit === undefined ? base : [...base, crumb(exit.name, exit.path)];
}
export const placeCrumbs = (lang: Lang, name: string, path: `/${string}`): readonly Crumb[] => [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(name, path)];
export const motorwaysCrumbs = (lang: Lang): readonly Crumb[] => [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(t(lang, "seo.crumbMotorways"), pathFor("motorways", lang))];

export const stationsCrumbs = (lang: Lang): readonly Crumb[] => [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(t(lang, "seo.crumbStations"), pathFor("stations", lang))];
export const statesCrumbs = (lang: Lang): readonly Crumb[] => [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(t(lang, "statePages.crumb"), pathFor("states", lang))];
/** #1074: a Land's trail — home → the Länder → the Land. */
export const stateCrumbs = (lang: Lang, name: string, path: `/${string}`): readonly Crumb[] => [...statesCrumbs(lang), crumb(name, path)];

/**
 * #1074: a Land page's graph — WebPage, BreadcrumbList and an AdministrativeArea carrying exactly what the page states:
 * the Land's name in this language, its German name, its ISO 3166-2 code and that it is in Germany. NO FUEL DATA and no
 * figure of any card (data-steward MF1): built from the name and the table, never from the cards' HTML.
 */
export function stateJsonLd(lang: Lang, name: string, iso: string, title: string, description: string, path: `/${string}`): string {
  const areaId = `${SITE_ORIGIN}${path}#area`;
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, { title, description }, path, stateCrumbs(lang, name, path), areaId),
      { "@type": "AdministrativeArea", "@id": areaId, name, identifier: `DE-${iso}`, containedInPlace: { "@type": "Country", name: "Deutschland", identifier: "DE" } },
    ],
  });
}

/**
 * #1076: a fuel station's trail — home → the fuel page → the station; a charging site's — home → the site. The fuel
 * page is a page of the map; there is no charging index page, so that trail has no middle step.
 */
/**
 * `board`: the fuel board's name for a fuel station (its crumb links the board), null for a charging site. The
 * caller passes it, so this module names no page's own copy (the lastmod content rule, #934 A3, reads a copy key in a
 * shared module as printed by every page that imports it).
 */
export const energyCrumbs = (kind: "fuel" | "charging", lang: Lang, name: string, path: `/${string}`, board: string | null): readonly Crumb[] => [
  crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)),
  ...(kind === "fuel" && board !== null ? [crumb(board, pathFor("fuel", lang))] : []),
  crumb(name, path),
];

/** #1076: what a station page's graph says beyond its name — its address, read off the fragment's head. */
export type EnergyJsonLdFacts = { readonly street: string | null; readonly postcode: string | null; readonly city: string | null };

/**
 * #1076: a charging site's graph — WebPage and BreadcrumbList, and the site as a `Place` (schema.org names no charging
 * station) with its name and postal address. No live figure: the graph is built from the name and the address alone,
 * never from the page's HTML.
 *
 * A FUEL STATION'S PAGE HAS NO GRAPH (#1167 S2, data-steward 2026-11-04): a station's name and address are MTS-K
 * Grunddaten, and a structured record of them is the "nothing … in JSON-LD" of Verdict 1 of 2026-10-05 — the board's
 * page carries none either (`NO_JSON_LD`). So `kind` is charging alone; a fuel graph is a type error.
 */
export function energyJsonLd(kind: "charging", lang: Lang, name: string, title: string, description: string, path: `/${string}`, facts: EnergyJsonLdFacts): string {
  const id = `${SITE_ORIGIN}${path}#site`;
  const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "DE" };
  if (facts.street !== null) address["streetAddress"] = facts.street;
  if (facts.postcode !== null) address["postalCode"] = facts.postcode;
  if (facts.city !== null) address["addressLocality"] = facts.city;
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, { title, description }, path, energyCrumbs(kind, lang, name, path, null), id),
      { "@type": "Place", "@id": id, name, address },
    ],
  });
}

/** #1095: where a station sits — its Land (in the page's language, with its two-digit key) and its town page. */
export type StationWhere = { readonly land?: string | null; readonly landKey?: string | null; readonly place?: { readonly slug: string; readonly name: string } | null };

/**
 * A station's trail (#1041; #1095: Germany's stations → the Land → the town → the station). The Land is the station
 * catalogue's list of that Land, the town its Gemeinde's place page; a step the digest did not name is left out.
 */
export const stationCrumbs = (lang: Lang, name: string, path: `/${string}`, where: StationWhere | null = null): readonly Crumb[] => [
  ...stationsCrumbs(lang),
  ...(where?.land != null && where.landKey != null ? [crumb(where.land, `${pathFor("stations", lang)}?land=${where.landKey}`)] : []),
  ...(where?.place != null ? [crumb(where.place.name, placePath(lang, where.place.slug))] : []),
  crumb(name, path),
];

/** #1044: what a station's graph says beyond its name (`lib/station.ts` `StationFacts`, read off the digest's header). */
export type StationJsonLdFacts = StationWhere & {
  readonly street: string | null;
  readonly zip: string | null;
  readonly city: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly amenities: readonly string[];
  readonly source?: "db_stada" | "delfi_zhv";
  /** #1095: the record's Stand — the WebPage's `dateModified` (when the station's own data last changed, never a live figure). */
  readonly stand?: Date | null;
};

/**
 * A station page's graph (#1041, #1044, #1095): WebPage (with the record's Stand as `dateModified`) and BreadcrumbList,
 * home → the stations → the Land → the town → this one, and the station
 * as a `TrainStation` — its address and point, the facilities StaDa states (`amenityFeature`, named in the page's
 * language) and that the station is free to enter. The address, the point and the facilities are DB StaDa's
 * (CC BY 4.0), so the station node carries StaDa's credit itself (`isBasedOn`, the #1025 shape). No live figure: a
 * departure or a lift state is never in the graph. Without the facts, the name and the country only.
 */
export function stationJsonLd(lang: Lang, name: string, path: `/${string}`, facts: StationJsonLdFacts | null = null): string {
  const stationId = `${SITE_ORIGIN}${path}#station`;
  const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "DE" };
  if (facts?.street != null) address["streetAddress"] = facts.street;
  if (facts?.zip != null) address["postalCode"] = facts.zip;
  if (facts?.city != null) address["addressLocality"] = facts.city;
  if (facts?.land != null) address["addressRegion"] = facts.land;
  const geo = facts?.lat != null && facts.lon != null ? { geo: { "@type": "GeoCoordinates", latitude: facts.lat, longitude: facts.lon } } : {};
  const amenities = (facts?.amenities ?? []).map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true }));
  // #1095: the town the station is in, as its own page
  const town = facts?.place != null ? { containedInPlace: { "@type": "Place", name: facts.place.name, url: `${SITE_ORIGIN}${placePath(lang, facts.place.slug)}` } } : {};
  // #1087: a railway station StaDa does not list is the zHV's (name and point): its graph credits the zHV instead
  const [dataset, credit] = facts?.source === "delfi_zhv" ? ["DELFI zHV", ZHV_CREDIT] : ["DB StaDa", STADA_CREDIT];
  const stada =
    facts === null
      ? {}
      : { isBasedOn: sourceCredit(dataset, credit) };
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, stationMeta(name, lang, facts?.city ?? null), path, stationCrumbs(lang, name, path, facts), stationId).map((n) =>
        n["@type"] === "WebPage" && facts?.stand != null ? { ...n, dateModified: facts.stand.toISOString() } : n,
      ),
      { "@type": "TrainStation", "@id": stationId, name, address, ...geo, ...town, ...(amenities.length === 0 ? {} : { amenityFeature: amenities }), isAccessibleForFree: true, publicAccess: true, ...stada },
    ],
  });
}

/**
 * #1077: schema.org has no road type, so a motorway is a `Thing` whose `additionalType` is Wikidata's
 * "controlled-access highway" — the shape a validator accepts for an entity schema.org does not name.
 */
export const MOTORWAY_ADDITIONAL_TYPE = "https://www.wikidata.org/wiki/Q46622";

/** A motorway page's graph (#715): WebPage and BreadcrumbList, home → the motorways → this one, and (#1077) the road itself. No figure. */
export function motorwayJsonLd(lang: Lang, road: string, path: `/${string}`): string {
  const roadId = `${SITE_ORIGIN}${motorwayPath(lang, road)}#road`;
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, motorwayMeta(road, lang), path, [...motorwayCrumbs(lang, road).slice(0, 2), crumb(road, path)], roadId),
      { "@type": "Thing", "@id": roadId, additionalType: MOTORWAY_ADDITIONAL_TYPE, name: road, alternateName: `Bundesautobahn ${road.slice(1)}`, url: `${SITE_ORIGIN}${motorwayPath(lang, road)}` },
    ],
  });
}

/**
 * An exit page's graph (#1025): WebPage (the exit's own title), BreadcrumbList home → the motorways → the road → the
 * exit, and a Place — the junction's LCL name and, when the fragment carries it, its LCL point. The name and the point
 * are BASt LCL data (CC BY 4.0), so the graph carries their credit itself: the WebPage `isBasedOn` the LCL with the
 * register's line as `creditText`, the licence, the dataset's source `url` and its `creator` (steward M27 kept LCL
 * data out of JSON-LD in 2.1.15 because the credit could not travel with it; here it travels inside the graph).
 *
 * NO LIVE FIGURE (2.4.1 review S3): the WebPage's description is the motorway's own deck line
 * (`motorwayMeta`), never the page's live meta description ("A24 Hamburg-Horn jetzt: 1 Sperrung.") — that is an
 * Autobahn GmbH figure, and the graph carries only the LCL's credit. Of the page's meta only the title is read here.
 */
export function exitJsonLd(lang: Lang, road: string, head: PageMeta, exit: { readonly name: string; readonly path: `/${string}`; readonly lat: number | null; readonly lon: number | null }): string {
  const url = `${SITE_ORIGIN}${exit.path}`;
  const placeId = `${url}#place`;
  const meta: PageMeta = { title: head.title, description: motorwayMeta(road, lang).description };
  const nodes = pageNodes(lang, meta, exit.path, motorwayCrumbs(lang, road, exit), placeId);
  const lcl = sourceCredit("TMC Location Code List (LCL)", LCL_CREDIT);
  const page = { ...nodes[0], isBasedOn: lcl };
  const geo = exit.lat !== null && exit.lon !== null ? { geo: { "@type": "GeoCoordinates", latitude: exit.lat, longitude: exit.lon } } : {};
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [...siteNodes(lang), page, ...nodes.slice(1), { "@type": "Place", "@id": placeId, name: exit.name, ...geo, address: { "@type": "PostalAddress", addressCountry: "DE" } }],
  });
}

/** #1027: a road page's trail — home → the road. No catalogue page of roads exists, so the road is the second step. */
export const roadCrumbs = (lang: Lang, road: string, path: `/${string}`): readonly Crumb[] => [crumb(t(lang, "seo.crumbHome"), pathFor("start", lang)), crumb(road, path)];

/** #1027: schema.org has no road type; Wikidata's "road", the #1077 shape the motorway's graph uses. */
export const ROAD_ADDITIONAL_TYPE = "https://www.wikidata.org/wiki/Q34442";

/**
 * A road page's graph (#1027): WebPage and BreadcrumbList, home → the road, and the road itself as a `Thing` — its
 * label and, for a Land's road, the Land it is in. NO LIVE FIGURE: the WebPage's name and description are the page's
 * title (the road and its main place), never the live meta description with its counts — those are the publishers'
 * facts, credited on the page, and the graph carries no credit.
 */
export function roadJsonLd(lang: Lang, road: string, title: string, path: `/${string}`, land: string | null = null): string {
  const roadId = `${SITE_ORIGIN}${path}#road`;
  return jsonLdText({
    "@context": "https://schema.org",
    "@graph": [
      ...siteNodes(lang),
      ...pageNodes(lang, { title, description: title }, path, roadCrumbs(lang, road, path), roadId),
      { "@type": "Thing", "@id": roadId, additionalType: ROAD_ADDITIONAL_TYPE, name: road, url: `${SITE_ORIGIN}${path}`, ...(land === null ? {} : { containedInPlace: { "@type": "AdministrativeArea", name: land } }) },
    ],
  });
}

/**
 * The JSON as it goes into a `<script type="application/ld+json">`: `<`, `>`
 * and `&` escaped as JSON unicode escapes, so no value can close the element
 * or open a comment — the parsed JSON is unchanged.
 */
export function jsonLdText(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
