/**
 * THE event list of viafrei.de's analytics (#375, GA rules comment, rule 5).
 *
 * Nine names, closed (six until #564 added `location_source`, seven until #938 added `card_more`, eight until #939
 * added `card_refresh`). A name that is not here cannot be sent: `track()` takes
 * an `EventName`, `assertEventName()` is the runtime door for anything that
 * arrives as a string, and `events.test.ts` fails on a seventh name wherever
 * it is written. `location_source` says HOW the home knew its place —
 * browser, ip, manual, saved or none — and never WHICH place (#564 § 6). No parameter carries free text — every parameter is an enum
 * or a path from `site/pages.ts` — because rule 4 says a "My board" value
 * (a place, a line, a road) may never reach Google, and the cheapest way to
 * make that true is a parameter type that cannot hold one.
 *
 * Nothing here contacts Google. The consent island (`components/Consent.svelte`)
 * is the only code that loads gtag.js, only after the accept control is
 * clicked, and only when `GOOGLE_TAG` is set (rules 1, 2). This module is the
 * vocabulary; the island is the mouth.
 */
import type { ConnectSource } from "@viafrei/design";
import type { Lang } from "../site/pages.js";

export const EVENTS = [
  "page_view",
  "cta_connect_click",
  "cta_developers_click",
  "language_switch",
  "consent_accept",
  "consent_decline",
  "location_source",
  "card_more",
  "card_refresh",
  "cta_business_click",
  "dev_copy",
] as const;

/** #992: the business page's calls to action, each a closed-list word on its anchor (`data-vf-cta`). */
export const BUSINESS_CTAS = ["contact", "pilot", "live"] as const;
export type BusinessCta = (typeof BUSINESS_CTAS)[number];
export function isBusinessCta(x: unknown): x is BusinessCta {
  return typeof x === "string" && (BUSINESS_CTAS as readonly string[]).includes(x);
}
/** #992: what the developers page's copy buttons copy, and the quickstart tab (or the try-it) it was copied from. */
export const DEV_COPY_WHATS = ["config", "curl"] as const;
export type DevCopyWhat = (typeof DEV_COPY_WHATS)[number];
export const DEV_CLIENTS = ["claudeCode", "cursor", "vscode", "windsurf", "codex", "stdio", "http", "tryit"] as const;
export type DevClient = (typeof DEV_CLIENTS)[number];
export function isDevClient(x: unknown): x is DevClient {
  return typeof x === "string" && (DEV_CLIENTS as readonly string[]).includes(x);
}

/**
 * #938 C5: the cards an event may name — the place cards and the motorway page's card kinds, a closed list (the
 * digest's `PLACE_CARD_IDS` and `MOTORWAY_KINDS`; the shell may not import the digest, `card-events.test.ts` holds
 * them equal). A card id names a kind of list, never a place, a line or a road.
 */
export const CARD_EVENT_IDS = [
  "stations", "parking", "roads", "motorways", "lorry", "charging", "warnings", "groceries", "health", "money", "food", "lodging", "garage", "police", "toilets", "neighbours", "lifts", "fuel", "speed",
  "closures", "jams", "weather", "roadweather", "roadworks", "planned", "crossings", "detours", "messages", "cities", "cameras", "bridges", "borders",
] as const;
export type CardEventId = (typeof CARD_EVENT_IDS)[number];
export function isCardEventId(x: unknown): x is CardEventId {
  return typeof x === "string" && (CARD_EVENT_IDS as readonly string[]).includes(x);
}
/** The most steps a card event counts; a larger number is sent as this (a count, never an identifier). */
export const CARD_STEP_MAX = 50;

/** The rungs of the location ladder, as the event names them — never a place. */
export const LOCATION_SOURCES = ["browser", "ip", "manual", "saved", "none"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];
export function isLocationSource(x: unknown): x is LocationSource {
  return typeof x === "string" && (LOCATION_SOURCES as readonly string[]).includes(x);
}

export type EventName = (typeof EVENTS)[number];

/** The parameters each event may carry — enums and site paths, never a free string. */
export type EventParams = {
  readonly page_view: { readonly route: `/${string}`; readonly lang: Lang };
  /**
   * #1001: a click on the "how to connect" link of the note under an example answer is `where: "note"` with the
   * SURFACE it stood on (`surface`, a closed list of `@viafrei/design`), so the report says which surface converts.
   * Never a parameter named `source`, `medium`, `campaign` or `term`: GA4 reads those as traffic attribution and
   * overwrites the session's source (2026-10-24, "browser / (not set)" appeared as a session source).
   * #1003: a successful copy of the endpoint chip is `where: "copy"` with the chip's surface, sent by the consent
   * island on the copy script's `vf:endpoint-copy` event (never a click on a link).
   */
  readonly cta_connect_click:
    | { readonly lang: Lang; readonly where: "hero" | "header" | "audience" | "moment" | "start" | "sticky" }
    | { readonly lang: Lang; readonly where: "note" | "copy"; readonly surface: ConnectSource };
  readonly cta_developers_click: { readonly lang: Lang; readonly where: "hero" | "audience" };
  readonly language_switch: { readonly from: Lang; readonly to: Lang };
  readonly consent_accept: Record<never, never>;
  readonly consent_decline: Record<never, never>;
  readonly location_source: { readonly lang: Lang; readonly method: LocationSource };
  /** #938 C5: a card's fold loaded its next entries — which kind of card, and how many steps it has loaded (1..CARD_STEP_MAX). */
  readonly card_more: { readonly lang: Lang; readonly card: CardEventId; readonly step: number };
  /** #939: a card refreshed in place — which kind, by hand or by itself (sampled), and whether its content changed. */
  readonly card_refresh: { readonly lang: Lang; readonly card: CardEventId; readonly how: RefreshHow; readonly result: RefreshResult };
  /** #992: a call to action of the business page — the pilot, the contact mail (a `mailto:` link, counted all the same) or "see it live"; never the address. */
  readonly cta_business_click: { readonly lang: Lang; readonly cta: BusinessCta };
  /** #992: a successful copy on the developers page — a client's config, or a curl — and which tab; never what was copied. */
  readonly dev_copy: { readonly lang: Lang; readonly what: DevCopyWhat; readonly client: DevClient };
};

/** #939: how a card was refreshed, and what came back. */
export const REFRESH_HOWS = ["manual", "auto"] as const;
export type RefreshHow = (typeof REFRESH_HOWS)[number];
export const REFRESH_RESULTS = ["changed", "unchanged"] as const;
export type RefreshResult = (typeof REFRESH_RESULTS)[number];

export function isEventName(name: string): name is EventName {
  return (EVENTS as readonly string[]).includes(name);
}

/** The runtime door: a string that is not on the list is an error, not a hit. */
export function assertEventName(name: string): EventName {
  if (!isEventName(name)) throw new Error(`analytics: '${name}' is not one of the ${EVENTS.length} events in src/analytics/events.ts`);
  return name;
}

/** What a transport receives: the name and its typed parameters, nothing else. */
export type TrackedEvent<N extends EventName = EventName> = { readonly name: N; readonly params: EventParams[N] };

export function event<N extends EventName>(name: N, params: EventParams[N]): TrackedEvent<N> {
  return { name: assertEventName(name) as N, params };
}
