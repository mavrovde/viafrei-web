/**
 * The place cards of a FIRST render (#564) — the home's IP rung and a place
 * page — under the render-then-fill rule (`lib/fill.ts`).
 *
 * #981 C1 (data-steward ruling 2026-10-24): a DOCUMENT render never asks
 * Tankerkönig — not even for a person. A client forging a browser's
 * navigation headers (`Sec-Fetch-Mode: navigate`, a google referer) walked the
 * place pages town by town and every GET became a `list.php`; a document
 * request cannot tell that client from a person, so the document asks nothing
 * and the ask moves to the page's own script, which such a client never runs:
 *   1. the cards are read from the digest with the HELD prices and their time
 *      (no fuel note: nothing was asked);
 *   2. for a person's navigation (`personAsks(…, "document")`: no crawler, no
 *      prefetch, no HEAD, not the meta refresh) they are wrapped with a FILL
 *      MARKER whose body carries the island's `how` (`page`, `ip`), so the
 *      page's filler POSTs `/fragment/place` once it runs — and THAT request,
 *      behind the same-origin and `how` checks (`fragmentAsks`), is the one
 *      that asks. A person sees fresh prices one fragment round-trip later; a
 *      client without JavaScript asks nothing and sees the held prices;
 *   3. cards that arrive inside the deadline are the first HTML; cards that do
 *      not are a placeholder the filler fetches whole. Since #1166 a place page
 *      is no exception: it waits at most its own deadline (`PLACE_PAGE_CARDS_MS`),
 *      and its title and canonical address come from the place index and its
 *      slug when the cards are late (`lib/place-page.ts`).
 *
 * #1065 (owner 2026-10-25): the cards are asked with the fuel card DEFERRED
 * (`fuelRows=0`: its frame and heading, no price), and cards that arrived carry
 * no fill marker any more — the ask of step 2 moved to the fuel card's own
 * fragment, `/fragment/place-fuel`, which the page's script asks when the card
 * comes into view, behind the same person gate (`lib/place-fuel.ts`). The
 * placeholder of step 3 (cards that missed the deadline; since #1166 a place page's too) still
 * fetches the cards whole through `/fragment/place`.
 *
 * There is no refresh URL in this module's options on purpose: the document
 * path cannot reach the MCP process's refresh route at all
 * (`test/fuel-c1.test.ts` hands it one anyway and counts zero calls).
 */
import type { Lang } from "../site/pages.js";
import { t } from "../i18n/index.js";
import { PANEL_DEADLINE_MS, placeFill, withDeadline } from "./fill.js";
import { HELD, personAsks, type AskingRequest, type FuelNote, type How } from "./fuel-refresh.js";
import { fetchPlaceAnswer, type PlaceFragment } from "./place.js";
import { fetchLocalAsks, PLACE_ASKS_SSR_MS, spliceAnswers } from "./place-asks.js";
import type { FetchLike, TileFetchOptions } from "./tiles.js";
import { budgetLeft } from "./page-budget.js";

export type FirstRenderOptions = {
  /** The MCP internal listener, for the cards' live answers (#745); undefined: the cards as the digest made them. */
  readonly asksUrl?: string | undefined;
  readonly asksFetch?: FetchLike;
  /** The panel deadline; tests shorten it. */
  readonly deadlineMs?: number;
  /**
   * #1166: where the page's budget ends (epoch ms, `lib/page-budget.ts`). No floor goes past it — not the cards'
   * `CARDS_MIN_MS`, not the live answers' `PLACE_ASKS_SSR_MS`: cards still out then are the placeholder, answers still
   * out are left to the page (the cards as the digest made them). Undefined: the deadlines alone, as before.
   */
  readonly endsAt?: number | undefined;
};

/** `fuel` is always null since #981 C1: a document render asks nothing, so it has no refresh to report. */
export type FirstRender =
  | { readonly kind: "place"; readonly place: PlaceFragment; readonly fuel: FuelNote | null }
  /** The cards missed the deadline: `html` is the placeholder the filler fetches. */
  | { readonly kind: "deferred"; readonly html: string; readonly fuel: FuelNote | null }
  | { readonly kind: "missing" }
  /** #1070: the point is far from Germany: the page shows all of Germany. */
  | { readonly kind: "far" }
  | { readonly kind: "failed" };

/** The least time the cards get, ms: a warm digest answers in well under 10. */
export const CARDS_MIN_MS = 250;

/** What a place's cards are asked with — the placeholder's fill body; the first render's and the deferred page's. */
type CardsAsk = { readonly snap?: boolean; readonly how: How; readonly request: AskingRequest; readonly ev?: string };

/**
 * The placeholder the page's filler fetches the cards through (`placeFill`): the cards of `at`, asked with the island's
 * `how` when a person's page asks (#981 C1), with the address's charging filter (#1081, #1166).
 */
export function placeCardsPlaceholder(at: string, lang: Lang, o: CardsAsk): string {
  // #981 C1: whether the PAGE's script will ask, never whether this render asks — it asks nothing.
  const asks = personAsks(o.request, "document");
  // The fill marker: a person's page asks through its filler with the island's `how`; a render that is not a
  // person's (a reload, a script) leaves a placeholder that asks nothing either: `held`.
  // #1166: a place page's charging filter (`ev_*`) rides the fill too, so the cards that arrive late are the filtered ones.
  const body = { at, lang, how: asks ? o.how : HELD, ...(o.snap === true ? { snap: true as const } : {}), ...(typeof o.ev === "string" && o.ev !== "" ? { ev: o.ev } : {}) };
  return placeFill(null, body, t(lang, "place.fuelUnavailable"), lang);
}

export async function placeFirstRender(
  at: string,
  lang: Lang,
  o: TileFetchOptions &
    FirstRenderOptions & {
      readonly snap?: boolean;
      readonly how: How;
      readonly request: AskingRequest;
      /**
       * #1166: a place page — cards the digest FAILED to give are a placeholder the filler fetches as well, never an
       * error page: the page knows its place already (the slug resolved to its key), only its cards are missing.
       */
      readonly deferFailed?: boolean;
      /** #1061: a place page's no-script `?<card>=N`, as `card:N` (`placeOpenOf`). */
      readonly open?: string | null;
      /** #1081: the address's charging filter (`chargingFilterForward`), "" for none. */
      readonly ev?: string;
    },
): Promise<FirstRender> {
  const t0 = Date.now();
  const deadline = o.deadlineMs ?? PANEL_DEADLINE_MS;
  // #981 C1: whether the PAGE's script will ask, never whether this render asks — it asks nothing.
  const asks = personAsks(o.request, "document");
  const fuel: FuelNote | null = null;
  // #1065: a document's fuel card is its frame alone — no price, no station row, no MTS-K line in the HTML.
  const read = fetchPlaceAnswer(at, lang, { ...o, fuel, deferFuel: true });
  // #745: a person's view of a Gemeinde asks for the cards' live answers beside the cards' read (a place page knows its
  // key already; the IP rung learns it from the cards). Never for a crawler, a prefetch or a HEAD.
  const local = (key: string) => fetchLocalAsks(key, { baseUrl: o.asksUrl, timeoutMs: PLACE_ASKS_SSR_MS, ...(o.asksFetch === undefined ? {} : { fetchImpl: o.asksFetch }) });
  const early = asks && /^ags:\d{8}$/u.test(at) ? local(at) : null;
  // #1166: the floor is the cards' own; the page's budget (`endsAt`) caps it.
  const cardsMs = Math.min(Math.max(CARDS_MIN_MS, deadline - (Date.now() - t0)), budgetLeft(o.endsAt));
  const r = await withDeadline(read, cardsMs, "late" as const);
  if (r === "late" || (r.kind === "failed" && o.deferFailed === true)) return { kind: "deferred", html: placeCardsPlaceholder(at, lang, o), fuel };
  if (r.kind !== "place") return r;
  const pending = asks ? (early ?? local(r.place.at)) : null;
  // #1166: answers still out when the budget ends are left out — the cards as the digest made them, never a later page.
  const answers = pending === null ? new Map() : o.endsAt === undefined ? await pending : await withDeadline(pending, budgetLeft(o.endsAt), new Map());
  const cards = spliceAnswers(r.place.html, lang, answers);
  // #1065: no fill marker on cards that arrived — the marker existed for the fuel ask alone, and that ask is now the
  // fuel card's own `/fragment/place-fuel`, made by the page's script when the card is in view (a person's view).
  return { kind: "place", place: { ...r.place, html: cards }, fuel };
}
