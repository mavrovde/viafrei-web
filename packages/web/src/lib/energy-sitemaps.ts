/**
 * #1076: the routes of the charging pages' sitemaps, as functions of the request (the tests drive them without Astro).
 * There is no fuel sitemap (#1167, data-steward 2026-11-04 S1): `SitemapEnergyKind` is charging alone.
 *
 *  - `/sitemap-<kind>.xml`: the index of the kind's part files in every live language, as many as the digest counts
 *    (its part 1's `Energy-Parts`);
 *  - `/sitemap-<kind>-<lang>-<part>.xml`: one part, at most `ENERGY_SITEMAP_PART` entries.
 *
 * The digest not answering, or answering anything but the list's shape, is the last body built for that address
 * (#1205, `sitemap-held.ts`), else a 503 — never an empty or a shorter
 * urlset, which would tell an index that the pages are gone. A part past the count is a 404.
 */
import { isLang } from "../i18n/index.js";
import { ENERGY_PARTS_MAX, type SitemapEnergyKind } from "../site/energy.js";
import { energyPartFiles, energyPartXml, sitemapIndexXml } from "../site/sitemaps.js";
import { ENERGY_LIST_TIMEOUT_MS, fetchEnergyList } from "./energy-page.js";
import type { FetchLike } from "./tiles.js";

import { sitemapAnswer } from "./sitemap-held.js";

export type EnergySitemapOptions = { readonly baseUrl: string; readonly fetchImpl?: FetchLike };

const listOptions = (o: EnergySitemapOptions) => ({ baseUrl: o.baseUrl, timeoutMs: ENERGY_LIST_TIMEOUT_MS, ...(o.fetchImpl === undefined ? {} : { fetchImpl: o.fetchImpl }) });

/** How many parts the digest counts for a kind, or null when it does not answer. */
export async function energyParts(kind: SitemapEnergyKind, o: EnergySitemapOptions): Promise<number | null> {
  const first = await fetchEnergyList(kind, 1, listOptions(o));
  return first === null ? null : first.parts;
}

export async function energyIndexRoute(kind: SitemapEnergyKind, o: EnergySitemapOptions): Promise<Response> {
  const parts = await energyParts(kind, o);
  // #1205: the digest not answering serves the last index this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-${kind}`, parts === null || parts === 0 ? null : sitemapIndexXml(energyPartFiles(kind, parts)));
}

export async function energyPartRoute(kind: SitemapEnergyKind, lang: string, rawPart: string, o: EnergySitemapOptions): Promise<Response> {
  if (!isLang(lang) || !/^[1-9][0-9]{0,2}$/.test(rawPart) || Number(rawPart) > ENERGY_PARTS_MAX) return new Response(null, { status: 404 });
  const part = Number(rawPart);
  const list = await fetchEnergyList(kind, part, listOptions(o));
  if (list !== null && part > list.parts) return new Response(null, { status: 404 });
  return sitemapAnswer(`sitemap-${kind}-${lang}-${String(part)}`, list === null ? null : energyPartXml(kind, lang, list.entries));
}
