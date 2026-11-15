/**
 * #938 E1 in the shell: a stop's next departures go through the ONE card fragment route `/fragment/more`
 * (`card=departures`, English words) — the stop and the cursor validated here (#938 B3), asked of the digest
 * directly (a live list after a person's cursor: past the fragment cache), answered no-store and noindex; the place
 * page's no-script `?stop=<id>&departures=N` reaches the digest as `open=departures:N@<id>`; the card refresh keeps a
 * stop's opened steps; and the pager script is unchanged — no new script carries the steps.
 */
import { describe, expect, it } from "vitest";
import { CARD_MORE_HEADERS, DEPARTURES_MORE_HEADERS, cardMoreRoute, cardMoreTarget, carriesDeparturesFold, carriesPager, placeOpenOf } from "../src/lib/card-more.js";
import { REFRESH_JS } from "../src/lib/card-refresh.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";

const o = { baseUrl: "http://digest:8791", timeoutMs: 1000 };
const q = (s: string): URLSearchParams => new URLSearchParams(s);
const STOP = encodeURIComponent("de:05315:11201");
const AFTER = "0.1793000000.dDE";

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

describe("#938 E1: a stop's next departures through /fragment/more", () => {
  it("asks the digest's departures route of the place, with the stop and the cursor", () => {
    expect(cardMoreTarget(q(`place=koeln&card=departures&lang=tr&stop=${STOP}&after=${AFTER}`), o)).toBe(`http://digest:8791/internal/place/koeln/departures?lang=tr&stop=${STOP}&after=${AFTER}`);
  });

  it("B3: a missing or malformed stop or cursor, a road, or an unknown place is refused before the digest is asked", () => {
    for (const bad of [
      `place=koeln&card=departures&lang=de&stop=${STOP}`,
      `place=koeln&card=departures&lang=de&after=${AFTER}`,
      `place=koeln&card=departures&lang=de&stop=${STOP}&after=garbage`,
      `place=koeln&card=departures&lang=de&stop=${STOP}&after=1.17.dDE`,
      `place=koeln&card=departures&lang=de&stop=..%2Fx&after=${AFTER}`,
      `place=koeln&card=departures&lang=de&stop=a%20b&after=${AFTER}`,
      `road=A3&card=departures&lang=de&stop=${STOP}&after=${AFTER}`,
      `place=K%C3%B6ln&card=departures&lang=de&stop=${STOP}&after=${AFTER}`,
      `place=koeln&card=departures&lang=xx&stop=${STOP}&after=${AFTER}`,
    ]) {
      expect(cardMoreTarget(q(bad), o), bad).toBeNull();
    }
  });

  it("200: passed on no-store and noindex, asked directly of the digest (never through the fragment cache)", async () => {
    // the digest's step as it writes it (#1115 B): the stop's board, its header for a screen reader only
    const s = stub(200, '<table class="pcard__board"><thead class="visually-hidden"><tr><th scope="col">Zeit</th></tr></thead><tbody><tr class="pcard__dep"><td>x</td></tr></tbody></table>');
    const r = await cardMoreRoute(new Request(`https://viafrei.de/fragment/more?place=koeln&card=departures&lang=de&stop=${STOP}&after=${AFTER}`), { ...o, fragmentUrl: "http://fragcache:8080", fetchImpl: s.fetchImpl });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe(CARD_MORE_HEADERS["X-Robots-Tag"]);
    expect(DEPARTURES_MORE_HEADERS["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(s.calls).toEqual([`http://digest:8791/internal/place/koeln/departures?lang=de&stop=${STOP}&after=${AFTER}`]);
  });

  it("a refused request is a 400, a stop the card does not list a 404, a failed read a 502 — every refusal no-store", async () => {
    const url = `https://viafrei.de/fragment/more?place=koeln&card=departures&lang=de&stop=${STOP}&after=${AFTER}`;
    expect((await cardMoreRoute(new Request(url.replace(AFTER, "x")), { ...o, fetchImpl: stub(200).fetchImpl })).status).toBe(400);
    const missing = await cardMoreRoute(new Request(url), { ...o, fetchImpl: stub(404).fetchImpl });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect((await cardMoreRoute(new Request(url), { ...o, fetchImpl: stub(500).fetchImpl })).status).toBe(502);
    expect((await cardMoreRoute(new Request(url), { ...o, fetchImpl: stub(200, "<p>place unavailable</p>").fetchImpl })).status).toBe(502);
    // a list is another card's page, never a departures step
    expect((await cardMoreRoute(new Request(url), { ...o, fetchImpl: stub(200, '<ul class="pcard__list"><li>x</li></ul>').fetchImpl })).status).toBe(502);
  });

  it("the no-script ?stop=<id>&departures=N (1..6) is the digest's open=departures:N@<id>; anything else is nothing", () => {
    expect(placeOpenOf(q("stop=de:05315:11201&departures=1"))).toBe("departures:1@de:05315:11201");
    expect(placeOpenOf(q("departures=6&stop=de:05315:11201"))).toBe("departures:6@de:05315:11201");
    for (const x of ["departures=2", "stop=de:05315:11201", "stop=de:05315:11201&departures=0", "stop=de:05315:11201&departures=7", "stop=a/b&departures=2", "stop=de:05315:11201&departures=x"]) {
      expect(placeOpenOf(q(x)), x).toBeNull();
    }
    // a card's own ?<card>=N is unchanged
    expect(placeOpenOf(q("stations=2"))).toBe("stations:2");
  });
});

describe("#938 E1: the scripts carry the steps without a new one", () => {
  it("the pager script loads any `details.pager` with its `data-more` — the departures fold is one; no departures word in it", () => {
    expect(INLINE_SCRIPTS.pager).toContain("details.pager");
    expect(INLINE_SCRIPTS.pager).not.toContain("departures");
  });

  it("a stop's departures fold is no card pager: the home keeps its seven scripts, a place page carries the pager for it", async () => {
    const deps = '<details class="pcard__more pager" data-deps="1" data-more="/fragment/more?card=departures">';
    expect(carriesPager(deps)).toBe(false);
    expect(carriesDeparturesFold(deps)).toBe(true);
    expect(carriesPager(`${deps}<details class="pcard__more pager" data-more="/x">`)).toBe(true);
    expect(carriesDeparturesFold('<details class="pcard__more pager" data-more="/x">')).toBe(false);
    const { readFileSync } = await import("node:fs");
    const block = readFileSync(new URL("../src/components/PlaceBlock.astro", import.meta.url), "utf8");
    expect(block).toContain('(carriesPager(place?.html ?? "") || (source === "page" && carriesDeparturesFold(place?.html ?? "")))');
  });

  it("the card refresh counts a stop's steps as no page of the card, and waits while one is open (a person's reading)", () => {
    expect(REFRESH_JS).toContain("details.pager[data-state=done]:not([data-deps])");
    expect(REFRESH_JS).toContain("details.pager[data-deps][data-state=done]");
    expect(JSON.stringify(INLINE_SCRIPTS)).toContain("data-deps");
  });
});
