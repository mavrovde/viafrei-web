/**
 * The SEO sweep of #1020 (the last 2.3 issue), over every page the site
 * lists, in every live language:
 *
 *   1. titles and descriptions: non-empty, unique per language, a title of at
 *      most 60 characters (the home's is the brand line, owner rule #935,
 *      judged in `test/brand.test.ts`), a description of 70–160 — for the page
 *      map AND for every motorway page of the register and the popular towns;
 *   2. the counts the copy states equal the lists they count — the catalogue,
 *      the page map's languages, the motorway register, the assistants — read
 *      here independently, and no catalogue sentence types such a figure;
 *   3. the sitemaps list exactly the 200-answering pages of
 *      `scripts/site-pages.txt` (plus the place and motorway pages), never a
 *      redirect, a 404 or a `noindex` address, and their hreflang sets are
 *      reciprocal;
 *   4. llms.txt / llms-full.txt carry the catalogue's tools, prompts and
 *      resources, the MCP address and every assistant of the connect page;
 *   5. the JSON-LD of every page type carries the properties its type requires.
 *
 * The rendered half (each built page's head, canonical and reciprocal
 * hreflang) is `e2e/site.e2e.ts` "the SEO sweep, rendered (#1020)".
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { CONNECT_CLIENT_IDS, NOTE_CLIENTS, connectClients } from "../src/site/connect-clients.js";
import { assistantLines, llmsFullTxt, llmsTxt, robotsTxt } from "../src/site/discovery.js";
import { MCP_ENDPOINT, SITE_ORIGIN } from "../src/site/endpoints.js";
import { siteFacts } from "../src/site/facts.js";
import { DESCRIPTION_FIT_MIN, DESCRIPTION_MAX, TITLE_FIT, fitDescription, fitTitle, motorwayMeta, pageMeta, placeMeta } from "../src/site/meta.js";
import { MOTORWAY_REGISTER, motorwayPath } from "../src/site/motorways.js";
import { DEFAULT_LANG, LIVE_LANGS, PAGES, PAGE_IDS, pathFor, type Lang } from "../src/site/pages.js";
import { POPULAR_PLACES, placePath, popularSlug } from "../src/site/places.js";
import { ALL_SITEMAPS, motorwaysLangXml, placesLangXml } from "../src/site/sitemaps.js";
import { motorwayJsonLd, placeJsonLd, structuredData } from "../src/site/structured-data.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { LEGACY_FIXED } from "../src/lib/legacy-redirects.js";
import { NEWS_ENTRIES, homeNewsFor } from "../src/news/entries.js";
import { motorwayDescriptionOf, motorwayTitleOf, nowDescriptionOf, nowFacts } from "@viafrei/digest";
import { placeRoadsOf } from "../src/lib/place-head.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const I18N = join(ROOT, "packages", "web", "src", "i18n");

/** Long German town names, the worst case of a place title (the longest Gemeinde names of 10 000 people or more are about this long). */
const LONG_TOWNS = ["Mönchengladbach", "Villingen-Schwenningen", "Rheda-Wiedenbrück", "Garmisch-Partenkirchen", "Castrop-Rauxel"];

describe("1. every title and description, every page, every language (#1020)", () => {
  it("covers the whole map and every register motorway in every language — not a sample", () => {
    expect(LIVE_LANGS.length).toBeGreaterThanOrEqual(22);
    expect(MOTORWAY_REGISTER.length).toBeGreaterThan(100);
    expect(PAGE_IDS.length).toBeGreaterThanOrEqual(10);
  });
  for (const lang of LIVE_LANGS) {
    it(`${lang}: non-empty, unique, title ≤ ${String(TITLE_FIT)} (the home: the brand line), description ${String(DESCRIPTION_FIT_MIN)}–${String(DESCRIPTION_MAX)}`, () => {
      const metas: [string, { title: string; description: string }][] = [
        ...PAGE_IDS.filter((p) => p !== "404").map((p) => [p, pageMeta(p, lang)] as [string, { title: string; description: string }]),
        ...MOTORWAY_REGISTER.map((r) => [`motorway ${r}`, motorwayMeta(r, lang)] as [string, { title: string; description: string }]),
        ...[...POPULAR_PLACES.map((p) => p.name), ...LONG_TOWNS].map((n) => [`place ${n}`, placeMeta(n, lang)] as [string, { title: string; description: string }]),
      ];
      const titles = new Map<string, string>();
      const descriptions = new Map<string, string>();
      for (const [id, m] of metas) {
        expect(m.title.trim(), id).not.toBe("");
        if (id !== "start") expect(m.title.length, `${id}: ${m.title}`).toBeLessThanOrEqual(TITLE_FIT);
        expect(m.description.length, `${id}: ${m.description}`).toBeGreaterThanOrEqual(DESCRIPTION_FIT_MIN);
        expect(m.description.length, `${id}: ${m.description}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(`${m.title} ${m.description}`, id).not.toMatch(/\{\w+\}/);
        expect(titles.get(m.title), `${id}: the title of ${titles.get(m.title) ?? ""} too`).toBeUndefined();
        titles.set(m.title, id);
        // the dynamic pages share a template: their descriptions differ by the name they carry
        if (!id.startsWith("motorway ") && !id.startsWith("place ")) {
          expect(descriptions.get(m.description), `${id}: the description of ${descriptions.get(m.description) ?? ""} too`).toBeUndefined();
          descriptions.set(m.description, id);
        }
      }
      // the home's title is exactly the brand line (owner, #935)
      expect(pageMeta("start", lang).title).toBe(`ViaFrei – ${t(lang, "meta.tagline")}`);
    });
  }
  it("the fit shortens by structure, never mid-word: brand suffix, then list items, then the clause; whole sentences", () => {
    expect(fitTitle("Short – ViaFrei")).toBe("Short – ViaFrei");
    expect(fitTitle("Mönchengladbach live: jams, roadworks, parking, charging, fuel – ViaFrei")).toBe("Mönchengladbach live: jams, roadworks, parking, charging");
    expect(fitTitle("Postos de combustível por estado federado – uma seleção com preços — ViaFrei")).toBe("Postos de combustível por estado federado");
    const long = "First sentence is here and long enough to stand alone as a description. Second sentence adds more words. Third sentence would push it over the bound of one hundred and sixty.";
    expect(fitDescription(long)).toBe("First sentence is here and long enough to stand alone as a description. Second sentence adds more words.");
    const one = `${"word ".repeat(40)}end.`;
    const cut = fitDescription(one);
    expect(cut.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(cut.endsWith("word…")).toBe(true);
  });
  it("the two legal pages no longer share the site's description", () => {
    for (const l of LIVE_LANGS) expect(pageMeta("impressum", l).description).not.toBe(pageMeta("datenschutz", l).description);
  });
});

describe("2. the copy's counts are the lists they count (#1020)", () => {
  const facts = siteFacts();
  it("the facts are counted from the catalogue, the page map, the register and the connect page — read here independently", () => {
    const cat = JSON.parse(readFileSync(join(ROOT, "packages", "web", "src", "generated", "catalogue.json"), "utf8")) as { tools: unknown[]; prompts: unknown[]; resources: unknown[]; credits: unknown[] };
    expect(facts.tools).toBe(cat.tools.length);
    expect(facts.prompts).toBe(cat.prompts.length);
    expect(facts.resources).toBe(cat.resources.length);
    expect(facts.credits).toBe(cat.credits.length);
    const reviewed = (readFileSync(join(I18N, "locales.ts"), "utf8").match(/reviewed: true/g) ?? []).length;
    expect(facts.languages).toBe(reviewed);
    expect(facts.motorways).toBe(MOTORWAY_REGISTER.length);
    expect(facts.assistants).toBe(NOTE_CLIENTS.length);
    // a floor, not a pin (a lane may add one): 24 tools at 2.5.8, 9 prompts, 10 resources
    expect(facts.tools).toBeGreaterThanOrEqual(24);
    expect(facts.prompts).toBeGreaterThanOrEqual(9);
    expect(facts.resources).toBeGreaterThanOrEqual(10);
  });
  it("llms.txt and llms-full.txt state each count as the list beside it has it", () => {
    for (const txt of [llmsTxt(), llmsFullTxt()]) {
      expect(txt).toContain(`## Tools (${String(facts.tools)}`);
      expect(txt).toContain(`in ${String(facts.languages)} languages`);
      expect(txt).toContain(`lists all ${String(facts.motorways)} motorways`);
      expect(txt).toContain(`(${String(facts.credits)} credit lines today)`);
      expect(txt).toContain(`Which ${String(facts.tools)} tools does ViaFrei have?`);
    }
    expect(llmsTxt()).toContain(`## Prompts (${String(facts.prompts)})`);
    expect(llmsTxt()).toContain(`## Resources (${String(facts.resources)})`);
  });
  it("no catalogue sentence types a count of tools, prompts, resources, sources, languages, motorways or assistants", () => {
    const words = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(tools?|prompts?|resources?|sources?|credit lines?|languages?|motorways?|assistants?|Werkzeuge?|Quellen?|Sprachen|Autobahnen|Assistenten)\b/iu;
    for (const lang of ["en", "de"] as const) {
      const flat: string[] = [];
      const walk = (x: unknown): void => {
        if (typeof x === "string") flat.push(x);
        else if (x !== null && typeof x === "object") for (const v of Object.values(x)) walk(v);
      };
      walk(JSON.parse(readFileSync(join(I18N, `${lang}.json`), "utf8")));
      expect(flat.length).toBeGreaterThan(500);
      for (const s of flat) expect(s, `${lang}: ${s}`).not.toMatch(words);
    }
  });
});

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
type Row = { route: string; flags: string };
const pageRows = (): Row[] =>
  readFileSync(join(ROOT, "scripts", "site-pages.txt"), "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => {
      const c = l.split(/\s+/);
      return { route: c[0]!, flags: c[3] ?? "" };
    });

describe("3. the sitemaps list exactly the pages that answer 200 (#1020)", () => {
  const rows = pageRows();
  // #1111: the search page answers 200 and is probed, but is `noindex, follow` and listed in no sitemap (`site/search.ts`)
  const html200 = rows.filter((r) => (r.flags === "page" || r.flags === "identity") && r.route !== "/" && !/\.(txt|xml|json)$|^\/\.well-known\//.test(r.route) && !/^\/[a-z]{2}\/search$/.test(r.route)).map((r) => `${SITE_ORIGIN}${r.route}`);
  const redirects = new Set(rows.filter((r) => r.flags.startsWith("redirect=")).map((r) => `${SITE_ORIGIN}${r.route}`));
  it("sitemap.xml lists every page row of site-pages.txt (but the negotiated `/` and the files) and nothing else", () => {
    expect(html200.length).toBeGreaterThanOrEqual(9 * LIVE_LANGS.length);
    expect([...locs(sitemapXml())].sort()).toEqual([...html200].sort());
  });
  it("no sitemap lists a redirect, the 404, a noindex variant or a fragment", () => {
    const all = [...locs(sitemapXml()), ...LIVE_LANGS.flatMap((l) => locs(placesLangXml(l, POPULAR_PLACES.map(popularSlug)))), ...LIVE_LANGS.flatMap((l) => locs(motorwaysLangXml(l, MOTORWAY_REGISTER)))];
    expect(all.length).toBeGreaterThan(MOTORWAY_REGISTER.length * LIVE_LANGS.length);
    for (const u of all) {
      expect(redirects.has(u), `${u} is a redirect`).toBe(false);
      expect(LEGACY_FIXED.some((f) => `${SITE_ORIGIN}${f.from}` === u), `${u} is a legacy 301`).toBe(false);
      expect(u, "a 404, a query (noindex variant) or a fragment").not.toMatch(/\/404$|\?|#|\/fragment\//);
    }
    for (const l of LIVE_LANGS) expect(all).not.toContain(`${SITE_ORIGIN}${pathFor("404", l)}`);
  });
  it("the place and motorway sitemaps hold the place and motorway pages, one per page and language", () => {
    for (const l of LIVE_LANGS) {
      expect(locs(motorwaysLangXml(l, MOTORWAY_REGISTER))).toEqual(MOTORWAY_REGISTER.map((r) => `${SITE_ORIGIN}${motorwayPath(l, r)}`));
      expect(locs(placesLangXml(l, ["koeln"]))).toEqual([`${SITE_ORIGIN}${placePath(l, "koeln")}`]);
    }
  });
  it("hreflang is reciprocal in every sitemap that carries it (pages, motorways): each page's alternates are the same set from every language, and include the page itself", () => {
    const alternatesByLoc = new Map<string, string[]>();
    // the place, exit and station files list address and lastmod only (2.4.2); their alternates are in each page's head
    for (const xml of [sitemapXml(), ...LIVE_LANGS.map((l) => motorwaysLangXml(l, ["A7", "A100"]))]) {
      for (const u of xml.split("<url>").slice(1)) {
        const loc = /<loc>([^<]+)<\/loc>/.exec(u)![1]!;
        alternatesByLoc.set(loc, [...u.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]!} ${m[2]!}`));
      }
    }
    expect(alternatesByLoc.size).toBeGreaterThan(10 * LIVE_LANGS.length);
    for (const [loc, alts] of alternatesByLoc) {
      // the page names itself under its OWN language (x-default alone is not a self-reference), and every live language once
      const own = /^https:\/\/viafrei\.de\/([a-z]{2})(?:\/|$)/.exec(loc)?.[1] ?? DEFAULT_LANG;
      expect(alts, `${loc} lists itself as ${own}`).toContain(`${own} ${loc}`);
      expect(alts, loc).toHaveLength(LIVE_LANGS.length + 1);
      expect(alts.filter((a) => a.startsWith("x-default "))).toHaveLength(1);
      for (const a of alts) {
        const href = a.split(" ")[1]!;
        const back = alternatesByLoc.get(href);
        expect(back, `${loc} → ${href} is listed`).toBeDefined();
        expect(back, `${href} names ${loc} back with the same set`).toEqual(alts);
      }
    }
  });
  it("robots.txt names every sitemap and keeps the fuel pages — no longer the place pages (#1065) — off the corpus crawlers", () => {
    const txt = robotsTxt();
    // every sitemap the site serves, spelt out here rather than read from ALL_SITEMAPS, so a file dropped from that list is red
    const served = ["/sitemap-index.xml", "/sitemap.xml", "/sitemap-places.xml", ...LIVE_LANGS.flatMap((l) => [`/sitemap-places-${l}.xml`, `/sitemap-motorways-${l}.xml`, `/sitemap-exits-${l}.xml`, `/sitemap-stations-${l}.xml`, `/sitemap-roads-${l}.xml`, `/sitemap-states-${l}.xml`]), "/sitemap-charging.xml"];
    for (const s of served) expect(txt).toContain(`Sitemap: ${SITE_ORIGIN}${s}\n`);
    // #1167 S1: no fuel sitemap — a list of every fuel station's page is the MTS-K station set
    expect(txt).not.toContain("sitemap-fuel");
    expect([...ALL_SITEMAPS].sort()).toEqual([...served].sort());
    const ccbot = `${txt.split("User-agent: CCBot\n")[1]!.split("\n\n")[0]!}\n`;
    for (const l of LIVE_LANGS) {
      expect(ccbot).toContain(`Disallow: ${pathFor("fuel", l)}\n`);
      expect(ccbot).not.toContain(`/${l}/place/`);
    }
    // the default group keeps every page open
    expect(txt.split("User-agent: *\n")[1]!.split("\n\n")[0]).not.toMatch(/Disallow: \/(?!fragment\/|\*\/search[$?]$)/m);
  });
});

describe("4. llms.txt and llms-full.txt come from the catalogue and the connect page (#1020)", () => {
  it("the short file names every tool, prompt and resource; the full file carries each one's line", () => {
    const short = llmsTxt();
    const full = llmsFullTxt();
    for (const x of catalogue.tools) {
      expect(short).toContain(`\`${x.name}\``);
      expect(full).toContain(`- \`${x.name}\` — ${x.title}: `);
    }
    for (const x of catalogue.prompts) {
      expect(short).toContain(`\`${x.name}\``);
      expect(full).toContain(`- \`${x.name}\`: `);
    }
    for (const x of catalogue.resources) {
      expect(short).toContain(`\`${x.uri}\``);
      expect(full).toContain(`- \`${x.uri}\`: ${x.name}`);
    }
    for (const c of catalogue.credits) expect(full, c.id).toContain(c.url);
  });
  it("both carry the MCP address and every assistant of the connect page with its steps, in the page's order", () => {
    const clients = connectClients("en").filter((c) => c.id !== "generic");
    expect(clients.length).toBe(CONNECT_CLIENT_IDS.length - 1);
    for (const txt of [llmsTxt(), llmsFullTxt()]) {
      expect(txt).toContain(`- Endpoint (Streamable HTTP): ${MCP_ENDPOINT}`);
      const lines = txt.split("\n").filter((l) => clients.some((c) => l.startsWith(`- ${c.name}: `)));
      expect(lines.map((l) => clients.find((c) => l.startsWith(`- ${c.name}: `))!.id)).toEqual(clients.map((c) => c.id));
      for (const c of clients) if (c.code !== undefined && !c.code.startsWith("{")) expect(txt, c.id).toContain(`\`${c.code}\``);
      for (const n of NOTE_CLIENTS) expect(txt, n.name).toContain(n.name);
      expect(txt).not.toContain("the address above");
    }
    expect(assistantLines()).toHaveLength(clients.length);
  });
  it("lists the newest shipped News entries, each linking its permalink", () => {
    const txt = llmsTxt();
    expect(txt).toMatch(/^## New on ViaFrei/m);
    expect(txt).toMatch(new RegExp(`^- \\[[^\\]]+\\]\\(${SITE_ORIGIN.replace(/\./g, "\\.")}/en/news#[a-z0-9-]+\\)`, "m"));
  });
});

type Node = Record<string, unknown> & { "@type": string };
/** The properties each type must carry — schema.org's and Google's rich-result minimum for the type as we use it. */
const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  Organization: ["@id", "name", "url", "logo"],
  WebSite: ["@id", "name", "url", "inLanguage", "publisher"],
  SoftwareApplication: ["@id", "name", "description", "url", "applicationCategory", "operatingSystem", "offers", "isAccessibleForFree"],
  WebPage: ["@id", "url", "name", "description", "inLanguage", "isPartOf", "breadcrumb"],
  BreadcrumbList: ["@id", "itemListElement"],
  Place: ["@id", "name", "address"],
  // #1077: a motorway, which schema.org has no type for
  Thing: ["@id", "name", "additionalType", "url"],
};

describe("5. JSON-LD: every node carries what its type requires (#1020)", () => {
  const graphs = (lang: Lang): [string, Node[]][] => [
    ...PAGE_IDS.filter((p) => p !== "fuel").map((p) => [p, structuredData(p, lang, "2.3.23")["@graph"] as Node[]] as [string, Node[]]),
    ["motorway", (JSON.parse(motorwayJsonLd(lang, "A7", motorwayPath(lang, "A7"))) as { "@graph": Node[] })["@graph"]],
    ["place", (JSON.parse(placeJsonLd(lang, "Köln", placePath(lang, "koeln"))) as { "@graph": Node[] })["@graph"]],
  ];
  for (const lang of LIVE_LANGS) {
    it(`${lang}: each node has its required properties, non-empty; breadcrumbs are positioned ListItems ending at the page`, () => {
      for (const [id, g] of graphs(lang)) {
        for (const n of g) {
          const req = REQUIRED[n["@type"]];
          expect(req, `${id}: ${n["@type"]} is a known type`).toBeDefined();
          for (const k of req!) expect(n[k] !== undefined && n[k] !== "" && n[k] !== null, `${id} ${n["@type"]}.${k}`).toBe(true);
          if (n["@type"] === "SoftwareApplication") expect(n["offers"]).toMatchObject({ "@type": "Offer", price: "0", priceCurrency: "EUR" });
          if (n["@type"] === "BreadcrumbList") {
            const items = n["itemListElement"] as { "@type": string; position: number; name: string; item: string }[];
            expect(items.length, id).toBeGreaterThanOrEqual(2);
            items.forEach((x, i) => {
              expect(x).toMatchObject({ "@type": "ListItem", position: i + 1 });
              expect(x.name.trim()).not.toBe("");
              expect(x.item.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
            });
            expect(items[0]!.item).toBe(`${SITE_ORIGIN}${pathFor("start", lang)}`);
          }
        }
      }
      // the motorway and place pages carry breadcrumbs (#1020 AC: BreadcrumbList on both)
      for (const id of ["motorway", "place", "motorways"]) expect(graphs(lang).find(([x]) => x === id)![1].some((n) => n["@type"] === "BreadcrumbList"), id).toBe(true);
      expect(graphs(lang).find(([x]) => x === "start")![1].some((n) => n["@type"] === "SoftwareApplication")).toBe(true);
    });
  }
  it("the canonical page of every graph is the page's own address in its language", () => {
    for (const lang of LIVE_LANGS) {
      const app = (structuredData("connect", lang, undefined)["@graph"] as Node[]).find((n) => n["@type"] === "SoftwareApplication")!;
      expect(app["mainEntityOfPage"]).toBe(`${SITE_ORIGIN}${pathFor("connect", lang)}`);
      const page = (JSON.parse(motorwayJsonLd(lang, "A7", motorwayPath(lang, "A7"))) as { "@graph": Node[] })["@graph"].find((n) => n["@type"] === "WebPage")!;
      expect(page["url"]).toBe(`${SITE_ORIGIN}${motorwayPath(lang, "A7")}`);
    }
    expect(PAGES.find((p) => p.id === "start")).toBeDefined();
    expect(DEFAULT_LANG).toBe("de");
  });
});

describe("6. the 2.3 News entry (#1020)", () => {
  it("summarises the line in every live language, states no figure but its version, and leads the home's News strip", () => {
    const e = NEWS_ENTRIES.find((x) => x.id === "viafrei-2-3");
    expect(e).toBeDefined();
    expect(e!.kind).toBe("new");
    expect(e!.issue).toBe(1020);
    for (const l of LIVE_LANGS) {
      const x = e!.text[l];
      expect(x, l).toBeDefined();
      for (const f of [x!.title, x!.body]) expect(f.replace(/2\.3|A3/g, ""), `${l}: no typed figure`).not.toMatch(/\d/);
      // the address is on the connect page; a Latin-script URL in a Cyrillic or Greek sentence breaks one-language-per-page (#449)
      expect(x!.body, l).toContain("ChatGPT");
      expect(x!.body, l).not.toContain("mcp.viafrei.de");
      expect(homeNewsFor(l)[0]?.id, l).toBe("viafrei-2-3");
    }
  });
});

/** A live read as the motorway page holds it: only the fields the description reads are meaningful. */
type Live = Parameters<typeof nowFacts>[0];
const liveOf = (rows: { closures?: (string | null)[]; jams?: (string | null)[]; roadworks?: (string | null)[] }): Live => {
  const item = (section: string | null): Record<string, unknown> => ({ kind: "closure", blocked: false, section, what: null, direction: null, delaySeconds: null, at: null, segments: 1, directions: [], copies: 1 });
  const c = rows.closures ?? [];
  const j = rows.jams ?? [];
  const r = rows.roadworks ?? [];
  const counts = { closures: c.length, jams: j.length, warnings: 0, roadworks: r.length };
  return { state: "live", asOf: new Date(0), counts, toolCounts: counts, closures: c.map(item), jams: j.map(item), warnings: [], roadworks: r.map(item), moreClosures: 0, moreRoadworks: 0, moreJams: 0, header: null } as unknown as Live;
};
const A24 = liveOf({ closures: ["AS Hamburg-Jenfeld - AS Hamburg-Horn"], roadworks: ["Horner Kreisel - AS Hamburg-Jenfeld", "AS Reinbek - AS Witzhave"], jams: ["AS Witzhave - AS Schwarzenbek/Grande"] });
const QUIET = { state: "quiet", asOf: new Date(0) } as unknown as Live;
const STALE = { state: "stale", asOf: new Date(0) } as unknown as Live;
const DIGEST_LANGS = LIVE_LANGS as unknown as readonly Parameters<typeof nowDescriptionOf>[0][];
/** The page's clock beside the read's `asOf` (both the epoch: the Stand reads 01:00 in Berlin). */
const AT = new Date(0);
/** #1110: a first clause that is an item of a list of works — "Baustelle X – Y", in any language's item word or a bare stretch. */
const LIST_ITEM_FIRST = /^(Sperrung|Stau|Baustelle|closure|jam|roadworks)\s|^[^:\d]+ – [^:\d]+$/iu;

describe("7. place and motorway snippets match what searchers type (#1020 round 2, the Search Console baseline)", () => {
  it("the motorway title keeps the live pattern: the road first, then the state words of its language, ≤ 60 once fitted", () => {
    for (const lang of DIGEST_LANGS) {
      for (const road of MOTORWAY_REGISTER) {
        const title = motorwayTitleOf(lang, { road, course: true });
        expect(new RegExp(`(^|\\s)${road}(\\s|:|$)`).test(title), `${lang} ${road}: ${title}`).toBe(true);
        expect(fitTitle(title).length, `${lang} ${road}`).toBeLessThanOrEqual(60);
      }
    }
    expect(motorwayTitleOf("de", { road: "A24", course: true })).toBe("A24 Stau aktuell: Baustellen, Sperrung, Karte – ViaFrei");
  });
  it("#1110: the description LEADS with today's counts and the Berlin Stand — the page's own first line; German then names the stretches, closures first, as many as fit", () => {
    const d = nowDescriptionOf("de", { road: "A24", now: nowFacts(A24, AT) })!;
    expect(d.startsWith("Jetzt auf der A24 gemeldet: 1 Sperrung, 1 Stau, 2 Baustellen (Stand 01:00). Sperrung Hamburg-Jenfeld – Hamburg-Horn; ")).toBe(true);
    expect(d).toContain("Stau Witzhave – Schwarzenbek/Grande");
    // the third stretch does not fit beside the lead: left out whole, never cut
    expect(d).toBe("Jetzt auf der A24 gemeldet: 1 Sperrung, 1 Stau, 2 Baustellen (Stand 01:00). Sperrung Hamburg-Jenfeld – Hamburg-Horn; Stau Witzhave – Schwarzenbek/Grande.");
    expect(d.length).toBeLessThanOrEqual(158);
    // the description the fragment carries is this one whenever the page holds a live read
    expect(motorwayDescriptionOf("de", { road: "A24", course: true, ends: null, km: null, lands: [], junctions: null, interchanges: null, gaps: [], now: nowFacts(A24, AT) })).toBe(d);
  });
  it("#1110: no description's first clause is a list item — every language, active, many, quiet: it holds the road, a figure and the Stand", () => {
    const many = liveOf({ closures: Array.from({ length: 20 }, (_, i) => `AS Langer-Anschlussstellenname-${String(i)} - AS Noch-ein-langer-Name-${String(i)}`) });
    for (const lang of DIGEST_LANGS) {
      for (const live of [A24, many, QUIET, liveOf({}), liveOf({ jams: [null] })]) {
        const d = nowDescriptionOf(lang, { road: "A100", now: nowFacts(live, AT) })!;
        const first = d.split(/\)\.\s|;\s/u)[0]!;
        expect(first, `${lang}: ${d}`).not.toMatch(LIST_ITEM_FIRST);
        expect(first, `${lang}: ${d}`).toContain("A100");
        expect(first, `${lang}: ${d}`).toMatch(/0?1[:.]00/u);
        if (live !== QUIET && live.state === "live" && (live.counts.closures + live.counts.jams + live.counts.roadworks) > 0) expect(first.replace("A100", "").replace(/0?1[:.]00/u, ""), `${lang}: ${d}`).toMatch(/\d/u);
        expect(d.length, `${lang}: ${d}`).toBeLessThanOrEqual(158);
        expect(d.length, `${lang}: ${d}`).toBeGreaterThanOrEqual(50);
      }
    }
    // the refusal itself refuses the shape #1110 found on prod
    expect("Baustelle Hagenow – Wöbbelin; Baustelle Meyenburg – Pritzwalk").toMatch(LIST_ITEM_FIRST);
  });
  it("as many as fit: twenty active stretches still give one German description within the bound, never a cut name", () => {
    const many = liveOf({ closures: Array.from({ length: 20 }, (_, i) => `AS Langer-Anschlussstellenname-${String(i)} - AS Noch-ein-langer-Name-${String(i)}`) });
    expect(nowDescriptionOf("de", { road: "A100", now: nowFacts(many, AT) })).toMatch(/^Jetzt auf der A100 gemeldet: 20 Sperrungen, 0 Staus, 0 Baustellen \(Stand 01:00\)\. Sperrung Langer-Anschlussstellenname-0 – Noch-ein-langer-Name-0[;.]/);
  });
  it("every other language names the counts and no German place (#449), the tail added when it fits", () => {
    for (const lang of DIGEST_LANGS.filter((l) => l !== "de")) {
      const d = nowDescriptionOf(lang, { road: "A100", now: nowFacts(A24, AT) })!;
      expect(d, lang).not.toMatch(/Jenfeld|Horn|Witzhave|Kreisel/);
    }
    expect(nowDescriptionOf("en", { road: "A24", now: nowFacts(A24, AT) })).toBe("Reported on the A24 now: 1 closure, 1 jam, 2 roadworks (as of 01:00).");
    // the tail where it fits: a shorter road leaves room in a language whose lead is short
    expect(DIGEST_LANGS.some((l) => nowDescriptionOf(l, { road: "A1", now: nowFacts(QUIET, AT) })!.length > 90)).toBe(true);
  });
  it("nothing active is said truthfully with its Stand; a stale read says nothing about now and keeps the static description", () => {
    for (const lang of DIGEST_LANGS) {
      const q = nowDescriptionOf(lang, { road: "A100", now: nowFacts(QUIET, AT) })!;
      expect(nowDescriptionOf(lang, { road: "A100", now: nowFacts(liveOf({}), AT) }), lang).toBe(q);
      // the snippet is about now: no map or facilities promise (the A34 has no map)
      expect(q, lang).not.toMatch(/Karte|\bmap\b|карт|hart|harita|Rastpl|Ladesäul|rest area|charger/iu);
    }
    expect(nowDescriptionOf("de", { road: "A24", now: nowFacts(QUIET, AT) })).toBe("Auf der A24 ist derzeit nichts gemeldet (Stand 01:00). Jede Meldung mit Anschlussstellen, Richtung und Stand, live aus den Daten der Autobahn GmbH.");
    expect(nowFacts(STALE, AT)).toBeNull();
    expect(nowDescriptionOf("de", { road: "A24", now: null })).toBeNull();
  });
  it("the place title holds the place and the state words; the description names the roads the cards list", () => {
    for (const lang of LIVE_LANGS) {
      const m = placeMeta("Nideggen", lang, ["L249", "A4", "B265"]);
      expect(m.title.startsWith("Nideggen"), `${lang}: ${m.title}`).toBe(true);
      expect(m.title.length, lang).toBeLessThanOrEqual(60);
      expect(m.description.startsWith("Nideggen"), `${lang}: ${m.description}`).toBe(true);
      for (const r of ["L249", "A4", "B265"]) expect(m.description, `${lang} ${r}`).toContain(r);
      expect(m.description.length, lang).toBeLessThanOrEqual(160);
      expect(m.description.length, lang).toBeGreaterThanOrEqual(70);
      // no road listed: the place's general description, never an empty list
      expect(placeMeta("Nideggen", lang).description).toBe(placeMeta("Nideggen", lang, []).description);
    }
    expect(placeMeta("Köln", "de").title).toBe("Köln: Sperrungen, Baustellen, Verkehr aktuell – ViaFrei");
    // a longer name: the brand is dropped first, the state words stay (fitTitle)
    expect(placeMeta("Friesoythe", "de").title).toBe("Friesoythe: Sperrungen, Baustellen, Verkehr aktuell");
    expect(placeMeta("Nideggen", "de", ["L249", "A4"]).description).toBe("Nideggen: Sperrungen und Baustellen aktuell auf L249 und A4 – dazu Stau, Parken, Ladesäulen und Warnungen, live aus offenen Daten mit Quelle.");
  });
  it("as many roads as fit, in the cards' order", () => {
    const roads = Array.from({ length: 30 }, (_, i) => `B${String(100 + i)}`);
    for (const lang of LIVE_LANGS) {
      const d = placeMeta("Villingen-Schwenningen", lang, roads).description;
      expect(d.length, lang).toBeLessThanOrEqual(160);
      expect(d, lang).toContain("B100");
    }
  });
  it("the roads are read off the cards' shields, in order, each once, and only road numbers", () => {
    const html = '<a class="shield" href="/de/autobahn/a9" translate="no">A9</a> x <span class="shield shield--b">B96</span> <a class="shield" href="/de/autobahn/a9">A9</a> <span class="shield">L249</span> <span class="shield">Ampel</span> <span class="notshield">A1</span>';
    expect(placeRoadsOf(html)).toEqual(["A9", "B96", "L249"]);
    expect(placeRoadsOf("<p>keine Straße</p>")).toEqual([]);
  });
  it("the canonical motorway address is /autobahn: no sitemap, hreflang or llms file names a /motorway address", () => {
    const all = [sitemapXml(), ...LIVE_LANGS.map((l) => motorwaysLangXml(l, MOTORWAY_REGISTER)), ...LIVE_LANGS.map((l) => placesLangXml(l, ["koeln"])), llmsTxt(), llmsFullTxt()].join("\n");
    expect(all).toContain("/autobahn/a24");
    expect(all).not.toMatch(/viafrei\.de\/[a-z]{2}\/motorway/);
    for (const l of LIVE_LANGS) expect(motorwayPath(l, "A24")).toBe(`/${l}/autobahn/a24`);
  });
});
