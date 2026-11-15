/**
 * #1279: a verified crawler (Googlebot, Bingbot, OAI-SearchBot, ClaudeBot) got a 503 on a small town's place page
 * whose cards were late and of which nothing was held (`verified_refused`, ~1 200 ms): the deferred page took its name
 * from the place index alone, which lists only the Gemeinden of 10 000 people or more. The digest now gives every
 * Gemeinde's name beside its slug's key (`Place-Label`), so the late page is the deferred 200 for every Gemeinde.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLACE_PAGE_BUDGET_MS, PLACE_PAGE_CARDS_MS, resetPlaceNameIndex, resolvePlacePage, type PlacePageAnswer } from "../src/lib/place-page.js";
import { SLUG_NAME_RETRY_MS, placeNameOfSlug, resetSlugKeys } from "../src/lib/place.js";
import { DEFAULT_PLACE_TIMEOUT_MS } from "../src/lib/env.js";
import type { FetchLike } from "../src/lib/tiles.js";

const INDEX = '<ul class="place-index"><li><a href="/de/place/koeln">Köln</a></li></ul>';
const reply = (status: number, body: string, extra: Record<string, string> = {}) => ({ status, headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", ...extra })[n] ?? null }, text: () => Promise.resolve(body) });
const hang = (init: { signal: AbortSignal }) => new Promise<never>((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));

/** A digest whose cards hang; the key of `brackel` (not in the index) carries `label` as its Place-Label, when given. */
const digest = (label: string | undefined, asked: string[] = []): FetchLike => (url, init) => {
  asked.push(url);
  if (url.endsWith("/internal/place/key?slug=brackel")) return Promise.resolve(reply(200, '<p class="place-key">ags:03353005</p>', label === undefined ? {} : { "place-label": label }));
  if (url.endsWith("/internal/place/index")) return Promise.resolve(reply(200, INDEX));
  return hang(init);
};
const prod = (f: FetchLike) => ({ baseUrl: "http://digest", timeoutMs: DEFAULT_PLACE_TIMEOUT_MS, fetchImpl: f });
const within = async (p: Promise<PlacePageAnswer>, ms: number): Promise<PlacePageAnswer | null> => {
  let out: PlacePageAnswer | null = null;
  void p.then((a) => (out = a));
  await vi.advanceTimersByTimeAsync(ms);
  return out;
};

describe("#1279: a small town's page with late cards is the deferred 200, named by the key's Place-Label", () => {
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("a Gemeinde the place index does not list is the page with its cards loading, inside the cards' wait", async () => {
    const a = await within(resolvePlacePage("cs", "brackel", prod(digest(encodeURIComponent("Brackel")))), PLACE_PAGE_CARDS_MS + 50);
    expect(a).toMatchObject({ kind: "page", slug: "brackel", place: { at: "ags:03353005", label: "Brackel", slug: "brackel" } });
    expect((a as Extract<PlacePageAnswer, { kind: "page" }>).place.html).toContain("data-vf-fill");
  });

  it("the name is kept with the key: a second request asks the digest neither the key nor the index", async () => {
    // a name unlike the slug on purpose: the second answer can only have come from the KEPT name
    await within(resolvePlacePage("de", "brackel", prod(digest(encodeURIComponent("Rödental")))), PLACE_PAGE_CARDS_MS + 50);
    const asked: string[] = [];
    const a = await within(resolvePlacePage("en", "brackel", prod(digest(undefined, asked))), PLACE_PAGE_CARDS_MS + 50);
    expect(a).toMatchObject({ kind: "page", place: { label: "Rödental" } });
    expect(asked.some((u) => u.includes("/internal/place/key") || u.endsWith("/internal/place/index"))).toBe(false);
  });

  it("review: a key kept without a name (the digest still loading its slugs) asks for the name again after SLUG_NAME_RETRY_MS", async () => {
    expect(await within(resolvePlacePage("de", "brackel", prod(digest(undefined))), PLACE_PAGE_BUDGET_MS + 10)).toEqual({ kind: "unavailable" });
    const asked: string[] = [];
    // inside the retry window the held key answers and the digest is not asked for it
    await within(resolvePlacePage("de", "brackel", prod(digest(encodeURIComponent("Brackel"), asked))), PLACE_PAGE_BUDGET_MS + 10);
    expect(asked.filter((u) => u.includes("/internal/place/key"))).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(SLUG_NAME_RETRY_MS);
    const a = await within(resolvePlacePage("de", "brackel", prod(digest(encodeURIComponent("Brackel"), asked))), PLACE_PAGE_CARDS_MS + 50);
    expect(a).toMatchObject({ kind: "page", place: { label: "Brackel" } });
    expect(asked.filter((u) => u.includes("/internal/place/key"))).toHaveLength(1);
  });

  it("guard: a digest that gives no name (an older one) leaves the page as before — unavailable inside the budget", async () => {
    expect(await within(resolvePlacePage("de", "brackel", prod(digest(undefined))), PLACE_PAGE_BUDGET_MS + 10)).toEqual({ kind: "unavailable" });
  });

  it("a malformed Place-Label is no name: undecodable, empty, too long, a control character", async () => {
    for (const bad of ["%E0%A4%A", "%20", encodeURIComponent("x".repeat(121)), encodeURIComponent("Bra\nckel")]) {
      resetSlugKeys();
      expect(await within(resolvePlacePage("de", "brackel", prod(digest(bad))), PLACE_PAGE_BUDGET_MS + 10), bad).toEqual({ kind: "unavailable" });
      expect(placeNameOfSlug("brackel"), bad).toBeNull();
    }
  });
});
