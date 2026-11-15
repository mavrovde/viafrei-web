/**
 * The fuel card's on-demand refresh from the shell's side (#564, owner
 * 2026-10-12): WHO triggers it — a person on any known position, never a
 * crawler, a prefetch or a HEAD — and what the page does when it does not
 * come back in time. The MCP process is a stub here (it holds the key and
 * the guards, `packages/mcp/src/server/internal.test.ts`): no provider is
 * reachable from this package at all, and no test here makes a live call.
 */
import { describe, expect, it } from "vitest";
import { placeRoute } from "../src/lib/fragment-route.js";
import { askRefresh, AUTO_RELOAD_URL, FUEL_FILL_HEAD_MAX_MS, FUEL_FILL_MARGIN_MS, FUEL_FILL_MAX_MS, FUEL_FILL_MIN_MS, FUEL_FILL_POLLS_SEEN, FUEL_FILL_RETRY_MS, fillOf, fragmentAsks, fuelQuery, HELD, HOWS, isAutoReload, personAsks, type PostLike } from "../src/lib/fuel-refresh.js";
import { HOME_REFRESH_CONTENT, HOME_REFRESH_S } from "../src/site/pages.js";
import { placeFirstRender } from "../src/lib/place-first.js";
import { resolvePlacePage } from "../src/lib/place-page.js";
import { homePlace } from "../src/location/server.js";
import type { FetchLike, TileFetchOptions } from "../src/lib/tiles.js";

type TileOpts = TileFetchOptions;
import type { GeoIp } from "../src/location/geoip.js";

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const headers = (h: Record<string, string>): { get(n: string): string | null } => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
/** A person's top-level navigation, as a browser announces it (Fetch Metadata). */
const NAV = { "user-agent": BROWSER, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none", "sec-fetch-user": "?1" };
/** The island's or the filler's fetch from this origin's page. */
const FETCH = { "user-agent": BROWSER, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "sec-fetch-site": "same-origin" };
const CURL = { "user-agent": "curl/8.7.1", accept: "*/*" };
const req = (method: string, h: Record<string, string> = NAV, url?: string) => ({ method, headers: headers(h), ...(url === undefined ? {} : { url }) });

/** The MCP stub: records every area it is asked about and answers `state` (after `delayMs`). */
function mcp(state: string, o: { delayMs?: number; settledAt?: number; queue?: unknown } = {}) {
  const asked: string[] = [];
  const f: PostLike = (url, init) => {
    asked.push(`${url} ${init.body}`);
    return new Promise((resolve, reject) => {
      const answer = { state, settledAt: o.settledAt ?? null, reused: false, ...(o.queue === undefined ? {} : { queue: o.queue }) };
      const t = setTimeout(() => resolve({ status: 200, json: () => Promise.resolve(answer) }), o.delayMs ?? 0);
      init.signal.addEventListener("abort", () => {
        clearTimeout(t);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  };
  return { asked, f };
}

/** The digest stub: records the card URLs and answers a place section (the fuel words echo the `fuel` parameter). */
function digest(o: { delayMs?: number } = {}) {
  const asked: string[] = [];
  const f: FetchLike = (url, init) => {
    // #892: a place page's slug is resolved to its key first (`/internal/place/key`), the key route answering at once
    if (url.includes("/internal/place/key?slug=")) return Promise.resolve({ status: 200, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve('<p class="place-key">ags:05334002</p>') });
    asked.push(url);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        const fuel = /[?&]fuel=([a-z]+)/.exec(url)?.[1] ?? "none";
        resolve({
          status: 200,
          headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05334002", "place-label": "Alsdorf", "place-point": "0" })[n] ?? null },
          text: () => Promise.resolve(`<section class="place" id="place-cards"><p class="pcard__fresh pcard__fresh--${fuel}">${fuel}</p></section>`),
        });
      }, o.delayMs ?? 0);
      init.signal.addEventListener("abort", () => {
        clearTimeout(t);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  };
  return { asked, f };
}

describe("the trigger: a person on a known position, and nothing else", () => {
  it("every way the island obtained a place is a person's action; a missing or unknown `how` is not", () => {
    for (const how of ["manual", "browser", "saved", "auto", "page", "ip", "fill"]) expect(fragmentAsks(req("POST", FETCH), how), how).toBe(true);
    // #712: the one-shot `retry` is gone — the queue replaced it
    expect([...HOWS].sort()).toEqual(["auto", "browser", "fill", "ip", "manual", "page", "saved"]);
    for (const how of [undefined, null, "", "crawl", 1, "MANUAL", HELD, "retry"]) expect(fragmentAsks(req("POST", FETCH), how), String(how)).toBe(false);
  });

  it("the IP guess of a first render is a person's action (owner 2026-10-12) — when the browser says it is a top-level navigation", () => {
    expect(personAsks(req("GET"), "document")).toBe(true);
    expect(personAsks(req("GET", NAV, "http://shell/de"), "document")).toBe(true);
  });

  it("never a crawler, a request without a user agent, a prefetch or prerender, or a HEAD", () => {
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "Mozilla/5.0 HeadlessChrome/120", "Chrome-Lighthouse", "Applebot/0.1", ""]) {
      expect(personAsks(req("GET", { ...NAV, "user-agent": ua }), "document"), ua).toBe(false);
    }
    expect(personAsks(req("GET", { ...NAV, "sec-purpose": "prefetch" }), "document")).toBe(false);
    expect(personAsks(req("GET", { ...NAV, "sec-purpose": "prefetch;prerender" }), "document")).toBe(false);
    expect(personAsks(req("GET", { ...NAV, purpose: "prefetch" }), "document")).toBe(false);
    expect(personAsks(req("GET", { ...NAV, "x-moz": "prefetch" }), "document")).toBe(false);
    expect(personAsks(req("HEAD"), "document")).toBe(false);
    expect(personAsks(req("OPTIONS"), "document")).toBe(false);
  });

  // Review of #564 (blocker 1): "Regelmäßige, nicht explizit vom User initiierte Requests sind zu vermeiden".
  it("curl/8 asks nothing — our smoke test, prod round and any uptime check render the home without a Tankerkönig request", () => {
    expect(personAsks(req("GET", CURL), "document")).toBe(false);
    expect(personAsks(req("GET", { "user-agent": "python-requests/2.32" }), "document")).toBe(false);
    expect(personAsks(req("GET", { "user-agent": "Uptime-Kuma/1.23" }), "document")).toBe(false);
    // a browser UA alone is not enough: the Fetch Metadata a navigation carries is
    expect(personAsks(req("GET", { "user-agent": BROWSER }), "document")).toBe(false);
    // and a fragment POST from a script, not from this origin's page
    expect(fragmentAsks(req("POST", CURL), "manual")).toBe(false);
    expect(fragmentAsks(req("POST", { "user-agent": BROWSER }), "manual")).toBe(false);
  });

  it("only a top-level DOCUMENT navigation renders a refresh: an iframe, a fetch or a no-cors load does not", () => {
    expect(personAsks(req("GET", { ...NAV, "sec-fetch-dest": "iframe" }), "document")).toBe(false);
    expect(personAsks(req("GET", { ...NAV, "sec-fetch-mode": "cors" }), "document")).toBe(false);
    expect(personAsks(req("GET", { ...NAV, "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" }), "document")).toBe(false);
  });

  it("a fragment request asks only from THIS origin's page: same-site, cross-site and none are refused", () => {
    for (const site of ["same-site", "cross-site", "none"]) expect(fragmentAsks(req("POST", { ...FETCH, "sec-fetch-site": site }), "manual"), site).toBe(false);
  });

  it("the meta refresh's reload asks nothing: it goes to a MARKED address, and a marked render is not a person's action", () => {
    expect(HOME_REFRESH_CONTENT).toBe(`${String(HOME_REFRESH_S)};url=${AUTO_RELOAD_URL}`);
    expect(isAutoReload(new URL(AUTO_RELOAD_URL, "http://shell/de").href)).toBe(true);
    expect(personAsks(req("GET", NAV, "http://shell/de?r=auto"), "document")).toBe(false);
    expect(personAsks(req("GET", NAV, "http://shell/de?x=1&r=auto"), "document")).toBe(false);
    // only that mark
    expect(personAsks(req("GET", NAV, "http://shell/de?r=autox"), "document")).toBe(true);
    expect(personAsks(req("GET", NAV, "http://shell/de?q=r%3Dauto"), "document")).toBe(true);
  });
});

describe("askRefresh — the answer of our own MCP process, never a provider", () => {
  it("sends the area key and nothing else, to the internal route", async () => {
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    expect(await askRefresh("pt:50.875,6.1725", { url: "http://mcp:8788", timeoutMs: 500, fetchImpl: m.f })).toEqual({ state: "refreshed", at: 1_760_270_000_000 });
    expect(m.asked).toEqual(['http://mcp:8788/internal/fuel/refresh {"at":"pt:50.875,6.1725"}']);
  });

  it("maps every state honestly: refused and failed are 'unavailable', fresh enough says nothing, a slow one is 'pending'", async () => {
    const ask = (s: string, delayMs = 0) => askRefresh("ags:05334002", { url: "http://mcp:8788", timeoutMs: 50, fetchImpl: mcp(s, { delayMs }).f });
    expect(await ask("refused")).toEqual({ state: "unavailable", at: null });
    expect(await ask("failed")).toEqual({ state: "unavailable", at: null });
    expect(await ask("none_due")).toBeNull();
    expect(await ask("pending")).toEqual({ state: "pending", at: null });
    expect(await ask("refreshed", 500)).toEqual({ state: "pending", at: null });
    expect(await ask("something-else")).toBeNull();
    // #712, no lost requests: our own process erroring or unreachable (a restart) is not the provider's verdict — still pending
    const down = (status: number | "throw") => askRefresh("ags:05334002", { url: "http://mcp:8788", timeoutMs: 50, fetchImpl: () => (status === "throw" ? Promise.reject(new Error("ECONNREFUSED")) : Promise.resolve({ status, json: () => Promise.resolve({}) })) });
    expect(await down(503)).toEqual({ state: "pending", at: null, retry: true });
    expect(await down(500)).toEqual({ state: "pending", at: null, retry: true });
    expect(await down("throw")).toEqual({ state: "pending", at: null, retry: true });
    expect(await down(400)).toBeNull();
  });

  it("no refresh configured (a laptop) asks nothing at all", async () => {
    const m = mcp("refreshed");
    expect(await askRefresh("ags:05334002", { url: undefined, timeoutMs: 50, fetchImpl: m.f })).toBeNull();
    expect(m.asked).toEqual([]);
  });

  it("puts the note in the digest's query: words, and the instant only after a stored refresh", () => {
    expect(fuelQuery(null)).toBe("");
    expect(fuelQuery({ state: "refreshed", at: 1_760_270_000_000 })).toBe("&fuel=refreshed&fuelAt=1760270000000");
    expect(fuelQuery({ state: "pending", at: null })).toBe("&fuel=pending");
    // #712: a queued request's place and ETA (seconds, rounded up) ride beside it
    expect(fuelQuery({ state: "pending", at: null, queue: { position: 3, etaMs: 119_001 } })).toBe("&fuel=pending&fuelPos=3&fuelEta=120");
    expect(fuelQuery({ state: "unavailable", at: null })).toBe("&fuel=unavailable");
  });
});

describe("POST /fragment/place with `how`", () => {
  const post = (body: unknown, ua = BROWSER): Request =>
    new Request("http://shell/fragment/place", { method: "POST", headers: { ...FETCH, "content-type": "application/json", "user-agent": ua }, body: JSON.stringify(body) });

  it("a chosen place asks for its prices and the card says what happened", async () => {
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    const d = digest();
    const res = await placeRoute(post({ at: "ags:05334002", lang: "de", how: "manual" }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
    expect(res.status).toBe(200);
    expect(m.asked).toHaveLength(1);
    expect(d.asked).toEqual(["http://digest/internal/place/cards?at=ags%3A05334002&lang=de&fuel=refreshed&fuelAt=1760270000000"]);
  });

  it("without `how`, or from a crawler: the cards from held prices, and the MCP process is not asked", async () => {
    for (const [body, ua] of [[{ at: "ags:05334002", lang: "de" }, BROWSER], [{ at: "ags:05334002", lang: "de", how: "manual" }, "Googlebot/2.1"]] as const) {
      const m = mcp("refreshed");
      const d = digest();
      expect((await placeRoute(post(body, ua), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f })).status).toBe(200);
      expect(m.asked).toEqual([]);
      expect(d.asked[0]).not.toContain("fuel=");
    }
  });

  it("`held` (the island on an automatically reloaded page) and a request with no Fetch Metadata ask nothing", async () => {
    const m = mcp("refreshed");
    const d = digest();
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f };
    expect((await placeRoute(post({ at: "ags:05334002", lang: "de", how: HELD }), o)).status).toBe(200);
    const curl = new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json", "user-agent": "curl/8.7.1" }, body: JSON.stringify({ at: "ags:05334002", lang: "de", how: "manual" }) });
    expect((await placeRoute(curl, o)).status).toBe(200);
    expect(m.asked).toEqual([]);
  });

  it("a point answered as its Gemeinde (`snap`) is refreshed around that Gemeinde: the MCP process is told", async () => {
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    await placeRoute(post({ at: "pt:50.875,6.1725", lang: "de", how: "fill", snap: true }), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
    expect(m.asked).toEqual(['http://mcp:8788/internal/fuel/refresh {"at":"pt:50.875,6.1725","snap":true}']);
  });

  it("prices still on their way: the cards arrive wrapped for the page's filler — and a fill still pending is wrapped AGAIN (#712), however many came before: never 'unavailable' by count", async () => {
    const o = { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: mcp("pending").f };
    const first = await (await placeRoute(post({ at: "ags:05334002", lang: "de", how: "browser" }), o)).text();
    expect(first).toMatch(/^<div class="place-fill" data-vf-fill="\/fragment\/place" data-vf-body="[^"]*&quot;how&quot;:&quot;fill&quot;[^"]*&quot;polls&quot;:1[^"]*" data-vf-shape="place"/);
    const fill = await (await placeRoute(post({ at: "ags:05334002", lang: "de", how: "fill", polls: 1 }), o)).text();
    expect(fill).toMatch(/^<div class="place-fill"[^>]*&quot;polls&quot;:2/);
    for (const polls of [30, 31, 500, FUEL_FILL_POLLS_SEEN]) {
      const later = await (await placeRoute(post({ at: "ags:05334002", lang: "de", how: "fill", polls }), o)).text();
      expect(later, String(polls)).toMatch(/^<div class="place-fill"/);
      expect(later, String(polls)).not.toContain("pcard__fresh--unavailable");
    }
    // only the MCP process's own verdict ends it: a provider failure after the head retry, or a refusal
    for (const state of ["failed", "refused"]) {
      const end = await (await placeRoute(post({ at: "ags:05334002", lang: "de", how: "fill", polls: 3 }), { ...o, refreshFetch: mcp(state).f })).text();
      expect(end, state).toMatch(/^<section class="place"/);
      expect(end, state).toContain("pcard__fresh--unavailable");
    }
  });
});

/**
 * #712, the queue (owner 2026-10-15: "organize the queue, there must be no
 * lost requests"): the MCP process answers a pending refresh with where the
 * person's request stands in its queue. The card shows it, and the page's
 * background fill re-reads the card about when it is sent — again while it is
 * still pending, a bounded number of times. Every fill asks the refresh again,
 * so a request an MCP restart lost is submitted again. Nothing is refused for
 * the key's spacing any more, and there is no one-shot retry.
 */
describe("a queued refresh: its place in the queue on the card, and the page keeps re-reading until it settles (#712)", () => {
  const post = (body: unknown): Request =>
    new Request("http://shell/fragment/place", { method: "POST", headers: { ...FETCH, "content-type": "application/json" }, body: JSON.stringify(body) });
  const o = (m: ReturnType<typeof mcp>, d = digest()) => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });
  const ask = (m: ReturnType<typeof mcp>) => askRefresh("ags:05913000", { url: "http://mcp:8788", timeoutMs: 50, fetchImpl: m.f });

  it("the note: a pending answer carries its queue place; a malformed one is dropped, never trusted; a refusal is final", async () => {
    expect(await ask(mcp("pending", { queue: { position: 2, etaMs: 118_000 } }))).toEqual({ state: "pending", at: null, queue: { position: 2, etaMs: 118_000 } });
    expect(await ask(mcp("pending"))).toEqual({ state: "pending", at: null });
    for (const bad of [{ position: 0, etaMs: 1 }, { position: 1.5, etaMs: 1 }, { position: "2", etaMs: 1 }, { position: 2, etaMs: -1 }, { position: 2 }, null, "x"]) {
      expect(await ask(mcp("pending", { queue: bad }))).toEqual({ state: "pending", at: null });
    }
    // no key / an off switch / a failed read: final, said as such — the spacing never refuses any more
    expect(await ask(mcp("refused"))).toEqual({ state: "unavailable", at: null });
    expect(await ask(mcp("failed"))).toEqual({ state: "unavailable", at: null });
  });

  it("the rule (info ASAP): re-read at the queue's ETA plus the request's own 1.5 s, 2 s to 5 min apart; the head backs off 2 → 4 → 8 s; our own outage retries after 30 s; no cap", () => {
    const queued = { state: "pending" as const, at: null, queue: { position: 2, etaMs: 118_000 } };
    const running = { state: "pending" as const, at: null };
    expect([FUEL_FILL_MIN_MS, FUEL_FILL_MAX_MS, FUEL_FILL_MARGIN_MS, FUEL_FILL_HEAD_MAX_MS, FUEL_FILL_RETRY_MS]).toEqual([2_000, 300_000, 1_500, 60_000, 30_000]);
    expect(fillOf(queued, "browser")).toEqual({ how: "fill", delayMs: 119_500, polls: 1, head: 0 });
    expect(fillOf(queued, "fill", 4)).toEqual({ how: "fill", delayMs: 119_500, polls: 5, head: 0 });
    // spacing follows the ETA inside the bounds: an ETA of 3 s → 4.5 s, of 0.2 s at position 2 → the 2 s floor, an hour → five minutes
    expect(fillOf({ ...queued, queue: { position: 2, etaMs: 3_000 } }, "fill", 1)).toMatchObject({ delayMs: 4_500 });
    expect(fillOf({ ...queued, queue: { position: 2, etaMs: 200 } }, "fill", 1)).toMatchObject({ delayMs: FUEL_FILL_MIN_MS });
    expect(fillOf({ ...queued, queue: { position: 60, etaMs: 3_600_000 } }, "fill", 1)).toMatchObject({ delayMs: FUEL_FILL_MAX_MS, head: 0 });
    // the head (position 1 or an ETA of 0): about 2 s, then 4, 8, 16 … while still pending, at most a key spacing
    const top = { ...queued, queue: { position: 1, etaMs: 0 } };
    const steps: number[] = [];
    let h = 0;
    for (let i = 0; i < 8; i++) {
      const n = fillOf(top, "fill", i + 1, h)!;
      steps.push(n.delayMs!);
      h = n.head;
    }
    expect(steps).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
    // …but never before its ETA: position 1 with 20 s to go waits 21.5 s
    expect(fillOf({ ...queued, queue: { position: 1, etaMs: 20_000 } }, "fill", 1)).toMatchObject({ delayMs: 21_500, head: 1 });
    // a place in the queue again resets the back-off
    expect(fillOf(queued, "fill", 9, 5)).toMatchObject({ head: 0 });
    // running (no queue place): the first render's fill goes at once and waits on the request; a fill backs off from 2 s
    expect(fillOf(running, "ip")).toEqual({ how: "fill", polls: 1, head: 1 });
    expect(fillOf(running, "fill", 1, 1)).toEqual({ how: "fill", delayMs: 4_000, polls: 2, head: 2 });
    // our own process down (a restart, a 5xx): 30 s, the next fill submits again
    expect(fillOf({ state: "pending", at: null, retry: true }, "fill", 3, 4)).toEqual({ how: "fill", delayMs: FUEL_FILL_RETRY_MS, polls: 4, head: 0 });
    // no cap: the 30th, the 500th and the thousandth re-read are wrapped again; the counter only saturates
    for (const polls of [29, 30, 31, 500, FUEL_FILL_POLLS_SEEN, 50_000]) expect(fillOf(queued, "fill", polls), String(polls)).toMatchObject({ how: "fill", delayMs: 119_500 });
    expect(fillOf(queued, "fill", FUEL_FILL_POLLS_SEEN)).toMatchObject({ polls: FUEL_FILL_POLLS_SEEN });
    expect(fillOf({ state: "unavailable", at: null }, "manual")).toBeNull();
    expect(fillOf({ state: "refreshed", at: 1 }, "fill", 3)).toBeNull();
    expect(fillOf(null, "manual")).toBeNull();
  });

  it("the place route: queued → the digest is told the place and ETA, and the cards come back wrapped to be re-read about then", async () => {
    const m = mcp("pending", { queue: { position: 3, etaMs: 41_500 } });
    const d = digest();
    const first = await (await placeRoute(post({ at: "ags:05913000", lang: "de", how: "browser" }), o(m, d))).text();
    expect(first).toMatch(/^<div class="place-fill" data-vf-fill="\/fragment\/place" data-vf-body="[^"]*&quot;how&quot;:&quot;fill&quot;[^"]*" data-vf-shape="place"[^>]*data-vf-delay="43000">/);
    expect(first).toContain("pcard__fresh--pending");
    expect(d.asked[0]).toContain("&fuel=pending&fuelPos=3&fuelEta=42");
    expect(m.asked).toHaveLength(1);
  });

  it("the shell keeps polling while the entry waits, and a fill re-submits the ask — so a request an MCP restart lost is asked again", async () => {
    // Poll 1: still queued (position 1 now) — the fill asked the refresh again and is wrapped again.
    const queued = mcp("pending", { queue: { position: 1, etaMs: 20_000 } });
    const again = await (await placeRoute(post({ at: "ags:05913000", lang: "de", how: "fill", polls: 1 }), o(queued))).text();
    expect(queued.asked).toHaveLength(1);
    expect(again).toMatch(/&quot;polls&quot;:2[^>]*data-vf-delay="21500"/);
    // The MCP process restarted: its queue is empty, so the fill's ask is a NEW entry (pending, position 2) — the page keeps polling.
    const restarted = mcp("pending", { queue: { position: 2, etaMs: 80_000 } });
    const after = await (await placeRoute(post({ at: "ags:05913000", lang: "de", how: "fill", polls: 2 }), o(restarted))).text();
    expect(restarted.asked).toEqual(['http://mcp:8788/internal/fuel/refresh {"at":"ags:05913000"}']);
    expect(after).toMatch(/&quot;polls&quot;:3[^>]*data-vf-delay="81500"/);
    // The entry settled: the fresh prices, and nothing more to fill.
    const fresh = await (await placeRoute(post({ at: "ags:05913000", lang: "de", how: "fill", polls: 3 }), o(mcp("refreshed", { settledAt: 1_760_270_000_000 })))).text();
    expect(fresh).toMatch(/^<section class="place"/);
    expect(fresh).toContain("pcard__fresh--refreshed");
  });

  it("the first render asks nothing (#981 C1): the held cards, unwrapped since #1065 — the fuel card's own fragment is the one that asks and is queued", async () => {
    const m = mcp("pending", { queue: { position: 1, etaMs: 47_000 } });
    const r = await placeFirstRender("ags:05913000", "de", { ...(o(m) as unknown as TileOpts), deadlineMs: 300, how: "page", request: req("GET") });
    expect(m.asked).toEqual([]);
    expect(r.kind === "place" && r.place.html).toMatch(/^<section class="place"[^>]*><p class="pcard__fresh pcard__fresh--none">/);
    expect(r.kind === "place" && r.place.html).not.toContain("data-vf-fill");
  });
});

describe("the first render (home IP rung, place page): bounded, then filled — and asking nothing itself (#981 C1)", () => {
  /** The MCP refresh is handed to the document path ANYWAY (cast past its type): a render that used it would be caught. */
  const o = (m: ReturnType<typeof mcp>, d: ReturnType<typeof digest>) => ({ baseUrl: "http://digest", timeoutMs: 2_000, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f, deadlineMs: 300 }) as unknown as TileOpts & { readonly deadlineMs: number };

  it("a person's first render: no ask, the fuel card deferred (#1065: `fuelRows=0`, no price in the HTML) and no fill marker", async () => {
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    const d = digest();
    const r = await placeFirstRender("pt:50.875,6.1725", "de", { ...o(m, d), how: "ip", snap: true, request: req("GET") });
    expect(r).toMatchObject({ kind: "place", fuel: null });
    expect(m.asked).toEqual([]);
    expect(d.asked[0]).not.toContain("fuel=");
    expect(d.asked[0]).toContain("&fuelRows=0");
    expect(r.kind === "place" && r.place.html).toMatch(/^<section class="place"[^>]*><p class="pcard__fresh pcard__fresh--none">/);
    expect(r.kind === "place" && r.place.html).not.toContain("data-vf-fill");
  });

  it("the digest misses the panel deadline: a placeholder the filler fetches whole, never a long wait", async () => {
    const t0 = Date.now();
    const r = await placeFirstRender("pt:50.875,6.1725", "de", { ...o(mcp("none_due"), digest({ delayMs: 1_500 })), how: "ip", request: req("GET") });
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(r.kind).toBe("deferred");
    expect(r.kind === "deferred" && r.html).toMatch(/^<div class="place-fill place-fill--loading is-loading" aria-busy="true" data-vf-fill="\/fragment\/place"/);
  });

  it("a crawler's first render asks nothing", async () => {
    const m = mcp("refreshed");
    await placeFirstRender("ags:05334002", "de", { ...o(m, digest()), how: "page", request: req("GET", { "user-agent": "Googlebot/2.1" }) });
    expect(m.asked).toEqual([]);
  });

  it("the home's IP rung shows the GUESSED place's cards and asks nothing itself (#981 C1) — its filler will; a crawler is not even located", async () => {
    const geo: GeoIp = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    const here = await homePlace(headers({ ...NAV, "x-forwarded-for": "192.0.2.77" }), "de", { ...o(m, digest()), geoipFile: undefined, geo, method: "GET", url: "http://shell/de" });
    expect(here.source).toBe("ip");
    expect(m.asked).toEqual([]);
    // #1065: no fill marker — the fuel card's own fragment asks, from the card's view
    expect(here.place?.html).not.toContain("data-vf-fill");
    const bot = mcp("refreshed");
    await homePlace(headers({ ...NAV, "user-agent": "Googlebot/2.1", "x-forwarded-for": "192.0.2.77" }), "de", { ...o(bot, digest()), geoipFile: undefined, geo, method: "GET" });
    expect(bot.asked).toEqual([]);
  });

  it("curl/8 and the meta refresh's reload render the home and ask NOTHING — and their placeholder asks nothing either (#564 review)", async () => {
    const geo: GeoIp = { lookup: () => ({ country: "DE", lat: 50.8752, lon: 6.1694 }) } as unknown as GeoIp;
    const curl = mcp("refreshed");
    const c = await homePlace(headers({ ...CURL, "x-forwarded-for": "192.0.2.77" }), "de", { ...o(curl, digest()), geoipFile: undefined, geo, method: "GET", url: "http://shell/de" });
    expect(c.source).toBe("ip");
    expect(curl.asked).toEqual([]);
    const reload = mcp("refreshed");
    const r = await homePlace(headers({ ...NAV, "sec-fetch-user": "", "x-forwarded-for": "192.0.2.77" }), "de", { ...o(reload, digest({ delayMs: 1_500 })), geoipFile: undefined, geo, method: "GET", url: "http://shell/de?r=auto" });
    expect(reload.asked).toEqual([]);
    expect(r.deferred?.html).toContain("&quot;how&quot;:&quot;held&quot;");
    expect(r.deferred?.html).not.toContain("&quot;how&quot;:&quot;fill&quot;");
  });

  it("a place page's cards that arrive inside its deadline are the page, ask nothing, and carry no marker (#1065, #1166)", async () => {
    const m = mcp("refreshed", { settledAt: 1_760_270_000_000 });
    const a = await resolvePlacePage("de", "alsdorf", { ...o(m, digest({ delayMs: 100 })), request: req("GET") });
    expect(a.kind).toBe("page");
    expect(m.asked).toEqual([]);
    expect(a.kind === "page" && a.place.html).not.toContain("data-vf-fill");
    const head = mcp("refreshed");
    const h = await resolvePlacePage("de", "alsdorf", { ...o(head, digest()), request: req("HEAD") });
    expect(head.asked).toEqual([]);
    expect(h.kind === "page" && h.place.html).not.toContain("data-vf-fill");
  });

  // L2 (data-steward ruling 2026-10-15, #781): with the per-door ceilings gone a gate failure is no
  // longer capped at a dozen an hour, so the person-only gates carry the weight. Every ask that reached
  // the MCP process's internal route would be an entry in its one queue — the stub records each one.
  it("L2: a crawler's page load (even one forging a browser's navigation headers) and a cross-site fragment request put NOTHING in the queue", async () => {
    const queue = mcp("pending", { queue: { position: 1, etaMs: 60_000 } });
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"]) {
      await placeFirstRender("ags:05334002", "de", { ...o(queue, digest()), how: "page", request: req("GET", { ...NAV, "user-agent": ua }) });
    }
    const cross = new Request("http://shell/fragment/place", { method: "POST", headers: { ...FETCH, "sec-fetch-site": "cross-site", "content-type": "application/json" }, body: JSON.stringify({ at: "ags:05334002", lang: "de", how: "manual" }) });
    expect((await placeRoute(cross, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: queue.f })).status).toBe(200);
    expect(queue.asked).toEqual([]);
    // since #981 C1 a person's page load asks nothing either; the control, so the assertion above is not vacuous:
    // the same person's fragment request (what that page's filler sends) does reach it
    await placeFirstRender("ags:05334002", "de", { ...o(queue, digest()), how: "page", request: req("GET", NAV) });
    expect(queue.asked).toEqual([]);
    const same = new Request("http://shell/fragment/place", { method: "POST", headers: { ...FETCH, "content-type": "application/json" }, body: JSON.stringify({ at: "ags:05334002", lang: "de", how: "manual" }) });
    await placeRoute(same, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest().f, refreshUrl: "http://mcp:8788", refreshFetch: queue.f });
    expect(queue.asked).toHaveLength(1);
  });
});

describe("one ring, one sentence, three packages (#564)", () => {
  it("the refresh asks about exactly the stations the card can show, and the shell's failure sentence is the card's own", async () => {
    const { FUEL_CARD_MAX_M, PLACE_COPY } = await import("@viafrei/digest");
    const { SITE_REFRESH_RADIUS_KM, SITE_REFRESH_WAIT_MS } = await import("@viafrei/mcp");
    const { t } = await import("../src/i18n/index.js");
    const { FUEL_REFRESH_BG_MS } = await import("../src/lib/fuel-refresh.js");
    expect(SITE_REFRESH_RADIUS_KM * 1000).toBe(FUEL_CARD_MAX_M);
    // The MCP side answers (even "pending") before the shell gives up.
    expect(SITE_REFRESH_WAIT_MS).toBeLessThan(FUEL_REFRESH_BG_MS);
    for (const lang of ["de", "en", "ru", "bg", "uk", "ro", "tr"] as const) expect(t(lang, "place.fuelUnavailable"), lang).toBe(PLACE_COPY[lang].fuel.refresh.unavailable);
  });
});
