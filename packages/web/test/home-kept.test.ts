/**
 * #772: a home live block is never dropped for want of a kept render.
 *
 * After the 2.1.19 deploy `the public smoke` failed in four runs of five, each
 * on one home page one vantage got whole and the other got without the
 * motorway panel, the "Heute" facts or one fact: the block missed the panel
 * deadline, and the shell had nothing of its own to answer with. These pin the
 * shell's own last good answer per block and language — the cold case (a
 * block that does not arrive after one that did), the eviction case (the
 * motorway LRU walked out by the motorway pages), and the bounds that keep a
 * kept copy true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDED_TILES, FACTS, PENDING_TILES, fetchTiles, type FetchLike } from "../src/lib/tiles.js";
import { MOTORWAY_FRAGMENT_CACHE_BYTES, clearMotorwayFragments, fetchMotorwayPage, fetchMotorwayTop, motorwayFragmentsKept } from "../src/lib/motorway.js";
import { MOTORWAY_TOP_KEPT_SECONDS, clearHomeKept, homeKeptCapacity, homeKeptSize } from "../src/lib/home-kept.js";
import { PANEL_DEADLINE_MS } from "../src/lib/fill.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { MOTORWAY_STALE_MAX_SECONDS } from "../../digest/src/server/motorway-service.js";

const CADENCE_S = 60;
const tile = (id: string, state = "ok", n = "1"): string =>
  `<section class="tile is-${state}" id="tile-${id}" aria-labelledby="tile-${id}-title"><header class="tile__head"><h3 class="tile__title" id="tile-${id}-title">x</h3></header><p class="tile__figure"><span class="tile__num num">${n}</span></p></section>`;
const fact = (id: string, state = "ok", n = "1"): string => `<section class="tile tile--fact is-${state}" id="fact-${id}"><p>${n}</p></section>`;
const top = (n: string): string => `<section class="motorway-top" id="motorway-top"><p>${n}</p></section>`;

type Answer = Awaited<ReturnType<FetchLike>>;
const answer = (status: number, body: string, etag: string | null = null): Answer => ({
  status,
  headers: { get: (h: string) => (h === "content-type" ? "text/html; charset=utf-8" : h === "tile-cadence-seconds" ? String(CADENCE_S) : h === "etag" ? etag : null) },
  text: () => Promise.resolve(body),
});
const hang: FetchLike = (_u, init) => new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));

/** A digest that answers every home block with figure `n`. */
const healthy =
  (n: string): FetchLike =>
  (url) => {
    const id = /\/internal\/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? "";
    if (url.includes("/internal/motorway/top")) return Promise.resolve(answer(200, top(n), `"t${n}"`));
    return Promise.resolve(answer(200, url.includes("view=fact") ? fact(id, "ok", n) : tile(id, "ok", n)));
  };
const o = (fetchImpl: FetchLike) => ({ baseUrl: "http://digest:8791", timeoutMs: 2000, fetchImpl, deadlineMs: PANEL_DEADLINE_MS });
const topOptions = (fetchImpl: FetchLike) => ({ baseUrl: "http://digest:8791", timeoutMs: PANEL_DEADLINE_MS, fetchImpl });

beforeEach(() => {
  clearHomeKept();
  clearMotorwayFragments();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the home's tiles, facts and pending slot (#772)", () => {
  it("a block that misses the deadline after one that arrived is the kept one: no placeholder, no fact left out", async () => {
    await fetchTiles("uk", o(healthy("7")));
    const after = await fetchTiles("uk", o(hang));
    for (const id of EMBEDDED_TILES) {
      expect(after[id].fetched, id).toBe("ok");
      expect(after[id].kept, id).toBe(true);
      expect(after[id].html, id).toBe(tile(id, "ok", "7"));
    }
    expect(after.facts.map((f) => f.id)).toEqual(FACTS.map((id) => `fact-${id}`));
    expect(after.pending.transit?.html).toBe(tile("transit", "ok", "7"));
  });

  it("is kept per language: a block seen in German does not answer a Ukrainian home", async () => {
    await fetchTiles("de", o(healthy("7")));
    const uk = await fetchTiles("uk", o(hang));
    expect(uk.facts).toEqual([]);
    expect(uk.lifts.fetched).toBe("deferred");
    expect(uk.pending.transit).toBeNull();
  });

  it("a refused connection and a 5xx are answered from the kept block too; a 404 and a block that is not live are answers and stand", async () => {
    await fetchTiles("de", o(healthy("7")));
    const refused: FetchLike = () => Promise.reject(new Error("ECONNREFUSED"));
    expect((await fetchTiles("de", o(refused))).facts.length).toBe(FACTS.length);
    const failing: FetchLike = () => Promise.resolve(answer(502, "<p>bad gateway</p>"));
    expect((await fetchTiles("de", o(failing))).reports.kept).toBe(true);
    const gate: FetchLike = () => Promise.resolve(answer(404, "<p>no permitted line</p>"));
    const gated = await fetchTiles("de", o(gate));
    expect(gated.facts).toEqual([]);
    expect(gated.reports.kept).toBeUndefined();
    const empty: FetchLike = (url) => {
      const id = /\/internal\/tiles\/([a-z]+)\?/.exec(url)?.[1] ?? "";
      return Promise.resolve(answer(200, url.includes("view=fact") ? fact(id, "empty") : tile(id, "empty")));
    };
    const notLive = await fetchTiles("de", o(empty));
    expect(notLive.facts).toEqual([]);
    expect(notLive.pending.transit).toBeNull();
    // …and an answer that is not live does not replace the kept one either
    expect((await fetchTiles("de", o(hang))).facts.length).toBe(FACTS.length);
  });

  it("a kept block answers for its own cadence and not a second longer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.parse("2026-10-15T19:50:00Z");
    vi.setSystemTime(t0);
    await fetchTiles("ro", o(healthy("7")));
    vi.setSystemTime(t0 + CADENCE_S * 1000 - 1);
    expect((await fetchTiles("ro", o(hang))).facts.length).toBe(FACTS.length);
    vi.setSystemTime(t0 + CADENCE_S * 1000);
    const late = await fetchTiles("ro", o(hang));
    expect(late.facts).toEqual([]);
    expect(late.reports.fetched).toBe("deferred");
  });

  it("holds every home slot in every language and nothing else, so nothing is ever evicted", async () => {
    for (const lang of LIVE_LANGS) {
      await fetchTiles(lang, o(healthy("1")));
      await fetchMotorwayTop(lang, topOptions(healthy("1")));
    }
    expect(homeKeptCapacity()).toBe((EMBEDDED_TILES.length + FACTS.length + PENDING_TILES.length + 1) * LIVE_LANGS.length);
    expect(homeKeptSize()).toBe(homeKeptCapacity());
    // the fragment route's fetches (no deadline) keep nothing of the home's
    clearHomeKept();
    await fetchTiles("de", { baseUrl: "http://digest:8791", timeoutMs: 2000, fetchImpl: healthy("1") });
    expect(homeKeptSize()).toBe(0);
  });
});

describe("the home's motorway panel (#772)", () => {
  it("is kept as long as the digest answers its own held panel", () => {
    expect(MOTORWAY_TOP_KEPT_SECONDS).toBe(MOTORWAY_STALE_MAX_SECONDS);
  });

  it("evicted from the motorway LRU by a walk over the motorway pages, a panel that misses the deadline is still the kept one", async () => {
    expect((await fetchMotorwayTop("uk", topOptions(healthy("3")))).kind).toBe("ok");
    // A crawler walks the motorway pages: each ~150 KB, together more than the LRU holds.
    const big = `<section class="motorway" id="motorway">${"x".repeat(150_000)}</section>`;
    const pages: FetchLike = () => Promise.resolve(answer(200, big, '"p"'));
    for (let n = 1; n <= Math.ceil(MOTORWAY_FRAGMENT_CACHE_BYTES / 150_000) + 1; n += 1) await fetchMotorwayPage(`A${String(n)}`, "de", topOptions(pages));
    expect(motorwayFragmentsKept().bytes).toBeLessThanOrEqual(MOTORWAY_FRAGMENT_CACHE_BYTES);
    const r = await fetchMotorwayTop("uk", topOptions(hang));
    expect(r).toEqual({ kind: "ok", html: top("3"), revalidated: false });
  });

  it("past its bound, or in a language never seen, a panel that misses the deadline is left out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.parse("2026-10-15T19:50:00Z");
    vi.setSystemTime(t0);
    await fetchMotorwayTop("tr", topOptions(healthy("3")));
    expect((await fetchMotorwayTop("bg", topOptions(hang))).kind).toBe("failed");
    vi.setSystemTime(t0 + MOTORWAY_TOP_KEPT_SECONDS * 1000 - 1);
    expect((await fetchMotorwayTop("tr", topOptions(hang))).kind).toBe("ok");
    vi.setSystemTime(t0 + MOTORWAY_TOP_KEPT_SECONDS * 1000);
    expect((await fetchMotorwayTop("tr", topOptions(hang))).kind).toBe("failed");
  });

  it("a 404 is an answer: the kept panel does not stand in for a digest that holds no motorways", async () => {
    await fetchMotorwayTop("en", topOptions(healthy("3")));
    const r = await fetchMotorwayTop("en", topOptions(() => Promise.resolve(answer(404, ""))));
    expect(r.kind).toBe("missing");
  });
});

describe("#944 review: the kept motorway panel is the same for every platform", () => {
  it("the home's motorway panel is asked without map= (it carries no map link), so a kept Android render is one a desktop may get", async () => {
    const urls: string[] = [];
    const seen: FetchLike = (url, init) => {
      urls.push(url);
      return healthy("4")(url, init);
    };
    for (const mapPlatform of ["android", "ios", "other"] as const) await fetchMotorwayTop("de", { ...topOptions(seen), mapPlatform });
    expect(urls.filter((u) => u.includes("/internal/motorway/top"))).toEqual(Array(3).fill("http://digest:8791/internal/motorway/top?lang=de"));
    // and an Android render kept there answers the desktop's miss with the same bytes a desktop would have got
    const desktop = await fetchMotorwayTop("de", { ...topOptions(hang), mapPlatform: "other" });
    expect(desktop).toMatchObject({ kind: "ok", html: top("4") });
  });
});
