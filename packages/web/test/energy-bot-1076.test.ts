/**
 * #1076 AC "Crawler user agents never trigger a provider refresh; a test asserts zero Tankerkönig calls for a bot
 * request" — through the WHOLE chain a fuel station's page view can reach, with only the provider faked:
 *
 *   the shell's page (`resolveEnergyPage`) and its prices fragment (`fuelStationRoute`)
 *     → the REAL digest app (`createApp`, its `/internal/fuel/<slug>` and `/…/prices` routes, over a stub page
 *       service that holds a price two days old, so a person's view is answered with `Fuel-Ask`)
 *     → the REAL MCP site door (`createInternalApp`, `POST /internal/fuel/refresh`, under the shared fuel port)
 *     → the port's provider calls, counted: `refresh` is the prices request, `run` the list request — the two
 *       Tankerkönig calls the site can cause.
 *
 * A crawler (an nginx agent class, a crawler user agent, a prefetch, a navigation replayed at the fragment, a HEAD)
 * reads the page and the refused sentence and causes ZERO provider calls and zero door requests. A person's view of
 * the same page, with the same stale price, causes exactly one door request and a provider call — the control that
 * proves the chain is wired and can fire. Loopback only; no network, no live provider.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Queryable } from "@viafrei/ingest";
import { createApp } from "../../digest/src/server/app.js";
import { createDigestService } from "../../digest/src/server/service.js";
import type { EnergyPageService, FuelPage } from "../../digest/src/server/energy-page-service.js";
import { createFuelDiscovery } from "../../mcp/src/server/fuel.js";
import { createInternalApp } from "../../mcp/src/server/internal.js";
import { FUEL_MOTORWAY_ANCHOR } from "../../mcp/src/queries/fuel.sql.js";
import { resetMcpEnv } from "../../mcp/src/server/env.js";
import { resolveEnergyPage } from "../src/lib/energy-page.js";
import { FUEL_STATION_PATH, FUEL_STATION_ROOT, fuelStationRoute } from "../src/lib/fuel-station.js";
import { AGENT_CLASS_HEADER } from "../src/lib/agent-class.js";

const SLUG = "aral-nuernberg-fuerther-str-abcdefghij";
const AT = { lat: 49.45, lon: 11.06 };
const TWO_DAYS_MS = 2 * 86_400_000;

const row = { id: "f-1", brand: "ARAL", name: "Aral", street: "Fürther Str.", house_no: "12", postcode: "90429", city: "Nürnberg", land: "BY", town_places: null, whole_day: true, lat: AT.lat, lon: AT.lon, day: "2026-11-02" };
const page: FuelPage = { kind: "fuel", slug: SLUG, row, town: { ags: "09564000", name: "Nürnberg" }, exit: null, near: [] };

/** The digest's page service: the page, and a held price two days old (outside the cache window, inside the held one). */
function energy(): EnergyPageService & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fuel: (s) => (asked.push(`fuel:${s}`), Promise.resolve({ ok: true, value: { kind: "page", page } })),
    charging: () => Promise.resolve({ ok: true, value: { kind: "missing" } }),
    fuelPrices: (s) => (
      asked.push(`prices:${s}`),
      Promise.resolve({ ok: true, value: { kind: "page", page: { row, prices: [{ product: "e5", label: "Super E5", unit: "EUR/l", price: "1.699", observed_at: new Date(Date.now() - TWO_DAYS_MS), is_open: true }] } } })
    ),
    list: () => Promise.resolve({ ok: true, value: { total: 0, parts: 0, entries: [] } }),
    counters: () => ({ reads: 0, listHits: 0, failures: 0, collisions: 0 }),
  };
}

const listen = (app: { listen: (port: number, host: string, cb: () => void) => Server }): Promise<{ url: string; server: Server }> =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, server }));
  });

let digestUrl = "";
let doorUrl = "";
const servers: Server[] = [];
let es: ReturnType<typeof energy>;
/** The two Tankerkönig calls of the shared port, and every request the door received. */
const provider = { prices: vi.fn(), list: vi.fn() };
const door: string[] = [];

beforeAll(async () => {
  es = energy();
  const service = createDigestService({ db: null, now: () => new Date(), cacheSeconds: 30, autobahnFreshSeconds: 1800 });
  const d = await listen(createApp({ service, energy: es }));
  digestUrl = d.url;
  servers.push(d.server);
  // the MCP site door over a database that answers the area lookups only (no anchor), and a port whose provider calls are counted
  const db = { query: (sql: string) => Promise.resolve(sql === FUEL_MOTORWAY_ANCHOR ? { rows: [{ anchor: false }] } : { rows: [AT] }) } as unknown as Queryable;
  // the port's own database is unused by the door's path, as in the MCP's internal.test.ts (its two warnings are logged)
  const fuel = createFuelDiscovery({} as Queryable, {
    spacingMs: () => 0,
    wantKey: () => undefined,
    discoverCovered: () => Promise.resolve(false),
    switches: { wide: false },
    refresh: (_db: Queryable, ids: readonly string[]) => (provider.prices(ids), Promise.resolve({ runId: 1, ids: ids.length, rows: ids.length, failed: false, refused: false, keyWaitMs: null })),
    due: () => Promise.resolve(["s1", "s2"]),
    run: () => (provider.list(), Promise.resolve({ stations: 0, inserted: 0, watched: 0, priced: 0, bytes: 0 })),
    refreshWaitMs: 1_000,
  });
  const s = await listen(createInternalApp({ db, fuel }));
  doorUrl = s.url;
  servers.push(s.server);
});
afterAll(async () => {
  for (const s of servers) await new Promise((r) => s.close(r));
});

let keyBefore: string | undefined;
beforeEach(() => {
  keyBefore = process.env["TANKERKOENIG_API_KEY"];
  process.env["TANKERKOENIG_API_KEY"] = "test-key-not-a-real-one";
  resetMcpEnv();
  provider.prices.mockClear();
  provider.list.mockClear();
  door.length = 0;
  es.asked.length = 0;
});
afterEach(() => {
  if (keyBefore === undefined) delete process.env["TANKERKOENIG_API_KEY"];
  else process.env["TANKERKOENIG_API_KEY"] = keyBefore;
  resetMcpEnv();
});

/** Every request the shell sends the door, recorded on its way (the shell's own `refreshFetch` seam). */
const doorFetch = (u: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => {
  door.push(`${init.method} ${new URL(u).pathname}`);
  return fetch(u, init);
};

const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const NAV = { "user-agent": PERSON["user-agent"], "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
const fragmentReq = (h: Record<string, string>, method = "GET") => new Request(`https://viafrei.de${FUEL_STATION_PATH}?station=${SLUG}&lang=de`, { method, headers: h });

/** One page view: the page, then the prices fragment its script asks (a crawler that runs scripts asks it too). */
async function view(h: Record<string, string>, method = "GET"): Promise<{ page: string; prices: string }> {
  const o = { baseUrl: digestUrl, timeoutMs: 1_500 };
  const p = await resolveEnergyPage("fuel", "de", SLUG, o);
  expect(p.kind).toBe("page");
  const res = await fuelStationRoute(fragmentReq(h, method), { ...o, refreshUrl: doorUrl, refreshFetch: doorFetch });
  return { page: p.kind === "page" ? p.head.html : "", prices: await res.text() };
}

const CRAWLERS: [string, Record<string, string>, string?][] = [
  ["nginx agent class 'search'", { ...PERSON, [AGENT_CLASS_HEADER]: "search" }],
  ["nginx agent class 'ai'", { ...PERSON, [AGENT_CLASS_HEADER]: "ai" }],
  ["nginx agent class 'seo'", { ...PERSON, [AGENT_CLASS_HEADER]: "seo" }],
  ["Googlebot rendering the page's script (a browser's fetch headers, the crawler's UA)", { ...PERSON, "user-agent": "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
  ["bingbot", { ...PERSON, "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" }],
  ["GPTBot", { ...PERSON, "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" }],
  ["ClaudeBot", { ...PERSON, "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" }],
  ["no user agent", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }],
  ["a navigation replayed at the fragment", NAV],
  ["a prefetch", { ...PERSON, "sec-purpose": "prefetch" }],
  ["a HEAD", PERSON, "HEAD"],
];

describe("#1076 a crawler's view of a fuel station's page causes zero Tankerkönig calls (the whole chain)", () => {
  it("the control: a person's view of the same stale price asks the door once and the provider is called", { timeout: 2_000 }, async () => {
    const v = await view(PERSON);
    expect(v.page).toContain(`data-station="${SLUG}"`);
    expect(v.prices).toMatch(new RegExp(`^<div class="${FUEL_STATION_ROOT}"`));
    expect(door).toEqual(["POST /internal/fuel/refresh"]);
    expect(provider.prices.mock.calls.length + provider.list.mock.calls.length).toBeGreaterThanOrEqual(1);
    // the digest read the held prices for the person (twice: the first read, then the read with the refresh's note)
    expect(es.asked.filter((a) => a.startsWith("prices:")).length).toBe(2);
  });
  for (const [what, h, method] of CRAWLERS)
    it(`${what}: the page and the sentence, no price read, no door request, zero provider calls`, { timeout: 2_000 }, async () => {
      const v = await view(h, method);
      expect(v.page).toContain(`data-station="${SLUG}"`);
      // the page itself carries no figure, and the refused fragment carries none either
      for (const html of [v.page, v.prices]) expect(html).not.toMatch(/1[.,]69/);
      expect(door).toEqual([]);
      expect(provider.prices).not.toHaveBeenCalled();
      expect(provider.list).not.toHaveBeenCalled();
      // the digest was asked for the page; it never read a price for the crawler (`refused=1` asks the service nothing)
      expect(es.asked).toEqual([`fuel:${SLUG}`]);
    });
  it("a burst of crawler views over every class: still zero provider calls", { timeout: 2_000 }, async () => {
    for (let i = 0; i < 5; i += 1) for (const [, h, method] of CRAWLERS) await view(h, method);
    expect(door).toEqual([]);
    expect(provider.prices).not.toHaveBeenCalled();
    expect(provider.list).not.toHaveBeenCalled();
  });
});
