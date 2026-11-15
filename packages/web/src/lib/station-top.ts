/**
 * #1087 parts 2 and 3: the home's station block (#1199: "Bahnhöfe jetzt: Ausfälle, Verspätungen, …") — the digest's
 * `/internal/station/top` fragment (the stations most disrupted now, the station search and the link to every
 * station), fetched under the panel deadline like the motorway block (`fetchMotorwayTop`) — from the digest itself: the
 * block is rendered per request (`no-store`) and the fragment cache serves no `/internal/station/` path (2.4.6: asked
 * through it, every render was the cache's own 404 and the block its error state).
 *
 * A block that did not arrive is answered from the home's own last good one (`lib/home-kept.ts`) for as long as the
 * digest would answer its own held read (`STATION_TOP_STALE_S`); with nothing kept it is THIS block's error state —
 * its heading, the error note, the station search and the link to every station (both work without the digest) —
 * never a missing block and never a broken page.
 */
import { esc } from "@viafrei/design";
import { t } from "../i18n/index.js";
import { pathFor, type Lang } from "../site/pages.js";
import { getFragment } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";
import { declareHomeSlots, keepHome, keptHome } from "./home-kept.js";

/** The block's kept age, s: the digest's `STATION_TOP_STALE_S` (the shell imports no digest module; the test holds them equal). */
export const STATION_TOP_KEPT_SECONDS = 600;
/** The block's root, as the digest writes it (`STATION_TOP_OPEN`). */
export const STATION_TOP_SHAPE = /^<section class="station-top" id="station-top" aria-labelledby="station-top-t">/;

declareHomeSlots(["station-top"]);

export type StationTopFetched = { readonly kind: "ok" | "kept"; readonly html: string } | { readonly kind: "error"; readonly html: string };

/**
 * The search form, the digest's own shape (`stationSearchForm`, held equal by `test/station-suggest-246.test.ts`): GET
 * `q` to the station catalogue, no button (2.4.6) — it suggests stations as you type (`lib/suggest.ts`).
 */
function searchForm(lang: Lang): string {
  return (
    `<form class="station-top__search" method="get" action="${esc(pathFor("stations", lang))}" role="search">` +
    `<label for="station-top-q">${esc(t(lang, "now.stationTop.search"))}</label> ` +
    `<input class="sheet__input" id="station-top-q" name="q" type="search" maxlength="60" value="" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="station-top-q-results">` +
    `<div class="sheet__results" id="station-top-q-results" aria-live="polite"></div></form>`
  );
}

/** The block's error state: no figure and no credit (nothing was read), the search and the catalogue link still there. */
export function stationTopError(lang: Lang): string {
  return (
    `<section class="station-top is-error" id="station-top" aria-labelledby="station-top-t">` +
    `<h2 class="station-top__h" id="station-top-t">${esc(t(lang, "now.stationTop.head"))}</h2>` +
    `<p class="station-top__none">${esc(t(lang, "tile.errorNote"))}</p>` +
    searchForm(lang) +
    `<p class="station-top__cta"><a class="btn btn--primary" href="${esc(pathFor("stations", lang))}">${esc(t(lang, "now.stationTop.all"))} →</a></p></section>`
  );
}

/** The block for the home: the digest's, else the kept one, else its error state. Never throws. */
export async function fetchStationTop(lang: Lang, o: TileFetchOptions): Promise<StationTopFetched> {
  const r = await getFragment(`${o.baseUrl}/internal/station/top?lang=${lang}`, o, STATION_TOP_SHAPE, "</section>").catch(() => ({ ok: false as const }));
  if (r.ok) {
    keepHome("station-top", lang, r.html, STATION_TOP_KEPT_SECONDS);
    return { kind: "ok", html: r.html };
  }
  const k = keptHome("station-top", lang);
  return k === null ? { kind: "error", html: stationTopError(lang) } : { kind: "kept", html: k.html };
}

/**
 * #1182: the station catalogue in the owner's order — the search first, then the stations most delayed now (this
 * block), then the catalogue by Land. The block's own search and its link to the catalogue are dropped there: the page
 * IS the catalogue and already opens with its search. A block in its error state is left out (the catalogue still
 * works without it); a fragment with no search form is returned unchanged.
 */
export function withStationTop(indexHtml: string, top: StationTopFetched): string {
  if (top.kind === "error") return indexHtml;
  const block = top.html.replace(/<form class="station-top__search"[\s\S]*?<\/form>/u, "").replace(/<p class="station-top__cta">[\s\S]*?<\/p>/u, "");
  const at = /<form class="stpage-search"[\s\S]*?<\/form>/u.exec(indexHtml);
  if (at === null) return indexHtml;
  const end = at.index + at[0].length;
  return `${indexHtml.slice(0, end)}${block}${indexHtml.slice(end)}`;
}
