/**
 * The ONE analytics listener of the shell (GA rules 4 and 7, #375 comment).
 *
 * Pure: these functions decide, from a clicked element's attributes and the
 * page's path, which of the events (if any) a click is — and what the
 * `page_view` parameters are. They are called by the consent island, which is
 * the only script on the site, from one delegated `click` listener on
 * `document`. Nothing inside a tile is ever an event: a tile's only links are
 * its credit lines, which point off-site, and a refreshed tile (My board,
 * later) cannot re-register anything because nothing is registered on it.
 *
 * Rule 4 by type: the parameters are a page of the map and a language, never
 * a query string, never a hash, never a value typed by the visitor.
 */
import { CONNECT_SOURCE_ATTR, isConnectSource, type ConnectSource } from "@viafrei/design";
import { CARD_STEP_MAX, DEV_COPY_WHATS, REFRESH_HOWS, REFRESH_RESULTS, event, isBusinessCta, isCardEventId, isDevClient, type BusinessCta, type DevCopyWhat, type RefreshHow, type RefreshResult, type TrackedEvent } from "./events.js";
import { HOME_REFRESH_URL, LIVE_LANGS, allPaths, pageAt, pathFor, type Lang } from "../site/pages.js";
import { motorwayPageOf, motorwayPath } from "../site/motorways.js";

/** What the listener needs to know about the click: the anchor's href and where it sits. */
export type ClickFacts = {
  readonly href: string | null;
  readonly insideTile: boolean;
  readonly insideLangs: boolean;
  readonly where: "hero" | "header" | "audience" | "moment" | "start" | "sticky" | null;
  /** #1001: the surface a "works only with ViaFrei connected" note's link names (`data-cta-source`), or null. */
  readonly source?: ConnectSource | null;
  /** #992: the business page's call to action the anchor names (`data-vf-cta`, a closed list), or null. */
  readonly cta?: BusinessCta | null;
};

/** #992: the attribute a business call to action carries. */
export const BUSINESS_CTA_ATTR = "data-vf-cta";
/** #992: the DOM event the code-copy script fires after a successful copy: `{ detail: { what, client } }`. */
export const CODE_COPY_EVENT = "vf:code-copy";

/**
 * Whether this render is the home's automatic 20-minute reload (`HOME_REFRESH_URL`, `?r=auto`), not a person's
 * visit (2.4.3: GA showed 519 page views of `/de` from 2 users in a week — every reload of an open tab was a
 * `page_view`). On such a render the page-load events (`page_view`, `location_source`) are not sent; an event a
 * person causes on it (a click, a copy, a fold) still is.
 */
export function isAutomaticReload(href: string): boolean {
  const [key, value] = HOME_REFRESH_URL.slice(1).split("=") as [string, string];
  try {
    return new URL(href).searchParams.get(key) === value;
  } catch {
    return false;
  }
}

export function isLang(x: string): x is Lang {
  return (LIVE_LANGS as readonly string[]).includes(x);
}

/**
 * The route of a page view: the path when it is a page of the map or the
 * canonical page of a motorway of the static register (#716 G3; a stretch
 * below it counts as that page, #892), else `/` —
 * never the search or the hash.
 */
export function pageView(pathname: string, lang: Lang): TrackedEvent<"page_view"> {
  const clean = pathname.split(/[?#]/)[0] ?? "/";
  // #892: a stretch below a motorway page is a view of that motorway's page — its junction names never leave.
  const motorway = motorwayPageOf(clean);
  const route = allPaths().includes(clean) || clean === "/" ? (clean as `/${string}`) : motorway !== null ? motorwayPath(motorway.lang, motorway.road) : "/";
  return event("page_view", { route, lang });
}

/** A click is an event only when it is one of the three kinds the list names. */
export function clickEvent(f: ClickFacts, lang: Lang): TrackedEvent | null {
  if (f.href === null) return null;
  // #992: a business call to action counts whatever its href — the contact is a mailto: link — and never inside a tile
  if (f.cta !== undefined && f.cta !== null && !f.insideTile) return event("cta_business_click", { lang, cta: f.cta });
  // #1177: the sticky bar counts on the home too, where it goes to the page's own #start
  if (f.where === "sticky") return event("cta_connect_click", { lang, where: "sticky" });
  const path = f.href.startsWith("/") ? (f.href.split(/[?#]/)[0] ?? "") : null;
  if (path === null) return null; // off-site or external: a credit line, never counted
  // #1001: the note's guide link is the site's own link with a closed-list surface, never data, so it counts inside a
  // live block too (the place cards, the motorway page's assistant block); anything else inside one does not (rule 7).
  if (f.source !== undefined && f.source !== null && path === pathFor("connect", lang)) return event("cta_connect_click", { lang, where: "note", surface: f.source });
  if (f.insideTile) return null;
  if (f.insideLangs) {
    const to = pageAt(path);
    if (to === null || to.lang === lang) return null;
    return event("language_switch", { from: lang, to: to.lang });
  }
  if (path === pathFor("connect", lang) && f.where !== null) return event("cta_connect_click", { lang, where: f.where });
  if (path === pathFor("developers", lang) && (f.where === "hero" || f.where === "audience")) return event("cta_developers_click", { lang, where: f.where });
  return null;
}

/** #992: the code-copy script's `vf:code-copy` detail as an event, or null for anything off the two closed lists. */
export function devCopyEvent(detail: unknown, lang: Lang): TrackedEvent<"dev_copy"> | null {
  const d = (typeof detail === "object" && detail !== null ? detail : {}) as { what?: unknown; client?: unknown };
  if (!(DEV_COPY_WHATS as readonly unknown[]).includes(d.what) || !isDevClient(d.client)) return null;
  return event("dev_copy", { lang, what: d.what as DevCopyWhat, client: d.client });
}

/**
 * #1003: a copy of the endpoint chip is `cta_connect_click` with `where: "copy"` and the chip's surface — only a
 * word of the closed list (the `vf:endpoint-copy` event's detail), never anything else the page holds. The consent
 * island calls this, so it is sent only after consent.
 */
export function copyEvent(surface: unknown, lang: Lang): TrackedEvent<"cta_connect_click"> | null {
  return isConnectSource(surface) ? event("cta_connect_click", { lang, where: "copy", surface }) : null;
}

/**
 * #938 C5: a card's fold loaded a step (the pager's `vf:card-more`) — the card's KIND from the closed list and the
 * step count, clamped; anything else is not sent. The consent island calls this, so it is sent only after consent.
 */
export function cardMoreEvent(detail: unknown, lang: Lang): TrackedEvent<"card_more"> | null {
  const d = (typeof detail === "object" && detail !== null ? detail : {}) as { card?: unknown; step?: unknown };
  if (!isCardEventId(d.card) || typeof d.step !== "number" || !Number.isInteger(d.step) || d.step < 1) return null;
  return event("card_more", { lang, card: d.card, step: Math.min(d.step, CARD_STEP_MAX) });
}

/**
 * #939: a card refreshed in place (the refresh script's `vf:card-refresh`, an automatic one already sampled there) —
 * the card's kind, manual or auto, changed or unchanged; anything else is not sent. Sent only after consent.
 */
export function cardRefreshEvent(detail: unknown, lang: Lang): TrackedEvent<"card_refresh"> | null {
  const d = (typeof detail === "object" && detail !== null ? detail : {}) as { card?: unknown; how?: unknown; result?: unknown };
  if (!isCardEventId(d.card) || !(REFRESH_HOWS as readonly unknown[]).includes(d.how) || !(REFRESH_RESULTS as readonly unknown[]).includes(d.result)) return null;
  return event("card_refresh", { lang, card: d.card, how: d.how as RefreshHow, result: d.result as RefreshResult });
}

/** Where a click happened: the FIRST region in this order that contains it. */
const WHERE: readonly (readonly [string, NonNullable<ClickFacts["where"]>])[] = [
  [".actionbar", "sticky"],
  [".hero", "hero"],
  [".site-head", "header"],
  [".audience", "audience"],
  [".moment", "moment"],
  [".start", "start"],
];

/**
 * G3 (#716): the page's location and referrer as gtag may send them — origin
 * and path only, the query and the fragment cut off (no stretch, direction or
 * layer choice ever reaches Google). A referrer that is not a URL is dropped.
 */
export function cleanLocation(href: string): string {
  try {
    const u = new URL(href);
    // #892: a stretch below a motorway's page is reported as that page — the junction names never leave
    const mw = motorwayPageOf(u.pathname);
    return `${u.origin}${mw === null ? u.pathname : motorwayPath(mw.lang, mw.road)}`;
  } catch {
    return "";
  }
}

/** The regions whose content is live data (rule 7): the tiles and, since #716, the motorway page's body with its fuel fragment. */
/** #890 (G5.5): the motorway page's position bar and its "around you" block send no click event either. */
export const LIVE_BLOCKS = ".tile, .motorway-page, .placebar--motorway, .mwa";

/** Read the facts off a DOM anchor, with no DOM type here so the function is testable in node. */
export function factsOf(el: { closest(sel: string): unknown; getAttribute(name: string): string | null } | null): ClickFacts {
  if (el === null) return { href: null, insideTile: false, insideLangs: false, where: null, source: null, cta: null };
  const href = el.getAttribute("href");
  const where = WHERE.find(([sel]) => el.closest(sel))?.[1] ?? null;
  // #1001: the surface, only when the anchor itself names one of the closed list — never a value read from anywhere else
  const named = el.getAttribute(CONNECT_SOURCE_ATTR);
  const source = isConnectSource(named) ? named : null;
  // #992: the business page's call to action, only when the anchor names one of the closed list
  const ctaNamed = el.getAttribute(BUSINESS_CTA_ATTR);
  const cta = isBusinessCta(ctaNamed) ? ctaNamed : null;
  // G4 (#716): the motorway page's digest-rendered body — its live blocks and the fuel fragment loaded into it — counts as a tile: no click inside it is an event.
  return { href, insideTile: el.closest(LIVE_BLOCKS) !== null, insideLangs: el.closest(".langs") !== null, where, source, cta };
}
