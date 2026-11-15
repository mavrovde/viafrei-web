/**
 * #1182, the data steward's ruling of 2026-11-08 (point 2): "stations near the visitor" on the station index, found by
 * the existing location ladder only. This file holds the ruling's tests (a), (b), (c), (e) and (f); (d) is
 * `privacy-location.test.ts`, and the island's click with a precise fix is driven in `location.test.ts`
 * ("#1182 (c)").
 *
 * Mutants (each alone, this file run, restored): the DNT check dropped from `location/server.ts` → (a) red; `vary`
 * removed from `STATION_NEAR_HEADERS` → (b) red.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { all, classesOf, text } from "@viafrei/design/testing";
import type { GeoIp } from "../src/location/geoip.js";
import { setLogSink } from "../src/lib/log.js";
import { geoipCreditHtml } from "../src/lib/geoip-credit.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { NEAR_JS } from "../src/lib/near-script.js";
import {
  STATION_NEAR_HEADERS,
  STATION_NEAR_OPEN,
  STATION_NEAR_ROUTE,
  STATION_NEAR_SLOT,
  nearKeyOf,
  stationNearIp,
  stationNearRoute,
  stationNearScript,
  stationNearSlotHtml,
  withStationNear,
} from "../src/lib/station-near.js";
import { t } from "../src/i18n/index.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** The visitor's address resolves to a point near Aachen (DB-IP's coarse 0.01° point). */
const LAT = 50.8752;
const LON = 6.1694;
const CELL = "pt:50.875,6.1725";
const geo = { release: "test", lookup: () => ({ country: "DE", lat: LAT, lon: LON }), close: () => undefined } as GeoIp;
const BLOCK =
  `${STATION_NEAR_OPEN}<h2 class="station-top__h" id="station-near-t">Bahnhöfe in Ihrer Nähe</h2>` +
  `<p class="stpage__lead">Die nächsten Bahnhöfe bei Aachen, in Luftlinie:</p><ul class="stpage__list"><li><a href="/de/station/aachen-hbf" translate="no">Aachen Hbf</a> <span class="pcard__sub">2,1 km</span></li></ul></section>`;
const INDEX = `<section class="stpage-index" id="station-index"><p class="lead">x</p><form class="stpage-search" method="get" action="/de/station" role="search"><input name="q"></form><h2>Die großen Bahnhöfe</h2></section>`;
const PERSON = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const headers = (h: Record<string, string>): Headers => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": PERSON, ...h });
/** A digest that records what it was asked and answers the block. */
const digest = (seen: string[], status = 200, html = BLOCK) => ({
  baseUrl: "http://digest",
  timeoutMs: 1000,
  fetchImpl: (url: string) => {
    seen.push(url);
    const slug = /\/internal\/place\/key\?slug=aachen$/.test(url);
    return Promise.resolve(new Response(slug ? '<p class="place-key">ags:05334002</p>' : html, { status: slug ? 200 : status, headers: { "content-type": "text/html" } }));
  },
});
const post = (body: unknown): Request => new Request(`http://shell${STATION_NEAR_ROUTE}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("(a) a crawler, DNT and GPC are never located on the station index", () => {
  for (const [why, h] of [
    ["a crawler's user agent", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
    ["a headless Chrome", { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0 Safari/537.36" }],
    ["DNT: 1", { dnt: "1" }],
    ["Sec-GPC: 1", { "sec-gpc": "1" }],
  ] as const) {
    it(`${why}: the ladder returns none, nothing is asked, the served slot holds no near list`, async () => {
      const seen: string[] = [];
      let looked = 0;
      const counting = { ...geo, lookup: (ip: string) => (looked++, geo.lookup(ip)) };
      const ip = await stationNearIp(headers(h), "de", { ...digest(seen), geoipFile: undefined, geo: counting });
      expect(ip).toEqual({ html: null, usedGeoIp: false });
      expect(looked).toBe(0);
      expect(seen).toEqual([]);
      const page = withStationNear(INDEX, stationNearSlotHtml("de", ip));
      expect(all(page, "#station-near")).toHaveLength(0);
      const slot = all(page, `#${STATION_NEAR_SLOT}`);
      expect(slot).toHaveLength(1);
      expect([slot[0]!.tag, classesOf(slot[0]!), "hidden" in slot[0]!.attrs, slot[0]!.children]).toEqual(["div", ["station-near-slot"], true, []]);
      expect(page).not.toContain("IP Geolocation by DB-IP");
    });
  }

  it("a person's request is located: the cell alone goes to the digest", async () => {
    const seen: string[] = [];
    const ip = await stationNearIp(headers({}), "de", { ...digest(seen), geoipFile: undefined, geo });
    expect(ip).toEqual({ html: BLOCK, usedGeoIp: true });
    expect(seen).toEqual([`http://digest/internal/station/near?at=${encodeURIComponent(CELL)}&lang=de`]);
  });
});

describe("(b) the near list is private, never kept by a shared cache, and carries no coordinate finer than the cell", () => {
  it("the fragment route answers private, no-store with Vary: X-Forwarded-For — every status", async () => {
    const seen: string[] = [];
    const ok = await stationNearRoute(post({ at: CELL, lang: "de" }), digest(seen));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe(BLOCK);
    for (const r of [ok, await stationNearRoute(post({ at: "dst:1", lang: "de" }), digest([])), await stationNearRoute(new Request(`http://shell${STATION_NEAR_ROUTE}`), digest([])), await stationNearRoute(post({ at: CELL, lang: "de" }), digest([], 404, "<p>no such place</p>"))]) {
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(r.headers.get("vary")).toBe("X-Forwarded-For");
    }
    expect(STATION_NEAR_HEADERS).toEqual({ "cache-control": "private, no-store", vary: "X-Forwarded-For" });
  });

  it("the page sets the same headers (StationsPage.astro), and the fragment's ALL answer too", () => {
    const layout = code(read("packages/web/src/layouts/StationsPage.astro"));
    expect(layout).toContain("for (const [k, v] of Object.entries(STATION_NEAR_HEADERS)) Astro.response.headers.set(k, v);");
    expect(layout).not.toContain('"Cache-Control", "no-store"');
    expect(read("packages/web/src/pages/fragment/station-near.ts")).toContain('"cache-control": "private, no-store", vary: "X-Forwarded-For"');
  });

  it("a position is snapped to its ~500 m cell before the digest is asked; a slug becomes its Gemeinde; other keys are refused", async () => {
    expect(nearKeyOf("pt:50.876543,6.170123")).toBe(CELL);
    expect(nearKeyOf(CELL)).toBe(CELL);
    expect(nearKeyOf("ags:05334002")).toBe("ags:05334002");
    for (const k of ["dst:123", "poi:9", "plz:52062", "pt:50.8,6.1,1", ""]) expect(nearKeyOf(k), k).toBeNull();
    const seen: string[] = [];
    expect((await stationNearRoute(post({ at: "pt:50.876543,6.170123", lang: "de" }), digest(seen))).status).toBe(200);
    expect((await stationNearRoute(post({ at: "slug:aachen", lang: "en" }), digest(seen))).status).toBe(200);
    expect(seen).toEqual([`http://digest/internal/station/near?at=${encodeURIComponent(CELL)}&lang=de`, "http://digest/internal/place/key?slug=aachen", "http://digest/internal/station/near?at=ags%3A05334002&lang=en"]);
    expect(seen.join(" ")).not.toContain("876543");
  });

  it("the served HTML carries no coordinate at all — neither the address's point nor the cell", async () => {
    const ip = await stationNearIp(headers({}), "de", { ...digest([]), geoipFile: undefined, geo });
    const page = withStationNear(INDEX, stationNearSlotHtml("de", ip));
    for (const x of [String(LAT), String(LON), "50.875", "6.1725", "pt:"]) expect(page, x).not.toContain(x);
    expect(page).not.toMatch(/\b\d{1,2}\.\d{3,}\b/u);
  });

  it("refuses a GET, a bad language and an answer that is not the block", async () => {
    expect((await stationNearRoute(new Request(`http://shell${STATION_NEAR_ROUTE}`), digest([]))).status).toBe(405);
    expect((await stationNearRoute(post({ at: CELL, lang: "xx" }), digest([]))).status).toBe(400);
    expect((await stationNearRoute(post({ at: CELL, lang: "de" }), digest([], 200, "<script>x</script>"))).status).toBe(502);
  });
});

describe("(c) nothing on this page asks the exact-position endpoint", () => {
  it("the page's island runs with spot: false — StationsPage → Base → Header → the island's gate", () => {
    expect(code(read("packages/web/src/layouts/StationsPage.astro"))).toContain("const place = { ...headerPlaceFor(lang), spot: false as const };");
    expect(read("packages/web/src/layouts/StationsPage.astro")).toContain("place={place}");
    expect(read("packages/web/src/components/Header.astro")).toContain("...(place.spot === false ? { spot: false as const } : {})");
    expect(read("packages/web/src/location/island.ts")).toContain("if (!fromBar || acc > SPOT_ACC || cfg.spot === false) return cells();");
  });

  it("the near script asks its own route alone, with the key in the body", () => {
    expect(NEAR_JS).not.toContain("/fragment/spot");
    expect(INLINE_SCRIPTS.near).not.toContain("/fragment/spot");
    expect(stationNearScript("de")).toContain(JSON.stringify({ lang: "de", slot: STATION_NEAR_SLOT, route: STATION_NEAR_ROUTE, shape: STATION_NEAR_OPEN }));
    expect([...NEAR_JS.matchAll(/fetch\(([^,]+),/g)].map((m) => m[1])).toEqual(["C.route"]);
    expect(NEAR_JS).toContain("body: JSON.stringify({ at: at, lang: C.lang })");
  });
});

describe("(e) the request log names no place and no coordinate", () => {

  // cross-repo(viafrei-infra): the edge's log format is viafrei-infra's configuration
  it.skip("the format logs the request line and no body", () => {});

  // cross-repo(viafrei-infra): the edge's log format is viafrei-infra's configuration
  it.skip("the page and the near ask: a path with no place name and no coordinate beyond two decimals", () => {});

  it("the shell's own failure line is the route's path, never its query (where the cell travels)", async () => {
    const lines: string[] = [];
    const restore = setLogSink((l) => void lines.push(l));
    try {
      await stationNearIp(headers({}), "de", { ...digest([], 500, "x"), geoipFile: undefined, geo });
    } finally {
      restore();
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"key":"/internal/station/near"');
    expect(lines[0]).not.toMatch(/pt:|50\.87|6\.17|Aachen/u);
  });
});

describe("(f) DB-IP's credit whenever the IP rung chose the place", () => {
  it("a lookup that ran: the credit under the slot, outside it (a remembered place swapped in keeps it)", async () => {
    const ip = await stationNearIp(headers({}), "de", { ...digest([]), geoipFile: undefined, geo });
    const html = stationNearSlotHtml("de", ip);
    expect(html).toContain("IP Geolocation by DB-IP");
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
    expect(html.indexOf("placebar__credit")).toBeGreaterThan(html.indexOf("</div>"));
    // the lookup ran, the digest did not answer: still credited
    const failed = stationNearSlotHtml("de", await stationNearIp(headers({}), "de", { ...digest([], 500, "x"), geoipFile: undefined, geo }));
    expect(failed).toContain("IP Geolocation by DB-IP");
  });

  it("no lookup, no credit; the credit is the place block's own line in every language", () => {
    expect(stationNearSlotHtml("de", { html: null, usedGeoIp: false })).not.toContain("DB-IP");
    const block = read("packages/web/src/components/PlaceBlock.astro");
    // the credit as structure: the DB-IP link, then " · ", then the licence link, siblings in that order
    const dbip = all(block, 'a[href="https://db-ip.com"]');
    expect(dbip).toHaveLength(1);
    expect([dbip[0]!.attrs.lang, dbip[0]!.attrs.rel, text(dbip[0]!)]).toEqual(["en", "noopener noreferrer", "IP Geolocation by DB-IP"]);
    const sibs = dbip[0]!.parent!.children;
    const at = sibs.indexOf(dbip[0]!);
    const sep = sibs[at + 1];
    const lic = sibs[at + 2];
    expect(sep !== undefined && "text" in sep ? sep.text : null).toBe(" · ");
    expect(lic !== undefined && "tag" in lic ? [lic.tag, lic.attrs.href, lic.attrs.rel, text(lic)] : null).toEqual(["a", "https://creativecommons.org/licenses/by/4.0/", "license noopener noreferrer", "CC BY 4.0"]);
    for (const l of ["de", "en", "tr"] as const) expect(geoipCreditHtml(l), l).toContain(t(l, "place.geoipCredit"));
  });
});

describe("the block's place on the page", () => {
  it("right after the search, before the stations most delayed now; a catalogue without its search is unchanged", () => {
    const withTop = INDEX.replace("</form>", '</form><section class="station-top" id="station-top"></section>');
    const page = withStationNear(withTop, stationNearSlotHtml("de", { html: BLOCK, usedGeoIp: true }));
    const search = page.indexOf("stpage-search");
    const near = page.indexOf('id="station-near"');
    const top = page.indexOf('id="station-top"');
    expect(search).toBeLessThan(near);
    expect(near).toBeLessThan(top);
    const noSearch = INDEX.replace(/<form[\s\S]*?<\/form>/u, "");
    expect(withStationNear(noSearch, "x")).toBe(noSearch);
  });
});

describe("the near script follows the place bar (L1 after a click, L3 the remembered choice) and writes nothing", () => {
  const month = ((d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth())(new Date());
  /** The page's script over a fake page: the slot holds what the server rendered (the IP rung's block, or nothing). */
  function page(stored: unknown, served: string) {
    const store = new Map<string, string>(stored === undefined ? [] : [["viafrei.place", JSON.stringify(stored)]]);
    const asked: { url: string; body: unknown }[] = [];
    const writes: string[] = [];
    const listeners: Record<string, (() => void)[]> = {};
    const slot = { innerHTML: served, hidden: served === "", removeAttribute: (n: string) => void (n === "hidden" && (slot.hidden = false)) };
    const document = { getElementById: (id: string) => (id === STATION_NEAR_SLOT ? slot : null), addEventListener: (t: string, f: () => void) => void (listeners[t] ??= []).push(f) };
    const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string) => void writes.push(k), removeItem: (k: string) => void writes.push(k) };
    const fetch = (url: string, init: { body: string }) => {
      asked.push({ url, body: JSON.parse(init.body) as unknown });
      return Promise.resolve({ status: 200, text: () => Promise.resolve(BLOCK.replace("Aachen", (JSON.parse(init.body) as { at: string }).at)) });
    };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the page's own script text, run over fakes
    const run = new Function("document", "localStorage", "fetch", "location", stationNearScript("de")) as (...a: unknown[]) => void;
    run(document, localStorage, fetch, { search: "" });
    const settle = async (): Promise<void> => {
      for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    };
    const fire = async (type: string): Promise<void> => {
      for (const f of listeners[type] ?? []) f();
      await settle();
    };
    return { store, asked, writes, slot, fire, settle };
  }
  const SERVED = '<section class="station-near" id="station-near" aria-labelledby="station-near-t">IP</section>';

  it("nothing remembered: the server's block stays and nothing is asked", async () => {
    const p = page(undefined, SERVED);
    await p.settle();
    expect(p.asked).toEqual([]);
    expect(p.slot.innerHTML).toBe(SERVED);
  });

  it("a remembered place replaces the IP block; a click that remembers a cell is followed; Ort vergessen puts the server's block back", async () => {
    const p = page({ at: "ags:05334002", label: "Aachen", how: "manual", m: month }, SERVED);
    await p.settle();
    expect(p.asked).toEqual([{ url: STATION_NEAR_ROUTE, body: { at: "ags:05334002", lang: "de" } }]);
    expect(p.slot.innerHTML).toContain("ags:05334002");
    // the island remembered the click's cell (it writes after its vf:place)
    p.store.set("viafrei.place", JSON.stringify({ at: CELL, label: "Aachen", how: "browser", m: month }));
    await p.fire("vf:place");
    expect(p.asked.at(-1)).toEqual({ url: STATION_NEAR_ROUTE, body: { at: CELL, lang: "de" } });
    expect(p.slot.innerHTML).toContain(CELL);
    // the same choice told again asks nothing more
    await p.fire("vf:place");
    expect(p.asked).toHaveLength(2);
    p.store.delete("viafrei.place");
    await p.fire("vf:cleared");
    expect(p.slot.innerHTML).toBe(SERVED);
    expect(p.writes).toEqual([]);
  });

  it("a remembered Ganz Deutschland hides the IP block; an IP guess is no choice", async () => {
    const de = page({ at: null, label: "", how: "germany", m: month }, SERVED);
    await de.settle();
    expect(de.slot.hidden).toBe(true);
    expect(de.slot.innerHTML).toBe("");
    const ip = page({ at: CELL, label: "x", how: "ip", m: month }, SERVED);
    await ip.settle();
    expect(ip.asked).toEqual([]);
    expect(ip.slot.innerHTML).toBe(SERVED);
  });
});
