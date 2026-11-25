/**
 * 2.4.1's search pages, in the shell (#1025, #1026, #1028): the exit register read and its sitemaps, the head an exit
 * page and the index read off the digest's fragments, the breadcrumbs (one list for the visible trail and the
 * JSON-LD), the exit page's graph with the LCL's credit inside it, and the new words in every page language.
 */
import { describe, expect, it } from "vitest";
import de from "../src/i18n/de.json" with { type: "json" };
import { t } from "../src/i18n/index.js";
import { fetchExitRegister, parseExitRegister } from "../src/lib/motorway.js";
import { motorwayHeadOf, motorwayIndexHeadOf } from "../src/lib/motorway-head.js";
import { lastmodOf } from "../src/site/lastmod.js";
import { LCL_CREDIT } from "../src/site/lcl-credit.js";
import { TITLE_FIT, fitTitle, motorwayMeta, pageMeta } from "../src/site/meta.js";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { motorwayExitPath, motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";
import { exitsLangXml, exitsSitemap, indexFiles, newestDay } from "../src/site/sitemaps.js";
import { exitJsonLd, motorwayCrumbs, motorwayJsonLd, motorwaysCrumbs, placeCrumbs } from "../src/site/structured-data.js";

type Graph = { readonly "@graph": Record<string, unknown>[] };
const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

describe("the exit register (#1025): read line by line, a malformed line dropped, a failed read null", () => {
  it("keeps every well-formed line, the day or none", () => {
    expect(parseExitRegister("A7\texit-4-probeort-3\t2026-10-14\nA24\texit-1-hamburg-horn\t-\n")).toEqual([
      { road: "A7", slug: "exit-4-probeort-3", day: "2026-10-14" },
      { road: "A24", slug: "exit-1-hamburg-horn", day: null },
    ]);
  });
  it("drops a line that is not ours: another road, another segment, another day, another column count", () => {
    const bad = ["B7\texit-1-x\t-", "A7\tnesselwang-to-kempten\t-", "A7\texit-1-X\t-", "A7\texit-1-x\t14.10.2026", "A7\texit-1-x", "A7\texit-1-x\t-\textra", "", "A7\texit-\t-"];
    expect(parseExitRegister(bad.join("\n"))).toEqual([]);
  });
  it("null on anything but a 200 text/plain answer (the first lap, a failure, a timeout), never an empty list", async () => {
    const answer = (status: number, type: string, body = "A7\texit-1-x\t-\n") => () => Promise.resolve(new Response(body, { status, headers: { "content-type": type } }));
    const o = (f: () => Promise<Response>) => ({ baseUrl: "http://digest", timeoutMs: 50, fetchImpl: f });
    expect(await fetchExitRegister(o(answer(200, "text/plain; charset=utf-8")))).toEqual([{ road: "A7", slug: "exit-1-x", day: null }]);
    expect(await fetchExitRegister(o(answer(503, "text/plain")))).toBeNull();
    expect(await fetchExitRegister(o(answer(200, "text/html")))).toBeNull();
    expect(await fetchExitRegister(o(() => Promise.reject(new Error("down"))))).toBeNull();
    expect(await fetchExitRegister(o(answer(200, "text/plain", "")))).toEqual([]);
  });
});

describe("the exit sitemaps (#1025)", () => {
  const exits = [
    { road: "A7", slug: "exit-4-probeort-3", day: "2099-01-01" },
    { road: "A24", slug: "exit-1-hamburg-horn", day: null },
  ];
  it("one file per language, every entry its exit page — address and lastmod only, its alternates are in the page's head (2.4.2)", () => {
    for (const lang of LIVE_LANGS) {
      const xml = exitsLangXml(lang, exits);
      expect(locs(xml), lang).toEqual(exits.map((e) => `https://viafrei.de${motorwayExitPath(lang, e.road, e.slug)}`));
      expect(xml, lang).not.toContain("hreflang");
      expect(exitsSitemap(lang)).toBe(`/sitemap-exits-${lang}.xml`);
    }
  });
  it("an entry's lastmod: the newer of the template's day and the day its state last moved — never older than the template", () => {
    const xml = exitsLangXml("de", exits, "2026-10-20");
    expect([...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])).toEqual(["2099-01-01", "2026-10-20"]);
    expect(exitsLangXml("de", [{ road: "A7", slug: "exit-1-x", day: "2026-01-01" }], "2026-10-20")).toContain("<lastmod>2026-10-20</lastmod>");
    expect(exitsLangXml("de", [])).toMatch(/<urlset[^>]*><\/urlset>\n$/);
  });
  it("the index names the de and en exit files (#49) with the register's newest day, or the template's when the register did not answer", () => {
    const files = indexFiles("2099-01-01");
    expect(files.filter((f) => f.path.startsWith("/sitemap-exits-")).map((f) => f.path)).toEqual(["de", "en"].map((l) => exitsSitemap(l as Lang)));
    for (const l of ["de", "en"] as const) {
      expect(files.find((f) => f.path === exitsSitemap(l))?.lastmod, l).toBe("2099-01-01");
      expect(indexFiles(null).find((f) => f.path === exitsSitemap(l))?.lastmod, l).toBe(lastmodOf("motorway", l));
    }
    expect(newestDay(["2026-10-01", null, "2026-10-03"])).toBe("2026-10-03");
  });
});

// ---------------------------------------------------------------------------
// The head an exit page and the index read off the digest
// ---------------------------------------------------------------------------

const fragment = (attrs: string, rest = "<p>x</p>"): string => `<section class="motorway" id="motorway"${attrs} aria-labelledby="motorway-now-t">${rest}</section>`;

describe("an exit page's head, read off the fragment and stripped (#1025)", () => {
  it("the robots of the exit rule, the exit's name and its point; every attribute gone from the page", () => {
    const h = motorwayHeadOf("A7", fragment(' data-title="A7 Probeort-3: Baustelle" data-robots="index, follow" data-exit="Probeort-3" data-exit-lat="53.70000" data-exit-lon="9.50000"'));
    expect([h.robots, h.exit]).toEqual(["index, follow", { name: "Probeort-3", lat: 53.7, lon: 9.5 }]);
    expect(h.html).toBe(fragment(""));
    expect(motorwayHeadOf("A7", fragment(' data-robots="noindex, follow"')).robots).toBe("noindex, follow");
  });
  it("anything that is not the digest's is null: another directive, a hollow name, a point outside Germany or not at five decimals", () => {
    for (const r of ["index", "noindex", "none", "INDEX, FOLLOW", ""]) expect(motorwayHeadOf("A7", fragment(` data-robots="${r}"`)).robots, r).toBeNull();
    for (const n of ["", "  ", "{exit}", "x undefined", "&lt;b&gt;", "y".repeat(81)]) expect(motorwayHeadOf("A7", fragment(` data-exit="${n}"`)).exit, n).toBeNull();
    const at = (lat: string, lon: string) => motorwayHeadOf("A7", fragment(` data-exit="X" data-exit-lat="${lat}" data-exit-lon="${lon}"`)).exit;
    expect(at("40.00000", "9.50000")).toEqual({ name: "X", lat: null, lon: 9.5 });
    expect(at("53.7", "17.00000")).toEqual({ name: "X", lat: null, lon: null });
    expect(motorwayHeadOf("A7", fragment("")).exit).toBeNull();
  });
});

describe("the index's description, read off the index fragment and stripped (#1028)", () => {
  const index = (attrs: string): string => `<section class="motorways" id="motorway-index" aria-label="Alle Autobahnen"${attrs}><p>x</p></section>`;
  it("the national sums in words; the attribute gone from the page", () => {
    const h = motorwayIndexHeadOf(index(' data-description="Jetzt: 3 Sperrungen &amp; 2 Staus gemeldet."'));
    expect(h).toEqual({ html: index(""), description: "Jetzt: 3 Sperrungen & 2 Staus gemeldet." });
  });
  it("none (an older digest, no current read) or one that is not the digest's: null, and the page unchanged", () => {
    expect(motorwayIndexHeadOf(index(""))).toEqual({ html: index(""), description: null });
    for (const v of ["", "   ", "{list} gemeldet", "x".repeat(201), "&lt;b&gt;"]) expect(motorwayIndexHeadOf(index(` data-description="${v}"`)).description, v).toBeNull();
    expect(motorwayIndexHeadOf("<p>other</p>")).toEqual({ html: "<p>other</p>", description: null });
  });
});

// ---------------------------------------------------------------------------
// Breadcrumbs and the graphs (#1026 § 4, #1025)
// ---------------------------------------------------------------------------

describe("the breadcrumbs: one list per page type, for the trail and the JSON-LD alike", () => {
  it("motorway, exit, place and index, in every language, every step a page of the site", () => {
    for (const lang of LIVE_LANGS) {
      const exit = { name: "Hamburg-Horn", path: motorwayExitPath(lang, "A24", "exit-1-hamburg-horn") };
      expect(motorwayCrumbs(lang, "A24").map((c) => c.path), lang).toEqual([pathFor("start", lang), pathFor("motorways", lang), motorwayPath(lang, "A24")]);
      expect(motorwayCrumbs(lang, "A24", exit).map((c) => c.name), lang).toEqual([t(lang, "seo.crumbHome"), t(lang, "seo.crumbMotorways"), "A24", "Hamburg-Horn"]);
      expect(placeCrumbs(lang, "Köln", `/${lang}/place/koeln`).map((c) => c.path), lang).toEqual([pathFor("start", lang), `/${lang}/place/koeln`]);
      expect(motorwaysCrumbs(lang).map((c) => c.path), lang).toEqual([pathFor("start", lang), pathFor("motorways", lang)]);
    }
  });
  it("the motorway page's BreadcrumbList is the visible trail", () => {
    const g = JSON.parse(motorwayJsonLd("en", "A7", "/en/autobahn/a7")) as { "@graph": { "@type": string; itemListElement?: { name: string; item: string }[] }[] };
    const list = g["@graph"].find((n) => n["@type"] === "BreadcrumbList")!.itemListElement!;
    expect(list.map((x) => [x.name, x.item])).toEqual(motorwayCrumbs("en", "A7").map((c) => [c.name, `https://viafrei.de${c.path}`]));
  });
  it("an exit page's graph: its own WebPage, four crumbs, the junction as a Place with its point — and the LCL's credit inside it (M27)", () => {
    const path = motorwayExitPath("de", "A24", "exit-1-hamburg-horn");
    const meta = { title: "A24 Hamburg-Horn: Stau, Baustelle, Sperrung aktuell", description: "A24 Hamburg-Horn jetzt: 1 Sperrung." };
    const g = (JSON.parse(exitJsonLd("de", "A24", meta, { name: "Hamburg-Horn", path, lat: 53.56, lon: 10.08 })) as Graph)["@graph"];
    const page = g.find((n) => n["@type"] === "WebPage")!;
    expect([page["name"], page["description"], page["url"]]).toEqual([meta.title, motorwayMeta("A24", "de").description, `https://viafrei.de${path}`]);
    // S3: the dataset's source and its creator travel with the credit, all from the register's bast_lcl entry
    expect(page["isBasedOn"]).toEqual({
      "@type": "CreativeWork",
      name: "TMC Location Code List (LCL)",
      url: "https://www.bast.de/DE/Themen/Digitales/HF_1/Massnahmen/LCL/location-code-list.html",
      creator: { "@type": "Organization", name: "Bundesanstalt für Straßenwesen (BASt)", url: "https://www.bast.de" },
      creditText: LCL_CREDIT.text,
      license: LCL_CREDIT.licence,
    });
    const reg = (catalogue as { credits: { id: string; text: string; url: string }[] }).credits.find((c) => c.id === "bast_lcl")!;
    expect([LCL_CREDIT.url, LCL_CREDIT.text]).toEqual([reg.url, reg.text]);
    expect(reg.text).toContain(LCL_CREDIT.creator.name);
    expect(LCL_CREDIT.text).toContain("BASt");
    expect(LCL_CREDIT.licence).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect((g.find((n) => n["@type"] === "BreadcrumbList")!["itemListElement"] as unknown[]).length).toBe(4);
    expect(g.find((n) => n["@type"] === "Place")).toMatchObject({ name: "Hamburg-Horn", geo: { "@type": "GeoCoordinates", latitude: 53.56, longitude: 10.08 }, address: { addressCountry: "DE" } });
    const noPoint = (JSON.parse(exitJsonLd("de", "A24", meta, { name: "Hamburg-Horn", path, lat: null, lon: 10 })) as Graph)["@graph"];
    expect(noPoint.find((n) => n["@type"] === "Place")!["geo"]).toBeUndefined();
    expect(exitJsonLd("de", "A24", meta, { name: "</script><b>", path, lat: null, lon: null })).not.toContain("</script>");
  });
  it("S3: no live figure reaches the graph — the page's live description is planted in every language, and no digit or count word of it travels", () => {
    const COUNT_WORDS = /\b(?:kein|keine|keinen|eins?|eine[nm]?|zwei|drei|vier|fünf|no|none|one|two|three|four|five)\b/iu;
    for (const lang of LIVE_LANGS) {
      const path = motorwayExitPath(lang, "A24", "exit-1-hamburg-horn");
      // what the digest's exit description says on a live day: counts, a zero in words, a Stand
      const live = { title: "A24 Hamburg-Horn", description: "A24 Hamburg-Horn jetzt: 3 Sperrungen, keine Baustelle, 2 Staus (Stand 11:57). now: one closure, no jam." };
      const json = exitJsonLd(lang, "A24", live, { name: "Hamburg-Horn", path, lat: 53.56, lon: 10.08 });
      const page = (JSON.parse(json) as Graph)["@graph"].find((n) => n["@type"] === "WebPage")!;
      const d = String(page["description"]);
      expect(d, lang).toBe(motorwayMeta("A24", lang).description);
      expect(d.split("A24").join(""), lang).not.toMatch(/\d/u);
      if (lang === "de" || lang === "en") expect(d, lang).not.toMatch(COUNT_WORDS);
      expect(json, lang).not.toContain("Sperrungen, keine");
      expect(json, lang).not.toContain("11:57");
      expect(json, lang).not.toContain("one closure");
    }
  });
});

// ---------------------------------------------------------------------------
// The new words, in every page language (parity)
// ---------------------------------------------------------------------------

describe("the new words in every page language (#1026, #1028)", () => {
  it("the trail's label and the index's title exist in every language, are translated, and the title fits", () => {
    for (const lang of LIVE_LANGS as readonly Lang[]) {
      expect(t(lang, "a11y.crumbs"), lang).toMatch(/\S/);
      const title = t(lang, "seo.motorwaysTitle");
      expect(title.endsWith(" – ViaFrei"), lang).toBe(true);
      expect(fitTitle(title).length, lang).toBeLessThanOrEqual(TITLE_FIT);
      expect(pageMeta("motorways", lang).title, lang).toBe(fitTitle(title));
      if (lang !== "de") {
        expect(t(lang, "a11y.crumbs"), lang).not.toBe(de.a11y.crumbs);
        expect(title, lang).not.toBe(de.seo.motorwaysTitle);
      }
    }
    expect(pageMeta("motorways", "de").title).toBe("Autobahn Stau, Baustellen & Sperrungen aktuell – Deutschland");
  });
});
