/**
 * The IP rung, server-side (#564 § 1 step 1): the first HTML of the home holds
 * the cards of the visitor's approximate place when the local file can name
 * one — no JavaScript needed — the nearest German place's cards when the address
 * is just across the border, "Ganz Deutschland" when it is farther (#1070), or
 * nothing (Germany-wide) when it cannot.
 *
 * The address is read from the request, looked up in the file and dropped: it
 * is passed to no other function, logged nowhere and never sent to the digest
 * (`test/location.test.ts`). A crawler is not located at all: `/` renders
 * Germany-wide for it, and the place pages are what it indexes (§ 5).
 */
import type { Lang } from "../site/pages.js";
import { ROBOTS_CRAWLERS } from "../site/crawlers.js";
import type { PlaceFragment } from "../lib/place.js";
import type { TileFetchOptions } from "../lib/tiles.js";
import { placeFirstRender, type FirstRenderOptions } from "../lib/place-first.js";
import { clientIp } from "./client-ip.js";
import { sharedGeoIp, type GeoIp } from "./geoip.js";
import { serverRung } from "./ladder.js";
import { placeScopeOf } from "../lib/place-scope.js";

/** The generic words a robot's user agent carries. */
export const CRAWLER_WORDS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|lighthouse|headless/i;

/** The pattern for a token list: the generic words OR any token, escaped, case-insensitive (exported for the test's mutant). */
export function crawlerPattern(tokens: readonly string[]): RegExp {
  return new RegExp([CRAWLER_WORDS.source, ...tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))].join("|"), "i");
}

/**
 * A user agent that announces itself as a robot: the generic words, and every
 * token robots.txt names a group for (`ROBOTS_CRAWLERS`: the AI agents, the SEO tools, the paced crawlers) — read
 * from that one list, never typed again (#1065 steward C1 / PF3: the words
 * alone missed `meta-externalagent`, `omgili`, `GoogleOther` and
 * `Webzio-Extended`). Case-insensitive, matched anywhere in the string. Not a
 * security boundary — a courtesy to the index, and the person gate's first
 * question (`lib/fuel-refresh.ts` `personAsks`).
 */
export const CRAWLER = crawlerPattern(ROBOTS_CRAWLERS);

export type HomePlace = {
  /** #1088: `chosen` — the address named a Gemeinde, a district or a postcode (`?at=`); `germany` — `?scope=de`. */
  readonly source: "ip" | "none" | "outside" | "chosen" | "germany";
  readonly place: PlaceFragment | null;
  /**
   * The IP rung's place when its cards missed the first render's deadline
   * (#564): the key the island keeps, and the placeholder HTML the page fills
   * in the background. Null otherwise.
   */
  readonly deferred?: { readonly at: string; readonly html: string } | null;
  /** Whether the file was consulted for this page — DB-IP's line is printed when it was. */
  readonly usedGeoIp: boolean;
};

export async function homePlace(
  headers: { get(n: string): string | null },
  lang: Lang,
  o: TileFetchOptions & FirstRenderOptions & { readonly geoipFile: string | undefined; readonly geo?: GeoIp | null; readonly method?: string; readonly url?: string; readonly ev?: string },
): Promise<HomePlace> {
  const none: HomePlace = { source: "none", place: null, usedGeoIp: false };
  // #1088: the address's own choice comes first and needs no lookup — "Ganz Deutschland" (`?scope=de`) looks up
  // nothing at all, and an addressable key (`?at=`: a Gemeinde, a district, a postcode; never a point) is that place.
  const ask = o.url === undefined ? { kind: "none" as const } : placeScopeOf(new URL(o.url, "http://x").searchParams);
  if (ask.kind === "germany") return { source: "germany", place: null, usedGeoIp: false };
  if (ask.kind === "at") {
    const r = await placeFirstRender(ask.at, lang, { ...o, how: "page", request: { method: o.method ?? "GET", headers, ...(o.url === undefined ? {} : { url: o.url }) } });
    if (r.kind === "deferred") return { source: "chosen", place: null, usedGeoIp: false, deferred: { at: ask.at, html: r.html } };
    if (r.kind === "place") return { source: "chosen", place: r.place, usedGeoIp: false };
  }
  if (CRAWLER.test(headers.get("user-agent") ?? "")) return none;
  // An objection signal (Art. 21(5) DSGVO, the Datenschutz page § "Ihr Ort"): no lookup at all.
  if (headers.get("sec-gpc") === "1" || headers.get("dnt") === "1") return none;
  const geo = o.geo !== undefined ? o.geo : sharedGeoIp(o.geoipFile);
  if (geo === null) return none;
  const ip = clientIp(headers);
  const rung = serverRung(ip === null ? null : geo.lookup(ip));
  if (rung.kind === "ip") {
    // Owner 2026-10-12: the IP guess is a known position too — a person opening
    // the home asks for its fuel prices (never a crawler: returned above).
    // Only a top-level navigation by a person, never the meta refresh's marked reload (`lib/fuel-refresh.ts`).
    const r = await placeFirstRender(rung.at, lang, { ...o, snap: true, how: "ip", request: { method: o.method ?? "GET", headers, ...(o.url === undefined ? {} : { url: o.url }) } });
    if (r.kind === "deferred") return { source: "ip", place: null, usedGeoIp: true, deferred: { at: rung.at, html: r.html } };
    return r.kind === "place" ? { source: "ip", place: r.place, usedGeoIp: true } : { ...none, usedGeoIp: true };
  }
  if (rung.kind === "outside") {
    // #1070: the same rule as a browser fix — a neighbour's point near the border is answered as its nearest German
    // place (the cards say so), one farther or any other country's address is "all of Germany", never an error.
    if (rung.border === null) return { source: "outside", place: null, usedGeoIp: true };
    const r = await placeFirstRender(rung.border, lang, { ...o, snap: true, how: "ip", request: { method: o.method ?? "GET", headers, ...(o.url === undefined ? {} : { url: o.url }) } });
    if (r.kind === "deferred") return { source: "ip", place: null, usedGeoIp: true, deferred: { at: rung.border, html: r.html } };
    if (r.kind === "place") return { source: "ip", place: r.place, usedGeoIp: true };
    return { source: "outside", place: null, usedGeoIp: true };
  }
  return { ...none, usedGeoIp: true };
}

/**
 * #890: the IP rung of a motorway page — the same checks as the home's (a crawler and an objection signal are not
 * located at all), the cell of a German address or nothing. The address is looked up and dropped here; only the
 * cell goes on, to the digest's around block for this one render.
 */
export function motorwayIpCell(
  headers: { get(n: string): string | null },
  o: { readonly geoipFile: string | undefined; readonly geo?: GeoIp | null },
): { readonly source: "ip" | "none" | "outside"; readonly at: string | null; readonly usedGeoIp: boolean } {
  const none = { source: "none" as const, at: null, usedGeoIp: false };
  if (CRAWLER.test(headers.get("user-agent") ?? "") || headers.get("sec-gpc") === "1" || headers.get("dnt") === "1") return none;
  const geo = o.geo !== undefined ? o.geo : sharedGeoIp(o.geoipFile);
  if (geo === null) return none;
  const ip = clientIp(headers);
  const rung = serverRung(ip === null ? null : geo.lookup(ip));
  if (rung.kind === "ip") return { source: "ip", at: rung.at, usedGeoIp: true };
  // A neighbour's address: its cell too — the block then says how far the motorway is and where to join it in Germany.
  if (rung.kind === "outside" && rung.border !== null) return { source: "ip", at: rung.border, usedGeoIp: true };
  return { source: rung.kind === "outside" ? "outside" : "none", at: null, usedGeoIp: true };
}
