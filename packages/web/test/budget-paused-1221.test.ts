/**
 * #1221 acceptance (owner 2026-11-08: "if the limit is over we must show the last available data"), the shell's three
 * fuel doors: when the MCP process answers `paused` (the site door's request budget is spent, no request was made),
 * each door answers 200 with the held prices the digest renders — said `paused` to the digest, so the card carries the
 * line — and is NOT wrapped to be re-read: the pause is final for this view, never an error, an empty card or a loop.
 * The shell holds no provider client at all; that no provider request is made is the MCP side's acceptance
 * (`packages/mcp/src/tools/fuel-refresh.db.test.ts` for the two tools, `packages/mcp/src/server/internal.db.test.ts`
 * for the site door), the held prices with their times the digest's (`presentation/place-tiles.test.ts`,
 * `server/energy-routes.test.ts`), and the opening-hours cycle's `packages/ingest/src/schedulers/tankerkoenig.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { placeRoute } from "../src/lib/fragment-route.js";
import { FUEL_STATION_PATH, fuelStationRoute } from "../src/lib/fuel-station.js";
import { MOTORWAY_FUEL_PATH, motorwayFuelRoute } from "../src/lib/motorway-fuel.js";
import type { PostLike } from "../src/lib/fuel-refresh.js";
import type { FetchLike } from "../src/lib/tiles.js";

const PERSON = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
/** What the digest holds: a dated price, echoed with the note it was told. */
const HELD = (note: string): string => `<p class="pcard__fresh pcard__fresh--${note}">${note}</p><ul><li>ARAL 1,68<sup>9</sup> <time datetime="2026-11-08T06:00:00.000Z">vor 3 Std.</time></li></ul>`;

function mcpPaused() {
  const asked: string[] = [];
  const f: PostLike = (url, init) => {
    asked.push(`${url} ${init.body}`);
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ state: "paused", settledAt: null, reused: false }) });
  };
  return { asked, f };
}

function digest(wrap: (inner: string) => string, ask: string | null) {
  const asked: string[] = [];
  const f: FetchLike = (url) => {
    asked.push(url);
    const note = /[?&]fuel=([a-z]+)/.exec(url)?.[1] ?? "none";
    const h: Record<string, string> = { "content-type": "text/html; charset=utf-8", "place-key": "ags:05334002", "place-label": "Alsdorf", "place-point": "0" };
    if (ask !== null && note === "none") h["fuel-ask"] = ask;
    return Promise.resolve(new Response(wrap(HELD(note)), { status: 200, headers: h }));
  };
  return { asked, f };
}

const opts = (d: ReturnType<typeof digest>, m: ReturnType<typeof mcpPaused>) => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: d.f, refreshUrl: "http://mcp:8788", refreshFetch: m.f });

function expectHeldAnswer(status: number, body: string): void {
  expect(status).toBe(200);
  expect(body).toContain("pcard__fresh--paused");
  expect(body).toContain("1,68<sup>9</sup>");
  expect(body).toContain('datetime="2026-11-08T06:00:00.000Z"');
  // final: never wrapped to be re-read, never the "could not be loaded" state
  expect(body).not.toContain("data-vf-refill");
  expect(body).not.toContain("data-vf-fill");
  expect(body).not.toContain("pcard__fresh--unavailable");
}

describe("#1221 a spent budget: every shell door answers with the held prices and says live refresh is paused", () => {
  it("the place card (/fragment/place)", async () => {
    const m = mcpPaused();
    const d = digest((x) => `<section class="place" id="place-cards">${x}</section>`, null);
    const req = new Request("http://shell/fragment/place", { method: "POST", headers: { ...PERSON, "content-type": "application/json" }, body: JSON.stringify({ at: "ags:05334002", lang: "de", how: "manual" }) });
    const res = await placeRoute(req, opts(d, m));
    expectHeldAnswer(res.status, await res.text());
    expect(m.asked).toHaveLength(1);
    expect(d.asked.some((u) => u.includes("fuel=paused"))).toBe(true);
  });

  it("one station's prices (/fragment/fuel-station)", async () => {
    const m = mcpPaused();
    const slug = "aral-nuernberg-fuerther-str-abcdefghij";
    const d = digest((x) => `<div class="fuel-station">${x}</div>`, "pt:49.4500,11.0600");
    const res = await fuelStationRoute(new Request(`https://viafrei.de${FUEL_STATION_PATH}?station=${slug}&lang=de`, { headers: PERSON }), opts(d, m));
    expectHeldAnswer(res.status, await res.text());
    expect(m.asked).toEqual(['http://mcp:8788/internal/fuel/refresh {"at":"pt:49.4500,11.0600"}']);
    expect(d.asked).toEqual([`http://digest/internal/fuel/${slug}/prices?lang=de`, `http://digest/internal/fuel/${slug}/prices?lang=de&fuel=paused`]);
  });

  it("a motorway's fuel layer (/fragment/motorway-fuel)", async () => {
    const m = mcpPaused();
    const d = digest((x) => `<div class="motorway-fuel">${x}</div>`, "pt:50.8123,6.1234");
    const res = await motorwayFuelRoute(new Request(`https://viafrei.de${MOTORWAY_FUEL_PATH}?road=A4&lang=de&stretch=koeln-ost-to-koeln-sued`, { headers: PERSON }), opts(d, m));
    expectHeldAnswer(res.status, await res.text());
    expect(m.asked).toHaveLength(1);
    expect(d.asked[1]).toBe("http://digest/internal/motorway/A4/fuel?lang=de&stretch=koeln-ost-to-koeln-sued&fuel=paused");
  });
});
