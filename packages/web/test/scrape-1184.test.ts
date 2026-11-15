/**
 * #1184 (phase 1, the shell's half): the page's own script asks for its cards in the digest's `fill` lane, and a
 * place page whose cards the digest refused (`busy`, a 503 at once) is a 200 with the cards loading — never a 503.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { PLACE_BUSY_REFILL_MS, placeRoute } from "../src/lib/fragment-route.js";
import { CARDS_LANE_HEADER, resetSlugKeys } from "../src/lib/place.js";
import { resetPlaceNameIndex, resolvePlacePage } from "../src/lib/place-page.js";
import type { FetchLike } from "../src/lib/tiles.js";

const SCRIPT = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const NAV = { "user-agent": SCRIPT["user-agent"], "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

const html = (body: string, extra: Record<string, string> = {}) => ({
  get: (n: string) => ({ "content-type": "text/html; charset=utf-8", ...extra })[n] ?? null,
  body,
});

/** A digest stub: the key and the index answer; the cards answer `cards` (200 fragment, or the busy 503). */
function digest(cards: "ok" | "busy", seen: { url: string; headers: Record<string, string> }[]): FetchLike {
  return (url, init) => {
    seen.push({ url, headers: init.headers });
    const reply = (status: number, h: ReturnType<typeof html>) => Promise.resolve({ status, headers: h, text: () => Promise.resolve(h.body) });
    if (url.includes("/internal/place/key?slug=koeln")) return reply(200, html('<p class="place-key">ags:05315000</p>'));
    if (url.includes("/internal/place/index")) return reply(200, html('<ul class="place-index"><li><a href="/de/place/koeln">Köln</a></li></ul>'));
    if (cards === "busy") return reply(503, html("<p>place cards are busy</p>", { "retry-after": "5" }));
    return reply(200, html('<section class="place" id="place-cards"><h2>Köln</h2></section>', { "place-key": "ags:05315000", "place-label": "K%C3%B6ln", "place-point": "0", "place-slug": "koeln" }));
  };
}
const post = (headers: Record<string, string>): Request =>
  new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ at: "ags:05315000", lang: "de", how: "page" }) });

describe("#1184: the fill lane", () => {
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
  });

  it("a script's fetch from the page asks with the fill header; a replayed navigation does not", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    await placeRoute(post(SCRIPT), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest("ok", seen) });
    await placeRoute(post(NAV), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest("ok", seen) });
    const cards = seen.filter((s) => s.url.includes("/internal/place/cards"));
    expect(cards.map((c) => c.headers[CARDS_LANE_HEADER] ?? null)).toEqual(["fill", null]);
  });

  it("a place page whose cards the digest refused is a 200 page with its cards loading, inside the budget", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const t0 = Date.now();
    const a = await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 2_000, fetchImpl: digest("busy", seen), request: new Request("http://shell/de/place/koeln", { headers: NAV }) });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(a.kind).toBe("page");
    if (a.kind !== "page") return;
    expect(a.place.label).toBe("Köln");
    // the placeholder the page's filler fetches, never the cards
    expect(a.place.html).not.toContain('id="place-cards"><h2>');
    // and the document render asked in the page lane
    expect(seen.filter((s) => s.url.includes("/internal/place/cards")).every((s) => s.headers[CARDS_LANE_HEADER] === undefined)).toBe(true);
  });
});

describe("#1184: a refused fill is asked again, never final", () => {
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
  });

  it("a fill the digest refused is a 200 placeholder re-filled after the filler's floor, not the 404 it takes as final", async () => {
    const res = await placeRoute(post(SCRIPT), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest("busy", []) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^<div class="place-fill place-fill--loading/);
    expect(body).toContain(`data-vf-delay="${PLACE_BUSY_REFILL_MS}"`);
    expect(PLACE_BUSY_REFILL_MS).toBeLessThanOrEqual(2_000);
  });
});

/** AC 4: every named crawler gets a 200 place page while the digest refuses the cards (a walk holds the pool). */
const CRAWLERS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)",
  "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
];
describe("#1184 AC 4: search engines are never refused", () => {
  beforeEach(() => {
    resetSlugKeys();
    resetPlaceNameIndex();
  });
  it.each(CRAWLERS)("%s gets a 200 page inside the budget with the cards refused", async (ua) => {
    const t0 = Date.now();
    const a = await resolvePlacePage("de", "koeln", { baseUrl: "http://digest", timeoutMs: 2_000, fetchImpl: digest("busy", []), request: new Request("http://shell/de/place/koeln", { headers: { "user-agent": ua } }) });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(a.kind).toBe("page");
  });
});
