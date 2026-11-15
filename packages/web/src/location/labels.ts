/**
 * The island's labels for one language, from the catalogue (PlaceBlock.astro prints them into the page). One home, so
 * `test/location.test.ts` measures the island's budget with the labels that actually ship in every language.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import type { IslandLabels } from "./island.js";

export function islandLabels(lang: Lang): IslandLabels {
  return {
    exact: t(lang, "place.how.exact"),
    approx: t(lang, "place.how.approx"),
    rough: t(lang, "place.how.rough"),
    chosen: t(lang, "place.how.chosen"),
    germany: t(lang, "place.germany"),
    choose: t(lang, "place.choose"),
    loaded: t(lang, "place.loaded", { place: "{place}" }),
    failed: t(lang, "place.failed"),
    noGeo: t(lang, "place.noGeo"),
    locating: t(lang, "place.locating"),
    recent: t(lang, "place.bar.recent"),
    drop: t(lang, "place.bar.drop", { place: "{place}" }),
    found: t(lang, "place.bar.found", { n: "{n}" }),
    geoNo: t(lang, "place.geoNo", { why: "{why}", place: "{place}" }),
    geoDenied: t(lang, "place.geoDenied"),
    geoUnavailable: t(lang, "place.geoUnavailable"),
    geoTimeout: t(lang, "place.geoTimeout"),
    geoApprox: t(lang, "place.geoApprox"),
  };
}
