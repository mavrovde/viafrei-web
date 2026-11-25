/**
 * #1110 (owner 2026-11-01): the main URLs `scripts/main-urls.ts` derives are the ones the search consoles may be
 * handed — each in a sitemap robots.txt declares, each with a canonical equal to itself, each on the English slug
 * rules (#892, owner 2026-10-21). The sitemap XML here is the shell's own builders' (`site/sitemaps.ts`,
 * `pages/sitemap.xml.ts`); the canonical is the rendered page's, through Astro's container over the e2e fixture
 * digest (loopback, no database, no network) — one page of each family in German and English.
 */
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all, text as nodeText } from "@viafrei/design/testing";
import { exitSlug } from "@viafrei/ingest";
import { startRealDigest } from "../e2e/real-digest.js";
import { MAIN_PAGES, mainUrls, type MainUrl, type MainUrlFamily } from "../scripts/main-urls.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { robotsTxt } from "../src/site/discovery.js";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { MOTORWAY_REGISTER } from "../src/site/motorways.js";
import { LIVE_LANGS, pageAt, type Lang } from "../src/site/pages.js";
import { POPULAR_PLACES, popularSlug } from "../src/site/places.js";
import { ROUTE_WORDS, hasInternalId, isSlug } from "../src/site/slug.js";
import { PAGES_SITEMAP, motorwaysLangXml, motorwaysSitemap, placesLangXml, placesSitemap } from "../src/site/sitemaps.js";

const URLS = mainUrls();
const declared = new Set([...robotsTxt().matchAll(/^Sitemap: (\S+)$/gmu)].map((m) => m[1]!));

/** The sitemap a family's URL is listed in, and that sitemap's XML as the shell builds it. */
function sitemapOf(u: MainUrl): { readonly path: string; readonly xml: string } {
  if (u.family === "page") return { path: PAGES_SITEMAP, xml: sitemapXml(() => null) };
  if (u.family === "motorway") return { path: motorwaysSitemap(u.lang), xml: motorwaysLangXml(u.lang, MOTORWAY_REGISTER, null) };
  return { path: placesSitemap(u.lang), xml: placesLangXml(u.lang, POPULAR_PLACES.map(popularSlug), null) };
}

describe("#1110: the main URLs", () => {
  it("cover every family in every live language, each URL once, the five site pages in German and English first", () => {
    const n = MAIN_PAGES.length + POPULAR_PLACES.length + MOTORWAY_REGISTER.length;
    expect(URLS.length).toBe(n * LIVE_LANGS.length);
    expect(new Set(URLS.map((u) => u.url)).size).toBe(URLS.length);
    for (const l of LIVE_LANGS) for (const f of ["page", "place", "motorway"] as const) expect(URLS.some((u) => u.lang === l && u.family === f), `${l} ${f}`).toBe(true);
    expect(URLS.slice(0, 2 * MAIN_PAGES.length).map((u) => `${u.lang} ${u.family}`)).toEqual([...MAIN_PAGES.map(() => "de page"), ...MAIN_PAGES.map(() => "en page")]);
    expect(URLS[0]!.url).toBe(`${SITE_ORIGIN}/de`);
  });
  it("each German and English one is in a sitemap robots.txt declares; no other language is (#49)", () => {
    for (const u of URLS.filter((x) => x.lang !== "de" && x.lang !== "en")) {
      const s = sitemapOf(u);
      expect(declared.has(`${SITE_ORIGIN}${s.path}`) && s.xml.includes(`<loc>${u.url}</loc>`), `${u.url} is listed in ${s.path}`).toBe(false);
    }
    for (const u of URLS.filter((x) => x.lang === "de" || x.lang === "en")) {
      const s = sitemapOf(u);
      expect(declared.has(`${SITE_ORIGIN}${s.path}`), `${u.url}: ${s.path} not declared`).toBe(true);
      expect(s.xml.includes(`<loc>${u.url}</loc>`), `${u.url} not in ${s.path}`).toBe(true);
    }
  });
  it("each is https on the site, in the English slug rules: the language, then route words and slugs, no internal id", () => {
    const words = new Set<string>([...Object.values(ROUTE_WORDS), "connect", "business", "developers"]);
    for (const u of URLS) {
      const x = new URL(u.url);
      expect(x.origin, u.url).toBe(SITE_ORIGIN);
      expect(x.search + x.hash, u.url).toBe("");
      const [lang, ...rest] = x.pathname.split("/").slice(1);
      expect(lang, u.url).toBe(u.lang);
      for (const seg of rest) expect(isSlug(seg), `${u.url}: ${seg}`).toBe(true);
      if (rest[0] !== undefined) expect(words.has(rest[0]), `${u.url}: the first word ${rest[0]} is not an English route word`).toBe(true);
      expect(hasInternalId(x.pathname), u.url).toBe(false);
      if (u.family === "page") expect(pageAt(x.pathname), u.url).not.toBeNull();
    }
  });
  it("the check can say no: a URL outside every sitemap, and a German route word, are refused", () => {
    const bad: MainUrl = { url: `${SITE_ORIGIN}/de/autobahn/a9999`, lang: "de", family: "motorway" };
    expect(sitemapOf(bad).xml.includes(`<loc>${bad.url}</loc>`)).toBe(false);
    expect(new Set<string>(Object.values(ROUTE_WORDS)).has("ort")).toBe(false);
  });
});

// --- the self-canonical, on the rendered page --------------------------------------------------------------------

const ROOT = fileURLToPath(new URL("..", import.meta.url));
let digest: Awaited<ReturnType<typeof startRealDigest>> | undefined;
let vite: ViteDevServer | undefined;
let container: AstroContainer;
const saved = process.env["DIGEST_URL"];

const FILES: Readonly<Record<string, string>> = {
  start: "/src/pages/[lang]/index.astro",
  motorways: "/src/pages/[lang]/autobahn.astro",
  connect: "/src/pages/[lang]/connect.astro",
  business: "/src/pages/[lang]/business.astro",
  developers: "/src/pages/[lang]/developers.astro",
  place: "/src/pages/[lang]/place/[slug].astro",
  motorway: "/src/pages/[lang]/autobahn/[road]/[...rest].astro",
};

/** The page file and its params for a main URL. */
function fileOf(u: MainUrl): { readonly file: string; readonly params: Record<string, string> } {
  const path = new URL(u.url).pathname;
  const segs = path.split("/").slice(1);
  if (u.family === "place") return { file: FILES["place"]!, params: { lang: u.lang, slug: segs[2]! } };
  if (u.family === "motorway") return { file: FILES["motorway"]!, params: { lang: u.lang, road: segs[2]! } };
  return { file: FILES[pageAt(path)!.id]!, params: { lang: u.lang } };
}

/** One URL of each page and family, in German and English (the fixture digest knows Köln and the A7). */
const SAMPLE: readonly MainUrl[] = (["de", "en"] as const satisfies readonly Lang[]).flatMap((l) => [
  ...URLS.filter((u) => u.lang === l && u.family === "page"),
  URLS.find((u) => u.lang === l && u.family === "place" && u.url.endsWith("/koeln"))!,
  URLS.find((u) => u.lang === l && u.family === "motorway" && u.url.endsWith("/a7"))!,
]);

beforeAll(async () => {
  digest = await startRealDigest();
  process.env["DIGEST_URL"] = digest.url;
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
  for (const f of new Set(Object.values(FILES))) await vite.ssrLoadModule(f);
}, 30_000);

afterAll(async () => {
  await vite?.close();
  await digest?.close();
  if (saved === undefined) delete process.env["DIGEST_URL"];
  else process.env["DIGEST_URL"] = saved;
});

describe("#1110: each family's main URL carries a canonical equal to itself", () => {
  it("one page of each family, German and English: exactly one canonical, the URL itself", async () => {
    const families = new Set<MainUrlFamily>();
    for (const u of SAMPLE) {
      const { file, params } = fileOf(u);
      const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
      const html = await container.renderToString(mod.default, {
        params,
        request: new Request(u.url, { headers: { "accept-language": u.lang, "user-agent": "Mozilla/5.0" } }),
        locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
      });
      expect(all(html, 'link[rel="canonical"]').length, u.url).toBe(1);
      expect(all(html, `link[rel="canonical"][href="${u.url}"]`).length, u.url).toBe(1);
      families.add(u.family);
    }
    expect([...families].sort()).toEqual(["motorway", "page", "place"]);
    expect(SAMPLE.length).toBe(2 * (MAIN_PAGES.length + 2));
  });
});

describe("#1110 item 1: an interchange page under any of its motorways names ONE address", () => {
  // the fixture digest's one national interchange: the AD at LCL 20000 of the A1, A2, …, A7, …, A10 (canonical: the A1's)
  const own = exitSlug({ no: "1", name: "Musterstadt-Nord 1" });
  const canonicalTail = `/autobahn/a1/${exitSlug({ no: "1", name: "Beispielort-Nord 1" })}`;
  it("the A7's point: its canonical, its hreflang alternates and its graph are the A1's point, in each language", async () => {
    for (const lang of ["de", "en"] as const) {
      const url = `${SITE_ORIGIN}/${lang}/autobahn/a7/${own}`;
      const mod = (await vite!.ssrLoadModule(FILES["motorway"]!)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
      const html = await container.renderToString(mod.default, {
        params: { lang, road: "a7", rest: own },
        request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
        locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
      });
      const canonical = all(html, 'link[rel="canonical"]').map((e) => e.attrs.href);
      expect(canonical, lang).toEqual([`${SITE_ORIGIN}/${lang}${canonicalTail}`]);
      const alternates = all(html, 'link[rel="alternate"][hreflang]').map((e) => [e.attrs.hreflang, e.attrs.href]);
      expect(alternates.length, lang).toBeGreaterThan(2);
      for (const [hl, href] of alternates) expect(href, `${lang} ${String(hl)}`).toBe(`${SITE_ORIGIN}/${hl === "x-default" ? "de" : String(hl)}${canonicalTail}`);
      // the structured data names the same address, never the A7's
      const ld = all(html, 'script[type="application/ld+json"]').map(nodeText).join(" ");
      expect(ld, lang).toContain(`${lang}${canonicalTail}`);
      expect(ld, lang).not.toContain(`/autobahn/a7/${own}`);
      // the <h1> names the interchange, not the A7's exit
      expect(all(html, "h1").map(nodeText).join(" "), lang).toContain("Beispielort-Nord 1");
    }
  });
});

describe("#1110 item 3: every place, road, exit and interchange page carries the Weiter row; its AI link prefills the connect page", () => {
  const render = async (file: string, params: Record<string, string>, url: string, lang: Lang): Promise<string> => {
    const mod = (await vite!.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
    return container.renderToString(mod.default, {
      params,
      request: new Request(url, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
      locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
    });
  };
  const amp = (s: string): string => s.replaceAll("&amp;", "&");
  const interchange = exitSlug({ no: "1", name: "Musterstadt-Nord 1" });
  for (const lang of LIVE_LANGS) {
    it(`${lang}: place, road, exit and interchange`, async () => {
      const road = await render(FILES["motorway"]!, { lang, road: "a7" }, `${SITE_ORIGIN}/${lang}/autobahn/a7`, lang);
      // a plain exit of the A7, read off the road page's own links (any exit but the fixture's interchange)
      const plain = [...road.matchAll(/href="[^"]*?\ba7\/(exit-[a-z0-9-]+)"/gu)].map((m) => m[1]!).find((s) => s !== interchange);
      expect(plain, lang).toBeDefined();
      const pages = {
        place: await render(FILES["place"]!, { lang, slug: "koeln" }, `${SITE_ORIGIN}/${lang}/place/koeln`, lang),
        road,
        exit: await render(FILES["motorway"]!, { lang, road: "a7", rest: plain! }, `${SITE_ORIGIN}/${lang}/autobahn/a7/${plain!}`, lang),
        interchange: await render(FILES["motorway"]!, { lang, road: "a7", rest: interchange }, `${SITE_ORIGIN}/${lang}/autobahn/a7/${interchange}`, lang),
      };
      for (const [kind, html] of Object.entries(pages)) {
        expect(all(html, "nav.next-step").length, `${lang} ${kind}`).toBe(1);
        const links = all(html, "nav.next-step a").map((e) => amp(String(e.attrs.href)));
        const roads = links.filter((h) => h.startsWith(`/${lang}/autobahn`));
        expect(roads.length, `${lang} ${kind}: a road link`).toBeGreaterThanOrEqual(1);
        if (kind === "road") expect(roads, `${lang} road: not itself`).not.toContain(`/${lang}/autobahn/a7`);
        if (kind === "exit" || kind === "interchange") expect(roads[0], `${lang} ${kind}: its own road first`).toBe(`/${lang}/autobahn/a7`);
        const ask = links.find((h) => h.startsWith(`/${lang}/connect?`));
        expect(ask, `${lang} ${kind}: the AI link`).toBeDefined();
        // the connect page the link leads to: the prefilled question, noindex, the canonical the bare page
        const connect = await render(FILES["connect"]!, { lang }, `${SITE_ORIGIN}${ask!}`, lang);
        const params = new URLSearchParams(ask!.split("?")[1]);
        const asked = all(connect, ".connect-about .ask__text").map(nodeText).join(" ");
        expect(asked, `${lang} ${kind}: the question`).not.toBe("");
        if (kind === "place") expect(asked, lang).toContain("Köln");
        else expect(asked, `${lang} ${kind}`).toContain("A7");
        if (kind === "exit" || kind === "interchange") expect(asked, `${lang} ${kind}`).toContain(String(params.get("about")));
        expect(all(connect, 'meta[name="robots"][content="noindex, follow"]').length, `${lang} ${kind}`).toBe(1);
        expect(all(connect, `link[rel="canonical"][href="${SITE_ORIGIN}/${lang}/connect"]`).length, `${lang} ${kind}`).toBe(1);
      }
    });
  }
  it("the bare connect page carries no question and stays indexable; a refused subject shows nothing and is noindex", async () => {
    const html = await render(FILES["connect"]!, { lang: "de" }, `${SITE_ORIGIN}/de/connect`, "de");
    expect(all(html, ".connect-about").length).toBe(0);
    expect(all(html, 'meta[name="robots"]').length).toBe(0);
    const junk = await render(FILES["connect"]!, { lang: "de" }, `${SITE_ORIGIN}/de/connect?about=%3Cb%3E`, "de");
    expect(all(junk, ".connect-about").length).toBe(0);
    expect(all(junk, 'meta[name="robots"][content="noindex, follow"]').length).toBe(1);
  });
});
