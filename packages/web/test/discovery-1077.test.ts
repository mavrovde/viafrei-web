/**
 * #1077: the files AI crawlers and assistants read — complete (every page family, an English and a German example),
 * current (no number typed beside the thing it counts), honest about what a crawler cannot read, the robots groups
 * the person gate's list, the server card the server's, and every family's JSON-LD a valid schema.org shape (an
 * offline parse and shape check; the Rich Results test is run from prod once per release).
 */
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { t } from "../src/i18n/index.js";
import { CORPUS_CRAWLERS, CRAWLERS_CHECKED, ROBOTS_CRAWLERS } from "../src/site/crawlers.js";
import { AI_CRAWLERS, CORPUS_DISALLOW, FRAGMENT_DISALLOW, NEWS_IN_LLMS, PAGE_FAMILIES, PLACE_SITEMAP_MIN_POPULATION, llmsFullTxt, llmsTxt, newsLines, robotsTxt, serverCard } from "../src/site/discovery.js";
import { MOTORWAY_REGISTER } from "../src/site/motorways.js";
import { ALL_SITEMAPS, SITEMAP_LANGS } from "../src/site/sitemaps.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { LIVE_LANGS, PAGES, pathFor, type Lang, type PageId } from "../src/site/pages.js";
import { MOTORWAY_ADDITIONAL_TYPE, exitJsonLd, motorwayJsonLd, placeJsonLd, stationJsonLd, structuredData } from "../src/site/structured-data.js";
import { PLACE_PAGE_MIN_POPULATION } from "../../../.pinned/app/packages/digest/dist/src/server/place-service.js";
import { SERVER_VERSION } from "../../../.pinned/app/packages/mcp/dist/src/server/server.js";

const FILES = [["llms.txt", llmsTxt()], ["llms-full.txt", llmsFullTxt()]] as const;
const section = (txt: string, h: string): string[] => {
  const lines = txt.split("\n");
  const i = lines.indexOf(`## ${h}`);
  if (i < 0) return [];
  const end = lines.findIndex((l, k) => k > i && l.startsWith("## "));
  return lines.slice(i + 1, end < 0 ? undefined : end).filter((l) => l !== "");
};

describe("#1077 (1) complete: every page family, an English and a German example each", () => {
  it("every page of the map but the 404 is in exactly one family", () => {
    const ids = PAGES.filter((p) => p.id !== "404").map((p) => p.id);
    const covered = PAGE_FAMILIES.flatMap((f) => f.pages);
    expect([...covered].sort()).toEqual([...ids].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });
  it("the dynamic families are there: a town, a motorway, a stretch, a junction, a station, a Bundesstraße, a Landesstraße (#1027) and a Land (#1074)", () => {
    const dyn = PAGE_FAMILIES.filter((f) => f.pages.length === 0).map((f) => f.example("en"));
    expect(dyn).toEqual(["/en/place/koeln", "/en/autobahn/a7", "/en/autobahn/a7/nesselwang-to-kempten", "/en/autobahn/a7/exit-138-nesselwang", "/en/station/koeln-hbf", "/en/road/b51", "/en/road/nw/l249", "/en/state/bayern"]);
  });
  for (const [name, txt] of FILES) {
    it(`${name}: one line per family with both examples, /terms included`, () => {
      const lines = section(txt, "Page families");
      expect(lines).toHaveLength(PAGE_FAMILIES.length);
      PAGE_FAMILIES.forEach((f, i) => {
        expect(lines[i], f.name).toContain(`${SITE_ORIGIN}${f.example("en")} — Deutsch: ${SITE_ORIGIN}${f.example("de")}`);
      });
      expect(txt).toContain(`${SITE_ORIGIN}${pathFor("terms", "en")}`);
    });
  }
  it("llms-full.txt says what each family answers, and names only tools the server registers", () => {
    const lines = section(llmsFullTxt(), "Page families");
    const tools = new Set(catalogue.tools.map((x) => x.name));
    PAGE_FAMILIES.forEach((f, i) => {
      expect(lines[i], f.name).toContain(f.answers);
      for (const x of f.tools) {
        expect(tools.has(x), x).toBe(true);
        expect(lines[i], f.name).toContain(`\`${x}\``);
      }
    });
    // the legal family names its other two pages too
    expect(lines.at(-1)).toContain(`${SITE_ORIGIN}${pathFor("impressum", "en")}`);
    expect(lines.at(-1)).toContain(`${SITE_ORIGIN}${pathFor("datenschutz", "en")}`);
    // the short file stays short: no tool list per family
    for (const l of section(llmsTxt(), "Page families")) expect(l).not.toContain("the same answer");
  });
});

describe("#1077 (2) current: no number typed beside what it counts", () => {
  for (const [name, txt] of FILES) {
    it(`${name}: the languages are counted, the motorway fuel line says "load only in a reader's browser"`, () => {
      expect(txt).not.toMatch(/\bfive more languages\b|\bseven languages\b/u);
      expect(txt).not.toMatch(/on a click/u);
      const mw = txt.split("\n").find((l) => l.startsWith("- One motorway: "));
      expect(mw).toContain("Fuel prices along a motorway load only in a reader's browser and are not crawlable");
    });
  }
  it("llms-full.txt counts the other languages from the language list", () => {
    expect(llmsFullTxt()).toContain(`English and German; ${String(LIVE_LANGS.length - 2)} more languages each, linked from every page; the sitemaps list English and German`);
  });
  it("the place sitemap threshold is the digest's", () => {
    expect(PLACE_SITEMAP_MIN_POPULATION).toBe(PLACE_PAGE_MIN_POPULATION);
  });
});

describe("#1077 (3) what is not for crawlers, and why", () => {
  for (const [name, txt] of FILES) {
    it(`${name}: the fragments, the fuel boards, the SID occupancy, and no training offer`, () => {
      const lines = section(txt, "Not for crawlers").join("\n");
      expect(lines).toContain(`${FRAGMENT_DISALLOW} is disallowed to every crawler`);
      expect(lines).toContain("consumer information");
      expect(lines).toContain(`${SITE_ORIGIN}${pathFor("fuel", "en")}`);
      expect(lines).toContain("Toll Collect SID");
      expect(lines).toContain(`${SITE_ORIGIN}${pathFor("terms", "en")}`);
      expect(lines).toContain("Nothing on these pages is offered for training");
    });
  }
});

describe("#1077 (4) robots.txt", () => {
  const txt = robotsTxt();
  it("every token of the person gate's list has a group, and every group's token is on it", () => {
    const uas = txt.split("\n").filter((l) => l.startsWith("User-agent: ")).map((l) => l.slice(12)).filter((u) => u !== "*");
    expect([...uas].sort()).toEqual([...ROBOTS_CRAWLERS].sort());
  });
  it("the operators' current tokens are named (checked against their pages on CRAWLERS_CHECKED)", () => {
    expect(CRAWLERS_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    for (const ua of ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "Google-Extended", "PerplexityBot", "Perplexity-User", "Applebot", "Applebot-Extended", "meta-externalagent", "meta-externalfetcher", "CCBot", "Bytespider", "Amazonbot", "Amzn-SearchBot", "Amzn-User", "DuckAssistBot", "MistralAI-User", "MistralAI-Index", "MistralAI-Training"]) {
      expect(AI_CRAWLERS as readonly string[], ua).toContain(ua);
    }
  });
  it("points at llms.txt and every sitemap", () => {
    expect(txt.split("\n")[0]).toContain(`${SITE_ORIGIN}/llms.txt`);
    expect(txt.split("\n").filter((l) => l.startsWith("Sitemap: ")).length).toBeGreaterThan(0);
  });
});

describe("#1077 (5) the MCP card and llms.txt describe the same build", () => {
  it("the card's version is this tree's server, the catalogue's release; llms names every tool the server lists", () => {
    expect(serverCard().version).toBe(SERVER_VERSION);
    expect(catalogue.release.version).toBe(SERVER_VERSION);
    expect(llmsFullTxt()).toContain(`release ${SERVER_VERSION}`);
    for (const x of catalogue.tools) {
      expect(llmsTxt(), x.name).toContain(`\`${x.name}\``);
      expect(llmsFullTxt(), x.name).toContain(`- \`${x.name}\` — `);
    }
    expect(llmsTxt()).toContain(`## Tools (${String(catalogue.tools.length)})`);
  });
});

/** schema.org types the site's graphs may use, and what each must carry. */
const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  Organization: ["@id", "name", "url", "description", "logo"],
  WebSite: ["@id", "name", "url", "potentialAction"],
  WebPage: ["@id", "url", "name", "isPartOf"],
  BreadcrumbList: ["@id", "itemListElement"],
  Place: ["@id", "name", "address"],
  TrainStation: ["@id", "name", "address"],
  Thing: ["@id", "name", "additionalType", "url"],
  SoftwareApplication: ["@id", "name"],
  FAQPage: ["mainEntity"],
  CreativeWork: ["name", "url"],
};
type Node = Record<string, unknown>;

/** The offline check: parses, every node a known type with its required fields, every reference resolves. */
function check(json: string, lang: Lang, where: string): Node[] {
  const doc = JSON.parse(json) as { "@context": string; "@graph": Node[] };
  expect(doc["@context"], where).toBe("https://schema.org");
  const g = doc["@graph"];
  const ids = new Set(g.map((n) => n["@id"]).filter((x) => typeof x === "string"));
  for (const n of g) {
    const type = String(n["@type"]);
    expect(Object.keys(REQUIRED), `${where}: ${type}`).toContain(type);
    for (const k of REQUIRED[type]!) expect(n[k], `${where}: ${type}.${k}`).toBeDefined();
  }
  const refs = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(refs) : v !== null && typeof v === "object" ? (Object.keys(v).length === 1 && typeof (v as Node)["@id"] === "string" ? [String((v as Node)["@id"])] : Object.values(v).flatMap(refs)) : []);
  for (const r of refs(g)) expect(ids.has(r), `${where}: ${r}`).toBe(true);
  const org = g.find((n) => n["@type"] === "Organization")!;
  expect(org["description"], where).toBe(t(lang, "meta.tagline"));
  const site = g.find((n) => n["@type"] === "WebSite")!;
  const act = site["potentialAction"] as { "@type": string; target: { urlTemplate: string }; "query-input": string };
  expect(act["@type"], where).toBe("SearchAction");
  // #1111: the site search's results page, every kind of thing we hold (#1077 pointed it at the motorway index's search)
  expect(act.target.urlTemplate, where).toBe(`${SITE_ORIGIN}/${lang}/search?q={search_term_string}`);
  expect(act["query-input"], where).toBe("required name=search_term_string");
  return g;
}

describe("#1077 (6) every family's JSON-LD is a valid schema.org shape", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: pages of the map, a town, a motorway, a junction, a station`, () => {
      for (const id of PAGES.map((p) => p.id).filter((x): x is PageId => x !== "404" && x !== "fuel")) check(JSON.stringify(structuredData(id, lang, "2.5.2")), lang, `${lang} ${id}`);
      const place = check(placeJsonLd(lang, "Köln", `/${lang}/place/koeln`), lang, `${lang} place`);
      expect(place.some((n) => n["@type"] === "Place")).toBe(true);
      const road = check(motorwayJsonLd(lang, "A7", `/${lang}/autobahn/a7`), lang, `${lang} motorway`);
      const thing = road.find((n) => n["@type"] === "Thing")!;
      expect(thing["additionalType"]).toBe(MOTORWAY_ADDITIONAL_TYPE);
      expect(thing["name"]).toBe("A7");
      expect((road.find((n) => n["@type"] === "WebPage")!["about"] as Node)["@id"]).toBe(thing["@id"]);
      const exit = check(exitJsonLd(lang, "A7", { title: "A7 Nesselwang", description: "x" }, { name: "Nesselwang", path: `/${lang}/autobahn/a7/exit-138-nesselwang`, lat: 47.6, lon: 10.5 }), lang, `${lang} exit`);
      expect(exit.some((n) => n["@type"] === "Place")).toBe(true);
      const station = check(stationJsonLd(lang, "Köln Hbf", `/${lang}/station/koeln-hbf`), lang, `${lang} station`);
      expect(station.some((n) => n["@type"] === "TrainStation")).toBe(true);
    });
  }
  it("the check can say no: an unknown type, a missing field and a dangling reference are refused", () => {
    const base = JSON.parse(motorwayJsonLd("de", "A7", "/de/autobahn/a7")) as { "@graph": Node[] };
    const bad = (f: (g: Node[]) => void): string => {
      const c = structuredClone(base);
      f(c["@graph"]);
      return JSON.stringify(c);
    };
    expect(() => check(bad((g) => (g[4]!["@type"] = "Road")), "de", "x")).toThrow();
    expect(() => check(bad((g) => delete g[4]!["additionalType"]), "de", "x")).toThrow();
    expect(() => check(bad((g) => (g[2]!["about"] = { "@id": "https://viafrei.de/nowhere" })), "de", "x")).toThrow();
  });
});

/* ------------------------------------------------------------------------------------------------------------------ *
 * #1077 drift: a tool, a page or a language added to the site, and the AI-facing files do not follow, is red here.
 * ------------------------------------------------------------------------------------------------------------------ */

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_DIR = join(WEB, "src", "pages");

/** Every file under a directory, as a `/`-separated path relative to it. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p).map((f) => `${n}/${f}`) : [n];
  });
}

/** The route files under `src/pages/[lang]/` that are no page family, each with the reason it is none. */
const NOT_A_FAMILY: Readonly<Record<string, string>> = {
  "404.astro": "the not-found page: a destination of no link, left out of every sitemap",
  "search.astro": "#1111: a page of results for whatever was typed — noindex, and disallowed in every robots.txt group",
  "news.xml.ts": "the News page's Atom feed, linked from the News family's page — a feed, not a page",
  // #1076: one page per station, found through their sitemaps and the links of the town, motorway and station pages
  "fuel/[slug].astro": "#1076: one fuel station's page — consumer information off the corpus crawlers, so not offered to AI tools here; in no sitemap (#1167 S1)",
  "charging/[slug].astro": "#1076: one charging site's page — ~100 000 of them with no address stable enough to be an example; in no sitemap since #49 A, found through the links of the town, motorway and station pages",
  "station/[slug]/stop/[stop].astro": "#1043 (c): one stop around a station — a view of the station page's \"Haltestellen in der Nähe\" card, noindex and in no sitemap; the station page is the one to find",
};

/** The address pattern a route file serves, read off its own name: `[x]` is one segment, `[...x]` zero or more. */
function routePattern(file: string): RegExp {
  const segs = file.replace(/\.(astro|ts)$/u, "").split("/").filter((x) => x !== "index");
  const body = segs.map((x) => (/^\[\.\.\..+\]$/u.test(x) ? "(?:/[^/]+)*" : /^\[.+\]$/u.test(x) ? "/[^/]+" : `/${x.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`)).join("");
  return new RegExp(`^/(?:${LIVE_LANGS.join("|")})${body}$`, "u");
}

/**
 * The judge: every route file under `[lang]` is a page-map page of a family, a dynamic family's route, or excused by
 * name; and every excuse and every family route names a file that exists. Returns one finding per miss.
 */
function routeFindings(files: readonly string[]): string[] {
  const out: string[] = [];
  const familyPages = new Set<string>(PAGE_FAMILIES.flatMap((f) => f.pages));
  const routes = new Set(PAGE_FAMILIES.map((f) => f.route).filter((r): r is string => r !== undefined));
  for (const f of files) {
    if (f in NOT_A_FAMILY) continue;
    if (f.includes("[")) {
      if (!routes.has(f)) out.push(`${f}: a dynamic route no page family names (PAGE_FAMILIES in site/discovery.ts)`);
      continue;
    }
    const slug = f === "index.astro" ? "" : `/${f.replace(/\.astro$/u, "")}`;
    const page = PAGES.find((p) => p.slug === slug);
    if (page === undefined) out.push(`${f}: a route that is not a page of the map (site/pages.ts)`);
    else if (!familyPages.has(page.id)) out.push(`${f}: page "${page.id}" is in no page family`);
  }
  for (const r of routes) if (!files.includes(r)) out.push(`${r}: a family's route that is no file`);
  for (const r of Object.keys(NOT_A_FAMILY)) if (!files.includes(r)) out.push(`${r}: excused, but no such file`);
  return out;
}

describe("#1077 drift: a page or a page family added to the site is named in llms.txt", () => {
  const files = filesUnder(join(PAGES_DIR, "[lang]"));
  it("reads the route tree (a scan of nothing would agree with anything)", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.some((f) => f.includes("["))).toBe(true);
  });
  it("every route file under [lang] is a family's page or route, or excused with its reason", () => {
    expect(routeFindings(files)).toEqual([]);
  });
  it("the judge can say no: a new dynamic route, a new static page and a vanished family route are each named", () => {
    expect(routeFindings([...files, "parking/[slug].astro"])).toEqual(["parking/[slug].astro: a dynamic route no page family names (PAGE_FAMILIES in site/discovery.ts)"]);
    expect(routeFindings([...files, "ferries.astro"])).toEqual(["ferries.astro: a route that is not a page of the map (site/pages.ts)"]);
    expect(routeFindings(files.filter((f) => f !== "station/[slug].astro"))).toEqual(["station/[slug].astro: a family's route that is no file"]);
  });
  it("each dynamic family's English and German examples are addresses its route file serves", () => {
    for (const f of PAGE_FAMILIES.filter((x) => x.pages.length === 0)) {
      expect(f.route, f.name).toBeDefined();
      for (const l of ["en", "de"] as const) expect(f.example(l), `${f.name} ${l}`).toMatch(routePattern(f.route!));
    }
    // and the pattern is not a catch-all: a town address is no station route, the index no motorway page
    expect("/en/place/koeln").not.toMatch(routePattern("station/[slug].astro"));
    expect("/en/autobahn").not.toMatch(routePattern("autobahn/[road]/[...rest].astro"));
  });
  it("a root page is the home, the 404 or a legal page (German at the root)", () => {
    const root = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".astro"));
    const legal = PAGES.filter((p) => p.legal).map((p) => `${p.slug.slice(1)}.astro`);
    expect(root.length).toBeGreaterThanOrEqual(3);
    expect(root.filter((f) => !["index.astro", "404.astro", ...legal].includes(f))).toEqual([]);
  });
});

describe("#1077 drift: a language or a sitemap added is in robots.txt", () => {
  it("the sitemap route files, each per-language one in de and en (#49), are exactly ALL_SITEMAPS", () => {
    const files = readdirSync(PAGES_DIR).filter((f) => /^sitemap.*\.xml\.ts$/u.test(f));
    // #49 A: no part file is left (the charging parts are retired; there is no fuel sitemap, #1167 S1)
    expect(files.filter((f) => f.includes("[part]"))).toEqual([]);
    const routes = files.map((f) => `/${f.replace(/\.ts$/u, "")}`);
    expect(routes.length).toBeGreaterThanOrEqual(5);
    // #49: a per-language route serves de and en alone (`SITEMAP_LANGS`); every other language answers 404
    const expanded = routes.flatMap((r) => (r.includes("[lang]") ? SITEMAP_LANGS.map((l) => r.replace("[lang]", l)) : [r]));
    expect([...expanded].sort()).toEqual([...ALL_SITEMAPS].sort());
  });
  it("robots.txt names every sitemap, once each, and no other — after the last group, as a record of the whole file", () => {
    const lines = robotsTxt().split("\n");
    const named = lines.filter((l) => l.startsWith("Sitemap: ")).map((l) => l.slice("Sitemap: ".length));
    expect([...named].sort()).toEqual(ALL_SITEMAPS.map((p) => `${SITE_ORIGIN}${p}`).sort());
    // `Sitemap` belongs to no group (RFC 9309 § 2.2.4), so every group's crawler reads it; it stands after the last one.
    const lastGroup = lines.length - 1 - [...lines].reverse().findIndex((l) => l.startsWith("User-agent: "));
    expect(lines.findIndex((l) => l.startsWith("Sitemap: "))).toBeGreaterThan(lastGroup);
  });
  it("the corpus groups keep the fuel page off in exactly the live languages", () => {
    expect([...CORPUS_DISALLOW].sort()).toEqual(LIVE_LANGS.map((l) => pathFor("fuel", l)).sort());
  });
  for (const [name, txt] of FILES) {
    it(`${name}: names every live language`, () => {
      const line = txt.split("\n").find((l) => l.startsWith("Every page below is the same live data"));
      expect(line).toContain(`in ${String(LIVE_LANGS.length)} languages (${LIVE_LANGS.join(", ")})`);
    });
  }
});

describe("#1077 (4) the training opt-outs follow the data-steward register", () => {
  /** Each operator's training or corpus token, from its own crawler page as `CRAWLERS_CHECKED` read it. */
  const TRAINING_TOKENS = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "meta-externalagent", "CCBot", "Bytespider", "Amazonbot", "MistralAI-Training"];
  it("every operator's training token is a corpus crawler, and its group keeps the fuel page off (Verdict 1 condition 4)", () => {
    const groups = robotsTxt().split(/\n\n+/u);
    for (const ua of TRAINING_TOKENS) {
      expect(CORPUS_CRAWLERS as readonly string[], ua).toContain(ua);
      const g = groups.find((x) => x.startsWith(`User-agent: ${ua}\n`))?.split("\n") ?? [];
      for (const p of CORPUS_DISALLOW) expect(g, `${ua} ${p}`).toContain(`Disallow: ${p}`);
    }
  });
  it("no search or user agent is a corpus crawler: they keep the consumer page a person asked for", () => {
    for (const ua of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "MistralAI-User", "DuckAssistBot", "Applebot"]) {
      expect(CORPUS_CRAWLERS as readonly string[], ua).not.toContain(ua);
    }
  });
});

/** A number claimed beside what it counts, as the llms files word it. */
const CLAIM = /\b(\d{1,3}(?: \d{3})+|\d+)\s+(?:more\s+)?(newest entries|credit lines?|motorways?|languages?|tools?|prompts?|resources?|stations?|places?|towns?|sources?|Länder|feeds?|people)\b/gu;

/** What each counted noun must equal: the thing it counts, computed here from the lists the generator reads. */
const COUNTS: Readonly<Record<string, readonly number[]>> = {
  "credit lines": [catalogue.credits.length],
  tools: [catalogue.tools.length],
  languages: [LIVE_LANGS.length, LIVE_LANGS.length - 2],
  motorways: [MOTORWAY_REGISTER.length],
  people: [PLACE_SITEMAP_MIN_POPULATION],
  "newest entries": [NEWS_IN_LLMS],
};

/**
 * The judge: every "N <noun>" in the text whose noun we count must carry the computed count, and a count of a noun
 * nobody computes (a typed "40 sources") is a finding by itself. The catalogue's tool lines, the News lines and the
 * credit lines are the server's and the News page's own words, judged where they are made, not here.
 */
function claimFindings(txt: string): string[] {
  const news = new Set(newsLines());
  const ours = txt.split("\n").filter((l) => !l.startsWith("- `") && !news.has(l) && !catalogue.credits.some((c) => l.includes(c.text.slice(0, 40))));
  const out: string[] = [];
  for (const l of ours) {
    for (const m of l.matchAll(CLAIM)) {
      const n = Number(m[1]!.replace(/ /gu, ""));
      const noun = m[2]!.replace(/^(credit line|motorway|language|tool)$/u, "$1s");
      const want = COUNTS[noun];
      if (want === undefined) out.push(`"${m[0]}": a count of ${noun} nobody computes`);
      else if (!want.includes(n)) out.push(`"${m[0]}": ${noun} computes to ${want.join(" or ")}`);
    }
  }
  return out;
}

describe("#1077 (2) current: every claimed number is the count it names", () => {
  for (const [name, txt] of FILES) {
    it(`${name}: each "N motorways / languages / tools / credit lines / …" equals its computed count`, () => {
      expect(txt.match(CLAIM)?.length ?? 0).toBeGreaterThanOrEqual(6);
      expect(claimFindings(txt)).toEqual([]);
    });
  }
  it("the heading counts are the lists under them", () => {
    expect(llmsTxt()).toContain(`## Tools (${String(catalogue.tools.length)})`);
    expect(llmsTxt()).toContain(`## Prompts (${String(catalogue.prompts.length)})`);
    expect(llmsTxt()).toContain(`## Resources (${String(catalogue.resources.length)})`);
    expect(llmsFullTxt()).toContain(`## Motorway pages (${String(MOTORWAY_REGISTER.length)}, English and German;`);
    expect(newsLines().length).toBeLessThanOrEqual(NEWS_IN_LLMS);
  });
  it("the judge can say no: a stale count, a typed count of a thing nobody computes and a stale language count are each named", () => {
    const stale = llmsTxt().replace(`all ${String(MOTORWAY_REGISTER.length)} motorways`, `all ${String(MOTORWAY_REGISTER.length - 1)} motorways`);
    expect(claimFindings(stale)).toEqual([`"${String(MOTORWAY_REGISTER.length - 1)} motorways": motorways computes to ${String(MOTORWAY_REGISTER.length)}`]);
    expect(claimFindings(`${llmsTxt()}\nWe read 40 sources.\n`)).toEqual(['"40 sources": a count of sources nobody computes']);
    expect(claimFindings(llmsTxt().replace(`in ${String(LIVE_LANGS.length)} languages`, "in 7 languages"))).toHaveLength(1);
  });
});

describe("#1077 (5) the card on viafrei.de names the tools llms.txt names, which are the server's", () => {
  const tools = (serverCard()._meta as Record<string, unknown>)["de.viafrei/tools"] as { name: string; title: string }[];
  it("the card's tools are the catalogue's, name and title, in its order", () => {
    expect(tools).toEqual(catalogue.tools.map((x) => ({ name: x.name, title: x.title })));
  });
  it("every tool on the card is in llms.txt, and llms.txt lists no tool the card does not", () => {
    const listed = section(llmsTxt(), `Tools (${String(catalogue.tools.length)})`).join(" ").match(/`[a-z_]+`/gu)?.map((x) => x.slice(1, -1)) ?? [];
    expect(listed).toEqual(tools.map((x) => x.name));
  });
});
