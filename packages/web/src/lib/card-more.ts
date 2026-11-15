/**
 * #1061: a card's next entries, behind the existing "›" fold (`pcard__more`). The page carries the first
 * `ui.card_page_size` entries of every card; opening a fold asks `/fragment/more` for the next ones, which the digest
 * answers from the page's own rows (`/internal/motorway/<road>/more/<card>`), kept and revalidated like the page
 * (#715: summary version, ETag) and by the fragment cache in front of it. Nothing here reads a database or calls a
 * provider. A version that moved is a 409, which the pager script turns into "Daten aktualisiert, Liste neu
 * geladen" and a clean reload — a person never pages through two versions of one list.
 *
 * The answer is never indexed (`noindex`): it is a piece of a page, and its page is the canonical.
 */
import { isLang } from "../i18n/index.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { viaFragmentCache } from "./fragment-cache.js";
import { chargingFilterTail } from "./charging-filter.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { MOTORWAY_NUMBER } from "../site/motorways.js";
import { isPlaceSlug } from "../site/places.js";
import { digestFetch } from "./agent-class.js";

/** The public route (the digest's `MORE_FRAGMENT_PATH`). */
export const CARD_MORE_ROUTE = "/fragment/more";

/** Headers of every answer: a piece of a page, cached briefly by the browser and the edge, never indexed. */
export const CARD_MORE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60",
  "X-Robots-Tag": "noindex, nofollow",
};

const CARD = /^[a-z]{3,12}$/;
const WHOLE = /^[0-9]{1,6}$/;
/** What the digest's fragment begins with: the card's list. */
const SHAPE = /^<ul class="[a-z_ -]+">/;
/**
 * What a departures step begins with: the stop's board (#1115 B, the digest's `departuresTable` in step form). The
 * list shape above refused every step once the board became a table, so "more" under a stop answered 502 (2.5.4 cut).
 */
export const DEPARTURES_STEP_SHAPE = /^<table class="pcard__board">/;

/**
 * The place cards (the digest's `PLACE_CARD_IDS`): the no-script `?<card>=N` of a place page opens one of them, and
 * nothing else on that page is read as a pager parameter. The fuel card is not one: its rows are fetched by the page's
 * script (#1065), so no page renders them without it and its fold says so instead of linking (#1061 review).
 */
export const PLACE_PAGER_CARDS = ["stations", "parking", "roads", "motorways", "lorry", "charging", "warnings", "groceries", "health", "money", "food", "lodging", "garage", "police", "toilets", "neighbours", "lifts"] as const;

/**
 * #938 E1: "more" under one stop's departures on a place's stations card (the digest's `DEPARTURES_MORE_CARD`): the
 * `card` word of `/fragment/more`, and the no-script `?stop=<id>&departures=N` of a place page — English words only.
 */
export const DEPARTURES_CARD = "departures";
/** A stop id as the digest's `STOP_ID` takes it. */
const STOP_ID = /^[A-Za-z0-9:_.-]{1,64}$/;
/** A "more" cursor as the digest writes it (`departures-more.ts` `cursorText`): steps, epoch seconds, a base64url key. */
const AFTER = /^[0-9]\.[0-9]{9,11}\.[A-Za-z0-9_-]{1,160}$/;
/** At most this many steps a no-script page opens under one stop (the digest's `DEPARTURES_STEPS_MAX`). */
export const DEPARTURES_STEPS_MAX = 6;

/** Headers of a departures step: a live list after a person's cursor — kept by nobody (not the browser, not the edge), never indexed. */
export const DEPARTURES_MORE_HEADERS: Readonly<Record<string, string>> = { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" };

/**
 * A place page's no-script `?<card>=N` (N 2..99) as the digest's `open=<card>:<N>` — or, #938 E1, its
 * `?stop=<id>&departures=N` (N 1..6) as `open=departures:<N>@<stop>`; null when there is none.
 */
export function placeOpenOf(params: URLSearchParams): string | null {
  for (const id of PLACE_PAGER_CARDS) {
    const v = params.get(id);
    if (v !== null && /^(?:[2-9]|[1-9][0-9])$/.test(v)) return `${id}:${v}`;
  }
  const steps = params.get(DEPARTURES_CARD);
  const stop = params.get("stop");
  if (steps !== null && stop !== null && /^[1-9]$/.test(steps) && Number(steps) <= DEPARTURES_STEPS_MAX && STOP_ID.test(stop)) return `${DEPARTURES_CARD}:${steps}@${stop}`;
  return null;
}

/**
 * The digest address a public request asks for, or null when the request is malformed: a motorway's card
 * (`road=A7`) or a place page's (`place=<slug>`, #1061 "the same rules for the places pages also").
 */
export function cardMoreTarget(params: URLSearchParams, o: Pick<TileFetchOptions, "baseUrl" | "mapPlatform">): string | null {
  const road = params.get("road");
  const place = params.get("place");
  const card = params.get("card") ?? "";
  const lang = params.get("lang") ?? "";
  if ((road === null) === (place === null) || !CARD.test(card) || !isLang(lang)) return null;
  if (road !== null && !MOTORWAY_NUMBER.test(road)) return null;
  // #938 E1: a stop's next departures after a cursor — the place's stop and cursor validated here (#938 B3), the
  // stop's membership of the place's card by the digest (404)
  if (card === DEPARTURES_CARD) {
    const stop = params.get("stop") ?? "";
    const after = params.get("after") ?? "";
    if (place === null || !isPlaceSlug(place) || !STOP_ID.test(stop) || !AFTER.test(after)) return null;
    return `${o.baseUrl}/internal/place/${place}/${DEPARTURES_CARD}?lang=${lang}&stop=${encodeURIComponent(stop)}&after=${after}`;
  }
  // the fuel card pages through its own gated, never-cached `/fragment/place-fuel` (#1065), never this cached route
  if (place !== null && (!isPlaceSlug(place) || card === "fuel" || !(PLACE_PAGER_CARDS as readonly string[]).includes(card))) return null;
  // a negative, empty or non-numeric `from` is the start; the digest answers one past the end with an empty list
  const fromRaw = params.get("from") ?? "";
  const from = WHOLE.test(fromRaw) && Number(fromRaw) >= 1 ? fromRaw : "1";
  const v = params.get("v") ?? "";
  const path = road !== null ? `/internal/motorway/${road}/more/${card}` : `/internal/place/${place ?? ""}/${card}`;
  // #1081 C7: a filtered charging list's next page continues the FILTERED list (the digest answers it no-store)
  const ev = card === "charging" ? chargingFilterTail(params) : "";
  return `${o.baseUrl}${path}?lang=${lang}&from=${from}${/^[0-9]{1,15}$/.test(v) ? `&v=${v}` : ""}${ev}${mapQuery(o)}`;
}

/** The public route's answer. */
export async function cardMoreRoute(request: Request, o: TileFetchOptions): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const target = cardMoreTarget(params, o);
  if (target === null) return new Response("", { status: 400, headers: { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" } });
  // #938 E1: a departures step is live and a person's — asked of the digest directly, past the fragment cache, and
  // answered no-store; every other card's page is the kept fragment of #1061
  const live = params.get("card") === DEPARTURES_CARD;
  const get: FetchLike = live ? (o.fetchImpl ?? ((u, init) => digestFetch(u, init))) : viaFragmentCache({ ...o });
  try {
    const r = await get(target, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "text/html" } });
    if (r.status === 409) return new Response("", { status: 409, headers: { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" } });
    if (r.status === 404) return new Response("", { status: 404, headers: { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" } });
    const body = r.status === 200 ? await r.text() : "";
    if (r.status !== 200 || !(live ? DEPARTURES_STEP_SHAPE : SHAPE).test(body)) return new Response("", { status: 502, headers: { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" } });
    return new Response(body, { status: 200, headers: live ? DEPARTURES_MORE_HEADERS : CARD_MORE_HEADERS });
  } catch {
    return new Response("", { status: 504, headers: { ...CARD_MORE_HEADERS, "Cache-Control": "no-store" } });
  }
}

/**
 * The pager's script (#1061): when a `details.pager` opens, its body is filled from its `data-more` fragment; focus
 * moves to the first new entry (a list item, or a departure board's row — #1115 B) and a polite live region says "12 weitere Einträge geladen". A 409 says the list was
 * refreshed and reloads the page; any other failure (#938 B4) keeps every entry already shown, says "Konnte nicht
 * geladen werden …" beside the fold (`data-failed`), closes it and lets the next press ask again — the no-script
 * link stays in its body. Each loaded step tells the consent island `vf:card-more` (card, step), which sends
 * `card_more` only after consent (#938 C5). A filter chip of a card
 * (`.amchips`/`.nbchips`, CSS-only, #901 D6/D7) judges only the entries in the document, so checking one opens every
 * fold of its card, chained, without moving focus: the filter then reads the whole list, never page 1 alone (#1061).
 * It sends nothing else and stores nothing. Minified into `src/generated/inline-scripts.json` (`npm run web:inline`).
 */
export const PAGER_JS = `function say(t) {
  if (!t) return;
  var live = document.getElementById("vf-pager-live");
  if (!live) {
    live = document.createElement("p");
    live.id = "vf-pager-live";
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
  }
  live.textContent = "";
  setTimeout(function () { live.textContent = t; }, 50);
}
function load(d) {
  var url = d.getAttribute("data-more");
  if (!url || d.getAttribute("data-state")) return;
  var body = d.querySelector(".pcard__morebody");
  if (!body) return;
  d.setAttribute("data-state", "loading");
  fetch(url, { credentials: "same-origin" }).then(function (r) {
    if (r.status === 409) {
      say(d.getAttribute("data-refreshed"));
      setTimeout(function () { location.reload(); }, 1200);
      return null;
    }
    if (r.status !== 200) throw new Error(String(r.status));
    return r.text();
  }).then(function (html) {
    if (html === null) return;
    body.innerHTML = html;
    d.setAttribute("data-state", "done");
    if (d.getAttribute("data-all")) openAll(body);
    else {
      var first = body.querySelector("li, tr.pcard__dep");
      if (first) { first.setAttribute("tabindex", "-1"); first.focus(); }
      say(d.getAttribute("data-loaded"));
    }
    try { document.dispatchEvent(new CustomEvent("vf:loaded")); } catch (e) {}
    var bad = d.nextElementSibling;
    if (bad && bad.classList.contains("pager__failed")) bad.parentNode.removeChild(bad);
    var m = /[?&]card=([a-z]+)/.exec(url);
    var card = d.closest(".pcard");
    try { document.dispatchEvent(new CustomEvent("vf:card-more", { detail: { card: m ? m[1] : "", step: card ? card.querySelectorAll("details.pager[data-state=done]").length : 1 } })); } catch (e) {}
  }).catch(function () {
    d.removeAttribute("data-state");
    var t = d.getAttribute("data-failed");
    if (!t) return;
    var bad = d.nextElementSibling;
    if (!bad || !bad.classList.contains("pager__failed")) {
      bad = document.createElement("p");
      bad.className = "pcard__note pager__failed";
      d.parentNode.insertBefore(bad, d.nextSibling);
    }
    bad.textContent = t;
    d.open = false;
    say(t);
  });
}
function openAll(root) {
  Array.prototype.forEach.call(root.querySelectorAll("details.pager"), function (d) { d.setAttribute("data-all", "1"); if (!d.open) d.open = true; });
}
document.addEventListener("change", function (e) {
  var t = e.target;
  if (!t || !t.checked || !t.closest || !t.closest(".amchips, .nbchips")) return;
  var card = t.closest(".pcard");
  if (card) openAll(card);
}, true);
document.addEventListener("toggle", function (e) {
  var d = e.target;
  if (d && d.tagName === "DETAILS" && d.open && d.classList.contains("pager")) load(d);
}, true);`;

/** The pager's script for a page that carries a pager fold. */
export function cardPagerScript(): string {
  return `(${INLINE_SCRIPTS.pager})();`;
}

/** Whether a fragment carries a pager fold of a card's list (a stop's departures fold, #938 E1, is not one). */
export const carriesPager = (html: string): boolean => /class="pcard__more pager"(?! data-deps)/u.test(html);

/**
 * #938 E1: whether a fragment carries the "more" fold under a stop's departures. The pager script loads it, but only a
 * place PAGE carries the script for it alone (`PlaceBlock`): the home's script count stays what it was (#404), and
 * there the fold's no-script link opens the place page with the stop's next step in place.
 */
export const carriesDeparturesFold = (html: string): boolean => html.includes('class="pcard__more pager" data-deps="1"');
