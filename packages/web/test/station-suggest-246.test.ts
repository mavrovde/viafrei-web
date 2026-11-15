/**
 * 2.4.6 review: the station search as the shell writes it and the route that answers its suggestions.
 *
 * 1. The home block's error state carries the station search (`lib/station-top.ts`), which the shell must write itself
 *    because the digest did not answer — so it is a second copy of the digest's `stationSearchForm`. The shell imports
 *    no digest module at run time; this test holds the two equal, byte for byte, in every language.
 * 2. `POST /fragment/station-suggest` (`stationSuggestRoute`): POST only, a known language and a string `q`, the digest's
 *    list through, a 502 when the digest does not answer — never stored.
 */
import { describe, expect, it } from "vitest";
import { stationSearchForm } from "../../digest/src/presentation/station-top-html.js";
import { renderStationSuggest } from "../../digest/src/presentation/station-page-html.js";
import { stationSuggestRoute } from "../src/lib/fragment-route.js";
import { stationTopError } from "../src/lib/station-top.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import type { FetchLike } from "../src/lib/tiles.js";

describe("the home block's station search is the digest's own form (2.4.6 review 1)", () => {
  for (const lang of LIVE_LANGS) {
    it(lang, () => {
      const form = /<form class="station-top__search"[\s\S]*?<\/form>/u.exec(stationTopError(lang))?.[0];
      expect(form, lang).toBe(stationSearchForm(lang, "station-top-q"));
    });
  }
});

const LIST = renderStationSuggest("de", [], "Kö");
function digest(asked: string[], status = 200, body = LIST): FetchLike {
  return (url) => {
    asked.push(url);
    return Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(body) });
  };
}
const req = (body: unknown, method = "POST"): Request =>
  new Request("http://shell/fragment/station-suggest", method === "POST" ? { method, headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) } : { method });
const o = (asked: string[], status = 200, body = LIST): { baseUrl: string; timeoutMs: number; fetchImpl: FetchLike } => ({ baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest(asked, status, body) });

describe("POST /fragment/station-suggest (2.4.6 review 2)", () => {
  it("answers the digest's list for what was typed, in the asked language, never stored", async () => {
    const asked: string[] = [];
    const res = await stationSuggestRoute(req({ q: " Kö ", lang: "en" }), o(asked));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(LIST);
    expect(asked).toEqual(["http://digest/internal/station-suggest?q=K%C3%B6&lang=en"]);
  });
  for (const method of ["GET", "HEAD", "PUT"]) {
    it(`${method} is a 405 and asks the digest nothing`, async () => {
      const asked: string[] = [];
      const res = await stationSuggestRoute(req(null, method), o(asked));
      expect(res.status).toBe(405);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(asked).toEqual([]);
    });
  }
  for (const [what, body] of [
    ["an unknown language", { q: "Köln", lang: "xx" }],
    ["no language", { q: "Köln" }],
    ["a q that is a number", { q: 42, lang: "de" }],
    ["no q", { lang: "de" }],
    ["a body that is not JSON", "q=Köln&lang=de"],
  ] as const) {
    it(`${what} is a 400 and asks the digest nothing`, async () => {
      const asked: string[] = [];
      const res = await stationSuggestRoute(req(body), o(asked));
      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(asked).toEqual([]);
    });
  }
  it("a digest that fails, answers a 500 or something that is not the list is a 502, never stored", async () => {
    for (const d of [o([], 500), o([], 200, "<p>nope</p>"), { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: (() => Promise.reject(new Error("down"))) as FetchLike }]) {
      const res = await stationSuggestRoute(req({ q: "Köln", lang: "de" }), d);
      expect(res.status).toBe(502);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("one character or more than sixty is no question for the digest: a 502, nothing asked", async () => {
    for (const q of ["K", "x".repeat(61)]) {
      const asked: string[] = [];
      expect((await stationSuggestRoute(req({ q, lang: "de" }), o(asked))).status).toBe(502);
      expect(asked).toEqual([]);
    }
  });
});
