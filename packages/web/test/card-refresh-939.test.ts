/**
 * #939: the shell's half of a card refreshed in place.
 *  - `/fragment/card` asks the digest for one place card, passes `If-None-Match` on, passes a 304 on with no body,
 *    checks the answer's shape, and every answer is `noindex` and revalidated (C1); a malformed request is a 400 and
 *    never reaches the digest; the fuel card is never one (B2, #1065);
 *  - the script holds NO cadence of its own (A2: the cadences are the digest's table, carried as `data-refresh`), and
 *    keeps the behaviours the issue names: hidden tab, back-off, failure line, expansion, aria-live, no focus move;
 *  - `card_refresh` (card, manual|auto, changed|unchanged) is in the consented event list (C4).
 */
import { describe, expect, it } from "vitest";
import { CARD_REFRESH_SECONDS } from "../../digest/src/cards/refresh.js";
import { CARD_REFRESH_HEADERS, REFRESH_JS, cardRefreshRoute, cardRefreshScript, cardRefreshTarget, carriesRefresh } from "../src/lib/card-refresh.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { cardRefreshEvent } from "../src/analytics/listener.js";

const o = { baseUrl: "http://digest:8791", timeoutMs: 1000 };
const q = (s: string): URLSearchParams => new URLSearchParams(s);
const ETAG = `"cd-${"a".repeat(24)}"`;

type Seen = { url: string; headers: Record<string, string> };
function stub(status: number, body = "", headers: Record<string, string> = {}) {
  const seen: Seen[] = [];
  return {
    seen,
    fetchImpl: (url: string, init: { readonly signal: AbortSignal; readonly headers: Record<string, string> }) => {
      seen.push({ url, headers: init.headers });
      return Promise.resolve({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: () => Promise.resolve(body) });
    },
  };
}
const req = (qs: string, h: Record<string, string> = {}): Request => new Request(`https://viafrei.de/fragment/card?${qs}`, { headers: h });

describe("#939: the card route of the shell", () => {
  it("asks the digest for one card of one place, with pages only when more than one", () => {
    expect(cardRefreshTarget(q("place=koeln&card=stations&lang=de"), o)).toBe("http://digest:8791/internal/place/koeln/card/stations?lang=de");
    expect(cardRefreshTarget(q("place=koeln&card=stations&lang=de&pages=1"), o)).toBe("http://digest:8791/internal/place/koeln/card/stations?lang=de");
    expect(cardRefreshTarget(q("place=koeln&card=stations&lang=de&pages=3"), o)).toBe("http://digest:8791/internal/place/koeln/card/stations?lang=de&pages=3");
    expect(cardRefreshTarget(q("place=koeln&card=stations&lang=de"), { ...o, mapPlatform: "ios" })).toContain("&map=ios");
  });

  it("refuses a malformed request before the digest: the fuel card, an unknown card, a bad place, language or pages", async () => {
    for (const bad of ["place=koeln&card=fuel&lang=de", "place=koeln&card=bogus&lang=de", "place=Köln&card=stations&lang=de", "place=05315000&card=stations&lang=de", "place=koeln&card=stations&lang=xx", "place=koeln&card=stations&lang=de&pages=0", "place=koeln&card=stations&lang=de&pages=x"]) {
      expect(cardRefreshTarget(q(bad), o), bad).toBeNull();
      const s = stub(200, "<article class=\"pcard\"></article>");
      const r = await cardRefreshRoute(req(bad), { ...o, fetchImpl: s.fetchImpl });
      expect(r.status, bad).toBe(400);
      expect(s.seen, bad).toHaveLength(0);
    }
  });

  it("200: the article passed on with its ETag and Stand, revalidated and never indexed", async () => {
    const s = stub(200, '<article class="pcard pcard--info" id="pcard-stations"></article>', { etag: ETAG, "x-fragment-as-of": "2026-10-26T08:00:00.000Z" });
    const r = await cardRefreshRoute(req("place=koeln&card=stations&lang=de"), { ...o, fetchImpl: s.fetchImpl });
    expect(r.status).toBe(200);
    expect(r.headers.get("etag")).toBe(ETAG);
    expect(r.headers.get("x-fragment-as-of")).toBe("2026-10-26T08:00:00.000Z");
    expect(r.headers.get("x-robots-tag")).toBe(CARD_REFRESH_HEADERS["X-Robots-Tag"]);
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
  });

  it("B1: If-None-Match is passed on, and the digest's 304 reaches the browser as a 304 with no body", async () => {
    const s = stub(304, "", { etag: ETAG });
    const r = await cardRefreshRoute(req("place=koeln&card=stations&lang=de", { "if-none-match": ETAG }), { ...o, fetchImpl: s.fetchImpl });
    expect(s.seen[0]!.headers["if-none-match"]).toBe(ETAG);
    expect(r.status).toBe(304);
    expect(await r.text()).toBe("");
  });

  it("a validator that is not the digest's shape is not passed on", async () => {
    const s = stub(200, '<article class="pcard" id="pcard-stations"></article>');
    await cardRefreshRoute(req("place=koeln&card=stations&lang=de", { "if-none-match": '"anything"' }), { ...o, fetchImpl: s.fetchImpl });
    expect(s.seen[0]!.headers["if-none-match"]).toBeUndefined();
  });

  it("a card the place no longer shows is a 404; a body that is not an article a 502; a dead digest a 504 — none kept", async () => {
    expect((await cardRefreshRoute(req("place=koeln&card=stations&lang=de"), { ...o, fetchImpl: stub(404).fetchImpl })).status).toBe(404);
    const wrong = await cardRefreshRoute(req("place=koeln&card=stations&lang=de"), { ...o, fetchImpl: stub(200, "<p>motorway unavailable</p>").fetchImpl });
    expect(wrong.status).toBe(502);
    expect(wrong.headers.get("cache-control")).toBe("no-store");
    const dead = await cardRefreshRoute(req("place=koeln&card=stations&lang=de"), { ...o, fetchImpl: () => Promise.reject(new Error("down")) });
    expect(dead.status).toBe(504);
  });

  it("the page carries the script only when its cards carry their fragment address, and it is the minified one", () => {
    expect(carriesRefresh('<article class="pcard" id="pcard-stations" data-card="/fragment/card?place=koeln&amp;card=stations&amp;lang=de">')).toBe(true);
    expect(carriesRefresh('<article class="pcard" id="pcard-stations">')).toBe(false);
    expect(cardRefreshScript()).toBe(`(${INLINE_SCRIPTS.refresh})();`);
  });
});

describe("#939: the refresh script", () => {
  it("A2: holds no cadence of its own — no value of the digest's table is written in it", () => {
    const values = new Set(Object.values(CARD_REFRESH_SECONDS).filter((x): x is number => x !== null));
    expect(values.size).toBeGreaterThan(0);
    for (const v of values) {
      expect(REFRESH_JS, String(v)).not.toMatch(new RegExp(`\\b${String(v)}\\b`));
      expect(INLINE_SCRIPTS.refresh, String(v)).not.toMatch(new RegExp(`\\b${String(v)}\\b`));
    }
    expect(REFRESH_JS).toContain('getAttribute("data-refresh")');
  });

  it("B3: pauses while the tab is hidden and refreshes once on return when due", () => {
    expect(REFRESH_JS).toContain("if (document.hidden) { s.waiting = true; return; }");
    expect(REFRESH_JS).toContain('"visibilitychange"');
    expect(REFRESH_JS).toContain("if (s.waiting || Date.now() >= s.due) refresh(a, \"auto\");");
  });

  it("B4: a failure keeps the card, says the Stand kept and backs off ×2 up to eight times the cadence", () => {
    const failed = REFRESH_JS.slice(REFRESH_JS.indexOf("}).catch(function () {"));
    expect(failed).toContain("s.fails = Math.min(s.fails + 1, 3)");
    expect(failed).not.toContain("innerHTML");
    expect(REFRESH_JS).toContain("var wait = e * Math.pow(2, s.fails);");
    expect(REFRESH_JS).toContain('.replace("{t}", fmt ? fmt.format(s.asOf) : "")');
    expect(REFRESH_JS).toContain('timeZone: "Europe/Berlin"');
  });

  it("A3, A4, B6: asks the pages it shows, announces only a change, never moves focus, skips a card in use", () => {
    expect(REFRESH_JS).toContain('"&pages=" + n');
    expect(REFRESH_JS).toContain('if (r.status === 304) return { same: true };');
    expect(REFRESH_JS).toContain('if (changed) {\n      say(a.getAttribute("data-updated"));');
    expect(REFRESH_JS).toContain('"aria-live", "polite"');
    expect(REFRESH_JS).toContain("if (focused && own(a)) own(a).focus();");
    expect(REFRESH_JS).toContain("if (a.hidden || inside(a)) { plan(a); return; }");
    expect(REFRESH_JS).toContain('details.pager[data-state=loading]');
    expect(REFRESH_JS).toContain('"If-None-Match"');
  });
});

describe("#939 C4: the card_refresh event", () => {
  it("is built from the script's detail with closed values only", () => {
    expect(cardRefreshEvent({ card: "stations", how: "auto", result: "unchanged" }, "de")).toEqual({ name: "card_refresh", params: { lang: "de", card: "stations", how: "auto", result: "unchanged" } });
    for (const bad of [{ card: "Köln", how: "auto", result: "changed" }, { card: "stations", how: "timer", result: "changed" }, { card: "stations", how: "manual", result: "304" }, null]) {
      expect(cardRefreshEvent(bad, "de"), JSON.stringify(bad)).toBeNull();
    }
  });

  it("an automatic refresh is sampled by the script, one in ten", () => {
    expect(REFRESH_JS).toContain('if (how === "auto" && Math.random() >= 0.1) return;');
  });
});
