/**
 * The motorway pages' addresses (#715, 2.1.13): the site's copy of the
 * motorway rules is the ingest rule (pinned here, because the site may not
 * import a workspace that holds a database at runtime), the paths are the
 * digest's, and NO motorway address is a 404 — a spelling is a 301 to the page,
 * anything else a 301 to the index, a digest that does not answer a 503.
 */
import { canonicalMotorway as ingestCanonical, compareMotorways as ingestCompare, motorwaySlug as ingestSlug } from "@viafrei/ingest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCP_ENDPOINT_URL, connectPath } from "../../digest/src/presentation/motorway-tiles.js";
import { motorwayIndexPath as digestIndexPath, motorwayPath as digestPath } from "../../digest/src/cards/shared/paths.js";
import { MOTORWAY_FRAGMENT_CACHE_BYTES, MOTORWAY_KEPT_SERVE_SECONDS, clearMotorwayFragments, fetchMotorwayList, getMotorwayFragment, heapBytesOf, motorwayFragmentsKept } from "../src/lib/motorway.js";
import { motorwayAddress, resolveMotorwayIndex, resolveMotorwayPage } from "../src/lib/motorway-page.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { MOTORWAY_SEGMENT, canonicalMotorway, compareMotorways, motorwayPath, motorwaySlug } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";

const SPELLINGS = ["A3", "a3", "A 3", "a03", "A-3", "BAB3", "bab 3", "Autobahn 3", "A.7", "A100", "A995", "A0", "A1234", "B27", "", " ", "A", "3", "A3x", "Ä3", "A 0 3", "a007"];

describe("the site's motorway rules are the ingest rule", () => {
  it("canonical, natural order and slug agree on every spelling", () => {
    for (const s of SPELLINGS) expect(canonicalMotorway(s), s).toBe(ingestCanonical(s));
    const roads = ["A10", "A1", "A100", "A9", "A2", "A99", "A7"];
    expect([...roads].sort(compareMotorways)).toEqual([...roads].sort(ingestCompare));
    expect([...roads].sort(compareMotorways)).toEqual(["A1", "A2", "A7", "A9", "A10", "A99", "A100"]);
    for (const r of roads) expect(motorwaySlug(r)).toBe(ingestSlug(r));
  });
  it("the paths are the digest's, in every language, and the ask block's address and link are the site's", () => {
    for (const l of LIVE_LANGS) {
      expect(pathFor("motorways", l)).toBe(digestIndexPath(l));
      for (const r of ["A1", "A7", "A100"]) expect(motorwayPath(l, r)).toBe(digestPath(l, r));
      expect(connectPath(l)).toBe(pathFor("connect", l));
    }
    expect(pathFor("motorways", "de")).toBe("/de/autobahn");
    // #892: `autobahn` in every language
    for (const l of LIVE_LANGS) expect(pathFor("motorways", l)).toBe(`/${l}/autobahn`);
    expect(MCP_ENDPOINT_URL).toBe(MCP_ENDPOINT);
  });
});

describe("a motorway address never answers 404", () => {
  it("the canonical address is the page; a spelling is a 301 to it; anything else a 301 to the index", () => {
    expect(motorwayAddress("de", "a7")).toEqual({ kind: "canonical", road: "A7" });
    expect(motorwayAddress("en", "a7")).toEqual({ kind: "canonical", road: "A7" });
    for (const v of ["A7", "a07", "A%207", "bab7", "BAB-7", "autobahn%207"]) expect(motorwayAddress("de", v), v).toEqual({ kind: "redirect", to: "/de/autobahn/a7" });
    expect(motorwayAddress("tr", "A7")).toEqual({ kind: "redirect", to: "/tr/autobahn/a7" });
    for (const g of ["b27", "a0", "a1234", "koeln", "%E0%A4%A", "", "a3x"]) expect(motorwayAddress("en", g), g).toEqual({ kind: "redirect", to: "/en/autobahn" });
    expect(MOTORWAY_SEGMENT).toBe("autobahn");
  });

  /** A digest that answers the motorway routes, records what it was asked and honours If-None-Match. */
  function digest(status: number, asked: { url: string; inm: string | undefined }[] = []): FetchLike {
    return (url, init) => {
      asked.push({ url, inm: init.headers["if-none-match"] });
      const page = url.includes("/internal/motorway/A7");
      const body = url.includes("/list") ? '<ul class="motorway-list"><li><a href="/de/autobahn/a1">A1</a></li><li><a href="/de/autobahn/a7">A7</a></li><li><a href="/de/autobahn/a10">A10</a></li></ul>' : page ? '<section class="motorway" id="motorway"><p>A7</p></section>' : '<section class="motorways" id="motorway-index"><ul class="motorway-index"></ul></section>';
      const etag = '"mw-1-abcdefghijklmnop"';
      const st = status === 200 && init.headers["if-none-match"] === etag ? 304 : status;
      // #892: the digest names the address the asked choice has
      const stretch = /[?&]stretch=([a-z0-9-]+)/.exec(url)?.[1];
      const from = /[?&]from=([a-z0-9-]+)/.exec(url)?.[1];
      const to = /[?&]to=([a-z0-9-]+)/.exec(url)?.[1];
      const dir = /[?&]dir=(pos|neg)/.exec(url)?.[1];
      const known = (x: string | undefined): boolean => x === "nesselwang-to-kempten" || x === "kempten-to-nesselwang";
      const tail = known(stretch) || (from === "nesselwang" && to === "kempten") || from === "12247" ? "/nesselwang-to-kempten" : "";
      const towards = /[?&]towards=towards-wuerzburg/.test(url) || dir === "pos" ? "/towards-wuerzburg" : "";
      const path = page ? `/${/[?&]lang=([a-z]{2})/.exec(url)?.[1] ?? "de"}/autobahn/a7${tail}${towards}` : null;
      return Promise.resolve({ status: st, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : n === "etag" ? etag : n === "motorway-path" ? path : null) }, text: () => Promise.resolve(st === 200 ? body : "") });
    };
  }
  const o = (status: number, asked?: { url: string; inm: string | undefined }[]) => ({ baseUrl: "http://digest:8791", timeoutMs: 500, fetchImpl: digest(status, asked) });
  beforeEach(() => clearMotorwayFragments());

  it("a register motorway is the page; one the register does not hold is a 301 to the index; a silent digest is a 503, never a redirect", async () => {
    const p = await resolveMotorwayPage("de", "a7", undefined, o(200));
    expect(p.kind === "page" && p.road).toBe("A7");
    expect(p.kind === "page" && p.path).toBe("/de/autobahn/a7");
    expect(await resolveMotorwayPage("de", "a7", undefined, o(404))).toEqual({ kind: "redirect", to: "/de/autobahn" });
    expect(await resolveMotorwayPage("en", "a7", undefined, o(500))).toEqual({ kind: "unavailable" });
    expect(await resolveMotorwayIndex("en", o(500))).toEqual({ kind: "unavailable" });
    expect((await resolveMotorwayIndex("en", o(200))).kind).toBe("page");
    expect((await resolveMotorwayIndex("de", o(200))).kind).toBe("page");
  });

  it("#892: a stretch is a path; a backwards or unknown segment is a 301 to the path the digest names; the form is a 303 there, the layers kept", async () => {
    const asked: { url: string; inm: string | undefined }[] = [];
    const page = await resolveMotorwayPage("de", "a7", "nesselwang-to-kempten/towards-wuerzburg", o(200, asked));
    expect(page.kind === "page" && [page.path, page.variant]).toEqual(["/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg", true]);
    expect(asked.at(-1)?.url).toContain("stretch=nesselwang-to-kempten&towards=towards-wuerzburg");
    expect(await resolveMotorwayPage("de", "a7", "kempten-to-nesselwang", o(200))).toEqual({ kind: "redirect", to: "/de/autobahn/a7/nesselwang-to-kempten", status: 301 });
    expect(await resolveMotorwayPage("en", "a7", "nowhere-to-anywhere", o(200))).toEqual({ kind: "redirect", to: "/en/autobahn/a7", status: 301 });
    expect(await resolveMotorwayPage("en", "a7", "a/b/c", o(200))).toEqual({ kind: "redirect", to: "/en/autobahn/a7" });
    const form = new URLSearchParams("from=nesselwang&to=kempten&dir=pos&f=1&layer=events&layer=parking&evil=1");
    expect(await resolveMotorwayPage("de", "a7", undefined, o(200), form)).toEqual({ kind: "redirect", to: "/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg?f=1&layer=events&layer=parking", status: 303 });
    // the whole road from the form (both ends blank): the bare page
    expect(await resolveMotorwayPage("de", "a7", undefined, o(200), new URLSearchParams("from=&to=&dir="))).toEqual({ kind: "redirect", to: "/de/autobahn/a7", status: 303 });
    // a layer choice alone stays on the page, a variant
    const layers = await resolveMotorwayPage("de", "a7", undefined, o(200), new URLSearchParams("f=1&layer=events"));
    expect(layers.kind === "page" && [layers.path, layers.variant]).toEqual(["/de/autobahn/a7", true]);
  });

  it("2.4.6 (prod 2026-10-28, the A8 a 503 after 8 s): a bare page whose fragment misses its deadline or fails is answered from the kept copy, for MOTORWAY_KEPT_SERVE_SECONDS; a choice is not", async () => {
    expect(MOTORWAY_KEPT_SERVE_SECONDS).toBe(1_800);
    const good = await resolveMotorwayPage("de", "a7", undefined, o(200));
    expect(good.kind).toBe("page");
    // the digest never answers inside the deadline: the kept copy is the page, never a 503
    const silent: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const slow = await resolveMotorwayPage("de", "a7", undefined, { baseUrl: "http://digest:8791", timeoutMs: 30, fetchImpl: silent });
    expect(slow).toEqual(good);
    // a 5xx too
    expect(await resolveMotorwayPage("de", "a7", undefined, o(503))).toEqual(good);
    // a language never kept, and a person's choice (never kept, M30), are still unavailable
    expect(await resolveMotorwayPage("en", "a7", undefined, o(503))).toEqual({ kind: "unavailable" });
    expect(await resolveMotorwayPage("de", "a7", undefined, o(503), new URLSearchParams("f=1&layer=events"))).toEqual({ kind: "unavailable" });
    // past the bound, a miss is a miss
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + (MOTORWAY_KEPT_SERVE_SECONDS + 1) * 1000);
      expect(await resolveMotorwayPage("de", "a7", undefined, o(503))).toEqual({ kind: "unavailable" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a fragment is revalidated by its ETag: the second view is a 304 and the kept body (fragment-level caching, #715)", async () => {
    const asked: { url: string; inm: string | undefined }[] = [];
    const a = await resolveMotorwayPage("en", "a7", undefined, o(200, asked));
    const b = await resolveMotorwayPage("en", "a7", undefined, o(200, asked));
    expect(asked.map((x) => x.inm)).toEqual([undefined, '"mw-1-abcdefghijklmnop"']);
    expect(a).toEqual(b);
    expect(b.kind === "page" && b.html).toContain('id="motorway"');
  });

  it("S1 (review of 2.1.15): the kept fragments are bounded by their BYTES; the least recently used goes first, a revalidated one counts as used", async () => {
    expect(MOTORWAY_FRAGMENT_CACHE_BYTES).toBe(16 * 1024 * 1024);
    // an A7-sized Cyrillic fragment: 150 000 characters, a two-byte string
    const big = `<section class="motorway" id="motorway">${"Ж".repeat(150_000)}</section>`;
    const full: string[] = [];
    const etagOf = (url: string): string => `"mw-1-${url.replace(/\W/g, "").slice(-16).padStart(16, "x")}"`;
    const fetchImpl: FetchLike = (url, init) => {
      const st = init.headers["if-none-match"] === etagOf(url) ? 304 : 200;
      if (st === 200) full.push(url);
      return Promise.resolve({ status: st, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : n === "etag" ? etagOf(url) : null) }, text: () => Promise.resolve(st === 200 ? big : "") });
    };
    const opts = { baseUrl: "http://digest:8791", timeoutMs: 500, fetchImpl };
    const url = (k: number): string => `http://digest:8791/internal/motorway/A${String(k)}?lang=uk`;
    const get = (k: number) => getMotorwayFragment(url(k), opts, /id="motorway"/, "</section>");
    for (let k = 1; k <= 80; k++) {
      await get(k);
      if (k > 1) await get(1); // A1 is viewed after every other one: it stays the most recently used
    }
    const kept = motorwayFragmentsKept();
    expect(kept.bytes).toBeLessThanOrEqual(MOTORWAY_FRAGMENT_CACHE_BYTES);
    expect(kept.bytes).toBeGreaterThan(MOTORWAY_FRAGMENT_CACHE_BYTES - 2 * heapBytesOf(big));
    // ~300 KB each: 55 kept of 80 (the URL and the ETag are under 100 bytes), never the 1 000 the count bound allows
    expect(kept.entries).toBe(Math.floor(MOTORWAY_FRAGMENT_CACHE_BYTES / heapBytesOf(big)));
    // A1, revalidated after every other view, was never dropped: one full answer in 80 views of it
    expect(full.filter((u) => u === url(1))).toHaveLength(1);
    // the least recently used (A2) went; A1 is still revalidated by its ETag
    const r2 = await get(2);
    expect(r2.kind === "ok" && r2.revalidated).toBe(false);
    const r1 = await get(1);
    expect(r1.kind === "ok" && r1.revalidated).toBe(true);
  });

  it("S1 (re-review of 2.1.15): a fragment evicted while its 304 is in flight is not re-inserted, so the byte count cannot drift", async () => {
    const body = `<section class="motorway" id="motorway">${"Ж".repeat(1_000)}</section>`;
    const etag = '"mw-1-abcdefghijklmnop"';
    const flight: { during?: () => void } = {};
    const fetchImpl: FetchLike = (_url, init) => {
      const st = init.headers["if-none-match"] === etag ? 304 : 200;
      flight.during?.();
      return Promise.resolve({ status: st, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : n === "etag" ? etag : null) }, text: () => Promise.resolve(st === 200 ? body : "") });
    };
    const opts = { baseUrl: "http://digest:8791", timeoutMs: 500, fetchImpl };
    const url = "http://digest:8791/internal/motorway/A7?lang=uk";
    await getMotorwayFragment(url, opts, /id="motorway"/, "</section>");
    expect(motorwayFragmentsKept().entries).toBe(1);
    // during the revalidation, everything kept is dropped (what an eviction by another request does)
    flight.during = () => clearMotorwayFragments();
    const r = await getMotorwayFragment(url, opts, /id="motorway"/, "</section>");
    expect(r.kind === "ok" && r.revalidated).toBe(true);
    expect(motorwayFragmentsKept()).toEqual({ entries: 0, bytes: 0 });
  });

  it("the sitemap's list is read off the digest's links, natural order kept", async () => {
    expect(await fetchMotorwayList(o(500))).toBeNull();
    expect(await fetchMotorwayList(o(200))).toEqual(["A1", "A7", "A10"]);
    // 2.4.6: a miss after a good read answers the kept list (MOTORWAY_KEPT_SERVE_SECONDS), never an empty sitemap
    expect(await fetchMotorwayList(o(500))).toEqual(["A1", "A7", "A10"]);
  });
});
