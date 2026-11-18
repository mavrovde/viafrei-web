/**
 * 2.4.1's search pages against the BUILT shell and the REAL digest (`real-digest.ts`) — #1025, #1026, #1028:
 *
 *   - an exit page's head in German and English: its own title, the exit rule's robots, its canonical and alternates,
 *     the breadcrumbs (visible and in the JSON-LD, the same steps), the junction as a Place with the LCL's credit;
 *   - a crawl from `/de` and `/en` to depth 3 that reaches the index, a motorway, its exit pages and a place page, and
 *     that NAMES a planted orphan (the judge can say no);
 *   - the exit sitemaps answering 503 while the digest's register has not completed a lap (never an empty urlset);
 *   - on a phone (375×812) the national summary and the map above the fold on the index and a motorway page;
 *   - in a browser, the way along the motorway: an exit page's "next" link lands on the next exit's own page.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { all } from "@viafrei/design/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TITLE_MAX, DESCRIPTION_MAX, motorwayMeta } from "../src/site/meta.js";
import { LCL_CREDIT } from "../src/site/lcl-credit.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { firstScreen } from "./first-screen.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8862;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = "https://viafrei.de";
let shell: ChildProcess;
let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Seo Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "seo@example.invalid" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const get = async (path: string): Promise<{ status: number; body: string; location: string | null; headers: Headers }> => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text(), location: r.headers.get("location"), headers: r.headers };
};
const decode = (s: string): string => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const one = (body: string, re: RegExp): string | null => {
  const m = re.exec(body);
  return m === null ? null : decode(m[1] ?? "");
};
/** Every same-site page a body links to, resolved against the page's own address (the strip's links are relative). */
function linksOf(path: string, body: string): string[] {
  const out = new Set<string>();
  // a link is markup, never the text of an inline script: #1186's recent-kinds script carries an `<a class="place-opt"
  // href="\/[a-z]{2}\/station\/…"` regex literal, which an HTML parser never reads as a link and this scan did
  const markup = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const m of markup.matchAll(/<a\b[^>]*\shref="([^"#]*)(?:#[^"]*)?"/g)) {
    const raw = decode(m[1] ?? "");
    if (raw === "") continue;
    const u = new URL(raw, `${BASE}${path}`);
    if (u.origin !== BASE || u.search !== "" || /^\/(fragment|_a|internal)\/|\.(xml|txt|svg|png|json)$/.test(u.pathname)) continue;
    out.add(u.pathname);
  }
  return [...out];
}
/** THE CRAWL'S JUDGE: the pages of `required` the crawl did not reach — a planted orphan must be named here. */
const unreached = (required: readonly string[], reached: ReadonlySet<string>): string[] => required.filter((p) => !reached.has(p));

/** The first indexable exit of the A7 (a junction its live lists name): read off the motorway page's questions. */
async function liveExit(lang: "de" | "en"): Promise<string> {
  const a7 = await get(`/${lang}/autobahn/a7`);
  const faq = /<section class="motorway-faq"[\s\S]*?<\/section>/.exec(a7.body)?.[0] ?? "";
  const href = /<a href="(a7\/exit-[a-z0-9-]+)"/.exec(faq)?.[1];
  expect(href, "the A7's questions name a junction").toBeDefined();
  return new URL(href!, `${BASE}/${lang}/autobahn/a7`).pathname;
}


/** A page's robots directive, or null when it carries none. */
const robotsOf = (body: string): string | null => /<meta name="robots" content="([^"]+)"/.exec(body)?.[1] ?? null;
/**
 * The robots an exit page must carry: the exit rule's verdict (#1025: indexed = no directive, else `noindex, follow`)
 * with `noarchive` added when its around block carries the fuel card (#1188, as on a station page) — never otherwise.
 */
const exitRobots = (indexed: boolean, body: string): string | null => {
  const fuel = body.includes('id="pcard-fuel"');
  return indexed ? (fuel ? "noarchive" : null) : fuel ? "noindex, follow, noarchive" : "noindex, follow";
};
describe("an exit page's head (#1025), German and English", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: its own title and description, index by the rule, canonical and alternates, crumbs and graph`, async () => {
      const path = await liveExit(lang);
      const r = await get(path);
      expect(r.status).toBe(200);
      const title = one(r.body, /<title>([^<]*)<\/title>/)!;
      const description = one(r.body, /<meta name="description" content="([^"]*)"/)!;
      expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
      expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(title).toMatch(/^A7 /);
      // #1310 B2: the evergreen description leads with the junction, its road and Land, and carries nothing of the read
      expect(description).toMatch(/^[^:(]+ \(A7, /);
      expect(description).not.toMatch(/Stand|\d{1,2}:\d{2}/);
      // the exit rule indexes it (a live item there): no index directive; `noarchive` exactly when its around block
      // carries the fuel card (#1188, the MTS-K terms), and nothing else
      expect(robotsOf(r.body)).toEqual(exitRobots(true, r.body));
      expect(one(r.body, /<link rel="canonical" href="([^"]+)"/)).toBe(`${ORIGIN}${path}`);
      const tail = path.slice(`/${lang}/autobahn/a7`.length);
      for (const l of LIVE_LANGS) expect(all(r.body, `link[rel="alternate"][hreflang="${l}"]`).map((e) => e.attrs.href), l).toEqual([`${ORIGIN}/${l}/autobahn/a7${tail}`]);
      expect(all(r.body, 'link[rel="alternate"][hreflang="x-default"]').map((e) => e.attrs.href)).toEqual([`${ORIGIN}/de/autobahn/a7${tail}`]);
      // the head attributes are read and stripped
      expect(r.body).not.toMatch(/data-(title|description|robots|exit|exit-lat|exit-lon)=/);
      // #1173: the h1 is the object's name, which the title names too; the status block says what is reported there now
      const h1 = one(r.body, /<h1>([^<]*)<\/h1>/)!;
      expect(title.includes(h1), `${h1} | ${title}`).toBe(true);
      expect(r.body).toMatch(/<h1>[^<]+<\/h1>\s*<div class="pagefirst" id="page-first">[\s\S]*?<\/div>\s*<p class="lead motorway__intro">/);
      // the trail and the graph name the same four steps
      const crumbs = [...(/<nav class="wrap crumbs"[\s\S]*?<\/nav>/.exec(r.body)?.[0] ?? "").matchAll(/<(?:a href="([^"]+)"[^>]*|span aria-current="page"[^>]*)>([^<]*)</g)].map((m) => [m[1] ?? path, decode(m[2] ?? "")]);
      expect(crumbs.length).toBe(4);
      const ld = JSON.parse(one(r.body, /<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/)!.replace(/\\u003c/g, "<")) as { "@graph": Record<string, unknown>[] };
      const list = (ld["@graph"].find((n) => n["@type"] === "BreadcrumbList")!["itemListElement"] as { name: string; item: string }[]).map((x) => [x.item.slice(ORIGIN.length), x.name]);
      expect(list).toEqual(crumbs);
      const page = ld["@graph"].find((n) => n["@type"] === "WebPage")!;
      // 2.4.1 review S3: the graph names the page by its title, and describes it by the motorway's own deck line — the
      // live meta description (an Autobahn GmbH figure) never travels in the graph
      expect([page["name"], page["description"]]).toEqual([title, motorwayMeta("A7", lang).description]);
      expect(String(page["description"]).split("A7").join("")).not.toMatch(/\d/u);
      expect((page["isBasedOn"] as { creditText: string }).creditText).toContain("BASt");
      expect(page["isBasedOn"]).toMatchObject({ url: LCL_CREDIT.url, creator: { "@type": "Organization", name: LCL_CREDIT.creator.name } });
      const place = ld["@graph"].find((n) => n["@type"] === "Place")!;
      expect(place["name"]).toBe(crumbs[3]![1]);
      expect(place["geo"]).toMatchObject({ "@type": "GeoCoordinates" });
      // the way along the motorway: every link of the exit navigation answers 200
      const nav = /<nav class="motorway__exitnav"[\s\S]*?<\/nav>/.exec(r.body)?.[0] ?? "";
      const targets = linksOf(path, nav);
      expect(targets.length).toBeGreaterThanOrEqual(2);
      for (const t of targets) expect((await get(t)).status, t).toBe(200);
    });
  }
  it("an exit with nothing reported and no open facility is noindex, follow — still a page, still linked", async () => {
    const a61 = await get("/de/autobahn/a61");
    const exits = linksOf("/de/autobahn/a61", /<ol class="motorway__junctions motorway__strip">[\s\S]*?<\/ol>/.exec(a61.body)?.[0] ?? "").filter((p) => /\/exit-/.test(p));
    expect(exits.length).toBeGreaterThan(5);
    const bodies = await Promise.all(exits.slice(0, 12).map(async (p) => (await get(p)).body));
    // the exit rule's verdict, with `noarchive` added exactly where the fuel card stands (#1188): at least one exit is
    // noindex, and every exit carries one of the two verdicts and nothing else
    expect(bodies.some((b) => robotsOf(b) === exitRobots(false, b))).toBe(true);
    expect(bodies.every((b) => [exitRobots(true, b), exitRobots(false, b)].includes(robotsOf(b)))).toBe(true);
  });
  it("a query on an exit page is a variant (noindex) with the bare exit page as its canonical; a trailing slash is a 301", async () => {
    const path = await liveExit("de");
    const v = await get(`${path}?layers=events`);
    expect(v.status).toBe(200);
    expect(one(v.body, /<meta name="robots" content="([^"]+)"/)).toBe("noindex, follow");
    expect(one(v.body, /<link rel="canonical" href="([^"]+)"/)).toBe(`${ORIGIN}${path}`);
    for (const p of ["/de/autobahn/a7/", `${path}/`]) {
      const r = await get(p);
      expect([r.status, r.location], p).toEqual([301, p.replace(/\/$/, "")]);
    }
  });
});

describe("the exit sitemaps (#1025)", () => {
  it("list exactly the exits the rule indexes: the live exit is there, every listed page answers 200 with no noindex", async () => {
    for (const l of ["de", "en"] as const) {
      const r = await get(`/sitemap-exits-${l}.xml`);
      expect(r.status, l).toBe(200);
      const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.slice(ORIGIN.length));
      expect(locs, l).toContain(await liveExit(l));
      for (const p of locs.slice(0, 15)) {
        const page = await get(p);
        expect(page.status, p).toBe(200);
        expect(robotsOf(page.body), p).toEqual(exitRobots(true, page.body));
      }
    }
    expect((await get("/sitemap-exits-xx.xml")).status).toBe(404);
  });
  it("answer 503 with a Retry-After while the digest's register has not completed a lap — never an empty urlset", async () => {
    const early = await startRealDigest({ exits: "none" });
    const s = await startShell(PORT + 1, { DIGEST_URL: early.url, IMPRESSUM_NAME: "Seo Probe", IMPRESSUM_STREET: "Probeweg 7", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "seo@example.invalid" });
    try {
      for (const l of ["de", "en"]) {
        const r = await fetch(`http://127.0.0.1:${String(PORT + 1)}/sitemap-exits-${l}.xml`);
        expect([r.status, r.headers.get("retry-after"), await r.text()], l).toEqual([503, "180", ""]);
      }
      // the index still names the exit files, with the template's day
      expect(await (await fetch(`http://127.0.0.1:${String(PORT + 1)}/sitemap-index.xml`)).text()).toContain(`<loc>${ORIGIN}/sitemap-exits-de.xml</loc>`);
    } finally {
      s.kill();
      await early.close();
    }
  });
  it("the index and robots.txt name every exit file", async () => {
    const idx = await get("/sitemap-index.xml");
    const robots = await get("/robots.txt");
    expect(idx.status).toBe(200);
    for (const l of LIVE_LANGS) {
      expect(idx.body, l).toContain(`<loc>${ORIGIN}/sitemap-exits-${l}.xml</loc>`);
      expect(robots.body, l).toContain(`Sitemap: ${ORIGIN}/sitemap-exits-${l}.xml\n`);
    }
  });
});

describe("the crawl (#1026 § 5): from /de and /en, depth ≤ 3, no orphan", () => {
  async function crawl(start: string, depth: number): Promise<{ reached: Set<string>; broken: string[] }> {
    const reached = new Set<string>([start]);
    const broken: string[] = [];
    let frontier = [start];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (let i = 0; i < frontier.length; i += 8) {
        const batch = await Promise.all(frontier.slice(i, i + 8).map(async (p) => ({ p, r: await get(p) })));
        for (const { p, r } of batch) {
          if (r.status !== 200 && r.status !== 301) broken.push(`${p} ${String(r.status)}`);
          if (r.status !== 200 || !(r.headers.get("content-type") ?? "").startsWith("text/html")) continue;
          for (const l of linksOf(p, r.body))
            if (!reached.has(l)) {
              reached.add(l);
              next.push(l);
            }
        }
      }
      frontier = next;
    }
    return { reached, broken };
  }
  for (const lang of ["de", "en"] as const) {
    it(`/${lang}: the index, a motorway, its live exit, a quiet motorway's exit and a place page within three links; nothing links a page that does not answer`, async () => {
      const exit = await liveExit(lang);
      const { reached, broken } = await crawl(`/${lang}`, 3);
      const required = [`/${lang}/autobahn`, `/${lang}/autobahn/a7`, exit, `/${lang}/autobahn/a61`, `/${lang}/place/hamburg`];
      expect(unreached(required, reached)).toEqual([]);
      // every exit the A61's strip names was reached: the strip links each junction, so none is an orphan
      const a61 = await get(`/${lang}/autobahn/a61`);
      const strip = linksOf(`/${lang}/autobahn/a61`, /<ol class="motorway__junctions motorway__strip">[\s\S]*?<\/ol>/.exec(a61.body)?.[0] ?? "").filter((p) => /\/exit-/.test(p));
      expect(strip.length).toBeGreaterThan(5);
      expect(unreached(strip, reached)).toEqual([]);
      // a planted orphan: a real exit address nothing links (a junction number no motorway of the fixture has) is NAMED
      const orphan = `/${lang}/autobahn/a7/exit-999-nirgendwo`;
      expect(unreached([...required, orphan], reached)).toEqual([orphan]);
      expect(broken).toEqual([]);
    }, 240_000);
  }
});

describe("above the fold on a phone (#1028 § 3): 375×812", () => {
  // #1190: German and English (the route sentence opens with ". Die " / ". The "); since 2.5.15 a road page folds its
  // place bar on a phone (#1173), which is what keeps both on the first screen under the #1158 header
  for (const path of ["/de/autobahn", "/de/autobahn/a7", "/en/autobahn", "/en/autobahn/a7"]) {
    it(`${path}: the map (its thumbnail, drawing the map by reference) and the live summary are on the first screen`, async () => {
      const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
      await page.goto(`${BASE}${path}`);
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const thumb = await box(".motorway__thumb svg");
      expect(thumb.width).toBeGreaterThan(40);
      expect(thumb.height).toBeGreaterThan(40);
      // #1153 (lead decision 2026-11-03): the header now carries the place row, so the purpose is that the map is SEEN
      // on the first screen, not that it ends there — its top on the first screen and at least 240 px of it visible.
      // The thumbnail is 144 px tall at 375 px (measured 2026-11-03), shorter than the 240 px of that decision, so the
      // rule is applied to what exists: 240 px of a taller map, three quarters of a shorter one.
      expect(thumb.y, "the map's thumbnail starts on the first screen").toBeLessThan(812);
      expect(Math.min(thumb.y + thumb.height, 812) - thumb.y, "enough of the map is on the first screen").toBeGreaterThanOrEqual(Math.min(240, 0.75 * thumb.height));
      // the thumbnail draws the map's own group: the reference resolves in the page
      const ref = await page.locator(".motorway__thumb use").first().getAttribute("href");
      expect(await page.locator(ref!).count()).toBe(1);
      // #1190 AC 3: at least 108 px of the map and the whole live summary, on the index as on the road
      // (`first-screen.ts` says what the summary is on each)
      const seen = await firstScreen(page, path);
      expect(seen.mapShown, "#1190: the map's 108 px").toBeGreaterThanOrEqual(108);
      expect(seen.summaryEnd, "the live summary ends above the fold").toBeLessThanOrEqual(812);
      // the thumbnail is the way to the map
      await page.locator(".motorway__thumb").first().click();
      expect(new URL(page.url()).hash).toMatch(/^#mw-(map|ov)-h$/);
      await page.context().close();
    });
  }
});

describe("the way along the motorway, in a browser (#1026)", () => {
  it("an exit page's 'next' lands on the next exit's own page; its crumb back lands on the motorway", async () => {
    const path = await liveExit("de");
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}${path}`);
    const h1 = await page.locator("h1").textContent();
    await page.locator(".motorway__exitnav li", { hasText: "Nächste" }).locator("a").click();
    await page.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toMatch(/^\/de\/autobahn\/a7\/exit-/);
    expect(new URL(page.url()).pathname).not.toBe(path);
    expect(await page.locator("h1").textContent()).not.toBe(h1);
    await page.locator(".crumbs a", { hasText: "A7" }).click();
    await page.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toBe("/de/autobahn/a7");
    // the strip's relative links resolve on the motorway page, and the first one is an exit page of the A7
    const first = await page.locator(".motorway__strip a[href^='a7/exit-']").first().getAttribute("href");
    await page.locator(".motorway__strip a[href^='a7/exit-']").first().click();
    await page.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toBe(`/de/autobahn/${first!}`);
    await page.context().close();
  });
});
