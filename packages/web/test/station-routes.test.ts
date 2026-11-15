/**
 * The station pages' addresses and fragments (#1041): the paths are the
 * digest's in every language, the reserved route words are the ingest's, a
 * spelling of a slug is a 301 to it, a renamed station's old slug a 301 to the
 * new page (the digest's 301 is never FOLLOWED: that would serve the new page
 * under the old address), an unknown station the 404 page and a digest that
 * does not answer a 503. The fragment is kept with its ETag and revalidated;
 * the sitemap lists every page in every language (address and lastmod; the
 * alternates are in the page's head, 2.4.2) and a real day. Loopback-free: every fetch here is a stub.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { stationIndexPath as digestIndexPath, stationPath as digestPath } from "../../../.pinned/app/packages/digest/dist/src/cards/shared/paths.js";
import { renderStationIndex, renderStationPage } from "../../../.pinned/app/packages/digest/dist/src/presentation/station-page-html.js";
import { stationPageOf } from "../../../.pinned/app/packages/digest/dist/src/analysis/station-page.js";
import type { StationRecordRow } from "../../../.pinned/app/packages/digest/dist/src/queries/station-page.sql.js";
import { STATION_RESERVED_SLUGS } from "../../../.pinned/app/packages/ingest/dist/domain/transit/station-slug.js";
import { clearStationFragments, fetchStationList, fetchStationPage, stationFragmentsKept, stationIndexChoice, type StationFetchLike } from "../src/lib/station.js";
import { resolveStationIndex, resolveStationPage } from "../src/lib/station-page.js";
import { stationHeadOf } from "../src/lib/station-head.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { STATION_RESERVED, isStationSlug, stationAddress, stationPath } from "../src/site/stations.js";
import { stationsLangXml } from "../src/site/sitemaps.js";
import { stationMeta } from "../src/site/meta.js";
import { stationJsonLd } from "../src/site/structured-data.js";

const RECORD: StationRecordRow = {
  station_no: "3320", slug: "koeln-hbf", name: "Köln Hbf & Dom", eva_no: "8000207", eva_nos: ["8000207"], ds100: "KK", ifopt: null, category: 1,
  federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", street: null, zipcode: null, city: "Köln", lat: null, lon: null, stepless_access: "yes",
  has_parking: true, has_bicycle_parking: null, has_local_public_transport: null, has_public_facilities: true, has_locker_system: null, has_taxi_rank: null,
  has_travel_necessities: null, has_wifi: true, has_travel_center: null, has_railway_mission: null, has_db_lounge: null, has_lost_and_found: null, has_car_rental: null,
  mobility_service: null, mobility_staff: null, db_information: null, local_service_staff: null, service_phone: null,
  last_seen_at: new Date("2026-10-26T03:00:00Z"), updated_at: new Date("2026-10-20T03:00:00Z"), place_slug: null, place_name: null,
};
const none = { ok: true as const, value: [] };
const PAGE_HTML = renderStationPage("de", stationPageOf({ record: RECORD, platforms: none, around: none, neighbours: none, junctions: none }));

type Answer = { status: number; headers?: Record<string, string>; body?: string };
/** A digest stub: answers by path, records each request's headers and redirect mode. */
function stub(answers: Record<string, Answer | (() => Answer)>): StationFetchLike & { calls: { url: string; headers: Record<string, string>; redirect: string }[] } {
  const calls: { url: string; headers: Record<string, string>; redirect: string }[] = [];
  const f = ((url: string, init: { headers: Record<string, string>; redirect: "manual" }) => {
    calls.push({ url, headers: init.headers, redirect: init.redirect });
    const path = new URL(url).pathname;
    const a0 = answers[path];
    const a = typeof a0 === "function" ? a0() : (a0 ?? { status: 404 });
    const h = new Map(Object.entries({ "content-type": "text/html; charset=utf-8", ...(a.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), v]));
    return Promise.resolve({ status: a.status, headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null }, text: () => Promise.resolve(a.body ?? "") });
  }) as unknown as StationFetchLike & { calls: typeof calls };
  f.calls = calls;
  return f;
}
const o = (fetchImpl: StationFetchLike) => ({ baseUrl: "http://digest:8791", timeoutMs: 2_000, fetchImpl });

beforeEach(() => clearStationFragments());

describe("the station addresses", () => {
  it("are the digest's paths in every language, and the catalogue is the page map's row", () => {
    for (const l of LIVE_LANGS) {
      expect(pathFor("stations", l)).toBe(digestIndexPath(l));
      expect(pathFor("stations", l)).toBe(`/${l}/station`);
      expect(stationPath(l, "koeln-hbf")).toBe(digestPath(l, "koeln-hbf"));
    }
  });

  it("the route's own words are the ingest's reserved slugs: never a station", () => {
    expect([...STATION_RESERVED].sort()).toEqual([...STATION_RESERVED_SLUGS].sort());
    for (const w of STATION_RESERVED) expect(isStationSlug(w)).toBe(false);
  });

  it("a slug is itself; another spelling folds to one; nothing foldable is none", () => {
    expect(stationAddress("koeln-hbf")).toEqual({ kind: "slug", slug: "koeln-hbf" });
    expect(stationAddress("K%C3%B6ln%20Hbf")).toEqual({ kind: "respell", slug: "koeln-hbf" });
    expect(stationAddress("KOELN-HBF")).toEqual({ kind: "respell", slug: "koeln-hbf" });
    expect(stationAddress("%E0%A4%A")).toEqual({ kind: "none" });
    expect(stationAddress("---")).toEqual({ kind: "none" });
    expect(stationAddress("index")).toEqual({ kind: "none" });
  });
});

describe("one station's page through the shell", () => {
  it("the digest's own fragment is accepted, kept with its ETag, and revalidated with If-None-Match", async () => {
    let n = 0;
    const f = stub({ "/internal/station/koeln-hbf": () => (n++ === 0 ? { status: 200, headers: { etag: '"st-abc"' }, body: PAGE_HTML } : { status: 304 }) });
    const first = await resolveStationPage("de", "koeln-hbf", o(f));
    expect(first.kind).toBe("page");
    expect(stationFragmentsKept().entries).toBe(1);
    const again = await fetchStationPage("koeln-hbf", "de", o(f));
    expect(again).toMatchObject({ kind: "ok", revalidated: true });
    // the page is asked twice (the live part beside it is never kept, so never revalidated)
    const pageCalls = f.calls.filter((c) => new URL(c.url).pathname === "/internal/station/koeln-hbf");
    expect(pageCalls[1]!.headers["if-none-match"]).toBe('"st-abc"');
    expect(f.calls.every((c) => c.redirect === "manual")).toBe(true);
  });

  it("another spelling is a 301 to the slug without asking the digest", async () => {
    const f = stub({});
    expect(await resolveStationPage("en", "K%C3%B6ln%20Hbf", o(f))).toEqual({ kind: "redirect", to: "/en/station/koeln-hbf" });
    expect(f.calls).toHaveLength(0);
  });

  it("a renamed station's old slug (the digest's 301) is a 301 to the new page in the page's language", async () => {
    const f = stub({ "/internal/station/koeln-alt": { status: 301, headers: { "station-moved": "koeln-hbf", location: "/internal/station/koeln-hbf?lang=fr" } } });
    expect(await resolveStationPage("fr", "koeln-alt", o(f))).toEqual({ kind: "redirect", to: "/fr/station/koeln-hbf" });
  });

  it("a 301 naming no station, a 500, a body that is not ours and a dead digest are all 'unavailable' — never a page", async () => {
    for (const a of [{ status: 301 }, { status: 500 }, { status: 200, body: "<p>hello</p>" }, { status: 200, body: `${PAGE_HTML.slice(0, -10)}<script>x</script></section>` }]) {
      expect(await resolveStationPage("de", "koeln-hbf", o(stub({ "/internal/station/koeln-hbf": a }))), JSON.stringify(a).slice(0, 40)).toEqual({ kind: "unavailable" });
    }
    const dead: StationFetchLike = () => Promise.reject(new Error("ECONNREFUSED"));
    expect(await resolveStationPage("de", "koeln-hbf", o(dead))).toEqual({ kind: "unavailable" });
  });

  it("an unknown station is the 404 page", async () => {
    expect(await resolveStationPage("de", "gibt-es-nicht", o(stub({})))).toEqual({ kind: "missing" });
  });

  it("the name is read off the fragment for the h1 and taken out of it; the meta carries it, the JSON-LD names the station and no coordinate", () => {
    const head = stationHeadOf(PAGE_HTML);
    expect(head.name).toBe("Köln Hbf & Dom");
    expect(head.html).not.toContain("stpage__name");
    expect(stationMeta("Köln Hbf", "en").title).toContain("Köln Hbf");
    const ld = JSON.parse(stationJsonLd("en", "Köln Hbf", "/en/station/koeln-hbf")) as { "@graph": { "@type": string; name?: string }[] };
    expect(ld["@graph"].find((n) => n["@type"] === "TrainStation")?.name).toBe("Köln Hbf");
    expect(JSON.stringify(ld)).not.toMatch(/latitude|longitude|geo/);
  });
});

describe("the catalogue", () => {
  it("only a search and a Land key reach the digest, each by its shape; the bare catalogue alone is kept", async () => {
    expect(stationIndexChoice(new URLSearchParams("q=K%C3%B6ln%3Cscript%3E&land=05&x=1"))).toBe("q=K%C3%B6ln%20script&land=05");
    expect(stationIndexChoice(new URLSearchParams("land=99"))).toBe("");
    const body = renderStationIndex("de", [{ station_no: "1", slug: "koeln-hbf", name: "Köln Hbf", city: "Köln", federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", category: 1, updated_at: new Date(), ifopt: null }], { q: "", land: null });
    const f = stub({ "/internal/station/index": { status: 200, headers: { etag: '"st-i"' }, body } });
    expect(await resolveStationIndex("de", o(f))).toMatchObject({ kind: "page", variant: false });
    expect(await resolveStationIndex("de", o(f), new URLSearchParams("q=koeln"))).toMatchObject({ kind: "page", variant: true });
    expect(stationFragmentsKept().entries).toBe(1);
  });
});

describe("the station sitemap", () => {
  it("reads the digest's list; a malformed line or a count that disagrees is no list", async () => {
    const list = (body: string, n: string) => stub({ "/internal/station/list": { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "station-pages": n }, body } });
    expect(await fetchStationList(o(list("koeln-hbf\t2026-10-20\nbonn-hbf\t2026-10-19\n", "2")))).toEqual([{ slug: "koeln-hbf", day: "2026-10-20" }, { slug: "bonn-hbf", day: "2026-10-19" }]);
    expect(await fetchStationList(o(list("koeln-hbf\t2026-10-20\nBAD LINE\n", "2")))).toBeNull();
    expect(await fetchStationList(o(list("koeln-hbf\t2026-10-20\n", "3")))).toBeNull();
    expect(await fetchStationList(o(stub({})))).toBeNull();
  });

  it("lists every page in its language, address and lastmod only (the alternates are in the page's head, 2.4.2), the newer of the template's day and the record's", () => {
    const xml = stationsLangXml("en", [{ slug: "koeln-hbf", day: "2026-10-20" }, { slug: "bonn-hbf", day: "2020-01-01" }], "2026-10-01");
    const urls = all(xml, "url").map((u) => [text(all(u, "loc")[0]!), text(all(u, "lastmod")[0]!)]);
    expect(urls).toContainEqual(["https://viafrei.de/en/station/koeln-hbf", "2026-10-20"]);
    expect(urls).toContainEqual(["https://viafrei.de/en/station/bonn-hbf", "2026-10-01"]);
    expect(xml).not.toContain("hreflang");
    // 5 409 stations: about 0.6 MB a language, not the 12.3 MB the alternates made it (oom_kills 2026-10-26 16:51 UTC)
    const big = stationsLangXml("de", Array.from({ length: 5409 }, (_, i) => ({ slug: `bahnhof-nummer-${i}-hbf`, day: "2026-10-26" })), "2026-10-01");
    expect(big.length).toBeLessThan(800_000);
  });
});
