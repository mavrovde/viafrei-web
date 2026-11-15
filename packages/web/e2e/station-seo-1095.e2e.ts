/**
 * #1095 against the BUILT shell and the REAL digest (`real-digest.ts`): two station pages — Köln Hbf (no town page in
 * the fixture) and Bonn Hbf (its Gemeinde's town page) — in German and English carry the head a search result is made
 * of: the title and the description of `stationMeta`, the station as the one h1, a visible lead naming it with its
 * Land, and a JSON-LD graph whose trail runs home → stations → the Land → (the town →) the station, every step a page
 * of this site, the TrainStation with its Land (and its town page), and the WebPage with the record's Stand. And the
 * pages stay crawlable: no noindex on the bare page, robots.txt blocks no station path.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { stationNowOf } from "../src/lib/place-head.js";
import { stationMeta } from "../src/site/meta.js";
import { pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8819;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = "https://viafrei.de";
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "SEO Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "seo@example.invalid" });
});
afterAll(async () => {
  shell?.kill();
  await digest?.close();
});

const get = async (path: string): Promise<{ status: number; body: string }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
};
const graphOf = (body: string): Record<string, unknown>[] => {
  const ld = /<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/.exec(body)?.[1];
  expect(ld, "the page carries its graph").toBeDefined();
  return (JSON.parse(ld!) as { "@graph": Record<string, unknown>[] })["@graph"];
};

const CASES = [
  { slug: "koeln-hbf", name: "Köln Hbf", city: "Köln", land: { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, landKey: "05", town: null, now: "disruption" },
  { slug: "bonn-hbf", name: "Bonn Hbf", city: "Bonn", land: { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, landKey: "05", town: "bonn", now: "nothing" },
] as const;

describe("#1095 a station page's head is written for search", () => {
  for (const c of CASES) {
    for (const lang of ["de", "en"] as const) {
      it(`${stationPath(lang, c.slug)}: title, description, h1, lead, trail, Land, town and Stand`, async () => {
        const r = await get(stationPath(lang, c.slug));
        expect(r.status).toBe(200);
        // #1175 AC6: the live part answered, so its status line leads the description, and a station with something
        // reported is titled by it (Köln's fixture: a disruption; Bonn's: nothing, which keeps the search phrase)
        const now = stationNowOf(/<p [^>]*class="statusline[\s\S]*?<\/p>/u.exec(r.body)?.[0] ?? null);
        expect(now?.kind, "the page carries its live status line").toBe(c.now);
        const meta = stationMeta(c.name, lang, c.city, now);
        if (c.now === "nothing") expect(meta.title).toBe(stationMeta(c.name, lang, c.city).title);
        // the document's title (an SVG's <title> below it is a picture's name, not the page's)
        expect(/<head>[\s\S]*?<title>([^<]*)<\/title>/u.exec(r.body)?.[1]?.replace(/&amp;/g, "&")).toBe(meta.title);
        expect(all(r.body, 'meta[name="description"]').map((e) => e.attrs.content)).toEqual([meta.description]);
        expect(all(r.body, "h1").map(nodeText)).toEqual([c.name]);
        const lead = all(r.body, "p.stpage__intro").map(nodeText);
        expect(lead).toHaveLength(1);
        expect(lead[0]).toContain(`${c.name}, ${c.land[lang]}`);
        // crawlable: the bare page is indexed (its fuel card makes it noarchive, never noindex)
        expect(r.body).not.toMatch(/<meta name="robots" content="[^"]*noindex/u);

        const g = graphOf(r.body);
        expect(g.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList", "TrainStation"]);
        const trail = (g.find((n) => n["@type"] === "BreadcrumbList")!["itemListElement"] as { position: number; name: string; item: string }[]);
        const expected = [
          `${ORIGIN}${pathFor("start", lang)}`,
          `${ORIGIN}${pathFor("stations", lang)}`,
          `${ORIGIN}${pathFor("stations", lang)}?land=${c.landKey}`,
          ...(c.town === null ? [] : [`${ORIGIN}${placePath(lang, c.town)}`]),
          `${ORIGIN}${stationPath(lang, c.slug)}`,
        ];
        expect(trail.map((x) => x.item)).toEqual(expected);
        expect(trail.map((x) => x.position)).toEqual(expected.map((_, i) => i + 1));
        expect(trail[2]!.name).toBe(c.land[lang]);
        // the visible trail is the graph's
        expect(all(r.body, "nav.crumbs a").map((a) => `${ORIGIN}${a.attrs.href ?? ""}`)).toEqual(expected.slice(0, -1));
        const station = g.find((n) => n["@type"] === "TrainStation")!;
        expect((station["address"] as Record<string, unknown>)["addressRegion"]).toBe(c.land[lang]);
        if (c.town === null) expect(station["containedInPlace"]).toBeUndefined();
        else expect((station["containedInPlace"] as Record<string, unknown>)["url"]).toBe(`${ORIGIN}${placePath(lang, c.town)}`);
        expect(typeof g.find((n) => n["@type"] === "WebPage")!["dateModified"]).toBe("string");
      });
    }
  }

  it("robots.txt keeps no crawler off a station page", async () => {
    const r = await get("/robots.txt");
    const disallows = r.body.split("\n").filter((l) => l.startsWith("Disallow: ")).map((l) => l.slice(10));
    for (const c of CASES) for (const lang of ["de", "en"] as const) expect(disallows.filter((d) => stationPath(lang, c.slug).startsWith(d))).toEqual([]);
  });
});
