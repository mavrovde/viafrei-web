/**
 * #1042: the station page's live part put into its static page. The static fragment is the page as the source
 * version stands (cached by its ETag); the live part is the minute's — the chips and the four cards. It goes right
 * after the page's head, and its platforms card (the same table with the lift serving each platform now) stands in
 * for the static one, whose jump link is pointed at it. When the live part did not answer inside the deadline, the
 * static page stands whole and one sentence says the live data is not readable right now — never a missing page and
 * never a wait past two seconds.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";

/** The static page's platforms card, whole (`renderStationPage`: a section with no section inside it). */
const STATIC_PLATFORMS = /<section class="pcard stpage__card" id="station-platforms"[^>]*>[\s\S]*?<\/section>/;
/** The end of the static page's head, where the live part goes. */
const HEAD_END = "</header>";

/** The block a page shows when its live part did not answer. */
export function stationLiveError(lang: Lang): string {
  return `<section class="stlive stlive--error" id="station-live"><p class="stpage__note" role="status">${escapeText(t(lang, "tile.errorNote"))}</p></section>`;
}

/**
 * 2.4.6: the block a page shows when its live part was not ready inside the deadline — its loading state. Without
 * script nothing more will come, so it says the error sentence; the page's script shows the loading sentence instead,
 * asks for the page again and puts the live part in its place (`REFRESH_JS`, `lib/card-refresh.ts`), and after the
 * last try says the error sentence again.
 */
export function stationLiveLoading(lang: Lang): string {
  return `<section class="stlive stpart--loading" id="station-live"><p class="stpage__note" role="status">${escapeText(t(lang, "tile.errorNote"))}</p><p class="stpage__note" hidden>${escapeText(t(lang, "tile.loading"))}</p></section>`;
}

const escapeText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The static fragment with its live part after its head; null live = the block `missing` names — `loading` when the
 * live part was not ready in time (the page's script asks again), `error` when what came back was not a live part.
 */
export function withStationLive(page: string, live: string | null, lang: Lang, missing: "loading" | "error" = "error"): string {
  const at = page.indexOf(HEAD_END);
  if (at < 0) return page;
  const end = at + HEAD_END.length;
  if (live === null) return page.slice(0, end) + (missing === "loading" ? stationLiveLoading(lang) : stationLiveError(lang)) + page.slice(end);
  const rest = page.slice(end).replace(STATIC_PLATFORMS, "");
  const head = page.slice(0, end).replace('href="#station-platforms"', 'href="#pcard-station-platforms"');
  return head + live + rest;
}

/**
 * 2.4.6: the static part's frame when the digest did not send it inside the deadline (and this shell holds no earlier
 * copy): the station's name (from the held station list, `lib/station-names.ts`) as the page's head, and the page's
 * loading state where its cards would stand — filled in place by the page's script like the live part.
 */
export function stationPageLoading(lang: Lang, name: string): string {
  return `<section class="stpage stpart--loading" id="station"><header class="stpage__head"><p class="stpage__name" translate="no">${escapeText(name)}</p></header><p class="stpage__note" role="status">${escapeText(t(lang, "tile.errorNote"))}</p><p class="stpage__note" hidden>${escapeText(t(lang, "tile.loading"))}</p></section>`;
}
