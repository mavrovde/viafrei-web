/**
 * THE SITEMAP RULE (#715, 2.1.13; `src/site/sitemaps.ts`): every language in
 * every sitemap — the pages and motorway files with their alternates, the place,
 * exit and station files address and lastmod only (2.4.2) — the large lists split per language under
 * an index without changing the URL total, large towns first, real lastmod on
 * every entry, robots.txt naming every sitemap, and the corpus crawlers still
 * kept off the place and fuel pages.
 */
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { robotsTxt, CORPUS_CRAWLERS, CORPUS_DISALLOW } from "../src/site/discovery.js";
import { lastmodOf } from "../src/site/lastmod.js";
import { LIVE_LANGS, PAGES, pathFor } from "../src/site/pages.js";
import { ALL_SITEMAPS, exitsSitemap, indexFiles, roadsLangXml, roadsSitemap, stationsSitemap, statesSitemap, motorwaysLangXml, motorwaysSitemap, placeIndexFiles, placesLangXml, placesSitemap, sitemapIndexXml } from "../src/site/sitemaps.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const SLUGS = ["berlin", "hamburg", "muenchen", "koeln"];
const ROADS = ["A1", "A2", "A7", "A10", "A100"];

describe("the sitemap rule", () => {
  it("no language is left out: every entry of the pages and motorway files carries every alternate and x-default", () => {
    for (const xml of [sitemapXml(), ...LIVE_LANGS.map((l) => motorwaysLangXml(l, ROADS))]) {
      const urls = xml.split("<url>").slice(1);
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        for (const l of LIVE_LANGS) expect(u).toContain(`hreflang="${l}"`);
        expect(u).toContain('hreflang="x-default"');
      }
    }
  });
  it("the split changes no URL: one file per language holds that language's URLs, the total is pages × languages", () => {
    const places = LIVE_LANGS.flatMap((l) => locs(placesLangXml(l, SLUGS)));
    expect(places).toHaveLength(SLUGS.length * LIVE_LANGS.length);
    expect(new Set(places).size).toBe(places.length);
    for (const l of LIVE_LANGS) for (const u of locs(motorwaysLangXml(l, ROADS))) expect(u.startsWith(`https://viafrei.de${pathFor("motorways", l)}/`), u).toBe(true);
    expect(LIVE_LANGS.flatMap((l) => locs(motorwaysLangXml(l, ROADS)))).toHaveLength(ROADS.length * LIVE_LANGS.length);
    expect(locs(sitemapXml())).toHaveLength((PAGES.length - 1) * LIVE_LANGS.length);
  });
  it("large towns first and motorways in natural order: the order handed in is the order listed", () => {
    expect(locs(placesLangXml("de", SLUGS))).toEqual(SLUGS.map((s) => `https://viafrei.de/de/place/${s}`));
    expect(locs(motorwaysLangXml("en", ROADS))).toEqual(ROADS.map((r) => `https://viafrei.de/en/autobahn/${r.toLowerCase()}`));
  });
  it("lastmod is real on every entry: the content map's day, per language, and an index's the newest of its file", () => {
    for (const l of LIVE_LANGS) {
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
    expect(files.filter(isRoads).map((f) => f.lastmod)).toEqual(LIVE_LANGS.map(() => null));
    expect(files.filter(isStates).map((f) => f.lastmod)).toEqual(LIVE_LANGS.map(() => null));
    expect(indexFiles(null, null, "2026-11-02").filter(isRoads).map((f) => f.lastmod)).toEqual(LIVE_LANGS.map(() => "2026-11-02"));
    expect(indexFiles(null, null, null, "2026-11-03").filter(isStates).map((f) => f.lastmod)).toEqual(LIVE_LANGS.map(() => "2026-11-03"));
    expect(indexFiles(null, null, null, "2026-11-03").filter(isRoads).map((f) => f.lastmod)).toEqual(LIVE_LANGS.map(() => null));
    const pageDays = PAGES.filter((p) => p.id !== "404").flatMap((p) => LIVE_LANGS.map((l) => lastmodOf(p.id, l)!)).sort();
    expect(files[0]).toEqual({ path: "/sitemap.xml", lastmod: pageDays.at(-1) });
  });
  it("the index names the pages file and every per-language file; /sitemap-places.xml names the place files", () => {
    const idx = sitemapIndexXml(indexFiles());
    expect(all(idx, "sitemapindex").length).toBeGreaterThan(0);
    expect(locs(idx)).toEqual(["/sitemap.xml", ...LIVE_LANGS.map(placesSitemap), ...LIVE_LANGS.map(motorwaysSitemap), ...LIVE_LANGS.map(exitsSitemap), ...LIVE_LANGS.map(stationsSitemap), ...LIVE_LANGS.map(roadsSitemap), ...LIVE_LANGS.map(statesSitemap)].map((p) => `https://viafrei.de${p}`));
    expect(locs(sitemapIndexXml(placeIndexFiles()))).toEqual(LIVE_LANGS.map((l) => `https://viafrei.de${placesSitemap(l)}`));
  });
  it("robots.txt names every sitemap (136), and the corpus crawlers are kept off the fuel pages — not off the place pages (#1065) or the motorway pages", () => {
    const txt = robotsTxt();
    for (const s of ALL_SITEMAPS) expect(txt).toMatch(new RegExp(`^Sitemap: https://viafrei\\.de${s.replace(/\./g, "\\.")}$`, "m"));
    expect(ALL_SITEMAPS).toHaveLength(4 + 6 * LIVE_LANGS.length);
    // #1065: robots.txt is the source of truth of the sitemap list: 47 lines, 69 since #1025's 22 exit files, 91 since #1041's 22 station files, 113 since #1027's 22 road files, 135 since #1074's 22 Land files, 137 since #1076's two station indexes, 136 since #1167 dropped the fuel index (S1)
    expect(ALL_SITEMAPS).toHaveLength(136);
    expect(txt.split("\n").filter((l) => l.startsWith("Sitemap: "))).toHaveLength(136);
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
