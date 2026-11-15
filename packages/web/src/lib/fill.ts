/**
 * Render, then fill (#564, owner 2026-10-12: "If the init of page is slow - do
 * it asynchronous in background then show. You can use this approach for all
 * panels.").
 *
 * Every panel of the home and of a place page — each live tile, the place
 * cards, the fuel card's fresh prices — is fetched server-side with a SHORT
 * per-panel deadline (`PANEL_DEADLINE_MS`). A panel that answers in time is in
 * the first HTML exactly as before: a reader without JavaScript and a crawler
 * get the whole page. A panel that misses it is printed as a PLACEHOLDER of
 * the same shape and size (`tile is-loading`, the same header, figure and note
 * as the error tile), saying in words that it is loading, and carrying the
 * same-origin fragment URL it can be fetched from. The one inline script below
 * (`panelFill`, under the request's nonce) then fetches each placeholder in
 * the background — from THIS origin only (`connect-src 'self'`), never a third
 * party — and swaps the answer in, with the `is-new` fade unless reduced
 * motion is asked for. A background fetch that fails turns the placeholder
 * into the panel's error state with its sentence: never a blank card.
 *
 * The mechanism knows nothing about any one card: a placeholder is an element
 * carrying `data-vf-fill` (the path), optionally `data-vf-body` (a JSON body,
 * then it is a POST), `data-vf-shape` (which answers are ours), `data-vf-id`
 * (the id of the element that arrives) and, for the failure, any descendant
 * carrying `data-vf-failtext` and/or a `data-vf-failsel` selector with
 * `data-vf-failtext` on the placeholder itself. A new card the digest adds to
 * the place fragment needs no code here.
 *
 * Counting it honestly (the page-weight gate): the script is inline, so it is
 * no request of its own; a background fetch exists only for a panel that
 * MISSED its deadline, so a healthy render makes none, and the gate's run —
 * the real digest renderer over fixtures — measures the first HTML with every
 * panel in it. The fetches are same-origin and named here, not hidden.
 */
import { agePill, esc, tileNote, tileShell } from "@viafrei/design";
import type { Lang } from "../site/pages.js";
import { t } from "../i18n/index.js";
import type { How } from "./fuel-refresh.js";
import { INLINE_SCRIPTS } from "./inline-scripts.js";
import { RETRY_WAITS_MS, type askAgain as AskAgain } from "./fragment-retry.js";

/**
 * The per-panel deadline of the first render, ms. Measured 2026-10-12: the
 * digest answers a warm tile in under 10 ms (p95 over 200 requests per tile,
 * `fragment-latency.test.ts`) and a cold one under 1 s; the home's own p95
 * with a healthy digest is 5 ms (`scripts/latency.ts`). Production's cold
 * place round is the slow case (six statements on a busy database), and that
 * is the case this exists for: 500 ms keeps every warm panel in the first
 * HTML with two orders of magnitude to spare and bounds the page at half a
 * second when a source is slow, instead of the 2 s tile deadline.
 */
export const PANEL_DEADLINE_MS = 500;

/**
 * #1239: the longest a visitor looks at a tile's loading state before it says its error, ms, counted from the moment the
 * page's filler starts (the page is shown). The owner's ceiling is two seconds (2026-10-26). A hanging digest costs the
 * shell's whole 2 s tile deadline per ask, and the asks again after `RETRY_WAITS_MS` come on top — about 14 s in all, the
 * defect. So the tile says its error at this mark and the asks go on behind it; an answer that arrives later still
 * replaces the error tile. 1.5 s leaves a slow-but-live tile its room (a warm digest answers in milliseconds, the e2e
 * stub's "slow" tile in 1 s) and the page half a second to start its script inside the ceiling.
 */
export const TILE_SHOW_BY_MS = 1_500;

/** Resolve with `p`, or with `fallback` once `ms` passed — whichever is first. Never rejects if `p` does not. */
export async function withDeadline<T, F>(p: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<F>((r) => { timer = setTimeout(() => r(fallback), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A tile that missed the deadline: the error tile's exact shape (header, age
 * pill, figure, note — so no layout jump), the state `is-loading`, words that
 * say so, the same-origin path to fill it from, and the error words it turns
 * into if that fails.
 */
export function tilePlaceholder(id: string, title: string, lang: Lang, path: string): string {
  return tileShell({
    id,
    state: "loading",
    title: esc(title),
    pill: agePill({ word: esc(t(lang, "tile.loading")), wordAttrs: { "data-vf-failtext": t(lang, "tile.error") } }),
    figure: { value: null, unit: esc("") },
    note: tileNote(esc(t(lang, "tile.loadingNote")), { "data-vf-failtext": t(lang, "tile.errorNote") }),
    credits: [],
    attrs: { "aria-busy": "true", "data-vf-fill": path, "data-vf-shape": "tile", "data-vf-id": `tile-${id}` },
  });
}

/** The place fragment's fill request (POST /fragment/place): the key, the language, how, and whether to answer a point as its Gemeinde. */
/** `polls` (#712): how many fills of this pending card came before (a count, never a cap); `head`: how many of the last were at the queue's head (the back-off). */
/** `how` (#981 C1): `fill` for a re-read, `held` for none, or the island's own `how` (`page`, `ip`) — a first render's marker, the page's one ask. */
export type PlaceFillBody = { readonly at: string; readonly lang: Lang; readonly how: How | "held"; readonly snap?: true; readonly polls?: number; readonly head?: number; readonly ev?: string };

/**
 * The place cards, wrapped to be filled: either the cards that DID arrive with
 * the fuel card's prices still on their way (`inner` is the digest's section,
 * and on failure its pending sentence becomes the "could not be asked" one),
 * or nothing yet (`inner` null: a placeholder saying the cards are loading,
 * which on failure says they could not be loaded).
 */
export function placeFill(inner: string | null, body: PlaceFillBody, failText: string, lang: Lang, delayMs?: number): string {
  // `delayMs` (#712): a pending card is re-read about when the queue said its request is sent.
  const delay = delayMs === undefined || !Number.isFinite(delayMs) || delayMs <= 0 ? "" : ` data-vf-delay="${String(Math.ceil(delayMs))}"`;
  const attrs = `data-vf-fill="/fragment/place" data-vf-body="${esc(JSON.stringify(body))}" data-vf-shape="place" data-vf-id="place-cards" data-vf-failsel=".pcard__fresh--pending" data-vf-failtext="${esc(failText)}"${delay}`;
  if (inner !== null) return `<div class="place-fill" ${attrs}>${inner}</div>`;
  return `<div class="place-fill place-fill--loading is-loading" aria-busy="true" ${attrs}><p class="place-fill__note" data-vf-failtext="${esc(t(lang, "place.failed"))}">${esc(t(lang, "place.loadingCards"))}</p></div>`;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- runs in a browser, tested against a fake one; `any` is the honest type of both */
/**
 * The filler. Self-contained ON PURPOSE (serialised with `toString`, like the
 * location island): it references only its parameter and the browser's
 * globals through `w`. `test/fill.test.ts` runs this very text.
 *
 * #1239: a TILE says its error once the visitor has looked at "loading" for `showByMs` (`TILE_SHOW_BY_MS`), while its
 * asks go on behind it; an answer that arrives afterwards still replaces the error tile. The place cards keep loading
 * through their asks (#1224): their placeholder is the honest state of a cold read, and `place.failed` comes only when
 * the asks are spent.
 */
export function panelFill(w: any, askAgain: typeof AskAgain, waits: readonly number[], showByMs: number): void {
  const d = w.document;
  const SHAPES: Record<string, RegExp> = {
    // #717 C-4: the fuel tile's root also carries the Clarity stop marker after its state
    tile: /^<section class="tile (?:tile--[a-z]+ )?is-(?:ok|stale|empty|error)(?: vf-noclarity)?"/,
    // #712: or the cards wrapped once more, while the person's request still waits in the queue; #1224 (2.5.22): or the
    // shell's LOADING placeholder (`place-fill place-fill--loading`, the #1184/#1198 answer for a read that missed the
    // deadline or was refused at the digest's cold-read limit) — still loading, filled again after its own delay.
    place: /^<(?:section class="place" id="place-cards"|div class="place-fill[" ])/,
  };
  const reduce = (): boolean => typeof w.matchMedia === "function" && w.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  const fail = (el: any): void => {
    el.classList.remove("is-loading");
    el.classList.add("is-error");
    el.removeAttribute("aria-busy");
    const text = el.getAttribute("data-vf-failtext");
    const sel = el.getAttribute("data-vf-failsel");
    if (text !== null && sel !== null) for (const n of Array.from<any>(el.querySelectorAll(sel))) n.textContent = text;
    for (const n of Array.from<any>(el.querySelectorAll("[data-vf-failtext]"))) n.textContent = n.getAttribute("data-vf-failtext");
  };
  // #712, no lost requests, info ASAP: a re-read waits what the route said (the queue's ETA), 2 s at least and five
  // minutes at most (`FUEL_FILL_MIN_MS`/`FUEL_FILL_MAX_MS`); a failed read is tried again after 30 s
  // (`FUEL_FILL_RETRY_MS`). Literals here because this text runs alone in the page.
  const MIN_DELAY_MS = 2_000;
  const MAX_DELAY_MS = 300_000;
  const RETRY_MS = 30_000;
  // Paused while the page is hidden, resumed when it is shown again.
  const shown = (): Promise<void> =>
    d.hidden !== true
      ? Promise.resolve()
      : new Promise<void>((r) => {
          const on = (): void => {
            if (d.hidden === true) return;
            d.removeEventListener("visibilitychange", on);
            r();
          };
          d.addEventListener("visibilitychange", on);
        });
  // Cards that arrived with only their prices pending: a failed re-read is tried again, never said as a refusal —
  // only the MCP process's own verdict says the prices could not be had.
  const pendingCards = (el: any): boolean => el.getAttribute("data-vf-shape") === "place" && Array.from<any>(el.querySelectorAll(".pcard__fresh--pending")).length > 0;
  const failed = (el: any): void => {
    if (!pendingCards(el) || el.isConnected === false) return fail(el);
    el.setAttribute("data-vf-delay", String(RETRY_MS));
    void fill(el);
  };
  const fill = async (el: any): Promise<void> => {
    const path: string = el.getAttribute("data-vf-fill") ?? "";
    const shape = SHAPES[el.getAttribute("data-vf-shape") ?? ""];
    // Only this origin's fragment routes: a placeholder can never point the browser anywhere else.
    if (!/^\/fragment\/[a-z]+(\?[a-z0-9=&_.-]*)?$/.test(path) || shape === undefined) return fail(el);
    const delay = Number(el.getAttribute("data-vf-delay") ?? "0");
    if (Number.isFinite(delay) && delay > 0) {
      await new Promise<void>((r) => {
        w.setTimeout(r, Math.min(Math.max(delay, MIN_DELAY_MS), MAX_DELAY_MS));
      });
      await shown();
      // Replaced while it waited (another place chosen): nothing to fill.
      if (el.isConnected === false) return;
    }
    const body: string | null = el.getAttribute("data-vf-body");
    // #1239: a tile's error at `showByMs`, its asks going on behind it (see the doc comment)
    let answered = false;
    const showBy =
      el.getAttribute("data-vf-shape") === "tile"
        ? w.setTimeout(() => {
            if (!answered && el.isConnected !== false) fail(el);
          }, showByMs)
        : null;
    // #1224: a 5xx or no answer at all is asked again (`lib/fragment-retry.ts`) while the placeholder keeps loading;
    // a placeholder another place replaced meanwhile stops the asking.
    const res: any = await askAgain(
      w,
      () => w.fetch(path, body === null ? { headers: { accept: "text/html" }, credentials: "omit" } : { method: "POST", headers: { accept: "text/html", "content-type": "application/json" }, body, credentials: "omit" }),
      (_r: unknown, u: boolean) => el.isConnected !== false && u,
      waits,
      false,
    );
    answered = true;
    if (showBy !== null) w.clearTimeout(showBy);
    if (res === null) return failed(el);
    // A refusal of the shell's own (4xx: no such place, a bad body) is final; a 5xx has spent its asks.
    if (res.status !== 200) return res.status >= 400 && res.status < 500 ? fail(el) : failed(el);
    const html: string = await res.text();
    if (!shape.test(html) || /<script|javascript:/i.test(html)) return failed(el);
    // A place another rung put in the slot meanwhile wins: a detached placeholder is not filled.
    if (el.isConnected === false) return;
    el.outerHTML = html;
    const id = el.getAttribute("data-vf-id");
    const arrived = id === null ? null : d.getElementById(id);
    if (arrived !== null && !reduce()) arrived.classList.add("is-new");
    let label = "";
    try {
      label = decodeURIComponent(res.headers.get("place-label") ?? "");
    } catch {
      label = "";
    }
    try {
      d.dispatchEvent(new w.CustomEvent("vf:filled", { detail: { id, label, key: res.headers.get("place-key"), slug: res.headers.get("place-slug") } }));
      // The answer is itself to be filled once more (#712: the request still waits in the queue): wake the scan for it.
      if (/^<div class="place-fill[" ]/.test(html)) d.dispatchEvent(new w.CustomEvent("vf:fill"));
    } catch {
      /* no CustomEvent: nobody to tell */
    }
  };
  const busy = new Set<any>();
  const scan = (): void => {
    for (const el of Array.from<any>(d.querySelectorAll("[data-vf-fill]"))) {
      if (busy.has(el)) continue;
      busy.add(el);
      void fill(el);
    }
  };
  // The location island announces cards it put in the slot that still carry a fill.
  d.addEventListener("vf:fill", scan);
  scan();
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

/** The script text a page carries: the filler, nothing else. */
export function fillScript(): string {
  // #1224: with the one ask-again of a part that did not answer, and its waits (`lib/fragment-retry.ts`)
  // #1239: and the moment a tile stops making the visitor wait (`TILE_SHOW_BY_MS`)
  return `(${panelFill.toString()})(window, ${INLINE_SCRIPTS.retry}, ${JSON.stringify(RETRY_WAITS_MS)}, ${String(TILE_SHOW_BY_MS)});`;
}
