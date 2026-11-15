/**
 * The motorway pages of #715 (2.1.13) against the BUILT shell and the REAL
 * digest (`real-digest.ts`): every language answers 200 with the information
 * first and the "ask your assistant" block after it; the language switcher
 * lands on the SAME motorway in every language; no motorway address is a 404;
 * the per-language sitemaps list them; the Autobahn card on a place page links
 * to them and nothing is shown twice.
 */
import { withPickMarker } from "../src/i18n/lang-redirect.js";
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nowTitle, type NowKind } from "@viafrei/design";
import { all, text as nodeText } from "@viafrei/design/testing";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor, type Lang } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { ALL_SITEMAPS } from "../src/site/sitemaps.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8812;
const BASE = `http://127.0.0.1:${PORT}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const get = async (path: string): Promise<{ status: number; location: string | null; body: string; headers: Headers }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), body: await r.text(), headers: r.headers };
};

describe("a motorway page (#715)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${motorwayPath(lang, "A7")}: 200, its own title, the information first and the ask block after it`, async () => {
      const r = await get(motorwayPath(lang, "A7"));
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
      // #1028: the h1 is the search phrasing of the page's own title, without the brand
      const title = (/<title>([^<]*)<\/title>/.exec(r.body)?.[1] ?? "").replace(/&amp;/g, "&");
      const h1 = all(r.body, "h1").map(nodeText);
      expect(h1.length).toBe(1);
      expect(h1[0]).toContain("A7");
      // the <title> is the same words fitted (#1020 drops the brand first, then trailing items): a prefix of the h1
      // … unless something is reported: then #1173's now-title, `A7: Sperrung heute – ViaFrei` (the h1 keeps the search phrase)
      const decoded = title.replace(/&#39;/g, "'");
      const kinds: readonly NowKind[] = ["closure", "jam", "disruption", "roadworks"];
      const now = kinds.some((k) => nowTitle(lang, "A7", k) === decoded);
      expect(now || h1[0]!.startsWith(title.replace(/\s[—–]\sViaFrei$/u, "").replace(/…$/u, "")), `${h1[0]!} | ${title}`).toBe(true);
      const info = r.body.indexOf('class="motorway__counts"');
      const route = r.body.indexOf('class="motorway__junctions');
      const ask = r.body.indexOf('class="motorway__ask"');
      expect(info).toBeGreaterThan(0);
      expect(route).toBeGreaterThan(info);
      expect(ask).toBeGreaterThan(route);
      expect(r.body.slice(ask)).toContain(`href="${pathFor("connect", lang)}"`);
      // 2.3.22 (#1003): the address is the endpoint chip, its host and path in spans of their own, so it is read as
      // the chip's text, not as one run of characters in the markup.
      expect(all(r.body.slice(ask), ".endpoint-chip__url").map(nodeText)).toContain(MCP_ENDPOINT);
      expect(all(r.body.slice(ask), ".motorway__examples").length).toBeGreaterThan(0);
      // the canonical, the seven alternates and x-default point at the same motorway
      expect(all(r.body, `link[rel="canonical"][href="https://viafrei.de${motorwayPath(lang, "A7")}"]`).length).toBeGreaterThan(0);
      for (const l of LIVE_LANGS) expect(r.body).toContain(`hreflang="${l}" href="https://viafrei.de${motorwayPath(l, "A7")}"`);
      const ld = /<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/.exec(r.body)?.[1];
      const types = (JSON.parse(ld!) as { "@graph": { "@type": string }[] })["@graph"].map((n) => n["@type"]);
      // #1077: the road itself is a Thing (schema.org has no road type)
      expect(types).toEqual(["Organization", "WebSite", "WebPage", "BreadcrumbList", "Thing"]);
    });
  }

  it("the language switcher lands on the same motorway in every language, each answering 200", async () => {
    const targets: [string, (l: Lang) => string][] = [
      [motorwayPath("de", "A7"), (l) => motorwayPath(l, "A7")],
      [pathFor("motorways", "ru"), (l) => pathFor("motorways", l)],
    ];
    for (const [path, want] of targets) {
      const page = await browser.newPage();
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: "load" });
        const hrefs = await page.locator("header a[hreflang]").evaluateAll((as) => as.map((a) => [a.getAttribute("hreflang") ?? "", a.getAttribute("href") ?? ""] as const));
        // 2.4.4: each menu link carries the choice marker, which the shell strips with a 302 to the clean address
        expect(new Map(hrefs)).toEqual(new Map(LIVE_LANGS.map((l) => [l, withPickMarker(want(l))])));
        for (const [l, href] of hrefs) {
          const res = await page.goto(`${BASE}${href}`, { waitUntil: "load" });
          expect(res?.status(), `${l} ${href}`).toBe(200);
          expect(new URL(page.url()).pathname).toBe(want(l as Lang));
        }
      } finally {
        await page.close();
      }
    }
  });

  it("no motorway address is a 404: spellings and the other word are 301s to the page, the rest 301s to the index", async () => {
    const cases: [string, string][] = [
      ["/de/autobahn/A7", "/de/autobahn/a7"],
      ["/de/autobahn/a07", "/de/autobahn/a7"],
      ["/de/autobahn/bab7", "/de/autobahn/a7"],
      ["/de/autobahn/A%207", "/de/autobahn/a7"],
      // #892: `autobahn` in every language; the old `motorway` word is a temporary one-hop 301 (#898)
      ["/de/motorway/a7", "/de/autobahn/a7"],
      ["/en/motorway/a3", "/en/autobahn/a3"],
      ["/en/autobahn/a999", "/en/autobahn"],
      ["/en/motorway/koeln", "/en/autobahn"],
      ["/tr/motorway/b27", "/tr/autobahn"],
      ["/en/motorway", "/en/autobahn"],
      ["/de/motorway", "/de/autobahn"],
    ];
    for (const [from, to] of cases) {
      const r = await get(from);
      expect([r.status, r.location], from).toEqual([301, to]);
      expect((await get(to)).status, to).toBe(200);
    }
  });

  it("the index lists every register motorway in natural order, each linked, with its counts", async () => {
    // #1182: the bare address is most-affected first; `sort=number` is the natural order this row names
    const linksOf = (body: string): (string | undefined)[] => {
      const list = /<ul class="motorway-index">([\s\S]*?)<\/ul>/.exec(body)?.[1] ?? "";
      // a row's own road is its first link; the links after it are the motorways it connects to (#998, #1049)
      return list.split("<li").slice(1).map((li) => /href="(\/de\/autobahn\/a\d+)"/.exec(li)?.[1]);
    };
    const natural = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A34", "A57", "A61"].map((x) => `/de/autobahn/${x.toLowerCase()}`);
    const r = await get(`${pathFor("motorways", "de")}?sort=number`);
    expect(r.status).toBe(200);
    // the A10 of #1051 (D3) in its natural place
    expect(linksOf(r.body)).toEqual(natural);
    expect(all(/<ul class="motorway-index">([\s\S]*?)<\/ul>/.exec(r.body)?.[1] ?? "", ".motorway-index__n").length).toBeGreaterThan(0);
    // the bare index lists the same motorways, each once, in another order (the fixture's A1 is not the most affected)
    const bare = linksOf((await get(pathFor("motorways", "de"))).body);
    expect([...bare].sort()).toEqual([...natural].sort());
    expect(bare).not.toEqual(natural);
  });
});

describe("sitemaps and robots (#715)", () => {
  it("every sitemap answers, the motorway files list the register per language, and robots.txt names each", async () => {
    const robots = (await get("/robots.txt")).body;
    for (const s of ALL_SITEMAPS) {
      const r = await get(s);
      expect(r.status, s).toBe(200);
      expect(r.headers.get("content-type"), s).toContain("application/xml");
      expect(robots, s).toContain(`Sitemap: https://viafrei.de${s}\n`);
    }
    for (const l of LIVE_LANGS) {
      const xml = (await get(`/sitemap-motorways-${l}.xml`)).body;
      // the fixture's register: twelve roads, and the A10 of #1051 (D3)
      expect(xml.match(/<url>/g)?.length, l).toBe(13);
      expect(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length, l).toBe(13);
      expect((await get(`/sitemap-places-${l}.xml`)).body.match(/<url>/g)?.length, l).toBe(2);
    }
    expect((await get("/sitemap-motorways-xx.xml")).status).toBe(404);
  });
});

describe("the Autobahn card on a place page (#715)", () => {
  it("links each near motorway to its page, says 'all reports' in its footer, and the road card no longer repeats its rows", async () => {
    const r = await get(placePath("de", "koeln"));
    expect(r.status).toBe(200);
    const card = /<article class="pcard[^"]*" id="pcard-motorways"[\s\S]*?<\/article>/.exec(r.body)?.[0] ?? "";
    expect(card).toContain('href="/de/autobahn/a3"');
    // #1000: one row per near motorway, nearest first, each with its own shield; the footer names the FIRST row's road
    const rows = all(card, "a.shield").map((a) => a.attrs["href"]);
    expect(rows.slice(0, 2)).toEqual(["/de/autobahn/a1", "/de/autobahn/a3"]);
    expect(card).toContain("Alle Meldungen zur A1");
    expect(card).toContain("Köln-Dellbrück");
    const roads = /<article class="pcard[^"]*" id="pcard-roads"[\s\S]*?<\/article>/.exec(r.body)?.[0] ?? "";
    expect(roads).not.toContain("Köln-Dellbrück");
    // the cards follow each other: roads, then motorways
    expect(r.body.indexOf('id="pcard-motorways"')).toBeGreaterThan(r.body.indexOf('id="pcard-roads"'));
    // the link strip of the live pages
    expect(r.body).toContain(`href="${pathFor("motorways", "de")}"`);
  });
});
