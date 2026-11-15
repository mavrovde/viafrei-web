/**
 * #1061: the public card fragment route `/fragment/more` — a malformed request is 400, a bad `from` is the start, a
 * 409 (the summary version moved) passes through so the pager restarts, a body that is not a card list is 502, and
 * every answer is noindex; the pager script is the minified one and keeps its hooks.
 */
import { all, text } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { CARD_MORE_HEADERS, cardMoreRoute, cardMoreTarget, cardPagerScript, carriesPager, placeOpenOf } from "../src/lib/card-more.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { motorwayChoice } from "../src/lib/motorway.js";

const o = { baseUrl: "http://digest:8791", timeoutMs: 1000 };
const q = (s: string): URLSearchParams => new URLSearchParams(s);

function stub(status: number, body = ""): { calls: string[]; fetchImpl: NonNullable<Parameters<typeof cardMoreRoute>[1]["fetchImpl"]> } {
  const calls: string[] = [];
  return {
    calls,
    fetchImpl: (url) => {
      calls.push(url);
      return Promise.resolve({ status, headers: { get: () => null }, text: () => Promise.resolve(body) });
    },
  };
}

describe("the card fragment route (#1061)", () => {
  it("asks the digest for the card's next entries, pinned to the version", () => {
    expect(cardMoreTarget(q("road=A3&card=roadworks&lang=de&from=13&v=42"), o)).toBe("http://digest:8791/internal/motorway/A3/more/roadworks?lang=de&from=13&v=42");
  });

  it("a negative, empty or non-numeric from is the start; a malformed road, card or language is refused", () => {
    for (const f of ["-3", "", "abc", "0"]) expect(cardMoreTarget(q(`road=A3&card=roadworks&lang=de&from=${f}`), o), f).toContain("&from=1");
    expect(cardMoreTarget(q("road=B3&card=roadworks&lang=de"), o)).toBeNull();
    expect(cardMoreTarget(q("road=A3&card=../x&lang=de"), o)).toBeNull();
    expect(cardMoreTarget(q("road=A3&card=roadworks&lang=xx"), o)).toBeNull();
  });

  it("200 with a card list: passed on, cached a minute, noindex", async () => {
    const s = stub(200, '<ul class="pcard__list motorway__list"><li>x</li></ul>');
    const r = await cardMoreRoute(new Request("https://viafrei.de/fragment/more?road=A3&card=roadworks&lang=de&from=13&v=1"), { ...o, fetchImpl: s.fetchImpl });
    expect(r.status).toBe(200);
    expect(r.headers.get("x-robots-tag")).toBe(CARD_MORE_HEADERS["X-Robots-Tag"]);
    expect(r.headers.get("cache-control")).toBe("public, max-age=60");
    expect(all(await r.text(), "li").map(text)).toEqual(["x"]);
  });

  it("409 passes through (the pager restarts), 404 stays 404, another body is 502, a bad request 400", async () => {
    const req = new Request("https://viafrei.de/fragment/more?road=A3&card=roadworks&lang=de&from=13&v=1");
    expect((await cardMoreRoute(req, { ...o, fetchImpl: stub(409).fetchImpl })).status).toBe(409);
    expect((await cardMoreRoute(req, { ...o, fetchImpl: stub(404).fetchImpl })).status).toBe(404);
    expect((await cardMoreRoute(req, { ...o, fetchImpl: stub(200, "<p>motorway unavailable</p>").fetchImpl })).status).toBe(502);
    expect((await cardMoreRoute(req, { ...o, fetchImpl: stub(500).fetchImpl })).status).toBe(502);
    expect((await cardMoreRoute(new Request("https://viafrei.de/fragment/more?road=A3"), { ...o, fetchImpl: stub(200).fetchImpl })).status).toBe(400);
  });

  it("the no-script ?<card>=N reaches the digest as a choice; ?roadworks=1 and other values do not", () => {
    expect(motorwayChoice(q("roadworks=2"))).toContain("roadworks=2");
    expect(motorwayChoice(q("roadworks=1"))).not.toContain("roadworks");
    expect(motorwayChoice(q("roadworks=x"))).not.toContain("roadworks");
  });

  it("a place page's card (#1061 \"the same rules for the places pages also\"): its own digest route; a bad slug or card, or road and place together, refused", () => {
    expect(cardMoreTarget(q("place=koeln&card=neighbours&lang=tr&from=13&v=4242"), o)).toBe("http://digest:8791/internal/place/koeln/neighbours?lang=tr&from=13&v=4242");
    expect(cardMoreTarget(q("place=koeln&card=neighbours&lang=de&from=-1"), o)).toContain("&from=1");
    for (const bad of ["place=K%C3%B6ln&card=neighbours&lang=de", "place=koeln&card=roadworks&lang=de", "place=koeln&road=A3&card=roads&lang=de", "place=../x&card=roads&lang=de", "card=roads&lang=de"]) expect(cardMoreTarget(q(bad), o), bad).toBeNull();
  });

  it("a place page's no-script ?<card>=N is the digest's open=<card>:<N>; ?roads=1, a value or a card it does not know are nothing", () => {
    expect(placeOpenOf(q("roads=2"))).toBe("roads:2");
    expect(placeOpenOf(q("neighbours=12"))).toBe("neighbours:12");
    for (const x of ["roads=1", "roads=x", "roads=100", "roadworks=2", "fuel=2", ""]) expect(placeOpenOf(q(x)), x).toBeNull();
  });

  it("the pager script: the minified text, called with nothing; a page carries it only with a pager fold", () => {
    expect(cardPagerScript()).toBe(`(${INLINE_SCRIPTS.pager})();`);
    for (const x of ["data-more", "toggle", "vf-pager-live", "aria-live", "focus", "location.reload"]) expect(INLINE_SCRIPTS.pager, x).toContain(x);
    expect(carriesPager('<details class="pcard__more pager" data-more="/x">')).toBe(true);
    expect(carriesPager('<details class="pcard__more">')).toBe(false);
  });
});
