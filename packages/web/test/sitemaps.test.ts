/**
 * THE SITEMAP RULE (#715, 2.1.13; #49; `src/site/sitemaps.ts`): the sitemaps are in de and en only (#49, owner
 * 2026-11-25) — the pages and motorway files with their alternates in every live language, the place, exit and
 * station files address and lastmod only (2.4.2) — the large lists split per language under an index without
 * changing the URL total of a language, large towns first, real lastmod on every entry, robots.txt naming every
 * sitemap and no other, and the corpus crawlers still kept off the fuel pages.
 */
import { describe, expect, it } from "vitest";
import type { APIContext } from "astro";
import { all, text as nodeText } from "@viafrei/design/testing";
import { robotsTxt, CORPUS_CRAWLERS, CORPUS_DISALLOW } from "../src/site/discovery.js";
import { lastmodOf } from "../src/site/lastmod.js";
import { LIVE_LANGS, PAGES, pathFor, type Lang } from "../src/site/pages.js";
import { ALL_SITEMAPS, SITEMAP_LANGS, exitsSitemap, indexFiles, isSitemapLang, roadsLangXml, roadsSitemap, stationsSitemap, statesSitemap, motorwaysLangXml, motorwaysSitemap, placeIndexFiles, placesLangXml, placesSitemap, sitemapIndexXml } from "../src/site/sitemaps.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { GET as placesRoute } from "../src/pages/sitemap-places-[lang].xml.js";
import { GET as motorwaysRoute } from "../src/pages/sitemap-motorways-[lang].xml.js";
import { GET as exitsRoute } from "../src/pages/sitemap-exits-[lang].xml.js";
import { GET as stationsRoute } from "../src/pages/sitemap-stations-[lang].xml.js";
import { GET as roadsRoute } from "../src/pages/sitemap-roads-[lang].xml.js";
import { GET as statesRoute } from "../src/pages/sitemap-states-[lang].xml.js";

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const SLUGS = ["berlin", "hamburg", "muenchen", "koeln"];
const ROADS = ["A1", "A2", "A7", "A10", "A100"];
/** The language of a site address: its first path segment, or de for a German legal page without one. */
const langOfLoc = (u: string): string => /^https:\/\/viafrei\.de\/([a-z]{2})(?:[/?#]|$)/.exec(u)?.[1] ?? "de";

describe("the sitemap rule", () => {
  it("#49: the sitemap languages are de and en, nothing else", () => {
    expect([...SITEMAP_LANGS]).toEqual(["de", "en"]);
    for (const l of LIVE_LANGS) expect(isSitemapLang(l), l).toBe(l === "de" || l === "en");
  });
  it("no language is left out of the alternates: every entry of the pages and motorway files carries every alternate and x-default", () => {
    for (const xml of [sitemapXml(), ...SITEMAP_LANGS.map((l) => motorwaysLangXml(l, ROADS))]) {
      const urls = xml.split("<url>").slice(1);
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        for (const l of LIVE_LANGS) expect(u).toContain(`hreflang="${l}"`);
        expect(u).toContain('hreflang="x-default"');
      }
    }
  });
  it("the split changes no URL of a language: one file per sitemap language holds its URLs; /sitemap.xml is the map in de and en", () => {
    const places = SITEMAP_LANGS.flatMap((l) => locs(placesLangXml(l, SLUGS)));
    expect(places).toHaveLength(SLUGS.length * SITEMAP_LANGS.length);
    expect(new Set(places).size).toBe(places.length);
    for (const l of SITEMAP_LANGS) for (const u of locs(motorwaysLangXml(l, ROADS))) expect(u.startsWith(`https://viafrei.de${pathFor("motorways", l)}/`), u).toBe(true);
    expect(SITEMAP_LANGS.flatMap((l) => locs(motorwaysLangXml(l, ROADS)))).toHaveLength(ROADS.length * SITEMAP_LANGS.length);
    expect(locs(sitemapXml())).toHaveLength((PAGES.length - 1) * SITEMAP_LANGS.length);
  });
  it("#49: every <loc> of /sitemap.xml is a de or an en address", () => {
    const found = locs(sitemapXml());
    for (const u of found) expect(["de", "en"], u).toContain(langOfLoc(u));
    expect(found.filter((u) => langOfLoc(u) === "en")).toHaveLength(PAGES.length - 1);
  });
  it("large towns first and motorways in natural order: the order handed in is the order listed", () => {
    expect(locs(placesLangXml("de", SLUGS))).toEqual(SLUGS.map((s) => `https://viafrei.de/de/place/${s}`));
    expect(locs(motorwaysLangXml("en", ROADS))).toEqual(ROADS.map((r) => `https://viafrei.de/en/autobahn/${r.toLowerCase()}`));
  });
  it("lastmod is real on every entry: the content map's day, per language, and an index's the newest of its file", () => {
    for (const l of SITEMAP_LANGS) {
      expect(lastmodOf("motorway", l)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(lastmodOf("motorways", l)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const p = placesLangXml(l, SLUGS);
      expect(p.match(/<lastmod>/g)?.length).toBe(SLUGS.length);
      expect(all(p, "lastmod").map(nodeText)).toContain(`${lastmodOf("place", l)!}`);
      expect(all(motorwaysLangXml(l, ROADS), "lastmod").map(nodeText)).toContain(`${lastmodOf("motorway", l)!}`);
    }
    const files = indexFiles();
    // #1027: a road file has no template day — its lastmod is the road list's newest day, absent when the list was not read
    const isRoads = (f: { readonly path: string }): boolean => f.path.startsWith("/sitemap-roads-");
    // #1074: a Land file likewise — its lastmod is the Land list's newest day, absent when the list was not read
    const isStates = (f: { readonly path: string }): boolean => f.path.startsWith("/sitemap-states-");
    expect(files.filter((f) => !isRoads(f) && !isStates(f)).every((f) => f.lastmod !== null && /^\d{4}-\d{2}-\d{2}$/.test(f.lastmod))).toBe(true);
    expect(files.filter(isRoads).map((f) => f.lastmod)).toEqual(SITEMAP_LANGS.map(() => null));
    expect(files.filter(isStates).map((f) => f.lastmod)).toEqual(SITEMAP_LANGS.map(() => null));
    expect(indexFiles(null, null, "2026-11-02").filter(isRoads).map((f) => f.lastmod)).toEqual(SITEMAP_LANGS.map(() => "2026-11-02"));
    expect(indexFiles(null, null, null, "2026-11-03").filter(isStates).map((f) => f.lastmod)).toEqual(SITEMAP_LANGS.map(() => "2026-11-03"));
    expect(indexFiles(null, null, null, "2026-11-03").filter(isRoads).map((f) => f.lastmod)).toEqual(SITEMAP_LANGS.map(() => null));
    const pageDays = PAGES.filter((p) => p.id !== "404").flatMap((p) => SITEMAP_LANGS.map((l) => lastmodOf(p.id, l)!)).sort();
    expect(files[0]).toEqual({ path: "/sitemap.xml", lastmod: pageDays.at(-1) });
  });
  it("the index names the pages file and every de and en file; /sitemap-places.xml names the two place files", () => {
    const idx = sitemapIndexXml(indexFiles());
    expect(all(idx, "sitemapindex").length).toBeGreaterThan(0);
    expect(locs(idx)).toEqual(["/sitemap.xml", ...SITEMAP_LANGS.map(placesSitemap), ...SITEMAP_LANGS.map(motorwaysSitemap), ...SITEMAP_LANGS.map(exitsSitemap), ...SITEMAP_LANGS.map(stationsSitemap), ...SITEMAP_LANGS.map(roadsSitemap), ...SITEMAP_LANGS.map(statesSitemap)].map((p) => `https://viafrei.de${p}`));
    expect(locs(sitemapIndexXml(placeIndexFiles()))).toEqual(SITEMAP_LANGS.map((l) => `https://viafrei.de${placesSitemap(l)}`));
  });
  it("#49: robots.txt and every index declare de and en sitemaps only and no charging part — 15 sitemaps, 136 before", () => {
    const txt = robotsTxt();
    const lines = txt.split("\n").filter((l) => l.startsWith("Sitemap: ")).map((l) => l.slice("Sitemap: ".length));
    const indexed = [...locs(sitemapIndexXml(indexFiles("2026-11-01", "2026-11-01", "2026-11-01", "2026-11-01"))), ...locs(sitemapIndexXml(placeIndexFiles()))];
    for (const u of [...lines, ...indexed]) {
      expect(u, u).not.toMatch(/charging|fuel/);
      const per = /-([a-z]{2})(?:-\d+)?\.xml$/.exec(u);
      if (per !== null) expect(["de", "en"], u).toContain(per[1]);
    }
    for (const l of LIVE_LANGS.filter((x) => !isSitemapLang(x))) expect(txt, l).not.toMatch(new RegExp(`-${l}(?:-\\d+)?\\.xml$`, "m"));
    expect(lines).toHaveLength(3 + 6 * SITEMAP_LANGS.length);
    expect(lines).toHaveLength(15);
  });
  it("#49: a per-language sitemap of any other language answers 404, before the digest is asked", async () => {
    const ctx = (lang: string): APIContext => ({ params: { lang } }) as unknown as APIContext;
    for (const route of [placesRoute, motorwaysRoute, exitsRoute, stationsRoute, roadsRoute, statesRoute]) {
      for (const l of LIVE_LANGS.filter((x): x is Lang => !isSitemapLang(x))) expect(((await route(ctx(l))) as Response).status, l).toBe(404);
      expect(((await route(ctx("xx"))) as Response).status).toBe(404);
    }
  });
  it("robots.txt names every sitemap, and the corpus crawlers are kept off the fuel pages — not off the place pages (#1065) or the motorway pages", () => {
    const txt = robotsTxt();
    for (const s of ALL_SITEMAPS) expect(txt).toMatch(new RegExp(`^Sitemap: https://viafrei\\.de${s.replace(/\./g, "\\.")}$`, "m"));
    expect(ALL_SITEMAPS).toHaveLength(15);
    // #1065: robots.txt is the source of truth of the sitemap list: 47 lines, 69 since #1025's 22 exit files, 91 since #1041's 22 station files, 113 since #1027's 22 road files, 135 since #1074's 22 Land files, 137 since #1076's two station indexes, 136 since #1167 dropped the fuel index (S1), 15 since #49 (de and en only, no charging index)
    expect(txt.split("\n").filter((l) => l.startsWith("Sitemap: "))).toHaveLength(15);
    for (const l of LIVE_LANGS) {
      expect(CORPUS_DISALLOW).toContain(pathFor("fuel", l));
      expect(CORPUS_DISALLOW.some((d) => `/${l}/place/koeln`.startsWith(d)), l).toBe(false);
      expect(CORPUS_DISALLOW.some((d) => `${pathFor("motorways", l)}/a7`.startsWith(d))).toBe(false);
    }
    for (const c of CORPUS_CRAWLERS) expect(txt.split(`User-agent: ${c}\n`)[1]!.split("\n\n")[0]).not.toContain("/place/");
  });
  it("#1027: the road file lists each road's page in its language with the digest's day, a Land's road under its Land", () => {
    const xml = roadsLangXml("en", [{ id: "b51", day: "2026-11-01" }, { id: "nw/l249", day: "2026-11-02" }]);
    expect(locs(xml)).toEqual(["https://viafrei.de/en/road/b51", "https://viafrei.de/en/road/nw/l249"]);
    expect(all(xml, "lastmod").map(nodeText)).toEqual(["2026-11-01", "2026-11-02"]);
    expect(roadsSitemap("de")).toBe("/sitemap-roads-de.xml");
  });
});
