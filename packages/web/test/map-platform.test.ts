/**
 * #944 in the shell, with the data steward's conditions of 2026-10-23:
 *
 *  - condition 9: the User-Agent is reduced to android | ios | other first thing
 *    in the middleware, only that value reaches the digest (`map=`) and so every
 *    cache key; no Accept-CH header is set anywhere;
 *  - AC 5: a fragment kept for one platform is never served to another — by the
 *    fragment cache (viafrei-infra's: key `$uri|$args`), by the shell's kept
 *    motorway fragments (keyed by URL) or by an ETag (the digest's carries the
 *    platform);
 *  - AC 1/AC 3, conditions 1 and 5: a sweep over EVERY fragment the shell embeds,
 *    from the real digest, in three platforms: each OSM link is followed by
 *    exactly one platform link of the platform's kind with the same digits, the
 *    same rel and no target, and no platform link stands alone;
 *  - condition 6: a click on a map-app link is no analytics event.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAP_PLATFORMS, mapPlatformOfUserAgent, type MapPlatform } from "@viafrei/design";
import { startRealDigest } from "../e2e/real-digest.js";
import { clickEvent, factsOf } from "../src/analytics/listener.js";
import { clearMotorwayFragments, fetchMotorwayIndex, fetchMotorwayPage, fetchMotorwayTop } from "../src/lib/motorway.js";
import { fetchPlaceAnswer } from "../src/lib/place.js";
import { fetchMotorwayAround } from "../src/lib/motorway-around.js";
import { mapQuery, type FetchLike } from "../src/lib/tiles.js";
import { varyWith } from "../src/lib/vary.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const ROOT = new URL("../../../", import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, ROOT), "utf8");

describe("condition 9: the platform, reduced first and alone", () => {
  it("the middleware reduces the User-Agent before anything else and keeps nothing but the platform", () => {
    const src = read("packages/web/src/middleware.ts");
    // #1141: the request's handler, which the exported middleware runs inside the agent-class scope
    // #1235: typed to answer a Response on every path, so the staging wrapper can always set its header
    const body = src.slice(src.indexOf("const handle = async (context: Parameters<Handler>[0], next: Parameters<Handler>[1]): Promise<Response> => {"));
    expect(src).toContain("const handle = async (context: Parameters<Handler>[0], next: Parameters<Handler>[1]): Promise<Response> => {");
    const first = body.split("\n").find((l) => /^\s+[a-z]/.test(l) && !l.trim().startsWith("//"));
    expect(first?.trim()).toBe('context.locals.mapPlatform = mapPlatformOfUserAgent(context.request.headers.get("user-agent"));');
    // the middleware reads the header once, by that line; the fragment fetchers and the log line never read it (no new User-Agent logging)
    const reads = (f: string): number => (read(`packages/web/${f}`).match(/headers\.get\(["']user-agent["']\)/gi) ?? []).length;
    expect(reads("src/middleware.ts")).toBe(1);
    for (const f of ["src/lib/tiles.ts", "src/lib/place.ts", "src/lib/motorway.ts", "src/lib/motorway-around.ts", "src/lib/motorway-fuel.ts", "src/lib/fragment-route.ts", "src/lib/log.ts", "src/lib/fragment-cache.ts"]) expect(reads(f), f).toBe(0);
  });

  it("no Accept-CH anywhere in the shell or its security headers", () => {
    for (const f of ["packages/web/src/middleware.ts", "packages/web/src/security/csp.ts"]) expect(read(f), f).not.toMatch(/["'`](?:accept-ch|critical-ch)["'`]|add_header\s+(?:accept-ch|critical-ch)/i);
  });
  // cross-repo(viafrei-infra): the nginx configuration of the edge and the fragment cache is viafrei-infra's
  it.skip("no Accept-CH anywhere in the nginx configuration", () => {});

  it("only three values reach the digest, and other adds nothing to a URL", () => {
    expect(mapQuery({ mapPlatform: "android" })).toBe("&map=android");
    expect(mapQuery({ mapPlatform: "ios" })).toBe("&map=ios");
    expect(mapQuery({ mapPlatform: "other" })).toBe("");
    expect(mapQuery({})).toBe("");
    expect(mapPlatformOfUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("android");
  });

  it("every HTML answer varies on User-Agent, added once to what the page said", () => {
    expect(varyWith(null, "User-Agent")).toBe("User-Agent");
    expect(varyWith("Accept-Language, X-Forwarded-For", "User-Agent")).toBe("Accept-Language, X-Forwarded-For, User-Agent");
    expect(varyWith("accept-language, user-agent", "User-Agent")).toBe("accept-language, user-agent");
    expect(varyWith("*", "User-Agent")).toBe("*");
  });
});

describe("condition 6: a click on a map-app link is never an event", () => {
  const hrefs = ["https://www.google.com/maps/search/?api=1&query=49.45679%2C11.08111", "https://maps.apple.com/place?coordinate=49.45679,11.08111", "geo:49.45679,11.08111?q=49.45679,11.08111", "https://maps.apple.com/search?query=Hauptstr.%201"];
  for (const href of hrefs)
    it(href.slice(0, 32), () => {
      for (const where of [".hero", ".site-head", ".audience", ".moment", ".start", null])
        for (const tile of [true, false]) {
          const el = { getAttribute: (n: string) => (n === "href" ? href : null), closest: (sel: string) => (sel === where || (tile && sel.includes(".tile")) ? {} : null) };
          for (const lang of LIVE_LANGS) expect(clickEvent(factsOf(el), lang)).toBeNull();
        }
    });
});

describe("AC 5: the fragment cache's key carries the platform", () => {
  // cross-repo(viafrei-infra): the fragment cache's key is viafrei-infra's configuration
  it.skip("fragcache keys on the path and the whole query the shell sent", () => {});
});

let digest: Awaited<ReturnType<typeof startRealDigest>>;
beforeAll(async () => {
  digest = await startRealDigest();
}, 60_000);
afterAll(async () => {
  await digest.close();
});

const OSM_A =
  /<a href="https:\/\/www\.openstreetmap\.org\/(?:\?mlat=(-?[\d.]+)&amp;mlon=(-?[\d.]+)#map=15\/[\d.]+\/[\d.]+|search\?query=([^"]*))" rel="([^"]*)"(?: target="([^"]*)")?>[^<]*<\/a>( · <a href="[^"]*" rel="[^"]*"(?: target="[^"]*")?(?: translate="no")?>[^<]*<\/a>)?/g;
const APP = /^ · <a href="([^"]*)" rel="([^"]*)"(?: target="([^"]*)")?(?: translate="(no)")?>[^<]*<\/a>$/;
const ANY_APP = /<a href="(?:https:\/\/www\.google\.com\/maps|geo:|https:\/\/maps\.apple\.com)/g;

/** What the platform link beside an OSM target must be: the same digits, or the same address. */
function expectedApp(point: { lat: string; lon: string } | null, query: string | null, p: MapPlatform): string {
  if (point === null) return p === "android" ? `geo:0,0?q=${query ?? ""}` : p === "ios" ? `https://maps.apple.com/search?query=${query ?? ""}` : `https://www.google.com/maps/search/?api=1&amp;query=${query ?? ""}`;
  const ll = `${point.lat},${point.lon}`;
  return p === "android" ? `geo:${ll}?q=${ll}` : p === "ios" ? `https://maps.apple.com/place?coordinate=${ll}` : `https://www.google.com/maps/search/?api=1&amp;query=${point.lat}%2C${point.lon}`;
}

/** Every pair in a fragment, judged; the number of pairs. */
function sweep(html: string, p: MapPlatform, where: string): number {
  let n = 0;
  expect(html, where).not.toContain("<!--vf-map");
  for (const m of html.matchAll(OSM_A)) {
    const app = APP.exec(m[6] ?? "");
    expect(app, `${where}: an OSM link without its platform link: ${m[0]}`).not.toBeNull();
    expect(app?.[1], where).toBe(expectedApp(m[1] !== undefined ? { lat: m[1], lon: m[2] ?? "" } : null, m[3] ?? null, p));
    expect(app?.[2], where).toBe(m[4]);
    expect(app?.[2], where).toBe("noopener noreferrer nofollow");
    expect(app?.[3], `${where}: target only where the OSM link has one`).toBe(m[5]);
    // #449: a brand (Google's, Apple's map name) is marked as a name; Android's words are the page's own
    expect(app?.[4], `${where}: translate`).toBe(p === "android" ? undefined : "no");
    n++;
  }
  expect((html.match(ANY_APP) ?? []).length, `${where}: a platform link stands alone`).toBe(n);
  return n;
}

const ROADS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A34", "A57", "A61"];

describe("AC 1, AC 3, conditions 1 and 5: every fragment the shell embeds, in three platforms", () => {
  it("each OSM link has exactly one platform link of the platform's kind, the same point, the same rel", async () => {
    const totals = new Map<MapPlatform, number>();
    for (const p of MAP_PLATFORMS) {
      let n = 0;
      for (const l of ["de", "en", "uk"]) {
        const q = `lang=${l}${mapQuery({ mapPlatform: p })}`;
        const urls = [
          `/internal/motorway/index?${q}`,
          `/internal/motorway/top?${q}`,
          ...ROADS.map((r) => `/internal/motorway/${r}?${q}`),
          ...ROADS.map((r) => `/internal/motorway/${r}/fuel?${q}`),
          ...ROADS.map((r) => `/internal/motorway/${r}/around?${q}&at=ags%3A05315000&r=25`),
          ...["ags%3A05315000", "ags%3A11000000", "ags%3A02000000", "ags%3A09162000", "ags%3A09564000", "pt%3A50.94%2C6.96"].map((at) => `/internal/place/cards?at=${at}&${q}`),
          `/internal/news/traffic?${q}`,
          `/internal/tiles/fuel?${q}&view=board`,
        ];
        for (const u of urls) {
          const res = await fetch(digest.url + u);
          if (res.status !== 200) continue;
          n += sweep(await res.text(), p, `${p} ${u}`);
        }
      }
      totals.set(p, n);
    }
    // the sweep read links at all, and the same number in every platform
    expect(totals.get("other")).toBeGreaterThan(50);
    expect(totals.get("android")).toBe(totals.get("other"));
    expect(totals.get("ios")).toBe(totals.get("other"));
  }, 120_000);
});

describe("AC 5: a fragment kept for one platform never reaches another", () => {
  /** A shared cache in front of the digest keyed exactly as fragcache keys (`$uri|$args`): the URL. */
  function urlKeyedCache(): FetchLike {
    const held = new Map<string, { status: number; headers: Map<string, string>; body: string }>();
    return async (url, init) => {
      let e = held.get(url);
      if (e === undefined) {
        const r = await fetch(url, { headers: init.headers, signal: init.signal });
        e = { status: r.status, headers: new Map([...r.headers]), body: await r.text() };
        if (r.status === 200) held.set(url, e);
      }
      const h = e;
      return { status: h.status, headers: { get: (n: string) => h.headers.get(n.toLowerCase()) ?? null }, text: () => Promise.resolve(h.body) };
    };
  }
  const kinds = (html: string): string => [/google\.com\/maps/.test(html) ? "google" : "", /href="geo:/.test(html) ? "geo" : "", /maps\.apple\.com/.test(html) ? "apple" : ""].filter((x) => x !== "").join(",");
  const want: Record<MapPlatform, string> = { other: "google", android: "geo", ios: "apple" };

  it("motorway pages, the index and the top list through a URL-keyed cache and the shell's kept fragments, in any order", async () => {
    clearMotorwayFragments();
    const cache = urlKeyedCache();
    for (const p of ["android", "other", "ios", "other", "android", "ios"] as const) {
      const o = { baseUrl: digest.url, timeoutMs: 10_000, fetchImpl: cache, mapPlatform: p };
      const page = await fetchMotorwayPage("A7", "de", o);
      expect(page.kind).toBe("ok");
      if (page.kind === "ok") expect(kinds(page.html), `A7 ${p}`).toBe(want[p]);
      const index = await fetchMotorwayIndex("de", o);
      if (index.kind === "ok" && kinds(index.html) !== "") expect(kinds(index.html), `index ${p}`).toBe(want[p]);
      const top = await fetchMotorwayTop("de", o);
      if (top.kind === "ok" && kinds(top.html) !== "") expect(kinds(top.html), `top ${p}`).toBe(want[p]);
    }
  }, 60_000);

  it("the place cards through a URL-keyed cache, in any order", async () => {
    const cache = urlKeyedCache();
    let seen = 0;
    for (const p of ["ios", "other", "android", "other", "ios"] as const) {
      const r = await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: digest.url, timeoutMs: 10_000, fetchImpl: cache, mapPlatform: p });
      expect(r.kind).toBe("place");
      if (r.kind === "place" && kinds(r.place.html) !== "") {
        expect(kinds(r.place.html), p).toBe(want[p]);
        seen++;
      }
    }
    expect(seen, "the fixture's Köln cards carry map links").toBe(5);
  }, 60_000);

  it("the around block asks with the platform too", async () => {
    for (const p of MAP_PLATFORMS) {
      const a = await fetchMotorwayAround("A1", "ags:05315000", "25", "manual", "de", { baseUrl: digest.url, timeoutMs: 10_000, mapPlatform: p });
      if (a !== null && kinds(a.html) !== "") expect(kinds(a.html), p).toBe(want[p]);
    }
  }, 60_000);
});
