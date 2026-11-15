/**
 * The station pages of #1041 against the BUILT shell and the REAL digest
 * (`real-digest.ts`, whose station fixture is Köln Hbf and Bonn Hbf): the
 * catalogue and a station page answer 200 in every language with the station's
 * name as the one h1, the canonical and every language's alternate pointing at
 * the same station, each card's licence line, and a JSON-LD graph carrying
 * StaDa's address and credit (#1044); the live part or its error block (#1042); another spelling and a renamed station's old slug are 301s, an
 * unknown station the 404 page; a search of the catalogue is noindex; the
 * per-language station sitemaps list the pages and robots.txt names them.
 * Since 2.4.2 the place, exit and station sitemaps carry no alternates, so a
 * place page's head is asserted here too: every language and x-default.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { DEFAULT_LANG, LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { stationsSitemap } from "../src/site/sitemaps.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8817;
const BASE = `http://127.0.0.1:${PORT}`;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
});
afterAll(async () => {
  shell?.kill();
  await digest?.close();
});

const get = async (path: string): Promise<{ status: number; location: string | null; body: string; headers: Headers }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), body: await r.text(), headers: r.headers };
};

describe("a place page's head carries every language's alternate and x-default (2.4.2: the sitemap no longer does)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${placePath(lang, "koeln")}`, async () => {
      const r = await get(placePath(lang, "koeln"));
      expect(r.status).toBe(200);
      for (const l of LIVE_LANGS) expect(all(r.body, `link[rel="alternate"][hreflang="${l}"]`).map((e) => e.attrs.href), l).toEqual([`https://viafrei.de${placePath(l, "koeln")}`]);
      expect(all(r.body, 'link[rel="alternate"][hreflang="x-default"]').map((e) => e.attrs.href)).toEqual([`https://viafrei.de${placePath(DEFAULT_LANG, "koeln")}`]);
    });
  }
});

describe("a station page (#1041)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${stationPath(lang, "koeln-hbf")}: 200, the name as the one h1, the same station in every language, a credit on every card`, async () => {
      const r = await get(stationPath(lang, "koeln-hbf"));
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(all(r.body, "h1").map(nodeText)).toEqual(["Köln Hbf"]);
      expect(all(r.body, "section.stpage#station")).toHaveLength(1);
      expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${stationPath(lang, "koeln-hbf")}"]`).length).toBeGreaterThan(0);
      for (const l of LIVE_LANGS) expect(r.body).toContain(`hreflang="${l}" href="https://viafrei.de${stationPath(l, "koeln-hbf")}"`);
      expect(r.body).toContain(`hreflang="x-default" href="https://viafrei.de${stationPath(DEFAULT_LANG, "koeln-hbf")}"`);
      // the static cards and, since #1042, the live ones (an article each; the live platforms card stands in for the static one)
      const cards = [...all(r.body, "section.stpage__card"), ...all(r.body, "article.stpage__card")];
      expect(cards.length).toBeGreaterThan(2);
      for (const card of cards) expect(all(card, ".credit").length, card.attrs.id ?? "").toBeGreaterThan(0);
      expect(r.body).toContain("Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet");
      const ld = /<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/.exec(r.body)?.[1];
      const graph = (JSON.parse(ld!) as { "@graph": { "@type": string }[] })["@graph"];
      expect(graph.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList", "TrainStation"]);
      // #1044: the TrainStation carries StaDa's address and its credit, free entry, and no live figure
      const station = graph.find((n) => n["@type"] === "TrainStation") as Record<string, unknown>;
      expect(station["isAccessibleForFree"]).toBe(true);
      expect((station["address"] as Record<string, unknown>)["addressLocality"]).toBe("Köln");
      expect((station["isBasedOn"] as Record<string, unknown>)["creditText"]).toBe("Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet");
      expect(ld).not.toMatch(/Min\. später|min late|fällt aus|außer Betrieb|out of service/);
      // #1042: the live part (or its one-sentence error block) after the head; every live card with its licence line
      // the LIVE part itself — the selector alone also matches the one-sentence error block (`stlive--error`)
      expect(all(r.body, "section.stlive#station-live")).toHaveLength(1);
      expect(all(r.body, "section.stlive--error")).toHaveLength(0);
      expect(all(r.body, "section.stlive#station-live article.stpage__card").length).toBeGreaterThan(0);
      for (const card of all(r.body, "article.stpage__card")) expect(all(card, ".credit").length, card.attrs.id ?? "").toBeGreaterThan(0);
    });
  }

  for (const lang of ["de", "en"] as const) {
    it(`${stationPath(lang, "koeln-hbf")}?platform=4: a person's filter is noindex with the bare page as its canonical; the refresh script rides along`, async () => {
      const r = await get(`${stationPath(lang, "koeln-hbf")}?platform=4&access=1`);
      expect(r.status).toBe(200);
      // #1084: the page carries its area's fuel card, so it is noarchive as well (the fuel page's rule)
      expect(r.body).toContain('content="noindex, follow, noarchive"');
      expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${stationPath(lang, "koeln-hbf")}"]`).length).toBeGreaterThan(0);
      // the preconditions, unconditionally: the live part rendered (not its error block), its cards refresh in place and
      // its board carries the filter form — so the two claims below are about something the page has
      expect(all(r.body, "section.stlive--error")).toHaveLength(0);
      expect(r.body).toContain('data-card="/fragment/card?station=');
      expect(all(r.body, "form.stlive__filter")).toHaveLength(1);
      expect(r.body).toContain("&amp;platform=4");
      expect(r.headers.get("content-security-policy") ?? "").toContain("form-action 'self'");
    });
  }

  it("another spelling is a 301 to the slug; a renamed station's old slug a 301 to its page; an unknown one the 404 page", async () => {
    const respelled = await get("/en/station/K%C3%B6ln%20Hbf");
    expect(respelled.status).toBe(301);
    expect(respelled.location).toMatch(/\/en\/station\/koeln-hbf$/);
    const moved = await get("/fr/station/koeln-alt");
    expect(moved.status).toBe(301);
    expect(moved.location).toMatch(/\/fr\/station\/koeln-hbf$/);
    const unknown = await get("/de/station/gibt-es-nicht");
    expect(unknown.status).toBe(404);
  });
});

describe("the station catalogue (#1041)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${pathFor("stations", lang)}: 200, its h1 and every station of the largest linked`, async () => {
      const r = await get(pathFor("stations", lang));
      expect(r.status).toBe(200);
      expect(all(r.body, "h1").length).toBe(1);
      expect(r.body).toContain(`href="${stationPath(lang, "koeln-hbf")}"`);
      expect(all(r.body, "form.stpage-search")).toHaveLength(1);
    });
  }

  it("a search is noindex with the bare catalogue as its canonical", async () => {
    const r = await get(`${pathFor("stations", "de")}?q=bonn`);
    expect(r.status).toBe(200);
    expect(r.body).toContain('content="noindex, follow"');
    expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${pathFor("stations", "de")}"]`).length).toBeGreaterThan(0);
    expect(r.body).toContain(`href="${stationPath("de", "bonn-hbf")}"`);
  });
});

describe("the station sitemaps (#1041)", () => {
  it("each language's file lists every station page (address and lastmod; the alternates are in the head); robots.txt names every file", async () => {
    const robots = (await get("/robots.txt")).body;
    for (const lang of LIVE_LANGS) {
      const r = await get(stationsSitemap(lang));
      expect(r.status).toBe(200);
      const locs = all(r.body, "url loc").map((e) => nodeText(e));
      expect(locs).toContain(`https://viafrei.de${stationPath(lang, "koeln-hbf")}`);
      expect(locs).toContain(`https://viafrei.de${stationPath(lang, "bonn-hbf")}`);
      expect(robots).toContain(`Sitemap: https://viafrei.de${stationsSitemap(lang)}`);
    }
    expect((await get("/sitemap-index.xml")).body).toContain(`https://viafrei.de${stationsSitemap("de")}`);
  });
});
