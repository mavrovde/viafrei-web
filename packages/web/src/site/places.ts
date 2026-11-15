/**
 * The place pages of #564 § 5, since #892 `/<lang>/place/<slug>` in every
 * language, the slug the one `place_slugs` stores for the Gemeinde (the
 * official German name through THE builder, `site/slug.ts`, with the
 * shortest qualifier a namesake needs). The digest builds the same paths for
 * its links (`packages/digest/src/presentation/place-tiles.ts` placePath);
 * `test/location.test.ts` pins the two together, because the site may not
 * import the digest at runtime.
 *
 * Dynamic pages, so they are not rows of `pages.ts` (whose ids are fixed and
 * whose paths are probed on every deploy): the sitemap lists them from the
 * digest's index, every Gemeinde of 10 000 people or more (owner 2026-10-11).
 * The AGS appears in no address (#892); the pre-#892 addresses carrying it are
 * temporary 301s (`legacy-redirects.ts`, removed by #898).
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS, isSlug, slugify } from "./slug.js";

/**
 * The place pages a name alone asks for (#739): `/de/ort/koeln` (now `/de/place/koeln`) was opened by
 * people and assistants guessing the address, and answered 404. One national
 * rule over the index, no list of cities: the name is folded like a slug
 * (`slugify`), and a place matches when its slug IS that fold,
 * or, when none is, STARTS with it followed by a dash ("frankfurt" →
 * Frankfurt am Main and Frankfurt (Oder)). The caller redirects on exactly one
 * match and offers the choice on several, at most `PLACE_NAME_CHOICES`.
 */
export function placesByName<T extends { readonly slug: string }>(index: readonly T[], asked: string): T[] {
  const fold = slugify(asked);
  if (fold === "" || /^\d/.test(fold)) return [];
  const exact = index.filter((e) => e.slug === fold);
  if (exact.length > 0) return exact.slice(0, PLACE_NAME_CHOICES);
  // The prefix arm needs a word of PLACE_NAME_PREFIX_MIN letters: "bad" or "st" names no place, it begins
  // dozens. A longer generic first word ("sankt") still lists its towns on the 404 page, which is harmless.
  if (fold.length < PLACE_NAME_PREFIX_MIN) return [];
  return index.filter((e) => e.slug.startsWith(`${fold}-`)).slice(0, PLACE_NAME_CHOICES);
}

/** The shortest name that may stand for the places it begins (#739): "bad", "st", "ober" stand for none. */
export const PLACE_NAME_PREFIX_MIN = 5;

/** The most places a name-only address offers (#739): Neustadt has eight place pages, and a longer list is a search, not a choice. */
export const PLACE_NAME_CHOICES = 12;

/** The path segment of a place page: `place` in every language (#892). */
export const PLACE_SEGMENT = ROUTE_WORDS.place;

export function placePath(lang: Lang, slug: string): `/${string}` {
  return `/${lang}/${PLACE_SEGMENT}/${slug}`;
}

/** Whether a path segment can be a place slug at all (#892): the builder's shape, and no internal id. */
export const isPlaceSlug = (s: string): boolean => isSlug(s) && !/\d{5}/.test(s);

/**
 * The chips of the sheet and the outside-Germany hero: the largest cities, by
 * AGS. A fixed list (names are proper names and are not translated); the cards
 * behind each come from the digest like any other place. Each one's page slug
 * is its name through the builder (`popularSlug`): none of the twelve shares
 * its name with another Gemeinde, so that IS its stored slug.
 */
export const POPULAR_PLACES: readonly { readonly ags: string; readonly name: string }[] = [
  { ags: "11000000", name: "Berlin" },
  { ags: "02000000", name: "Hamburg" },
  { ags: "09162000", name: "München" },
  { ags: "05315000", name: "Köln" },
  { ags: "06412000", name: "Frankfurt am Main" },
  { ags: "08111000", name: "Stuttgart" },
  { ags: "05111000", name: "Düsseldorf" },
  { ags: "14713000", name: "Leipzig" },
  { ags: "05913000", name: "Dortmund" },
  { ags: "05113000", name: "Essen" },
  { ags: "04011000", name: "Bremen" },
  { ags: "14612000", name: "Dresden" },
];

/** A popular place's page slug (#892): its name through the builder. */
export const popularSlug = (p: { readonly name: string }): string => slugify(p.name);
