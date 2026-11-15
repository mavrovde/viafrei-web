/**
 * #981 C1 (data-steward ruling 2026-10-24): no Tankerkönig ask from a DOCUMENT
 * render. A client sending a browser's user agent, forged `Sec-Fetch-Mode:
 * navigate` / `Sec-Fetch-Dest: document` and a bare google referer walked the
 * place pages and every GET became a `list.php` (491 site discoveries over 419
 * Gemeinde centres in 3.2 days). Here: that request, through every document
 * path (a place page, the home's IP rung), makes ZERO refresh calls — even
 * with a refresh handed to the path, and with `fetch` itself watched — while
 * the page a person gets carries the fuel card deferred (#1065: its frame, no
 * price), whose own fragment `/fragment/place-fuel` — asked by the page's
 * script when the card is in view — asks once and brings the fresh prices.
 * A crawler, a cross-site fragment and `how: "held"` ask nothing. The MCP process and the
 * digest are stubs; nothing here can reach a provider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeRoute } from "../src/lib/fragment-route.js";
import { placeFuelRoute } from "../src/lib/place-fuel.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { HELD, type PostLike } from "../src/lib/fuel-refresh.js";
import { placeFirstRender } from "../src/lib/place-first.js";
import { resolvePlacePage } from "../src/lib/place-page.js";
import type { FetchLike, TileFetchOptions } from "../src/lib/tiles.js";
import { homePlace } from "../src/location/server.js";
import type { GeoIp } from "../src/location/geoip.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** The walk's request, as the ruling read it off the landing log: a browser's headers, forged, and no script ever run. */
const FORGED = { "user-agent": CHROME, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "cross-site", "sec-fetch-user": "?1", referer: "https://www.google.com/", accept: "text/html" };
const headers = (h: Record<string, string>) => new Headers(h);

/** The MCP stub: every refresh it is asked, and the answer `state`. */
function mcp(state = "refreshed") {
  const asked: string[] = [];
  const f: PostLike = (url, init) => {
    asked.push(`${url} ${init.body}`);
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ state, settledAt: 1_760_270_000_000, reused: false }) });
  };
  return { asked, f };
}

/** The digest stub: a place's cards whose fuel line echoes what the shell told it (`fuel=`), or `none`. */
function digest() {
  const asked: string[] = [];
  const f: FetchLike = (url) => {
    if (url.includes("/internal/place/key?slug=")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve('<p class="place-key">ags:05334002</p>') });
    asked.push(url);
    const fuel = /[?&]fuel=([a-z]+)/.exec(url)?.[1] ?? "none";
    // #1065: the fuel card's own fragment (the sentence for a refusal)
    if (url.includes("/internal/place/fuel?"))
      return Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(url.endsWith("&refused=1") ? '<div class="place-fuel"><p class="pcard__note">refused</p></div>' : `<div class="place-fuel"><p class="pcard__fresh pcard__fresh--${fuel}">${fuel}</p></div>`) });
    return Promise.resolve({
      status: 200,
      headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05334002", "place-label": "Alsdorf", "place-point": "0" })[n] ?? null },
      text: () => Promise.resolve(`<section class="place" id="place-cards"><p class="pcard__fresh pcard__fresh--${fuel}">${fuel}</p></section>`),
    });
  };
  return { asked, f };
}

/** The refresh handed to a document path ANYWAY — its options have no such field (#981 C1); a render that used one is caught. */
const withRefresh = (m: ReturnType<typeof mcp>, d: ReturnType<typeof digest>) =>
  ({ baseUrl: "http://digest", timeoutMs: 1_000, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f }) as unknown as TileFetchOptions;

/** Every `fetch` of the process is watched too: `askRefresh` falls back to it when no fetch is injected. */
let globalCalls: string[] = [];
beforeEach(() => {
  globalCalls = [];
  vi.stubGlobal("fetch", (url: string | URL) => {
    globalCalls.push(String(url));
    return Promise.reject(new Error("no network in a test"));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a document render asks nothing (#981 C1)", () => {
  it("the forged walk (Chrome UA, navigate/document, a google referer, no JS) on a place page: zero refresh calls", async () => {
    const m = mcp();
    const d = digest();
    for (const slug of ["alsdorf", "alsdorf", "alsdorf"]) {
      const a = await resolvePlacePage("de", slug, { ...withRefresh(m, d), request: { method: "GET", headers: headers(FORGED), url: `https://viafrei.de/de/place/${slug}` } });
      expect(a.kind).toBe("page");
      // the held prices with their time — the digest was told of no refresh
      expect(a.kind === "page" && a.place.html).toContain("pcard__fresh--none");
    }
    expect(m.asked).toEqual([]);
    expect(d.asked.every((u) => !u.includes("fuel="))).toBe(true);
    expect(globalCalls.filter((u) => u.includes("/internal/fuel/refresh"))).toEqual([]);
  });

  it("the same forged request on the home's IP rung: the guessed place's cards, zero refresh calls", async () => {
    const m = mcp();
    const geo = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;
    const here = await homePlace(headers({ ...FORGED, "x-forwarded-for": "192.0.2.81" }), "de", { ...withRefresh(m, digest()), geoipFile: undefined, geo, method: "GET", url: "https://viafrei.de/de" });
    expect(here.source).toBe("ip");
    expect(m.asked).toEqual([]);
    expect(globalCalls.filter((u) => u.includes("/internal/fuel/refresh"))).toEqual([]);
  });

  it("a first render's result reports no refresh at all — `fuel` is null for a person too", async () => {
    const r = await placeFirstRender("ags:05334002", "de", { ...withRefresh(mcp(), digest()), how: "page", request: { method: "GET", headers: headers(FORGED) } });
    expect(r).toMatchObject({ kind: "place", fuel: null });
  });
});

describe("a person still gets fresh prices, from the fuel card's own fragment (#981 C1, #1065)", () => {
  const PERSON = { "user-agent": CHROME, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  /** What the page's script sends when the fuel card comes into view (`lib/place-fuel.ts` `placeFuelScript`). */
  const view = (h: Record<string, string> = PERSON, query = "place=alsdorf&lang=de"): Request => new Request(`https://viafrei.de/fragment/place-fuel?${query}`, { headers: h });
  beforeEach(() => resetSlugKeys());

  it("the page carries the fuel card deferred and no fill marker; the card's fragment, asked from a person's view, asks ONCE and brings the refreshed card", async () => {
    const m = mcp("refreshed");
    const d0 = digest();
    const page = await resolvePlacePage("de", "alsdorf", { ...withRefresh(m, d0), request: { method: "GET", headers: headers(FORGED), url: "https://viafrei.de/de/place/alsdorf" } });
    expect(m.asked).toEqual([]);
    const html = page.kind === "page" ? page.place.html : "";
    expect(html).not.toContain("data-vf-fill");
    expect(d0.asked.every((u) => u.includes("&fuelRows=0")), d0.asked.join("\n")).toBe(true);
    const d = digest();
    const res = await placeFuelRoute(view(), { baseUrl: "http://digest", timeoutMs: 1_000, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
    expect(res.status).toBe(200);
    expect(m.asked).toEqual(['http://mcp:8788/internal/fuel/refresh {"at":"ags:05334002"}']);
    expect(await res.text()).toContain("pcard__fresh--refreshed");
  });

  it("the home's IP rung: the deferred card and no marker — nothing is asked until the card's fragment is", async () => {
    const m = mcp("refreshed");
    const geo = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;
    const d = digest();
    const here = await homePlace(headers({ ...FORGED, "x-forwarded-for": "192.0.2.81" }), "de", { ...withRefresh(m, d), geoipFile: undefined, geo, method: "GET", url: "https://viafrei.de/de" });
    expect(here.source).toBe("ip");
    expect(here.place?.html ?? "").not.toContain("data-vf-fill");
    expect(d.asked.filter((u) => u.includes("/internal/place/cards")).every((u) => u.includes("&fuelRows=0"))).toBe(true);
    expect(m.asked).toEqual([]);
  });

  it("a bot, a cross-site fetch, a navigation, a script without Fetch Metadata and `held` ask nothing — on the card's fragment and on the island's POST", async () => {
    const m = mcp("refreshed");
    const o = { baseUrl: "http://digest", timeoutMs: 1_000, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: m.f };
    for (const h of [
      { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" },
      { ...PERSON, "sec-fetch-site": "cross-site" },
      { ...FORGED, "sec-fetch-site": "same-origin" },
      { "user-agent": CHROME, "sec-fetch-site": "same-origin" },
    ]) {
      const res = await placeFuelRoute(view(h), o);
      expect(await res.text()).toBe('<div class="place-fuel"><p class="pcard__note">refused</p></div>');
    }
    await placeFuelRoute(view(PERSON, "place=alsdorf&lang=de&held=1"), o);
    // the island's POST is unchanged: refused its ask from the same requests
    const post = (h: Record<string, string>, how: string) => new Request("https://viafrei.de/fragment/place", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ at: "ags:05334002", lang: "de", how }) });
    await placeRoute(post({ "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)", "sec-fetch-site": "same-origin" }, "page"), o);
    await placeRoute(post({ "user-agent": CHROME, "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" }, "page"), o);
    await placeRoute(post({ ...FORGED, "sec-fetch-site": "same-origin" }, "page"), o);
    await placeRoute(post({ "user-agent": CHROME, "sec-fetch-site": "same-origin" }, HELD), o);
    expect(m.asked).toEqual([]);
  });
});
