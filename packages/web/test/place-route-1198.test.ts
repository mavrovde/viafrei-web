/**
 * #1198: the first load of /en asked POST /fragment/place twice and was answered 404 twice — the digest's read of a
 * place nobody had asked for yet missed the shell's deadline (on prod ≈ 2.3 s; the next ask answered in 1.6 s), and
 * `placeRoute` answered every answer but the cards with a 404, which the island and the filler (`lib/fill.ts`) take as
 * final. Only "no such place" is the 404 now; a read that did not arrive is the placeholder the filler fills again after
 * its floor (the #1184 shape), and an answer that is no fragment is a 503 the island and the filler ask again (#1224).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FUEL_FILL_RETRY_MS } from "../src/lib/fuel-refresh.js";
import { PLACE_BUSY_REFILL_MS, placeLateRefillMs, placeRoute } from "../src/lib/fragment-route.js";
import { resetSlugKeys } from "../src/lib/place.js";
import { resetPlaceNameIndex } from "../src/lib/place-page.js";
import type { FetchLike } from "../src/lib/tiles.js";

const SCRIPT = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const head = (extra: Record<string, string> = {}) => ({ get: (n: string) => ({ "content-type": "text/html; charset=utf-8", ...extra })[n] ?? null });

type Cards = "timeout" | "refused" | "500" | "503" | "malformed" | "missing";
function digest(cards: Cards): FetchLike {
  return (url) => {
    const reply = (status: number, body: string, extra: Record<string, string> = {}) => Promise.resolve({ status, headers: head(extra), text: () => Promise.resolve(body) });
    if (!url.includes("/internal/place/cards")) return reply(404, "<p>not here</p>");
    switch (cards) {
      case "timeout": return Promise.reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
      case "refused": return Promise.reject(new TypeError("fetch failed"));
      case "500": return reply(500, "<p>error</p>");
      case "503": return reply(503, "<p>busy</p>");
      case "malformed": return reply(200, "<p>not the cards</p>");
      case "missing": return reply(404, "<p>no such place</p>");
    }
  };
}
const post = (extra: Record<string, unknown> = {}): Request =>
  new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json", ...SCRIPT }, body: JSON.stringify({ at: "ags:05315000", lang: "en", how: "saved", ...extra }) });
const ask = (cards: Cards, extra: Record<string, unknown> = {}): Promise<Response> => placeRoute(post(extra), { baseUrl: "http://digest", timeoutMs: 200, fetchImpl: digest(cards) });
const delayOf = (body: string): number => Number(/data-vf-delay="(\d+)"/.exec(body)?.[1] ?? "NaN");
const pollsOf = (body: string): number | undefined => {
  const raw = /data-vf-body="([^"]*)"/.exec(body)?.[1];
  if (raw === undefined) return undefined;
  return (JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as { polls?: number }).polls;
};

describe("#1198: a place's cards are a 404 only when there is no such place", () => {
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
  });

  for (const cards of ["timeout", "refused", "500"] as const) {
    it(`a read that did not arrive (${cards}) is the placeholder, re-filled after the floor and then backing off`, async () => {
      const res = await ask(cards);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/^<div class="place-fill place-fill--loading/);
      // The first miss is asked again after the floor (prod's next ask answered in 1.6 s) …
      expect(delayOf(body)).toBe(PLACE_BUSY_REFILL_MS);
      expect(pollsOf(body)).toBe(1);
      // … each further miss waits twice as long, carried in the body the filler sends back, up to the 30 s retry.
      const third = await (await ask(cards, { how: "fill", polls: 2 })).text();
      expect(delayOf(third)).toBe(4 * PLACE_BUSY_REFILL_MS);
      expect(pollsOf(third)).toBe(3);
      const late = await (await ask(cards, { how: "fill", polls: 40 })).text();
      expect(delayOf(late)).toBe(FUEL_FILL_RETRY_MS);
    });
  }

  it("the digest's 503 refusal (#1184: nothing was read) stays at the 2 s floor, however often it is refused", async () => {
    for (const polls of [0, 5, 40]) {
      const body = await (await ask("503", { how: "fill", polls })).text();
      expect(body).toMatch(/^<div class="place-fill place-fill--loading/);
      expect(delayOf(body)).toBe(PLACE_BUSY_REFILL_MS);
    }
  });

  it("the back-off is 2 s doubling per miss and never above the filler's 30 s retry", () => {
    expect([0, 1, 2, 3, 4, 5, 99].map(placeLateRefillMs)).toEqual([2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
  });

  // #1224: the 502 is a 503 now, private and no-store, and the island asks it again as well as the filler
  it("an answer that is not the cards is a 503, private and no-store, that the island and the filler ask again", async () => {
    const r = await ask("malformed");
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await r.text()).toBe("");
  });

  it("no such place is still the 404 — and the only 404 (#1224: every other kind is no 404)", async () => {
    expect((await ask("missing")).status).toBe(404);
    for (const k of ["timeout", "refused", "500", "503", "malformed"] as const) expect((await ask(k)).status, k).not.toBe(404);
  });
});
