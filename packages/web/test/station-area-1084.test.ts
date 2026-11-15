/**
 * #1084, the shell's half: a station page asks the digest for the place cards of the station's position
 * (`/internal/station/<slug>/area`, `fuelRows=0` as a city page asks its cards) in parallel with the station's page and
 * live part, under the same deadline; the answer is taken only in the place cards' shape; a station with no cards is no
 * block, and a slow, failed or malformed answer is the block's error state in the page's language — never a slow page,
 * never a missing station. One card refreshes in place through `/fragment/card?station=<slug>&area=1&card=<id>`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { renderPlace } from "../../../.pinned/app/packages/digest/dist/src/presentation/place-tiles.js";
import type { PlaceCards } from "../../../.pinned/app/packages/digest/dist/src/analysis/place-cards.js";
import type { NeighboursCard } from "../../../.pinned/app/packages/digest/dist/src/cards/neighbours/judge.js";
import { renderStationPage } from "../../../.pinned/app/packages/digest/dist/src/presentation/station-page-html.js";
import { stationPageOf } from "../../../.pinned/app/packages/digest/dist/src/analysis/station-page.js";
import type { StationRecordRow } from "../../../.pinned/app/packages/digest/dist/src/queries/station-page.sql.js";
import { AREA_SHAPE, areaError, areaLoading, fetchArea } from "../src/lib/object-area.js";
import { resolveStationPage } from "../src/lib/station-page.js";
import { clearStationNames } from "../src/lib/station-names.js";
import { clearStationFragments, type StationFetchLike } from "../src/lib/station.js";
import { cardRefreshTarget } from "../src/lib/card-refresh.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { GET as cardFragment } from "../src/pages/fragment/card.js";

const NOW = new Date("2026-10-27T08:00:00.000Z");
const neighbours = { id: "neighbours", verdict: "info", reachM: 30_000, rows: [{ ags: "05315001", name: "Ortx", metres: 1000, lat: 50.9, lon: 6.9, state: null }], stateRead: true, attributions: [] } as unknown as NeighboursCard;
const CARDS: PlaceCards = { place: { at: "pt:50.94,6.9575", name: "Köln", ags: "05315000", lat: 50.94, lon: 6.9575, point: true }, at: NOW, cards: [neighbours] };
/** The digest's own fragment, as its area route renders it. */
const AREA = renderPlace({ cards: CARDS, report: null, lang: "de", label: { kind: "at", name: "Köln Hbf", town: "Köln", source: "db_stada" }, here: "/de/station/koeln-hbf" });

type Answer = { status: number; body?: string; delayMs?: number };
function stub(answers: Record<string, Answer>): StationFetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string, init: { signal: AbortSignal }) => {
    calls.push(url);
    const a = answers[new URL(url).pathname] ?? { status: 404 };
    const res = { status: a.status, headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(a.body ?? "") };
    if (a.delayMs === undefined) return Promise.resolve(res);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(res), a.delayMs);
      init.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  }) as unknown as StationFetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const o = (fetchImpl: StationFetchLike, timeoutMs = 2_000) => ({ baseUrl: "http://digest:8791", timeoutMs, fetchImpl });
const AREA_PATH = "/internal/station/koeln-hbf/area";

describe("#1084: the place cards of a station's position, in the shell", () => {
  it("asks the digest's area route for the station, with the fuel card as its frame, and takes the cards as they arrived", async () => {
    expect(AREA_SHAPE.test(AREA)).toBe(true);
    const f = stub({ [AREA_PATH]: { status: 200, body: AREA } });
    expect(await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(f))).toEqual({ kind: "ok", html: AREA });
    expect(f.calls).toEqual(["http://digest:8791/internal/station/koeln-hbf/area?lang=de&fuelRows=0"]);
  });

  it("#1109: the page's charging filter reaches the full charging card, and nothing else of the page's query does", async () => {
    const f = stub({ [AREA_PATH]: { status: 200, body: AREA } });
    await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(f), new URLSearchParams("ev_op=ladenetz&ev_kw=ac&platform=4&x=%3Cscript%3E"));
    expect(f.calls).toEqual(["http://digest:8791/internal/station/koeln-hbf/area?lang=de&fuelRows=0&ev_op=ladenetz&ev_kw=ac"]);
  });

  it("a station the digest has no cards for (no point, far outside Germany) is no block at all", async () => {
    expect(await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(stub({})))).toEqual({ kind: "none" });
  });

  it("a malformed answer is the block's error state — the frame and one sentence, nothing read", async () => {
    for (const a of [{ status: 200, body: "<p>place unavailable</p>" }, { status: 200, body: `${AREA.replace("</section>", "")}<script>x</script></section>` }]) {
      const r = await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(stub({ [AREA_PATH]: a })));
      expect(r, JSON.stringify(a).slice(0, 40)).toEqual({ kind: "error", html: areaError("de") });
    }
  });

  it("2.4.6: a slow answer or a 5xx is the block's LOADING state (the page's script asks again), and costs the deadline only", async () => {
    for (const a of [{ status: 500 }, { status: 503 }]) {
      const r = await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(stub({ [AREA_PATH]: a })));
      expect(r, JSON.stringify(a)).toEqual({ kind: "loading", html: areaLoading("de") });
    }
    const t0 = Date.now();
    const slow = await fetchArea({ kind: "station", slug: "koeln-hbf" }, "de", o(stub({ [AREA_PATH]: { status: 200, body: AREA, delayMs: 1_500 } }), 200));
    expect(slow.kind).toBe("loading");
    // the deadline, never the slow card's time
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it("2.4.6: the loading state in every language: the cards' frame, the error sentence shown (no script), the loading one held for the script", () => {
    for (const lang of LIVE_LANGS) {
      const html = areaLoading(lang);
      expect(first(html, "section#place-cards")!.attrs.class, lang).toBe("place stpart--loading");
      const ps = all(html, "p.place__none");
      // without script nothing more will come: the error sentence; the page's script shows the loading one instead
      expect(ps.map((p) => [text(p), p.attrs.hidden !== undefined]), lang).toEqual([[t(lang, "tile.errorNote"), false], [t(lang, "tile.loading"), true]]);
      expect(all(html, "article, .credit, a"), lang).toHaveLength(0);
    }
  });

  it("the error state in every language: the cards' frame, the one sentence, no figure, no card", () => {
    for (const lang of LIVE_LANGS) {
      const html = areaError(lang);
      expect(first(html, "section#place-cards")!.attrs.class, lang).toBe("place is-error");
      expect(text(first(html, "p.place__none")!), lang).toBe(t(lang, "tile.errorNote"));
      expect(all(html, "article, .credit, a"), lang).toHaveLength(0);
    }
  });

  it("the page answer carries the cards beside the station's own; a station with none carries no block", async () => {
    const record: StationRecordRow = {
      station_no: "3320", slug: "koeln-hbf", name: "Köln Hbf", eva_no: "8000207", eva_nos: ["8000207"], ds100: "KK", ifopt: null, category: 1,
      federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", street: null, zipcode: null, city: "Köln", lat: 50.943, lon: 6.9586, stepless_access: "yes",
      has_parking: true, has_bicycle_parking: null, has_local_public_transport: null, has_public_facilities: true, has_locker_system: null, has_taxi_rank: null,
      has_travel_necessities: null, has_wifi: true, has_travel_center: null, has_railway_mission: null, has_db_lounge: null, has_lost_and_found: null, has_car_rental: null,
      mobility_service: null, mobility_staff: null, db_information: null, local_service_staff: null, service_phone: null,
      last_seen_at: NOW, updated_at: NOW, place_slug: null, place_name: null,
    };
    const none = { ok: true as const, value: [] };
    const page = renderStationPage("de", stationPageOf({ record, platforms: none, around: none, neighbours: none, junctions: none }));
    clearStationFragments();
    const ok = await resolveStationPage("de", "koeln-hbf", o(stub({ "/internal/station/koeln-hbf": { status: 200, body: page }, [AREA_PATH]: { status: 200, body: AREA } })));
    expect(ok.kind === "page" ? ok.area : null).toEqual({ kind: "ok", html: AREA });
    clearStationFragments();
    const bare = await resolveStationPage("de", "koeln-hbf", o(stub({ "/internal/station/koeln-hbf": { status: 200, body: page } })));
    expect(bare.kind === "page" ? bare.area : null).toEqual({ kind: "none" });
    // a dead cards answer: the page stands, the block is its loading state (2.4.6), asked again by the page's script
    clearStationFragments();
    const dead = await resolveStationPage("de", "koeln-hbf", o(stub({ "/internal/station/koeln-hbf": { status: 200, body: page }, [AREA_PATH]: { status: 503 } })));
    expect(dead.kind).toBe("page");
    expect(dead.kind === "page" ? dead.area : null).toEqual({ kind: "loading", html: areaLoading("de") });
    expect(dead.kind === "page" ? dead.loading.any : null).toBe(true);
  });

  it("the station's page, its live part and the cards are asked together; a dead cards answer never costs the page", async () => {
    clearStationFragments();
    clearStationNames();
    const f = stub({ "/internal/station/koeln-hbf": { status: 500 }, [AREA_PATH]: { status: 200, body: AREA } });
    // the page itself failed and this shell holds no station list to vouch for the slug: the 503 of the page, never a
    // page of cards alone (with a held list it is the loading frame: station-page-246.test.ts); the list is asked beside
    expect(await resolveStationPage("de", "koeln-hbf", o(f))).toEqual({ kind: "unavailable" });
    expect(f.calls.map((u) => new URL(u).pathname).sort()).toEqual([AREA_PATH, "/internal/station/koeln-hbf", "/internal/station/koeln-hbf/live", "/internal/station/list"].sort());
  });
});

describe("#1084: one place card of a station page refreshed in place", () => {
  const O = { baseUrl: "http://digest:8791", mapPlatform: "other" as const };
  const q = (s: string): URLSearchParams => new URLSearchParams(s);

  it("is the digest's station area card, keeping an expanded card's pages", () => {
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=neighbours&lang=de"), O)).toBe("http://digest:8791/internal/station/koeln-hbf/area/neighbours?lang=de");
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=stations&lang=bg&pages=3"), O)).toBe("http://digest:8791/internal/station/koeln-hbf/area/stations?lang=bg&pages=3");
  });

  it("#1109: the station's full charging card keeps its filter on a refresh; no other card carries it", () => {
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=charging&lang=de&ev_op=ladenetz"), O)).toBe("http://digest:8791/internal/station/koeln-hbf/area/charging?lang=de&ev_op=ladenetz");
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=roads&lang=de&ev_op=ladenetz"), O)).toBe("http://digest:8791/internal/station/koeln-hbf/area/roads?lang=de");
  });

  it("refuses the fuel card, an unknown card, a bad language or pages, a place beside the station, and any other area word", () => {
    for (const s of [
      "station=koeln-hbf&area=1&card=fuel&lang=de",
      "station=koeln-hbf&area=1&card=bogus&lang=de",
      "station=koeln-hbf&area=1&card=roads&lang=xx",
      "station=koeln-hbf&area=1&card=roads&lang=de&pages=0",
      "station=koeln-hbf&area=1&card=roads&lang=de&place=koeln",
      "station=Koeln-Hbf&area=1&card=roads&lang=de",
      "station=koeln-hbf&area=2&card=board&lang=de",
    ])
      expect(cardRefreshTarget(q(s), O), s).toBeNull();
    // a live card of the station is its own route, as before
    expect(cardRefreshTarget(q("station=koeln-hbf&card=board&lang=de"), O)).toBe("http://digest:8791/internal/station/koeln-hbf/card/board?lang=de");
  });
});

describe("2.5.2 review: a station's area card waits a tile's 2 s, never the place page's deadline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Prod, read-only, 2026-11-01 (schema 236, before 0238): the digest's cold `/internal/station/<slug>/area/<card>`
  // round took 0.25-0.76 s over ten stations from Filsen to Berlin Zoologischer Garten (the full area 0.41 s), so a
  // tile's deadline holds it with room; the hotfix of 2026-10-30 had waited the place page's 8 s.
  it("/fragment/card?station=…&area=1 asks the digest under the tile deadline (2 000 ms), not WEB_PLACE_TIMEOUT_MS", async () => {
    vi.stubEnv("WEB_TILE_TIMEOUT_MS", "");
    vi.stubEnv("WEB_PLACE_TIMEOUT_MS", "");
    vi.stubEnv("DIGEST_URL", "http://digest:8791");
    vi.stubEnv("DIGEST_FRAGMENT_URL", "");
    const deadlines: number[] = [];
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      deadlines.push(ms);
      return timeout(ms);
    });
    const asked: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      return Promise.resolve(new Response('<article class="pcard" data-card="roads"></article>', { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
    });
    const request = new Request("https://viafrei.de/fragment/card?station=koeln-hbf&area=1&card=roads&lang=de");
    const r = await cardFragment({ request, locals: { mapPlatform: "other" } } as unknown as Parameters<typeof cardFragment>[0]);
    expect(r.status).toBe(200);
    expect(asked).toEqual(["http://digest:8791/internal/station/koeln-hbf/area/roads?lang=de"]);
    expect(deadlines).toEqual([2_000]);
  });
});
