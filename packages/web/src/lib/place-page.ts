/**
 * What a place-page address resolves to (#564 § 5), decided before anything
 * renders — Astro lets only a PAGE answer with a redirect or a rewrite, so the
 * two page files call this and act on it.
 */
import type { Lang } from "../site/pages.js";
import { isPlaceSlug, placePath, placesByName } from "../site/places.js";
import { fetchPlaceIndex, placeKeyOfSlug, placeNameOfSlug, type PlaceFragment, type PlaceIndexEntry } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";
import { CARDS_MIN_MS, placeCardsPlaceholder, placeFirstRender, type FirstRenderOptions } from "./place-first.js";
import { budgetLeft, pageBudgetMs, withinBudget } from "./page-budget.js";
import type { AskingRequest } from "./fuel-refresh.js";
import { esc } from "@viafrei/design";
import { t } from "../i18n/index.js";

export type PlacePageAnswer =
  | { readonly kind: "missing" }
  /** The place could not be identified (the slug's key did not arrive in time): a 503, never a 404 that would tell an index the place is gone. */
  | { readonly kind: "unavailable" }
  /** `temporary`: a name-only match (#739), a 302, because a second place of that name may join the index later and a cached 301 would hide the choice for ever. */
  | { readonly kind: "redirect"; readonly to: `/${string}`; readonly temporary?: true }
  /** A name alone that several place pages carry (#739): the 404 page lists them, in the page's language. */
  | { readonly kind: "choice"; readonly options: readonly { readonly name: string; readonly path: `/${string}` }[] }
  /**
   * #1166: when the cards were late or did not arrive, `place.html` is the placeholder the page's filler fetches
   * (`placeFill`) and `place.label` the place index's name. Such a page is never kept (`PlacePage.astro`: no-store).
   */
  | { readonly kind: "page"; readonly place: PlaceFragment; readonly slug: string };

/**
 * #1166 (owner 2026-10-26: no visitor waits above two seconds): the most a place page waits on the digest in all —
 * the slug's key, the cards, and when the cards are late the place index's name. A late digest is a page whose
 * cards load in the browser, never a page that waits; only a place that cannot be identified in time is a 503.
 */
export const PLACE_PAGE_BUDGET_MS = 2_000;
/** How long a place page's first render waits for its cards before it renders them as loading (#1166). */
export const PLACE_PAGE_CARDS_MS = 1_200;
/** The part of the budget kept for the name index when the cards are late (the digest holds it in memory: no pool). */
const PLACE_INDEX_RESERVE_MS = 400;

export async function resolvePlacePage(
  lang: Lang,
  slug: string,
  o: TileFetchOptions & FirstRenderOptions & { readonly request?: AskingRequest; readonly open?: string | null; readonly ev?: string },
): Promise<PlacePageAnswer> {
  // #1166: ONE deadline for the whole resolve — the page's own two seconds, or less when the request's budget
  // (`o.endsAt`, `lib/page-budget.ts`: a legacy lookup before it) ends first. Every read below gets what is left of it
  // and no floor goes past it: the key's and the index's reads are aborted at it, the cards' wait and their live
  // answers' are capped by it (`placeFirstRender`'s `endsAt`), and too little left for the cards skips their read.
  // #1310 A2: a verified crawler's resolve gets its own budget (`pageBudgetMs`, eight seconds), so a slow key read is
  // a page for it rather than the 503 a person's two seconds would leave it with nothing held
  const endsAt = Math.min(Date.now() + Math.max(PLACE_PAGE_BUDGET_MS, pageBudgetMs()), o.endsAt ?? Number.POSITIVE_INFINITY);
  const left = (): number => budgetLeft(endsAt);
  const within = (): TileFetchOptions & FirstRenderOptions => withinBudget(o, endsAt);
  // #892: the address is the place's stored slug (`/de/place/koeln`); anything that is not one — a typed name
  // ("Köln", "frankfurt") — is the name lookup of #739.
  if (!isPlaceSlug(slug)) return byName(lang, slug, within());
  const ags = await placeKeyOfSlug(slug, within());
  if (ags === undefined) return { kind: "unavailable" };
  if (ags === null) return byName(lang, slug, within());
  // #1166: the key is the place's, and a slug never moves, so the place exists and this is its address. Its cards get
  // the page's deadline and no longer: late (or failed) they are the placeholder the filler fetches. Its fuel prices
  // are asked by the page's own script (#564, #1065), as on every page with cards.
  const ask = { how: "page" as const, request: o.request ?? { method: "HEAD", headers: { get: () => null } }, ...(o.ev === undefined ? {} : { ev: o.ev }) };
  // Too little left for the cards' least wait AND the name index: no cards read at all, the placeholder at once.
  if (left() < CARDS_MIN_MS + PLACE_INDEX_RESERVE_MS) return deferredPage(lang, slug, ags, placeCardsPlaceholder(ags, lang, ask), within());
  const cardsMs = Math.min(o.deadlineMs ?? PLACE_PAGE_CARDS_MS, left() - PLACE_INDEX_RESERVE_MS);
  const r = await placeFirstRender(ags, lang, { ...within(), ...ask, deadlineMs: cardsMs, endsAt, deferFailed: true });
  if (r.kind === "deferred") return deferredPage(lang, slug, ags, r.html, within());
  // `failed` is deferred above; `far` cannot be a Gemeinde's key's answer. Only the digest's own 404 is a 404 (#1224):
  // anything else that is no place is not known to be none.
  if (r.kind === "missing") return { kind: "missing" };
  if (r.kind !== "place") return { kind: "unavailable" };
  const place = r.place;
  // The slug a key resolves to is the key's own (a slug never moves), so the digest's answer names this one.
  if (place.slug !== undefined && place.slug !== slug) return { kind: "redirect", to: placePath(lang, place.slug) };
  return { kind: "page", place, slug };
}

/**
 * #1166: the page of a place whose cards did not arrive in time. Its name is the place index's (the digest holds the
 * index in memory, so a saturated pool does not hold it up; the shell keeps it ten minutes and a stale one beyond, a
 * name changes a few times a year); its address is its slug's — a slug the index lists is a stored one, so canonical,
 * and one it does not list (a link to a slug before it was stored, whose 301 only the cards can tell) or no index at
 * all leaves the page without an honest title: a 503, inside the budget.
 * Without JavaScript the placeholder cannot fill, so it carries a link that asks for the page again.
 *
 * The crawler trade-off, decided: a crawler whose cards are late gets this same 200 — an indexable page whose cards
 * are a placeholder — and NOT a 503. A 503 would keep a thin render out of the index, but the owner's rule of #1141
 * is that search engines are never refused or rate-limited (their reads run on the digest's own crawler pool
 * instead), and a 503 to a crawler is a refusal that, repeated, drops the page from the index. So the deferred page
 * carries everything that does not depend on the cards: the title, the H1 and the lead from the index's name, its
 * canonical and alternates from the slug, and a meta description that is the place's general one in the page's
 * language (`placeMeta(name, lang)`: the evergreen `pageDescription` of #1310 B2, which reads no card), never empty.
 * The next crawl, with the pool free, sees the cards.
 */
async function deferredPage(lang: Lang, slug: string, ags: string, placeholder: string, o: TileFetchOptions): Promise<PlacePageAnswer> {
  // #1279: the name the digest gave beside the slug's key (every Gemeinde's, the slug its own), the place index's only
  // from a digest that gave none. The index holds the Gemeinden of 10 000 people or more alone, so a small town's late
  // cards were a 503 — people's degraded page, and a verified crawler with nothing held refused (`verified_refused`).
  const name = placeNameOfSlug(slug) ?? (await cachedPlaceIndex(o))?.find((e) => e.slug === slug)?.name;
  if (name === undefined || name === "") return { kind: "unavailable" };
  const path = placePath(lang, slug);
  // Inside the placeholder's frame, so the filler's swap takes it away with the frame.
  const retry = `<noscript><p class="place-fill__note"><a href="${path}">${esc(t(lang, "place.reloadCards"))}</a></p></noscript>`;
  const html = placeholder.endsWith("</div>") ? `${placeholder.slice(0, -"</div>".length)}${retry}</div>` : `${placeholder}${retry}`;
  return { kind: "page", place: { html, at: ags, label: name, point: false, slug }, slug };
}

/**
 * How long the shell keeps the digest's place index for the name lookup
 * (#739). The index changes when the gazetteer is reloaded, a few times a
 * year; ten minutes bounds a burst of guessed addresses to one digest read and
 * puts a reload on the site within ten minutes.
 */
export const PLACE_NAME_INDEX_TTL_MS = 10 * 60_000;

let indexCache: { readonly at: number; readonly entries: readonly PlaceIndexEntry[] } | null = null;

/** For tests: forget the cached index. */
export function resetPlaceNameIndex(): void {
  indexCache = null;
}

/** The digest's place index, kept `PLACE_NAME_INDEX_TTL_MS` (also read by the temporary legacy redirects of #892). */
export async function cachedPlaceIndex(o: TileFetchOptions): Promise<readonly PlaceIndexEntry[] | null> {
  const now = Date.now();
  if (indexCache !== null && now - indexCache.at < PLACE_NAME_INDEX_TTL_MS) return indexCache.entries;
  const entries = await fetchPlaceIndex(o);
  // #1166: a refresh the digest did not answer keeps the index the shell holds — a stale name beats no page.
  if (entries === null) return indexCache?.entries ?? null;
  indexCache = { at: now, entries };
  return entries;
}

/**
 * `/<lang>/place/<name>`, a name that is no stored slug (#739): one place page carries the
 * name → 301 to it, in the asked language's segment; several → the choice;
 * none → missing (the address names no page; a 503 would invite a retry of
 * something that will never exist). An index the digest did not give (and the
 * shell holds none) is NOT none: the name is not known either way, so it is
 * unavailable — the degraded page that asks again — never a 404 (#1224).
 */
async function byName(lang: Lang, asked: string, o: TileFetchOptions): Promise<PlacePageAnswer> {
  const index = await cachedPlaceIndex(o);
  if (index === null) return { kind: "unavailable" };
  const found = placesByName(index, asked);
  if (found.length === 0) return { kind: "missing" };
  // The one match IS the address asked (a slug the digest no longer answers for): a 404, never a redirect to itself.
  if (found.length === 1 && found[0]!.slug === asked) return { kind: "missing" };
  if (found.length === 1) return { kind: "redirect", to: placePath(lang, found[0]!.slug), temporary: true };
  return { kind: "choice", options: found.map((e) => ({ name: e.name, path: placePath(lang, e.slug) })) };
}
