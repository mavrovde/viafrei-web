/**
 * #1182 part 2: the fuel index (`/<lang>/fuel`) opens with the visitor's place — its cheapest open stations — then
 * the big cities, then the per-Land board of 2026-10-06 (C1–C5) as before.
 *
 * The place's prices are PERSON-GATED exactly as on a place page (#1065 PF1/PF2, #1076 S1–S5, the MTS-K terms: a
 * consumer's request, "auf Useraktion"): the document carries the fuel card's FRAME alone — the slot of
 * `lib/place-fuel.ts`, its no-script, loading and failed lines and an empty box — and the page's one fuel script asks
 * `/fragment/place-fuel` for the place when the slot comes into view, behind `personAsks`. No figure, no station and
 * no Tankerkönig datum is in the server HTML of either block; `test/fuel-index-1182.test.ts` plants a digest whose
 * cards DO carry prices and holds that.
 *
 * The place is the IP rung's (`motorwayIpCell`: no crawler, no objection signal, never stored), answered as its
 * Gemeinde by the digest's cards with the fuel rows left out (`deferFuel`, `fuelRows=0`) and nothing asked of the
 * fuel refresh — only its label and its page's slug are kept, never the cards' HTML. A place with no page, a digest
 * late past the panel deadline, or no rung at all is the honest line and the cities; the page never waits for it.
 *
 * The board (data-steward ruling 2026-11-08 on #1182, B2/B3): its disclosure — `fuelPage.lead`, "up to three per Land
 * … not necessarily the cheapest" — stands inside the board's own section, under a visible heading that states the
 * bound, directly above the board, so it cannot be read as being about the place block above it (§ 7 Abs. 1 Nr. 6
 * MTSKraftV). A client that names itself as automation, a corpus crawler or an SEO-tool crawler gets the not-available
 * line instead and the board's fragment is never asked for; search engines and the answer agents keep it under
 * `noarchive` (C5).
 */
import { esc } from "./answer-html.js";
import { fetchPlace } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";
import { motorwayIpCell } from "../location/server.js";
import type { GeoIp } from "../location/geoip.js";
import { t } from "../i18n/index.js";
import { placePath, POPULAR_PLACES, popularSlug } from "../site/places.js";
import { pathFor, type Lang } from "../site/pages.js";
import { CORPUS_CRAWLERS, SEO_CRAWLERS, isAutomationAgent } from "../site/crawlers.js";

/** The place whose prices the slot asks for: its name and its place page's slug. */
export type FuelHere = { readonly label: string; readonly slug: string };

/** The visitor's place for the fuel index, or null (no rung, no page, or the digest did not answer in time). */
export async function fuelHereOf(
  headers: { get(n: string): string | null },
  lang: Lang,
  o: TileFetchOptions & { readonly geoipFile: string | undefined; readonly geo?: GeoIp | null },
): Promise<FuelHere | null> {
  const cell = motorwayIpCell(headers, o);
  if (cell.at === null) return null;
  const p = await fetchPlace(cell.at, lang, { ...o, snap: true, deferFuel: true, fuel: null });
  return p === null || p.slug === undefined || p.label === "" ? null : { label: p.label, slug: p.slug };
}

/** `{place}` in a sentence, as the link the fuel script reads the place from (`a.place__page`). */
function withPlace(lang: Lang, link: string): string {
  const MARK = "\u0000";
  return t(lang, "fuelPage.hereHead", { place: MARK }).split(MARK).map((x) => esc(x)).join(link);
}

/** The first block: the place's slot (a frame with no figure) or, with no place, the line that says how to get one. */
export function fuelHereHtml(lang: Lang, here: FuelHere | null): string {
  const head = `<h2 class="fuel-here__h" id="fuel-here-h">`;
  if (here === null)
    return `<section class="fuel-here" id="fuel-here" aria-labelledby="fuel-here-h">${head}${esc(t(lang, "fuelPage.hereHeadNone"))}</h2><p class="fuel-here__none">${esc(t(lang, "fuelPage.hereNone"))}</p></section>`;
  const link = `<a class="place__page" href="${esc(placePath(lang, here.slug))}"><span translate="no">${esc(here.label)}</span></a>`;
  return (
    `<section class="fuel-here place" id="fuel-here" aria-labelledby="fuel-here-h">${head}${withPlace(lang, link)}</h2>` +
    `<div class="pcard__fuelslot">` +
    `<p class="pcard__note pcard__fueljs">${esc(t(lang, "fuelPage.hereNoScript"))}</p>` +
    `<p class="pcard__note pcard__fuelloading" hidden>${esc(t(lang, "fuelPage.hereLoading"))}</p>` +
    `<p class="pcard__note pcard__fuelfailed" hidden>${esc(t(lang, "fuelPage.hereFailed"))}</p>` +
    `<div class="pcard__fuelout" aria-live="polite"></div>` +
    `</div></section>`
  );
}

/** The cities: the big cities' place pages, each with its own person-gated prices; no figure here. */
export function fuelCitiesHtml(lang: Lang): string {
  const items = POPULAR_PLACES.map((p) => `<li><a href="${esc(placePath(lang, popularSlug(p)))}"><span translate="no">${esc(p.name)}</span></a></li>`).join("");
  return `<section class="fuel-cities" id="fuel-cities" aria-labelledby="fuel-cities-h"><h2 class="fuel-cities__h" id="fuel-cities-h">${esc(t(lang, "fuelPage.cities"))}</h2><p class="fuel-cities__lead">${esc(t(lang, "fuelPage.citiesLead"))}</p><ul class="fuel-cities__list">${items}</ul></section>`;
}

/**
 * B3: whether the board is withheld from this user agent — a declared automation client (`AUTOMATION_AGENTS`), a corpus
 * or training crawler (`CORPUS_CRAWLERS`) or an SEO-tool crawler (`SEO_CRAWLERS`), each token matched
 * case-insensitively as a substring. Search engines and `AI_ASSISTANTS` are on none of the three lists, ClaudeBot,
 * Amazonbot and GPTBot (corpus crawlers, owner 2026-11-12, 2026-11-14 and #1306) excepted.
 */
export function boardWithheld(ua: string): boolean {
  const u = ua.toLowerCase();
  return isAutomationAgent(ua) || [...CORPUS_CRAWLERS, ...SEO_CRAWLERS].some((c) => u.includes(c.toLowerCase()));
}

/** Whether a digest answer is the board itself (not the error tile, a quiet tile, or a withheld board). */
export const isBoard = (html: string | null): html is string => html !== null && html.includes('<div class="fuel-board">');

/**
 * The board's section (B2): the visible heading stating the bound, then the lead directly above the board — or, with
 * no board (withheld, digest down, quiet tile), the not-available line in its place, so no lead promises a list the
 * page does not show (review N5). `board` is the digest's fragment (the error tile included), null when withheld.
 */
export function fuelBoardSectionHtml(lang: Lang, board: string | null): string {
  const lead = isBoard(board) ? `<p class="lead">${esc(t(lang, "fuelPage.lead"))}</p>` : `<p class="lead fuel-page__unavailable">${esc(t(lang, "fuelPage.unavailable"))}</p>`;
  return (
    `<section class="block" id="board" aria-labelledby="board-h"><div class="wrap">` +
    `<h2 id="board-h" class="fuel-page__h">${esc(t(lang, "fuelPage.boardHead"))}</h2>` +
    lead +
    `<div class="fuel-page">${board ?? ""}</div>` +
    `<p class="fuel-all"><a href="${esc(pathFor("start", lang))}">${esc(t(lang, "fuelPage.back"))}</a></p>` +
    `</div></section>`
  );
}
