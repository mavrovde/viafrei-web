/**
 * 2.4.6 P0 (prod 2026-10-28: Frankfurt and Hamburg Hbf answered 503 after 2 s, cold): a station page is never a 503
 * because a part of it is slow — one national rule, for every station:
 *  - the static part past the deadline (or a 5xx, a refused connection): the last copy this shell was sent for the
 *    address; else, when the held station list names the slug, its loading frame named from the list (`noindex`), with
 *    the live part and the cards as they came; else (no list held, a slug the list does not name) the 503 as before —
 *    the shell cannot vouch for a slug the digest has not named;
 *  - an answer that is not the page (another shape, a 4xx) is never dressed as loading;
 *  - the list rides as a third column of `/internal/station/list`, and an old two-column list still parses.
 * The page's script that fills a loading part in place is proven in a real browser (`e2e/station-246.e2e.ts`).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATION_PAGE_MAX_AGE_S } from "../../../.pinned/app/packages/digest/dist/src/server/station-service.js";
import { all, first, text } from "@viafrei/design/testing";
import { renderStationPage, stationListText } from "../../../.pinned/app/packages/digest/dist/src/presentation/station-page-html.js";
import { stationPageOf } from "../../../.pinned/app/packages/digest/dist/src/analysis/station-page.js";
import type { StationRecordRow } from "../../../.pinned/app/packages/digest/dist/src/queries/station-page.sql.js";
import { clearStationNames, heldStationName, keepStationNames, primeStationNames, stopKeepingStationNames } from "../src/lib/station-names.js";
import { clearStationFragments, fetchStationList, STATION_KEPT_SERVE_SECONDS, type StationFetchLike } from "../src/lib/station.js";
import { isTransient, resolveStationPage } from "../src/lib/station-page.js";
import { stationPageLoading } from "../src/lib/station-live.js";
import { stationHeadOf } from "../src/lib/station-head.js";
import { REFRESH_JS } from "../src/lib/card-refresh.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { askAgain, RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";

const RECORD: StationRecordRow = {
  station_no: "1866", slug: "frankfurt-main-hbf", name: "Frankfurt (Main) Hbf", eva_no: "8000105", eva_nos: ["8000105"], ds100: "FF", ifopt: null, category: 1,
  federal_state: "Hessen", municipality_code: "06412000", street: null, zipcode: null, city: "Frankfurt am Main", lat: null, lon: null, stepless_access: "yes",
  has_parking: true, has_bicycle_parking: null, has_local_public_transport: null, has_public_facilities: true, has_locker_system: null, has_taxi_rank: null,
  has_travel_necessities: null, has_wifi: true, has_travel_center: null, has_railway_mission: null, has_db_lounge: null, has_lost_and_found: null, has_car_rental: null,
  mobility_service: null, mobility_staff: null, db_information: null, local_service_staff: null, service_phone: null,
  last_seen_at: new Date("2026-10-26T03:00:00Z"), updated_at: new Date("2026-10-20T03:00:00Z"), place_slug: null, place_name: null,
};
const none = { ok: true as const, value: [] };
const PAGE_HTML = renderStationPage("de", stationPageOf({ record: RECORD, platforms: none, around: none, neighbours: none, junctions: none }));
const LIST = "frankfurt-main-hbf\t2026-10-20\tFrankfurt (Main) Hbf\nhamburg-hbf\t2026-10-20\tHamburg Hbf\n";

type Answer = { status: number; body?: string; hang?: boolean; headers?: Record<string, string> };
function stub(answers: Record<string, Answer>): StationFetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = ((url: string, init: { signal: AbortSignal }) => {
    calls.push(url);
    const a = answers[new URL(url).pathname] ?? { status: 404 };
    if (a.hang === true) return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const type = new URL(url).pathname.endsWith("/list") ? "text/plain; charset=utf-8" : "text/html; charset=utf-8";
    const h = new Map(Object.entries({ "content-type": type, ...(a.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), v]));
    return Promise.resolve({ status: a.status, headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null }, text: () => Promise.resolve(a.body ?? "") });
  }) as unknown as StationFetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}
const o = (fetchImpl: StationFetchLike, timeoutMs = 150) => ({ baseUrl: "http://digest:8791", timeoutMs, fetchImpl });
const PAGE = "/internal/station/frankfurt-main-hbf";

beforeEach(() => {
  clearStationFragments();
  clearStationNames();
});

describe("the station list carries the names", () => {
  it("three columns parse with the name; the old two parse without it; a malformed line is a failed read", async () => {
    expect(await fetchStationList(o(stub({ "/internal/station/list": { status: 200, body: LIST } })))).toEqual([
      { slug: "frankfurt-main-hbf", day: "2026-10-20", name: "Frankfurt (Main) Hbf" },
      { slug: "hamburg-hbf", day: "2026-10-20", name: "Hamburg Hbf" },
    ]);
    expect(await fetchStationList(o(stub({ "/internal/station/list": { status: 200, body: "hamburg-hbf\t2026-10-20\n" } })))).toEqual([{ slug: "hamburg-hbf", day: "2026-10-20" }]);
    expect(await fetchStationList(o(stub({ "/internal/station/list": { status: 200, body: "hamburg-hbf\t2026-10-20\tA\tB\n" } })))).toBeNull();
  });

  it("2.4.6 review: the digest's list with a station whose name is blank still parses — that station without a name", async () => {
    const text = stationListText([
      { ...RECORD, name: "Frankfurt (Main) Hbf" },
      { ...RECORD, slug: "ohne-namen", name: " \t " },
    ]);
    expect(await fetchStationList(o(stub({ "/internal/station/list": { status: 200, body: text } })))).toEqual([
      { slug: "frankfurt-main-hbf", day: "2026-10-20", name: "Frankfurt (Main) Hbf" },
      { slug: "ohne-namen", day: "2026-10-20" },
    ]);
  });

  it("the held list: undefined before it is read, a name or null after; a failed ask is not repeated for a minute", async () => {
    expect(heldStationName("hamburg-hbf")).toBeUndefined();
    const dead = stub({});
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: dead }, 1_000);
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: dead }, 30_000);
    expect(dead.calls).toHaveLength(1);
    const f = stub({ "/internal/station/list": { status: 200, body: LIST } });
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: f }, 62_000);
    expect(heldStationName("hamburg-hbf")).toBe("Hamburg Hbf");
    expect(heldStationName("nirgendwo")).toBeNull();
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: f }, 63_000);
    expect(f.calls, "held and fresh: not asked again").toHaveLength(1);
  });
});

describe("#1205: the list is held from the process's first request, not from its first station page", () => {
  it("keepStationNames asks once at once, is idempotent, and its timer keeps no process alive", async () => {
    const f = stub({ "/internal/station/list": { status: 200, body: LIST } });
    try {
      keepStationNames({ baseUrl: "http://digest:8791", fetchImpl: f });
      keepStationNames({ baseUrl: "http://digest:8791", fetchImpl: f });
      await vi.waitFor(() => expect(heldStationName("hamburg-hbf")).toBe("Hamburg Hbf"), { timeout: 500 });
      expect(f.calls, "a second call starts no second ask or timer").toHaveLength(1);
    } finally {
      stopKeepingStationNames();
    }
  });

  it("the middleware keeps the list from every request (no station page needed)", () => {
    const mw = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
    expect(mw).toMatch(/keepStationNames\(\{ baseUrl: readEnv\(\)\.digestUrl \}\)/);
  });
});

describe("a slow static part is never a 503 for a station the shell can vouch for", () => {
  it("past the deadline, with the list held: the loading frame named from the list, noindex, the parts as they came", async () => {
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: stub({ "/internal/station/list": { status: 200, body: LIST } }) });
    const f = stub({ [PAGE]: { status: 200, hang: true }, [`${PAGE}/live`]: { status: 200, hang: true }, [`${PAGE}/area`]: { status: 200, hang: true } });
    const t0 = Date.now();
    const a = await resolveStationPage("de", "frankfurt-main-hbf", o(f));
    expect(Date.now() - t0, "the deadline, never more").toBeLessThan(1_000);
    if (a.kind !== "page") throw new Error(a.kind);
    expect(a.loading).toEqual({ any: true, static: true });
    expect(stationHeadOf(a.html).name).toBe("Frankfurt (Main) Hbf");
    expect(first(a.html, "section#station")!.attrs.class).toBe("stpage stpart--loading");
    expect(first(a.html, "section#station-live")!.attrs.class).toBe("stlive stpart--loading");
    expect(a.area.kind).toBe("loading");
    expect(a.facts).toBeNull();
  });

  it("a 5xx of the static part is the same loading frame; a 404 is still the 404 and another shape still a 503", async () => {
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: stub({ "/internal/station/list": { status: 200, body: LIST } }) });
    const five = await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 503 } })));
    expect(five.kind === "page" && five.loading.static).toBe(true);
    expect(await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 404 } })))).toEqual({ kind: "missing" });
    expect(await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 200, body: "<p>nope</p>" } })))).toEqual({ kind: "unavailable" });
  });

  it("no list held, or a slug the list does not name: the 503 as before (the shell cannot vouch for it)", async () => {
    expect(await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 200, hang: true } })))).toEqual({ kind: "unavailable" });
    await primeStationNames({ baseUrl: "http://digest:8791", fetchImpl: stub({ "/internal/station/list": { status: 200, body: "hamburg-hbf\t2026-10-20\tHamburg Hbf\n" } }) });
    expect(await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 200, hang: true } })))).toEqual({ kind: "unavailable" });
  });

  it("a static part this shell was sent before is answered from that copy when the digest is slow — the full page, not the frame", async () => {
    const ok = stub({ [PAGE]: { status: 200, body: PAGE_HTML, headers: { etag: '"st-abc"' } } });
    const first1 = await resolveStationPage("de", "frankfurt-main-hbf", o(ok));
    expect(first1.kind).toBe("page");
    const slow = await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 200, hang: true } })));
    if (slow.kind !== "page") throw new Error(slow.kind);
    expect(slow.loading.static).toBe(false);
    expect(stationHeadOf(slow.html).name).toBe("Frankfurt (Main) Hbf");
    expect(slow.html).toContain('id="station-facilities"');
  });

  it("2.4.6 review: the kept copy answers for a slow digest only within the bound — the digest's own page-data age", async () => {
    expect(STATION_KEPT_SERVE_SECONDS).toBe(STATION_PAGE_MAX_AGE_S);
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T10:00:00Z") });
    try {
      const ok = stub({ [PAGE]: { status: 200, body: PAGE_HTML, headers: { etag: '"st-abc"' } } });
      expect((await resolveStationPage("de", "frankfurt-main-hbf", o(ok))).kind).toBe("page");
      const fail = (): StationFetchLike => stub({ [PAGE]: { status: 502 } });
      // a 304 later restarts the copy's age
      vi.setSystemTime(Date.now() + (STATION_KEPT_SERVE_SECONDS - 60) * 1000);
      expect((await resolveStationPage("de", "frankfurt-main-hbf", o(stub({ [PAGE]: { status: 304, headers: { etag: '"st-abc"' } } })))).kind).toBe("page");
      vi.setSystemTime(Date.now() + (STATION_KEPT_SERVE_SECONDS - 1) * 1000);
      const within = await resolveStationPage("de", "frankfurt-main-hbf", o(fail()));
      if (within.kind !== "page") throw new Error(within.kind);
      expect(within.loading.static).toBe(false);
      vi.setSystemTime(Date.now() + 2_000);
      // past the bound and no list held: the copy is not served; the shell cannot vouch for the page
      expect((await resolveStationPage("de", "frankfurt-main-hbf", o(fail()))).kind).not.toBe("page");
    } finally {
      vi.useRealTimers();
    }
  });

  it("the loading frame in every language: the name, the error sentence shown (no script), the loading one held for the script", () => {
    for (const lang of LIVE_LANGS) {
      const html = stationPageLoading(lang, "Köln <Hbf>");
      expect(stationHeadOf(html).name, lang).toBe("Köln <Hbf>");
      const ps = all(html, "p.stpage__note");
      expect(ps.map((p) => [text(p), p.attrs.hidden !== undefined]), lang).toEqual([[t(lang, "tile.errorNote"), false], [t(lang, "tile.loading"), true]]);
    }
  });

  it("what may be ready on the next ask, and what may not", () => {
    for (const r of ["timeout after 2000 ms", "HTTP 500", "HTTP 503", "TypeError: fetch failed"]) expect(isTransient(r), r).toBe(true);
    for (const r of ["HTTP 404", "HTTP 400", "not a station fragment", "not text/html", "a 301 without a station"]) expect(isTransient(r), r).toBe(false);
  });
});

describe("the page's script fills a loading part from the page itself", () => {
  it("asks the page's own address, a station page's three parts only, three tries, then the error sentence", () => {
    expect(REFRESH_JS).toContain('var PARTS = ["station", "station-live", "place-cards"];');
    // #1224: the one ask-again of a part that did not answer, shared with the place island and the filler
    expect(REFRESH_JS).toContain(`var FILL_WAITS = ${JSON.stringify(RETRY_WAITS_MS)};`);
    expect(REFRESH_JS).toContain(`var askAgain = ${askAgain.toString()};`);
    expect(REFRESH_JS).toContain("askAgain(window, askPage, function (left) { return left !== 0; }, FILL_WAITS, true)");
    expect(REFRESH_JS).toContain("fetch(location.pathname + location.search,");
    // 2.4.6 review: marked, so the access log (the edge configuration `$vf_visit`) does not count a re-ask as a page view
    expect(REFRESH_JS).toContain('headers: { accept: "text/html", "x-vf-fill": "1" }');
    expect(readFileSync(new URL("the edge configuration", import.meta.url), "utf8")).toMatch(/map \$http_x_vf_fill \$vf_visit \{\s*default 1;\s*"1"\s+0;\s*\}/);
    // #1188: and the around block of every object page (`AroundBlock`'s `#vf-around`)
    expect(REFRESH_JS).toContain('if (!document.getElementById("station") && !document.getElementById("vf-around")) return [];');
    // a live part already in place is kept when the static part arrives around it
    expect(REFRESH_JS).toContain('if (inner) inner.replaceWith(held);');
    // the newly placed cards are scheduled for their refreshes, and the cards' own scripts hear of them
    expect(REFRESH_JS).toContain('document.dispatchEvent(new CustomEvent("vf:swapped"))');
  });
});
