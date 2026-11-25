/**
 * #1076: the fuel station and charging site pages in the shell — the address rule, the resolver (page / 301 / 404 /
 * 503), the head read off the fragment, the person-gated prices (a crawler never asks a refresh), no energy sitemap
 * (#49 A: the charging part files retired; no fuel sitemap, #1167 S1) and the robots rule (the fuel
 * pages off the corpus crawlers, the charging pages not). Every digest answer is a stub: no network, no live provider.
 */
import { describe, expect, it } from "vitest";
import { canonicalPageSlugs, fuelPageKeyedSlug, chargingPageKeyedSlug, energyPagePath, pageKeyOf, ROUTE_WORDS as INGEST_WORDS } from "@viafrei/ingest";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENERGY_KEY_LEN, energyPath, isEnergySlug } from "../src/site/energy.js";
import { ENERGY_PAGE_SHAPE, energyHeadOf, resolveEnergyPage } from "../src/lib/energy-page.js";
import { FUEL_STATION_PATH, FUEL_STATION_ROOT, fuelStationRoute, fuelStationScript, stationPersonAsks } from "../src/lib/fuel-station.js";
import { ALL_SITEMAPS, indexFiles } from "../src/site/sitemaps.js";
import { CORPUS_CRAWLERS, CORPUS_DISALLOW, FRAGMENT_DISALLOW, robotsTxt } from "../src/site/discovery.js";
import { energyJsonLd } from "../src/site/structured-data.js";
import { LIVE_LANGS } from "../src/site/pages.js";

import type { FetchLike } from "../src/lib/tiles.js";
import type { PostLike } from "../src/lib/fuel-refresh.js";

const SLUG = "aral-nuernberg-fuerther-str-abcdefghij";
const BASE = "http://digest.test";

type Answer = { status?: number; type?: string; body?: string; headers?: Record<string, string> };
function digest(route: (url: string) => Answer): FetchLike & { asked: string[] } {
  const asked: string[] = [];
  const f = Object.assign((url: string) => {
    asked.push(url);
    const a = route(url);
    return Promise.resolve(new Response(a.body ?? "", { status: a.status ?? 200, headers: { "content-type": a.type ?? "text/html; charset=utf-8", ...(a.headers ?? {}) } }));
  }, { asked });
  return f;
}

const PAGE = `<section class="energypage energypage--fuel" id="energypage" data-kind="fuel" data-slug="${SLUG}" data-title="Aral in Nürnberg – ViaFrei" data-description="Aral, Fürther Str. 12, 90429 Nürnberg" data-name="Aral" data-robots="index, follow, noarchive" data-lastmod="2026-11-02" data-street="Fürther Str. 12" data-postcode="90429" data-city="Nürnberg"><p>x</p><div class="energypage__prices" data-station="${SLUG}"></div></section>`;

describe("#1076 the address rule", () => {
  it("#1200: a slug is the slug shape with no internal id — the bare description, a short key or a pre-#1200 ten-letter key; the path is the English route word in every language", () => {
    expect(isEnergySlug(SLUG)).toBe(true);
    expect(isEnergySlug("abcdefghij")).toBe(true);
    for (const good of ["ladenetz-alsdorf-hubertusstrasse-17", "aral-nuernberg", "ladenetz-alsdorf-hubertusstrasse-17-abcd"]) expect(isEnergySlug(good), good).toBe(true);
    for (const bad of ["aral-ABCDEFGHIJ", "aral-abcdefghij-", "a".repeat(71) + "-abcdefghij", "aral-52062-aachen", "", "aral--x"]) expect(isEnergySlug(bad), bad).toBe(false);
    expect(energyPath("fuel", "en", SLUG)).toBe(`/en/fuel/${SLUG}`);
    expect(energyPath("charging", "de", SLUG)).toBe(`/de/charging/${SLUG}`);
  });
  it("is the ingest's rule: the same paths, and every slug the ingest builds is one the shell accepts", () => {
    expect(INGEST_WORDS.fuel).toBe("fuel");
    expect(INGEST_WORDS.charging).toBe("charging");
    for (const l of LIVE_LANGS) expect(energyPath("fuel", l, SLUG)).toBe(energyPagePath("fuel", l, SLUG));
    const long = "Sehr Lange Straße Mit Vielen Wörtern Und Noch Mehr Wörtern Bis Zum Ende";
    const slugs = [
      fuelPageKeyedSlug({ id: "51d4b4f3-a095-1aa0-e100-80009459e03a", brand: "ARAL", name: "Aral Tankstelle", city: "Nürnberg", street: "Fürther Str." }),
      fuelPageKeyedSlug({ id: "x", brand: null, name: null, city: null, street: null }),
      chargingPageKeyedSlug({ sourceFeed: "afir_x", siteId: "S1", operator: "EnBW", name: long, city: "Garmisch-Partenkirchen", street: long }),
    ];
    for (const s of slugs) {
      expect(isEnergySlug(s), s).toBe(true);
      expect(s.slice(-ENERGY_KEY_LEN)).toMatch(/^[a-z]{10}$/);
    }
    expect(slugs[1]!.endsWith(pageKeyOf("fuel:x"))).toBe(true);
  });
  it("#1200: every canonical slug the ingest assigns — bare or with a short key — is one the shell accepts", () => {
    const rows = [
      { identity: "charging:afir_eclearing_stat:A", description: "ladenetz-alsdorf-hubertusstrasse-17" },
      { identity: "charging:afir_eclearing_stat:B", description: "ladenetz-alsdorf-hubertusstrasse-17" },
      { identity: "fuel:x", description: "aral-nuernberg-fuerther-str" },
      { identity: "fuel:y", description: "" },
    ];
    const slugs = [...canonicalPageSlugs(rows).values()];
    expect(slugs).toHaveLength(4);
    expect(slugs).toContain("aral-nuernberg-fuerther-str");
    for (const s of slugs) expect(isEnergySlug(s), s).toBe(true);
  });
});

describe("#1076 the page: resolved before anything renders", () => {
  const o = (f: FetchLike) => ({ baseUrl: BASE, timeoutMs: 500, fetchImpl: f });
  it("the digest's page is the page, with its head read and stripped", async () => {
    const f = digest(() => ({ body: PAGE }));
    const a = await resolveEnergyPage("fuel", "en", SLUG, o(f));
    // #1188: beside the page, its around block (`around-block-1188.test.ts`)
    expect(f.asked.filter((u) => !u.includes("/area?"))).toEqual([`${BASE}/internal/fuel/${SLUG}?lang=en`]);
    expect(a.kind).toBe("page");
    if (a.kind !== "page") return;
    expect(a.path).toBe(`/en/fuel/${SLUG}`);
    expect(a.head).toMatchObject({ title: "Aral in Nürnberg – ViaFrei", name: "Aral", lastmod: "2026-11-02", street: "Fürther Str. 12", postcode: "90429", city: "Nürnberg" });
    expect(a.head.html).toMatch(ENERGY_PAGE_SHAPE);
    expect(a.head.html).not.toMatch(/data-(?:title|description|name|robots|lastmod|street|postcode|city|kind|slug)=/);
    expect(a.head.html).toContain(`data-station="${SLUG}"`);
  });
  it("a moved key is a 301 to the current slug; 404 is missing; anything else is unavailable, never a redirect", async () => {
    const cur = "aral-nuernberg-neue-str-abcdefghij";
    const moved = await resolveEnergyPage("fuel", "de", SLUG, o(digest(() => ({ body: `<section class="energypage energypage--fuel" id="energypage" data-moved="${cur}"></section>` }))));
    expect(moved).toEqual({ kind: "redirect", to: `/de/fuel/${cur}` });
    // a move to itself, or to something that is no slug, is no answer
    expect((await resolveEnergyPage("fuel", "de", SLUG, o(digest(() => ({ body: `<section class="energypage energypage--fuel" id="energypage" data-moved="${SLUG}"></section>` }))))).kind).toBe("unavailable");
    expect((await resolveEnergyPage("fuel", "de", SLUG, o(digest(() => ({ status: 404 }))))).kind).toBe("missing");
    for (const a of [{ status: 500 }, { type: "text/plain", body: PAGE }, { body: PAGE.replace("<p>x</p>", "<script>x</script>") }, { body: PAGE.replace("energypage--fuel", "energypage--charging") }, { body: "<p>hi</p>" }])
      expect((await resolveEnergyPage("fuel", "de", SLUG, o(digest(() => a)))).kind, JSON.stringify(a).slice(0, 60)).toBe("unavailable");
    const slow: FetchLike = (_u, init) => new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    expect((await resolveEnergyPage("fuel", "de", SLUG, { baseUrl: BASE, timeoutMs: 50, fetchImpl: slow })).kind).toBe("unavailable");
  });
  it("a slug that cannot be one asks nothing and is the 404 page", async () => {
    const f = digest(() => ({ body: PAGE }));
    for (const bad of ["../x-abcdefghij", "Aral-abcdefghij", "aral-52062-aachen"]) expect((await resolveEnergyPage("charging", "de", bad, o(f))).kind).toBe("missing");
    expect(f.asked).toEqual([]);
  });
  it("#1200: a bare canonical slug is asked of the digest and is the page; the old keyed address is a 301 to it", async () => {
    const bare = "ladenetz-alsdorf-hubertusstrasse-17";
    const old = `${bare}-gzgieqgteo`;
    const page = PAGE.replace("energypage--fuel", "energypage--charging").replace('data-kind="fuel"', 'data-kind="charging"').replaceAll(SLUG, bare);
    const f = digest((u) => (u.includes(`/${old}?`) ? { body: `<section class="energypage energypage--charging" id="energypage" data-moved="${bare}"></section>` } : { body: page }));
    const a = await resolveEnergyPage("charging", "de", bare, o(f));
    expect(a.kind).toBe("page");
    expect(a.kind === "page" && a.path).toBe(`/de/charging/${bare}`);
    expect(await resolveEnergyPage("charging", "de", old, o(f))).toEqual({ kind: "redirect", to: `/de/charging/${bare}` });
    // a rename: the previous canonical slug (bare, no key) is a 301 to the current one
    const renamed = digest(() => ({ body: `<section class="energypage energypage--charging" id="energypage" data-moved="${bare}-abcd"></section>` }));
    expect(await resolveEnergyPage("charging", "de", bare, o(renamed))).toEqual({ kind: "redirect", to: `/de/charging/${bare}-abcd` });
    expect(f.asked.filter((u) => !u.includes("/area?")).map((u) => u.replace(BASE, ""))).toEqual([`/internal/charging/${bare}?lang=de`, `/internal/charging/${old}?lang=de`]);
  });
  it("a fragment about another station gives no head (the layout's own words)", () => {
    const h = energyHeadOf(PAGE, "fuel", "other-abcdefghij");
    expect(h.title).toBeNull();
    expect(h.name).toBeNull();
    expect(h.html).not.toContain("data-title=");
  });
  // #1167 S2: a fuel station's page carries no JSON-LD at all (the rendered page: test/energy-page-render-1167.test.ts);
  // the graph is a charging site's alone
  it("a charging site's graph is a Place with its name and address — no live figure, no point", () => {
    const ev = (JSON.parse(energyJsonLd("charging", "en", "EnBW", "t", "d", `/en/charging/${SLUG}`, { street: "Hauptstraße 3", postcode: null, city: "Fulda" })) as { "@graph": Record<string, unknown>[] })["@graph"];
    expect(ev.find((n) => n["@type"] === "Place" && n["name"] === "EnBW")).toMatchObject({ address: { streetAddress: "Hauptstraße 3", addressLocality: "Fulda", addressCountry: "DE" } });
    expect(ev.some((n) => n["@type"] === "GasStation")).toBe(false);
    expect(JSON.stringify(ev.slice(2))).not.toMatch(/price|offer|"geo"|latitude|longitude|€|EUR/i);
  });
});

const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const req = (h: Record<string, string>, q = `station=${SLUG}&lang=de`, method = "GET") => new Request(`https://viafrei.de${FUEL_STATION_PATH}?${q}`, { method, headers: h });
const PRICES = `<div class="${FUEL_STATION_ROOT}"><p>Super E5 1,69<sup>9</sup></p></div>`;
const SENTENCE = `<div class="${FUEL_STATION_ROOT}"><p class="pcard__note">nur beim Ansehen</p></div>`;

function refresh(): PostLike & { asked: string[] } {
  const asked: string[] = [];
  const f = ((_u: string, init: { body: string }) => {
    asked.push(init.body);
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ state: "pending", queue: { position: 1, etaMs: 2000 } }) });
  }) as unknown as PostLike & { asked: string[] };
  f.asked = asked;
  return f;
}

describe("#1076 the prices of one station: a person's view only (PF2/PF3), and a crawler never asks a refresh", () => {
  const stale = (url: string): Answer => (url.includes("refused=1") ? { body: SENTENCE } : { body: PRICES, headers: url.includes("fuel=") ? {} : { "fuel-ask": "pt:49.4500,11.0600" } });
  it("a person's view with nothing current asks the site door about the station's point, then shows the answer to be re-read", async () => {
    const d = digest(stale);
    const r = refresh();
    const res = await fuelStationRoute(req(PERSON), { baseUrl: BASE, timeoutMs: 500, fetchImpl: d, refreshUrl: "http://mcp.test", refreshFetch: r });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.asked).toEqual([JSON.stringify({ at: "pt:49.4500,11.0600" })]);
    expect(d.asked).toEqual([`${BASE}/internal/fuel/${SLUG}/prices?lang=de`, `${BASE}/internal/fuel/${SLUG}/prices?lang=de&fuel=pending&fuelPos=1&fuelEta=2`]);
    expect(await res.text()).toMatch(/^<div class="fuel-station" data-vf-refill="\d+"/);
  });
  it("prices inside the window: shown, nothing asked", async () => {
    const r = refresh();
    const res = await fuelStationRoute(req(PERSON), { baseUrl: BASE, timeoutMs: 500, fetchImpl: digest(() => ({ body: PRICES })), refreshUrl: "http://mcp.test", refreshFetch: r });
    expect(await res.text()).toBe(PRICES);
    expect(r.asked).toEqual([]);
  });
  const crawlers: [string, Record<string, string>][] = [
    ["a crawler class from nginx (search)", { ...PERSON, "x-vf-agent-class": "search" }],
    ["a crawler class from nginx (seo)", { ...PERSON, "x-vf-agent-class": "seo" }],
    ["any class at all", { ...PERSON, "x-vf-agent-class": "unknown-bot" }],
    ["a crawler user agent", { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
    ["a navigation to the fragment", { ...PERSON, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }],
    ["a cross-site fetch", { ...PERSON, "sec-fetch-site": "cross-site" }],
    ["a prefetch", { ...PERSON, "sec-purpose": "prefetch" }],
  ];
  for (const [what, h] of crawlers)
    it(`${what}: the sentence alone, the digest asked with refused=1 only, and no refresh`, async () => {
      expect(stationPersonAsks(req(h))).toBe(false);
      const d = digest(stale);
      const r = refresh();
      const res = await fuelStationRoute(req(h), { baseUrl: BASE, timeoutMs: 500, fetchImpl: d, refreshUrl: "http://mcp.test", refreshFetch: r });
      expect(await res.text()).toBe(SENTENCE);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(d.asked).toEqual([`${BASE}/internal/fuel/${SLUG}/prices?lang=de&refused=1`]);
      expect(r.asked).toEqual([]);
    });
  it("a HEAD asks nothing either; a malformed query is a 404 that asks nothing; a foreign answer is a 502", async () => {
    const r = refresh();
    const d = digest(stale);
    await fuelStationRoute(req(PERSON, undefined, "HEAD"), { baseUrl: BASE, timeoutMs: 500, fetchImpl: d, refreshUrl: "http://mcp.test", refreshFetch: r });
    expect(r.asked).toEqual([]);
    const d2 = digest(stale);
    for (const q of ["station=Aral&lang=de", "station=aral-52062&lang=de", `station=${SLUG}&lang=xx`, `lang=de`]) expect((await fuelStationRoute(req(PERSON, q), { baseUrl: BASE, timeoutMs: 500, fetchImpl: d2 })).status).toBe(404);
    expect(d2.asked).toEqual([]);
    expect((await fuelStationRoute(req(PERSON), { baseUrl: BASE, timeoutMs: 500, fetchImpl: digest(() => ({ body: "<div class=\"place-fuel\">x</div>" })) })).status).toBe(502);
  });
  it("the script asks the fragment path for the slot's own station, only when shown, and is the page's one fetch", () => {
    const js = fuelStationScript();
    expect(js).toContain(JSON.stringify(FUEL_STATION_PATH));
    expect(js).toContain('getAttribute("data-station")');
    expect(js).toContain("IntersectionObserver");
    expect(js).toContain("document.prerendering!==true");
    expect(js.match(/fetch\(/g)).toHaveLength(1);
  });
  it("the fragment path is under the robots line every group carries", () => {
    expect(FUEL_STATION_PATH.startsWith(FRAGMENT_DISALLOW)).toBe(true);
  });
});

describe("#49 A: no energy sitemap — the charging part files are retired, the pages stay", () => {
  it("robots.txt and every index name no charging (and no fuel) sitemap; the charging sitemap routes are gone", () => {
    const named = [...ALL_SITEMAPS, ...indexFiles("2026-11-01", "2026-11-01", "2026-11-01", "2026-11-01").map((f) => f.path)];
    expect(named.filter((p) => /charging|fuel/.test(p))).toEqual([]);
    expect(robotsTxt()).not.toMatch(/^Sitemap: .*(charging|fuel)/mu);
    const routes = readdirSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "pages"));
    expect(routes.filter((f) => /^sitemap-(charging|fuel)/.test(f))).toEqual([]);
  });
  it("a charging site's page still has its address in every language", () => {
    for (const l of LIVE_LANGS) expect(energyPath("charging", l, SLUG)).toBe(`/${l}/charging/${SLUG}`);
  });
});

describe("#1076 robots: a fuel station's page is off the corpus crawlers, a charging site's is not", () => {
  it("the fuel rule's prefix covers every fuel station page and no charging page, in every language", () => {
    const txt = robotsTxt();
    for (const l of LIVE_LANGS) {
      expect(CORPUS_DISALLOW.some((d) => energyPath("fuel", l, SLUG).startsWith(d)), l).toBe(true);
      expect(CORPUS_DISALLOW.some((d) => energyPath("charging", l, SLUG).startsWith(d)), l).toBe(false);
    }
    for (const c of CORPUS_CRAWLERS) {
      const group = txt.split(`User-agent: ${c}\n`)[1]!.split("\n\n")[0]!.split("\n");
      for (const l of LIVE_LANGS) expect(group).toContain(`Disallow: /${l}/fuel`);
      expect(group.some((x) => x.includes("/charging"))).toBe(false);
    }
  });
});
