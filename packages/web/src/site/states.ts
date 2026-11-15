/**
 * The Land pages (#1074): one page per Bundesland, `/<lang>/state/<slug>`, and the index of the sixteen,
 * `/<lang>/states` (`pages.ts` "states") — English route words in every language, the language prefix the only
 * language marker (#892), the slug the Land's German name folded by the one slug rule (`bayern`,
 * `baden-wuerttemberg`). Listed in `/sitemap-states-<lang>.xml`.
 *
 * The table is stated here a second time because the shell reads no ingest package (A2): it is the ingest's `LAENDER`
 * (`packages/ingest/src/domain/places/laender.ts`), and `test/states-1074.test.ts` holds the two equal — slug, ISO code
 * and English name, in AGS order.
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS, slugify } from "./slug.js";

/** The path segment of a Land page: `state` in every language. */
export const STATE_SEGMENT = ROUTE_WORDS.state;

/** The sixteen in AGS order: the slug, the ISO 3166-2 code and the English name — the aliases a reader may type. */
export const STATES: readonly { readonly slug: string; readonly iso: string; readonly nameEn: string }[] = [
  { slug: "schleswig-holstein", iso: "SH", nameEn: "Schleswig-Holstein" },
  { slug: "hamburg", iso: "HH", nameEn: "Hamburg" },
  { slug: "niedersachsen", iso: "NI", nameEn: "Lower Saxony" },
  { slug: "bremen", iso: "HB", nameEn: "Bremen" },
  { slug: "nordrhein-westfalen", iso: "NW", nameEn: "North Rhine-Westphalia" },
  { slug: "hessen", iso: "HE", nameEn: "Hesse" },
  { slug: "rheinland-pfalz", iso: "RP", nameEn: "Rhineland-Palatinate" },
  { slug: "baden-wuerttemberg", iso: "BW", nameEn: "Baden-Württemberg" },
  { slug: "bayern", iso: "BY", nameEn: "Bavaria" },
  { slug: "saarland", iso: "SL", nameEn: "Saarland" },
  { slug: "berlin", iso: "BE", nameEn: "Berlin" },
  { slug: "brandenburg", iso: "BB", nameEn: "Brandenburg" },
  { slug: "mecklenburg-vorpommern", iso: "MV", nameEn: "Mecklenburg-Western Pomerania" },
  { slug: "sachsen", iso: "SN", nameEn: "Saxony" },
  { slug: "sachsen-anhalt", iso: "ST", nameEn: "Saxony-Anhalt" },
  { slug: "thueringen", iso: "TH", nameEn: "Thuringia" },
];

const SLUGS: ReadonlySet<string> = new Set(STATES.map((s) => s.slug));
export const isStateSlug = (s: string): boolean => SLUGS.has(s);

export function statePath(lang: Lang, slug: string): `/${string}` {
  return `/${lang}/${STATE_SEGMENT}/${slug}`;
}

/**
 * Another spelling of a Land, folded, to its slug: the ISO code (`by`, `de-by`), the English name (`bavaria`,
 * `north-rhine-westphalia`), and the German name written without the umlaut's e (`thuringen`, `baden-wurttemberg`).
 */
const ALIASES: ReadonlyMap<string, string> = new Map(
  STATES.flatMap((s) => [
    [s.iso.toLowerCase(), s.slug],
    [`de-${s.iso.toLowerCase()}`, s.slug],
    [slugify(s.nameEn), s.slug],
    [s.slug.replace(/ue/g, "u"), s.slug],
  ]).filter(([alias, slug]) => alias !== slug) as [string, string][],
);

/**
 * What a Land address's segment names: the slug as it is, another spelling of one to 301 to (`Bayern`, `BY`,
 * `bavaria`, `Thüringen`), or nothing.
 */
export function stateAddress(raw: string): { readonly kind: "slug"; readonly slug: string } | { readonly kind: "respell"; readonly slug: string } | { readonly kind: "none" } {
  if (isStateSlug(raw)) return { kind: "slug", slug: raw };
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: "none" };
  }
  if (decoded.length > 60) return { kind: "none" };
  const folded = slugify(decoded);
  if (isStateSlug(folded)) return { kind: "respell", slug: folded };
  const alias = ALIASES.get(folded);
  return alias === undefined ? { kind: "none" } : { kind: "respell", slug: alias };
}
