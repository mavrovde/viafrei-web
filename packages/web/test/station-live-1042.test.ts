/**
 * #1042 / #1044 through the shell: the station page's live part asked beside the static page under the same deadline
 * (never a wait past it, never a missing page), put after the head with its platforms card standing in for the static
 * one; the person's choices (`platform`, `to`, `access`) by their shapes only, noindex; the live cards refreshed in
 * place through `/fragment/card?station=`; StaDa's facts read strictly off the `Station-Facts` header into the
 * TrainStation graph with its credit; and every title naming the station and its town, unique across a station set.
 * Every fetch here is a stub.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderStationPage, stationFactsHeader } from "../../../.pinned/app/packages/digest/dist/src/presentation/station-page-html.js";
import { stationPageOf } from "../../../.pinned/app/packages/digest/dist/src/analysis/station-page.js";
import type { StationRecordRow } from "../../../.pinned/app/packages/digest/dist/src/queries/station-page.sql.js";
import { clearStationNames } from "../src/lib/station-names.js";
import { clearStationFragments, stationFactsOf, stationLiveChoice, type StationFetchLike } from "../src/lib/station.js";
import { resolveStationPage } from "../src/lib/station-page.js";
import { stationLiveError, stationLiveLoading, withStationLive } from "../src/lib/station-live.js";
import { cardRefreshRoute, cardRefreshTarget, stationCardCacheControl, validatorOf } from "../src/lib/card-refresh.js";
import { stationLabel, stationMeta } from "../src/site/meta.js";
import { stationJsonLd } from "../src/site/structured-data.js";
import { STADA_CREDIT } from "../src/site/stada-credit.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { t } from "../src/i18n/index.js";

const RECORD: StationRecordRow = {
  station_no: "3320", slug: "koeln-hbf", name: "Köln Hbf", eva_no: "8000207", eva_nos: ["8000207"], ds100: "KK", ifopt: null, category: 1,
  federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", street: "Trankgasse 11", zipcode: "50667", city: "Köln", lat: 50.94303, lon: 6.958729, stepless_access: "yes",
  has_parking: true, has_bicycle_parking: null, has_local_public_transport: null, has_public_facilities: true, has_locker_system: null, has_taxi_rank: null,
  has_travel_necessities: null, has_wifi: true, has_travel_center: null, has_railway_mission: null, has_db_lounge: null, has_lost_and_found: null, has_car_rental: null,
  mobility_service: null, mobility_staff: null, db_information: null, local_service_staff: null, service_phone: null,
  last_seen_at: new Date("2026-10-26T03:00:00Z"), updated_at: new Date("2026-10-20T03:00:00Z"), place_slug: null, place_name: null,
};
const none = { ok: true as const, value: [] };
const PAGE = stationPageOf({ record: RECORD, platforms: none, around: none, neighbours: none, junctions: none });
const PAGE_HTML = renderStationPage("de", PAGE);
const LIVE_HTML =
  '<section class="stlive" id="station-live"><nav class="stlive__chips" aria-label="Jetzt"><ul></ul></nav>' +
  '<article class="pcard stpage__card stlive__card pcard--ok" id="pcard-station-platforms" aria-labelledby="pcard-station-platforms-t" data-card="/fragment/card?station=koeln-hbf&amp;card=platforms&amp;lang=de" data-refresh="300"><header class="pcard__head"><h2 class="pcard__title" id="pcard-station-platforms-t">Bahnsteige</h2></header><p>Aufzug jetzt</p><footer class="pcard__foot">x</footer></article></section>';

type Answer = { status: number; headers?: Record<string, string>; body?: string; hang?: boolean };
function stub(answers: Record<string, Answer>): StationFetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string, init: { signal: AbortSignal }) => {
    calls.push(url);
    const a = answers[new URL(url).pathname] ?? { status: 404 };
    if (a.hang === true) return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const h = new Map(Object.entries({ "content-type": "text/html; charset=utf-8", ...(a.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), v]));
    return Promise.resolve({ status: a.status, headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null }, text: () => Promise.resolve(a.body ?? "") });
  }) as unknown as StationFetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const o = (fetchImpl: StationFetchLike, timeoutMs = 2_000) => ({ baseUrl: "http://digest:8791", timeoutMs, fetchImpl });
const FACTS = stationFactsHeader("de", PAGE);
const pageAnswer: Answer = { status: 200, headers: { etag: '"st-abc"', "station-facts": FACTS }, body: PAGE_HTML };

beforeEach(() => {
  clearStationFragments();
  clearStationNames();
});

describe("#1042 the live part on the station page", () => {
  it("is asked beside the page, put after the head; its platforms card stands in for the static one, the jump link follows", async () => {
    const f = stub({ "/internal/station/koeln-hbf": pageAnswer, "/internal/station/koeln-hbf/live": { status: 200, body: LIVE_HTML } });
    const a = await resolveStationPage("de", "koeln-hbf", o(f), new URLSearchParams());
    if (a.kind !== "page") throw new Error(a.kind);
    expect(a.html.indexOf("</header>")).toBeLessThan(a.html.indexOf('id="station-live"'));
    expect(a.html).not.toContain('id="station-platforms"');
    expect(a.html).toContain('href="#pcard-station-platforms"');
    expect(a.html).toContain('id="station-facilities"');
    expect(a.variant).toBe(false);
    expect(a.facts?.city).toBe("Köln");
  });

  it.each([
    ["a 404", { status: 404 }],
    ["another shape", { status: 200, body: "<p>hello</p>" }],
    ["a script", { status: 200, body: LIVE_HTML.replace("</section>", "<script>x</script></section>") }],
  ])("%s from the live part: the page stands whole, with one sentence instead", async (_n, live) => {
    const f = stub({ "/internal/station/koeln-hbf": pageAnswer, "/internal/station/koeln-hbf/live": live });
    const a = await resolveStationPage("de", "koeln-hbf", o(f));
    if (a.kind !== "page") throw new Error(a.kind);
    expect(a.html).toContain(stationLiveError("de"));
    expect(a.html).toContain('id="station-platforms"');
    expect(a.html).not.toMatch(/<script/);
    expect(a.loading.any).toBe(false);
  });

  it("2.4.6: a 500 from the live part (the digest's pool was busy) is its LOADING block, which the page's script fills", async () => {
    const f = stub({ "/internal/station/koeln-hbf": pageAnswer, "/internal/station/koeln-hbf/live": { status: 500 } });
    const a = await resolveStationPage("de", "koeln-hbf", o(f));
    if (a.kind !== "page") throw new Error(a.kind);
    expect(a.html).toContain(stationLiveLoading("de"));
    expect(a.html).not.toContain(stationLiveError("de"));
    expect(a.html).toContain('id="station-platforms"');
    expect(a.loading).toEqual({ any: true, static: false });
  });

  it("a live part that hangs costs the deadline and no more: the two are asked together", async () => {
    const f = stub({ "/internal/station/koeln-hbf": pageAnswer, "/internal/station/koeln-hbf/live": { status: 200, hang: true } });
    const t0 = Date.now();
    const a = await resolveStationPage("de", "koeln-hbf", o(f, 150));
    const took = Date.now() - t0;
    expect(a.kind).toBe("page");
    expect(took).toBeLessThan(600);
    // 2.4.6: a live part past the deadline is its loading block
    expect(a.kind === "page" && a.html.includes(stationLiveLoading("de"))).toBe(true);
    // #1084: and the place cards of its position, asked with them (2.4.6: and the station list, once, beside them)
    expect(f.calls.map((u) => new URL(u).pathname).sort()).toEqual(["/internal/station/koeln-hbf", "/internal/station/koeln-hbf/area", "/internal/station/koeln-hbf/live", "/internal/station/list"]);
  });

  it("the error block is in the page's language, in every language", () => {
    for (const l of LIVE_LANGS) expect(stationLiveError(l)).toContain(t(l, "tile.errorNote").replace(/'/g, "'").slice(0, 10));
  });

  it("withStationLive leaves a fragment with no head untouched", () => {
    expect(withStationLive("<section>x</section>", LIVE_HTML, "de")).toBe("<section>x</section>");
  });

  it("the person's choices: their shapes only, in one order; anything else dropped; the page is then a variant", async () => {
    expect(stationLiveChoice(new URLSearchParams("to=M%C3%BCnchen%3Cb%3E&platform=10A&access=1&x=1"))).toBe("platform=10a&to=M%C3%BCnchen%20b&access=1");
    expect(stationLiveChoice(new URLSearchParams("platform=4;drop&access=yes"))).toBe("");
    // #1092: the seven travel modes reach the digest and nothing else (2.4.3's "rail" is every mode: dropped)
    expect(stationLiveChoice(new URLSearchParams("mode=subway&platform=2"))).toBe("mode=subway&platform=2");
    expect(stationLiveChoice(new URLSearchParams("mode=bus"))).toBe("mode=bus");
    expect(stationLiveChoice(new URLSearchParams("mode=rail"))).toBe("");
    // #1092: every choice in the digest's order; a Steig or a Bussteig value; a clock time wins over "in 30 min"
    expect(stationLiveChoice(new URLSearchParams("stepfree=1&issues=1&time=30&at=18:30&to=Aachen&platform=B85&mode=sev&side=arr&access=1"))).toBe(
      "side=arr&mode=sev&platform=b85&to=Aachen&at=18%3A30&issues=1&stepfree=1&access=1",
    );
    expect(stationLiveChoice(new URLSearchParams("platform=s12&time=60"))).toBe("platform=s12&time=60");
    // the form's time select sends a clock time as its value: it travels as at=
    expect(stationLiveChoice(new URLSearchParams("time=07:30"))).toBe("at=07%3A30");
    expect(stationLiveChoice(new URLSearchParams("side=dep&time=45&at=25:00&issues=yes&stepfree=0&platform=x12"))).toBe("");
    const f = stub({ "/internal/station/koeln-hbf": pageAnswer, "/internal/station/koeln-hbf/live": { status: 200, body: LIVE_HTML } });
    const a = await resolveStationPage("de", "koeln-hbf", o(f), new URLSearchParams("platform=4"));
    expect(a.kind === "page" && a.variant).toBe(true);
    expect(f.calls.find((u) => u.includes("/live"))).toContain("&platform=4");
    // an unknown parameter alone still makes the address a variant (noindex), never a second indexed copy
    const b = await resolveStationPage("de", "koeln-hbf", o(f), new URLSearchParams("utm=x"));
    expect(b.kind === "page" && b.variant).toBe(true);
  });
});

describe("#1042 the live cards refresh in place", () => {
  const base = { baseUrl: "http://digest:8791" };
  it("a station card's digest address carries the page's choices", () => {
    expect(cardRefreshTarget(new URLSearchParams("station=koeln-hbf&card=board&lang=de&platform=4&to=Aachen"), base)).toBe("http://digest:8791/internal/station/koeln-hbf/card/board?lang=de&platform=4&to=Aachen");
    expect(cardRefreshTarget(new URLSearchParams("station=koeln-hbf&card=lifts&lang=en"), base)).toBe("http://digest:8791/internal/station/koeln-hbf/card/lifts?lang=en");
  });
  it.each(["station=koeln-hbf&card=fuel&lang=de", "station=Koeln&card=board&lang=de", "station=koeln-hbf&card=board&lang=xx", "station=koeln-hbf&card=board&lang=de&place=koeln", "station=koeln-hbf&card=board&lang=de&pages=2", "station=index&card=board&lang=de"])("refused: %s", (q) => {
    expect(cardRefreshTarget(new URLSearchParams(q), base)).toBeNull();
  });
  it("the route answers the card's article with its validator; anything else is a 502 the card is kept through", async () => {
    const article = LIVE_HTML.slice(LIVE_HTML.indexOf("<article"), LIVE_HTML.indexOf("</section>"));
    const ok = await cardRefreshRoute(new Request("https://viafrei.de/fragment/card?station=koeln-hbf&card=platforms&lang=de"), {
      baseUrl: "http://digest:8791",
      timeoutMs: 2_000,
      fetchImpl: () => Promise.resolve(new Response(article, { status: 200, headers: { etag: '"cd-0123456789abcdef01234567"', "x-fragment-as-of": "2026-10-26T08:00:00.000Z" } })),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("etag")).toBe('"cd-0123456789abcdef01234567"');
    expect(ok.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const bad = await cardRefreshRoute(new Request("https://viafrei.de/fragment/card?station=koeln-hbf&card=platforms&lang=de"), { baseUrl: "http://digest:8791", timeoutMs: 2_000, fetchImpl: () => Promise.resolve(new Response("<p>x</p>", { status: 200 })) });
    expect(bad.status).toBe(502);
  });
});

describe("#1042 caching: a bare station live card is a minute's public data", () => {
  const PUBLIC = "public, max-age=60, stale-while-revalidate=600, stale-if-error=600";
  const article = LIVE_HTML.slice(LIVE_HTML.indexOf("<article"), LIVE_HTML.indexOf("</section>"));
  const ask = (q: string, cacheControl: string, inm?: string, seen: string[] = []): Promise<Response> =>
    cardRefreshRoute(new Request(`https://viafrei.de/fragment/card?${q}`, inm === undefined ? {} : { headers: { "if-none-match": inm } }), {
      baseUrl: "http://digest:8791",
      timeoutMs: 2_000,
      fetchImpl: (_url, init) => {
        seen.push(init.headers["if-none-match"] ?? "");
        return Promise.resolve(new Response(article, { status: 200, headers: { etag: '"cd-0123456789abcdef01234567"', "cache-control": cacheControl } }));
      },
    });

  it("the digest's header is passed on for a card with no choice: max-age=60, stale-while-revalidate=600, keyed by the platform", async () => {
    const r = await ask("station=koeln-hbf&card=board&lang=de", PUBLIC);
    expect(r.headers.get("cache-control")).toBe(PUBLIC);
    expect(r.headers.get("vary")).toBe("User-Agent");
    expect(r.headers.get("etag")).toBe('"cd-0123456789abcdef01234567"');
    // a held value's shorter header is passed on as it is
    expect(stationCardCacheControl(new URLSearchParams("station=koeln-hbf&card=lifts&lang=en"), "public, max-age=15, stale-while-revalidate=600, stale-if-error=600")).toBe("public, max-age=15, stale-while-revalidate=600, stale-if-error=600");
  });

  it("a person's choice, a place card, a station's place card, a no-store answer or a header past the bounds stay private", async () => {
    for (const q of ["station=koeln-hbf&card=board&lang=de&platform=4", "station=koeln-hbf&card=board&lang=de&to=M%C3%BCnchen", "station=koeln-hbf&card=platforms&lang=de&access=1", "station=koeln-hbf&card=board&lang=de&side=arr"]) {
      expect((await ask(q, PUBLIC)).headers.get("cache-control"), q).toBe("private, no-cache");
    }
    const params = new URLSearchParams("station=koeln-hbf&card=board&lang=de");
    for (const h of ["no-store", "public, max-age=61, stale-while-revalidate=600, stale-if-error=600", "public, max-age=60, stale-while-revalidate=601, stale-if-error=601", "public, max-age=60, stale-while-revalidate=600", "private, max-age=60, stale-while-revalidate=600, stale-if-error=600"]) {
      expect(stationCardCacheControl(params, h), h).toBeNull();
    }
    expect(stationCardCacheControl(new URLSearchParams("place=koeln&card=roads&lang=de"), PUBLIC)).toBeNull();
    expect(stationCardCacheControl(new URLSearchParams("station=koeln-hbf&area=1&card=roads&lang=de"), PUBLIC)).toBeNull();
    expect((await ask("station=koeln-hbf&card=board&lang=de", "no-store")).headers.get("cache-control")).toBe("private, no-cache");
  });

  it("a validator an edge weakened (W/) is still sent on, so an unchanged card is a 304 and not a full answer (prod 2026-10-28)", async () => {
    const seen: string[] = [];
    await ask("station=koeln-hbf&card=board&lang=de", PUBLIC, 'W/"cd-0123456789abcdef01234567"', seen);
    await ask("station=koeln-hbf&card=board&lang=de", PUBLIC, '"cd-0123456789abcdef01234567"', seen);
    await ask("station=koeln-hbf&card=board&lang=de", PUBLIC, 'W/"x"', seen);
    expect(seen).toEqual(['"cd-0123456789abcdef01234567"', '"cd-0123456789abcdef01234567"', ""]);
    expect(validatorOf(null)).toBeNull();
    expect(validatorOf('W/"cd-0123456789abcdef01234567-ios"')).toBe('"cd-0123456789abcdef01234567-ios"');
  });
});

describe("#1044 the station's facts, its graph and its title", () => {
  it("the facts header is read strictly", () => {
    expect(stationFactsOf(FACTS)).toMatchObject({ street: "Trankgasse 11", zip: "50667", city: "Köln", lat: 50.94303, lon: 6.958729, stepless: "yes" });
    expect(stationFactsOf(FACTS)!.amenities).toHaveLength(3);
    const enc = (x: unknown): string => Buffer.from(JSON.stringify(x)).toString("base64url");
    expect(stationFactsOf(enc({ city: "<b>x</b>", lat: 10, lon: 200, zip: "1234", amenities: ["a", 3, "<x>"] }))).toEqual({ street: null, zip: null, city: null, lat: null, lon: null, stepless: null, amenities: ["a"], source: "db_stada", land: null, landKey: null, place: null, stand: null });
    // #1087: whose record — the zHV's for a railway station StaDa does not list; anything else is StaDa's
    expect(stationFactsOf(enc({ source: "delfi_zhv" }))?.source).toBe("delfi_zhv");
    expect(stationFactsOf(enc({ source: "osm" }))?.source).toBe("db_stada");
    expect(stationFactsOf("not base64 !")).toBeNull();
    expect(stationFactsOf(null)).toBeNull();
    expect(stationFactsOf(enc([1, 2]))).not.toBeNull();
  });

  it("#1087: a railway station StaDa does not list credits the zHV in its graph, never StaDa", () => {
    const enc = (x: unknown): string => Buffer.from(JSON.stringify(x)).toString("base64url");
    const g = (JSON.parse(stationJsonLd("de", "Alsdorf, Annapark Bf", "/de/station/alsdorf-annapark-bf", stationFactsOf(enc({ lat: 50.87, lon: 6.16, source: "delfi_zhv" })))) as { "@graph": Record<string, unknown>[] })["@graph"];
    const based = g.find((n) => n["@type"] === "TrainStation")!["isBasedOn"] as Record<string, unknown>;
    expect(based["name"]).toBe("DELFI zHV");
    expect(based["creditText"]).toBe("Haltestellendaten: DELFI e.V. (zentrales Haltestellenverzeichnis), CC BY 4.0, bearbeitet");
  });

  const ldOf = (facts: ReturnType<typeof stationFactsOf>) => {
    const g = (JSON.parse(stationJsonLd("de", "Köln Hbf", "/de/station/koeln-hbf", facts)) as { "@graph": Record<string, unknown>[] })["@graph"];
    return g.find((n) => n["@type"] === "TrainStation")!;
  };
  /** The schema rule the page must meet (#1044): a TrainStation with a name, a full address, a point, free entry and its credit. */
  const valid = (n: Record<string, unknown>): boolean => {
    const a = n["address"] as Record<string, unknown> | undefined;
    const geo = n["geo"] as Record<string, unknown> | undefined;
    const based = n["isBasedOn"] as Record<string, unknown> | undefined;
    return (
      n["@type"] === "TrainStation" &&
      typeof n["name"] === "string" &&
      a?.["@type"] === "PostalAddress" && typeof a["streetAddress"] === "string" && typeof a["postalCode"] === "string" && typeof a["addressLocality"] === "string" && a["addressCountry"] === "DE" &&
      geo?.["@type"] === "GeoCoordinates" && typeof geo["latitude"] === "number" && typeof geo["longitude"] === "number" &&
      n["isAccessibleForFree"] === true &&
      Array.isArray(n["amenityFeature"]) &&
      based?.["creditText"] === STADA_CREDIT.text && based["license"] === "https://creativecommons.org/licenses/by/4.0/"
    );
  };

  it("the TrainStation: address, point, facilities, free entry and StaDa's credit — and a mutant without address or geo is caught", () => {
    const n = ldOf(stationFactsOf(FACTS));
    expect(valid(n)).toBe(true);
    const without = (k: string): Record<string, unknown> => Object.fromEntries(Object.entries(n).filter(([x]) => x !== k));
    const noAddress = without("address");
    const noGeo = without("geo");
    expect(valid(noAddress)).toBe(false);
    expect(valid(noGeo)).toBe(false);
    expect(JSON.stringify(n)).not.toMatch(/Abfahrt|Verspätung|außer Betrieb/);
  });

  it("without facts: the name and the country only, and no credit for data it does not carry", () => {
    const n = ldOf(null);
    expect(n["address"]).toEqual({ "@type": "PostalAddress", addressCountry: "DE" });
    expect(n["isBasedOn"]).toBeUndefined();
  });

  it("the StaDa credit is the register's, its publisher the first part of the line", () => {
    expect(STADA_CREDIT.text).toBe("Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet");
    expect(STADA_CREDIT.creator.name).toBe("Deutsche Bahn AG");
  });

  it("a title names the station and its town, and the set of titles is unique", () => {
    expect(stationLabel("Köln Hbf", "Köln")).toBe("Köln Hbf");
    expect(stationLabel("Frankfurt (Main) Hbf", "Frankfurt am Main")).toBe("Frankfurt (Main) Hbf");
    expect(stationLabel("Kleinhalt", "Görlitz")).toBe("Kleinhalt (Görlitz)");
    expect(stationLabel("Kleinhalt", null)).toBe("Kleinhalt");
    expect(stationLabel("Mühlhausen", "Mühlhausen/Thüringen")).toBe("Mühlhausen (Mühlhausen/Thüringen)");
    // StaDa has "Neustadt (Holst)" and "Neustadt (Dosse)"; and two halts of one name in two towns
    const set = [
      ["Neustadt (Holst)", "Neustadt in Holstein"],
      ["Neustadt (Dosse)", "Neustadt (Dosse)"],
      ["Mühlhausen", "Mühlhausen/Thüringen"],
      ["Mühlhausen", "Mühlhausen (Kraichgau)"],
      ["Bahnhof Nord", "Erfurt"],
      ["Bahnhof Nord", "Halle (Saale)"],
    ] as const;
    for (const l of LIVE_LANGS) {
      const titles = set.map(([n, c]) => stationMeta(n, l, c).title);
      expect(new Set(titles).size, l).toBe(titles.length);
      for (const [n] of set) expect(titles.some((x) => x.includes(n)), `${l} ${n}`).toBe(true);
    }
    expect(stationMeta("Bahnhof Nord", "de", "Erfurt").title).toContain("Bahnhof Nord (Erfurt)");
  });
});
