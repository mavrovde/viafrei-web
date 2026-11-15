/**
 * #1182: the station catalogue in the owner's order — the search, then the stations most delayed now, then the
 * catalogue by Land — composed by the shell from the digest's two fragments (`withStationTop`). The block's own search
 * and its link to the catalogue are dropped (the page is the catalogue and already opens with its search); a block in
 * its error state is left out; a catalogue fragment without its search is left as it is.
 *
 * Mutant (alone, this file run, restored): the block inserted before the search (`slice(0, at.index)`) → "the order" red.
 */
import { describe, expect, it } from "vitest";
import { withStationTop } from "../src/lib/station-top.js";

const INDEX =
  `<section class="stpage-index" id="station-index"><p class="lead">5.400 Bahnhöfe</p>` +
  `<form class="stpage-search" method="get" action="/de/station" role="search"><input name="q"></form>` +
  `<h2>Die größten Bahnhöfe</h2><section class="stpage-land"><h3>Bayern</h3></section></section>`;
const TOP =
  `<section class="station-top" id="station-top" aria-labelledby="station-top-t"><h2 class="station-top__h" id="station-top-t">Bahnhöfe jetzt</h2>` +
  `<ol class="station-top__list"><li>München Hbf · 12 Ausfälle</li></ol>` +
  `<form class="station-top__search" method="get" action="/de/station" role="search"><input name="q"></form>` +
  `<p class="station-top__cta"><a class="btn btn--primary" href="/de/station">Alle 5.400 Bahnhöfe →</a></p></section>`;

describe("the station catalogue's order (#1182)", () => {
  it("the order: search, then the most delayed, then the catalogue by Land", () => {
    const html = withStationTop(INDEX, { kind: "ok", html: TOP });
    const search = html.indexOf('class="stpage-search"');
    const top = html.indexOf('id="station-top"');
    const land = html.indexOf('class="stpage-land"');
    expect(search).toBeGreaterThan(-1);
    expect(search).toBeLessThan(top);
    expect(top).toBeLessThan(land);
    // one search on the page, and no link from the catalogue to itself
    expect(html.match(/role="search"/g)).toHaveLength(1);
    expect(html).not.toContain("station-top__cta");
    expect(html).toContain("München Hbf · 12 Ausfälle");
  });

  it("a kept block is used like a fresh one; an error block and a fragment without its search change nothing", () => {
    expect(withStationTop(INDEX, { kind: "kept", html: TOP })).toContain('id="station-top"');
    expect(withStationTop(INDEX, { kind: "error", html: TOP })).toBe(INDEX);
    const noSearch = INDEX.replace(/<form[\s\S]*?<\/form>/u, "");
    expect(withStationTop(noSearch, { kind: "ok", html: TOP })).toBe(noSearch);
  });
});
