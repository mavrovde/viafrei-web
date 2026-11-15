/**
 * #1158: the digest's station line now links its station page with its point and kind beside it. The header's merge
 * must keep it in the place list (the island keeps it as a station), while the site search's own station links, with
 * no point beside them, stay ordinary links that are followed and never stored.
 */
import { afterEach, describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";
import { isPlaceLine, mergeSuggest, placeLinesOf } from "../src/lib/header-suggest.js";
import { renderSuggestions } from "../../../.pinned/app/packages/digest/dist/src/presentation/place-suggest-html.js";
import { resetStationSlugs, setStationSlugs } from "../../../.pinned/app/packages/digest/dist/src/analysis/station-slugs.js";

const station = { kind: "station", name: "Köln Hbf", town: "Köln", lat: 50.94303, lon: 6.95873 } as const;

describe("#1158 a station's place line survives the header's merge, with its point and kind", () => {
  afterEach(() => resetStationSlugs());

  it("the digest's own line (its page, its point, its kind) is a place line; a bare station link is not", () => {
    setStationSlugs([{ slug: "koeln-hbf", ifopt: "de:05315:11201", name: "Köln Hbf", lat: 50.9431, lon: 6.9586 }]);
    const html = renderSuggestions("de", "Köln Hbf", [station]);
    const items = placeLinesOf(html)?.items ?? [];
    expect(items).toHaveLength(1);
    expect(isPlaceLine(items[0] ?? "")).toBe(true);
    expect(isPlaceLine('<li class="place-sug"><a class="place-opt" href="/de/station/koeln-hbf"><span class="place-opt__name">Köln Hbf</span></a></li>')).toBe(false);
    // a data-at that is no point does not make a station link a place
    expect(isPlaceLine('<li class="place-sug"><a class="place-opt" href="/de/station/koeln-hbf" data-at="javascript:x" data-kind="station">x</a></li>')).toBe(false);
  });

  it("merged, the line keeps its link, its point and its kind for the island", () => {
    setStationSlugs([{ slug: "koeln-hbf", ifopt: "de:05315:11201", name: "Köln Hbf", lat: 50.9431, lon: 6.9586 }]);
    const merged = mergeSuggest("de", "Köln Hbf", renderSuggestions("de", "Köln Hbf", [station]), null);
    const a = all(merged, "a.place-opt").find((x) => x.attrs["data-kind"] === "station");
    expect(a?.attrs["href"]).toBe("/de/station/koeln-hbf");
    expect(a?.attrs["data-at"]).toMatch(/^pt:50\.94\d*,6\.95\d*$/);
  });
});
