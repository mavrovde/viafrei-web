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
 * NO ENERGY SITEMAP (#49 A): the charging pages' part files (`/sitemap-charging.xml` and
 * `/sitemap-charging-<lang>-<part>.xml`, #1076) are retired — about 1.84 million URLs across 22 languages took most of a
 * search engine's crawl for discovery. The pages answer 200 and stay linked from their place, station and motorway
 * pages; the sitemap addresses answer 404.
 *
 * NO FUEL SITEMAP (#1167, data-steward 2026-11-04 S1): a list of every fuel station's page is the "public list of all
 * stations we hold" the MTS-K terms and the 2026-10-05 ruling forbid, and each slug spells the station's brand, town
 * and street. So no sitemap, index entry, robots line or `llms*.txt` line names a `/<lang>/fuel/<slug>` URL, and
 * `/sitemap-fuel*.xml` answers 404.
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS, hasInternalId, isSlug } from "./slug.js";

export type EnergyKind = "fuel" | "charging";
export const ENERGY_KINDS: readonly EnergyKind[] = ["fuel", "charging"];

/** The length of the key an address published before #1200 ends with (the ingest's `PAGE_KEY_LEN`). */
export const ENERGY_KEY_LEN = 10;

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

