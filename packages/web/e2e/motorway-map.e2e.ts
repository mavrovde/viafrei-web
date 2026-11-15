/**
 * The motorway page's map, junction strip, filter, service layers and the
 * deferred fuel fragment of #716 (2.1.15), against the BUILT shell and the
 * REAL digest (`real-digest.ts` + `real-motorway.ts`: the A7 at production's
 * size, its LCL chain broken once), in every language — and the measurement
 * of G1–G4 on a shell WITH a tag, in a clean browser profile.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { MOTORWAY_FUEL_PATH } from "../src/lib/motorway-fuel.js";
import { GTAG_ORIGIN } from "../src/security/csp.js";
import { FRAGMENT_DISALLOW } from "../src/site/discovery.js";
import { motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8816;
const TAG_PORT = 8817;
const BASE = `http://127.0.0.1:${PORT}`;
const TAGGED = `http://127.0.0.1:${TAG_PORT}`;
/** A person's browser: the gate (M16 c) refuses `HeadlessChrome`, which the default user agent of the test browser names. */
const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = { IMPRESSUM_NAME: "Map Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "map@example.invalid" };
/** M2, verbatim: the `bkg_vg2500` register string as it reads on the page. */
const BKG = "Kartengrundlage: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf (Daten verändert)";
/** #984: the `bkg_gvisys` register string, the towns' line. */
const GN250 = "Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_gn250.pdf (Daten verändert)";
const LCL = "TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet";

let browser: Browser;
const shells: ChildProcess[] = [];
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shells.push(await startShell(PORT, { ...ID, DIGEST_URL: digest.url }));
  shells.push(await startShell(TAG_PORT, { ...ID, DIGEST_URL: digest.url, GOOGLE_TAG: "G-0" }));
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await digest?.close();
});

const get = async (path: string, headers: Record<string, string> = {}, base = BASE) => {
  const r = await fetch(`${base}${path}`, { redirect: "manual", headers });
  return { status: r.status, body: await r.text(), headers: r.headers };
};
const between = (s: string, open: RegExp, close: string): string => {
  const m = open.exec(s);
  if (m === null) return "";
  const end = s.indexOf(close, m.index);
  return end < 0 ? "" : s.slice(m.index, end + close.length);
};
const text = (html: string): string => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("the map (M1–M8)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${motorwayPath(lang, "A7")}: an inline SVG with its title and description, the BKG base, the line broken where the chain breaks, and the M2/M3 credits verbatim in the figcaption`, async () => {
      const r = await get(motorwayPath(lang, "A7"));
      expect(r.status).toBe(200);
      const fig = between(r.body, /<figure class="motorway__map"/, "</figure>");
      expect(fig).not.toBe("");
      const svg = between(fig, /<svg class="motorway__svg"/, "</svg>");
      // 2.4.8 (#1085 AC 2): the marks link to their rows, so the SVG is a group — the children of role="img" are
      // presentational and a screen reader would never reach the links (`mapRole`)
      expect(svg).toMatch(/^<svg class="motorway__svg" viewBox="[^"]+" role="group" aria-labelledby="mw-map-t mw-map-d"/);
      expect(all(svg, "a.map-link").length).toBeGreaterThan(0);
      // the description's two end junctions are names, marked as the page marks names (#449): text and <tspan translate="no"> only
      const desc = /<title id="mw-map-t">[^<]*A7[^<]*<\/title><desc id="mw-map-d">((?:[^<]|<tspan translate="no">[^<]+<\/tspan>)+)<\/desc>/.exec(svg);
      expect(desc, "title and description").not.toBeNull();
      expect([...(desc?.[1] ?? "").matchAll(/<tspan translate="no">([^<]+)<\/tspan>/g)].map((m) => m[1])).toHaveLength(2);
      expect(all(svg, ".mw-land").length).toBeGreaterThan(0);
      expect(all(svg, ".mw-borders").length).toBeGreaterThan(0);
      // M3: the LCL chain of the fixture breaks once, so the line is two runs and nothing bridges the gap
      const line = /<path class="mw-line" d="([^"]+)"/.exec(svg)?.[1] ?? "";
      expect(line.match(/M/g)).toHaveLength(2);
      // M4/M6: no OpenStreetMap, no Tankerkönig, no share-alike source inside the SVG; M7: no data-* attribute
      // "OSM" as a word, never inside one: Latvian "posmiem" (sections) is not OpenStreetMap (#768)
      expect(svg).not.toMatch(/openstreetmap|\bOSM\b|osm_|Pendlerparkplatz|tankerk|Muster Tankstelle|Truckpark Beispielfeld|P\+R Bahnhof|data-/i);
      // M5: the events are drawn — a closure, a jam with its delay
      expect(all(svg, ".mw-closure").length).toBeGreaterThan(0);
      expect(all(svg, ".mw-jam").length).toBeGreaterThan(0);
      expect(svg).toMatch(/<g class="mw-delay"/);
      // M25: the DWD warning's stretch mark
      expect(all(svg, ".mw-warn").length).toBeGreaterThan(0);
      // M2: the figcaption directly under the SVG carries the BKG line verbatim, BKG and the licence linked as the terms prescribe
      const cap = between(fig, /<figcaption>/, "</figcaption>");
      expect(fig.indexOf("</svg>")).toBeLessThan(fig.indexOf("<figcaption>"));
      expect(text(cap)).toContain(BKG);
      expect(all(cap, "a[href=\"https://www.bkg.bund.de\"][rel=\"license noopener noreferrer\"]").map(nodeText)).toContain("BKG");
      expect(all(cap, "a[href=\"https://www.govdata.de/dl-de/by-2-0\"][rel=\"license noopener noreferrer\"]").map(nodeText)).toContain("dl-de/by-2-0");
      // M3: the LCL line, and the warning marks' altered-form credit (M25) — never the warnings' Quellenvermerk in the caption
      expect(text(cap)).toContain(LCL);
      expect(text(cap)).toContain("Datenbasis: Deutscher Wetterdienst, zusammengefasst");
      // (the road-weather stations' own Quellenvermerk is there, unaltered dots — M24 — and is a different line)
      expect(text(cap)).not.toMatch(/Quelle: Deutscher Wetterdienst(?!\. Datenquelle: BMVBS)/);
      // a legend
      expect(cap).toMatch(/<ul class="motorway__legend"/);
      // #984 (M32): the context — the Großstädte named in <text> (40 at most, German names on every page), the other
      // motorways under the line, a scale bar and a north arrow — and the GN250 line exactly because towns are drawn
      // #985: a city-state (Berlin, Hamburg) is named once, as its Land's label, never again as a town — so the names
      // are read across the towns AND the Länder groups, and each appears exactly once
      const textsOf = (cls: string): string[] => {
        const grp = between(svg, new RegExp(`<g class="${cls}" translate="no">`), "</g>");
        return [...grp.matchAll(/<text [^>]*>([^<]+)<\/text>/g)].map((m) => m[1]!);
      };
      const towns = textsOf("mwc-towns");
      const names = [...towns, ...textsOf("mwc-lands")];
      expect(names).toEqual(expect.arrayContaining(["Berlin", "Hamburg", "München"]));
      for (const n of ["Berlin", "Hamburg", "München"]) expect(names.filter((x) => x === n), n).toHaveLength(1);
      expect(towns).toContain("München");
      expect(names.length).toBeLessThanOrEqual(40);
      expect(svg).toMatch(/<g class="mwc-roads" aria-hidden="true">/);
      expect(svg).toMatch(/<g class="mwc-scale" aria-hidden="true">/);
      expect(svg).toMatch(/<g class="mwc-north" aria-hidden="true">/);
      expect(text(cap)).toContain(GN250);
    });
  }
});

describe("the junction strip and the filter (M9, M30)", () => {
  it("the strip lists the junctions in the page's order, the same order as the filter's choices", async () => {
    const r = await get(motorwayPath("de", "A7"));
    const strip = between(r.body, /<ol class="motorway__junctions motorway__strip"/, "</ol>");
    const items = [...strip.matchAll(/<li\b/g)].length;
    const options = [...between(r.body, /<select name="from"/, "</select>").matchAll(/<option value="([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(items).toBeGreaterThan(100);
    expect(options).toHaveLength(items);
    expect(text(r.body)).toContain(LCL);
  });

  it("a stretch, a direction and the layers are a GET form to the bare page, answered with a 303 to the stretch's path; the stretch is noindex with its own canonical, never kept (#892)", async () => {
    const r = await get(motorwayPath("de", "A7"));
    expect(r.body).toMatch(/<form class="motorway__filter" method="get" action="\/de\/autobahn\/a7">/);
    expect(r.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(r.body).not.toContain('name="robots"');
    const opts = [...between(r.body, /<select name="from"/, "</select>").matchAll(/<option value="([a-z0-9-]+)"/g)].map((m) => m[1]!);
    // #892: the form's query is a 303 to the stretch as a path — junction slugs, never a BASt code
    const form = await get(`${motorwayPath("de", "A7")}?from=${opts[10]!}&to=${opts[40]!}&dir=pos`);
    expect(form.status).toBe(303);
    const to = form.headers.get("location") ?? "";
    expect(to).toMatch(new RegExp(`^/de/autobahn/a7/${opts[10]!}-to-${opts[40]!}/towards-[a-z0-9-]+$`));
    expect(to).not.toMatch(/\d{5}/);
    const v = await get(to);
    expect(v.status).toBe(200);
    expect(all(v.body, "meta[name=\"robots\"][content=\"noindex, follow\"]").length).toBeGreaterThan(0);
    expect(all(v.body, `link[rel="canonical"][href="https://viafrei.de${to}"]`).length).toBeGreaterThan(0);
    const strip = between(v.body, /<ol class="motorway__junctions motorway__strip"/, "</ol>");
    expect([...strip.matchAll(/<li\b/g)].length).toBe(31);
    // a layer switched off is not rendered
    const noParking = await get(`${motorwayPath("de", "A7")}?f=1&layer=events&layer=charging`);
    expect(all(noParking.body, "meta[name=\"robots\"][content=\"noindex, follow\"]").length).toBeGreaterThan(0);
    expect(noParking.body).not.toContain('id="mw-parking"');
    expect(noParking.body).toContain('id="mw-charging"');
  });

  it("works without JavaScript: the form submits and the page answers the choice", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}${motorwayPath("en", "A7")}`, { waitUntil: "load" });
      const opts = await page.locator('select[name="from"] option[value]:not([value=""])').evaluateAll((os) => os.map((o) => o.getAttribute("value") ?? ""));
      await page.selectOption('select[name="from"]', opts[5]!);
      await page.selectOption('select[name="to"]', opts[20]!);
      await page.check('input[name="dir"][value="neg"]');
      await Promise.all([page.waitForNavigation(), page.click('form.motorway__filter button[type="submit"]')]);
      const u = new URL(page.url());
      // #892: the form's choice is a 303 to the stretch's path — junction slugs, `-to-`, then `towards-<end>`
      expect(u.pathname).toMatch(new RegExp(`^/en/autobahn/a7/${opts[5]!}-to-${opts[20]!}/towards-[a-z0-9-]+$`));
      // the layers stay the query; the stretch and direction never do
      expect(u.search).not.toMatch(/from=|to=|dir=/);
      expect(await page.locator("ol.motorway__strip > li").count()).toBe(16);
      // without a script the fuel layer stays empty and the page says why
      expect(await page.locator(".motorway__fuelout").innerHTML()).toBe("");
      expect(await page.locator(".motorway__nojs").isVisible()).toBe(true);
    } finally {
      await ctx.close();
    }
  });
});

describe("the service layers (M10–M13, M23, M24)", () => {
  it("parking with live free spaces and its own credits; the OSM car parks, Trucklounge and P+R NRW each in their own block with the offer", async () => {
    const r = await get(motorwayPath("de", "A7"));
    const parking = between(r.body, /<section class="pcard mwk" id="mwk-parking" aria-labelledby="mw-parking">/, "</section>");
    expect(parking).not.toBe("");
    expect(text(parking)).toMatch(/frei/);
    expect(parking).toContain("pcard__osm");
    expect(text(parking)).toContain("OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0");
    expect(text(r.body)).toContain("Truckpark Beispielfeld");
    expect(text(r.body)).toContain("P+R Bahnhof Musterstadt");
  });

  it("chargers, cameras as links (never an image) and road weather as a forecast", async () => {
    const r = await get(motorwayPath("de", "A7"));
    expect(r.body).toContain('id="mw-charging"');
    const cams = between(r.body, /<section class="pcard mwk" id="mwk-cameras" aria-labelledby="mw-cameras">/, "</section>");
    expect(cams).not.toBe("");
    expect(cams).not.toMatch(/<img|<picture|<iframe|<video/);
    expect(r.body).not.toMatch(/<img\b/);
    // #901 D5: the road-surface forecast is its own card beside the DWD warnings' card
    const weather = between(r.body, /<section class="pcard mwk" id="mwk-roadweather" aria-labelledby="mwk-roadweather-t">/, "</section>");
    expect(text(weather)).toMatch(/Vorhersage/);
  });
});

/**
 * A fuel datum the crawler-open page may never carry: the fixture's station, a price shape, the count line. A price is a
 * number of the 1,65x–1,69x shape NOT followed by a distance unit — #998's crossings card prints road lengths such as
 * "1.662 km", which are not prices (#1049).
 */
const FUEL_DATUM = /\bMUSTER\b|\b1[.,]6[5-9]\d\b(?!\s*(?:km|m)\b)|Tankstellen mit Preis/;

describe("no fuel datum on the crawler-open page (M14, M15)", () => {
  it("the datum rule still catches a planted price and passes a distance (#1049)", () => {
    for (const price of ["1,669 €", "1.659", "Diesel 1,689"]) expect(price).toMatch(FUEL_DATUM);
    for (const distance of ["1.662 km", "1.662\u00a0km", "1,675 m"]) expect(distance).not.toMatch(FUEL_DATUM);
  });
  for (const lang of LIVE_LANGS) {
    for (const road of ["A7", "A1"]) {
      it(`${motorwayPath(lang, road)}: no Tankerkönig string, station, price or count — only the empty layer`, async () => {
        const r = await get(motorwayPath(lang, road));
        expect(r.status).toBe(200);
        expect(r.body).not.toMatch(/tankerk|MTS-K|Muster Tankstelle|Raststättenweg|00000000-0000-0000-0000/i);
        expect(r.body).not.toMatch(FUEL_DATUM);
        expect(all(r.body, ".motorway__fuelout")).toHaveLength(1);
        expect(between(r.body, /<div class="motorway__fuelout"[^>]*>/, "</div>")).toMatch(/^<div class="motorway__fuelout"[^>]*>\s*<\/div>$/);
        expect(r.body).toMatch(/<section class="pcard mwk motorway__fuel vf-noclarity" id="mwk-fuel" aria-labelledby="mw-fuel" data-nosnippet>/);
      });
    }
  }
});

describe("the fuel fragment (M16–M22)", () => {
  it("(a, b, c) its path is disallowed in every robots group; every answer is private, no-store and noindex; a crawler gets the sentence only", async () => {
    const robots = (await get("/robots.txt")).body;
    const groups = robots.split("\n").filter((l) => l.startsWith("User-agent:")).length;
    // since #1065 (C2) every group disallows the whole fragment prefix, which covers this path; no place line is written
    expect(MOTORWAY_FUEL_PATH.startsWith(FRAGMENT_DISALLOW)).toBe(true);
    expect(groups).toBeGreaterThan(1);
    expect(robots.split("\n").filter((l) => l === `Disallow: ${FRAGMENT_DISALLOW}`)).toHaveLength(groups);
    expect(robots).not.toMatch(/^Disallow: .*\/place\//m);
    const person = await get(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, { "user-agent": PERSON_UA, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" });
    const crawler = await get(`${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "sec-fetch-site": "same-origin" });
    for (const r of [person, crawler]) {
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
      expect(r.body).not.toMatch(/<script|astro-island|googletagmanager/);
    }
    expect(person.body).toContain("Muster Tankstelle");
    expect(crawler.body).not.toMatch(/Muster Tankstelle|tankerk|\d[.,]\d{3}/i);
    // (M17) at most ten stations
    expect([...person.body.matchAll(/<li>/g)].length).toBeLessThanOrEqual(10);
    expect([...person.body.matchAll(/<li>/g)].length).toBeGreaterThan(0);
    // (M21) the Tankerkönig line and the MTS-K note verbatim, with the priced rows
    expect(person.body).toContain("tankerkoenig.de");
    expect(person.body).toContain("Hinweis zu den Kraftstoffpreisdaten (MTS-K)");
    // (M18) each price with its own time
    expect(text(person.body)).toMatch(/Preis von \d{2}:\d{2}/);
    // a POST is refused (Astro's origin check answers 403 first; the route's own ALL is 405) and carries no station
    const post = await fetch(`${BASE}${MOTORWAY_FUEL_PATH}?road=A7&lang=de`, { method: "POST" });
    expect([403, 405]).toContain(post.status);
    expect(await post.text()).not.toContain("Muster Tankstelle");
  });

  for (const lang of ["de", "tr"] as const) {
    it(`(d) ${motorwayPath(lang, "A7")}: nothing is asked before the card is in view; in view it asks once and shows the stations with their credit (PF2, owner 2026-10-26)`, async () => {
      const ctx = await browser.newContext({ userAgent: PERSON_UA });
      try {
        const page = await ctx.newPage();
        const asked: string[] = [];
        page.on("request", (q) => {
          if (q.url().includes("/fragment/")) asked.push(q.url());
        });
        await page.goto(`${BASE}${motorwayPath(lang, "A7")}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        expect(asked).toEqual([]);
        expect(await page.locator(".motorway__fuelout").innerHTML()).toBe("");
        expect(await page.locator(".motorway__fuelbtn").count()).toBe(0);
        await page.locator(".motorway__fuel").scrollIntoViewIfNeeded();
        await page.waitForSelector(".motorway__fuelout .motorway-fuel li");
        expect(asked).toHaveLength(1);
        expect(new URL(asked[0]!).pathname).toBe(MOTORWAY_FUEL_PATH);
        const out = await page.locator(".motorway__fuelout").innerHTML();
        expect(out).toContain("Hinweis zu den Kraftstoffpreisdaten (MTS-K)");
        expect([...out.matchAll(/<li>/g)].length).toBeLessThanOrEqual(10);
      } finally {
        await ctx.close();
      }
    });
  }

  it("(d) the stretch and direction of the address reach the fragment; the headless browser's own user agent is refused with the sentence", async () => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      const asked: string[] = [];
      page.on("request", (q) => {
        if (q.url().includes("/fragment/")) asked.push(q.url());
      });
      const r = await get(motorwayPath("de", "A7"));
      const opts = [...between(r.body, /<select name="from"/, "</select>").matchAll(/<option value="([a-z0-9-]+)"/g)].map((m) => m[1]!);
      await page.goto(`${BASE}${motorwayPath("de", "A7")}?from=${opts[3]!}&to=${opts[30]!}&dir=neg`, { waitUntil: "networkidle" });
      // #892: the form's query landed on the stretch's path; its two segments are what reach the fragment
      const [, , , , stretch, towards] = new URL(page.url()).pathname.split("/");
      expect(stretch).toBe(`${opts[3]!}-to-${opts[30]!}`);
      await page.locator(".motorway__fuel").scrollIntoViewIfNeeded();
      await page.waitForSelector(".motorway__fuelout .motorway-fuel");
      const q = new URL(asked[0]!).searchParams;
      expect([q.get("road"), q.get("lang"), q.get("stretch"), q.get("towards"), q.get("from")]).toEqual(["A7", "de", stretch, towards, null]);
      expect(await page.locator(".motorway__fuelout li").count()).toBe(0);
    } finally {
      await ctx.close();
    }
  });
});

type Seen = { google: string[] };
async function cleanProfile(): Promise<{ ctx: BrowserContext; seen: Seen }> {
  const ctx = await browser.newContext({ userAgent: PERSON_UA });
  const seen: Seen = { google: [] };
  await ctx.route(/https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google)\.com\/.*/, (route) => {
    seen.google.push(route.request().url());
    void route.fulfill({ status: 200, contentType: "application/javascript", body: "/* intercepted by motorway-map.e2e.ts — never fetched */" });
  });
  return { ctx, seen };
}
type Layer = { first: unknown; second: unknown; third: Record<string, unknown> | null }[];
const layerOf = (page: Page): Promise<Layer> =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map((e) => {
      const a = e as ArrayLike<unknown>;
      return { first: a[0], second: a[1], third: (a[2] as Record<string, unknown> | undefined) ?? null };
    }),
  );

describe("measuring the motorway pages (G1–G5)", () => {
  it("G1: the consent island and the tag's origin on the index and on a motorway page in all seven languages; never on a place page, the fuel page, the legal pages, the 404 or the fragment", async () => {
    for (const lang of LIVE_LANGS) {
      for (const path of [pathFor("motorways", lang), motorwayPath(lang, "A7")]) {
        const r = await get(path, {}, TAGGED);
        expect(r.status, path).toBe(200);
        expect(r.body, path).toMatch(/component-url="\/_a\/Consent\./);
        expect(r.headers.get("content-security-policy"), path).toContain(GTAG_ORIGIN);
        // the document title is the static one: no live count in it
        // (an apostrophe is escaped as `&#39;`, which is no count — #1173's French `fermeture aujourd'hui`)
        expect((/<title>([^<]*)<\/title>/.exec(r.body)?.[1] ?? "").replace(/&#\d+;/g, ""), path).not.toMatch(/\d{2,}/);
      }
    }
    for (const path of [placePath("de", "koeln"), pathFor("fuel", "de"), "/impressum", "/datenschutz", "/de/404", `${MOTORWAY_FUEL_PATH}?road=A7&lang=de`]) {
      const r = await get(path, { "user-agent": PERSON_UA, "sec-fetch-site": "same-origin" }, TAGGED);
      // the bar renders nothing until hydrated, so the island's component is what to look for (legal.e2e.ts)
      expect(r.body, path).not.toMatch(/component-url="\/_a\/Consent\./);
    }
    // and without a tag, a motorway page has no island at all
    expect(all((await get(motorwayPath("de", "A7"))).body, "astro-island")).toHaveLength(0);
  });

  for (const lang of ["de", "en"] as const) {
    it(`G2/G3: ${lang} clean profile on a motorway page with a stretch and an anchor — nothing to Google before accept, after it one page_view of the bare path, location and referrer cut to the path`, async () => {
      const { ctx, seen } = await cleanProfile();
      try {
        const page = await ctx.newPage();
        const r = await get(motorwayPath(lang, "A7"), {}, TAGGED);
        const opts = [...between(r.body, /<select name="from"/, "</select>").matchAll(/<option value="([a-z0-9-]+)"/g)].map((m) => m[1]!);
        await page.goto(`${TAGGED}${motorwayPath(lang, "A7")}?from=${opts[2]!}&to=${opts[9]!}&dir=pos#mw-map-h`, { waitUntil: "networkidle" });
        await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
        expect(seen.google).toEqual([]);
        await page.click(".consent__actions .btn:last-child"); // accept
        await page.waitForFunction(() => (window as unknown as { vfAnalytics?: boolean }).vfAnalytics === true);
        await page.waitForTimeout(200);
        expect(seen.google.length).toBeGreaterThanOrEqual(1);
        for (const u of seen.google) expect(u).not.toMatch(/from=|dir=|mw-map/);
        const layer = await layerOf(page);
        const config = layer.find((e) => e.first === "config");
        expect(config?.third).toEqual({ send_page_view: false, page_location: `${TAGGED}${motorwayPath(lang, "A7")}`, page_referrer: "" });
        const events = layer.filter((e) => e.first === "event");
        expect(events.map((e) => e.second)).toEqual(["page_view", "consent_accept"]);
        expect(events[0]?.third).toEqual({ route: motorwayPath(lang, "A7"), lang });
        // G3/G4: the filter, the layers and the fuel layer's load send nothing
        const before = (await layerOf(page)).length;
        await page.locator(".motorway__fuel").scrollIntoViewIfNeeded();
        await page.waitForSelector(".motorway__fuelout .motorway-fuel");
        expect((await layerOf(page)).length).toBe(before);
        // G5: no location_source on a measured motorway page
        expect(events.map((e) => e.second)).not.toContain("location_source");
      } finally {
        await ctx.close();
      }
    });
  }

  it("G2: decline is remembered — nothing to Google, also after a reload", async () => {
    const { ctx, seen } = await cleanProfile();
    try {
      const page = await ctx.newPage();
      await page.goto(`${TAGGED}${motorwayPath("ro", "A7")}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".consent[role=dialog]", { state: "visible" });
      await page.click(".consent__actions .btn:first-child"); // decline
      await page.reload({ waitUntil: "networkidle" });
      expect(await page.$(".consent[role=dialog]")).toBeNull();
      expect(seen.google).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});
