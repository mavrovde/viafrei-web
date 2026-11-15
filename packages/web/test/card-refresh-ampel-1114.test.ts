/**
 * #1114 (2.5.8, plan §9.4): the place's and the station's Ampel (with its map) refresh in place through the shell's
 * card route, like a card — and, having no pages, never with `pages`. The Ampel stays a region (a card is an article,
 * and several readers count the articles), so the route's shape check and the script's selectors take a `.pcard[data-card]`
 * of either. Each case names the mutant it was proved red against.
 */
import { describe, expect, it } from "vitest";
import { REFRESH_JS, cardRefreshRoute, cardRefreshTarget } from "../src/lib/card-refresh.js";

const o = { baseUrl: "http://digest:8791", timeoutMs: 1000 };
const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe("#1114: the Ampel's refresh through the shell", () => {
  // mutant M-R1: the Ampel left out of the cards a refresh may ask for
  it("a place's and a station's Ampel are asked of the digest's own Ampel routes", () => {
    expect(cardRefreshTarget(q("place=koeln&card=ampel&lang=de"), o)).toBe("http://digest:8791/internal/place/koeln/card/ampel?lang=de");
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=ampel&lang=en"), o)).toBe("http://digest:8791/internal/station/koeln-hbf/area/ampel?lang=en");
  });
  it("never with pages, never as a station's live card", () => {
    expect(cardRefreshTarget(q("place=koeln&card=ampel&lang=de&pages=2"), o)).toBeNull();
    expect(cardRefreshTarget(q("station=koeln-hbf&area=1&card=ampel&lang=de&pages=2"), o)).toBeNull();
    expect(cardRefreshTarget(q("station=koeln-hbf&card=ampel&lang=de"), o)).toBeNull();
  });
  // mutant M-R6: the route's shape check left at `<article` (every Ampel refresh a 502)
  it("the digest's Ampel region passes the route's shape check", async () => {
    const body = `<div role="region" class="pcard pcard--clear ampel ampel--green place-ampel" id="place-ampel" aria-labelledby="pampel-h" data-card="/fragment/card?place=koeln&amp;card=ampel&amp;lang=de" data-refresh="120"><p>x</p></div>`;
    const fetchImpl = () => Promise.resolve({ status: 200, headers: { get: () => null }, text: () => Promise.resolve(body) });
    const r = await cardRefreshRoute(new Request("https://viafrei.de/fragment/card?place=koeln&card=ampel&lang=de"), { ...o, fetchImpl });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(body);
  });
  // mutant M-R7: the script's selectors left at `article.pcard[data-card]` (the Ampel never planned nor clicked)
  it("the script plans, clicks and resumes every .pcard[data-card], not the articles alone", () => {
    expect(REFRESH_JS.match(/querySelectorAll\("\.pcard\[data-card\]"\)/gu)).toHaveLength(2);
    expect(REFRESH_JS).toContain('l.closest(".pcard[data-card]")');
    expect(REFRESH_JS).not.toMatch(/querySelectorAll\("article\.pcard\[data-card\]"\)/u);
  });
});
