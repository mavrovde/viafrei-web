/**
 * What a station address resolves to (#1041), decided before anything renders
 * — Astro lets only a PAGE answer with a redirect, so the route files call this.
 *
 *   - the stored slug (`/de/station/koeln-hbf`) → the page;
 *   - another spelling of a slug (`Köln Hbf`, capitals) → 301 to the folded one;
 *   - a renamed station's old slug (the digest's `moved`) → 301 to its new page;
 *   - a slug the digest does not hold → the 404 page (a station is not a place
 *     an address can be guessed into);
 *   - the digest not answering → 503, never a redirect that would tell an
 *     index the page has moved — 2.4.6: ONLY when this shell cannot vouch for
 *     the slug. A station page is never a 503 because a part of it is slow
 *     (prod 2026-10-28: Frankfurt and Hamburg Hbf, cold): the static part
 *     falls back to the last copy this shell was sent, else to its loading
 *     frame named from the held station list (`station-names.ts`); the live
 *     part and the place cards to their loading blocks. The page's script
 *     asks for the page again and puts each part in its place.
 */
import type { Lang } from "../site/pages.js";
import { stationAddress, stationPath } from "../site/stations.js";
import { fetchStationIndex, fetchStationLive, fetchStationPage, fetchStationStop, stationIndexChoice, stationLiveChoice, stationStopNames, type StationFacts, type StationFetchOptions } from "./station.js";
import { stationPageLoading, withStationLive } from "./station-live.js";
import { heldStationName, primeStationNames } from "./station-names.js";
import { fetchArea, type ObjectArea } from "./object-area.js";

export type StationPageAnswer =
  | { readonly kind: "unavailable" }
  | { readonly kind: "missing" }
  | { readonly kind: "redirect"; readonly to: `/${string}` }
  | {
      readonly kind: "page";
      readonly slug: string;
      /** The static page with its live part (#1042) — or, when that did not answer, the one-sentence error block. */
      readonly html: string;
      readonly path: `/${string}`;
      /** #1044: StaDa's facts for the title and the structured data; null when the digest sent none. */
      readonly facts: StationFacts | null;
      /** A person's choice in the address (`platform`, `to`, `access`): noindex, the canonical the bare page. */
      readonly variant: boolean;
      /** #1084: the place cards of the station's position; `none` for a station with no point. */
      readonly area: ObjectArea;
      /** 2.4.6: a part is in its loading state (the page's script fills it in place); `static`: the static part is its frame. */
      readonly loading: { readonly any: boolean; readonly static: boolean };
    };

export async function resolveStationPage(lang: Lang, raw: string, o: StationFetchOptions, params: URLSearchParams = new URLSearchParams()): Promise<StationPageAnswer> {
  const a = stationAddress(raw);
  if (a.kind === "none") return { kind: "missing" };
  if (a.kind === "respell") return { kind: "redirect", to: stationPath(lang, a.slug) };
  const choice = stationLiveChoice(params);
  // the static page, the live part and the place cards of its position (#1084) are asked together, each under the same
  // deadline (the two-second ceiling)
  void primeStationNames(o);
  const [r, live, area] = await Promise.all([fetchStationPage(a.slug, lang, o), fetchStationLive(a.slug, lang, o, choice), fetchArea({ kind: "station", slug: a.slug }, lang, o, params)]);
  if (r.kind === "moved") return { kind: "redirect", to: stationPath(lang, r.to) };
  if (r.kind === "missing") return { kind: "missing" };
  const variant = choice !== "" || [...params.keys()].length > 0;
  const liveHtml = live.kind === "ok" ? live.html : null;
  const liveMissing = live.kind === "failed" && isTransient(live.reason) ? "loading" : "error";
  if (r.kind === "failed") {
    // only a part that may be ready on the next ask is a loading frame; an answer that is not the page stays a 503
    const name = isTransient(r.reason) ? heldStationName(a.slug) : null;
    if (name === undefined || name === null) return { kind: "unavailable" };
    return { kind: "page", slug: a.slug, html: withStationLive(stationPageLoading(lang, name), liveHtml, lang, liveMissing), path: stationPath(lang, a.slug), facts: null, variant, area, loading: { any: true, static: true } };
  }
  const any = (liveHtml === null && liveMissing === "loading") || area.kind === "loading";
  return { kind: "page", slug: a.slug, html: withStationLive(r.html, liveHtml, lang, liveMissing), path: stationPath(lang, a.slug), facts: r.facts ?? null, variant, area, loading: { any, static: false } };
}

/**
 * 2.4.6: whether a failed fragment may be ready on the next ask — a deadline, a refused connection or a 5xx (the
 * digest's pool was busy) — rather than an answer that is not the fragment (another shape, a script, a 4xx).
 */
export function isTransient(reason: string): boolean {
  return /^timeout after /.test(reason) || /^HTTP 5\d\d$/.test(reason) || !/^(?:HTTP \d{3}|not |a 301)/.test(reason);
}

export type StationIndexAnswer = { readonly kind: "unavailable" } | { readonly kind: "page"; readonly html: string; readonly variant: boolean };

/** `params`: a search or one Land's list renders that choice, is never kept, and is `noindex` with the bare catalogue as its canonical. */
export async function resolveStationIndex(lang: Lang, o: StationFetchOptions, params: URLSearchParams = new URLSearchParams()): Promise<StationIndexAnswer> {
  const choice = stationIndexChoice(params);
  const r = await fetchStationIndex(lang, o, choice);
  return r.kind === "ok" ? { kind: "page", html: r.html, variant: choice !== "" || [...params.keys()].length > 0 } : { kind: "unavailable" };
}

/** #1043 (c): a stop around a station on its own address — its view, its names and its addresses; never indexed. */
export type StationStopAnswer =
  | { readonly kind: "unavailable" }
  | { readonly kind: "missing" }
  | { readonly kind: "redirect"; readonly to: `/${string}` }
  | { readonly kind: "page"; readonly slug: string; readonly html: string; readonly path: `/${string}`; readonly back: `/${string}`; readonly stop: string; readonly station: string };

/** A stop's view address (`/<lang>/station/<slug>/stop/<key>`). */
export const stationStopPath = (lang: Lang, slug: string, key: string): `/${string}` => `${stationPath(lang, slug)}/stop/${key}`;

/** The stop view: a respelled or renamed station's slug is a 301 to the same stop; a key naming no stop around it is a 404. */
export async function resolveStationStop(lang: Lang, raw: string, key: string, o: StationFetchOptions): Promise<StationStopAnswer> {
  const a = stationAddress(raw);
  if (a.kind === "none") return { kind: "missing" };
  if (a.kind === "respell") return { kind: "redirect", to: stationStopPath(lang, a.slug, key) };
  const r = await fetchStationStop(a.slug, key, lang, o);
  if (r.kind === "missing") return { kind: "missing" };
  if (r.kind === "moved") return { kind: "redirect", to: stationStopPath(lang, r.to, key) };
  if (r.kind === "failed") return { kind: "unavailable" };
  const names = stationStopNames(r.html);
  if (names === null) return { kind: "unavailable" };
  return { kind: "page", slug: a.slug, html: r.html, path: stationStopPath(lang, a.slug, key), back: `${stationPath(lang, a.slug)}#pcard-station-nearby`, ...names };
}
