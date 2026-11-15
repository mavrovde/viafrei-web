/**
 * #1095: the station pages written for what people search for a station.
 *  - the title names the station with its town and the four things searched for it (departures, the track, lifts,
 *    disruptions), in every language, within the title limit; the description within its limit — and both unique
 *    across stations that share a name in different towns;
 *  - the digest's facts header carries the Land (in the page's language, with its key), the town page and the record's
 *    Stand, read back strictly by the shell;
 *  - the graph: a BreadcrumbList home → stations → Land → town → station with a crawlable address for every step,
 *    the TrainStation's `addressRegion` and `containedInPlace` (the town page), and the WebPage's `dateModified` — a
 *    schema-shape rule, with mutants it must refuse;
 *  - the AI-robot files: llms.txt and llms-full.txt name the station family, its sitemaps and what a page holds;
 *    robots.txt blocks no station page in any group (the fuel stays behind `/fragment/`).
 */
import { describe, expect, it } from "vitest";
import { stationPageOf } from "../../digest/src/analysis/station-page.js";
import { stationFactsHeader } from "../../digest/src/presentation/station-page-html.js";
import type { StationRecordRow } from "../../digest/src/queries/station-page.sql.js";
import { t } from "../src/i18n/index.js";
import { stationFactsOf } from "../src/lib/station.js";
import { FRAGMENT_DISALLOW, llmsFullTxt, llmsTxt, robotsTxt, serverCard } from "../src/site/discovery.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { DESCRIPTION_MAX, TITLE_FIT, stationLabel, stationMeta } from "../src/site/meta.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { SITEMAP_INDEX, stationsSitemap } from "../src/site/sitemaps.js";
import { stationPath } from "../src/site/stations.js";
import { stationCrumbs, stationJsonLd } from "../src/site/structured-data.js";

const RECORD: StationRecordRow = {
  station_no: "8192", slug: "kleinhalt", name: "Kleinhalt", eva_no: "8099001", eva_nos: ["8099001"], ds100: null, ifopt: null, category: 6,
  federal_state: "Sachsen", municipality_code: "14626110", street: "Bahnhofstr. 1", zipcode: "02826", city: "Görlitz", lat: 51.15, lon: 14.98, stepless_access: "yes",
  has_parking: true, has_bicycle_parking: null, has_local_public_transport: null, has_public_facilities: null, has_locker_system: null, has_taxi_rank: null,
  has_travel_necessities: null, has_wifi: null, has_travel_center: null, has_railway_mission: null, has_db_lounge: null, has_lost_and_found: null, has_car_rental: null,
  mobility_service: null, mobility_staff: null, db_information: null, local_service_staff: null, service_phone: null,
  last_seen_at: new Date("2026-10-27T03:00:00Z"), updated_at: new Date("2026-10-20T03:00:00Z"), place_slug: "goerlitz", place_name: "Görlitz",
};
const none = { ok: true as const, value: [] };
const PAGE = stationPageOf({ record: RECORD, platforms: none, around: none, neighbours: none, junctions: none });

/** Real name collisions of the station register: one name, several towns. */
const SAME_NAME: readonly [string, string][] = [
  ["Neustadt", "Neustadt an der Weinstraße"],
  ["Neustadt", "Neustadt in Holstein"],
  ["Neustadt", "Neustadt bei Coburg"],
  ["Rosenheim", "Rosenheim"],
  ["Berg", "Berg (Starnberger See)"],
  ["Berg", "Berg bei Neumarkt"],
  ["Frankfurt (Main) Hbf", "Frankfurt am Main"],
  ["Frankfurt (Oder)", "Frankfurt (Oder)"],
  ["Kleinhalt", "Görlitz"],
  ["Hamburg-Harburg", "Hamburg"],
  ["Sankt Peter-Ording Bad", "Sankt Peter-Ording"],
  ["Mönchengladbach-Rheydt-Odenkirchen-Süd Abzw.", "Mönchengladbach"],
];

describe("#1095 the title and the description", () => {
  it("name the station with its town, within the limits, in every language — and never twice for two stations", () => {
    for (const lang of LIVE_LANGS) {
      const titles = new Set<string>();
      const descriptions = new Set<string>();
      for (const [name, city] of SAME_NAME) {
        const m = stationMeta(name, lang, city);
        const label = stationLabel(name, city);
        expect(m.title.length, `${lang} ${label}: ${m.title}`).toBeLessThanOrEqual(TITLE_FIT);
        expect(m.description.length, `${lang} ${label}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(m.title.startsWith(label) || m.title.startsWith(name), `${lang}: ${m.title}`).toBe(true);
        expect(m.description).toContain(label);
        titles.add(m.title);
        descriptions.add(m.description);
      }
      expect(descriptions.size, lang).toBe(SAME_NAME.length);
      // a cut title of a very long name may lose its town; every other one is unique
      expect(titles.size, lang).toBeGreaterThanOrEqual(SAME_NAME.length - 1);
    }
  });

  it("the German title says what is searched for a station: Abfahrten, Gleise, Aufzüge, Störungen — once each", () => {
    const m = stationMeta("Köln Hbf", "de", "Köln");
    expect(m.title).toBe("Köln Hbf: Abfahrten, Gleise, Aufzüge, Störungen – ViaFrei");
    expect(stationMeta("Kleinhalt", "de", "Görlitz").title).toBe("Kleinhalt (Görlitz): Abfahrten, Gleise, Aufzüge, Störungen"); // over 60 with the brand: the brand goes first
    expect(stationMeta("Köln Hbf", "en", "Köln").title).toBe("Köln Hbf: departures, platforms, lifts, disruptions");
    for (const lang of LIVE_LANGS) {
      const words = t(lang, "seo.stationTitle", { name: "X" }).replace(/^X\s?:\s*/u, "").replace(/\s–\sViaFrei$/u, "").split(/,\s*/u);
      expect(words, lang).toHaveLength(4);
      expect(new Set(words).size, lang).toBe(4);
    }
  });
});

describe("#1095 the facts header: the Land, the town page and the Stand", () => {
  it("the digest writes them in the page's language and the shell reads them back", () => {
    const de = stationFactsOf(stationFactsHeader("de", PAGE))!;
    expect([de.land, de.landKey, de.place, de.stand?.toISOString()]).toEqual(["Sachsen", "14", { slug: "goerlitz", name: "Görlitz" }, PAGE.stand.toISOString()]);
    expect(stationFactsOf(stationFactsHeader("en", PAGE))!.land).toBe("Saxony");
  });

  it("is read strictly: a bad key, slug or date is no value", () => {
    const enc = (x: unknown): string => Buffer.from(JSON.stringify(x)).toString("base64url");
    const f = stationFactsOf(enc({ land: "<b>", landKey: "99", place: { slug: "Gör litz", name: "Görlitz" }, stand: "gestern" }))!;
    expect([f.land, f.landKey, f.place, f.stand]).toEqual([null, null, null, null]);
    expect(stationFactsOf(enc({ place: { slug: "goerlitz", name: 3 } }))!.place).toBeNull();
  });
});

describe("#1095 the graph", () => {
  const facts = stationFactsOf(stationFactsHeader("de", PAGE))!;
  const path = stationPath("de", "kleinhalt");
  const graph = (f: typeof facts | null): Record<string, unknown>[] => (JSON.parse(stationJsonLd("de", "Kleinhalt", path, f)) as { "@graph": Record<string, unknown>[] })["@graph"];

  /** The schema rule: every ListItem has a position in order, a name and an absolute address on this site; the last is the page. */
  const validTrail = (g: Record<string, unknown>[]): boolean => {
    const list = g.find((n) => n["@type"] === "BreadcrumbList");
    const items = (list?.["itemListElement"] ?? []) as Record<string, unknown>[];
    return (
      items.length >= 3 &&
      items.every((it, i) => it["@type"] === "ListItem" && it["position"] === i + 1 && typeof it["name"] === "string" && (it["name"]) !== "" && typeof it["item"] === "string" && (it["item"]).startsWith(`${SITE_ORIGIN}/`)) &&
      items[items.length - 1]!["item"] === `${SITE_ORIGIN}${path}`
    );
  };

  it("the trail: home → stations → the Land → the town → the station, each a crawlable address", () => {
    const g = graph(facts);
    expect(validTrail(g)).toBe(true);
    const items = (g.find((n) => n["@type"] === "BreadcrumbList")!["itemListElement"] as { name: string; item: string }[]).map((i) => [i.name, i.item]);
    expect(items).toEqual([
      [t("de", "seo.crumbHome"), `${SITE_ORIGIN}${pathFor("start", "de")}`],
      [t("de", "seo.crumbStations"), `${SITE_ORIGIN}${pathFor("stations", "de")}`],
      ["Sachsen", `${SITE_ORIGIN}${pathFor("stations", "de")}?land=14`],
      ["Görlitz", `${SITE_ORIGIN}${placePath("de", "goerlitz")}`],
      ["Kleinhalt", `${SITE_ORIGIN}${path}`],
    ]);
    // the visible trail is the same one
    expect(stationCrumbs("de", "Kleinhalt", path, facts).map((c) => c.path)).toEqual(items.map(([, u]) => u!.slice(SITE_ORIGIN.length)));
    // a step the digest did not name is left out, never an empty crumb
    expect(stationCrumbs("de", "Kleinhalt", path, { ...facts, place: null, land: null }).map((c) => c.name)).toEqual([t("de", "seo.crumbHome"), t("de", "seo.crumbStations"), "Kleinhalt"]);
  });

  it("a mutant trail is refused: a step without an address, a gap in the positions, a foreign address", () => {
    const g = graph(facts);
    const list = g.find((n) => n["@type"] === "BreadcrumbList")!;
    const items = list["itemListElement"] as Record<string, unknown>[];
    const mutate = (f: (xs: Record<string, unknown>[]) => Record<string, unknown>[]): Record<string, unknown>[] => g.map((n) => (n === list ? { ...n, itemListElement: f(items.map((x) => ({ ...x }))) } : n));
    expect(validTrail(mutate((xs) => xs.map((x, i) => (i === 2 ? { ...x, item: undefined } : x))))).toBe(false);
    expect(validTrail(mutate((xs) => xs.map((x, i) => (i === 3 ? { ...x, position: 9 } : x))))).toBe(false);
    expect(validTrail(mutate((xs) => xs.map((x, i) => (i === 1 ? { ...x, item: "https://example.com/" } : x))))).toBe(false);
  });

  it("the TrainStation names its Land and its town page; the WebPage carries the record's Stand — and nothing live", () => {
    const g = graph(facts);
    const st = g.find((n) => n["@type"] === "TrainStation")!;
    expect((st["address"] as Record<string, unknown>)["addressRegion"]).toBe("Sachsen");
    expect(st["containedInPlace"]).toEqual({ "@type": "Place", name: "Görlitz", url: `${SITE_ORIGIN}${placePath("de", "goerlitz")}` });
    expect(g.find((n) => n["@type"] === "WebPage")!["dateModified"]).toBe(PAGE.stand.toISOString());
    // without the facts: no region, no town, no date — never a guess
    const bare = graph(null);
    expect(bare.find((n) => n["@type"] === "TrainStation")!["containedInPlace"]).toBeUndefined();
    expect(bare.find((n) => n["@type"] === "WebPage")!["dateModified"]).toBeUndefined();
    expect(JSON.stringify(g)).not.toMatch(/delay|Verspätung|departure|Abfahrt um/iu);
  });
});

describe("#1095 the AI-robot files name the station family", () => {
  it("llms.txt and llms-full.txt: the catalogue, an example page in English and German, the two sitemaps and what a page holds", () => {
    for (const body of [llmsTxt(), llmsFullTxt()]) {
      const line = body.split("\n").find((l) => l.startsWith("- Train stations: "));
      expect(line).toBeDefined();
      expect(line).toContain(`${SITE_ORIGIN}${pathFor("stations", "en")}`);
      expect(line).toContain(`${SITE_ORIGIN}${stationPath("en", "koeln-hbf")}`);
      expect(line).toContain(`${SITE_ORIGIN}${stationPath("de", "koeln-hbf")}`);
      expect(line).toContain(`${SITE_ORIGIN}${stationsSitemap("en")}`);
      expect(line).toContain(`${SITE_ORIGIN}${stationsSitemap("de")}`);
      expect(line).toContain("not crawlable");
    }
  });

  it("the MCP server card points at the llms.txt that describes the families and at the sitemap index that lists every page", () => {
    const meta = serverCard()._meta as Record<string, unknown>;
    expect(meta["de.viafrei/llms"]).toBe(`${SITE_ORIGIN}/llms.txt`);
    expect(meta["de.viafrei/sitemap"]).toBe(`${SITE_ORIGIN}${SITEMAP_INDEX}`);
  });

  it("robots.txt keeps no station page from any crawler; the fuel stays behind the fragment prefix in every group", () => {
    const robots = robotsTxt();
    const disallows = robots.split("\n").filter((l) => l.startsWith("Disallow: ")).map((l) => l.slice("Disallow: ".length));
    for (const lang of LIVE_LANGS) {
      const station = stationPath(lang, "koeln-hbf");
      expect(disallows.filter((d) => station.startsWith(d)), `${lang}: ${station}`).toEqual([]);
      expect(disallows.filter((d) => pathFor("stations", lang).startsWith(d))).toEqual([]);
    }
    const groups = robots.split(/\n\n/u).filter((g) => g.startsWith("User-agent: "));
    for (const g of groups) expect(g).toContain(`Disallow: ${FRAGMENT_DISALLOW}`);
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}${stationsSitemap("de")}`);
  });
});
