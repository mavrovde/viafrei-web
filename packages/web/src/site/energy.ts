/**
 * #1076: one fuel station's page `/<lang>/fuel/<slug>` and one charging site's `/<lang>/charging/<slug>` — English
 * route words in every language (#892). #1200: the slug is the description alone (`aral-nuernberg-fuerther-str`)
 * unless two pages of the kind share it, when each carries the shortest distinguishing key of at least four letters
 * (`canonicalPageSlugs` in `@viafrei/ingest`, `platform/page-slug.ts`). An address published before #1200 — the
 * description and a ten-letter key, `aral-nuernberg-fuerther-str-abcdefghij` — and a renamed page's previous slug
 * are still slugs the shell asks the digest about, which answers them with the move (301) to the current slug.
 *
 * The shell reads no ingest package (A2), so the address rule is stated here a second time; `test/energy-pages.test.ts`
 * holds it equal to the ingest's.
 *
 * The sitemap: `/sitemap-charging.xml` is an index (robots.txt names it, as it names `/sitemap-places.xml`), naming
 * the part files `/sitemap-charging-<lang>-<part>.xml` of every live language. A part is at most `ENERGY_SITEMAP_PART`
 * entries (the digest's own bound), so a file stays far under 1 MB.
 *
 * NO FUEL SITEMAP (#1167, data-steward 2026-11-04 S1): a list of every fuel station's page is the "public list of all
 * stations we hold" the MTS-K terms and the 2026-10-05 ruling forbid, and each slug spells the station's brand, town
 * and street. So no sitemap, index entry, robots line or `llms*.txt` line names a `/<lang>/fuel/<slug>` URL, and
 * `/sitemap-fuel*.xml` answers 404. `SitemapEnergyKind` makes a fuel sitemap a type error.
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS, hasInternalId, isSlug } from "./slug.js";

export type EnergyKind = "fuel" | "charging";
export const ENERGY_KINDS: readonly EnergyKind[] = ["fuel", "charging"];

/** #1167 S1: the kinds whose pages a sitemap lists — charging alone; a fuel station's page is listed nowhere. */
export type SitemapEnergyKind = Exclude<EnergyKind, "fuel">;
export const SITEMAP_ENERGY_KINDS: readonly SitemapEnergyKind[] = ["charging"];

/** The length of the key an address published before #1200 ends with (the ingest's `PAGE_KEY_LEN`). */
export const ENERGY_KEY_LEN = 10;

/** The digest's part bound (`ENERGY_SITEMAP_PART`): the shell refuses a part that is longer. */
export const ENERGY_SITEMAP_PART = 5000;

/** The most parts the shell names per kind and language: 50 × 5000 = 250 000 pages, twice what either list holds. */
export const ENERGY_PARTS_MAX = 50;

/**
 * A slug a page could have (#1200): the slug shape with no internal id (no run of five digits — the slug table's CHECK).
 * A key is no longer required: the canonical slug of a description no other page shares carries none.
 */
export function isEnergySlug(s: string): boolean {
  return isSlug(s) && !hasInternalId(s);
}

export function energyPath(kind: EnergyKind, lang: Lang, slug: string): `/${string}` {
  return `/${lang}/${ROUTE_WORDS[kind]}/${slug}`;
}

/** A kind's index of its part files: `/sitemap-charging.xml`. */
export const energyIndexSitemap = (kind: SitemapEnergyKind): `/${string}` => `/sitemap-${kind}.xml`;

/** One part file: `/sitemap-charging-de-1.xml`. */
export const energyPartSitemap = (kind: SitemapEnergyKind, lang: Lang, part: number): `/${string}` => `/sitemap-${kind}-${lang}-${String(part)}.xml`;
