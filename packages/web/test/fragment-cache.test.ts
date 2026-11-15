/**
 * #936 D: the shell's road to the fragment cache and back. Unset (the
 * default), every request goes to the digest exactly as before; set, the place
 * cards and the motorway pages ask `fragcache` first, and a cache that is away
 * — a REFUSED CONNECTION here, a real socket nobody listens on — is today's
 * path inside the same deadline, never an error. Nothing else is routed there.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { readEnv } from "../src/lib/env.js";
import { readFileSync } from "node:fs";
import { FRAGMENT_CACHE_PATHS, cacheOutcomeCounts, cacheServes, countCacheOutcome, resetConfiguredFragmentUrl, viaFragmentCache } from "../src/lib/fragment-cache.js";
import { fetchStationTop } from "../src/lib/station-top.js";
import { clearStationFragments, fetchStationLive, fetchStationPage } from "../src/lib/station.js";
import { setLogSink } from "../src/lib/log.js";
import { fetchMotorwayIndex, fetchMotorwayList, fetchMotorwayPage } from "../src/lib/motorway.js";
import { fetchPlaceAnswer, fetchSuggest } from "../src/lib/place.js";
import type { FetchLike } from "../src/lib/tiles.js";

const CARDS = '<section class="place" id="place-cards"><h2>Köln</h2></section>';
const HEADERS: Record<string, string> = { "content-type": "text/html; charset=utf-8", "place-key": "ags:05315000", "place-label": encodeURIComponent("Köln"), "place-point": "0" };

let servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))));
  servers = [];
  cacheOutcomeCounts(true);
});

/** A real HTTP server answering every request with `status`/`body`/`headers`; the paths it saw land in `seen`. */
async function server(seen: string[], status = 200, body = CARDS, headers: Record<string, string> = HEADERS): Promise<string> {
  const s = createServer((req, res) => {
    seen.push(req.url ?? "");
    res.writeHead(status, headers);
    res.end(body);
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

/** An origin on which nothing listens: a server started and closed, so the port refuses. */
async function refused(): Promise<string> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  const port = (s.address() as AddressInfo).port;
  await new Promise<void>((r) => s.close(() => r()));
  return `http://127.0.0.1:${port}`;
}

describe("DIGEST_FRAGMENT_URL (env.ts)", () => {
  it("is absent by default and when it names the digest itself; must be an origin", () => {
    expect(readEnv({}).fragmentUrl).toBeUndefined();
    expect(readEnv({ DIGEST_URL: "http://digest:8791", DIGEST_FRAGMENT_URL: "http://digest:8791" }).fragmentUrl).toBeUndefined();
    expect(readEnv({ DIGEST_URL: "http://digest:8791", DIGEST_FRAGMENT_URL: " http://fragcache:8793 " }).fragmentUrl).toBe("http://fragcache:8793");
    expect(() => readEnv({ DIGEST_FRAGMENT_URL: "http://fragcache:8793/internal" })).toThrow(/DIGEST_FRAGMENT_URL must be an origin/);
  });
});

describe("the place cards through the fragment cache", () => {
  it("unset: asks the digest, as before 2.3.18", async () => {
    const digest: string[] = [];
    const base = await server(digest);
    const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: base, timeoutMs: 2000 });
    expect(r.kind).toBe("place");
    expect(digest).toEqual(["/internal/place/cards?at=ags%3A05315000&lang=de"]);
  });

  it("set: asks the cache, not the digest, and counts its X-Cache", async () => {
    const digest: string[] = [];
    const cache: string[] = [];
    const base = await server(digest);
    const frag = await server(cache, 200, CARDS, { ...HEADERS, "x-cache": "HIT" });
    const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: base, fragmentUrl: frag, timeoutMs: 2000 });
    expect(r.kind).toBe("place");
    expect(cache).toEqual(["/internal/place/cards?at=ags%3A05315000&lang=de"]);
    expect(digest).toEqual([]);
    expect(cacheOutcomeCounts().get("HIT")).toBe(1);
  });

  it("the process's own DIGEST_FRAGMENT_URL applies to its own DIGEST_URL, with nothing passed by the pages", async () => {
    const digest: string[] = [];
    const cache: string[] = [];
    const base = await server(digest);
    const frag = await server(cache, 200, CARDS, { ...HEADERS, "x-cache": "MISS" });
    const saved = { d: process.env["DIGEST_URL"], f: process.env["DIGEST_FRAGMENT_URL"] };
    try {
      process.env["DIGEST_URL"] = base;
      process.env["DIGEST_FRAGMENT_URL"] = frag;
      resetConfiguredFragmentUrl();
      expect((await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: base, timeoutMs: 2000 })).kind).toBe("place");
      expect([cache.length, digest.length]).toEqual([1, 0]);
      // another digest origin is never routed to this process's cache
      const other = await server(digest);
      await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: other, timeoutMs: 2000 });
      expect([cache.length, digest.length]).toEqual([1, 1]);
    } finally {
      for (const [k, v] of [["DIGEST_URL", saved.d], ["DIGEST_FRAGMENT_URL", saved.f]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      resetConfiguredFragmentUrl();
    }
  });

  it("a cache that refuses the connection: the digest answers inside the same deadline", async () => {
    const digest: string[] = [];
    const base = await server(digest);
    const t0 = Date.now();
    const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: base, fragmentUrl: await refused(), timeoutMs: 2000 });
    expect(r.kind).toBe("place");
    expect(digest).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(cacheOutcomeCounts().get("fallback")).toBe(1);
  });

  it("a cache that could not reach the digest (502, 504) is asked again of the digest; any other answer is the answer", async () => {
    for (const status of [502, 504]) {
      const digest: string[] = [];
      const base = await server(digest);
      const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: base, fragmentUrl: await server([], status, "<p>bad gateway</p>"), timeoutMs: 2000 });
      expect(r.kind, String(status)).toBe("place");
      expect(digest, String(status)).toHaveLength(1);
    }
    const digest: string[] = [];
    const base = await server(digest);
    const r = await fetchPlaceAnswer("ags:09999999", "de", { baseUrl: base, fragmentUrl: await server([], 404, "<p>no such place in Germany</p>"), timeoutMs: 2000 });
    expect(r.kind).toBe("missing");
    expect(digest).toEqual([]);
  });

  it("a cache that misses the deadline is not retried: the deadline is spent", async () => {
    let calls = 0;
    const slow: FetchLike = (url, init) => {
      calls++;
      return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error(`aborted ${url}`), { name: "AbortError" }))));
    };
    const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: "http://digest:8791", fragmentUrl: "http://fragcache:8793", timeoutMs: 100, fetchImpl: slow });
    expect(r.kind).toBe("failed");
    expect(calls).toBe(1);
  });

  it("a fuel refresh's read goes to the cache too, which bypasses its store by the fuel arguments", async () => {
    const cache: string[] = [];
    const frag = await server(cache, 200, CARDS, { ...HEADERS, "x-cache": "BYPASS" });
    await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: await server([]), fragmentUrl: frag, timeoutMs: 2000, fuel: { state: "refreshed", at: 1760256000000 } });
    expect(cache[0]).toMatch(/[?&]fuel=refreshed/);
  });
});

describe("what goes through the cache, and what never does", () => {
  it("the motorway page and index do; the motorway list and the place suggestions do not", async () => {
    const digest: string[] = [];
    const cache: string[] = [];
    const base = await server(digest, 200, '<section class="motorway" id="motorway"></section>');
    const frag = await server(cache, 200, '<section class="motorway" id="motorway"></section>', { "content-type": "text/html; charset=utf-8", "x-cache": "MISS" });
    const o = { baseUrl: base, fragmentUrl: frag, timeoutMs: 2000 };
    await fetchMotorwayPage("A7", "de", o);
    await fetchMotorwayIndex("de", o);
    await fetchMotorwayList(o);
    await fetchSuggest("Köln", "de", o);
    expect(cache.map((u) => u.split("?")[0])).toEqual(["/internal/motorway/A7", "/internal/motorway/index"]);
    expect(digest.map((u) => u.split("?")[0])).toEqual(["/internal/motorway/list", "/internal/place/suggest"]);
  });

  it("viaFragmentCache leaves a URL that is not the digest's alone", async () => {
    const seen: string[] = [];
    const f = viaFragmentCache({ baseUrl: "http://digest:8791", fragmentUrl: "http://fragcache:8793", timeoutMs: 100, fetchImpl: (u) => (seen.push(u), Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve("") })) });
    await f("http://mcp:8788/internal/fuel", { signal: new AbortController().signal, headers: {} });
    await f("http://digest:8791/internal/place/cards?at=ags%3A05315000&lang=de", { signal: new AbortController().signal, headers: {} });
    expect(seen).toEqual(["http://mcp:8788/internal/fuel", "http://fragcache:8793/internal/place/cards?at=ags%3A05315000&lang=de"]);
  });
});

describe("2.4.6: a path the cache does not serve is asked of the digest (the home's station block)", () => {
  // cross-repo(viafrei-infra): the fragment cache's nginx configuration is viafrei-infra's
  it.skip("the shell's list of cached paths is the cache's own locations (the fragment cache configuration)", () => {
    const conf = readFileSync(new URL("the fragment cache configuration", import.meta.url), "utf8");
    const served = conf
      .split("\n")
      .filter((l) => /^\s*location\s/u.test(l) && l.includes("the fragment cache configuration"))
      .map((l) => {
        const m = /^\s*location\s+(=|~)\s+"?([^"\s]+)"?\s*\{/u.exec(l)!;
        return m[1] === "=" ? (p: string) => p === m[2] : (p: string) => new RegExp(m[2]!).test(p);
      });
    expect(served).toHaveLength(FRAGMENT_CACHE_PATHS.length);
    const corpus = ["/internal/place/cards", "/internal/place/cardsx", "/internal/motorway/A7", "/internal/motorway/A0", "/internal/motorway/index", "/internal/motorway/top", "/internal/motorway/list", "/internal/motorway/A1/more/roads", "/internal/motorway/A1/fuel", "/internal/place/koeln/roads", "/internal/place/suggest", "/internal/place/koeln/card/roads", "/internal/station/top", "/internal/station/list", "/internal/station/index", "/internal/station/aachen-hbf", "/internal/station/aachen-hbf/live", "/internal/station/aachen-hbf/card/board", "/internal/station/aachen-hbf/area", "/internal/station/topx", "/internal/station/Aachen", "/internal/tiles/roads", "/healthz"];
    for (const p of corpus) expect(cacheServes(p), p).toBe(served.some((f) => f(p)));
  });

  it("cacheServes: the place cards, the motorway pages and (#1042) a station's page and live part yes; the station block, the lists, a card alone and the suggestions no", () => {
    for (const p of ["/internal/place/cards?at=x", "/internal/motorway/A7", "/internal/motorway/top", "/internal/motorway/A1/more/roads", "/internal/place/koeln/roads", "/internal/station/aachen-hbf?lang=de", "/internal/station/aachen-hbf/live?lang=de", "/internal/station/index?lang=de"]) expect(cacheServes(p), p).toBe(true);
    for (const p of ["/internal/station/top?lang=de", "/internal/station/list", "/internal/station/aachen-hbf/card/board?lang=de", "/internal/station/aachen-hbf/area?lang=de", "/internal/motorway/list", "/internal/place/suggest", "/internal/tiles/roads"]) expect(cacheServes(p), p).toBe(false);
  });

  it("the home's station block, with a cache configured, is asked of the digest and arrives (a cache's 404 never answers for it)", async () => {
    const digest: string[] = [];
    const cache: string[] = [];
    const block = '<section class="station-top" id="station-top" aria-labelledby="station-top-t"><h2 class="station-top__h" id="station-top-t">x</h2></section>';
    const base = await server(digest, 200, block, { "content-type": "text/html; charset=utf-8" });
    const fc = await server(cache, 404, "not found", { "content-type": "text/plain" });
    const r = await fetchStationTop("de", { baseUrl: base, fragmentUrl: fc, timeoutMs: 500 });
    expect(r.kind).toBe("ok");
    expect(cache).toEqual([]);
    expect(digest.map((u) => u.split("?")[0])).toEqual(["/internal/station/top"]);
  });

  it("viaFragmentCache sends an unserved digest path straight to the digest", async () => {
    const seen: string[] = [];
    const f = viaFragmentCache({ baseUrl: "http://digest:8791", fragmentUrl: "http://fragcache:8793", timeoutMs: 100, fetchImpl: (u) => (seen.push(u), Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve("") })) });
    await f("http://digest:8791/internal/station/top?lang=de", { signal: new AbortController().signal, headers: {} });
    expect(seen).toEqual(["http://digest:8791/internal/station/top?lang=de"]);
  });
});

describe("#1042 caching: a station's page and live part are asked of the fragment cache", () => {
  const PAGE = '<section class="stpage" id="station"><h1>Köln Hbf</h1></section>';
  const LIVE = '<section class="stlive" id="station-live"><p>x</p></section>';
  const html = { "content-type": "text/html; charset=utf-8", etag: '"st-abc"' };

  it("the page and the live part go to the cache, never to the digest, while the cache answers", async () => {
    clearStationFragments();
    const digest: string[] = [];
    const cache: string[] = [];
    const base = await server(digest, 500, "", { "content-type": "text/plain" });
    const s = createServer((req, res) => {
      cache.push(req.url ?? "");
      res.writeHead(200, html);
      res.end((req.url ?? "").includes("/live") ? LIVE : PAGE);
    });
    servers.push(s);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
    const fc = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    expect((await fetchStationPage("koeln-hbf", "de", { baseUrl: base, fragmentUrl: fc, timeoutMs: 500 })).kind).toBe("ok");
    expect((await fetchStationLive("koeln-hbf", "de", { baseUrl: base, fragmentUrl: fc, timeoutMs: 500 })).kind).toBe("ok");
    expect(cache.map((u) => u.split("?")[0])).toEqual(["/internal/station/koeln-hbf", "/internal/station/koeln-hbf/live"]);
    expect(digest).toEqual([]);
  });

  it("an old slug's 301 through the cache is the page's answer, never followed", async () => {
    clearStationFragments();
    const cache: string[] = [];
    const fc = await server(cache, 301, "", { location: "/internal/station/koeln-hbf?lang=de", "station-moved": "koeln-hbf" });
    const r = await fetchStationPage("koeln-alt", "de", { baseUrl: "http://127.0.0.1:9", fragmentUrl: fc, timeoutMs: 500 });
    expect(r).toEqual({ kind: "moved", to: "koeln-hbf" });
    expect(cache).toHaveLength(1);
  });

  it("a cache that is away is the digest, inside the same deadline", async () => {
    clearStationFragments();
    const digest: string[] = [];
    const base = await server(digest, 200, PAGE, html);
    const r = await fetchStationPage("koeln-hbf", "de", { baseUrl: base, fragmentUrl: "http://127.0.0.1:9", timeoutMs: 500 });
    expect(r.kind).toBe("ok");
    expect(digest.map((u) => u.split("?")[0])).toEqual(["/internal/station/koeln-hbf"]);
  });
});

describe("the X-Cache counts are written as counts, every five minutes, never a key", () => {
  it("one line per outcome with its number", () => {
    const lines: string[] = [];
    const restore = setLogSink((l) => lines.push(l));
    try {
      cacheOutcomeCounts(true);
      let t = Date.now();
      countCacheOutcome("HIT", () => t);
      countCacheOutcome("HIT", () => t);
      countCacheOutcome("bogus", () => t);
      expect(lines).toEqual([]);
      t += 300_000;
      countCacheOutcome("STALE", () => t);
      const parsed = lines.map((l) => JSON.parse(l) as { kind: string; key: string; count: number; level: number });
      expect(parsed.map((p) => [p.kind, p.key, p.count, p.level])).toEqual([
        ["fragment_cache", "HIT", 2, 30],
        ["fragment_cache", "other", 1, 30],
        ["fragment_cache", "STALE", 1, 30],
      ]);
    } finally {
      restore();
    }
  });
});
