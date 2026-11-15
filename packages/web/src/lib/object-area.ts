/**
 * #1084, #1188: the place cards of an OBJECT's position, under the object's own section — a station's, a fuel
 * station's, a charging site's: the digest's `/internal/<kind>/<slug>/area`, which is the SAME card set the home and a
 * city page render for a position (`renderPlace` over `PlaceService.cards`, gated and cached per cell by #1184), with
 * what the object's page already says taken out there (`objectAreaCards`). The shell copies no card markup: it asks,
 * checks the shape, and frames the answer with the place pages' own topic bar (`components/AroundBlock.astro`, the ONE
 * around block of every object page).
 *
 * Asked in parallel with the object's own page, under the same per-fragment deadline (the two-second ceiling): a slow
 * or failed answer is the block's loading or error state — one sentence in the page's language — never a slow page and
 * never a missing object. An object the digest has no cards for (no point, far outside Germany) is no block at all.
 * Fetched from the digest directly: the fragment cache routes the place cards, not an object's.
 */
import { t } from "../i18n/index.js";
import { chargingFilterTail } from "./charging-filter.js";
import type { Lang } from "../site/pages.js";
import { getFragment } from "./place.js";
import type { StationFetchOptions } from "./station.js";
import type { FetchLike } from "./tiles.js";
import { mapQuery } from "./tiles.js";
import { digestFetch } from "./agent-class.js";
import { didNotAnswer } from "./fragment-retry.js";

/** The digest's root of the cards, as `renderPlace` writes it. */
export const AREA_SHAPE = /^<section class="place" id="place-cards"/;

/**
 * #1188: the object pages that carry the around block — each the digest's `/internal/<kind>/<slug>/area`; an exit's
 * slug is its motorway and its segment (`/internal/exit/A4/exit-8-koeln-loevenich/area`).
 */
export const AREA_KINDS = ["station", "fuel", "charging", "exit"] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
/** The object a page is about: its kind and its stored slug; an exit's, its canonical motorway and its segment. */
export type AreaTarget = { readonly kind: Exclude<AreaKind, "exit">; readonly slug: string } | { readonly kind: "exit"; readonly road: string; readonly segment: string };

/** The digest's address of `target`'s block, below `/internal/`. */
export function areaPathOf(target: AreaTarget): string {
  return target.kind === "exit" ? `exit/${encodeURIComponent(target.road)}/${encodeURIComponent(target.segment)}/area` : `${target.kind}/${encodeURIComponent(target.slug)}/area`;
}

export type ObjectArea = { readonly kind: "ok"; readonly html: string } | { readonly kind: "none" } | { readonly kind: "error"; readonly html: string } | { readonly kind: "loading"; readonly html: string };

/** The block's error state: the frame the cards would have stood in, and the one sentence. Nothing was read, so no figure. */
export function areaError(lang: Lang): string {
  return `<section class="place is-error" id="place-cards"><p class="place__none">${esc(t(lang, "tile.errorNote"))}</p></section>`;
}

/**
 * 2.4.6: the block's loading state — the cards were not ready inside the deadline. Without script it says the error
 * sentence (nothing more will come); the page's script shows the loading sentence and asks again (`REFRESH_JS`).
 */
export function areaLoading(lang: Lang): string {
  return `<section class="place stpart--loading" id="place-cards"><p class="place__none" role="status">${esc(t(lang, "tile.errorNote"))}</p><p class="place__none" hidden>${esc(t(lang, "tile.loading"))}</p></section>`;
}

const esc = (s: string): string => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * The cards around `target` (its slug already the stored one) in `lang`; `fuelRows=0`, so the fuel card is its frame
 * and the page's script asks the prices as on a city page. Never throws.
 */
export async function fetchArea(target: AreaTarget, lang: Lang, o: StationFetchOptions, params: URLSearchParams = new URLSearchParams()): Promise<ObjectArea> {
  const own = o.fetchImpl;
  const fetchImpl: FetchLike = own === undefined ? (u, init) => digestFetch(u, init) : (u, init) => own(u, { ...init, redirect: "manual" });
  // #1109: a station page's charging filter reaches the full charging card too (the place pages' card, read at the station)
  const filter = target.kind === "station" ? chargingFilterTail(params) : "";
  const r = await getFragment(`${o.baseUrl}/internal/${areaPathOf(target)}?lang=${lang}&fuelRows=0${filter}${mapQuery(o)}`, { baseUrl: o.baseUrl, timeoutMs: o.timeoutMs, fetchImpl }, AREA_SHAPE, "</section>").catch(() => ({ ok: false as const, status: null }));
  if (r.ok) return { kind: "ok", html: r.html };
  // 2.4.6: no status (a deadline, a refused connection) or a 5xx (the digest's pool was busy: #1184's refusal) is the
  // loading state, asked again by the page's script; an answer that is not the cards' shape is the error sentence
  if (didNotAnswer(r.status)) return { kind: "loading", html: areaLoading(lang) };
  return r.status === 404 ? { kind: "none" } : { kind: "error", html: areaError(lang) };
}
