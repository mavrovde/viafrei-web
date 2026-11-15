/**
 * DB-IP's line (`dbip_city_lite`, CC BY 4.0, credited on every page where the IP lookup ran), as the place block
 * prints it (`components/PlaceBlock.astro`; `test/station-near-1182.test.ts` holds the two equal) — for a page that
 * composes its HTML in code (#1182, the station index).
 */
import { esc } from "@viafrei/design";
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";

export function geoipCreditHtml(lang: Lang): string {
  return (
    `<p class="placebar__credit">${esc(t(lang, "place.geoipCredit"))} <a href="https://db-ip.com" lang="en" rel="noopener noreferrer">IP Geolocation by DB-IP</a> · ` +
    `<a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener noreferrer">CC BY 4.0</a>, ${esc(t(lang, "place.geoipModified"))}</p>`
  );
}
